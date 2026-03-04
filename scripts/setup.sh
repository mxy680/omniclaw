#!/usr/bin/env bash
set -e

# Start the gateway in the background
openclaw gateway &
GATEWAY_PID=$!
trap "kill $GATEWAY_PID 2>/dev/null" EXIT

# Give the gateway a moment to initialize
sleep 3

# Start the MCP server in the foreground (exec replaces this shell)
export OMNICLAW_MCP_TOKEN=dev
exec tsx src/mcp-server.ts
