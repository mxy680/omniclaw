# TikTok Integration

Browse your For You page, search videos and users, view profiles, explore trending content, and read comments.

## Authentication

TikTok uses browser-based authentication via Playwright. No API token or developer account needed.

### Setup

1. Install Playwright browsers: `npx playwright install chromium`
2. Configure credentials:

```bash
openclaw config set plugins.entries.omniclaw.config.tiktok_username "your_email_or_username"
openclaw config set plugins.entries.omniclaw.config.tiktok_password "your_password"
```

3. Call `tiktok_auth_setup` — credentials are read automatically.

### How It Works

- Opens a visible Chromium browser, navigates to TikTok's email login page
- Auto-fills credentials if configured, otherwise waits for manual login
- Polls for `sessionid` cookie (5-minute timeout)
- Captures all cookies and saves to `~/.openclaw/omniclaw-tiktok-tokens.json`
- Validates session with a profile fetch before returning

If your account uses MFA (CAPTCHA, SMS, etc.), the browser stays open for manual completion.

Sessions may expire after inactivity — call `tiktok_auth_setup` again to re-authenticate.

## Tools (10)

| Tool | Description |
|---|---|
| `tiktok_auth_setup` | Authenticate via browser login |
| `tiktok_profile` | Get your own TikTok profile |
| `tiktok_get_user` | Get any user's profile by username |
| `tiktok_user_videos` | Get a user's recent videos |
| `tiktok_video_details` | Get full details for a video by URL or ID |
| `tiktok_feed` | Get For You page recommendations |
| `tiktok_search_videos` | Search for videos by keyword |
| `tiktok_search_users` | Search for users by keyword |
| `tiktok_trending` | Get trending/popular videos |
| `tiktok_video_comments` | Get comments on a video |

## Architecture

- **Client Manager**: `src/auth/tiktok-client-manager.ts` — session storage, Playwright-context HTTP
- **Auth Tool**: `src/tools/tiktok-auth-tool.ts` — Playwright browser login
- **Data Tools**: `src/tools/tiktok-*.ts` — 8 files for 9 data tools
- **Utils**: `src/tools/tiktok-utils.ts` — shared formatting helpers

All API calls are made via `page.evaluate()` inside a headless Playwright browser context. This bypasses TikTok's anti-bot protections (X-Bogus parameter signing, device fingerprinting) since requests originate from an actual browser.

## API Endpoints

Internal web API endpoints used (reverse-engineered, may change):

- `/api/user/detail/` — user profile
- `/api/post/item_list/` — user's videos
- `/api/item/detail/` — video details
- `/api/recommend/item_list/` — For You feed and trending
- `/api/search/general/full/` — video search
- `/api/search/user/full/` — user search
- `/api/comment/list/` — video comments

## Config Fields

| Field | Description |
|---|---|
| `tiktok_tokens_path` | Path to session token file (default: `~/.openclaw/omniclaw-tiktok-tokens.json`) |
| `tiktok_username` | Username/email for auto-login |
| `tiktok_password` | Password for auto-login |
