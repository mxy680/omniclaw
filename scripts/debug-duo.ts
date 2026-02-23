/**
 * Debug script: replicate the exact canvas-auth-tool flow end-to-end.
 */
import { chromium } from "playwright";
import { generateDuoPasscode } from "../src/auth/duo-totp";

const BASE_URL = "https://canvas.case.edu";
const USERNAME = "mis60";
const PASSWORD = "Masik19730424$Markusha4#";
const DUO_SECRET = "5d1d2670c0ba2b565c5f14d7f5b785d2";

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Navigate to Canvas
    console.log("[1] Navigating to Canvas...");
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    console.log(`    URL: ${page.url()}`);

    // Step 2: Fill SSO credentials
    console.log("[2] Filling SSO credentials...");
    await page.waitForSelector('input[name="username"], input#username', { timeout: 15000 });
    await page.fill('input[name="username"], input#username', USERNAME);
    await page.fill('input[name="password"], input#password', PASSWORD);
    console.log("    Filled username and password.");

    const submit = page.locator(
      'button[type="submit"], input[type="submit"], ' +
      'button[name="submit"], input[name="submit"], ' +
      'button:has-text("Login"), button:has-text("Log In"), ' +
      'button:has-text("Sign In"), a:has-text("Login"), ' +
      'input[value="Login"], input[value="LOG IN"], ' +
      '.btn-submit, #submit, .login-btn'
    );
    await submit.first().click();
    console.log("    Submitted credentials.");

    // Step 3: Wait for Duo redirect using waitForURL
    console.log("[3] Waiting for Duo redirect (waitForURL)...");
    let isUniversalPrompt = false;
    try {
      await page.waitForURL(/duosecurity\.com|duo\.com/, { timeout: 20000 });
      isUniversalPrompt = true;
      console.log(`    Duo detected! URL: ${page.url()}`);
      await page.waitForLoadState("domcontentloaded");
      console.log("    Page loaded.");
    } catch (e) {
      console.log(`    waitForURL failed: ${e instanceof Error ? e.message : e}`);
      console.log(`    Current URL: ${page.url()}`);
    }

    if (!isUniversalPrompt) {
      console.log("[!] Duo Universal Prompt not detected. Taking screenshot...");
      await page.screenshot({ path: "/tmp/debug-duo-no-redirect.png", fullPage: true });
      console.log("    Screenshot saved to /tmp/debug-duo-no-redirect.png");
      await browser.close();
      return;
    }

    // Step 4: Click "Other options"
    console.log("[4] Looking for 'Other options'...");
    const otherOptions = page.locator(
      'a:has-text("Other options"), button:has-text("Other options")'
    );
    try {
      await otherOptions.first().waitFor({ state: "visible", timeout: 10000 });
      await otherOptions.first().click();
      console.log("    Clicked 'Other options'.");
    } catch (e) {
      console.log(`    'Other options' not found: ${e instanceof Error ? e.message : e}`);
      await page.screenshot({ path: "/tmp/debug-duo-no-other-options.png", fullPage: true });
      console.log("    Screenshot saved to /tmp/debug-duo-no-other-options.png");
    }

    // Step 5: Click "Duo Mobile passcode"
    console.log("[5] Looking for 'Duo Mobile passcode'...");
    const passcodeOption = page.locator(
      'a:has-text("Duo Mobile passcode"), ' +
      'a:has-text("Enter a Passcode"), ' +
      'a:has-text("Passcode"), ' +
      'button:has-text("Duo Mobile passcode"), ' +
      'button:has-text("Enter a Passcode"), ' +
      'button:has-text("Passcode")'
    );
    try {
      await passcodeOption.first().waitFor({ state: "visible", timeout: 5000 });
      await passcodeOption.first().click();
      console.log("    Selected passcode option.");
    } catch (e) {
      console.log(`    Passcode option not found: ${e instanceof Error ? e.message : e}`);
      await page.screenshot({ path: "/tmp/debug-duo-no-passcode-option.png", fullPage: true });
      console.log("    Screenshot saved to /tmp/debug-duo-no-passcode-option.png");
    }

    // Step 6: Fill passcode
    console.log("[6] Filling TOTP passcode...");
    const passcodeInput = page.locator(
      'input[name="passcode-input"], ' +
      'input[name="passcode"], ' +
      'input.passcode-input'
    );
    try {
      await passcodeInput.first().waitFor({ state: "visible", timeout: 5000 });
      const code = generateDuoPasscode(DUO_SECRET);
      await passcodeInput.first().fill(code);
      console.log(`    Filled code: ${code}`);
    } catch (e) {
      console.log(`    Passcode input not found: ${e instanceof Error ? e.message : e}`);
      await page.screenshot({ path: "/tmp/debug-duo-no-input.png", fullPage: true });
      console.log("    Screenshot saved to /tmp/debug-duo-no-input.png");
    }

    // Step 7: Click Verify
    console.log("[7] Clicking Verify...");
    const verifyBtn = page.locator(
      'button:has-text("Verify"), button:has-text("Submit"), ' +
      'button:has-text("Log In"), button[type="submit"], ' +
      'input[type="submit"]'
    );
    await verifyBtn.first().click();
    console.log("    Clicked Verify.");

    // Step 8: Wait for result
    console.log("[8] Waiting for Duo verification...");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/tmp/debug-duo-after-verify.png", fullPage: true });
    console.log(`    URL after verify: ${page.url()}`);
    console.log("    Screenshot saved to /tmp/debug-duo-after-verify.png");

    // Step 9: Poll for Canvas redirect
    console.log("[9] Polling for Canvas session...");
    let loggedIn = false;
    for (let i = 0; i < 60; i++) {
      const url = page.url();
      const cookies = await context.cookies();

      // Auto-click trust device
      try {
        const trustBtn = page.locator(
          'button:has-text("Yes, this is my device"), ' +
          'button:has-text("Trust"), ' +
          'button#trust-browser-button'
        );
        if (await trustBtn.first().isVisible({ timeout: 500 })) {
          await trustBtn.first().click();
          console.log("    Clicked 'Yes, this is my device'");
        }
      } catch { /* not visible */ }

      if (cookies.some(c => c.name === "canvas_session") && url.includes("canvas.case.edu")) {
        console.log(`\n=== SUCCESS! URL: ${url} ===`);
        loggedIn = true;
        break;
      }

      if (i % 10 === 0 && i > 0) {
        console.log(`    Still waiting... (${i}s, URL: ${url.slice(0, 80)})`);
      }
      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      console.log("\n=== TIMED OUT ===");
      await page.screenshot({ path: "/tmp/debug-duo-timeout.png", fullPage: true });
      console.log("    Screenshot saved to /tmp/debug-duo-timeout.png");
    }

  } catch (e) {
    console.error(`\n=== ERROR: ${e instanceof Error ? e.message : e} ===`);
    try {
      await page.screenshot({ path: "/tmp/debug-duo-error.png", fullPage: true });
      console.log("Screenshot saved to /tmp/debug-duo-error.png");
    } catch { /* page might be closed */ }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
