import SwiftUI
import QuickLook

struct PDFAttachmentView: View {
    let attachment: Attachment

    @State private var previewURL: URL?

    var body: some View {
        Button {
            previewURL = AttachmentStore.shared.fileURL(for: attachment)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "doc.richtext")
                    .font(.title3)
                    .foregroundStyle(.red)
                VStack(alignment: .leading, spacing: 2) {
                    Text(attachment.filename)
                        .font(.caption)
                        .fontWeight(.medium)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Text(formattedSize)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(10)
            .frame(maxWidth: 220)
        }
        .buttonStyle(.plain)
        .quickLookPreview($previewURL)
    }

    private var formattedSize: String {
        ByteCountFormatter.string(fromByteCount: Int64(attachment.byteCount), countStyle: .file)
    }
}
