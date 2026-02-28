"use client";

import { useState, useMemo } from "react";
import { Clock } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { JobCard } from "@/components/jobs/job-card";
import { JobEmptyState } from "@/components/jobs/job-empty-state";
import { JobStatusFilter } from "@/components/jobs/status-filter";
import { useJobs } from "@/hooks/use-jobs";

export default function JobsPage() {
  const { jobs, loading, toggleJob, loadRuns, runsCache } = useJobs();
  const [statusFilter, setStatusFilter] = useState("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { enabled: 0, disabled: 0 };
    for (const j of jobs) {
      if (j.enabled) c.enabled++;
      else c.disabled++;
    }
    return c;
  }, [jobs]);

  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? jobs
        : statusFilter === "enabled"
          ? jobs.filter((j) => j.enabled)
          : jobs.filter((j) => !j.enabled),
    [jobs, statusFilter],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionHeader
        icon={Clock}
        color="#f59e0b"
        title="Jobs"
        tagline="Scheduled cron tasks"
      />

      <JobStatusFilter value={statusFilter} onChange={setStatusFilter} counts={counts} />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-sm text-muted-foreground">Loading jobs...</div>
        </div>
      ) : filtered.length === 0 ? (
        <JobEmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((j) => (
            <JobCard
              key={j.id}
              job={j}
              runs={runsCache[j.id]}
              onToggle={() => toggleJob(j.id)}
              onExpand={() => loadRuns(j.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
