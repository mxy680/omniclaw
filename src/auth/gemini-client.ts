import { GoogleGenAI } from "@google/genai";

export class GeminiClient {
  private ai: GoogleGenAI | null = null;
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  isAuthenticated(): boolean {
    return this.ai !== null;
  }

  getClient(): GoogleGenAI {
    return this.ai!;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.ai = new GoogleGenAI({ apiKey });
  }
}
