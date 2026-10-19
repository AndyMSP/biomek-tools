# outputs — specification

> Experiment branch: written without section-by-section review.

## 1. Purpose
`outputs.js` turns a randomized plate into the two lists of `randomizer.md` section 6, and into the
tab-separated text their Copy buttons copy. It has no screen code.

## 2. Interface
| Export | Description |
|---|---|
| `contentsToWells(inputs, result)` | One row `{ contents, wells }` per distinct contents on the plate, with its wells in standard order. Order: conditions as listed, then the filler, then the fixed contents, then overrides (in standard well order); a name already listed isn't repeated. Contents not on the plate (e.g. an unneeded filler) aren't listed. |
| `wellToContents(result)` | One row `{ well, contents }` per well, in standard order. |
| `contentsToWellsText(rows)` | `Contents` and `Wells` columns, wells joined by `, `. |
| `wellToContentsText(rows)` | `Well` and `Contents` columns. |

Text uses a tab between columns and a line break between rows, with a header row, so it pastes into
Excel as columns. Names are trimmed the same way `assign` trims them.

## 3. Test cases
- The main example: 14 rows (12 conditions, `Spare`, `Static`), with every condition's 4 wells.
- Shared names: `Static` appears once, with all 48 of its wells.
- Overrides come last, in standard well order, and a filler that isn't needed isn't listed.
- Both lists agree with the plate exactly (randomizer.md check 6).
- Copy text: the header row and the rows described above, tab-separated.
