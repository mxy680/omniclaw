# Project Instructions

## Git workflow
- Commit every semi-significant change as you go. Don't batch everything at the end.
- Push to origin after commits.
- Exclude files with hardcoded credentials from commits (e.g. `scripts/debug-duo.ts`, `scripts/extract-duo-secret.ts`).

## Build & test
- `pnpm build` — TypeScript compilation
- `pnpm vitest run` — run all tests
- Always build and test after changes before committing.
