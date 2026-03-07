import { File, Paths } from 'expo-file-system';

function conversationsFile(): File {
  return new File(Paths.document, 'conversations.json');
}

function scheduleSyncFile(): File {
  return new File(Paths.document, 'schedule-sync.json');
}

export async function loadConversations<T>(): Promise<T[]> {
  try {
    const file = conversationsFile();
    if (!file.exists) return [];
    const raw = await file.text();
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveConversations<T>(data: T[]): Promise<void> {
  try {
    const file = conversationsFile();
    file.write(JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('Failed to save conversations:', err);
  }
}

export interface ScheduleSyncData {
  lastSyncTimestamp: string | null;
  injectedRunIds: string[];
  unreadCounts: Record<string, number>;
}

export async function loadScheduleSync(): Promise<ScheduleSyncData> {
  try {
    const file = scheduleSyncFile();
    if (!file.exists) return { lastSyncTimestamp: null, injectedRunIds: [], unreadCounts: {} };
    const raw = await file.text();
    return JSON.parse(raw);
  } catch {
    return { lastSyncTimestamp: null, injectedRunIds: [], unreadCounts: {} };
  }
}

export async function saveScheduleSync(data: ScheduleSyncData): Promise<void> {
  try {
    const file = scheduleSyncFile();
    file.write(JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save schedule sync:', err);
  }
}
