import SwiftUI

enum BubblePosition {
    case standalone  // single message, not grouped
    case first       // first in a group of consecutive same-sender messages
    case middle      // middle of a group
    case last        // last in a group (gets the tail)
}

struct MessageBubble: View {
    let message: Message
    let agentColor: Color
    var position: BubblePosition = .standalone

    private var isUser: Bool { message.role == .user }

    private var showTail: Bool {
        position == .standalone || position == .last
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            if isUser { Spacer(minLength: 60) }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 2) {
                if message.isStreaming && message.content.isEmpty {
                    // Typing indicator bubble
                    TypingIndicator()
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color(.systemGray5))
                        .clipShape(BubbleShape(isUser: false, showTail: showTail))
                } else {
                    Text(LocalizedStringKey(message.content))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(isUser ? Color.blue : Color(.systemGray5))
                        .foregroundStyle(isUser ? .white : .primary)
                        .clipShape(BubbleShape(isUser: isUser, showTail: showTail))
                }
            }

            if !isUser { Spacer(minLength: 60) }
        }
        .padding(showTail ? (isUser ? .trailing : .leading) : [], showTail ? 0 : 0)
    }
}

// MARK: - iMessage Bubble Shape with Tail

struct BubbleShape: Shape {
    let isUser: Bool
    let showTail: Bool

    func path(in rect: CGRect) -> Path {
        let radius: CGFloat = 18
        let tailWidth: CGFloat = 6
        let tailHeight: CGFloat = 6

        if !showTail {
            // Simple rounded rectangle for grouped messages without tail
            return Path(roundedRect: rect, cornerRadius: radius)
        }

        var path = Path()

        if isUser {
            // User bubble with tail on bottom-right
            let tailX = rect.maxX
            let tailY = rect.maxY

            path.move(to: CGPoint(x: rect.minX + radius, y: rect.minY))
            // Top edge
            path.addLine(to: CGPoint(x: rect.maxX - radius, y: rect.minY))
            // Top-right corner
            path.addArc(center: CGPoint(x: rect.maxX - radius, y: rect.minY + radius),
                        radius: radius, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
            // Right edge
            path.addLine(to: CGPoint(x: rect.maxX, y: tailY - radius - tailHeight))
            // Bottom-right corner leading into tail
            path.addArc(center: CGPoint(x: rect.maxX - radius, y: tailY - radius),
                        radius: radius, startAngle: .degrees(0), endAngle: .degrees(45), clockwise: false)
            // Tail curve
            path.addQuadCurve(to: CGPoint(x: tailX + tailWidth, y: tailY),
                              control: CGPoint(x: tailX, y: tailY))
            path.addQuadCurve(to: CGPoint(x: rect.maxX - radius / 2, y: tailY),
                              control: CGPoint(x: tailX - 2, y: tailY))
            // Bottom edge
            path.addLine(to: CGPoint(x: rect.minX + radius, y: tailY))
            // Bottom-left corner
            path.addArc(center: CGPoint(x: rect.minX + radius, y: tailY - radius),
                        radius: radius, startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false)
            // Left edge
            path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + radius))
            // Top-left corner
            path.addArc(center: CGPoint(x: rect.minX + radius, y: rect.minY + radius),
                        radius: radius, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
        } else {
            // Assistant bubble with tail on bottom-left
            let tailX = rect.minX
            let tailY = rect.maxY

            path.move(to: CGPoint(x: rect.minX + radius, y: rect.minY))
            // Top edge
            path.addLine(to: CGPoint(x: rect.maxX - radius, y: rect.minY))
            // Top-right corner
            path.addArc(center: CGPoint(x: rect.maxX - radius, y: rect.minY + radius),
                        radius: radius, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
            // Right edge
            path.addLine(to: CGPoint(x: rect.maxX, y: tailY - radius))
            // Bottom-right corner
            path.addArc(center: CGPoint(x: rect.maxX - radius, y: tailY - radius),
                        radius: radius, startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false)
            // Bottom edge
            path.addLine(to: CGPoint(x: rect.minX + radius / 2, y: tailY))
            // Tail curve
            path.addQuadCurve(to: CGPoint(x: tailX - tailWidth, y: tailY),
                              control: CGPoint(x: tailX + 2, y: tailY))
            path.addQuadCurve(to: CGPoint(x: rect.minX + radius, y: tailY - radius),
                              control: CGPoint(x: tailX, y: tailY))
            // Finish left side after tail
            path.addArc(center: CGPoint(x: rect.minX + radius, y: tailY - radius),
                        radius: radius, startAngle: .degrees(135), endAngle: .degrees(180), clockwise: false)
            // Left edge
            path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + radius))
            // Top-left corner
            path.addArc(center: CGPoint(x: rect.minX + radius, y: rect.minY + radius),
                        radius: radius, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
        }

        path.closeSubpath()
        return path
    }
}

// MARK: - Typing Indicator (iMessage-style three bouncing dots)

struct TypingIndicator: View {
    @State private var dotScales: [CGFloat] = [0.5, 0.5, 0.5]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color(.systemGray2))
                    .frame(width: 8, height: 8)
                    .scaleEffect(dotScales[index])
            }
        }
        .onAppear { startAnimation() }
    }

    private func startAnimation() {
        for i in 0..<3 {
            withAnimation(
                .easeInOut(duration: 0.5)
                .repeatForever(autoreverses: true)
                .delay(Double(i) * 0.15)
            ) {
                dotScales[i] = 1.0
            }
        }
    }
}
