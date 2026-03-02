import * as fs from "fs";
import * as path from "path";
import type { ScheduleRunResult } from "./types.js";

export class ResultStore {
  private getRunDir(agentWorkspace: string, jobId: string): string {
    return path.join(agentWorkspace, "schedule-results", jobId);
  }

  saveRun(agentWorkspace: string, run: ScheduleRunResult): void {
    const dir = this.getRunDir(agentWorkspace, run.jobId);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${run.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(run, null, 2), "utf-8");
  }

  getRun(agentWorkspace: string, jobId: string, runId: string): ScheduleRunResult | null {
    const filePath = path.join(this.getRunDir(agentWorkspace, jobId), `${runId}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ScheduleRunResult;
  }

  /** List runs for a job, sorted newest first. */
  listRuns(agentWorkspace: string, jobId: string, limit?: number): ScheduleRunResult[] {
    const dir = this.getRunDir(agentWorkspace, jobId);
    if (!fs.existsSync(dir)) return [];

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    const runs = files.map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf-8");
      return JSON.parse(raw) as ScheduleRunResult;
    });
    runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return limit ? runs.slice(0, limit) : runs;
  }

  getLatestRun(agentWorkspace: string, jobId: string): ScheduleRunResult | null {
    const runs = this.listRuns(agentWorkspace, jobId, 1);
    return runs[0] ?? null;
  }
}
