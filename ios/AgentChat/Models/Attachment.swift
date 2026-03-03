import Foundation

struct Attachment: Identifiable, Codable, Equatable {
    let id: UUID
    let filename: String
    let mimeType: String
    let byteCount: Int

    var fileExtension: String {
        switch mimeType {
        case "image/jpeg": return "jpg"
        case "image/png": return "png"
        case "image/heic": return "heic"
        case "image/gif": return "gif"
        case "application/pdf": return "pdf"
        default: return "bin"
        }
    }

    var isImage: Bool { mimeType.hasPrefix("image/") }
    var isPDF: Bool { mimeType == "application/pdf" }

    init(id: UUID = UUID(), filename: String, mimeType: String, byteCount: Int) {
        self.id = id
        self.filename = filename
        self.mimeType = mimeType
        self.byteCount = byteCount
    }
}
