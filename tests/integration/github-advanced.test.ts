/**
 * Integration tests — hit the real GitHub API.
 *
 * Covers: search, users/orgs, profile, projects, webhooks, security, notifications.
 *
 * Required env var:
 *   GITHUB_TOKEN         GitHub Personal Access Token
 *
 * Optional overrides:
 *   GITHUB_TEST_OWNER    repo owner for read tests (default: "octocat")
 *   GITHUB_TEST_REPO     repo name  for read tests (default: "Hello-World")
 *
 * Write tests require all of the following:
 *   RUN_WRITE_TESTS=1
 *   GITHUB_WRITE_OWNER   owner of the test repo (must be the token's user/org)
 *   GITHUB_WRITE_REPO    name  of the test repo
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { rmSync } from "fs";
import { ApiKeyStore } from "../../src/auth/api-key-store.js";
import { GitHubClientManager } from "../../src/auth/github-client-manager.js";

// Search
import {
  createGitHubSearchCodeTool,
  createGitHubSearchIssuesTool,
  createGitHubSearchCommitsTool,
} from "../../src/tools/github-search.js";

// Users / orgs
import {
  createGitHubOrgGetTool,
  createGitHubOrgMembersTool,
  createGitHubOrgReposTool,
  createGitHubTeamListTool,
} from "../../src/tools/github-users.js";

// Profile
import {
  createGitHubUserFollowersListTool,
  createGitHubUserFollowingListTool,
  createGitHubUserEventsListTool,
  createGitHubUserFollowTool,
  createGitHubUserUnfollowTool,
  createGitHubUserUpdateTool,
  createGitHubRepoTopicsReplaceTool,
} from "../../src/tools/github-profile.js";

// Projects
import { createGitHubProjectListTool } from "../../src/tools/github-projects.js";

// Security
import {
  createGitHubDependabotAlertsTool,
  createGitHubCodeScanningAlertsTool,
  createGitHubSecretScanningAlertsTool,
  createGitHubSecurityAdvisoriesTool,
} from "../../src/tools/github-security.js";

// Webhooks
import {
  createGitHubWebhookListTool,
  createGitHubWebhookCreateTool,
  createGitHubWebhookUpdateTool,
  createGitHubWebhookDeleteTool,
} from "../../src/tools/github-webhooks.js";

// Repos (read + write)
import {
  createGitHubRepoTopicsTool,
  createGitHubRepoCreateTool,
  createGitHubRepoUpdateTool,
  createGitHubRepoDeleteTool,
  createGitHubRepoForkTool,
  createGitHubRepoStarTool,
  createGitHubRepoUnstarTool,
} from "../../src/tools/github-repos.js";

// Notifications
import {
  createGitHubNotificationListTool,
  createGitHubNotificationMarkReadTool,
} from "../../src/tools/github-notifications.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const storePath = join(tmpdir(), `github-advanced-test-keys-${Date.now()}.json`);
const TEST_OWNER = process.env.GITHUB_TEST_OWNER ?? "octocat";
const TEST_REPO = process.env.GITHUB_TEST_REPO ?? "Hello-World";
const WRITE_OWNER = process.env.GITHUB_WRITE_OWNER ?? "";
const WRITE_REPO = process.env.GITHUB_WRITE_REPO ?? "";
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1" && WRITE_OWNER !== "" && WRITE_REPO !== "";

const hasToken = GITHUB_TOKEN.length > 0;

if (!hasToken) {
  console.warn("\n[integration] Skipping GitHub advanced tests: GITHUB_TOKEN not set.\n");
}

// ---------------------------------------------------------------------------
let gh: GitHubClientManager;

describe.skipIf(!hasToken)("GitHub advanced API integration", { timeout: 30_000 }, () => {
  beforeAll(() => {
    const store = new ApiKeyStore(storePath);
    store.set("default", GITHUB_TOKEN);
    gh = new GitHubClientManager(store);
  });

  afterAll(() => {
    try { rmSync(storePath, { force: true }); } catch { /* ignore */ }
  });

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------
  describe("github_search_code", () => {
    it("searches code within a repo", async () => {
      const tool = createGitHubSearchCodeTool(gh);
      const result = await tool.execute("t", { q: "hello repo:octocat/Hello-World" });

      expect(result.details).toHaveProperty("total_count");
      expect(typeof result.details.total_count).toBe("number");
      expect(Array.isArray(result.details.items)).toBe(true);
    });
  });

  describe("github_search_issues", () => {
    it("searches issues within a repo", async () => {
      const tool = createGitHubSearchIssuesTool(gh);
      const result = await tool.execute("t", {
        q: "is:issue repo:octocat/Hello-World",
        per_page: 5,
      });

      expect(result.details).toHaveProperty("total_count");
      expect(typeof result.details.total_count).toBe("number");
      expect(Array.isArray(result.details.items)).toBe(true);
    });
  });

  describe("github_search_commits", () => {
    it("searches commits within a repo", async () => {
      const tool = createGitHubSearchCommitsTool(gh);
      const result = await tool.execute("t", {
        q: "initial repo:octocat/Hello-World",
        per_page: 5,
      });

      expect(result.details).toHaveProperty("total_count");
      expect(typeof result.details.total_count).toBe("number");
      expect(Array.isArray(result.details.items)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Users / orgs
  // -------------------------------------------------------------------------
  describe("github_org_get", () => {
    it("fetches org metadata", async () => {
      const tool = createGitHubOrgGetTool(gh);
      const result = await tool.execute("t", { org: "github" });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.login).toBe("github");
      expect(typeof result.details.name).toBe("string");
    });
  });

  describe("github_org_members", () => {
    it("returns an array of members", async () => {
      const tool = createGitHubOrgMembersTool(gh);
      const result = await tool.execute("t", { org: "github", per_page: 3 });

      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toHaveProperty("login");
      }
    });
  });

  describe("github_org_repos", () => {
    it("returns an array of repos", async () => {
      const tool = createGitHubOrgReposTool(gh);
      const result = await tool.execute("t", { org: "github", per_page: 3 });

      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toHaveProperty("full_name");
      }
    });
  });

  describe("github_team_list", () => {
    it("returns an array or a graceful error (requires org membership)", async () => {
      const tool = createGitHubTeamListTool(gh);
      const result = await tool.execute("t", { org: "github" });

      // May return 403 if the token is not an org member — that is acceptable.
      const isArray = Array.isArray(result.details);
      const isGracefulError =
        !isArray &&
        typeof result.details === "object" &&
        result.details !== null &&
        "error" in result.details;

      expect(isArray || isGracefulError).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Profile — authenticated user
  // -------------------------------------------------------------------------
  describe("github_user_followers_list", () => {
    it("returns the authenticated user's followers list", async () => {
      const tool = createGitHubUserFollowersListTool(gh);
      const result = await tool.execute("t", { per_page: 5 });

      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toHaveProperty("login");
      }
    });
  });

  describe("github_user_following_list", () => {
    it("returns the users the authenticated user follows", async () => {
      const tool = createGitHubUserFollowingListTool(gh);
      const result = await tool.execute("t", { per_page: 5 });

      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toHaveProperty("login");
      }
    });
  });

  describe("github_user_events_list", () => {
    it("returns public events for octocat", async () => {
      const tool = createGitHubUserEventsListTool(gh);
      const result = await tool.execute("t", { username: "octocat", per_page: 5 });

      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Projects (read)
  // -------------------------------------------------------------------------
  describe("github_project_list", () => {
    it("returns an array (likely empty for octocat/Hello-World)", async () => {
      const tool = createGitHubProjectListTool(gh);
      const result = await tool.execute("t", { owner: TEST_OWNER, repo: TEST_REPO });

      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Repo topics (read)
  // -------------------------------------------------------------------------
  describe("github_repo_topics", () => {
    it("returns a names array for the test repo", async () => {
      const tool = createGitHubRepoTopicsTool(gh);
      const result = await tool.execute("t", { owner: TEST_OWNER, repo: TEST_REPO });

      expect(result.details).not.toHaveProperty("error");
      // The tool returns { topics: string[] }
      expect(result.details).toHaveProperty("topics");
      expect(Array.isArray(result.details.topics)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Security (read) — 403/404 on public repos is acceptable
  // -------------------------------------------------------------------------
  describe("github_dependabot_alerts", () => {
    it("returns an array or a graceful error", async () => {
      const tool = createGitHubDependabotAlertsTool(gh);
      let result: Awaited<ReturnType<typeof tool.execute>>;
      try {
        result = await tool.execute("t", { owner: TEST_OWNER, repo: TEST_REPO });
      } catch {
        return; // network-level error — skip
      }
      const isArray = Array.isArray(result.details);
      const isGracefulError =
        !isArray && typeof result.details === "object" && result.details !== null && "error" in result.details;
      expect(isArray || isGracefulError).toBe(true);
    });
  });

  describe("github_code_scanning_alerts", () => {
    it("returns an array or a graceful error", async () => {
      const tool = createGitHubCodeScanningAlertsTool(gh);
      let result: Awaited<ReturnType<typeof tool.execute>>;
      try {
        result = await tool.execute("t", { owner: TEST_OWNER, repo: TEST_REPO });
      } catch {
        return;
      }
      const isArray = Array.isArray(result.details);
      const isGracefulError =
        !isArray && typeof result.details === "object" && result.details !== null && "error" in result.details;
      expect(isArray || isGracefulError).toBe(true);
    });
  });

  describe("github_secret_scanning_alerts", () => {
    it("returns an array or a graceful error", async () => {
      const tool = createGitHubSecretScanningAlertsTool(gh);
      let result: Awaited<ReturnType<typeof tool.execute>>;
      try {
        result = await tool.execute("t", { owner: TEST_OWNER, repo: TEST_REPO });
      } catch {
        return;
      }
      const isArray = Array.isArray(result.details);
      const isGracefulError =
        !isArray && typeof result.details === "object" && result.details !== null && "error" in result.details;
      expect(isArray || isGracefulError).toBe(true);
    });
  });

  describe("github_security_advisories", () => {
    it("returns an array or a graceful error", async () => {
      const tool = createGitHubSecurityAdvisoriesTool(gh);
      let result: Awaited<ReturnType<typeof tool.execute>>;
      try {
        result = await tool.execute("t", { owner: TEST_OWNER, repo: TEST_REPO });
      } catch {
        return;
      }
      const isArray = Array.isArray(result.details);
      const isGracefulError =
        !isArray && typeof result.details === "object" && result.details !== null && "error" in result.details;
      expect(isArray || isGracefulError).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Webhooks (read) — requires admin; graceful error is acceptable
  // -------------------------------------------------------------------------
  describe("github_webhook_list", () => {
    it("returns an array or a graceful error (requires admin access)", async () => {
      const tool = createGitHubWebhookListTool(gh);
      let result: Awaited<ReturnType<typeof tool.execute>>;
      try {
        result = await tool.execute("t", { owner: TEST_OWNER, repo: TEST_REPO });
      } catch {
        return;
      }
      const isArray = Array.isArray(result.details);
      const isGracefulError =
        !isArray && typeof result.details === "object" && result.details !== null && "error" in result.details;
      expect(isArray || isGracefulError).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Notifications (read)
  // -------------------------------------------------------------------------
  describe("github_notification_list", () => {
    it("returns a list (possibly empty) without error", async () => {
      const tool = createGitHubNotificationListTool(gh);
      const result = await tool.execute("t", { per_page: 5 });

      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  // =========================================================================
  // WRITE TESTS — opt-in via RUN_WRITE_TESTS=1 + GITHUB_WRITE_OWNER + GITHUB_WRITE_REPO
  // =========================================================================
  describe.skipIf(!RUN_WRITE_TESTS)("write operations (RUN_WRITE_TESTS=1)", () => {
    // -----------------------------------------------------------------------
    // Follow / unfollow
    // -----------------------------------------------------------------------
    it("github_user_follow — follows octocat", async () => {
      const tool = createGitHubUserFollowTool(gh);
      const result = await tool.execute("t", { username: "octocat" });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toMatchObject({ followed: "octocat" });
    });

    it("github_user_unfollow — unfollows octocat", async () => {
      const tool = createGitHubUserUnfollowTool(gh);
      const result = await tool.execute("t", { username: "octocat" });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toMatchObject({ unfollowed: "octocat" });
    });

    // -----------------------------------------------------------------------
    // Star / unstar
    // -----------------------------------------------------------------------
    it("github_repo_star — stars octocat/Hello-World", async () => {
      const tool = createGitHubRepoStarTool(gh);
      const result = await tool.execute("t", { owner: "octocat", repo: "Hello-World" });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toMatchObject({ success: true });
    });

    it("github_repo_unstar — unstars octocat/Hello-World", async () => {
      const tool = createGitHubRepoUnstarTool(gh);
      const result = await tool.execute("t", { owner: "octocat", repo: "Hello-World" });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toMatchObject({ success: true });
    });

    // -----------------------------------------------------------------------
    // Notifications
    // -----------------------------------------------------------------------
    it("github_notification_mark_read — marks all notifications read", async () => {
      const tool = createGitHubNotificationMarkReadTool(gh);
      const result = await tool.execute("t", {});

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toMatchObject({ success: true });
    });

    // -----------------------------------------------------------------------
    // User profile update (restore original bio after)
    // -----------------------------------------------------------------------
    describe("github_user_update — profile round-trip", () => {
      let originalBio: string | null = null;

      beforeAll(async () => {
        // Capture current bio so we can restore it
        const octokit = gh.getClient("default").getClient();
        const { data } = await octokit.rest.users.getAuthenticated();
        originalBio = data.bio ?? null;
      });

      afterAll(async () => {
        // Restore original bio regardless of test outcome
        const tool = createGitHubUserUpdateTool(gh);
        await tool.execute("t", { bio: originalBio ?? "" });
      });

      it("updates bio and gets back the new value", async () => {
        const tool = createGitHubUserUpdateTool(gh);
        const newBio = `[omniclaw-integration-test] ${Date.now()}`;
        const result = await tool.execute("t", { bio: newBio });

        expect(result.details).not.toHaveProperty("error");
        expect(result.details.bio).toBe(newBio);
      });
    });

    // -----------------------------------------------------------------------
    // Repo topics replace (restore original topics after)
    // -----------------------------------------------------------------------
    describe("github_repo_topics_replace — round-trip on WRITE_REPO", () => {
      let originalTopics: string[] = [];

      beforeAll(async () => {
        const octokit = gh.getClient("default").getClient();
        const { data } = await octokit.rest.repos.getAllTopics({
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
        });
        originalTopics = data.names ?? [];
      });

      afterAll(async () => {
        const tool = createGitHubRepoTopicsReplaceTool(gh);
        await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          names: originalTopics,
        });
      });

      it("replaces topics and returns the new set", async () => {
        const tool = createGitHubRepoTopicsReplaceTool(gh);
        const testTopics = ["omniclaw-test"];
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          names: testTopics,
        });

        expect(result.details).not.toHaveProperty("error");
        expect(result.details).toHaveProperty("topics");
        expect(result.details.topics).toEqual(testTopics);
      });
    });

    // -----------------------------------------------------------------------
    // Webhook lifecycle (requires admin on WRITE_REPO)
    // -----------------------------------------------------------------------
    describe("webhook lifecycle", () => {
      let webhookId: number;

      it("github_webhook_create — creates a test webhook", async () => {
        const tool = createGitHubWebhookCreateTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          url: "https://example.com/omniclaw-integration-test",
          content_type: "json",
          events: ["push"],
          active: false,
        });

        expect(result.details).not.toHaveProperty("error");
        expect(typeof result.details.id).toBe("number");
        webhookId = result.details.id;
      });

      it("github_webhook_update — deactivates the webhook", async () => {
        expect(webhookId).toBeTruthy();

        const tool = createGitHubWebhookUpdateTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          hook_id: webhookId,
          active: false,
        });

        expect(result.details).not.toHaveProperty("error");
        expect(result.details.id).toBe(webhookId);
      });

      it("github_webhook_delete — deletes the webhook", async () => {
        expect(webhookId).toBeTruthy();

        const tool = createGitHubWebhookDeleteTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          hook_id: webhookId,
        });

        expect(result.details).toMatchObject({ success: true });
      });
    });

    // -----------------------------------------------------------------------
    // Repo lifecycle: create → update → fork → delete
    // -----------------------------------------------------------------------
    describe("repo lifecycle", () => {
      const repoName = `omniclaw-integration-test-${Date.now()}`;
      let forkedRepoName: string | undefined;

      afterAll(async () => {
        // Best-effort cleanup: delete the forked repo if it was created
        if (forkedRepoName) {
          try {
            const octokit = gh.getClient("default").getClient();
            await octokit.rest.repos.delete({ owner: WRITE_OWNER, repo: forkedRepoName });
          } catch { /* ignore */ }
        }
      });

      it("github_repo_create — creates a private repo", async () => {
        const tool = createGitHubRepoCreateTool(gh);
        const result = await tool.execute("t", {
          name: repoName,
          description: "[omniclaw-integration-test] auto-cleanup",
          private: true,
          auto_init: true,
        });

        expect(result.details).not.toHaveProperty("error");
        expect(result.details.full_name).toContain(repoName);
        expect(result.details.private).toBe(true);
      });

      it("github_repo_update — updates the repo description", async () => {
        const tool = createGitHubRepoUpdateTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: repoName,
          description: "[omniclaw-integration-test] updated",
        });

        expect(result.details).not.toHaveProperty("error");
        expect(result.details.description).toBe("[omniclaw-integration-test] updated");
      });

      it("github_repo_fork — forks octocat/Hello-World", async () => {
        const tool = createGitHubRepoForkTool(gh);
        const result = await tool.execute("t", {
          owner: "octocat",
          repo: "Hello-World",
        });

        expect(result.details).not.toHaveProperty("error");
        expect(typeof result.details.full_name).toBe("string");
        // Store just the repo portion so we can delete it in afterAll
        forkedRepoName = result.details.full_name.split("/")[1];
      });

      it("github_repo_delete — deletes the created test repo", async () => {
        const tool = createGitHubRepoDeleteTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: repoName,
        });

        expect(result.details).toMatchObject({ success: true });
      });
    });
  });
});
