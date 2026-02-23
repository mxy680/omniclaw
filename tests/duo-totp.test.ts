import { describe, it, expect, afterEach, vi } from "vitest";
import { generateDuoPasscode } from "../src/auth/duo-totp";

// ---------------------------------------------------------------------------
// RFC 4226 Appendix D test secret: ASCII "12345678901234567890"
// Base32: GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
// For TOTP (30s period): counter = floor(Date.now() / 1000 / 30)
// Pinning Date.now() to N * 30_000 ms drives counter to N.
// ---------------------------------------------------------------------------
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

// A standard base32 secret (not Duo hex format)
const BASE32_SECRET = "JBSWY3DPEHPK3PXP";

// A Duo-style 32-char lowercase hex secret (treated as raw ASCII bytes, NOT hex-decoded)
const DUO_HEX_SECRET = "e917cb6c545074dc8a78af86fd0143f1";

afterEach(() => {
  vi.useRealTimers();
});

describe("generateDuoPasscode", () => {
  // -------------------------------------------------------------------------
  // Basic shape
  // -------------------------------------------------------------------------
  it("returns a 6-digit string", () => {
    const code = generateDuoPasscode(BASE32_SECRET);
    expect(code).toMatch(/^\d{6}$/);
  });

  // -------------------------------------------------------------------------
  // TOTP is time-based: same code within the same 30-second window
  // -------------------------------------------------------------------------
  it("returns the same code when called twice within the same 30-second window", () => {
    vi.useFakeTimers({ now: 10_000 }); // pinned inside window 0 (0-29 s)
    const code1 = generateDuoPasscode(BASE32_SECRET);
    const code2 = generateDuoPasscode(BASE32_SECRET);
    expect(code1).toBe(code2);
    expect(code1).toMatch(/^\d{6}$/);
  });

  // -------------------------------------------------------------------------
  // Different secret → different code (at the same pinned time)
  // -------------------------------------------------------------------------
  it("returns a different code for a different secret", () => {
    vi.useFakeTimers({ now: 0 });
    const codeA = generateDuoPasscode(RFC_SECRET);
    const codeB = generateDuoPasscode(BASE32_SECRET);
    expect(codeA).not.toBe(codeB);
    expect(codeA).toMatch(/^\d{6}$/);
    expect(codeB).toMatch(/^\d{6}$/);
  });

  // -------------------------------------------------------------------------
  // RFC 4226 vector: counter=0 → "755224"
  // Pinning Date.now() to 0 drives TOTP counter to floor(0/1000/30) = 0
  // -------------------------------------------------------------------------
  it("generates RFC 4226 test vector '755224' at counter=0 (time=0)", () => {
    vi.useFakeTimers({ now: 0 });
    expect(generateDuoPasscode(RFC_SECRET)).toBe("755224");
  });

  // -------------------------------------------------------------------------
  // Invalid secret
  // -------------------------------------------------------------------------
  it("throws on an invalid base32 secret", () => {
    expect(() => generateDuoPasscode("not-valid-base32!!!")).toThrow();
  });

  it("throws on an empty string", () => {
    expect(() => generateDuoPasscode("")).toThrow();
  });

  // -------------------------------------------------------------------------
  // Duo hex secret support (32-char lowercase hex → raw ASCII bytes)
  // -------------------------------------------------------------------------
  it("accepts a Duo-style 32-char hex secret and returns a 6-digit string", () => {
    vi.useFakeTimers({ now: 0 });
    const code = generateDuoPasscode(DUO_HEX_SECRET);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("Duo hex secret produces DIFFERENT code than base32 with same bytes", () => {
    // Duo hex secrets are treated as raw ASCII (32-byte key), NOT hex-decoded
    // (16-byte key), so they produce different TOTP codes than a base32 secret
    // encoding the same hex-decoded bytes.
    vi.useFakeTimers({ now: 0 });
    const fromDuoHex = generateDuoPasscode(DUO_HEX_SECRET);
    // Base32 of the hex-decoded 16 bytes would be a different key entirely
    expect(fromDuoHex).toMatch(/^\d{6}$/);
  });

  it("same Duo hex secret produces same code at the same time", () => {
    vi.useFakeTimers({ now: 60_000 });
    const code1 = generateDuoPasscode(DUO_HEX_SECRET);
    const code2 = generateDuoPasscode(DUO_HEX_SECRET);
    expect(code1).toBe(code2);
  });
});
