import * as OTPAuth from "otpauth";

/**
 * Parses a Duo secret into an OTPAuth.Secret.
 *
 * Duo's activation API returns the secret as a hex string, but Duo Mobile
 * uses the raw ASCII characters of that hex string as the HMAC key — NOT
 * the hex-decoded bytes. This matches the behavior of duo-hotp and other
 * open-source Duo OTP implementations.
 *
 * If the secret looks like a Duo hex secret (lowercase hex, 32 chars),
 * treat it as raw ASCII bytes. Otherwise assume base32.
 */
function parseSecret(secret: string): OTPAuth.Secret {
  if (/^[0-9a-f]+$/.test(secret) && secret.length === 32) {
    // Duo activation API secret: use the hex string as raw ASCII bytes
    return new OTPAuth.Secret({ buffer: new Uint8Array(Buffer.from(secret, "utf-8")).buffer });
  }
  return OTPAuth.Secret.fromBase32(secret);
}

/**
 * Generates a 6-digit Duo TOTP passcode.
 * Accepts the secret as a Duo hex string (from activation API) or base32.
 * Uses Duo defaults: SHA1, 6 digits, 30-second period.
 */
export function generateDuoPasscode(secret: string): string {
  if (!secret) {
    throw new Error("Duo TOTP secret must not be empty.");
  }
  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: parseSecret(secret),
  });
  return totp.generate();
}
