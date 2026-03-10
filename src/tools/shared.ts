// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AgentToolResult = any;

export function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

/**
 * Returns a standard auth-required error object directing the LLM to the
 * correct auth setup tool for the given service.
 */
export function authRequired(service: string) {
  return {
    error: "auth_required",
    action: `Call ${service}_auth_setup to authenticate.`,
  };
}

/**
 * Handles errors from API calls, returning auth_required for 401 errors
 * and operation_failed for everything else.
 */
export function handleApiError(err: unknown, service: string): AgentToolResult {
  const status = (err as { status?: number }).status;
  if (status === 401) {
    return jsonResult(authRequired(service));
  }
  return jsonResult({
    error: "operation_failed",
    message: err instanceof Error ? err.message : String(err),
  });
}
