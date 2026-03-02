import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("slides");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlidesWriteNotesTool(clientManager: OAuthClientManager): any {
  return {
    name: "slides_write_notes",
    label: "Google Slides Write Speaker Notes",
    description: "Write or replace speaker notes for a slide.",
    parameters: Type.Object({
      presentation_id: Type.String({ description: "The presentation ID." }),
      slide_id: Type.String({ description: "The objectId of the slide." }),
      notes: Type.String({ description: "Speaker notes text." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { presentation_id: string; slide_id: string; notes: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);
      const client = clientManager.getClient(account);
      const slidesApi = google.slides({ version: "v1", auth: client });

      // Get the presentation to find the notes page body placeholder
      const pres = await slidesApi.presentations.get({ presentationId: params.presentation_id });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slide = (pres.data.slides ?? []).find((s: any) => s.objectId === params.slide_id);
      if (!slide) {
        return jsonResult({
          error: "slide_not_found",
          message: `Slide ${params.slide_id} not found.`,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const notesPage = (slide as any).slideProperties?.notesPage;
      if (!notesPage) {
        return jsonResult({
          error: "no_notes_page",
          message: "Slide has no notes page.",
        });
      }

      // Find the BODY placeholder on the notes page
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bodyEl = (notesPage.pageElements ?? []).find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el: any) => el.shape?.placeholder?.type === "BODY",
      );
      if (!bodyEl) {
        return jsonResult({
          error: "no_body_placeholder",
          message: "No body placeholder found on notes page.",
        });
      }

      const bodyId = bodyEl.objectId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requests: any[] = [];

      // Clear existing text if any
      const existingText = (bodyEl.shape?.text?.textElements ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((te: any) => te.textRun)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((te: any) => te.textRun.content)
        .join("");
      if (existingText.length > 0) {
        requests.push({
          deleteText: {
            objectId: bodyId,
            textRange: { type: "ALL" },
          },
        });
      }

      // Insert new notes
      requests.push({
        insertText: {
          objectId: bodyId,
          insertionIndex: 0,
          text: params.notes,
        },
      });

      await slidesApi.presentations.batchUpdate({
        presentationId: params.presentation_id,
        requestBody: { requests },
      });

      return jsonResult({
        success: true,
        presentation_id: params.presentation_id,
        slide_id: params.slide_id,
      });
    },
  };
}
