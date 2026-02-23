import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { waitForOAuthCallback } from "../auth/oauth-server.js";
import type { PluginConfig } from "../types/plugin-config.js";

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function createAuthTool(
  name: string,
  label: string,
  description: string,
  clientManager: OAuthClientManager,
  config: PluginConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return {
    name,
    label,
    description,
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Name for this account (e.g. 'work', 'personal'). Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const port = config.oauth_port ?? 9753;

      try {
        const open = (await import("open")).default;
        const rawClient = clientManager.getRawClient();

        const tokens = await waitForOAuthCallback(rawClient, port, (url) => {
          open(url).catch(() => {});
        });

        const client = clientManager.setCredentials(account, tokens);

        const oauth2 = google.oauth2({ version: "v2", auth: client });
        let email = "unknown";
        try {
          const info = await oauth2.userinfo.get();
          email = info.data.email ?? "unknown";
        } catch {
          // Non-fatal
        }

        return jsonResult({ status: "authenticated", account, email });
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailAuthTool(clientManager: OAuthClientManager, config: PluginConfig): any {
  return createAuthTool(
    "gmail_auth_setup",
    "Gmail Auth Setup",
    "Authenticate omniclaw with Gmail via Google OAuth2. Opens a browser window for the Google sign-in flow. Must be called before using any gmail_* or calendar_* tools.",
    clientManager,
    config,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCalendarAuthTool(
  clientManager: OAuthClientManager,
  config: PluginConfig,
): any {
  return createAuthTool(
    "calendar_auth_setup",
    "Calendar Auth Setup",
    "Authenticate omniclaw with Google Calendar via Google OAuth2. Opens a browser window for the Google sign-in flow. Must be called before using any calendar_* tools. Also grants Gmail access.",
    clientManager,
    config,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDriveAuthTool(clientManager: OAuthClientManager, config: PluginConfig): any {
  return createAuthTool(
    "drive_auth_setup",
    "Drive Auth Setup",
    "Authenticate omniclaw with Google Drive via Google OAuth2. Opens a browser window for the Google sign-in flow. Must be called before using any drive_* tools. Also grants Gmail and Calendar access.",
    clientManager,
    config,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDocsAuthTool(clientManager: OAuthClientManager, config: PluginConfig): any {
  return createAuthTool(
    "docs_auth_setup",
    "Docs Auth Setup",
    "Authenticate omniclaw with Google Docs via Google OAuth2. Opens a browser window for the Google sign-in flow. Must be called before using any docs_* tools. Also grants Gmail, Calendar, and Drive access.",
    clientManager,
    config,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlidesAuthTool(clientManager: OAuthClientManager, config: PluginConfig): any {
  return createAuthTool(
    "slides_auth_setup",
    "Slides Auth Setup",
    "Authenticate omniclaw with Google Slides via Google OAuth2. Opens a browser window for the Google sign-in flow. Must be called before using any slides_* tools. Also grants Gmail, Calendar, Drive, and Docs access.",
    clientManager,
    config,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSheetsAuthTool(clientManager: OAuthClientManager, config: PluginConfig): any {
  return createAuthTool(
    "sheets_auth_setup",
    "Sheets Auth Setup",
    "Authenticate omniclaw with Google Sheets via Google OAuth2. Opens a browser window for the Google sign-in flow. Must be called before using any sheets_* tools. Also grants Gmail, Calendar, Drive, Docs, and Slides access.",
    clientManager,
    config,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createYouTubeAuthTool(
  clientManager: OAuthClientManager,
  config: PluginConfig,
): any {
  return createAuthTool(
    "youtube_auth_setup",
    "YouTube Auth Setup",
    "Authenticate omniclaw with YouTube via Google OAuth2. Opens a browser window for the Google sign-in flow. Must be called before using youtube_search, youtube_video_details, youtube_channel_info, or youtube_video_comments tools.",
    clientManager,
    config,
  );
}
