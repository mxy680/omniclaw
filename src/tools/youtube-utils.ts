/**
 * Extract a YouTube video ID from various URL formats or a plain ID string.
 *
 * Supported formats:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://www.youtube.com/shorts/VIDEO_ID
 *   - Plain 11-character video ID
 *
 * Returns `null` when the input cannot be resolved to a video ID.
 */
export function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Plain video ID (typically 11 chars, alphanumeric + dash + underscore)
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    // youtube.com/watch?v=ID
    if ((host === "youtube.com" || host === "m.youtube.com") && url.pathname === "/watch") {
      return url.searchParams.get("v") ?? null;
    }

    // youtube.com/embed/ID or youtube.com/shorts/ID or youtube.com/v/ID
    const pathMatch = url.pathname.match(/^\/(embed|shorts|v)\/([A-Za-z0-9_-]+)/);
    if (pathMatch && (host === "youtube.com" || host === "m.youtube.com")) {
      return pathMatch[2];
    }

    // youtu.be/ID
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return id || null;
    }
  } catch {
    // Not a valid URL — fall through
  }

  return null;
}
