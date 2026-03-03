import Foundation

@MainActor
final class ChatService: ObservableObject {
    @Published var isStreaming = false
    @Published var isConnected = false

    private var webSocket: URLSessionWebSocketTask?
    private var currentRunId: String?
    private var currentSessionKey: String?
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
                role: "operator",
                scopes: ["operator.read", "operator.write"],
                auth: AuthInfo(token: config.authToken)
            )
        )

        let data = try JSONEncoder().encode(connectFrame)
        try await webSocket?.send(.string(String(data: data, encoding: .utf8)!))

        // Wait for hello-ok response (skip events like connect.challenge)
        var connected = false
        for _ in 0..<10 {
            let response = try await receiveOne()
            guard let resData = response.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: resData) as? [String: Any] else {
                continue
            }
            let type = json["type"] as? String
            if type == "event" { continue } // Skip events (connect.challenge, health, etc.)
            if type == "res" {
                if let ok = json["ok"] as? Bool, ok {
                    connected = true
                    break
                } else {
                    let errorMsg = extractErrorMessage(json: json)
                    throw ChatError.connectionRejected(errorMsg)
                }
            }
        }
        guard connected else {
            throw ChatError.connectionRejected("No hello-ok received")
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
        currentSessionKey = nil
    }

    // MARK: - Chat

    func sendMessage(
        text: String,
        attachments: [Attachment] = [],
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
        self.currentSessionKey = sessionKey
        self.isStreaming = true

        // Build attachments as content blocks for the Gateway
        var contentBlocks: [ContentBlock]? = nil
        if !attachments.isEmpty {
            var blocks: [ContentBlock] = []
            for attachment in attachments {
                guard let base64 = AttachmentStore.shared.base64Data(for: attachment) else { continue }
                let blockType = attachment.isImage ? "image" : "document"
                blocks.append(ContentBlock(
                    type: blockType,
                    source: ContentBlockSource(type: "base64", mediaType: attachment.mimeType, data: base64)
                ))
            }
            if !blocks.isEmpty {
                contentBlocks = blocks
            }
        }

        let chatFrame = ChatSendFrame(
            type: "req",
            id: nextRequestId(),
            method: "chat.send",
            params: ChatSendParams(
                sessionKey: sessionKey,
                message: text,
                attachments: contentBlocks,
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
        guard isConnected, let webSocket, let runId = currentRunId, let sessionKey = currentSessionKey else { return }

        let abortFrame = ChatAbortFrame(
            type: "req",
            id: nextRequestId(),
            method: "chat.abort",
            params: ChatAbortParams(sessionKey: sessionKey, runId: runId)
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
            guard let self else { return }
            while !Task.isCancelled {
                guard let webSocket = self.webSocket else { break }
                do {
                    let message = try await webSocket.receive()
                    switch message {
                    case .string(let text):
                        self.handleMessage(text)
                    case .data(let data):
                        if let text = String(data: data, encoding: .utf8) {
                            self.handleMessage(text)
                        }
                    @unknown default:
                        break
                    }
                } catch {
                    if !Task.isCancelled {
                        self.isConnected = false
                        self.isStreaming = false
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
        case "delta", "final":
            if let text = extractTextFromMessage(payload["message"]) {
                onDelta?(text)
            }
            if state == "final" {
                isStreaming = false
                currentRunId = nil
                onComplete?()
            }
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

    /// Extracts text from OpenClaw message format:
    /// `{ role: "assistant", content: [{ type: "text", text: "..." }] }`
    private func extractTextFromMessage(_ message: Any?) -> String? {
        guard let msg = message as? [String: Any],
              let content = msg["content"] as? [[String: Any]] else {
            return message as? String
        }
        let texts = content.compactMap { block -> String? in
            guard (block["type"] as? String) == "text" else { return nil }
            return block["text"] as? String
        }
        return texts.isEmpty ? nil : texts.joined()
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
    let role: String
    let scopes: [String]
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
    let attachments: [ContentBlock]?
    let idempotencyKey: String
}

struct ContentBlock: Encodable {
    let type: String
    var text: String?
    var source: ContentBlockSource?

    enum CodingKeys: String, CodingKey {
        case type, text, source
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)
        if let text { try container.encode(text, forKey: .text) }
        if let source { try container.encode(source, forKey: .source) }
    }
}

struct ContentBlockSource: Encodable {
    let type: String
    let mediaType: String
    let data: String

    enum CodingKeys: String, CodingKey {
        case type
        case mediaType = "media_type"
        case data
    }
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
