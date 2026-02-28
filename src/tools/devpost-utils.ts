// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

export function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call devpost_auth_setup to authenticate with Devpost first.",
};
