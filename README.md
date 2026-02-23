# omniclaw

Gmail, Google Calendar, Drive, Docs, Slides, Sheets, and Canvas LMS integration for OpenClaw. Manage emails, calendar, files, documents, and coursework using natural language.

## Prerequisites

- [OpenClaw](https://openclaw.ai) installed
- A Google account with Gmail

## Setup

### 1. Install the plugin

```bash
openclaw plugins install --link /path/to/omniclaw
```

### 2. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. `omniclaw`)
3. Go to **APIs & Services → Library** and enable the following APIs:
   - **Gmail API**
   - **Google Calendar API**
   - **Google Drive API**
   - **Google Docs API**
   - **Google Slides API**
   - **Google Sheets API**

### 3. Create OAuth credentials

1. Go to **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
2. If prompted to configure the consent screen first:
   - Choose **External**
   - Fill in app name and your email, click through the rest
3. Application type: **Desktop app**, name it anything
4. Download the `client_secret.json`

### 4. Add yourself as a test user

1. Go to **APIs & Services → OAuth consent screen → Test users**
2. Click **+ Add Users** and add your Gmail address
3. Save

> This step ensures you get a clean sign-in flow with no warnings.

### 5. Configure the plugin

```bash
openclaw config set plugins.entries.omniclaw.config.client_secret_path "/path/to/client_secret.json"
```

### 6. Authenticate

Restart the OpenClaw gateway, then ask your agent:

> "Set up Gmail" or call `gmail_auth_setup` directly

A browser window will open. Sign in with your Google account and grant access. You only need to do this once.

## Usage

Once authenticated, your agent can:

**Gmail**
- **List inbox** — "Show me my recent emails"
- **Search** — "Find emails from Alice with attachments"
- **Read** — "Show me the full body of that email"
- **Send** — "Send an email to bob@example.com about the meeting"
- **Reply** — "Reply to that email saying I'll be there"
- **Forward** — "Forward this to alice@example.com"
- **Manage** — "Mark that as read" / "Archive it" / "Move it to trash"

**Google Calendar**
- **List events** — "What's on my calendar this week?"
- **Create** — "Schedule a meeting with alice@example.com tomorrow at 2pm"
- **Update** — "Move the 3pm meeting to 4pm"
- **RSVP** — "Accept the invite to the product review"
- **Delete** — "Cancel tomorrow's standup"

**Google Slides**
- **Create** — "Create a presentation called 'Q4 Review'"
- **Read** — "What's on each slide of my pitch deck?"
- **Edit** — "Add a slide titled 'Next Steps' with action items"
- **Template** — "Replace all '{{company}}' placeholders with 'Acme Corp'"

**Google Sheets**
- **Create** — "Create a spreadsheet called 'Budget 2026'"
- **Read** — "Read the data in Sheet1 columns A through D"
- **Write** — "Write a header row: Name, Email, Score"
- **Append** — "Add Alice's row to the sheet"
- **Clear** — "Clear the data range A1:D10"

**Google Docs**
- **Create** — "Create a doc called 'Meeting Notes' with today's agenda"
- **Read** — "Read the project spec doc"
- **Append** — "Add a summary section to the end of the doc"
- **Edit** — "Replace all occurrences of '{{name}}' with 'Alice'"

**Google Drive**
- **Browse** — "What files are in my Drive?"
- **Search** — "Find all PDFs named 'report'"
- **Read** — "Read the Q4 planning doc"
- **Upload** — "Create a file called notes.txt with this content"
- **Organize** — "Create a folder called Archive and move the old drafts there"
- **Share** — "Share the doc with alice@example.com as editor"
- **Delete** — "Trash the old draft"

**Canvas LMS** (no Google account or API token needed — uses browser SSO)
- **Courses** — "What courses am I enrolled in?"
- **Assignments** — "What assignments are due this week in CS 101?"
- **Grades** — "What's my current grade in Linear Algebra?"
- **Announcements** — "Any new announcements from my professors?"
- **To-do** — "What does Canvas say I need to do?"

## Tools

### Gmail

| Tool | Description |
|------|-------------|
| `gmail_auth_setup` | Authenticate with Gmail and Calendar (run once) |
| `gmail_accounts` | List all authenticated accounts and their emails |
| `gmail_inbox` | List recent inbox messages |
| `gmail_search` | Search with Gmail query syntax |
| `gmail_get` | Fetch full body of a message by ID |
| `gmail_send` | Send a new email |
| `gmail_reply` | Reply to a message (keeps thread) |
| `gmail_forward` | Forward a message to another recipient |
| `gmail_modify` | Mark read/unread, archive, or trash a message |

### Google Calendar

| Tool | Description |
|------|-------------|
| `calendar_list_calendars` | List all calendars (primary, shared, subscribed) |
| `calendar_events` | List upcoming events with optional time range filter |
| `calendar_get` | Fetch full details of an event by ID |
| `calendar_create` | Create a new event with attendees |
| `calendar_update` | Update an existing event |
| `calendar_delete` | Delete/cancel an event and notify attendees |
| `calendar_respond` | RSVP to an event (accept/decline/tentative) |

### Google Slides

| Tool | Description |
|------|-------------|
| `slides_auth_setup` | Authenticate with Slides (run once) |
| `slides_create` | Create a new presentation |
| `slides_get` | Fetch all slide text content and speaker notes |
| `slides_append_slide` | Append a new slide with title and body text |
| `slides_replace_text` | Find and replace text across all slides |

### Google Sheets

| Tool | Description |
|------|-------------|
| `sheets_auth_setup` | Authenticate with Sheets (run once) |
| `sheets_create` | Create a new spreadsheet |
| `sheets_get` | Read cell values from a range (A1 notation) |
| `sheets_update` | Write values to a range |
| `sheets_append` | Append rows after the last row with data |
| `sheets_clear` | Clear values from a range |

### Google Docs

| Tool | Description |
|------|-------------|
| `docs_auth_setup` | Authenticate with Docs, Drive, Calendar, and Gmail (run once) |
| `docs_create` | Create a new Google Doc with a title and optional content |
| `docs_get` | Fetch a document's title and full plain-text content |
| `docs_append` | Append text to the end of a document |
| `docs_replace_text` | Find and replace all occurrences of a string in a document |

### Google Drive

| Tool | Description |
|------|-------------|
| `drive_auth_setup` | Authenticate with Drive, Calendar, and Gmail (run once) |
| `drive_list` | List files and folders in a directory |
| `drive_search` | Search files using Drive query syntax |
| `drive_get` | Fetch full metadata for a file by ID |
| `drive_read` | Read text content of a file (Docs, Sheets, Slides, plain text) |
| `drive_upload` | Create a new file or update an existing one |
| `drive_create_folder` | Create a new folder |
| `drive_move` | Move a file or folder to a different parent |
| `drive_delete` | Trash or permanently delete a file |
| `drive_share` | Share a file with another user (reader/commenter/writer) |

### Canvas LMS

No Google credentials or API tokens required. Canvas uses browser-based SSO authentication.

**Setup:**
1. Install Playwright browsers: `npx playwright install chromium`
2. Save your Canvas credentials once:
   ```bash
   openclaw config set plugins.entries.omniclaw.config.canvas_base_url "https://canvas.example.edu"
   openclaw config set plugins.entries.omniclaw.config.canvas_username "your_username"
   openclaw config set plugins.entries.omniclaw.config.canvas_password "your_password"
   ```
3. (Optional) Save your Duo TOTP secret to enable automatic Duo MFA:
   ```bash
   openclaw config set plugins.entries.omniclaw.config.duo_totp_secret "YOUR_SECRET"
   ```
   To get the secret: run `scripts/extract-duo-secret.ts` with a Duo activation URL, or when activating Duo Mobile choose "Use a third-party authenticator" and copy the secret from the `otpauth://` URI. The secret can be hex (from Duo's activation API) or base32 — both formats work.
4. Call `canvas_auth_setup` with no arguments — a browser opens, the tool auto-generates and fills the Duo TOTP passcode if configured, and session cookies are captured automatically. Falls back to manual MFA if no TOTP secret is set.

| Tool | Description |
|------|-------------|
| `canvas_auth_setup` | Authenticate via browser SSO (run once per session) |
| `canvas_profile` | Get your Canvas user profile |
| `canvas_courses` | List enrolled courses |
| `canvas_get_course` | Get details for a specific course |
| `canvas_assignments` | List assignments for a course |
| `canvas_get_assignment` | Get details for a specific assignment |
| `canvas_announcements` | List announcements across courses |
| `canvas_grades` | Get grade information for a course |
| `canvas_submissions` | List submissions for an assignment |
| `canvas_todo` | Get your Canvas to-do list |

## Configuration

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `client_secret_path` | Yes (Google) | — | Path to your `client_secret.json` |
| `oauth_port` | No | `9753` | Local port for the OAuth callback |
| `tokens_path` | No | `~/.openclaw/omniclaw-tokens.json` | Where Google tokens are stored |
| `canvas_tokens_path` | No | `~/.openclaw/omniclaw-canvas-tokens.json` | Where Canvas tokens are stored |
| `canvas_base_url` | No | — | Your Canvas instance URL (e.g. `https://canvas.example.edu`) |
| `canvas_username` | No | — | Your university/SSO username for Canvas |
| `canvas_password` | No | — | Your university/SSO password for Canvas |
| `canvas_auto_mfa` | No | `true` | Auto-fill Duo MFA using TOTP (requires `duo_totp_secret`) |
| `duo_totp_secret` | No | — | Duo TOTP secret (hex from activation API or base32) |

> **Existing users:** The OAuth scope now includes Google Docs. Re-run any `*_auth_setup` tool once to grant the additional permission.
