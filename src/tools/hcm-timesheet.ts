// src/tools/hcm-timesheet.ts
import { Type } from "@sinclair/typebox";
import type { HcmClientManager } from "../auth/hcm-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";
import { launchHcmBrowser, navigateToTimeTile, resolveLoginConfig } from "./hcm-browser.js";
import { jsonResult, AUTH_REQUIRED } from "./hcm-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHcmGetTimesheetTool(manager: HcmClientManager, config: PluginConfig): any {
  return {
    name: "hcm_get_timesheet",
    label: "HCM Get Timesheet",
    description:
      "View the current or past timesheet from CWRU PeopleSoft HCM. " +
      "Returns hours entered per day and submission status.",
    parameters: Type.Object({
      period: Type.Optional(
        Type.String({
          description: "Pay period date (e.g. '2026-02-24'). Defaults to current period.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { period?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const loginConfig = resolveLoginConfig(config);
      const canLogin = manager.hasCredentials(account) || (!!loginConfig.caseId && !!loginConfig.password);

      if (!canLogin) {
        return jsonResult(AUTH_REQUIRED);
      }

      let hcm;
      try {
        hcm = await launchHcmBrowser(manager, account, loginConfig);
      } catch (err) {
        if (err instanceof Error && err.message.includes("session expired")) {
          return jsonResult(AUTH_REQUIRED);
        }
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }

      try {
        await navigateToTimeTile(hcm.page);

        if (params.period) {
          const periodSelector = hcm.page.locator(
            'select[id*="PERIOD"], input[id*="DATE"], [id*="PAY_PERIOD"]',
          );
          try {
            await periodSelector.first().waitFor({ state: "visible", timeout: 5000 });
            await periodSelector.first().fill(params.period);
            await hcm.page.keyboard.press("Enter");
            await hcm.page.waitForTimeout(2000);
          } catch {
            console.log("[hcm] Could not find period selector — using current period.");
          }
        }

        const timesheetData = await hcm.page.evaluate(() => {
          const result: {
            period: string;
            status: string;
            days: Array<{ date: string; day: string; hours: number }>;
            total_hours: number;
          } = {
            period: "",
            status: "unknown",
            days: [],
            total_hours: 0,
          };

          const periodEl = document.querySelector(
            '[id*="PERIOD"], [id*="PAY_BEGIN"], .ps-text:has-text("Period")',
          );
          if (periodEl?.textContent) result.period = periodEl.textContent.trim();

          const statusEl = document.querySelector(
            '[id*="STATUS"], [id*="APPR"], .ps-text:has-text("Status")',
          );
          if (statusEl?.textContent) result.status = statusEl.textContent.trim();

          const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const inputs = document.querySelectorAll(
            'input[id*="QUANTITY"], input[id*="HOURS"], input[id*="TRC"], ' +
            'td[id*="QUANTITY"], td[id*="HOURS"], span[id*="QUANTITY"]',
          );

          inputs.forEach((input, idx) => {
            const value = (input as HTMLInputElement).value ?? input.textContent?.trim() ?? "0";
            const hours = parseFloat(value) || 0;
            result.days.push({
              date: "",
              day: dayNames[idx % 7] ?? `Day ${idx + 1}`,
              hours,
            });
            result.total_hours += hours;
          });

          return result;
        });

        await hcm.browser.close();
        return jsonResult(timesheetData);
      } catch (err) {
        await hcm.browser.close();
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHcmEnterHoursTool(manager: HcmClientManager, config: PluginConfig): any {
  return {
    name: "hcm_enter_hours",
    label: "HCM Enter Hours",
    description:
      "Enter hours into the CWRU PeopleSoft timesheet for specific days. " +
      "This saves the timesheet but does NOT submit it — use hcm_submit_timesheet to submit.",
    parameters: Type.Object({
      hours: Type.Object(
        {
          sunday: Type.Optional(Type.Number({ description: "Hours for Sunday" })),
          monday: Type.Optional(Type.Number({ description: "Hours for Monday" })),
          tuesday: Type.Optional(Type.Number({ description: "Hours for Tuesday" })),
          wednesday: Type.Optional(Type.Number({ description: "Hours for Wednesday" })),
          thursday: Type.Optional(Type.Number({ description: "Hours for Thursday" })),
          friday: Type.Optional(Type.Number({ description: "Hours for Friday" })),
          saturday: Type.Optional(Type.Number({ description: "Hours for Saturday" })),
        },
        { description: "Hours to enter for each day of the week" },
      ),
      period: Type.Optional(
        Type.String({ description: "Pay period date. Defaults to current period." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        hours: {
          sunday?: number; monday?: number; tuesday?: number; wednesday?: number;
          thursday?: number; friday?: number; saturday?: number;
        };
        period?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      const loginConfig = resolveLoginConfig(config);
      const canLogin = manager.hasCredentials(account) || (!!loginConfig.caseId && !!loginConfig.password);

      if (!canLogin) {
        return jsonResult(AUTH_REQUIRED);
      }

      let hcm;
      try {
        hcm = await launchHcmBrowser(manager, account, loginConfig);
      } catch (err) {
        if (err instanceof Error && err.message.includes("session expired")) {
          return jsonResult(AUTH_REQUIRED);
        }
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }

      try {
        await navigateToTimeTile(hcm.page);

        if (params.period) {
          const periodSelector = hcm.page.locator(
            'select[id*="PERIOD"], input[id*="DATE"], [id*="PAY_PERIOD"]',
          );
          try {
            await periodSelector.first().waitFor({ state: "visible", timeout: 5000 });
            await periodSelector.first().fill(params.period);
            await hcm.page.keyboard.press("Enter");
            await hcm.page.waitForTimeout(2000);
          } catch {
            console.log("[hcm] Could not find period selector — using current period.");
          }
        }

        const status = await hcm.page.evaluate(() => {
          const statusEl = document.querySelector('[id*="STATUS"], [id*="APPR"]');
          return statusEl?.textContent?.trim() ?? "";
        });

        if (status.toLowerCase().includes("submitted") || status.toLowerCase().includes("approved")) {
          await hcm.browser.close();
          return jsonResult({
            error: "timesheet_already_submitted",
            status,
            message: "Cannot modify a submitted/approved timesheet.",
          });
        }

        const dayOrder = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
        const filledDays: Array<{ day: string; hours: number }> = [];

        const hourInputs = hcm.page.locator(
          'input[id*="QUANTITY"], input[id*="HOURS"], input[id*="TRC_QUANTITY"]',
        );
        const inputCount = await hourInputs.count();
        console.log(`[hcm] Found ${inputCount} hour input fields.`);

        for (let i = 0; i < Math.min(inputCount, 7); i++) {
          const dayName = dayOrder[i];
          const hoursValue = params.hours[dayName];

          if (hoursValue !== undefined) {
            const input = hourInputs.nth(i);
            await input.click();
            await input.fill("");
            await input.fill(String(hoursValue));
            filledDays.push({ day: dayName, hours: hoursValue });
            console.log(`[hcm] Entered ${hoursValue} hours for ${dayName}`);
          }
        }

        const saveBtn = hcm.page.locator(
          'button:has-text("Save"), input[value="Save"], #ICSave, [id*="SAVE"]',
        );
        try {
          await saveBtn.first().waitFor({ state: "visible", timeout: 5000 });
          await saveBtn.first().click();
          console.log("[hcm] Clicked Save.");
          await hcm.page.waitForTimeout(2000);
        } catch {
          console.log("[hcm] Save button not found — hours may auto-save.");
        }

        await hcm.browser.close();
        return jsonResult({
          status: "saved",
          message: "Hours entered and saved. Call hcm_submit_timesheet to submit.",
          filled_days: filledDays,
          total_hours: filledDays.reduce((sum, d) => sum + d.hours, 0),
        });
      } catch (err) {
        await hcm.browser.close();
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHcmSubmitTimesheetTool(manager: HcmClientManager, config: PluginConfig): any {
  return {
    name: "hcm_submit_timesheet",
    label: "HCM Submit Timesheet",
    description:
      "Submit the current CWRU PeopleSoft timesheet for approval. " +
      "Use hcm_get_timesheet first to verify hours, then call this to submit.",
    parameters: Type.Object({
      period: Type.Optional(
        Type.String({ description: "Pay period date. Defaults to current period." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { period?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const loginConfig = resolveLoginConfig(config);
      const canLogin = manager.hasCredentials(account) || (!!loginConfig.caseId && !!loginConfig.password);

      if (!canLogin) {
        return jsonResult(AUTH_REQUIRED);
      }

      let hcm;
      try {
        hcm = await launchHcmBrowser(manager, account, loginConfig);
      } catch (err) {
        if (err instanceof Error && err.message.includes("session expired")) {
          return jsonResult(AUTH_REQUIRED);
        }
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }

      try {
        await navigateToTimeTile(hcm.page);

        if (params.period) {
          const periodSelector = hcm.page.locator(
            'select[id*="PERIOD"], input[id*="DATE"], [id*="PAY_PERIOD"]',
          );
          try {
            await periodSelector.first().waitFor({ state: "visible", timeout: 5000 });
            await periodSelector.first().fill(params.period);
            await hcm.page.keyboard.press("Enter");
            await hcm.page.waitForTimeout(2000);
          } catch {
            console.log("[hcm] Could not find period selector — using current period.");
          }
        }

        const submitBtn = hcm.page.locator(
          'button:has-text("Submit"), input[value="Submit"], #Submit, ' +
          '[id*="SUBMIT"], a:has-text("Submit")',
        );

        await submitBtn.first().waitFor({ state: "visible", timeout: 10000 });
        await submitBtn.first().click();
        console.log("[hcm] Clicked Submit.");

        try {
          const confirmBtn = hcm.page.locator(
            'button:has-text("Yes"), button:has-text("OK"), button:has-text("Confirm"), #ptModOK_0',
          );
          await confirmBtn.first().waitFor({ state: "visible", timeout: 5000 });
          await confirmBtn.first().click();
          console.log("[hcm] Confirmed submission.");
        } catch { /* No confirmation dialog */ }

        await hcm.page.waitForTimeout(2000);

        const resultStatus = await hcm.page.evaluate(() => {
          const statusEl = document.querySelector('[id*="STATUS"], [id*="APPR"]');
          return statusEl?.textContent?.trim() ?? "submitted";
        });

        await hcm.browser.close();
        return jsonResult({
          status: "submitted",
          timesheet_status: resultStatus,
          message: "Timesheet submitted for approval.",
        });
      } catch (err) {
        await hcm.browser.close();
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
