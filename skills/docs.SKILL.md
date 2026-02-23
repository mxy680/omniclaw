---
name: docs
description: Google Docs access — create, read, append text, and find-and-replace inside documents.
metadata: {"openclaw": {"emoji": "📝"}}
---

# Google Docs

Create, read, append to, and edit Google Docs.

## First-Time Setup

1. Call `docs_auth_setup` — a browser window opens
2. Sign in and accept the permissions (covers Docs, Drive, Calendar, and Gmail)

This is a one-time step. If you've already authenticated via any other `*_auth_setup` tool, re-run it to pick up the Docs scope.

**Also enable the Google Docs API** in your GCP project:
- Go to **APIs & Services → Library** → search "Google Docs API" → Enable it

## Available Tools

- `docs_auth_setup` — Authenticate with Google Docs (run once)
- `docs_create` — Create a new Google Doc with a title and optional initial content
- `docs_get` — Fetch a document's title and full plain-text content
- `docs_append` — Append text to the end of an existing document
- `docs_replace_text` — Find and replace all occurrences of a string in a document

## Workflow

1. Complete first-time setup above.
2. Use `docs_create` to make a new document, optionally with starter text.
3. Use `docs_get` to read the current content of any document by its ID.
4. Use `docs_append` to add new content to the end of a document.
5. Use `docs_replace_text` to fill in templates or bulk-update text.

## Finding the Document ID

The document ID is in the URL:
`https://docs.google.com/document/d/**DOCUMENT_ID**/edit`

Or use `drive_search` to find a document by name and get its ID.

## Examples

- "Create a doc called 'Meeting Notes' with today's agenda" → `docs_create`
- "Read the project spec doc" → `drive_search` then `docs_get`
- "Add a summary section to the doc" → `docs_append`
- "Replace all occurrences of '{{name}}' with 'Alice'" → `docs_replace_text`
- "Fill in the template: replace {{date}} and {{author}}" → `docs_replace_text` twice

## Error Handling

If any tool returns `"error": "auth_required"`, call `docs_auth_setup` first.
