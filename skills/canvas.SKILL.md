---
name: canvas
description: Read-only Canvas LMS access — courses, assignments, grades, announcements, and to-do items.
metadata: {"openclaw": {"emoji": "🎓"}}
---

# Canvas LMS

Read your Canvas LMS courses, assignments, grades, announcements, and to-do list.

## First-Time Setup

Canvas uses browser-based SSO authentication — no API token needed.

1. Make sure Playwright browsers are installed: `npx playwright install chromium`
2. Save your Canvas credentials once (so you never have to type them again):

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

4. Call `canvas_auth_setup` with no arguments:

```
canvas_auth_setup
```

5. A browser will open. If a TOTP secret is configured, the tool will automatically generate and fill in the Duo passcode. Otherwise, complete Duo/MFA manually — the tool waits up to 5 minutes.
6. Once login succeeds, session cookies are saved automatically.

> You can also pass `base_url`, `username`, and `password` directly to `canvas_auth_setup` to override the saved config.

## Available Tools

- `canvas_auth_setup` — Authenticate via browser SSO (run once per session)
- `canvas_profile` — Get your Canvas user profile
- `canvas_courses` — List your enrolled courses
- `canvas_get_course` — Get details for a specific course
- `canvas_assignments` — List assignments for a course
- `canvas_get_assignment` — Get details for a specific assignment
- `canvas_announcements` — List announcements across courses
- `canvas_grades` — Get grade information for a course
- `canvas_submissions` — List submissions for an assignment
- `canvas_todo` — Get your Canvas to-do list

## Workflow

1. Call `canvas_auth_setup` with no arguments — the tool reads credentials from the plugin config automatically. Do NOT ask the user for their URL, username, or password.
2. Use `canvas_courses` to see your active courses.
3. Use `canvas_assignments` with a course ID to see upcoming work.
4. Use `canvas_grades` to check your grade in a course.
5. Use `canvas_announcements` to see recent course announcements.
6. Use `canvas_todo` for a quick view of what needs your attention.

## Error Handling

If any tool returns `"error": "auth_required"`, call `canvas_auth_setup` first.

If a session expires, call `canvas_auth_setup` again to re-authenticate.
