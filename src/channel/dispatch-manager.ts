import { runWithContext } from "./active-context.js";

export type DispatchPriority = "interactive" | "background";

export type DispatchRequest = {
  conversationId: string;
  connId: string;
  priority: DispatchPriority;
  fn: () => Promise<void>;
};

export type DispatchConfig = {
  maxConcurrency: number;
  dispatchTimeoutMs: number;
};

type QueuedItem = DispatchRequest & {
  resolve: () => void;
  reject: (err: Error) => void;
};

const DEFAULTS: DispatchConfig = {
  maxConcurrency: 3,
  dispatchTimeoutMs: 300_000,
};

export class DispatchManager {
  private config: DispatchConfig;
  private activeCount = 0;
  private activeConversations = new Set<string>();
  private queue: QueuedItem[] = [];

  constructor(config?: Partial<DispatchConfig>) {
    this.config = { ...DEFAULTS, ...config };
  }

  async submit(req: DispatchRequest): Promise<void> {
    if (
      this.activeConversations.has(req.conversationId) ||
      this.queue.some((q) => q.conversationId === req.conversationId)
    ) {
      throw new Error(
        `Conversation ${req.conversationId} is already processing a dispatch`,
      );
    }

    if (this.activeCount < this.config.maxConcurrency) {
      return this.execute(req);
    }

    return new Promise<void>((resolve, reject) => {
      const item: QueuedItem = { ...req, resolve, reject };
      if (req.priority === "interactive") {
        // Insert before the first background item so interactive tasks jump
        // ahead of background ones while preserving FIFO among same-priority.
        const idx = this.queue.findIndex((q) => q.priority === "background");
        if (idx === -1) {
          this.queue.push(item);
        } else {
          this.queue.splice(idx, 0, item);
        }
      } else {
        this.queue.push(item);
      }
    });
  }

  /** Number of dispatches currently executing. */
  get active(): number {
    return this.activeCount;
  }

  /** Number of dispatches waiting in the queue. */
  get queued(): number {
    return this.queue.length;
  }

  private async execute(req: DispatchRequest): Promise<void> {
    this.activeCount++;
    this.activeConversations.add(req.conversationId);

    try {
      await runWithContext(
        req.conversationId,
        req.connId,
        () => this.withTimeout(req.fn(), req.conversationId),
      );
    } finally {
      this.activeCount--;
      this.activeConversations.delete(req.conversationId);
      // Always drain the queue after a slot is freed, even on error or timeout.
      this.drain();
    }
  }

  private withTimeout(
    promise: Promise<void>,
    conversationId: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Dispatch for conversation ${conversationId} timed out after ${this.config.dispatchTimeoutMs}ms`,
          ),
        );
      }, this.config.dispatchTimeoutMs);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  private drain(): void {
    while (
      this.activeCount < this.config.maxConcurrency &&
      this.queue.length > 0
    ) {
      const next = this.queue.shift()!;
      // Kick off execution and wire its outcome back to the waiting promise.
      this.execute(next).then(next.resolve, next.reject);
    }
  }
}
