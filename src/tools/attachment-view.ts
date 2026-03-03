import { Type } from "@sinclair/typebox";
import { getAttachment } from "./attachment-store.js";

export function createViewAttachmentTool() {
  return {
    name: "view_attachment",
    label: "View Attachment",
    description:
      "View an attachment uploaded by the user. For images, returns the image so you can see it. " +
      "For PDFs and other files, returns the base64 data. Use this when the user sends a message " +
      "referencing an attachment ID.",
    parameters: Type.Object({
      attachment_id: Type.String({ description: "The attachment UUID to view." }),
    }),
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const id = params.attachment_id as string;
      const result = getAttachment(id);

      if (!result) {
        return {
          content: [{ type: "text", text: `Attachment not found: ${id}` }],
          isError: true,
        };
      }

      const { meta, data } = result;
      const base64 = data.toString("base64");

      if (meta.mimeType.startsWith("image/")) {
        // Return as MCP image content block — the agent framework converts this
        // to a Claude image content block so the model can see the image.
        return {
          content: [
            {
              type: "image" as const,
              data: base64,
              mimeType: meta.mimeType,
            },
          ],
        };
      }

      // For PDFs and other files, return as an embedded resource
      return {
        content: [
          {
            type: "resource" as const,
            resource: {
              uri: `attachment://${id}/${meta.filename}`,
              mimeType: meta.mimeType,
              blob: base64,
            },
          },
        ],
      };
    },
  };
}
