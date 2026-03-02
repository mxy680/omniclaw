---
name: youtube
description: Search YouTube videos, read transcripts, get video/channel metadata, browse comments, and manage playlists.
metadata: {"openclaw": {"emoji": "🎬"}}
---

# YouTube

Search for videos, read transcripts, get video and channel metadata, browse comments, download thumbnails, and manage playlists.

## First-Time Setup

**Transcript tool** (`youtube_get_transcript`) works immediately with no setup — it can read captions from any public video.

**All other tools** require Google OAuth:
1. Call `youtube_auth_setup` — a browser window opens
2. Sign in and accept the permissions

This is a one-time step. If you've already authenticated via `gmail_auth_setup` or another Google auth tool, re-run any auth tool to grant any missing scopes.

**Also enable the YouTube Data API v3** in your GCP project:
- Go to **APIs & Services -> Library** -> search "YouTube Data API v3" -> Enable it

## Available Tools

### Search & Metadata
- `youtube_auth_setup` — Authenticate with YouTube via Google OAuth (run once)
- `youtube_search` — Search for videos by keyword or phrase (supports pagination)
- `youtube_video_details` — Get full metadata for a video (duration, views, likes, tags, etc.)
- `youtube_get_transcript` — Get captions/transcript text (no auth needed)
- `youtube_channel_info` — Get channel details (subscribers, video count, description)
- `youtube_video_comments` — Read top-level comments on a video (supports pagination)
- `youtube_download_thumbnail` — Download a video thumbnail (accepts URLs or IDs, multiple quality levels)

### Playlists
- `youtube_playlists_list` — List playlists for the authenticated user or a specific channel
- `youtube_playlist_items` — List videos in a playlist (supports pagination)
- `youtube_playlist_create` — Create a new playlist (public, unlisted, or private)

## Workflow

1. Use `youtube_search` to find videos on a topic (use `page_token` to paginate).
2. Use `youtube_video_details` to get metadata (duration, view count, tags, etc.) for a specific video.
3. Use `youtube_get_transcript` to read the full transcript/captions of a video.
4. Use `youtube_channel_info` to learn about a channel (subscribers, video count, etc.).
5. Use `youtube_video_comments` to read what viewers are saying (use `page_token` to load more).
6. Use `youtube_download_thumbnail` to save a video thumbnail locally.
7. Use `youtube_playlists_list` to browse playlists for a user or channel.
8. Use `youtube_playlist_items` to see videos in a specific playlist.
9. Use `youtube_playlist_create` to create a new playlist.

## Examples

- "Find videos about TypeScript generics" → `youtube_search` with query "TypeScript generics"
- "Show me more results" → `youtube_search` with `page_token` from previous response
- "How long is this video?" → `youtube_video_details` with the video URL/ID
- "Summarize this YouTube video" → `youtube_get_transcript` then summarize the text
- "How many subscribers does @mkbhd have?" → `youtube_channel_info` with channel "@mkbhd"
- "What are people saying about this video?" → `youtube_video_comments` with the video URL/ID
- "Download the thumbnail" → `youtube_download_thumbnail` with video URL and save directory
- "List my playlists" → `youtube_playlists_list`
- "What videos are in this playlist?" → `youtube_playlist_items`
- "Create a playlist called 'Watch Later Tech'" → `youtube_playlist_create`
- "Get the transcript of https://youtu.be/dQw4w9WgXcQ" → `youtube_get_transcript` with the URL

## Error Handling

If any OAuth tool returns `"error": "auth_required"`, call `youtube_auth_setup` first.
If `youtube_get_transcript` fails, the video may not have captions enabled.
If `youtube_video_comments` returns `"error": "comments_disabled"`, comments are turned off on that video.
