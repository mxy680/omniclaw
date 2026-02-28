# Discord Integration Design

**Date:** 2026-02-28
**Issue:** #26
**Auth:** Playwright user session (direct HTTP with extracted token)

## Overview

Add Discord integration with 16 tools covering guilds, channels, messages, threads, DMs, reactions, and search. Uses Playwright browser login to extract the user's auth token from localStorage, then makes direct HTTP calls to Discord API v9.

## Auth Approach

### Token Extraction

Discord stores the user's auth token in localStorage. After Playwright login:

1. Launch browser, navigate to `https://discord.com/login`
2. User logs in (or auto-fill if credentials provided in config)
3. Wait for navigation to `https://discord.com/channels/`
4. Extract token via: `page.evaluate(() => { ... })` — Discord stores it in localStorage or it can be intercepted from network requests using the `Authorization` header
5. Validate token with `GET /users/@me`
6. Store session in `~/.openclaw/omniclaw-discord-tokens.json`

### Session Shape

```typescript
interface DiscordSession {
  token: string;
  user_id: string;
  username: string;
  discriminator: string;
}
```

### API Details

- **Base URL:** `https://discord.com/api/v9`
- **Auth header:** `Authorization: <token>` (no "Bearer" prefix for user tokens)
- **Content-Type:** `application/json`
- **Rate limits:** Handle 429 responses with `Retry-After` header (exponential backoff)
- **Super properties header:** `X-Super-Properties` — base64-encoded JSON with browser/OS info to appear as a real client

## Tools (16 total)

### Auth (1 tool)

| Tool | Description |
|------|-------------|
| `discord_auth_setup` | Playwright browser login → token extraction → validation |

Config options: `discord_tokens_path?`, `discord_email?`, `discord_password?`

### Guilds (2 tools)

| Tool | Params | Description |
|------|--------|-------------|
| `discord_list_guilds` | `account?` | List all servers the user is in |
| `discord_get_guild` | `guild_id`, `account?` | Get server details including roles, member count |

### Channels (2 tools)

| Tool | Params | Description |
|------|--------|-------------|
| `discord_list_channels` | `guild_id`, `account?` | List all channels in a server |
| `discord_get_channel` | `channel_id`, `account?` | Get channel details (topic, type, permissions) |

### Messages (5 tools)

| Tool | Params | Description |
|------|--------|-------------|
| `discord_list_messages` | `channel_id`, `limit?`, `before?`, `after?`, `around?`, `account?` | Get messages from a channel with pagination |
| `discord_get_message` | `channel_id`, `message_id`, `account?` | Get a specific message |
| `discord_send_message` | `channel_id`, `content`, `reply_to?`, `account?` | Send a message (works for both channels and DMs) |
| `discord_edit_message` | `channel_id`, `message_id`, `content`, `account?` | Edit own message |
| `discord_delete_message` | `channel_id`, `message_id`, `account?` | Delete own message |

### Reactions (2 tools)

| Tool | Params | Description |
|------|--------|-------------|
| `discord_add_reaction` | `channel_id`, `message_id`, `emoji`, `account?` | Add emoji reaction to a message |
| `discord_remove_reaction` | `channel_id`, `message_id`, `emoji`, `account?` | Remove own reaction from a message |

### Threads (2 tools)

| Tool | Params | Description |
|------|--------|-------------|
| `discord_list_threads` | `guild_id`, `channel_id?`, `account?` | List active threads (optionally filtered by parent channel) |
| `discord_create_thread` | `channel_id`, `name`, `message_id?`, `auto_archive_duration?`, `account?` | Create a thread (from message or standalone) |

### DMs (1 tool)

| Tool | Params | Description |
|------|--------|-------------|
| `discord_list_dms` | `account?` | List DM channels with recent activity |

Note: Sending DMs uses `discord_send_message` with a DM channel_id. To start a new DM, the user opens a DM channel first via `POST /users/@me/channels` with `recipient_id` — this can be a param on `discord_send_message` (`recipient_id?` as alternative to `channel_id`).

### Search (1 tool)

| Tool | Params | Description |
|------|--------|-------------|
| `discord_search_messages` | `guild_id`, `query`, `author_id?`, `channel_id?`, `has?`, `limit?`, `account?` | Search messages in a guild |

## File Structure

```
src/auth/discord-client-manager.ts     — DiscordClientManager (session store + HTTP methods)
src/tools/discord-utils.ts             — jsonResult, AUTH_REQUIRED, constants
src/tools/discord-auth-tool.ts         — discord_auth_setup (Playwright)
src/tools/discord-guilds.ts            — list_guilds, get_guild
src/tools/discord-channels.ts          — list_channels, get_channel
src/tools/discord-messages.ts          — list_messages, get_message, send_message, edit_message, delete_message
src/tools/discord-reactions.ts         — add_reaction, remove_reaction
src/tools/discord-threads.ts           — list_threads, create_thread
src/tools/discord-dms.ts               — list_dms
src/tools/discord-search.ts            — search_messages
skills/discord.SKILL.md                — Skill documentation
tests/integration/discord.test.ts      — Integration tests
```

## Rate Limit Handling

Discord enforces per-route rate limits. The client manager will:

1. Read `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers from every response
2. On 429 response, wait for `Retry-After` seconds then retry (max 3 retries)
3. Log rate limit warnings via `console.warn`

## Error Handling

Standard pattern — all tools return `jsonResult({ error: ... })` on failure. Auth-required returns the standard `AUTH_REQUIRED` constant pointing to `discord_auth_setup`.

## Plugin Registration

In `src/plugin.ts`, add Discord block after TikTok (or similar position):

```typescript
const discordTokensPath = config.discord_tokens_path ??
  path.join(defaultTokensDir, "omniclaw-discord-tokens.json");
const discordManager = new DiscordClientManager(discordTokensPath);

reg(createDiscordAuthTool(discordManager, config));
reg(createDiscordListGuilds(discordManager));
reg(createDiscordGetGuild(discordManager));
// ... all 16 tools
```

## Config Additions (`plugin-config.ts`)

```typescript
discord_tokens_path?: string;
discord_email?: string;
discord_password?: string;
```

## What I Need From the User to Test

1. A Discord account (email + password for auto-login, or manual browser login)
2. Access to at least one Discord server with text channels
3. A DM conversation to test DM reading
