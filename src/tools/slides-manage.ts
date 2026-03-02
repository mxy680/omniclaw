import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("slides");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlidesDeleteSlideTool(clientManager: OAuthClientManager): any {
  return {
    name: "slides_delete_slide",
    label: "Google Slides Delete Slide",
    description: "Delete a slide from a presentation by its object ID.",
    parameters: Type.Object({
      presentation_id: Type.String({ description: "The presentation ID." }),
      slide_id: Type.String({ description: "The objectId of the slide to delete." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { presentation_id: string; slide_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);
      const client = clientManager.getClient(account);
      const slides = google.slides({ version: "v1", auth: client });
      await slides.presentations.batchUpdate({
        presentationId: params.presentation_id,
        requestBody: { requests: [{ deleteObject: { objectId: params.slide_id } }] },
      });
      return jsonResult({
        success: true,
        presentation_id: params.presentation_id,
        deleted_slide_id: params.slide_id,
      });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlidesDuplicateSlideTool(clientManager: OAuthClientManager): any {
  return {
    name: "slides_duplicate_slide",
    label: "Google Slides Duplicate Slide",
    description: "Duplicate a slide in a presentation.",
    parameters: Type.Object({
      presentation_id: Type.String({ description: "The presentation ID." }),
      slide_id: Type.String({ description: "The objectId of the slide to duplicate." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { presentation_id: string; slide_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);
      const client = clientManager.getClient(account);
      const slides = google.slides({ version: "v1", auth: client });
      const res = await slides.presentations.batchUpdate({
        presentationId: params.presentation_id,
        requestBody: { requests: [{ duplicateObject: { objectId: params.slide_id } }] },
      });
      const newId = res.data.replies?.[0]?.duplicateObject?.objectId ?? "";
      return jsonResult({
        success: true,
        presentation_id: params.presentation_id,
        original_slide_id: params.slide_id,
        new_slide_id: newId,
      });
    },
  };
}
