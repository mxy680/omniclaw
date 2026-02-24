# Canvas LMS Integration

10 tools for managing university coursework — courses, assignments, grades, announcements, and to-do lists.

## Setup

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

## Tools

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

## Configuration

All configuration is set via `openclaw config set plugins.entries.omniclaw.config.<key> <value>`.

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `canvas_tokens_path` | No | `~/.openclaw/omniclaw-canvas-tokens.json` | Where Canvas session tokens are stored |
| `canvas_auto_mfa` | No | `true` | Auto-fill Duo MFA using TOTP secret |
| `duo_totp_secret` | No | — | Duo TOTP secret (hex or base32) for automatic MFA |

## Usage Examples

> "What courses am I enrolled in?"
> "What assignments are due this week in CS 101?"
> "What's my current grade in Linear Algebra?"
> "Any new announcements from my professors?"
