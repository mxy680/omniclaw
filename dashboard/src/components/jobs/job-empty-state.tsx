import { Clock } from "lucide-react";

export function JobEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: "#f59e0b15" }}
      >
        <Clock className="h-6 w-6" style={{ color: "#f59e0b" }} />
      </div>
      <h3 className="text-sm font-semibold">No scheduled jobs</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Ask the agent to create a scheduled job to see it here
      </p>
    </div>
  );
}
