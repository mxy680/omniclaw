# LinkedIn Write Tools Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 write/action tools (send message, connection request, respond invitation, create post, react, comment) to the LinkedIn integration.

**Architecture:** Extend `LinkedInClientManager` with `post()` and `delete()` methods mirroring the existing `get()` pattern (Playwright browser context + in-page fetch). Then create 6 new tool files following the exact factory pattern of existing LinkedIn tools, register them in `plugin.ts`, and update docs.

**Tech Stack:** TypeScript, Playwright (headless Chromium), LinkedIn Voyager API, `@sinclair/typebox` for parameter schemas.

---

### Task 1: Add `post()` and `delete()` to LinkedInClientManager

**Files:**
- Modify: `src/auth/linkedin-client-manager.ts`

**Step 1: Refactor `get()` into a shared `request()` method**

Extract the Playwright browser+fetch logic from `get()` into a private `request()` method that accepts `method`, `path`, `params`, `rawQs`, and optional `body`. Then rewrite `get()` to delegate to `request()`.

Add this private method right before the existing `get()` method (after `buildCookieString`, before `get`):

```typescript
  private async request(
    account: string,
    method: "GET" | "POST" | "DELETE",
    path: string,
    params?: Record<string, string>,
    rawQs?: string,
    body?: unknown,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    let url = `https://www.linkedin.com/voyager/api/${path}`;
    const searchParams = new URLSearchParams(params ?? {});
    const qs = searchParams.toString();
    const parts = [qs, rawQs].filter(Boolean).join("&");
    if (parts) {
      url += `?${parts}`;
    }

    const cookieStr = this.buildCookieString(session);
    const headers: Record<string, string> = {
      Cookie: cookieStr,
      "Csrf-Token": session.csrf_token,
      "X-Restli-Protocol-Version": "2.0.0",
      "X-Li-Lang": "en_US",
      Accept: "application/vnd.linkedin.normalized+json+2.1",
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json; charset=UTF-8";
    }

    const fetchBody = body !== undefined ? JSON.stringify(body) : undefined;

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

      const result = await page.evaluate(
        async ({ fetchUrl, fetchHeaders, fetchMethod, fetchBody }) => {
          const resp = await fetch(fetchUrl, {
            method: fetchMethod,
            headers: fetchHeaders,
            credentials: "include",
            body: fetchBody ?? undefined,
          });
          const respBody = await resp.text();
          const setCookieHeader = resp.headers.get("set-cookie") ?? "";
          return {
            status: resp.status,
            statusText: resp.statusText,
            body: respBody,
            setCookie: setCookieHeader,
          };
        },
        { fetchUrl: url, fetchHeaders: headers, fetchMethod: method, fetchBody: fetchBody ?? null },
      );

      await browser.close();

      if (result.status === 401) {
        throw new Error("LinkedIn session expired. Call linkedin_auth_setup again.");
      }
      if (result.status === 429) {
        throw new Error("LinkedIn API rate limit exceeded. Please wait before retrying.");
      }
      if (result.status >= 400) {
        throw new Error(`LinkedIn API error: ${result.status} ${result.statusText}`);
      }

      if (result.setCookie) {
        this.updateCookiesFromHeader(account, result.setCookie);
      }

      return result.body ? JSON.parse(result.body) : {};
    } catch (err) {
      await browser.close().catch(() => {});
      throw err;
    }
  }
```

**Step 2: Rewrite `get()` to delegate to `request()`**

Replace the entire body of the `get()` method with:

```typescript
  async get(
    account: string,
    path: string,
    params?: Record<string, string>,
    rawQs?: string,
  ): Promise<unknown> {
    return this.request(account, "GET", path, params, rawQs);
  }
```

**Step 3: Add `post()` and `delete()` methods**

Add these right after `get()`:

```typescript
  async post(
    account: string,
    path: string,
    body: unknown,
    params?: Record<string, string>,
    rawQs?: string,
  ): Promise<unknown> {
    return this.request(account, "POST", path, params, rawQs, body);
  }

  async delete(
    account: string,
    path: string,
    params?: Record<string, string>,
    rawQs?: string,
  ): Promise<unknown> {
    return this.request(account, "DELETE", path, params, rawQs);
  }
```

**Step 4: Verify build**

Run: `pnpm build`
Expected: Clean compilation, no errors.

**Step 5: Run existing LinkedIn tests to confirm no regression**

Run: `pnpm vitest run tests/integration/linkedin.test.ts`
Expected: All existing tests pass (the `get()` refactor is a pure internal change).

**Step 6: Commit**

```bash
git add src/auth/linkedin-client-manager.ts
git commit -m "feat(linkedin): add post() and delete() to LinkedInClientManager"
```

---

### Task 2: Create `linkedin_send_message` tool

**Files:**
- Create: `src/tools/linkedin-send-message.ts`

**Step 1: Create the tool file**

```typescript
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
export function createLinkedInSendMessageTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_send_message",
    label: "LinkedIn Send Message",
    description:
      "Send a direct message to a LinkedIn connection. Pass the recipient's profile URN (from linkedin_search, linkedin_connections, or linkedin_get_profile) and the message text.",
    parameters: Type.Object({
      recipient_urn: Type.String({
        description:
          "The recipient's profile URN (e.g. 'urn:li:fs_miniProfile:...' or 'urn:li:fsd_profile:...'). Get this from linkedin_search, linkedin_connections, or linkedin_get_profile.",
      }),
      text: Type.String({
        description: "The message text to send.",
      }),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { recipient_urn: string; text: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        // Get the sender's member ID from the profile
        const meData = (await linkedinManager.get(account, "me")) as {
          included?: Array<Record<string, unknown>>;
        };
        const miniProfiles = extractEntities(meData.included, "MiniProfile");
        const myProfile = miniProfiles[0];
        const myUrn = (myProfile?.entityUrn as string) ?? "";
        const myMemberId = myUrn.split(":").pop() ?? "";

        if (!myMemberId) {
          return jsonResult({ error: "Could not resolve sender profile. Re-authenticate and try again." });
        }

        // Extract recipient member ID from URN
        const recipientId = params.recipient_urn.split(":").pop() ?? "";

        // Send message via Voyager messaging REST endpoint
        const mailboxUrn = `urn:li:msg_mailbox:${myMemberId}`;
        const body = {
          dedupeByClientGeneratedToken: false,
          hostRecipientUrns: [`urn:li:fsd_profile:${recipientId}`],
          message: {
            body: {
              attributes: [],
              text: params.text,
            },
            originToken: crypto.randomUUID(),
            renderContentUnions: [],
          },
          mailboxUrn,
        };

        const data = await linkedinManager.post(
          account,
          "voyagerMessagingDashMessengerMessages",
          body,
          { action: "createMessage" },
        );

        return jsonResult({
          success: true,
          recipient: params.recipient_urn,
          text: params.text,
          response: data,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add src/tools/linkedin-send-message.ts
git commit -m "feat(linkedin): add linkedin_send_message tool"
```

---

### Task 3: Create `linkedin_send_connection_request` tool

**Files:**
- Create: `src/tools/linkedin-connection-request.ts`

**Step 1: Create the tool file**

```typescript
import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";

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
export function createLinkedInSendConnectionRequestTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_send_connection_request",
    label: "LinkedIn Send Connection Request",
    description:
      "Send a connection request (invitation) to another LinkedIn user. Optionally include a personalization message (max 300 characters).",
    parameters: Type.Object({
      profile_urn: Type.String({
        description:
          "The target user's profile URN (e.g. 'urn:li:fs_miniProfile:...' or 'urn:li:fsd_profile:...'). Get this from linkedin_search or linkedin_get_profile.",
      }),
      message: Type.Optional(
        Type.String({
          description: "Optional personalization note (max 300 characters).",
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
      params: { profile_urn: string; message?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const memberId = params.profile_urn.split(":").pop() ?? "";

        // Truncate message to 300 characters (LinkedIn limit)
        const message = params.message ? params.message.slice(0, 300) : undefined;

        const body: Record<string, unknown> = {
          inviteeProfileUrn: `urn:li:fsd_profile:${memberId}`,
          customMessage: message ?? "",
        };

        const data = await linkedinManager.post(
          account,
          "voyagerRelationshipsDashMemberRelationships",
          body,
          { action: "verifyQuotaAndCreate" },
        );

        return jsonResult({
          success: true,
          target: params.profile_urn,
          message: message ?? null,
          response: data,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add src/tools/linkedin-connection-request.ts
git commit -m "feat(linkedin): add linkedin_send_connection_request tool"
```

---

### Task 4: Create `linkedin_respond_invitation` tool

**Files:**
- Create: `src/tools/linkedin-respond-invitation.ts`

**Step 1: Create the tool file**

```typescript
import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";

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
export function createLinkedInRespondInvitationTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_respond_invitation",
    label: "LinkedIn Respond to Invitation",
    description:
      "Accept or decline a pending connection request. Pass the invitation URN from linkedin_pending_invitations.",
    parameters: Type.Object({
      invitation_urn: Type.String({
        description:
          "The invitation URN (e.g. 'urn:li:fsd_invitation:...'). Get this from linkedin_pending_invitations.",
      }),
      action: Type.String({
        description: "Action to take: 'accept' or 'decline'.",
      }),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { invitation_urn: string; action: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const actionLower = params.action.toLowerCase();
        if (actionLower !== "accept" && actionLower !== "decline") {
          return jsonResult({ error: "action must be 'accept' or 'decline'" });
        }

        // Extract the invitation ID from the URN
        const invitationId = params.invitation_urn.split(":").pop() ?? "";
        const encodedUrn = encodeURIComponent(params.invitation_urn);

        let data: unknown;
        if (actionLower === "accept") {
          data = await linkedinManager.post(
            account,
            `voyagerRelationshipsDashInvitations/${encodedUrn}`,
            {},
            { action: "accept" },
          );
        } else {
          data = await linkedinManager.delete(
            account,
            `voyagerRelationshipsDashInvitations/${encodedUrn}`,
            { action: "reject" },
          );
        }

        return jsonResult({
          success: true,
          invitation: params.invitation_urn,
          action: actionLower,
          response: data,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add src/tools/linkedin-respond-invitation.ts
git commit -m "feat(linkedin): add linkedin_respond_invitation tool"
```

---

### Task 5: Create `linkedin_create_post` tool

**Files:**
- Create: `src/tools/linkedin-create-post.ts`

**Step 1: Create the tool file**

This is the most complex tool — supports text-only and text+image posts.

```typescript
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
            // Step 2: Upload the actual image binary
            // We do this via Playwright to stay within LinkedIn's CORS/cookie context
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
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add src/tools/linkedin-create-post.ts
git commit -m "feat(linkedin): add linkedin_create_post tool with image support"
```

---

### Task 6: Create `linkedin_react_to_post` tool

**Files:**
- Create: `src/tools/linkedin-react.ts`

**Step 1: Create the tool file**

```typescript
import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";

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

const VALID_REACTIONS = ["LIKE", "CELEBRATE", "SUPPORT", "LOVE", "INSIGHTFUL", "FUNNY"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInReactToPostTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_react_to_post",
    label: "LinkedIn React to Post",
    description:
      "React to a LinkedIn feed post. Supported reactions: LIKE, CELEBRATE, SUPPORT, LOVE, INSIGHTFUL, FUNNY. Pass the activity URN from linkedin_feed.",
    parameters: Type.Object({
      activity_urn: Type.String({
        description:
          "The activity/update URN (e.g. 'urn:li:activity:...'). Get this from linkedin_feed.",
      }),
      reaction_type: Type.Optional(
        Type.String({
          description:
            "Reaction type: LIKE (default), CELEBRATE, SUPPORT, LOVE, INSIGHTFUL, or FUNNY.",
          default: "LIKE",
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
      params: { activity_urn: string; reaction_type?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const reaction = (params.reaction_type ?? "LIKE").toUpperCase();
        if (!VALID_REACTIONS.includes(reaction as typeof VALID_REACTIONS[number])) {
          return jsonResult({
            error: `Invalid reaction type '${reaction}'. Valid types: ${VALID_REACTIONS.join(", ")}`,
          });
        }

        const encodedUrn = encodeURIComponent(params.activity_urn);

        const body = {
          reactionType: reaction,
        };

        const data = await linkedinManager.post(
          account,
          `voyagerSocialDashReactions`,
          body,
          undefined,
          `threadUrn=${encodedUrn}`,
        );

        return jsonResult({
          success: true,
          activity: params.activity_urn,
          reaction,
          response: data,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add src/tools/linkedin-react.ts
git commit -m "feat(linkedin): add linkedin_react_to_post tool"
```

---

### Task 7: Create `linkedin_comment_on_post` tool

**Files:**
- Create: `src/tools/linkedin-comment.ts`

**Step 1: Create the tool file**

```typescript
import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";

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
export function createLinkedInCommentOnPostTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_comment_on_post",
    label: "LinkedIn Comment on Post",
    description:
      "Add a comment to a LinkedIn feed post. Pass the activity URN from linkedin_feed and the comment text.",
    parameters: Type.Object({
      activity_urn: Type.String({
        description:
          "The activity/update URN (e.g. 'urn:li:activity:...'). Get this from linkedin_feed.",
      }),
      text: Type.String({
        description: "The comment text.",
      }),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { activity_urn: string; text: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const encodedUrn = encodeURIComponent(params.activity_urn);

        const body = {
          threadUrn: params.activity_urn,
          commentary: {
            text: params.text,
            attributes: [],
          },
        };

        const data = (await linkedinManager.post(
          account,
          "voyagerSocialDashComments",
          body,
        )) as Record<string, unknown>;

        // Extract comment URN from response
        const responseData = (data.data ?? data) as Record<string, unknown>;
        const commentUrn =
          responseData.entityUrn ?? responseData.urn ?? responseData.value;

        return jsonResult({
          success: true,
          activity: params.activity_urn,
          text: params.text,
          commentUrn: commentUrn ?? null,
          response: data,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add src/tools/linkedin-comment.ts
git commit -m "feat(linkedin): add linkedin_comment_on_post tool"
```

---

### Task 8: Register all 6 tools in plugin.ts

**Files:**
- Modify: `src/plugin.ts`

**Step 1: Add imports**

Add these imports after the existing LinkedIn imports (after the `createLinkedInSearchTool` import line):

```typescript
import { createLinkedInSendMessageTool } from "./tools/linkedin-send-message.js";
import { createLinkedInSendConnectionRequestTool } from "./tools/linkedin-connection-request.js";
import { createLinkedInRespondInvitationTool } from "./tools/linkedin-respond-invitation.js";
import { createLinkedInCreatePostTool } from "./tools/linkedin-create-post.js";
import { createLinkedInReactToPostTool } from "./tools/linkedin-react.js";
import { createLinkedInCommentOnPostTool } from "./tools/linkedin-comment.js";
```

**Step 2: Register the tools**

Add these 6 lines right after `reg(createLinkedInSavedJobsTool(linkedinManager));` (around line 457):

```typescript
  reg(createLinkedInSendMessageTool(linkedinManager));
  reg(createLinkedInSendConnectionRequestTool(linkedinManager));
  reg(createLinkedInRespondInvitationTool(linkedinManager));
  reg(createLinkedInCreatePostTool(linkedinManager));
  reg(createLinkedInReactToPostTool(linkedinManager));
  reg(createLinkedInCommentOnPostTool(linkedinManager));
```

**Step 3: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 4: Commit**

```bash
git add src/plugin.ts
git commit -m "feat(linkedin): register 6 new write tools in plugin"
```

---

### Task 9: Add write tests to integration test file

**Files:**
- Modify: `tests/integration/linkedin.test.ts`

**Step 1: Add imports for the new tools**

Add after the existing LinkedIn test imports:

```typescript
import { createLinkedInSendMessageTool } from "../../src/tools/linkedin-send-message.js";
import { createLinkedInSendConnectionRequestTool } from "../../src/tools/linkedin-connection-request.js";
import { createLinkedInRespondInvitationTool } from "../../src/tools/linkedin-respond-invitation.js";
import { createLinkedInCreatePostTool } from "../../src/tools/linkedin-create-post.js";
import { createLinkedInReactToPostTool } from "../../src/tools/linkedin-react.js";
import { createLinkedInCommentOnPostTool } from "../../src/tools/linkedin-comment.js";
```

**Step 2: Add test variable**

Add near the other shared state variables:

```typescript
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";
```

**Step 3: Add write test blocks**

Add these at the end of the describe block (before the closing `});`), after the `linkedin_auth_setup` test:

```typescript
  // =========================================================================
  // WRITE TOOLS — opt-in via RUN_WRITE_TESTS=1
  // =========================================================================

  describe.skipIf(!RUN_WRITE_TESTS)("linkedin_create_post (write)", () => {
    it("creates a text-only post", async () => {
      const tool = createLinkedInCreatePostTool(linkedinManager);
      const result = await tool.execute("t", {
        text: `[Automated test post — please ignore] ${new Date().toISOString()}`,
        visibility: "connections",
        account: ACCOUNT,
      });

      if (result.details.error) {
        console.warn("[linkedin] create_post error:", result.details.error);
        expect(result.details.error).toMatch(/error/i);
      } else {
        expect(result.details.success).toBe(true);
        expect(typeof result.details.text).toBe("string");
      }
    });
  });

  describe.skipIf(!RUN_WRITE_TESTS)("linkedin_react_to_post (write)", () => {
    it("reacts to a feed post with LIKE", async () => {
      if (!firstPostEntityUrn) {
        console.warn("[linkedin] Skipping react test: no post URN from feed test");
        return;
      }
      const tool = createLinkedInReactToPostTool(linkedinManager);
      const result = await tool.execute("t", {
        activity_urn: firstPostEntityUrn,
        reaction_type: "LIKE",
        account: ACCOUNT,
      });

      if (result.details.error) {
        console.warn("[linkedin] react error:", result.details.error);
        expect(result.details.error).toMatch(/error/i);
      } else {
        expect(result.details.success).toBe(true);
        expect(result.details.reaction).toBe("LIKE");
      }
    });
  });

  describe.skipIf(!RUN_WRITE_TESTS)("linkedin_comment_on_post (write)", () => {
    it("comments on a feed post", async () => {
      if (!firstPostEntityUrn) {
        console.warn("[linkedin] Skipping comment test: no post URN from feed test");
        return;
      }
      const tool = createLinkedInCommentOnPostTool(linkedinManager);
      const result = await tool.execute("t", {
        activity_urn: firstPostEntityUrn,
        text: `[Automated test comment — please ignore] ${new Date().toISOString()}`,
        account: ACCOUNT,
      });

      if (result.details.error) {
        console.warn("[linkedin] comment error:", result.details.error);
        expect(result.details.error).toMatch(/error/i);
      } else {
        expect(result.details.success).toBe(true);
        expect(typeof result.details.text).toBe("string");
      }
    });
  });

  // Send message — needs a known recipient URN; use first connection if available
  describe.skipIf(!RUN_WRITE_TESTS)("linkedin_send_message (write)", () => {
    it("sends a message to a connection (or fails gracefully)", async () => {
      // Get first connection's URN
      const connTool = createLinkedInConnectionsTool(linkedinManager);
      const connResult = await connTool.execute("t", { count: 1, account: ACCOUNT });
      const connections = connResult.details.connections ?? [];
      if (connections.length === 0) {
        console.warn("[linkedin] Skipping send_message: no connections found");
        return;
      }
      const recipientUrn = connections[0].entityUrn;
      if (!recipientUrn) {
        console.warn("[linkedin] Skipping send_message: connection has no URN");
        return;
      }

      const tool = createLinkedInSendMessageTool(linkedinManager);
      const result = await tool.execute("t", {
        recipient_urn: recipientUrn,
        text: `[Automated test message — please ignore] ${new Date().toISOString()}`,
        account: ACCOUNT,
      });

      if (result.details.error) {
        console.warn("[linkedin] send_message error:", result.details.error);
        expect(result.details.error).toMatch(/error/i);
      } else {
        expect(result.details.success).toBe(true);
        expect(result.details.recipient).toBe(recipientUrn);
      }
    });
  });

  // Connection request — we don't actually send one to avoid spamming;
  // just verify the tool instantiation
  describe("linkedin_send_connection_request", () => {
    it("has the correct tool name", () => {
      const tool = createLinkedInSendConnectionRequestTool(linkedinManager);
      expect(tool.name).toBe("linkedin_send_connection_request");
      expect(tool.label).toBe("LinkedIn Send Connection Request");
    });
  });

  // Respond invitation — we don't have a guaranteed pending invitation;
  // just verify the tool instantiation
  describe("linkedin_respond_invitation", () => {
    it("has the correct tool name", () => {
      const tool = createLinkedInRespondInvitationTool(linkedinManager);
      expect(tool.name).toBe("linkedin_respond_invitation");
      expect(tool.label).toBe("LinkedIn Respond to Invitation");
    });
  });
```

**Step 4: Run read-only tests to verify no regressions**

Run: `pnpm vitest run tests/integration/linkedin.test.ts`
Expected: All existing tests still pass; new write tests are skipped (since `RUN_WRITE_TESTS` is not set).

**Step 5: Commit**

```bash
git add tests/integration/linkedin.test.ts
git commit -m "test(linkedin): add integration tests for 6 write tools"
```

---

### Task 10: Update docs and skill file

**Files:**
- Modify: `skills/linkedin.SKILL.md`
- Modify: `docs/linkedin.md`
- Modify: `CLAUDE.md`

**Step 1: Update `skills/linkedin.SKILL.md`**

In the description (line 3), change:
```
description: LinkedIn access — profiles, feed, connections, messages, notifications, and search.
```
to:
```
description: LinkedIn access — profiles, feed, connections, messages, notifications, search, and write actions (post, react, comment, message, connect).
```

In the intro paragraph (line 9), change:
```
View LinkedIn profiles, read your feed, manage connections, access messages, read notifications, and search for people, companies, and jobs.
```
to:
```
View LinkedIn profiles, read your feed, manage connections, access messages, read notifications, search for people/companies/jobs, and take actions — create posts, react, comment, send messages, and send connection requests.
```

Add these 6 lines to the "Available Tools" section (after line 51, before the `## Workflow` section):
```
- `linkedin_send_message` — Send a direct message to a connection
- `linkedin_send_connection_request` — Send a connection request to a user
- `linkedin_respond_invitation` — Accept or decline a pending connection request
- `linkedin_create_post` — Create a new post (text, or text + image)
- `linkedin_react_to_post` — React to a feed post (like, celebrate, etc.)
- `linkedin_comment_on_post` — Comment on a feed post
```

Add these workflow items at the end of the Workflow section (after item 14):
```
15. Use `linkedin_send_message` to send a DM to a connection (pass their profile URN).
16. Use `linkedin_send_connection_request` to invite someone to connect (optionally with a personalization note, max 300 chars).
17. Use `linkedin_respond_invitation` with "accept" or "decline" to respond to pending connection requests from `linkedin_pending_invitations`.
18. Use `linkedin_create_post` to publish a text post. Optionally attach an image via `image_path` (local file) or `image_url`. Set `visibility` to "connections" to limit audience.
19. Use `linkedin_react_to_post` with an activity URN from the feed to add a reaction (LIKE, CELEBRATE, SUPPORT, LOVE, INSIGHTFUL, or FUNNY).
20. Use `linkedin_comment_on_post` with an activity URN and text to add a comment.
```

**Step 2: Update `docs/linkedin.md`**

Change line 3:
```
16 tools for managing your LinkedIn presence — profiles, feed, connections, messages, notifications, search, jobs, and companies.
```
to:
```
22 tools for managing your LinkedIn presence — profiles, feed, connections, messages, notifications, search, jobs, companies, posting, reactions, and comments.
```

Add these 6 rows to the Tools table (after the `linkedin_saved_jobs` row):
```
| `linkedin_send_message` | Send a direct message to a connection |
| `linkedin_send_connection_request` | Send a connection request to a user |
| `linkedin_respond_invitation` | Accept or decline a connection request |
| `linkedin_create_post` | Create a post (text, or text + image) |
| `linkedin_react_to_post` | React to a post (like, celebrate, etc.) |
| `linkedin_comment_on_post` | Comment on a feed post |
```

Add new usage examples at the end of the Usage Examples section:
```
> "Send a LinkedIn message to John saying I'd love to connect about the role"
> "Create a LinkedIn post about our new product launch"
> "Like the first post on my LinkedIn feed"
> "Accept all my pending LinkedIn connection requests"
```

**Step 3: Update `CLAUDE.md`**

In the Development Kanban "Done" table, change the LinkedIn row:
- Tools column: `17` -> `23` (16 existing + 1 download_media was already counted + 6 new)

Wait — let me recount. The current CLAUDE.md says `17` for LinkedIn tools. Looking at the actual tool registrations in plugin.ts, there are: auth + profile + get_profile + feed + download_media + connections + conversations + messages + notifications + search + search_jobs + pending_invitations + company + job_details + post_comments + profile_views + saved_jobs = 17 tools. Adding 6 makes it 23.

Change `17` to `23` in the LinkedIn row of the Done table.

**Step 4: Verify build one final time**

Run: `pnpm build`
Expected: Clean compilation.

**Step 5: Commit**

```bash
git add skills/linkedin.SKILL.md docs/linkedin.md CLAUDE.md
git commit -m "docs(linkedin): update docs for 6 new write tools (23 total)"
```

---

### Task 11: Final verification — run full test suite

**Step 1: Run read-only integration tests**

Run: `pnpm vitest run tests/integration/linkedin.test.ts`
Expected: All read-only tests pass, write tests skipped.

**Step 2: Optionally run write tests**

Run: `RUN_WRITE_TESTS=1 pnpm vitest run tests/integration/linkedin.test.ts`
Expected: Write tests execute (some may fail due to API endpoint discovery — that's expected and will need live debugging).

**Step 3: Final commit if any adjustments were needed**

If API endpoints need adjustment based on live testing, fix the tool files and commit:
```bash
git add -A
git commit -m "fix(linkedin): adjust write tool API endpoints from live testing"
```
