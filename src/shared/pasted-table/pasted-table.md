# pasted-table — specification

> **Draft change (2026-11-05, stock tables, item 21 of v0.2.0):** `tableToText`, the reverse of
> `parsePastedTable`, so a tool can put a table on the clipboard for a spreadsheet or another paste
> (sections 1, 4 and 5). Written in the hands-off workflow (CLAUDE.md, "Workflows"). It becomes
> Final once built and tested by Andy.

## 1. Purpose
`pasted-table.js` turns text copied from a spreadsheet, such as Excel, into rows of cells, so a tool
can fill a table from a paste, and turns rows of cells back into such text, so a tool can copy a
table. It knows nothing about what the cells mean; each tool decides where
they go.

## 2. Background
When cells are copied from a spreadsheet, the clipboard holds them as plain text: cells in a row are
separated by tabs, and each row ends with a line break. Excel ends lines with `\r\n` and adds a line
break after the last row too. For example, two rows of two cells copy as:
```
"Drug A\t4\r\nVehicle\t3\r\n"
```

## 3. Scope
Version 1 handles the plain text a spreadsheet puts on the clipboard. Not in version 1: cells that
contain tabs or line breaks themselves (spreadsheets put those in quotes), and HTML from the
clipboard.

## 4. Interface
The module exports three functions.

| Function | Returns | Example |
|---|---|---|
| `parsePastedTable(text)` | The rows, each a list of its cells' text, in order. | `"Drug A\t4\r\nVehicle\t3\r\n"` → `[["Drug A", "4"], ["Vehicle", "3"]]` |
| `tableToText(rows)` | The rows as a spreadsheet copies them: cells joined by tabs, each row ended by `\r\n` (the last too). | `[["Drug A", "4"], ["Vehicle", "3"]]` → `"Drug A\t4\r\nVehicle\t3\r\n"` |
| `isMultiCell(text)` | `true` if the text holds more than one cell, so a tool should fill a table instead of one box. | `"Drug A\t4"` → `true`; `"Drug A"` → `false` |

Rules for `parsePastedTable`:
- Line breaks may be `\r\n`, `\n` or `\r`; all are treated the same.
- One line break at the very end is ignored, because spreadsheets add it. Any other empty line is a
  row with one empty cell.
- Cells are split only at tabs. Their text is kept exactly, including spaces at the start or end, so
  the tool's own checks can report them.
- Rows may have different numbers of cells.
- Empty text gives one row with one empty cell: `""` → `[[""]]`.

`isMultiCell` is `true` when `parsePastedTable` gives more than one row, or a row with more than one
cell.

Rules for `tableToText`:
- `rows` is a non-empty list of rows, each a non-empty list of cells, each text; rows may have
  different numbers of cells. Anything else throws `A table to copy must be a list of rows, each a
  list of cells, each text, but got 5.` (the value by `describeValue`, except that an empty list is
  written `[]`: `… but got [].`), or, for a row or cell, `… but row 2 is [].` (an empty row is
  written `[]`; another non-list row by `describeValue`, e.g. `… but row 2 is 5.`) / `… but row 2,
  cell 3 is null.` (`describeValue`), rows and cells counted from 1.
- A cell holding a tab or a line break (`\t`, `\n` or `\r`) throws `Row 2, cell 1 holds a tab or a
  line break, which a copied table can't carry: "Feed\tA".`, the cell written with
  `JSON.stringify`, so a tab shows as the two characters `\t` (not a real tab), since version 1
  writes no quotes (section 3) and `parsePastedTable` would split it.
- Cells are written exactly, spaces included; nothing is quoted.
- `parsePastedTable(tableToText(rows))` gives `rows` back for any rows it accepts.

`parsePastedTable` and `isMultiCell` take text. Anything else throws `Pasted text must be text, but got 5.` (using
`describeValue`, `error-messages` module).

## 5. Test cases
Each becomes at least one unit test in `pasted-table.test.js`.
- The example in section 2 gives `[["Drug A", "4"], ["Vehicle", "3"]]`.
- `\n` and `\r` line breaks give the same rows as `\r\n`.
- Only one final line break is ignored: `"A\n\n"` → `[["A"], [""]]`.
- One column: `"Static\r\nBlank\r\n"` → `[["Static"], ["Blank"]]`.
- Empty cells are kept: `"A\t\tC"` → `[["A", "", "C"]]`.
- Spaces are kept: `" A \t4"` → `[[" A ", "4"]]`.
- Rows of different lengths: `"A\t1\nB"` → `[["A", "1"], ["B"]]`.
- `""` → `[[""]]`.
- `isMultiCell`: `true` for `"A\tB"`, `"A\nB"` and the example; `false` for `"A"`, `"A\n"` and `""`.
- `parsePastedTable(5)` and `isMultiCell(null)` throw the text error.
- `tableToText` gives the example in section 2 from `[["Drug A", "4"], ["Vehicle", "3"]]`; one
  cell `[["A"]]` gives `"A\r\n"`; empty cells and spaces are kept (`[[" A ", "", "C"]]` →
  `" A \t\tC\r\n"`); rows of different lengths are kept.
- `tableToText` round-trips through `parsePastedTable` for the examples above.
- `tableToText` throws its form message for `5`, `[]`, `[[]]`, `[["A"], []]` and `[["A", null]]`,
  and its tab-or-line-break message for a cell holding `\t`, `\n` or `\r`.
- The REPL's `pasted-table` topic gains `tableToText`, with an example.
