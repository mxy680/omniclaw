import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";
import { extractEntities, bestImageUrl, buildEntityMap } from "./linkedin-utils.js";

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
  action: "Call linkedin_auth_setup to authenticate with LinkedIn first.",
};

interface MediaItem {
  type: "image" | "video";
  url: string;
}

/**
 * Extract media URLs from a single feed update entity and the shared included array.
 *
 * LinkedIn Voyager encodes media in a few different shapes depending on the post type:
 *
 * 1. `update.content.images` — array of objects, each with a `vectorImage` field
 *    (com.linkedin.common.VectorImage or plain VectorImage).
 * 2. `update.content["com.linkedin.voyager.feed.render.ImageComponent"]` — single
 *    image component with an `images` sub-array.
 * 3. `update.content.videoComponent` — object whose `progressiveStreams[0].streamingLocations[0].url`
 *    is the playable video URL.
 * 4. Included entities whose `$type` contains "Image" and whose `entityUrn` is
 *    referenced by `update.content.*Image*` or `update.*imageUrns*` arrays.
 */
function extractMediaFromUpdate(
  update: Record<string, unknown>,
  entityMap: Record<string, Record<string, unknown>>,
): MediaItem[] {
  const media: MediaItem[] = new Array<MediaItem>();

  const content = update.content as Record<string, unknown> | undefined;

  // ── 1. Inline images array at update.content.images ──────────────────────
  if (content) {
    const inlineImages = content.images as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(inlineImages)) {
      for (const img of inlineImages) {
        // Voyager wraps vectorImage under a namespaced key or a plain key
        const vectorImage =
          (img["com.linkedin.common.VectorImage"] as Record<string, unknown> | undefined) ??
          (img.vectorImage as Record<string, unknown> | undefined) ??
          (img as Record<string, unknown>);
        const url = bestImageUrl(vectorImage);
        if (url) media.push({ type: "image", url });
      }
    }

    // ── 2. ImageComponent wrapper ──────────────────────────────────────────
    // Looks like: content["com.linkedin.voyager.feed.render.ImageComponent"].images[...]
    for (const key of Object.keys(content)) {
      if (key.includes("ImageComponent")) {
        const component = content[key] as Record<string, unknown> | undefined;
        const componentImages = component?.images as
          | Array<Record<string, unknown>>
          | undefined;
        if (Array.isArray(componentImages)) {
          for (const img of componentImages) {
            const vectorImage =
              (img["com.linkedin.common.VectorImage"] as Record<string, unknown> | undefined) ??
              (img.vectorImage as Record<string, unknown> | undefined) ??
              (img as Record<string, unknown>);
            const url = bestImageUrl(vectorImage);
            if (url) media.push({ type: "image", url });
          }
        }
      }
    }

    // ── 3. Video component ─────────────────────────────────────────────────
    // Looks like: content.videoComponent.progressiveStreams[0].streamingLocations[0].url
    // or: content["com.linkedin.voyager.feed.render.VideoComponent"].videoPlayMetadata...
    const rawVideoComponent =
      (content.videoComponent as Record<string, unknown> | undefined) ??
      (() => {
        for (const key of Object.keys(content)) {
          if (key.includes("VideoComponent") || key.includes("videoComponent")) {
            return content[key] as Record<string, unknown> | undefined;
          }
        }
        return undefined;
      })();

    if (rawVideoComponent) {
      const videoUrl = extractVideoUrl(rawVideoComponent);
      if (videoUrl) media.push({ type: "video", url: videoUrl });
    }
  }

  // ── 4. Resolve URN references in imageUrns / *ImageUrns arrays ────────────
  // Some updates carry a flat array of URNs that resolve to Image entities.
  for (const key of Object.keys(update)) {
    if (key.toLowerCase().includes("imageurn")) {
      const urns = update[key] as unknown;
      const urnArray = Array.isArray(urns) ? urns : typeof urns === "string" ? [urns] : [];
      for (const urn of urnArray) {
        if (typeof urn !== "string") continue;
        const entity = entityMap[urn];
        if (!entity) continue;
        const vectorImage =
          (entity["com.linkedin.common.VectorImage"] as Record<string, unknown> | undefined) ??
          (entity.vectorImage as Record<string, unknown> | undefined) ??
          (entity as Record<string, unknown>);
        const url = bestImageUrl(vectorImage);
        if (url) media.push({ type: "image", url });
      }
    }
  }

  // ── 5. Scan all included Image entities associated with this update's URN ──
  // Some posts attach images via entities typed "Image" (e.g. VectorImage entities)
  // whose parentUrn or mediaUrn points back to the update. We do a broad scan
  // across all Image-typed entities in the map and keep only those whose
  // vectorImage yields a URL (deduplicating against what we already have).
  const existingUrls = new Set(media.map((m) => m.url));
  for (const entity of Object.values(entityMap)) {
    const typeStr = entity.$type as string | undefined;
    if (!typeStr || !typeStr.includes("Image")) continue;
    // Only consider entities that actually have vectorImage data
    const vectorImage =
      (entity["com.linkedin.common.VectorImage"] as Record<string, unknown> | undefined) ??
      (entity.vectorImage as Record<string, unknown> | undefined);
    if (!vectorImage) continue;
    // Must be referenced from this update (check mediaUrn or parentUrn)
    const parentUrn =
      (entity.mediaUrn as string | undefined) ??
      (entity.parentUrn as string | undefined) ??
      (entity.ownerUrn as string | undefined);
    if (
      parentUrn &&
      typeof update.entityUrn === "string" &&
      !update.entityUrn.includes(parentUrn) &&
      !parentUrn.includes(update.entityUrn as string)
    ) {
      continue;
    }
    const url = bestImageUrl(vectorImage);
    if (url && !existingUrls.has(url)) {
      media.push({ type: "image", url });
      existingUrls.add(url);
    }
  }

  return media;
}

/**
 * Walk a videoComponent object to find a playable streaming URL.
 * LinkedIn nests video URLs in progressiveStreams or adaptiveStreams.
 */
function extractVideoUrl(videoComponent: Record<string, unknown>): string | null {
  // Direct videoPlayMetadata path (common in newer Voyager responses)
  const playMetadata = videoComponent.videoPlayMetadata as
    | Record<string, unknown>
    | undefined;
  if (playMetadata) {
    const streams = playMetadata.progressiveStreams as
      | Array<Record<string, unknown>>
      | undefined;
    if (Array.isArray(streams) && streams.length > 0) {
      const locations = streams[0].streamingLocations as
        | Array<Record<string, unknown>>
        | undefined;
      if (Array.isArray(locations) && locations.length > 0) {
        const url = locations[0].url as string | undefined;
        if (url) return url;
      }
    }
    // Fallback: adaptiveStreams
    const adaptive = playMetadata.adaptiveStreams as
      | Array<Record<string, unknown>>
      | undefined;
    if (Array.isArray(adaptive) && adaptive.length > 0) {
      const masterUrl = adaptive[0].masterPlaylists as
        | Array<Record<string, unknown>>
        | undefined;
      if (Array.isArray(masterUrl) && masterUrl.length > 0) {
        const url = masterUrl[0].url as string | undefined;
        if (url) return url;
      }
    }
  }

  // Older structure: progressiveStreams directly on the component
  const streams = videoComponent.progressiveStreams as
    | Array<Record<string, unknown>>
    | undefined;
  if (Array.isArray(streams) && streams.length > 0) {
    const locations = streams[0].streamingLocations as
      | Array<Record<string, unknown>>
      | undefined;
    if (Array.isArray(locations) && locations.length > 0) {
      const url = locations[0].url as string | undefined;
      if (url) return url;
    }
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInFeedTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_feed",
    label: "LinkedIn Feed",
    description:
      "Get posts from the user's LinkedIn feed. Returns recent feed updates with author info, text content, engagement metrics, and media URLs (images/videos) that can be downloaded with linkedin_download_media.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of posts to retrieve (default 10, max 50).",
          default: 10,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { count?: number; account?: string }) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 10, 50);
        const data = (await linkedinManager.get(
          account,
          "graphql",
          undefined,
          `queryId=voyagerFeedDashMainFeed.923020905727c01516495a0ac90bb475&variables=(start:0,count:${count},sortOrder:RELEVANCE)`,
        )) as { included?: Array<Record<string, unknown>> };

        const updates = extractEntities(data.included, "Update");
        const miniProfiles = extractEntities(data.included, "MiniProfile");
        const commentaries = extractEntities(data.included, "Commentary");

        // Build a profile lookup by URN
        const profileMap = new Map<string, Record<string, unknown>>();
        for (const p of miniProfiles) {
          if (typeof p.entityUrn === "string") {
            profileMap.set(p.entityUrn, p);
          }
        }

        // Build a full entity map for media URL resolution (keyed by entityUrn)
        const entityMap = buildEntityMap(data.included);

        const posts = updates.slice(0, count).map((update) => {
          // Extract text content from commentary
          const actorUrn = update.actor as string | undefined;
          const actor = actorUrn ? profileMap.get(actorUrn) : undefined;

          // Try to find associated commentary
          const commentary = commentaries.find((c) => {
            const urn = c.entityUrn as string | undefined;
            return (
              urn &&
              update.entityUrn &&
              typeof update.entityUrn === "string" &&
              urn.includes(update.entityUrn as string)
            );
          });

          const textContent =
            (update.commentary as Record<string, unknown>)?.text ??
            (commentary as Record<string, unknown> | undefined)?.text ??
            update.text;

          // Extract media (images and videos) from this update
          const mediaUrls = extractMediaFromUpdate(update, entityMap);

          return {
            entityUrn: update.entityUrn,
            text: textContent,
            author: actor
              ? {
                  name: `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim(),
                  headline: actor.occupation,
                  publicIdentifier: actor.publicIdentifier,
                }
              : null,
            numLikes: update.numLikes ?? update.totalSocialActivityCounts
              ? ((update.totalSocialActivityCounts as Record<string, unknown>)?.numLikes ?? 0)
              : 0,
            numComments: update.numComments ?? update.totalSocialActivityCounts
              ? ((update.totalSocialActivityCounts as Record<string, unknown>)?.numComments ?? 0)
              : 0,
            // Array of { type: "image" | "video", url: string }; empty when the post has no media.
            // Pass any URL to linkedin_download_media to save it to disk.
            media: mediaUrls,
          };
        });

        return jsonResult({ count: posts.length, posts });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
