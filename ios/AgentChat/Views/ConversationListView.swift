import SwiftUI

struct ConversationListView: View {
    @EnvironmentObject var store: ConversationStore
    @EnvironmentObject var agentService: AgentService
    @State private var showSettings = false

    @AppStorage("gatewayHost") private var host = ""
    @AppStorage("gatewayPort") private var port = 18789
    @AppStorage("authToken") private var authToken = ""

    var sortedConversations: [Conversation] {
        store.conversations
            .filter { agentService.agent(for: $0.agentId) != nil }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    var body: some View {
        NavigationStack {
            List(sortedConversations) { conversation in
                if let agent = agentService.agent(for: conversation.agentId) {
                    NavigationLink(value: conversation.id) {
                        ConversationRow(conversation: conversation, agent: agent)
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Messages")
            .navigationDestination(for: UUID.self) { conversationId in
                if let conversation = store.conversations.first(where: { $0.id == conversationId }),
                   let agent = agentService.agent(for: conversation.agentId) {
                    ChatView(conversationId: conversationId, agent: agent)
                }
            }
            .refreshable {
                await agentService.fetchAgents(host: host, port: port, authToken: authToken)
                store.ensureDefaultConversations(for: agentService.agents)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        Task {
                            await agentService.fetchAgents(host: host, port: port, authToken: authToken)
                            store.ensureDefaultConversations(for: agentService.agents)
                        }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gear")
                    }
                }
            }
            .sheet(isPresented: $showSettings, onDismiss: {
                Task {
                    await agentService.fetchAgents(host: host, port: port, authToken: authToken)
                    store.ensureDefaultConversations(for: agentService.agents)
                }
            }) {
                SettingsView()
            }
            .overlay {
                if agentService.isLoading {
                    ProgressView("Loading agents...")
                } else if agentService.agents.isEmpty {
                    ContentUnavailableView(
                        "No Agents",
                        systemImage: "person.2.slash",
                        description: Text(agentService.error ?? "Configure your server in Settings.")
                    )
                }
            }
        }
        .task {
            await agentService.fetchAgents(host: host, port: port, authToken: authToken)
            store.ensureDefaultConversations(for: agentService.agents)
        }
    }
}
