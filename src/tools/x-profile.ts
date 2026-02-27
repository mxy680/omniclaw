import { readFileSync } from "fs";
import { Type } from "@sinclair/typebox";
import { type XClientManager, X_BEARER_TOKEN } from "../auth/x-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./x-utils.js";

/**
 * Build auth headers for REST v1.1 requests (form-urlencoded, not JSON).
 */
function restHeaders(session: { auth_token: string; ct0: string; cookie_details?: Record<string, string> }) {
  const cookieParts = [`auth_token=${session.auth_token}`, `ct0=${session.ct0}`];
  if (session.cookie_details) {
    for (const [key, value] of Object.entries(session.cookie_details)) {
      if (key !== "auth_token" && key !== "ct0") cookieParts.push(`${key}=${value}`);
    }
  }
  return {
    Authorization: `Bearer ${X_BEARER_TOKEN}`,
    "x-csrf-token": session.ct0,
    Cookie: cookieParts.join("; "),
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": "en",
  };
}

/**
 * Upload media via X's chunked upload API, returning the media_id string.
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
    Cookie: [`auth_token=${session.auth_token}`, `ct0=${session.ct0}`].join("; "),
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": "en",
  };

  // INIT
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

  // APPEND
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

  // FINALIZE
  const finalizeParams = new URLSearchParams({
    command: "FINALIZE",
    media_id: mediaId,
  });
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

export function createXUpdateProfileTool(manager: XClientManager) {
  return {
    name: "x_update_profile",
    label: "X Update Profile",
    description:
      "Update your X (Twitter) profile info. Only provide the fields you want to change — others remain unchanged.",
    parameters: Type.Object({
      name: Type.Optional(Type.String({ description: "Display name (max 50 chars)." })),
      description: Type.Optional(Type.String({ description: "Bio / description (max 160 chars)." })),
      location: Type.Optional(Type.String({ description: "Location text (max 30 chars)." })),
      url: Type.Optional(Type.String({ description: "Website URL." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { name?: string; description?: string; location?: string; url?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const session = manager.getCredentials(account)!;
      const body = new URLSearchParams();
      if (params.name !== undefined) body.set("name", params.name);
      if (params.description !== undefined) body.set("description", params.description);
      if (params.location !== undefined) body.set("location", params.location);
      if (params.url !== undefined) body.set("url", params.url);

      if ([...body.keys()].length === 0) {
        return jsonResult({ error: "Provide at least one field to update (name, description, location, url)." });
      }

      try {
        const resp = await fetch("https://api.x.com/1.1/account/update_profile.json", {
          method: "POST",
          headers: restHeaders(session),
          body: body.toString(),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Update profile failed: ${resp.status} — ${text.slice(0, 300)}`);
        }
        const data = (await resp.json()) as { name?: string; screen_name?: string; description?: string; location?: string };
        return jsonResult({
          status: "updated",
          name: data.name,
          screen_name: data.screen_name,
          description: data.description,
          location: data.location,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXUpdateProfileImageTool(manager: XClientManager) {
  return {
    name: "x_update_profile_image",
    label: "X Update Profile Image",
    description: "Update your X (Twitter) profile picture / avatar. Provide a local file path to the image (JPEG, PNG, or GIF, max 5 MB).",
    parameters: Type.Object({
      file_path: Type.String({ description: "Absolute path to the image file." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { file_path: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const session = manager.getCredentials(account)!;

      try {
        const imageData = readFileSync(params.file_path);
        const ext = params.file_path.split(".").pop()?.toLowerCase() ?? "";
        const mediaTypeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif" };
        const mediaType = mediaTypeMap[ext] ?? "image/jpeg";

        const mediaId = await uploadMedia(session, imageData, mediaType);

        const body = new URLSearchParams({ media_id: mediaId });
        const resp = await fetch("https://api.x.com/1.1/account/update_profile_image.json", {
          method: "POST",
          headers: restHeaders(session),
          body: body.toString(),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Update profile image failed: ${resp.status} — ${text.slice(0, 300)}`);
        }
        const data = (await resp.json()) as { profile_image_url_https?: string };
        return jsonResult({ status: "updated", profile_image_url: data.profile_image_url_https });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

export function createXUpdateProfileBannerTool(manager: XClientManager) {
  return {
    name: "x_update_profile_banner",
    label: "X Update Profile Banner",
    description: "Update your X (Twitter) profile banner / header image. Provide a local file path to the image (JPEG or PNG, max 5 MB, recommended 1500x500).",
    parameters: Type.Object({
      file_path: Type.String({ description: "Absolute path to the image file." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { file_path: string; account?: string }) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      const session = manager.getCredentials(account)!;

      try {
        const imageData = readFileSync(params.file_path);
        const ext = params.file_path.split(".").pop()?.toLowerCase() ?? "";
        const mediaTypeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
        const mediaType = mediaTypeMap[ext] ?? "image/jpeg";

        const mediaId = await uploadMedia(session, imageData, mediaType);

        const body = new URLSearchParams({ media_id: mediaId });
        const resp = await fetch("https://api.x.com/1.1/account/update_profile_banner.json", {
          method: "POST",
          headers: restHeaders(session),
          body: body.toString(),
        });
        // Banner endpoint returns 200 with empty body on success
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Update profile banner failed: ${resp.status} — ${text.slice(0, 300)}`);
        }
        return jsonResult({ status: "updated" });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
