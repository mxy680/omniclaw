# Smoke Test Response Validation

**Date:** 2026-03-10
**Status:** Approved

## Problem

Smoke tests treat any non-throwing tool response as "success." Tools that return `{ error: "auth_required" }` or `{ error: "operation_failed" }` as JSON (without throwing) show green checkmarks. This means smoke tests pass even with no account connected, giving false confidence.

## Design

### New status: "skipped"

`TestStepResult.status` becomes `"success" | "error" | "skipped"`.

### Response inspection in `runStep`

After a tool executes without throwing, `runStep` extracts the result and checks for an `error` field:

- `error === "auth_required"` → status `"skipped"`, store error message
- `error` is any other string → status `"error"`, store error message
- No `error` field → status `"success"`

This happens inside `runStep` itself — no changes needed to any individual test function. All 13 integrations get the fix automatically.

### UI changes in `service-test-panel.tsx`

- **Step icon:** Skipped steps get a yellow/amber icon (e.g., `MinusCircle` or `SkipForward`)
- **Summary line:** `"X/Y passed (Z failed) · W skipped (Nms)"` — skipped count only shown when > 0. The pass/fail ratio only counts steps that actually executed.
- **Step row:** Skipped steps shown with muted/amber text and the `action` message (e.g., "Call framer_auth_setup to authenticate")

## Files changed

| File | Change |
|---|---|
| `web/lib/test-plans.ts` | Add `"skipped"` to status union, update `runStep` to inspect response body |
| `web/components/service-test-panel.tsx` | Add skipped icon, update summary format, style skipped rows |

Two files total. Zero changes to individual test functions.
