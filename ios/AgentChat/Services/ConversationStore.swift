import Foundation

@MainActor
final class ConversationStore: ObservableObject {
    @Published var conversations: [Conversation] = []

    private let fileURL: URL

    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        fileURL = docs.appendingPathComponent("conversations.json")
        load()
    }

    func load() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            ensureDefaultConversations()
            return
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            conversations = try decoder.decode([Conversation].self, from: data)
            ensureDefaultConversations()
        } catch {
            print("Failed to load conversations: \(error)")
            ensureDefaultConversations()
        }
    }

    func save() {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(conversations)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            print("Failed to save conversations: \(error)")
        }
    }

    func conversation(for agentId: String) -> Conversation? {
        conversations.first { $0.agentId == agentId }
    }

    func addMessage(_ message: Message, to conversationId: UUID) {
        guard let index = conversations.firstIndex(where: { $0.id == conversationId }) else { return }
        conversations[index].messages.append(message)
        conversations[index].updatedAt = Date()
        save()
    }

    func updateLastMessage(in conversationId: UUID, content: String, isStreaming: Bool) {
        guard let index = conversations.firstIndex(where: { $0.id == conversationId }),
              !conversations[index].messages.isEmpty else { return }
        let lastIndex = conversations[index].messages.count - 1
        conversations[index].messages[lastIndex].content = content
        conversations[index].messages[lastIndex].isStreaming = isStreaming
        conversations[index].updatedAt = Date()
        if !isStreaming {
            save()
        }
    }

    func clearConversation(_ conversationId: UUID) {
        guard let index = conversations.firstIndex(where: { $0.id == conversationId }) else { return }
        conversations[index].messages.removeAll()
        conversations[index].updatedAt = Date()
        save()
    }

    private func ensureDefaultConversations() {
        for agent in Agent.allAgents {
            if !conversations.contains(where: { $0.agentId == agent.id }) {
                conversations.append(Conversation(agentId: agent.id))
            }
        }
    }
}
