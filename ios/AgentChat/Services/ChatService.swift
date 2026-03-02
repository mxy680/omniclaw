import Foundation

@MainActor
final class ChatService: ObservableObject {
    @Published var isStreaming = false

    private var currentTask: Task<Void, Never>?

    struct ServerConfig {
        var host: String
        var port: Int
        var authToken: String

        var baseURL: URL? {
            URL(string: "http://\(host):\(port)")
        }
    }

    func sendMessage(
        messages: [Message],
        agent: Agent,
        config: ServerConfig,
        onDelta: @escaping (String) -> Void,
        onComplete: @escaping () -> Void,
        onError: @escaping (Error) -> Void
    ) {
        currentTask?.cancel()

        guard let baseURL = config.baseURL else {
            onError(ChatError.invalidURL)
            return
        }

        let endpoint = baseURL.appendingPathComponent("v1/chat/completions")

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("Bearer \(config.authToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 120

        let apiMessages = buildAPIMessages(messages: messages, agent: agent)
        let body = ChatCompletionRequest(
            model: "openclaw:main",
            messages: apiMessages,
            stream: true
        )

        do {
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            onError(error)
            return
        }

        isStreaming = true

        currentTask = Task {
            defer {
                Task { @MainActor in
                    self.isStreaming = false
                    onComplete()
                }
            }

            do {
                let (bytes, response) = try await URLSession.shared.bytes(for: request)

                guard let httpResponse = response as? HTTPURLResponse else {
                    throw ChatError.invalidResponse
                }

                guard httpResponse.statusCode == 200 else {
                    throw ChatError.httpError(httpResponse.statusCode)
                }

                for try await line in bytes.lines {
                    if Task.isCancelled { break }

                    guard line.hasPrefix("data: ") else { continue }
                    let data = String(line.dropFirst(6))

                    if data == "[DONE]" { break }

                    guard let jsonData = data.data(using: .utf8),
                          let chunk = try? JSONDecoder().decode(ChatCompletionChunk.self, from: jsonData),
                          let content = chunk.choices.first?.delta.content else {
                        continue
                    }

                    await MainActor.run {
                        onDelta(content)
                    }
                }
            } catch is CancellationError {
                // Cancelled — ignore
            } catch {
                if !Task.isCancelled {
                    await MainActor.run {
                        onError(error)
                    }
                }
            }
        }
    }

    func cancel() {
        currentTask?.cancel()
        currentTask = nil
        isStreaming = false
    }

    func testConnection(config: ServerConfig) async throws -> Bool {
        guard let baseURL = config.baseURL else {
            throw ChatError.invalidURL
        }

        let url = baseURL.appendingPathComponent("v1/models")
        var request = URLRequest(url: url)
        request.setValue("Bearer \(config.authToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 10

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChatError.invalidResponse
        }

        return httpResponse.statusCode == 200
    }

    private func buildAPIMessages(messages: [Message], agent: Agent) -> [APIMessage] {
        var apiMessages: [APIMessage] = [
            APIMessage(role: "system", content: agent.systemPrompt)
        ]

        for message in messages where message.role != .system {
            apiMessages.append(APIMessage(
                role: message.role.rawValue,
                content: message.content
            ))
        }

        return apiMessages
    }
}

// MARK: - API Types

struct ChatCompletionRequest: Encodable {
    let model: String
    let messages: [APIMessage]
    let stream: Bool
}

struct APIMessage: Codable {
    let role: String
    let content: String
}

struct ChatCompletionChunk: Decodable {
    let choices: [ChunkChoice]
}

struct ChunkChoice: Decodable {
    let delta: ChunkDelta
}

struct ChunkDelta: Decodable {
    let content: String?
}

// MARK: - Errors

enum ChatError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            switch code {
            case 401: return "Unauthorized — check your auth token"
            case 429: return "Rate limited — try again later"
            default: return "Server error (\(code))"
            }
        }
    }
}
