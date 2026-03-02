import SwiftUI

@main
struct AgentChatApp: App {
    @StateObject private var store = ConversationStore()
    @AppStorage("gatewayHost") private var host = ""

    var body: some Scene {
        WindowGroup {
            ConversationListView()
                .environmentObject(store)
                .sheet(isPresented: .constant(host.isEmpty)) {
                    SettingsView()
                        .interactiveDismissDisabled(host.isEmpty)
                }
        }
    }
}
