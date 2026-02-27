# Dashboard Rules

- **NEVER run `next start` or `pnpm start` for the dashboard.** It uses `output: "export"` (static HTML), so `next start` always returns 500 Internal Server Error.
- **Always use `pnpm dev`** to run the dashboard locally.
- The dashboard must run on port 3000. Before starting, kill only stale `node` processes on :3000 (never blindly `kill $(lsof -ti :3000)` — that can kill Firefox).
- When initializing React state from browser APIs (localStorage, sessionStorage, etc.), **never use a lazy initializer** like `useState(() => readFromStorage())`. Instead, initialize with a static default and hydrate in `useEffect` to avoid SSR hydration mismatches.

# Development Kanban

## Done

| Integration | Tools | Skill | Docs | Notes |
|---|---|---|---|---|
| Gmail | 10 | `gmail` | `docs/google-workspace.md` | OAuth2, multi-account |
| Google Calendar | 7 | `calendar` | `docs/google-workspace.md` | OAuth2, shared with Gmail |
| Google Drive | 10 | `drive` | `docs/google-workspace.md` | OAuth2, shared with Gmail |
| Google Docs | 5 | `docs` | `docs/google-workspace.md` | OAuth2, shared with Gmail |
| Google Sheets | 6 | `sheets` | `docs/google-workspace.md` | OAuth2, shared with Gmail |
| Google Slides | 5 | `slides` | `docs/google-workspace.md` | OAuth2, shared with Gmail |
| GitHub | 18 | `github` | `docs/github.md` | Personal Access Token |
| Gemini AI | 5 | `gemini` | `docs/gemini.md` | API key auth |
| YouTube | 7 | `youtube` | `docs/youtube.md` | Transcripts need no auth; search uses Google OAuth |
| Canvas LMS | 11 | `canvas` | `docs/canvas.md` | Bearer token auth via Playwright SSO |
| LinkedIn | 17 | `linkedin` | `docs/linkedin.md` | Browser auth via Playwright |
| Instagram | 17 | `instagram` | `docs/instagram.md` | Browser auth via Playwright |
| iMessage | 7 | `imessage` | `skills/imessage.SKILL.md` | BlueBubbles backend, contact name resolution |
| Factor75 | 13 | `factor75` | `docs/factor75.md` | Playwright login + direct HTTP with JWT Bearer tokens |
| Nutrition Tracking | 21 | `nutrition` | `docs/nutrition.md` | Local SQLite, no auth. Includes pantry inventory + meal planning + workout planning |
| Slack | 8 | `slack` | `docs/slack.md` | Browser session auth (xoxc- token + d cookie), read-only |
| Vercel | 16 | `vercel` | `docs/vercel.md` | Personal Access Token |
| X (Twitter) | 44 | `x` | `docs/plans/2026-02-27-x-twitter-design.md` | Browser session auth, GraphQL + REST API |
| TikTok | 10 | `tiktok` | `docs/tiktok.md` | Playwright browser auth, read-only |

## In Progress

| Integration | Tools | Skill | Docs | Notes |
|---|---|---|---|---|
| *(none)* | | | | |

## Planned

| Integration | GitHub Issue | Notes |
|---|---|---|
| Handshake | #18 | |
| Zoom | #19 | |
| Venmo | #20 | |
| Bank of America | #21 | |
| Kalshi | #22 | |
| Shop | #23 | |
| Discord | #26 | |
| Facebook Marketplace | #27 | |
| Even Realities | #28 | |
| Framer | #30 | |
| Revolution EHR | #33 | |
| Gradescope | #34 | |
| Overleaf | #35 | |
| Rate My Professor | #36 | |
| CWRU SIS | #37 | |
| Cloudflare | #39 | |
| Hetzner | #40 | |
| Supabase | #41 | |
| npm | #42 | |
| PyPI | #43 | |
| Docker Hub | #44 | |
| GroupMe | #45 | |
| Reddit | #47 | |
| YouTube Music | #48 | |
| SoundCloud | #49 | |
| Google Maps | #50 | |
| Airbnb | #51 | |
| Google Flights | #52 | |
| Amazon | #53 | |
| eBay | #54 | |
| Costco | #55 | |
| Hugging Face | #56 | |
