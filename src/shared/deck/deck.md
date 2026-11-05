# deck — specification

> **Draft (2026-10-30).** Final on 2026-10-29 for v0.2.0; reopened for item 11 of v0.2.0 (well
> capacities and dead volume): the labware types in `config/labware-types.js`, the grid moving
> from each labware to its type, and `capacityOf` and `deadVolumeOf`. Final again once Andy has
> tested the page built from it and the stand-in numbers are replaced (roadmap, "Technical debt").
>
> **Draft change (2026-11-05, cell density, item 16 of v0.2.0):** a labware type may have a
> **growth area**, `growthArea`, and `growthAreaOf` gives it (sections 1 and 3 to 6), decided with
> Andy on 2026-11-05. BCFlat96's is Andy's stand-in (roadmap, "Technical debt"). Written in the
> hands-off workflow (CLAUDE.md, "Workflows"), so the choices made for Andy are listed in its pull
> request.

## 1. Purpose
`deck.js` answers questions about the **deck description** in `config/deck.js`, the labware on the
general-purpose method's standard deck (ADR 0007), each with its name and its labware type, and
about the **labware types** in `config/labware-types.js`, each with its well grid, its capacity,
its dead volume and, for a type cells grow on, its growth area. Given a labware's name, it gives
its grid, its labware type, its capacity, its dead volume and its growth area; it checks that a well is on the deck; and it lists the wells in a box on one labware.

It's shared because more than one part of the project needs the deck description: the transfer
designer (to draw labware and check wells), contents tracking (capacities and dead volumes) and the
file writer (to look up labware types, to split stages into substages; ADR 0007, amended
2026-10-26).

It's also the module that uses `config/deck.js` and `config/labware-types.js`, so its tests check
both files (ADR 0009).

It knows only the deck description's names. The labels a user gives labware
(`docs/glossary.md`, "Labware label") are part of a plan, held by the transfer designer's logic.

## 2. Scope
Version 1 reads the one deck description in `config/deck.js` and the labware types in
`config/labware-types.js`.

Not in version 1:
- **More than one deck**, or a deck chosen by the user. There is one standard deck (ADR 0007).
- **Other physical properties** of labware, such as a well's shape or a working volume below the
  capacity (roadmap, item 11: only true overfilling is warned about).

## 3. Data model
**The deck description** (`config/deck.js`) exports `DECK`, a list with one entry per labware:
```js
{ name: "Plate", labwareType: "BCFlat96" }
```
- `name`: the labware's name exactly as in the general-purpose method. Transfers and Biomek files
  name labware by it.
- `labwareType`: its labware type, exactly as in Biomek Software, and a key in `LABWARE_TYPES`.

The list's order is the deck's order: `labwareNames()` keeps it, so a tool can show labware in the
same order every time.

**The labware types** (`config/labware-types.js`) export `LABWARE_TYPES`, an object with one entry
per labware type the deck uses, keyed by the type's name:
```js
BCFlat96: { grid: "GRID_96", capacity: 360, deadVolume: 20, growthArea: 0.32 }
```
- `grid`: the name of the type's well grid in `well-grid.js`, as text: `"GRID_96"` or
  `"GRID_1X12_NUMBERED"` (text, because configuration imports nothing but other configuration,
  ADR 0009). This module turns the name into the grid itself. A grid is a fact about the type (a
  `BCFlat96` is always 96 wells), so it's stated once here, not on each labware.
- `capacity`: the most one well holds, in µL: the type's "Maximum volume per well" in the Biomek's
  Labware Type Editor (B56358AF 17-18), copied by hand, with the source in the file's comment.
- `deadVolume`: the liquid a well holds that a tip can't reach, in µL: one value per labware type,
  because Andy sets every technique's minimum pipetting height to reach it (roadmap, item 11). A
  tip can draw only what's above it: a well's **usable volume** is what it holds minus the dead
  volume, never below 0.

- `growthArea` (only on some types; 2026-11-05): the area of one well's bottom that cells grow on,
  in cm² (`docs/glossary.md`, "Growth area"), so a tool can give a well's cells per cm²
  (`concentrations.md`, "Cells"). A type with no `growthArea` property has none, and **having none
  is what keeps cells per cm² off it**: today only `BCFlat96` has one (Andy, 2026-11-05), so deep
  wells and reservoir troughs show cells in cells/mL. Its value is in the file once.

The numbers are measured or copied, never worked out by the tool; each value's comment says where
it came from. A stand-in says so (roadmap, "Technical debt"). `BCFlat96`'s growth area is Andy's
stand-in (2026-11-05), to be confirmed against the plate's datasheet. So in
`config/labware-types.js`, `BCFlat96` gains `growthArea: 0.32`, its comment line saying
`growthArea: Andy's stand-in (2026-11-05), not checked; to be confirmed against the plate's
datasheet.`, and the file's header comment gains a `growthArea` item: the area of one well's bottom
in cm², only on types cells are grown on; a type without it gets no cells per cm².

**A well on the deck** is `{ labware, well }`, as in the operation list: `labware` is a name from the
deck description, and `well` a well name on that labware's grid (e.g. `"A1"`, or `"5"` on a
numbered grid).

**What the tests check in the two files** (ADR 0009: configuration is checked by the tests of the
module that uses it):
- in `config/deck.js`: every entry has exactly `name` and `labwareType`; both are names (text, not
  blank, no whitespace at the start or end; `checkName`, `input-checks` module), because Biomek
  finds them only by their exact names; no two entries share a name; every `labwareType` is a key
  in `LABWARE_TYPES`;
- in `config/labware-types.js`: every key is a name; every entry has `grid`, `capacity` and
  `deadVolume`, may have `growthArea`, and has nothing else; `grid` is `"GRID_96"` or
  `"GRID_1X12_NUMBERED"`; `capacity` is a number above 0 and `deadVolume` a number from 0 up to,
  and not above, `capacity`; `growthArea`, where present, is a number above 0 (not `Infinity`).

So a typo in either file fails `npm test`.

## 4. Interface
The module exports nine functions. None changes anything; each reads the configuration.

| Function | Takes | Returns | Throws |
|---|---|---|---|
| `labwareNames()` | nothing | every labware's name, in the deck's order, as a new list each time: `["Plate", "Deep", "Res"]` | never |
| `hasLabware(name)` | any value | `true` if a labware on the deck has that name, else `false`: `"Res"` → `true`, `"Bench"` → `false`, `5` → `false` | never |
| `gridOf(name)` | a labware's name | its labware type's well grid, a `WellGrid`: `"Res"` → `GRID_1X12_NUMBERED` | if the labware isn't on the deck |
| `labwareTypeOf(name)` | a labware's name | its labware type: `"Plate"` → `"BCFlat96"` | if the labware isn't on the deck |
| `capacityOf(name)` | a labware's name | its labware type's capacity in µL: `"Plate"` → `360` | if the labware isn't on the deck |
| `deadVolumeOf(name)` | a labware's name | its labware type's dead volume in µL: `"Plate"` → `20` | if the labware isn't on the deck |
| `growthAreaOf(name)` | a labware's name | its labware type's growth area in cm², or `null` if the type has none: `"Plate"` → `0.32`, `"Res"` → `null` | if the labware isn't on the deck |
| `checkWell(end)` | a well on the deck, `{ labware, well }` | nothing | if `end` isn't an object with a labware on the deck and a well on that labware's grid |
| `wellsInBox(corner, opposite)` | two wells on the deck, on one labware | every well in the rectangle between them, as wells on the deck, in the grid's standard order: `({ labware: "Plate", well: "B2" }, { labware: "Plate", well: "C3" })` → `B2, B3, C2, C3` on Plate | if either isn't a well on the deck, or they're on different labware |

`wellsInBox` uses the grid's own `wellsInBox` (`well-grid.md`), so the order and the corners work
the same way, whichever corners are given.

`capacityOf` and `deadVolumeOf` return the configured numbers as they are. The usable volume
(what's held minus the dead volume) is worked out by contents tracking only (`usableVolumeOf`,
`contents-tracking.md`), so that the rounding rule lives in one place.

## 5. Errors
Each message says what's wrong and how to fix it. Values are shown with `describeValue`
(`error-messages` module), and lists of names with `listNames` (`input-checks` module).

| Problem | Message |
|---|---|
| The labware isn't on the deck (`gridOf`, `labwareTypeOf`, `capacityOf`, `deadVolumeOf`, `growthAreaOf`, `checkWell`, `wellsInBox`) | `There's no labware "Bench" on the deck. The deck has "Plate", "Deep", "Res".` |
| `end` isn't an object with `labware` and `well` | `A well on the deck must be an object like { labware: "Plate", well: "A1" }, but got "A1".` |
| The well isn't on that labware's grid | `"Z99" isn't a well on Plate. Its wells are A1 to H12.` (On a numbered grid: `"13" isn't a well on Res. Its wells are 1 to 12.`) The first and last wells come from the grid's `wellNames()`. |
| A box's corners are on different labware (`wellsInBox`) | `A box of wells must be on one labware, but one corner is on Plate and the other on Deep.` |

`checkWell` checks in this order: the object, the labware, the well. `wellsInBox` checks the first
corner, then the second, then that they're on one labware. The first problem found is reported.

A labware type `deck.js` names but `labware-types.js` doesn't define is a configuration mistake,
caught by the tests, not at run time.

## 6. Test cases
Each becomes at least one unit test in `deck.test.js`, inside `describe("deck", …)`.

**The deck description** (`config/deck.js`)
- Every entry has exactly `name` and `labwareType`.
- Every `name` and `labwareType` passes `checkName`.
- No two entries share a name.
- Every `labwareType` is a key in `LABWARE_TYPES`.

**The labware types** (`config/labware-types.js`)
- Every key passes `checkName`.
- Every entry has `grid`, `capacity` and `deadVolume`, and nothing else but, optionally,
  `growthArea`.
- Every `grid` is `"GRID_96"` or `"GRID_1X12_NUMBERED"`.
- Every `capacity` is a number above 0, and every `deadVolume` a number from 0 to that type's
  `capacity`.
- Every `growthArea` present is a finite number above 0.

**Looking up**
- `labwareNames()` gives the names in `DECK`'s order; changing the list it returns doesn't change the
  next one.
- `hasLabware` is `true` for each name in `DECK`, and `false` for `"Bench"`, `"plate"` (case
  matters), `""`, `5` and `null`.
- `gridOf` gives `GRID_96` for a labware whose type's grid is `"GRID_96"`, and `GRID_1X12_NUMBERED`
  for one whose type's grid is `"GRID_1X12_NUMBERED"`.
- `labwareTypeOf` gives each entry's `labwareType`.
- `capacityOf` and `deadVolumeOf` give, for each entry, its type's `capacity` and `deadVolume`
  from `LABWARE_TYPES`.
- `growthAreaOf` gives, for each entry, its type's `growthArea` from `LABWARE_TYPES`, or `null`
  for a type without one.
- `gridOf`, `labwareTypeOf`, `capacityOf`, `deadVolumeOf` and `growthAreaOf` each throw the
  no-such-labware message for `"Bench"`.

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

These tests use the real configuration files. Where a test needs a labware of a given grid, it finds
one in `DECK` by `gridOf(entry.name)` rather than naming it, so the tests still pass when the deck
changes. The tests of other modules that pick labware the same way (`substages`, `mix-volumes`)
do likewise, since `DECK` entries no longer carry a `grid`.
