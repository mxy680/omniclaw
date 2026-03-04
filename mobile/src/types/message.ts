import { Attachment } from './attachment';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;          // UUID string
  role: MessageRole;
  content: string;
  timestamp: string;   // ISO 8601
  isStreaming: boolean;
  attachments: Attachment[];
}
