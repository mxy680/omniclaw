import { Type } from "@sinclair/typebox";
import { statSync } from "fs";
import { join } from "path";
import { ensureDir, downloadUrl } from "./media-utils.js";
import { jsonResult } from "./shared.js";

const qualityMap: Record<string, string> = {
  default: "default",
  medium: "mqdefault",
  high: "hqdefault",
  sd: "sddefault",
  maxres: "maxresdefault",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createYouTubeDownloadThumbnailTool(): any {
  return {
    name: "youtube_download_thumbnail",
    label: "YouTube Download Thumbnail",
    description:
      "Download a YouTube video thumbnail to local disk. Supports different quality levels.",
    parameters: Type.Object({
      video_id: Type.String({
        description: "YouTube video ID (e.g. 'dQw4w9WgXcQ').",
      }),
      save_dir: Type.String({
        description: "Directory to save the thumbnail.",
      }),
      quality: Type.Optional(
        Type.String({
          description:
            "Thumbnail quality: 'default', 'medium' (mqdefault), 'high' (hqdefault), 'sd' (sddefault), 'maxres' (maxresdefault). Defaults to 'high'.",
          default: "high",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Not required for thumbnails but included for consistency.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { video_id: string; save_dir: string; quality?: string; account?: string },
    ) {
      try {
        const resolvedQuality = params.quality ?? "high";
        const qualitySlug = qualityMap[resolvedQuality] ?? qualityMap["high"];

        const url = `https://img.youtube.com/vi/${params.video_id}/${qualitySlug}.jpg`;

        ensureDir(params.save_dir);

        const filename = `youtube-thumb-${params.video_id}-${qualitySlug}.jpg`;
        const filepath = join(params.save_dir, filename);

        await downloadUrl(url, filepath);

        const size = statSync(filepath).size;

        return jsonResult({
          path: filepath,
          mimeType: "image/jpeg",
          video_id: params.video_id,
          quality: resolvedQuality,
          size,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
