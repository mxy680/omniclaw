# Jobs (Scheduled Tasks)

Schedule recurring tasks using cron expressions. Two modes: direct tool execution or agent-driven prompts.

## Tools

| Tool | Description |
|---|---|
| `job_create` | Create a new scheduled job |
| `job_list` | List all scheduled jobs |
| `job_get` | Get job details + run history |
| `job_update` | Update job schedule, params, or enabled status |
| `job_delete` | Delete a job and its run history |
| `job_run_now` | Trigger a job immediately |

## Modes

- **Tool mode**: Execute a specific omniclaw tool with fixed parameters. No LLM inference needed.
- **Agent mode**: Send a natural language prompt to the agent. Runs as a background dispatch.

## Cron Expressions

Standard 5-field format: `minute hour day month weekday`

| Expression | Meaning |
|---|---|
| `0 8 * * *` | Every day at 8:00 AM |
| `0 9 * * 1` | Every Monday at 9:00 AM |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 1 * *` | First day of every month at midnight |

All times are in the configured timezone (defaults to system local).

## Examples

Create a daily inbox check:
```
job_create(name: "Morning inbox", cron: "0 8 * * *", mode: "tool", tool_name: "gmail_inbox", tool_params: { account: "default", max_results: 10 })
```

Create a weekly summary:
```
job_create(name: "Weekly summary", cron: "0 9 * * 1", mode: "agent", prompt: "Summarize my unread emails and upcoming calendar events for this week")
```

Pause a job:
```
job_update(job_id: "<job-id>", enabled: false)
```
