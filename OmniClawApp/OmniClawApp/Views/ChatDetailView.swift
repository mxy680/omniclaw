import SwiftUI
import SwiftData

struct ChatDetailView: View {
    let conversation: Conversation
    let viewModel: ChatViewModel
    @State private var inputText = ""
    @FocusState private var inputFocused: Bool
    @Query private var messages: [PersistentMessage]

    init(conversation: Conversation, viewModel: ChatViewModel) {
        self.conversation = conversation
        self.viewModel = viewModel
        let conversationId = conversation.id
        _messages = Query(
            filter: #Predicate<PersistentMessage> { msg in
                msg.conversation?.id == conversationId
            },
            sort: \PersistentMessage.timestamp
        )
    }

    private var isActiveConversation: Bool {
        viewModel.pendingResponseConversationId == conversation.id
    }

    private var dateSeparatorMessageIds: Set<String> {
        let calendar = Calendar.current
        var ids = Set<String>()
        for (index, message) in messages.enumerated() {
            if index == 0 || !calendar.isDate(message.timestamp, inSameDayAs: messages[index - 1].timestamp) {
                ids.insert(message.id)
            }
        }
        return ids
    }

    var body: some View {
        VStack(spacing: 0) {
            connectionBanner

            if messages.isEmpty && !(viewModel.isTyping && isActiveConversation) {
                Spacer()
                ContentUnavailableView(
                    "Start a Conversation",
                    systemImage: "text.bubble",
                    description: Text("Send a message to get started")
                )
                Spacer()
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(messages) { message in
                                if dateSeparatorMessageIds.contains(message.id) {
                                    DateSeparatorView(date: message.timestamp)
                                }
                                MessageBubble(message: message)
                                    .id(message.id)
                            }

                            if viewModel.isTyping && isActiveConversation {
                                HStack {
                                    TypingIndicator()
                                    Spacer()
                                }
                                .id("typing")
                            }
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 8)
                    }
                    .onChange(of: messages.count) {
                        withAnimation {
                            if let last = messages.last {
                                proxy.scrollTo(last.id, anchor: .bottom)
                            }
                        }
                    }
                    .onChange(of: viewModel.isTyping) {
                        if viewModel.isTyping && isActiveConversation {
                            withAnimation {
                                proxy.scrollTo("typing", anchor: .bottom)
                            }
                        }
                    }
                }
            }

            Divider()
            inputBar
        }
        .navigationTitle(conversation.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Connection Banner

    @ViewBuilder
    private var connectionBanner: some View {
        let state = viewModel.connectionState
        if state != .connected {
            HStack(spacing: 8) {
                switch state {
                case .disconnected:
                    Image(systemName: "wifi.slash")
                    Text("Disconnected")
                case .connecting, .authenticating:
                    ProgressView()
                        .controlSize(.small)
                    Text("Connecting...")
                case .error(let msg):
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.yellow)
                    Text(msg)
                        .lineLimit(1)
                case .connected:
                    EmptyView()
                }
            }
            .font(.caption)
            .foregroundStyle(.white)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity)
            .background(bannerColor(for: state))
        }
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        HStack(spacing: 8) {
            TextField("Message", text: $inputText, axis: .vertical)
                .lineLimit(1...5)
                .textFieldStyle(.plain)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .focused($inputFocused)

            Button {
                let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !text.isEmpty else { return }
                viewModel.sendMessage(text, in: conversation)
                inputText = ""
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundStyle(
                        inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? .gray : .blue
                    )
            }
            .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !viewModel.isConnected)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    private func bannerColor(for state: ConnectionState) -> Color {
        switch state {
        case .error: .red.opacity(0.85)
        case .connecting, .authenticating: .orange.opacity(0.85)
        default: .gray.opacity(0.85)
        }
    }
}
