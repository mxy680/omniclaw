---
name: devpost
description: Browse hackathons, search projects, manage profile and submissions on Devpost.
metadata: {"openclaw": {"emoji": "🏆"}}
---

# Devpost

Browse hackathons, search software projects, manage your profile, and submit to hackathons on Devpost.

## First-Time Setup

omniclaw uses browser session authentication to access your Devpost account.

1. Optionally pre-configure credentials:
   - `openclaw config set plugins.entries.omniclaw.config.devpost_email "you@example.com"`
   - `openclaw config set plugins.entries.omniclaw.config.devpost_password "your_password"`
2. Call `devpost_auth_setup` — a browser window opens, log into Devpost, done.

Note: Browsing hackathons and searching projects does NOT require authentication.

## Available Tools

### No Auth Required
- `devpost_search_hackathons` — Search/filter hackathons (status, themes, location)
- `devpost_get_hackathon` — Get full hackathon details (prizes, rules, timeline)
- `devpost_hackathon_projects` — Browse submitted projects for a hackathon
- `devpost_search_projects` — Search software projects by keyword
- `devpost_get_project` — Get full project details (description, tech stack, team)

### Auth Required
- `devpost_auth_setup` — Authenticate with Devpost (opens browser for login)
- `devpost_get_profile` — Get your profile or any user's profile
- `devpost_my_hackathons` — List hackathons you've participated in
- `devpost_my_projects` — List your submitted projects
- `devpost_register_hackathon` — Register for a hackathon
- `devpost_create_submission` — Create a new project submission
- `devpost_update_submission` — Update an existing submission

## Workflow

### Browsing (no auth)
1. Use `devpost_search_hackathons` with `status: "open"` to find active hackathons.
2. Use `devpost_get_hackathon` to see prizes, rules, and deadlines.
3. Use `devpost_hackathon_projects` to browse past submissions for inspiration.
4. Use `devpost_search_projects` to find projects by technology or topic.
5. Use `devpost_get_project` to see full project details.

### Submitting (auth required)
1. Call `devpost_auth_setup` to authenticate.
2. Use `devpost_register_hackathon` to register for a hackathon.
3. Use `devpost_create_submission` to start your project submission.
4. Use `devpost_update_submission` to add description, tech stack, demo link, and video.

## Error Handling

If any tool returns `"error": "auth_required"`, call `devpost_auth_setup` first.
If you get a session expired error, re-run `devpost_auth_setup`.
