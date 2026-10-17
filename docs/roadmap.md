# Roadmap

Where the project is headed. This is a plan, not a specification: nothing here is built until it has
a specification (`name.md`) and Andy has approved it. Decisions are recorded as ADRs in `docs/adr/`.

Last updated: 2026-10-17

## Done
- **`well-grid`** (shared module): the grid of well positions on labware — listing wells, validating
  well names, converting between names and row/column, edge wells. See
  `src/shared/well-grid/well-grid.md`.
- **Project setup**: ES modules, `npm test` (Node's built-in test runner), `npm run repl`.

## Next: the randomizer
A general version of the Exp37 plate randomizer (`randomizer_V2.xlsx`), built as modules.

Expected for version 1 (to be confirmed in `randomizer.md`):
- Paste an organized plate layout from Excel.
- Choose which wells stay fixed and which are shuffled; "fix the outer ring" as a preset
  (built on `isEdgeWell`). Contents never decide whether a well moves; only its position does.
- Seeded shuffle, so the same seed and layout always give the same result.
- Outputs: the randomized layout and a well key in both directions (where each well came from and
  where it went).

Later, as separate modules:
- Several plates: one pattern for all plates, or a new shuffle per plate.
- Constrained shuffles, e.g. each condition once per quadrant, or each condition getting a share of
  edge wells (Sophie's question).
- Celigo labeling: label a pasted Celigo export with each well's contents.
- Biomek Transfer From File CSV to move samples from the organized plate to the randomized one.

Shared modules it needs:
- **`layout`**: what is in each well of a grid. Contents should be designed so they can later carry
  volumes and mixtures (see volume tracking below), even if version 1 only needs text labels.
- **`random`**: seeded random numbers that give the same sequence on any computer.

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
