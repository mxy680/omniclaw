export function formatTimestamp(ts: number | undefined): string | null {
  if (ts == null) return null;
  // TikTok uses seconds
  return new Date(ts * 1000).toISOString();
}

export function truncateText(text: string | undefined | null, max = 500): string | null {
  if (!text) return null;
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export function formatUser(
  user: Record<string, unknown> | undefined | null,
): Record<string, unknown> | null {
  if (!user) return null;
  return {
    uniqueId: user.uniqueId,
    nickname: user.nickname,
    avatarThumb: user.avatarThumb,
    verified: user.verified ?? false,
    id: user.id,
  };
}

export function formatVideo(item: Record<string, unknown>): Record<string, unknown> {
  const author = item.author as Record<string, unknown> | undefined;
  const stats = item.stats as Record<string, unknown> | undefined;
  const video = item.video as Record<string, unknown> | undefined;
  const music = item.music as Record<string, unknown> | undefined;

  return {
    id: item.id,
    desc: truncateText(item.desc as string | undefined),
    createTime: formatTimestamp(item.createTime as number | undefined),
    duration: video?.duration,
    cover: video?.cover ?? video?.originCover,
    playAddr: video?.playAddr,
    diggCount: stats?.diggCount,
    shareCount: stats?.shareCount,
    commentCount: stats?.commentCount,
    playCount: stats?.playCount,
    collectCount: stats?.collectCount,
    author: formatUser(author),
    music: music
      ? { id: music.id, title: music.title, authorName: music.authorName }
      : null,
  };
}

export function parseTikTokVideoId(input: string): string {
  // Accept full URL or just video ID
  // URLs: https://www.tiktok.com/@user/video/1234567890
  // or: https://vm.tiktok.com/ZMxxxxxx/
  const match = input.match(/\/video\/(\d+)/);
  if (match) return match[1];
  // If it's already a numeric ID
  if (/^\d+$/.test(input)) return input;
  return input;
}
