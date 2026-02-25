/**
 * Unified backend interface for iMessage tools.
 */

export interface ContactResult {
  handle_id: number;
  identifier: string;
  service: string;
  name?: string | null;
}

export interface ChatResult {
  chat_id: string;
  display_name: string | null;
  is_group: boolean;
  service: string;
  participants: string[];
  last_message_date: string | null;
}

export interface MessageResult {
  message_id: number;
  text: string | null;
  date: string | null;
  is_from_me: boolean;
  sender: string;
  has_attachments: boolean;
}

export interface SearchMessageResult {
  message_id: number;
  text: string | null;
  date: string | null;
  is_from_me: boolean;
  sender: string;
  chat_id: string;
  chat_name: string | null;
}

export interface SendResult {
  success: boolean;
  to: string;
  text: string;
}

export interface AttachmentResult {
  attachment_id: number;
  filename: string | null;
  filepath: string | null;
  mime_type: string | null;
  size_bytes: number;
  date: string | null;
  message_id: number;
  sender: string;
}

export interface IMessageBackend {
  getContacts(params: {
    search?: string;
    limit?: number;
  }): Promise<{ count: number; contacts: ContactResult[] }>;

  getChats(params: {
    limit?: number;
  }): Promise<{ count: number; chats: ChatResult[] }>;

  getMessages(params: {
    chat_id: string;
    limit?: number;
    before?: string;
  }): Promise<
    | { chat_id: string; count: number; messages: MessageResult[] }
    | { error: string; message: string }
  >;

  searchMessages(params: {
    query: string;
    limit?: number;
  }): Promise<{ query: string; count: number; messages: SearchMessageResult[] }>;

  sendMessage(params: {
    to: string;
    text: string;
  }): Promise<SendResult>;

  getAttachments(params: {
    chat_id: string;
    limit?: number;
  }): Promise<
    | { chat_id: string; count: number; attachments: AttachmentResult[] }
    | { error: string; message: string }
  >;
}
