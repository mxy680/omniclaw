import { FolderKanban } from "lucide-react";

interface EmptyStateProps {
  color: string;
}

export function EmptyState({ color }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}15` }}
      >
        <FolderKanban className="h-6 w-6" style={{ color }} />
      </div>
      <h3 className="text-sm font-semibold">No projects yet</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Ask the agent to set up your projects
      </p>
    </div>
  );
}
