import Foundation

struct ScheduleJob: Identifiable, Codable {
    let id: String
    let name: String
    let agentId: String
    let cron: String
    let instructionFile: String
    let enabled: Bool
    let timezone: String?
    let description: String?
    let createdAt: Date
    let updatedAt: Date
    // Enriched fields from API
    let nextRun: Date?
    let isRunning: Bool?

    enum CodingKeys: String, CodingKey {
        case id, name, agentId, cron, instructionFile, enabled, timezone
        case description, createdAt, updatedAt, nextRun, isRunning
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        agentId = try container.decode(String.self, forKey: .agentId)
        cron = try container.decode(String.self, forKey: .cron)
        instructionFile = try container.decode(String.self, forKey: .instructionFile)
        enabled = try container.decode(Bool.self, forKey: .enabled)
        timezone = try container.decodeIfPresent(String.self, forKey: .timezone)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        nextRun = try container.decodeIfPresent(Date.self, forKey: .nextRun)
        isRunning = try container.decodeIfPresent(Bool.self, forKey: .isRunning)
    }
}

struct ScheduleJobsResponse: Codable {
    let jobs: [ScheduleJob]
}
