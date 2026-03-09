import { Platform } from 'react-native';
import { ChatSendFrame, ChatAbortFrame } from '../types/protocol';

export interface ServerConfig {
  host: string;
  port: number;
  authToken: string;
  useTLS?: boolean;
}

type ChatCallbacks = {
  onDelta: (fullText: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
};

export class ChatService {
  isConnected = false;
  isStreaming = false;
  private ws: WebSocket | null = null;
  private requestCounter = 0;
  private currentRunId: string | null = null;
  private currentSessionKey: string | null = null;
  private callbacks: ChatCallbacks | null = null;
  private onStateChange?: () => void;
  private accumulatedText = '';

  constructor(onStateChange?: () => void) {
    this.onStateChange = onStateChange;
  }

  private nextId(): string {
    this.requestCounter += 1;
    return `rn-${this.requestCounter}`;
  }

  private notifyStateChange(): void {
    this.onStateChange?.();
  }

  async connect(config: ServerConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.close();
        this.ws = null;
      }

      const { host, port, authToken, useTLS } = config;
      const scopes = ['operator.read', 'operator.write'];
      const proto = useTLS ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${host}:${port}`);
      this.ws = ws;
      let settled = false;

      const settle = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

      ws.onmessage = (event) => {
        let json: Record<string, unknown>;
        try {
          json = JSON.parse(event.data as string);
        } catch {
          return;
        }

        // Send connect frame (token-only, no device auth)
        if (json.type === 'event' && json.event === 'connect.challenge') {
          ws.send(JSON.stringify({
            type: 'req',
            id: this.nextId(),
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: 'openclaw-control-ui',
                version: '1.0.0',
                platform: Platform.OS,
                mode: 'ui',
              },
              role: 'operator',
              scopes,
              auth: { token: authToken },
            },
          }));
          return;
        }

        // Skip other events during handshake
        if (json.type === 'event') return;

        if (json.type === 'res') {
          if (json.ok) {
            this.isConnected = true;
            this.notifyStateChange();
            ws.onmessage = this.handleMessage.bind(this);
            settle();
          } else {
            const errMsg =
              (json.error as Record<string, unknown> | undefined)?.message as string | undefined ??
              'Connection rejected by server';
            settle(new Error(errMsg));
          }
        }
      };

      ws.onerror = () => {
        settle(new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        if (!settled) {
          settle(new Error('WebSocket closed before handshake'));
        }
        this.isConnected = false;
        this.isStreaming = false;
        this.callbacks = null;
        this.currentRunId = null;
        this.currentSessionKey = null;
        this.accumulatedText = '';
        this.notifyStateChange();
      };
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnected = false;
    this.isStreaming = false;
    this.callbacks = null;
    this.currentRunId = null;
    this.currentSessionKey = null;
    this.accumulatedText = '';
    this.notifyStateChange();
  }

  sendMessage(text: string, sessionKey: string, callbacks: ChatCallbacks): void {
    if (!this.ws || !this.isConnected) {
      callbacks.onError(new Error('Not connected'));
      return;
    }

    this.callbacks = callbacks;
    this.currentSessionKey = sessionKey;
    this.currentRunId = null;
    this.accumulatedText = '';
    this.isStreaming = true;
    this.notifyStateChange();

    const frame: ChatSendFrame = {
      type: 'req',
      id: this.nextId(),
      method: 'chat.send',
      params: {
        sessionKey,
        message: text,
        idempotencyKey: this.nextId(),
      },
    };
    this.ws.send(JSON.stringify(frame));
  }

  abort(): void {
    if (!this.ws || !this.isConnected) return;
    if (!this.currentRunId || !this.currentSessionKey) return;

    const frame: ChatAbortFrame = {
      type: 'req',
      id: this.nextId(),
      method: 'chat.abort',
      params: {
        sessionKey: this.currentSessionKey,
        runId: this.currentRunId,
      },
    };
    this.ws.send(JSON.stringify(frame));
    this.isStreaming = false;
    this.notifyStateChange();
  }

  async testConnection(config: ServerConfig): Promise<boolean> {
    try {
      await this.connect(config);
      this.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  private handleMessage(event: WebSocketMessageEvent): void {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(event.data as string);
    } catch {
      return;
    }

    if (json.type === 'res') {
      if (json.ok === false) {
        // chat.send was rejected (e.g. missing scope)
        const err = json.error as Record<string, unknown> | undefined;
        const errMsg = (err?.message as string) ?? 'Request rejected by server';
        this.isStreaming = false;
        this.currentRunId = null;
        this.notifyStateChange();
        const cb = this.callbacks;
        this.callbacks = null;
        cb?.onError(new Error(errMsg));
        return;
      }
      // Extract runId from the chat.send response
      const payload = json.payload as Record<string, unknown> | undefined;
      if (payload?.runId) {
        this.currentRunId = payload.runId as string;
      }
      return;
    }

    if (json.type === 'event' && json.event === 'chat') {
      const payload = json.payload as {
        state: 'delta' | 'final' | 'error' | 'aborted';
        message?: { role: string; content: Array<{ type: string; text: string }> };
        errorMessage?: string;
      };

      const state = payload.state;

      if (state === 'delta' || state === 'final') {
        const text = this.extractTextFromMessage(payload.message);
        if (text != null) {
          this.accumulatedText = text;
          this.callbacks?.onDelta(this.accumulatedText);
        }
        if (state === 'final') {
          this.isStreaming = false;
          this.currentRunId = null;
          this.notifyStateChange();
          const cb = this.callbacks;
          this.callbacks = null;
          cb?.onComplete();
        }
        return;
      }

      if (state === 'error') {
        const errMsg = payload.errorMessage ?? 'Unknown streaming error';
        this.isStreaming = false;
        this.currentRunId = null;
        this.notifyStateChange();
        const cb = this.callbacks;
        this.callbacks = null;
        cb?.onError(new Error(errMsg));
        return;
      }

      if (state === 'aborted') {
        this.isStreaming = false;
        this.currentRunId = null;
        this.notifyStateChange();
        const cb = this.callbacks;
        this.callbacks = null;
        cb?.onComplete();
        return;
      }
    }
  }

  private extractTextFromMessage(
    message: { role: string; content: Array<{ type: string; text: string }> } | undefined
  ): string | null {
    if (!message) return null;

    const content = message.content;
    if (!Array.isArray(content)) {
      // Fallback: if message itself is a string somehow
      return null;
    }

    const texts = content
      .filter(block => block.type === 'text')
      .map(block => block.text);

    return texts.length === 0 ? null : texts.join('');
  }
}
