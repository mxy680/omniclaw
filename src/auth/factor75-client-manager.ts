import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface Factor75Session {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: number; // Unix timestamp (seconds)
  user_id: string;
  // ISO country code returned by the login response (e.g. "FJ").
  // Required on every API call via the `country` query parameter.
  country: string;
  all_cookies: Record<string, string>;
  cookie_details: Array<{ name: string; value: string; domain: string; path: string }>;
}

interface Factor75SessionFile {
  [account: string]: Factor75Session;
}

export interface Factor75SubscriptionParams {
  subscriptionId: number;
  customerPlanId: string;
  productSku: string;
  deliveryOption: string;
  postcode: string;
  preference: string;
}

const API_BASE = "https://www.factor75.com/gw";

export class Factor75ClientManager {
  // In-memory cache for subscription params, keyed by account name.
  private subscriptionCache = new Map<string, Factor75SubscriptionParams>();

  constructor(private tokensPath: string) {}

  private load(): Factor75SessionFile {
    if (!existsSync(this.tokensPath)) {
      return {};
    }
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as Factor75SessionFile;
    } catch {
      return {};
    }
  }

  private save(data: Factor75SessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: Factor75Session): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  getCredentials(account: string): Factor75Session | null {
    const data = this.load();
    return data[account] ?? null;
  }

  hasCredentials(account: string): boolean {
    const session = this.getCredentials(account);
    return session !== null && session.access_token !== "";
  }

  isTokenExpired(account: string): boolean {
    const session = this.getCredentials(account);
    if (!session) return true;
    // Consider expired if within 5 minutes of expiry
    return Date.now() / 1000 >= session.expires_at - 300;
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  private getHeaders(session: Factor75Session): Record<string, string> {
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Origin: "https://www.factor75.com",
      Referer: "https://www.factor75.com/",
    };
  }

  /**
   * Makes a GET request to `https://www.factor75.com/gw/{path}`.
   *
   * `country={session.country}&locale=en-US` are automatically appended to the
   * query string unless the caller has already included a `country` key in
   * `params`.
   */
  async get(
    account: string,
    path: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    if (this.isTokenExpired(account)) {
      throw new Error("Factor75 session expired. Call factor75_auth_setup to re-authenticate.");
    }

    const merged: Record<string, string> = { ...params };
    // Inject country + locale unless the caller already supplied them.
    if (!("country" in merged)) {
      merged.country = session.country;
    }
    if (!("locale" in merged)) {
      merged.locale = "en-US";
    }

    const url = `${API_BASE}/${path}?${new URLSearchParams(merged).toString()}`;
    const headers = this.getHeaders(session);

    const resp = await fetch(url, { method: "GET", headers });

    if (resp.status === 401 || resp.status === 403) {
      throw new Error("Factor75 session expired. Call factor75_auth_setup to re-authenticate.");
    }
    if (resp.status === 429) {
      throw new Error("Factor75 API rate limit exceeded. Please wait before retrying.");
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Factor75 API error: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`);
    }

    return resp.json();
  }

  /**
   * Makes a POST request to `https://www.factor75.com/gw/{path}`.
   */
  async post(
    account: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    if (this.isTokenExpired(account)) {
      throw new Error("Factor75 session expired. Call factor75_auth_setup to re-authenticate.");
    }

    const url = `${API_BASE}/${path}`;
    const headers = this.getHeaders(session);

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new Error("Factor75 session expired. Call factor75_auth_setup to re-authenticate.");
    }
    if (resp.status === 429) {
      throw new Error("Factor75 API rate limit exceeded. Please wait before retrying.");
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Factor75 API error: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`);
    }

    return resp.json();
  }

  /**
   * Fetches and caches subscription-derived parameters required by endpoints
   * such as the menu browser.
   *
   * Sources:
   *   - Subscription list: GET /gw/api/customers/me/subscriptions
   *   - Plan preference:   GET /gw/v1/profile/me
   *
   * The result is memoised in-memory for the lifetime of this manager instance
   * to avoid repeated network calls within a single agent session.
   */
  async getSubscriptionParams(account: string): Promise<Factor75SubscriptionParams> {
    const cached = this.subscriptionCache.get(account);
    if (cached) return cached;

    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    // --- Subscription list ---
    const subData = (await this.get(
      account,
      "api/customers/me/subscriptions",
    )) as {
      count: number;
      items: Array<{
        id: number;
        customerPlanId: string;
        product: { sku: string; handle?: string };
        deliveryOption: { handle: string };
        shippingAddress: { postcode: string };
        isActive?: boolean;
        status?: string;
      }>;
    };

    if (!subData.items || subData.items.length === 0) {
      throw new Error("Factor75: no subscriptions found for account: " + account);
    }

    const sub = subData.items[0];

    // --- Plan preference from profile ---
    let preference = "";
    try {
      const profile = (await this.get(account, "v1/profile/me")) as {
        unifiedPreferences?: {
          plans?: Record<string, { planPreference: string }>;
        };
      };
      const planPreferenceMap = profile.unifiedPreferences?.plans ?? {};
      preference = planPreferenceMap[sub.customerPlanId]?.planPreference ?? "";
    } catch {
      // Profile endpoint may not be available; preference is optional
    }

    const params: Factor75SubscriptionParams = {
      subscriptionId: sub.id,
      customerPlanId: sub.customerPlanId,
      productSku: sub.product.sku ?? sub.product.handle ?? "",
      deliveryOption: sub.deliveryOption.handle,
      postcode: sub.shippingAddress.postcode,
      preference,
    };

    this.subscriptionCache.set(account, params);
    return params;
  }
}
