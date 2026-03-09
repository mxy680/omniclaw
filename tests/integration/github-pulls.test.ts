/**
 * Integration tests — hit the real GitHub API for pull request tools.
 *
 * Required env vars:
 *   GITHUB_TOKEN         GitHub Personal Access Token
 *
 * Read tests use the public "octocat/Hello-World" repo. Override with:
 *   GITHUB_TEST_OWNER    repo owner  (default: "octocat")
 *   GITHUB_TEST_REPO     repo name   (default: "Hello-World")
 *
 * Write tests are skipped unless ALL of the following are set:
 *   RUN_WRITE_TESTS=1
 *   GITHUB_WRITE_OWNER   owner of a repo the token can write to
 *   GITHUB_WRITE_REPO    name of that repo
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { rmSync } from "fs";
import { ApiKeyStore } from "../../src/auth/api-key-store.js";
import { GitHubClientManager } from "../../src/auth/github-client-manager.js";

import {
  createGitHubPullListTool,
  createGitHubPullGetTool,
  createGitHubPullCreateTool,
  createGitHubPullUpdateTool,
  createGitHubPullFilesTool,
  createGitHubPullDiffTool,
  createGitHubPullReviewListTool,
  createGitHubPullReviewCreateTool,
  createGitHubPullReviewCommentsTool,
  createGitHubPullRequestReviewersTool,
  createGitHubPullChecksTool,
} from "../../src/tools/github-pulls.js";

import {
  createGitHubBranchGetTool,
  createGitHubBranchCreateTool,
  createGitHubBranchDeleteTool,
} from "../../src/tools/github-branches.js";

import {
  createGitHubRepoGetTool,
  createGitHubRepoContentCreateTool,
} from "../../src/tools/github-repos.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const storePath = join(tmpdir(), `github-pulls-test-keys-${Date.now()}.json`);
const TEST_OWNER = process.env.GITHUB_TEST_OWNER ?? "octocat";
const TEST_REPO = process.env.GITHUB_TEST_REPO ?? "Hello-World";
const WRITE_OWNER = process.env.GITHUB_WRITE_OWNER ?? "";
const WRITE_REPO = process.env.GITHUB_WRITE_REPO ?? "";
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1" && WRITE_OWNER !== "" && WRITE_REPO !== "";

const hasToken = GITHUB_TOKEN.length > 0;

if (!hasToken) {
  console.warn(
    "\n[integration] Skipping GitHub pull request tests: GITHUB_TOKEN not set.\n",
  );
}

// ---------------------------------------------------------------------------
let gh: GitHubClientManager;

describe.skipIf(!hasToken)("GitHub Pull Requests integration", { timeout: 30_000 }, () => {
  let firstPrNumber: number;

  beforeAll(() => {
    const store = new ApiKeyStore(storePath);
    store.set("default", GITHUB_TOKEN);
    gh = new GitHubClientManager(store);
  });

  afterAll(() => {
    try { rmSync(storePath); } catch { /* ignore */ }
  });

  // -------------------------------------------------------------------------
  // Read tests
  // -------------------------------------------------------------------------
  describe("github_pull_list", () => {
    it("lists closed PRs for a public repo", async () => {
      const tool = createGitHubPullListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        state: "closed",
        per_page: 3,
      });

      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details[0]).toHaveProperty("number");
      expect(result.details[0]).toHaveProperty("title");
      firstPrNumber = result.details[0].number;
    });
  });

  describe("github_pull_get", () => {
    it("fetches a specific PR by number", async () => {
      expect(firstPrNumber).toBeTruthy();

      const tool = createGitHubPullGetTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        pull_number: firstPrNumber,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.number).toBe(firstPrNumber);
      expect(typeof result.details.title).toBe("string");
      expect(typeof result.details.state).toBe("string");
    });
  });

  describe("github_pull_files", () => {
    it("lists files changed in a PR", async () => {
      expect(firstPrNumber).toBeTruthy();

      const tool = createGitHubPullFilesTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        pull_number: firstPrNumber,
      });

      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toHaveProperty("filename");
      }
    });
  });

  describe("github_pull_diff", () => {
    it("returns diff text for a PR", async () => {
      expect(firstPrNumber).toBeTruthy();

      const tool = createGitHubPullDiffTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        pull_number: firstPrNumber,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("diff");
      expect(typeof result.details.diff).toBe("string");
    });
  });

  describe("github_pull_review_list", () => {
    it("returns a list (possibly empty) without error", async () => {
      expect(firstPrNumber).toBeTruthy();

      const tool = createGitHubPullReviewListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        pull_number: firstPrNumber,
      });

      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  describe("github_pull_review_comments", () => {
    it("returns a list (possibly empty) without error", async () => {
      expect(firstPrNumber).toBeTruthy();

      const tool = createGitHubPullReviewCommentsTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        pull_number: firstPrNumber,
      });

      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  describe("github_pull_request_reviewers", () => {
    it("returns requested reviewers without error", async () => {
      expect(firstPrNumber).toBeTruthy();

      const tool = createGitHubPullRequestReviewersTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        pull_number: firstPrNumber,
        reviewers: [],
      });

      expect(result.details).toBeDefined();
    });
  });

  describe("github_pull_checks", () => {
    it("returns check runs without error", async () => {
      expect(firstPrNumber).toBeTruthy();

      const tool = createGitHubPullChecksTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        pull_number: firstPrNumber,
      });

      expect(result.details).toBeDefined();
    });
  });

  // =========================================================================
  // WRITE TESTS — opt-in via RUN_WRITE_TESTS=1 + GITHUB_WRITE_OWNER + GITHUB_WRITE_REPO
  // =========================================================================
  describe.skipIf(!RUN_WRITE_TESTS)("write operations (RUN_WRITE_TESTS=1)", { timeout: 60_000 }, () => {
    const timestamp = Date.now();
    const branchName = `omniclaw-test-pr-${timestamp}`;
    let prNumber: number;

    afterAll(async () => {
      // Best-effort cleanup: delete the test branch
      try {
        const deleteTool = createGitHubBranchDeleteTool(gh);
        await deleteTool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          branch: branchName,
        });
      } catch { /* ignore cleanup errors */ }
    });

    it("creates a branch from the default branch", async () => {
      // Resolve the default branch name
      const repoTool = createGitHubRepoGetTool(gh);
      const repoResult = await repoTool.execute("t", {
        owner: WRITE_OWNER,
        repo: WRITE_REPO,
      });
      expect(repoResult.details).not.toHaveProperty("error");
      const defaultBranch: string = repoResult.details.default_branch;

      // Resolve the HEAD SHA of the default branch
      const branchInfoTool = createGitHubBranchGetTool(gh);
      const branchInfoResult = await branchInfoTool.execute("t", {
        owner: WRITE_OWNER,
        repo: WRITE_REPO,
        branch: defaultBranch,
      });
      expect(branchInfoResult.details).not.toHaveProperty("error");
      const defaultSha: string = branchInfoResult.details.commit.sha;
      expect(defaultSha).toBeTruthy();

      // Create the new branch
      const branchTool = createGitHubBranchCreateTool(gh);
      const branchResult = await branchTool.execute("t", {
        owner: WRITE_OWNER,
        repo: WRITE_REPO,
        branch: branchName,
        sha: defaultSha,
      });

      expect(branchResult.details).not.toHaveProperty("error");
      expect(branchResult.details.ref).toContain(branchName);
    });

    it("creates a file on the new branch", async () => {
      const contentTool = createGitHubRepoContentCreateTool(gh);
      const content = Buffer.from(
        `# omniclaw integration test\n\nTimestamp: ${timestamp}\n`,
      ).toString("base64");

      const result = await contentTool.execute("t", {
        owner: WRITE_OWNER,
        repo: WRITE_REPO,
        path: `omniclaw-test-${timestamp}.md`,
        message: "[omniclaw-integration-test] add test file",
        content,
        branch: branchName,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("sha");
    });

    it("github_pull_create — creates a PR", async () => {
      // Resolve the default branch name (needed for the base branch)
      const repoTool = createGitHubRepoGetTool(gh);
      const repoResult = await repoTool.execute("t", { owner: WRITE_OWNER, repo: WRITE_REPO });
      expect(repoResult.details).not.toHaveProperty("error");
      const defaultBranch: string = repoResult.details.default_branch;

      const tool = createGitHubPullCreateTool(gh);
      const result = await tool.execute("t", {
        owner: WRITE_OWNER,
        repo: WRITE_REPO,
        title: "[omniclaw-integration-test] auto-cleanup PR",
        body: "Automated integration test — will be closed.",
        head: branchName,
        base: defaultBranch,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.number).toBe("number");
      expect(typeof result.details.html_url).toBe("string");
      prNumber = result.details.number;
    });

    it("github_pull_update — updates the PR title", async () => {
      expect(prNumber).toBeTruthy();

      const tool = createGitHubPullUpdateTool(gh);
      const result = await tool.execute("t", {
        owner: WRITE_OWNER,
        repo: WRITE_REPO,
        pull_number: prNumber,
        title: "[omniclaw-integration-test] updated title",
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.number).toBe(prNumber);
      expect(result.details.title).toBe("[omniclaw-integration-test] updated title");
    });

    it("github_pull_review_create — submits a comment review", async () => {
      expect(prNumber).toBeTruthy();

      const tool = createGitHubPullReviewCreateTool(gh);
      const result = await tool.execute("t", {
        owner: WRITE_OWNER,
        repo: WRITE_REPO,
        pull_number: prNumber,
        event: "COMMENT",
        body: "test review",
      });

      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.id).toBe("number");
      expect(result.details.state).toBe("COMMENTED");
    });

    it("github_pull_update — closes the PR instead of merging", async () => {
      expect(prNumber).toBeTruthy();

      const tool = createGitHubPullUpdateTool(gh);
      const result = await tool.execute("t", {
        owner: WRITE_OWNER,
        repo: WRITE_REPO,
        pull_number: prNumber,
        state: "closed",
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.state).toBe("closed");
    });
  });
});
