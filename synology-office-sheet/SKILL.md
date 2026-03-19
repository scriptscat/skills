---
name: synology-office-sheet
description: Read and write Synology Office spreadsheet cells. Use when the user wants to interact with a Synology Office (DSM) spreadsheet — read cell data, write/update cell values, or automate spreadsheet operations. Requires the spreadsheet page to be open in a browser tab.
---

# Synology Office Sheet

Read and write cells in Synology Office spreadsheets via internal APIs.

## Prerequisites

- The target spreadsheet must be **open in a browser tab**
- Use the built-in `list_tabs` tool to find the tab, then pass `tabId` to this skill's tools

## Tools

### `read_sheet`

Read all cell data from the spreadsheet (via Snapshot HTTP API).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tabId` | number | yes | Tab ID of the open Synology Office spreadsheet page |
| `sheetId` | string | no | Specific sheet ID to read (e.g. `"sh_1"`). Omit to read all sheets |

### `write_cells`

Write values to one or more cells (via socket.io in page context).

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tabId` | number | yes | Tab ID of the open Synology Office spreadsheet page |
| `changes` | string | yes | JSON array of `[row, col, value]` triples (0-based). E.g. `[[0,0,"Hello"],[1,2,42]]` |
| `sheetId` | string | no | Target sheet ID (default: `"sh_1"`) |

## Workflow

1. `list_tabs` → find the Synology Office tab (`/oo/r/` in the URL)
2. `read_sheet(tabId)` → get all sheets and cell data
3. Process/analyze the data
4. `write_cells(tabId, changes)` → write back modified values

## Data Format

### read_sheet response

```json
{
  "sheets": [
    {
      "id": "sh_1",
      "title": "Sheet1",
      "rowCount": 101,
      "colCount": 30,
      "cells": { "0": { "0": { "v": "Name" }, "1": { "v": "Age" } } }
    }
  ]
}
```

- `cells[row][col].v` — cell value (string or number)
- Row and column indices are **0-based**

### write_cells changes format

JSON array of `[row, col, value]` triples (0-based):

```
[[0, 0, "Hello"], [1, 2, 42]]
```

## Tips

- For large sheets, `read_sheet` returns all cells — the agent can process/filter the data as needed
- `write_cells` sends changes through socket.io; the page must remain open during writes
- Multiple cells can be written in a single `write_cells` call
