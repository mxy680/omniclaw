/**
 * Integration tests — hit the real Vercel API.
 *
 * Required: Vercel token stored at ~/.openclaw/omniclaw-vercel-tokens.json
 * Or env var: VERCEL_TOKEN
 *
 * Run:
 *   pnpm vitest run tests/integration/vercel.test.ts
 *
 * Write tests (create/delete project) are opt-in:
 *   RUN_WRITE_TESTS=1 VERCEL_TOKEN=<token> pnpm vitest run tests/integration/vercel.test.ts
 */

import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { VercelClientManager } from "../../src/auth/vercel-client-manager.js";
import { createVercelAuthTool } from "../../src/tools/vercel-auth.js";
import {
  createVercelProjectsTool,
  createVercelGetProjectTool,
  createVercelCreateProjectTool,
  createVercelDeleteProjectTool,
} from "../../src/tools/vercel-projects.js";
import {
  createVercelDeploymentsTool,
  createVercelGetDeploymentTool,
  createVercelDeploymentEventsTool,
} from "../../src/tools/vercel-deployments.js";
import {
  createVercelDomainsTool,
} from "../../src/tools/vercel-domains.js";
import {
  createVercelEnvVarsTool,
} from "../../src/tools/vercel-env.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-vercel-tokens.json");
const ACCOUNT = "default";

const envToken = process.env.VERCEL_TOKEN;
const hasCredentials = !!envToken || existsSync(TOKENS_PATH);
const runWriteTests = process.env.RUN_WRITE_TESTS === "1";

if (!hasCredentials) {
  console.warn(
    "\n[integration] Skipping Vercel: no token found.\n" +
      `  Set VERCEL_TOKEN env var or add token to ${TOKENS_PATH}\n`,
  );
}

let vercelManager: VercelClientManager;

// ---------------------------------------------------------------------------
describe.skipIf(!hasCredentials)("Vercel API integration", { timeout: 30_000 }, () => {
  beforeAll(() => {
    vercelManager = new VercelClientManager(TOKENS_PATH);
    if (envToken && !vercelManager.hasToken(ACCOUNT)) {
      vercelManager.setToken(ACCOUNT, envToken);
    }
  });

  // -------------------------------------------------------------------------
  // vercel_auth_setup
  // -------------------------------------------------------------------------
  describe("vercel_auth_setup", () => {
    it("validates an existing token", async () => {
      const tool = createVercelAuthTool(vercelManager, { client_secret_path: "" });
      const token = vercelManager.getToken(ACCOUNT);
      const result = await tool.execute("t", { token, account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.status).toBe("authenticated");
      expect(typeof result.details.username).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // vercel_projects
  // -------------------------------------------------------------------------
  describe("vercel_projects", () => {
    it("lists projects", async () => {
      const tool = createVercelProjectsTool(vercelManager);
      const result = await tool.execute("t", { account: ACCOUNT, limit: "5" });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("projects");
      expect(Array.isArray(result.details.projects)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // vercel_get_project (uses first project from list)
  // -------------------------------------------------------------------------
  describe("vercel_get_project", () => {
    it("gets project details", async () => {
      // First, list projects to get a real project name
      const listTool = createVercelProjectsTool(vercelManager);
      const listResult = await listTool.execute("t", { account: ACCOUNT, limit: "1" });
      const projects = listResult.details?.projects;
      if (!projects || projects.length === 0) {
        console.warn("No projects found — skipping vercel_get_project test");
        return;
      }

      const projectName = projects[0].name;
      const tool = createVercelGetProjectTool(vercelManager);
      const result = await tool.execute("t", { project: projectName, account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.name).toBe(projectName);
    });
  });

  // -------------------------------------------------------------------------
  // vercel_deployments
  // -------------------------------------------------------------------------
  describe("vercel_deployments", () => {
    it("lists deployments", async () => {
      const tool = createVercelDeploymentsTool(vercelManager);
      const result = await tool.execute("t", { account: ACCOUNT, limit: "5" });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("deployments");
      expect(Array.isArray(result.details.deployments)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // vercel_get_deployment (uses first deployment from list)
  // -------------------------------------------------------------------------
  describe("vercel_get_deployment", () => {
    it("gets deployment details", async () => {
      const listTool = createVercelDeploymentsTool(vercelManager);
      const listResult = await listTool.execute("t", { account: ACCOUNT, limit: "1" });
      const deployments = listResult.details?.deployments;
      if (!deployments || deployments.length === 0) {
        console.warn("No deployments found — skipping vercel_get_deployment test");
        return;
      }

      const deploymentId = deployments[0].uid;
      const tool = createVercelGetDeploymentTool(vercelManager);
      const result = await tool.execute("t", { deployment: deploymentId, account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("id");
    });
  });

  // -------------------------------------------------------------------------
  // vercel_deployment_events
  // -------------------------------------------------------------------------
  describe("vercel_deployment_events", () => {
    it("gets build events for a deployment", async () => {
      const listTool = createVercelDeploymentsTool(vercelManager);
      const listResult = await listTool.execute("t", { account: ACCOUNT, limit: "1" });
      const deployments = listResult.details?.deployments;
      if (!deployments || deployments.length === 0) {
        console.warn("No deployments found — skipping vercel_deployment_events test");
        return;
      }

      const deploymentId = deployments[0].uid;
      const tool = createVercelDeploymentEventsTool(vercelManager);
      const result = await tool.execute("t", {
        deployment: deploymentId,
        limit: "10",
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      // Events come back as an array
      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // vercel_domains (requires a project)
  // -------------------------------------------------------------------------
  describe("vercel_domains", () => {
    it("lists domains for a project", async () => {
      const listTool = createVercelProjectsTool(vercelManager);
      const listResult = await listTool.execute("t", { account: ACCOUNT, limit: "1" });
      const projects = listResult.details?.projects;
      if (!projects || projects.length === 0) {
        console.warn("No projects found — skipping vercel_domains test");
        return;
      }

      const tool = createVercelDomainsTool(vercelManager);
      const result = await tool.execute("t", {
        project: projects[0].name,
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("domains");
    });
  });

  // -------------------------------------------------------------------------
  // vercel_env_vars (requires a project)
  // -------------------------------------------------------------------------
  describe("vercel_env_vars", () => {
    it("lists env vars for a project", async () => {
      const listTool = createVercelProjectsTool(vercelManager);
      const listResult = await listTool.execute("t", { account: ACCOUNT, limit: "1" });
      const projects = listResult.details?.projects;
      if (!projects || projects.length === 0) {
        console.warn("No projects found — skipping vercel_env_vars test");
        return;
      }

      const tool = createVercelEnvVarsTool(vercelManager);
      const result = await tool.execute("t", {
        project: projects[0].name,
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("envs");
    });
  });

  // -------------------------------------------------------------------------
  // Write tests (opt-in)
  // -------------------------------------------------------------------------
  describe.skipIf(!runWriteTests)("write operations", () => {
    const testProjectName = `omniclaw-test-${Date.now()}`;

    it("creates and deletes a project", async () => {
      const createTool = createVercelCreateProjectTool(vercelManager);
      const createResult = await createTool.execute("t", {
        name: testProjectName,
        framework: "nextjs",
        account: ACCOUNT,
      });

      expect(createResult.details).not.toHaveProperty("error");
      expect(createResult.details.name).toBe(testProjectName);

      // Clean up: delete the project
      const deleteTool = createVercelDeleteProjectTool(vercelManager);
      const deleteResult = await deleteTool.execute("t", {
        project: testProjectName,
        account: ACCOUNT,
      });

      expect(deleteResult.details).not.toHaveProperty("error");
    });
  });
});
