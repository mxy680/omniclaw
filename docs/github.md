# GitHub Integration

omniclaw provides comprehensive GitHub access through ~95 tools covering repositories, issues, pull requests, actions, branches, search, gists, notifications, projects, webhooks, and security alerts.

## Authentication

GitHub uses Personal Access Tokens (PATs) — not OAuth. Configure once:

1. Generate a PAT at [github.com/settings/tokens](https://github.com/settings/tokens)
2. Set `github_token` in plugin config: `openclaw plugins config omniclaw`
3. Call `github_auth_setup` with your token to verify

### Required Token Scopes (Classic PAT)

| Scope | Used by |
|-------|---------|
| `repo` | All repository, issue, PR, branch, content, and security tools |
| `workflow` | Actions tools (workflow dispatch, run management) |
| `read:org` | Organization and team tools |
| `gist` | Gist tools |
| `notifications` | Notification tools |
| `admin:repo_hook` | Webhook tools |

Fine-grained PATs: select the repositories and permissions matching the tools you want to use.

## Tool Reference

### Auth (1 tool)

| Tool | Description |
|------|-------------|
| `github_auth_setup` | Validate PAT and return authenticated user info |

### Repositories (14 tools)

| Tool | Description |
|------|-------------|
| `github_repo_list` | List repos for authenticated user |
| `github_repo_get` | Get repo details |
| `github_repo_create` | Create a new repository |
| `github_repo_update` | Update repo settings |
| `github_repo_delete` | Delete a repository |
| `github_repo_fork` | Fork a repository |
| `github_repo_star` | Star a repository |
| `github_repo_unstar` | Unstar a repository |
| `github_repo_content_get` | Get file or directory contents |
| `github_repo_content_create` | Create or update a file |
| `github_repo_content_delete` | Delete a file |
| `github_repo_topics` | Get repo topics |
| `github_repo_contributors` | List contributors |
| `github_repo_languages` | Get language breakdown |

### Issues (12 tools)

| Tool | Description |
|------|-------------|
| `github_issue_list` | List issues for a repo |
| `github_issue_get` | Get issue details |
| `github_issue_create` | Create a new issue |
| `github_issue_update` | Update an issue |
| `github_issue_comment_list` | List comments on an issue |
| `github_issue_comment_create` | Add a comment |
| `github_issue_comment_update` | Update a comment |
| `github_issue_comment_delete` | Delete a comment |
| `github_issue_label_list` | List labels |
| `github_issue_label_create` | Create a label |
| `github_issue_milestone_list` | List milestones |
| `github_issue_milestone_create` | Create a milestone |

### Pull Requests (12 tools)

| Tool | Description |
|------|-------------|
| `github_pull_list` | List pull requests |
| `github_pull_get` | Get PR details |
| `github_pull_create` | Create a pull request |
| `github_pull_update` | Update a pull request |
| `github_pull_merge` | Merge a pull request |
| `github_pull_files` | List changed files |
| `github_pull_diff` | Get the full diff |
| `github_pull_review_list` | List reviews |
| `github_pull_review_create` | Submit a review |
| `github_pull_review_comments` | List review comments |
| `github_pull_request_reviewers` | Request reviewers |
| `github_pull_checks` | List check runs for PR head |

### Branches, Tags & Releases (10 tools)

| Tool | Description |
|------|-------------|
| `github_branch_list` | List branches |
| `github_branch_get` | Get branch details |
| `github_branch_create` | Create a branch |
| `github_branch_delete` | Delete a branch |
| `github_branch_protection_get` | Get branch protection rules |
| `github_tag_list` | List tags |
| `github_release_list` | List releases |
| `github_release_get` | Get release details |
| `github_release_create` | Create a release |
| `github_release_delete` | Delete a release |

### Git (5 tools)

| Tool | Description |
|------|-------------|
| `github_commit_list` | List commits |
| `github_commit_get` | Get commit details |
| `github_compare` | Compare two branches/commits |
| `github_ref_list` | List git refs |
| `github_tree_get` | Get a git tree |

### Actions (9 tools)

| Tool | Description |
|------|-------------|
| `github_workflow_list` | List workflows |
| `github_workflow_get` | Get workflow details |
| `github_workflow_dispatch` | Trigger a workflow |
| `github_run_list` | List workflow runs |
| `github_run_get` | Get run details |
| `github_run_cancel` | Cancel a run |
| `github_run_rerun` | Re-run a workflow |
| `github_job_list` | List jobs in a run |
| `github_run_logs` | Get run logs URL |

### Search (5 tools)

| Tool | Description |
|------|-------------|
| `github_search_repos` | Search repositories |
| `github_search_code` | Search code |
| `github_search_issues` | Search issues and PRs |
| `github_search_commits` | Search commits |
| `github_search_users` | Search users |

### Users & Organizations (6 tools)

| Tool | Description |
|------|-------------|
| `github_user_get` | Get user profile |
| `github_user_repos` | List user's repos |
| `github_org_get` | Get org info |
| `github_org_members` | List org members |
| `github_org_repos` | List org repos |
| `github_team_list` | List teams |

### Gists (5 tools)

| Tool | Description |
|------|-------------|
| `github_gist_list` | List your gists |
| `github_gist_get` | Get a gist with contents |
| `github_gist_create` | Create a gist |
| `github_gist_update` | Update a gist |
| `github_gist_delete` | Delete a gist |

### Notifications (4 tools)

| Tool | Description |
|------|-------------|
| `github_notification_list` | List notifications |
| `github_notification_mark_read` | Mark all as read |
| `github_notification_thread_read` | Mark thread as read |
| `github_notification_thread_subscribe` | Subscribe/unsubscribe |

### Projects (4 tools)

| Tool | Description |
|------|-------------|
| `github_project_list` | List projects |
| `github_project_get` | Get project details |
| `github_project_columns` | List columns |
| `github_project_cards` | List cards |

### Webhooks (4 tools)

| Tool | Description |
|------|-------------|
| `github_webhook_list` | List webhooks |
| `github_webhook_create` | Create a webhook |
| `github_webhook_update` | Update a webhook |
| `github_webhook_delete` | Delete a webhook |

### Security (4 tools)

| Tool | Description |
|------|-------------|
| `github_dependabot_alerts` | Dependabot alerts |
| `github_code_scanning_alerts` | Code scanning alerts |
| `github_secret_scanning_alerts` | Secret scanning alerts |
| `github_security_advisories` | Security advisories |
