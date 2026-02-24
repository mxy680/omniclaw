# Gemini AI Integration

5 tools for AI-powered image generation, image editing, video generation, and video analysis.

## Setup

Gemini tools use a Google AI Studio API key for image generation, video generation, and video analysis.

### Step 1: Get an API Key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click **Create API key**
3. Copy the key

### Step 2: Configure

**Option A:** Set via config:
```bash
openclaw config set plugins.entries.omniclaw.config.gemini_api_key "your_api_key_here"
```

**Option B:** Let the agent prompt you. Ask your agent:
> "Set up Gemini"

## Tools

| Tool | Description |
|------|-------------|
| `gemini_auth_setup` | Store your Gemini API key |
| `gemini_generate_image` | Generate an image from a text prompt |
| `gemini_edit_image` | Edit an existing image with a text prompt |
| `gemini_generate_video` | Generate a short video from a text prompt |
| `gemini_analyze_video` | Analyze/describe a video from a URL |

## Configuration

All configuration is set via `openclaw config set plugins.entries.omniclaw.config.<key> <value>`.

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `gemini_api_key` | No | — | Google AI Studio API key. Can also be set interactively via `gemini_auth_setup` |

## Usage Examples

> "Generate an image of a sunset over mountains in watercolor style"
> "Create a 5-second video of ocean waves"
> "Analyze this video and describe what's happening"
