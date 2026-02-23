import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailAccountsTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_accounts",
    label: "Gmail Accounts",
    description:
      "List all authenticated Gmail accounts. Returns each account name and its associated email address.",
    parameters: Type.Object({}),
    async execute() {
      const accountNames = clientManager.listAccounts();

      const accounts = await Promise.all(
        accountNames.map(async (account) => {
          try {
            const client = clientManager.getClient(account);
            const gmail = google.gmail({ version: "v1", auth: client });
            const res = await gmail.users.getProfile({ userId: "me" });
            return { account, email: res.data.emailAddress ?? null };
          } catch {
            return { account, email: null };
          }
        })
      );

      return jsonResult({ accounts });
    },
  };
}
