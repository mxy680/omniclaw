"use client";

import type { WsProject } from "@/lib/websocket";
import { getPlatformConfig, GitHubMeta } from "./platform-config";

// ── Project card ────────────────────────────────────────────────────

interface ProjectCardProps {
  project: WsProject;
  onSelect: () => void;
}

export function ProjectCard({ project, onSelect }: ProjectCardProps) {
  // Inline GitHub stats from the first GitHub link with metadata
  const githubLink = project.links.find(
    (l) => l.platform === "github" && l.metadata,
  );
  const ghMeta = githubLink?.metadata as Record<string, unknown> | null;

  return (
    <div
      className="cursor-pointer rounded-xl border border-border bg-card/40 p-5 transition-colors hover:bg-card/60"
      style={{ borderLeftColor: project.color, borderLeftWidth: 3 }}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold">{project.name}</h3>
        {project.description && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {project.description}
          </p>
        )}
      </div>

      {/* Platform icons row */}
      <div className="mt-3 flex items-center gap-2">
        {project.links.map((link) => {
          const cfg = getPlatformConfig(link.platform);
          const Icon = cfg.icon;
          return (
            <div
              key={link.id}
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: `${cfg.color}20` }}
              title={`${cfg.label}: ${link.identifier}`}
            >
              <Icon className="h-3 w-3" style={{ color: cfg.color }} />
            </div>
          );
        })}
        {project.links.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {project.links.length} service{project.links.length !== 1 ? "s" : ""} linked
          </span>
        )}
      </div>

      {/* Inline GitHub stats */}
      {ghMeta && (
        <div className="mt-2">
          <GitHubMeta metadata={ghMeta} />
        </div>
      )}
    </div>
  );
}
