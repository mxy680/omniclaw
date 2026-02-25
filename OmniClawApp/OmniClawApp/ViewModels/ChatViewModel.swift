import Foundation
import SwiftUI
import SwiftData

@Observable
final class ChatViewModel {
    var isTyping = false
    var activeTools: [String] = []
    private(set) var connectionState: ConnectionState = .disconnected

    let settings: SettingsStore
    let webSocket = WebSocketService()
    var modelContext: ModelContext?

    var pendingResponseConversationId: String?
    private var currentStreamingMessage: PersistentMessage?

    init(settings: SettingsStore) {
        self.settings = settings
        webSocket.onMessage = { [weak self] msg in
            Task { @MainActor in
                self?.handleMessage(msg)
            }
        }
    }

    var isConnected: Bool {
        connectionState == .connected
    }

    func connect() {
        guard settings.isConfigured else { return }
        webSocket.connect(url: settings.serverURL, token: settings.authToken)
    }

    func disconnect() {
        webSocket.disconnect()
    }

    func sendMessage(_ text: String, in conversation: Conversation) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        guard let modelContext else { return }

        let userMsg = PersistentMessage(text: text, isUser: true, conversation: conversation)
        modelContext.insert(userMsg)
        conversation.updatedAt = .now

        // Auto-title from first user message
        if conversation.title == "New Chat" {
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            conversation.title = String(trimmed.prefix(40))
        }

        try? modelContext.save()

        pendingResponseConversationId = conversation.id
        currentStreamingMessage = nil
        webSocket.send(.message(text: text, id: userMsg.id))
    }

    func updateConnectionState() {
        connectionState = webSocket.state
    }

    // MARK: - Private

    @MainActor
    private func handleMessage(_ msg: ServerMessage) {
        connectionState = webSocket.state
        guard let modelContext else { return }

        switch msg.type {
        case .authOk, .authFail:
            break

        case .message:
            guard let text = msg.text else { return }

            if let streaming = currentStreamingMessage {
                streaming.text += text
            } else {
                guard let conversation = resolveConversation() else { return }
                let agentMsg = PersistentMessage(
                    id: msg.id ?? UUID().uuidString,
                    text: text,
                    isUser: false,
                    isStreaming: true,
                    conversation: conversation
                )
                modelContext.insert(agentMsg)
                conversation.updatedAt = .now
                currentStreamingMessage = agentMsg
            }
            try? modelContext.save()

        case .typing:
            isTyping = msg.active ?? false
            if !(msg.active ?? false) {
                currentStreamingMessage?.isStreaming = false
                try? modelContext.save()
                currentStreamingMessage = nil
                pendingResponseConversationId = nil
            }

        case .toolUse:
            guard let name = msg.name else { return }
            if msg.phase == "start" {
                activeTools.append(name)
                if let streaming = currentStreamingMessage {
                    var tools = streaming.toolUses
                    tools.append(ToolUseInfo(name: name, phase: "start"))
                    streaming.toolUses = tools
                    try? modelContext.save()
                } else {
                    // Tool use before any message text — create empty agent message
                    guard let conversation = resolveConversation() else { return }
                    let agentMsg = PersistentMessage(
                        text: "",
                        isUser: false,
                        toolUses: [ToolUseInfo(name: name, phase: "start")],
                        isStreaming: true,
                        conversation: conversation
                    )
                    modelContext.insert(agentMsg)
                    conversation.updatedAt = .now
                    currentStreamingMessage = agentMsg
                    try? modelContext.save()
                }
            } else {
                activeTools.removeAll { $0 == name }
                if let streaming = currentStreamingMessage {
                    var tools = streaming.toolUses
                    if let idx = tools.lastIndex(where: { $0.name == name && $0.phase == "start" }) {
                        tools[idx] = ToolUseInfo(id: tools[idx].id, name: name, phase: "end")
                        streaming.toolUses = tools
                        try? modelContext.save()
                    }
                }
            }

        case .error:
            guard let conversation = resolveConversation() else { return }
            let errMsg = PersistentMessage(
                text: "Error: \(msg.message ?? "Unknown error")",
                isUser: false,
                conversation: conversation
            )
            modelContext.insert(errMsg)
            try? modelContext.save()
        }
    }

    private func resolveConversation() -> Conversation? {
        guard let modelContext else { return nil }
        if let id = pendingResponseConversationId {
            let descriptor = FetchDescriptor<Conversation>(predicate: #Predicate { $0.id == id })
            return try? modelContext.fetch(descriptor).first
        }
        // Create orphan conversation if needed
        let conversation = Conversation()
        modelContext.insert(conversation)
        pendingResponseConversationId = conversation.id
        try? modelContext.save()
        return conversation
    }
}
