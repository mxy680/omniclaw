import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("drive");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDriveShareTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_share",
    label: "Drive Share File",
    description:
      "Share a Google Drive file or folder. Supports sharing with a user, group, domain, or anyone. Roles: reader (view), commenter (comment), writer (edit).",
    parameters: Type.Object({
      file_id: Type.String({ description: "ID of the file or folder to share." }),
      email: Type.Optional(
        Type.String({
          description:
            "Email address of the person or group to share with. Required for 'user' and 'group' share types.",
        }),
      ),
      role: Type.Union(
        [Type.Literal("reader"), Type.Literal("commenter"), Type.Literal("writer")],
        { description: "Permission level: 'reader', 'commenter', or 'writer'." },
      ),
      share_type: Type.Optional(
        Type.Union(
          [
            Type.Literal("user"),
            Type.Literal("group"),
            Type.Literal("domain"),
            Type.Literal("anyone"),
          ],
          { description: "Type of share. Defaults to 'user'.", default: "user" },
        ),
      ),
      domain: Type.Optional(
        Type.String({ description: "Domain for domain-type sharing." }),
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
        email?: string;
        role: "reader" | "commenter" | "writer";
        share_type?: "user" | "group" | "domain" | "anyone";
        domain?: string;
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

      const shareType = params.share_type ?? "user";

      const permissionBody: {
        type: string;
        role: string;
        emailAddress?: string;
        domain?: string;
      } = {
        type: shareType,
        role: params.role,
      };

      if (shareType === "user" || shareType === "group") {
        permissionBody.emailAddress = params.email;
      } else if (shareType === "domain") {
        permissionBody.domain = params.domain;
      }

      const res = await drive.permissions.create({
        fileId: params.file_id,
        sendNotificationEmail: params.notify ?? true,
        requestBody: permissionBody,
        fields: "id,role,emailAddress,type",
        supportsAllDrives: true,
      });

      return jsonResult({
        success: true,
        permission_id: res.data.id ?? "",
        email: res.data.emailAddress ?? params.email ?? "",
        role: res.data.role ?? params.role,
        type: res.data.type ?? shareType,
      });
    },
  };
}
