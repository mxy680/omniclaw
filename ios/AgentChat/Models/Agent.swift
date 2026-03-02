import SwiftUI

struct Agent: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let role: String
    let colorName: String
    let services: [String]

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
