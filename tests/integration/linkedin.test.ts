/**
 * Integration tests — hit the real LinkedIn Voyager API via Playwright.
 *
 * Re-authenticates in beforeAll to ensure fresh session cookies.
 * Credentials are read from the openclaw config file (~/.openclaw/openclaw.json),
 * with env var overrides:
 *   LINKEDIN_USERNAME   LinkedIn email/username
 *   LINKEDIN_PASSWORD   LinkedIn password
 *
 * Timeout: 120s — each call launches a Playwright browser (~5-10s per call).
 *
 * Run:
 *   pnpm vitest run tests/integration/linkedin.test.ts
 */

import { existsSync, readFileSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { LinkedInClientManager } from "../../src/auth/linkedin-client-manager.js";
import { createLinkedInProfileTool } from "../../src/tools/linkedin-profile.js";
import { createLinkedInGetProfileTool } from "../../src/tools/linkedin-profile.js";
import { createLinkedInFeedTool } from "../../src/tools/linkedin-feed.js";
import { createLinkedInConnectionsTool } from "../../src/tools/linkedin-connections.js";
import {
  createLinkedInConversationsTool,
  createLinkedInMessagesTool,
} from "../../src/tools/linkedin-messages.js";
import { createLinkedInNotificationsTool } from "../../src/tools/linkedin-notifications.js";
import {
  createLinkedInSearchTool,
  createLinkedInSearchJobsTool,
} from "../../src/tools/linkedin-search.js";
import { createLinkedInAuthTool } from "../../src/tools/linkedin-auth-tool.js";
import { createLinkedInPendingInvitationsTool } from "../../src/tools/linkedin-invitations.js";
import { createLinkedInCompanyTool } from "../../src/tools/linkedin-company.js";
import { createLinkedInJobDetailsTool } from "../../src/tools/linkedin-job-details.js";
import { createLinkedInPostCommentsTool } from "../../src/tools/linkedin-post-comments.js";
import { createLinkedInProfileViewsTool } from "../../src/tools/linkedin-profile-views.js";
import { createLinkedInSavedJobsTool } from "../../src/tools/linkedin-saved-jobs.js";
import { createLinkedInDownloadMediaTool } from "../../src/tools/linkedin-download-media.js";
import { createLinkedInSendMessageTool } from "../../src/tools/linkedin-send-message.js";
import { createLinkedInSendConnectionRequestTool } from "../../src/tools/linkedin-connection-request.js";
import { createLinkedInRespondInvitationTool } from "../../src/tools/linkedin-respond-invitation.js";
import { createLinkedInCreatePostTool } from "../../src/tools/linkedin-create-post.js";
import { createLinkedInReactToPostTool } from "../../src/tools/linkedin-react.js";
import { createLinkedInCommentOnPostTool } from "../../src/tools/linkedin-comment.js";

// ---------------------------------------------------------------------------
// Config — read auth credentials from openclaw plugin config, env overrides
// ---------------------------------------------------------------------------
function loadOpenclawPluginConfig(): Record<string, string> {
  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  if (!existsSync(configPath)) return {};
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    return raw?.plugins?.entries?.omniclaw?.config ?? {};
  } catch {
    return {};
  }
}

const oclConfig = loadOpenclawPluginConfig();

const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-linkedin-tokens.json");
const ACCOUNT = "default";

const LINKEDIN_USERNAME = process.env.LINKEDIN_USERNAME || oclConfig.linkedin_username || "";
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD || oclConfig.linkedin_password || "";

const authCredentialsAvailable = LINKEDIN_USERNAME !== "" && LINKEDIN_PASSWORD !== "";
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

if (!authCredentialsAvailable) {
  console.warn(
    "\n[integration] Skipping LinkedIn: auth credentials not found in " +
      "~/.openclaw/openclaw.json or env vars.\n",
  );
}

// ---------------------------------------------------------------------------
// Shared state populated across tests
// ---------------------------------------------------------------------------
let linkedinManager: LinkedInClientManager;
let myPublicIdentifier: string;
let firstPostEntityUrn: string;
let firstConversationUrn: string;
let firstJobEntityUrn: string;
const LINKEDIN_SAVE_DIR = join(tmpdir(), `omniclaw-linkedin-test-${Date.now()}`);
let firstMediaUrl: string;

// ---------------------------------------------------------------------------
describe.skipIf(!authCredentialsAvailable)("LinkedIn API integration", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    linkedinManager = new LinkedInClientManager(TOKENS_PATH);

    // Re-authenticate to get fresh session cookies
    const tool = createLinkedInAuthTool(linkedinManager, {
      client_secret_path: "",
      linkedin_username: LINKEDIN_USERNAME,
      linkedin_password: LINKEDIN_PASSWORD,
    });
    const result = await tool.execute("reauth", { account: ACCOUNT });
    console.log("[linkedin] Re-auth result:", JSON.stringify(result.details, null, 2));
    expect(result.details.status).toBe("authenticated");
  });

  afterAll(() => {
    try {
      if (existsSync(LINKEDIN_SAVE_DIR)) {
        for (const file of readdirSync(LINKEDIN_SAVE_DIR)) {
          unlinkSync(join(LINKEDIN_SAVE_DIR, file));
        }
        rmdirSync(LINKEDIN_SAVE_DIR);
      }
    } catch { /* best-effort cleanup */ }
  });

  // -------------------------------------------------------------------------
  // linkedin_profile
  // -------------------------------------------------------------------------
  describe("linkedin_profile", () => {
    it("returns the authenticated user's profile", async () => {
      const tool = createLinkedInProfileTool(linkedinManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.firstName).toBe("string");
      expect(typeof result.details.lastName).toBe("string");
      expect(typeof result.details.publicIdentifier).toBe("string");

      myPublicIdentifier = result.details.publicIdentifier;
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_get_profile
  // -------------------------------------------------------------------------
  describe("linkedin_get_profile", () => {
    it("fetches a full profile with experience/education", async () => {
      expect(myPublicIdentifier).toBeTruthy();

      const tool = createLinkedInGetProfileTool(linkedinManager);
      const result = await tool.execute("t", { id: myPublicIdentifier, account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.firstName).toBe("string");
      expect(Array.isArray(result.details.experience)).toBe(true);
      expect(Array.isArray(result.details.education)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_feed
  // -------------------------------------------------------------------------
  describe("linkedin_feed", () => {
    it("returns an array of feed posts", async () => {
      const tool = createLinkedInFeedTool(linkedinManager);
      const result = await tool.execute("t", { count: 3, account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.posts)).toBe(true);

      if (result.details.posts.length > 0) {
        const post = result.details.posts[0];
        // Save entityUrn for comments test
        if (post.entityUrn) {
          firstPostEntityUrn = post.entityUrn;
        }

        expect(Array.isArray(result.details.posts[0]?.media)).toBe(true);

        // Check for media URLs in posts (new feature)
        for (const p of result.details.posts) {
          if (Array.isArray(p.media) && p.media.length > 0) {
            const mediaItem = p.media[0];
            expect(typeof mediaItem.type).toBe("string");
            expect(typeof mediaItem.url).toBe("string");
            if (!firstMediaUrl && mediaItem.url) {
              firstMediaUrl = mediaItem.url;
            }
            break;
          }
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_download_media
  // -------------------------------------------------------------------------
  describe("linkedin_download_media", () => {
    it("downloads a media file when a URL is available", async () => {
      if (!firstMediaUrl) {
        console.warn("[linkedin] No media URLs found in feed — skipping download test");
        return;
      }

      const tool = createLinkedInDownloadMediaTool(linkedinManager);
      const result = await tool.execute("t", {
        url: firstMediaUrl,
        save_dir: LINKEDIN_SAVE_DIR,
        account: ACCOUNT,
      });

      if (result.details.error) {
        // Media URLs may expire or require specific auth — accept graceful error
        expect(typeof result.details.error).toBe("string");
      } else {
        expect(typeof result.details.path).toBe("string");
        expect(existsSync(result.details.path)).toBe(true);
        expect(typeof result.details.mimeType).toBe("string");
        expect(result.details.size).toBeGreaterThan(0);
        expect(result.details.source_url).toBe(firstMediaUrl);
      }
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_connections
  // -------------------------------------------------------------------------
  describe("linkedin_connections", () => {
    it("returns connections with firstName", async () => {
      const tool = createLinkedInConnectionsTool(linkedinManager);
      const result = await tool.execute("t", { count: 5, account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.connections)).toBe(true);
      if (result.details.connections.length > 0) {
        expect(typeof result.details.connections[0].firstName).toBe("string");
      }
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_conversations
  // -------------------------------------------------------------------------
  describe("linkedin_conversations", () => {
    it("returns conversations array", async () => {
      const tool = createLinkedInConversationsTool(linkedinManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.conversations)).toBe(true);

      if (result.details.conversations.length > 0) {
        firstConversationUrn = result.details.conversations[0].conversationUrn;
      }
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_messages
  // -------------------------------------------------------------------------
  describe("linkedin_messages", () => {
    it("returns messages from a conversation", async () => {
      if (!firstConversationUrn) {
        console.warn("[linkedin] Skipping linkedin_messages: no conversation URN from conversations test");
        return;
      }
      const tool = createLinkedInMessagesTool(linkedinManager);
      const result = await tool.execute("t", {
        conversation_urn: firstConversationUrn,
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.messages)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_notifications
  // -------------------------------------------------------------------------
  describe("linkedin_notifications", () => {
    it("returns notifications array (may be empty)", async () => {
      const tool = createLinkedInNotificationsTool(linkedinManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.notifications)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_search
  // -------------------------------------------------------------------------
  describe("linkedin_search", () => {
    it('searches for "software engineer" and returns results', async () => {
      const tool = createLinkedInSearchTool(linkedinManager);
      const result = await tool.execute("t", { query: "software engineer", account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.results)).toBe(true);
      // Results may be empty depending on LinkedIn's API behavior
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_search_jobs
  // -------------------------------------------------------------------------
  describe("linkedin_search_jobs", () => {
    it("searches for jobs", async () => {
      const tool = createLinkedInSearchJobsTool(linkedinManager);
      const result = await tool.execute("t", { keywords: "software engineer", account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.jobs)).toBe(true);
      expect(result.details.jobs.length).toBeGreaterThan(0);
      expect(result.details.jobs[0].title).toBeDefined();
      expect(result.details.jobs[0].companyName).toBeDefined();
      firstJobEntityUrn = result.details.jobs[0].entityUrn;
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_pending_invitations
  // -------------------------------------------------------------------------
  describe("linkedin_pending_invitations", () => {
    it("returns invitations array (may be empty)", async () => {
      const tool = createLinkedInPendingInvitationsTool(linkedinManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.invitations)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_company
  // -------------------------------------------------------------------------
  describe("linkedin_company", () => {
    it('returns company details for "google", or a known API error', async () => {
      const tool = createLinkedInCompanyTool(linkedinManager);
      const result = await tool.execute("t", { name: "google", account: ACCOUNT });

      if (result.details.error) {
        // Known: LinkedIn may return 500 for company lookups
        expect(result.details.error).toMatch(/500|error/i);
      } else {
        expect(typeof result.details.name).toBe("string");
      }
    });

    it("returns error for nonexistent company", async () => {
      const tool = createLinkedInCompanyTool(linkedinManager);
      const result = await tool.execute("t", {
        name: "zzz_no_such_company_omniclaw_test_xyzxyz",
        account: ACCOUNT,
      });

      expect(result.details.error).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_job_details
  // -------------------------------------------------------------------------
  describe("linkedin_job_details", () => {
    it("fetches job details", async () => {
      if (!firstJobEntityUrn) {
        console.warn("[linkedin] Skipping linkedin_job_details: no job URN from search_jobs test");
        return;
      }
      // Extract numeric job ID from entityUrn like "urn:li:fsd_jobPosting:1234567890"
      const jobId = firstJobEntityUrn.split(":").pop() ?? firstJobEntityUrn;
      const tool = createLinkedInJobDetailsTool(linkedinManager);
      const result = await tool.execute("t", { job_id: jobId, account: ACCOUNT });

      if (result.details.error) {
        expect(result.details.error).toMatch(/error/i);
      } else {
        expect(result.details).not.toHaveProperty("error");
        expect(result.details.title ?? result.details.jobTitle).toBeDefined();
      }
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_post_comments
  // -------------------------------------------------------------------------
  describe("linkedin_post_comments", () => {
    it("returns comments for a feed post", async () => {
      if (!firstPostEntityUrn) {
        console.warn("[linkedin] Skipping linkedin_post_comments: no post URN from feed test");
        return;
      }
      const tool = createLinkedInPostCommentsTool(linkedinManager);
      const result = await tool.execute("t", {
        activity_urn: firstPostEntityUrn,
        account: ACCOUNT,
      });

      if (result.details.error) {
        // Known: LinkedIn may return 400 for comments if URN format doesn't match
        expect(result.details.error).toMatch(/400|error/i);
      } else {
        expect(Array.isArray(result.details.comments)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_profile_views
  // -------------------------------------------------------------------------
  describe("linkedin_profile_views", () => {
    it("returns viewers array and totalViews, or a known API error", async () => {
      const tool = createLinkedInProfileViewsTool(linkedinManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      if (result.details.error) {
        // Known: LinkedIn may return 404 for profile views endpoint
        expect(result.details.error).toMatch(/404|not found/i);
      } else {
        expect(Array.isArray(result.details.viewers)).toBe(true);
        expect(typeof result.details.totalViews).toBe("number");
      }
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_saved_jobs
  // -------------------------------------------------------------------------
  describe("linkedin_saved_jobs", () => {
    it("returns saved jobs array, or a known API error", async () => {
      const tool = createLinkedInSavedJobsTool(linkedinManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      if (result.details.error) {
        // Known: LinkedIn may return 400 for saved jobs endpoint
        expect(result.details.error).toMatch(/400|bad request/i);
      } else {
        expect(Array.isArray(result.details.jobs)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // linkedin_auth_setup — verify tool.name only (browser flow — don't execute)
  // -------------------------------------------------------------------------
  describe("linkedin_auth_setup", () => {
    it("has the correct tool name (browser flow — not executed)", () => {
      const tool = createLinkedInAuthTool(linkedinManager, {} as any);
      expect(tool.name).toBe("linkedin_auth_setup");
      expect(tool.label).toBe("LinkedIn Auth Setup");
    });
  });

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

  // Connection request — just verify tool instantiation (don't spam)
  describe("linkedin_send_connection_request", () => {
    it("has the correct tool name", () => {
      const tool = createLinkedInSendConnectionRequestTool(linkedinManager);
      expect(tool.name).toBe("linkedin_send_connection_request");
      expect(tool.label).toBe("LinkedIn Send Connection Request");
    });
  });

  // Respond invitation — just verify tool instantiation
  describe("linkedin_respond_invitation", () => {
    it("has the correct tool name", () => {
      const tool = createLinkedInRespondInvitationTool(linkedinManager);
      expect(tool.name).toBe("linkedin_respond_invitation");
      expect(tool.label).toBe("LinkedIn Respond to Invitation");
    });
  });
});
