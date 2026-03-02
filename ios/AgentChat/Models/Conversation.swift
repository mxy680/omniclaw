import Foundation

struct Conversation: Identifiable, Codable {
    let id: UUID
    let agentId: String
    var messages: [Message]
    let createdAt: Date
    var updatedAt: Date

    init(id: UUID = UUID(), agentId: String, messages: [Message] = [], createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id
        self.agentId = agentId
        self.messages = messages
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var lastMessage: Message? {
        messages.last { $0.role != .system }
    }
}
