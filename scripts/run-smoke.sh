#!/bin/bash
# run-smoke.sh — Hourly smoke test runner for omniclaw.
# Called by launchd (com.openclaw.omniclaw-smoke.plist).

set -euo pipefail

PROJECT_DIR="/Users/markshteyn/conductor/workspaces/omniclaw-v1/boston"

# Ensure pnpm/node are on PATH (Homebrew)
export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"

cd "${PROJECT_DIR}"

echo "[smoke] $(date -Iseconds) — starting smoke tests"

if pnpm test:smoke 2>&1; then
  echo "[smoke] $(date -Iseconds) — all checks passed"
else
  EXIT_CODE=$?
  echo "[smoke] $(date -Iseconds) — FAILED (exit code ${EXIT_CODE})"

  # macOS notification on failure
  osascript -e "display notification \"Omniclaw smoke tests failed (exit ${EXIT_CODE})\" with title \"Omniclaw Smoke\" sound name \"Basso\"" 2>/dev/null || true

  exit ${EXIT_CODE}
fi
