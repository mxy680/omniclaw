// src/tools/hcm-paystubs.ts
import { Type } from "@sinclair/typebox";
import type { HcmClientManager } from "../auth/hcm-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";
import { launchHcmBrowser, dumpPageInfo, resolveLoginConfig } from "./hcm-browser.js";
import { jsonResult, AUTH_REQUIRED } from "./hcm-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHcmGetPaystubsTool(manager: HcmClientManager, config: PluginConfig): any {
  return {
    name: "hcm_get_paystubs",
    label: "HCM Get Paystubs",
    description:
      "View recent pay stubs from CWRU PeopleSoft HCM. " +
      "Returns date, gross pay, net pay, and deduction summary for each stub.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { account?: string },
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
        const page = hcm.page;

        // Dump page info to see actual PeopleSoft DOM
        await dumpPageInfo(page);

        // Try to find payroll/pay-related navigation
        const clickedPayroll = await page.evaluate(() => {
          const candidates = Array.from(document.querySelectorAll("a, button, div[role='button'], [onclick]"));
          const el = candidates.find(
            (c) => /Payroll|Pay\s*Stub|Paycheck|View\s*Pay/i.test(c.textContent?.trim() || ""),
          ) as HTMLElement | undefined;
          if (el) { el.click(); return el.textContent?.trim().slice(0, 80); }
          return null;
        });
        if (clickedPayroll) {
          console.log(`[hcm] Clicked payroll element: "${clickedPayroll}"`);
          await page.waitForTimeout(3000);
        } else {
          console.log("[hcm] No payroll element found on landing page.");
        }

        const paystubs = await page.evaluate(() => {
          const stubs: Array<{
            index: number;
            date: string;
            gross_pay: string;
            net_pay: string;
            description: string;
          }> = [];

          const rows = document.querySelectorAll(
            'tr[id*="PAY"], tr[id*="CHECK"], .ps-grid-row, table tr',
          );

          rows.forEach((row, idx) => {
            const cells = row.querySelectorAll("td, span");
            const texts = Array.from(cells).map((c) => c.textContent?.trim() ?? "");
            const dateMatch = texts.find((t) => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t));
            const amountMatch = texts.filter((t) => /\$[\d,.]+/.test(t));

            if (dateMatch || amountMatch.length > 0) {
              stubs.push({
                index: idx,
                date: dateMatch ?? "",
                gross_pay: amountMatch[0] ?? "",
                net_pay: amountMatch[1] ?? amountMatch[0] ?? "",
                description: texts.join(" | ").slice(0, 200),
              });
            }
          });

          return stubs;
        });

        await hcm.browser.close();
        return jsonResult({ count: paystubs.length, paystubs });
      } catch (err) {
        await hcm.browser.close();
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHcmGetPaystubDetailsTool(manager: HcmClientManager, config: PluginConfig): any {
  return {
    name: "hcm_get_paystub_details",
    label: "HCM Get Paystub Details",
    description:
      "View full details of a specific pay stub from CWRU PeopleSoft HCM. " +
      "Includes earnings breakdown, deductions, taxes, and net pay.",
    parameters: Type.Object({
      index: Type.Number({
        description: "Index of the pay stub to view (from hcm_get_paystubs results, 0-based).",
      }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { index: number; account?: string },
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
        const page = hcm.page;

        // Try to navigate to payroll page
        const clickedPayroll = await page.evaluate(() => {
          const candidates = Array.from(document.querySelectorAll("a, button, div[role='button'], [onclick]"));
          const el = candidates.find(
            (c) => /Payroll|Pay\s*Stub|Paycheck|View\s*Pay/i.test(c.textContent?.trim() || ""),
          ) as HTMLElement | undefined;
          if (el) { el.click(); return true; }
          return false;
        });
        if (clickedPayroll) {
          await page.waitForTimeout(3000);
        }

        const rows = page.locator(
          'tr[id*="PAY"], tr[id*="CHECK"], .ps-grid-row, table tr',
        );
        const row = rows.nth(params.index);
        try {
          const link = row.locator("a").first();
          await link.click();
          await page.waitForTimeout(3000);
        } catch {
          await row.click();
          await page.waitForTimeout(3000);
        }

        const details = await page.evaluate(() => {
          const result: {
            pay_date: string;
            period: string;
            earnings: Array<{ description: string; rate: string; hours: string; amount: string }>;
            deductions: Array<{ description: string; amount: string }>;
            taxes: Array<{ description: string; amount: string }>;
            gross_pay: string;
            net_pay: string;
            raw_text: string;
          } = {
            pay_date: "",
            period: "",
            earnings: [],
            deductions: [],
            taxes: [],
            gross_pay: "",
            net_pay: "",
            raw_text: "",
          };

          result.raw_text = document.body.innerText.slice(0, 5000);

          const tables = document.querySelectorAll("table");
          tables.forEach((table) => {
            const header = table.querySelector("th, caption, .ps-group-title");
            const headerText = header?.textContent?.trim()?.toLowerCase() ?? "";

            const tableRows = table.querySelectorAll("tr");
            tableRows.forEach((tr) => {
              const cells = Array.from(tr.querySelectorAll("td, th")).map(
                (c) => c.textContent?.trim() ?? "",
              );

              if (headerText.includes("earning")) {
                if (cells.length >= 2) {
                  result.earnings.push({
                    description: cells[0],
                    rate: cells[1] ?? "",
                    hours: cells[2] ?? "",
                    amount: cells[cells.length - 1],
                  });
                }
              } else if (headerText.includes("deduction")) {
                if (cells.length >= 2) {
                  result.deductions.push({
                    description: cells[0],
                    amount: cells[cells.length - 1],
                  });
                }
              } else if (headerText.includes("tax")) {
                if (cells.length >= 2) {
                  result.taxes.push({
                    description: cells[0],
                    amount: cells[cells.length - 1],
                  });
                }
              }
            });
          });

          const allText = document.body.innerText;
          const grossMatch = allText.match(/Gross\s*(?:Pay|Earnings)[:\s]*\$?([\d,.]+)/i);
          if (grossMatch) result.gross_pay = grossMatch[1];
          const netMatch = allText.match(/Net\s*Pay[:\s]*\$?([\d,.]+)/i);
          if (netMatch) result.net_pay = netMatch[1];
          const dateMatch = allText.match(/Pay\s*Date[:\s]*([\d/]+)/i);
          if (dateMatch) result.pay_date = dateMatch[1];
          const periodMatch = allText.match(/Period[:\s]*([\d/]+\s*[-–]\s*[\d/]+)/i);
          if (periodMatch) result.period = periodMatch[1];

          return result;
        });

        await hcm.browser.close();

        if (details.earnings.length > 0 || details.deductions.length > 0) {
          delete (details as Record<string, unknown>).raw_text;
        }

        return jsonResult(details);
      } catch (err) {
        await hcm.browser.close();
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
