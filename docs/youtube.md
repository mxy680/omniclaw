# YouTube Integration

6 tools for searching videos, fetching transcripts, video details, channel info, and comments.

## Setup

YouTube has two modes:

- **Transcripts** — work immediately with no setup. Just ask for any public video's transcript.
- **Search, video details, comments, channel info** — require Google OAuth (same as [Google Workspace setup](google-workspace.md)). If you already set up Google Workspace, YouTube authenticated tools are ready to use.

## Tools

| Tool | Description |
|------|-------------|
| `youtube_auth_setup` | Authenticate with Google for search/details (run once) |
| `youtube_get_transcript` | Get transcript of any public YouTube video (no auth needed) |
| `youtube_search` | Search YouTube videos by query |
| `youtube_video_details` | Get metadata, stats, and description for a video |
| `youtube_channel_info` | Get channel details by handle or ID |
| `youtube_video_comments` | Get top comments on a video |

## Usage Examples

> "Get the transcript of this YouTube video: https://youtube.com/watch?v=..."
> "Search YouTube for TypeScript tutorials"
> "Show me the top comments on that video"
