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
export function createCanvasGradesTool(canvasManager: CanvasClientManager): any {
  return {
    name: "canvas_grades",
    label: "Canvas Grades",
    description:
      "Get grade information for a Canvas course, including current score, final score, and enrollment details.",
    parameters: Type.Object({
      course_id: Type.String({ description: "The Canvas course ID." }),
      account: Type.Optional(
        Type.String({
          description: "Canvas account name. Defaults to 'default'.",
          default: "default",
        })
      ),
    }),
    async execute(_toolCallId: string, params: { course_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!canvasManager.hasCredentials(account)) {
        return jsonResult(CANVAS_AUTH_REQUIRED);
      }
      try {
        // Fetch course with total scores and enrollments for the current user
        const [course, enrollments] = await Promise.all([
          canvasManager.get(account, `courses/${params.course_id}`, {
            "include[]": "total_scores",
          }),
          canvasManager.getPaginated(account, `courses/${params.course_id}/enrollments`, {
            user_id: "self",
          }),
        ]);

        return jsonResult({ course, enrollments });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
