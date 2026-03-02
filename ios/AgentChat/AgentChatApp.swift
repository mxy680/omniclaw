import SwiftUI

@main
struct AgentChatApp: App {
    @StateObject private var store = ConversationStore()
    @StateObject private var agentService = AgentService()
    @AppStorage("gatewayHost") private var host = ""

    var body: some Scene {
        WindowGroup {
            TabView {
                NavigationStack {
                    ConversationListView()
                }
                .tabItem {
                    Label("Messages", systemImage: "message.fill")
                }

                NavigationStack {
                    ScheduleListView()
                }
                .tabItem {
                    Label("Schedules", systemImage: "clock.fill")
                }
            }
            .environmentObject(store)
            .environmentObject(agentService)
            .sheet(isPresented: .constant(host.isEmpty)) {
                SettingsView()
                    .interactiveDismissDisabled(host.isEmpty)
            }
        }
    }
}
