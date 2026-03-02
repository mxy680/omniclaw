import Foundation

struct Conversation: Identifiable, Codable {
    let id: UUID
    let agentId: String
    var messages: [Message]
    let createdAt: Date
    var updatedAt: Date
    var sessionSuffix: String

    init(id: UUID = UUID(), agentId: String, messages: [Message] = [], createdAt: Date = Date(), updatedAt: Date = Date(), sessionSuffix: String = UUID().uuidString) {
        self.id = id
        self.agentId = agentId
        self.messages = messages
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.sessionSuffix = sessionSuffix
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        agentId = try container.decode(String.self, forKey: .agentId)
        messages = try container.decode([Message].self, forKey: .messages)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        sessionSuffix = try container.decodeIfPresent(String.self, forKey: .sessionSuffix) ?? UUID().uuidString
    }

    /// Gateway session key — changes when the conversation is cleared.
    var sessionKey: String {
        "agent:\(agentId):ios-\(sessionSuffix)"
    }

    var lastMessage: Message? {
        messages.last { $0.role != .system }
    }
}
