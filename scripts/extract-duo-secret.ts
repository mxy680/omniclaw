/**
 * Extract HOTP secret from a Duo Mobile activation code.
 * Prints the FULL API response for debugging.
 */

import { generateKeyPairSync } from "crypto";

const ACTIVATION_CODE = "STjjDKYCe3vuVj9Qfg4M";
const API_HOST = Buffer.from("YXBpLTc2ZjVmNzY2LmR1b3NlY3VyaXR5LmNvbQ", "base64").toString("utf-8");

async function main() {
  const { publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });

  const params = new URLSearchParams({
    customer_protocol: "1",
    pubkey: publicKey as string,
    pkpush: "rsa-sha512",
    jailbroken: "false",
    architecture: "arm64",
    region: "US",
    app_id: "com.duosecurity.duomobile",
    full_disk_encryption: "true",
    passcode_status: "true",
    platform: "Android",
    app_version: "3.49.0",
    app_build_number: "323001",
    version: "11",
    manufacturer: "unknown",
    language: "en",
    model: "Pixel",
    security_patch_level: "2021-02-01",
  });

  const url = `https://${API_HOST}/push/v2/activation/${ACTIVATION_CODE}`;
  console.log(`POST ${url}\n`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  console.log("=== FULL API RESPONSE ===");
  console.log(JSON.stringify(data, null, 2));
  console.log("=========================\n");

  if (data.stat === "OK" && data.response?.hotp_secret) {
    console.log(`hotp_secret: ${data.response.hotp_secret}`);
    console.log(`\nSave it with:`);
    console.log(`  openclaw config set plugins.entries.omniclaw.config.duo_totp_secret "${data.response.hotp_secret}"`);
  }
}

main();
