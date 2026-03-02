import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("drive");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDrivePermissionsListTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_permissions_list",
    label: "Drive List Permissions",
    description:
      "List all permissions on a Google Drive file or folder. Returns each permission's id, type, emailAddress, role, displayName, and domain.",
    parameters: Type.Object({
      file_id: Type.String({ description: "ID of the file or folder." }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { file_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const drive = google.drive({ version: "v3", auth: client });

      const res = await drive.permissions.list({
        fileId: params.file_id,
        supportsAllDrives: true,
        fields: "permissions(id,type,emailAddress,role,displayName,domain)",
      });

      const permissions = (res.data.permissions ?? []).map((p) => ({
        id: p.id ?? "",
        type: p.type ?? "",
        emailAddress: p.emailAddress ?? "",
        role: p.role ?? "",
        displayName: p.displayName ?? "",
        domain: p.domain ?? "",
      }));

      return jsonResult(permissions);
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDrivePermissionsDeleteTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_permissions_delete",
    label: "Drive Delete Permission",
    description: "Remove a permission from a Google Drive file or folder.",
    parameters: Type.Object({
      file_id: Type.String({ description: "ID of the file or folder." }),
      permission_id: Type.String({ description: "ID of the permission to remove." }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { file_id: string; permission_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const drive = google.drive({ version: "v3", auth: client });

      await drive.permissions.delete({
        fileId: params.file_id,
        permissionId: params.permission_id,
        supportsAllDrives: true,
      });

      return jsonResult({
        success: true,
        file_id: params.file_id,
        permission_id: params.permission_id,
      });
    },
  };
}
