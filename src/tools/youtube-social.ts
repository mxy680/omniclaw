import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { parseVideoId } from "./youtube-utils.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("youtube");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createYouTubeChannelInfoTool(clientManager: OAuthClientManager): any {
  return {
    name: "youtube_channel_info",
    label: "YouTube Channel Info",
    description:
      "Get details about a YouTube channel: name, description, subscriber count, video count, view count, and custom URL. Accepts a channel ID (starts with 'UC') or a channel handle (e.g. '@mkbhd').",
    parameters: Type.Object({
      channel: Type.String({
        description:
          "Channel ID (e.g. 'UCXuqSBlHAE6Xw-yeJA0Tunw') or handle (e.g. '@LinusTechTips').",
      }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { channel: string; account?: string }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const yt = google.youtube({ version: "v3", auth: client });

      try {
        const isHandle = params.channel.startsWith("@");
        const isChannelId = params.channel.startsWith("UC");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const request: any = {
          part: ["snippet", "statistics", "brandingSettings"],
        };

        if (isHandle) {
          request.forHandle = params.channel;
        } else if (isChannelId) {
          request.id = [params.channel];
        } else {
          // Try as username
          request.forUsername = params.channel;
        }

        const res = await yt.channels.list(request);

        const item = res.data.items?.[0];
        if (!item) {
          return jsonResult({
            error: "not_found",
            message: `No channel found for: ${params.channel}`,
          });
        }

        return jsonResult({
          channelId: item.id ?? "",
          title: item.snippet?.title ?? "",
          description: item.snippet?.description ?? "",
          customUrl: item.snippet?.customUrl ?? "",
          publishedAt: item.snippet?.publishedAt ?? "",
          subscriberCount: item.statistics?.subscriberCount ?? "0",
          videoCount: item.statistics?.videoCount ?? "0",
          viewCount: item.statistics?.viewCount ?? "0",
          thumbnail:
            item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
          country: item.snippet?.country ?? "",
        });
      } catch (err) {
        return jsonResult({
          error: "channel_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createYouTubeVideoCommentsTool(clientManager: OAuthClientManager): any {
  return {
    name: "youtube_video_comments",
    label: "YouTube Video Comments",
    description:
      "Read top-level comments on a YouTube video. Returns comment text, author, like count, and publish date. Accepts a video ID or full YouTube URL.",
    parameters: Type.Object({
      video: Type.String({
        description:
          "YouTube video ID or URL (e.g. 'dQw4w9WgXcQ' or 'https://www.youtube.com/watch?v=dQw4w9WgXcQ').",
      }),
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of comments (1–100). Defaults to 20.",
          default: 20,
        }),
      ),
      order: Type.Optional(
        Type.String({
          description: "Sort order: 'relevance' (default) or 'time'.",
          default: "relevance",
        }),
      ),
      page_token: Type.Optional(
        Type.String({ description: "Token for the next page of comments (from a previous response's nextPageToken)." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { video: string; max_results?: number; order?: string; page_token?: string; account?: string },
    ) {
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
        const res = await yt.commentThreads.list({
          part: ["snippet"],
          videoId,
          maxResults: Math.min(params.max_results ?? 20, 100),
          order: params.order ?? "relevance",
          textFormat: "plainText",
          ...(params.page_token ? { pageToken: params.page_token } : {}),
        });

        const comments = (res.data.items ?? []).map((item) => {
          const comment = item.snippet?.topLevelComment?.snippet;
          return {
            author: comment?.authorDisplayName ?? "",
            authorChannelId: comment?.authorChannelId?.value ?? "",
            text: comment?.textDisplay ?? "",
            likeCount: comment?.likeCount ?? 0,
            publishedAt: comment?.publishedAt ?? "",
            updatedAt: comment?.updatedAt ?? "",
            totalReplyCount: item.snippet?.totalReplyCount ?? 0,
          };
        });

        return jsonResult({
          videoId,
          commentCount: comments.length,
          comments,
          ...(res.data.nextPageToken ? { nextPageToken: res.data.nextPageToken } : {}),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Comments may be disabled on the video
        if (message.includes("commentsDisabled") || message.includes("403")) {
          return jsonResult({
            error: "comments_disabled",
            message: "Comments are disabled on this video.",
          });
        }
        return jsonResult({
          error: "comments_failed",
          message,
        });
      }
    },
  };
}
