---
name: drive
description: Full Google Drive access — list, search, read, upload, create folders, move, delete, and share files.
metadata: {"openclaw": {"emoji": "📁"}}
---

# Google Drive

List, search, read, upload, create, move, delete, and share Google Drive files and folders.

## First-Time Setup

1. Call `drive_auth_setup` — a browser window opens
2. Sign in and accept the permissions (covers Drive, Calendar, and Gmail)

This is a one-time step. If you've already authenticated via `gmail_auth_setup` or `calendar_auth_setup`, re-run any auth tool to grant any missing scopes.

**Also enable the Google Drive API** in your GCP project:
- Go to **APIs & Services → Library** → search "Google Drive API" → Enable it

## Available Tools

- `drive_auth_setup` — Authenticate with Google Drive (run once)
- `drive_list` — List files and folders in a directory (or Drive root)
- `drive_search` — Search for files using Drive query syntax
- `drive_get` — Fetch full metadata for a file by ID
- `drive_read` — Read the text content of a file (Docs, Sheets, Slides, plain text)
- `drive_upload` — Create a new file or update an existing one with text content
- `drive_create_folder` — Create a new folder
- `drive_move` — Move a file or folder to a different parent
- `drive_delete` — Trash (or permanently delete) a file or folder
- `drive_share` — Share a file with another user (reader/commenter/writer)

## Workflow

1. Complete first-time setup above.
2. Use `drive_list` to browse files in a folder, or `drive_search` to find files by name or content.
3. Use `drive_get` to inspect full metadata of a specific file.
4. Use `drive_read` to read the text content of a Google Doc, Sheet, or plain-text file.
5. Use `drive_upload` to create a new file or update an existing one.
6. Use `drive_create_folder` to organize files into folders.
7. Use `drive_move` to move a file or folder to a different location.
8. Use `drive_share` to grant access to another user.
9. Use `drive_delete` to trash a file (recoverable) or permanently remove it.

## Examples

- "What files are in my Drive?" → `drive_list` with no folder_id
- "Find all PDFs named 'report'" → `drive_search` with `query: "name contains 'report' and mimeType='application/pdf'"`
- "Read the Q4 planning doc" → `drive_search` then `drive_read`
- "Create a file called notes.txt with the content '...'" → `drive_upload`
- "Create a folder called 'Archive'" → `drive_create_folder`
- "Move the report to the Archive folder" → `drive_move`
- "Share the doc with alice@example.com as editor" → `drive_share` with `role: "writer"`
- "Trash the old draft" → `drive_delete`

## Drive Search Query Syntax

| Goal | Query |
|------|-------|
| By name | `name contains 'report'` |
| Exact name | `name = 'budget.xlsx'` |
| By type (Docs) | `mimeType = 'application/vnd.google-apps.document'` |
| By type (Folders) | `mimeType = 'application/vnd.google-apps.folder'` |
| Full-text search | `fullText contains 'Q4 revenue'` |
| In a folder | `'folder_id' in parents` |
| Modified after | `modifiedTime > '2025-01-01T00:00:00'` |

## Error Handling

If any tool returns `"error": "auth_required"`, call `drive_auth_setup` first.
If `drive_read` returns `"error": "unsupported_mime_type"`, the file is binary (image, PDF, etc.) and cannot be read as text.
