# Slack Integration

8 read-only tools for browsing Slack — list channels, read messages and threads, search, and look up users.

## Setup

Slack uses browser-based session authentication via Playwright. This approach works even in workspaces that restrict custom Slack app installations. After authentication, all API calls use fast direct HTTP with the captured session tokens (~100ms per call).

### Step 1: Install Browser

```bash
npx playwright install chromium
```

### Step 2: Configure Workspace (Optional)

Save your Slack workspace subdomain so you don't have to type it each time:

```bash
openclaw config set plugins.entries.omniclaw.config.slack_workspace "mycompany"
```

### Step 3: Authenticate

Ask your agent:
> "Set up Slack"

It will call `slack_auth_setup`, which opens a Chromium browser to your Slack workspace login page. Complete the login (including any MFA) manually — the tool waits up to 5 minutes. Once logged in, the session tokens are captured and stored.

## Tools

| Tool | Description |
|------|-------------|
| `slack_auth_setup` | Authenticate via browser login |
| `slack_list_channels` | List channels (public, private, DMs, group DMs) |
| `slack_get_channel_info` | Get detailed info about a channel |
| `slack_list_messages` | Read messages from a channel |
| `slack_get_thread` | Read all replies in a thread |
| `slack_search_messages` | Search messages across the workspace |
| `slack_list_users` | List workspace members |
| `slack_get_user_info` | Get a user's profile by ID |

## Configuration

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `slack_workspace` | No | *(none)* | Slack workspace subdomain (e.g. `mycompany`) |
| `slack_tokens_path` | No | `~/.openclaw/omniclaw-slack-tokens.json` | Where session tokens are stored |

## Architecture

### Authentication

Slack's web client uses two credentials for API access:

1. **`xoxc-` token**: A client session token stored in the browser's localStorage
2. **`d` cookie**: A session cookie with value starting with `xoxd-`

Both are required for API calls. The auth flow:
1. Playwright opens `https://<workspace>.slack.com`
2. User completes login (email/password + MFA)
3. Tool extracts the `xoxc-` token from localStorage/boot data
4. Tool extracts the `d` cookie from browser cookies
5. Validates with `auth.test` API call
6. Stores both in the tokens file

### API Calls

All tools call the standard Slack Web API (`https://slack.com/api/<method>`) using POST with:
- `Authorization: Bearer xoxc-...` header
- `Cookie: d=xoxd-...` header
- `Content-Type: application/x-www-form-urlencoded` body

### Token Lifetime

Session tokens typically last for several days but may expire if:
- You log out of Slack in your browser
- The workspace admin revokes sessions
- Extended inactivity

When tokens expire, tools return an `auth_required` error. Re-run `slack_auth_setup`.

## Limitations

- **Read-only**: No message sending, channel creation, or workspace administration
- **Session-based**: Tokens are tied to your user session, not an installed app
- **Rate limits**: Slack applies standard Web API rate limits (Tier 2-3 depending on method)
