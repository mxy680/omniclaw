import * as path from "path";
import { writeFileSync } from "fs";
import { Type } from "@sinclair/typebox";
import type { GeminiClientManager } from "../auth/gemini-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";
import { ensureDir } from "./media-utils.js";

const AUTH_REQUIRED = authRequired("gemini");

const POLL_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_SECONDS = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGeminiGenerateVideoTool(manager: GeminiClientManager): any {
  return {
    name: "gemini_generate_video",
    label: "Gemini Generate Video",
    description:
      "Generate a video using Google's Veo model. The tool polls automatically until the video is ready (up to 5 minutes by default), then downloads and saves it. Returns the file path to the generated video.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Text description of the video to generate." }),
      save_dir: Type.String({ description: "Directory to save the generated video." }),
      model: Type.Optional(
        Type.String({
          description: 'Model to use. Default: "veo-3.1-generate-preview".',
        }),
      ),
      aspect_ratio: Type.Optional(
        Type.String({
          description: 'Aspect ratio. Options: "16:9" (default), "9:16".',
        }),
      ),
      duration_seconds: Type.Optional(
        Type.Number({
          description: "Video duration in seconds. Options: 4, 6, or 8.",
        }),
      ),
      person_generation: Type.Optional(
        Type.String({
          description:
            'Person generation policy. Options: "dont_allow", "allow_adult" (default).',
        }),
      ),
      timeout_seconds: Type.Optional(
        Type.Number({
          description:
            "Maximum time to wait for video generation in seconds. Default: 300 (5 minutes).",
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
        duration_seconds?: number;
        person_generation?: string;
        timeout_seconds?: number;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);

      const ai = client.getClient();
      const apiKey = client.getApiKey();
      const model = params.model ?? "veo-3.1-generate-preview";
      const timeoutMs = (params.timeout_seconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: Record<string, any> = { numberOfVideos: 1 };
        if (params.aspect_ratio) config.aspectRatio = params.aspect_ratio;
        if (params.duration_seconds) config.durationSeconds = String(params.duration_seconds);
        if (params.person_generation) config.personGeneration = params.person_generation;

        let operation = await ai.models.generateVideos({
          model,
          prompt: params.prompt,
          config,
        });

        // Poll until done or timeout
        const deadline = Date.now() + timeoutMs;
        while (!operation.done) {
          if (Date.now() > deadline) {
            return jsonResult({
              error: "timeout",
              message: `Video generation did not complete within ${params.timeout_seconds ?? DEFAULT_TIMEOUT_SECONDS} seconds. Try again later or increase timeout_seconds.`,
            });
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          operation = await ai.operations.getVideosOperation({ operation });
        }

        // Check for errors
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((operation as any).error) {
          return jsonResult({
            error: "generation_failed",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            details: (operation as any).error,
          });
        }

        const videos = operation.response?.generatedVideos;
        if (!videos || videos.length === 0) {
          return jsonResult({
            error: "no_video",
            message: "No video was generated. The prompt may have been filtered by safety policies.",
          });
        }

        ensureDir(params.save_dir);
        const timestamp = Date.now();
        const savedFiles: Array<{ path: string; mime_type: string; size: number }> = [];

        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const videoUri = (video as any)?.video?.uri;
          if (!videoUri) continue;

          const filename = `gemini-video-${timestamp}${videos.length > 1 ? `-${i}` : ""}.mp4`;
          const filePath = path.join(params.save_dir, filename);

          // Download video via authenticated fetch
          const videoUrl = `${videoUri}&key=${apiKey}`;
          const resp = await fetch(videoUrl);
          if (!resp.ok) {
            return jsonResult({
              error: "download_failed",
              message: `Failed to download video: ${resp.status} ${resp.statusText}`,
            });
          }
          const buffer = Buffer.from(await resp.arrayBuffer());
          writeFileSync(filePath, buffer);

          savedFiles.push({
            path: filePath,
            mime_type: "video/mp4",
            size: buffer.length,
          });
        }

        if (savedFiles.length === 0) {
          return jsonResult({
            error: "download_failed",
            message: "Video was generated but could not be downloaded.",
          });
        }

        return jsonResult({
          videos: savedFiles,
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
