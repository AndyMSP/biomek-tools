# labware — specification

## Purpose
`labware.js` describes grid-shaped labware: its dimensions and how its positions are named. It
answers questions about positions, such as listing them in order, checking whether a name is valid,
and converting between a name and its row and column. It knows nothing about contents, experiments,
or instruments.

## Scope
Version 1 supports the standard 96-well plate (8 rows × 12 columns) only. The class and its methods
must work for any rectangular grid, so other formats can be added by creating new `Labware`
instances, without changing existing methods.

## Data model
- Labware is an instance of the `Labware` class, created with `new Labware(rows, columns)`.
  - `rows`: number of rows (8 for a 96-well plate)
  - `columns`: number of columns (12 for a 96-well plate)
- The constructor validates its inputs, so an invalid `Labware` instance cannot exist.
- `rows` and `columns` are readable but never change after creation.
- The module exports the `Labware` class and one predefined instance, `PLATE_96`.
- Wells are named with an uppercase row letter followed by a column number with no leading zeros:
  `A1` to `H12`. Rows are lettered from the top (A), columns numbered from the left (1).
- Rows and columns are numbered from 1, matching how they are printed on the plate. Any conversion
  to 0-based array indexes stays inside `labware.js`.
- The standard well order is rows first: `A1, A2 … A12, B1 … H12`.

## Methods
All methods are pure: they don't modify the instance and return the same output for the same input.

| Method | Takes | Returns | Example (on `PLATE_96`) |
|---|---|---|---|
| `wellNames()` | nothing | all well names in standard order | `["A1", "A2", … "H12"]` |
| `isValidWell(name)` | a well name | `true` if the well exists on this labware | `"H12"` → `true`, `"I1"` → `false` |
| `wellPosition(name)` | a well name | its row and column | `"D3"` → `{ row: 4, column: 3 }` |
| `wellNameAt(row, column)` | a row and a column | the well name | `(4, 3)` → `"D3"` |
| `isEdgeWell(name)` | a well name | `true` if the well is in the first or last row or column | `"A5"` → `true`, `"B2"` → `false` |

Well names are matched strictly. `"b2"`, `"B02"` and `" B2"` are not valid; they are never silently
corrected.

## Errors
- The constructor throws an `Error` if `rows` or `columns` is not a whole number of at least 1.
- `isValidWell` never throws. It returns `false` for anything that isn't a valid well on this
  labware, including non-text input.
- All other methods throw an `Error` when given invalid input. The message names the bad value,
  explains the problem, and says what is valid.

| Problem | Example message |
|---|---|
| Invalid labware | `Labware must have whole-number rows and columns of at least 1, but got rows 0, columns 12.` |
| Well name has the wrong format | `"b2" is not a valid well name. Well names are an uppercase row letter followed by a column number with no leading zeros, like "B2". Did you mean "B2"?` |
| Well isn't on the labware | `"I1" is not on this labware. Valid wells are rows A–H, columns 1–12.` |
| Row or column out of range | `Row 9 is out of range. Valid rows are 1–8.` |
| Not text, or not a whole number | `Well name must be text, but got 5.` |

The "Did you mean" suggestion appears only when the name becomes a valid well on this labware by
changing case, removing spaces, or removing leading zeros. Otherwise the message ends after the
explanation. The suggestion logic is internal and not exported.

## Test cases
Each becomes at least one unit test in `labware.test.js`.

**Creating labware**
- `new Labware(8, 12)` succeeds; `PLATE_96` has 8 rows and 12 columns.
- `new Labware(0, 12)`, `new Labware(8, 1.5)` and `new Labware("8", 12)` throw the invalid-labware
  error.

**`wellNames()`**
- `PLATE_96.wellNames()` returns 96 names, starting `A1, A2 … A12, B1` and ending `H12`.
- No name appears twice.

**`isValidWell(name)`**
- True: `"A1"`, `"H12"`, `"D3"`.
- False: `"I1"`, `"A13"`, `"A0"`, `"b2"`, `"B02"`, `" B2"`, `"B 2"`, `""`, `"hello"`, `5`, `null`.

**`wellPosition(name)` and `wellNameAt(row, column)`**
- `"D3"` ↔ `{ row: 4, column: 3 }`; `"A1"` ↔ `(1, 1)`; `"H12"` ↔ `(8, 12)`.
- Round trip: for every well on `PLATE_96`, converting to a position and back gives the same name.
- `wellNameAt(9, 1)`, `wellNameAt(1, 13)` and `wellNameAt(2.5, 1)` throw out-of-range or
  whole-number errors.

**`isEdgeWell(name)`**
- True: `"A1"`, `"A5"`, `"H12"`, `"D1"`, `"D12"`.
- False: `"B2"`, `"G11"`, `"D6"`.
- Exactly 36 wells on `PLATE_96` are edge wells.

**Error messages**
- `PLATE_96.wellPosition("b2")` throws a message containing `Did you mean "B2"?`
- `PLATE_96.wellPosition("B02")` suggests `"B2"`; `PLATE_96.wellPosition("hello")` gives no
  suggestion.
- `PLATE_96.wellPosition("I1")` throws the "not on this labware" message.
