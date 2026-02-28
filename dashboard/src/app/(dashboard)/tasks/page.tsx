"use client";

import { useState, useMemo } from "react";
import { ListTodo } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskEmptyState } from "@/components/tasks/task-empty-state";
import { StatusFilter } from "@/components/tasks/status-filter";
import { useTasks } from "@/hooks/use-tasks";

export default function TasksPage() {
  const { tasks, loading, approveTask, executeTask, deleteTask } = useTasks();
  const [statusFilter, setStatusFilter] = useState("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of tasks) {
      c[t.status] = (c[t.status] ?? 0) + 1;
    }
    return c;
  }, [tasks]);

  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? tasks
        : tasks.filter((t) => t.status === statusFilter),
    [tasks, statusFilter],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionHeader
        icon={ListTodo}
        color="#3b82f6"
        title="Tasks"
        tagline="Agent-proposed improvements and self-evolution pipeline"
      />

      <StatusFilter value={statusFilter} onChange={setStatusFilter} counts={counts} />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-sm text-muted-foreground">Loading tasks...</div>
        </div>
      ) : filtered.length === 0 ? (
        <TaskEmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onApprove={() => approveTask(t.id)}
              onExecute={() => executeTask(t.id)}
              onDelete={() => deleteTask(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
