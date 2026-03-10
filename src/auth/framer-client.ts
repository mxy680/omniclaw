import { connect, type Framer } from "framer-api";

export interface FramerCredentials {
  url: string;
  apiKey: string;
}

const IDLE_TIMEOUT_MS = 30_000;

export class FramerClient {
  private credentials: FramerCredentials | null = null;
  private connection: Framer | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(credentialsJson?: string) {
    if (credentialsJson) {
      this.credentials = JSON.parse(credentialsJson) as FramerCredentials;
    }
  }

  isAuthenticated(): boolean {
    return this.credentials !== null;
  }

  getCredentials(): FramerCredentials | null {
    return this.credentials;
  }

  setCredentials(credentialsJson: string): void {
    this.credentials = JSON.parse(credentialsJson) as FramerCredentials;
    // Clear existing connection when credentials change
    void this.disconnect();
  }

  async getConnection(): Promise<Framer> {
    if (!this.credentials) {
      throw new Error("not_authenticated");
    }

    // Reuse cached connection if available
    if (this.connection) {
      this.resetIdleTimer();
      return this.connection;
    }

    // Create new connection
    const conn = await connect(this.credentials.url, this.credentials.apiKey);
    this.connection = conn;
    this.resetIdleTimer();
    return conn;
  }

  async disconnect(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.connection) {
      try {
        await this.connection.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.connection = null;
    }
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      void this.disconnect();
    }, IDLE_TIMEOUT_MS);
  }
}
