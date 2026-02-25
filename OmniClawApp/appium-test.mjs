import { remote } from "webdriverio";

const UDID = "00008030-0014491C0C50202E";
const BUNDLE_ID = "com.omniclaw.app";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Connecting to Appium...");

  const driver = await remote({
    hostname: "127.0.0.1",
    port: 4723,
    path: "/",
    capabilities: {
      platformName: "iOS",
      "appium:automationName": "XCUITest",
      "appium:udid": UDID,
      "appium:bundleId": BUNDLE_ID,
      "appium:noReset": true,
      "appium:xcodeOrgId": "SMJLWBZ8X6",
      "appium:xcodeSigningId": "iPhone Developer",
      "appium:showXcodeLog": false,
      "appium:wdaLaunchTimeout": 120000,
      "appium:wdaConnectionTimeout": 120000,
    },
    logLevel: "warn",
  });

  console.log("Session started!\n");

  // Poll connection state + debug log every 2s for 10s
  for (let i = 0; i < 5; i++) {
    console.log(`=== Check ${i + 1} (t=${i * 2}s) ===`);

    // Read debug log
    try {
      const dbg = await driver.$("~debugLog");
      if (await dbg.isExisting()) {
        const val = await dbg.getText();
        console.log(`Debug log: ${JSON.stringify(val)}`);
      }
    } catch (e) {
      console.log(`Debug log error: ${e.message}`);
    }

    // Read all text on screen
    const allTexts = await driver.$$("//XCUIElementTypeStaticText");
    for (const el of allTexts) {
      try {
        const label = await el.getAttribute("label");
        if (label && label !== "OmniClaw") {
          console.log(`  Text: "${label}"`);
        }
      } catch {}
    }

    if (i < 4) await sleep(2000);
  }

  console.log("\n=== Done ===");
  await driver.deleteSession();
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
