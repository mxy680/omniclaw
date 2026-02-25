import SwiftUI
import SwiftData

struct ConversationListView: View {
    @Query(sort: \Conversation.updatedAt, order: .reverse) private var conversations: [Conversation]
    @Binding var selectedConversation: Conversation?
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        if conversations.isEmpty {
            ContentUnavailableView(
                "No Conversations",
                systemImage: "bubble.left",
                description: Text("Tap the compose button to start a new chat")
            )
        } else {
            List(selection: $selectedConversation) {
                ForEach(conversations) { conversation in
                    ConversationRowView(conversation: conversation)
                        .tag(conversation)
                }
                .onDelete(perform: deleteConversations)
            }
        }
    }

    private func deleteConversations(at offsets: IndexSet) {
        for index in offsets {
            let conversation = conversations[index]
            if selectedConversation?.id == conversation.id {
                selectedConversation = nil
            }
            modelContext.delete(conversation)
        }
        try? modelContext.save()
    }
}
