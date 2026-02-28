import type { JobStore } from "./job-store.js";
import type { WsServerInstance } from "./ws-server.js";
import type { WsClientMessage } from "./types.js";
import { toWsJob, toWsJobRun } from "./types.js";

export function handleJobMessage(
  connId: string,
  msg: WsClientMessage,
  store: JobStore,
  wsServer: WsServerInstance,
): void {
  switch (msg.type) {
    case "job_list": {
      const jobs = store.listJobs().map(toWsJob);
      wsServer.send(connId, { type: "job_list", jobs });
      break;
    }

    case "job_toggle": {
      const job = store.getJob(msg.jobId);
      if (!job) break;
      const newEnabled = !Boolean(job.enabled);
      store.updateJob(msg.jobId, { enabled: newEnabled });
      const updated = store.getJob(msg.jobId)!;
      wsServer.broadcast({ type: "job_updated", job: toWsJob(updated) });
      break;
    }

    case "job_runs": {
      const runs = store.listRuns(msg.jobId, msg.limit ?? 10).map(toWsJobRun);
      wsServer.send(connId, { type: "job_runs", jobId: msg.jobId, runs });
      break;
    }

    default:
      break;
  }
}
