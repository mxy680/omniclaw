import { Message } from './message';

export interface Conversation {
  id: string;           // UUID string
  agentId: string;
  messages: Message[];
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
  sessionSuffix: string;
}

export function sessionKey(c: Conversation): string {
  return `agent:${c.agentId}:rn-${c.sessionSuffix}`;
}

export function lastMessage(c: Conversation): Message | undefined {
  for (let i = c.messages.length - 1; i >= 0; i--) {
    if (c.messages[i].role !== 'system') return c.messages[i];
  }
  return undefined;
}
