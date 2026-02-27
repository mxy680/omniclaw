import type { ProjectStore, ProjectRow, ProjectLinkRow } from "./project-store.js";
import type { WsServerInstance } from "./ws-server.js";
import type { WsClientMessage, WsProject, WsProjectLink } from "./types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function toWsProjectLink(row: ProjectLinkRow): WsProjectLink {
  return {
    id: row.id,
    platform: row.platform,
    identifier: row.identifier,
    displayName: row.display_name,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
  };
}

function toWsProject(row: ProjectRow, links: ProjectLinkRow[]): WsProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    links: links.map(toWsProjectLink),
  };
}

// ── Handlers ────────────────────────────────────────────────────────

export function handleProjectMessage(
  connId: string,
  msg: WsClientMessage,
  store: ProjectStore,
  wsServer: WsServerInstance,
): void {
  switch (msg.type) {
    case "project_list": {
      const projects = store.listProjects();
      const wsProjects = projects.map((p) =>
        toWsProject(p, store.listLinks(p.id)),
      );
      wsServer.send(connId, { type: "project_list", projects: wsProjects });
      break;
    }

    case "project_get": {
      const project = store.getProject(msg.projectId);
      if (!project) break;
      const links = store.listLinks(project.id);
      wsServer.send(connId, {
        type: "project_data",
        project: toWsProject(project, links),
        links: links.map(toWsProjectLink),
      });
      break;
    }

    case "project_delete": {
      const existing = store.getProject(msg.projectId);
      if (!existing) break;
      store.deleteProject(msg.projectId);
      wsServer.broadcast({ type: "project_deleted", projectId: msg.projectId });
      break;
    }

    default:
      break;
  }
}

// Re-export helpers for use by project-tools.ts (broadcast after writes)
export { toWsProject, toWsProjectLink };
