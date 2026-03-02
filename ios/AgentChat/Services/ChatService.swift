import Foundation

@MainActor
final class ChatService: ObservableObject {
    @Published var isStreaming = false
    @Published var isConnected = false

    private var webSocket: URLSessionWebSocketTask?
    private var currentRunId: String?
    private var requestCounter = 0
    private var onDelta: ((String) -> Void)?
    private var onComplete: (() -> Void)?
    private var onError: ((Error) -> Void)?
    private var receiveTask: Task<Void, Never>?

    struct ServerConfig {
        var host: String
        var port: Int
        var authToken: String

        var wsURL: URL? {
            URL(string: "ws://\(host):\(port)")
        }
    }

    // MARK: - Connection

    func connect(config: ServerConfig) async throws {
        disconnect()

        guard let url = config.wsURL else {
            throw ChatError.invalidURL
        }

        let session = URLSession(configuration: .default)
        webSocket = session.webSocketTask(with: url)
        webSocket?.resume()

        // Send connect handshake
        let connectFrame = RequestFrame(
            type: "req",
            id: nextRequestId(),
            method: "connect",
            params: ConnectParams(
                minProtocol: 3,
                maxProtocol: 3,
                client: ClientInfo(
                    id: "openclaw-ios",
                    version: "1.0.0",
                    platform: "ios",
                    mode: "cli"
                ),
                auth: AuthInfo(token: config.authToken)
            )
        )

        let data = try JSONEncoder().encode(connectFrame)
        try await webSocket?.send(.string(String(data: data, encoding: .utf8)!))

        // Wait for hello-ok response
        let response = try await receiveOne()
        guard let resData = response.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: resData) as? [String: Any],
              let ok = json["ok"] as? Bool, ok else {
            let errorMsg = extractErrorMessage(from: response) ?? "Connection rejected"
            throw ChatError.connectionRejected(errorMsg)
        }

        isConnected = true
        startReceiving()
    }

    func disconnect() {
        receiveTask?.cancel()
        receiveTask = nil
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        isConnected = false
        isStreaming = false
        currentRunId = nil
    }

    // MARK: - Chat

    func sendMessage(
        text: String,
        sessionKey: String,
        onDelta: @escaping (String) -> Void,
        onComplete: @escaping () -> Void,
        onError: @escaping (Error) -> Void
    ) {
        guard isConnected, let webSocket else {
            onError(ChatError.notConnected)
            return
        }

        self.onDelta = onDelta
        self.onComplete = onComplete
        self.onError = onError
        self.isStreaming = true

        let chatFrame = ChatSendFrame(
            type: "req",
            id: nextRequestId(),
            method: "chat.send",
            params: ChatSendParams(
                sessionKey: sessionKey,
                message: text,
                idempotencyKey: UUID().uuidString
            )
        )

        Task {
            do {
                let data = try JSONEncoder().encode(chatFrame)
                try await webSocket.send(.string(String(data: data, encoding: .utf8)!))
            } catch {
                await MainActor.run {
                    self.isStreaming = false
                    onError(error)
                }
            }
        }
    }

    func abort() {
        guard isConnected, let webSocket, let runId = currentRunId else { return }

        let abortFrame = ChatAbortFrame(
            type: "req",
            id: nextRequestId(),
            method: "chat.abort",
            params: ChatAbortParams(sessionKey: "agent:main:ios-app", runId: runId)
        )

        Task {
            if let data = try? JSONEncoder().encode(abortFrame) {
                try? await webSocket.send(.string(String(data: data, encoding: .utf8)!))
            }
        }

        isStreaming = false
        currentRunId = nil
        onComplete?()
    }

    func testConnection(config: ServerConfig) async throws -> Bool {
        try await connect(config: config)
        disconnect()
        return true
    }

    // MARK: - Receiving

    private func startReceiving() {
        receiveTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self, let webSocket = await self.webSocket else { break }
                do {
                    let message = try await webSocket.receive()
                    switch message {
                    case .string(let text):
                        await self.handleMessage(text)
                    case .data(let data):
                        if let text = String(data: data, encoding: .utf8) {
                            await self.handleMessage(text)
                        }
                    @unknown default:
                        break
                    }
                } catch {
                    if !Task.isCancelled {
                        await MainActor.run { [weak self] in
                            self?.isConnected = false
                            self?.isStreaming = false
                        }
                    }
                    break
                }
            }
        }
    }

    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }

        let type = json["type"] as? String

        if type == "res" {
            // Response to chat.send — extract runId
            if let ok = json["ok"] as? Bool {
                if ok {
                    if let payload = json["payload"] as? [String: Any],
                       let runId = payload["runId"] as? String {
                        currentRunId = runId
                    }
                } else {
                    let errorMsg = extractErrorMessage(json: json)
                    isStreaming = false
                    onError?(ChatError.serverError(errorMsg))
                }
            }
        } else if type == "event" {
            if let event = json["event"] as? String, event == "chat" {
                handleChatEvent(json)
            }
        }
    }

    private func handleChatEvent(_ json: [String: Any]) {
        guard let payload = json["payload"] as? [String: Any],
              let state = payload["state"] as? String else {
            return
        }

        switch state {
        case "delta":
            if let message = payload["message"] as? String {
                onDelta?(message)
            }
        case "final":
            isStreaming = false
            currentRunId = nil
            if let message = payload["message"] as? String {
                onDelta?(message)
            }
            onComplete?()
        case "error":
            isStreaming = false
            currentRunId = nil
            let errorMsg = payload["errorMessage"] as? String ?? "Agent error"
            onError?(ChatError.serverError(errorMsg))
        case "aborted":
            isStreaming = false
            currentRunId = nil
            onComplete?()
        default:
            break
        }
    }

    // MARK: - Helpers

    private func nextRequestId() -> String {
        requestCounter += 1
        return "ios-\(requestCounter)"
    }

    private func receiveOne() async throws -> String {
        guard let webSocket else { throw ChatError.notConnected }
        let message = try await webSocket.receive()
        switch message {
        case .string(let text): return text
        case .data(let data): return String(data: data, encoding: .utf8) ?? ""
        @unknown default: return ""
        }
    }

    private func extractErrorMessage(from text: String) -> String? {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return extractErrorMessage(json: json)
    }

    private func extractErrorMessage(json: [String: Any]) -> String {
        if let error = json["error"] as? [String: Any],
           let message = error["message"] as? String {
            return message
        }
        return "Unknown error"
    }
}

// MARK: - Protocol Frames

struct RequestFrame<P: Encodable>: Encodable {
    let type: String
    let id: String
    let method: String
    let params: P
}

struct ConnectParams: Encodable {
    let minProtocol: Int
    let maxProtocol: Int
    let client: ClientInfo
    let auth: AuthInfo
}

struct ClientInfo: Encodable {
    let id: String
    let version: String
    let platform: String
    let mode: String
}

struct AuthInfo: Encodable {
    let token: String
}

struct ChatSendFrame: Encodable {
    let type: String
    let id: String
    let method: String
    let params: ChatSendParams
}

struct ChatSendParams: Encodable {
    let sessionKey: String
    let message: String
    let idempotencyKey: String
}

struct ChatAbortFrame: Encodable {
    let type: String
    let id: String
    let method: String
    let params: ChatAbortParams
}

struct ChatAbortParams: Encodable {
    let sessionKey: String
    let runId: String
}

// MARK: - Errors

enum ChatError: LocalizedError {
    case invalidURL
    case notConnected
    case connectionRejected(String)
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL"
        case .notConnected:
            return "Not connected to gateway"
        case .connectionRejected(let msg):
            return "Connection rejected: \(msg)"
        case .serverError(let msg):
            return msg
        }
    }
}
