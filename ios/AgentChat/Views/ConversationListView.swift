import SwiftUI

struct ConversationListView: View {
    @EnvironmentObject var store: ConversationStore
    @State private var showSettings = false

    var sortedConversations: [Conversation] {
        store.conversations.sorted { $0.updatedAt > $1.updatedAt }
    }

    var body: some View {
        NavigationStack {
            List(sortedConversations) { conversation in
                if let agent = conversation.agent {
                    NavigationLink(value: conversation.id) {
                        ConversationRow(conversation: conversation, agent: agent)
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Messages")
            .navigationDestination(for: UUID.self) { conversationId in
                if let conversation = store.conversations.first(where: { $0.id == conversationId }),
                   let agent = conversation.agent {
                    ChatView(conversationId: conversationId, agent: agent)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gear")
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
        }
    }
}
