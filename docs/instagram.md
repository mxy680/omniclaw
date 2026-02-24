# Instagram Integration

16 tools for browsing Instagram — profiles, feed, posts, stories, reels, search, followers, DMs, and notifications.

## Setup

Instagram uses browser-based authentication via Playwright — no API token needed. Instagram blocks non-browser HTTP clients, so all API calls are made through a real browser context.

### Step 1: Install Browser

```bash
npx playwright install chromium
```

### Step 2: Configure Credentials (Optional)

Save your Instagram credentials so authentication is automatic:

```bash
openclaw config set plugins.entries.omniclaw.config.instagram_username "your_username"
openclaw config set plugins.entries.omniclaw.config.instagram_password "your_password"
```

### Step 3: Authenticate

Ask your agent:
> "Set up Instagram"

It will call `instagram_auth_setup`, which opens a Chromium browser to Instagram's login page. If credentials are configured, they are auto-filled. Complete any MFA or captcha challenges manually — the tool waits up to 5 minutes.

## Tools

| Tool | Description |
|------|-------------|
| `instagram_auth_setup` | Authenticate via browser login |
| `instagram_profile` | Get your own Instagram profile |
| `instagram_get_profile` | Get any user's profile by username |
| `instagram_feed` | Get posts from your home feed |
| `instagram_user_posts` | Get a user's recent posts |
| `instagram_post_details` | Get details of a specific post by shortcode/URL |
| `instagram_post_comments` | Get comments on a post |
| `instagram_stories` | Get story tray or a specific user's stories |
| `instagram_reels` | Get trending reels |
| `instagram_search` | Search for users, hashtags, and places |
| `instagram_followers` | Get a user's followers |
| `instagram_following` | Get accounts a user follows |
| `instagram_conversations` | List your DM conversations |
| `instagram_messages` | Get messages from a DM thread |
| `instagram_notifications` | List your activity notifications |
| `instagram_saved` | Get your saved/bookmarked posts |

## Configuration

All configuration is set via `openclaw config set plugins.entries.omniclaw.config.<key> <value>`.

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `instagram_tokens_path` | No | `~/.openclaw/omniclaw-instagram-tokens.json` | Where Instagram session tokens are stored |
| `instagram_username` | No | — | Instagram username for automatic login |
| `instagram_password` | No | — | Instagram password for automatic login |

## Usage Examples

> "Show me my Instagram profile"
> "Look up natgeo's Instagram"
> "What's on my Instagram feed?"
> "Show me the latest posts from nasa"
> "Get details of this post: https://www.instagram.com/p/CxYz123/"
> "Show comments on this Instagram post"
> "Who has Instagram stories right now?"
> "Show me trending reels"
> "Search Instagram for photography"
> "Who follows natgeo on Instagram?"
> "Show me my Instagram DMs"
> "Check my Instagram notifications"
> "Show my saved Instagram posts"
