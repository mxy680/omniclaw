# TikTok Integration Design

**Date**: 2026-02-27
**GitHub Issue**: #25

## Overview

Consumption-focused TikTok integration using Playwright browser-session authentication. Follows the same pattern as the Instagram integration — user logs in via a visible browser, we capture session cookies, and make API calls from within a Playwright browser context to bypass TikTok's anti-bot protections.

## Architecture

```
src/auth/tiktok-client-manager.ts    — Session storage + Playwright-context HTTP
src/tools/tiktok-auth-tool.ts        — Browser login, cookie capture
src/tools/tiktok-profile.ts          — Own profile
src/tools/tiktok-get-user.ts         — Any user's profile
src/tools/tiktok-user-videos.ts      — User's posted videos
src/tools/tiktok-video-details.ts    — Video details by URL/ID
src/tools/tiktok-feed.ts             — For You page
src/tools/tiktok-search.ts           — Search videos + users
src/tools/tiktok-trending.ts         — Trending/discover content
src/tools/tiktok-video-comments.ts   — Video comments
skills/tiktok.SKILL.md               — User-facing skill docs
```

## Auth Flow

1. Launch visible Chromium via Playwright
2. Navigate to `https://www.tiktok.com/login`
3. Auto-fill credentials if provided in config (`tiktok_username`, `tiktok_password`)
4. Poll for `sessionid` cookie (5-minute timeout, 1-second intervals)
5. Capture all cookies from browser context
6. Validate session with a profile fetch
7. Save to `~/.openclaw/omniclaw-tiktok-tokens.json` (multi-account, keyed by account name)

## Session Shape

```typescript
interface TikTokSession {
  sessionid: string;
  tt_csrf_token: string;
  msToken: string;
  tt_webid_v2: string;
  all_cookies: Record<string, string>;
  cookie_details: Array<{ name: string; value: string; domain: string; path: string }>;
}
```

## Tool Set (10 tools)

| Tool | Description |
|---|---|
| `tiktok_auth_setup` | Playwright browser login, capture session cookies |
| `tiktok_profile` | Get authenticated user's own profile |
| `tiktok_get_user` | Get any user's profile by username |
| `tiktok_user_videos` | List a user's posted videos (paginated) |
| `tiktok_video_details` | Get full details for a specific video by URL or ID |
| `tiktok_feed` | Get For You page recommendations |
| `tiktok_search_videos` | Search videos by keyword |
| `tiktok_search_users` | Search users by keyword |
| `tiktok_trending` | Get trending/discover content |
| `tiktok_video_comments` | Get comments on a specific video |

## API Endpoints (internal web API via Playwright fetch)

- **Profile**: `https://www.tiktok.com/api/user/detail/?uniqueId=<username>`
- **User videos**: `https://www.tiktok.com/api/post/item_list/?secUid=<id>&count=30&cursor=0`
- **Feed**: `https://www.tiktok.com/api/recommend/item_list/?count=30`
- **Search videos**: `https://www.tiktok.com/api/search/general/full/?keyword=<q>&offset=0&count=20`
- **Search users**: `https://www.tiktok.com/api/search/user/full/?keyword=<q>&offset=0&count=20`
- **Video comments**: `https://www.tiktok.com/api/comment/list/?aweme_id=<id>&count=20&cursor=0`
- **Trending**: `https://www.tiktok.com/api/discover/` (exact path TBD during implementation)

Note: These endpoints are reverse-engineered from TikTok's web app and may change. Implementation will verify exact paths by inspecting network traffic.

## Config Additions

Added to `PluginConfig` in `src/types/plugin-config.ts`:

```typescript
tiktok_tokens_path?: string;
tiktok_username?: string;
tiktok_password?: string;
```

## Registration

In `src/plugin.ts`, same pattern as Instagram:

1. Derive `tiktokTokensPath` from config (default: `~/.openclaw/omniclaw-tiktok-tokens.json`)
2. Create `TikTokClientManager` instance
3. Register all 10 tools unconditionally via `reg()`

## Design Decisions

- **Playwright-context fetch over direct HTTP**: TikTok's anti-bot system (X-Bogus parameter signing, device fingerprinting) blocks direct HTTP requests. Making fetch calls from within Playwright's browser context inherits the browser's anti-bot context.
- **Instagram as reference implementation**: Both are social media platforms with Playwright auth, session cookies, and internal web APIs. Code structure mirrors Instagram 1:1.
- **Consumption only**: No posting/uploading tools. Can be added later if needed.
