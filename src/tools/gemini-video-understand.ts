import { Type } from "@sinclair/typebox";
import { existsSync, statSync } from "fs";
import { extname } from "path";
import type { GeminiClientManager } from "../auth/gemini-client-manager";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGeminiAnalyzeVideoTool(manager: GeminiClientManager): any {
  return {
    name: "gemini_analyze_video",
    label: "Gemini Analyze Video",
    description:
      "Upload and analyze a video file using Google Gemini. " +
      "The video is uploaded via the File API, then analyzed with a text prompt. " +
      "Useful for video understanding, transcription, content description, and Q&A about video content.",
    parameters: Type.Object({
      prompt: Type.String({ description: "Question or instruction about the video content." }),
      video_path: Type.String({ description: "Path to the video file to analyze." }),
      model: Type.Optional(
        Type.String({
          description: "Model to use. Default: gemini-2.5-flash.",
          default: "gemini-2.5-flash",
        })
      ),
      media_resolution: Type.Optional(
        Type.String({
          description: "Video processing resolution: 'low', 'medium', or 'high'. Default: 'medium'.",
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
        video_path: string;
        model?: string;
        media_resolution?: string;
        account?: string;
      }
    ) {
      const account = params.account ?? "default";
      if (!manager.hasKey(account)) {
        return jsonResult({ error: "auth_required", message: "Call gemini_auth_setup first." });
      }

      if (!existsSync(params.video_path)) {
        return jsonResult({ error: "file_not_found", message: `Video file not found: ${params.video_path}` });
      }

      const model = params.model ?? "gemini-2.5-flash";

      try {
        const ai = manager.getClient(account);

        const ext = extname(params.video_path).toLowerCase();
        const mimeMap: Record<string, string> = {
          ".mp4": "video/mp4",
          ".avi": "video/x-msvideo",
          ".mov": "video/quicktime",
          ".mkv": "video/x-matroska",
          ".webm": "video/webm",
          ".flv": "video/x-flv",
          ".wmv": "video/x-ms-wmv",
        };
        const mimeType = mimeMap[ext] ?? "video/mp4";

        const fileSize = statSync(params.video_path).size;
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);

        // Upload video via File API
        const uploadResult = await ai.files.upload({
          file: params.video_path,
          config: { mimeType },
        });

        // Wait for file to become ACTIVE
        let file = uploadResult;
        while (file.state === "PROCESSING") {
          await sleep(3000);
          file = await ai.files.get({ name: file.name! });
        }

        if (file.state === "FAILED") {
          return jsonResult({
            error: "upload_failed",
            message: "Video file processing failed.",
          });
        }

        // Build config
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: any = {};
        if (params.media_resolution) {
          config.mediaResolution = params.media_resolution;
        }

        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                {
                  fileData: {
                    fileUri: file.uri!,
                    mimeType: file.mimeType!,
                  },
                },
                { text: params.prompt },
              ],
            },
          ],
          config,
        });

        const analysis = response.candidates?.[0]?.content?.parts
          ?.map((p) => p.text)
          .filter(Boolean)
          .join("\n") ?? "";

        return jsonResult({
          analysis,
          model,
          file_size_mb: fileSizeMB,
        });
      } catch (err) {
        return jsonResult({
          error: "analysis_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
