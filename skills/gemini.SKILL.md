---
name: gemini
description: Generate images and videos using Google's Gemini, Imagen, and Veo models.
metadata: {"openclaw": {"emoji": "🎨"}}
---

# Gemini Media Generation

Generate images with Imagen and videos with Veo.

## First-Time Setup

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Call `gemini_auth_setup` with your API key
3. Alternatively, set `gemini_api_key` in your plugin config

## Available Tools

### Auth
- `gemini_auth_setup` — Validate a Gemini API key (run once)

### Image Generation
- `gemini_imagen` — Generate images using Imagen models (supports multiple images, aspect ratio, person generation)

### Video Generation
- `gemini_generate_video` — Generate a video using Veo models (polls automatically, supports aspect ratio, duration)

## Workflow

1. Use `gemini_imagen` for image generation (supports multiple images, aspect ratio, person generation).
2. Use `gemini_generate_video` for video generation (takes 1-5 minutes, polls automatically).

## Models

### Image Models
| Model | Notes |
|---|---|
| `imagen-4.0-generate-001` | Default. Standard quality. |
| `imagen-4.0-ultra-generate-001` | Ultra quality. |
| `imagen-4.0-fast-generate-001` | Fast generation. |

### Video Models
| Model | Notes |
|---|---|
| `veo-3.1-generate-preview` | Default. Latest Veo model. |

## Examples

- "Generate an image of a sunset over mountains" → `gemini_imagen`
- "Create 4 logo variations for a coffee shop" → `gemini_imagen` with `number_of_images=4`
- "Generate a cinematic video of ocean waves" → `gemini_generate_video`

## Error Handling

- If any tool returns `"error": "auth_required"`, call `gemini_auth_setup` first.
- Video generation may time out after 5 minutes for complex prompts — increase `timeout_seconds` if needed.
- If images are filtered by safety policies, try rephrasing the prompt.
