const LS_KEY = "omniclaw-operations";
const EVENT_NAME = "omniclaw-operations-updated";

export interface StoredOperation {
  id: string;
  toolName: string;
  phase: "start" | "end";
  conversationId: string;
  conversationTitle: string;
  timestamp: string;
}

export function loadOperations(): StoredOperation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredOperation[];
  } catch {
    return [];
  }
}

function save(ops: StoredOperation[]) {
  const trimmed = ops.slice(-500);
  localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function appendOperation(op: StoredOperation) {
  const ops = loadOperations();
  ops.push(op);
  save(ops);
}

export function completeOperation(
  toolName: string,
  conversationId: string,
) {
  const ops = loadOperations();
  // Find the last "start" entry for this tool+conversation
  for (let i = ops.length - 1; i >= 0; i--) {
    if (
      ops[i].toolName === toolName &&
      ops[i].phase === "start" &&
      ops[i].conversationId === conversationId
    ) {
      ops[i] = { ...ops[i], phase: "end" };
      break;
    }
  }
  save(ops);
}

export function onOperationsUpdated(cb: () => void): () => void {
  window.addEventListener(EVENT_NAME, cb);
  return () => window.removeEventListener(EVENT_NAME, cb);
}
