import * as path from "path";
import { writeFileSync } from "fs";
import { Type } from "@sinclair/typebox";
import type { GeminiClientManager } from "../auth/gemini-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";
import { ensureDir, mimeToExt } from "./media-utils.js";

const AUTH_REQUIRED = authRequired("gemini");

// ---------------------------------------------------------------------------
// Native Gemini image generation (gemini-2.5-flash-image, etc.)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGeminiGenerateImageTool(manager: GeminiClientManager): any {
  return {
    name: "gemini_generate_image",
    label: "Gemini Generate Image",
    description:
      "Generate an image using Gemini's native image generation. Supports text-to-image with configurable aspect ratio and resolution. Returns the file path to the generated image.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Text description of the image to generate." }),
      save_dir: Type.String({ description: "Directory to save the generated image." }),
      model: Type.Optional(
        Type.String({
          description:
            'Model to use. Options: "gemini-2.5-flash-image" (default, free tier), "gemini-3.1-flash-image-preview", "gemini-3-pro-image-preview".',
        }),
      ),
      aspect_ratio: Type.Optional(
        Type.String({
          description:
            'Aspect ratio. Options: "1:1" (default), "16:9", "9:16", "3:4", "4:3", "2:3", "3:2", "4:5", "5:4", "21:9".',
        }),
      ),
      image_size: Type.Optional(
        Type.String({
          description: 'Image resolution. Options: "1K" (default), "2K", "4K".',
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
        aspect_ratio?: string;
        image_size?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);

      const ai = client.getClient();
      const model = params.model ?? "gemini-2.5-flash-image";

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: Record<string, any> = {};
        if (params.aspect_ratio || params.image_size) {
          config.imageConfig = {
            ...(params.aspect_ratio && { aspectRatio: params.aspect_ratio }),
            ...(params.image_size && { imageSize: params.image_size }),
          };
        }

        const response = await ai.models.generateContent({
          model,
          contents: params.prompt,
          config,
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (!parts) {
          return jsonResult({ error: "no_response", message: "No content returned from model." });
        }

        ensureDir(params.save_dir);
        const savedFiles: Array<{ path: string; mime_type: string; size: number }> = [];
        let textResponse = "";

        for (const part of parts) {
          if (part.text) {
            textResponse += part.text;
          } else if (part.inlineData) {
            const ext = mimeToExt(part.inlineData.mimeType ?? "image/png");
            const filename = `gemini-image-${Date.now()}${ext}`;
            const filePath = path.join(params.save_dir, filename);
            const buffer = Buffer.from(part.inlineData.data!, "base64");
            writeFileSync(filePath, buffer);
            savedFiles.push({
              path: filePath,
              mime_type: part.inlineData.mimeType ?? "image/png",
              size: buffer.length,
            });
          }
        }

        if (savedFiles.length === 0) {
          return jsonResult({
            error: "no_image",
            message: "Model did not return any images. It may have been filtered by safety policies.",
            text_response: textResponse || undefined,
          });
        }

        return jsonResult({
          images: savedFiles,
          text_response: textResponse || undefined,
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
