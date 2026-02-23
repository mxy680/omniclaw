import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call drive_auth_setup to authenticate.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDriveShareTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_share",
    label: "Drive Share File",
    description:
      "Share a Google Drive file or folder with another user. Roles: reader (view), commenter (comment), writer (edit).",
    parameters: Type.Object({
      file_id: Type.String({ description: "ID of the file or folder to share." }),
      email: Type.String({ description: "Email address of the person to share with." }),
      role: Type.Union(
        [Type.Literal("reader"), Type.Literal("commenter"), Type.Literal("writer")],
        { description: "Permission level: 'reader', 'commenter', or 'writer'." },
      ),
      notify: Type.Optional(
        Type.Boolean({
          description: "Send an email notification to the recipient. Defaults to true.",
          default: true,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        file_id: string;
        email: string;
        role: "reader" | "commenter" | "writer";
        notify?: boolean;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const drive = google.drive({ version: "v3", auth: client });

      const res = await drive.permissions.create({
        fileId: params.file_id,
        sendNotificationEmail: params.notify ?? true,
        requestBody: {
          type: "user",
          role: params.role,
          emailAddress: params.email,
        },
        fields: "id,role,emailAddress",
      });

      return jsonResult({
        success: true,
        permission_id: res.data.id ?? "",
        email: res.data.emailAddress ?? params.email,
        role: res.data.role ?? params.role,
      });
    },
  };
}
