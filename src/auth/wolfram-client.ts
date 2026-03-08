const LLM_API_URL = "https://www.wolframalpha.com/api/v1/llm-api";
const FULL_API_URL = "https://api.wolframalpha.com/v2/query";

export interface WolframLLMOptions {
  maxchars?: number;
  units?: "metric" | "imperial";
  location?: string;
}

export interface WolframFullOptions {
  format?: string;
  includepodid?: string;
  excludepodid?: string;
  podindex?: string;
  units?: "metric" | "imperial";
  location?: string;
}

export class WolframClient {
  private appId: string | null;

  constructor(appId?: string) {
    this.appId = appId ?? null;
  }

  isAuthenticated(): boolean {
    return this.appId !== null;
  }

  /**
   * Query the Wolfram Alpha LLM API. Returns plain text optimized for LLM consumption.
   */
  async queryLLM(input: string, opts?: WolframLLMOptions): Promise<string> {
    const params = new URLSearchParams({
      appid: this.appId!,
      input,
    });
    if (opts?.maxchars != null) params.set("maxchars", String(opts.maxchars));
    if (opts?.units) params.set("units", opts.units);
    if (opts?.location) params.set("location", opts.location);

    const res = await fetch(`${LLM_API_URL}?${params}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Wolfram LLM API ${res.status}: ${body || res.statusText}`);
    }
    return res.text();
  }

  /**
   * Query the Wolfram Alpha Full Results API. Returns structured JSON with pods.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async queryFull(input: string, opts?: WolframFullOptions): Promise<any> {
    const params = new URLSearchParams({
      appid: this.appId!,
      input,
      output: "json",
    });
    if (opts?.format) params.set("format", opts.format);
    if (opts?.includepodid) params.set("includepodid", opts.includepodid);
    if (opts?.excludepodid) params.set("excludepodid", opts.excludepodid);
    if (opts?.podindex) params.set("podindex", opts.podindex);
    if (opts?.units) params.set("units", opts.units);
    if (opts?.location) params.set("location", opts.location);

    const res = await fetch(`${FULL_API_URL}?${params}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Wolfram Full API ${res.status}: ${body || res.statusText}`);
    }
    return res.json();
  }
}
