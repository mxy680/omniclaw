import SwiftUI

struct MessageInputBar: View {
    @Binding var text: String
    @Binding var pendingAttachments: [Attachment]
    let isStreaming: Bool
    var isFocused: FocusState<Bool>.Binding
    let onSend: () -> Void
    let onCancel: () -> Void
    let onPickFromLibrary: () -> Void
    let onPickFromCamera: () -> Void
    let onPickFromFiles: () -> Void
    let onRemoveAttachment: (Attachment) -> Void

    private var canSend: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !pendingAttachments.isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            if !pendingAttachments.isEmpty {
                AttachmentTray(
                    attachments: pendingAttachments,
                    onRemove: onRemoveAttachment
                )
            }

            HStack(alignment: .bottom, spacing: 8) {
                // Attachment menu
                Menu {
                    Button { onPickFromLibrary() } label: {
                        Label("Photo Library", systemImage: "photo.on.rectangle")
                    }
                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        Button { onPickFromCamera() } label: {
                            Label("Camera", systemImage: "camera")
                        }
                    }
                    Button { onPickFromFiles() } label: {
                        Label("Browse Files", systemImage: "doc")
                    }
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(.blue)
                }

                // Text field in iMessage-style capsule
                HStack(alignment: .bottom, spacing: 0) {
                    TextField("Message", text: $text, axis: .vertical)
                        .textFieldStyle(.plain)
                        .lineLimit(1...6)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .focused(isFocused)
                }
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color(.systemGray4), lineWidth: 0.5)
                )

                // Send / Stop button
                if isStreaming {
                    Button(action: onCancel) {
                        Image(systemName: "stop.circle.fill")
                            .font(.system(size: 28))
                            .foregroundStyle(.red)
                    }
                    .transition(.scale.combined(with: .opacity))
                } else if canSend {
                    Button(action: onSend) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 28))
                            .foregroundStyle(.blue)
                    }
                    .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
        }
        .background(.bar)
        .animation(.easeInOut(duration: 0.15), value: canSend)
        .animation(.easeInOut(duration: 0.15), value: isStreaming)
        .animation(.easeInOut(duration: 0.2), value: pendingAttachments.count)
    }
}
