# pasted-table — specification

## 1. Purpose
`pasted-table.js` turns text copied from a spreadsheet, such as Excel, into rows of cells, so a tool
can fill a table from a paste. It knows nothing about what the cells mean; each tool decides where
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
The module exports two functions.

| Function | Returns | Example |
|---|---|---|
| `parsePastedTable(text)` | The rows, each a list of its cells' text, in order. | `"Drug A\t4\r\nVehicle\t3\r\n"` → `[["Drug A", "4"], ["Vehicle", "3"]]` |
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

Both functions take text. Anything else throws `Pasted text must be text, but got 5.` (using
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
