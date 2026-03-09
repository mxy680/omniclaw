/**
 * Integration tests — hit the real GitHub API.
 *
 * Required env vars (or fall back to detected defaults):
 *   GITHUB_TOKEN         GitHub Personal Access Token
 *
 * Write tests are skipped unless:
 *   RUN_WRITE_TESTS=1    enable gist create/update/delete tests
 *
 * The test repo used for read tests defaults to "octocat/Hello-World"
 * (a well-known public repo). Override with:
 *   GITHUB_TEST_OWNER    repo owner  (default: "octocat")
 *   GITHUB_TEST_REPO     repo name   (default: "Hello-World")
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { rmSync } from "fs";
import { ApiKeyStore } from "../../src/auth/api-key-store.js";
import { GitHubClientManager } from "../../src/auth/github-client-manager.js";

// Read-only tool imports
import { createGitHubAuthSetupTool } from "../../src/tools/github-auth.js";
import {
  createGitHubRepoListTool,
  createGitHubRepoGetTool,
  createGitHubRepoContentGetTool,
  createGitHubRepoLanguagesTool,
  createGitHubRepoContributorsTool,
} from "../../src/tools/github-repos.js";
import {
  createGitHubIssueListTool,
} from "../../src/tools/github-issues.js";
import {
  createGitHubPRListTool,
} from "../../src/tools/github-pulls.js";
import {
  createGitHubSearchReposTool,
  createGitHubSearchUsersTool,
} from "../../src/tools/github-search.js";
import {
  createGitHubUserGetTool,
  createGitHubUserReposTool,
} from "../../src/tools/github-users.js";
import {
  createGitHubNotificationListTool,
} from "../../src/tools/github-notifications.js";
import {
  createGitHubGistListTool,
  createGitHubGistCreateTool,
  createGitHubGistGetTool,
  createGitHubGistUpdateTool,
  createGitHubGistDeleteTool,
} from "../../src/tools/github-gists.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const TEST_OWNER = process.env.GITHUB_TEST_OWNER ?? "octocat";
const TEST_REPO = process.env.GITHUB_TEST_REPO ?? "Hello-World";
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

const hasToken = GITHUB_TOKEN.length > 0;

if (!hasToken) {
  console.warn(
    "\n[integration] Skipping GitHub tests: GITHUB_TOKEN not set.\n",
  );
}

// ---------------------------------------------------------------------------
const storePath = join(tmpdir(), `github-test-keys-${Date.now()}.json`);
let gh: GitHubClientManager;

describe.skipIf(!hasToken)("GitHub API integration", { timeout: 30_000 }, () => {
  beforeAll(() => {
    const store = new ApiKeyStore(storePath);
    store.set("default", GITHUB_TOKEN);
    gh = new GitHubClientManager(store);
  });

  afterAll(() => {
    try { rmSync(storePath); } catch { /* ignore */ }
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  describe("github_auth_setup", () => {
    it("validates the token and returns user info", async () => {
      const tool = createGitHubAuthSetupTool(gh);
      const result = await tool.execute("t", { token: GITHUB_TOKEN });

      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.login).toBe("string");
      expect(typeof result.details.public_repos).toBe("number");
    });
  });

  // -------------------------------------------------------------------------
  // Repos — read
  // -------------------------------------------------------------------------
  describe("github_repo_list", () => {
    it("returns repos for the authenticated user", async () => {
      const tool = createGitHubRepoListTool(gh);
      const result = await tool.execute("t", { per_page: 5 });

      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toHaveProperty("full_name");
        expect(result.details[0]).toHaveProperty("language");
      }
    });
  });

  describe("github_repo_get", () => {
    it("fetches a public repo by owner/name", async () => {
      const tool = createGitHubRepoGetTool(gh);
      const result = await tool.execute("t", { owner: TEST_OWNER, repo: TEST_REPO });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.full_name).toBe(`${TEST_OWNER}/${TEST_REPO}`);
      expect(typeof result.details.description).toBe("string");
    });
  });

  describe("github_repo_content_get", () => {
    it("reads the README from a public repo", async () => {
      const tool = createGitHubRepoContentGetTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        path: "README",
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("name");
      expect(result.details).toHaveProperty("content");
    });
  });

  describe("github_repo_languages", () => {
    it("returns language breakdown", async () => {
      const tool = createGitHubRepoLanguagesTool(gh);
      const result = await tool.execute("t", { owner: TEST_OWNER, repo: TEST_REPO });

      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details).toBe("object");
    });
  });

  describe("github_repo_contributors", () => {
    it("returns at least one contributor", async () => {
      const tool = createGitHubRepoContributorsTool(gh);
      const result = await tool.execute("t", { owner: TEST_OWNER, repo: TEST_REPO, per_page: 5 });

      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details[0]).toHaveProperty("login");
    });
  });

  // -------------------------------------------------------------------------
  // Issues — read
  // -------------------------------------------------------------------------
  describe("github_issue_list", () => {
    it("lists issues for a public repo", async () => {
      const tool = createGitHubIssueListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        state: "all",
        per_page: 5,
      });

      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toHaveProperty("number");
        expect(result.details[0]).toHaveProperty("title");
        expect(result.details[0]).toHaveProperty("state");
      }
    });
  });

  // -------------------------------------------------------------------------
  // Pull Requests — read
  // -------------------------------------------------------------------------
  describe("github_pr_list", () => {
    it("lists PRs for a public repo", async () => {
      const tool = createGitHubPRListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        state: "all",
        per_page: 5,
      });

      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toHaveProperty("number");
        expect(result.details[0]).toHaveProperty("title");
      }
    });
  });

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------
  describe("github_search_repos", () => {
    it("searches for repos by keyword", async () => {
      const tool = createGitHubSearchReposTool(gh);
      const result = await tool.execute("t", { q: "typescript", per_page: 3 });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.total_count).toBeGreaterThan(0);
      expect(result.details.items.length).toBeGreaterThan(0);
      expect(result.details.items[0]).toHaveProperty("full_name");
    });
  });

  describe("github_search_users", () => {
    it("searches for users", async () => {
      const tool = createGitHubSearchUsersTool(gh);
      const result = await tool.execute("t", { q: "octocat", per_page: 3 });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.total_count).toBeGreaterThan(0);
      expect(result.details.items.length).toBeGreaterThan(0);
      expect(result.details.items[0]).toHaveProperty("login");
    });
  });

  // -------------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------------
  describe("github_user_get", () => {
    it("fetches a public user profile", async () => {
      const tool = createGitHubUserGetTool(gh);
      const result = await tool.execute("t", { username: "octocat" });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.login).toBe("octocat");
      expect(typeof result.details.public_repos).toBe("number");
    });
  });

  describe("github_user_repos", () => {
    it("lists public repos for a user", async () => {
      const tool = createGitHubUserReposTool(gh);
      const result = await tool.execute("t", { username: "octocat", per_page: 5 });

      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details[0]).toHaveProperty("full_name");
    });
  });

  // -------------------------------------------------------------------------
  // Notifications — read
  // -------------------------------------------------------------------------
  describe("github_notification_list", () => {
    it("returns a list (possibly empty) without error", async () => {
      const tool = createGitHubNotificationListTool(gh);
      const result = await tool.execute("t", { per_page: 5 });

      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Gists — read
  // -------------------------------------------------------------------------
  describe("github_gist_list", () => {
    it("returns a list (possibly empty) without error", async () => {
      const tool = createGitHubGistListTool(gh);
      const result = await tool.execute("t", { per_page: 5 });

      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  // =========================================================================
  // WRITE TESTS — opt-in via RUN_WRITE_TESTS=1
  // =========================================================================
  describe.skipIf(!RUN_WRITE_TESTS)("write operations (RUN_WRITE_TESTS=1)", () => {
    let gistId: string;

    it("github_gist_create — create a private gist", async () => {
      const tool = createGitHubGistCreateTool(gh);
      const result = await tool.execute("t", {
        description: "[omniclaw-integration-test] auto-cleanup",
        public: false,
        files: {
          "test.txt": { content: "Automated integration test — will be deleted." },
        },
      });

      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.id).toBe("string");
      expect(typeof result.details.html_url).toBe("string");
      gistId = result.details.id;
    });

    it("github_gist_get — fetch the created gist", async () => {
      expect(gistId).toBeTruthy();

      const tool = createGitHubGistGetTool(gh);
      const result = await tool.execute("t", { gist_id: gistId });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.id).toBe(gistId);
      expect(result.details.files).toHaveProperty("test.txt");
      expect(result.details.files["test.txt"].content).toContain("integration test");
    });

    it("github_gist_update — update the gist description", async () => {
      expect(gistId).toBeTruthy();

      const tool = createGitHubGistUpdateTool(gh);
      const result = await tool.execute("t", {
        gist_id: gistId,
        description: "[omniclaw-integration-test] updated",
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.id).toBe(gistId);
    });

    it("github_gist_delete — delete the gist", async () => {
      expect(gistId).toBeTruthy();

      const tool = createGitHubGistDeleteTool(gh);
      const result = await tool.execute("t", { gist_id: gistId });

      expect(result.details).toMatchObject({ success: true });
    });
  });
});
