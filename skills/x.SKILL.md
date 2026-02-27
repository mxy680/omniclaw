---
name: x
description: Full X (Twitter) account management — timelines, search, post/delete/quote/thread/poll/media tweets, DMs, lists, bookmarks, follow/mute/block, profile updates, and moderation via browser session auth.
metadata: {"openclaw": {"emoji": "🐦"}}
---

# X (Twitter)

Full read-write access to X (Twitter) using browser session authentication. No developer API key needed — uses your logged-in browser session.

## First-Time Setup

1. Run `x_auth_setup` — a browser window opens to x.com
2. Log in with your X credentials (handles 2FA automatically)
3. The tool captures your session cookies — you're ready to go

## Available Tools

### Auth
- **x_auth_setup** — authenticate with X via browser login

### Reading
- **x_get_timeline** — home timeline (Following or For You tab)
- **x_get_user_tweets** — a specific user's tweets
- **x_search** — search tweets with full X search syntax
- **x_get_profile** — get a user's profile by @handle
- **x_get_tweet_detail** — full tweet details with engagement stats and reply thread

### Posting
- **x_post_tweet** — post a new tweet
- **x_delete_tweet** — delete one of your tweets
- **x_reply** — reply to a tweet
- **x_post_media_tweet** — post a tweet with up to 4 images
- **x_quote_tweet** — quote-tweet another tweet
- **x_post_thread** — post a multi-tweet thread
- **x_post_poll** — post a tweet with a poll (2-4 choices)

### Engagement
- **x_like** / **x_unlike** — like or unlike a tweet
- **x_retweet** / **x_unretweet** — retweet or remove a retweet

### Bookmarks
- **x_get_bookmarks** — get your bookmarked tweets
- **x_add_bookmark** / **x_remove_bookmark** — bookmark or unbookmark a tweet

### Users
- **x_follow** / **x_unfollow** — follow or unfollow a user
- **x_mute** / **x_unmute** — mute or unmute a user
- **x_block** / **x_unblock** — block or unblock a user

### Profile
- **x_update_profile** — update your name, bio, location, or website URL
- **x_update_profile_image** — change your profile picture / avatar
- **x_update_profile_banner** — change your profile banner / header image

### Moderation
- **x_pin_tweet** / **x_unpin_tweet** — pin or unpin a tweet to your profile
- **x_hide_reply** / **x_unhide_reply** — hide or unhide a reply on your tweet

### Direct Messages
- **x_dm_inbox** — get your DM inbox (recent conversations)
- **x_dm_conversation** — get messages from a specific DM conversation
- **x_dm_send** — send a direct message

### Lists
- **x_get_lists** — get your lists (owned, subscribed, member of)
- **x_get_list_tweets** — get tweets from a list
- **x_get_list_members** — get members of a list
- **x_create_list** / **x_delete_list** / **x_update_list** — manage your lists
- **x_list_add_member** / **x_list_remove_member** — add or remove list members

## Search Syntax

X search supports these operators:
- `from:username` — tweets from a specific user
- `to:username` — tweets replying to a specific user
- `@username` — tweets mentioning a user
- `#hashtag` — tweets with a hashtag
- `"exact phrase"` — exact text match
- `since:YYYY-MM-DD` / `until:YYYY-MM-DD` — date range
- `filter:links` / `filter:images` / `filter:videos` — media filters
- `min_retweets:N` / `min_faves:N` / `min_replies:N` — engagement thresholds
- `lang:en` — language filter

## Error Handling

- **Session expired**: Call `x_auth_setup` to re-authenticate
- **Rate limited**: Wait a few minutes before retrying
- **User not found**: Verify the @handle is correct
