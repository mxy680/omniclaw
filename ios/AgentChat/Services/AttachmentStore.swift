import Foundation
import UIKit

@MainActor
final class AttachmentStore {
    static let shared = AttachmentStore()

    private let baseDir: URL

    private init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        baseDir = docs.appendingPathComponent("attachments", isDirectory: true)
        try? FileManager.default.createDirectory(at: baseDir, withIntermediateDirectories: true)
    }

    func fileURL(for attachment: Attachment) -> URL {
        baseDir.appendingPathComponent("\(attachment.id.uuidString).\(attachment.fileExtension)")
    }

    func save(data: Data, filename: String, mimeType: String) throws -> Attachment {
        let attachment = Attachment(filename: filename, mimeType: mimeType, byteCount: data.count)
        try data.write(to: fileURL(for: attachment), options: .atomic)
        return attachment
    }

    /// Compress a UIImage to JPEG and save. Returns nil if result exceeds 10MB.
    func saveImage(_ image: UIImage, filename: String, quality: CGFloat = 0.7) throws -> Attachment? {
        guard let data = image.jpegData(compressionQuality: quality) else { return nil }
        guard data.count <= 10 * 1024 * 1024 else { return nil }
        return try save(data: data, filename: filename, mimeType: "image/jpeg")
    }

    func loadData(for attachment: Attachment) -> Data? {
        try? Data(contentsOf: fileURL(for: attachment))
    }

    func loadImage(for attachment: Attachment) -> UIImage? {
        guard attachment.isImage, let data = loadData(for: attachment) else { return nil }
        return UIImage(data: data)
    }

    func delete(attachments: [Attachment]) {
        for attachment in attachments {
            try? FileManager.default.removeItem(at: fileURL(for: attachment))
        }
    }

    func base64Data(for attachment: Attachment) -> String? {
        loadData(for: attachment)?.base64EncodedString()
    }
}
