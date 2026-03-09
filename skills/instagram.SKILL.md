---
name: instagram
description: Browse profiles, search users, view stories, like posts, comment, and send DMs on Instagram.
metadata: {"openclaw": {"emoji": "📸"}}
---

# Instagram

Access Instagram through the private API using browser-based session cookie authentication. Browse profiles, search users, view feed and stories, like and comment on posts, and send direct messages.

## First-Time Setup

1. Click **Connect Account** on the Instagram integration in the web dashboard
2. A browser window will open — log in to Instagram manually (supports SSO, MFA, passkeys)
3. The browser closes automatically once authenticated
4. Session cookies are captured and stored locally

Alternatively, call `instagram_auth_setup` directly from an agent conversation.

**Note:** Sessions typically last 24h–30d. Re-authenticate with `instagram_auth_setup` when the session expires. Instagram may also rotate CSRF tokens — this is handled automatically.

## Available Tools

- `instagram_auth_setup` — Authenticate with Instagram via browser login
- `instagram_profile_get` — Get your own profile information
- `instagram_profile_view` — View another user's profile by username
- `instagram_feed_get` — Get your timeline feed
- `instagram_post_list` — List posts for a user by user ID
- `instagram_post_get` — Get details of a specific post by media ID
- `instagram_search` — Search for users, hashtags, and places
- `instagram_stories_get` — Get stories for a user by user ID
- `instagram_post_like` — Like a post
- `instagram_post_unlike` — Unlike a post
- `instagram_post_comment` — Comment on a post
- `instagram_inbox_get` — List DM threads
- `instagram_messages_get` — Get messages in a DM thread
- `instagram_message_send` — Send a text DM

## Workflow

1. Authenticate with `instagram_auth_setup`
2. Get your profile with `instagram_profile_get` to find your user ID
3. Use read tools to browse feeds, search users, and view stories
4. Use write tools to like, comment, or send messages

## Examples

- "Show my Instagram profile" → `instagram_profile_get`
- "Look up @natgeo on Instagram" → `instagram_profile_view` with username "natgeo"
- "Search for travel photographers" → `instagram_search` with query "travel photographer"
- "Show my feed" → `instagram_feed_get`
- "Like this post" → `instagram_post_like` with media_id
- "Check my DMs" → `instagram_inbox_get`

## Error Handling

- `auth_required` → Call `instagram_auth_setup` to authenticate
- `session_expired` → Re-authenticate with `instagram_auth_setup`
- `instagram_api_error` → Check the error message for details; Instagram may block requests from non-standard TLS stacks
