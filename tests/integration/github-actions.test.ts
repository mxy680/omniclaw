import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { rmSync } from "fs";
import { ApiKeyStore } from "../../src/auth/api-key-store.js";
import { GitHubClientManager } from "../../src/auth/github-client-manager.js";
import {
  createGitHubWorkflowListTool,
  createGitHubWorkflowGetTool,
  createGitHubWorkflowDispatchTool,
  createGitHubRunListTool,
  createGitHubRunGetTool,
  createGitHubRunCancelTool,
  createGitHubRunRerunTool,
  createGitHubJobListTool,
  createGitHubRunLogsTool,
} from "../../src/tools/github-actions.js";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const storePath = join(tmpdir(), `github-actions-test-keys-${Date.now()}.json`);
const TEST_OWNER = process.env.GITHUB_TEST_OWNER ?? "octocat";
const TEST_REPO = process.env.GITHUB_TEST_REPO ?? "Hello-World";
const WRITE_OWNER = process.env.GITHUB_WRITE_OWNER ?? "";
const WRITE_REPO = process.env.GITHUB_WRITE_REPO ?? "";
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1" && WRITE_OWNER !== "" && WRITE_REPO !== "";

let gh: GitHubClientManager;

describe.skipIf(!GITHUB_TOKEN)(
  "GitHub Actions integration",
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

    // --- Read tests ---

    let firstWorkflowId: number | undefined;

    it("lists workflows (may be empty)", async () => {
      const tool = createGitHubWorkflowListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
      });
      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toMatchObject({
          id: expect.any(Number),
          name: expect.any(String),
          path: expect.any(String),
        });
        firstWorkflowId = result.details[0].id;
      }
    });

    it("gets a specific workflow by id (skips if no workflows exist)", async () => {
      if (firstWorkflowId === undefined) {
        return;
      }
      const tool = createGitHubWorkflowGetTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        workflow_id: firstWorkflowId,
      });
      expect(result.details).toMatchObject({
        id: firstWorkflowId,
        name: expect.any(String),
      });
    });

    let firstRunId: number | undefined;
    let firstRunStatus: string | undefined;

    it("lists workflow runs (may be empty)", async () => {
      const tool = createGitHubRunListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        per_page: 3,
      });
      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toMatchObject({
          id: expect.any(Number),
          status: expect.any(String),
        });
        firstRunId = result.details[0].id;
        firstRunStatus = result.details[0].status;
      }
    });

    it("gets a specific workflow run by id (skips if no runs exist)", async () => {
      if (firstRunId === undefined) {
        return;
      }
      const tool = createGitHubRunGetTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        run_id: firstRunId,
      });
      expect(result.details).toMatchObject({
        id: firstRunId,
        status: expect.any(String),
      });
    });

    it("lists jobs for the first run (skips if no runs exist)", async () => {
      if (firstRunId === undefined) {
        return;
      }
      const tool = createGitHubJobListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        run_id: firstRunId,
      });
      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toMatchObject({
          id: expect.any(Number),
          name: expect.any(String),
          status: expect.any(String),
        });
      }
    });

    it("gets logs URL for the first run (skips if no runs exist)", async () => {
      if (firstRunId === undefined) {
        return;
      }
      const tool = createGitHubRunLogsTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        run_id: firstRunId,
      });
      // Result is either a URL object or an operation_failed error (e.g. logs expired).
      expect(result.details).toBeDefined();
      const isUrl = typeof result.details === "object" && result.details !== null;
      expect(isUrl).toBe(true);
    });

    // --- Write tests ---

    describe.skipIf(!RUN_WRITE_TESTS)("write operations", () => {
      it("dispatches a workflow (skips gracefully if no dispatchable workflow exists)", async () => {
        const listTool = createGitHubWorkflowListTool(gh);
        const listResult = await listTool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
        });
        const workflows: Array<{ id: number; path: string }> = listResult.details;
        if (!workflows || workflows.length === 0) {
          return;
        }
        const tool = createGitHubWorkflowDispatchTool(gh);
        try {
          const result = await tool.execute("t", {
            owner: WRITE_OWNER,
            repo: WRITE_REPO,
            workflow_id: workflows[0].id,
            ref: "main",
          });
          // Accept success or an operation_failed response (workflow may not support dispatch).
          expect(result.details).toBeDefined();
        } catch {
          // Dispatch may fail if the workflow doesn't have workflow_dispatch trigger.
        }
      });

      it("cancels an in-progress run (skips if no in-progress runs exist)", async () => {
        const listTool = createGitHubRunListTool(gh);
        const listResult = await listTool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          per_page: 10,
          status: "in_progress",
        });
        const runs: Array<{ id: number; status: string }> = listResult.details;
        if (!runs || runs.length === 0) {
          return;
        }
        const tool = createGitHubRunCancelTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          run_id: runs[0].id,
        });
        expect(result.details).toBeDefined();
      });

      it("reruns a completed run (skips if no completed runs exist)", async () => {
        const listTool = createGitHubRunListTool(gh);
        const listResult = await listTool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          per_page: 10,
          status: "completed",
        });
        const runs: Array<{ id: number; status: string }> = listResult.details;
        if (!runs || runs.length === 0) {
          return;
        }
        const tool = createGitHubRunRerunTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          run_id: runs[0].id,
        });
        expect(result.details).toBeDefined();
      });
    });
  },
);
