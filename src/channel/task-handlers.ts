import type { TaskStore } from "./task-store.js";
import type { WsServerInstance } from "./ws-server.js";
import type { WsClientMessage } from "./types.js";
import { toWsTask } from "./task-types.js";
import { executeSelfTask, executeProjectTask } from "../tools/task-tools.js";

export function handleTaskMessage(
  connId: string,
  msg: WsClientMessage,
  store: TaskStore,
  wsServer: WsServerInstance,
): void {
  switch (msg.type) {
    case "task_list": {
      const tasks = store.listTasks().map(toWsTask);
      wsServer.send(connId, { type: "task_list", tasks });
      break;
    }

    case "task_approve": {
      const task = store.getTask(msg.taskId);
      if (!task) break;
      if (task.status !== "proposed") break;

      store.updateTask(msg.taskId, { status: "approved" });
      const updated = store.getTask(msg.taskId)!;
      wsServer.broadcast({ type: "task_updated", task: toWsTask(updated) });
      break;
    }

    case "task_delete": {
      const existing = store.getTask(msg.taskId);
      if (!existing) break;
      store.deleteTask(msg.taskId);
      wsServer.broadcast({ type: "task_deleted", taskId: msg.taskId });
      break;
    }

    case "task_execute": {
      const task = store.getTask(msg.taskId);
      if (!task) break;
      if (task.status !== "approved") break;

      // Check no other task is in_progress
      const inProgress = store.listTasks({ status: "in_progress" });
      if (inProgress.length > 0) break;

      // Run in background — don't block the WS handler
      const executeFn =
        task.target === "self" || !task.target
          ? executeSelfTask
          : executeProjectTask;

      executeFn(store, task).catch((err) => {
        store.updateTask(msg.taskId, {
          status: "failed",
          error: String(err),
        });
        const failedTask = store.getTask(msg.taskId);
        if (failedTask) {
          wsServer.broadcast({ type: "task_updated", task: toWsTask(failedTask) });
        }
      });
      break;
    }

    default:
      break;
  }
}
