export interface ConnectFrame {
  type: 'req';
  id: string;
  method: 'connect';
  params: {
    minProtocol: 3;
    maxProtocol: 3;
    client: { id: string; version: string; platform: string; mode: string };
    role: 'operator';
    scopes: string[];
    auth: { token: string };
  };
}

export interface ChatSendFrame {
  type: 'req';
  id: string;
  method: 'chat.send';
  params: {
    sessionKey: string;
    message: string;
    idempotencyKey: string;
  };
}

export interface ChatAbortFrame {
  type: 'req';
  id: string;
  method: 'chat.abort';
  params: {
    sessionKey: string;
    runId: string;
  };
}

export interface AgentsListFrame {
  type: 'req';
  id: string;
  method: 'agents.list';
  params: Record<string, never>;
}

// Incoming frames
export interface ResponseFrame {
  type: 'res';
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: { message: string };
}

export interface ChatEventFrame {
  type: 'event';
  event: 'chat';
  payload: {
    state: 'delta' | 'final' | 'error' | 'aborted';
    message?: { role: string; content: Array<{ type: string; text: string }> };
    errorMessage?: string;
  };
}
