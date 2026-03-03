import SwiftUI

struct ChatView: View {
    let conversationId: UUID
    let agent: Agent

    @EnvironmentObject var store: ConversationStore
    @StateObject private var chatService = ChatService()
    @State private var inputText = ""
    @State private var pendingAttachments: [Attachment] = []
    @State private var errorMessage: String?
    @State private var hasConnected = false
    @State private var showPhotoLibrary = false
    @State private var showCamera = false
    @State private var showDocumentPicker = false
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
                    LazyVStack(spacing: 2) {
                        ForEach(Array(visibleMessages.enumerated()), id: \.element.id) { index, message in
                            let position = bubblePosition(for: index)
                            let showDate = shouldShowDate(at: index)

                            if showDate {
                                DateHeader(date: message.timestamp)
                                    .padding(.top, index == 0 ? 4 : 12)
                                    .padding(.bottom, 8)
                            }

                            MessageBubble(
                                message: message,
                                agentColor: agent.color,
                                position: position
                            )
                            .id(message.id)
                            .padding(.top, topPadding(for: index))
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.bottom, 8)
                }
                .scrollDismissesKeyboard(.interactively)
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

            // Connection banner
            if !chatService.isConnected && hasConnected {
                ConnectionBanner {
                    connectToGateway()
                }
            }

            // Error banner
            if let errorMessage {
                ErrorBanner(message: errorMessage) {
                    self.errorMessage = nil
                }
            }

            // Input bar
            MessageInputBar(
                text: $inputText,
                pendingAttachments: $pendingAttachments,
                isStreaming: chatService.isStreaming,
                isFocused: $isInputFocused,
                onSend: sendMessage,
                onCancel: { chatService.abort() },
                onPickFromLibrary: { showPhotoLibrary = true },
                onPickFromCamera: { showCamera = true },
                onPickFromFiles: { showDocumentPicker = true },
                onRemoveAttachment: { attachment in
                    pendingAttachments.removeAll { $0.id == attachment.id }
                    AttachmentStore.shared.delete(attachments: [attachment])
                }
            )
        }
        .background(Color(.systemBackground))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 1) {
                    ZStack {
                        Circle()
                            .fill(agent.color.gradient)
                            .frame(width: 28, height: 28)
                        Text(agent.initial)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    Text(agent.name)
                        .font(.caption2)
                        .fontWeight(.medium)
                }
                .padding(.top, 2)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(role: .destructive) {
                        store.clearConversation(conversationId)
                    } label: {
                        Label("Clear Chat", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(.blue)
                }
            }
        }
        .sheet(isPresented: $showPhotoLibrary) {
            PhotoLibraryPicker { images in
                for image in images {
                    if let attachment = try? AttachmentStore.shared.saveImage(image, filename: "photo.jpg") {
                        pendingAttachments.append(attachment)
                    }
                }
            }
        }
        .sheet(isPresented: $showCamera) {
            CameraPicker { image in
                if let attachment = try? AttachmentStore.shared.saveImage(image, filename: "camera.jpg") {
                    pendingAttachments.append(attachment)
                }
            }
        }
        .sheet(isPresented: $showDocumentPicker) {
            DocumentPicker { url in
                if let data = try? Data(contentsOf: url) {
                    let filename = url.lastPathComponent
                    if let attachment = try? AttachmentStore.shared.save(
                        data: data, filename: filename, mimeType: "application/pdf"
                    ) {
                        pendingAttachments.append(attachment)
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

    // MARK: - Message Grouping

    private func bubblePosition(for index: Int) -> BubblePosition {
        let messages = visibleMessages
        let current = messages[index]
        let hasPrev = index > 0 && messages[index - 1].role == current.role
        let hasNext = index < messages.count - 1 && messages[index + 1].role == current.role

        // Also break groups at date boundaries
        let prevSameTimeGroup = index > 0 && !shouldShowDate(at: index)
        let nextSameTimeGroup = index < messages.count - 1 && !shouldShowDate(at: index + 1)

        let groupedWithPrev = hasPrev && prevSameTimeGroup
        let groupedWithNext = hasNext && nextSameTimeGroup

        switch (groupedWithPrev, groupedWithNext) {
        case (false, false): return .standalone
        case (false, true):  return .first
        case (true, true):   return .middle
        case (true, false):  return .last
        }
    }

    private func shouldShowDate(at index: Int) -> Bool {
        let messages = visibleMessages
        if index == 0 { return true }
        let current = messages[index].timestamp
        let previous = messages[index - 1].timestamp
        return current.timeIntervalSince(previous) > 300 // 5 minutes
    }

    private func topPadding(for index: Int) -> CGFloat {
        if index == 0 { return 0 }
        let messages = visibleMessages
        let current = messages[index]
        let previous = messages[index - 1]
        if current.role != previous.role {
            return 8 // Extra space between different senders
        }
        return 1
    }

    // MARK: - Networking

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
        let attachments = pendingAttachments
        guard !text.isEmpty || !attachments.isEmpty else { return }

        inputText = ""
        pendingAttachments = []
        errorMessage = nil

        let userMessage = Message(role: .user, content: text, attachments: attachments)
        store.addMessage(userMessage, to: conversationId)

        let assistantMessage = Message(role: .assistant, content: "", isStreaming: true)
        store.addMessage(assistantMessage, to: conversationId)

        var latestContent = ""

        chatService.sendMessage(
            text: text,
            attachments: attachments,
            sessionKey: conversation?.sessionKey ?? "agent:\(agent.id):ios-app",
            onDelta: { fullText in
                latestContent = fullText
                store.updateLastMessage(in: conversationId, content: fullText, isStreaming: true)
            },
            onComplete: {
                store.updateLastMessage(in: conversationId, content: latestContent, isStreaming: false)
            },
            onError: { error in
                errorMessage = error.localizedDescription
                if latestContent.isEmpty {
                    if let index = store.conversations.firstIndex(where: { $0.id == conversationId }) {
                        store.conversations[index].messages.removeLast()
                        store.save()
                    }
                } else {
                    store.updateLastMessage(in: conversationId, content: latestContent, isStreaming: false)
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

// MARK: - Date Header (iMessage-style centered timestamp)

struct DateHeader: View {
    let date: Date

    var body: some View {
        Text(formattedDate)
            .font(.caption2)
            .fontWeight(.medium)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 3)
    }

    private var formattedDate: String {
        let calendar = Calendar.current
        let now = Date()

        if calendar.isDateInToday(date) {
            return date.formatted(date: .omitted, time: .shortened)
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday \(date.formatted(date: .omitted, time: .shortened))"
        } else if calendar.isDate(date, equalTo: now, toGranularity: .weekOfYear) {
            let formatter = DateFormatter()
            formatter.dateFormat = "EEEE h:mm a"
            return formatter.string(from: date)
        } else if calendar.isDate(date, equalTo: now, toGranularity: .year) {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d, h:mm a"
            return formatter.string(from: date)
        } else {
            return date.formatted(date: .abbreviated, time: .shortened)
        }
    }
}

// MARK: - Banners

struct ConnectionBanner: View {
    let onReconnect: () -> Void

    var body: some View {
        HStack {
            Image(systemName: "wifi.slash")
                .foregroundStyle(.orange)
                .font(.caption)
            Text("Disconnected")
                .font(.caption)
            Spacer()
            Button("Reconnect", action: onReconnect)
                .font(.caption.weight(.semibold))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .background(.orange.opacity(0.1))
    }
}

struct ErrorBanner: View {
    let message: String
    let onDismiss: () -> Void

    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)
                .font(.caption)
            Text(message)
                .font(.caption)
                .lineLimit(2)
            Spacer()
            Button("Dismiss", action: onDismiss)
                .font(.caption.weight(.semibold))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .background(.red.opacity(0.1))
    }
}
