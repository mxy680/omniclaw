import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("youtube");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createYouTubePlaylistsListTool(clientManager: OAuthClientManager): any {
  return {
    name: "youtube_playlists_list",
    label: "YouTube List Playlists",
    description:
      "List playlists for the authenticated user or a specific channel. Returns playlist ID, title, description, item count, and thumbnail.",
    parameters: Type.Object({
      channel_id: Type.Optional(
        Type.String({
          description:
            "Channel ID to list playlists for. Omit to list the authenticated user's playlists.",
        }),
      ),
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of playlists (1–50). Defaults to 25.",
          default: 25,
        }),
      ),
      page_token: Type.Optional(
        Type.String({ description: "Token for the next page of results." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { channel_id?: string; max_results?: number; page_token?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const yt = google.youtube({ version: "v3", auth: client });

      try {
        const res = await yt.playlists.list({
          part: ["snippet", "contentDetails"],
          ...(params.channel_id ? { channelId: params.channel_id } : { mine: true }),
          maxResults: Math.min(params.max_results ?? 25, 50),
          ...(params.page_token ? { pageToken: params.page_token } : {}),
        });

        const playlists = (res.data.items ?? []).map((item) => ({
          playlistId: item.id ?? "",
          title: item.snippet?.title ?? "",
          description: item.snippet?.description ?? "",
          channelTitle: item.snippet?.channelTitle ?? "",
          publishedAt: item.snippet?.publishedAt ?? "",
          itemCount: item.contentDetails?.itemCount ?? 0,
          thumbnail:
            item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
        }));

        return jsonResult({
          playlists,
          ...(res.data.nextPageToken ? { nextPageToken: res.data.nextPageToken } : {}),
        });
      } catch (err) {
        return jsonResult({
          error: "playlists_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createYouTubePlaylistItemsTool(clientManager: OAuthClientManager): any {
  return {
    name: "youtube_playlist_items",
    label: "YouTube Playlist Items",
    description:
      "List videos in a YouTube playlist. Returns video IDs, titles, positions, and thumbnails.",
    parameters: Type.Object({
      playlist_id: Type.String({ description: "The YouTube playlist ID." }),
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of items (1–50). Defaults to 25.",
          default: 25,
        }),
      ),
      page_token: Type.Optional(
        Type.String({ description: "Token for the next page of results." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { playlist_id: string; max_results?: number; page_token?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const yt = google.youtube({ version: "v3", auth: client });

      try {
        const res = await yt.playlistItems.list({
          part: ["snippet", "contentDetails"],
          playlistId: params.playlist_id,
          maxResults: Math.min(params.max_results ?? 25, 50),
          ...(params.page_token ? { pageToken: params.page_token } : {}),
        });

        const items = (res.data.items ?? []).map((item) => ({
          videoId: item.contentDetails?.videoId ?? "",
          title: item.snippet?.title ?? "",
          description: item.snippet?.description ?? "",
          channelTitle: item.snippet?.videoOwnerChannelTitle ?? "",
          position: item.snippet?.position ?? 0,
          publishedAt: item.snippet?.publishedAt ?? "",
          thumbnail:
            item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
        }));

        return jsonResult({
          playlistId: params.playlist_id,
          items,
          totalResults: res.data.pageInfo?.totalResults ?? items.length,
          ...(res.data.nextPageToken ? { nextPageToken: res.data.nextPageToken } : {}),
        });
      } catch (err) {
        return jsonResult({
          error: "playlist_items_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createYouTubePlaylistCreateTool(clientManager: OAuthClientManager): any {
  return {
    name: "youtube_playlist_create",
    label: "YouTube Create Playlist",
    description:
      "Create a new YouTube playlist for the authenticated user.",
    parameters: Type.Object({
      title: Type.String({ description: "Playlist title." }),
      description: Type.Optional(
        Type.String({ description: "Playlist description." }),
      ),
      privacy: Type.Optional(
        Type.String({
          description: "Privacy status: 'public', 'unlisted', or 'private'. Defaults to 'private'.",
          default: "private",
        }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { title: string; description?: string; privacy?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const yt = google.youtube({ version: "v3", auth: client });

      try {
        const res = await yt.playlists.insert({
          part: ["snippet", "status"],
          requestBody: {
            snippet: {
              title: params.title,
              ...(params.description ? { description: params.description } : {}),
            },
            status: {
              privacyStatus: params.privacy ?? "private",
            },
          },
        });

        const pl = res.data;
        return jsonResult({
          playlistId: pl.id ?? "",
          title: pl.snippet?.title ?? "",
          description: pl.snippet?.description ?? "",
          privacyStatus: pl.status?.privacyStatus ?? "",
          channelId: pl.snippet?.channelId ?? "",
          success: true,
        });
      } catch (err) {
        return jsonResult({
          error: "playlist_create_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
