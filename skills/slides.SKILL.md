---
name: slides
description: Google Slides access — create presentations, read slide content (text, tables, images), append/delete/duplicate slides, speaker notes, and find-and-replace text.
metadata: {"openclaw": {"emoji": "📊"}}
---

# Google Slides

Create, read, and edit Google Slides presentations with full slide management.

## First-Time Setup

1. Call `slides_auth_setup` — a browser window opens
2. Sign in and accept the permissions

This is a one-time step. If you've already authenticated via any other `*_auth_setup` tool, re-run it to pick up the Slides scope.

**Also enable the Google Slides API** in your GCP project:
- Go to **APIs & Services → Library** → search "Google Slides API" → Enable it

## Available Tools

- `slides_auth_setup` — Authenticate with Google Slides (run once)
- `slides_create` — Create a new presentation with a title
- `slides_get` — Fetch all slide text content, speaker notes, table text, and image URLs
- `slides_append_slide` — Append a new slide with a title and body text (supports layout selection)
- `slides_replace_text` — Find and replace text across all slides
- `slides_delete_slide` — Delete a slide by its object ID
- `slides_duplicate_slide` — Duplicate a slide (optionally insert at a specific position)
- `slides_write_notes` — Write or replace speaker notes on a slide
- `slides_export` — Download/export a presentation to local disk (PDF, PPTX, etc.)

## Workflow

1. Complete first-time setup above.
2. Use `slides_create` to start a new presentation.
3. Use `slides_get` to read slide content (text, tables, images, speaker notes).
4. Use `slides_append_slide` to add new slides (choose layout: BLANK, TITLE_ONLY, SECTION_HEADER, etc.).
5. Use `slides_duplicate_slide` to clone an existing slide.
6. Use `slides_write_notes` to add or update speaker notes.
7. Use `slides_replace_text` to fill in templates or make bulk edits.
8. Use `slides_delete_slide` to remove unwanted slides.
9. Use `slides_export` to download the presentation as PDF or PPTX.

## Finding the Presentation ID

The presentation ID is in the URL:
`https://docs.google.com/presentation/d/**PRESENTATION_ID**/edit`

Or use `drive_search` with `mimeType = 'application/vnd.google-apps.presentation'`.

## Examples

- "Create a presentation called 'Q4 Review'" → `slides_create`
- "Read the content of my pitch deck" → `slides_get`
- "Add a slide titled 'Next Steps' with action items" → `slides_append_slide`
- "Add a blank slide" → `slides_append_slide` with `layout: "BLANK"`
- "Duplicate the first slide" → `slides_duplicate_slide`
- "Add speaker notes to slide 3" → `slides_write_notes`
- "Replace all '{{company}}' placeholders with 'Acme Corp'" → `slides_replace_text`
- "Delete the last slide" → `slides_delete_slide`
- "Export the presentation as PDF" → `slides_export`

## Error Handling

If any tool returns `"error": "auth_required"`, call `slides_auth_setup` first.
