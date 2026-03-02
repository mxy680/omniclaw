---
name: sheets
description: Google Sheets access — create spreadsheets, read/write cell ranges, manage sheets/tabs, append rows, clear data, and export.
metadata: {"openclaw": {"emoji": "📈"}}
---

# Google Sheets

Create, read, write, and manage Google Sheets spreadsheets and their individual sheets/tabs.

## First-Time Setup

1. Call `sheets_auth_setup` — a browser window opens
2. Sign in and accept the permissions

This is a one-time step. If you've already authenticated via any other `*_auth_setup` tool, re-run it to pick up the Sheets scope.

**Also enable the Google Sheets API** in your GCP project:
- Go to **APIs & Services → Library** → search "Google Sheets API" → Enable it

## Available Tools

- `sheets_auth_setup` — Authenticate with Google Sheets (run once)
- `sheets_create` — Create a new spreadsheet with a title
- `sheets_get` — Read cell values from a range (supports `value_render`: FORMATTED_VALUE, FORMULA, UNFORMATTED_VALUE)
- `sheets_update` — Write values to a range (overwrites existing content)
- `sheets_append` — Append rows after the last row with data
- `sheets_clear` — Clear values from a range (preserves formatting)
- `sheets_info` — Get spreadsheet metadata including list of all sheets/tabs
- `sheets_add_sheet` — Add a new sheet/tab to a spreadsheet
- `sheets_delete_sheet` — Delete a sheet/tab by ID
- `sheets_rename_sheet` — Rename a sheet/tab
- `sheets_export` — Download/export a spreadsheet to local disk (CSV, XLSX, PDF, etc.)

## Workflow

1. Complete first-time setup above.
2. Use `sheets_create` to create a new spreadsheet.
3. Use `sheets_info` to see all sheets/tabs in a spreadsheet.
4. Use `sheets_get` to read data from a range (use `value_render: "FORMULA"` to see formulas).
5. Use `sheets_update` to write data to specific cells.
6. Use `sheets_append` to add new rows to the end of existing data.
7. Use `sheets_clear` to remove data from a range.
8. Use `sheets_add_sheet` / `sheets_delete_sheet` / `sheets_rename_sheet` to manage tabs.
9. Use `sheets_export` to download as CSV, XLSX, or PDF.

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
- "What sheets are in this spreadsheet?" → `sheets_info`
- "Read rows 1 through 10 from Sheet1" → `sheets_get` with `range: "Sheet1!A1:Z10"`
- "Show me the formulas" → `sheets_get` with `value_render: "FORMULA"`
- "Write a header row: Name, Email, Date" → `sheets_update` with `values: [["Name","Email","Date"]]`
- "Add a new row with Alice's info" → `sheets_append`
- "Clear the data range" → `sheets_clear`
- "Add a new tab called 'Summary'" → `sheets_add_sheet`
- "Rename 'Sheet1' to 'Raw Data'" → `sheets_rename_sheet`
- "Export as CSV" → `sheets_export`

## Error Handling

If any tool returns `"error": "auth_required"`, call `sheets_auth_setup` first.
