import SwiftUI

enum BubblePosition {
    case standalone
    case first
    case middle
    case last
}

struct MessageBubble: View {
    let message: Message
    let agentColor: Color
    var position: BubblePosition = .standalone

    private var isUser: Bool { message.role == .user }

    private var showTail: Bool {
        position == .standalone || position == .last
    }

    /// Corner radii matching iMessage: large radius everywhere except the tail corner
    private var cornerRadii: RectangleCornerRadii {
        let large: CGFloat = 18
        let small: CGFloat = 4

        switch (isUser, showTail) {
        case (true, true):
            // User bubble with tail: sharp bottom-right
            return RectangleCornerRadii(topLeading: large, bottomLeading: large, bottomTrailing: small, topTrailing: large)
        case (true, false):
            // User bubble grouped (no tail): all large
            return RectangleCornerRadii(topLeading: large, bottomLeading: large, bottomTrailing: large, topTrailing: large)
        case (false, true):
            // Assistant bubble with tail: sharp bottom-left
            return RectangleCornerRadii(topLeading: large, bottomLeading: small, bottomTrailing: large, topTrailing: large)
        case (false, false):
            // Assistant bubble grouped: all large
            return RectangleCornerRadii(topLeading: large, bottomLeading: large, bottomTrailing: large, topTrailing: large)
        }
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            if isUser { Spacer(minLength: 60) }

            if message.isStreaming && message.content.isEmpty {
                TypingIndicator()
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color(.systemGray5))
                    .clipShape(UnevenRoundedRectangle(cornerRadii: cornerRadii))
            } else {
                Text(LocalizedStringKey(message.content))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(isUser ? Color.blue : Color(.systemGray5))
                    .foregroundStyle(isUser ? .white : .primary)
                    .clipShape(UnevenRoundedRectangle(cornerRadii: cornerRadii))
            }

            if !isUser { Spacer(minLength: 60) }
        }
    }
}

// MARK: - Typing Indicator (iMessage-style bouncing dots)

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
