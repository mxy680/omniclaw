# Google Workspace Integration

All Google Workspace tools share a single OAuth2 flow. Set it up once to unlock Gmail, Calendar, Drive, Docs, Sheets, Slides, and authenticated YouTube access.

## Setup

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

## Tools

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

## Configuration

All configuration is set via `openclaw config set plugins.entries.omniclaw.config.<key> <value>`.

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `client_secret_path` | Yes | — | Absolute path to your `client_secret.json` from Google Cloud Console |
| `oauth_port` | No | `9753` | Local port for the OAuth callback server |
| `tokens_path` | No | `~/.openclaw/omniclaw-tokens.json` | Where OAuth tokens are stored |

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
