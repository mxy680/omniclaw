---
name: github
description: GitHub integration — manage issues, pull requests, repos, code, and notifications.
metadata: {"openclaw": {"emoji": "🐙"}}
---

# GitHub

Manage GitHub issues, pull requests, repositories, code, and notifications using natural language.

## First-Time Setup

GitHub uses a Personal Access Token (PAT) — no OAuth flow needed.

1. Create a token at https://github.com/settings/tokens (classic or fine-grained).
   - For full access, select scopes: `repo`, `notifications`, `read:user`.
2. Save your token in the plugin config:

```bash
openclaw config set plugins.entries.omniclaw.config.github_token "ghp_your_token_here"
```

3. Call `github_auth_setup` with no arguments to validate:

```
github_auth_setup
```

The tool reads the token from config, verifies it against the GitHub API, and stores it for subsequent tool calls.

## Available Tools

### Auth
- `github_auth_setup` — Validate and store a GitHub PAT (run once)

### Issues
- `github_issues` — List issues for a repo
- `github_get_issue` — Get issue details + comments
- `github_create_issue` — Create an issue
- `github_update_issue` — Update an issue (title, body, state, labels, assignees)
- `github_add_issue_comment` — Comment on an issue

### Pull Requests
- `github_pulls` — List pull requests for a repo
- `github_get_pull` — Get PR details + reviews
- `github_create_pull` — Create a pull request
- `github_merge_pull` — Merge a pull request
- `github_add_pull_review` — Create a review (approve/comment/request changes)

### Repositories
- `github_repos` — List your repositories
- `github_get_repo` — Get repo details
- `github_search_code` — Search code across repos
- `github_get_file` — Read a file's contents (auto-decodes base64)
- `github_branches` — List branches for a repo

### Notifications
- `github_notifications` — List your notifications
- `github_mark_notification_read` — Mark a notification as read

## Workflow

1. Call `github_auth_setup` with no arguments — the tool reads the token from config automatically.
2. Use `github_repos` to see your repositories.
3. Use `github_issues` or `github_pulls` with an `owner` and `repo` to list items.
4. Use `github_get_issue` or `github_get_pull` for full details.
5. Use `github_create_issue` or `github_create_pull` to create new items.
6. Use `github_notifications` to check what needs your attention.

## Error Handling

If any tool returns `"error": "auth_required"`, call `github_auth_setup` first.

If a token is invalid or expired, generate a new one at https://github.com/settings/tokens and call `github_auth_setup` again.
