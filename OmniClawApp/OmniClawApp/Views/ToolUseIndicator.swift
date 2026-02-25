import SwiftUI

struct ToolUseIndicator: View {
    let toolUse: ToolUseInfo

    var body: some View {
        HStack(spacing: 4) {
            if toolUse.phase == "start" {
                ProgressView()
                    .controlSize(.mini)
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .font(.caption2)
                    .foregroundStyle(.green)
            }
            Text(toolUse.name)
                .font(.caption2)
                .fontDesign(.monospaced)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color(.systemGray6))
        .clipShape(Capsule())
    }
}
