/**
 * Integration test for parallel conversation dispatch.
 *
 * Connects to a running omniclaw backend via WebSocket, creates 3 conversations,
 * sends a message to each simultaneously, and verifies that all 3 receive
 * typing indicators concurrently (not sequentially queued).
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
  conversations?: unknown[];
  messages?: unknown[];
  [key: string]: unknown;
};

function createClient(): Promise<{
  ws: WebSocket;
  send: (msg: Record<string, unknown>) => void;
  waitFor: (
    predicate: (msg: ServerMsg) => boolean,
    timeoutMs?: number,
  ) => Promise<ServerMsg>;
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
          waitFor: (predicate, timeoutMs = 60_000) =>
            new Promise<ServerMsg>((res, rej) => {
              // Check already-received messages
              const existing = messages.find(predicate);
              if (existing) {
                res(existing);
                return;
              }
              const timer = setTimeout(() => {
                rej(
                  new Error(
                    `Timed out waiting for message (${timeoutMs}ms)`,
                  ),
                );
              }, timeoutMs);
              const listener = (m: ServerMsg) => {
                if (predicate(m)) {
                  clearTimeout(timer);
                  const idx = listeners.indexOf(listener);
                  if (idx >= 0) listeners.splice(idx, 1);
                  res(m);
                }
              };
              listeners.push(listener);
            }),
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

    // Wait for conversations to be acknowledged
    await new Promise((r) => setTimeout(r, 500));
  }, 30_000);

  afterAll(() => {
    // Clean up: delete test conversations
    for (const id of convIds) {
      try {
        client.send({ type: "conversation_delete", conversationId: id });
      } catch {
        // ignore
      }
    }
    setTimeout(() => client.close(), 1000);
  });

  it("should process 3 conversations concurrently (typing indicators arrive within 5s of each other)", async () => {
    // Clear message buffer
    client.messages.length = 0;

    // Send messages to all 3 conversations simultaneously
    const sendTime = Date.now();
    for (const id of convIds) {
      client.send({
        type: "message",
        text: "Hello, what is 2+2? Reply in one word.",
        id: `msg-${id}`,
        conversationId: id,
      });
    }

    console.log(
      `[${new Date().toISOString()}] Sent 3 messages simultaneously`,
    );

    // Wait for typing:true on all 3 conversations
    const typingTimes: Record<string, number> = {};
    const typingPromises = convIds.map((convId) =>
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Timed out waiting for typing indicator on ${convId}`,
            ),
          );
        }, 120_000);

        const check = (msg: ServerMsg) => {
          if (
            msg.type === "typing" &&
            msg.conversationId === convId &&
            msg.active === true
          ) {
            typingTimes[convId] = Date.now();
            clearTimeout(timeout);
            resolve();
            return true;
          }
          return false;
        };

        // Check existing messages
        if (client.messages.some(check)) return;

        // Listen for new ones
        const interval = setInterval(() => {
          if (client.messages.some(check)) {
            clearInterval(interval);
          }
        }, 50);

        // Cleanup on timeout
        setTimeout(() => clearInterval(interval), 120_000);
      }),
    );

    await Promise.all(typingPromises);

    // Analyze timing
    const times = Object.entries(typingTimes).map(([id, t]) => ({
      id,
      t,
      offset: t - sendTime,
    }));
    times.sort((a, b) => a.t - b.t);

    console.log("\n=== Typing indicator timing ===");
    for (const { id, offset } of times) {
      console.log(`  ${id}: +${offset}ms`);
    }

    const spread = times[times.length - 1].t - times[0].t;
    console.log(`  Spread (last - first): ${spread}ms`);

    // If truly parallel, all typing indicators should arrive within ~5s of each other.
    // If sequential, the spread would be 30s+ (each LLM call takes ~10-30s).
    expect(spread).toBeLessThan(5000);
    console.log(
      `\n✅ PARALLEL: All 3 typing indicators arrived within ${spread}ms of each other`,
    );
  }, 180_000);

  it("should receive responses from all 3 conversations", async () => {
    // Wait for typing:false (done) on all 3 conversations
    const donePromises = convIds.map(
      (convId) =>
        new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(
              new Error(
                `Timed out waiting for response on ${convId}`,
              ),
            );
          }, 120_000);

          const check = () => {
            const hasResponse = client.messages.some(
              (m) =>
                m.type === "typing" &&
                m.conversationId === convId &&
                m.active === false,
            );
            if (hasResponse) {
              clearTimeout(timeout);
              resolve();
              return true;
            }
            return false;
          };

          if (check()) return;

          const interval = setInterval(() => {
            if (check()) clearInterval(interval);
          }, 100);

          setTimeout(() => clearInterval(interval), 120_000);
        }),
    );

    const startWait = Date.now();
    await Promise.all(donePromises);
    const elapsed = Date.now() - startWait;

    // Count response messages per conversation
    for (const convId of convIds) {
      const responseMsgs = client.messages.filter(
        (m) =>
          m.type === "message" &&
          m.conversationId === convId &&
          !m.isUser,
      );
      console.log(
        `  ${convId}: ${responseMsgs.length} response message(s)`,
      );
      expect(responseMsgs.length).toBeGreaterThan(0);
    }

    console.log(`  All 3 responses received in ${elapsed}ms total`);
  }, 180_000);
});
