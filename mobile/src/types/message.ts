import { Attachment } from './attachment';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ScheduleMessageMetadata {
  source: 'schedule';
  runId: string;
  jobId: string;
  jobName: string;
  response: string;
}

export interface Message {
  id: string;          // UUID string
  role: MessageRole;
  content: string;
  timestamp: string;   // ISO 8601
  isStreaming: boolean;
  attachments: Attachment[];
  metadata?: ScheduleMessageMetadata;
}
