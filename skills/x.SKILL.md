---
name: x
description: Post tweets, browse timelines, search, manage followers, bookmarks, lists, and send DMs on X (Twitter).
metadata: {"openclaw": {"emoji": "𝕏"}}
---

# X (Twitter)

Access X (Twitter) through session-based authentication. Post and manage tweets, browse timelines, search, manage followers and following, interact with bookmarks and lists, and send direct messages.

## First-Time Setup

1. Click **Connect Account** on the X integration in the web dashboard
2. A browser window will open — log in to X manually (supports SSO, MFA, passkeys)
3. The browser closes automatically once authenticated
4. Session cookies are captured and stored locally

Alternatively, call `x_auth_setup` directly from an agent conversation.

**Note:** Sessions typically last several days to weeks. Re-authenticate with `x_auth_setup` when the session expires.

## Available Tools

### Authentication
- `x_auth_setup` — Authenticate with X via browser login

### Profile
- `x_profile_me` — Get your own profile information
- `x_profile_get` — View another user's profile by username

### Timelines
- `x_timeline_home` — Get your home timeline feed
- `x_timeline_user` — Get tweets from a specific user by user ID

### Tweets
- `x_tweet_get` — Get details of a specific tweet by tweet ID
- `x_tweet_create` — Post a new tweet
- `x_tweet_reply` — Reply to a tweet
- `x_tweet_delete` — Delete a tweet

### Search
- `x_search` — Search for tweets

### Interactions
- `x_tweet_like` — Like a tweet
- `x_tweet_unlike` — Unlike a tweet
- `x_tweet_retweet` — Retweet a tweet
- `x_tweet_unretweet` — Undo a retweet

### Bookmarks
- `x_tweet_bookmark` — Bookmark a tweet
- `x_tweet_unbookmark` — Remove a bookmark
- `x_bookmarks_list` — List your bookmarks

### Social
- `x_follow` — Follow a user
- `x_unfollow` — Unfollow a user
- `x_followers_list` — List followers of a user
- `x_following_list` — List accounts a user is following

### Direct Messages
- `x_dm_conversations` — List DM conversations
- `x_dm_messages` — Get messages in a DM conversation
- `x_dm_send` — Send a direct message

### Lists
- `x_lists_get` — Get your lists
- `x_list_timeline` — Get tweets from a list

## Workflow

1. Authenticate with `x_auth_setup`
2. Get your profile with `x_profile_me` to find your user ID
3. Use read tools to browse timelines, search tweets, and check bookmarks
4. Use write tools to post tweets, like, retweet, follow, and send DMs

## Examples

- "Show my X profile" → `x_profile_me`
- "Look up @elonmusk on X" → `x_profile_get` with username "elonmusk"
- "Show my timeline" → `x_timeline_home`
- "Search for AI news on X" → `x_search` with query "AI news"
- "Post a tweet saying hello" → `x_tweet_create` with text "hello"
- "Like this tweet" → `x_tweet_like` with tweet_id
- "Check my bookmarks" → `x_bookmarks_list`
- "Show my DMs" → `x_dm_conversations`
- "Who follows me?" → `x_followers_list` with your user_id

## Error Handling

- `auth_required` → Call `x_auth_setup` to authenticate
- `session_expired` → Re-authenticate with `x_auth_setup`
- `x_api_error` → Check the error message for details; X may rate-limit or block requests
- `rate_limited` → Wait and retry; X enforces strict rate limits on most endpoints
