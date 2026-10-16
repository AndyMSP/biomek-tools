# well-grid — specification

## Purpose
`well-grid.js` describes the grid of positions on a piece of labware: its dimensions and how its
positions are named. It answers questions about positions, such as listing them in order, checking
whether a name is valid, and converting between a name and its row and column. It knows nothing about
contents, experiments, instruments, or physical properties such as well volume or depth.

Different labware types can share one grid. A standard 96-well plate, a deep-well block and a PCR
plate all have the same 8 × 12 grid; what differs between them is described elsewhere, not here.

## Scope
Version 1 supports the 96-well grid (8 rows × 12 columns) only. The class and its methods must work
for any rectangular grid, so other formats can be added by creating new `WellGrid` instances, without
changing existing methods.

## Data model
- A grid is an instance of the `WellGrid` class, created with `new WellGrid(rows, columns)`.
  - `rows`: number of rows (8 for a 96-well grid); at most 26, because each row is named with one
    letter (A–Z)
  - `columns`: number of columns (12 for a 96-well grid)
- The constructor validates its inputs, so an invalid `WellGrid` instance cannot exist.
- `rows` and `columns` are readable but never change after creation.
- The module exports the `WellGrid` class and one predefined instance, `GRID_96`.
- Wells are named with an uppercase row letter followed by a column number with no leading zeros:
  `A1` to `H12`. Rows are lettered from the top (A), columns numbered from the left (1).
- Rows and columns are numbered from 1, matching how they are printed on the plate. Any conversion
  to 0-based array indexes stays inside `well-grid.js`.
- The standard well order is rows first: `A1, A2 … A12, B1 … H12`.

## Methods
All methods are pure: they don't modify the instance and return the same output for the same input.

| Method | Takes | Returns | Example (on `GRID_96`) |
|---|---|---|---|
| `wellNames()` | nothing | all well names in standard order | `["A1", "A2", … "H12"]` |
| `isValidWell(name)` | a well name | `true` if the well exists on this grid | `"H12"` → `true`, `"I1"` → `false` |
| `wellPosition(name)` | a well name | its row and column | `"D3"` → `{ row: 4, column: 3 }` |
| `wellNameAt(row, column)` | a row and a column | the well name | `(4, 3)` → `"D3"` |
| `isEdgeWell(name)` | a well name | `true` if the well is in the first or last row or column | `"A5"` → `true`, `"B2"` → `false` |

Well names are matched strictly. `"b2"`, `"B02"` and `" B2"` are not valid; they are never silently
corrected.

## Errors
- The constructor throws an `Error` if `rows` is not a whole number from 1 to 26, or `columns` is
  not a whole number of at least 1.
- `isValidWell` never throws. It returns `false` for anything that isn't a valid well on this grid,
  including non-text input.
- All other methods throw an `Error` when given invalid input. The message names the bad value,
  explains the problem, and says what is valid.

| Problem | Example message |
|---|---|
| Invalid grid | `A well grid must have whole-number rows from 1 to 26 and columns of at least 1, but got rows 0, columns 12.` |
| Well name has the wrong format | `"b2" is not a valid well name. Well names are an uppercase row letter followed by a column number with no leading zeros, like "B2". Did you mean "B2"?` |
| Well isn't on the grid | `"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.` |
| Row or column out of range | `Row 9 is out of range. Valid rows are 1–8.` |
| Not text, or not a whole number | `Well name must be text, but got 5.` |

A name that has the right format but names a row or column outside this grid, such as `"I1"`,
`"A13"` or `"A0"`, gets the "not on this grid" message, not the wrong-format message.

The "Did you mean" suggestion appears only when the name becomes a valid well on this grid by
changing case, removing spaces, or removing leading zeros. Otherwise the message ends after the
explanation. The suggestion logic is internal and not exported.

## Test cases
Each becomes at least one unit test in `well-grid.test.js`.

**Creating a grid**
- `new WellGrid(8, 12)` succeeds; `GRID_96` has 8 rows and 12 columns.
- `new WellGrid(26, 1)` succeeds.
- `new WellGrid(0, 12)`, `new WellGrid(8, 1.5)`, `new WellGrid("8", 12)` and `new WellGrid(27, 12)`
  throw the invalid-grid error.

**`wellNames()`**
- `GRID_96.wellNames()` returns 96 names, starting `A1, A2 … A12, B1` and ending `H12`.
- No name appears twice.

**`isValidWell(name)`**
- True: `"A1"`, `"H12"`, `"D3"`.
- False: `"I1"`, `"A13"`, `"A0"`, `"b2"`, `"B02"`, `" B2"`, `"B 2"`, `""`, `"hello"`, `5`, `null`.

**`wellPosition(name)` and `wellNameAt(row, column)`**
- `"D3"` ↔ `{ row: 4, column: 3 }`; `"A1"` ↔ `(1, 1)`; `"H12"` ↔ `(8, 12)`.
- Round trip: for every well on `GRID_96`, converting to a position and back gives the same name.
- `wellNameAt(9, 1)`, `wellNameAt(1, 13)` and `wellNameAt(2.5, 1)` throw out-of-range or
  whole-number errors.

**`isEdgeWell(name)`**
- True: `"A1"`, `"A5"`, `"H12"`, `"D1"`, `"D12"`.
- False: `"B2"`, `"G11"`, `"D6"`.
- Exactly 36 wells on `GRID_96` are edge wells.

**Error messages**
- `GRID_96.wellPosition("b2")` throws a message containing `Did you mean "B2"?`
- `GRID_96.wellPosition("B02")` suggests `"B2"`; `GRID_96.wellPosition("hello")` gives no
  suggestion.
- `GRID_96.wellPosition("I1")`, `GRID_96.wellPosition("A13")` and `GRID_96.wellPosition("A0")`
  throw the "not on this grid" message.
