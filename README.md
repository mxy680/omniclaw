# omniclaw

96+ tools for [OpenClaw](https://openclaw.ai) that give your AI agent full access to Google Workspace, GitHub, Gemini AI, YouTube, Canvas LMS, and LinkedIn. Manage emails, calendars, files, documents, spreadsheets, presentations, repos, issues, PRs, AI image/video generation, YouTube search, university coursework, and LinkedIn profiles — all through natural language.

## What's Included

| Service | Tools | Skills |
|---------|-------|--------|
| Gmail | 9 tools — inbox, search, read, send, reply, forward, manage | `gmail` |
| Google Calendar | 7 tools — list, view, create, update, delete, RSVP | `calendar` |
| Google Drive | 9 tools — browse, search, read, upload, organize, share, delete | `drive` |
| Google Docs | 4 tools — create, read, append, find-and-replace | `docs` |
| Google Sheets | 5 tools — create, read, write, append, clear | `sheets` |
| Google Slides | 4 tools — create, read, add slides, find-and-replace | `slides` |
| GitHub | 18 tools — repos, issues, PRs, code search, notifications | `github` |
| Gemini AI | 5 tools — image gen, image edit, video gen, video analysis | `gemini` |
| YouTube | 6 tools — search, video details, transcripts, channels, comments | `youtube` |
| Canvas LMS | 10 tools — courses, assignments, grades, announcements, to-do | `canvas` |
| LinkedIn | 16 tools — profiles, feed, connections, messages, notifications, search, jobs, companies | `linkedin` |

---

## Quick Start

### 1. Install omniclaw into OpenClaw

```bash
openclaw plugins install --link /path/to/omniclaw
```

Or if running from the OpenClaw monorepo as a built-in extension, place this repo under `extensions/omniclaw/` — the workspace auto-discovers it.

### 2. Set up credentials (detailed below)

Each service has its own authentication. You only need to configure the ones you plan to use.

---

## Google Workspace Setup (Gmail, Calendar, Drive, Docs, Sheets, Slides, YouTube)

All Google Workspace tools share a single OAuth2 flow. Set it up once to unlock Gmail, Calendar, Drive, Docs, Sheets, Slides, and authenticated YouTube access.

### Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** > **New Project**
3. Name it (e.g. `omniclaw`) and click **Create**

### Step 2: Enable the Required APIs

Go to **APIs & Services > Library** and enable each of these:

- **Gmail API**
- **Google Calendar API**
- **Google Drive API**
- **Google Docs API**
- **Google Sheets API**
- **Google Slides API**
- **YouTube Data API v3**

### Step 3: Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **+ Create Credentials > OAuth client ID**
3. If prompted to configure the consent screen:
   - Choose **External** (or Internal if using Google Workspace)
   - Fill in app name and your email
   - Under **Scopes**, you can skip this (scopes are requested at runtime)
   - Click through to save
4. Back on Credentials, select **Desktop app** as the application type
5. Click **Create** and **Download JSON**
6. Save the file somewhere permanent (e.g. `~/omniclaw-credentials/client_secret.json`)

### Step 4: Add Yourself as a Test User

1. Go to **APIs & Services > OAuth consent screen > Test users**
2. Click **+ Add Users** and enter your Gmail address
3. Click **Save**

> While your app is in "Testing" mode, only listed test users can authenticate. This avoids Google's verification process.

### Step 5: Configure the Plugin

```bash
openclaw config set plugins.entries.omniclaw.config.client_secret_path "/path/to/client_secret.json"
```

### Step 6: Authenticate

Restart the OpenClaw gateway, then ask your agent:

> "Set up Gmail" (or call any `*_auth_setup` tool)

A browser window opens. Sign in with your Google account and grant the requested permissions. Tokens are saved locally at `~/.openclaw/omniclaw-tokens.json` — you only need to do this once.

> **Tip:** Each service has its own auth tool (`gmail_auth_setup`, `calendar_auth_setup`, `drive_auth_setup`, etc.) but they all use the same OAuth flow. Authenticating through any one of them grants access to all Google services.

---

## GitHub Setup

GitHub tools use a Personal Access Token (PAT) — no OAuth flow required.

### Step 1: Create a Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)** or **Fine-grained token**
3. For classic tokens, select scopes:
   - `repo` — full access to repositories
   - `notifications` — read notifications
4. Copy the token

### Step 2: Configure

**Option A:** Set via config:
```bash
openclaw config set plugins.entries.omniclaw.config.github_token "ghp_your_token_here"
```

**Option B:** Let the agent prompt you. Ask your agent:
> "Set up GitHub"

It will call `github_auth_setup` and walk you through entering the token interactively.

---

## Gemini AI Setup

Gemini tools use a Google AI Studio API key for image generation, video generation, and video analysis.

### Step 1: Get an API Key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click **Create API key**
3. Copy the key

### Step 2: Configure

**Option A:** Set via config:
```bash
openclaw config set plugins.entries.omniclaw.config.gemini_api_key "your_api_key_here"
```

**Option B:** Let the agent prompt you. Ask your agent:
> "Set up Gemini"

---

## YouTube Setup

YouTube has two modes:

- **Transcripts** — work immediately with no setup. Just ask for any public video's transcript.
- **Search, video details, comments, channel info** — require Google OAuth (same as Gmail setup above). If you already set up Google Workspace, YouTube authenticated tools are ready to use.

---

## Canvas LMS Setup

Canvas uses browser-based SSO authentication via Playwright — no API tokens or Google credentials needed.

### Step 1: Install Browser

```bash
npx playwright install chromium
```

### Step 2: Authenticate

Ask your agent:
> "Set up Canvas"

It will call `canvas_auth_setup`, which opens a Chromium browser window to your university's Canvas login page. Sign in normally; the tool captures your session automatically.

### Optional: Automatic Duo MFA

If your university uses Duo two-factor authentication, you can automate the MFA step:

1. Get your Duo TOTP secret (during Duo Mobile activation, choose "Use a third-party authenticator" and copy the secret from the `otpauth://` URI)
2. Configure it:
   ```bash
   openclaw config set plugins.entries.omniclaw.config.duo_totp_secret "YOUR_SECRET"
   ```

The tool will auto-generate and fill the 6-digit Duo passcode during authentication. Without this, it falls back to waiting for manual MFA approval.

---

## LinkedIn Setup

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

---

## All Tools Reference

### Gmail (9 tools)

| Tool | Description |
|------|-------------|
| `gmail_auth_setup` | Authenticate with Google (run once) |
| `gmail_accounts` | List all authenticated accounts and their emails |
| `gmail_inbox` | List recent inbox messages |
| `gmail_search` | Search with Gmail query syntax |
| `gmail_get` | Fetch full message body by ID |
| `gmail_send` | Compose and send a new email |
| `gmail_reply` | Reply to a message (keeps thread) |
| `gmail_forward` | Forward a message to another recipient |
| `gmail_modify` | Mark read/unread, archive, or trash a message |

### Google Calendar (7 tools)

| Tool | Description |
|------|-------------|
| `calendar_auth_setup` | Authenticate with Google (run once) |
| `calendar_list_calendars` | List all calendars (primary, shared, subscribed) |
| `calendar_events` | List upcoming events with optional time range filter |
| `calendar_get` | Fetch full event details by ID |
| `calendar_create` | Create a new event with attendees and reminders |
| `calendar_update` | Update an existing event |
| `calendar_delete` | Delete an event and notify attendees |
| `calendar_respond` | RSVP to an event (accept/decline/tentative) |

### Google Drive (9 tools)

| Tool | Description |
|------|-------------|
| `drive_auth_setup` | Authenticate with Google (run once) |
| `drive_list` | List files and folders in a directory |
| `drive_search` | Search files using Drive query syntax |
| `drive_get` | Fetch full metadata for a file by ID |
| `drive_read` | Read text content of a file (Docs, Sheets, text files) |
| `drive_upload` | Create a new file or update an existing one |
| `drive_create_folder` | Create a new folder |
| `drive_move` | Move a file or folder to a different parent |
| `drive_delete` | Trash or permanently delete a file |
| `drive_share` | Share a file with a user (reader/commenter/writer) |

### Google Docs (4 tools)

| Tool | Description |
|------|-------------|
| `docs_auth_setup` | Authenticate with Google (run once) |
| `docs_create` | Create a new Google Doc with optional initial content |
| `docs_get` | Fetch a document's title and full plain-text content |
| `docs_append` | Append text to the end of a document |
| `docs_replace_text` | Find and replace all occurrences of a string |

### Google Sheets (5 tools)

| Tool | Description |
|------|-------------|
| `sheets_auth_setup` | Authenticate with Google (run once) |
| `sheets_create` | Create a new spreadsheet |
| `sheets_get` | Read cell values from a range (A1 notation) |
| `sheets_update` | Write values to a range |
| `sheets_append` | Append rows after the last row with data |
| `sheets_clear` | Clear values from a range |

### Google Slides (4 tools)

| Tool | Description |
|------|-------------|
| `slides_auth_setup` | Authenticate with Google (run once) |
| `slides_create` | Create a new presentation |
| `slides_get` | Fetch all slide text content and speaker notes |
| `slides_append_slide` | Append a new slide with title and body text |
| `slides_replace_text` | Find and replace text across all slides |

### YouTube (6 tools)

| Tool | Description |
|------|-------------|
| `youtube_auth_setup` | Authenticate with Google for search/details (run once) |
| `youtube_get_transcript` | Get transcript of any public YouTube video (no auth needed) |
| `youtube_search` | Search YouTube videos by query |
| `youtube_video_details` | Get metadata, stats, and description for a video |
| `youtube_channel_info` | Get channel details by handle or ID |
| `youtube_video_comments` | Get top comments on a video |

### GitHub (18 tools)

| Tool | Description |
|------|-------------|
| `github_auth_setup` | Store your GitHub Personal Access Token |
| `github_issues` | List issues for a repository |
| `github_get_issue` | Get full details of a single issue |
| `github_create_issue` | Create a new issue |
| `github_update_issue` | Update an issue (title, body, state, labels, assignees) |
| `github_add_issue_comment` | Add a comment to an issue |
| `github_pulls` | List pull requests for a repository |
| `github_get_pull` | Get full details of a pull request |
| `github_create_pull` | Create a new pull request |
| `github_merge_pull` | Merge a pull request |
| `github_add_pull_review` | Add a review to a pull request |
| `github_repos` | List repositories for a user or organization |
| `github_get_repo` | Get full details of a repository |
| `github_search_code` | Search code across GitHub |
| `github_get_file` | Get contents of a file from a repository |
| `github_branches` | List branches for a repository |
| `github_notifications` | List your GitHub notifications |
| `github_mark_notification_read` | Mark a notification as read |

### Gemini AI (5 tools)

| Tool | Description |
|------|-------------|
| `gemini_auth_setup` | Store your Gemini API key |
| `gemini_generate_image` | Generate an image from a text prompt |
| `gemini_edit_image` | Edit an existing image with a text prompt |
| `gemini_generate_video` | Generate a short video from a text prompt |
| `gemini_analyze_video` | Analyze/describe a video from a URL |

### Canvas LMS (10 tools)

| Tool | Description |
|------|-------------|
| `canvas_auth_setup` | Authenticate via browser SSO |
| `canvas_profile` | Get your Canvas user profile |
| `canvas_courses` | List enrolled courses |
| `canvas_get_course` | Get details for a specific course |
| `canvas_assignments` | List assignments for a course |
| `canvas_get_assignment` | Get details for a specific assignment |
| `canvas_announcements` | List announcements across courses |
| `canvas_grades` | Get grade information for a course |
| `canvas_submissions` | List submissions for an assignment |
| `canvas_todo` | Get your Canvas to-do list |

### LinkedIn (16 tools)

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

---

## Configuration Reference

All configuration is set via `openclaw config set plugins.entries.omniclaw.config.<key> <value>`.

### Google Workspace

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `client_secret_path` | Yes | — | Absolute path to your `client_secret.json` from Google Cloud Console |
| `oauth_port` | No | `9753` | Local port for the OAuth callback server |
| `tokens_path` | No | `~/.openclaw/omniclaw-tokens.json` | Where OAuth tokens are stored |

### GitHub

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `github_token` | No | — | GitHub Personal Access Token. Can also be set interactively via `github_auth_setup` |

### Gemini AI

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `gemini_api_key` | No | — | Google AI Studio API key. Can also be set interactively via `gemini_auth_setup` |

### Canvas LMS

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `canvas_tokens_path` | No | `~/.openclaw/omniclaw-canvas-tokens.json` | Where Canvas session tokens are stored |
| `canvas_auto_mfa` | No | `true` | Auto-fill Duo MFA using TOTP secret |
| `duo_totp_secret` | No | — | Duo TOTP secret (hex or base32) for automatic MFA |

### LinkedIn

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `linkedin_tokens_path` | No | `~/.openclaw/omniclaw-linkedin-tokens.json` | Where LinkedIn session tokens are stored |
| `linkedin_username` | No | — | LinkedIn email for automatic login |
| `linkedin_password` | No | — | LinkedIn password for automatic login |

---

## Usage Examples

Once authenticated, just talk to your agent naturally:

**Email**
> "Show me my recent emails"
> "Find emails from Alice about the project proposal"
> "Reply saying I'll review it by Friday"
> "Forward that to bob@example.com"

**Calendar**
> "What's on my calendar tomorrow?"
> "Schedule a 30-minute meeting with alice@example.com next Tuesday at 2pm"
> "Accept the invite to the design review"

**Drive & Docs**
> "What files are in my Drive?"
> "Create a Google Doc called 'Meeting Notes' and add today's agenda"
> "Read the project spec and summarize it"
> "Share the doc with the team as editors"

**Sheets**
> "Create a spreadsheet called 'Budget Tracker'"
> "Add a header row: Date, Category, Amount, Notes"
> "Read the data in columns A through D"

**Slides**
> "Create a presentation called 'Q4 Review'"
> "Add a slide titled 'Key Metrics' with our revenue numbers"
> "Replace all '{{company}}' placeholders with 'Acme Corp'"

**GitHub**
> "Show me open issues in myorg/myrepo"
> "Create an issue titled 'Fix login bug' with a description"
> "List open PRs that need review"
> "Merge PR #42"

**Gemini AI**
> "Generate an image of a sunset over mountains in watercolor style"
> "Create a 5-second video of ocean waves"
> "Analyze this video and describe what's happening"

**YouTube**
> "Get the transcript of this YouTube video: https://youtube.com/watch?v=..."
> "Search YouTube for TypeScript tutorials"
> "Show me the top comments on that video"

**Canvas**
> "What courses am I enrolled in?"
> "What assignments are due this week in CS 101?"
> "What's my current grade in Linear Algebra?"
> "Any new announcements from my professors?"

**LinkedIn**
> "Show me my LinkedIn profile"
> "Look up John Doe's LinkedIn profile"
> "What's on my LinkedIn feed?"
> "List my recent LinkedIn connections"
> "Show me my LinkedIn messages"
> "Search LinkedIn for software engineers at Google"
> "Search for remote product manager jobs"

---

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # TypeScript compilation
pnpm test             # Run unit tests
pnpm test:integration # Run integration tests (requires real credentials)
```

## Architecture

- **Auth managers** (`src/auth/`) — handle OAuth2, token storage, and per-service authentication
- **Tool factories** (`src/tools/`) — each tool is a factory function returning `{ name, label, description, parameters, execute }`
- **Plugin registration** (`src/plugin.ts`) — the `register(api)` function wires everything together
- **Skills** (`skills/`) — SKILL.md files that teach the agent how to combine tools for each service
- **Multi-account** — every tool accepts an optional `account` parameter (defaults to `"default"`)

## License

MIT
