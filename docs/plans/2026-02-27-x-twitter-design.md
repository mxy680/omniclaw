# X (Twitter) Integration Design

## Overview

Full read-write X integration using browser session auth (Playwright login) and direct HTTP calls to X's internal GraphQL API. ~15 tools covering timeline, search, tweets, engagement, users, and bookmarks.

## Auth

- **Login**: Playwright launches visible browser to `x.com`, user logs in manually (handles 2FA, CAPTCHAs, SSO)
- **Session capture**: Extract `auth_token` and `ct0` cookies after login
- **API calls**: Direct `fetch()` with cookies + static bearer token + CSRF header
- **Token storage**: `~/.openclaw/omniclaw-x-tokens.json`

## API Call Pattern

X's internal API uses GraphQL at `https://x.com/i/api/graphql/<queryId>/<operationName>`.

Required headers:
- `Authorization: Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs`
- `x-csrf-token: <ct0 cookie value>`
- `Cookie: auth_token=<auth_token>; ct0=<ct0>`
- `x-twitter-auth-type: OAuth2Session`
- `x-twitter-active-user: yes`

GraphQL query IDs are hardcoded (extracted from X's web client). They change occasionally on X deploys — pinned and updated as needed.

## File Structure

```
src/auth/x-client-manager.ts     — XClientManager (session storage + HTTP client)
src/tools/x-auth-tool.ts         — x_auth_setup (Playwright login flow)
src/tools/x-utils.ts             — jsonResult, AUTH_REQUIRED, shared helpers
src/tools/x-timeline.ts          — x_get_timeline, x_get_user_tweets
src/tools/x-search.ts            — x_search
src/tools/x-tweet.ts             — x_post_tweet, x_delete_tweet, x_reply
src/tools/x-engagement.ts        — x_like, x_unlike, x_retweet, x_unretweet
src/tools/x-users.ts             — x_follow, x_unfollow, x_get_profile, x_get_user
src/tools/x-bookmarks.ts         — x_get_bookmarks
skills/x.SKILL.md                — Skill file
```

## Tools

| Tool | Method | Description |
|------|--------|-------------|
| `x_auth_setup` | Playwright | Login to X, capture session cookies |
| `x_get_timeline` | GraphQL | Home timeline (For You / Following) |
| `x_get_user_tweets` | GraphQL | A user's tweets |
| `x_search` | GraphQL | Search tweets (Top/Latest/People/Photos/Videos) |
| `x_post_tweet` | GraphQL | Post a new tweet (with optional media) |
| `x_delete_tweet` | GraphQL | Delete a tweet |
| `x_reply` | GraphQL | Reply to a tweet |
| `x_like` | GraphQL | Like a tweet |
| `x_unlike` | GraphQL | Unlike a tweet |
| `x_retweet` | GraphQL | Retweet |
| `x_unretweet` | GraphQL | Remove retweet |
| `x_follow` | GraphQL | Follow a user |
| `x_unfollow` | GraphQL | Unfollow a user |
| `x_get_profile` | GraphQL | Get a user's profile |
| `x_get_bookmarks` | GraphQL | Get bookmarked tweets |

## XClientManager

```typescript
interface XSession {
  auth_token: string;
  ct0: string;
  cookie_details?: Array<{ name: string; value: string; domain: string; path: string }>;
}

class XClientManager {
  constructor(tokensPath: string);
  setCredentials(account: string, session: XSession): void;
  getCredentials(account: string): XSession | null;
  hasCredentials(account: string): boolean;
  listAccounts(): string[];
  graphql(account: string, operationName: string, queryId: string, variables: Record<string, unknown>, features?: Record<string, boolean>): Promise<unknown>;
}
```

## Key Decisions

- **Direct HTTP over Playwright for API calls**: X's API works with direct fetch (unlike LinkedIn/Instagram). Simpler, faster, lower resources.
- **Browser session auth over OAuth**: No developer app registration, no rate limits from official API tier, full access to everything visible in browser.
- **Hardcoded query IDs**: Extracted from X's web client JS. Will need periodic updates when X deploys changes.
- **Multi-account support**: Every tool has optional `account` parameter defaulting to `"default"`.
