import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerPublishTool(manager: FramerClientManager): any {
  return {
    name: "framer_publish",
    label: "Framer Publish",
    description: "Publish the Framer project to staging. Returns the publish result with staging URL.",
    parameters: Type.Object({
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const result = await conn.publish();
        return jsonResult(result);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerDeployTool(manager: FramerClientManager): any {
  return {
    name: "framer_deploy",
    label: "Framer Deploy",
    description: "Deploy a specific deployment to production, optionally targeting specific domains.",
    parameters: Type.Object({
      deployment_id: Type.String({ description: "The deployment ID to deploy to production." }),
      domains: Type.Optional(Type.Array(Type.String(), { description: "Specific domains to deploy to. If omitted, deploys to all domains." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { deployment_id: string; domains?: string[]; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const hostnames = await conn.deploy(params.deployment_id, params.domains);
        return jsonResult(hostnames);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerDeploymentsListTool(manager: FramerClientManager): any {
  return {
    name: "framer_deployments_list",
    label: "Framer List Deployments",
    description: "List all deployments for the project.",
    parameters: Type.Object({
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const deployments = await conn.getDeployments();
        return jsonResult(deployments);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
