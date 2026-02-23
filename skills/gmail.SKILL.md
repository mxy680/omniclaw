---
name: gmail
description: Full Gmail access — read, send, reply, forward, and manage emails using Google OAuth2.
metadata: {"openclaw": {"emoji": "📧"}}
---

# Gmail

Read, send, reply, forward, and manage your Gmail messages.

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

- `gmail_auth_setup` — Authenticate with your Gmail account (run once after setup)
- `gmail_accounts` — List all authenticated accounts and their email addresses
- `gmail_inbox` — List recent inbox messages (subject, from, date, snippet)
- `gmail_search` — Search emails with Gmail query syntax
- `gmail_get` — Fetch the full body of a single message by ID
- `gmail_send` — Send a new email
- `gmail_reply` — Reply to an existing message (keeps thread)
- `gmail_forward` — Forward a message to another recipient
- `gmail_modify` — Mark read/unread, archive, or trash a message

## Workflow

1. Complete first-time setup above.
2. Call `gmail_auth_setup` — a browser window opens, sign in, done.
3. Use `gmail_accounts` to see which accounts are authenticated.
4. Use `gmail_inbox` to see recent emails or `gmail_search` for targeted searches.
5. Use `gmail_get <id>` to read the full body of a message.
6. Use `gmail_send`, `gmail_reply`, or `gmail_forward` to respond or compose.
7. Use `gmail_modify` to mark messages read, archive, or trash them.

## Gmail Query Syntax Examples

- `from:alice` — emails from alice
- `subject:meeting` — emails with "meeting" in subject
- `after:2025/01/01` — emails after Jan 1 2025
- `has:attachment` — emails with attachments
- `is:unread` — unread emails only
- Combine: `from:boss is:unread after:2025/01/01`

## Error Handling

If any tool returns `"error": "auth_required"`, call `gmail_auth_setup` first.
