/**
 * Shared helpers for parsing Instagram API responses.
 */

const SHORTCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function bestImageUrl(
  imageVersions2: Record<string, unknown> | undefined | null,
): string | null {
  if (!imageVersions2) return null;
  const candidates = imageVersions2.candidates as Array<Record<string, unknown>> | undefined;
  if (!candidates || candidates.length === 0) return null;

  let best = candidates[0];
  let bestWidth = 0;
  for (const c of candidates) {
    const w = (c.width as number) ?? 0;
    if (w > bestWidth) {
      bestWidth = w;
      best = c;
    }
  }
  return (best.url as string) ?? null;
}

export function formatTimestamp(ts: number | undefined | null): string | null {
  if (ts == null) return null;
  // DM timestamps are in microseconds (> 1e15)
  const seconds = ts > 1e15 ? ts / 1_000_000 : ts;
  return new Date(seconds * 1000).toISOString();
}

export function mediaTypeLabel(n: number | undefined | null): string {
  if (n === 1) return "Photo";
  if (n === 2) return "Video";
  if (n === 8) return "Carousel";
  return "Unknown";
}

export function parseShortcode(input: string): string {
  // Extract shortcode from URL like https://www.instagram.com/p/ABC123/ or https://www.instagram.com/reel/ABC123/
  const match = input.match(/(?:\/p\/|\/reel\/|\/tv\/)([A-Za-z0-9_-]+)/);
  return match ? match[1] : input;
}

export function shortcodeToMediaId(shortcode: string): string {
  let id = BigInt(0);
  for (const char of shortcode) {
    const idx = SHORTCODE_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    id = id * BigInt(64) + BigInt(idx);
  }
  return id.toString();
}

export function truncateText(text: string | undefined | null, max = 500): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

export function formatUser(
  user: Record<string, unknown> | undefined | null,
): Record<string, unknown> | null {
  if (!user) return null;
  return {
    username: user.username,
    full_name: user.full_name,
    profile_pic_url: user.profile_pic_url,
    is_verified: user.is_verified,
    pk: user.pk,
  };
}
