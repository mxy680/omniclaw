---
name: hcm
description: CWRU PeopleSoft HCM — enter work hours, view timesheets, check pay stubs
metadata: {"openclaw": {"emoji": "⏰"}}
---

# HCM (CWRU PeopleSoft)

Manage your CWRU work hours and payroll through PeopleSoft HCM at hcm.case.edu.

## First-Time Setup

HCM uses browser-based authentication via CWRU SSO + Duo MFA.

1. Pre-configure credentials (optional, enables fully automated login):

   openclaw config set plugins.entries.omniclaw.config.hcm_case_id "abc123"
   openclaw config set plugins.entries.omniclaw.config.hcm_password "your-password"
   openclaw config set plugins.entries.omniclaw.config.duo_totp_secret "your-duo-secret"

2. Call `hcm_auth_setup` — browser opens for CWRU SSO login

3. Complete Duo MFA (automatic if duo_totp_secret configured, otherwise approve the push)

4. Session cookies saved automatically

## Available Tools

- `hcm_auth_setup` — Authenticate via CWRU SSO + Duo
- `hcm_get_timesheet` — View current or past timesheet
- `hcm_enter_hours` — Enter hours for specific days (saves but does NOT submit)
- `hcm_submit_timesheet` — Submit timesheet for approval
- `hcm_get_paystubs` — View recent pay stubs
- `hcm_get_paystub_details` — View full details of a specific pay stub

## Workflow

### Enter Weekly Hours

1. `hcm_auth_setup` (if not already authenticated)
2. `hcm_enter_hours` with your hours, e.g. `{ "hours": { "monday": 4, "wednesday": 3, "friday": 5 } }`
3. `hcm_get_timesheet` to verify hours look correct
4. `hcm_submit_timesheet` to submit for approval

### Check Pay

1. `hcm_get_paystubs` to see recent pay stubs
2. `hcm_get_paystub_details` with the index of the stub you want to view

## Error Handling

If any tool returns `"error": "auth_required"`, call `hcm_auth_setup` first.
PeopleSoft sessions typically expire after a few hours — re-run `hcm_auth_setup` if needed.
