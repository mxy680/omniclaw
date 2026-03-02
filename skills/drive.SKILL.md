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
- `drive_list` — List files and folders in a directory (supports pagination and Shared Drives)
- `drive_search` — Search for files using Drive query syntax (supports pagination and Shared Drives)
- `drive_get` — Fetch full metadata for a file by ID
- `drive_read` — Read the text content of a file (Docs, Sheets, Slides, plain text)
- `drive_upload` — Create a new file or update an existing one with text content
- `drive_download` — Download/export a file to local disk (with format choice for Google files)
- `drive_create_folder` — Create a new folder
- `drive_move` — Move a file or folder to a different parent
- `drive_delete` — Trash (or permanently delete) a file or folder
- `drive_share` — Share a file (user/group/domain/anyone with reader/commenter/writer/organizer)
- `drive_copy` — Copy a file (optionally rename and move to a folder)
- `drive_restore` — Restore a trashed file
- `drive_permissions_list` — List all permissions on a file
- `drive_permissions_delete` — Remove a specific permission from a file

## Workflow

1. Complete first-time setup above.
2. Use `drive_list` to browse files in a folder, or `drive_search` to find files by name or content.
3. Use `drive_get` to inspect full metadata of a specific file.
4. Use `drive_read` to read the text content of a Google Doc, Sheet, or plain-text file.
5. Use `drive_download` to export/download files to local disk.
6. Use `drive_upload` to create a new file or update an existing one.
7. Use `drive_create_folder` to organize files into folders.
8. Use `drive_move` to move a file or folder to a different location.
9. Use `drive_copy` to duplicate a file.
10. Use `drive_share` to grant access to a user, group, domain, or anyone.
11. Use `drive_permissions_list` / `drive_permissions_delete` to audit and revoke access.
12. Use `drive_delete` to trash a file (recoverable) or permanently remove it.
13. Use `drive_restore` to recover a trashed file.

## Examples

- "What files are in my Drive?" → `drive_list` with no folder_id
- "Find all PDFs named 'report'" → `drive_search` with `query: "name contains 'report' and mimeType='application/pdf'"`
- "Read the Q4 planning doc" → `drive_search` then `drive_read`
- "Download the Q4 doc as PDF" → `drive_download` with `format: "pdf"`
- "Create a file called notes.txt with the content '...'" → `drive_upload`
- "Create a folder called 'Archive'" → `drive_create_folder`
- "Make a copy of the report" → `drive_copy`
- "Move the report to the Archive folder" → `drive_move`
- "Share the doc with alice@example.com as editor" → `drive_share` with `role: "writer"`, `share_type: "user"`
- "Make this file public" → `drive_share` with `share_type: "anyone"`, `role: "reader"`
- "Who has access to this file?" → `drive_permissions_list`
- "Remove Bob's access" → `drive_permissions_delete`
- "Trash the old draft" → `drive_delete`
- "Restore the trashed file" → `drive_restore`

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
