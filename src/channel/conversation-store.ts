import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";
import { homedir } from "os";

// ── Types ───────────────────────────────────────────────────────────

export interface ConversationRow {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  text: string;
  is_user: number;
  timestamp: number;
  tool_uses_json: string | null;
  is_streaming: number;
  attachments_json: string | null;
}

// ── Store ───────────────────────────────────────────────────────────

export class ConversationStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const dir = join(homedir(), ".openclaw");
    mkdirSync(dir, { recursive: true });
    const path = dbPath ?? join(dir, "omniclaw-conversations.db");

    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  // ── Schema ──────────────────────────────────────────────────────

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL DEFAULT 'New Chat',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id              TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        text            TEXT NOT NULL DEFAULT '',
        is_user         INTEGER NOT NULL DEFAULT 0,
        timestamp       INTEGER NOT NULL,
        tool_uses_json  TEXT,
        is_streaming    INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conv_ts
        ON messages(conversation_id, timestamp);
    `);
    try {
      this.db.exec(`ALTER TABLE messages ADD COLUMN attachments_json TEXT`);
    } catch {
      // Column already exists — ignore
    }
  }

  // ── Conversations ───────────────────────────────────────────────

  listConversations(): ConversationRow[] {
    return this.db
      .prepare("SELECT * FROM conversations ORDER BY updated_at DESC")
      .all() as ConversationRow[];
  }

  getConversation(id: string): ConversationRow | undefined {
    return this.db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(id) as ConversationRow | undefined;
  }

  createConversation(id: string, title?: string): ConversationRow {
    const now = Date.now();
    this.db
      .prepare(
        "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, title ?? "New Chat", now, now);
    return { id, title: title ?? "New Chat", created_at: now, updated_at: now };
  }

  deleteConversation(id: string): void {
    this.db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  }

  renameConversation(id: string, title: string): void {
    this.db
      .prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?")
      .run(title, Date.now(), id);
  }

  touchConversation(id: string): void {
    this.db
      .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
      .run(Date.now(), id);
  }

  // ── Messages ────────────────────────────────────────────────────

  getMessages(
    conversationId: string,
    opts?: { before?: number; limit?: number },
  ): MessageRow[] {
    const limit = opts?.limit ?? 50;
    if (opts?.before) {
      return this.db
        .prepare(
          `SELECT * FROM messages
           WHERE conversation_id = ? AND timestamp < ?
           ORDER BY timestamp DESC LIMIT ?`,
        )
        .all(conversationId, opts.before, limit) as MessageRow[];
    }
    return this.db
      .prepare(
        `SELECT * FROM messages
         WHERE conversation_id = ?
         ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(conversationId, limit) as MessageRow[];
  }

  insertMessage(msg: {
    id: string;
    conversationId: string;
    text: string;
    isUser: boolean;
    timestamp: number;
    toolUsesJson?: string;
    isStreaming?: boolean;
    attachmentsJson?: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, text, is_user, timestamp, tool_uses_json, is_streaming, attachments_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        msg.id,
        msg.conversationId,
        msg.text,
        msg.isUser ? 1 : 0,
        msg.timestamp,
        msg.toolUsesJson ?? null,
        msg.isStreaming ? 1 : 0,
        msg.attachmentsJson ?? null,
      );
    this.touchConversation(msg.conversationId);
  }

  appendMessageText(messageId: string, text: string): void {
    this.db
      .prepare("UPDATE messages SET text = text || ? WHERE id = ?")
      .run(text, messageId);
  }

  markMessageDoneStreaming(messageId: string): void {
    this.db
      .prepare("UPDATE messages SET is_streaming = 0 WHERE id = ?")
      .run(messageId);
  }

  updateMessageToolUses(messageId: string, toolUsesJson: string): void {
    this.db
      .prepare("UPDATE messages SET tool_uses_json = ? WHERE id = ?")
      .run(toolUsesJson, messageId);
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}
