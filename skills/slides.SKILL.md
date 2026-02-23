---
name: slides
description: Google Slides access — create presentations, read slide content, append slides, and find-and-replace text.
metadata: {"openclaw": {"emoji": "📊"}}
---

# Google Slides

Create, read, and edit Google Slides presentations.

## First-Time Setup

1. Call `slides_auth_setup` — a browser window opens
2. Sign in and accept the permissions

This is a one-time step. If you've already authenticated via any other `*_auth_setup` tool, re-run it to pick up the Slides scope.

**Also enable the Google Slides API** in your GCP project:
- Go to **APIs & Services → Library** → search "Google Slides API" → Enable it

## Available Tools

- `slides_auth_setup` — Authenticate with Google Slides (run once)
- `slides_create` — Create a new presentation with a title
- `slides_get` — Fetch all slide text content and speaker notes
- `slides_append_slide` — Append a new slide with a title and body text
- `slides_replace_text` — Find and replace text across all slides

## Workflow

1. Complete first-time setup above.
2. Use `slides_create` to start a new presentation.
3. Use `slides_get` to read the text content and speaker notes of each slide.
4. Use `slides_append_slide` to add new slides with content.
5. Use `slides_replace_text` to fill in templates or make bulk edits.

## Finding the Presentation ID

The presentation ID is in the URL:
`https://docs.google.com/presentation/d/**PRESENTATION_ID**/edit`

Or use `drive_search` with `mimeType = 'application/vnd.google-apps.presentation'`.

## Examples

- "Create a presentation called 'Q4 Review'" → `slides_create`
- "Read the content of my pitch deck" → `slides_get`
- "Add a slide titled 'Next Steps' with action items" → `slides_append_slide`
- "Replace all '{{company}}' placeholders with 'Acme Corp'" → `slides_replace_text`

## Error Handling

If any tool returns `"error": "auth_required"`, call `slides_auth_setup` first.
