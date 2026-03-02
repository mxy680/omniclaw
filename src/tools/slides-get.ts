import { Type } from "@sinclair/typebox";
import { google, slides_v1 } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("slides");

function extractShapeText(element: slides_v1.Schema$PageElement): string {
  return (element.shape?.text?.textElements ?? [])
    .map((te) => te.textRun?.content ?? "")
    .join("")
    .trim();
}

function extractSpeakerNotes(slide: slides_v1.Schema$Page): string {
  const notesPage = slide.slideProperties?.notesPage;
  for (const el of notesPage?.pageElements ?? []) {
    if (el.shape?.placeholder?.type === "BODY") {
      return (el.shape.text?.textElements ?? [])
        .map((te) => te.textRun?.content ?? "")
        .join("")
        .trim();
    }
  }
  return "";
}

function extractTableText(element: slides_v1.Schema$PageElement): string[][] {
  return (element.table?.tableRows ?? []).map((row) =>
    (row.tableCells ?? []).map((cell) =>
      (cell.text?.textElements ?? [])
        .map((te) => te.textRun?.content ?? "")
        .join("")
        .trim(),
    ),
  );
}

function extractImageUrl(element: slides_v1.Schema$PageElement): string {
  return element.image?.contentUrl ?? element.image?.sourceUrl ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlidesGetTool(clientManager: OAuthClientManager): any {
  return {
    name: "slides_get",
    label: "Slides Get",
    description:
      "Fetch a Google Slides presentation by its ID. Returns the title, slide count, and the text content, tables, images, and speaker notes of each slide.",
    parameters: Type.Object({
      presentation_id: Type.String({
        description: "The Google Slides presentation ID (from its URL).",
      }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { presentation_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const slides = google.slides({ version: "v1", auth: client });

      const res = await slides.presentations.get({
        presentationId: params.presentation_id,
      });

      const pres = res.data;
      const slideData = (pres.slides ?? []).map((slide, i) => {
        const texts: string[] = [];
        const tables: string[][][] = [];
        const images: string[] = [];

        for (const element of slide.pageElements ?? []) {
          const shapeText = extractShapeText(element);
          if (shapeText) {
            texts.push(shapeText);
          }
          if (element.table) {
            tables.push(extractTableText(element));
          }
          if (element.image) {
            const url = extractImageUrl(element);
            if (url) images.push(url);
          }
        }

        return {
          index: i + 1,
          objectId: slide.objectId ?? "",
          texts,
          tables,
          images,
          speakerNotes: extractSpeakerNotes(slide),
        };
      });

      return jsonResult({
        id: pres.presentationId ?? "",
        title: pres.title ?? "",
        slideCount: slideData.length,
        url: `https://docs.google.com/presentation/d/${pres.presentationId}/edit`,
        slides: slideData,
      });
    },
  };
}
