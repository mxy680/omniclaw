import SwiftUI
import SwiftData

struct ContentView: View {
    @State var viewModel: ChatViewModel
    @State private var selectedConversation: Conversation?
    @State private var showSettings = false
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        NavigationSplitView {
            ConversationListView(selectedConversation: $selectedConversation, viewModel: viewModel)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button(action: createNewConversation) {
                            Image(systemName: "square.and.pencil")
                        }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showSettings = true } label: {
                            Image(systemName: "gear")
                        }
                    }
                }
                .navigationTitle("omniclaw")
        } detail: {
            if let selectedConversation {
                ChatDetailView(conversation: selectedConversation, viewModel: viewModel)
                    .id(selectedConversation.id)
            } else {
                ContentUnavailableView(
                    "No Conversation Selected",
                    systemImage: "bubble.left.and.bubble.right",
                    description: Text("Select a conversation or start a new one")
                )
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView(settings: viewModel.settings)
                .onDisappear {
                    if viewModel.settings.isConfigured && !viewModel.isConnected {
                        viewModel.connect()
                    }
                }
        }
        .onAppear {
            viewModel.modelContext = modelContext
            viewModel.connect()
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            viewModel.updateConnectionState()
        }
    }

    private func createNewConversation() {
        if let conversation = viewModel.createConversation() {
            selectedConversation = conversation
        }
    }
}
