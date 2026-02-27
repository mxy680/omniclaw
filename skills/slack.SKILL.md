---
name: slack
description: Read-only Slack access — browse channels, read messages, search, and look up users via browser session auth.
metadata: {"openclaw": {"emoji": "💬"}}
---

# Slack

Read-only access to your Slack workspace — browse channels, read messages and threads, search, and look up users.

## First-Time Setup

omniclaw uses browser session authentication (no Slack app installation required). This works even in workspaces that restrict custom app installs.

1. Know your Slack workspace subdomain (e.g. `mycompany` from `mycompany.slack.com`)
2. Optionally pre-configure it: `openclaw config set plugins.entries.omniclaw.config.slack_workspace "mycompany"`
3. Call `slack_auth_setup` — a browser window opens, log into Slack, done.

## Available Tools

- `slack_auth_setup` — Authenticate with Slack (opens browser for login)
- `slack_list_channels` — List channels (public, private, DMs, group DMs)
- `slack_get_channel_info` — Get details about a specific channel
- `slack_list_messages` — Read messages from a channel (with date range filtering)
- `slack_get_thread` — Read all replies in a thread
- `slack_search_messages` — Search messages across all channels
- `slack_list_users` — List workspace members
- `slack_get_user_info` — Get a user's profile by ID

## Workflow

1. Call `slack_auth_setup` with your workspace name — log in via the browser window.
2. Use `slack_list_channels` to browse available channels.
3. Use `slack_list_messages` with a channel ID to read recent messages.
4. Use `slack_get_thread` to read thread replies (needs channel ID + thread timestamp).
5. Use `slack_search_messages` to find messages across the workspace.
6. Use `slack_list_users` / `slack_get_user_info` to resolve user IDs to names.

## Search Syntax

Slack search supports operators:
- `from:@username` — messages from a user
- `in:#channel` — messages in a channel
- `has:link` / `has:reaction` / `has:emoji` — content filters
- `before:YYYY-MM-DD` / `after:YYYY-MM-DD` — date range
- `during:month` / `during:year` — relative dates
- Combine: `from:@alice in:#general after:2025-01-01`

## Error Handling

If any tool returns `"error": "auth_required"`, call `slack_auth_setup` first.
If you get `"token_revoked"` or `"invalid_auth"`, the session has expired — re-run `slack_auth_setup`.
