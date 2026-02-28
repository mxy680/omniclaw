# HCM Case (PeopleSoft) Integration Design

**Date:** 2026-02-28
**Status:** Approved

## Overview

Integration with Case Western Reserve University's PeopleSoft HCM system (`hcm.case.edu`) for timesheet entry and pay stub viewing. The primary use case is auto-filling weekly hours for a student SDLE job.

## Architecture

**Approach:** Full Playwright automation. All interactions go through the browser — PeopleSoft's internal APIs are poorly documented and vary by installation, so browser automation is the most reliable path.

**Auth:** CWRU SSO (Case ID + password) with Duo MFA. Reuse existing `duo-totp.js` helper for automated TOTP, with manual push fallback.

## Authentication

1. Launch Playwright, navigate to `hcm.case.edu`
2. CWRU SSO page — fill Case ID + password (from plugin config or manual entry)
3. Duo MFA — auto-TOTP if `hcm_duo_totp_secret` configured, otherwise wait for manual push approval (up to 2 min)
4. Capture PeopleSoft session cookies after SSO redirect
5. Store to `~/.openclaw/omniclaw-hcm-tokens.json`, keyed by account name

**Session reuse:** Inject stored cookies on subsequent calls. Validate on each use; re-auth if expired.

**Plugin config keys:**
- `hcm_case_id` — CWRU Case ID
- `hcm_password` — password
- `hcm_duo_totp_secret` — optional Duo TOTP secret for automated MFA
- `hcm_tokens_path` — custom tokens path override

## Tools (6 total)

### Auth
| Tool | Description |
|------|-------------|
| `hcm_auth_setup` | Authenticate via CWRU SSO + Duo through Playwright |

### Time Entry
| Tool | Description |
|------|-------------|
| `hcm_get_timesheet` | View current or past timesheet (hours per day, status) |
| `hcm_enter_hours` | Enter hours for specific days in the current pay period |
| `hcm_submit_timesheet` | Submit the current timesheet for approval |

### Pay Info
| Tool | Description |
|------|-------------|
| `hcm_get_paystubs` | View recent pay stubs (date, gross, net, deductions) |
| `hcm_get_paystub_details` | View full details of a specific pay stub |

## Time Entry Flow

`hcm_enter_hours` parameters:
```typescript
{
  hours: { monday?: number, tuesday?: number, wednesday?: number,
           thursday?: number, friday?: number, saturday?: number, sunday?: number },
  period?: string,    // pay period date, defaults to current
  account?: string    // defaults to "default"
}
```

Flow:
1. Launch Playwright with stored session cookies
2. Navigate to `hcm.case.edu` → Employee Self-Service homepage
3. Click "Time" tile → timesheet page
4. Select correct pay period (current by default, or specific date if `period` provided)
5. For each day with hours: locate input field, clear, type new value
6. Save (but do NOT submit — that's a separate `hcm_submit_timesheet` call)
7. Return updated timesheet data as structured JSON

Enter and submit are separate tools so hours can be reviewed before submission.

## Read-Only Tools

`hcm_get_timesheet`, `hcm_get_paystubs`, `hcm_get_paystub_details` follow the same Playwright pattern: navigate to the relevant PeopleSoft page, scrape data from the DOM, return as structured JSON.

## Error Handling

- **Session expired:** Return `{ error: "auth_required" }` if login redirect detected
- **Duo timeout:** 2-minute timeout for manual push approval
- **UI resilience:** Use text content and ARIA label selectors over brittle CSS selectors
- **Period not found:** Return error with list of available periods
- **Already submitted:** `hcm_enter_hours` returns error with current timesheet status

## File Structure

```
src/auth/hcm-client-manager.ts         — Session storage, cookie management
src/tools/hcm-auth-tool.ts             — SSO + Duo login flow
src/tools/hcm-timesheet.ts             — get_timesheet, enter_hours, submit_timesheet
src/tools/hcm-paystubs.ts              — get_paystubs, get_paystub_details
skills/hcm.SKILL.md                    — Usage documentation
tests/integration/hcm.test.ts          — Integration tests
```

## Registration

In `src/mcp/tool-registry.ts`: instantiate `HcmClientManager`, register all 6 tools unconditionally (no `client_secret_path` guard — browser auth only).
