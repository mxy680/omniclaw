import SwiftUI

struct ChatView: View {
    let conversationId: UUID
    let agent: Agent

    @EnvironmentObject var store: ConversationStore
    @StateObject private var chatService = ChatService()
    @State private var inputText = ""
    @State private var errorMessage: String?
    @FocusState private var isInputFocused: Bool

    @AppStorage("gatewayHost") private var host = ""
    @AppStorage("gatewayPort") private var port = 18789
    @AppStorage("authToken") private var authToken = ""

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

            // Error banner
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
                onCancel: { chatService.cancel() }
            )
        }
        .navigationTitle(agent.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
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

        let config = ChatService.ServerConfig(
            host: host,
            port: port,
            authToken: authToken
        )

        chatService.sendMessage(
            messages: conversation?.messages.filter { !$0.isStreaming } ?? [],
            agent: agent,
            config: config,
            onDelta: { delta in
                accumulated += delta
                store.updateLastMessage(in: conversationId, content: accumulated, isStreaming: true)
            },
            onComplete: {
                store.updateLastMessage(in: conversationId, content: accumulated, isStreaming: false)
            },
            onError: { error in
                errorMessage = error.localizedDescription
                // Remove the empty assistant message on error
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
