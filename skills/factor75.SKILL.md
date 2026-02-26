---
name: factor75
description: Factor75 meal delivery — browse menus, select meals, manage subscriptions, and track deliveries.
metadata: {"openclaw": {"emoji": "🥗"}}
---

# Factor75

Browse weekly menus, pick meals, manage your subscription, and track deliveries on Factor75 (factor.com).

## First-Time Setup

Factor75 uses browser-based authentication via Playwright — no API token needed. After the initial login, all requests use fast direct HTTP with JWT tokens (~100ms per call).

1. Make sure Playwright browsers are installed: `npx playwright install chromium`
2. Save your Factor75 credentials once (so you never have to type them again):

```bash
openclaw config set plugins.entries.omniclaw.config.factor75_email "your_email@example.com"
openclaw config set plugins.entries.omniclaw.config.factor75_password "your_password"
```

3. Call `factor75_auth_setup` with no arguments:

```
factor75_auth_setup
```

4. A browser will open to factor75.com/login. If credentials are configured, they will be auto-filled. Complete any MFA/captcha challenges manually — the tool waits up to 5 minutes.
5. Once login succeeds, JWT tokens are saved automatically. Tokens last ~30 days.

> You can also pass `email` and `password` directly to `factor75_auth_setup` to override the saved config.

## Available Tools

- `factor75_auth_setup` — Authenticate via browser login (run once, tokens last ~30 days)
- `factor75_menu` — Browse the weekly meal menu, optionally filter by diet
- `factor75_meal_details` — Full nutrition, ingredients, allergens for a meal
- `factor75_get_selections` — See your current meal picks for a week
- `factor75_select_meal` — Add a meal to your weekly selections
- `factor75_remove_meal` — Remove a meal from your weekly selections
- `factor75_subscription` — View subscription plan, status, and pricing
- `factor75_skip_week` — Skip a delivery week
- `factor75_pause` — Pause your subscription
- `factor75_resume` — Resume a paused subscription
- `factor75_deliveries` — List upcoming and recent deliveries
- `factor75_delivery_details` — Full details for a specific delivery
- `factor75_account` — Account info, address, payment, credits

## Workflow

1. Call `factor75_auth_setup` with no arguments — the tool reads credentials from the plugin config automatically. Do NOT ask the user for their email or password.
2. Use `factor75_menu` to see this week's available meals. Filter by diet with `filter: "keto"`, `"protein-plus"`, etc.
3. Use `factor75_meal_details` with a meal ID to see full nutrition and ingredients.
4. Use `factor75_get_selections` to see what's already selected for the week.
5. Use `factor75_select_meal` / `factor75_remove_meal` to modify selections before the cutoff.
6. Use `factor75_subscription` to check plan details and delivery schedule.
7. Use `factor75_skip_week` to skip a specific week.
8. Use `factor75_deliveries` to see upcoming/recent deliveries, then `factor75_delivery_details` for tracking info.
9. Use `factor75_account` to review account info, address, and payment.

## Error Handling

If any tool returns `"error": "auth_required"`, call `factor75_auth_setup` first.

If a session expires (~30 days), call `factor75_auth_setup` again to re-authenticate.
