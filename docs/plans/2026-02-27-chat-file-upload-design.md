# Chat File Upload Design

**Date:** 2026-02-27

## Overview

Add file/image/document upload to the dashboard chat. Users can attach any file type alongside their message. The agent sees images via multimodal vision and documents via content extraction. Files are stored on the local filesystem and displayed as rich previews in the chat UI.

## Architecture

**HTTP upload + WebSocket metadata** — binary uploads go over HTTP POST to avoid base64 bloat on the WebSocket. The WS message carries text + references to uploaded files by ID.

### Data Flow

```
1. User selects files → Dashboard HTTP POST /upload → Backend saves to ~/.openclaw/uploads/<convId>/
2. Backend returns { fileId, filename, mimeType, size, url }
3. User clicks send → WS {type:"message", text:"...", attachments:[{fileId, filename, mimeType}]}
4. Backend reads files from disk, sets MediaPaths/MediaTypes on MsgContext
5. SDK processes media (image description, etc.) → agent sees files
6. Agent responds
```

## Components

### 1. Backend — HTTP Upload Endpoint

New HTTP server (or route on the existing WS server's HTTP upgrade server) at the channel plugin level.

- **POST /upload** — accepts `multipart/form-data`, validates auth token (same as WS token, sent as Bearer header)
  - Body: `file` (the binary), `conversationId` (string)
  - Saves to `~/.openclaw/uploads/<conversationId>/<uuid>-<originalFilename>`
  - Returns `{ fileId: string, filename: string, mimeType: string, size: number, url: string }`
  - Max file size: 25MB (configurable)
- **GET /uploads/:conversationId/:fileId** — serves uploaded files back for dashboard previews
  - Auth via query param `?token=<authToken>` (since img src can't set headers)

### 2. Backend — Enhanced Inbound Handler

`handleIosInbound` gains optional `attachments` parameter:
- Resolves file paths from `fileId` references
- Sets `MediaPaths`, `MediaTypes` on the `ctxPayload` passed to `finalizeInboundContext`
- The SDK's existing media understanding pipeline handles image description, audio transcription, etc.
- For text-based files (txt, csv, md, code), content is appended to `BodyForAgent`

### 3. Wire Protocol Changes

**WsClientMessage** — `message` variant adds:
```typescript
attachments?: { fileId: string; filename: string; mimeType: string }[]
```

**WsServerMessage** — `message` variant adds:
```typescript
attachments?: { fileId: string; filename: string; mimeType: string; url: string }[]
```

**WsMessage** (history) adds:
```typescript
attachments?: { fileId: string; filename: string; mimeType: string; url: string }[] | null
```

**SQLite** — `messages` table gains `attachments_json TEXT` column (JSON array, nullable).

### 4. Dashboard — Upload UI

- **Attachment button** (paperclip icon) next to the textarea send button
- **Drag-and-drop** zone on the chat message area
- **Paste** support for images from clipboard
- **Staging area** between input box and messages — shows attached files before sending
  - Image thumbnails for image files
  - File icon + filename + size for non-image files
  - Remove button (X) on each attachment
- Multiple files per message supported

### 5. Dashboard — Message Display

- **User messages** with attachments show:
  - Inline image thumbnails (clickable to view full size) for image types
  - File chips (icon + name) for non-image types
- **Images** load from `GET /uploads/:conversationId/:fileId?token=...`
- `ChatMessage` interface gains `attachments` field

### 6. Frontend HTTP Upload Hook

New `useFileUpload` hook:
- `uploadFile(file: File, conversationId: string) → Promise<UploadedFile>`
- `uploadFiles(files: File[], conversationId: string) → Promise<UploadedFile[]>`
- Tracks upload progress per file
- Uses the same `serverUrl` and `authToken` from WebSocket settings

## File Storage

- Base directory: `~/.openclaw/uploads/`
- Per-conversation subdirectories: `~/.openclaw/uploads/<conversationId>/`
- Filenames: `<uuid>-<sanitized-original-filename>`
- No automatic cleanup (files persist across sessions)

## Supported File Types

All file types accepted. The backend determines handling by MIME type:
- **Images** (image/*): passed as MediaPaths for vision/description
- **Audio** (audio/*): passed as MediaPaths for transcription
- **Text-based** (text/*, application/json, etc.): content read and included in prompt
- **Other** (PDF, binary, etc.): path provided to agent, agent uses tools to read if needed
