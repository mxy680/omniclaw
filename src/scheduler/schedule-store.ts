import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { ScheduleJob, SchedulesFile } from "./types.js";

export const DEFAULT_SCHEDULES_PATH = path.join(os.homedir(), ".openclaw", "schedules.json");

export class ScheduleStore {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? DEFAULT_SCHEDULES_PATH;
  }

  load(): SchedulesFile {
    if (!fs.existsSync(this.filePath)) {
      return { version: 1, jobs: [] };
    }
    const raw = fs.readFileSync(this.filePath, "utf-8");
    return JSON.parse(raw) as SchedulesFile;
  }

  save(data: SchedulesFile): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  listJobs(): ScheduleJob[] {
    return this.load().jobs;
  }

  getJob(jobId: string): ScheduleJob | undefined {
    return this.load().jobs.find((j) => j.id === jobId);
  }

  createJob(job: ScheduleJob): void {
    const data = this.load();
    if (data.jobs.some((j) => j.id === job.id)) {
      throw new Error(`Job "${job.id}" already exists`);
    }
    data.jobs.push(job);
    this.save(data);
  }

  updateJob(jobId: string, updates: Partial<ScheduleJob>): ScheduleJob {
    const data = this.load();
    const index = data.jobs.findIndex((j) => j.id === jobId);
    if (index === -1) {
      throw new Error(`Job "${jobId}" not found`);
    }
    data.jobs[index] = { ...data.jobs[index], ...updates, id: jobId };
    this.save(data);
    return data.jobs[index];
  }

  deleteJob(jobId: string): void {
    const data = this.load();
    data.jobs = data.jobs.filter((j) => j.id !== jobId);
    this.save(data);
  }

  /** Resolve instruction file path for a job given the agent workspace path */
  resolveInstructionPath(job: ScheduleJob, agentWorkspace: string): string {
    if (path.isAbsolute(job.instructionFile)) {
      return job.instructionFile;
    }
    return path.join(agentWorkspace, "instructions", job.instructionFile);
  }

  /** Read instruction markdown content */
  readInstruction(job: ScheduleJob, agentWorkspace: string): string {
    const filePath = this.resolveInstructionPath(job, agentWorkspace);
    return fs.readFileSync(filePath, "utf-8");
  }
}
