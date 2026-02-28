import { ListTodo } from "lucide-react";

export function TaskEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: "#3b82f615" }}
      >
        <ListTodo className="h-6 w-6" style={{ color: "#3b82f6" }} />
      </div>
      <h3 className="text-sm font-semibold">No tasks yet</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Tasks appear here when the agent proposes improvements
      </p>
    </div>
  );
}
