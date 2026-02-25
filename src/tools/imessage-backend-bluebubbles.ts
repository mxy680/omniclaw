import type { BlueBubblesClientManager } from "../auth/bluebubbles-client-manager.js";
import type {
  IMessageBackend,
  ContactResult,
  ChatResult,
  MessageResult,
  SearchMessageResult,
  SendResult,
  AttachmentResult,
} from "./imessage-backend.js";

/**
 * Convert a BlueBubbles ms-epoch timestamp to an ISO date string.
 */
function bbToIso(ts: number | null | undefined): string | null {
  if (!ts) return null;
  return new Date(ts).toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BBResponse = { status: number; data: any };

export class BlueBubblesMessageBackend implements IMessageBackend {
  private account: string;

  constructor(
    private manager: BlueBubblesClientManager,
    account = "default",
  ) {
    this.account = account;
  }

  /**
   * Build a map of phone/email → display name from the Contacts API.
   */
  private async fetchContactNames(): Promise<Map<string, string>> {
    const nameMap = new Map<string, string>();
    try {
      const res = (await this.manager.get(
        this.account,
        "/api/v1/contact",
      )) as BBResponse;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const c of res.data ?? []) {
        const name = c.displayName || [c.firstName, c.lastName].filter(Boolean).join(" ") || null;
        if (!name) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const p of c.phoneNumbers ?? []) {
          const addr = typeof p === "string" ? p : p.address ?? p.value;
          if (addr) nameMap.set(addr, name);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const e of c.emails ?? []) {
          const addr = typeof e === "string" ? e : e.address ?? e.value;
          if (addr) nameMap.set(addr.toLowerCase(), name);
        }
      }
    } catch {
      // Contacts API may not be available — silently fall back
    }
    return nameMap;
  }

  async getContacts(params: {
    search?: string;
    limit?: number;
  }): Promise<{ count: number; contacts: ContactResult[] }> {
    const limit = params.limit ?? 50;

    // Fetch handles and contact names in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = {
      limit,
      offset: 0,
      sort: "lastMessage",
      with: [],
    };

    if (params.search) {
      body.where = [
        {
          statement: "handle.id LIKE :query",
          args: { query: `%${params.search}%` },
        },
      ];
    }

    const [handleRes, nameMap] = await Promise.all([
      this.manager.post(this.account, "/api/v1/handle/query", body) as Promise<BBResponse>,
      this.fetchContactNames(),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contacts: ContactResult[] = (handleRes.data ?? []).map((h: any) => {
      const identifier = h.address ?? h.id ?? "";
      return {
        handle_id: h.originalROWID ?? h.ROWID ?? 0,
        identifier,
        service: h.service ?? "iMessage",
        name: nameMap.get(identifier) ?? nameMap.get(identifier.toLowerCase()) ?? null,
      };
    });

    return { count: contacts.length, contacts };
  }

  async getChats(params: {
    limit?: number;
  }): Promise<{ count: number; chats: ChatResult[] }> {
    const limit = params.limit ?? 20;

    const res = (await this.manager.post(this.account, "/api/v1/chat/query", {
      limit,
      offset: 0,
      sort: "lastmessage",
      with: ["lastMessage", "participants"],
    })) as BBResponse;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chats: ChatResult[] = (res.data ?? []).map((chat: any) => ({
      chat_id: chat.guid ?? chat.chatIdentifier ?? "",
      display_name: chat.displayName || null,
      is_group: chat.style === 43,
      service: chat.serviceName ?? chat.service ?? "iMessage",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      participants: (chat.participants ?? []).map((p: any) => p.address ?? p.id ?? ""),
      last_message_date: chat.lastMessage
        ? bbToIso(chat.lastMessage.dateCreated ?? chat.lastMessage.date)
        : null,
    }));

    return { count: chats.length, chats };
  }

  async getMessages(params: {
    chat_id: string;
    limit?: number;
    before?: string;
  }): Promise<
    | { chat_id: string; count: number; messages: MessageResult[] }
    | { error: string; message: string }
  > {
    const limit = params.limit ?? 50;

    const queryParams: Record<string, string | number> = {
      sort: "DESC",
      limit,
    };

    if (params.before) {
      queryParams.before = new Date(params.before).getTime();
    }

    const chatGuid = params.chat_id;

    try {
      const res = (await this.manager.get(
        this.account,
        `/api/v1/chat/${encodeURIComponent(chatGuid)}/message`,
        queryParams,
      )) as BBResponse;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages: MessageResult[] = (res.data ?? []).map((msg: any) => ({
        message_id: msg.originalROWID ?? msg.ROWID ?? 0,
        text: msg.text ?? null,
        date: bbToIso(msg.dateCreated ?? msg.date),
        is_from_me: msg.isFromMe === true || msg.isFromMe === 1,
        sender:
          msg.isFromMe === true || msg.isFromMe === 1
            ? "me"
            : (msg.handle?.address ?? msg.handle?.id ?? "unknown"),
        has_attachments: (msg.attachments?.length ?? 0) > 0 || msg.hasAttachments === true,
      }));

      return { chat_id: params.chat_id, count: messages.length, messages };
    } catch (err) {
      return {
        error: "chat_not_found",
        message:
          err instanceof Error ? err.message : String(err),
      };
    }
  }

  async searchMessages(params: {
    query: string;
    limit?: number;
  }): Promise<{ query: string; count: number; messages: SearchMessageResult[] }> {
    const limit = params.limit ?? 25;

    const res = (await this.manager.post(this.account, "/api/v1/message/query", {
      limit,
      offset: 0,
      sort: "DESC",
      with: ["chat", "handle"],
      where: [
        {
          statement: "message.text LIKE :query",
          args: { query: `%${params.query}%` },
        },
      ],
    })) as BBResponse;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: SearchMessageResult[] = (res.data ?? []).map((msg: any) => {
      const chat = msg.chats?.[0] ?? {};
      return {
        message_id: msg.originalROWID ?? msg.ROWID ?? 0,
        text: msg.text ?? null,
        date: bbToIso(msg.dateCreated ?? msg.date),
        is_from_me: msg.isFromMe === true || msg.isFromMe === 1,
        sender:
          msg.isFromMe === true || msg.isFromMe === 1
            ? "me"
            : (msg.handle?.address ?? msg.handle?.id ?? "unknown"),
        chat_id: chat.guid ?? chat.chatIdentifier ?? "",
        chat_name: chat.displayName || null,
      };
    });

    return { query: params.query, count: messages.length, messages };
  }

  async sendMessage(params: {
    to: string;
    text: string;
  }): Promise<SendResult> {
    const chatGuid = `iMessage;-;${params.to}`;

    await this.manager.post(this.account, "/api/v1/message/text", {
      chatGuid,
      message: params.text,
      method: "private-api",
    });

    return { success: true, to: params.to, text: params.text };
  }

  async getAttachments(params: {
    chat_id: string;
    limit?: number;
  }): Promise<
    | { chat_id: string; count: number; attachments: AttachmentResult[] }
    | { error: string; message: string }
  > {
    const limit = params.limit ?? 20;

    const chatGuid = params.chat_id;

    try {
      // Fetch messages with attachments included
      const res = (await this.manager.get(
        this.account,
        `/api/v1/chat/${encodeURIComponent(chatGuid)}/message`,
        {
          sort: "DESC",
          limit: limit * 3, // Fetch more messages to find enough with attachments
          with: "attachment",
        },
      )) as BBResponse;

      const attachments: AttachmentResult[] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const msg of res.data ?? []) {
        if (!msg.attachments || msg.attachments.length === 0) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const att of msg.attachments) {
          if (attachments.length >= limit) break;
          attachments.push({
            attachment_id: att.originalROWID ?? att.ROWID ?? 0,
            filename: att.transferName ?? att.filename ?? null,
            filepath: att.filePath ?? null,
            mime_type: att.mimeType ?? att.mime_type ?? null,
            size_bytes: att.totalBytes ?? att.total_bytes ?? 0,
            date: bbToIso(att.createdDate ?? att.created_date ?? msg.dateCreated ?? msg.date),
            message_id: msg.originalROWID ?? msg.ROWID ?? 0,
            sender:
              msg.isFromMe === true || msg.isFromMe === 1
                ? "me"
                : (msg.handle?.address ?? msg.handle?.id ?? "unknown"),
          });
        }
        if (attachments.length >= limit) break;
      }

      return { chat_id: params.chat_id, count: attachments.length, attachments };
    } catch (err) {
      return {
        error: "chat_not_found",
        message:
          err instanceof Error ? err.message : String(err),
      };
    }
  }
}
