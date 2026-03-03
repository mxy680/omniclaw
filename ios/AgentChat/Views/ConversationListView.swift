import SwiftUI

struct ConversationListView: View {
    @EnvironmentObject var store: ConversationStore
    @EnvironmentObject var agentService: AgentService
    @State private var showSettings = false
    @State private var searchText = ""

    @AppStorage("gatewayHost") private var host = ""
    @AppStorage("gatewayPort") private var port = 18789
    @AppStorage("authToken") private var authToken = ""

    var sortedConversations: [Conversation] {
        let conversations = store.conversations
            .filter { agentService.agent(for: $0.agentId) != nil }
            .sorted { $0.updatedAt > $1.updatedAt }

        if searchText.isEmpty {
            return conversations
        }
        return conversations.filter { conversation in
            let agent = agentService.agent(for: conversation.agentId)
            let nameMatch = agent?.name.localizedCaseInsensitiveContains(searchText) ?? false
            let messageMatch = conversation.lastMessage?.content.localizedCaseInsensitiveContains(searchText) ?? false
            return nameMatch || messageMatch
        }
    }

    var body: some View {
        List(sortedConversations) { conversation in
            if let agent = agentService.agent(for: conversation.agentId) {
                NavigationLink(value: conversation.id) {
                    ConversationRow(conversation: conversation, agent: agent)
                }
            }
        }
        .listStyle(.plain)
        .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search")
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
                    showSettings = true
                } label: {
                    Image(systemName: "gear")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task {
                        await agentService.fetchAgents(host: host, port: port, authToken: authToken)
                        store.ensureDefaultConversations(for: agentService.agents)
                    }
                } label: {
                    Image(systemName: "arrow.clockwise")
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
        .task {
            await agentService.fetchAgents(host: host, port: port, authToken: authToken)
            store.ensureDefaultConversations(for: agentService.agents)
        }
    }
}
