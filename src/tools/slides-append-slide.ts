import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("slides");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlidesAppendSlideTool(clientManager: OAuthClientManager): any {
  return {
    name: "slides_append_slide",
    label: "Slides Append Slide",
    description:
      "Append a new slide to a Google Slides presentation with a title and optional body text.",
    parameters: Type.Object({
      presentation_id: Type.String({ description: "The Google Slides presentation ID." }),
      title: Type.Optional(Type.String({ description: "Title text for the new slide." })),
      body: Type.Optional(Type.String({ description: "Body text for the new slide." })),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { presentation_id: string; title?: string; body?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const slidesApi = google.slides({ version: "v1", auth: client });

      // Create the slide using TITLE_AND_BODY layout
      const createRes = await slidesApi.presentations.batchUpdate({
        presentationId: params.presentation_id,
        requestBody: {
          requests: [
            {
              createSlide: {
                slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
              },
            },
          ],
        },
      });

      const newSlideId = createRes.data.replies?.[0]?.createSlide?.objectId ?? "";

      // Get the new slide's placeholder IDs
      const pres = await slidesApi.presentations.get({
        presentationId: params.presentation_id,
      });
      const newSlide = pres.data.slides?.find((s) => s.objectId === newSlideId);
      const titleEl = newSlide?.pageElements?.find((e) => e.shape?.placeholder?.type === "TITLE");
      const bodyEl = newSlide?.pageElements?.find((e) => e.shape?.placeholder?.type === "BODY");

      // Insert title and body text
      const textRequests = [];
      if (params.title && titleEl?.objectId) {
        textRequests.push({
          insertText: { objectId: titleEl.objectId, insertionIndex: 0, text: params.title },
        });
      }
      if (params.body && bodyEl?.objectId) {
        textRequests.push({
          insertText: { objectId: bodyEl.objectId, insertionIndex: 0, text: params.body },
        });
      }

      if (textRequests.length > 0) {
        await slidesApi.presentations.batchUpdate({
          presentationId: params.presentation_id,
          requestBody: { requests: textRequests },
        });
      }

      return jsonResult({
        success: true,
        presentation_id: params.presentation_id,
        slide_id: newSlideId,
        slide_index: pres.data.slides?.length ?? 1,
      });
    },
  };
}
