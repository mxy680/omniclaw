import SwiftUI

struct ImageAttachmentView: View {
    let attachment: Attachment

    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: 240, maxHeight: 320)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                    .padding(4)
            } else {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.systemGray4))
                    .frame(width: 120, height: 120)
                    .overlay { ProgressView() }
                    .padding(4)
            }
        }
        .onAppear {
            image = AttachmentStore.shared.loadImage(for: attachment)
        }
    }
}
