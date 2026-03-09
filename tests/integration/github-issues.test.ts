import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { rmSync } from "fs";
import { ApiKeyStore } from "../../src/auth/api-key-store.js";
import { GitHubClientManager } from "../../src/auth/github-client-manager.js";
import {
  createGitHubIssueGetTool,
  createGitHubIssueCommentListTool,
  createGitHubIssueLabelListTool,
  createGitHubIssueMilestoneListTool,
  createGitHubIssueCreateTool,
  createGitHubIssueUpdateTool,
  createGitHubIssueCommentCreateTool,
  createGitHubIssueCommentUpdateTool,
  createGitHubIssueCommentDeleteTool,
  createGitHubIssueLabelCreateTool,
  createGitHubIssueMilestoneCreateTool,
} from "../../src/tools/github-issues.js";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const storePath = join(tmpdir(), `github-issues-test-keys-${Date.now()}.json`);
const TEST_OWNER = process.env.GITHUB_TEST_OWNER ?? "octocat";
const TEST_REPO = process.env.GITHUB_TEST_REPO ?? "Hello-World";
const WRITE_OWNER = process.env.GITHUB_WRITE_OWNER ?? "";
const WRITE_REPO = process.env.GITHUB_WRITE_REPO ?? "";
const RUN_WRITE_TESTS =
  process.env.RUN_WRITE_TESTS === "1" && WRITE_OWNER !== "" && WRITE_REPO !== "";

let gh: GitHubClientManager;

describe.skipIf(!GITHUB_TOKEN)(
  "GitHub Issues integration",
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

    it("gets a single issue", async () => {
      const tool = createGitHubIssueGetTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        issue_number: 1,
      });
      expect(result.details).toMatchObject({
        number: expect.any(Number),
        title: expect.any(String),
        state: expect.any(String),
      });
    });

    it("lists issue comments", async () => {
      const tool = createGitHubIssueCommentListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
        issue_number: 1,
        per_page: 5,
      });
      expect(Array.isArray(result.details)).toBe(true);
    });

    it("lists issue labels", async () => {
      const tool = createGitHubIssueLabelListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
      });
      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toMatchObject({
          name: expect.any(String),
          color: expect.any(String),
        });
      }
    });

    it("lists issue milestones", async () => {
      const tool = createGitHubIssueMilestoneListTool(gh);
      const result = await tool.execute("t", {
        owner: TEST_OWNER,
        repo: TEST_REPO,
      });
      expect(Array.isArray(result.details)).toBe(true);
    });

    // --- Write tests ---

    describe.skipIf(!RUN_WRITE_TESTS)("write operations", () => {
      let issueNumber: number;
      let commentId: number;
      const labelName = `omniclaw-test-${Date.now()}`;
      let milestoneNumber: number;

      afterAll(async () => {
        const octokit = gh.getClient("default").getClient();

        // Clean up label
        try {
          await octokit.rest.issues.deleteLabel({
            owner: WRITE_OWNER,
            repo: WRITE_REPO,
            name: labelName,
          });
        } catch {}

        // Clean up milestone
        if (milestoneNumber) {
          try {
            await octokit.rest.issues.deleteMilestone({
              owner: WRITE_OWNER,
              repo: WRITE_REPO,
              milestone_number: milestoneNumber,
            });
          } catch {}
        }
      });

      it("creates an issue", async () => {
        const tool = createGitHubIssueCreateTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          title: "[omniclaw test] issue",
          body: "test",
        });
        expect(result.details).toMatchObject({
          number: expect.any(Number),
        });
        issueNumber = result.details.number;
      });

      it("updates the issue title", async () => {
        const tool = createGitHubIssueUpdateTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          issue_number: issueNumber,
          title: "[omniclaw test] updated issue",
        });
        expect(result.details).toMatchObject({
          title: "[omniclaw test] updated issue",
        });
      });

      it("closes the issue", async () => {
        const tool = createGitHubIssueUpdateTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          issue_number: issueNumber,
          state: "closed",
        });
        expect(result.details).toMatchObject({
          state: "closed",
        });
      });

      it("creates a comment on the issue", async () => {
        const tool = createGitHubIssueCommentCreateTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          issue_number: issueNumber,
          body: "[omniclaw test] comment",
        });
        expect(result.details).toMatchObject({
          id: expect.any(Number),
        });
        commentId = result.details.id;
      });

      it("updates the comment", async () => {
        const tool = createGitHubIssueCommentUpdateTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          comment_id: commentId,
          body: "[omniclaw test] updated comment",
        });
        expect(result.details).toMatchObject({
          body: "[omniclaw test] updated comment",
        });
      });

      it("deletes the comment", async () => {
        const tool = createGitHubIssueCommentDeleteTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          comment_id: commentId,
        });
        expect(result.details).toBeDefined();
      });

      it("creates a label", async () => {
        const tool = createGitHubIssueLabelCreateTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          name: labelName,
          color: "ff0000",
        });
        expect(result.details).toMatchObject({
          name: labelName,
        });
      });

      it("creates a milestone", async () => {
        const tool = createGitHubIssueMilestoneCreateTool(gh);
        const result = await tool.execute("t", {
          owner: WRITE_OWNER,
          repo: WRITE_REPO,
          title: `omniclaw-test-milestone-${Date.now()}`,
        });
        expect(result.details).toMatchObject({
          number: expect.any(Number),
        });
        milestoneNumber = result.details.number;
      });
    });
  }
);
