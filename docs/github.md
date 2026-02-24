# GitHub Integration

18 tools for managing repositories, issues, pull requests, code search, and notifications through your AI agent.

## Setup

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

## Tools

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

## Configuration

All configuration is set via `openclaw config set plugins.entries.omniclaw.config.<key> <value>`.

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `github_token` | No | — | GitHub Personal Access Token. Can also be set interactively via `github_auth_setup` |

## Usage Examples

> "Show me open issues in myorg/myrepo"
> "Create an issue titled 'Fix login bug' with a description"
> "List open PRs that need review"
> "Merge PR #42"
