export interface ScheduleJob {
  id: string;
  name: string;
  agentId: string;
  cron: string;
  instructionFile: string;
  enabled: boolean;
  timezone?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  nextRun?: string;
  isRunning?: boolean;
}

export type RunStatus = 'running' | 'completed' | 'error';

export interface ScheduleRun {
  id: string;
  jobId: string;
  jobName?: string;
  agentId: string;
  startedAt: string;
  completedAt?: string;
  status: RunStatus;
  instruction: string;
  response: string;
  errorMessage?: string;
  durationMs?: number;
}

export function durationFormatted(ms?: number): string | undefined {
  if (ms == null) return undefined;
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${(seconds / 60).toFixed(1)} min`;
}
