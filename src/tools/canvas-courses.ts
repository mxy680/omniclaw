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
export function createCanvasCoursesTool(canvasManager: CanvasClientManager): any {
  return {
    name: "canvas_courses",
    label: "Canvas Courses",
    description:
      "List your Canvas courses. Returns course id, name, course_code, and enrollment state.",
    parameters: Type.Object({
      enrollment_state: Type.Optional(
        Type.String({
          description:
            "Filter by enrollment state: 'active', 'invited_or_pending', 'completed'. Defaults to 'active'.",
          default: "active",
        })
      ),
      account: Type.Optional(
        Type.String({
          description: "Canvas account name. Defaults to 'default'.",
          default: "default",
        })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { enrollment_state?: string; account?: string }
    ) {
      const account = params.account ?? "default";
      if (!canvasManager.hasCredentials(account)) {
        return jsonResult(CANVAS_AUTH_REQUIRED);
      }
      try {
        const enrollmentState = params.enrollment_state ?? "active";
        const courses = await canvasManager.getPaginated(account, "courses", {
          enrollment_state: enrollmentState,
          "include[]": "term",
        });
        return jsonResult(courses);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCanvasGetCourseTool(canvasManager: CanvasClientManager): any {
  return {
    name: "canvas_get_course",
    label: "Canvas Get Course",
    description: "Get details for a specific Canvas course by ID.",
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
        const course = await canvasManager.get(account, `courses/${params.course_id}`, {
          "include[]": ["term", "teachers", "total_students"],
        });
        return jsonResult(course);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
