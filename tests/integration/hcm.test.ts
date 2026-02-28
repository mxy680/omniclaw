import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { mkdirSync } from "fs";
import { HcmClientManager } from "../../src/auth/hcm-client-manager.js";
import { createHcmAuthTool } from "../../src/tools/hcm-auth-tool.js";
import {
  createHcmGetTimesheetTool,
  createHcmEnterHoursTool,
  createHcmSubmitTimesheetTool,
} from "../../src/tools/hcm-timesheet.js";
import {
  createHcmGetPaystubsTool,
  createHcmGetPaystubDetailsTool,
} from "../../src/tools/hcm-paystubs.js";
import type { PluginConfig } from "../../src/types/plugin-config.js";

const HCM_CASE_ID = process.env.HCM_CASE_ID;
const HCM_PASSWORD = process.env.HCM_PASSWORD;
const DUO_TOTP_SECRET = process.env.DUO_TOTP_SECRET;
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

const skip = !HCM_CASE_ID;

describe.skipIf(skip)("HCM Integration Tests", () => {
  let manager: HcmClientManager;
  let config: PluginConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authTool: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getTimesheetTool: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let enterHoursTool: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let submitTimesheetTool: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getPaystubsTool: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getPaystubDetailsTool: any;

  beforeAll(() => {
    const dir = join(tmpdir(), "hcm-integration-test-" + Date.now());
    mkdirSync(dir, { recursive: true });
    const tokensPath = join(dir, "tokens.json");
    manager = new HcmClientManager(tokensPath);

    config = {
      client_secret_path: "",
      hcm_case_id: HCM_CASE_ID,
      hcm_password: HCM_PASSWORD,
      duo_totp_secret: DUO_TOTP_SECRET,
    } as PluginConfig;

    authTool = createHcmAuthTool(manager, config);
    getTimesheetTool = createHcmGetTimesheetTool(manager);
    enterHoursTool = createHcmEnterHoursTool(manager);
    submitTimesheetTool = createHcmSubmitTimesheetTool(manager);
    getPaystubsTool = createHcmGetPaystubsTool(manager);
    getPaystubDetailsTool = createHcmGetPaystubDetailsTool(manager);
  });

  it("authenticates via CWRU SSO", async () => {
    const result = await authTool.execute("test", {});
    const data = result.details;
    expect(data.status).toMatch(/authenticated|already_authenticated/);
    expect(data.employee_name).toBeDefined();
    console.log("Auth result:", JSON.stringify(data, null, 2));
  }, 120_000);

  it("gets timesheet", async () => {
    const result = await getTimesheetTool.execute("test", {});
    const data = result.details;
    expect(data.error).toBeUndefined();
    console.log("Timesheet:", JSON.stringify(data, null, 2));
  }, 60_000);

  it("gets paystubs", async () => {
    const result = await getPaystubsTool.execute("test", {});
    const data = result.details;
    expect(data.error).toBeUndefined();
    expect(data.paystubs).toBeDefined();
    console.log("Paystubs:", JSON.stringify(data, null, 2));
  }, 60_000);

  it("gets paystub details", async () => {
    const result = await getPaystubDetailsTool.execute("test", { index: 0 });
    const data = result.details;
    expect(data.error).toBeUndefined();
    console.log("Paystub details:", JSON.stringify(data, null, 2));
  }, 60_000);

  describe.skipIf(!RUN_WRITE_TESTS)("Write Tests", () => {
    it("enters hours", async () => {
      const result = await enterHoursTool.execute("test", {
        hours: { monday: 4 },
      });
      const data = result.details;
      expect(data.status).toBe("saved");
      console.log("Enter hours:", JSON.stringify(data, null, 2));
    }, 60_000);
  });
});
