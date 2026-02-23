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
export function createCanvasAnnouncementsTool(canvasManager: CanvasClientManager): any {
  return {
    name: "canvas_announcements",
    label: "Canvas Announcements",
    description:
      "List announcements for Canvas courses. If no course_ids provided, fetches all active courses and returns their announcements.",
    parameters: Type.Object({
      course_ids: Type.Optional(
        Type.Array(Type.Number(), {
          description:
            "List of course IDs to fetch announcements for. Fetches all active courses if omitted.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Canvas account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { course_ids?: number[]; account?: string }) {
      const account = params.account ?? "default";
      if (!canvasManager.hasCredentials(account)) {
        return jsonResult(CANVAS_AUTH_REQUIRED);
      }
      try {
        let courseIds = params.course_ids;

        if (!courseIds || courseIds.length === 0) {
          // Fetch all active courses to get their IDs
          const courses = (await canvasManager.getPaginated(account, "courses", {
            enrollment_state: "active",
          })) as Array<{ id: number }>;
          courseIds = courses.map((c) => c.id);
        }

        if (courseIds.length === 0) {
          return jsonResult([]);
        }

        const contextCodes = courseIds.map((id) => `course_${id}`);
        const announcements = await canvasManager.getPaginated(account, "announcements", {
          "context_codes[]": contextCodes,
        });
        return jsonResult(announcements);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
