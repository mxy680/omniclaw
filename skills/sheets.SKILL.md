---
name: sheets
description: Google Sheets access — create spreadsheets, read and write cell ranges, append rows, and clear data.
metadata: {"openclaw": {"emoji": "📈"}}
---

# Google Sheets

Create, read, write, and manage Google Sheets spreadsheets.

## First-Time Setup

1. Call `sheets_auth_setup` — a browser window opens
2. Sign in and accept the permissions

This is a one-time step. If you've already authenticated via any other `*_auth_setup` tool, re-run it to pick up the Sheets scope.

**Also enable the Google Sheets API** in your GCP project:
- Go to **APIs & Services → Library** → search "Google Sheets API" → Enable it

## Available Tools

- `sheets_auth_setup` — Authenticate with Google Sheets (run once)
- `sheets_create` — Create a new spreadsheet with a title
- `sheets_get` — Read cell values from a range (A1 notation)
- `sheets_update` — Write values to a range (overwrites existing content)
- `sheets_append` — Append rows after the last row with data
- `sheets_clear` — Clear values from a range (preserves formatting)

## Workflow

1. Complete first-time setup above.
2. Use `sheets_create` to create a new spreadsheet.
3. Use `sheets_get` to read data from a range.
4. Use `sheets_update` to write data to specific cells.
5. Use `sheets_append` to add new rows to the end of existing data.
6. Use `sheets_clear` to remove data from a range.

## A1 Notation

| Example | Meaning |
|---------|---------|
| `Sheet1!A1` | Single cell |
| `Sheet1!A1:D10` | Range A1 to D10 |
| `Sheet1!A:A` | Entire column A |
| `Sheet1!1:1` | Entire row 1 |
| `Sheet1` | Entire sheet |

## Finding the Spreadsheet ID

The spreadsheet ID is in the URL:
`https://docs.google.com/spreadsheets/d/**SPREADSHEET_ID**/edit`

Or use `drive_search` with `mimeType = 'application/vnd.google-apps.spreadsheet'`.

## Examples

- "Create a spreadsheet called 'Budget 2026'" → `sheets_create`
- "Read rows 1 through 10 from Sheet1" → `sheets_get` with `range: "Sheet1!A1:Z10"`
- "Write a header row: Name, Email, Date" → `sheets_update` with `values: [["Name","Email","Date"]]`
- "Add a new row with Alice's info" → `sheets_append`
- "Clear the data range" → `sheets_clear`

## Error Handling

If any tool returns `"error": "auth_required"`, call `sheets_auth_setup` first.
