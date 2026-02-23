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
export function createCanvasSubmissionsTool(canvasManager: CanvasClientManager): any {
  return {
    name: "canvas_submissions",
    label: "Canvas Submissions",
    description:
      "List submissions for a Canvas assignment. Returns submission details including score, grade, submitted_at, and workflow_state.",
    parameters: Type.Object({
      course_id: Type.String({ description: "The Canvas course ID." }),
      assignment_id: Type.String({ description: "The Canvas assignment ID." }),
      account: Type.Optional(
        Type.String({
          description: "Canvas account name. Defaults to 'default'.",
          default: "default",
        })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { course_id: string; assignment_id: string; account?: string }
    ) {
      const account = params.account ?? "default";
      if (!canvasManager.hasCredentials(account)) {
        return jsonResult(CANVAS_AUTH_REQUIRED);
      }
      try {
        const submissions = await canvasManager.getPaginated(
          account,
          `courses/${params.course_id}/assignments/${params.assignment_id}/submissions`,
          { "include[]": ["submission_comments", "rubric_assessment"] }
        );
        return jsonResult(submissions);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
