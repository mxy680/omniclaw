import Foundation

struct Message: Identifiable, Codable, Equatable {
    let id: UUID
    let role: Role
    var content: String
    let timestamp: Date
    var isStreaming: Bool
    var attachments: [Attachment]

    enum Role: String, Codable {
        case user
        case assistant
        case system
    }

    init(id: UUID = UUID(), role: Role, content: String, timestamp: Date = Date(), isStreaming: Bool = false, attachments: [Attachment] = []) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.isStreaming = isStreaming
        self.attachments = attachments
    }

    // Backward-compatible decoding for existing conversations without attachments
    enum CodingKeys: String, CodingKey {
        case id, role, content, timestamp, isStreaming, attachments
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        role = try container.decode(Role.self, forKey: .role)
        content = try container.decode(String.self, forKey: .content)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        isStreaming = try container.decode(Bool.self, forKey: .isStreaming)
        attachments = try container.decodeIfPresent([Attachment].self, forKey: .attachments) ?? []
    }
}
