import SwiftUI

@main
struct AgentChatApp: App {
    @StateObject private var store = ConversationStore()
    @StateObject private var agentService = AgentService()
    @AppStorage("gatewayHost") private var host = ""

    var body: some Scene {
        WindowGroup {
            ConversationListView()
                .environmentObject(store)
                .environmentObject(agentService)
                .sheet(isPresented: .constant(host.isEmpty)) {
                    SettingsView()
                        .interactiveDismissDisabled(host.isEmpty)
                }
        }
    }
}
