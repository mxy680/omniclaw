---
name: linkedin
description: LinkedIn access — profiles, feed, connections, messages, notifications, and search.
metadata: {"openclaw": {"emoji": "💼"}}
---

# LinkedIn

View LinkedIn profiles, read your feed, manage connections, access messages, read notifications, and search for people, companies, and jobs.

## First-Time Setup

LinkedIn uses browser-based authentication via Playwright — no API token needed.

1. Make sure Playwright browsers are installed: `npx playwright install chromium`
2. Save your LinkedIn credentials once (so you never have to type them again):

```bash
openclaw config set plugins.entries.omniclaw.config.linkedin_username "your_email@example.com"
openclaw config set plugins.entries.omniclaw.config.linkedin_password "your_password"
```

3. Call `linkedin_auth_setup` with no arguments:

```
linkedin_auth_setup
```

4. A browser will open to linkedin.com/login. If credentials are configured, they will be auto-filled. Complete any MFA/captcha challenges manually — the tool waits up to 5 minutes.
5. Once login succeeds, session cookies are saved automatically.

> You can also pass `username` and `password` directly to `linkedin_auth_setup` to override the saved config.

## Available Tools

- `linkedin_auth_setup` — Authenticate via browser login (run once per session)
- `linkedin_profile` — Get your own LinkedIn profile
- `linkedin_get_profile` — Get any user's full profile by public ID
- `linkedin_feed` — Get posts from your LinkedIn feed
- `linkedin_connections` — List your connections
- `linkedin_conversations` — List your message conversations
- `linkedin_messages` — Get messages from a specific conversation
- `linkedin_notifications` — List your notifications
- `linkedin_search` — Search for people or companies
- `linkedin_search_jobs` — Search for job listings
- `linkedin_pending_invitations` — View incoming connection requests
- `linkedin_company` — Get detailed company/organization info
- `linkedin_job_details` — Get full details of a job posting
- `linkedin_post_comments` — Read comments on a feed post
- `linkedin_profile_views` — See who viewed your profile
- `linkedin_saved_jobs` — List your saved/bookmarked jobs

## Workflow

1. Call `linkedin_auth_setup` with no arguments — the tool reads credentials from the plugin config automatically. Do NOT ask the user for their email, username, or password.
2. Use `linkedin_profile` to see your own profile info.
3. Use `linkedin_get_profile` with a public identifier to view someone else's profile.
4. Use `linkedin_feed` to see recent posts from your network.
5. Use `linkedin_connections` to browse your connections.
6. Use `linkedin_conversations` to see message threads, then `linkedin_messages` with a conversation URN to read messages.
7. Use `linkedin_notifications` to check recent notifications.
8. Use `linkedin_search` to find people or companies, and `linkedin_search_jobs` to find job listings.
9. Use `linkedin_pending_invitations` to see who wants to connect with you.
10. Use `linkedin_company` to look up detailed info about a company.
11. Use `linkedin_job_details` with a job ID to get full job posting details.
12. Use `linkedin_post_comments` with an activity URN from the feed to read comments on a post.
13. Use `linkedin_profile_views` to see who has viewed your profile.
14. Use `linkedin_saved_jobs` to review your bookmarked job listings.

## Error Handling

If any tool returns `"error": "auth_required"`, call `linkedin_auth_setup` first.

If a session expires, call `linkedin_auth_setup` again to re-authenticate.
