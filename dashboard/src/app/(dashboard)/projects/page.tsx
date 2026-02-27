"use client";

import { useState, useMemo } from "react";
import { SectionHeader } from "@/components/section-header";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectDetail } from "@/components/projects/project-detail";
import { EmptyState } from "@/components/projects/empty-state";
import { getSection } from "@/lib/sections";
import { useProjects } from "@/hooks/use-projects";

const section = getSection("projects")!;

export default function ProjectsPage() {
  const { projects, loading, deleteProject } = useProjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => (selectedId ? projects.find((p) => p.id === selectedId) ?? null : null),
    [projects, selectedId],
  );

  if (selectedProject) {
    return (
      <div className="mx-auto max-w-6xl">
        <ProjectDetail
          project={selectedProject}
          onBack={() => setSelectedId(null)}
          onDelete={() => {
            deleteProject(selectedProject.id);
            setSelectedId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionHeader
        icon={section.icon}
        color={section.color}
        title={section.title}
        tagline={section.tagline}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-sm text-muted-foreground">Loading projects...</div>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState color={section.color} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onSelect={() => setSelectedId(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
