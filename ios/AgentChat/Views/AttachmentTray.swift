import SwiftUI

struct AttachmentTray: View {
    let attachments: [Attachment]
    let onRemove: (Attachment) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(attachments) { attachment in
                    AttachmentChip(attachment: attachment) {
                        onRemove(attachment)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .background(Color(.systemGray6).opacity(0.5))
    }
}

struct AttachmentChip: View {
    let attachment: Attachment
    let onRemove: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if attachment.isImage {
                    if let image = AttachmentStore.shared.loadImage(for: attachment) {
                        Image(uiImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 64, height: 64)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else {
                        placeholder
                    }
                } else if attachment.isPDF {
                    VStack(spacing: 4) {
                        Image(systemName: "doc.richtext")
                            .font(.title3)
                            .foregroundStyle(.red)
                        Text(attachment.filename)
                            .font(.caption2)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                    .frame(width: 64, height: 64)
                    .background(Color(.systemGray5))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }

            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(.white, .gray)
            }
            .offset(x: 6, y: -6)
        }
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color(.systemGray4))
            .frame(width: 64, height: 64)
            .overlay {
                Image(systemName: "photo")
                    .foregroundStyle(.secondary)
            }
    }
}
