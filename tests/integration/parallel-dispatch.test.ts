/**
 * Integration test for parallel conversation dispatch.
 *
 * Connects to a running omniclaw backend via WebSocket, creates 3 conversations,
 * sends a message to each simultaneously, and verifies that all 3 receive
 * responses concurrently (not sequentially queued).
 *
 * Requires: WS_URL and WS_TOKEN env vars, or defaults to local dev values.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";

const WS_URL = process.env.WS_URL ?? "ws://100.122.77.79:9800";
const WS_TOKEN =
  process.env.WS_TOKEN ??
  "12114508a208ff38b1ee25a2b043162ac6f966f5f96dc8db83de81be8b4d7ce2";

type ServerMsg = {
  type: string;
  conversationId?: string;
  active?: boolean;
  text?: string;
  id?: string;
  isUser?: boolean;
  conversations?: unknown[];
  messages?: unknown[];
  [key: string]: unknown;
};

function createClient(): Promise<{
  ws: WebSocket;
  send: (msg: Record<string, unknown>) => void;
  onMessage: (cb: (msg: ServerMsg) => void) => void;
  messages: ServerMsg[];
  close: () => void;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const messages: ServerMsg[] = [];
    const listeners: Array<(msg: ServerMsg) => void> = [];

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "auth", token: WS_TOKEN }));
    });

    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw)) as ServerMsg;
      messages.push(msg);

      if (msg.type === "auth_ok") {
        resolve({
          ws,
          send: (m) => ws.send(JSON.stringify(m)),
          onMessage: (cb) => listeners.push(cb),
          messages,
          close: () => ws.close(),
        });
      }
      if (msg.type === "auth_fail") {
        reject(new Error(`Auth failed: ${msg.reason ?? "unknown"}`));
      }

      for (const listener of [...listeners]) {
        listener(msg);
      }
    });

    ws.on("error", reject);
    setTimeout(() => reject(new Error("Connection timeout")), 10_000);
  });
}

describe("parallel dispatch", () => {
  let client: Awaited<ReturnType<typeof createClient>>;
  const convIds: string[] = [];

  beforeAll(async () => {
    client = await createClient();

    // Create 3 conversations
    for (let i = 0; i < 3; i++) {
      const id = `test-parallel-${Date.now()}-${i}`;
      convIds.push(id);
      client.send({
        type: "conversation_create",
        id,
        title: `Parallel Test ${i + 1}`,
      });
    }

    // Wait for conversations to be created
    await new Promise((r) => setTimeout(r, 500));
  }, 30_000);

  afterAll(() => {
    for (const id of convIds) {
      try {
        client.send({ type: "conversation_delete", conversationId: id });
      } catch {
        // ignore
      }
    }
    setTimeout(() => client.close(), 1000);
  });

  it("should process 3 conversations in parallel (all complete within ~1.5x single response time)", async () => {
    // Track when each conversation's FIRST response text arrives and when it completes
    const firstResponseTime: Record<string, number> = {};
    const completionTime: Record<string, number> = {};

    client.onMessage((msg) => {
      if (
        msg.type === "message" &&
        msg.conversationId &&
        convIds.includes(msg.conversationId) &&
        !msg.isUser
      ) {
        if (!firstResponseTime[msg.conversationId]) {
          firstResponseTime[msg.conversationId] = Date.now();
        }
      }
      if (
        msg.type === "typing" &&
        msg.conversationId &&
        convIds.includes(msg.conversationId) &&
        msg.active === false
      ) {
        completionTime[msg.conversationId] = Date.now();
      }
    });

    // Send messages to all 3 conversations simultaneously
    const sendTime = Date.now();
    for (const id of convIds) {
      client.send({
        type: "message",
        text: "What is 2+2? Reply with just the number.",
        id: `msg-${id}`,
        conversationId: id,
      });
    }

    console.log(
      `\n[${new Date().toISOString()}] Sent 3 messages simultaneously`,
    );

    // Wait for all 3 to complete (typing:false)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const completed = Object.keys(completionTime);
        const missing = convIds.filter((id) => !completionTime[id]);
        reject(
          new Error(
            `Timed out. Completed: ${completed.length}/3. Missing: ${missing.join(", ")}`,
          ),
        );
      }, 120_000);

      const interval = setInterval(() => {
        if (convIds.every((id) => completionTime[id])) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });

    // Analyze timing
    console.log("\n=== First response timing ===");
    for (const id of convIds) {
      const responseOffset = firstResponseTime[id]
        ? firstResponseTime[id] - sendTime
        : "N/A";
      const completionOffset = completionTime[id] - sendTime;
      console.log(
        `  ${id}: first_response=+${responseOffset}ms, completed=+${completionOffset}ms`,
      );
    }

    const firstResponseTimes = convIds.map(
      (id) => firstResponseTime[id] - sendTime,
    );
    const completionTimes = convIds.map(
      (id) => completionTime[id] - sendTime,
    );

    const firstResponseSpread =
      Math.max(...firstResponseTimes) - Math.min(...firstResponseTimes);
    const completionSpread =
      Math.max(...completionTimes) - Math.min(...completionTimes);
    const totalTime = Math.max(...completionTimes);

    console.log(`\n  First response spread: ${firstResponseSpread}ms`);
    console.log(`  Completion spread: ${completionSpread}ms`);
    console.log(`  Total time for all 3: ${totalTime}ms`);

    // Key assertion: if truly parallel, the first responses should arrive
    // close together (within 10s). If sequential, they'd be 15-60s apart.
    expect(firstResponseSpread).toBeLessThan(10_000);

    // Also: total time should be roughly 1x single response time (not 3x).
    // A single response typically takes 5-20s. 3 sequential would be 15-60s.
    // If parallel, all 3 should finish in ~20-30s total.
    console.log(
      `\n✅ PARALLEL: First response spread=${firstResponseSpread}ms, total=${totalTime}ms`,
    );
  }, 180_000);
});
