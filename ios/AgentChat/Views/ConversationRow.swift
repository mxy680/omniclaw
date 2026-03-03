import SwiftUI

struct ConversationRow: View {
    let conversation: Conversation
    let agent: Agent

    var body: some View {
        HStack(spacing: 12) {
            // Avatar — iMessage-style gradient circle with initial
            ZStack {
                Circle()
                    .fill(agent.color.gradient)
                    .frame(width: 48, height: 48)
                Text(agent.initial)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.white)
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(agent.name)
                        .font(.body.weight(.semibold))
                        .lineLimit(1)
                    Spacer()
                    if let lastMessage = conversation.lastMessage {
                        Text(formattedTimestamp(lastMessage.timestamp))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                if let lastMessage = conversation.lastMessage {
                    Text(lastMessage.content.isEmpty ? "..." : lastMessage.content)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                } else {
                    Text(agent.role)
                        .font(.subheadline)
                        .foregroundStyle(.tertiary)
                        .lineLimit(2)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func formattedTimestamp(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return date.formatted(date: .omitted, time: .shortened)
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else if calendar.isDate(date, equalTo: Date(), toGranularity: .weekOfYear) {
            let formatter = DateFormatter()
            formatter.dateFormat = "EEEE"
            return formatter.string(from: date)
        } else {
            return date.formatted(date: .numeric, time: .omitted)
        }
    }
}
