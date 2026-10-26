# Roadmap

Where the project is headed. This is a plan, not a specification: nothing here is built until it has
a specification (`name.md`) and Andy has approved it. Decisions are recorded as ADRs in `docs/adr/`.

Last updated: 2026-10-26

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
- **The `input-checks` shared module is built** (code and tests), against its specification
  (`src/shared/input-checks/input-checks.md`). `operation-list` now uses it, so `contents-tracking`
  can share the same checks.
- **The `contents-tracking` shared module is built** (code and tests), against its specification
  (`src/shared/contents-tracking/contents-tracking.md`; formerly "volume tracking"). A preview of the
  transfer designer with contents tracking and a timeline exists (not in the repository).
- **Decided: how stages are stored** (ADR 0008, 2026-10-23). Each transfer names its stage by a
  hidden ID; a stage list holds each stage's ID, name (names may repeat) and settings; the operation
  list keeps each stage's transfers consecutive and stays the one source of truth for order.
- **`operation-list` now has stages** (code and tests), against its specification: every
  transfer names its stage, `add` places it by stage, `insertBeforeStage`, `remove`, the stage rule
  and `groupByStage()`.
- **The `stage-list` shared module is built** (code and tests), against its Draft specification
  (`src/shared/stage-list/stage-list.md`): each stage's ID, name and settings, and the IDs
  transfers use. Sources and destinations each have their own technique and liquid type
  (ADR 0007, amended).
- **Decided: configuration files are JavaScript modules holding data only** (ADR 0009,
  2026-10-23), with sources in comments, checked by the tests of the module that uses them.
- **Decided: labware types aren't stage settings** (Andy, 2026-10-23; ADR 0007 amended). Each
  labware's type is stated once, in a deck description in `config/` (item 5 of v0.2.0), so a stage
  can't disagree with the labware its transfers use.
- **`well-grid` now has numbered grids** (code and tests), for reservoirs: the `naming` option and
  `GRID_1X12_NUMBERED`, the 12-well reservoir's grid (item 2 of v0.2.0, below).
- **Tested on the instrument, 2026-10-22:** Transfer From File file quirks and speed
  (`biomek.md`). With one probe, row-by-row and Transfer From File take the same time; 8 probes were
  about 5 times faster.
- **The transfer designer preview has been shaped with Andy** (2026-10-24 to 2026-10-26; not in the
  repository). Its decisions are being written into the repository one pull request at a time,
  starting with the glossary: new terms component, labware label, pipetting mode, plan file,
  substage and tip change; plan and stage revised (tips are no longer part of a stage).
- **ADR 0007 amended (2026-10-26):** a stage may mix labware types, and the file writer splits it
  into substages, one stage-worklist row each; tip changes are stage-worklist rows of their own,
  chosen by one If step (Then: change tips; Else: Transfer From File).
- **`stage-list` specification revised (2026-10-26):** a stage has five settings; `tipType` and
  `changeTipsFirst` are gone, since tips are the plan's tip changes. The code and tests still have
  seven settings until they're changed to match.
- **Decided: plans are saved as files** (ADR 0010): JSON with a format name and version number,
  checked through the same rules as edits when opened; stages are renumbered on opening. The page
  also keeps a browser copy, brought back when it opens. Saving and opening plans is part of the
  designer page (item 6), no longer "Later".
- **The transfer designer's logic is split into four modules** (Andy, 2026-10-26), one topic each:
  `deck` (shared: the deck description), and, in the tool, `plan-history` (undo and redo),
  `plan-file` (saving and opening) and `transfer-designer` (the plan and its rules). Their
  specifications come one at a time: `deck` (`src/shared/deck/deck.md`), then `plan-history`
  (`src/tools/transfer-designer/plan-history.md`).
- **`operation-list` specification gains `replace`** (2026-10-26): one operation swapped for
  another in the same stage, sharing every other stored operation, so changing a volume doesn't copy
  the whole list into each undo state (`plan-history.md`: about 13 MB at its limit with sharing, 156
  MB without, for a 1,000-transfer plan). The code doesn't have it yet.
- **`transfer-designer` specification written** (Draft, 2026-10-26;
  `src/tools/transfer-designer/transfer-designer.md`): the plan and every edit to it, from the
  preview. Tip changes are entries in the plan, not operations. The "stage order" includes stages
  without transfers; ADR 0008's run order is still only the stages with transfers. New glossary terms: stage order,
  tip group. Not built yet.
- **`plan-file` specification written** (Draft, 2026-10-26;
  `src/tools/transfer-designer/plan-file.md`): what a plan file holds (format version 1), and the
  checks on opening one, in order. Stage IDs are renumbered on opening. Not built yet.
- **Working towards v0.2.0**, the transfer designer's first lab use, for Exp36: see below.

## v0.2.0: the transfer designer, for Exp36
Goal: the transfer designer's first lab use, for Exp36, on 2026-10-26. Planned on 2026-10-22.

**How we work towards it**
- `main` stays the one source of truth, with one small branch per task, merged quickly.
- Specifications written for v0.2.0 say **Draft** at the top (CLAUDE.md), and every shortcut goes in
  "Technical debt", below.
- Once PR #29 is merged, `main` gets the tag **`pre-v0.2.0`**: a bookmark of the project before the
  rushed work, not a release.
- The version the lab runs is released as **v0.2.0** (a tag and a GitHub Release).
- A new idea goes under "Later" by default, unless it blocks the Exp36 run.

**Needed for v0.2.0**, in order:
1. **`contents-tracking`**: finish the specification (errors and test cases), then code and tests, so
   overdraws are caught before files are written. *Done 2026-10-23.*
2. **Reservoirs in `well-grid`**: numbered positions (`1`, `2` …) as well as letter-number names,
   as ADR 0001 anticipated, so reservoirs can be drawn and checked. (The operation list and contents
   tracking already accept any well name.) *Done 2026-10-23.*
3. **Stages** (ADR 0008): in `operation-list` (specification first), a `stage` property on
   transfers, `add` placing each transfer by its stage, `insertBeforeStage`, `remove`, the stage
   rule checked as transfers are added, and grouping transfers by stage; and a new `stage-list` module holding each stage's ID, name and settings. *Done 2026-10-23.*
4. **A short technique list** in `config/`: the two or three techniques the lab uses. The page's
   settings menus use it. *Decided 2026-10-23:* just a list of names in `config/techniques.js`
   (ADR 0009), with no module of its own; the designer's logic module checks the names in its
   tests. Stand-ins for now (see "Technical debt"). *Also decided 2026-10-23:* a list of liquid
   type names in `config/liquid-types.js`, the same way, so liquid types are chosen from a menu
   too; its test also checks Biomek's naming rule (letters, digits and underscores, starting with
   a letter; B56358AF 9-4). *Changed 2026-10-26:* both lists are replaced by
   `config/pipetting-modes.js`, which names each pipetting mode with its technique and liquid type,
   and `config/tip-types.js` lists the tip types (`transfer-designer.md`, "Configuration").
5. **A deck description** in `config/`: each labware on the standard deck, with its name (exactly
   as in the general-purpose method), its grid (`GRID_96` or `GRID_1X12_NUMBERED`) and its labware
   type. The page draws the labware from it, and the file writer looks up labware types in it.
   Its names and types are stand-ins for now (see "Technical debt").
6. **The designer page**, built from the preview: plates and a reservoir (drawn as numbered
   troughs), from the deck description; entering starting volumes, building stages, and choosing
   each stage's settings. Its undo must clear the redo history whenever a new edit follows an
   undo, because a stage's ID can come back after undo (`stage-list.md`, "IDs"); the page's
   specification says so. It comes before the file writer so that
   building stages on the page can shape the file writer's specification.
7. **The file writer**: the operation list becomes a setup worklist, a stage worklist and one
   Transfer From File file per stage (ADR 0007), with look-ahead tip loading and volumes rounded to
   3 decimal places. It splits each stage into substages, one row each (each Transfer From File
   file has one source and one destination labware type: Biomek requires it, B56358AF 22-13),
   looking up each labware's type in the deck description, and writes tip changes as rows of
   their own (ADR 0007, amended 2026-10-26). It adds the page's button for writing the files.
8. **The general-purpose method** built on the Biomek (ADR 0007), with a reservoir on the standard
   deck; the tool's own files run in simulation, then one real run with water. Tests to run first
   (see "Not yet known" in `biomek.md`): labware types from variables in Transfer From File (if not,
   one Transfer From File step per combination of labware types, chosen by If steps); per-trough
   starting volumes from the setup file; 8 probes drawing from one trough together; and what
   Biomek does with an unknown liquid type name from `=LiquidType`; and separate technique and
   liquid type variables in Transfer From File's source and destination configurations; and empty
   transfer columns on tip-change rows.

Rough schedule: Friday 1 to 7 if time allows; Saturday the rest; Sunday 8, at the Biomek. Setting up a volume
variable for every well of the standard deck is slow clicking work, so leave time for it.

**Later** (after v0.2.0):
- Mixing (see "Open decisions").
- The timeline (see "Contents tracking").
- Final concentrations.
- Editing the list further: moving a stage, or a transfer within its stage.
- Labware types with well capacities, to warn about overfilling.
- Biomek output for the randomizer (the randomizer link).
- The full technique table, from the Technique Browser.
- **Smarter staging:** the tool works out which transfers really depend on each other, reorders the
  independent ones, and forms as few stages as possible, so the user no longer builds stages.
- **Resuming after an interruption** (power loss or Abort; Biomek can't continue a method from where
  it stopped). The tool reads Biomek's Span8Transfer log to see which transfers were done, uses
  contents tracking to work out what every well should hold, and writes a restart: a new setup file
  with the corrected starting volumes, and the remaining transfers. First, test on the instrument
  that the log is written as the run goes (see "Not yet known" in `biomek.md`), and how a
  light-curtain break and an Abort behave.

## Technical debt
Shortcuts taken knowingly, each with what doing it properly would mean.
- **Users build stages by hand** (v0.2.0). Properly: smarter staging (see "Later").
- **The stage rule is simple:** within one stage, no well may be both a source and a destination;
  the operation list refuses a transfer that breaks it, with a message saying why. It is stricter than needed (it
  separates transfers even when their order wouldn't matter), which costs some side-by-side work at
  each stage boundary. Properly: smarter staging.
- **The pipetting modes cover only the lab's current techniques** (`config/pipetting-modes.js`,
  which replaced the technique and liquid-type lists on 2026-10-26). Properly: the full table.
- **The pipetting modes' technique and liquid-type names are stand-ins** (v0.2.0, 2026-10-23).
  Before the first run, replace them with the real names from Biomek Software's Technique Browser
  and Liquid Type Editor.
- **Techniques aren't checked against tip types** (v0.2.0, 2026-10-23). The tool treats every
  technique as usable with every tip type. Biomek doesn't check this either (`biomek.md`), so until
  it's built, the user chooses a technique that suits each stage's tips. Properly: each pipetting
  mode records the tip types its technique suits, and the page and the file writer check them
  (ADR 0007).
- **The deck description's labware names and types are stand-ins** (v0.2.0, written 2026-10-23
  before checking Biomek Software). Before the first run, replace them with the real names from the
  general-purpose method and the real labware types from Biomek Software.
- **Overdraws within a stage are found in the planned order** (v0.2.0, 2026-10-26). Within a
  stage the Biomek chooses its own order (B56358AF, 22-25), but contents tracking replays the
  planned order. When a stage draws from an overdrawn well more than once, which of its transfers
  runs short is one possible outcome, not certain; the stage with the overdraw is certain. Properly:
  report an overdraw by stage and well, not by transfer (`transfer-designer.md`, "Not in version 1").
- **Dead volume isn't modelled.** A reservoir trough holds liquid a tip can't reach (2 mL in Exp37,
  `exp37.md`). For v0.2.0, the user enters a reservoir's starting volume minus its dead volume.
  Properly: dead volume per labware type, in contents tracking (it's under "Not in version 1" in its
  specification).

## Done
- **`well-grid`** (shared module): the grid of well positions on labware — listing wells, validating
  well names, converting between names and row/column, edge wells. Grids name their wells
  letter-number (`A1`) or, for reservoirs, by number (`1`); `GRID_1X12_NUMBERED` is the 12-well
  reservoir's grid. See `src/shared/well-grid/well-grid.md`.
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
- **`input-checks`** (shared module): checks that several modules need to run on their input, such as
  whether a value is an object with the right properties, and whether a name or volume is valid.
  Moved out of `operation-list` so other modules can use them. See
  `src/shared/input-checks/input-checks.md`.
- **`contents-tracking`** (shared module): replays an operation list's transfers from the starting
  contents to work out each well's components in µL, after any number of operations, and reports
  transfers that take more than their source holds and the wells they affect. See
  `src/shared/contents-tracking/contents-tracking.md`.
- **`stage-list`** (shared module): the stages of a plan, each with its ID, name and settings
  (technique and liquid type at the sources and at the destinations, tip type, probes, whether to
  change tips first); it makes the IDs that transfers name their stage by (ADR 0008). See `src/shared/stage-list/stage-list.md`.
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
*Priority changed on 2026-10-22: v0.2.0 builds the transfer designer first, and the
randomizer link is under "Later". The shared pieces below are the same.*

Turn a randomized plate into the files the Biomek runs, so nobody edits Biomek files by hand. In Exp37
that file-making was the hardest and most error-prone part (`docs/domain/exp37.md`).

Most of what it needs, the designer needs too (table below), so after v0.2.0 it can reuse those
pieces.

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
release (a version after v0.2.0).

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
- **Possible contamination.** Hover a well to see every well that could have contaminated it.
  "Could" means any way a well's contents could conceivably reach another: a tip carries whatever it
  touches to every well it enters afterwards, until it's changed. That includes aspirating from an
  empty well, and dispensing into a well when the tip touches the liquid. It works both ways: a used
  tip can contaminate the source it aspirates from. This follows tips, not liquid, so it's a separate
  module from contents tracking, and it needs stages and their tip-change setting. Within a stage the
  order isn't fixed and the Biomek chooses which probe does which transfer, so it must assume every
  well the stage touches could contaminate every other one. Whether a dispense touches the liquid
  depends on the technique (see "Not yet known" in `docs/domain/biomek.md`). It could spread through
  the wells the way contents tracking's `causes` do.

## Open decisions
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
  see `biomek.md`). Ideally live, as operations are entered, so a wrong sequence is caught before
  it's built. Where these checks live is undecided. (The stage rule is decided: `operation-list`
  checks it in `add`.)
- **A programming interface from Beckman**: Andy is asking whether one exists. If it does, ADR 0006's
  option 3 would be reconsidered.
- **Very large plates**: `WellGrid` allows at most 26 rows (A–Z). 1536-well plates (rows A–AF)
  would need a specification change.
