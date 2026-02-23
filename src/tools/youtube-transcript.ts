import { Type } from "@sinclair/typebox";
import { parseVideoId } from "./youtube-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createYouTubeTranscriptTool(): any {
  return {
    name: "youtube_get_transcript",
    label: "YouTube Get Transcript",
    description:
      "Get the transcript (captions/subtitles) of a YouTube video. Returns timestamped segments and full concatenated text. No authentication required — works with any public video that has captions enabled.",
    parameters: Type.Object({
      video: Type.String({
        description:
          "YouTube video ID or URL (e.g. 'dQw4w9WgXcQ' or 'https://www.youtube.com/watch?v=dQw4w9WgXcQ').",
      }),
      lang: Type.Optional(
        Type.String({
          description: "Language code for the transcript (e.g. 'en', 'es', 'fr'). Defaults to 'en'.",
          default: "en",
        })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { video: string; lang?: string }
    ) {
      const videoId = parseVideoId(params.video);
      if (!videoId) {
        return jsonResult({ error: "invalid_video", message: "Could not parse a video ID from the input." });
      }

      try {
        const { YoutubeTranscript } = await import("youtube-transcript");

        const segments = await YoutubeTranscript.fetchTranscript(videoId, {
          lang: params.lang ?? "en",
        });

        const fullText = segments.map((s) => s.text).join(" ");

        const timestamped = segments.map((s) => ({
          text: s.text,
          offset: s.offset,
          duration: s.duration,
        }));

        return jsonResult({
          videoId,
          language: params.lang ?? "en",
          segmentCount: timestamped.length,
          fullText,
          segments: timestamped,
        });
      } catch (err) {
        return jsonResult({
          error: "transcript_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
