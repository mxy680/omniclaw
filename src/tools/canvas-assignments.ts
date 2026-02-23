import { Type } from "@sinclair/typebox";
import type { CanvasClientManager } from "../auth/canvas-client-manager.js";

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
export function createCanvasAssignmentsTool(canvasManager: CanvasClientManager): any {
  return {
    name: "canvas_assignments",
    label: "Canvas Assignments",
    description:
      "List assignments for a Canvas course. Returns assignment id, name, due_at, points_possible, and submission status.",
    parameters: Type.Object({
      course_id: Type.String({ description: "The Canvas course ID." }),
      order_by: Type.Optional(
        Type.String({
          description: "Sort order: 'position', 'name', or 'due_at'. Defaults to 'due_at'.",
          default: "due_at",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Canvas account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { course_id: string; order_by?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!canvasManager.hasCredentials(account)) {
        return jsonResult(CANVAS_AUTH_REQUIRED);
      }
      try {
        const orderBy = params.order_by ?? "due_at";
        const assignments = await canvasManager.getPaginated(
          account,
          `courses/${params.course_id}/assignments`,
          {
            order_by: orderBy,
            "include[]": "submission",
          },
        );
        return jsonResult(assignments);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCanvasGetAssignmentTool(canvasManager: CanvasClientManager): any {
  return {
    name: "canvas_get_assignment",
    label: "Canvas Get Assignment",
    description: "Get details for a specific Canvas assignment.",
    parameters: Type.Object({
      course_id: Type.String({ description: "The Canvas course ID." }),
      assignment_id: Type.String({ description: "The Canvas assignment ID." }),
      account: Type.Optional(
        Type.String({
          description: "Canvas account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { course_id: string; assignment_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!canvasManager.hasCredentials(account)) {
        return jsonResult(CANVAS_AUTH_REQUIRED);
      }
      try {
        const assignment = await canvasManager.get(
          account,
          `courses/${params.course_id}/assignments/${params.assignment_id}`,
          { "include[]": "submission" },
        );
        return jsonResult(assignment);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
