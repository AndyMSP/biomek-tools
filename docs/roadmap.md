# Roadmap

Where the project is headed. This is a plan, not a specification: nothing here is built until it has
a specification (`name.md`) and Andy has approved it. Decisions are recorded as ADRs in `docs/adr/`.

Last updated: 2026-10-19

## Done
- **`well-grid`** (shared module): the grid of well positions on labware — listing wells, validating
  well names, converting between names and row/column, edge wells. See
  `src/shared/well-grid/well-grid.md`.
- **`error-messages`** (shared module): helpers for writing error messages (`describeValue`). See
  `src/shared/error-messages/error-messages.md`.
- **`random`** (shared module): seeded random numbers (mulberry32) and a Fisher–Yates shuffle. See
  `src/shared/random/random.md` and ADR 0003.
- **`randomizer.md`**: the randomizer's tool specification. See
  `src/tools/randomizer/randomizer.md`.
- **`layout`** (shared module): what is in each well of a grid, with each well's contents recorded
  as a name. See `src/shared/layout/layout.md`.
- **`well-selection`** (shared module): which wells of a grid are selected — select, deselect and
  toggle single wells, and list selected and unselected wells. See
  `src/shared/well-selection/well-selection.md`.
- **`randomizer.js`**: the randomizer's logic — checking the inputs, shuffling the replicates and
  filling the open wells, and building the two lists and their copy text. See
  `src/tools/randomizer/randomizer.md`.
- **Project setup**: ES modules, `npm test` (Node's built-in test runner), `npm run repl`.

## Current goal: the randomizer
A general version of the Exp37 plate randomizer (`randomizer_V2.xlsx`). The randomizer is a tool made
of several modules; work happens one module at a time, each with its own specification, branch and
pull request.

Order of work:
1. **`randomizer.md`**: the tool specification — what goes in, what comes out, what version 1
   includes. Written first, because it sets the requirements for the modules below.
2. **`random`** (shared): seeded random numbers.
3. **`layout`** (shared): what is in each well.
4. **`well-selection`** (shared): which wells of a grid are selected. The randomizer uses it for
   its fixed wells.
5. **`randomizer.js`**: the tool's logic — checking the inputs, shuffling the replicates and filling
   the open wells, and building the two lists and their copy text.
6. **The page**: `randomizer.html`, `randomizer.css` and `randomizer-page.js`, the screen that
   connects the modules.

Expected for version 1 (to be confirmed in `randomizer.md`), one 96-well plate:
- List the conditions and how many replicates each needs. There is no organized plate: samples
  don't start in one, so the replicates are dealt directly into random wells.
- Choose which wells are fixed and which are open, by clicking wells. The user decides which wells
  are fixed; contents never do.
- Name the contents of the fixed wells (no preset), with optional exceptions for individual wells.
- Name a filler for spare open wells; the filler is randomized together with the conditions.
- Replicates (and filler) are put in a random order and placed into the open wells. The order is
  seeded, so the same inputs and seed always give the same result.
- Outputs: the randomized plate, and a key from each condition to its wells and from each well to
  its contents.

Later, as separate modules:
- Several plates:
  - the same arrangement on every plate (as in Exp37);
  - a new shuffle on every plate, each plate holding a complete set;
  - one set of replicates spread across plates, either fully random or blocked by plate (each plate
    gets an equal share of every condition). Blocking needs a rule for uneven splits.
- More ways to enter inputs: pasting conditions from Excel, a "fix the outer ring" shortcut (built on
  `isEdgeWell`), and a button for a new random seed.
- Constrained shuffles, e.g. each condition once per quadrant, or each condition getting a share of
  edge wells (Sophie's question).
- Saving and reloading inputs: save the full inputs (condition list in order, fixed wells, contents,
  overrides, filler, seed) with the results, so a plate can be recreated by loading them rather
  than retyping. Avoids accidental changes from reordering conditions or changing replicate counts.
- Celigo labeling: label a pasted Celigo export with each well's contents.
- Biomek Transfer From File CSV to dispense each condition into its randomized wells (needs the
  source labware and positions of each condition).

Shared modules it needs:
- **`layout`**: what is in each well of a grid. In the randomizer it holds and shows the result
  rather than being typed in. Contents should be designed so they can later carry volumes and
  mixtures (see volume tracking below), even if version 1 only needs text labels.
- **`random`**: seeded random numbers that give the same sequence on any computer.
- **`well-selection`**: which wells of a grid are selected; the randomizer treats selected wells
  as fixed. The transfer designer can use it to pick wells too.

## Later: transfer designer
A tool for planning transfers by clicking and dragging from one well to another.
- Each drag becomes a transfer: source labware and well, destination labware and well, volume. This
  matches the Biomek Transfer From File columns, so it shares the Biomek CSV output module with the
  randomizer.
- Needs **labware types** (`Labware`): a name exactly as in the Biomek method, physical properties
  such as well capacity, and a `WellGrid` (composition; see ADR 0001). Lab-specific values live in
  `config/`.
- Reservoirs need numbered positions (`1`, `2` …); `WellGrid` currently names wells letter-number
  only. ADR 0001 anticipates a constructor option or subclass.
- Drag handling lives only in page code; everything it produces is plain data, tested in Node.

## Later: volume tracking
Show what each well will contain after a series of transfers, and warn about problems such as
overfilling a well or drawing more than it holds.
- Proposed design: **replay**. Keep the starting layout and the transfer list, and compute the
  current state by applying the transfers in order, rather than keeping an object that changes.
  This gives undo for free (remove the last transfer), is a pure function and easy to test, and
  keeps the transfer list as the single source of truth — the same list that becomes the Biomek CSV.
- Well capacities come from the labware types.

## Open decisions
- **How tools reach the lab**: a single HTML file per tool (needs a build script; works offline) or
  a hosted site (no build step; needs internet access, and GitHub Pages on a private repository
  needs a paid plan). Only the end of the process differs; nothing built before then depends on it.
- **Very large plates**: `WellGrid` allows at most 26 rows (A–Z). 1536-well plates (rows A–AF)
  would need a specification change.
