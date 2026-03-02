import SwiftUI

struct Agent: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let role: String
    let systemPrompt: String
    let colorName: String

    var color: Color {
        switch colorName {
        case "blue": return .blue
        case "green": return .green
        case "orange": return .orange
        case "purple": return .purple
        case "red": return .red
        case "teal": return .teal
        case "indigo": return .indigo
        case "pink": return .pink
        default: return .blue
        }
    }

    var initial: String {
        String(name.prefix(1)).uppercased()
    }
}

extension Agent {
    static let allAgents: [Agent] = [
        Agent(
            id: "markus",
            name: "Markus",
            role: "General Assistant",
            systemPrompt: "You are Markus, a helpful and knowledgeable general-purpose assistant. You are concise, thoughtful, and direct. You help with coding, writing, research, planning, and any other task.",
            colorName: "blue"
        ),
    ]

    static func agent(for id: String) -> Agent? {
        allAgents.first { $0.id == id }
    }
}
