import Foundation

enum ConnectionState: Equatable {
    case disconnected
    case connecting
    case authenticating
    case connected
    case error(String)
}

@Observable
final class WebSocketService: NSObject, URLSessionWebSocketDelegate {
    private(set) var state: ConnectionState = .disconnected

    private var webSocketTask: URLSessionWebSocketTask?
    private var session: URLSession?
    private var reconnectAttempts = 0
    private var reconnectTask: Task<Void, Never>?
    private var receiveTask: Task<Void, Never>?
    private var intentionalDisconnect = false
    private var pendingToken: String?
    private var pendingURL: String?

    private let maxReconnectDelay: TimeInterval = 30

    var onMessage: ((ServerMessage) -> Void)?

    func connect(url: String, token: String) {
        intentionalDisconnect = false
        reconnectAttempts = 0
        performConnect(url: url, token: token)
    }

    func disconnect() {
        intentionalDisconnect = true
        reconnectTask?.cancel()
        reconnectTask = nil
        receiveTask?.cancel()
        receiveTask = nil
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        pendingToken = nil
        pendingURL = nil
        state = .disconnected
    }

    func send(_ message: ClientMessage) {
        guard let task = webSocketTask else { return }
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(message),
              let text = String(data: data, encoding: .utf8) else { return }
        task.send(.string(text)) { [weak self] error in
            if let error {
                Task { @MainActor in
                    self?.state = .error(error.localizedDescription)
                }
            }
        }
    }

    // MARK: - URLSessionWebSocketDelegate

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        Task { @MainActor in
            guard let token = self.pendingToken else {
                return
            }
            self.state = .authenticating
            self.send(.auth(token: token))
        }
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        Task { @MainActor in
            if !self.intentionalDisconnect {
                self.state = .disconnected
                if let url = self.pendingURL, let token = self.pendingToken {
                    self.scheduleReconnect(url: url, token: token)
                }
            }
        }
    }

    // MARK: - Private

    private func performConnect(url: String, token: String) {
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        receiveTask?.cancel()

        guard let wsURL = URL(string: url) else {
            state = .error("Invalid URL")
            return
        }

        pendingURL = url
        pendingToken = token
        state = .connecting

        let config = URLSessionConfiguration.default
        session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        webSocketTask = session?.webSocketTask(with: wsURL)
        webSocketTask?.resume()

        // Auth is sent in didOpenWithProtocol delegate callback
        // Start receiving messages
        receiveTask = Task { [weak self] in
            await self?.receiveLoop(url: url, token: token)
        }
    }

    private func receiveLoop(url: String, token: String) async {
        while !Task.isCancelled {
            guard let task = webSocketTask else { break }
            do {
                let message = try await task.receive()
                switch message {
                case .string(let text):
                    guard let data = text.data(using: .utf8),
                          let serverMsg = try? JSONDecoder().decode(ServerMessage.self, from: data)
                    else { continue }

                    await MainActor.run {
                        self.handleServerMessage(serverMsg, url: url, token: token)
                    }
                case .data:
                    break
                @unknown default:
                    break
                }
            } catch {
                if Task.isCancelled { break }
                await MainActor.run {
                    if !self.intentionalDisconnect {
                        self.state = .disconnected
                        self.scheduleReconnect(url: url, token: token)
                    }
                }
                break
            }
        }
    }

    @MainActor
    private func handleServerMessage(_ msg: ServerMessage, url: String, token: String) {
        switch msg.type {
        case .authOk:
            state = .connected
            reconnectAttempts = 0
        case .authFail:
            state = .error(msg.reason ?? "Authentication failed")
        default:
            break
        }
        onMessage?(msg)
    }

    private func scheduleReconnect(url: String, token: String) {
        guard !intentionalDisconnect else { return }
        reconnectTask?.cancel()
        let delay = min(pow(2.0, Double(reconnectAttempts)), maxReconnectDelay)
        reconnectAttempts += 1

        reconnectTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                self?.performConnect(url: url, token: token)
            }
        }
    }
}
