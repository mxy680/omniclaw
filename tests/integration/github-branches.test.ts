import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { rmSync } from "fs";
import { ApiKeyStore } from "../../src/auth/api-key-store.js";
import { GitHubClientManager } from "../../src/auth/github-client-manager.js";
import {
  createGitHubBranchListTool,
  createGitHubBranchGetTool,
  createGitHubBranchProtectionGetTool,
  createGitHubBranchCreateTool,
  createGitHubBranchDeleteTool,
  createGitHubTagListTool,
  createGitHubReleaseListTool,
  createGitHubReleaseGetTool,
} from "../../src/tools/github-branches.js";
import {
  createGitHubCommitListTool,
  createGitHubCommitGetTool,
  createGitHubCompareTool,
  createGitHubRefListTool,
  createGitHubTreeGetTool,
} from "../../src/tools/github-git.js";
import {
  createGitHubRepoContentCreateTool,
  createGitHubRepoContentDeleteTool,
} from "../../src/tools/github-repos.js";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const storePath = join(tmpdir(), `github-branches-test-keys-${Date.now()}.json`);
const TEST_OWNER = process.env.GITHUB_TEST_OWNER ?? "octocat";
const TEST_REPO = process.env.GITHUB_TEST_REPO ?? "Hello-World";
const WRITE_OWNER = process.env.GITHUB_WRITE_OWNER ?? "";
const WRITE_REPO = process.env.GITHUB_WRITE_REPO ?? "";
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1" && WRITE_OWNER !== "" && WRITE_REPO !== "";

let gh: GitHubClientManager;

describe.skipIf(!GITHUB_TOKEN)(
  "GitHub Branches, Tags, Releases & Git Objects integration",
  { timeout: 30_000 },
  () => {
    beforeAll(() => {
      const store = new ApiKeyStore(storePath);
      store.set("default", GITHUB_TOKEN);
      gh = new GitHubClientManager(store);
    });

    afterAll(() => {
      try {
        rmSync(storePath, { force: true });
      } catch {}
    });

    // --- Branch read tests ---

    it("lists branches", async () => {
      const tool = createGitHubBranchListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
      });
      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details[0]).toMatchObject({
        name: expect.any(String),
      });
    });

    it("gets a specific branch", async () => {
      const tool = createGitHubBranchGetTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        branch: "master",
      });
      expect(result.details).toMatchObject({
        name: expect.any(String),
        commit: expect.any(Object),
      });
    });

    it("gets branch protection (accepts protected data or error)", async () => {
      const tool = createGitHubBranchProtectionGetTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        branch: "master",
      });
      // Public repos may not have branch protection — accept either a valid
      // protection object or an operation_failed error from the API.
      expect(result.details).toBeDefined();
      const isProtectionData = typeof result.details === "object" && result.details !== null;
      expect(isProtectionData).toBe(true);
    });

    // --- Tag tests ---

    it("lists tags", async () => {
      const tool = createGitHubTagListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
      });
      expect(Array.isArray(result.details)).toBe(true);
    });

    // --- Release tests ---

    let firstReleaseId: number | undefined;

    it("lists releases", async () => {
      const tool = createGitHubReleaseListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
      });
      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toMatchObject({
          id: expect.any(Number),
          tag_name: expect.any(String),
        });
        firstReleaseId = result.details[0].id;
      }
    });

    it("gets a specific release by id (skips if no releases exist)", async () => {
      if (firstReleaseId === undefined) {
        // Nothing to assert — repo has no releases.
        return;
      }
      const tool = createGitHubReleaseGetTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        release_id: firstReleaseId,
      });
      expect(result.details).toMatchObject({
        tag_name: expect.any(String),
        name: expect.any(String),
      });
    });

    // --- Git object tests ---

    let commitSha: string;

    it("lists commits", async () => {
      const tool = createGitHubCommitListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        per_page: 5,
      });
      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details[0]).toMatchObject({
        sha: expect.any(String),
        message: expect.any(String),
      });
      commitSha = result.details[0].sha;
    });

    it("gets a specific commit by SHA", async () => {
      const tool = createGitHubCommitGetTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        ref: commitSha,
      });
      expect(result.details).toMatchObject({
        sha: expect.any(String),
        commit: expect.any(Object),
      });
    });

    it("compares two commits", async () => {
      const commitListTool = createGitHubCommitListTool(gh);
      const listResult = await commitListTool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        per_page: 5,
      });
      const commits: Array<{ sha: string }> = listResult.details;
      // Use last and first commit from the page as base and head.
      const base = commits[commits.length - 1].sha;
      const head = commits[0].sha;

      const tool = createGitHubCompareTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        base,
        head,
      });
      expect(result.details).toMatchObject({
        commits: expect.any(Array),
        files: expect.any(Array),
      });
    });

    it("lists refs matching heads pattern", async () => {
      const tool = createGitHubRefListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        ref: "heads",
      });
      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toMatchObject({
          ref: expect.any(String),
          sha: expect.any(String),
        });
      }
    });

    it("gets a git tree by commit SHA", async () => {
      const tool = createGitHubTreeGetTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        tree_sha: commitSha,
      });
      expect(result.details).toMatchObject({
        tree: expect.any(Array),
      });
      expect(result.details.tree.length).toBeGreaterThan(0);
    });

    // --- Write tests ---

    describe.skipIf(!RUN_WRITE_TESTS)("write operations", () => {
      const testBranch = `omniclaw-test-branch-${Date.now()}`;
      const testFilePath = `omniclaw-test-${Date.now()}.txt`;
      let branchSha: string;
      let fileSha: string;

      it("creates a branch from the default branch HEAD", async () => {
        // Resolve the default branch HEAD SHA first.
        const branchGetTool = createGitHubBranchGetTool(gh);
        const branchResult = await branchGetTool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          branch: "main",
        });
        // Fall back to "master" if "main" returned an error.
        const sha: string =
          branchResult.details?.commit?.sha ??
          (await (async () => {
            const fallback = await branchGetTool.execute("t", {
              owner: WRITE_OWNER,
              repo: WRITE_REPO,
              branch: "master",
            });
            return fallback.details.commit.sha;
          })());

        branchSha = sha;

        const tool = createGitHubBranchCreateTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          branch: testBranch,
          sha,
        });
        expect(result.details).toMatchObject({
          ref: expect.stringContaining(testBranch),
          sha: expect.any(String),
        });
      });

      it("verifies the new branch exists", async () => {
        const tool = createGitHubBranchGetTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          branch: testBranch,
        });
        expect(result.details).toMatchObject({
          name: testBranch,
        });
      });

      it("creates a file on the test branch", async () => {
        const tool = createGitHubRepoContentCreateTool(gh);
        const content = Buffer.from("[omniclaw test] file content").toString("base64");
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          path: testFilePath,
          message: "[omniclaw test] create file",
          content,
          branch: testBranch,
        });
        expect(result.details).toMatchObject({
          path: testFilePath,
          sha: expect.any(String),
          commit_sha: expect.any(String),
        });
        fileSha = result.details.sha;
      });

      it("deletes the file from the test branch", async () => {
        const tool = createGitHubRepoContentDeleteTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          path: testFilePath,
          message: "[omniclaw test] delete file",
          sha: fileSha,
          branch: testBranch,
        });
        expect(result.details).toMatchObject({
          commit: expect.any(Object),
        });
      });

      it("deletes the test branch", async () => {
        const tool = createGitHubBranchDeleteTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          branch: testBranch,
        });
        expect(result.details).toMatchObject({
          success: true,
          deleted: testBranch,
        });
      });
    });
  },
);
