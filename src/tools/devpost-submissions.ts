import { Type } from "@sinclair/typebox";
import type { DevpostClientManager } from "../auth/devpost-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./devpost-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostRegisterHackathonTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_register_hackathon",
    label: "Devpost Register Hackathon",
    description:
      "Register for a hackathon on Devpost. Opens a browser to complete the registration. Auth required.",
    parameters: Type.Object({
      hackathon: Type.String({
        description:
          "Hackathon URL (e.g. 'https://example.devpost.com/') or slug (e.g. 'example').",
      }),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { hackathon: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const session = manager.getCredentials(account)!;

        let url: string;
        if (params.hackathon.startsWith("http")) {
          url = params.hackathon.replace(/\/$/, "");
        } else {
          url = `https://${params.hackathon}.devpost.com`;
        }

        const { chromium } = await import("playwright");
        const browser = await chromium.launch({ headless: false, channel: "chrome" });
        const context = await browser.newContext();

        const cookieObjects = session.cookie_details.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain || ".devpost.com",
          path: c.path || "/",
        }));
        if (cookieObjects.length > 0) await context.addCookies(cookieObjects);

        const page = await context.newPage();

        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
          await page.waitForTimeout(2000);

          const registerBtn = page.locator(
            'a:has-text("Register"), a:has-text("Join"), button:has-text("Register"), button:has-text("Join")',
          ).first();

          try {
            await registerBtn.click({ timeout: 5000 });
            await page.waitForTimeout(3000);

            const pageText = await page.textContent("body");
            const registered =
              pageText?.includes("registered") ||
              pageText?.includes("You're in") ||
              pageText?.includes("joined");

            return jsonResult({
              success: true,
              hackathon: url,
              message: registered
                ? "Successfully registered for the hackathon."
                : "Registration button clicked. Check the hackathon page to confirm.",
            });
          } catch {
            const pageText = await page.textContent("body");
            if (pageText?.includes("registered") || pageText?.includes("You're in")) {
              return jsonResult({
                status: "already_registered",
                hackathon: url,
                message: "You are already registered for this hackathon.",
              });
            }
            return jsonResult({
              error: "Could not find registration button. The hackathon may be closed or invite-only.",
              hackathon: url,
            });
          }
        } finally {
          await browser.close();
        }
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostCreateSubmissionTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_create_submission",
    label: "Devpost Create Submission",
    description:
      "Create a new project submission for a hackathon on Devpost. Opens a browser to fill out the submission form. Auth required.",
    parameters: Type.Object({
      hackathon: Type.String({
        description:
          "Hackathon URL (e.g. 'https://example.devpost.com/') or slug (e.g. 'example').",
      }),
      title: Type.String({ description: "Project title." }),
      tagline: Type.Optional(
        Type.String({ description: "Short tagline for the project." }),
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
      params: { hackathon: string; title: string; tagline?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const session = manager.getCredentials(account)!;

        let hackUrl: string;
        if (params.hackathon.startsWith("http")) {
          hackUrl = params.hackathon.replace(/\/$/, "");
        } else {
          hackUrl = `https://${params.hackathon}.devpost.com`;
        }

        const { chromium } = await import("playwright");
        const browser = await chromium.launch({ headless: false, channel: "chrome" });
        const context = await browser.newContext();

        const cookieObjects = session.cookie_details.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain || ".devpost.com",
          path: c.path || "/",
        }));
        if (cookieObjects.length > 0) await context.addCookies(cookieObjects);

        const page = await context.newPage();

        try {
          const startUrl = `${hackUrl}/submissions/new`;
          await page.goto(startUrl, { waitUntil: "networkidle", timeout: 15000 });
          await page.waitForTimeout(2000);

          try {
            const titleInput = page.locator(
              'input[name*="title"], input[id*="title"], input[placeholder*="title" i]',
            ).first();
            await titleInput.fill(params.title);
          } catch {
            console.log("[devpost] Could not find title field — form structure may differ.");
          }

          if (params.tagline) {
            try {
              const taglineInput = page.locator(
                'input[name*="tagline"], input[id*="tagline"], textarea[name*="tagline"]',
              ).first();
              await taglineInput.fill(params.tagline);
            } catch {
              console.log("[devpost] Could not find tagline field.");
            }
          }

          try {
            const submitBtn = page.locator(
              'input[type="submit"], button[type="submit"], button:has-text("Save"), button:has-text("Create")',
            ).first();
            await submitBtn.click();
            await page.waitForTimeout(3000);
          } catch {
            console.log("[devpost] Could not find submit button.");
          }

          const resultUrl = page.url();

          return jsonResult({
            success: true,
            hackathon: hackUrl,
            title: params.title,
            result_url: resultUrl,
            message:
              "Submission created. Use devpost_update_submission to add more details.",
          });
        } finally {
          await browser.close();
        }
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostUpdateSubmissionTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_update_submission",
    label: "Devpost Update Submission",
    description:
      "Update an existing project submission on Devpost. Opens a browser to fill in the edit form. Auth required.",
    parameters: Type.Object({
      project: Type.String({
        description:
          "Project URL (e.g. 'https://devpost.com/software/myproject') or slug (e.g. 'myproject').",
      }),
      title: Type.Optional(Type.String({ description: "Updated project title." })),
      tagline: Type.Optional(
        Type.String({ description: "Updated short tagline." }),
      ),
      description: Type.Optional(
        Type.String({ description: "Updated project description (supports markdown)." }),
      ),
      built_with: Type.Optional(
        Type.String({
          description: "Comma-separated list of technologies used.",
        }),
      ),
      demo_url: Type.Optional(
        Type.String({ description: "URL where the project can be tried." }),
      ),
      video_url: Type.Optional(
        Type.String({ description: "Demo video URL (YouTube, Vimeo, etc.)." }),
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
      params: {
        project: string;
        title?: string;
        tagline?: string;
        description?: string;
        built_with?: string;
        demo_url?: string;
        video_url?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const session = manager.getCredentials(account)!;

        let projectUrl: string;
        if (params.project.startsWith("http")) {
          projectUrl = params.project.replace(/\/$/, "");
        } else {
          projectUrl = `https://devpost.com/software/${params.project}`;
        }

        const editUrl = `${projectUrl}/edit`;

        const { chromium } = await import("playwright");
        const browser = await chromium.launch({ headless: false, channel: "chrome" });
        const context = await browser.newContext();

        const cookieObjects = session.cookie_details.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain || ".devpost.com",
          path: c.path || "/",
        }));
        if (cookieObjects.length > 0) await context.addCookies(cookieObjects);

        const page = await context.newPage();

        try {
          await page.goto(editUrl, { waitUntil: "networkidle", timeout: 15000 });
          await page.waitForTimeout(2000);

          const fieldsUpdated: string[] = [];

          if (params.title) {
            try {
              const input = page.locator('input[name*="title"], input[id*="title"]').first();
              await input.clear();
              await input.fill(params.title);
              fieldsUpdated.push("title");
            } catch { /* field not found */ }
          }

          if (params.tagline) {
            try {
              const input = page.locator(
                'input[name*="tagline"], input[id*="tagline"], textarea[name*="tagline"]',
              ).first();
              await input.clear();
              await input.fill(params.tagline);
              fieldsUpdated.push("tagline");
            } catch { /* field not found */ }
          }

          if (params.description) {
            try {
              const textarea = page.locator(
                'textarea[name*="description"], textarea[id*="description"], [contenteditable="true"]',
              ).first();
              await textarea.clear();
              await textarea.fill(params.description);
              fieldsUpdated.push("description");
            } catch { /* field not found */ }
          }

          if (params.demo_url) {
            try {
              const input = page.locator(
                'input[name*="url"], input[name*="demo"], input[id*="app_url"]',
              ).first();
              await input.clear();
              await input.fill(params.demo_url);
              fieldsUpdated.push("demo_url");
            } catch { /* field not found */ }
          }

          if (params.video_url) {
            try {
              const input = page.locator(
                'input[name*="video"], input[id*="video"]',
              ).first();
              await input.clear();
              await input.fill(params.video_url);
              fieldsUpdated.push("video_url");
            } catch { /* field not found */ }
          }

          try {
            const saveBtn = page.locator(
              'input[type="submit"], button[type="submit"], button:has-text("Save"), a:has-text("Save")',
            ).first();
            await saveBtn.click();
            await page.waitForTimeout(3000);
          } catch {
            console.log("[devpost] Could not find save button.");
          }

          return jsonResult({
            success: true,
            project: projectUrl,
            fields_updated: fieldsUpdated,
            message: `Updated ${fieldsUpdated.length} field(s) on the submission.`,
          });
        } finally {
          await browser.close();
        }
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
