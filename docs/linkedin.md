# LinkedIn Integration

16 tools for managing your LinkedIn presence — profiles, feed, connections, messages, notifications, search, jobs, and companies.

## Setup

LinkedIn uses browser-based authentication via Playwright — no API token needed. LinkedIn blocks non-browser HTTP clients, so all API calls are made through a real browser context.

### Step 1: Install Browser

```bash
npx playwright install chromium
```

### Step 2: Configure Credentials (Optional)

Save your LinkedIn credentials so authentication is automatic:

```bash
openclaw config set plugins.entries.omniclaw.config.linkedin_username "your_email@example.com"
openclaw config set plugins.entries.omniclaw.config.linkedin_password "your_password"
```

### Step 3: Authenticate

Ask your agent:
> "Set up LinkedIn"

It will call `linkedin_auth_setup`, which opens a Chromium browser to LinkedIn's login page. If credentials are configured, they are auto-filled. Complete any MFA or captcha challenges manually — the tool waits up to 5 minutes.

## Tools

| Tool | Description |
|------|-------------|
| `linkedin_auth_setup` | Authenticate via browser login |
| `linkedin_profile` | Get your own LinkedIn profile |
| `linkedin_get_profile` | Get any user's full profile by public ID |
| `linkedin_feed` | Get posts from your feed |
| `linkedin_connections` | List your connections |
| `linkedin_conversations` | List message conversations |
| `linkedin_messages` | Get messages from a conversation |
| `linkedin_notifications` | List your notifications |
| `linkedin_search` | Search for people or companies |
| `linkedin_search_jobs` | Search for job listings |
| `linkedin_pending_invitations` | View incoming connection requests |
| `linkedin_company` | Get detailed company/organization info |
| `linkedin_job_details` | Get full details of a job posting |
| `linkedin_post_comments` | Read comments on a feed post |
| `linkedin_profile_views` | See who viewed your profile |
| `linkedin_saved_jobs` | List your saved/bookmarked jobs |

## Configuration

All configuration is set via `openclaw config set plugins.entries.omniclaw.config.<key> <value>`.

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `linkedin_tokens_path` | No | `~/.openclaw/omniclaw-linkedin-tokens.json` | Where LinkedIn session tokens are stored |
| `linkedin_username` | No | — | LinkedIn email for automatic login |
| `linkedin_password` | No | — | LinkedIn password for automatic login |

## Usage Examples

> "Show me my LinkedIn profile"
> "Look up John Doe's LinkedIn profile"
> "What's on my LinkedIn feed?"
> "List my recent LinkedIn connections"
> "Show me my LinkedIn messages"
> "Search LinkedIn for software engineers at Google"
> "Search for remote product manager jobs"
