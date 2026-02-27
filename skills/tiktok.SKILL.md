---
name: tiktok
description: TikTok access — browse feed, search videos, view profiles, trending content, and read comments.
metadata: {"openclaw": {"emoji": "🎵"}}
---

# TikTok

Browse your For You page, search videos and users, view profiles, explore trending content, and read comments.

## First-Time Setup

TikTok uses browser-based authentication via Playwright — no API token needed.

1. Make sure Playwright browsers are installed: `npx playwright install chromium`
2. Save your TikTok credentials once (so you never have to type them again):

```bash
openclaw config set plugins.entries.omniclaw.config.tiktok_username "your_email_or_username"
openclaw config set plugins.entries.omniclaw.config.tiktok_password "your_password"
```

3. Call `tiktok_auth_setup` with no arguments — the tool reads your credentials automatically.

If your account uses MFA, the browser will stay open for you to complete the verification manually.

## Available Tools

- `tiktok_auth_setup` — Authenticate via browser login
- `tiktok_profile` — Get your own TikTok profile
- `tiktok_get_user` — Get any user's profile by username
- `tiktok_user_videos` — Get a user's recent videos
- `tiktok_video_details` — Get full details for a specific video by URL or ID
- `tiktok_feed` — Get For You page recommendations
- `tiktok_search_videos` — Search for videos by keyword
- `tiktok_search_users` — Search for users by keyword
- `tiktok_trending` — Get trending/popular videos
- `tiktok_video_comments` — Get comments on a video

## Workflow

1. Call `tiktok_auth_setup` with no arguments (reads credentials from config).
2. Use `tiktok_profile` to verify your account info.
3. Browse with `tiktok_feed` or `tiktok_trending`.
4. Search with `tiktok_search_videos` or `tiktok_search_users`.
5. View details with `tiktok_get_user`, `tiktok_user_videos`, or `tiktok_video_details`.
6. Read engagement with `tiktok_video_comments`.

## Error Handling

If any tool returns `"error": "auth_required"`, call `tiktok_auth_setup` first.

If you get session expired errors, call `tiktok_auth_setup` again to re-authenticate. TikTok sessions may expire after a period of inactivity.
