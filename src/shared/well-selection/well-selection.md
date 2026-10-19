# well-selection — specification

## 1. Purpose
`well-selection.js` records which wells of a grid are selected. Each selection is made for one
`WellGrid`, which supplies the well names. It knows nothing about what the selection is for; each
tool decides what being selected means (e.g. fixed wells, or wells to transfer from).

## 2. Scope
Version 1 can select and deselect single wells, and list the selected and unselected wells in
standard order.

Not in version 1:
- Selecting a rectangle of wells, or a whole row or column, at once.
- Presets such as selecting all edge wells. A tool that needs one builds it from `select` and the
  grid (e.g. `isEdgeWell` in `well-grid.md`).
- Remembering the order in which wells were selected. A selection is a set, listed in standard
  order.

## 3. Data model
- A selection is an instance of the `WellSelection` class, created with `new WellSelection(grid)`,
  where `grid` is a `WellGrid` (e.g. `GRID_96`). The constructor checks that `grid` is a
  `WellGrid`.
- The selection gets the well names and their standard order from its grid. Code using the
  selection can read which grid it uses, but can't replace it with a different grid.
- A new selection starts with no wells selected.
- A selection is mutable: selecting or deselecting a well changes the selection itself.
- Each well is either selected or not; there is nothing else to record about it.

## 4. Interface
The module exports one class, `WellSelection`.

| Member | Visibility | Description |
|---|---|---|
| `constructor(grid)` | public | Checks that `grid` is a `WellGrid` and creates a selection with no wells selected. |
| `grid` | public, read-only | The `WellGrid` this selection is made for. |
| `select(well)` | public | Selects a well. Selecting a well that is already selected changes nothing and isn't an error. |
| `deselect(well)` | public | Deselects a well. Deselecting a well that isn't selected changes nothing and isn't an error. |
| `toggle(well)` | public | Selects the well if it isn't selected, and deselects it if it is. |
| `isSelected(well)` | public | Returns `true` if the well is selected, `false` if not. |
| `selectedWells()` | public | Returns the selected wells as a list of well names in standard order. |
| `unselectedWells()` | public | Returns the wells that aren't selected as a list of well names in standard order. |
| `#grid` | private | The grid passed to the constructor. |
| `#selected` | private | A Set (a built-in collection of unique values) holding the names of the selected wells. |

Example:
```js
const selection = new WellSelection(GRID_96);
selection.select("A1");
selection.toggle("D4");          // D4 is now selected
selection.isSelected("D4");      // true
selection.selectedWells();       // ["A1", "D4"]
selection.unselectedWells().length;  // 94
```

## 5. Errors
Every method that takes a well, and the constructor, checks its input and throws an `Error` whose
message says what is wrong and how to fix it. Values in messages are shown with `describeValue`
(`error-messages` module).

| Problem | Message |
|---|---|
| `grid` isn't a `WellGrid` | `A well selection needs a WellGrid, like GRID_96, but got 96.` |
| Well name not valid on the grid | The grid's own error, unchanged (see `well-grid.md`), e.g. `"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.` |

`isSelected` also throws for a well name that isn't valid, rather than answering `false`: asking
about a well that doesn't exist is almost certainly a mistake, and a silent `false` would hide it.

## 6. Test cases
Each becomes at least one unit test in `well-selection.test.js`.

**Creating a selection**
- `new WellSelection(GRID_96)` succeeds, `selection.grid` is `GRID_96`, nothing is selected
  (`selectedWells()` is `[]`), and `unselectedWells()` lists all 96 wells.
- Works for other grids: on `new WellGrid(2, 3)`, `unselectedWells()` is
  `A1, A2, A3, B1, B2, B3`.
- The grid can't be replaced: assigning to `selection.grid` throws, and `selection.grid` is still
  `GRID_96`.
- `new WellSelection(96)`, `new WellSelection(null)` and
  `new WellSelection({ rows: 8, columns: 12 })` throw the WellGrid error; the last message ends
  `but got an object.`

**Selecting and deselecting**
- After `select("D4")`, `isSelected("D4")` is `true` and every other well is `false`.
- After `deselect("D4")`, `isSelected("D4")` is `false`.
- `toggle("D4")` on an unselected well selects it; toggling again deselects it.
- Selecting D4 twice causes no error, and D4 appears once in `selectedWells()`.
- Deselecting a well that isn't selected causes no error and changes nothing.

**Lists**
- `selectedWells()` and `unselectedWells()` are in standard order, e.g. after selecting H12, A2 and
  D4 (in that order), `selectedWells()` is `A2, D4, H12`.
- Together they contain every well of the grid exactly once.
- Each returns a new list: changing a returned list doesn't change the selection.

**Errors**
- `select`, `deselect`, `toggle` and `isSelected` with `"I1"` give the "not on this grid" message;
  with `"b2"`, the message includes `Did you mean "B2"?`.
- A failed call leaves the selection unchanged: after `select("D4")`, `select("I1")` throws and
  `selectedWells()` is still `D4` only.
