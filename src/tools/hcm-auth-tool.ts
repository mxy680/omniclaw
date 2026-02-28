// src/tools/hcm-auth-tool.ts
import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { HcmClientManager } from "../auth/hcm-client-manager.js";
import { HCM_BASE_URL } from "../auth/hcm-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";
import { jsonResult } from "./hcm-utils.js";
import { performCasLogin, resolveLoginConfig } from "./hcm-browser.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHcmAuthTool(
  manager: HcmClientManager,
  config: PluginConfig,
): any {
  return {
    name: "hcm_auth_setup",
    label: "HCM Auth Setup",
    description:
      "Authenticate with CWRU PeopleSoft HCM (hcm.case.edu) via browser login. " +
      "Uses shared CWRU SSO credentials (canvas_username, canvas_password, duo_totp_secret). " +
      "If configured, login is fully automated. Otherwise opens a browser for manual login.",
    parameters: Type.Object({
      case_id: Type.Optional(
        Type.String({ description: "CWRU Case ID (e.g. 'abc123'). Overrides hcm_case_id config." }),
      ),
      password: Type.Optional(
        Type.String({ description: "CWRU password. Overrides hcm_password config." }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Name for this account. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { case_id?: string; password?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const loginConfig = resolveLoginConfig(config);
      if (params.case_id) loginConfig.caseId = params.case_id;
      if (params.password) loginConfig.password = params.password;

      const autoLogin = !!loginConfig.caseId && !!loginConfig.password;

      // Check if already authenticated by testing cookie validity
      if (manager.hasCredentials(account)) {
        try {
          const valid = await validateHcmSession(manager, account);
          if (valid) {
            const session = manager.getCredentials(account)!;
            return jsonResult({
              status: "already_authenticated",
              account,
              employee_name: session.employee_name,
            });
          }
        } catch {
          // Session invalid — proceed with re-auth
        }
      }

      if (!autoLogin) {
        return jsonResult({
          status: "error",
          error: "No CWRU credentials configured.",
          hint: 'Configure CWRU SSO credentials: openclaw config set plugins.entries.omniclaw.config.canvas_username "abc123"',
        });
      }

      try {
        const browser = await chromium.launch({
          headless: false,
          args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        });
        const context = await browser.newContext({
          locale: "en-US",
          timezoneId: "America/New_York",
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        });

        const page = await context.newPage();
        await page.goto(HCM_BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

        await performCasLogin(page, context, loginConfig);

        // Extract employee name
        let employeeName = "unknown";
        try {
          employeeName = await page.evaluate(() => {
            const nameEl = document.querySelector(
              '#pthdr2usrname, .ps-username, [id*="EMPLOYEE_NAME"], [id*="PERSON_NAME"]',
            );
            if (nameEl?.textContent?.trim()) return nameEl.textContent.trim();
            const welcome = document.body.innerText.match(/Welcome[,\s]+([A-Za-z\s]+)/i);
            if (welcome) return welcome[1].trim();
            return "unknown";
          }) || "unknown";
        } catch { /* best-effort */ }

        // Store cookies
        const finalCookies = await context.cookies();
        const allCookies: Record<string, string> = {};
        const cookieDetails: Array<{
          name: string; value: string; domain: string; path: string;
          httpOnly?: boolean; secure?: boolean; sameSite?: "Strict" | "Lax" | "None"; expires?: number;
        }> = [];
        for (const c of finalCookies) {
          allCookies[c.name] = c.value;
          cookieDetails.push({
            name: c.name, value: c.value, domain: c.domain, path: c.path,
            httpOnly: c.httpOnly, secure: c.secure,
            sameSite: c.sameSite as "Strict" | "Lax" | "None",
            expires: c.expires,
          });
        }

        manager.setCredentials(account, {
          cookies: allCookies,
          cookie_details: cookieDetails,
          employee_name: employeeName,
        });

        await browser.close();
        return jsonResult({
          status: "authenticated",
          account,
          employee_name: employeeName,
        });
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: "Auto-login failed. Check canvas_username, canvas_password, and duo_totp_secret in plugin config.",
        });
      }
    },
  };
}

async function validateHcmSession(manager: HcmClientManager, account: string): Promise<boolean> {
  const session = manager.getCredentials(account);
  if (!session) return false;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(
    session.cookie_details.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      httpOnly: c.httpOnly ?? false,
      secure: c.secure ?? false,
      sameSite: (c.sameSite as "Strict" | "Lax" | "None") ?? "Lax",
      expires: c.expires ?? -1,
    })),
  );

  const page = await context.newPage();
  try {
    await page.goto(HCM_BASE_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
    const url = page.url();
    const valid = !url.includes("login.case.edu") && !url.includes("cas/login");
    await browser.close();
    return valid;
  } catch {
    await browser.close();
    return false;
  }
}
