# Factor75 Integration

13 tools for managing Factor75 meal delivery — browse menus, select meals, manage subscriptions, and track deliveries.

## Setup

Factor75 uses browser-based authentication via Playwright for the initial login. After authentication, all API calls use fast direct HTTP with JWT Bearer tokens (~100ms per call instead of ~5-10s with a browser). Tokens last approximately 30 days.

### Step 1: Install Browser

```bash
npx playwright install chromium
```

### Step 2: Configure Credentials (Optional)

Save your Factor75 credentials so authentication is automatic:

```bash
openclaw config set plugins.entries.omniclaw.config.factor75_email "your_email@example.com"
openclaw config set plugins.entries.omniclaw.config.factor75_password "your_password"
```

### Step 3: Authenticate

Ask your agent:
> "Set up Factor75"

It will call `factor75_auth_setup`, which opens a Chromium browser to Factor75's login page. If credentials are configured, they are auto-filled. Complete any MFA or captcha challenges manually — the tool waits up to 5 minutes. Once logged in, the JWT is captured and stored for subsequent direct HTTP calls.

## Tools

| Tool | Description |
|------|-------------|
| `factor75_auth_setup` | Authenticate via browser login |
| `factor75_menu` | Browse the weekly meal menu |
| `factor75_meal_details` | Full nutrition, ingredients, allergens for a meal |
| `factor75_get_selections` | See current meal picks for a week |
| `factor75_select_meal` | Add a meal to weekly selections |
| `factor75_remove_meal` | Remove a meal from weekly selections |
| `factor75_subscription` | View subscription plan and status |
| `factor75_skip_week` | Skip a delivery week |
| `factor75_pause` | Pause subscription |
| `factor75_resume` | Resume a paused subscription |
| `factor75_deliveries` | List upcoming and recent deliveries |
| `factor75_delivery_details` | Full details for a specific delivery |
| `factor75_account` | Account info, address, payment, credits |

## Configuration

All configuration is set via `openclaw config set plugins.entries.omniclaw.config.<key> <value>`.

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `factor75_tokens_path` | No | `~/.openclaw/omniclaw-factor75-tokens.json` | Where Factor75 session tokens are stored |
| `factor75_email` | No | — | Factor75 account email for automatic login |
| `factor75_password` | No | — | Factor75 account password for automatic login |

## Architecture

Unlike Instagram and LinkedIn which use Playwright for every API call, Factor75 uses **direct HTTP with JWT Bearer tokens** after the initial browser-based login. This is possible because Factor75 runs on HelloFresh's infrastructure, which provides a standard GraphQL API (`food-graphql-router.live-k8s.hellofresh.io`) with JWT authentication.

- **Auth**: Playwright opens factor75.com/login, intercepts the JWT from the auth-service response
- **API calls**: Standard `fetch()` with `Authorization: Bearer <token>` — no browser needed
- **Performance**: ~100ms per API call vs ~5-10s with Playwright-in-browser

## Usage Examples

> "What's on the Factor75 menu this week?"
> "Show me the keto options on Factor75"
> "Get nutrition info for that chicken meal"
> "What meals do I have selected for this week?"
> "Add the grilled salmon to my Factor75 order"
> "Remove the pasta from my selections"
> "What's my Factor75 subscription plan?"
> "Skip next week's Factor75 delivery"
> "When is my next Factor75 delivery?"
> "Track my Factor75 delivery"
> "Show my Factor75 account info"
