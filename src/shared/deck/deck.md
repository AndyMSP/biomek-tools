# deck — specification

> **Final (2026-10-29).** Written for v0.2.0, from the transfer designer preview (where these
> functions were tried, 2026-10-24 to 2026-10-26); built, and tested by Andy with the page (whose
> specification became Final on 2026-10-27).

## 1. Purpose
`deck.js` answers questions about the **deck description** in `config/deck.js`: the labware on the
general-purpose method's standard deck (ADR 0007), each with its name, its well grid and its labware
type. Given a labware's name, it gives its grid and its labware type; it checks that a well is on
the deck; and it lists the wells in a box on one labware.

It's shared because more than one part of the project needs the deck description: the transfer
designer (to draw labware and check wells) and the file writer (to look up labware types, to split
stages into substages; ADR 0007, amended 2026-10-26).

It's also the module that uses `config/deck.js`, so its tests check that file (ADR 0009).

It knows only the deck description's names. The labels a user gives labware
(`docs/glossary.md`, "Labware label") are part of a plan, held by the transfer designer's logic.

## 2. Scope
Version 1 reads the one deck description in `config/deck.js`.

Not in version 1:
- **More than one deck**, or a deck chosen by the user. There is one standard deck (ADR 0007).
- **Physical properties** of labware, such as well volume or dead volume (roadmap, "Technical
  debt").

## 3. Data model
**The deck description** (`config/deck.js`) exports `DECK`, a list with one entry per labware:
```js
{ name: "Plate", grid: "GRID_96", labwareType: "BCFlat96" }
```
- `name`: the labware's name exactly as in the general-purpose method. Transfers and Biomek files
  name labware by it.
- `grid`: the name of its well grid in `well-grid.js`, as text: `"GRID_96"` or
  `"GRID_1X12_NUMBERED"` (text, because configuration imports nothing but other configuration,
  ADR 0009). This module turns the name into the grid itself.
- `labwareType`: its labware type, exactly as in Biomek Software.

The list's order is the deck's order: `labwareNames()` keeps it, so a tool can show labware in the
same order every time.

**A well on the deck** is `{ labware, well }`, as in the operation list: `labware` is a name from the
deck description, and `well` a well name on that labware's grid (e.g. `"A1"`, or `"5"` on a
numbered grid).

**What the tests check in `config/deck.js`** (ADR 0009: configuration is checked by the tests of the
module that uses it):
- every entry has exactly `name`, `grid` and `labwareType`;
- `name` and `labwareType` are names (text, not blank, no whitespace at the start or end; `checkName`,
  `input-checks` module), because Biomek finds them only by their exact names;
- no two entries share a name;
- `grid` is `"GRID_96"` or `"GRID_1X12_NUMBERED"`.

So a typo in `config/deck.js` fails `npm test`.

## 4. Interface
The module exports six functions. None changes anything; each reads the deck description.

| Function | Takes | Returns | Throws |
|---|---|---|---|
| `labwareNames()` | nothing | every labware's name, in the deck's order, as a new list each time: `["Plate", "Deep", "Res"]` | never |
| `hasLabware(name)` | any value | `true` if a labware on the deck has that name, else `false`: `"Res"` → `true`, `"Bench"` → `false`, `5` → `false` | never |
| `gridOf(name)` | a labware's name | its well grid, a `WellGrid`: `"Res"` → `GRID_1X12_NUMBERED` | if the labware isn't on the deck |
| `labwareTypeOf(name)` | a labware's name | its labware type: `"Plate"` → `"BCFlat96"` | if the labware isn't on the deck |
| `checkWell(end)` | a well on the deck, `{ labware, well }` | nothing | if `end` isn't an object with a labware on the deck and a well on that labware's grid |
| `wellsInBox(corner, opposite)` | two wells on the deck, on one labware | every well in the rectangle between them, as wells on the deck, in the grid's standard order: `({ labware: "Plate", well: "B2" }, { labware: "Plate", well: "C3" })` → `B2, B3, C2, C3` on Plate | if either isn't a well on the deck, or they're on different labware |

`wellsInBox` uses the grid's own `wellsInBox` (`well-grid.md`), so the order and the corners work
the same way, whichever corners are given.

## 5. Errors
Each message says what's wrong and how to fix it. Values are shown with `describeValue`
(`error-messages` module), and lists of names with `listNames` (`input-checks` module).

| Problem | Message |
|---|---|
| The labware isn't on the deck (`gridOf`, `labwareTypeOf`, `checkWell`, `wellsInBox`) | `There's no labware "Bench" on the deck. The deck has "Plate", "Deep", "Res".` |
| `end` isn't an object with `labware` and `well` | `A well on the deck must be an object like { labware: "Plate", well: "A1" }, but got "A1".` |
| The well isn't on that labware's grid | `"Z99" isn't a well on Plate. Its wells are A1 to H12.` (On a numbered grid: `"13" isn't a well on Res. Its wells are 1 to 12.`) The first and last wells come from the grid's `wellNames()`. |
| A box's corners are on different labware (`wellsInBox`) | `A box of wells must be on one labware, but one corner is on Plate and the other on Deep.` |

`checkWell` checks in this order: the object, the labware, the well. `wellsInBox` checks the first
corner, then the second, then that they're on one labware. The first problem found is reported.

## 6. Test cases
Each becomes at least one unit test in `deck.test.js`, inside `describe("deck", …)`.

**The deck description** (`config/deck.js`)
- Every entry has exactly `name`, `grid` and `labwareType`.
- Every `name` and `labwareType` passes `checkName`.
- No two entries share a name.
- Every `grid` is `"GRID_96"` or `"GRID_1X12_NUMBERED"`.

**Looking up**
- `labwareNames()` gives the names in `DECK`'s order; changing the list it returns doesn't change the
  next one.
- `hasLabware` is `true` for each name in `DECK`, and `false` for `"Bench"`, `"plate"` (case
  matters), `""`, `5` and `null`.
- `gridOf` gives `GRID_96` for a labware whose grid is `"GRID_96"`, and `GRID_1X12_NUMBERED` for one
  whose grid is `"GRID_1X12_NUMBERED"`.
- `labwareTypeOf` gives each entry's `labwareType`.

**Wells**
- `checkWell` accepts `{ labware: "Plate", well: "H12" }` and, for the numbered labware, `"12"`.
- `checkWell` refuses `"A1"` and `null` (not an object), `{ labware: "Bench", well: "A1" }` (no such
  labware), `{ labware: "Plate", well: "Z99" }` and `{ labware: "Res", well: "13" }` (not on the
  grid), each with its message.
- `wellsInBox` with B2 and C3 on one plate gives B2, B3, C2, C3, each `{ labware, well }`, and so do
  C3 and B2 (corners in either order).
- `wellsInBox` with one well twice gives just that well.
- `wellsInBox` on the numbered labware with `"7"` and `"5"` gives 5, 6, 7.
- `wellsInBox` with corners on different labware gives its message.
- `wellsInBox` with a corner not on the deck gives `checkWell`'s message.

These tests use the real `config/deck.js`. Where a test needs a labware of a given grid, it finds one
in `DECK` rather than naming it, so the tests still pass when the deck changes.
