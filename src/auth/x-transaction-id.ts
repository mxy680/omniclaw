/**
 * Generates x-client-transaction-id headers required for X (Twitter) mutations.
 *
 * X uses this header to detect automated requests. It's derived from:
 * 1. The homepage HTML (SVG animation data + site verification key)
 * 2. An on-demand JS file (key byte indices)
 * 3. The HTTP method and path of the request
 *
 * Uses the xclienttransaction npm package for the core algorithm.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any = null;
async function loadModule() {
  if (!mod) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — no type declarations for xclienttransaction
    mod = await import("xclienttransaction");
  }
  return mod;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedTransaction: any = null;
let cacheExpiry = 0;

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function fetchText(url: string, headers?: Record<string, string>): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`fetch_failed: ${url} ${res.status}`);
  return res.text();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function initTransaction(): Promise<any> {
  if (cachedTransaction && Date.now() < cacheExpiry) {
    return cachedTransaction;
  }

  const { ClientTransaction, getOndemandFileUrl } = await loadModule();

  // 1. Fetch X homepage to get site verification key and animation frames
  const homeHtml = await fetchText("https://x.com");

  // 2. Extract the ondemand JS file URL from the homepage
  const ondemandUrl = getOndemandFileUrl(homeHtml);
  if (!ondemandUrl) {
    throw new Error("Could not find ondemand JS URL in X homepage");
  }

  // 3. Fetch the ondemand JS file to get key byte indices
  const ondemandJs = await fetchText(ondemandUrl, {
    Referer: "https://x.com/",
    Origin: "https://x.com",
  });

  // 4. Create the transaction generator
  cachedTransaction = new ClientTransaction(homeHtml, ondemandJs);
  cacheExpiry = Date.now() + CACHE_TTL_MS;

  return cachedTransaction;
}

/**
 * Generate an x-client-transaction-id for a given method and path.
 * Returns null if generation fails (non-fatal — request can proceed without it).
 */
export async function generateTransactionId(
  method: string,
  path: string,
): Promise<string | null> {
  try {
    const ct = await initTransaction();
    return ct.generateTransactionId(method, path);
  } catch {
    // Non-fatal: mutations may still work without this header on some accounts
    return null;
  }
}
