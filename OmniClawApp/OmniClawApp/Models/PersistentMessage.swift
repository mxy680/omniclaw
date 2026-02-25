import Foundation
import SwiftData

struct ToolUseInfo: Codable, Identifiable {
    let id: String
    let name: String
    var phase: String

    init(id: String = UUID().uuidString, name: String, phase: String) {
        self.id = id
        self.name = name
        self.phase = phase
    }
}

@Model
final class PersistentMessage {
    @Attribute(.unique) var id: String
    var text: String
    var isUser: Bool
    var timestamp: Date
    var toolUsesData: Data?
    var isStreaming: Bool
    var conversation: Conversation?

    var toolUses: [ToolUseInfo] {
        get {
            guard let data = toolUsesData else { return [] }
            return (try? JSONDecoder().decode([ToolUseInfo].self, from: data)) ?? []
        }
        set {
            toolUsesData = try? JSONEncoder().encode(newValue)
        }
    }

    init(
        id: String = UUID().uuidString,
        text: String,
        isUser: Bool,
        timestamp: Date = .now,
        toolUses: [ToolUseInfo] = [],
        isStreaming: Bool = false,
        conversation: Conversation? = nil
    ) {
        self.id = id
        self.text = text
        self.isUser = isUser
        self.timestamp = timestamp
        self.toolUsesData = try? JSONEncoder().encode(toolUses)
        self.isStreaming = isStreaming
        self.conversation = conversation
    }
}
