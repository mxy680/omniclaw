# Chat File Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to upload files/images/documents in the chat, displayed as rich previews, and passed to the agent via the OpenClaw SDK's MediaPaths/MediaTypes context fields.

**Architecture:** HTTP POST endpoint for binary uploads (avoids base64 bloat over WebSocket), files stored to `~/.openclaw/uploads/<conversationId>/`, WebSocket message carries text + attachment metadata references. Backend sets `MediaPaths`/`MediaTypes` on MsgContext for the SDK pipeline.

**Tech Stack:** Node.js (http module), better-sqlite3, Next.js/React, WebSocket, TypeScript

---

### Task 1: Add `attachments_json` column to SQLite messages table

**Files:**
- Modify: `src/channel/conversation-store.ts`

**Step 1: Add migration for new column**

In the `migrate()` method (line 43), after the existing `CREATE TABLE` / `CREATE INDEX` block, add an `ALTER TABLE` wrapped in a try/catch (since SQLite doesn't support `IF NOT EXISTS` for ALTER TABLE):

```typescript
// In migrate(), after the existing this.db.exec(`) block at line 64:
try {
  this.db.exec(`ALTER TABLE messages ADD COLUMN attachments_json TEXT`);
} catch {
  // Column already exists — ignore
}
```

**Step 2: Add `attachments_json` to `MessageRow` interface**

```typescript
// In MessageRow interface (line 15-23), add:
export interface MessageRow {
  id: string;
  conversation_id: string;
  text: string;
  is_user: number;
  timestamp: number;
  tool_uses_json: string | null;
  is_streaming: number;
  attachments_json: string | null;  // NEW
}
```

**Step 3: Update `insertMessage()` to accept and store attachments**

```typescript
insertMessage(msg: {
  id: string;
  conversationId: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  toolUsesJson?: string;
  isStreaming?: boolean;
  attachmentsJson?: string;  // NEW
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
      msg.attachmentsJson ?? null,  // NEW
    );
  this.touchConversation(msg.conversationId);
}
```

**Step 4: Build and verify**

Run: `pnpm build`
Expected: Clean compile

**Step 5: Commit**

```bash
git add src/channel/conversation-store.ts
git commit -m "feat: add attachments_json column to messages table"
```

---

### Task 2: Update wire protocol types for attachments

**Files:**
- Modify: `src/channel/types.ts`
- Modify: `src/channel/conversation-handlers.ts`

**Step 1: Add `WsAttachment` type and update message types**

In `src/channel/types.ts`, add a shared attachment type and update `WsClientMessage`, `WsServerMessage`, and `WsMessage`:

```typescript
// Add after line 9 (after ResolvedIosAccount type):

/** Attachment metadata for file uploads. */
export type WsAttachment = {
  fileId: string;
  filename: string;
  mimeType: string;
  size?: number;
  url?: string;
};
```

Update `WsClientMessage` message variant (line 15):
```typescript
| { type: "message"; text: string; id?: string; conversationId: string; attachments?: WsAttachment[] }
```

Update `WsServerMessage` message variant (line 30):
```typescript
| { type: "message"; text: string; id: string; conversationId: string; isUser?: boolean; attachments?: WsAttachment[] }
```

Update `WsMessage` type (lines 61-69):
```typescript
export type WsMessage = {
  id: string;
  conversationId: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  toolUses: { name: string; phase: string }[] | null;
  isStreaming: boolean;
  attachments: WsAttachment[] | null;  // NEW
};
```

**Step 2: Update `toWsMessage` in conversation-handlers.ts**

In `src/channel/conversation-handlers.ts`, update the `toWsMessage` function (line 16-26):

```typescript
function toWsMessage(row: MessageRow): WsMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    text: row.text,
    isUser: row.is_user === 1,
    timestamp: row.timestamp,
    toolUses: row.tool_uses_json ? JSON.parse(row.tool_uses_json) : null,
    isStreaming: row.is_streaming === 1,
    attachments: row.attachments_json ? JSON.parse(row.attachments_json) : null,
  };
}
```

**Step 3: Build and verify**

Run: `pnpm build`
Expected: Clean compile

**Step 4: Commit**

```bash
git add src/channel/types.ts src/channel/conversation-handlers.ts
git commit -m "feat: add attachment types to wire protocol"
```

---

### Task 3: Create HTTP upload server alongside WebSocket server

**Files:**
- Create: `src/channel/upload-server.ts`
- Modify: `src/channel/ws-server.ts`

**Step 1: Create the upload server module**

Create `src/channel/upload-server.ts`:

```typescript
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { randomUUID } from "crypto";
import { mkdirSync, createWriteStream, createReadStream, statSync, existsSync } from "fs";
import { join, extname } from "path";
import { homedir } from "os";
import { lookup } from "mime-types";

const UPLOADS_BASE = join(homedir(), ".openclaw", "uploads");
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export type UploadServerInstance = {
  stop: () => void;
};

/**
 * Resolve the on-disk path for an uploaded file.
 * Returns undefined if the file doesn't exist.
 */
export function resolveUploadPath(conversationId: string, fileId: string): string | undefined {
  const dir = join(UPLOADS_BASE, conversationId);
  if (!existsSync(dir)) return undefined;
  // Files are stored as <fileId>-<filename>, find by prefix
  const { readdirSync } = require("fs");
  const files = readdirSync(dir) as string[];
  const match = files.find((f: string) => f.startsWith(fileId));
  return match ? join(dir, match) : undefined;
}

/**
 * Start an HTTP server for file uploads and serving uploaded files.
 */
export function startUploadServer(opts: {
  port: number;
  authToken: string;
  log?: (msg: string) => void;
}): UploadServerInstance {
  const { authToken, log } = opts;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    // POST /upload — file upload
    if (req.method === "POST" && url.pathname === "/upload") {
      handleUpload(req, res, authToken, log);
      return;
    }

    // GET /uploads/:conversationId/:fileId — serve files
    const serveMatch = url.pathname.match(/^\/uploads\/([^/]+)\/([^/]+)$/);
    if (req.method === "GET" && serveMatch) {
      const token = url.searchParams.get("token");
      if (token !== authToken) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      serveFile(res, serveMatch[1], serveMatch[2], log);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(opts.port + 1, () => {
    log?.(`[ios] Upload HTTP server listening on port ${opts.port + 1}`);
  });

  return {
    stop: () => {
      server.close();
      log?.("[ios] Upload HTTP server stopped");
    },
  };
}

function handleUpload(
  req: IncomingMessage,
  res: ServerResponse,
  authToken: string,
  log?: (msg: string) => void,
): void {
  // Validate auth
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${authToken}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const contentType = req.headers["content-type"] ?? "";

  // Parse multipart boundary
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "missing multipart boundary" }));
    return;
  }

  // Collect body
  const chunks: Buffer[] = [];
  let totalSize = 0;

  req.on("data", (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > MAX_FILE_SIZE) {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "file too large", maxBytes: MAX_FILE_SIZE }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", () => {
    try {
      const body = Buffer.concat(chunks);
      const boundary = boundaryMatch![1];
      const { conversationId, filename, mimeType, fileBuffer } = parseMultipart(body, boundary);

      if (!conversationId || !fileBuffer) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "missing conversationId or file" }));
        return;
      }

      // Save file
      const fileId = randomUUID().slice(0, 8);
      const sanitized = (filename ?? "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
      const dir = join(UPLOADS_BASE, conversationId);
      mkdirSync(dir, { recursive: true });
      const filePath = join(dir, `${fileId}-${sanitized}`);

      const ws = createWriteStream(filePath);
      ws.write(fileBuffer);
      ws.end();

      const resolvedMime = mimeType ?? (lookup(sanitized) || "application/octet-stream");

      log?.(`[ios] uploaded ${sanitized} (${fileBuffer.length} bytes) → ${filePath}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          fileId,
          filename: sanitized,
          mimeType: resolvedMime,
          size: fileBuffer.length,
        }),
      );
    } catch (err) {
      log?.(`[ios] upload parse error: ${err}`);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "failed to parse upload" }));
    }
  });
}

function parseMultipart(
  body: Buffer,
  boundary: string,
): { conversationId?: string; filename?: string; mimeType?: string; fileBuffer?: Buffer } {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let conversationId: string | undefined;
  let filename: string | undefined;
  let mimeType: string | undefined;
  let fileBuffer: Buffer | undefined;

  // Split by boundary
  const parts: Buffer[] = [];
  let start = 0;
  while (true) {
    const idx = body.indexOf(boundaryBuffer, start);
    if (idx === -1) break;
    if (start > 0) {
      parts.push(body.subarray(start, idx));
    }
    start = idx + boundaryBuffer.length;
    // Skip \r\n after boundary
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headers = part.subarray(0, headerEnd).toString();
    const content = part.subarray(headerEnd + 4);
    // Trim trailing \r\n
    const trimmed = content.subarray(
      0,
      content.length >= 2 &&
        content[content.length - 2] === 0x0d &&
        content[content.length - 1] === 0x0a
        ? content.length - 2
        : content.length,
    );

    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const contentTypeMatch = headers.match(/Content-Type:\s*(.+)/i);

    if (nameMatch?.[1] === "conversationId") {
      conversationId = trimmed.toString().trim();
    } else if (nameMatch?.[1] === "file" || filenameMatch) {
      filename = filenameMatch?.[1];
      mimeType = contentTypeMatch?.[1]?.trim();
      fileBuffer = trimmed;
    }
  }

  return { conversationId, filename, mimeType, fileBuffer };
}

function serveFile(
  res: ServerResponse,
  conversationId: string,
  fileId: string,
  log?: (msg: string) => void,
): void {
  const filePath = resolveUploadPath(conversationId, fileId);
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "file not found" }));
    return;
  }

  const stat = statSync(filePath);
  const ext = extname(filePath);
  const mime = lookup(ext) || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": stat.size,
    "Cache-Control": "private, max-age=86400",
  });

  createReadStream(filePath).pipe(res);
}
```

**Step 2: Add `mime-types` dependency**

Run: `pnpm add mime-types && pnpm add -D @types/mime-types`

**Step 3: Integrate upload server into channel plugin**

In `src/channel/channel-plugin.ts`, add import and start/stop the upload server:

Add import (after line 19):
```typescript
import { startUploadServer } from "./upload-server.js";
```

After `const wsServer = startWsServer({...})` block (after line 195), add:
```typescript
const uploadServer = startUploadServer({
  port: account.port,
  authToken: account.authToken,
  log: (msg) => ctx.log?.info(msg),
});
```

In the `stop()` function (line 204), add `uploadServer.stop()` after `wsServer.stop()`:
```typescript
stop: () => {
  wsServer.stop();
  uploadServer.stop();
  store.close();
  // ... rest unchanged
```

**Step 4: Build and verify**

Run: `pnpm build`
Expected: Clean compile

**Step 5: Commit**

```bash
git add src/channel/upload-server.ts src/channel/channel-plugin.ts package.json pnpm-lock.yaml
git commit -m "feat: add HTTP upload server for file attachments"
```

---

### Task 4: Pass attachments through inbound handler to SDK

**Files:**
- Modify: `src/channel/inbound.ts`
- Modify: `src/channel/channel-plugin.ts`

**Step 1: Extend `handleIosInbound` to accept attachments**

In `src/channel/inbound.ts`, update the function signature (line 75-86) to include attachments:

```typescript
export async function handleIosInbound(params: {
  text: string;
  messageId?: string;
  conversationId: string;
  connId: string;
  attachments?: Array<{ fileId: string; filename: string; mimeType: string; size?: number }>;
  account: ResolvedIosAccount;
  config: CoreConfig;
  runtime: RuntimeEnv;
  store: ConversationStore;
  wsServer: WsServerInstance;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
}): Promise<void> {
```

Add import at top of file:
```typescript
import { resolveUploadPath } from "./upload-server.js";
```

**Step 2: Store attachments in SQLite and pass to SDK**

In `handleIosInbound`, after `const rawBody = text.trim();` (line 93), add attachment resolution:

```typescript
// Resolve attachment file paths
const attachments = params.attachments ?? [];
const mediaPaths: string[] = [];
const mediaTypes: string[] = [];
for (const att of attachments) {
  const path = resolveUploadPath(params.conversationId, att.fileId);
  if (path) {
    mediaPaths.push(path);
    mediaTypes.push(att.mimeType);
  }
}

// Serialize for storage
const attachmentsJson = attachments.length > 0 ? JSON.stringify(attachments) : undefined;
```

Update the `store.insertMessage()` call (line 108-114) to include attachments:
```typescript
store.insertMessage({
  id: userMsgId,
  conversationId,
  text: rawBody,
  isUser: true,
  timestamp,
  attachmentsJson,
});
```

Update the broadcast to other clients (line 129-135) to include attachments:
```typescript
wsServer.broadcastExcept(connId, {
  type: "message",
  text: rawBody,
  id: userMsgId,
  conversationId,
  isUser: true,
  attachments: attachments.length > 0 ? attachments : undefined,
});
```

Update the `ctxPayload` (line 172-191) to include media fields. Add these fields to the `finalizeInboundContext` call:
```typescript
const ctxPayload = core.channel.reply.finalizeInboundContext({
  Body: body,
  RawBody: rawBody,
  CommandBody: rawBody,
  From: `omniclaw-ios:${peerId}`,
  To: `omniclaw-ios:${peerId}`,
  SessionKey: conversationSessionKey,
  AccountId: route.accountId,
  ChatType: "direct",
  ConversationLabel: "iOS App",
  SenderName: "User",
  SenderId: peerId,
  Provider: CHANNEL_ID,
  Surface: CHANNEL_ID,
  MessageSid: userMsgId,
  Timestamp: timestamp,
  OriginatingChannel: CHANNEL_ID,
  OriginatingTo: `omniclaw-ios:${peerId}`,
  CommandAuthorized: true,
  // Media attachments
  ...(mediaPaths.length > 0 && {
    MediaPaths: mediaPaths,
    MediaTypes: mediaTypes,
    MediaDir: join(homedir(), ".openclaw", "uploads", conversationId),
  }),
});
```

Add `join` and `homedir` imports at top:
```typescript
import { join } from "path";
import { homedir } from "os";
```

**Step 3: Update channel-plugin.ts to pass attachments from WS message to handler**

In `src/channel/channel-plugin.ts`, update the `handleIosInbound` call (lines 173-185):

```typescript
fn: () =>
  handleIosInbound({
    text: msg.text,
    messageId: msg.id,
    conversationId: msg.conversationId,
    attachments: msg.attachments,  // NEW — pass through from WS message
    connId,
    account,
    config: cfg,
    runtime,
    store,
    wsServer,
    statusSink: (patch) =>
      ctx.setStatus({ accountId: ctx.accountId, ...patch }),
  }),
```

**Step 4: Build and verify**

Run: `pnpm build`
Expected: Clean compile

**Step 5: Commit**

```bash
git add src/channel/inbound.ts src/channel/channel-plugin.ts
git commit -m "feat: pass file attachments through inbound handler to SDK"
```

---

### Task 5: Dashboard — Add `useFileUpload` hook

**Files:**
- Create: `dashboard/src/hooks/use-file-upload.ts`

**Step 1: Create the upload hook**

```typescript
import { useState, useCallback, useRef } from "react";

export interface UploadedFile {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface PendingFile {
  file: File;
  preview?: string; // data URL for images
  uploading: boolean;
  uploaded?: UploadedFile;
  error?: string;
}

export function useFileUpload(serverUrl: string, authToken: string) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const getHttpUrl = useCallback(() => {
    try {
      const wsUrl = new URL(serverUrl);
      const protocol = wsUrl.protocol === "wss:" ? "https:" : "http:";
      const port = parseInt(wsUrl.port || "9600", 10) + 1;
      return `${protocol}//${wsUrl.hostname}:${port}`;
    } catch {
      return "";
    }
  }, [serverUrl]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newPending: PendingFile[] = Array.from(files).map((file) => {
      const pending: PendingFile = { file, uploading: false };
      // Generate preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPendingFiles((prev) =>
            prev.map((p) =>
              p.file === file ? { ...p, preview: e.target?.result as string } : p,
            ),
          );
        };
        reader.readAsDataURL(file);
      }
      return pending;
    });

    setPendingFiles((prev) => [...prev, ...newPending]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => {
      const updated = [...prev];
      const removed = updated.splice(index, 1)[0];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return updated;
    });
  }, []);

  const uploadAll = useCallback(
    async (conversationId: string): Promise<UploadedFile[]> => {
      const httpUrl = getHttpUrl();
      if (!httpUrl) return [];

      const controller = new AbortController();
      abortRef.current = controller;

      const results: UploadedFile[] = [];

      for (let i = 0; i < pendingFiles.length; i++) {
        const pf = pendingFiles[i];
        if (pf.uploaded) {
          results.push(pf.uploaded);
          continue;
        }

        setPendingFiles((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, uploading: true } : p)),
        );

        try {
          const formData = new FormData();
          formData.append("conversationId", conversationId);
          formData.append("file", pf.file, pf.file.name);

          const res = await fetch(`${httpUrl}/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}` },
            body: formData,
            signal: controller.signal,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "upload failed" }));
            throw new Error(err.error ?? `HTTP ${res.status}`);
          }

          const uploaded: UploadedFile = await res.json();
          results.push(uploaded);

          setPendingFiles((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, uploading: false, uploaded } : p,
            ),
          );
        } catch (err) {
          setPendingFiles((prev) =>
            prev.map((p, idx) =>
              idx === i ? { ...p, uploading: false, error: String(err) } : p,
            ),
          );
        }
      }

      return results;
    },
    [pendingFiles, getHttpUrl, authToken],
  );

  const clear = useCallback(() => {
    for (const pf of pendingFiles) {
      if (pf.preview) URL.revokeObjectURL(pf.preview);
    }
    setPendingFiles([]);
  }, [pendingFiles]);

  return {
    pendingFiles,
    addFiles,
    removeFile,
    uploadAll,
    clear,
    hasPending: pendingFiles.length > 0,
  };
}
```

**Step 2: Build dashboard and verify**

Run: `cd dashboard && pnpm build`
Expected: Clean compile

**Step 3: Commit**

```bash
git add dashboard/src/hooks/use-file-upload.ts
git commit -m "feat: add useFileUpload hook for dashboard file uploads"
```

---

### Task 6: Dashboard — Update WebSocket types and conversations hook

**Files:**
- Modify: `dashboard/src/lib/websocket.ts`
- Modify: `dashboard/src/hooks/use-conversations.ts`

**Step 1: Update `ClientMessage` type in websocket.ts**

In `dashboard/src/lib/websocket.ts`, update the `message` variant (line 14):

```typescript
| { type: "message"; text: string; id?: string; conversationId: string; attachments?: { fileId: string; filename: string; mimeType: string; size?: number }[] }
```

**Step 2: Add `getHttpUrl()` method to `AgentWebSocket`**

In the `AgentWebSocket` class (after the `send` method at line 226), add:

```typescript
getHttpUrl(): string {
  if (!this.url) return "";
  try {
    const wsUrl = new URL(this.url);
    const protocol = wsUrl.protocol === "wss:" ? "https:" : "http:";
    const port = parseInt(wsUrl.port || "9600", 10) + 1;
    return `${protocol}//${wsUrl.hostname}:${port}`;
  } catch {
    return "";
  }
}
```

**Step 3: Update `ChatMessage` interface in use-conversations.ts**

In `dashboard/src/hooks/use-conversations.ts`, update `ChatMessage` (line 40-47):

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolUses: ToolUse[];
  isStreaming: boolean;
  attachments?: { fileId: string; filename: string; mimeType: string; size?: number; url?: string }[];
}
```

**Step 4: Update `sendMessage` to accept attachments**

In `use-conversations.ts`, update the `sendMessage` callback (around line 393):

```typescript
const sendMessage = useCallback(
  (text: string, attachments?: { fileId: string; filename: string; mimeType: string; size?: number }[]) => {
    const trimmed = text.trim();
    if ((!trimmed && (!attachments || attachments.length === 0)) || !activeConversationId) return;

    const id = crypto.randomUUID();
    const userMsg: ChatMessage = {
      id,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
      toolUses: [],
      isStreaming: false,
      attachments,
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConversationId]: [
        ...(prev[activeConversationId] ?? []),
        userMsg,
      ],
    }));
    wsRef.current?.send({
      type: "message",
      text: trimmed,
      id,
      conversationId: activeConversationId,
      attachments,
    });
  },
  [activeConversationId],
);
```

**Step 5: Update incoming message handler to parse attachments**

In the message handler (where `msg.type === "message"` is processed, around line 144-200), ensure attachments from server messages are included in `ChatMessage`:

Find the section where user messages from broadcasts are added to `messagesMap` (around line 150-163). Update the `ChatMessage` construction to include attachments:

```typescript
// Where userMsg ChatMessage is created from incoming broadcast
const userMsg: ChatMessage = {
  id: msg.id,
  role: "user",
  content: msg.text,
  timestamp: new Date(),
  toolUses: [],
  isStreaming: false,
  attachments: msg.attachments,
};
```

Also update the conversation history handler where `WsMessage[]` is converted to `ChatMessage[]` — ensure attachments are mapped through.

**Step 6: Build and verify**

Run: `cd dashboard && pnpm build`
Expected: Clean compile

**Step 7: Commit**

```bash
git add dashboard/src/lib/websocket.ts dashboard/src/hooks/use-conversations.ts
git commit -m "feat: add attachment support to dashboard WS types and conversations hook"
```

---

### Task 7: Dashboard — Add file upload UI to chat page

**Files:**
- Modify: `dashboard/src/app/(dashboard)/chat/page.tsx`

This is the largest UI task. It adds:
1. Attachment button (paperclip icon) next to textarea
2. Drag-and-drop support
3. Clipboard paste support for images
4. Staging area showing pending files before send
5. Rich previews in sent message bubbles

**Step 1: Add imports and hook**

At the top of `chat/page.tsx`, add:
```typescript
import { Paperclip, X, FileText, ImageIcon } from "lucide-react";
import { useFileUpload } from "@/hooks/use-file-upload";
```

**Step 2: Wire up the file upload hook in the main component**

Inside the main chat component (the one that uses `useConversations`), add:

```typescript
const { pendingFiles, addFiles, removeFile, uploadAll, clear: clearFiles, hasPending } =
  useFileUpload(serverUrl, authToken);
const fileInputRef = useRef<HTMLInputElement>(null);
```

**Step 3: Update `handleSubmit` to upload files before sending**

Replace the `handleSubmit` function:

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const text = input.trim();
  if ((!text && !hasPending) || !isConnected) return;

  let attachments: { fileId: string; filename: string; mimeType: string; size?: number }[] | undefined;
  if (hasPending && activeConversationId) {
    attachments = await uploadAll(activeConversationId);
    if (attachments.length === 0 && !text) return;
  }

  onSendMessage(text, attachments);
  setInput("");
  clearFiles();
  inputRef.current?.focus();
}
```

**Step 4: Add drag-and-drop handlers**

Add to the chat component:

```typescript
const [isDragging, setIsDragging] = useState(false);

function handleDragOver(e: React.DragEvent) {
  e.preventDefault();
  setIsDragging(true);
}

function handleDragLeave(e: React.DragEvent) {
  e.preventDefault();
  setIsDragging(false);
}

function handleDrop(e: React.DragEvent) {
  e.preventDefault();
  setIsDragging(false);
  if (e.dataTransfer.files.length > 0) {
    addFiles(e.dataTransfer.files);
  }
}
```

**Step 5: Add paste handler for images**

Add to the chat component:

```typescript
function handlePaste(e: React.ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;
  const files: File[] = [];
  for (const item of items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (files.length > 0) {
    addFiles(files);
  }
}
```

**Step 6: Update the input area JSX**

Replace the form/input area section with file upload UI:

```tsx
{/* Pending files staging area */}
{hasPending && (
  <div className="max-w-2xl w-full mx-auto px-6">
    <div className="flex flex-wrap gap-2 p-2 rounded-t-xl border border-b-0 border-border bg-card/50">
      {pendingFiles.map((pf, i) => (
        <div key={i} className="relative group flex items-center gap-1.5 rounded-lg bg-white/5 border border-border px-2 py-1.5 text-xs">
          {pf.preview ? (
            <img src={pf.preview} alt="" className="h-8 w-8 rounded object-cover" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="max-w-[120px] truncate text-muted-foreground">
            {pf.file.name}
          </span>
          {pf.uploading && (
            <span className="text-blue-400 animate-pulse">...</span>
          )}
          <button
            type="button"
            onClick={() => removeFile(i)}
            className="ml-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  </div>
)}

<div className="max-w-2xl w-full mx-auto px-6 pb-4 pt-1">
  <form
    onSubmit={handleSubmit}
    className={`flex items-end gap-2 ${hasPending ? "rounded-b-xl rounded-t-none" : "rounded-xl"} border border-border p-2.5 focus-within:border-foreground/15 transition-colors`}
  >
    <input
      ref={fileInputRef}
      type="file"
      multiple
      className="hidden"
      onChange={(e) => {
        if (e.target.files) addFiles(e.target.files);
        e.target.value = "";
      }}
    />
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={!isConnected}
      className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-15 transition-opacity"
    >
      <Paperclip className="h-4 w-4" />
    </button>
    <textarea
      ref={inputRef}
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={isConnected ? "Message..." : "Connecting..."}
      rows={1}
      disabled={!isConnected}
      className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/30 max-h-32 disabled:opacity-40 px-1"
    />
    <button
      type="submit"
      disabled={(!input.trim() && !hasPending) || !isConnected}
      className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg bg-foreground text-background disabled:opacity-15 transition-opacity"
    >
      <ArrowUp className="h-3.5 w-3.5" />
    </button>
  </form>
</div>
```

**Step 7: Add drag-and-drop zone to the chat messages area**

Wrap the messages scroll container with drag handlers:

```tsx
<div
  className="flex-1 overflow-y-auto ..."
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
>
  {isDragging && (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 border-2 border-dashed border-foreground/20 rounded-xl m-2">
      <p className="text-muted-foreground text-sm">Drop files here</p>
    </div>
  )}
  {/* ...existing messages... */}
</div>
```

**Step 8: Update MessageBubble to show attachments**

In the `MessageBubble` component, add attachment rendering after the text content. For user messages:

```tsx
{msg.attachments && msg.attachments.length > 0 && (
  <div className="flex flex-wrap gap-2 mt-2">
    {msg.attachments.map((att, i) => {
      const isImage = att.mimeType.startsWith("image/");
      if (isImage) {
        const url = att.url ?? buildFileUrl(att.fileId, /* conversationId */);
        return (
          <img
            key={i}
            src={url}
            alt={att.filename}
            className="max-h-48 max-w-64 rounded-lg object-cover border border-border"
          />
        );
      }
      return (
        <div key={i} className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-border px-2 py-1.5 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span className="truncate max-w-[150px]">{att.filename}</span>
        </div>
      );
    })}
  </div>
)}
```

Add a helper function for building file URLs:

```typescript
function buildFileUrl(fileId: string, conversationId: string): string {
  try {
    const wsUrl = new URL(serverUrl);
    const protocol = wsUrl.protocol === "wss:" ? "https:" : "http:";
    const port = parseInt(wsUrl.port || "9600", 10) + 1;
    return `${protocol}//${wsUrl.hostname}:${port}/uploads/${conversationId}/${fileId}?token=${encodeURIComponent(authToken)}`;
  } catch {
    return "";
  }
}
```

**Step 9: Build and test visually**

Run: `cd dashboard && pnpm dev`

Verify:
- Paperclip button appears next to textarea
- Clicking it opens file picker
- Selected files appear in staging area above input
- Image files show thumbnail previews
- Files can be removed with X button
- Drag-and-drop works on the chat area
- Pasting images from clipboard works
- Sending a message with attachments works
- Sent messages show image previews and file chips

**Step 10: Commit**

```bash
git add dashboard/src/app/\(dashboard\)/chat/page.tsx
git commit -m "feat: add file upload UI with drag-drop, paste, and rich previews"
```

---

### Task 8: Handle attachment URLs in conversation history

**Files:**
- Modify: `dashboard/src/hooks/use-conversations.ts`

**Step 1: Map attachments with URLs when loading conversation history**

In the message handler where conversation history responses are processed (where `WsMessage[]` → `ChatMessage[]`), ensure attachment URLs are populated. The server already sends `WsMessage.attachments` which includes the stored attachment metadata. Build the full URL on the client side:

```typescript
// In the conversation_history handler, when mapping WsMessage to ChatMessage:
const mapped: ChatMessage = {
  id: m.id,
  role: m.isUser ? "user" : "assistant",
  content: m.text,
  timestamp: new Date(m.timestamp),
  toolUses: m.toolUses?.map(/* ... existing mapping ... */) ?? [],
  isStreaming: m.isStreaming,
  attachments: m.attachments?.map((att) => ({
    ...att,
    url: buildFileUrl(att.fileId, m.conversationId),
  })),
};
```

The `buildFileUrl` helper needs to be available in the hook or passed down. Since the hook already has `serverUrl` and `authToken` in scope, add the helper there.

**Step 2: Build and verify**

Run: `cd dashboard && pnpm build`
Expected: Clean compile

**Step 3: Commit**

```bash
git add dashboard/src/hooks/use-conversations.ts
git commit -m "feat: populate attachment URLs in conversation history"
```

---

### Task 9: End-to-end testing

**No new files — manual verification**

**Step 1: Start the backend**

Ensure OpenClaw is running with the omniclaw plugin.

**Step 2: Start the dashboard**

Run: `cd dashboard && pnpm dev`

**Step 3: Test the full flow**

1. Open the chat in a browser at `http://localhost:3000`
2. Click the paperclip button → select an image → verify preview appears in staging area
3. Type a message → send → verify:
   - Image thumbnail appears in the sent message
   - Agent responds (acknowledging the image if it supports vision)
4. Drag-and-drop a file onto the chat area → verify it appears in staging
5. Paste an image from clipboard → verify it appears in staging
6. Send a text file → verify file chip appears in message
7. Reload the page → navigate back to the conversation → verify attachments appear in history
8. Test error cases: try uploading a file > 25MB → verify error handling

**Step 4: Build check**

Run: `pnpm build` (from root)
Expected: Clean compile

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address file upload edge cases"
```
