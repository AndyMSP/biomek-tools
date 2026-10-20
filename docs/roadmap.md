# Roadmap

Where the project is headed. This is a plan, not a specification: nothing here is built until it has
a specification (`name.md`) and Andy has approved it. Decisions are recorded as ADRs in `docs/adr/`.

Last updated: 2026-10-20

## Where things stand
- The randomizer is released as **v0.1.0** (GitHub Releases; see `CHANGELOG.md`). Version numbers
  starting with 0 mean it may still change, for example to work with the next tool.
- **Next:** Biomek output for the randomizer (below). Before its specification can start, one
  decision is open: which Biomek method will read the files.

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
- **`pasted-table`** (shared module): turns text copied from a spreadsheet into rows of cells. See
  `src/shared/pasted-table/pasted-table.md`.
- **The randomizer page**: `randomizer.html`, `randomizer.css` and `randomizer-page.js`, the screen
  that connects the modules. See `src/tools/randomizer/randomizer-page.md`.
- **Build step**: `npm run build` makes one self-contained HTML file per tool in `dist/`, which opens
  in Edge or Chrome with nothing installed. See ADR 0004.
- **Release v0.1.0** of the randomizer, 2026-10-20.
- **Project setup**: ES modules, `npm test` (Node's built-in test runner), `npm run repl`,
  `npm run serve`.

## The randomizer
A general version of the Exp37 plate randomizer (`randomizer_V2.xlsx`), for one 96-well plate.
Version 1 is done and released; what it does is in `src/tools/randomizer/randomizer.md` and
`randomizer-page.md`.

Later additions, each as its own change:
- Several plates:
  - the same arrangement on every plate (as in Exp37);
  - a new shuffle on every plate, each plate holding a complete set;
  - one set of replicates spread across plates, either fully random or blocked by plate (each plate
    gets an equal share of every condition). Blocking needs a rule for uneven splits.
- More ways to enter inputs: a "fix the outer ring" shortcut (built on `isEdgeWell`) and a button for
  a new random seed. (Pasting from Excel is in version 1.)
- Constrained shuffles, e.g. each condition once per quadrant, or each condition getting a share of
  edge wells (Sophie's question).
- Saving and reloading inputs: save the full inputs (condition list in order, fixed wells, contents,
  overrides, filler, seed) with the results, so a plate can be recreated by loading them rather
  than retyping. Avoids accidental changes from reordering conditions or changing replicate counts.
- Celigo labeling: probably not needed as a separate tool. The "well → contents" list can be pasted
  next to a Celigo export in Excel, as long as the export lists one row per well, in the same order,
  with the same well names (`A1`, not `A01`). If it doesn't, a small option in the randomizer's copy
  text (such as leading zeros) may be enough. Andy to check a real Celigo export.

## Next goal: Biomek output for the randomizer
Turn a randomized plate into Transfer From File files, so nobody edits Biomek files by hand. In Exp37
that file-making was the hardest and most error-prone part (`docs/domain/exp37.md`).

Why this comes before the transfer designer: most of what it needs, the designer needs too.

| Piece | Biomek output | Transfer designer |
|---|---|---|
| Transfer list: from which well, to which well, how much | needed | needed |
| Biomek file writer: transfer list → Transfer From File file | needed | needed |
| Method description: labware names and positions, which steps read which files | needed | needed |
| Randomizer link: one transfer per replicate, from each condition's source | needed | — |
| Labware types with well volumes | — | needed |
| Volume tracking | — | needed |
| Drag-and-drop page | — | needed |

For the randomizer this is a new output, with its current lists unchanged, so it would be a MINOR
release (0.2.0).

**Open decision: which Biomek method reads the files?** A file only works with a method built to
read it: the same labware names, positions and steps (`docs/domain/biomek.md`). Options:
- **A. Exp37's method as it is.** Quickest and proven on the instrument, but only helps experiments
  set up exactly like Exp37.
- **B. One general method with a standard deck.** Someone builds and tests it once in Biomek
  Software; the tool already knows its labware and positions, so users type nothing about the
  method. Experiments must fit the standard deck.
- **C. A method per experiment.** The user builds each method in Biomek Software as usual and tells
  the tool its labware names and positions. Most flexible, but more typing, with room for a typo
  that doesn't match the method.

Recommended so far: **C, with saved method descriptions.** Describing a method once and saving it
means repeating that kind of experiment needs no typing, which is what B gives; a standard deck, if
the lab settles on one, is then just one saved description. This also follows CLAUDE.md's
"no hard-coded configuration". Not decided yet: Andy was unsure about the difference between B and
C, which needs explaining again.

Not an option: having the tool **write the Biomek method itself**. The method file's format isn't
documented and Script steps aren't supported for end users (`docs/domain/biomek.md`), so the tool
writes only the documented Transfer From File files, and methods are built in Biomek Software.

First step once decided: a specification for the method description, starting from a real method
(Exp37's Transfer From File and Worklist settings).

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

## Ideas not yet planned
- **Checking a method with dye.** Every well's contents are the sum of the transfers into it, so a
  tool could predict what a plate reader should see when some sources are dyed, and compare that
  with the real reading. This would check any method, both how much went where and whether it went
  to the right well, without designing a new test each time. It builds on the transfer list and
  volume tracking.

## Open decisions
- **Which Biomek method reads the files** (see "Next goal" above).
- **Very large plates**: `WellGrid` allows at most 26 rows (A–Z). 1536-well plates (rows A–AF)
  would need a specification change.
