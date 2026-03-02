import Foundation

struct ScheduleRun: Identifiable, Codable {
    let id: String
    let jobId: String
    let agentId: String
    let startedAt: Date
    let completedAt: Date?
    let status: RunStatus
    let instruction: String
    let response: String
    let errorMessage: String?
    let durationMs: Int?

    enum RunStatus: String, Codable {
        case running
        case completed
        case error
    }

    var durationFormatted: String? {
        guard let ms = durationMs else { return nil }
        if ms < 1000 { return "\(ms)ms" }
        let seconds = Double(ms) / 1000.0
        if seconds < 60 { return String(format: "%.1fs", seconds) }
        let minutes = seconds / 60
        return String(format: "%.1f min", minutes)
    }
}

struct ScheduleRunsResponse: Codable {
    let runs: [ScheduleRun]
}
