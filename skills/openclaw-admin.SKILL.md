---
name: openclaw-admin
description: Restart the OpenClaw gateway, rebuild the plugin, and other admin tasks.
metadata: {"openclaw": {"emoji": "🔧"}}
---

# OpenClaw Admin

Common admin commands for the OpenClaw gateway and plugin.

## Restarting the Gateway

After changing backend code (tools, channel handlers, etc.), the gateway must be restarted to pick up changes.

```bash
# 1. Rebuild the plugin
pnpm build

# 2. Restart the gateway (uses launchd)
openclaw gateway restart
```

**Do NOT** kill the process manually — use the CLI.

## Starting the Dashboard

The dashboard uses `output: "export"` (static HTML). **`next start` / `pnpm start` always returns 500.**

```bash
cd dashboard && pnpm dev
```

Must run on port 3000. Before starting, kill only stale node processes on :3000:

```bash
# Find the PID
lsof -i :3000 -P | grep node
# Kill only that PID — never kill $(lsof -ti :3000) as it can kill Firefox
kill <pid>
```

## Gateway Status

```bash
openclaw gateway status
```

## Useful Commands

| Task | Command |
|---|---|
| Rebuild plugin | `pnpm build` |
| Restart gateway | `openclaw gateway restart` |
| Gateway status | `openclaw gateway status` |
| Start dashboard | `cd dashboard && pnpm dev` |
| Build dashboard | `cd dashboard && pnpm build` |
| Gateway logs | Check launchd or `openclaw gateway run` for foreground |
