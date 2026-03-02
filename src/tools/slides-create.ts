import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("slides");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlidesCreateTool(clientManager: OAuthClientManager): any {
  return {
    name: "slides_create",
    label: "Slides Create",
    description: "Create a new Google Slides presentation with a given title.",
    parameters: Type.Object({
      title: Type.String({ description: "Title of the new presentation." }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { title: string; account?: string }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const slides = google.slides({ version: "v1", auth: client });

      const res = await slides.presentations.create({
        requestBody: { title: params.title },
      });

      const id = res.data.presentationId ?? "";
      return jsonResult({
        success: true,
        id,
        title: res.data.title ?? params.title,
        slideCount: res.data.slides?.length ?? 0,
        url: `https://docs.google.com/presentation/d/${id}/edit`,
      });
    },
  };
}
