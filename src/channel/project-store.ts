import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";
import { homedir } from "os";

// ── Types ───────────────────────────────────────────────────────────

export interface ProjectRow {
  id: string;
  name: string;
  description: string;
  color: string;
  created_at: number;
  updated_at: number;
}

export interface ProjectLinkRow {
  id: string;
  project_id: string;
  platform: string;
  identifier: string;
  display_name: string;
  metadata_json: string | null;
}

// ── Store ───────────────────────────────────────────────────────────

export class ProjectStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const dir = join(homedir(), ".openclaw");
    mkdirSync(dir, { recursive: true });
    const path = dbPath ?? join(dir, "omniclaw-projects.db");

    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  // ── Schema ──────────────────────────────────────────────────────

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        color       TEXT NOT NULL DEFAULT '#f0f6fc',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_links (
        id            TEXT PRIMARY KEY,
        project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        platform      TEXT NOT NULL,
        identifier    TEXT NOT NULL,
        display_name  TEXT NOT NULL DEFAULT '',
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_project_links_project
        ON project_links(project_id);
    `);
  }

  // ── Projects ──────────────────────────────────────────────────

  listProjects(): ProjectRow[] {
    return this.db
      .prepare("SELECT * FROM projects ORDER BY updated_at DESC")
      .all() as ProjectRow[];
  }

  getProject(id: string): ProjectRow | undefined {
    return this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as ProjectRow | undefined;
  }

  createProject(
    id: string,
    name: string,
    description?: string,
    color?: string,
  ): ProjectRow {
    const now = Date.now();
    this.db
      .prepare(
        "INSERT INTO projects (id, name, description, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, name, description ?? "", color ?? "#f0f6fc", now, now);
    return {
      id,
      name,
      description: description ?? "",
      color: color ?? "#f0f6fc",
      created_at: now,
      updated_at: now,
    };
  }

  updateProject(
    id: string,
    fields: { name?: string; description?: string; color?: string },
  ): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.name !== undefined) {
      sets.push("name = ?");
      values.push(fields.name);
    }
    if (fields.description !== undefined) {
      sets.push("description = ?");
      values.push(fields.description);
    }
    if (fields.color !== undefined) {
      sets.push("color = ?");
      values.push(fields.color);
    }

    if (sets.length === 0) return;

    sets.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);

    this.db
      .prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  deleteProject(id: string): void {
    this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  }

  // ── Links ─────────────────────────────────────────────────────

  listLinks(projectId: string): ProjectLinkRow[] {
    return this.db
      .prepare("SELECT * FROM project_links WHERE project_id = ?")
      .all(projectId) as ProjectLinkRow[];
  }

  addLink(
    id: string,
    projectId: string,
    platform: string,
    identifier: string,
    displayName?: string,
    metadataJson?: string,
  ): ProjectLinkRow {
    this.db
      .prepare(
        "INSERT INTO project_links (id, project_id, platform, identifier, display_name, metadata_json) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, projectId, platform, identifier, displayName ?? "", metadataJson ?? null);

    // Touch parent project
    this.db
      .prepare("UPDATE projects SET updated_at = ? WHERE id = ?")
      .run(Date.now(), projectId);

    return {
      id,
      project_id: projectId,
      platform,
      identifier,
      display_name: displayName ?? "",
      metadata_json: metadataJson ?? null,
    };
  }

  updateLinkMetadata(id: string, metadataJson: string): void {
    this.db
      .prepare("UPDATE project_links SET metadata_json = ? WHERE id = ?")
      .run(metadataJson, id);
  }

  removeLink(id: string): void {
    // Get project_id before deleting so we can touch the parent
    const link = this.db
      .prepare("SELECT project_id FROM project_links WHERE id = ?")
      .get(id) as { project_id: string } | undefined;

    this.db.prepare("DELETE FROM project_links WHERE id = ?").run(id);

    if (link) {
      this.db
        .prepare("UPDATE projects SET updated_at = ? WHERE id = ?")
        .run(Date.now(), link.project_id);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}
