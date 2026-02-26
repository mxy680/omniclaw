# Cronometer Integration Design

**Date:** 2026-02-26
**Status:** Approved
**Issue:** #32

## Overview

Full read/write integration with [Cronometer](https://cronometer.com), a nutrition and health tracking app. Hybrid approach: Playwright for login + GWT magic value extraction, then direct HTTP for all API calls.

## Why Hybrid

Cronometer has no public API. It uses a GWT (Google Web Toolkit) backend with version-specific "magic values" (permutation hash, header hash) that change on app updates. The hybrid approach:

- **Playwright** handles login and auto-discovers GWT values from intercepted network traffic — no hardcoding fragile constants
- **Direct HTTP** for all subsequent reads (CSV export API) and writes (GWT RPC) — fast, no browser overhead
- Same pattern as Factor75 (Playwright login captures tokens, then direct HTTP)

## Authentication Flow

1. Playwright opens `cronometer.com/login/`
2. Extracts CSRF token from `<input name="anticsrf">`
3. Intercepts outgoing GWT requests to capture `X-GWT-Permutation` and `X-GWT-Module-Base` headers
4. Fills email/password, submits form
5. Captures `sesnonce` cookie from login response
6. Calls GWT `authenticate` (direct HTTP) to get user ID
7. Generates export auth token via GWT RPC `generateAuthToken`
8. Stores full session object, closes browser

### Session Object

```typescript
interface CronometerSession {
  sesnonce: string;
  user_id: string;
  auth_token: string;       // for export API
  gwt_permutation: string;
  gwt_header: string;
  gwt_content_type: string; // "text/x-gwt-rpc; charset=UTF-8"
  gwt_module_base: string;
  all_cookies: Record<string, string>;
  authenticated_at: number; // Unix timestamp
}
```

## API Endpoints

### Export API (Read — Phase 1)

```
GET https://cronometer.com/export
  ?nonce={auth_token}
  &generate={dailySummary|servings|exercises|biometrics|notes}
  &start=YYYY-MM-DD
  &end=YYYY-MM-DD

Headers:
  sec-fetch-dest: document
  sec-fetch-mode: navigate
  sec-fetch-site: same-origin
  Cookie: sesnonce={sesnonce}
```

Returns CSV data parsed into structured objects.

### GWT RPC (Write — Phase 2)

```
POST https://cronometer.com/cronometer/app

Headers:
  content-type: text/x-gwt-rpc; charset=UTF-8
  x-gwt-module-base: {gwt_module_base}
  x-gwt-permutation: {gwt_permutation}
  Cookie: sesnonce={sesnonce}

Body: GWT RPC serialized format
  Pattern: 7|0|{param_count}|{module_base}|{header}|{service}|{method}|{type_sigs}|{params}
```

Write method names and signatures to be discovered during implementation via network traffic interception.

## Tools

### Phase 1 — Read (Export API)

| Tool | Export Type | Description |
|---|---|---|
| `cronometer_auth_setup` | — | Playwright login + GWT value capture |
| `cronometer_diary` | `servings` | Food diary for date range |
| `cronometer_nutrition_summary` | `dailySummary` | Daily nutrition totals (84 nutrients) |
| `cronometer_exercises` | `exercises` | Exercise log |
| `cronometer_biometrics` | `biometrics` | Weight, blood pressure, body fat, etc. |
| `cronometer_notes` | `notes` | Daily notes |

### Phase 2 — Write (GWT RPC)

| Tool | Expected GWT Method | Description |
|---|---|---|
| `cronometer_search_food` | TBD | Search food database |
| `cronometer_log_food` | TBD | Add food entry to diary |
| `cronometer_remove_food` | TBD | Remove food entry |
| `cronometer_log_exercise` | TBD | Log exercise |
| `cronometer_log_biometric` | TBD | Log biometric measurement |
| `cronometer_log_note` | TBD | Add daily note |

**Fallback:** If GWT write serialization proves too complex, write tools will fall back to Playwright browser automation.

## Architecture

### Files

```
src/auth/cronometer-client-manager.ts    — Session storage, HTTP helpers, CSV parsing
src/tools/cronometer-auth-tool.ts        — Playwright login + GWT discovery
src/tools/cronometer-diary.ts            — Food diary export
src/tools/cronometer-nutrition.ts        — Daily nutrition summary
src/tools/cronometer-exercises.ts        — Exercise export
src/tools/cronometer-biometrics.ts       — Biometric export
src/tools/cronometer-notes.ts            — Notes export
src/tools/cronometer-search.ts           — Food search (Phase 2)
src/tools/cronometer-log-food.ts         — Log food (Phase 2)
src/tools/cronometer-remove-food.ts      — Remove food (Phase 2)
src/tools/cronometer-log-exercise.ts     — Log exercise (Phase 2)
src/tools/cronometer-log-biometric.ts    — Log biometric (Phase 2)
src/tools/cronometer-log-note.ts         — Log note (Phase 2)
src/tools/cronometer-utils.ts            — Shared GWT/CSV helpers
docs/cronometer.md                       — Technical docs
skills/cronometer.SKILL.md               — User-facing skill
tests/integration/cronometer.test.ts     — Integration tests
```

### Config

```typescript
// Added to PluginConfig
cronometer_tokens_path?: string;
cronometer_email?: string;
cronometer_password?: string;
```

### Registration

All tools register in `src/plugin.ts` before the Google OAuth guard, matching the Factor75/LinkedIn pattern.

## CSV Parsing

The export API returns CSV with these record types:

**ServingRecord** (67 fields): Day, Time, Group, FoodName, Quantity, EnergyKcal, ProteinG, FatG, CarbsG, FiberG, plus vitamins (A-K, B1-B12), minerals (Ca, Fe, Mg, Zn, etc.), amino acids, sugars, fats (saturated, mono, poly, trans, omega-3/6), water, caffeine.

**ExerciseRecord**: Day, Time, Exercise, Minutes, CaloriesBurned.

**BiometricRecord**: Day, Time, Metric, Unit, Amount.

**NoteRecord**: Day, Note.

## Phased Rollout

**Phase 1** — Auth + 5 read tools. Uses the documented export API. Low risk.

**Phase 2** — 6 write tools. Requires GWT reverse-engineering. During auth, we intercept real GWT requests to discover method signatures. Higher risk; fallback to Playwright if needed.

## References

- [gocronometer](https://github.com/jrmycanady/gocronometer) — Go library with read-only Cronometer API access (GPLv2)
- [burke/gocronometer](https://pkg.go.dev/github.com/burke/gocronometer) — Fork with parsed export methods
- GWT values discovered: permutation `7B121DC5483BF272B1BC1916DA9FA963`, header `2D6A926E3729946302DC68073CB0D550` (may change with app updates)
