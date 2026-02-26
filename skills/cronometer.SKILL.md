---
name: cronometer
description: Cronometer nutrition tracking — view food diary, nutrition, exercise, biometrics, and notes.
metadata: {"openclaw": {"emoji": "🥦"}}
---

# Cronometer

Track nutrition, exercise, biometrics, and notes on Cronometer (cronometer.com).

## First-Time Setup

Cronometer uses browser-based authentication via Playwright. After the initial login, all requests use fast direct HTTP.

1. Make sure Playwright browsers are installed: `npx playwright install chromium`
2. Save your Cronometer credentials once:

```bash
openclaw config set plugins.entries.omniclaw.config.cronometer_email "your_email@example.com"
openclaw config set plugins.entries.omniclaw.config.cronometer_password "your_password"
```

3. Call `cronometer_auth_setup` with no arguments.
4. A browser will open to cronometer.com/login. Credentials are auto-filled if configured.
5. Once login succeeds, session tokens are saved automatically.

## Available Tools

- `cronometer_auth_setup` — Authenticate via browser login
- `cronometer_diary` — Food diary (servings) for a date range
- `cronometer_nutrition_summary` — Daily nutrition totals (84 nutrients)
- `cronometer_exercises` — Exercise log for a date range
- `cronometer_biometrics` — Biometric measurements (weight, BP, body fat, etc.)
- `cronometer_notes` — Daily notes for a date range

## Workflow

1. Call `cronometer_auth_setup` with no arguments — the tool reads credentials from the plugin config automatically. Do NOT ask the user for their email or password.
2. Use `cronometer_diary` to see what was eaten on a given day or date range.
3. Use `cronometer_nutrition_summary` for daily totals of all tracked nutrients.
4. Use `cronometer_exercises` to see the exercise log.
5. Use `cronometer_biometrics` to track weight, blood pressure, and other measurements over time.
6. Use `cronometer_notes` to see daily notes.

## Error Handling

If any tool returns `"error": "auth_required"`, call `cronometer_auth_setup` first.

If a session expires, call `cronometer_auth_setup` again to re-authenticate.
