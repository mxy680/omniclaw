---
name: linkedin
description: Post updates, manage connections, search people, and send messages on LinkedIn.
metadata: {"openclaw": {"emoji": "💼"}}
---

# LinkedIn

Access LinkedIn through the Voyager API using browser-based session cookie authentication. Post updates, manage connections, search for people, and send messages.

## First-Time Setup

1. Click **Connect Account** on the LinkedIn integration in the web dashboard
2. A browser window will open — log in to LinkedIn manually (supports SSO, MFA, passkeys)
3. The browser closes automatically once authenticated
4. Session cookies are captured and stored locally

Alternatively, call `linkedin_auth_setup` directly from an agent conversation.

**Note:** Sessions typically last 24h–30d. Re-authenticate with `linkedin_auth_setup` when the session expires.

## Available Tools

- `linkedin_auth_setup` — Authenticate with LinkedIn via browser login
- `linkedin_profile_get` — Get your own profile information
- `linkedin_profile_view` — View another user's profile by public ID
- `linkedin_connections_list` — List your 1st-degree connections
- `linkedin_search_people` — Search for people by keyword
- `linkedin_post_list` — Get posts from your feed
- `linkedin_post_create` — Create a new text post
- `linkedin_post_like` — Like a post
- `linkedin_post_comment` — Comment on a post
- `linkedin_messages_list` — List recent conversations
- `linkedin_messages_send` — Send a message in a conversation

## Workflow

1. Authenticate with `linkedin_auth_setup`
2. Use read tools to explore your network and feed
3. Use write tools to post, react, comment, or message

## Examples

- "Show my LinkedIn profile" → `linkedin_profile_get`
- "List my connections" → `linkedin_connections_list`
- "Search for product managers at Google" → `linkedin_search_people` with keywords "product manager Google"
- "Post an update about my new project" → `linkedin_post_create`
- "Show my recent messages" → `linkedin_messages_list`

## Error Handling

- `auth_required` → Call `linkedin_auth_setup` to authenticate
- `session_expired` → Re-authenticate with `linkedin_auth_setup`
- `linkedin_api_error` → Check the error message for details
