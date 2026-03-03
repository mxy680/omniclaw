import Foundation

struct UploadedAttachment: Codable {
    let id: String
    let filename: String
    let mimeType: String
    let byteCount: Int
}

@MainActor
final class AttachmentUploader {
    static let shared = AttachmentUploader()
    private init() {}

    /// Upload an attachment's data to the MCP server. Returns the server-side metadata.
    func upload(attachment: Attachment, host: String, mcpPort: Int, authToken: String) async throws -> UploadedAttachment {
        guard let data = AttachmentStore.shared.loadData(for: attachment) else {
            throw UploadError.fileNotFound
        }

        guard let url = URL(string: "http://\(host):\(mcpPort)/api/attachments") else {
            throw UploadError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = data
        request.setValue(attachment.mimeType, forHTTPHeaderField: "Content-Type")
        request.setValue(attachment.filename, forHTTPHeaderField: "X-Filename")
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")

        let (responseData, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw UploadError.serverError("Upload failed with status \(statusCode)")
        }

        return try JSONDecoder().decode(UploadedAttachment.self, from: responseData)
    }
}

enum UploadError: LocalizedError {
    case fileNotFound
    case invalidURL
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .fileNotFound: return "Attachment file not found"
        case .invalidURL: return "Invalid MCP server URL"
        case .serverError(let msg): return msg
        }
    }
}
