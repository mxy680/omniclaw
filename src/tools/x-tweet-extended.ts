import { readFileSync } from "fs";
import { Type } from "@sinclair/typebox";
import { type XClientManager, X_BEARER_TOKEN } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED, QUERY_IDS } from "./x-utils.js";

/**
 * Upload media via X's chunked upload API (INIT → APPEND → FINALIZE),
 * returning the media_id_string on success.
 */
async function uploadMedia(
  session: { auth_token: string; ct0: string; cookie_details?: Record<string, string> },
  imageData: Buffer,
  mediaType: string,
): Promise<string> {
  const baseUrl = "https://upload.twitter.com/i/media/upload.json";

  const authHeaders = {
    Authorization: `Bearer ${X_BEARER_TOKEN}`,
    "x-csrf-token": session.ct0,
    Cookie: `auth_token=${session.auth_token}; ct0=${session.ct0}`,
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": "en",
  };

  // INIT — register the upload and obtain a media_id
  const initParams = new URLSearchParams({
    command: "INIT",
    total_bytes: String(imageData.length),
    media_type: mediaType,
  });
  const initResp = await fetch(`${baseUrl}?${initParams}`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!initResp.ok) {
    const text = await initResp.text();
    throw new Error(`Media upload INIT failed: ${initResp.status} — ${text.slice(0, 300)}`);
  }
  const initData = (await initResp.json()) as { media_id_string: string };
  const mediaId = initData.media_id_string;

  // APPEND — upload the raw bytes (base64-encoded) as segment 0
  const formData = new FormData();
  formData.append("command", "APPEND");
  formData.append("media_id", mediaId);
  formData.append("segment_index", "0");
  formData.append("media_data", imageData.toString("base64"));
  const appendResp = await fetch(baseUrl, {
    method: "POST",
    headers: authHeaders,
    body: formData,
  });
  if (!appendResp.ok && appendResp.status !== 204) {
    const text = await appendResp.text();
    throw new Error(`Media upload APPEND failed: ${appendResp.status} — ${text.slice(0, 300)}`);
  }

  // FINALIZE — commit the upload so X processes the media
  const finalizeParams = new URLSearchParams({ command: "FINALIZE", media_id: mediaId });
  const finalizeResp = await fetch(`${baseUrl}?${finalizeParams}`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!finalizeResp.ok) {
    const text = await finalizeResp.text();
    throw new Error(`Media upload FINALIZE failed: ${finalizeResp.status} — ${text.slice(0, 300)}`);
  }

  return mediaId;
}

/** Infer MIME type from a file extension (lowercase). */
function mediaTypeFromExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
  };
  return map[ext] ?? "image/jpeg";
}

// ---------------------------------------------------------------------------
// Tool: x_post_media_tweet
// ---------------------------------------------------------------------------

export function createXPostMediaTweetTool(manager: XClientManager) {
  return {
    name: "x_post_media_tweet",
    label: "X Post Media Tweet",
    description: "Post a tweet with images on X (Twitter). Upload up to 4 images.",
    parameters: Type.Object({
      text: Type.String({ description: "The tweet text." }),
      file_paths: Type.Array(
        Type.String({ description: "Absolute path to an image file." }),
        { description: "Image file paths (max 4)." },
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { text: string; file_paths: string[]; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const session = manager.getCredentials(account)!;

      try {
        if (params.file_paths.length === 0) {
          return jsonResult({ error: "Provide at least one file path." });
        }
        if (params.file_paths.length > 4) {
          return jsonResult({ error: "X supports at most 4 images per tweet." });
        }

        // Upload each image and collect media IDs
        const mediaIds: string[] = [];
        for (const filePath of params.file_paths) {
          const imageData = readFileSync(filePath);
          const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
          const mediaType = mediaTypeFromExt(ext);
          const mediaId = await uploadMedia(session, imageData, mediaType);
          mediaIds.push(mediaId);
        }

        const variables = {
          tweet_text: params.text,
          dark_request: false,
          media: {
            media_entities: mediaIds.map((id) => ({ media_id: id, tagged_users: [] })),
            possibly_sensitive: false,
          },
          semantic_annotation_ids: [],
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await manager.graphqlPost(
          account,
          "CreateTweet",
          QUERY_IDS.CreateTweet,
          variables,
        )) as any;

        const result = data?.data?.create_tweet?.tweet_results?.result;
        const legacy = result?.legacy;
        if (!result && data?.errors) {
          const errMsg = (data.errors as Array<{ message?: string }>)?.[0]?.message;
          return jsonResult({ error: errMsg ?? "CreateTweet returned errors", errors: data.errors });
        }
        return jsonResult({
          status: "posted",
          tweet_id: legacy?.id_str ?? result?.rest_id,
          text: legacy?.full_text ?? params.text,
          media_count: mediaIds.length,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tool: x_quote_tweet
// ---------------------------------------------------------------------------

export function createXQuoteTweetTool(manager: XClientManager) {
  return {
    name: "x_quote_tweet",
    label: "X Quote Tweet",
    description: "Quote-tweet another tweet on X (Twitter).",
    parameters: Type.Object({
      tweet_id: Type.String({ description: "The ID of the tweet to quote." }),
      text: Type.String({ description: "Your commentary to accompany the quoted tweet." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { tweet_id: string; text: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const variables = {
        tweet_text: params.text,
        dark_request: false,
        // attachment_url causes X to embed the quoted tweet card
        attachment_url: `https://x.com/i/status/${params.tweet_id}`,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: [],
      };

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await manager.graphqlPost(
          account,
          "CreateTweet",
          QUERY_IDS.CreateTweet,
          variables,
        )) as any;

        const result = data?.data?.create_tweet?.tweet_results?.result;
        const legacy = result?.legacy;
        if (!result && data?.errors) {
          const errMsg = (data.errors as Array<{ message?: string }>)?.[0]?.message;
          return jsonResult({ error: errMsg ?? "CreateTweet returned errors", errors: data.errors });
        }
        return jsonResult({
          status: "quoted",
          tweet_id: legacy?.id_str ?? result?.rest_id,
          quoted_tweet_id: params.tweet_id,
          text: legacy?.full_text ?? params.text,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tool: x_post_thread
// ---------------------------------------------------------------------------

export function createXPostThreadTool(manager: XClientManager) {
  return {
    name: "x_post_thread",
    label: "X Post Thread",
    description: "Post a thread (multiple connected tweets) on X (Twitter).",
    parameters: Type.Object({
      tweets: Type.Array(
        Type.String({ description: "Text for one tweet in the thread." }),
        {
          description: "Array of tweet texts in order. Each becomes one tweet in the thread.",
          minItems: 2,
        },
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { tweets: string[]; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      if (params.tweets.length < 2) {
        return jsonResult({ error: "A thread requires at least 2 tweets." });
      }

      try {
        const tweetIds: string[] = [];

        // Post the first tweet without a reply context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firstData = (await manager.graphqlPost(
          account,
          "CreateTweet",
          QUERY_IDS.CreateTweet,
          {
            tweet_text: params.tweets[0],
            dark_request: false,
            media: { media_entities: [], possibly_sensitive: false },
            semantic_annotation_ids: [],
          },
        )) as any;

        const firstResult = firstData?.data?.create_tweet?.tweet_results?.result;
        const firstId: string = firstResult?.legacy?.id_str ?? firstResult?.rest_id;
        if (!firstId) throw new Error("Failed to obtain tweet ID for the first tweet.");
        tweetIds.push(firstId);

        // Post each subsequent tweet as a reply to the previous one
        let prevId = firstId;
        for (let i = 1; i < params.tweets.length; i++) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const replyData = (await manager.graphqlPost(
            account,
            "CreateTweet",
            QUERY_IDS.CreateTweet,
            {
              tweet_text: params.tweets[i],
              dark_request: false,
              reply: { in_reply_to_tweet_id: prevId, exclude_reply_user_ids: [] },
              media: { media_entities: [], possibly_sensitive: false },
              semantic_annotation_ids: [],
            },
          )) as any;

          const replyResult = replyData?.data?.create_tweet?.tweet_results?.result;
          const replyId: string = replyResult?.legacy?.id_str ?? replyResult?.rest_id;
          if (!replyId) throw new Error(`Failed to obtain tweet ID for tweet ${i + 1} in thread.`);
          tweetIds.push(replyId);
          prevId = replyId;
        }

        return jsonResult({
          status: "thread_posted",
          tweet_ids: tweetIds,
          count: tweetIds.length,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tool: x_post_poll
// ---------------------------------------------------------------------------

export function createXPostPollTool(manager: XClientManager) {
  return {
    name: "x_post_poll",
    label: "X Post Poll",
    description: "Post a tweet with a poll on X (Twitter).",
    parameters: Type.Object({
      text: Type.String({ description: "The tweet text to accompany the poll." }),
      choices: Type.Array(
        Type.String({ description: "A poll option text." }),
        { description: "Poll choices (2-4 options).", minItems: 2, maxItems: 4 },
      ),
      duration_minutes: Type.Optional(
        Type.Number({
          description: "Poll duration in minutes. Defaults to 1440 (24 hours).",
          default: 1440,
        }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        text: string;
        choices: string[];
        duration_minutes?: number;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const { choices, duration_minutes = 1440 } = params;
      if (choices.length < 2 || choices.length > 4) {
        return jsonResult({ error: "Poll requires 2-4 choices." });
      }

      const session = manager.getCredentials(account)!;

      try {
        // Build the Twitter Card data object that defines the poll structure.
        // The key format twitter:string:choice{N}_label is X's internal schema.
        const cardData: Record<string, string> = {
          "twitter:api:api:endpoint": "1",
          "twitter:card": `poll${choices.length}choice_text_only`,
          "twitter:long:duration_minutes": String(duration_minutes),
        };
        choices.forEach((choice, i) => {
          cardData[`twitter:string:choice${i + 1}_label`] = choice;
        });

        const restHeaders = {
          Authorization: `Bearer ${X_BEARER_TOKEN}`,
          "x-csrf-token": session.ct0,
          Cookie: `auth_token=${session.auth_token}; ct0=${session.ct0}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel MacOS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "x-twitter-active-user": "yes",
          "x-twitter-auth-type": "OAuth2Session",
          "x-twitter-client-language": "en",
        };

        // Create the Twitter Card first — this returns a card_uri ("card://...")
        // which is then attached to the tweet to render the poll UI.
        const cardBody = new URLSearchParams({
          card_data: JSON.stringify(cardData),
        });
        const cardResp = await fetch("https://caps.twitter.com/v2/cards/create.json", {
          method: "POST",
          headers: restHeaders,
          body: cardBody.toString(),
        });
        if (!cardResp.ok) {
          const text = await cardResp.text();
          throw new Error(`Poll card creation failed: ${cardResp.status} — ${text.slice(0, 300)}`);
        }
        const cardJson = (await cardResp.json()) as { card_uri: string };
        const cardUri = cardJson.card_uri;

        // Post the tweet with the card_uri attached
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await manager.graphqlPost(
          account,
          "CreateTweet",
          QUERY_IDS.CreateTweet,
          {
            tweet_text: params.text,
            dark_request: false,
            card_uri: cardUri,
            media: { media_entities: [], possibly_sensitive: false },
            semantic_annotation_ids: [],
          },
        )) as any;

        const result = data?.data?.create_tweet?.tweet_results?.result;
        const legacy = result?.legacy;
        if (!result && data?.errors) {
          const errMsg = (data.errors as Array<{ message?: string }>)?.[0]?.message;
          return jsonResult({ error: errMsg ?? "CreateTweet returned errors", errors: data.errors });
        }
        return jsonResult({
          status: "posted_with_poll",
          tweet_id: legacy?.id_str ?? result?.rest_id,
          text: legacy?.full_text ?? params.text,
          choices,
          duration_minutes,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
