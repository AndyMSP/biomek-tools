# paste — specification

> Experiment branch: written without section-by-section review.

## 1. Purpose
`paste.js` turns text copied from Excel into condition rows `{ name, replicates }`, for the
randomizer's condition list (`randomizer.md` section 4). It doesn't check the rows; `assign` does,
so pasted mistakes get the same messages as typed ones.

## 2. Interface
| Export | Description |
|---|---|
| `parseConditionRows(text)` | One row per line that isn't blank. The first column is the name, the second the replicates; further columns are ignored. |
| `replicatesFromText(text)` | Trims the text; digits only (e.g. `"4"`) become a number, anything else (e.g. `"four"`, `""`, `"1.5"`) stays text, so `assign` can report it. |

Excel separates columns with tabs and rows with line breaks (`\r\n` or `\n`), and often ends with
a line break, which gives a blank last line.

## 3. Test cases
- `"Condition 1\t4\r\nCondition 2\t4\r\n"` → two rows with replicates `4`.
- Blank lines are skipped; a line with only a name gets replicates `""`.
- `"four"` and `"1.5"` stay text; `" 12 "` becomes `12`.
- A pasted header row (`Name\tReplicates`) becomes an ordinary row, reported by `assign`.
