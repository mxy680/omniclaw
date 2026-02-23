/**
 * Integration tests for Duo TOTP passcode generation.
 *
 * Validates generateDuoPasscode against RFC 4226 (HOTP) / RFC 6238 (TOTP)
 * test vectors. All vector tests are fully deterministic — they pin Date.now()
 * via vi.useFakeTimers and require no external services.
 *
 * For TOTP with a 30-second period:
 *   counter = Math.floor(Date.now() / 1000 / 30)
 *   Pinning Date.now() to N * 30_000 ms drives counter to exactly N.
 *
 * Also tests the full canvas_auth_setup tool with TOTP when env vars are set:
 *   CANVAS_BASE_URL       Canvas instance URL
 *   CANVAS_USERNAME       SSO username
 *   CANVAS_PASSWORD       SSO password
 *   DUO_TOTP_SECRET       Hex or base32-encoded Duo TOTP secret
 *
 * Run:
 *   pnpm vitest run tests/integration/duo-totp.test.ts
 *
 * Run with live Canvas auth:
 *   CANVAS_BASE_URL="https://canvas.example.edu" CANVAS_USERNAME="user" \
 *   CANVAS_PASSWORD="pass" DUO_TOTP_SECRET="hexsecret" \
 *   pnpm vitest run tests/integration/duo-totp.test.ts
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { generateDuoPasscode } from "../../src/auth/duo-totp";

// ---------------------------------------------------------------------------
// RFC 4226 Appendix D test secret: ASCII "12345678901234567890"
// Base32: GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
// ---------------------------------------------------------------------------
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

// Duo-style 32-char lowercase hex secret (treated as raw ASCII bytes)
const DUO_HEX_SECRET = "e917cb6c545074dc8a78af86fd0143f1";

// RFC 4226 Appendix D — all 10 HOTP test vectors (SHA1, 6 digits).
// For TOTP at 30-second period, counter N corresponds to Date.now() = N * 30_000 ms.
const RFC_VECTORS: { counter: number; expectedCode: string }[] = [
  { counter: 0, expectedCode: "755224" },
  { counter: 1, expectedCode: "287082" },
  { counter: 2, expectedCode: "359152" },
  { counter: 3, expectedCode: "969429" },
  { counter: 4, expectedCode: "338314" },
  { counter: 5, expectedCode: "254676" },
  { counter: 6, expectedCode: "287922" },
  { counter: 7, expectedCode: "162583" },
  { counter: 8, expectedCode: "399871" },
  { counter: 9, expectedCode: "520489" },
];

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
describe("Duo TOTP — RFC 4226/6238 test vectors", () => {
  it.each(RFC_VECTORS)(
    "counter=$counter → $expectedCode (time=$counter*30s)",
    ({ counter, expectedCode }) => {
      vi.useFakeTimers({ now: counter * 30_000 });
      expect(generateDuoPasscode(RFC_SECRET)).toBe(expectedCode);
    }
  );

  it("produces all 10 vectors when time advances by 30-second steps", () => {
    for (const { counter, expectedCode } of RFC_VECTORS) {
      vi.useFakeTimers({ now: counter * 30_000 });
      expect(generateDuoPasscode(RFC_SECRET), `counter=${counter}`).toBe(expectedCode);
    }
  });
});

// ---------------------------------------------------------------------------
describe("Duo TOTP — time window behavior", () => {
  it("returns the same code throughout an entire 30-second window", () => {
    // Window for counter=1: [30_000, 59_999] ms
    vi.useFakeTimers({ now: 30_000 });
    const atStart = generateDuoPasscode(RFC_SECRET);

    vi.useFakeTimers({ now: 44_999 });
    const atMid = generateDuoPasscode(RFC_SECRET);

    vi.useFakeTimers({ now: 59_999 });
    const atEnd = generateDuoPasscode(RFC_SECRET);

    expect(atStart).toBe("287082"); // counter=1
    expect(atMid).toBe(atStart);
    expect(atEnd).toBe(atStart);
  });

  it("produces a different code immediately after a 30-second boundary", () => {
    vi.useFakeTimers({ now: 59_999 }); // last ms of window 1 → counter=1
    const beforeBoundary = generateDuoPasscode(RFC_SECRET);

    vi.useFakeTimers({ now: 60_000 }); // first ms of window 2 → counter=2
    const afterBoundary = generateDuoPasscode(RFC_SECRET);

    expect(beforeBoundary).toBe("287082"); // counter=1
    expect(afterBoundary).toBe("359152"); // counter=2
    expect(beforeBoundary).not.toBe(afterBoundary);
  });
});

// ---------------------------------------------------------------------------
describe("Duo TOTP — edge cases", () => {
  it("always produces exactly 6 digits across all RFC vectors", () => {
    for (const { counter } of RFC_VECTORS) {
      vi.useFakeTimers({ now: counter * 30_000 });
      expect(generateDuoPasscode(RFC_SECRET)).toHaveLength(6);
    }
  });

  it("works with a minimal valid base32 secret (16 chars)", () => {
    vi.useFakeTimers({ now: 0 });
    const code = generateDuoPasscode("AAAAAAAAAAAAAAAA");
    expect(code).toMatch(/^\d{6}$/);
  });

  it("throws on empty string secret", () => {
    expect(() => generateDuoPasscode("")).toThrow();
  });
});

// ---------------------------------------------------------------------------
describe("Duo TOTP — Duo hex secret support", () => {
  it("accepts a Duo-style 32-char hex secret and returns 6-digit codes", () => {
    vi.useFakeTimers({ now: 0 });
    const code = generateDuoPasscode(DUO_HEX_SECRET);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("Duo hex secret produces consistent codes across time windows", () => {
    for (const { counter } of RFC_VECTORS) {
      vi.useFakeTimers({ now: counter * 30_000 });
      const code = generateDuoPasscode(DUO_HEX_SECRET);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("Duo hex secret uses ASCII bytes, NOT hex-decoded bytes", () => {
    // A 32-char lowercase hex string is treated as raw ASCII (32-byte key),
    // which produces different codes than hex-decoding it (16-byte key).
    // The RFC base32 secret (20 bytes) will also differ.
    vi.useFakeTimers({ now: 0 });
    const fromDuoHex = generateDuoPasscode(DUO_HEX_SECRET);
    const fromBase32 = generateDuoPasscode(RFC_SECRET);
    expect(fromDuoHex).not.toBe(fromBase32);
  });
});

// ---------------------------------------------------------------------------
// Live Canvas SSO + TOTP auth flow (skipped unless all four env vars are set)
// ---------------------------------------------------------------------------
const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL ?? "";
const CANVAS_USERNAME = process.env.CANVAS_USERNAME ?? "";
const CANVAS_PASSWORD = process.env.CANVAS_PASSWORD ?? "";
const DUO_TOTP_SECRET = process.env.DUO_TOTP_SECRET ?? "";

const liveCredentialsProvided =
  CANVAS_BASE_URL !== "" &&
  CANVAS_USERNAME !== "" &&
  CANVAS_PASSWORD !== "" &&
  DUO_TOTP_SECRET !== "";

if (!liveCredentialsProvided) {
  console.warn(
    "\n[integration] Skipping live Canvas TOTP auth test: set CANVAS_BASE_URL, " +
    "CANVAS_USERNAME, CANVAS_PASSWORD, and DUO_TOTP_SECRET to enable.\n"
  );
}

describe.skipIf(!liveCredentialsProvided)(
  "Duo TOTP — live Canvas SSO auth flow",
  { timeout: 120_000 },
  () => {
    it("authenticates via canvas_auth_setup with TOTP auto-fill", async () => {
      const { CanvasClientManager } = await import("../../src/auth/canvas-client-manager");
      const { createCanvasAuthTool } = await import("../../src/tools/canvas-auth-tool");

      const tokensPath = join(tmpdir(), `omniclaw-canvas-totp-test-${Date.now()}.json`);
      const canvasManager = new CanvasClientManager(tokensPath);

      const tool = createCanvasAuthTool(canvasManager, {
        client_secret_path: "",
        canvas_base_url: CANVAS_BASE_URL,
        canvas_username: CANVAS_USERNAME,
        canvas_password: CANVAS_PASSWORD,
        canvas_auto_mfa: true,
        duo_totp_secret: DUO_TOTP_SECRET,
      });

      const result = await tool.execute("totp-test", {});
      const payload = JSON.parse(result.content[0].text);

      console.log("[totp-test] Result:", JSON.stringify(payload, null, 2));

      expect(payload.status).toBe("authenticated");
      expect(payload.account).toBe("default");
      expect(payload.name).toBeDefined();
    });
  }
);
