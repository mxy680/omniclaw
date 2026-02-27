"use client";

import { useState } from "react";
import type { WsProject } from "@/lib/websocket";
import { ArrowLeft, CalendarDays, Link2, Trash2 } from "lucide-react";
import { LinkDetail } from "./platform-config";

interface ProjectDetailProps {
  project: WsProject;
  onBack: () => void;
  onDelete: () => void;
}

export function ProjectDetail({ project, onBack, onDelete }: ProjectDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const created = new Date(project.createdAt);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </button>

      {/* Project header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold"
            style={{ backgroundColor: `${project.color}20`, color: project.color }}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>

        {/* Delete button */}
        {confirmDelete ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={onDelete}
              className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25"
            >
              Delete project
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          Created {created.toLocaleDateString()}
        </span>
        <span className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          {project.links.length} service{project.links.length !== 1 ? "s" : ""} linked
        </span>
      </div>

      {/* Linked services */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Linked Services</h2>
        {project.links.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No services linked yet. Ask the agent to link a GitHub repo,
              Vercel project, or other service.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {project.links.map((link) => (
              <LinkDetail key={link.id} link={link} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
