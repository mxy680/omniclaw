# Devpost Integration Design

**Date**: 2026-02-28
**Status**: Approved

## Overview

Full read+write Devpost integration using a hybrid approach: public JSON APIs for browsing (no auth needed) and Playwright browser auth for authenticated operations.

## Architecture

### Auth

Playwright browser auth — opens Devpost login page, user logs in (email/password or OAuth), session cookies captured and stored in `~/.openclaw/omniclaw-devpost-tokens.json`.

### Data Access — Hybrid

- **No-auth JSON APIs**: `/api/hackathons` for hackathon search, `/software/search` for project search. Structured JSON responses.
- **Authenticated HTTP + page scraping**: Profile data, submissions, registrations, write operations. Uses session cookies from Playwright login.

### Client Manager

`DevpostClientManager` — stores session cookies keyed by account name (default: "default"). Provides:
- `get(account, url)` / `post(account, url, body)` for authenticated requests
- Static methods for no-auth API calls (hackathon search, software search)

## Tools (~12)

### Auth (1)

| Tool | Description | Auth |
|------|-------------|------|
| `devpost_auth_setup` | Playwright login (email/password or OAuth), captures session cookies | None |

### Hackathons — No Auth (3)

| Tool | Description | Auth |
|------|-------------|------|
| `devpost_search_hackathons` | Search/filter hackathons by status, themes, location. Uses `/api/hackathons` JSON API | None |
| `devpost_get_hackathon` | Get full hackathon details: prizes, rules, judges, timeline, eligibility | None |
| `devpost_hackathon_projects` | Browse submitted projects for a specific hackathon | None |

### Projects/Software — No Auth (2)

| Tool | Description | Auth |
|------|-------------|------|
| `devpost_search_projects` | Search software projects by query, sort. Uses `/software/search` | None |
| `devpost_get_project` | Get full project details: description, tech stack, team, demo link, media | None |

### Profile — Auth Required (3)

| Tool | Description | Auth |
|------|-------------|------|
| `devpost_get_profile` | Get your profile or any user's public profile (name, bio, skills, stats) | Required |
| `devpost_my_hackathons` | List hackathons you've registered for or participated in | Required |
| `devpost_my_projects` | List your submitted projects with status | Required |

### Write Operations — Auth Required (3)

| Tool | Description | Auth |
|------|-------------|------|
| `devpost_register_hackathon` | Register for a hackathon | Required |
| `devpost_create_submission` | Create/start a project submission for a hackathon | Required |
| `devpost_update_submission` | Update an existing submission (title, description, tech, links) | Required |

## Error Handling

- **No-auth tools**: Return `{ error: "..." }` with details on API failure
- **Auth-required tools**: Return `{ error: "auth_required", message: "Run devpost_auth_setup first" }` if no session
- **Expired sessions**: 401/403 responses trigger `auth_required` error
- **Scraping failures**: Descriptive error if page structure changed

## Config Options

```typescript
devpost_tokens_path?: string;   // Default: ~/.openclaw/omniclaw-devpost-tokens.json
devpost_email?: string;         // Auto-fill during login
devpost_password?: string;      // Auto-fill during login
```

## Files

| File | Purpose |
|------|---------|
| `src/auth/devpost-client-manager.ts` | Session storage + HTTP requests |
| `src/tools/devpost-auth-tool.ts` | Playwright login flow |
| `src/tools/devpost-hackathons.ts` | Search/get hackathons (no auth) |
| `src/tools/devpost-projects.ts` | Search/get projects (no auth) |
| `src/tools/devpost-profile.ts` | Profile + my hackathons/projects |
| `src/tools/devpost-submissions.ts` | Register, create, update submissions |
| `src/tools/devpost-utils.ts` | Shared helpers (jsonResult, AUTH_REQUIRED) |
| `skills/devpost.SKILL.md` | User-facing skill documentation |
| `tests/integration/devpost.test.ts` | Integration tests |

## Key Devpost URLs/APIs

- Hackathon search API: `https://devpost.com/api/hackathons`
- Software search: `https://devpost.com/software/search`
- Login: `https://secure.devpost.com/users/login`
- User profile: `https://devpost.com/{username}`
- Hackathon page: `https://{slug}.devpost.com/`
- Project page: `https://devpost.com/software/{slug}`
