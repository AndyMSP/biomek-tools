# Roadmap

Where the project is headed. This is a plan, not a specification: nothing here is built until it has
a specification (`name.md`) and Andy has approved it. Decisions are recorded as ADRs in `docs/adr/`.

Last updated: 2026-11-01

## Where things stand
- The randomizer is released as **v0.1.0** (GitHub Releases; see `CHANGELOG.md`). Version numbers
  starting with 0 mean it may still change, for example to work with the next tool.
- **Accepted: ADR 0006** (amending ADR 0005) **and ADR 0007** (Andy, 2026-10-28): the tool defines
  the whole method. Experiments run as files the tool writes, for **one general-purpose method** built
  once in Biomek Software, whose steps take their settings from the files: a setup worklist, a stage
  worklist, and one Transfer From File file per substage. Andy is asking Beckman whether they offer a
  programming interface (API).
- **Tested in simulation, 2026-10-21:** what a worklist row can control (`docs/domain/biomek.md`,
  "Worklist-driven steps"). Almost everything the tool needs works. These tests shaped
  **ADR 0007** (standard deck, setup worklist, stage worklist, look-ahead tip loading).
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
  chosen by one If step (Then: change tips; Else: Transfer From File). (The method as built uses
  separate If steps instead; ADR 0007 was rewritten on 2026-10-27, below.)
- **`stage-list` specification revised (2026-10-26):** a stage has five settings; `tipType` and
  `changeTipsFirst` are gone, since tips are the plan's tip changes. The code and tests now match:
  five settings, and settings still giving `tipType` or `changeTipsFirst` are refused as extra
  settings.
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
  MB without, for a 1,000-transfer plan). The code and tests now match: `replace`, and every edit
  shares the unchanged stored operations.
- **`transfer-designer` specification written** (Draft, 2026-10-26;
  `src/tools/transfer-designer/transfer-designer.md`): the plan and every edit to it, from the
  preview. Tip changes are entries in the plan, not operations. The "stage order" includes stages
  without transfers; ADR 0008's run order is still only the stages with transfers. New glossary terms: stage order,
  tip group.
- **Decided: the plan keeps its stage order in a list** (ADR 0011, 2026-10-26), `stageOrder`,
  replacing `plannedBefore`, whose notes for stages without transfers needed a new rule each time a
  bug was found (three on 2026-10-26). The operation list's blocks follow the list. Specifications
  changed: `transfer-designer.md` and `plan-file.md` (a file holds its stages in stage order). The
  `transfer-designer` code and tests now match: `stageOrder` replaces `plannedBefore`, and the
  tests check after every kind of edit that the operation list's blocks follow it.
- **`plan-file` specification written** (Draft, 2026-10-26;
  `src/tools/transfer-designer/plan-file.md`): what a plan file holds (format version 1), and the
  checks on opening one, in order. Stage IDs are renumbered on opening. Not built yet. *Tightened
  2026-10-26* (found by Claude Code before building): starting contents with a 0 volume or a well
  holding nothing are refused, and labels are checked as a whole table with the transfer designer's
  new `setLabels`, so a file with swapped labels opens. *`setLabels` is built* (code and tests).
- **Transfer designer page specification written** (Draft, 2026-10-26;
  `src/tools/transfer-designer/transfer-designer-page.md`), from the preview: the whole screen, its
  messages, and two new config files (`component-colors.js`, `default-volumes.js`). Display rules
  stay in the page and are checked by hand, as for the randomizer. Not built yet.
- **The `deck` shared module is built** (code and tests), against its Draft specification
  (`src/shared/deck/deck.md`): labware names, grids and labware types from `config/deck.js`,
  checking wells and listing the wells in a box. Its tests also check `config/deck.js` (ADR 0009).
- **The `plan-history` module is built** (code and tests), against its Draft specification
  (`src/tools/transfer-designer/plan-history.md`): the transfer designer's undo and redo, immutable
  like the operation list, keeping at most `UNDO_STATES_KEPT` (1,000) earlier states from
  `config/undo.js`. Its tests also check `config/undo.js` (ADR 0009).
- **The `transfer-designer` module is built** (code and tests), against its Draft specification
  (`src/tools/transfer-designer/transfer-designer.md`): the plan and every edit to it, the stage
  order, tip groups and overdraws. Its configuration is built too: `config/pipetting-modes.js` (four
  stand-in modes, made real on 2026-10-28; default Medium) and `config/tip-types.js` (BC230, BC1070), which its tests check
  (ADR 0009). `config/techniques.js` and `config/liquid-types.js` are removed.
- **The `plan-file` module is built** (code and tests), against its Draft specification
  (`src/tools/transfer-designer/plan-file.md`): `planToText` and `planFromText`, with every check
  on opening in the specification's order. It builds the opened plan through the transfer
  designer's own edits, so a file is checked by the same rules as editing.
- **The transfer designer page is built** (2026-10-26), against its Draft specification
  (`src/tools/transfer-designer/transfer-designer-page.md`): `transfer-designer.html`,
  `transfer-designer.css` and `transfer-designer-page.js`, with the two configuration files
  `config/component-colors.js` and `config/default-volumes.js`, which its tests check (ADR 0009).
  `npm run build` now makes `dist/transfer-designer.html`. Andy hasn't tested it yet, so the
  specification stays Draft (item 6 of v0.2.0, below).
- **Andy tested the built page** (2026-10-26) and kept its look, with 16 changes, each tried first
  in a preview: labware two to a row, a reservoir the same size as a plate, a second deep-well
  plate (`Deep2` in `config/deck.js`), a centered overdraw X and `+`, volumes on white labels, a
  clearer highlight, Enter moving to the next volume (the highlight locked to the volume being
  edited), tip counts on tip groups, tidier bars, `Show transfers` scrolling into view, a lost
  click after a volume or label box (a bug in the build), the overdraw message naming a transfer
  the edit caused, softer buttons in two groups (action and choice), softer key and colors, and
  bigger arrowheads. Written into `transfer-designer-page.md` (still Draft). Tried and dropped:
  folding the open card, and a white edge around the arrows. **Built 2026-10-26** in the three page
  files, and checked in headless Chrome (70 checks, including a window narrower than 1000px); Andy
  hasn't tested the build yet, so the specification stays Draft.
- **Two fixes from reviewing that build** (#75, 2026-10-26): clicking away from a label or volume
  box whose save is refused closes it and does nothing else, so the message saying why stays in
  view; and only a main-button press is passed on (a right click with a box open chose a well as a
  source).
- **The transfer designer page specification is Final** (2026-10-27): Andy tested the build with
  #74 and #75 (`transfer-designer-page.md`).
- **The general-purpose method is built and tested** (2026-10-27, Method6 to Method32;
  `biomek.md`, "Building the general-purpose method"): nested worklists, one If step for tip changes
  and one per pair of labware types (all nine built), a technique and liquid type at each end, and
  mixing from the stage worklist. Method31 ran for real, Method32 in simulation. **ADR 0007 was
  rewritten** to describe the method as built (2026-10-27). The method's 792 volume variables were
  set once by script; the scripts are kept as reference in the claude.ai project
  (`claude/bmf-scripts/`), not in the repository.
- **Decided: the file writer** (Andy, 2026-10-27) is a shared module, `src/shared/file-writer/`. It
  takes a plan, and each tool builds its own plan. Mixing isn't in its version 1.
- **The file writer specification is written** (Draft, 2026-10-28;
  `src/shared/file-writer/file-writer.md`): each run's files go in a folder of their own inside
  `C:\Users\Beckman Coulter\Desktop\Ento\` (`config/paths.js`), named by a timestamp and the
  experiment name; plans with overdraws are refused. **Built** (#86, 2026-10-28): code and tests,
  and `config/paths.js`. The page's Biomek files button isn't connected yet: how it saves the files
  (one zip, or the browser's folder picker) is still to be decided, and tried in a preview first.
- **Decided: the experiment name is part of the plan** (Andy, 2026-10-28, from the preview):
  shown as the page's heading and edited in place, undone like any edit, and saved in the plan
  file, which goes to format version 2 (version 1 files still open, with no name). Specifications
  changed: `transfer-designer.md`, `plan-file.md`, and `file-writer.md` (`writeRunFiles` now takes
  the name from the plan, so it's `writeRunFiles(plan, timestamp)`); new glossary term "Experiment
  name".
- **Decided: the Biomek files download as one zip** (Andy, 2026-10-28), holding the run's folder,
  built by our own small `zip` shared module (stored, uncompressed zips only; no dependency). Tried
  in a preview on Andy's own computer; still to try on the Biomek PC. The `zip` specification is
  written (Draft, `src/shared/zip/zip.md`). **Built** (#91, 2026-10-28): code and tests, matching
  the golden file `tests/fixtures/zip-two-files.zip` byte for byte. `zip.md` stays Draft until a zip
  it makes has been unzipped and run on the Biomek PC.
- **The page specification is updated** (Draft changes, 2026-10-28;
  `src/tools/transfer-designer/transfer-designer-page.md`), from the preview Andy shaped: the
  experiment's name as the page's heading, edited in place; the Biomek files box, showing the zip's
  name before it's written; both header boxes closing on a press outside them; no tool name on the
  page, only in the tab. **The experiment name is built** (#94, 2026-10-28): in the plan
  (`setExperimentName`), in plan files (version 2, still reading version 1), and read from the plan
  by the file writer (`writeRunFiles(plan, timestamp)`). Next, Claude Code builds the page (`zip` is
  built, #91). **The page is built** (#96, 2026-10-28): the experiment's name as the heading, the
  Biomek files box and the zip download, and both header boxes closing on a press outside them.
  Still to check by Andy: Write files through the save dialog in Edge or Chrome, and a zip
  unzipped and run in simulation on the Biomek PC (step 1 of the order, below). The page
  specification's changed sections stay Draft until then.
- **Decided: tip groups move to a shared module, `tip-groups`** (Andy, 2026-10-28), so the transfer
  designer and the file writer use one function. **Built** (#85, 2026-10-28): the function and its
  tests moved, with no change in behavior; the file writer uses it (#86). Its specification is
  Final (#99, 2026-10-29; `src/shared/tip-groups/tip-groups.md`).
- **Decided: the randomizer link joins v0.2.0** (Andy, 2026-10-27; item 9, below).
- **Decided: v0.2.0 grows** (Andy, 2026-10-28): it gains **mixing** and **well capacities with dead
  volume** (items 10 and 11, below), so each specification changes once and the Biomek is tested
  once, on the final files. The remaining work has an order (below).
- **The mixing preview is done** (2026-10-29 and 2026-10-30; its changes and decisions are in the
  claude.ai project, `claude/mixing-preview-changes.md`, until each goes to its place). It goes in
  in three chunks (Andy, 2026-10-30), each leaving `main` working: (1) page layout only, (2) probes
  chosen with the tips, (3) mixing, in layers. **Chunk 1's page specification is written** (Draft,
  2026-10-30; `transfer-designer-page.md`): an open stage's ✎ beside its name, and the stage's
  editing box as a grid (Aspirate and Dispense columns, a Mode row); merged (#103). **Built and
  merged** (#105, 2026-10-30), with two fixes from its review: the Stages column at least 348px
  wide, and no `Current` on open cards. Tagged **`pre-mixing`** (`e7ac830`, Andy, 2026-10-30): the
  version for the deferred simulation run (step 1 of the order below), since its Biomek files are
  the same as before the mixing work. **Chunk 2's specifications are written**
  (Draft, 2026-10-30): each tip change chooses its probes, and every stage until the next tip change
  uses all of them, replacing per-stage probes and look-ahead tip loading (ADR 0007 amended;
  glossary; `stage-list.md`, `tip-groups.md`, `transfer-designer.md`, `plan-file.md` with format
  version 3, `file-writer.md`, `transfer-designer-page.md`). Next, Claude Code builds it, in one
  pull request, since the modules change together. **Built** (#104, 2026-10-30): the code, tests
  and REPL of every module above; plan files are written as version 3 and versions 1 and 2 still
  open; checked in headless Chrome (42 checks). Andy tested the page in Chrome and merged it
  (2026-10-30); the changed specifications stay Draft until the files have run on the Biomek.
- **Chunk 3, layer (a), is specified** (Draft, 2026-10-30): each stage holds a mix for each end,
  `sourceMix` and `destinationMix` (share of the well, times, speed, or `null`), stored and saved but
  not yet offered on the page or written to files (ADR 0007, "Mixing"; glossary "Mix" and "Mix
  step"; `stage-list.md`; `transfer-designer.md`; `plan-file.md` with format version 4, older files
  opening with no mixing). A new stage copies its neighbor's settings, mixes included (Andy,
  2026-10-30). **Built** (#106, 2026-10-30): code, tests and REPL; plan files are written as version
  4 and versions 1 to 3 still open, with no mixing; the page carries a stage's mixes through when its
  editing box is saved. Next: layer (b), the file writer's mix columns and techniques, then (c), the page.
  **For layer (c), when mix steps arrive** (Andy, 2026-10-30): a new stage copies the nearest stage
  of its own kind, so a transfer stage copies a transfer stage and a mix step a mix step: the
  nearest before it, else the nearest after it, else the defaults (a transfer stage with no
  mixing; a mix step with the default mix).
  **For layer (b), from #106's review** (2026-10-30): (1) the stage list checks a mix's form only,
  so a plan file can hold a stage that mixes with a technique that doesn't (e.g. `Operation`), or
  the reverse; once `config/` names each mode's mixing technique, opening a file should refuse
  such a stage, as ADR 0007 says the stored technique is always the one Biomek gets. (2) A mix's
  `times` and `speed` have no upper limit, because Biomek's limits aren't known (only that 0 times
  is refused); to check at the instrument.
- **Mixing layer (b) is specified** (Draft, 2026-10-30): the Biomek files' mix columns, with one mix
  volume per row from the new `mix-volumes` shared module (substages move into a `substages` shared
  module); each mode's mixing technique in `config/`, `setStageMix` switching an end's mixing and
  technique together, and settings whose technique doesn't match their mixing refused (item (1)
  above); a mix that works out to 0 µL is a **mix problem** (since #110: under 1 µL), shown on the page as an overdraw is,
  and refused by the file writer (Andy, 2026-10-30). Item (2) above stays open. **For layer (c):**
  switching mixing on and off on the page, the default mix in `config/` (90% × 3 at 400 µL/s), mix
  steps, and the short-mix warning (40%). **At the Biomek:** a simulation run with files from a
  mixing plan, checking each row mixes the volume written, and how a 1 µL mix and a 1 µL transfer
  run (the minimum mix volume is 1 µL; Andy, 2026-10-30).
  **Built** (#109, 2026-10-30): code, tests and REPL of `substages`, `mix-volumes`, the transfer designer, the file writer and the page; checked in headless Chrome.
- **Mixing layer (c), the page, goes in two parts** (Andy, 2026-10-30): **(c1) mixing in transfer
  stages is specified** (Draft, 2026-10-30): a Mix checkbox for each end in a stage's box, giving
  `DEFAULT_MIX` (`config/mixing.js`); ⟳ after a mode on the stage's card; a ⟳ badge on each well
  the open stage mixes, yellow under `SHORT_MIX_SHARE` (40%); `Mixed N% of well` in the contents
  card; each well's mixed share from `mix-volumes`. **(c2) mix steps**, next, decided so far (Andy,
  2026-10-30): added with a ⟳ button beside each seam's `+`; a new stage copies the nearest stage of
  its own kind (above); each mixed well stored as a transfer into itself with a **1 µL placeholder**
  volume (whether the volume matters is to check at the Biomek); End's count leaves mix steps' wells
  out; a mix step's card has ⟳ after its name and no separate `⟳ Mixes` line.
  **(c2) is specified** (Draft, 2026-10-30): `addMixStep`, `isMixStep`, `mixWells`, `unmixWell`
  and the copying rule in the transfer designer; `MIX_STEP_MODE` and `MIX_STEP_VOLUME` in
  `config/mixing.js`; the page's ⟳ seam button, mix step cards and box, and mixing wells on the
  deck. Still open: an overdraw caused by a mix step's 1 µL draw is described as a transfer
  ("Transfer #5 asked for 1 µL…"); saying it's a mix would be clearer.
  **(c2) is built** (#112, 2026-10-30): code, tests and REPL of the transfer designer and
  `config/mixing.js`, tests for `mix-volumes`, the file writer and plan files, and the page's mix
  steps; checked in headless Chrome.
  **(c1) is built** (#110, 2026-10-30): `config/mixing.js`, each row's `mixedWells` in
  `mix-volumes`, `DEFAULT_MIX` in the transfer designer, and the page's Mix row, ⟳ and badges;
  checked in headless Chrome.
- **Decided: Claude starts Claude Code's builds itself** (Andy, 2026-10-30, after trying it on
  #106 to #112), as a background agent, then reviews them and notifies Andy (CLAUDE.md, "Who does
  what").
- **Chrome is enough for testing pages** (Andy, 2026-10-30): Edge is tried only if the lab ever
  needs it. CLAUDE.md's requirement ("Edge or Chrome") is met by Chrome.
- **Mixing is done** (2026-10-30, #106, #109, #110, #112): stages store their mixes, the Biomek
  files write them, and the page has Mix checkboxes, mix steps, ⟳ badges (yellow for a short mix,
  red for a mix problem) and the 1 µL minimum. Its specifications stay Draft until the files have
  run on the Biomek (see each layer's "At the Biomek" above).
- **Well capacities and dead volume are built** (#118, 2026-10-31; item 11): `config/labware-types.js`
  (grid, capacity and dead volume per labware type; stand-ins, "Technical debt"), contents
  tracking's three problem kinds and `usableVolumeOf`, the file writer's refusals, and the page's
  stripes, overfill bar and card lines. Andy tested the page and merged. The specifications stay
  Draft until the files have run on the Biomek.
- **Six page tweaks** (Andy, 2026-10-31, from using the #118 build; the next topic, branch
  `page-tweaks`): (1) a picked color swatch in a component's box keeps its color (it turned pale
  blue: a bug); (2) Remove in a stage's box removes at once, without the question, since Undo
  brings it back, and every other Remove works the same way; (3) the tip button on a tip group's
  last seam adds a new stage there with a tip change on it, the stage copying the one before it;
  (4) previews published to the preview artifact say `Preview: …` in the tab and route downloads
  through the artifact's save prompt (a preview habit, in CLAUDE.md); (5) a transfer row with a
  contents problem shows its volume in red, with a tooltip `Only 450 µL is reachable.` or
  `Overfills the well by 20 µL.`; (6) the contents card drops its total, usable and capacity
  lines altogether: the well, its components, then only problem and warning lines (holding only
  dead volume is neither; the problem lines carry the numbers). Tried in one preview (2026-10-31;
  Andy liked it), then specified and **built (#119)**.
- **Decided: the randomizer link (item 9) is randomizing inside the transfer designer** (Andy,
  2026-10-31 and 2026-11-01, from a preview he shaped), rather than the randomizer saving a plan file
  for the designer, writing Biomek files itself, or transfers entered by hand. It goes in as
  three topics, one pull request each: **seams**, **well names**, then **randomizations** (item 9,
  below, holds the decisions so far). Exp36 needs it, so it comes before the final Biomek runs
  (Andy, 2026-11-01). **Seams are specified** (Draft, 2026-11-01; branch `seams`): seams inside a
  tip group add with its tips, new seams between tip groups add with new tips
  (`transfer-designer-page.md`, section 7; `addStageWithNewTips` and `addMixStepWithNewTips` in
  `transfer-designer.md`; glossary "Seam").
- **Working towards v0.2.0**, the transfer designer's first lab use, for Exp36: see below.

## v0.2.0: the transfer designer, for Exp36
Goal: the transfer designer's first lab use, for Exp36. Planned on 2026-10-22; items 10 and 11
added on 2026-10-28 (Andy).

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
   *Real names and types since 2026-10-28*, with the real pipetting modes (`config/pipetting-modes.js`).
6. **The designer page**, built from the preview: plates and a reservoir (drawn as numbered
   troughs), from the deck description; entering starting volumes, building stages, and choosing
   each stage's settings. Its undo must clear the redo history whenever a new edit follows an
   undo, because a stage's ID can come back after undo (`stage-list.md`, "IDs"); the page's
   specification says so. It comes before the file writer so that
   building stages on the page can shape the file writer's specification.
7. **The file writer** (`src/shared/file-writer/`): a plan becomes a setup worklist, a stage
   worklist and one Transfer From File file per substage (ADR 0007), with look-ahead tip loading
   (replaced on 2026-10-30 by probes chosen with each tip change) and volumes rounded to 3 decimal
   places. It splits each stage into substages, one row each (each
   Transfer From File file has one source and one destination labware type: Biomek requires it,
   B56358AF 22-13), looking up each labware's type in the deck description, and writes tip changes
   as rows of their own (ADR 0007). It adds the page's button for writing the files.
8. **The general-purpose method** built on the Biomek (ADR 0007), with a reservoir on the standard
   deck. *Built and tested 2026-10-27* (`biomek.md`, "Building the general-purpose method"); the
   tests planned to run first are answered there, except whether 8 probes can draw from one trough
   together. Still to do: the tool's own files in simulation, then one real run with water. The
   files of a run that worked are kept as the file writer's golden files (`file-writer.md`,
   "Golden files"): a coverage plan first, Exp37 once plans can hold mixing.
9. **The randomizer link** (Andy, 2026-10-27, moved from "Later"): the randomizer's plates reach
   the Biomek without anyone editing Biomek files by hand. **Decided (Andy, 2026-10-31 and
   2026-11-01): randomizing becomes part of the transfer designer**, as a **randomization** in its
   Stages column, from a preview he shaped (not in the repository). Three topics, in order, each
   specification first, then a build and Andy's test:
   1. **Seams** (specified, Draft, 2026-11-01): see "Where things stand".
   2. **Well names.** Right-click a well (or the menu key, or Shift+F10, on a focused well) to name
      it, whatever card is open; a box under the well: Enter or clicking away saves (`Named Deep1 A4
      “Media stock”.`), Escape keeps the old name, an empty name removes it. A **Names** toggle
      beside Arrows (on by default): a named well shows its name in its volume's spot, wrapping at
      spaces onto two lines, a single word in slightly smaller type, cut with `…` if it still
      doesn't fit; a trough shows it upright. The contents card starts with the name (16px, bold),
      then the well, smaller and quieter; its last line says `Right-click to name` (or `to
      rename`). Transfer rows keep locations, not names (names can repeat). Names are part of the
      plan: undone, and saved in plan files.
   3. **Randomizations**, with an ADR recording why randomizing lives in the designer. Decided so
      far:
      - **Where:** added with a dice button (a small SVG of two dice) in the right spot of a seam
        between tip groups. A randomization sits in the list before it has run (a dashed box,
        `Randomize`, `not set up yet`) and after (a box around its stages, `Randomized`, `N stages ·
        seed S`), collapsing to its heading unless its card or one of its stages is open. Its card
        opens from the heading at any time; closing it keeps what was set.
      - **The card:** tabs **Sources (n)** and **Wells to fill (n)**, the open tab being what
        clicks and drags on the deck pick (any wells, never guessed from contents; a well can't be
        both); Sources lists each source (its well's name, else its main component, `Drug A +2`)
        with a replicates box, a Filler toggle (the filler's row says how many wells it fills) and
        ×, an **All sources** box setting every source's replicates, and only the first 8 sources
        until `Show all N sources ▸` (8 in `config/`); Wells to fill says `60 on Plate1 · 60 on
        Plate2`, with Clear. Then **Each transfer** (Mode and Mix for Aspirate and Dispense laid out
        as a stage's box, Tips: tip type and probes, Volume set by clicking it), then Seed (random
        to start). The footer shows the first problem only, in short words, then Remove, Close and
        **Randomize**, which reads **Update** once it has run.
      - **On the deck:** wells to fill get a dashed blue outline and, when empty, a pale tint;
        sources the chosen-source ring, which now stands 2px off the well with a gap,
        **everywhere** a source is chosen (Andy, 2026-11-01: hard to see on a filled well).
        Numbering the sources was tried and dropped as confusing.
      - **Running it** makes one stage per source, in list order, named as the source is, each with
        new tips, filling the wells to fill as **one pool** across any number of plates (a
        several-plates mode in `randomizer.js`). Update makes the stages match the card again: the
        same seed and inputs keep the same wells; a new seed shuffles again. One Undo takes a run
        out.
      - **Tips:** a randomization never shares tips with anything outside it; the tool adds tips
        where one needs them (the stage after it, or the old first stage, gets its own) and never
        removes tips or joins tip groups by itself.
      - **It owns its stages:** they can be looked at but changed only through its card (no ✎, no
        seams inside, no adding or removing transfers), so the card always matches them. **Remove**
        takes out the randomization and, once it has run, its stages, at once (Undo brings them
        back); tips it added stay. A "Turn into ordinary stages" button was tried and dropped for
        now (Andy, 2026-11-01).
      - **Part of the plan:** randomizations and which stages are theirs are saved in plan files
        (format version 5; versions 1 to 4 still open) and undone like any edit.
      - The standalone randomizer page stays for now (Andy, 2026-11-01), for its bench lists, until
        the designer can make them.
10. **Mixing** (Andy, 2026-10-28, moved from "Later"): in the plan, the plan file, the page and the
    file writer. The general-purpose method supports it (ADR 0007: before aspirating, after
    dispensing, and on its own). How it's shown in a plan and on the page is still open ("Open
    decisions"), so it starts with a preview.
11. **Well capacities and dead volume** (Andy, 2026-10-28, moved from "Later" and from "Technical
    debt"): each labware type's capacity and dead volume, so the tool warns about overfilling and
    about drawing into the dead volume. Starts with the facts, with sources (`docs/domain/`):
    each value, and whether dead volume depends on the tips or technique as well as the labware.
    How starting volumes are entered once dead volume is modelled is decided in its specification.
    *Decided 2026-10-30 (Andy):* **one dead volume per labware type**; tips and technique don't
    affect it, because Andy builds the lab's techniques and sets each one's minimum pipetting
    height so it reaches down to the labware's dead volume. Capacities and dead volumes live in `config/` (with the deck description), so
    stand-in numbers can go in first and be replaced when measured, as the pipetting modes were;
    stand-ins go in "Technical debt" until then. Known so far: reservoir trough 2 mL, deep well
    200 µL (`exp37.md`). *Also decided 2026-10-30 (Andy):* **capacity is one value per labware
    type too**, the labware type's "Maximum volume per well" in the Biomek's Labware Type Editor
    (B56358AF 17-18), copied into `config/` by hand with that source in its comment. The tool warns
    only on true overfilling; a lower working maximum (headroom for mixing, say) is not modelled.
    *Also decided 2026-10-30 (Andy):* **a starting volume is what was put in the well**, dead volume
    included, as at the bench today; the tool subtracts the dead volume itself and warns when a
    draw would go into it, and the setup worklist carries the real volume. The feature warns; it
    doesn't change how people fill labware. (Replaces the workaround in "Technical debt" of
    entering a reservoir's volume minus its dead volume.) **The preview is done** (2026-10-30;
    Andy liked it): capacity and dead volume per labware type in a new `config/labware-types.js`
    (stand-in numbers until measured; "Technical debt"); contents tracking finds **three kinds of
    problem**, a draw that reaches into the dead volume (marked as an overdraw is), an overdraw,
    and an **overfill** (a well over its capacity, from a transfer or at Start; a new mark: a red
    ring and a red bar across the well), all red, all in the problem count, all refused by the
    file writer (Andy, 2026-10-30); a well whose liquid is all dead volume is drawn **striped** in
    its component's color, its label still the total, the same on plates and troughs (Andy,
    2026-10-30); the contents card shows the usable volume and the labware's capacity and dead
    volume. **Mixing stays as it is** (Andy, 2026-10-30): a mix takes its share of what the well
    holds, dead volume included ("Technical debt"). *Decided 2026-10-30 (Andy):* the values live
    in a new `config/labware-types.js`, which defines each labware type the deck uses: its grid,
    capacity and dead volume; `config/deck.js` keeps only each labware's name and type, its `grid`
    moving to the type (a `BCFlat96` is always 96 wells). The `deck` module reads the grid through
    the type. Next: the specifications.

**Order of the remaining work** (Andy, 2026-10-28). Whatever changes the files comes before the
final Biomek runs, so they test the files as they will be:
1. Finish the Biomek files button (item 7): Claude Code builds the page. Then **one simulation run**
   of the page's files on the Biomek, so a tested version exists before anything else changes.
2. Mixing (item 10): preview, specifications, then builds.
3. Well capacities and dead volume (item 11): the facts first, then preview, specification, build.
4. The randomizer link (item 9), decided on 2026-11-01: seams, well names, then randomizations.
5. The final Biomek runs (item 8): simulation, then one real run with water, on the final files;
   then the golden file.
6. The release: `CHANGELOG.md`, README, `npm run build`, the tag `v0.2.0` and a GitHub Release.

**Later** (after v0.2.0):
- Final concentrations, from each component's stock concentration (such as "Dye is 10 mM").
  Each component's volume fraction of a well is already shown on the page's contents card.
- Editing the list further: moving a stage, or a transfer within its stage.
- **Splitting a stage's rows by well volume** (from the mixing work, 2026-10-29): a stage mixes one
  volume per row, worked out from its emptiest well, so fuller wells mix less than their share. The
  file writer could split a row's wells by what they hold, so each gets close to its share and
  short mixes mostly disappear (`mix-volumes.md`).
- **A short-mix warning in the Stages column** (from the mixing preview, 2026-10-29 and 30): for
  v0.2.0 a short mix shows only on the deck. Yellow stages, rows, lines and per-well reasons were
  tried in the preview and set aside as too crowded; a clearer way may come with use.
- The full technique table, from the Technique Browser.
- **Smarter staging:** the tool works out which transfers really depend on each other, reorders the
  independent ones, and forms as few stages as possible, so the user no longer builds stages.
- **Resuming after an interruption** (power loss or Abort; Biomek can't continue a method from where
  it stopped). The tool reads Biomek's Span8Transfer log to see which transfers were done, uses
  contents tracking to work out what every well should hold, and writes a restart: a new setup file
  with the corrected starting volumes, and the remaining transfers. First, test on the instrument
  that the log is written as the run goes (see "Not yet known" in `biomek.md`), and how a
  light-curtain break and an Abort behave.
- **A guided start** for an empty plan (Andy considered it, 2026-10-26, and chose not now): a
  checklist that ticks itself (bring out labware, fill wells at Start, add transfers), shown while
  the plan is empty. Perhaps once others in the lab use the tool.
- **Constituents of a component** (Andy, 2026-10-25): a component made of several things, such as a
  medium with a drug in it. Not designed yet.
- **Tips only for stages that run** (Andy, 2026-10-28, reviewing #86): a tip group's probes count
  only its stages with transfers, so an empty stage left in the plan with more probes than the rest
  doesn't load extra tips. To keep the page's tip counts and the files agreeing, the change goes in
  `tip-groups` (which would then read the operation list), and the page's tip counts would change as
  transfers are added and removed, so it's tried in a preview first. Until then, deleting unused
  stages before writing files avoids it.
- **A run code** (Andy, 2026-10-28): the file writer puts a new code in every setup worklist it
  writes, and the general-purpose method asks for it first thing when it starts, refusing to run
  if it's wrong. So the method could read its setup worklist from one fixed path (ADR 0007) without
  running an old one by mistake. Needs testing first: how a prompted variable behaves during
  validation (`biomek.md`, "Not yet known").
- **A prompted experiment ID** (tried 2026-10-27, Method24 and Method25; `biomek.md`): the method
  asks for an experiment name when it starts, instead of the user replacing the setup worklist. It
  worked, but warns differently from the rest, and would need its own testing before it's trusted.
- **A script that sets the method's volume variables from `config/deck.js`**, for when the deck next
  changes (2026-10-27). Start from the reference scripts in the claude.ai project
  (`claude/bmf-scripts/`).
- **One look for every tool's page** (Andy, 2026-10-28): once there are more tools, give their
  headers and names one style, including whether a tool's name shows on the page (the transfer
  designer's was taken off, to keep its header clean) and how names are written in browser tabs
  (now "Transfer Designer" and "Plate randomizer").
- **Collapsing tip groups** in the Stages column, for plans with many stages (considered
  2026-10-25, when the column was made to scroll on its own).

## Technical debt
Shortcuts taken knowingly, each with what doing it properly would mean.
- **Tests that hard-code config values** (2026-10-30): CLAUDE.md now says tests work out their
  numbers from `config/`, but tests written before then may name config values (e.g. default
  volumes, tip types, the experiment name's 40 characters if it moves to `config/`). The mixing
  values were fixed in #110. Properly: each module's tests follow the rule the next time it's
  changed; a quick check is to change a config value and run `npm test`.
- **Mix volume limits are stand-ins** (2026-10-30, mixing layer (b)): `MIX_VOLUME_LIMITS` in
  `config/tip-types.js` (BC230 200 µL, BC1070 1000 µL) is about what each tip holds in one trip
  (`biomek.md`, "Volumes and tips"), not checked as a mix volume on the instrument. Doing it
  properly: find the largest mix each tip type does cleanly (no air drawn, no splashing) and record
  it in `biomek.md` with the run that showed it.
- **The method's setup worklist is pointed at each run's folder by hand** (v0.2.0, Andy,
  2026-10-28; `file-writer.md`). Each run's files go in a folder of their own, and before each run
  the method's first Worklist step is pointed at that folder's `Setup.csv` and the method saved.
  ADR 0007 plans a fixed path so the method never changes. Properly: the fixed path, with a run
  code (see "Later").
- **Users build stages by hand** (v0.2.0). Properly: smarter staging (see "Later").
- **The stage rule is simple:** within one stage, no well may be both a source and a destination;
  the operation list refuses a transfer that breaks it, with a message saying why. It is stricter than needed (it
  separates transfers even when their order wouldn't matter), which costs some side-by-side work at
  each stage boundary. Properly: smarter staging.
- **The pipetting modes cover only the lab's current techniques** (`config/pipetting-modes.js`,
  which replaced the technique and liquid-type lists on 2026-10-26). Properly: the full table.
- **Techniques aren't checked against tip types** (v0.2.0, 2026-10-23). The tool treats every
  technique as usable with every tip type. Biomek doesn't check this either (`biomek.md`), so until
  it's built, the user chooses a technique that suits each stage's tips. Properly: each pipetting
  mode records the tip types its technique suits, and the page and the file writer check them
  (ADR 0007).
- **Finding stages with overdraws is written twice** (v0.2.0, #86, 2026-10-28): the file writer
  has its own copy of the transfer designer's four-line `stagesWithOverdraw`, because a shared
  module can't import from a tool. Properly: move it into a shared module (`contents-tracking` is
  the natural home), specification first, and have both use it.
- **Overdraws within a stage are found in the planned order** (v0.2.0, 2026-10-26). Within a
  stage the Biomek chooses its own order (B56358AF, 22-25), but contents tracking replays the
  planned order. When a stage draws from an overdrawn well more than once, which of its transfers
  runs short is one possible outcome, not certain; the stage with the overdraw is certain. Properly:
  report an overdraw by stage and well, not by transfer (`transfer-designer.md`, "Not in version 1").
- **Some messages use internal terms** (v0.2.0, 2026-10-25). The transfer designer page names
  stages by place and name, and labware by label, but some messages from the shared modules' checks
  still use internal terms, such as "starting contents entry 3", and contents cards number transfers
  (`#5`) by their place in the operation list, which the page doesn't show. Properly: collect every
  message a user can meet and reword those into the page's terms.
- **Capacities and dead volumes are stand-ins** (2026-10-30): `config/labware-types.js` has
  measured dead volumes for the deep well and the trough (`exp37.md`) but a guessed one for the
  flat plate, and guessed capacities for all three. Properly: each capacity copied from the
  Biomek's Labware Type Editor, and the flat plate's dead volume measured, with sources in the
  file's comments.
- **A mix can draw into the dead volume** (2026-10-30): `mix-volumes` takes a mix's share of what
  the well holds, dead volume included, so a 90% mix of a trough holding little more than its dead
  volume pulls air. Properly: the share of the usable volume, which also changes the short-mix
  and mix-problem rules; a mix that would reach into the dead volume could be a problem of its own.
- **Dead volume isn't modelled.** *(Replaced 2026-10-30 by item 11 of v0.2.0.)* A reservoir trough holds liquid a tip can't reach (2 mL in Exp37,
  `exp37.md`). For v0.2.0, the user enters a reservoir's starting volume minus its dead volume.
  The transfer designer page doesn't remind the user of this (Andy dropped the reminder,
  2026-10-25), so the lab needs to know it another way.
  Properly: dead volume per labware type, in contents tracking (it's under "Not in version 1" in its
  specification). *Being done in v0.2.0* (item 11, Andy, 2026-10-28).
- **A label's text box doesn't match the label** (found by Claude Code in #96, 2026-10-28;
  measured in Chromium the same day). The label is 15px semibold and 30px tall, and its text box's
  own style (`.label-box`) asks for the same, but the general rule for every text box
  (`input[type="text"]`) outweighs it (CSS specificity: the more specific selector wins), so the
  text box is 14px, regular weight and 34px tall: the label shrinks and loses its bold while being
  renamed. The page specification doesn't give the box's size. Properly: select it so it wins, as
  the experiment name's text box does (`input.experiment-name-box`).
- **`npm run serve` prints only the randomizer's address** (found 2026-10-29, updating the README
  in #98; left as it is, Andy). The README gives both pages' addresses, so nothing is missing for
  someone reading it. Properly: `scripts/serve.js` prints the Transfer Designer's address too.
- **The REPL's `deck` and `transfer-designer` examples name labware that's no longer on the deck**
  (`"Res"`, `"Plate"`, `"Deep"`, the stand-ins before #82), so most of them fail with "There's no
  labware … on the deck." Found reviewing #94, 2026-10-28; left for later (Andy). The page and the
  tests are unaffected. Properly: rename them to real labware (`Res1`, `Plate1`, `Deep1`), keeping
  the examples that are meant to be refused refused for the same reason, and run every example.

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
  (technique and liquid type at the sources and at the destinations, and probes); it makes the IDs that transfers name their stage by (ADR 0008). See `src/shared/stage-list/stage-list.md`.
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
randomizer link is under "Later". Changed again on 2026-10-27: it joins v0.2.0 (item 9). The shared
pieces below are the same.*

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

For the randomizer this is a new output, with its current lists unchanged. It's part of v0.2.0
(item 9, Andy, 2026-10-27); the project has one version number for all its tools, so there's no
separate randomizer version.

**Decided: any method, described to the tool (ADR 0005).** Options considered were Exp37's method
only (A), one general method with a standard deck (B), and any method described to the tool (C). C
was chosen, with descriptions saved and loaded, so B stays possible as one shared description.
Generating the method itself was ruled out: its file format isn't documented and Script steps aren't
supported for end users.

**Accepted: ADR 0006, one general-purpose method, driven by a worklist** (2026-10-28). The tool should define the
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
  *Built, by stage* (`transfer-designer-page.md`, section 11): the page shows the plates at Start,
  after each stage, and at the end. Never after a single transfer, because within a stage the
  Biomek chooses its own order (B56358AF, 22-25).
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
- **Mixing** (v0.2.0, item 10; noted 2026-10-22): the tools will need to mix wells. Andy's Biomek Software has no
  separate Mix step for the Span-8, so it has to be done another way. Options to look at: a transfer
  from a well back into the same well (the operation list already allows this), or a technique's
  mix settings in Transfer From File (Exp37 used "aspirate mix 75 µL × 2"; `exp37.md`). How mixing
  is represented in the operation list is part of this. *Decided for the method (2026-10-27, ADR
  0007):* techniques' mix settings, read from the stage worklist, and a well-to-itself transfer for
  mixing on its own. Still open: how mixing is shown in a plan and on the page.
- **Working rule:** each setting is controlled in one place, either the worklist or the
  general-purpose method, never both, so the tool never shows one plan while the Biomek follows
  another. ADR 0007 puts liquid type, technique, tip type, probes, tip changes and mixing in the
  worklist.
- **How operations are checked against labware and techniques**, such as whether a well exists on
  the named labware, a volume fits in it, a technique suits its tip type (Biomek doesn't check this;
  see `biomek.md`). Ideally live, as operations are entered, so a wrong sequence is caught before
  it's built. Where these checks live is undecided. (The stage rule is decided: `operation-list`
  checks it in `add`.)
- **A programming interface from Beckman**: Andy is asking whether one exists. If it does, ADR 0006's
  option 3 would be reconsidered.
- **How wide the transfer designer's Stages column is in mid-sized windows** (noted 2026-10-26,
  reviewing #74). Between about 1000px and 1420px wide, the Stages column shrinks to its minimum,
  320px, to give the deck panel the room, though the labware stack one per row anyway, so the
  narrower column gains nothing and cuts names off sooner. Option: keep it at 400px unless the extra
  room lets two labware sit side by side (`transfer-designer-page.md`, section 3). Not urgent.
  *2026-10-30 (#105):* the minimum is now 348px, so a stage's 320px editing box fits inside the
  column; the rest of this question is still open.
- **Very large plates**: `WellGrid` allows at most 26 rows (A–Z). 1536-well plates (rows A–AF)
  would need a specification change.
