---
name: x
description: Full read-write X (Twitter) access — browse timelines, search, post/delete tweets, like, retweet, follow/unfollow, and manage bookmarks via browser session auth.
metadata: {"openclaw": {"emoji": "🐦"}}
---

# X (Twitter)

Full read-write access to X (Twitter) using browser session authentication. No developer API key needed — uses your logged-in browser session.

## First-Time Setup

1. Run `x_auth_setup` — a browser window opens to x.com
2. Log in with your X credentials (handles 2FA automatically)
3. The tool captures your session cookies — you're ready to go

## Available Tools

- **x_auth_setup** — authenticate with X via browser login
- **x_get_timeline** — home timeline (Following or For You tab)
- **x_get_user_tweets** — a specific user's tweets
- **x_search** — search tweets with full X search syntax
- **x_post_tweet** — post a new tweet
- **x_delete_tweet** — delete one of your tweets
- **x_reply** — reply to a tweet
- **x_like** / **x_unlike** — like or unlike a tweet
- **x_retweet** / **x_unretweet** — retweet or remove a retweet
- **x_follow** / **x_unfollow** — follow or unfollow a user
- **x_get_profile** — get a user's profile by @handle
- **x_get_bookmarks** — get your bookmarked tweets

## Workflow

1. Authenticate: `x_auth_setup`
2. Browse: `x_get_timeline` or `x_search query="topic"`
3. Interact: `x_like`, `x_retweet`, `x_reply`
4. Post: `x_post_tweet text="Hello world"`
5. Discover: `x_get_profile screen_name="elonmusk"`

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
