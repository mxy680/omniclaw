import Foundation

@MainActor
final class ScheduleService: ObservableObject {
    @Published var jobs: [ScheduleJob] = []
    @Published var isLoading = false
    @Published var error: String?

    private func baseURL(host: String, port: Int) -> String {
        "http://\(host):\(port)"
    }

    private func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    func fetchSchedules(host: String, mcpPort: Int, authToken: String) async {
        isLoading = true
        error = nil

        guard let url = URL(string: "\(baseURL(host: host, port: mcpPort))/api/schedules") else {
            error = "Invalid URL"
            isLoading = false
            return
        }

        var request = URLRequest(url: url)
        request.addValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try makeDecoder().decode(ScheduleJobsResponse.self, from: data)
            jobs = response.jobs
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func fetchRuns(
        jobId: String,
        host: String,
        mcpPort: Int,
        authToken: String,
        limit: Int = 20
    ) async -> [ScheduleRun] {
        guard let url = URL(string:
            "\(baseURL(host: host, port: mcpPort))/api/schedules/\(jobId)/runs?limit=\(limit)"
        ) else { return [] }

        var request = URLRequest(url: url)
        request.addValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try makeDecoder().decode(ScheduleRunsResponse.self, from: data)
            return response.runs
        } catch {
            return []
        }
    }

    func triggerJob(
        jobId: String,
        host: String,
        mcpPort: Int,
        authToken: String
    ) async -> Bool {
        guard let url = URL(string:
            "\(baseURL(host: host, port: mcpPort))/api/schedules/\(jobId)/trigger"
        ) else { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }
}
