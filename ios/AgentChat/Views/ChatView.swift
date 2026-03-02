import SwiftUI

struct ChatView: View {
    let conversationId: UUID
    let agent: Agent

    @EnvironmentObject var store: ConversationStore
    @StateObject private var chatService = ChatService()
    @State private var inputText = ""
    @State private var errorMessage: String?
    @State private var hasConnected = false
    @FocusState private var isInputFocused: Bool

    @AppStorage("gatewayHost") private var host = ""
    @AppStorage("gatewayPort") private var port = 18789
    @AppStorage("authToken") private var authToken = ""

    private var sessionKey: String {
        "agent:main:ios-\(agent.id)"
    }

    private var conversation: Conversation? {
        store.conversations.first { $0.id == conversationId }
    }

    private var visibleMessages: [Message] {
        conversation?.messages.filter { $0.role != .system } ?? []
    }

    var body: some View {
        VStack(spacing: 0) {
            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(visibleMessages) { message in
                            MessageBubble(message: message, agentColor: agent.color)
                                .id(message.id)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.top, 8)
                    .padding(.bottom, 8)
                }
                .onChange(of: visibleMessages.count) {
                    scrollToBottom(proxy: proxy)
                }
                .onChange(of: visibleMessages.last?.content) {
                    scrollToBottom(proxy: proxy)
                }
                .onAppear {
                    scrollToBottom(proxy: proxy, animated: false)
                }
            }

            // Connection / error banner
            if !chatService.isConnected && hasConnected {
                HStack {
                    Image(systemName: "wifi.slash")
                        .foregroundStyle(.orange)
                    Text("Disconnected from gateway")
                        .font(.caption)
                    Spacer()
                    Button("Reconnect") {
                        connectToGateway()
                    }
                    .font(.caption.weight(.semibold))
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(.orange.opacity(0.1))
            }

            if let errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.yellow)
                    Text(errorMessage)
                        .font(.caption)
                    Spacer()
                    Button("Dismiss") {
                        self.errorMessage = nil
                    }
                    .font(.caption.weight(.semibold))
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(.red.opacity(0.1))
            }

            // Input bar
            MessageInputBar(
                text: $inputText,
                isStreaming: chatService.isStreaming,
                isFocused: $isInputFocused,
                onSend: sendMessage,
                onCancel: { chatService.abort() }
            )
        }
        .navigationTitle(agent.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 12) {
                    Circle()
                        .fill(chatService.isConnected ? .green : .red)
                        .frame(width: 8, height: 8)
                    Menu {
                        Button(role: .destructive) {
                            store.clearConversation(conversationId)
                        } label: {
                            Label("Clear Chat", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .onAppear {
            if !chatService.isConnected {
                connectToGateway()
            }
        }
        .onDisappear {
            chatService.disconnect()
        }
    }

    private func connectToGateway() {
        let config = ChatService.ServerConfig(
            host: host,
            port: port,
            authToken: authToken
        )
        Task {
            do {
                try await chatService.connect(config: config)
                hasConnected = true
            } catch {
                errorMessage = error.localizedDescription
                hasConnected = true
            }
        }
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        inputText = ""
        errorMessage = nil

        // Add user message
        let userMessage = Message(role: .user, content: text)
        store.addMessage(userMessage, to: conversationId)

        // Add placeholder assistant message
        let assistantMessage = Message(role: .assistant, content: "", isStreaming: true)
        store.addMessage(assistantMessage, to: conversationId)

        var accumulated = ""

        chatService.sendMessage(
            text: text,
            sessionKey: sessionKey,
            onDelta: { delta in
                accumulated += delta
                store.updateLastMessage(in: conversationId, content: accumulated, isStreaming: true)
            },
            onComplete: {
                store.updateLastMessage(in: conversationId, content: accumulated, isStreaming: false)
            },
            onError: { error in
                errorMessage = error.localizedDescription
                if accumulated.isEmpty {
                    if let index = store.conversations.firstIndex(where: { $0.id == conversationId }) {
                        store.conversations[index].messages.removeLast()
                        store.save()
                    }
                } else {
                    store.updateLastMessage(in: conversationId, content: accumulated, isStreaming: false)
                }
            }
        )
    }

    private func scrollToBottom(proxy: ScrollViewProxy, animated: Bool = true) {
        guard let lastId = visibleMessages.last?.id else { return }
        if animated {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(lastId, anchor: .bottom)
            }
        } else {
            proxy.scrollTo(lastId, anchor: .bottom)
        }
    }
}
