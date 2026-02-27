import { readFileSync, existsSync } from "fs";
import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";
import { extractEntities } from "./linkedin-utils.js";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInCreatePostTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_create_post",
    label: "LinkedIn Create Post",
    description:
      "Create a new LinkedIn post. Supports text-only or text with an image (provide a local file path or URL). Returns the created post URN.",
    parameters: Type.Object({
      text: Type.String({
        description: "The post content/text.",
      }),
      image_path: Type.Optional(
        Type.String({
          description: "Local file path to an image to attach to the post.",
        }),
      ),
      image_url: Type.Optional(
        Type.String({
          description:
            "URL of an image to attach. The image will be downloaded and uploaded to LinkedIn.",
        }),
      ),
      visibility: Type.Optional(
        Type.String({
          description: "Post visibility: 'public' (default) or 'connections'.",
          default: "public",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        text: string;
        image_path?: string;
        image_url?: string;
        visibility?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        // Get user's member URN for the author field
        const meData = (await linkedinManager.get(account, "me")) as {
          included?: Array<Record<string, unknown>>;
        };
        const miniProfiles = extractEntities(meData.included, "MiniProfile");
        const myProfile = miniProfiles[0];
        const myUrn = (myProfile?.entityUrn as string) ?? "";
        const myMemberId = myUrn.split(":").pop() ?? "";

        if (!myMemberId) {
          return jsonResult({ error: "Could not resolve author profile. Re-authenticate and try again." });
        }

        const authorUrn = `urn:li:fsd_profile:${myMemberId}`;
        const visibilityValue =
          params.visibility === "connections"
            ? "CONNECTIONS"
            : "PUBLIC";

        // Determine if we need to upload an image
        let imageUrn: string | undefined;

        if (params.image_path || params.image_url) {
          let imageBuffer: Buffer;
          let mimeType = "image/png";

          if (params.image_path) {
            if (!existsSync(params.image_path)) {
              return jsonResult({ error: `Image file not found: ${params.image_path}` });
            }
            imageBuffer = readFileSync(params.image_path);
            // Infer MIME from extension
            const ext = params.image_path.toLowerCase().split(".").pop();
            if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
            else if (ext === "gif") mimeType = "image/gif";
            else if (ext === "webp") mimeType = "image/webp";
          } else {
            // Download from URL
            const resp = await fetch(params.image_url!);
            if (!resp.ok) {
              return jsonResult({ error: `Failed to download image: ${resp.status} ${resp.statusText}` });
            }
            const ct = resp.headers.get("content-type") ?? "image/png";
            mimeType = ct.split(";")[0].trim();
            imageBuffer = Buffer.from(await resp.arrayBuffer());
          }

          // Step 1: Register the image upload to get an upload URL
          const registerBody = {
            initializeUploadRequest: {
              owner: authorUrn,
              fileMediaType: mimeType,
            },
          };

          const registerData = (await linkedinManager.post(
            account,
            "voyagerVideoDashClientUpload",
            registerBody,
            { action: "initializeUpload" },
          )) as Record<string, unknown>;

          // Extract upload URL and image URN from the response
          const uploadData =
            (registerData.data as Record<string, unknown>) ?? registerData;
          const initResult =
            (uploadData.initializeUploadResponse ??
              uploadData["com.linkedin.voyager.dash.clientUpload.InitializeUploadResponse"] ??
              uploadData) as Record<string, unknown>;
          const uploadUrl = initResult.uploadUrl as string | undefined;
          imageUrn = initResult.image as string | undefined;

          if (uploadUrl && imageBuffer) {
            // Step 2: Upload the actual image binary via Playwright
            const session = linkedinManager.getCredentials(account)!;
            const { chromium } = await import("playwright");
            const browser = await chromium.launch({ headless: true });
            try {
              const context = await browser.newContext();
              const cookieObjects = session.cookie_details.map((c) => ({
                name: c.name,
                value: c.value,
                domain: c.domain || ".linkedin.com",
                path: c.path || "/",
              }));
              if (cookieObjects.length > 0) {
                await context.addCookies(cookieObjects);
              }
              const page = await context.newPage();
              await page.goto("https://www.linkedin.com", { waitUntil: "domcontentloaded" });

              // Convert image buffer to base64 for transfer into browser context
              const base64Image = imageBuffer.toString("base64");

              await page.evaluate(
                async ({ url, base64, mime, csrfToken }) => {
                  const binary = atob(base64);
                  const bytes = new Uint8Array(binary.length);
                  for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                  }
                  const resp = await fetch(url, {
                    method: "PUT",
                    headers: {
                      "Content-Type": mime,
                      "Csrf-Token": csrfToken,
                    },
                    credentials: "include",
                    body: bytes.buffer,
                  });
                  if (!resp.ok) {
                    throw new Error(`Image upload failed: ${resp.status} ${resp.statusText}`);
                  }
                },
                {
                  url: uploadUrl,
                  base64: base64Image,
                  mime: mimeType,
                  csrfToken: session.csrf_token,
                },
              );

              await browser.close();
            } catch (uploadErr) {
              await browser.close().catch(() => {});
              throw uploadErr;
            }
          }
        }

        // Create the post
        const postBody: Record<string, unknown> = {
          visibilityEnum: visibilityValue,
          commentary: params.text,
          origin: "FEED",
          allowedCommentScope: "ALL",
        };

        if (imageUrn) {
          postBody.mediaUrns = [imageUrn];
        }

        const postData = await linkedinManager.post(
          account,
          "voyagerContentCreationDashShares",
          postBody,
          { action: "create" },
        );

        // Extract post URN from response
        const responseData = (postData as Record<string, unknown>).data ?? postData;
        const postUrn =
          (responseData as Record<string, unknown>).urn ??
          (responseData as Record<string, unknown>).entityUrn ??
          (responseData as Record<string, unknown>).value;

        return jsonResult({
          success: true,
          postUrn: postUrn ?? null,
          text: params.text,
          visibility: visibilityValue,
          hasImage: !!imageUrn,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
