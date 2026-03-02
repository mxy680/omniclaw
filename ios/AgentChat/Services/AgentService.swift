import Foundation

@MainActor
final class AgentService: ObservableObject {
    @Published var agents: [Agent] = []
    @Published var isLoading = false
    @Published var error: String?

    func agent(for id: String) -> Agent? {
        agents.first { $0.id == id }
    }

    /// Fetch agents from the gateway over WebSocket RPC.
    func fetchAgents(host: String, port: Int, authToken: String) async {
        guard !host.isEmpty else { return }

        isLoading = true
        error = nil

        do {
            agents = try await fetchAgentsViaWS(host: host, port: port, authToken: authToken)
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Connect to gateway WS, authenticate, send agents.list, parse response.
    private func fetchAgentsViaWS(host: String, port: Int, authToken: String) async throws -> [Agent] {
        guard let url = URL(string: "ws://\(host):\(port)") else {
            throw AgentServiceError.invalidURL
        }

        let session = URLSession(configuration: .default)
        let ws = session.webSocketTask(with: url)
        ws.resume()

        defer { ws.cancel(with: .goingAway, reason: nil) }

        // 1. Send connect handshake
        let connectPayload: [String: Any] = [
            "type": "req",
            "id": "agent-svc-1",
            "method": "connect",
            "params": [
                "minProtocol": 3,
                "maxProtocol": 3,
                "client": [
                    "id": "openclaw-ios",
                    "version": "1.0.0",
                    "platform": "ios",
                    "mode": "cli"
                ],
                "role": "operator",
                "scopes": ["operator.read"],
                "auth": ["token": authToken]
            ]
        ]

        let connectData = try JSONSerialization.data(withJSONObject: connectPayload)
        try await ws.send(.string(String(data: connectData, encoding: .utf8)!))

        // 2. Wait for hello-ok (skip events)
        var connected = false
        for _ in 0..<10 {
            let msg = try await receiveString(ws)
            guard let json = parseJSON(msg) else { continue }
            let type = json["type"] as? String
            if type == "event" { continue }
            if type == "res" {
                if json["ok"] as? Bool == true {
                    connected = true
                    break
                } else {
                    throw AgentServiceError.connectionRejected
                }
            }
        }
        guard connected else { throw AgentServiceError.connectionRejected }

        // 3. Send agents.list RPC
        let listPayload: [String: Any] = [
            "type": "req",
            "id": "agent-svc-2",
            "method": "agents.list",
            "params": [String: Any]()
        ]
        let listData = try JSONSerialization.data(withJSONObject: listPayload)
        try await ws.send(.string(String(data: listData, encoding: .utf8)!))

        // 4. Wait for response
        for _ in 0..<10 {
            let msg = try await receiveString(ws)
            guard let json = parseJSON(msg) else { continue }
            let type = json["type"] as? String
            if type == "event" { continue }
            if type == "res" {
                if json["ok"] as? Bool == true,
                   let payload = json["payload"] as? [String: Any],
                   let agentList = payload["agents"] as? [[String: Any]] {
                    return agentList.compactMap { dict in
                        guard let id = dict["id"] as? String else { return nil }
                        let name = dict["name"] as? String ?? id
                        let role = dict["role"] as? String ?? ""
                        let colorName = dict["colorName"] as? String ?? "blue"
                        let services = dict["services"] as? [String] ?? []
                        return Agent(id: id, name: name, role: role, colorName: colorName, services: services)
                    }
                } else {
                    // agents.list not supported — fall back to config-based agents
                    throw AgentServiceError.rpcNotSupported
                }
            }
        }

        throw AgentServiceError.noResponse
    }

    private func receiveString(_ ws: URLSessionWebSocketTask) async throws -> String {
        let message = try await ws.receive()
        switch message {
        case .string(let text): return text
        case .data(let data): return String(data: data, encoding: .utf8) ?? ""
        @unknown default: return ""
        }
    }

    private func parseJSON(_ text: String) -> [String: Any]? {
        guard let data = text.data(using: .utf8) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}

enum AgentServiceError: LocalizedError {
    case invalidURL
    case connectionRejected
    case rpcNotSupported
    case noResponse

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid gateway URL"
        case .connectionRejected: return "Gateway rejected connection"
        case .rpcNotSupported: return "Gateway does not support agents.list"
        case .noResponse: return "No response from gateway"
        }
    }
}
