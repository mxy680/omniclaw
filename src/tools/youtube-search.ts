import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { parseVideoId } from "./youtube-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call youtube_auth_setup to authenticate.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createYouTubeSearchTool(clientManager: OAuthClientManager): any {
  return {
    name: "youtube_search",
    label: "YouTube Search",
    description:
      "Search YouTube for videos by keyword or phrase. Returns video IDs, titles, channel names, descriptions, and publish dates. Use youtube_video_details for full metadata on a specific video.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query string." }),
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of results (1–50). Defaults to 10.",
          default: 10,
        }),
      ),
      order: Type.Optional(
        Type.String({
          description: "Sort order: 'relevance' (default), 'date', 'viewCount', 'rating'.",
          default: "relevance",
        }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; max_results?: number; order?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const yt = google.youtube({ version: "v3", auth: client });

      try {
        const res = await yt.search.list({
          part: ["snippet"],
          q: params.query,
          type: ["video"],
          maxResults: Math.min(params.max_results ?? 10, 50),
          order: params.order ?? "relevance",
        });

        const videos = (res.data.items ?? []).map((item) => ({
          videoId: item.id?.videoId ?? "",
          title: item.snippet?.title ?? "",
          channelTitle: item.snippet?.channelTitle ?? "",
          channelId: item.snippet?.channelId ?? "",
          description: item.snippet?.description ?? "",
          publishedAt: item.snippet?.publishedAt ?? "",
          thumbnail:
            item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
        }));

        return jsonResult({ query: params.query, results: videos });
      } catch (err) {
        return jsonResult({
          error: "search_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createYouTubeVideoDetailsTool(clientManager: OAuthClientManager): any {
  return {
    name: "youtube_video_details",
    label: "YouTube Video Details",
    description:
      "Get detailed metadata for a YouTube video: title, description, duration, view/like/comment counts, tags, channel info, and more. Accepts a video ID or full YouTube URL.",
    parameters: Type.Object({
      video: Type.String({
        description:
          "YouTube video ID or URL (e.g. 'dQw4w9WgXcQ' or 'https://www.youtube.com/watch?v=dQw4w9WgXcQ').",
      }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { video: string; account?: string }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const videoId = parseVideoId(params.video);
      if (!videoId) {
        return jsonResult({
          error: "invalid_video",
          message: "Could not parse a video ID from the input.",
        });
      }

      const client = clientManager.getClient(account);
      const yt = google.youtube({ version: "v3", auth: client });

      try {
        const res = await yt.videos.list({
          part: ["snippet", "contentDetails", "statistics"],
          id: [videoId],
        });

        const item = res.data.items?.[0];
        if (!item) {
          return jsonResult({ error: "not_found", message: `No video found for ID: ${videoId}` });
        }

        return jsonResult({
          videoId,
          title: item.snippet?.title ?? "",
          description: item.snippet?.description ?? "",
          channelTitle: item.snippet?.channelTitle ?? "",
          channelId: item.snippet?.channelId ?? "",
          publishedAt: item.snippet?.publishedAt ?? "",
          duration: item.contentDetails?.duration ?? "",
          tags: item.snippet?.tags ?? [],
          categoryId: item.snippet?.categoryId ?? "",
          viewCount: item.statistics?.viewCount ?? "0",
          likeCount: item.statistics?.likeCount ?? "0",
          commentCount: item.statistics?.commentCount ?? "0",
          thumbnail:
            item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
        });
      } catch (err) {
        return jsonResult({
          error: "details_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
