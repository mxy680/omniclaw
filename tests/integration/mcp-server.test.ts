import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { ChildProcess } from "child_process";
import { spawn } from "child_process";

const PORT = 19850;
const TOKEN = "test-integration-token";

let serverProc: ChildProcess;

async function waitForServer(url: string, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

describe("MCP Server Integration", () => {
  beforeAll(async () => {
    serverProc = spawn("node", ["dist/mcp-server.js"], {
      cwd: "/Users/markshteyn/omniclaw",
      env: {
        ...process.env,
        OMNICLAW_MCP_TOKEN: TOKEN,
        OMNICLAW_MCP_PORT: String(PORT),
      },
      stdio: "pipe",
    });
    await waitForServer(`http://localhost:${PORT}/health`);
  }, 15000);

  afterAll(() => {
    serverProc?.kill("SIGTERM");
  });

  it("health endpoint returns tool count", async () => {
    const res = await fetch(`http://localhost:${PORT}/health`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.tools).toBeGreaterThan(50);
  });

  it("rejects requests without auth token", async () => {
    const res = await fetch(`http://localhost:${PORT}/health`);
    expect(res.status).toBe(401);
  });

  it("rejects requests with wrong auth token", async () => {
    const res = await fetch(`http://localhost:${PORT}/health`, {
      headers: { Authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("responds to MCP initialize via POST /mcp", async () => {
    const res = await fetch(`http://localhost:${PORT}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("omniclaw");
  });
});
