# Roadmap

Where the project is headed. This is a plan, not a specification: nothing here is built until it has
a specification (`name.md`) and Andy has approved it. Decisions are recorded as ADRs in `docs/adr/`.

Last updated: 2026-10-22

## Where things stand
- The randomizer is released as **v0.1.0** (GitHub Releases; see `CHANGELOG.md`). Version numbers
  starting with 0 mean it may still change, for example to work with the next tool.
- **Proposed: ADR 0006** (amending ADR 0005): the tool defines the whole method. Experiments run as
  a worklist the tool writes, for **one general-purpose method** built once in Biomek Software, whose
  steps take their settings from the worklist's columns. Andy is asking Beckman whether they offer a
  programming interface (API).
- **Tested in simulation, 2026-10-21:** what a worklist row can control (`docs/domain/biomek.md`,
  "Worklist-driven steps"). Almost everything the tool needs works. ADR 0006 and the new
  **ADR 0007** (standard deck, setup worklist, one Transfer From File file per stage,
  look-ahead tip loading) are ready for Andy to accept.
- **The `operation-list` shared module is built** (code and tests), against its specification
  (`src/shared/operation-list/operation-list.md`).
- **In progress: the `contents-tracking` specification** (formerly "volume tracking"). Sections 1–4
  are drafted on the `contents-tracking` branch; errors and test cases are still to write. A preview
  of the transfer designer with contents tracking and a timeline exists (not in the repository).
- **Tested on the instrument, 2026-10-22:** Transfer From File file quirks and speed
  (`biomek.md`). With one probe, row-by-row and Transfer From File take the same time; 8 probes were
  about 5 times faster.
- **Working towards the Monday version** (v0.2.0), the transfer designer's first lab use: see below.

## The Monday version (v0.2.0)
Goal: the transfer designer in lab use on Monday, 2026-10-26. Planned on 2026-10-22.

**How we work towards it**
- `main` stays the one source of truth, with one small branch per task, merged quickly.
- Specifications written for Monday say **Draft** at the top (CLAUDE.md), and every shortcut goes in
  "Technical debt", below.
- Once PR #29 is merged, `main` gets the tag **`pre-monday`**: a bookmark of the project before the
  rushed work, not a release.
- The version the lab runs is released as **v0.2.0** (a tag and a GitHub Release).
- A new idea goes under "Later" by default, unless it blocks a Monday lab run.

**Needed for Monday**, in order:
1. **`contents-tracking`**: finish the specification (errors and test cases), then code and tests, so
   overdraws are caught before files are written.
2. **The file writer**: the operation list becomes a setup worklist, a stage worklist and one
   Transfer From File file per stage (ADR 0007), with look-ahead tip loading and volumes rounded to
   3 decimal places. It refuses a stage that breaks the stage rule (see "Technical debt").
3. **The designer page**, built from the preview: entering starting volumes, building stages, and
   choosing each stage's settings.
4. **A short technique list** in `config/`: the two or three techniques the lab uses.
5. **The general-purpose method** built on the Biomek (ADR 0007), the tool's own files run in
   simulation, then one real run with water.

Rough schedule: Friday 1 and 2; Saturday 3 and 4; Sunday 5, at the Biomek. Setting up a volume
variable for every well of the standard deck is slow clicking work, so leave time for it.

Before 2 and 3: decide where a stage's settings are stored (see "Open decisions").

**Later** (after Monday):
- Mixing (see "Open decisions").
- The timeline (see "Contents tracking").
- Final concentrations.
- Saving and loading plans.
- Editing the list: inserting, removing and undo.
- Labware types with well capacities, to warn about overfilling.
- Biomek output for the randomizer (the randomizer link).
- The full technique table, from the Technique Browser.
- **Smarter staging:** the tool works out which transfers really depend on each other, reorders the
  independent ones, and forms as few stages as possible, so the user no longer builds stages.

## Technical debt
Shortcuts taken knowingly, each with what doing it properly would mean.
- **Users build stages by hand** (Monday version). Properly: smarter staging (see "Later").
- **The stage rule is simple:** within one stage, no well may be both a source and a destination;
  the tool refuses a stage that breaks it, with a message saying why. It is stricter than needed (it
  separates transfers even when their order wouldn't matter), which costs some side-by-side work at
  each stage boundary. Properly: smarter staging.
- **The technique list holds only the lab's current techniques.** Properly: the full table.

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
- **`operation-list.md`**: the specification for the operation list, an ordered, immutable list of
  operations (version 1: transfers only), the single source of truth for Biomek output, volume
  tracking and the transfer designer. See `src/shared/operation-list/operation-list.md`.
- **`operation-list.js`**: the operation list's code and tests.
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

## Biomek output for the randomizer
*Priority changed on 2026-10-22: the Monday version builds the transfer designer first, and the
randomizer link is under "Later". The shared pieces below are the same.*

Turn a randomized plate into the files the Biomek runs, so nobody edits Biomek files by hand. In Exp37
that file-making was the hardest and most error-prone part (`docs/domain/exp37.md`).

Why this comes before the transfer designer: most of what it needs, the designer needs too.

| Piece | Biomek output | Transfer designer |
|---|---|---|
| Operation list: every transfer (from which well, to which well, how much), later tip changes | needed | needed |
| Biomek file writer: operation list → worklist and the files it names | needed | needed |
| General-purpose method, built once in Biomek Software, and its description | needed | needed |
| Randomizer link: one transfer per replicate, from each condition's source | needed | — |
| Labware types with well volumes | — | needed |
| Contents tracking | — | needed |
| Drag-and-drop page | — | needed |

For the randomizer this is a new output, with its current lists unchanged, so it would be a MINOR
release (0.2.0).

**Decided: any method, described to the tool (ADR 0005).** Options considered were Exp37's method
only (A), one general method with a standard deck (B), and any method described to the tool (C). C
was chosen, with descriptions saved and loaded, so B stays possible as one shared description.
Generating the method itself was ruled out: its file format isn't documented and Script steps aren't
supported for end users.

**Proposed: ADR 0006, one general-purpose method, driven by a worklist.** The tool should define the
whole method, including tip changes. Within the limits above, the plan is one method built once in
Biomek Software: a Worklist loop whose steps take their settings from the worklist's columns. The
tool writes the worklist, which becomes the experiment's method. Generating the method's `.json`
file is not pursued for now; scripting Biomek Software's interface is ruled out; a Beckman
programming interface would be reconsidered if one exists.

**Method description.** It now mainly describes the general-purpose method. A first sketch of what it
holds (written before ADR 0006; to revisit):
- the labware the method uses: each name exactly as in the method, and its wells (so the tool can
  catch a well that doesn't exist before the Biomek does);
- which Transfer From File steps read files, and which transfers go in each (by condition, by
  reagent, or kept in order through a worklist) — the hardest part to describe in general;
- where the files go on the Biomek PC and how they are named; worklists need full paths.

It is saved as a file (likely JSON) kept with the Biomek method, and holds nothing about an
experiment's contents. Deck positions are probably unnecessary, because files can name labware
instead. The specification decides all of this.

## Transfer designer
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

## Contents tracking
Called "volume tracking" before 2026-10-20; renamed because it tracks every component in a well, not
just its volume. Specification in progress (see "Where things stand").

Show what each well will contain after a series of transfers, and warn about problems such as
overfilling a well or drawing more than it holds.
- Proposed design: **replay**. Keep the starting layout and the operation list, and compute the
  current state by applying its transfers in order, rather than keeping an object that changes.
  This is a pure function and easy to test, works with undo of any edit (the operation list is
  immutable, so earlier versions stay as they were), and keeps the operation list as the single
  source of truth — the same list that becomes the Biomek files.
- **A timeline** (idea): step through the plan and see every well's contents after any transfer.
  The draft specification already allows it (contents after any number of operations).
- Well capacities come from the labware types.

## Ideas not yet planned
- **Checking a method with dye.** Every well's contents are the sum of the transfers into it, so a
  tool could predict what a plate reader should see when some sources are dyed, and compare that
  with the real reading. This would check any method, both how much went where and whether it went
  to the right well, without designing a new test each time. It builds on the operation list and
  contents tracking.
- **Hand-pipetting plans.** The operation list doesn't depend on the Biomek, so it could also
  describe an experiment done by hand. Contents tracking would show each well's volume and
  concentrations, and a "pipette this, then this" sheet would be one more output from the same list.
  Existing plate-map tools let you label wells, but don't calculate their contents from the planned
  steps.

## Open decisions
- **Where a stage's settings are stored** in the operation list (to decide before the file writer
  and designer specifications). A stage's settings are its liquid type, technique, tip type, probes,
  and whether tips are changed first. Options discussed on 2026-10-22:
  1. **One set of settings for the whole plan,** chosen on the page. Quickest, but one technique for
     everything; per-stage settings or mixing later would need a redesign. Doesn't fit user-built
     stages.
  2. **Settings stored on each operation** (or each operation naming its stage), with the file
     writer grouping neighbouring operations with the same settings into stages. A little more work
     now, and a small change to the `operation-list` specification, but inserting, undo, the timeline
     and mixing all work naturally.
  3. **Separate "stage" entries in the list** that apply to the operations after them. Compact, and
     close to how the user builds stages, but inserting or moving an operation can silently change
     its settings.

  Recommended: 2. That recommendation was made before stages became user-built, which makes 3 look
  closer to the page, so it's worth weighing both again when deciding.
- **Mixing** (Later; noted 2026-10-22): the tools will need to mix wells. Andy's Biomek Software has no
  separate Mix step for the Span-8, so it has to be done another way. Options to look at: a transfer
  from a well back into the same well (the operation list already allows this), or a technique's
  mix settings in Transfer From File (Exp37 used "aspirate mix 75 µL × 2"; `exp37.md`). How mixing
  is represented in the operation list is part of this.
- **Accept ADR 0006 and ADR 0007?** The simulation tests of 2026-10-21 answered the question
  ADR 0006 was waiting on (what a worklist row can vary). Andy to decide.
- **Working rule:** each setting is controlled in one place, either the worklist or the
  general-purpose method, never both, so the tool never shows one plan while the Biomek follows
  another. ADR 0007 puts liquid type, technique, tip type, probes and tip changes in the worklist.
- **How operations are checked against labware and techniques**, such as whether a well exists on
  the named labware, a volume fits in it, a technique suits its tip type (Biomek doesn't check this;
  see `biomek.md`), or a stage follows the stage rule. Ideally live, as operations are entered, so a
  wrong sequence is caught before it's built. Where the check lives is undecided; `operation-list`
  doesn't do it.
- **A programming interface from Beckman**: Andy is asking whether one exists. If it does, ADR 0006's
  option 3 would be reconsidered.
- **Very large plates**: `WellGrid` allows at most 26 rows (A–Z). 1536-well plates (rows A–AF)
  would need a specification change.
