# well-grid — specification

## Purpose
`well-grid.js` describes the grid of positions on a piece of labware: its dimensions and how its
positions are named. It answers questions about positions, such as listing them in order, checking
whether a name is valid, and converting between a name and its row and column. It knows nothing about
contents, experiments, instruments, or physical properties such as well volume or depth.

Different labware types can share one grid. A standard 96-well plate, a deep-well block and a PCR
plate all have the same 8 × 12 grid; what differs between them is described elsewhere, not here.

A grid names its wells in one of two ways. Plates use letter-number names (`A1`, `B2`); the lab's
12-well reservoir uses numbers (`1` to `12`), as Exp37's files did (`docs/domain/exp37.md`). Each
grid uses one way only, so each well has exactly one name: other modules compare names exactly, and
`"5"` and `"A5"` would otherwise count as two different wells.

## Scope
Version 1 supports two grids: the 96-well grid (8 rows × 12 columns, letter-number names) and the
12-well reservoir's grid (1 row × 12 columns, numbered). The class and its methods must work for any
rectangular grid, so other formats can be added by creating new `WellGrid` instances, without
changing existing methods.

## Data model
- A grid is an instance of the `WellGrid` class, created with `new WellGrid(rows, columns)` or
  `new WellGrid(rows, columns, { naming: "number" })`.
  - `rows`: number of rows (8 for a 96-well grid); at most 26 for letter-number names, because each
    row is named with one letter (A–Z)
  - `columns`: number of columns (12 for a 96-well grid)
  - `naming`: `"letter-number"` (the default, when the third argument is left out) or `"number"`
- The constructor validates its inputs, so an invalid `WellGrid` instance cannot exist.
- `rows`, `columns` and `naming` are readable but never change after creation.
- The module exports the `WellGrid` class and two predefined instances: `GRID_96`
  (`new WellGrid(8, 12)`) and `GRID_1X12_NUMBERED` (`new WellGrid(1, 12, { naming: "number" })`), used
  by the 12-well reservoir.
- **Letter-number names:** an uppercase row letter followed by a column number with no leading
  zeros: `A1` to `H12`. Rows are lettered from the top (A), columns numbered from the left (1).
- **Number names:** the well's place in the standard well order, counting from 1, as text with no
  leading zeros: number = (row − 1) × columns + column, the same numbering the Biomek uses
  (`docs/domain/biomek.md`). On `GRID_1X12_NUMBERED`, `"1"` to `"12"`, left to right.
- Rows and columns are numbered from 1, matching how they are printed on the plate. Any conversion
  to 0-based array indexes stays inside `well-grid.js`.
- The standard well order is rows first: `A1, A2 … A12, B1 … H12`. On a numbered grid it is
  `1, 2, 3 …`.

## Methods
All methods are pure: they don't modify the instance and return the same output for the same input.

| Method | Takes | Returns | Example (on `GRID_96`) | Example (on `GRID_1X12_NUMBERED`) |
|---|---|---|---|---|
| `wellNames()` | nothing | all well names in standard order | `["A1", "A2", … "H12"]` | `["1", "2", … "12"]` |
| `isValidWell(name)` | a well name | `true` if the well exists on this grid | `"H12"` → `true`, `"I1"` → `false` | `"5"` → `true`, `"A5"` → `false` |
| `wellPosition(name)` | a well name | its row and column | `"D3"` → `{ row: 4, column: 3 }` | `"5"` → `{ row: 1, column: 5 }` |
| `wellNameAt(row, column)` | a row and a column | the well name | `(4, 3)` → `"D3"` | `(1, 5)` → `"5"` |
| `isEdgeWell(name)` | a well name | `true` if the well is in the first or last row or column | `"A5"` → `true`, `"B2"` → `false` | every well → `true` (one row) |
| `wellsInBox(corner, oppositeCorner)` | two well names | every well in the rectangle between them, in standard order | `("B2", "C4")` → `["B2", "B3", "B4", "C2", "C3", "C4"]` | `("7", "5")` → `["5", "6", "7"]` |

`wellsInBox` includes both corners. The corners may be any two opposite corners, given in either
order: `("B2", "C4")`, `("C4", "B2")`, `("B4", "C2")` and `("C2", "B4")` all give the same box. Two
equal corners give a box of one well: `("D7", "D7")` → `["D7"]`. Each corner is checked the same way
as in `wellPosition`, with the same messages.

Well names are matched strictly. `"b2"`, `"B02"` and `" B2"` are not valid; they are never silently
corrected. On a numbered grid, `"05"`, `" 5"` and the number `5` (not text) are not valid either, and
neither is a letter-number name such as `"A5"`.

## Errors
- The constructor throws an `Error` if `rows` is not a whole number of at least 1 (and at most 26
  for letter-number names), `columns` is not a whole number of at least 1, or the third argument
  isn't left out or an object whose `naming` is `"letter-number"` or `"number"`.
- `isValidWell` never throws. It returns `false` for anything that isn't a valid well on this grid,
  including non-text input.
- All other methods throw an `Error` when given invalid input. The message names the bad value,
  explains the problem, and says what is valid.

| Problem | Example message |
|---|---|
| Invalid grid | `A well grid must have whole-number rows from 1 to 26 and columns of at least 1, but got rows 0, columns 12.` On a numbered grid: `A numbered well grid must have whole-number rows and columns of at least 1, but got rows 0, columns 12.` |
| Invalid naming | `A well grid's naming must be "letter-number" or "number", but got "numbers".` |
| Well name has the wrong format | `"b2" is not a valid well name. Well names are an uppercase row letter followed by a column number with no leading zeros, like "B2". Did you mean "B2"?` |
| Well name has the wrong format, numbered grid | `"A5" is not a valid well name. Wells on this grid are numbered, with no leading zeros, like "5".` |
| Well isn't on the grid | `"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.` |
| Well isn't on the grid, numbered grid | `"13" is not on this grid. Valid wells are 1–12.` |
| Row or column out of range | `Row 9 is out of range. Valid rows are 1–8.` |
| Not text, or not a whole number | `Well name must be text, but got 5.` |

A name that has the right format but names a row or column outside this grid, such as `"I1"`,
`"A13"` or `"A0"`, gets the "not on this grid" message, not the wrong-format message. On a numbered
grid, the same goes for `"13"` and `"0"`.

The "Did you mean" suggestion appears only when the name becomes a valid well on this grid by
changing case, removing spaces, or removing leading zeros. Otherwise the message ends after the
explanation. On a numbered grid it works the same way: `"05"` and `" 5"` suggest `"5"`, while `"A5"`
gets no suggestion. The suggestion logic is internal and not exported.

## Test cases
Each becomes at least one unit test in `well-grid.test.js`.

**Creating a grid**
- `new WellGrid(8, 12)` succeeds; `GRID_96` has 8 rows, 12 columns and naming `"letter-number"`.
- `new WellGrid(26, 1)` succeeds.
- `new WellGrid(0, 12)`, `new WellGrid(8, 1.5)`, `new WellGrid("8", 12)` and `new WellGrid(27, 12)`
  throw the invalid-grid error.
- `GRID_1X12_NUMBERED` has 1 row, 12 columns and naming `"number"`.
- `new WellGrid(8, 12, { naming: "letter-number" })` is the same as `new WellGrid(8, 12)`.
- `new WellGrid(27, 12, { naming: "number" })` succeeds: numbered grids have no 26-row limit.
- `new WellGrid(0, 12, { naming: "number" })` throws the numbered invalid-grid error.
- `{ naming: "numbers" }`, `{ naming: 5 }`, `{}`, `"number"` and `null` as the third argument
  throw the invalid-naming error.

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

**`wellsInBox(corner, oppositeCorner)`**
- `("B2", "C4")` returns `B2, B3, B4, C2, C3, C4`, in standard order.
- The same box from all four directions: `("C4", "B2")`, `("B4", "C2")` and `("C2", "B4")` give the
  same list.
- `("D7", "D7")` returns `["D7"]`; `("A1", "H12")` returns all 96 wells in standard order.
- A single row and a single column: `("A3", "A5")` → `A3, A4, A5`; `("B2", "D2")` → `B2, C2, D2`.
- Works on other grids: on `new WellGrid(2, 3)`, `("A1", "B3")` returns all 6 wells.
- A bad corner throws the same message as `wellPosition`: `("I1", "A1")` gives the "not on this grid"
  message, and `("A1", "b2")` includes `Did you mean "B2"?`.

**Numbered grids** (on `GRID_1X12_NUMBERED` unless stated)
- `wellNames()` returns `"1"` to `"12"` in order.
- On `new WellGrid(2, 3, { naming: "number" })`, `wellNames()` returns `"1"` to `"6"`, and
  `wellPosition("4")` returns `{ row: 2, column: 1 }`.
- `isValidWell`: true for `"1"`, `"5"`, `"12"`; false for `"0"`, `"13"`, `"05"`, `" 5"`, `"A5"`,
  `"a5"`, `5`, `null`.
- `wellPosition("5")` ↔ `wellNameAt(1, 5)` is `"5"`; round trip for every well.
- `isEdgeWell` is true for every well.
- `wellsInBox("7", "5")` returns `"5"`, `"6"`, `"7"`.
- `wellPosition("A5")` gives the numbered wrong-format message, with no suggestion.
- `wellPosition("05")` and `wellPosition(" 5")` include `Did you mean "5"?`.
- `wellPosition("13")` and `wellPosition("0")` give the numbered "not on this grid" message.

**Error messages**
- `GRID_96.wellPosition("b2")` throws a message containing `Did you mean "B2"?`
- `GRID_96.wellPosition("B02")` suggests `"B2"`; `GRID_96.wellPosition("hello")` gives no
  suggestion.
- `GRID_96.wellPosition("I1")`, `GRID_96.wellPosition("A13")` and `GRID_96.wellPosition("A0")`
  throw the "not on this grid" message.
