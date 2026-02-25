import SwiftUI

struct MessageBubble: View {
    let message: PersistentMessage

    private var bubbleShape: UnevenRoundedRectangle {
        if message.isUser {
            UnevenRoundedRectangle(
                topLeadingRadius: 18,
                bottomLeadingRadius: 18,
                bottomTrailingRadius: 4,
                topTrailingRadius: 18
            )
        } else {
            UnevenRoundedRectangle(
                topLeadingRadius: 18,
                bottomLeadingRadius: 4,
                bottomTrailingRadius: 18,
                topTrailingRadius: 18
            )
        }
    }

    private var resolvedText: Text {
        if let attributed = try? AttributedString(
            markdown: message.text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        ) {
            return Text(attributed)
        } else {
            return Text(message.text)
        }
    }

    var body: some View {
        HStack {
            if message.isUser { Spacer(minLength: 60) }

            VStack(alignment: message.isUser ? .trailing : .leading, spacing: 6) {
                if !message.toolUses.isEmpty {
                    FlowLayout(spacing: 4) {
                        ForEach(message.toolUses) { tool in
                            ToolUseIndicator(toolUse: tool)
                        }
                    }
                }

                if !message.text.isEmpty {
                    resolvedText
                        .textSelection(.enabled)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .foregroundStyle(message.isUser ? .white : .primary)
                        .background {
                            if message.isUser {
                                bubbleShape.fill(
                                    LinearGradient(
                                        colors: [Color.blue, Color.blue.opacity(0.8)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                            } else {
                                bubbleShape.fill(Color(.systemGray6))
                            }
                        }
                        .overlay {
                            if !message.isUser {
                                bubbleShape.stroke(Color(.systemGray4), lineWidth: 0.5)
                            }
                        }
                }
            }

            if !message.isUser { Spacer(minLength: 60) }
        }
    }
}

/// Simple horizontal flow layout for tool badges.
struct FlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: .unspecified
            )
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalSize: CGSize = .zero

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            totalSize.width = max(totalSize.width, x - spacing)
            totalSize.height = max(totalSize.height, y + rowHeight)
        }

        return (totalSize, positions)
    }
}
