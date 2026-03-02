import Foundation

@MainActor
final class AgentService: ObservableObject {
    @Published var agents: [Agent] = []
    @Published var isLoading = false
    @Published var error: String?

    private struct AgentsResponse: Decodable {
        let agents: [Agent]
    }

    func agent(for id: String) -> Agent? {
        agents.first { $0.id == id }
    }

    func fetchAgents(host: String, port: Int, authToken: String) async {
        guard !host.isEmpty else { return }

        isLoading = true
        error = nil

        guard let url = URL(string: "http://\(host):\(port)/agents") else {
            error = "Invalid MCP server URL"
            isLoading = false
            return
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 10

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                error = "Invalid response"
                isLoading = false
                return
            }

            guard httpResponse.statusCode == 200 else {
                error = "Server returned \(httpResponse.statusCode)"
                isLoading = false
                return
            }

            let decoded = try JSONDecoder().decode(AgentsResponse.self, from: data)
            agents = decoded.agents
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}
