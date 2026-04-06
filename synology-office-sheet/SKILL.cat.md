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

| Tool | Input → Output |
|------|----------------|
| `read_sheet` | tabId, sheetId? → sheets[] with cell data (`cells[row][col].v`, 0-based) |
| `write_cells` | tabId, changes (`[[row,col,value],...]` JSON, 0-based), sheetId? → write confirmation |

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

## Examples

**Read → analyze → write back**:
```
→ list_tabs()
← tabId=42 | Synology Office | https://nas.local/oo/r/...

→ read_sheet(tabId=42)
← { sheets: [{ id: "sh_1", title: "Sheet1", cells: { "0": { "0": { "v": "Name" }, "1": { "v": "Score" } }, "1": { "0": { "v": "Alice" }, "1": { "v": 85 } } } }] }

→ write_cells(tabId=42, changes='[[1,2,"Pass"],[2,0,"Bob"],[2,1,92],[2,2,"Pass"]]')
← { success: true }
```

**Read specific sheet**:
```
→ read_sheet(tabId=42, sheetId="sh_2")
← { sheets: [{ id: "sh_2", title: "Summary", cells: { ... } }] }
```

## Tips

- For large sheets, `read_sheet` returns all cells — the agent can process/filter the data as needed
- `write_cells` sends changes through socket.io; the page must remain open during writes
- Multiple cells can be written in a single `write_cells` call
