---
name: github
description: Full GitHub access — repos, issues, PRs, actions, branches, search, gists, notifications, projects, webhooks, and security alerts using a Personal Access Token.
metadata: {"openclaw": {"emoji": "🐙"}}
---

# GitHub

Manage repositories, issues, pull requests, actions, branches, gists, notifications, and more on GitHub.

## First-Time Setup

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Generate a **Personal Access Token** (classic or fine-grained)
   - Classic: select scopes like `repo`, `workflow`, `read:org`, `gist`, `notifications`, `admin:repo_hook`
   - Fine-grained: select the repositories and permissions you need
3. Configure the plugin: `openclaw plugins config omniclaw`
   - Set `github_token` to the token you generated
4. Call `github_auth_setup` with your token to verify it works

## Available Tools

### Auth
- `github_auth_setup` — Validate a GitHub PAT and return authenticated user info

### Repositories (14)
- `github_repo_list` — List repos for the authenticated user
- `github_repo_get` — Get repo details
- `github_repo_create` — Create a new repo
- `github_repo_update` — Update repo settings
- `github_repo_delete` — Delete a repo
- `github_repo_fork` — Fork a repo
- `github_repo_star` / `github_repo_unstar` — Star/unstar a repo
- `github_repo_content_get` — Get file/directory contents
- `github_repo_content_create` — Create or update a file
- `github_repo_content_delete` — Delete a file
- `github_repo_topics` — Get repo topics
- `github_repo_contributors` — List contributors
- `github_repo_languages` — Get language breakdown

### Issues (12)
- `github_issue_list` — List issues
- `github_issue_get` — Get issue details
- `github_issue_create` — Create an issue
- `github_issue_update` — Update an issue
- `github_issue_comment_list` / `github_issue_comment_create` / `github_issue_comment_update` / `github_issue_comment_delete` — Manage comments
- `github_issue_label_list` / `github_issue_label_create` — Manage labels
- `github_issue_milestone_list` / `github_issue_milestone_create` — Manage milestones

### Pull Requests (12)
- `github_pull_list` — List PRs
- `github_pull_get` — Get PR details
- `github_pull_create` — Create a PR
- `github_pull_update` — Update a PR
- `github_pull_merge` — Merge a PR
- `github_pull_files` — List changed files
- `github_pull_diff` — Get the diff
- `github_pull_review_list` / `github_pull_review_create` — Manage reviews
- `github_pull_review_comments` — List review comments
- `github_pull_request_reviewers` — Request reviewers
- `github_pull_checks` — List check runs

### Branches, Tags & Releases (10)
- `github_branch_list` / `github_branch_get` / `github_branch_create` / `github_branch_delete` — Branch management
- `github_branch_protection_get` — Get branch protection rules
- `github_tag_list` — List tags
- `github_release_list` / `github_release_get` / `github_release_create` / `github_release_delete` — Release management

### Git (5)
- `github_commit_list` / `github_commit_get` — Browse commits
- `github_compare` — Compare branches/commits
- `github_ref_list` — List git refs
- `github_tree_get` — Get a git tree

### Actions (9)
- `github_workflow_list` / `github_workflow_get` / `github_workflow_dispatch` — Manage workflows
- `github_run_list` / `github_run_get` / `github_run_cancel` / `github_run_rerun` — Manage runs
- `github_job_list` — List jobs for a run
- `github_run_logs` — Get run log download URL

### Search (5)
- `github_search_repos` / `github_search_code` / `github_search_issues` / `github_search_commits` / `github_search_users`

### Users & Organizations (6)
- `github_user_get` / `github_user_repos` — User info and repos
- `github_org_get` / `github_org_members` / `github_org_repos` — Org info and members
- `github_team_list` — List teams

### Gists (5)
- `github_gist_list` / `github_gist_get` / `github_gist_create` / `github_gist_update` / `github_gist_delete`

### Notifications (4)
- `github_notification_list` — List notifications
- `github_notification_mark_read` — Mark all as read
- `github_notification_thread_read` — Mark specific thread as read
- `github_notification_thread_subscribe` — Subscribe/unsubscribe from thread

### Projects (4)
- `github_project_list` / `github_project_get` — View projects
- `github_project_columns` / `github_project_cards` — View columns and cards

### Webhooks (4)
- `github_webhook_list` / `github_webhook_create` / `github_webhook_update` / `github_webhook_delete`

### Security (4)
- `github_dependabot_alerts` — Dependabot vulnerability alerts
- `github_code_scanning_alerts` — Code scanning alerts
- `github_secret_scanning_alerts` — Secret scanning alerts
- `github_security_advisories` — Repository security advisories

## Workflow

1. Complete first-time setup above.
2. Call `github_auth_setup` with your PAT to authenticate.
3. Use `github_repo_list` to see your repositories.
4. Use issue, PR, and branch tools to manage your projects.
5. Use `github_search_*` to find repos, code, issues across GitHub.
6. Use Actions tools to monitor CI/CD workflows.

## Error Handling

If any tool returns `"error": "auth_required"`, call `github_auth_setup` first with a valid token.
