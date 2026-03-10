import { Type } from "@sinclair/typebox";
import { execFileSync } from "child_process";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerExportHtmlTool(): any {
  return {
    name: "framer_export_html",
    label: "Framer Export HTML",
    description:
      "Export a published Framer site to static HTML using the unframed CLI. The site must be published and accessible via URL.",
    parameters: Type.Object({
      url: Type.String({
        description: "The published Framer site URL to export (e.g., https://mysite.framer.app).",
      }),
      output_dir: Type.Optional(
        Type.String({
          description: "Output directory for the exported HTML files. Defaults to './framer-export'.",
          default: "./framer-export",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { url: string; output_dir?: string },
    ) {
      const outputDir = params.output_dir ?? "./framer-export";
      try {
        const result = execFileSync(
          "npx", ["unframed", params.url, "-o", outputDir],
          { encoding: "utf-8", timeout: 120_000 },
        );
        return jsonResult({
          success: true,
          url: params.url,
          output_dir: outputDir,
          output: result.trim(),
        });
      } catch (err: unknown) {
        return jsonResult({
          error: "export_failed",
          message: err instanceof Error ? err.message : String(err),
          note: "Make sure the site is published and accessible. The unframed CLI must be available via npx.",
        });
      }
    },
  };
}
