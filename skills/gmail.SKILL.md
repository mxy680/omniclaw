---
name: gmail
description: Full Gmail access — read, send, reply, forward, manage drafts, labels, and threads using Google OAuth2.
metadata: {"openclaw": {"emoji": "📧"}}
---

# Gmail

Read, send, reply, forward, and manage your Gmail messages, drafts, labels, and threads.

## First-Time Setup

omniclaw requires your own Google Cloud OAuth credentials. Do this once:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project
2. Enable the **Gmail API** (APIs & Services → Library → search "Gmail API")
3. Create an OAuth client: APIs & Services → Credentials → **+ Create Credentials → OAuth client ID**
   - Application type: **Desktop app**
4. Download the `client_secret.json`
5. Go to **OAuth consent screen → Test users** and add your Gmail address
6. Configure the plugin: `openclaw plugins config omniclaw`
   - Set `client_secret_path` to the path of your downloaded `client_secret.json`
7. Call `gmail_auth_setup` to complete authentication

## Available Tools

### Core
- `gmail_auth_setup` — Authenticate with your Gmail account (run once after setup)
- `gmail_accounts` — List all authenticated accounts and their email addresses
- `gmail_inbox` — List recent inbox messages (subject, from, date, snippet)
- `gmail_search` — Search emails with Gmail query syntax (searches all labels, not just Inbox)
- `gmail_get` — Fetch the full body of a message by ID (includes CC, BCC, Reply-To, threadId, labelIds, snippet)
- `gmail_download_attachment` — Download an email attachment by ID

### Compose
- `gmail_send` — Send a new email (supports CC, BCC, HTML body)
- `gmail_reply` — Reply to an existing message (supports reply-all and HTML body)
- `gmail_forward` — Forward a message with original attachments

### Manage
- `gmail_modify` — Mark read/unread, archive, trash, untrash, star/unstar, or add/remove labels

### Drafts
- `gmail_draft_list` — List all drafts
- `gmail_draft_create` — Create a new draft
- `gmail_draft_update` — Update an existing draft
- `gmail_draft_delete` — Delete a draft
- `gmail_draft_send` — Send an existing draft

### Labels
- `gmail_labels_list` — List all labels (system and user-created)
- `gmail_label_create` — Create a new label
- `gmail_label_delete` — Delete a label

### Threads
- `gmail_thread_list` — List threads with optional query filter
- `gmail_thread_get` — Get all messages in a thread

## Workflow

1. Complete first-time setup above.
2. Call `gmail_auth_setup` — a browser window opens, sign in, done.
3. Use `gmail_accounts` to see which accounts are authenticated.
4. Use `gmail_inbox` to see recent emails or `gmail_search` for targeted searches.
5. Use `gmail_get <id>` to read the full body of a message.
6. Use `gmail_download_attachment` to save attachments locally.
7. Use `gmail_send`, `gmail_reply`, or `gmail_forward` to respond or compose.
8. Use `gmail_modify` to mark messages read, archive, trash, star, or manage labels.
9. Use `gmail_draft_*` tools to create, edit, and send drafts.
10. Use `gmail_thread_get` to read entire conversation threads.

## Gmail Query Syntax Examples

- `from:alice` — emails from alice
- `subject:meeting` — emails with "meeting" in subject
- `after:2025/01/01` — emails after Jan 1 2025
- `has:attachment` — emails with attachments
- `is:unread` — unread emails only
- Combine: `from:boss is:unread after:2025/01/01`

## Error Handling

If any tool returns `"error": "auth_required"`, call `gmail_auth_setup` first.
