# layout — specification

## 1. Purpose
`layout.js` records what is in each well of a grid (e.g. "D4 holds Condition 3"). Each layout is made
for one `WellGrid`, which supplies the well names, so it works for any grid size. It knows nothing
about how the contents were chosen.

## 2. Scope
Version 1 records each well's contents as a name only, such as `"Condition 3"` or `"PBS"` (see
section 3).

Not in version 1 (see `docs/roadmap.md`):
- **Volumes and mixtures**, such as "50 µL of Condition 3 plus 50 µL of PBS". Volume tracking will
  need these later.
- **History.** A layout holds only the current contents; it doesn't remember earlier ones. Working
  out what wells hold after a series of transfers belongs to volume tracking.

## 3. Data model
- A layout is an instance of the `Layout` class, created with `new Layout(grid)`, where `grid` is a
  `WellGrid` (e.g. `GRID_96`). The constructor checks that `grid` is a `WellGrid`.
- The layout gets the well names and their standard order from its grid. Code using the layout can
  read which grid it uses (e.g. to know how many rows and columns to draw), but can't replace it with
  a different grid.
- A new layout starts with every well empty. An empty well is a normal state, not an error.
- A layout is mutable: setting a well's contents changes the layout itself.
- Contents are an object with one property, `name`, which is text that isn't blank (it has at least
  one character that isn't whitespace) and has no whitespace at the start or end, e.g.
  `{ name: "Condition 3" }`. Later versions may add properties such as volume.
- The layout stores and returns contents by well. It doesn't compare, search or group them; that's
  left to the modules that use it.

## 4. Interface
The module exports one class, `Layout`.

| Member | Visibility | Description |
|---|---|---|
| `constructor(grid)` | public | Checks that `grid` is a `WellGrid` and creates a layout with every well empty. |
| `grid` | public, read-only | The `WellGrid` this layout is made for. |
| `setContents(well, contents)` | public | Sets the contents of a well, replacing any contents already there. `contents` must be valid contents (see section 3); `null` is rejected, so this can't be used to empty a well. |
| `contentsOf(well)` | public | Returns the contents of a well, or `null` if it's empty. |
| `listWells()` | public | Returns every well in standard order with its contents (`null` if empty). |
| `#grid` | private | The grid passed to the constructor. |
| `#contentsByWell` | private | A Map from well name to contents. Empty wells have no entry. |

Example:
```js
const layout = new Layout(GRID_96);
layout.setContents("D4", { name: "Condition 3" });
layout.contentsOf("D4");   // { name: "Condition 3" }
layout.contentsOf("A1");   // null
layout.listWells();        // [{ well: "A1", contents: null }, … { well: "D4", contents: { name: "Condition 3" } }, …]
```

## 5. Errors
Every public method checks its input and throws an `Error` whose message says what is wrong and how
to fix it. Values in messages are shown with `describeValue` (`error-messages` module), so text
appears in quotes.

| Problem | Message |
|---|---|
| `grid` isn't a `WellGrid` | `A layout needs a WellGrid, like GRID_96, but got 96.` |
| Well name not valid on the grid | The grid's own error, unchanged (see `well-grid.md`), e.g. `"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.` |
| Contents isn't an object (including `null` and lists) | `Contents must be an object with a name, like { name: "PBS" }, but got null.` |
| `name` missing or not text | `The contents name must be text, but got undefined.` |
| `name` is blank (empty or only whitespace) | `The contents name is blank. Give it at least one character that isn't a space.` |
| `name` has whitespace at the start or end | `The contents name " PBS" has spaces at the start or end. Remove them.` |

In JavaScript a list (an array) and `null` both count as objects, so they are named in the contents
row to make sure they get that message. For a list, the message ends `but got a list.`, because
`describeValue` shows a list's items without brackets (`[]` would appear as nothing at all).

## 6. Test cases
Each becomes at least one unit test in `layout.test.js`.

**Creating a layout**
- `new Layout(GRID_96)` succeeds, and `layout.grid` is `GRID_96`.
- A new layout is empty: `listWells()` gives 96 wells, all with contents `null`.
- Works for other grids: `new Layout(new WellGrid(2, 3))` lists `A1, A2, A3, B1, B2, B3`, all empty.
- The grid can't be replaced: assigning to `layout.grid` throws, and `layout.grid` is still
  `GRID_96`.
- `new Layout(96)`, `new Layout(null)` and `new Layout({ rows: 8, columns: 12 })` throw the
  WellGrid error.

**`setContents` and `contentsOf`**
- After `setContents("D4", { name: "Condition 3" })`, `contentsOf("D4")` returns
  `{ name: "Condition 3" }`, and every other well is still `null`.
- Setting D4 again replaces its contents.
- Accepted names include `"+"`, `"α"` and `"Condition 3"`.
- Extra properties are kept: `{ name: "PBS", colour: "blue" }` comes back unchanged.

**`listWells()`**
- Returns every well in standard order, with set wells showing their contents and the rest `null`.
- Returns a new list each time: changing the returned list doesn't change the layout.

**Errors**
- `setContents` and `contentsOf` with `"I1"` give the "not on this grid" message; with `"b2"`, the
  message includes `Did you mean "B2"?`.
- Contents `null`, `"PBS"`, `5` and `[]` throw the object error; `[]` gives a message ending
  `but got a list.`
- `{}` and `{ name: 5 }` throw the text error.
- `{ name: "" }` and `{ name: "   " }` throw the blank error.
- `{ name: " PBS" }` and `{ name: "PBS " }` throw the whitespace error.
- A failed `setContents` leaves the well's contents unchanged.
