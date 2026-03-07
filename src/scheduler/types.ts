// ---------------------------------------------------------------------------
// Schedule job configuration
// ---------------------------------------------------------------------------

export interface ScheduleJob {
  id: string;
  name: string;
  agentId: string;
  cron: string;
  /** Relative to agent workspace instructions/ dir, or absolute if starts with / */
  instructionFile: string;
  enabled: boolean;
  timezone?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulesFile {
  version: 1;
  jobs: ScheduleJob[];
}

// ---------------------------------------------------------------------------
// Schedule run results
// ---------------------------------------------------------------------------

export interface ScheduleRunResult {
  id: string;
  jobId: string;
  jobName?: string;
  agentId: string;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "completed" | "error";
  instruction: string;
  response: string;
  errorMessage?: string;
  durationMs?: number;
}
