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
- `calendar_create` — Create a new event (supports all-day, recurrence, Google Meet conference link)
- `calendar_update` — Update an existing event (supports attendees, add_attendees merge, recurrence)
- `calendar_delete` — Delete/cancel an event and notify attendees
- `calendar_respond` — RSVP to an event invite (accept/decline/tentative)
- `calendar_search` — Search events by text query across titles and descriptions
- `calendar_freebusy` — Check free/busy availability across one or more calendars
- `calendar_quick_add` — Create an event from natural language (e.g. "Lunch with Alice Friday at noon")

## Workflow

1. Complete first-time setup above.
2. Use `calendar_list_calendars` to see available calendars and their IDs.
3. Use `calendar_events` to list upcoming events. Filter by `time_min`/`time_max` or `calendar_id`.
4. Use `calendar_search` to find events by keyword.
5. Use `calendar_get <event_id>` to read full event details including attendees and meeting link.
6. Use `calendar_create` to schedule a new meeting with attendees (with optional Google Meet link and recurrence).
7. Use `calendar_quick_add` to create events from natural language descriptions.
8. Use `calendar_update` to reschedule or edit event details, add attendees, or change recurrence.
9. Use `calendar_respond` to accept, decline, or tentatively accept an invite.
10. Use `calendar_freebusy` to check availability before scheduling.
11. Use `calendar_delete` to cancel an event.

## Examples

- "What's on my calendar this week?" → `calendar_events` with `time_min` today, `time_max` end of week
- "Create a meeting with alice@example.com tomorrow at 2pm for 1 hour" → `calendar_create`
- "Create an all-day event on 2026-03-15" → `calendar_create` with `start: "2026-03-15"`, `end: "2026-03-16"`
- "Schedule a weekly standup with a Google Meet link" → `calendar_create` with `recurrence` and `conference: true`
- "Meeting with Bob tomorrow at 3pm" → `calendar_quick_add`
- "Search for events about 'budget'" → `calendar_search`
- "Am I free on Friday afternoon?" → `calendar_freebusy`
- "Move the 3pm meeting to 4pm" → `calendar_update` with new `start`/`end`
- "Add charlie@example.com to the meeting" → `calendar_update` with `add_attendees`
- "Accept the invite to the product review" → `calendar_respond` with `response: "accepted"`
- "Cancel tomorrow's standup" → `calendar_delete`

## Error Handling

If any tool returns `"error": "auth_required"`, call `gmail_auth_setup` first.
If `calendar_respond` returns `"error": "not_an_attendee"`, you are not listed as an attendee on that event.
