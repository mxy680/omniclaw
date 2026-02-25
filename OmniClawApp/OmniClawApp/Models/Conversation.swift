import Foundation
import SwiftData

@Model
final class Conversation {
    @Attribute(.unique) var id: String
    var title: String
    var createdAt: Date
    var updatedAt: Date
    @Relationship(deleteRule: .cascade, inverse: \PersistentMessage.conversation)
    var messages: [PersistentMessage]

    init(
        id: String = UUID().uuidString,
        title: String = "New Chat",
        createdAt: Date = .now,
        updatedAt: Date = .now,
        messages: [PersistentMessage] = []
    ) {
        self.id = id
        self.title = title
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.messages = messages
    }
}
