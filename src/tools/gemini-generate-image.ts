import * as path from "path";
import { writeFileSync } from "fs";
import { Type } from "@sinclair/typebox";
import type { GeminiClientManager } from "../auth/gemini-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";
import { ensureDir } from "./media-utils.js";

const AUTH_REQUIRED = authRequired("gemini");

// ---------------------------------------------------------------------------
// Imagen dedicated image generation (imagen-4.0-generate-001, etc.)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGeminiImagenTool(manager: GeminiClientManager): any {
  return {
    name: "gemini_imagen",
    label: "Gemini Imagen",
    description:
      "Generate images using Google's Imagen model. Supports generating multiple images at once with configurable aspect ratio and person generation settings. Returns file paths to all generated images.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Text description of the image(s) to generate." }),
      save_dir: Type.String({ description: "Directory to save the generated images." }),
      model: Type.Optional(
        Type.String({
          description:
            'Model to use. Options: "imagen-4.0-generate-001" (default), "imagen-4.0-ultra-generate-001", "imagen-4.0-fast-generate-001".',
        }),
      ),
      number_of_images: Type.Optional(
        Type.Number({
          description: "Number of images to generate (1-4). Default: 1.",
          minimum: 1,
          maximum: 4,
        }),
      ),
      aspect_ratio: Type.Optional(
        Type.String({
          description: 'Aspect ratio. Options: "1:1" (default), "16:9", "9:16", "3:4", "4:3".',
        }),
      ),
      person_generation: Type.Optional(
        Type.String({
          description:
            'Person generation policy. Options: "dont_allow", "allow_adult" (default).',
        }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        prompt: string;
        save_dir: string;
        model?: string;
        number_of_images?: number;
        aspect_ratio?: string;
        person_generation?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);

      const ai = client.getClient();
      const model = params.model ?? "imagen-4.0-generate-001";

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: Record<string, any> = {};
        if (params.number_of_images) config.numberOfImages = params.number_of_images;
        if (params.aspect_ratio) config.aspectRatio = params.aspect_ratio;
        if (params.person_generation) config.personGeneration = params.person_generation;
        config.includeRaiReason = true;

        const response = await ai.models.generateImages({
          model,
          prompt: params.prompt,
          config,
        });

        const generated = response?.generatedImages;
        if (!generated || generated.length === 0) {
          return jsonResult({
            error: "no_images",
            message: "No images were generated. The prompt may have been filtered by safety policies.",
          });
        }

        ensureDir(params.save_dir);
        const timestamp = Date.now();
        const savedFiles: Array<{ path: string; mime_type: string; size: number }> = [];

        for (let i = 0; i < generated.length; i++) {
          const imageBytes = generated[i]?.image?.imageBytes;
          if (!imageBytes) continue;

          const filename = `gemini-imagen-${timestamp}-${i}.png`;
          const filePath = path.join(params.save_dir, filename);
          const buffer = Buffer.from(imageBytes, "base64");
          writeFileSync(filePath, buffer);
          savedFiles.push({
            path: filePath,
            mime_type: "image/png",
            size: buffer.length,
          });
        }

        return jsonResult({
          images: savedFiles,
          count: savedFiles.length,
          model,
        });
      } catch (err: unknown) {
        return jsonResult({
          error: "generation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
