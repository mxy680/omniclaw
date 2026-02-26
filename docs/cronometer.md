# Cronometer Integration

6 tools for tracking nutrition, exercise, biometrics, and notes via Cronometer.

## Setup

Cronometer uses browser-based authentication via Playwright for the initial login. After authentication, all API calls use direct HTTP to Cronometer's export API (~100ms per call). Session tokens do not have a known expiry — re-authenticate if calls start failing.

### Step 1: Install Browser

```bash
npx playwright install chromium
```

### Step 2: Configure Credentials (Optional)

Save your Cronometer credentials so authentication is automatic:

```bash
openclaw config set plugins.entries.omniclaw.config.cronometer_email "your_email@example.com"
openclaw config set plugins.entries.omniclaw.config.cronometer_password "your_password"
```

### Step 3: Authenticate

Ask your agent:
> "Set up Cronometer"

It will call `cronometer_auth_setup`, which opens a Chromium browser to Cronometer's login page. Credentials are auto-filled if configured. Once logged in, session tokens and GWT values are captured for subsequent direct HTTP calls.

## Tools

| Tool | Description |
|------|-------------|
| `cronometer_auth_setup` | Authenticate via browser login |
| `cronometer_diary` | Food diary (servings) for a date range |
| `cronometer_nutrition_summary` | Daily nutrition totals (up to 84 nutrients) |
| `cronometer_exercises` | Exercise log for a date range |
| `cronometer_biometrics` | Biometric measurements (weight, BP, etc.) |
| `cronometer_notes` | Daily notes for a date range |

## Configuration

All configuration is set via `openclaw config set plugins.entries.omniclaw.config.<key> <value>`.

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `cronometer_tokens_path` | No | `~/.openclaw/omniclaw-cronometer-tokens.json` | Where Cronometer session tokens are stored |
| `cronometer_email` | No | — | Cronometer account email for automatic login |
| `cronometer_password` | No | — | Cronometer account password for automatic login |

## Architecture

Cronometer uses a GWT (Google Web Toolkit) backend with no public API. This integration uses a hybrid approach:

- **Auth**: Playwright opens cronometer.com/login, captures session cookies and GWT magic values
- **Read**: Direct HTTP to `/export` endpoint with CSV response parsing
- **Write (future)**: GWT RPC calls to `/cronometer/app`

## Usage Examples

> "What did I eat today on Cronometer?"
> "Show my Cronometer nutrition for this week"
> "How many calories did I burn exercising this month?"
> "What's my weight trend on Cronometer?"
> "Show my Cronometer notes from January"
