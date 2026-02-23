---
name: calendar
description: Full Google Calendar access — list, create, update, delete, and RSVP to events.
metadata: {"openclaw": {"emoji": "📅"}}
---

# Google Calendar

List, create, update, delete, and respond to Google Calendar events.

## First-Time Setup

1. Call `calendar_auth_setup` — a browser window opens
2. Sign in and accept the permissions (covers both Calendar and Gmail)

This is a one-time step. If you've already authenticated via `gmail_auth_setup`, you can re-run either tool to grant any missing scopes.

**Also enable the Google Calendar API** in your GCP project:
- Go to **APIs & Services → Library** → search "Google Calendar API" → Enable it

## Available Tools

- `calendar_auth_setup` — Authenticate with Google Calendar (run once)
- `calendar_list_calendars` — List all calendars (primary, shared, subscribed)
- `calendar_events` — List upcoming events from a calendar
- `calendar_get` — Fetch full details of a single event by ID
- `calendar_create` — Create a new calendar event
- `calendar_update` — Update an existing event (title, time, location, etc.)
- `calendar_delete` — Delete/cancel an event and notify attendees
- `calendar_respond` — RSVP to an event invite (accept/decline/tentative)

## Workflow

1. Complete first-time setup above.
2. Use `calendar_list_calendars` to see available calendars and their IDs.
3. Use `calendar_events` to list upcoming events. Filter by `time_min`/`time_max` or `calendar_id`.
4. Use `calendar_get <event_id>` to read full event details including attendees and meeting link.
5. Use `calendar_create` to schedule a new meeting with attendees.
6. Use `calendar_update` to reschedule or edit event details.
7. Use `calendar_respond` to accept, decline, or tentatively accept an invite.
8. Use `calendar_delete` to cancel an event.

## Examples

- "What's on my calendar this week?" → `calendar_events` with `time_min` today, `time_max` end of week
- "Create a meeting with alice@example.com tomorrow at 2pm for 1 hour" → `calendar_create`
- "Move the 3pm meeting to 4pm" → `calendar_update` with new `start`/`end`
- "Accept the invite to the product review" → `calendar_respond` with `response: "accepted"`
- "Cancel tomorrow's standup" → `calendar_delete`

## Error Handling

If any tool returns `"error": "auth_required"`, call `gmail_auth_setup` first.
If `calendar_respond` returns `"error": "not_an_attendee"`, you are not listed as an attendee on that event.
