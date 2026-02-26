import Foundation

/// Messages sent from the client to the server.
enum ClientMessage: Encodable {
    case auth(token: String)
    case message(text: String, id: String?, conversationId: String)
    case conversationList
    case conversationCreate(id: String, title: String?)
    case conversationHistory(conversationId: String, before: Int?, limit: Int?)
    case conversationDelete(conversationId: String)
    case conversationRename(conversationId: String, title: String)

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .auth(let token):
            try container.encode("auth", forKey: .type)
            try container.encode(token, forKey: .token)
        case .message(let text, let id, let conversationId):
            try container.encode("message", forKey: .type)
            try container.encode(text, forKey: .text)
            try container.encodeIfPresent(id, forKey: .id)
            try container.encode(conversationId, forKey: .conversationId)
        case .conversationList:
            try container.encode("conversation_list", forKey: .type)
        case .conversationCreate(let id, let title):
            try container.encode("conversation_create", forKey: .type)
            try container.encode(id, forKey: .id)
            try container.encodeIfPresent(title, forKey: .title)
        case .conversationHistory(let conversationId, let before, let limit):
            try container.encode("conversation_history", forKey: .type)
            try container.encode(conversationId, forKey: .conversationId)
            try container.encodeIfPresent(before, forKey: .before)
            try container.encodeIfPresent(limit, forKey: .limit)
        case .conversationDelete(let conversationId):
            try container.encode("conversation_delete", forKey: .type)
            try container.encode(conversationId, forKey: .conversationId)
        case .conversationRename(let conversationId, let title):
            try container.encode("conversation_rename", forKey: .type)
            try container.encode(conversationId, forKey: .conversationId)
            try container.encode(title, forKey: .title)
        }
    }

    private enum CodingKeys: String, CodingKey {
        case type, token, text, id, conversationId, title, before, limit
    }
}

/// Conversation data from the server.
struct ConversationData: Decodable {
    let id: String
    let title: String
    let createdAt: Int
    let updatedAt: Int
}

/// Message data from the server (conversation history).
struct MessageData: Decodable {
    let id: String
    let conversationId: String
    let text: String
    let isUser: Bool
    let timestamp: Int
    let toolUses: [ToolUseData]?
    let isStreaming: Bool
}

struct ToolUseData: Decodable {
    let name: String
    let phase: String
}

/// Messages received from the server.
struct ServerMessage: Decodable {
    let type: MessageType
    // Existing fields
    let text: String?
    let id: String?
    let reason: String?
    let active: Bool?
    let name: String?
    let phase: String?
    let message: String?
    let isUser: Bool?
    // Conversation fields
    let conversationId: String?
    let title: String?
    let conversations: [ConversationData]?
    let conversation: ConversationData?
    let messages: [MessageData]?

    enum MessageType: String, Decodable {
        case authOk = "auth_ok"
        case authFail = "auth_fail"
        case message
        case typing
        case toolUse = "tool_use"
        case error
        case conversationList = "conversation_list"
        case conversationCreated = "conversation_created"
        case conversationHistory = "conversation_history"
        case conversationDeleted = "conversation_deleted"
        case conversationRenamed = "conversation_renamed"
        case conversationUpdated = "conversation_updated"
    }
}
