import SwiftUI
import SwiftData

@main
struct OmniClawApp: App {
    @State private var settings = SettingsStore()

    var body: some Scene {
        WindowGroup {
            ContentView(viewModel: ChatViewModel(settings: settings))
        }
        .modelContainer(for: [Conversation.self, PersistentMessage.self])
    }
}
