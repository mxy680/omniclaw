import SwiftUI

struct DateSeparatorView: View {
    let date: Date

    var body: some View {
        Text(formattedDate)
            .font(.caption)
            .fontWeight(.medium)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 4)
            .background(Color(.systemGray6))
            .clipShape(Capsule())
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
    }

    private var formattedDate: String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .none
            return formatter.string(from: date)
        }
    }
}
