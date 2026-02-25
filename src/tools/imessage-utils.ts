// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

/**
 * Standard JSON result formatter matching the pattern used across omniclaw tools.
 */
export function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}
