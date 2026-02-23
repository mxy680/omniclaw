---
name: youtube
description: Search YouTube videos, read transcripts, get video/channel metadata, and browse comments.
metadata: {"openclaw": {"emoji": "🎬"}}
---

# YouTube

Search for videos, read transcripts, get video and channel metadata, and browse comments.

## First-Time Setup

**Transcript tool** (`youtube_get_transcript`) works immediately with no setup — it can read captions from any public video.

**All other tools** require Google OAuth:
1. Call `youtube_auth_setup` — a browser window opens
2. Sign in and accept the permissions

This is a one-time step. If you've already authenticated via `gmail_auth_setup` or another Google auth tool, re-run any auth tool to grant any missing scopes.

**Also enable the YouTube Data API v3** in your GCP project:
- Go to **APIs & Services -> Library** -> search "YouTube Data API v3" -> Enable it

## Available Tools

- `youtube_auth_setup` — Authenticate with YouTube via Google OAuth (run once)
- `youtube_search` — Search for videos by keyword or phrase
- `youtube_video_details` — Get full metadata for a video (duration, views, likes, tags, etc.)
- `youtube_get_transcript` — Get captions/transcript text (no auth needed)
- `youtube_channel_info` — Get channel details (subscribers, video count, description)
- `youtube_video_comments` — Read top-level comments on a video

## Workflow

1. Use `youtube_search` to find videos on a topic.
2. Use `youtube_video_details` to get metadata (duration, view count, tags, etc.) for a specific video.
3. Use `youtube_get_transcript` to read the full transcript/captions of a video.
4. Use `youtube_channel_info` to learn about a channel (subscribers, video count, etc.).
5. Use `youtube_video_comments` to read what viewers are saying about a video.

## Examples

- "Find videos about TypeScript generics" -> `youtube_search` with query "TypeScript generics"
- "How long is this video?" -> `youtube_video_details` with the video URL/ID
- "Summarize this YouTube video" -> `youtube_get_transcript` then summarize the text
- "How many subscribers does @mkbhd have?" -> `youtube_channel_info` with channel "@mkbhd"
- "What are people saying about this video?" -> `youtube_video_comments` with the video URL/ID
- "Get the transcript of https://youtu.be/dQw4w9WgXcQ" -> `youtube_get_transcript` with the URL

## Error Handling

If any OAuth tool returns `"error": "auth_required"`, call `youtube_auth_setup` first.
If `youtube_get_transcript` fails, the video may not have captions enabled.
If `youtube_video_comments` returns `"error": "comments_disabled"`, comments are turned off on that video.
