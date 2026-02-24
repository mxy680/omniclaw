/**
 * Integration tests — hit the real GitHub API.
 *
 * Required: GitHub token stored at ~/.openclaw/omniclaw-github-tokens.json
 * Or env var: GITHUB_TOKEN
 *
 * Run:
 *   pnpm vitest run tests/integration/github.test.ts
 */

import { existsSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GitHubClientManager } from "../../src/auth/github-client-manager.js";
import {
  createGitHubReposTool,
  createGitHubGetRepoTool,
  createGitHubSearchCodeTool,
  createGitHubGetFileTool,
  createGitHubBranchesTool,
} from "../../src/tools/github-repos.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-github-tokens.json");
const ACCOUNT = "default";

let ghManager: GitHubClientManager;

// Check if token exists via env or file
const envToken = process.env.GITHUB_TOKEN;
const hasCredentials = !!envToken || existsSync(TOKENS_PATH);

if (!hasCredentials) {
  console.warn(
    "\n[integration] Skipping GitHub: no token found.\n" +
      `  Set GITHUB_TOKEN env var or add token to ${TOKENS_PATH}\n`,
  );
}

const GITHUB_SAVE_DIR = join(tmpdir(), `omniclaw-github-test-${Date.now()}`);

// ---------------------------------------------------------------------------
describe.skipIf(!hasCredentials)("GitHub API integration", { timeout: 30_000 }, () => {
  beforeAll(() => {
    ghManager = new GitHubClientManager(TOKENS_PATH);
    if (envToken && !ghManager.hasToken(ACCOUNT)) {
      ghManager.setToken(ACCOUNT, envToken);
    }
  });

  afterAll(() => {
    try {
      if (existsSync(GITHUB_SAVE_DIR)) {
        for (const file of readdirSync(GITHUB_SAVE_DIR)) {
          unlinkSync(join(GITHUB_SAVE_DIR, file));
        }
        rmdirSync(GITHUB_SAVE_DIR);
      }
    } catch { /* best-effort cleanup */ }
  });

  // -------------------------------------------------------------------------
  // github_repos
  // -------------------------------------------------------------------------
  describe("github_repos", () => {
    it("lists repos for the authenticated user", async () => {
      const tool = createGitHubReposTool(ghManager);
      const result = await tool.execute("t", { account: ACCOUNT, per_page: "5" });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // github_get_file — text mode (existing behavior)
  // -------------------------------------------------------------------------
  describe("github_get_file", () => {
    it("reads a text file from a public repo", async () => {
      const tool = createGitHubGetFileTool(ghManager);
      const result = await tool.execute("t", {
        owner: "octocat",
        repo: "Hello-World",
        path: "README",
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.content).toBe("string");
      expect(result.details.content.length).toBeGreaterThan(0);
    });

    it("downloads a file to disk with save_dir", async () => {
      const tool = createGitHubGetFileTool(ghManager);
      const result = await tool.execute("t", {
        owner: "octocat",
        repo: "Hello-World",
        path: "README",
        save_dir: GITHUB_SAVE_DIR,
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.mode).toBe("downloaded");
      expect(typeof result.details.path).toBe("string");
      expect(existsSync(result.details.path)).toBe(true);
      expect(result.details.size).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // github_branches
  // -------------------------------------------------------------------------
  describe("github_branches", () => {
    it("lists branches for a public repo", async () => {
      const tool = createGitHubBranchesTool(ghManager);
      const result = await tool.execute("t", {
        owner: "octocat",
        repo: "Hello-World",
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // github_search_code
  // -------------------------------------------------------------------------
  describe("github_search_code", () => {
    it("searches for code in a specific repo", async () => {
      const tool = createGitHubSearchCodeTool(ghManager);
      const result = await tool.execute("t", {
        query: "repo:octocat/Hello-World Hello",
        per_page: "3",
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.total_count).toBe("number");
    });
  });

  // -------------------------------------------------------------------------
  // github_get_repo
  // -------------------------------------------------------------------------
  describe("github_get_repo", () => {
    it("gets details for a public repo", async () => {
      const tool = createGitHubGetRepoTool(ghManager);
      const result = await tool.execute("t", {
        owner: "octocat",
        repo: "Hello-World",
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.full_name).toBe("octocat/Hello-World");
    });
  });
});
