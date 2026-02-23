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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGeminiGenerateVideoTool(manager: GeminiClientManager): any {
  return {
    name: "gemini_generate_video",
    label: "Gemini Generate Video",
    description:
      "Generate videos from text prompts or images using Google Veo models. " +
      "Videos are saved to the specified directory. " +
      "Generation is asynchronous — the tool polls until completion or timeout.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Text prompt describing the video to generate." }),
      save_directory: Type.String({ description: "Directory path where generated videos will be saved." }),
      model: Type.Optional(
        Type.String({
          description: "Model to use. Options: veo-3.1-generate-preview (default), veo-3.1-fast-generate-preview.",
          default: "veo-3.1-generate-preview",
        })
      ),
      input_image_path: Type.Optional(
        Type.String({ description: "Optional path to an input image for image-to-video generation." })
      ),
      aspect_ratio: Type.Optional(
        Type.String({ description: "Aspect ratio (e.g. '16:9', '9:16'). Default '16:9'." })
      ),
      duration_seconds: Type.Optional(
        Type.Number({ description: "Video duration in seconds (e.g. 5, 8)." })
      ),
      number_of_videos: Type.Optional(
        Type.Number({ description: "Number of videos to generate. Default 1.", default: 1 })
      ),
      timeout_seconds: Type.Optional(
        Type.Number({ description: "Maximum time to wait for generation in seconds. Default 300.", default: 300 })
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
        input_image_path?: string;
        aspect_ratio?: string;
        duration_seconds?: number;
        number_of_videos?: number;
        timeout_seconds?: number;
        account?: string;
      }
    ) {
      const account = params.account ?? "default";
      if (!manager.hasKey(account)) {
        return jsonResult({ error: "auth_required", message: "Call gemini_auth_setup first." });
      }

      if (params.input_image_path && !existsSync(params.input_image_path)) {
        return jsonResult({ error: "file_not_found", message: `Input image not found: ${params.input_image_path}` });
      }

      const model = params.model ?? "veo-3.1-generate-preview";
      const timeoutMs = (params.timeout_seconds ?? 300) * 1000;

      try {
        const ai = manager.getClient(account);
        ensureDir(params.save_directory);
        const timestamp = Date.now();

        // Build image reference if provided
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let image: any;
        if (params.input_image_path) {
          const imageData = readFileSync(params.input_image_path);
          const ext = extname(params.input_image_path).toLowerCase();
          const mimeMap: Record<string, string> = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
          };
          image = {
            imageBytes: imageData.toString("base64"),
            mimeType: mimeMap[ext] ?? "image/png",
          };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const generateConfig: any = {
          numberOfVideos: params.number_of_videos ?? 1,
          aspectRatio: params.aspect_ratio,
          durationSeconds: params.duration_seconds,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const request: any = {
          model,
          prompt: params.prompt,
          config: generateConfig,
        };
        if (image) {
          request.image = image;
        }

        let operation = await ai.models.generateVideos(request);

        // Poll for completion
        const startTime = Date.now();
        while (!operation.done) {
          if (Date.now() - startTime > timeoutMs) {
            return jsonResult({
              status: "timeout",
              message: `Video generation did not complete within ${params.timeout_seconds ?? 300} seconds. The operation may still be running.`,
              operation_name: operation.name,
            });
          }
          await sleep(5000);
          operation = await ai.operations.getVideosOperation({ operation });
        }

        // Save generated videos
        const videos: { path: string; mimeType: string }[] = [];
        const generatedVideos = operation.response?.generatedVideos ?? [];
        for (let i = 0; i < generatedVideos.length; i++) {
          const vid = generatedVideos[i];
          if (vid.video?.uri) {
            // Download video from URI
            const res = await fetch(vid.video.uri);
            if (res.ok) {
              const buffer = Buffer.from(await res.arrayBuffer());
              const filename = `gemini-video-${timestamp}-${i}.mp4`;
              const filepath = join(params.save_directory, filename);
              writeFileSync(filepath, buffer);
              videos.push({ path: filepath, mimeType: "video/mp4" });
            }
          }
        }

        return jsonResult({ status: "completed", videos });
      } catch (err) {
        return jsonResult({
          error: "generation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
