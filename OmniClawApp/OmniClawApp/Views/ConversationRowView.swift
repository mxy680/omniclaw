import SwiftUI

struct ConversationRowView: View {
    let conversation: Conversation

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(conversation.title)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Text(relativeTimestamp)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let preview = lastMessagePreview {
                Text(preview)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 4)
    }

    private var lastMessagePreview: String? {
        conversation.messages
            .sorted { $0.timestamp < $1.timestamp }
            .last?.text
    }

    private var relativeTimestamp: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: conversation.updatedAt, relativeTo: .now)
    }
}
