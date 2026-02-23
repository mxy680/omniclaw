import { Type } from "@sinclair/typebox";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { extname, join } from "path";
import type { GeminiClientManager } from "../auth/gemini-client-manager";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  return map[mime] ?? ".png";
}

function isImagenModel(model: string): boolean {
  return model.startsWith("imagen");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGeminiGenerateImageTool(manager: GeminiClientManager): any {
  return {
    name: "gemini_generate_image",
    label: "Gemini Generate Image",
    description:
      "Generate images from a text prompt using Google Gemini or Imagen models. " +
      "Images are saved to the specified directory. " +
      "Use gemini-2.5-flash-preview-image-generation for creative/mixed output, or imagen-4/imagen-4-ultra/imagen-4-fast for high-quality image-only output.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Text prompt describing the image to generate." }),
      save_directory: Type.String({ description: "Directory path where generated images will be saved." }),
      model: Type.Optional(
        Type.String({
          description:
            "Model to use. Options: gemini-2.5-flash-preview-image-generation (default), imagen-4, imagen-4-ultra, imagen-4-fast.",
          default: "gemini-2.5-flash-preview-image-generation",
        })
      ),
      number_of_images: Type.Optional(
        Type.Number({ description: "Number of images to generate (Imagen models only). Default 1.", default: 1 })
      ),
      aspect_ratio: Type.Optional(
        Type.String({ description: "Aspect ratio (e.g. '16:9', '1:1', '9:16'). Default '1:1'." })
      ),
      account: Type.Optional(
        Type.String({ description: "Gemini account name. Defaults to 'default'.", default: "default" })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        prompt: string;
        save_directory: string;
        model?: string;
        number_of_images?: number;
        aspect_ratio?: string;
        account?: string;
      }
    ) {
      const account = params.account ?? "default";
      if (!manager.hasKey(account)) {
        return jsonResult({ error: "auth_required", message: "Call gemini_auth_setup first." });
      }

      const model = params.model ?? "gemini-2.5-flash-preview-image-generation";

      try {
        const ai = manager.getClient(account);
        ensureDir(params.save_directory);
        const timestamp = Date.now();

        if (isImagenModel(model)) {
          const response = await ai.models.generateImages({
            model,
            prompt: params.prompt,
            config: {
              numberOfImages: params.number_of_images ?? 1,
              aspectRatio: params.aspect_ratio,
            },
          });

          const images: { path: string; mimeType: string }[] = [];
          const generatedImages = response.generatedImages ?? [];
          for (let i = 0; i < generatedImages.length; i++) {
            const img = generatedImages[i];
            if (img.image?.imageBytes) {
              const mime = img.image.mimeType ?? "image/png";
              const ext = mimeToExt(mime);
              const filename = `gemini-image-${timestamp}-${i}${ext}`;
              const filepath = join(params.save_directory, filename);
              writeFileSync(filepath, Buffer.from(img.image.imageBytes, "base64"));
              images.push({ path: filepath, mimeType: mime });
            }
          }

          return jsonResult({ images });
        }

        // Gemini model — use generateContent with image modality
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: params.prompt }] }],
          config: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        });

        const images: { path: string; mimeType: string }[] = [];
        let text: string | undefined;

        const parts = response.candidates?.[0]?.content?.parts ?? [];
        let imgIdx = 0;
        for (const part of parts) {
          if (part.text) {
            text = (text ?? "") + part.text;
          }
          if (part.inlineData) {
            const mime = part.inlineData.mimeType ?? "image/png";
            const ext = mimeToExt(mime);
            const filename = `gemini-image-${timestamp}-${imgIdx}${ext}`;
            const filepath = join(params.save_directory, filename);
            writeFileSync(filepath, Buffer.from(part.inlineData.data!, "base64"));
            images.push({ path: filepath, mimeType: mime });
            imgIdx++;
          }
        }

        return jsonResult({ images, text });
      } catch (err) {
        return jsonResult({
          error: "generation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGeminiEditImageTool(manager: GeminiClientManager): any {
  return {
    name: "gemini_edit_image",
    label: "Gemini Edit Image",
    description:
      "Edit an existing image using a text instruction. " +
      "Reads the input image from disk, sends it to Gemini with the editing prompt, and saves the result.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Text instruction describing how to edit the image." }),
      input_image_path: Type.String({ description: "Path to the input image file to edit." }),
      save_directory: Type.String({ description: "Directory path where edited images will be saved." }),
      model: Type.Optional(
        Type.String({
          description: "Model to use. Default: gemini-2.5-flash-preview-image-generation.",
          default: "gemini-2.5-flash-preview-image-generation",
        })
      ),
      account: Type.Optional(
        Type.String({ description: "Gemini account name. Defaults to 'default'.", default: "default" })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        prompt: string;
        input_image_path: string;
        save_directory: string;
        model?: string;
        account?: string;
      }
    ) {
      const account = params.account ?? "default";
      if (!manager.hasKey(account)) {
        return jsonResult({ error: "auth_required", message: "Call gemini_auth_setup first." });
      }

      if (!existsSync(params.input_image_path)) {
        return jsonResult({ error: "file_not_found", message: `Input image not found: ${params.input_image_path}` });
      }

      const model = params.model ?? "gemini-2.5-flash-preview-image-generation";

      try {
        const ai = manager.getClient(account);
        ensureDir(params.save_directory);
        const timestamp = Date.now();

        const imageData = readFileSync(params.input_image_path);
        const ext = extname(params.input_image_path).toLowerCase();
        const mimeMap: Record<string, string> = {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".webp": "image/webp",
          ".gif": "image/gif",
        };
        const inputMime = mimeMap[ext] ?? "image/png";

        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { text: params.prompt },
                {
                  inlineData: {
                    mimeType: inputMime,
                    data: imageData.toString("base64"),
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        });

        const images: { path: string; mimeType: string }[] = [];
        let text: string | undefined;

        const parts = response.candidates?.[0]?.content?.parts ?? [];
        let imgIdx = 0;
        for (const part of parts) {
          if (part.text) {
            text = (text ?? "") + part.text;
          }
          if (part.inlineData) {
            const mime = part.inlineData.mimeType ?? "image/png";
            const outExt = mimeToExt(mime);
            const filename = `gemini-image-${timestamp}-${imgIdx}${outExt}`;
            const filepath = join(params.save_directory, filename);
            writeFileSync(filepath, Buffer.from(part.inlineData.data!, "base64"));
            images.push({ path: filepath, mimeType: mime });
            imgIdx++;
          }
        }

        return jsonResult({ images, text });
      } catch (err) {
        return jsonResult({
          error: "edit_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
