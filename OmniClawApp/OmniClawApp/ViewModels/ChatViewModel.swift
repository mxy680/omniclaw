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
        webSocket.send(.message(text: text, id: userMsg.id, conversationId: conversation.id))
    }

    func createConversation(title: String? = nil) -> Conversation? {
        guard let modelContext else { return nil }
        let conversation = Conversation(title: title ?? "New Chat")
        modelContext.insert(conversation)
        try? modelContext.save()
        // Notify server
        webSocket.send(.conversationCreate(id: conversation.id, title: title))
        return conversation
    }

    func deleteConversation(_ conversation: Conversation) {
        guard let modelContext else { return }
        let id = conversation.id
        modelContext.delete(conversation)
        try? modelContext.save()
        webSocket.send(.conversationDelete(conversationId: id))
    }

    func renameConversation(_ conversation: Conversation, title: String) {
        conversation.title = title
        try? modelContext?.save()
        webSocket.send(.conversationRename(conversationId: conversation.id, title: title))
    }

    func requestConversationList() {
        webSocket.send(.conversationList)
    }

    func requestConversationHistory(_ conversationId: String) {
        webSocket.send(.conversationHistory(conversationId: conversationId, before: nil, limit: 100))
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
        case .authOk:
            // Request conversation list on auth
            requestConversationList()

        case .authFail:
            break

        case .conversationList:
            guard let serverConversations = msg.conversations else { return }
            reconcileConversations(serverConversations)

        case .conversationCreated:
            guard let convData = msg.conversation else { return }
            // Only insert if we don't already have it locally
            let createdId = convData.id
            let descriptor = FetchDescriptor<Conversation>(predicate: #Predicate { $0.id == createdId })
            let existing = (try? modelContext.fetch(descriptor))?.first
            if existing == nil {
                let conversation = Conversation(
                    id: convData.id,
                    title: convData.title,
                    createdAt: Date(timeIntervalSince1970: Double(convData.createdAt) / 1000),
                    updatedAt: Date(timeIntervalSince1970: Double(convData.updatedAt) / 1000)
                )
                modelContext.insert(conversation)
                try? modelContext.save()
            }

        case .conversationDeleted:
            guard let convId = msg.conversationId else { return }
            let descriptor = FetchDescriptor<Conversation>(predicate: #Predicate { $0.id == convId })
            if let conversation = (try? modelContext.fetch(descriptor))?.first {
                modelContext.delete(conversation)
                try? modelContext.save()
            }

        case .conversationRenamed:
            guard let convId = msg.conversationId, let title = msg.title else { return }
            let descriptor = FetchDescriptor<Conversation>(predicate: #Predicate { $0.id == convId })
            if let conversation = (try? modelContext.fetch(descriptor))?.first {
                conversation.title = title
                try? modelContext.save()
            }

        case .conversationUpdated:
            guard let convData = msg.conversation else { return }
            let updatedId = convData.id
            let descriptor = FetchDescriptor<Conversation>(predicate: #Predicate { $0.id == updatedId })
            if let conversation = (try? modelContext.fetch(descriptor))?.first {
                conversation.title = convData.title
                conversation.updatedAt = Date(timeIntervalSince1970: Double(convData.updatedAt) / 1000)
                try? modelContext.save()
            }

        case .conversationHistory:
            guard let convId = msg.conversationId, let serverMessages = msg.messages else { return }
            populateHistory(conversationId: convId, serverMessages: serverMessages)

        case .message:
            guard let text = msg.text else { return }
            let convId = msg.conversationId

            // User message broadcast from another client
            if msg.isUser == true {
                guard let conversation = resolveConversation(forId: convId) else { return }
                let userMsg = PersistentMessage(
                    id: msg.id ?? UUID().uuidString,
                    text: text,
                    isUser: true,
                    conversation: conversation
                )
                modelContext.insert(userMsg)
                conversation.updatedAt = .now
                try? modelContext.save()
                return
            }

            // Agent message (streaming)
            if let streaming = currentStreamingMessage {
                streaming.text += text
            } else {
                guard let conversation = resolveConversation(forId: convId) else { return }
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
                    let convId = msg.conversationId
                    guard let conversation = resolveConversation(forId: convId) else { return }
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
            let convId = msg.conversationId
            guard let conversation = resolveConversation(forId: convId) else { return }
            let errMsg = PersistentMessage(
                text: "Error: \(msg.message ?? "Unknown error")",
                isUser: false,
                conversation: conversation
            )
            modelContext.insert(errMsg)
            try? modelContext.save()
        }
    }

    private func resolveConversation(forId conversationId: String? = nil) -> Conversation? {
        guard let modelContext else { return nil }
        // Try the explicit conversationId first
        if let id = conversationId ?? pendingResponseConversationId {
            let descriptor = FetchDescriptor<Conversation>(predicate: #Predicate { $0.id == id })
            return try? modelContext.fetch(descriptor).first
        }
        // Create orphan conversation if needed
        let conversation = Conversation()
        modelContext.insert(conversation)
        pendingResponseConversationId = conversation.id
        try? modelContext.save()
        // Notify server of the new conversation
        webSocket.send(.conversationCreate(id: conversation.id, title: nil))
        return conversation
    }

    private func reconcileConversations(_ serverConversations: [ConversationData]) {
        guard let modelContext else { return }

        // Fetch all local conversations
        let descriptor = FetchDescriptor<Conversation>()
        let localConversations = (try? modelContext.fetch(descriptor)) ?? []
        let localById = Dictionary(uniqueKeysWithValues: localConversations.map { ($0.id, $0) })
        let serverIds = Set(serverConversations.map(\.id))

        // Upsert from server
        for convData in serverConversations {
            if let local = localById[convData.id] {
                // Update if server is newer
                let serverUpdated = Date(timeIntervalSince1970: Double(convData.updatedAt) / 1000)
                if serverUpdated > local.updatedAt {
                    local.title = convData.title
                    local.updatedAt = serverUpdated
                }
            } else {
                // Insert new from server
                let conversation = Conversation(
                    id: convData.id,
                    title: convData.title,
                    createdAt: Date(timeIntervalSince1970: Double(convData.createdAt) / 1000),
                    updatedAt: Date(timeIntervalSince1970: Double(convData.updatedAt) / 1000)
                )
                modelContext.insert(conversation)
            }
        }

        // Delete local conversations not on server (server is source of truth)
        for local in localConversations {
            if !serverIds.contains(local.id) {
                modelContext.delete(local)
            }
        }

        try? modelContext.save()
    }

    private func populateHistory(conversationId: String, serverMessages: [MessageData]) {
        guard let modelContext else { return }
        let descriptor = FetchDescriptor<Conversation>(predicate: #Predicate { $0.id == conversationId })
        guard let conversation = (try? modelContext.fetch(descriptor))?.first else { return }

        // Build set of existing message IDs
        let existingIds = Set(conversation.messages.map(\.id))

        for msgData in serverMessages {
            if existingIds.contains(msgData.id) { continue }
            let toolUses = (msgData.toolUses ?? []).map {
                ToolUseInfo(name: $0.name, phase: $0.phase)
            }
            let pm = PersistentMessage(
                id: msgData.id,
                text: msgData.text,
                isUser: msgData.isUser,
                timestamp: Date(timeIntervalSince1970: Double(msgData.timestamp) / 1000),
                toolUses: toolUses,
                isStreaming: msgData.isStreaming,
                conversation: conversation
            )
            modelContext.insert(pm)
        }

        try? modelContext.save()
    }
}
