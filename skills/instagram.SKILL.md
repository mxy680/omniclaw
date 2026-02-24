---
name: instagram
description: Instagram access — profiles, feed, posts, stories, reels, search, followers, DMs, and notifications.
metadata: {"openclaw": {"emoji": "📸"}}
---

# Instagram

View Instagram profiles, browse your feed, explore posts and reels, watch stories, search users and hashtags, check followers, read DMs, and review notifications.

## First-Time Setup

Instagram uses browser-based authentication via Playwright — no API token needed.

1. Make sure Playwright browsers are installed: `npx playwright install chromium`
2. Save your Instagram credentials once (so you never have to type them again):

```bash
openclaw config set plugins.entries.omniclaw.config.instagram_username "your_username"
openclaw config set plugins.entries.omniclaw.config.instagram_password "your_password"
```

3. Call `instagram_auth_setup` with no arguments:

```
instagram_auth_setup
```

4. A browser will open to instagram.com/accounts/login/. If credentials are configured, they will be auto-filled. Complete any MFA/captcha challenges manually — the tool waits up to 5 minutes.
5. Once login succeeds, session cookies are saved automatically.

> You can also pass `username` and `password` directly to `instagram_auth_setup` to override the saved config.

## Available Tools

- `instagram_auth_setup` — Authenticate via browser login (run once per session)
- `instagram_profile` — Get your own Instagram profile
- `instagram_get_profile` — Get any user's profile by username
- `instagram_feed` — Get posts from your home feed
- `instagram_user_posts` — Get a user's recent posts
- `instagram_post_details` — Get details of a specific post by shortcode/URL
- `instagram_post_comments` — Get comments on a post
- `instagram_stories` — Get story tray or a specific user's stories
- `instagram_reels` — Get trending reels
- `instagram_search` — Search for users, hashtags, and places
- `instagram_followers` — Get a user's followers
- `instagram_following` — Get accounts a user follows
- `instagram_conversations` — List your DM conversations
- `instagram_messages` — Get messages from a DM thread
- `instagram_notifications` — List your activity notifications
- `instagram_saved` — Get your saved/bookmarked posts

## Workflow

1. Call `instagram_auth_setup` with no arguments — the tool reads credentials from the plugin config automatically. Do NOT ask the user for their email, username, or password.
2. Use `instagram_profile` to see your own profile info.
3. Use `instagram_get_profile` with a username to view someone else's profile.
4. Use `instagram_feed` to see recent posts from your timeline.
5. Use `instagram_user_posts` to see a specific user's posts.
6. Use `instagram_post_details` with a shortcode or URL to get full post info.
7. Use `instagram_post_comments` to read comments on a specific post.
8. Use `instagram_stories` to see who has active stories, or pass a username to view their stories.
9. Use `instagram_reels` to discover trending reels.
10. Use `instagram_search` to find users, hashtags, or places.
11. Use `instagram_followers` / `instagram_following` to see a user's social graph.
12. Use `instagram_conversations` to see DM threads, then `instagram_messages` with a thread_id to read messages.
13. Use `instagram_notifications` to check recent activity.
14. Use `instagram_saved` to review your bookmarked posts.

## Error Handling

If any tool returns `"error": "auth_required"`, call `instagram_auth_setup` first.

If a session expires, call `instagram_auth_setup` again to re-authenticate.
