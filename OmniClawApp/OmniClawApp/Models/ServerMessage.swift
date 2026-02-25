import Foundation

/// Messages sent from the client to the server.
enum ClientMessage: Encodable {
    case auth(token: String)
    case message(text: String, id: String?)

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .auth(let token):
            try container.encode("auth", forKey: .type)
            try container.encode(token, forKey: .token)
        case .message(let text, let id):
            try container.encode("message", forKey: .type)
            try container.encode(text, forKey: .text)
            try container.encodeIfPresent(id, forKey: .id)
        }
    }

    private enum CodingKeys: String, CodingKey {
        case type, token, text, id
    }
}

/// Messages received from the server.
struct ServerMessage: Decodable {
    let type: MessageType
    let text: String?
    let id: String?
    let reason: String?
    let active: Bool?
    let name: String?
    let phase: String?
    let message: String?

    enum MessageType: String, Decodable {
        case authOk = "auth_ok"
        case authFail = "auth_fail"
        case message
        case typing
        case toolUse = "tool_use"
        case error
    }
}
