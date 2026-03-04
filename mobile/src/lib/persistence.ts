import { File, Paths } from 'expo-file-system';

function conversationsFile(): File {
  return new File(Paths.document, 'conversations.json');
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
