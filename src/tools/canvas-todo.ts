import { Type } from "@sinclair/typebox";
import type { CanvasClientManager } from "../auth/canvas-client-manager";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const CANVAS_AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call canvas_auth_setup with your Canvas base_url and api_token.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCanvasTodoTool(canvasManager: CanvasClientManager): any {
  return {
    name: "canvas_todo",
    label: "Canvas Todo",
    description:
      "Get your Canvas to-do list: upcoming assignments, quizzes, and other items needing attention.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Canvas account name. Defaults to 'default'.",
          default: "default",
        })
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      if (!canvasManager.hasCredentials(account)) {
        return jsonResult(CANVAS_AUTH_REQUIRED);
      }
      try {
        const todo = await canvasManager.get(account, "users/self/todo");
        return jsonResult(todo);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
