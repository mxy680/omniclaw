---
name: gemini
description: Google Gemini AI — generate images, generate videos, edit images, and analyze video content.
metadata: {"openclaw": {"emoji": "✨"}}
---

# Gemini

Generate images, edit images, generate videos, and analyze video content using Google Gemini AI models.

## First-Time Setup

Gemini uses an API key — no OAuth flow needed.

1. Get an API key at https://aistudio.google.com/apikey
2. Save your key in the plugin config:

```bash
openclaw config set plugins.entries.omniclaw.config.gemini_api_key "your_api_key_here"
```

3. Call `gemini_auth_setup` with no arguments to validate:

```
gemini_auth_setup
```

The tool reads the key from config, verifies it against the Gemini API, and stores it for subsequent tool calls.

## Available Tools

### Auth
- `gemini_auth_setup` — Validate and store a Gemini API key (run once)

### Image Generation
- `gemini_generate_image` — Generate images from a text prompt
- `gemini_edit_image` — Edit an existing image with a text instruction

### Video Generation
- `gemini_generate_video` — Generate videos from text or images (Veo models)

### Video Understanding
- `gemini_analyze_video` — Upload and analyze video content with a prompt

## Models

| Model | Type | Best For |
|-------|------|----------|
| `gemini-2.5-flash-preview-image-generation` | Image gen/edit | Creative images, mixed text+image output (default) |
| `imagen-4` | Image gen | High-quality photorealistic images |
| `imagen-4-ultra` | Image gen | Highest quality images |
| `imagen-4-fast` | Image gen | Fast image generation |
| `veo-3.1-generate-preview` | Video gen | High-quality video generation (default) |
| `veo-3.1-fast-generate-preview` | Video gen | Faster video generation |
| `gemini-2.5-flash` | Video analysis | Fast video understanding (default) |
| `gemini-2.5-pro` | Video analysis | Most capable video understanding |

## Workflow

### Image Generation
1. Call `gemini_auth_setup` with no arguments.
2. Use `gemini_generate_image` with a prompt and `save_directory`.
3. Use `gemini_edit_image` to modify an existing image with instructions.

### Video Generation
1. Call `gemini_auth_setup` with no arguments.
2. Use `gemini_generate_video` with a prompt and `save_directory`.
3. Optionally provide `input_image_path` for image-to-video generation.

### Video Analysis
1. Call `gemini_auth_setup` with no arguments.
2. Use `gemini_analyze_video` with a video path and a question/prompt.

## Error Handling

If any tool returns `"error": "auth_required"`, call `gemini_auth_setup` first.

If the API key is invalid, generate a new one at https://aistudio.google.com/apikey and call `gemini_auth_setup` again.

Video generation may time out for long videos — increase `timeout_seconds` or check the operation status.
