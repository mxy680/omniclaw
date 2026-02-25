import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Serialize test files to prevent concurrent Duo MFA flows from
    // being rejected (canvas.test.ts and duo-totp.test.ts both auth
    // against the same Duo account).
    fileParallelism: false,
  },
});
