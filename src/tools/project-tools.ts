import { Type } from "@sinclair/typebox";
import { randomUUID } from "crypto";
import { getProjectStore } from "../channel/channel-plugin.js";
import { toWsProject, toWsProjectLink } from "../channel/project-handlers.js";
import { getWsServer } from "../channel/send.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function requireStore() {
  const store = getProjectStore();
  if (!store) throw new Error("Project store not initialized — iOS channel not running");
  return store;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createProjectListTool(): any {
  return {
    name: "project_list",
    label: "List Projects",
    description:
      "List all projects with their linked services. " +
      "ALWAYS call this first when the user mentions a project by name — " +
      "it returns project IDs needed by project_update, project_delete, project_add_link, and project_code_edit.",
    parameters: Type.Object({}),
    async execute() {
      const store = requireStore();
      const projects = store.listProjects();
      const result = projects.map((p) => {
        const links = store.listLinks(p.id);
        return toWsProject(p, links);
      });
      return jsonResult({ projects: result });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createProjectCreateTool(): any {
  return {
    name: "project_create",
    label: "Create Project",
    description:
      "Create a new project in the dashboard. A project groups linked services across platforms (GitHub, Vercel, Supabase, etc.).",
    parameters: Type.Object({
      name: Type.String({ description: "Project name (e.g. 'omniclaw', 'personal-site')" }),
      description: Type.Optional(
        Type.String({ description: "Short description of the project" }),
      ),
      color: Type.Optional(
        Type.String({ description: "Hex color for card accent (e.g. '#f0f6fc'). Defaults to '#f0f6fc'." }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { name: string; description?: string; color?: string },
    ) {
      const store = requireStore();
      const id = randomUUID();
      const row = store.createProject(id, params.name, params.description, params.color);
      const wsProject = toWsProject(row, []);

      const ws = getWsServer();
      if (ws) {
        ws.broadcast({ type: "project_created", project: wsProject });
      }

      return jsonResult({ status: "created", project: wsProject });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createProjectUpdateTool(): any {
  return {
    name: "project_update",
    label: "Update Project",
    description: "Update a project's name, description, or color.",
    parameters: Type.Object({
      project_id: Type.String({ description: "ID of the project to update" }),
      name: Type.Optional(Type.String({ description: "New project name" })),
      description: Type.Optional(Type.String({ description: "New description" })),
      color: Type.Optional(Type.String({ description: "New hex color" })),
    }),
    async execute(
      _toolCallId: string,
      params: { project_id: string; name?: string; description?: string; color?: string },
    ) {
      const store = requireStore();
      const existing = store.getProject(params.project_id);
      if (!existing) {
        return jsonResult({ status: "error", error: `Project ${params.project_id} not found` });
      }

      store.updateProject(params.project_id, {
        name: params.name,
        description: params.description,
        color: params.color,
      });

      const updated = store.getProject(params.project_id)!;
      const links = store.listLinks(params.project_id);
      const wsProject = toWsProject(updated, links);

      const ws = getWsServer();
      if (ws) {
        ws.broadcast({ type: "project_updated", project: wsProject });
      }

      return jsonResult({ status: "updated", project: wsProject });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createProjectDeleteTool(): any {
  return {
    name: "project_delete",
    label: "Delete Project",
    description: "Delete a project and all its linked services.",
    parameters: Type.Object({
      project_id: Type.String({ description: "ID of the project to delete" }),
    }),
    async execute(
      _toolCallId: string,
      params: { project_id: string },
    ) {
      const store = requireStore();
      const existing = store.getProject(params.project_id);
      if (!existing) {
        return jsonResult({ status: "error", error: `Project ${params.project_id} not found` });
      }

      store.deleteProject(params.project_id);

      const ws = getWsServer();
      if (ws) {
        ws.broadcast({ type: "project_deleted", projectId: params.project_id });
      }

      return jsonResult({ status: "deleted", projectId: params.project_id });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createProjectAddLinkTool(): any {
  return {
    name: "project_add_link",
    label: "Add Link to Project",
    description:
      "Link a platform service to a project (e.g. link a GitHub repo, Vercel project, or Supabase instance).",
    parameters: Type.Object({
      project_id: Type.String({ description: "ID of the project" }),
      platform: Type.String({
        description:
          'Platform identifier: "github", "vercel", "supabase", "cloudflare", "npm", etc.',
      }),
      identifier: Type.String({
        description:
          'Platform-specific ID (e.g. "mxy680/omniclaw" for GitHub, "prj_xxx" for Vercel)',
      }),
      display_name: Type.Optional(
        Type.String({ description: "Friendly name override" }),
      ),
      metadata: Type.Optional(
        Type.Unknown({ description: "Cached platform data (stars, deploy status, etc.)" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        project_id: string;
        platform: string;
        identifier: string;
        display_name?: string;
        metadata?: unknown;
      },
    ) {
      const store = requireStore();
      const existing = store.getProject(params.project_id);
      if (!existing) {
        return jsonResult({ status: "error", error: `Project ${params.project_id} not found` });
      }

      const id = randomUUID();
      const metadataJson = params.metadata
        ? JSON.stringify(params.metadata)
        : undefined;

      const row = store.addLink(
        id,
        params.project_id,
        params.platform,
        params.identifier,
        params.display_name,
        metadataJson,
      );

      const wsLink = toWsProjectLink(row);

      const ws = getWsServer();
      if (ws) {
        ws.broadcast({
          type: "project_link_added",
          projectId: params.project_id,
          link: wsLink,
        });
      }

      return jsonResult({ status: "linked", link: wsLink });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createProjectRemoveLinkTool(): any {
  return {
    name: "project_remove_link",
    label: "Remove Link from Project",
    description: "Remove a linked service from a project.",
    parameters: Type.Object({
      link_id: Type.String({ description: "ID of the link to remove" }),
    }),
    async execute(
      _toolCallId: string,
      params: { link_id: string },
    ) {
      const store = requireStore();

      // Find the parent project for the broadcast
      const allProjects = store.listProjects();
      let parentProjectId: string | undefined;
      for (const p of allProjects) {
        const links = store.listLinks(p.id);
        if (links.some((l) => l.id === params.link_id)) {
          parentProjectId = p.id;
          break;
        }
      }

      if (!parentProjectId) {
        return jsonResult({ status: "error", error: `Link ${params.link_id} not found` });
      }

      store.removeLink(params.link_id);

      const ws = getWsServer();
      if (ws) {
        ws.broadcast({
          type: "project_link_removed",
          projectId: parentProjectId,
          linkId: params.link_id,
        });
      }

      return jsonResult({
        status: "removed",
        linkId: params.link_id,
        projectId: parentProjectId,
      });
    },
  };
}
