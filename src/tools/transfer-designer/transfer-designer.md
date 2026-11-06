# transfer-designer — specification

> **Draft (2026-10-26).** Written for v0.2.0, from the transfer designer preview, where these rules
> were tried with Andy (2026-10-24 to 2026-10-26). It becomes Final once its code is built and Andy
> has tested the page.
>
> **Draft change (2026-10-30):** each tip change chooses its probes, and stages no longer have
> probes (ADR 0007, "Tip changes"; sections 3, 4, 5 and 6), from the mixing preview.
>
> **Draft change (2026-10-30, mixing settings):** a stage's settings hold its mixes, `sourceMix` and
> `destinationMix` (ADR 0007, "Mixing"); a new stage copies them with its other settings (sections 3
> and 6).
>
> **Draft change (2026-10-30, mixing layer (b)):** each pipetting mode names its mixing technique;
> `setStageMix` switches an end's mixing on or off, and its technique with it; settings whose
> technique doesn't match their mixing are refused; and stages with a mix problem are reported, as
> overdraws are (sections 2 to 6).
>
> **Draft change (2026-10-30, well capacities and dead volume, item 11 of v0.2.0):** contents
> tracking now reports three kinds of problem (a draw into the dead volume, an overdraw and an
> overfill; `contents-tracking.md`), so `stagesWithOverdraw` becomes `stagesWithContentsProblem`
> (sections 3, 4 and 6).
>
> **Draft change (2026-10-30, mixing layer (c1)):** the default mix, `DEFAULT_MIX`, from
> `config/mixing.js`, for a tool switching mixing on (sections 3, 4 and 6).
>
> **Draft change (2026-10-30, mixing layer (c2)):** mix steps: `addMixStep`, `isMixStep`,
> `mixWells`, `unmixWell`; a mix step takes only mixed wells; and a new stage copies the nearest
> stage of its own kind (sections 3 to 6).
>
> **Draft change (2026-11-01, seams, the first part of v0.2.0's item 9):** `addStageWithNewTips`
> and `addMixStepWithNewTips` add a stage or a mix step in a tip group of its own, for the page's
> seams between tip groups (sections 3, 4 and 6; `transfer-designer-page.md`, section 7). Nothing
> else changes. It becomes Final once built and tested by Andy.
>
> **Draft change (2026-11-01, well labels, the second part of v0.2.0's item 9):** a plan holds
> **well labels**, the names a user gives wells (`docs/glossary.md`, "Well label"):
> `wellLabels`, `wellLabelOf`, `setWellLabel` and `setWellLabels` (sections 3 to 6), from the
> randomizer preview Andy shaped on 2026-11-01. Plan files hold them from format version 5
> (`plan-file.md`). It becomes Final once built and tested by Andy.
>
> **Draft change (2026-11-01, randomizations, the third part of v0.2.0's item 9; ADR 0012):** a plan
> holds **randomizations** (`docs/glossary.md`), which own the stages they make (sections 3 to 6),
> from the randomizer preview Andy shaped on 2026-10-31 and 2026-11-01. Written in one sitting while
> Andy was away (2026-11-01), so still to review with him: the choices listed in its pull request.
> It becomes Final once built and tested by Andy.
>
> **Draft change (2026-11-01, constituents and concentrations; ADR 0013):** each component carries
> **constituents** (`docs/glossary.md`): `setConstituents` and `concentrationsOf` (sections 3 to
> 6), from the preview Andy shaped on 2026-11-01. Plan files hold them from format version 7
> (`plan-file.md`). It becomes Final once built and tested by Andy.

> **Draft change (2026-11-01, moving and copying; ADR 0014):** stages, tip groups and
> randomizations can be moved and copied in the column, and copied items pasted into this plan or
> another: `columnBoxes`, `moveItems`, `copyOf`, `copyItems` and `pasteItems`, following the
> container rule (sections 2 to 6), from the preview Andy shaped on 2026-11-01. Written in the
> hands-off workflow (CLAUDE.md, "Workflows"), so the choices made for Andy are listed in its pull
> request. It becomes Final once built and tested by Andy.

> **Draft change (2026-11-02, moving wells, item 12 of v0.2.0):** everything the plan does with one
> well can be moved to a well the plan doesn't use: `isWellUsed`, `isWellToFill` and `moveWell`
> (sections 3 to 6), from the preview Andy shaped on 2026-11-02, so a trough warped in the
> autoclave can be swapped for another. Written in the hands-off workflow (CLAUDE.md, "Workflows"),
> so the choices made for Andy are listed in its pull request. It becomes Final once built and
> tested by Andy.

> **Draft change (2026-11-02, a filler of several wells, item 13 of v0.2.0):** a randomization's
> filler can be several **filler wells**, used in order, each giving the whole transfers that fit
> above its dead volume, all in one stage on one set of tips; they must hold one liquid; and a
> randomization whose stages no longer match what a run would make now is **out of date**, and a
> run renames its stages too: `fillerShares` and `isRandomizationOutOfDate` (sections 3 to 6), from
> the preview Andy shaped on 2026-11-02 and 2026-11-03. Plan files hold several filler wells from
> format version 8 (`plan-file.md`). Written in the hands-off workflow (CLAUDE.md, "Workflows"), so
> the choices made for Andy are listed in its pull request. It becomes Final once built and tested
> by Andy.

> **Draft change (2026-11-05, osmolality; ADR 0016):** each component may have an **osmolality**
> (`docs/glossary.md`), its stock's measured value in mOsm/kg, and a well's osmolality is estimated
> from its components' (the new shared module `osmolality`): `setOsmolality` and `osmolalityOf`
> (sections 1 to 6), from what Andy decided on 2026-11-05. Plan files hold it from format version 9
> (`plan-file.md`). Written in the hands-off workflow (CLAUDE.md, "Workflows"), so the choices made
> for Andy are listed in its pull request. It becomes Final once built and tested by Andy.
>
> **Draft change (2026-11-05, shared tips, item 18 of v0.2.0; ADR 0018):** a randomization's
> sources can **share tips**: each source says whether its stage shares the tips of the source
> before it (`sharesTips`), so related sources (one drug at rising concentrations, lowest first) run
> on one set of tips; a randomization still never shares tips with stages outside it. A run puts
> its stages in the sources' order, existing stages included, and gives new tips only where a
> **source group** starts. The list functions `sourceGroups`, `setSourceSharesTips`, `moveSource`
> and `removeSources` move sources and set their sharing by the container rule (ADR 0014), for a
> caller editing a list of sources. A randomization's stages may now share tip groups with each
> other (`columnBoxes`, `setRandomizations`, copied items version 3). Sections 3 to 6. Plan files
> hold the sharing from format version 10 (`plan-file.md`). Shaped in a preview Andy approved on
> 2026-11-05 and written in the hands-off workflow (CLAUDE.md, "Workflows"), so the choices made
> for Andy are listed in its pull request. It becomes Final once built and tested by Andy.

> **Draft change (2026-11-05, cell density, item 16 of v0.2.0):** cells are a constituent in
> cells/mL (`concentrations.md`, "Cells"), and `seedingDensitiesOf` gives a well's cells per cm² of
> its growth area, on labware types that have one (sections 3, 4 and 6), decided with Andy on
> 2026-11-05. Plan files don't change. Written in the hands-off workflow (CLAUDE.md, "Workflows"),
> so the choices made for Andy are listed in its pull request. It becomes Final once built and
> tested by Andy.

> **Draft change (2026-11-05, tips used, item 17 of v0.2.0):** `tipsUsed`, how many tips of each
> tip type the run loads, for a tool to show (sections 2, 3, 4 and 6; Andy, 2026-11-05). It counts
> exactly the tips the Biomek files load, so it changes no Biomek files. Written in the hands-off
> workflow (CLAUDE.md, "Workflows"), so the choices made for Andy are listed in its pull request.
> It becomes Final once built and tested by Andy.

> **Draft change (2026-11-05, transfer tables, item 19 of v0.2.0; ADR 0019):** a plan holds
> **transfer tables** (`docs/glossary.md`), each a table of how many µL of each component go into
> each labeled well, owning one stage per component: `readTransferTable`, `stockWellsOf`,
> `transferTableProblems`, `sourceSplit`, `transferTableStages`, `addTransferTable`,
> `updateTransferTable`, `removeTransferTable`, `canRemoveTransferTable`, `transferTableAt`,
> `transferTableOf`, `isTransferTableOutOfDate` and `setTransferTables`; their stages' pipetting and
> tips are edited as any stage's, and every other edit of them is refused here, in the logic;
> `renameComponent` renames their columns; moving wells, moving and copying know them (copied items
> version 4). Sections 2 to 6. Plan files hold them from format version 11 (`plan-file.md`). Shaped
> in previews with Andy on 2026-11-05 and written in the hands-off workflow (CLAUDE.md,
> "Workflows"), so the choices made for Andy are listed in its pull request. Still to review: every
> message, and whether `renamedFrom` should also carry a column's source wells. It becomes Final
> once built and tested by Andy.

> **Draft change (2026-11-05, a randomization's settings on its stages, item 20 of v0.2.0):** once a
> randomization has run, its pipetting settings and tips live only on its stages and their tip
> changes (one source of truth, as for transfer tables): its own `settings`, `tipType` and `probes`
> are `null` then, and hold only what its first run gives while it has no stages. A run keeps each
> stage's settings and each source group's tips, a new stage starting from its neighbor's; a run may
> set every stage's mode, mixing, tip type or probes at once (`runRandomization`'s `forAll`); a
> randomization's stages and tip changes take `changeStageSettings`, `setStageMix`, `setTipType`
> and `setTipProbes`, and every other edit of them is now refused in the logic;
> `randomizationStageValues` gives the values its stages share. `addRandomization` starts its
> first-run settings from the nearest transfer stage, as `addStage` does.
> Copied items go to version 5. Sections 3 to 6. Plan files go to format version 12
> (`plan-file.md`). Shaped in a preview with Andy on 2026-11-05 and written in the hands-off
> workflow, so the choices made for Andy are listed in its pull request. Still to review: every new
> message. It becomes Final once built and tested by Andy.

> **Draft change (2026-11-05, stock tables, item 22 of v0.2.0):** a **stock table**
> (`docs/glossary.md`) adds many components at once, each with its constituents and osmolality,
> and the plan's components can be written out as one: `readStockTable`, `addStocks` and
> `stockTable`; `UNIT_SPELLINGS` in `config/concentration-units.js` (sections 3 to 6). Nothing new
> is kept in the plan, so plan files and the Biomek files don't change. Shaped in a preview with
> Andy on 2026-11-05 and written in the hands-off workflow (CLAUDE.md, "Workflows"), so the choices
> made for Andy are listed in its pull request. Still to review: every new message. It becomes
> Final once built and tested by Andy.

> **Draft change (2026-11-06, copied decks, item 23 of v0.2.0):** a **copied deck**
> (`docs/glossary.md`): what every well holds at one point of a plan, with the components' details
> and the labels, added to another plan's starting contents: `copyDeck`, `pasteDeck`,
> `COPIED_DECK_FORMAT` and `COPIED_DECK_VERSION` (sections 3 to 6). Nothing new is kept in the plan,
> so plan files and the Biomek files don't change. Shaped in a preview on 2026-11-06 and written in
> the hands-off workflow (CLAUDE.md, "Workflows"), so the choices made for Andy are listed in its
> pull request. Still to review: every new message. It becomes Final once built and tested by Andy.

## 1. Purpose
`transfer-designer.js` holds the transfer designer's rules: what a **plan** (`docs/glossary.md`) is,
and every edit that can be made to one, each checked so that a plan is always valid. A tool shows a
plan and passes on what the user does; every rule about what that means lives here, so it can be
tested in Node (CLAUDE.md, "Separate logic from the UI").

It builds on the shared modules, and doesn't repeat what they do:
- `operation-list`: the transfers, in run order, by stage (ADR 0008);
- `stage-list`: each stage's ID, name and settings;
- `contents-tracking`: what every well holds at any point, and its problems (a draw into the
  dead volume, an overdraw, an overfill);
- `mix-volumes`: how much each row mixes, and mix problems;
- `deck`: the labware on the deck, their grids, and which wells exist;
- `concentrations`: what a well's mixture carries, from what its components carry (ADR 0013);
- `osmolality`: a well's estimated osmolality, from its components' measured ones (ADR 0016).

Beside it in this tool are two other logic modules, `plan-history` (undo and redo of plans) and
`plan-file` (saving and opening plans; ADR 0010), and the page (`transfer-designer-page.md`).

## 2. Scope
Version 1 creates an empty plan; adds, removes, changes, moves and copies stages (and moves and
copies tip groups and randomizations); adds, removes and changes transfers, tip changes,
components (with their constituents and osmolality), starting contents, labware labels, well
labels and the experiment name; adds, updates and removes transfer tables; and answers questions about a plan: its stage order, its tip
groups, the tips it uses, the stages with a contents problem or a mix problem, where each stage
ends, the labware it uses, and what each well carries (its concentrations and osmolality, and its
cells per cm² where its labware has a growth area).

Not in version 1 (see `docs/roadmap.md`):
- **Moving a transfer** to another stage, or within its stage (ADR 0014). A transfer can be removed
  and added again.
- **Cut and delete** of several things at once (ADR 0014).
- **Smarter staging** (the tool forming stages itself).
- **Converting between families of units** (g/L to mM needs a molecular weight): a constituent
  keeps one family (section 3, "Constituents").
- **Checking techniques against tip types** (roadmap, "Technical debt").
- **Which transfer runs short when a stage draws from an overdrawn well more than once** (roadmap,
  "Technical debt"): within a stage the Biomek chooses the order (B56358AF, 22-25), but contents
  tracking replays the planned order, so the wells it marks are one possible outcome. The stage
  with the overdraw is known for certain.

## 3. Data model

### The plan
A plan is an object that is **never changed after it's made**: every edit returns a new plan and
leaves the old one as it was, so undo can keep old plans (`plan-history.md`). It holds plain data
(text, numbers, lists and objects) and two immutable lists, an `OperationList` and a `StageList`.

A new plan shares every part the edit didn't change with the plan it came from, and the operation
list shares unchanged transfers (`operation-list.md`, "Unchanged operations are shared"), so
keeping many plans costs little. So every edit here changes only what it must: for example,
changing a transfer's volume uses the operation list's `replace`, never a rebuilt list.

```js
{
  components:       [{ name: "Media", color: "#4e79a7", constituents: [], osmolality: 300 },
                     { name: "Dye stock", color: "#f28e2b",
                       constituents: [{ name: "Dye", amount: 10, unit: "mM" }],
                       osmolality: null }, …],
  startingContents: [{ labware: "Res", well: "1", components: { Media: 12000 } }, …],
  operationList:    /* an OperationList */,
  stageList:        /* a StageList */,
  stageOrder:       ["1", "3", "2"],
  tipChanges:       { start: { tipType: "BC1070", probes: [1, 2, 3, 4, 5, 6, 7, 8] },
                      "2": { tipType: "BC230", probes: [1, 2, 3, 4] } },
  labwareLabels:    { Plate: "Assay plate" },
  wellLabels:       { Deep: { A1: "Cond 1", A2: "Cond 2" } },
  randomizations:   [/* a randomization, below */],
  transferTables:   [/* a transfer table, below */],
  experimentName:   "Exp36",
}
```

- **`components`**: the liquids the user has named (`docs/glossary.md`, "Component"), in the order
  they were added. Each has a `name` (a name: text, not blank, no whitespace at the start or end,
  as `checkName` in `input-checks`) and a `color` (text, e.g. `"#4e79a7"`; which colors are
  offered is up to the tool) and `constituents` (`concentrations.md`, section 3: a list of
  `{ name, amount, unit }`, in the user's order, possibly empty; "Constituents", below) and
  `osmolality` (a number of mOsm/kg, 0 or more, or `null` for none; "Osmolality", below), its
  properties in that order (`name`, `color`, `constituents`, `osmolality`), since plan files
  write them as they are. No two
  components share a name, or a color, so they can always be told apart where colors are drawn. A
  component may be in the list without being in any well yet.
- **`startingContents`**: what each well holds before the run, in the form `contents-tracking`
  takes (`contents-tracking.md`): one entry per well that holds something, its `components` giving
  microliters (µL) of each. Every well is on the deck, and every component named is in `components`.
- **`operationList`**: the transfers. Every transfer's `stage` is a stage in `stageList`, and its
  wells are on the deck.
- **`stageList`**: the stages, with their six settings (`stage-list.md`), including their mixes.
- **`stageOrder`**: the stage order (below), as a list of stage IDs holding every stage in
  `stageList` exactly once (ADR 0011).
- **`tipChanges`**: the plan's tip changes (`docs/glossary.md`, "Tip change"), each `{ tipType,
  probes }`, by where they happen: **`START`** (the text `"start"`), before the first stage, always
  there; or a stage's ID, just before that stage. (Stage IDs are numbers written as text, so none is
  `"start"`.) There is never one keyed by the first stage in the stage order: that stage's tips
  are the `START` ones. A tip change's **`probes`** are the probes that get its tips, and every
  stage using those tips uses all of them (Andy, 2026-10-30; ADR 0007, "Tip changes"): a list of at
  least one probe number, each a whole number from 1 to 8 (the Span-8's probes, numbered as in
  Biomek Software), none twice, stored smallest first (`[3, 1]` is stored as `[1, 3]`).
- **`labwareLabels`**: the label the user gave each labware (`docs/glossary.md`, "Labware label"),
  by the labware's name in the deck description. A labware without one is labeled by that name.
  No two labware have the same label.
- **`wellLabels`**: the label the user gave each well (`docs/glossary.md`, "Well label"), by the
  labware's name in the deck description, then the well's name on its grid (`A1`, or `5` on a
  reservoir). Only labware with at least one labeled well are listed, and only labeled wells.
  Each label is text, not blank, with no whitespace at the start or end (as `checkName`). Labels
  may repeat. A label belongs to the well's position for the whole run, not to what the well holds.
  Like the experiment name, labels are part of the plan, so labeling is an edit like any other:
  undone and redone, kept in the browser copy, and saved in the plan file (`plan-file.md`; Andy,
  2026-11-01). They're for people only: the file writer never reads them.
- **`randomizations`**: the plan's randomizations (section 3, "Randomizations"), in the order they
  were added, except that a move or a paste that changes something puts the whole list in column
  order (section 3, "Moving and copying"); several sitting at one place are in this list's order. The file writer never reads them: their stages are ordinary stages to it.
- **`transferTables`**: the plan's transfer tables (section 3, "Transfer tables"), in the order they
  were added, except that a move or a paste that changes something puts the whole list in column
  order (section 3, "Moving and copying"). The file writer never reads them: their stages are
  ordinary stages to it.
- **`experimentName`**: the experiment's name (`docs/glossary.md`, "Experiment name"), or `""`
  until the user gives one (Andy, 2026-10-28). A name follows the file writer's rule,
  `checkExperimentName` (`file-writer.md`): letters, digits, hyphens and underscores, 1 to 40
  characters. It's part of the plan, so renaming is an edit like any other: undone and redone, kept
  in the browser copy, and saved in the plan file (`plan-file.md`).

### Stage order
The **stage order** is the order of all the plan's stages, with or without transfers: the order a
tool shows them in, and the order they will run in. The plan keeps it as its own list,
`stageOrder`, the one source of truth for it (ADR 0011). It changes only when a stage is added
(its ID is inserted), removed (its ID is taken out) or moved (ADR 0014; section 3, "Moving and
copying"). Adding or removing transfers never changes it.

**The operation list follows it.** Its blocks, one per stage with transfers (ADR 0008), are always
in the same order as those stages in `stageOrder`: a stage's first transfer is placed to keep it so
(section 3, "Transfers"); a move rebuilds the operation list in the new stage order (section 3,
"Moving and copying"). So the **run order** of ADR 0008, the stages with transfers in the
operation list's order, is the stage order with the stages without transfers left out. A stage
without transfers isn't run.

### Stages
- A new stage is called **`NEW_STAGE_NAME`**, `"New stage"` (Andy, 2026-10-25: a number in the name
  stopped matching the stage's place once one was inserted). Stage names needn't be unique
  (`stage-list.md`).
- A new stage's settings are copied from the **nearest stage of its own kind** (Andy, 2026-10-30):
  a transfer stage from the nearest transfer stage, a mix step from the nearest mix step (section 3,
  "Mix steps"); the nearest before it in the stage order, or, with none before it, the nearest
  after it; **mixes included**, so it mixes as that stage does, with the techniques that go with
  its mixing (Andy, 2026-10-30: one rule, and a new stage is often "another one like the last").
  With no stage of its kind, it has the default settings (a transfer stage) or the default mix step
  settings (below). The stage of a new plan has the **default settings**: the default pipetting
  mode, `DEFAULT_PIPETTING_MODE` in `config/` (below), at both ends, and no mixing (Andy, 2026-10-26: named in `config/`, so the menus
  keep their order and the default can change without changing code).
- A stage is added **before** a given stage (or last). With **take tips**, a tip change keyed by that
  stage moves onto the new stage, so the new stage is the first to use those tips; without it, the
  new stage uses the tips before that tip change (Andy, 2026-10-25: so a stage can be added at the
  top of a tip group, or at the end of the group before).
- **Any stage can be removed unless it's the only one**, and its transfers go with it (Andy,
  2026-10-26). A tip change keyed by it goes too.
- **A stage may mix labware types.** The file writer splits it into substages (ADR 0007, amended
  2026-10-26), so nothing here refuses it.


### Pipetting modes
A stage's techniques and liquid types are chosen as **pipetting modes** (`docs/glossary.md`), listed
in `config/pipetting-modes.js` (below). A mode at one end sets that end's technique and liquid type
together. Reading back, a stage's technique and liquid type at an end give its mode, or none if they
aren't one of the modes (for example, after the modes in `config/` change).

### Mixing
A stage holds a mix for each end, or `null` (`stage-list.md`). Biomek mixes only with a technique
that mixes, and such a technique refuses 0 mix times (`biomek.md`, "Mixing"), so **an end's
technique follows its mixing** (ADR 0007, "Mixing"):
- Each pipetting mode names two techniques: `technique`, used when that end doesn't mix, and
  `mixingTechnique`, used when it does, or `null` if the mode can't mix (Non-Contact can't;
  `biomek.md`). Its liquid type is the same either way.
- **The rule:** at an end whose technique and liquid type are one of a mode's, the stage mixes
  exactly when the technique is that mode's `mixingTechnique`. So a mix with the mode's `technique`,
  or no mix with its `mixingTechnique`, is refused. Every change of a stage's settings is checked
  (`changeStageSettings`), so a plan file can't bring in a stage that breaks it (`plan-file.md`).
  An end whose technique and liquid type aren't one of the modes isn't checked: the tool can't know
  whether its technique mixes.
- **Switching mixing on or off** (`setStageMix`) sets the end's mix and switches its technique to
  the mode's `mixingTechnique` or `technique` in the same edit, keeping its liquid type. It needs
  the end to be one of the modes, and a mode that can mix to switch it on. If the end already has
  that mix (equal `share`, `times` and `speed`, or both `null`), the same plan is returned, as an
  unchanged experiment name is.
- **The default mix** is `DEFAULT_MIX` in `config/mixing.js` (below): what a tool gives an end
  when it switches mixing on, since it offers mixing only as on or off (Andy, 2026-10-29). An end
  that already mixes keeps its own mix, so a plan made with another default still runs as made.
- **Choosing a mode** keeps the end's mixing: `modeSettings(end, name, mixes)` gives the mode's
  `mixingTechnique` when `mixes` is `true`.
- **Mix problems:** a stage whose mix volume in any row is under the minimum mix volume (`MIN_MIX_VOLUME`, `mix-volumes.md`) has a **mix problem**
  (`mix-volumes.md`). It's reported as soon as it appears, as an overdraw is (Andy, 2026-10-30), and
  the file writer refuses the plan until it's fixed (`file-writer.md`).

### Mix steps
A **mix step** (`docs/glossary.md`) is a stage that only mixes: it moves no liquid, and mixes each
of its wells in place (ADR 0007, "Mixing"). It's still a stage, in the stage list and the stage
order, using its tip group's tips, and becoming stage-worklist rows; the plan file needs nothing
new for it (`plan-file.md`).
- **Its settings** are `MIX_STEP_MODE` (`config/mixing.js`, below) at both ends, the technique that
  only mixes and its liquid type; no source mix; and a destination mix, since that technique mixes
  at the dispense end (ADR 0007). The **default mix step settings**, for a mix step with none to
  copy: `MIX_STEP_MODE` at both ends, `sourceMix` `null`, `destinationMix` `DEFAULT_MIX`. A stage
  **is a mix step** (`isMixStep`) exactly when its technique and liquid type are `MIX_STEP_MODE`'s
  at both ends. (Since that technique isn't one of the pipetting modes', the mixing rule above
  doesn't check it.)
- **Its settings are checked** whenever a stage's settings change (`changeStageSettings`, so plan
  files too; from #112's review): `MIX_STEP_MODE`'s technique is used at both ends or at neither;
  a mix step has no source mix and has a destination mix; and **a stage with transfers keeps its
  kind**, so a transfer stage's transfers never become a mix step's row, nor a mix step's mixed
  wells a transfer stage's. (A stage without transfers may change kind: a plan file's stages are
  given their settings before their transfers, `plan-file.md`.)
- **Its transfers are its mixed wells:** each is a transfer from a well into itself of
  `MIX_STEP_VOLUME` (`config/mixing.js`), a placeholder (Andy, 2026-10-30: 1 µL; whether the
  volume matters is to be checked at the Biomek). A mix step takes no other transfer, and a mixed
  well's volume can't be changed. A well is mixed at most once in a mix step (the operation list's
  stage rule refuses it twice).
- **Mixing wells** (`mixWells`) adds a mixed well for each well given that the mix step doesn't mix
  yet, as one edit, leaving out the rest; **unmixing a well** (`unmixWell`) removes its mixed well.
- A mixed well is a transfer like any other to the modules that work on transfers: the operation
  list, contents tracking (it leaves the well's contents as they were, and is an overdraw if the
  well holds less than `MIX_STEP_VOLUME`), `mix-volumes` (its mix volume is the share of what the
  emptiest well holds as the stage starts) and the file writer (a row with the mix step's settings).

### Transfers
- A transfer is added to a stage. If that stage already has transfers, it goes after them (the
  operation list's `add`). If it's the stage's first, it goes just before the next stage in
  `stageOrder` that has transfers (`insertBeforeStage`), or last if none does, so the operation
  list's blocks stay in the stage order.
- Several transfers can be added as **one edit** (for example, one source into each of many
  wells): all are added, or, if any can't be, none.
- A transfer's volume can be changed in place, keeping its position and stage (`replace`).
- Removing a stage's last transfer leaves the stage in its place: the stage order doesn't change.
- Positions are positions in the operation list, counting from 0, as in `listOperations()`.

### Tip changes and tip groups
- The run starts with the `START` tip change, which can't be removed. A new plan's `START` tips go
  on the first `DEFAULT_PROBE_COUNT` probes, from `config/` (below): 4 (Andy, 2026-10-30). Another tip change can be added just before any stage except the first in
  the stage order, at most one per place. It loads the tip type and probes already in use there,
  until changed. Removing one leaves the stages after it on the tips before it.
- How many probes a tip change loads is chosen as a number: it gets the first that many probes
  (`probesFor(4)` → `[1, 2, 3, 4]`; Andy, 2026-10-24: choosing which probes would be too much).
  `setTipProbes` accepts any probes, though, so the rules here don't assume they're the first ones.
- A **tip group** (`docs/glossary.md`) is a group of stages that run on the same tips: the stages
  after one tip change, up to the next, in stage order, all using that tip change's tip type and
  probes (`tip-groups.md`).
- After stages are added or removed, a tip change keyed by the stage that's now first in the stage
  order becomes the `START` one (its tip type and probes replace the `START` one's), so there's
  never one before the first stage but `START`.
- **Adding a stage in a tip group of its own** (`addStageWithNewTips`, `addMixStepWithNewTips`;
  Andy, 2026-10-31), for a caller that starts a new tip group with a new stage. The
  new stage is added as `addStage` (or `addMixStep`) adds it, without `takeTips`; then it gets a tip
  change of its own (none is added when it's the first stage, whose tips are the `START` ones), and
  the stage just after it, if there is one and it has no tip change, gets one too. Each added tip
  change loads the tip type and probes in use there, as `addTipChange` does. So the new stage
  shares tips with nothing, and the stage after it keeps the tips it had. For example, adding
  before the first stage of a plan whose `START` tips are BC230 on `[1, 2, 3, 4]`: the new stage is
  first, with the `START` tips, and the old first stage gets a tip change of BC230 on
  `[1, 2, 3, 4]`.
- **Tips used** (`tipsUsed`; Andy, 2026-11-05): how many tips of each tip type the run loads, so a
  tool can show what a run needs. It's the sum, by tip type, of the tips each tip change loads, one
  per probe it loads (its tip group's `probes`), with no special cases. Only the tip changes whose
  tips the run actually loads count, so the count is what the Biomek files load (`file-writer.md`,
  `Stages.csv`):
  - **A tip group counts when any of its stages has transfers** (a mix step's mixed wells
    included, since they're transfers): the file writer writes a tip-change row for it. A tip group
    whose stages have no transfers counts nothing, since the file writer writes no row for it and
    the Biomek loads no tips there. So the `START` tips count like any other, when their group has
    transfers.
  - **Every such tip change counts in full**, even when the one before it loaded the same tip type
    on the same probes: the Biomek unloads all tips and loads new ones at each (ADR 0007, "The
    method").
  - **Randomizations count through their stages only:** a randomization's own `tipType` and
    `probes` (its settings for the stages it makes) are never read. Only the tip changes of its
    stages, as they stand in the plan, count, like any others; a randomization that hasn't run has
    no stages, so it counts nothing.
  - **Problems don't matter:** a plan with an overdraw, a mix problem or a randomization out of date
    is counted as it stands, though the file writer refuses it until the problem is fixed.
  - **Order:** by tip type, in `TIP_TYPES` order (`config/`, below), leaving out a tip type the run
    loads none of. A plan's tip types are always in `TIP_TYPES` (`setTipType` and plan files check
    them).

  For example, `START` tips BC230 on `[1, 2, 3, 4]` before stages 1 and 2 (with transfers), a tip
  change of BC1070 on `[1, 2]` before stage 3 (with transfers), BC230 on all eight probes before
  stage 4 (with transfers), and BC1070 on `[1]` before stage 5 (no transfers): `[{ tipType: "BC230",
  count: 12 }, { tipType: "BC1070", count: 2 }]`.

### Components and starting contents
- Components are added by name and color, renamed, recolored and removed. Renaming changes the name
  in every well too, and in every transfer table (section 3, "Transfer tables", "Components");
  removing takes the component out of every well (a well left empty is no longer listed) and out of
  every transfer table's `sources`. Renaming a component to its own name changes nothing.
- **Adding to wells adds**: a volume of a component added to wells goes on top of what each holds,
  like pipetting it in (Andy, 2026-10-25): 500 µL of Media plus 1000 µL of Media is 1500 µL; other
  components stay. The volume must be a number above 0. A well listed more than once gets the
  volume once.
- Emptying wells removes everything they hold at the start. The components stay in the list. A well
  that's already empty is left as it is.

### Constituents
A component's constituents (`docs/glossary.md`; ADR 0013) are set as a whole list, replacing what
it carried: `checkConstituents` (`concentrations.md`) checks the list's form, names, amounts and
units. A new component carries nothing, `[]`.

**One family per constituent name**, across the plan: the same name in different components is the
same thing, whose amounts add up in a well, and adding g/L to mM would need a molecular weight the
tool doesn't know. So a constituent whose unit's family (`familyOf`, `concentrations.md`) differs
from the family that name already has in **another** component is refused, naming the first
component in the plan's order (other than the one being set) that carries that name, and the unit
it carries it in.
Within the list being set, the first constituent with a name sets the family the plan must agree
with (names are unique in a list, so no two entries of one list share a name). Changing a
constituent's family where only this component has that name is fine, since the list replaces the
old one.

Renaming a component doesn't touch constituents, even one with the component's own name: a
component and a constituent are different things (ADR 0013). Removing a component removes its
constituents with it.

**Concentrations.** What a well carries after any number of operations: `concentrationsOf` gives
`wellConcentrations` (`concentrations.md`) of the well's volume fractions in a contents snapshot of
the plan (`contents-tracking.md`, `volumeFractionsOf`) and the plan's components. A tool makes the
snapshot (it already has one for the point it shows) and asks per well. The well is checked by the
snapshot alone (`end?.labware` and `end?.well` are passed to `volumeFractionsOf`, so an `end` that
isn't an object gets the snapshot's message for a labware of `undefined`); `deck.checkWell` isn't
used, since a well the snapshot has no record of is simply empty.

**Seeding densities** (2026-11-05; `concentrations.md`, "Cells"). On a labware whose type has a
growth area (`growthAreaOf`, `deck.md`), a well's cells are also given as a **seeding density**,
in cells/cm²: `seedingDensitiesOf` takes each entry of `concentrationsOf` in the cells' family
(`isCellFamily`) and gives `seedingDensity(entry.value, snapshot.totalVolumeOf(labware, well),
growthAreaOf(labware))`, as `{ name, value }`, in `concentrationsOf`'s order. On labware without a
growth area (`growthAreaOf` gives `null`) it gives `[]`, so its cells stay a cell density in
cells/mL, like any concentration. The well's volume is everything it holds, dead volume included,
since those cells settle too. It assumes every cell settles onto the bottom.
`end` is checked as `concentrationsOf` checks it, first; then `growthAreaOf(end.labware)`, called
even when the well carries no cells, so the result never depends on the well's contents to throw;
it throws the deck's message for a labware not on the deck (a well that reaches it has a labware that
is text, so the message is the deck's, e.g. `There's no labware "Bench" on the deck. …`).

### Osmolality
A component's **osmolality** (`docs/glossary.md`; ADR 0016) is its stock's measured osmolality, in
mOsm/kg, or `null` when it has none. It's a property of the whole component, set on its own,
separate from its constituents (Andy, 2026-11-05: osmolality isn't a constituent). A new component
has none, `null`; water is given `0` by the user like any other value, never automatically.

`setOsmolality` sets it, checked by `checkOsmolality` (`osmolality.md`): a finite number, 0 or
more, or `null` to remove it. There's no upper limit (`osmolality.md`, section 2: a concentrated
stock can be far above 300 mOsm/kg, and a limit would refuse some real stock). Setting the value
the component already has gives the same plan back, as an unchanged experiment name does.

Renaming a component keeps its osmolality; changing its color or constituents doesn't touch it;
removing a component removes it with the component.

**A well's osmolality.** At any point in the plan: `osmolalityOf` gives `wellOsmolality`
(`osmolality.md`) of the well's volume fractions in a contents snapshot of the plan
(`contents-tracking.md`, `volumeFractionsOf`) and the plan's components: `{ value, missing }`, an
estimate in mOsm/kg when every component the well holds has an osmolality, else `value` `null` and
the names of those that have none. A tool makes the snapshot and asks per well, and the well is
checked by the snapshot alone, exactly as for `concentrationsOf` (above).

### Stock tables
(Andy, 2026-11-05; roadmap, item 22 of v0.2.0.) A **stock table** (`docs/glossary.md`) is a table,
usually pasted from a spreadsheet, of components to add, one row each, with what each carries and its
osmolality. It isn't kept in the plan: adding one adds ordinary components, and the plan can be
written back out as one, to copy into another plan or a spreadsheet.

Its form is a transfer table's (section 3, "Transfer tables"): a list of rows, each a list of cell
texts, every row the same length, at least one row and one cell. Row 0 is the **header**; column 0
holds the **names**.

**Reading it** (`readStockTable(plan, table, colors)`). Each cell's text is trimmed before it's read.
A **fully blank column** after column 0 (its header and every cell blank) and a **fully blank row** after the header
(every cell blank) are ignored: no problem, nothing read, but still counted by their place.
- **Column 0** is always the names, even when it's fully blank (then every row with text has a
  blank name); its header isn't read (`Name`, `Stock`, anything, or blank).
- **An osmolality column**: a header that reads `Osmolality`, in any capitals, alone or followed by
  `(mOsm/kg)` (spaces allowed inside and before the brackets; `mOsm/kg` exactly, as written here),
  e.g. `Osmolality`, `osmolality (mOsm/kg)`. Optional. A second one is a problem.
- **A constituent column**: any other header, read as a constituent's **name** and **unit** in
  brackets at its end, `Hy-Soy (g/L)`: the text before the last `(`, trimmed, is the name; the text
  inside the brackets, trimmed, is the unit. The unit must be a unit of `CONCENTRATION_UNITS`
  exactly, capitals included, or a key of `UNIT_SPELLINGS` (below), read as that unit; nothing else
  (Andy, 2026-11-05: "keep it tight"). Problems: a blank header over a column with any text; no
  brackets at the end; a blank name (`(mM)`); a unit the tool doesn't know; a name already given by
  a column to its left (names compared as `checkConstituents` compares them: trimmed, exactly;
  only columns read as constituents count, so a column with a header problem, such as `Drug A (g)`,
  doesn't make a later `Drug A (mM)` a second column).
- **Each row after the header** is one **stock**: its name is its first cell. Problems: a blank name
  (in a row that isn't fully blank); a name a component in the plan already has (Andy, 2026-11-05: a
  paste never changes an existing component); a name a row above already has.
- **Each cell** under a constituent column is the **amount** that stock carries, in the column's
  unit; under the osmolality column, its osmolality in mOsm/kg. Commas are removed first
  (thousands separators, `1,500,000`, as transfer tables read amounts); what's left must match
  `/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/` (digits with at most one decimal point, `4.` included as
  transfer tables accept `190.`, optionally an exponent: `4`, `0.5`, `.5`, `4.`, `1.5e6`, `1e-7`; no
  sign before it), and `Number` of it must be finite (`1e400` is a problem at its cell). Blank means the stock doesn't carry that constituent, or has no osmolality (`null`). An
  amount of 0 also means it doesn't carry it (as a blank). An osmolality of 0 is a value (water).
  Anything else is a problem. A cell under an ignored, blank-header or problem header isn't read.
  Cells in a row whose name has a problem are still read (unlike a transfer table's rows), so all
  of a row's problems show at once.
- **Then the plan's rules**, row by row, top to bottom. A row is **tried** when its name cell and its
  own cells have no problem; problems in the header don't stop it (the columns under them just
  aren't read), so the caller can still show which color each row would take. Trying a row is: `addComponent` with its color (below),
  then `setConstituents` with its constituents (in column order), then `setOsmolality`, on the plan
  with every earlier tried row already added. A throw is a problem of the whole row, with that
  message (e.g. a constituent in a unit family that clashes with another component's,
  section 3, "Constituents").
- **Colors**: each tried row takes the first color of `colors` (a list of color texts, in order,
  given by the caller) that no component in the plan and no earlier **added** row has. A row whose
  try fails isn't added and takes no color, so the next tried row may take the same one. With none
  left, the row isn't tried and has a whole-row problem instead (as does each later row that would
  be tried).

It gives `{ stocks, problems }`:
- `stocks`: one per row after the header that isn't fully blank, in row order: `{ row, name, color,
  constituents, osmolality }`, `row` its index, `name` its trimmed first cell (possibly `""`),
  `constituents` a list of `{ name, amount, unit }` in column order (only the amounts above 0 that
  were read), `osmolality` a number or `null`, and `color` the color it takes, or `null` for a row
  that wasn't added (not tried, or its try failed) (so a caller can show which rows will be added).
- `problems`: `{ row, column, message }` each, `column` `null` for a whole-row problem, in reading
  order (the header row left to right, then each row: its name, then its cells left to right, then
  its whole-row problem); a row has at most one whole-row problem.

**Adding it** (`addStocks(plan, table, colors)`): the plan with every stock of `readStockTable(plan,
table, colors)` added, in row order, each as its try added it: one new plan, so a caller records it
as one edit and one Undo takes them all out. Throws the first problem's message if there are any
problems; then, if there are no stocks, `The stock table has no stocks to add. Give it at least one
row under the header.`

**Writing the plan out** (`stockTable(plan)`): the plan's components as a stock table, rows of text,
in the form `readStockTable` reads:
- The header: `Name`; then `Osmolality` if any component has one (not `null`); then one column per
  constituent name, in the order first met (components in the plan's order, each one's
  constituents in its order), headed `Name (unit)` in the unit that name is first met in.
- Then one row per component, in the plan's order: its name; its osmolality as `String(n)`, or blank
  for `null`, if there's an osmolality column; then, for each constituent column, its amount of that
  constituent **converted into the column's unit** (amount × its unit's `factor` ÷ the column unit's
  `factor`; the same family, since a name keeps one family across the plan), written as
  `String(Number(value.toPrecision(12)))` so a conversion's floating-point noise doesn't show
  (500 µM in a column in mM is `0.5`), or blank if it doesn't carry it.
- A plan without components gives `[["Name"]]`.

So a stock table written from a plan reads back, into a plan without those names, as the same
components: names, osmolalities, and constituents with the same amounts (perhaps in another unit of
the same family, by the conversion), with no problems, given enough colors. A name or cell holding
a tab or a line break can't travel as pasted text (`tableToText`, `pasted-table.md`, refuses it).

### Copied decks
(Andy, 2026-11-06; roadmap, item 23 of v0.2.0.) A **copied deck** (`docs/glossary.md`) is what every
well holds at one point of a plan, with the components' details and the plan's labels, as plain
data, so it can be added to another plan's starting contents: the end of one experiment becomes the
start of the next. It isn't kept in the plan.

```js
{
  format:        "biomek-tools copied deck",   // COPIED_DECK_FORMAT
  version:       1,                             // COPIED_DECK_VERSION
  point:         "At the end, after all stages",
  components:    [{ name: "Media", color: "#4e79a7", constituents: [], osmolality: 300 }, …],
  wells:         [{ labware: "Plate1", well: "A1", components: { Media: 180, "Drug A": 20 } }, …],
  wellLabels:    { Plate1: { A1: "Cond 1" } },
  labwareLabels: { Plate1: "Assay plate" },
}
```

**Copying** (`copyDeck(plan, snapshot, point)`): `snapshot` is a `ContentsSnapshot` of this plan at
the point being copied (the caller makes it, as for `concentrationsOf`); `point` is the caller's
text naming that point, kept so the paste can say where it came from (any text, not blank).
- **Wells**: `snapshot.listContents()`, in its order, each `{ labware, well, components }` with only
  the components above `NEGLIGIBLE_MICROLITERS` (contents tracking's allowance for arithmetic
  leftovers), their volumes as the snapshot gives them (not rounded); a well left with none isn't
  listed. A well's mixture stays its components (Andy, 2026-11-06: so concentrations and
  osmolality keep working from the original stocks).
- **Components**: the plan's components that any listed well holds, in the plan's order, each
  `{ name, color, constituents, osmolality }` as the plan has it (Andy, 2026-11-06: their details
  come along).
- **Labels**: the plan's `wellLabels` and `labwareLabels`, all of them (Andy, 2026-11-06), since a
  label belongs to a place on the deck for the whole run, not to a point.
- **Refused** when the snapshot has a problem that isn't an overfill (a draw into the dead volume
  or an overdraw), since then what the wells hold isn't what the Biomek would leave: `The deck can't
  be copied at this point: a transfer before it draws more than a well can give. Fix the overdraws
  first, or copy from an earlier point.` An overfill is copied as tracked (the volume that was put
  in; the tool can't know what spilled), as the deck shows it.
- A point where no well holds anything gives `wells: []` and `components: []` (the caller says so).

**Pasting** (`pasteDeck(plan, copied, colors)`): the plan with the copied deck **added** to its
starting contents, as one new plan, so a caller records it as one edit (Andy, 2026-11-06: into any
plan's Start, on top of what it holds). `colors` is the list new components' colors come from, in
order (as for stock tables). In this order, throwing the first problem's message and pasting none:
1. **The form** (section 5): an object with exactly the properties above, `format` the
   `COPIED_DECK_FORMAT`, `version` a whole number from 1 to `COPIED_DECK_VERSION` (a later version
   is refused, saying the copy comes from a newer version of the tool), `point` non-blank text,
   `components` a list of components (each with exactly `name`, `color`, `constituents`,
   `osmolality`), `wells` a list of `{ labware, well, components }` each well at most once, and the
   two label objects in the plan's form. The contents are checked by the plan's own edits below,
   so their messages are the usual ones.
2. **Components**, in the copy's order. A component whose name **is already in the plan** must
   carry the same constituents (compared as JSON, in order) and the same osmolality; it keeps the
   plan's color. Otherwise it's refused: `Media is already in this plan with different contents or
   osmolality. Rename one of them, or make them match, then paste again.` A **new** component is
   added (`addComponent`, `setConstituents`, `setOsmolality`) with its copied color if no component
   in the plan has it yet, else the first color of `colors` that none has; with none free: `There's
   no free color for Media: all 30 are taken. Remove a component first.` (30 is `colors.length`).
3. **Wells**, in the copy's order, each component's volume **added** on top of what the well holds
   at the start (`addToWells`), so its messages apply (a labware or well not on the deck). An
   overfill this causes isn't refused; it's shown like any other.
4. **Well labels**: each copied label is set (`setWellLabel`) unless the well already has it; a well
   with a **different** label is refused: `Assay plate A1 is already named “Cond 2” here, but “Cond
   1” in the copy. Rename one of them, then paste again.` (the labware by its label, as the plan has
   it at that moment).
5. **Labware labels**: each copied label is set (`setLabel`) unless the labware already has it; a
   labware with a **different** label is refused: `Plate1 is labeled “Plate A” here, but “Assay
   plate” in the copy. Rename one of them, then paste again.`; a label another labware has gives
   `setLabel`'s message.

Pasting the same copy twice adds its volumes twice (as filling wells twice does); its components
and labels match the first time's, so they change nothing. Plan files don't change: a pasted deck
is ordinary starting contents, components and labels.

### Contents problems
`contents-tracking` reports each transfer that asks a well for more than its usable volume (a
`"dead-volume"` or `"overdraw"` problem) and each transfer that fills a well over its capacity (an
`"overfill"`; `contents-tracking.md`). A stage **has a contents problem** if any of its transfers
has one of any kind (but see "Not in version 1"). A well that starts over its capacity is a problem
of the starting contents, not of any stage. The glossary's "overdraw" keeps its everyday meaning,
a transfer asking for more than it can get; in contents tracking's terms that is a
`"dead-volume"` or `"overdraw"` problem.

### Labware
- The labware a plan **uses** are those in its starting contents, in any transfer, or with a well
  label (Andy, 2026-11-01, to confirm: so a plate whose wells are only named is brought out), in the deck's
  order.
- A labware's label is text; spaces at the ends are removed, and a blank label, or one equal to the
  labware's name, goes back to the name.
- **No two labware have the same label** (Andy, 2026-10-26), so the page never shows two labware by
  one name. A labware without a label counts as labeled by its name, so a plate can't be
  labeled "Deep" while another labware called Deep has no label.
- **Setting all the labels at once** (`setLabels`) replaces the whole table, and checks it as a
  whole: whether two labware share a label is judged on the new table, not one label at a time. So
  swapping two labels, or labeling Deep "D1" and Plate "Deep", works in one step. It's **strict**:
  it refuses what `setLabel` would tidy (spaces at the ends, a blank label, a label equal to its own
  labware's name), because it's for a table already in the plan's own form, such as one read from a
  plan file (`plan-file.md`), not for what someone types.

### Well labels
(Andy, 2026-11-01, from the randomizer preview: labeling the wells that hold each condition makes
a plate's wells easy to recognize.)
- **Labeling a well** (`setWellLabel`): the label's spaces at the ends are removed; a label that's
  blank after that removes the well's label. Any text is a label, and two wells may share one, so
  nothing else is checked. Giving a well the label it already has, or removing a label it doesn't
  have, gives back the same plan, as `setExperimentName` does, so a caller can tell nothing
  changed.
- **Setting all the well labels at once** (`setWellLabels`) replaces the whole table, and is
  **strict**, as `setLabels` is: it refuses what `setWellLabel` would tidy (spaces at the ends, a
  blank label), and a labware listed with no wells, because it's for a table already in the plan's
  own form, such as one read from a plan file.

### Randomizations
(Andy, 2026-10-31 and 2026-11-01; ADR 0012.) A **randomization** (`docs/glossary.md`) spreads
replicates of several **sources** over a set of **wells to fill**, at random, and makes one stage
per source moving them. It's part of the plan, so it's undone and saved like any edit. Each is:

```js
{
  id:        "r1",                 // "r" and one more than the largest number in use (addRandomization)
  beforeId:  "4",                  // where it sits while it has no stages (below)
  sources:   [{ labware: "Deep", well: "A1", replicates: 4, filler: false, sharesTips: false }, …],
  fill:      [{ labware: "Plate1", well: "B2" }, …],
  seed:      37,                   // or null
  volume:    50,                   // µL per transfer, or null
  settings:  { /* a stage's six settings */ },   // its first run's; null once it has stages
  tipType:   "BC230",                             // its first run's; null once it has stages
  probes:    [1, 2, 3, 4],                        // its first run's; null once it has stages
  stages:    [{ labware: "Deep", well: "A1", stage: "5" }, …],   // what its last run made
}
```

- **`sources`**: wells on the deck, each once, in the order given. `replicates` is a whole number of
  at least 1, or `null` (not given yet). Any number of sources may be **filler wells** (`filler:
  true`), each with `replicates` always `null`; together they're the **filler**, which fills the
  wells the replicates leave over, drawing from the filler wells in their order in `sources` (Andy,
  2026-11-02: one well can't always hold enough filler). Any well may be
  a source, whatever it holds (Andy, 2026-11-01: never guessed from contents); one that holds
  nothing at that point just makes overdraws. **`sharesTips`** is `true` or `false`: whether the
  source's stage shares the tips of the source just before it in `sources` (below, "Sharing tips");
  always `false` for the first source.
- **`fill`**: the wells to fill, on any labware, each once, none of them a source, kept in the
  deck's order of labware and each labware's grid order (`wellNames()`), whatever order they were
  given in, so the same wells always form the same pool.
- **`seed`**: a whole number from 1 to 999,999, or `null`. **`volume`**: a number above 0, or
  `null`.
- **`settings`**, **`tipType`** and **`probes`**: **what its first run gives**, only while it has no
  stages, and `null` (all three) once it has (Andy, 2026-11-05, item 20: one source of truth; until
  then they were the settings and tips every run gave every stage). While it has no stages:
  `settings` are the settings every stage its first run makes gets (`stage-list.md`; the mixing
  rule of section 3 applies; they can't be a mix step's, `MIX_STEP_MODE`), and `tipType` and
  `probes` the tips each of its source groups loads (as `setTipType` and `setTipProbes` check them;
  `probes` stored smallest first). Once it has stages, **its stages' own settings and their tip
  changes are its settings and tips**, and nothing else holds a copy: a caller shows them from the
  stages (e.g. the value they share, or that they differ) and changes them on the stages, one at a
  time (`changeStageSettings`, `setStageMix`, `setTipType`, `setTipProbes`) or all at once on a run
  (`runRandomization`'s `forAll`, below). A run always leaves it with stages (a source taking
  replicates always gets wells: more replicates than wells is a problem), and only a run gives it
  stages, so the three are `null` exactly when `stages` isn't empty.
- **`stages`**: the stages it **owns**, one per source its last run gave a stage, in stage order,
  each with its source's well. Only running and removing change it, so a source taken out of
  `sources` keeps its stage here until the next run removes it.

**Where it sits.** Once it owns stages, it sits where they are: they're consecutive in the stage
order, its first stage starts a tip group, and so does the stage just after its last (if any), so
**no stage outside it shares a tip group with its stages** (Andy, 2026-11-05: its stages may share
tips with each other, as its sources say, "Sharing tips" below; before then each was the only stage
of its tip group). Until then, it sits just before stage
`beforeId` (or last, for `null`). Several randomizations sitting at one place are in the order of
`randomizations`. `beforeId` is always the first stage of a tip group, a randomization's first
stage, or `null`, and never a stage another randomization owns other than its first:
- `addRandomization` refuses any other `beforeId`;
- `removeStage`, removing the stage a randomization sits before, moves it to the next stage in the
  stage order (or `null`), giving that stage a tip change loading the tips in use there if it isn't
  the first of a tip group (the tool adds tips where a randomization needs them);
- `placeRandomization(plan, id, beforeId)` moves one that hasn't run (for a caller adding a stage
  just below it, so it stays above the new stage);
- each run sets `beforeId` to the stage just after its last stage (or `null`), and every edit keeps
  it so while it has stages, so it's ready if a later run has no stages (from the build, 2026-11-01:
  otherwise a plan could be saved that its file can't open);
- `addStage` with `takeTips` before the stage a randomization without stages sits before moves the
  randomization onto the new stage, which now starts the tip group;
- on a first run, randomizations without stages sitting at the same place and earlier in
  `randomizations` move onto its first stage, so they stay above it.

**It owns its stages** (Andy, 2026-11-01): their transfers, names and places are changed only
through it, so they always match what it last ran with. `randomizationOf(plan, stageId)` says which
randomization owns a stage. **Their pipetting settings and tips are theirs to edit** (Andy,
2026-11-05, item 20): `changeStageSettings` and `setStageMix` on an owned stage, and `setTipType`
and `setTipProbes` on an owned stage's tip change (or `START`'s, when its first stage is the plan's
first), work as on any stage; a run keeps what they set (below, "Running"). **Every other edit of
them is refused, in the logic** (2026-11-05, item 20, as for transfer tables: until then only the
page kept them, and a plan that lost a run randomization's stages couldn't be saved and opened
again, since its settings are `null`):
- `addTransfer`, `addTransfers`, `changeVolume`, `removeTransfer` on an owned stage;
- `renameStage` of an owned stage (it's named after its source);
- `removeStage` of an owned stage;
- `removeTipChange` of an owned stage's tip change (whether its stages share tips is its sources'
  `sharesTips`), and, as before, of the stage just after its last stage;
- `addTipChange` before an owned stage (splitting one of its source groups);
- `addStage`, `addMixStep` (with or without `takeTips`), `addStageWithNewTips`,
  `addMixStepWithNewTips`, `addRandomization`, `placeRandomization` and `addTransferTable` with a
  `beforeId` that is an owned stage other than its first, and `addStage` and `addMixStep` with
  `takeTips` before its first stage (the new stage would take its first group's tips);
- `addStage` and `addMixStep` without `takeTips` whose new stage would land just after its last
  stage, joining its last tip group (a `beforeId` that's the stage just after its last stage, or
  `null` when its last stage is the plan's last); `addStageWithNewTips` and
  `addMixStepWithNewTips` there are allowed;
- `moveItems` as before (section 3, "Moving and copying").

`addStage` and `addMixStep` without `takeTips` before its first stage when that's the plan's first
stage are allowed: the new stage becomes the first, on the `START` tips, and the randomization's
first stage gets a tip change of its own loading the tips it had, as `addStageWithNewTips` gives.
**The refusals are for calls from outside**: a randomization's own edits (`runRandomization`,
`removeRandomization`, `moveItems`, `pasteItems`, `moveWell`) change its stages through internal
helpers that skip them but keep every other rule of the edit they stand for (the stage rule, the
tip rules, and `removeStage`'s rules for randomizations). Two rules keep its stages off the tips of
stages outside it whatever else is edited:
- `removeTipChange` refuses the tip change of the stage just after a randomization's last stage:
  `This tip change keeps stage 7, “Media”, off the randomization's tips. A randomization never
  shares tips with other stages.` (Until 2026-11-05 it ended `A randomization never shares tips.`;
  its stages may now share tips with each other, so the message says with whom.)
- `removeStage`, removing the stage just after a randomization's last stage, gives the next stage
  a tip change loading the tips the removed one used, if it has none.
- `removeTipChange` also refuses the tip change of a stage a randomization without stages sits
  before: `A randomization sits before stage 2, “Top up”, between tip groups, so these tips can't
  be removed.`

**Sharing tips** (Andy, 2026-11-05, from a preview he approved; ADR 0018). A randomization is a
point of heavy tip use, and related sources, such as one drug at rising concentrations run lowest
first, can safely share tips. So each source says whether its stage **shares the tips** of the
source just before it in `sources` (`sharesTips`): sources choose only *whether* new tips come
before them. Which tips each source group loads is its first stage's tip change (since 2026-11-05,
item 20; until then one `tipType` and `probes` for the whole randomization). The rules:
- **Source groups** (`docs/glossary.md`): the sources split into groups that share tips: a group
  starts at each source with `sharesTips` `false` and holds the sources just after it with
  `sharesTips` `true`. `sourceGroups(sources)` gives them, as lists of indexes into `sources`, e.g.
  `[[0, 1, 2], [3], [4, 5]]`.
- **The first source never shares tips** (`sharesTips` is always `false` for it), so a
  randomization still never shares tips with a stage outside it (Andy, 2026-11-01, kept). A new
  source, from any caller, starts with `false` (new tips of its own), so every source starts in a
  group of its own, as before this change.
- **A run's tips**: the stages of one source group share one set of tips (the group's first stage
  that the run makes starts new tips, the others have no tip change); which tips each group loads is step 7 of
  "Running", below. A source that gets no stage
  (on an exact fit, the filler) leaves its group as it is: the group's other stages still share.
- **The filler's stage**, one for all filler wells (step 3 of "Running"), is in the source group of
  the **first filler well**, and sits at its place; the other filler wells' `sharesTips` matter only
  for where groups start, as any source's do.
- **Order matters**: the pool numbers sources by their place in `sources` (step 1 of "Running"),
  so reordering sources changes the random layout even with the same seed (Andy accepted this,
  2026-11-05), and the run puts every stage in the sources' order, existing stages included (step 6).
- **Editing a list of sources** by the container rule (ADR 0014; glossary "Container rule"), with
  source groups as the containers and sources as what goes inside them. These functions work on
  any list of objects that each have a `sharesTips` of `true` or `false` (other properties are
  kept as they are), so a caller can edit its own unsaved copy of a randomization's sources and
  then save it with `setRandomization`. Each returns a new list; an entry whose `sharesTips`
  doesn't change is the same object, and one that changes is a shallow copy with only `sharesTips`
  changed.
  - **`setSourceSharesTips(sources, index, shares)`**: source `index` shares the tips before it
    (`true`: it joins the group above, with any sources sharing its tips after it) or starts new
    tips (`false`: it splits its group there). Setting the first source to `true` is refused. An
    unchanged value gives back the same list.
  - **`moveSource(sources, from, place)`**: the source at `from` moved to `place`, a place in the
    list's source groups (before the move), one of:
    - `{ kind: "between", index }`: between groups, just before group `index` (`0` above the first;
      the number of groups, below the last). The source becomes a group of its own: `sharesTips`
      `false`.
    - `{ kind: "inGroup", index, position }`: inside group `index`, just before its source at
      `position` (`0` at its top; the group's length, at its bottom). The source shares that
      group's tips (`true`), unless it lands **at the top** of the group (no source of the group
      that stays comes before it): then it starts the group (`false`) and the source that was the
      group's first now shares its tips (`true`), so the group keeps one set of tips whichever
      source is first.
    - **Taking it out** first: if the moved source starts a group (`false`, or the first source)
      and the source just after it shares its tips, that source now starts the group (`false`): a
      group a source leaves keeps its tips.
    - A place may point at the moved source itself, as `moveItems`' places may: inside a group, it
      means just before the first source of that group, at `position` or after it, that isn't the
      moved one, or the group's end; between groups, just before the first source, at the start of
      group `index` or after it, that isn't the moved one, or the list's end. Moving a group's only
      source to a place in its own group leaves it a group of its own.
    - After the move the first source's `sharesTips` is `false` (so a source moved to the very top
      starts new tips, and the old first shares them only if it was dropped inside group 0).
    - If the result has every entry in the same place with the same `sharesTips`, the **same list**
      is given back, so a caller can tell nothing moved.
    - E.g. sources A, B, C, D with groups `[[0, 1], [2, 3]]` (A and B share; C and D share): moving
      D (`3`) to `{ kind: "inGroup", index: 0, position: 1 }` gives A, D, B, C with D and B sharing
      A's tips and C alone; moving A (`0`) to `{ kind: "between", index: 2 }` gives B, C, D, A,
      groups `[[0], [1, 2], [3]]` (B now starts A's old group); moving C (`2`) to `{ kind:
      "inGroup", index: 0, position: 0 }` gives C, A, B, D: C starts the group, A and B share its
      tips, and D, left alone, starts new tips.
  - **`removeSources(sources, indexes)`**: the sources at `indexes` (each once; any order) taken
    out; each group they leave keeps its tips: the first source left of a group whose first was
    taken out starts it (`false`). After it the first source's `sharesTips` is `false`.
    `removeSources(sources, [])` gives back the same list (only if its first source's `sharesTips`
    is already `false`; see the next point).
  - **The first source is always made `false`** by `setSourceSharesTips`, `moveSource` and
    `removeSources`, so their result never holds a first source sharing tips, even when the list
    given did (a caller's list may; `sourceGroups` reads such a first source as starting a group
    anyway). **A result that differs from the list given only by that is a change**: a new list,
    its first entry a shallow copy with `sharesTips` `false`, not the same list. (Decided in the
    hands-off workflow, 2026-11-05: "the same list" means "nothing differs", so a caller saving
    the result with `setRandomization`, which refuses a first source sharing tips, always gets a
    list it accepts; the other choice would hand back a list `setRandomization` refuses.) E.g.
    `setSourceSharesTips(list, 2, true)` on a list whose first source holds `true` and whose source
    2 already shares gives a new list whose first source holds `false`.
  - Adding a source is the caller's: it appends `{ …, sharesTips: false }` (new tips of its own).

**Where a new randomization's settings come from** (2026-11-05, item 20): `addRandomization`
gives it, for its first run, the settings of the **nearest transfer stage** to its place, as
`addStage` copies them (section 3, "Stages": the nearest before it in the stage order, else the
nearest after it, else `defaultSettings()`), and the tips **in use just before its place** (the tip
type and probes of the tip group of the stage just before `beforeId` in the stage order, or of the
plan's last stage for `null`, or `START`'s when `beforeId` is the first stage). So a mix step just
before the place is passed over, as `addStage` passes it over.

**Running** (`runRandomization(plan, id, forAll)`), when it has no problems (below), as one edit.
Whether it's a **first run** (no `stages` before it) is noted first, with, for a later run, its
stages before the run, their settings and the tips each one's tip group loaded.
1. **The pool** (`random-pool.md`): an item per source, keyed `"source 1"`, `"source 2"` … by its
   place in `sources`, with its replicates, except that the filler wells are one item, keyed by the
   **first filler well**'s place, the others left out; the filler's key (the first filler well's),
   or `null`; the wells to fill, keyed `"well 1"`, `"well 2"` … by their place in `fill`; the seed.
   `assignPool` gives each well to fill its source, or the filler. (So the pool, and the shuffle,
   are the same however many filler wells there are.)
1a. **The filler's shares** (`fillerShares`, below): the wells given to the filler, taken in
   `fill`'s order, go to the filler wells in their order in `sources`: the first takes as many as
   its share, the next the next ones, and so on.
2. **The place**: the stage just after its last owned stage, or, with none, `beforeId` (`null`:
   last). Noted before anything changes.
3. **New stages first**: each source that gets wells but has no stage in `stages` gets one (the
   filler may get none, on an exact fit: then it gets no stage, as decided for one filler).
   **The filler has one stage for all its filler wells** (Andy, 2026-11-02: the liquid is the same,
   so one set of tips). The filler **gets wells** when its shares add up to more than 0, whatever
   the first filler well's own share. **Its stage** is the first entry in `stages`, in stage order,
   that names any of its current filler wells; it's kept (same stage ID and tips), and the run
   re-keys its entry to the first filler well. With none, a new one is made, its entry naming the
   first filler well. Every other entry naming a filler well is removed with its stage in step 4.
   An entry naming a well that's now a source taking replicates is that source's stage, as for any
   source. So the other filler wells have no entry. Each new stage is added with
   `addStageWithNewTips` (section 3, "Tip changes and tip groups") before the place, in `sources`'
   order, **named** as its source is (below). So every new stage has new tips for now (step 7 takes
   away those its source group shares), and the stage after keeps the tips it had. **A new stage's
   settings** (Andy, 2026-11-05, item 20), as `changeStageSettings`: on a first run, the
   randomization's `settings`. On a later run, the first of these that applies:
   - **the filler's new stage**, when this run removes stages (step 4): the settings of the last of
     the stages it removes, in stage order before the run (normally the old filler stage, as the
     filler wells are usually the last sources);
   - the settings of the **nearest stage the randomization keeps** (one it had before the run and
     this run doesn't remove) whose source comes before the new stage's source in `sources` (the
     filler's stage at its first filler well's place), else the nearest whose source comes after it;
   - when it keeps none of its stages (every source replaced): the settings of its **old first
     stage** (the first of its stages before the run).
   So a new stage takes its settings from the randomization's own stages, never from a stage
   outside it. (`addStageWithNewTips` copies the nearest transfer stage, which may be outside the
   randomization; this replaces it.)
4. **Then old stages go**: each stage in `stages` whose source is no longer in `sources`, or now
   gets no wells (for the filler's stage: the filler as a whole gets none), and each other entry
   naming a filler well (step 3), is removed (`removeStage`). (New stages come first, so a run never
   tries to remove a plan's only stage.)
5. **Each source's stage**: its transfers replaced by one transfer of `volume` from the source to
   each of its wells, in `fill`'s order (the filler's stage: from the filler well each well was
   shared to, in `fill`'s order). **Its settings aren't changed** (Andy, 2026-11-05, item 20: until
   then every run set them to `settings`): a kept stage keeps its own, a new one has step 3's. (Its
   tips are set in step 7.) It's **named** as its source is now: `sourceName` of its source, and for the filler's
   stage, of the first filler well that holds something just before the randomization (its label,
   if it has one, counts as for any source), or of the first filler well if none holds anything.
   So a run renames a stage whose source holds something else since the last run (Andy,
   2026-11-03). Contents just before the randomization are replayed once per run, not once per
   source.
6. **Stages in the sources' order** (Andy, 2026-11-05; before this, a run left the stages it had
   already made where they were, so reordering sources didn't reorder stages): the randomization's
   stages are put in the order of their sources in `sources` (the filler's stage at the first
   filler well's place), consecutive, starting where its first stage now is in the stage order.
   Only the randomization's own stages move; every other stage keeps its place. A randomization
   without stages that sat before one of this randomization's stages now sits before its new
   first stage, so it stays above it (section 3, "Where it sits"). Each stage keeps
   its ID, name, settings and transfers; the operation list is rebuilt in the new stage order as a
   move rebuilds it (section 3, "Moving and copying", "The operation list after a move"), or left
   as it is if its blocks already follow it.
7. **Tips, by source group**: for each source group (above, "Sharing tips") that has stages, its
   first stage in stage order **starts the group's tips** (its own tip change, added if it has
   none; or, if it's now the plan's first stage, `START`'s, and a tip change keyed by it is taken
   out, since none is ever keyed by the first stage), and every other stage of the group has **no
   tip change** (one it had is taken out), so it shares those tips. **Which tips** (Andy,
   2026-11-05, item 20), taking the groups in `sources`' order: on a first run, the randomization's
   `tipType` and `probes`. On a later run, the first of these that applies:
   - **a group with a stage the randomization keeps**: the tips the tip group of its first such
     stage (in stage order before the run) loaded before the run, whether or not that stage
     started its tip group; so a group whose first source was taken out (A1 and A2 sharing, A1
     removed) keeps the tips it had;
   - **a group with only new stages**, whose first stage took its settings from a stage this run
     removes (step 3: the filler's new stage, or every source replaced): the tips that removed
     stage's tip group loaded;
   - otherwise the tips of the source group before it in `sources` (as just worked out), else of
     the nearest group after it that has a stage the randomization keeps.
   So a group keeps the tips set on it, and a new group starts like its neighbor. The stage just
   after the randomization's last stage, if any, keeps its own tip change (step 3 gives it one when
   a new stage goes before it, and a run never takes it away). So no stage outside the
   randomization shares its tips, and nothing about tip changes outside it changes.
8. `stages` lists them in stage order, and `beforeId` is set (above).
9. **All at once** (`forAll`; Andy, 2026-11-05, item 20: "otherwise you'd need to set dozens of
   settings manually"): an object (default `{}`) giving any of `sourceMode`, `sourceMixes`,
   `destinationMode`, `destinationMixes` (a pipetting mode's name for that end, `modesFor`; whether
   that end mixes, `true` or `false`), `tipType` (in `TIP_TYPES`) and `probes` (as `setTipProbes`
   takes them). Each one given is applied to **every** stage the randomization now owns (the four
   settings) or **every** tip change starting one of its source groups (`tipType`, `probes`; for a
   group whose first stage is the plan's first, `START`'s tip change); each one left out leaves
   every stage or tip change as it is. For an end, on each stage: the mode is `forAll`'s if given,
   else the stage's own; whether it mixes is `forAll`'s if given, else the stage's own, except that
   a mode given that can't mix, with no mixing given, turns that end's mixing off (as a stage's box
   does); then the end's settings are the mode's (`modeSettings`, with its mixing technique when it
   mixes) and its mix the stage's own if it already mixed, else `DEFAULT_MIX`, or `null` when it
   doesn't mix. A stage whose end isn't one of the modes (`modeOf` gives `null`) and for which
   neither that end's mode nor its mixing is given keeps that end as it is. **Refused, changing
   nothing** (the whole run): a mixing value given without a mode for that end, when any stage's
   end isn't one of the modes; mixing turned on (`true`) without a mode, when any stage's mode at
   that end can't mix; a mode given that can't mix with mixing turned on (`modeSettings`' message).
   Stages are checked in stage order; the first is reported (section 5). (A caller showing "the
   value they share, or that they differ" passes only the values the user chose.)
10. `settings`, `tipType` and `probes` are set to `null` (above: the stages hold them now).

**Its stages' shared values** (`randomizationStageValues(plan, id)`; 2026-11-05, item 20, for a
caller showing its settings): `{ sourceMode, sourceMixes, destinationMode, destinationMixes,
tipType, probeCount }`. Once it has stages, each is the value **every one** of its stages (for the
modes and mixing: `modeOf` and whether the end's mix isn't `null`) or every tip change starting one
of its source groups (for `tipType` and `probeCount`, the number of probes; `START`'s for a group
whose first stage is the plan's first) shares, or `null` when they differ; a mode is also `null`
when any stage's end isn't one of the modes. With no stages, they're its own `settings`',
`tipType` and number of `probes` (a mode `null` if its settings' end isn't one of the modes). E.g.
three stages aspirating Medium, Medium and Slow, each dispensing Fast without mixing, on BC230 4
probes: `{ sourceMode: null, sourceMixes: false, destinationMode: "Fast", destinationMixes: false,
tipType: "BC230", probeCount: 4 }`. Throws if there's no randomization `id`.

So a run with every source starting new tips (`sharesTips` `false` everywhere, as every
randomization had before 2026-11-05) gives exactly what it gave before: each stage the only stage
of its tip group.

**The filler's shares** (`fillerShares(plan, id)`): how many of the filler's wells each filler well
fills, as `[{ index, count }]`, one per filler well in `sources`' order (`index` its place in
`sources`, from 0). The filler's wells number the pool's spare wells (`random-pool`'s
`spareWellCount`). Every filler well but the last takes as many whole transfers of `volume` as fit
in its **usable volume** (contents tracking's `usableVolumeOf`: what it holds above its labware
type's dead volume) just before the randomization (as `sourceName` replays it), or the wells still
left if fewer; the last takes all the wells still left, and may draw into its dead volume or be
overdrawn (a contents problem, as any other). A transfer is never split between two wells, so a
filler well may be left with a little more than its dead volume (Andy, 2026-11-02). A well's fit is
`floor((usable + 0.000001) / volume)`, the 0.000001 µL being contents tracking's allowance for
arithmetic leftovers ("Tiny amounts"), so a usable volume of exactly `n` transfers gives `n`. E.g.
three filler wells each 750 µL above their dead volume, 100 µL transfers and 18 wells for the
filler: `7`, `7` and `4`. `[]` if it has no filler wells; `null` if `volume` is `null`, or a
source's replicates aren't known yet (`spareWellCount` gives `null`). When `spareWellCount` gives
`0` (an exact fit, or more replicates than wells to fill), every share is `0`; with only filler
wells, every well to fill is spare. Throws if there's no randomization `id`.

With the same sources (in the same order), replicates, filler, wells to fill and seed, a run gives
every well the same source as before, so running again only applies changed tip sharing, volume or
`forAll` (each stage keeping its own settings and each group its tips otherwise); a new seed, or sources in a new order, shuffles again (Andy, 2026-11-01 and
2026-11-05). Changing only `sharesTips` changes no well's source.

**Out of date** (`isRandomizationOutOfDate(plan, id)`; Andy, 2026-11-02 and 2026-11-03). A
randomization's stages are what its last run made; other edits never rerun it. A run's result
depends on its own values and, through the filler's shares, on what the filler wells hold, and a
stage's name on what its source holds, so an edit elsewhere can leave its stages different from
what a run would make now. A randomization is **out of date** when it has run (its `stages` isn't
empty) and either it now has problems (checked first: a run would refuse), or running it now (on a
copy, thrown away) would give different stages: a different number of stages, or, for any of its
stages in order, a different source well, name, list of transfers (each one's source,
destination and volume, in order), or **whether it starts new tips** (has a tip change of its own,
or is the plan's first stage; Andy, 2026-11-05, shared tips: so stored sharing that its stages
don't follow, such as from `setRandomization` without a run, reads as out of date). Stage IDs
aren't compared, since a run may make them fresh. **Settings and tips aren't compared** (2026-11-05,
item 20): they're the stages' own, so changing them never makes it out of date, and the trial run
has no `forAll`. (Since stages are compared in stage order and a
run puts them in the sources' order, sources reordered without a run also read as out of date.)
**Plans saved before this change whose stages aren't in their sources' order** (plan files
versions 6 to 9, and copied items versions 1 and 2): before 2026-11-05 a run left stages it had
already made where they were and put new ones just before the place, so a randomization's stage
order could differ from its sources' order, e.g. a first filler well unmarked so it takes
replicates (its old filler stage stays first, as its own, and the new filler stage comes after the
other sources'), or a filler toggled on a row above sources that already had stages. Such a
randomization now **opens out of date** (a trial run puts its stages in the sources' order, so its
stages in order name different source wells), and **Update reorders its stages**, which changes
the order of their rows and Transfer From File files in the Biomek files (the same transfers, in
the sources' order). Nothing reorders them without Update.
One that hasn't run is never out of date. Throws if there's no randomization `id`. (A plan saved
before names were compared, whose sources' contents changed after a run, opens out of date; one
Update clears it.) A tool shows it and lets the user run it again; nothing
reruns it by itself (Andy: it could rearrange a plate already checked).

**Sets of new tips a run makes** (`tipSetsToMake(plan, id)`, for a caller describing a run before
it's made): the number of tip groups among the stages a trial run (as "Out of date" makes one, on a
copy, thrown away) gives the randomization: the source groups that get at least one stage. E.g.
A1, A2 and A3 sharing and the filler on new tips: `2`; every source on new tips: the number of
stages. `null` while it can't run (it has problems). Throws if there's no randomization `id`. (A
count of `sourceGroups` alone would be wrong where a source gets no stage, such as a filler on an
exact fit that starts a group of its own.)

**A source's name** (`sourceName`; for a new stage, and for the caller to show): its well label if
it has one (section 3, "Well labels"); otherwise the component it holds most of just before the
randomization (contents tracking's `replay` over the operations of the stages with transfers before
its place in the stage order), the first in the well's component order on a tie, followed by ` +N`
when it holds N other components too, e.g. `Drug A +2`; otherwise, if it holds nothing then, its
labware's label and well name, e.g. `Deep A1`.

**Problems** (`randomizationProblems`), each a short message (they're the pool's problems, plus the
designer's own, in the designer's words), in this order:

| Problem | Message |
|---|---|
| no sources | `Pick at least one source.` |
| no wells to fill | `Pick the wells to fill.` |
| only the filler | `Add a source that isn't the filler.` |
| a source's replicates are `null` | `Drug A needs a number of replicates.` (the source's name) |
| too many replicates | `64 replicates, but only 60 wells to fill.` (`1 well to fill` for one) |
| wells left over, no filler | `12 wells left over: make a source the filler, or unpick them.` (`1 well`) |
| no seed | `Type a seed.` |
| no volume | `Set the volume.` |
| two filler wells holding something hold different liquids (different components, or a component's share of the well differing by more than 0.000001, just before the randomization; filler wells holding nothing are left out) | `The filler wells hold different liquids.` (Andy, 2026-11-02: they share a stage and tips) |

With no sources, or no wells to fill, the pool's problems (replicates, too many, left over) aren't
listed, since they'd only follow from that one.

**Removing** (`removeRandomization`) takes out the randomization and every stage it owns, as one
edit (Andy, 2026-11-01). Tip changes its runs added elsewhere (on the stage after it) stay: the
tool never takes tips away or joins tip groups by itself.

### Transfer tables
(Andy, 2026-11-05; roadmap, item 19 of v0.2.0; ADR 0019.) A **transfer table** (`docs/glossary.md`)
is a table, usually pasted from a spreadsheet, saying how many µL of each component go into each
labeled well, kept in the plan as one unit that **owns** one stage per component. It's part of the
plan, so it's undone and saved like any edit. Each is:

```js
{
  id:      "t1",          // "t" and one more than the largest number in use (addTransferTable)
  table:   [["Dest Well Label", "Media", "Drug A"],
            ["Control",         "190",   ""],
            ["A low",           "190",   "2"]],
  sources: { Media: [{ labware: "Res1", well: "1" }, { labware: "Res1", well: "2" }],
             "Drug A": [{ labware: "Deep1", well: "A1" }] },
  stages:  [{ component: "Media", stage: "5" }, { component: "Drug A", stage: "6" }],
}
```

- **`table`**: the grid as text, a list of rows, each a list of cell texts, kept exactly as given
  (spaces included), so the caller can show it as the user left it. At least two rows, every row
  the same length, at least two cells. Row 0 is the **header**; column 0 holds the **well labels**.
- **`sources`**: for each component, the wells its column draws from, **in order**: a non-empty list
  of wells on the deck, each once. Its keys are components in the plan (in any order); a key whose
  column isn't in the table is kept and unused (so a column deleted and brought back keeps its
  wells).
- **`stages`**: the stages it owns, one per component whose column has an amount, **in column
  order**, each with its component. Only adding, updating and removing change it (and
  `renameComponent`, below).
- **No pipetting settings or tips** are stored here (Andy, 2026-11-05: one source of truth). They
  live only on its stages and their tip changes, and are edited there as any stage's are (below,
  "What can be edited").

**Reading the table** (`readTransferTable(plan, table)`). Each cell's text is trimmed before it's
read (the stored text keeps its spaces). Each column after the first is a **component column**:
- **Its header** names a component in the plan, exactly (after trimming). A blank header makes no
  column; that's a problem only if the column has any amount (below). A header naming no component,
  or the same component as a column to its left, is a problem.
- **Each row after the header** is one **well label**: its first cell, which must be a label some
  well in the plan has (`wellLabels`), and not the label of a row above it. A row fills **every
  well with that label** (labels may repeat: replicate wells; Andy, 2026-11-05), in deck order
  (the deck's labware order, then each grid's `wellNames()` order).
- **Each cell** of a row and a component column is an **amount**, µL of that component to add to
  each of the row's wells: blank or a number. Commas are removed first (thousands separators,
  `1,500`); what's left must be digits with at most one decimal point (`190`, `2.5`, `.5`; no sign,
  no exponent). Blank, `0`, `0.0` and the like **add nothing**.
- A cell under a blank header or a problem header, or in a problem row, isn't read as an amount.
- **A fully blank row** (every cell blank after trimming) is ignored: it fills nothing and is no
  problem, so stray empty lines are harmless. Rows are still counted by their place in the grid.
- A table of only the header row, or only the label column, is read as any other: it has no
  amounts, so its draft's problem is that it adds nothing (below).

It gives `{ columns, problems }`:
- `columns`: one per component column with a valid header, left to right, `{ column, component,
  amounts }`, `column` its index in the rows, `amounts` one per row with a valid label and an amount
  above 0, in row order: `{ row, label, wells, volume }`, `wells` the label's wells in deck order.
  A column with no amounts is still listed (it makes no stage).
- `problems`: `{ row, column, message }` each, `row` and `column` the cell's indexes, in reading
  order (the header row left to right, then each row: its label, then its amounts left to right),
  with these messages:

| Problem | `row`, `column` | Message |
|---|---|---|
| a header names no component | `0`, the column | `“Drug C” isn't a component in the plan.` |
| a header names a component a column to its left names | `0`, the column | `“Drug A” is in more than one column. Each component gets one column.` |
| a blank header whose column has an amount (any cell not blank) | `0`, the column | `Column 5 has amounts but no component.` (counting from 1) |
| a row's label is blank | the row, `0` | `Row 4 has no well label.` (counting from 1, the header being row 1) |
| a label is a row above's | the row, `0` | `“Control” is in more than one row.` |
| no well has the label | the row, `0` | `No well is labeled “Cond 9”.` |
| an amount isn't blank or a number | the row, the column | `Control, Media: “lots” isn't an amount in µL.` |

**Stock wells** (`stockWellsOf(plan, component)`): the wells that hold **only** that component at
Start (their starting contents name no other), in deck order. A column draws only from these
(Andy, 2026-11-05: a well holding a mix is never mistaken for a stock).

**A draft** is `{ table, sources }`, a transfer table's values before they're in the plan, as a caller
edits them. **Its problems** (`transferTableProblems(plan, draft, at)`), `at` being where its stages
go (below): `readTransferTable`'s problems, then, if there are none:

| Problem | Message |
|---|---|
| no column has an amount | `The table adds nothing: every amount is blank or 0.` |
| for each column with an amount, in column order: no stock well exists | `No well holds only Media at Start. Fill one with Media at Start first.` |
| its `sources` entry is missing | `Choose a well for Media to draw from.` |
| one of its wells isn't a stock well of it | `Res1 1 doesn't hold only Media at Start, so Media can't draw from it.` (the first such) |
| one of its wells is a destination of any column of the table (a stock well carrying a label a row uses, or a well another column fills) | `Res1 1 is both a source of Media and a well the table fills. Choose another well.` (the first such) |

(The last one keeps the operation list's stage rule from refusing the table's stages with a message
about operations: a well can't be both drawn from and filled in one table, so it's caught here, in
the table's terms.)

These are `{ row: null, column: null, message }`, so all of a draft's problems have one form.
`sources` itself must be in its form (an object of component names and lists of wells on the deck,
each once); a draft that isn't is refused with a thrown message (section 5), not a problem, since a
caller builds it.

**`at`**: the stage the transfer table's stages go just before: for a transfer table in the plan,
its first stage; for a new one, the stage it's added before, or `null` for the end of the run.
What a well holds **just before the transfer table** is the starting contents with the transfers
of the stages before `at` in the stage order replayed (contents tracking's `replay`, as for a
randomization); for `null`, after every stage.

**A column's transfers**: one per amount and well, rows in table order and each row's wells in deck
order, of that amount, into that well. **Several source wells** (Andy, 2026-11-05: as a
randomization's filler wells): its transfers draw from its wells in order; each well gives **whole
transfers**, in the column's transfer order, until the next transfer would draw more than it has
left above its dead volume (its usable volume just before the transfer table, contents tracking's
`usableVolumeOf`, less the transfers it has given), and then the next well takes over; the last
well takes all the rest (and may draw into its dead volume or be overdrawn: a contents problem, as
any other). A transfer is never split between two wells. A well "has room" for a transfer when the
transfer's volume is at most what it has left plus 0.000001 µL (contents tracking's allowance for
arithmetic leftovers). A well that can't give the first transfer it's offered is passed over for
the rest, even if a later, smaller transfer would fit (the column's wells are used one after
another, never gone back to). **How the transfers split** (`sourceSplit(plan, draft, component,
at)`): `[{ well, count }]`, one per well in the column's `sources` order, `count` how many of its
transfers draw from it. E.g. Res1 1 with 1,000 µL above its dead volume and Res1 2 with plenty,
and 12 transfers of 190 µL: `[{ Res1 1, 5 }, { Res1 2, 7 }]`.

**What the stages will be** (`transferTableStages(plan, draft, at, { id, renamedFrom })`), for a
caller to show before adding or updating; `id` is the transfer table's ID when it's in the plan
(`null` for a new one), `renamedFrom` as for updating (below). With an `id`, `at` is ignored: it's
worked out as that transfer table's first stage (a caller may pass `null`). One entry per column with an amount,
in column order: `{ component, stage, transfers, settings, tips }`, `stage` the ID of the stage it
keeps (below; `null` for a new one), `transfers` the column's transfers (each `{ source,
destination, volume }`), `settings` the stage settings it will have and `tips` `{ tipType, probes
}` the tips its tip change will load. Throws the first problem's message if the draft has any.

**Settings and tips** (Andy, 2026-11-05: settings follow the liquid, by component):
- A column whose component already has a stage in the transfer table **keeps that stage**: its ID,
  name, settings and tip change's tip type and probes. Only its transfers are replaced.
- **`renamedFrom`**, an object of new component names and old ones, e.g. `{ "DMEM": "Media" }`,
  given by a caller that knows a column's header was changed (Andy, 2026-11-05): a column for a
  component listed there, with no stage of its own in the table, keeps the stage of the old one
  (if the table has one and no other column keeps it), and that stage is renamed to the new
  component. Entries that don't apply are ignored. Only an update uses it; the plan stores nothing
  of it.
- Any other column's stage is new, with the settings and tips of the **column before it** (as it
  will be after this edit), or, for the first column, of the stage just before `at` in the stage
  order if it's a transfer stage (the nearest transfer stage before `at` otherwise, as `addStage`
  copies its own kind), and that stage's tips (its tip group's tip type and probes), or, with
  none before `at`, `defaultSettings()` and the `START` tips' tip type and probes.

**Adding** (`addTransferTable(plan, draft, beforeId)`), as one edit, when the draft has no problems
(`at` = `beforeId`):
1. `beforeId` is a place a transfer table can sit: `null`, or the first stage of a tip group that
   isn't inside a randomization or another transfer table (the first stage of a randomization's or
   transfer table's box is allowed: the new one goes above it).
2. Each column with an amount gets a new stage, added with `addStageWithNewTips(plan, beforeId)` in
   column order, so each starts its own tip group and the stage below keeps its tips; it's named
   after its component (`renameStage`), given its settings and its tip change its tip type and
   probes (as `changeStageSettings`, `setTipType`, `setTipProbes`; or the `START` tips, if it's now
   the plan's first stage), and its transfers (`addTransfers`), as `transferTableStages` gives them.
3. The new transfer table is last in `transferTables`, with the next free ID (`t` and one more than
   the largest number in use, from `t1`), `table` and `sources` as given (copied), and `stages` in
   column order.

It gives `{ plan, id }`.

**Updating** (`updateTransferTable(plan, id, draft, { renamedFrom })`), as one edit, when the draft
has no problems (`at` = its first stage):
1. **The place**: the stage just after its last stage (or `null`). Noted first.
2. **New stages first**: each column that keeps no stage (above) gets one, added with
   `addStageWithNewTips` before the place, named, set and filled as in adding.
3. **Then stages no column keeps** are removed (`removeStage`), so the plan is never left without a
   stage.
4. **Each kept stage**: its transfers replaced by the column's (in the column's order), unless they
   are the same transfers in another order (the same multiset, as "Out of date" compares them):
   then they're kept as they are, so an update that changes nothing gives back the same plan; and,
   if it was kept through `renamedFrom`, renamed to its new component. Its settings and tips don't change.
5. **Stages in column order**: the transfer table's stages are put in the order of its columns,
   consecutive, starting where its first stage now is, as a randomization's run orders its stages
   (section 3, "Randomizations", step 6): only its own stages move; each keeps its ID, name,
   settings and transfers; the operation list is rebuilt as a move rebuilds it, or left as it is if
   its blocks already follow the new order. A randomization whose `beforeId` was its old first
   stage (one without stages sitting above it, or one that has run just above it, whose `beforeId`
   is the stage just after its last) now has its new first stage (section 3, "Where randomizations
   sit afterwards"); this holds wherever a transfer table's or a randomization's stages are
   reordered.
6. **Tips**: every one of its stages starts a tip group of its own, its tip change loading the tip
   type and probes it had (a kept stage) or was given (a new one); one that is now the plan's first
   stage has the `START` tips set to those, and a tip change keyed by it is taken out. The stage
   just after its last stage keeps its own tip change (step 2 gives it one when a new stage goes
   before it).
7. **Randomizations sitting here**: a randomization without stages whose `beforeId`, before the
   update, was the transfer table's first stage, or is now one of its stages, sits before its new
   first stage (step 3 can move one onto a later stage of it, and step 5 can reorder its first
   stage away), so it stays above the transfer table and never inside it.
8. `table`, `sources` and `stages` are set; its place in `transferTables` doesn't change.

A draft equal to the stored one with nothing to change gives back the same plan.

**Removing** (`removeTransferTable(plan, id)`) takes out the transfer table and every stage it owns,
as one edit. Tip changes on the stage after it stay. A randomization without stages sitting before
its first stage then sits before the stage just after it (or `null`), as `removeStage`'s rule moves
it. It's refused when its stages are all the plan's
stages (`canRemoveTransferTable` is `false`), as for a randomization: a plan needs at least one stage.

**Out of date** (`isTransferTableOutOfDate(plan, id)`; Andy, 2026-11-05). A transfer table's stages
are what it last made; other edits never update it. It's **out of date** when its draft (`table`
and `sources`) now has problems (checked first), or `transferTableStages` now gives different
stages: a different number, or, for any of its stages in order, a different component, or
different transfers: each stage's transfers are compared **ignoring their order**, as a multiset of
(source, destination, volume) (from the build's review, 2026-11-05: the Biomek orders a stage's
transfers itself, B56358AF 22-25, and the tool's own transfer order only follows deck order, so a
well moved past another with the same label changes only the order). The order of its stages
(column order) and their components still count. Settings and tips aren't compared: they're the
user's, edited on the stages. So relabeling a well, emptying or
refilling a stock at Start, editing a stage before it that draws from its source wells (changing
the split), or removing a component named by a header, makes it out of date; nothing updates it but
`updateTransferTable` (Andy: as for a randomization, a checked plate never changes by itself).

**Where it sits**: its stages are consecutive in the stage order, each the only stage of its own tip
group (so none shares tips with any other stage, inside it or out), in the order of its `stages`.
Every edit keeps this so:

**The refusals below are for calls from outside**: a transfer table's own edits (adding, updating,
removing it, `renameComponent`, `moveItems`, `pasteItems`, `moveWell`) change its stages through
internal helpers that skip these refusals but keep every other rule of the edit they stand for
(the stage rule, the tip rules, and `removeStage`'s rules for randomizations: moving one that sits
before a removed stage, and giving the stage after one's last stage a tip change).

**What can be edited** on its stages (Andy, 2026-11-05: pipetting the normal way): `changeStageSettings`
and `setStageMix` on any of its stages; `setTipType` and `setTipProbes` on their tip changes (or
`START`, for one that's the plan's first). **Refused, in the logic** (not only by a caller; as for
randomizations since 2026-11-05, item 20, "It owns its stages"):
- `addTransfer`, `addTransfers`, `changeVolume`, `removeTransfer` on one of its stages;
- `renameStage` of one of its stages (its name is its component's);
- `removeStage` of one of its stages;
- `removeTipChange` of one of its stages' tip changes, or of the stage just after its last stage
  (which keeps that stage off its tips);
- `addStage`, `addMixStep` (with or without `takeTips`), `addStageWithNewTips`,
  `addMixStepWithNewTips`, `addRandomization`, `placeRandomization` and `addTransferTable` with a
  `beforeId` that is one of its stages other than its first; and `addStage` and `addMixStep` with
  `takeTips` before its first stage (the new stage would take its first stage's tips);
- `addStage` and `addMixStep` without `takeTips` whose new stage would land just after its last
  stage, joining its last tip group: a `beforeId` that is the stage just after its last stage, or
  `null` when its last stage is the plan's last (own message, section 5); `addStageWithNewTips`
  and `addMixStepWithNewTips` there are allowed, since they start new tips;
- `addTipChange` before one of its stages (each has one already, so this is the existing
  message; no new rule);
- `moveItems` with one of its stages without the transfer table, to any place but inside its own
  transfer table (section 3, "Moving inside a transfer table"); any other item to a place inside its
  box;
- `removeStage` of the stage just after its last stage gives the next stage a tip change loading the
  tips the removed one used, if it has none (as for a randomization).
- `addStage` and `addMixStep` without `takeTips` before its first stage when that's the plan's first
  stage: the new stage becomes the first, on the `START` tips, and the transfer table's first stage
  gets a tip change of its own loading the tips it had, as `addStageWithNewTips` gives the stage
  that was first (so its first stage keeps its own tips).

**Components** (Andy, 2026-11-05):
- **`renameComponent`** renames it in every transfer table too, as part of the same edit: each
  header cell whose trimmed text is the old name becomes the new name (exactly, no spaces), the
  `sources` key, each `stages` entry's `component`, and the name of that stage (`renameStage`'s
  rule set aside for this). So a transfer table stays up to date through a rename.
- **`removeComponent`** leaves the header as it is and takes the component's key out of `sources`;
  the table then reads the header as naming no component, so it's out of date until the column is
  deleted or its header changed. Its stage stays, owned, until an update.

**Moving wells** (section 3, "Moving wells"): a transfer table's source wells are **wells in use**,
and `moveWell` puts `to` in place of `from` in every `sources` list (keeping its place). Its
destinations are found by well label, and the label moves with the well, so its table needs no
change. A moved well keeps the transfer table up to date, unless the move changes how a column's
transfers split among several source wells (the split follows the transfers' deck order): moving a
destination well past another with the same label can change which of them draws from the next
source well, and then it's out of date, as any other change of what it would make.

### Moving and copying
(Andy, 2026-11-01; ADR 0014.) Stages, tip groups, randomizations and transfer tables (since
2026-11-05) can be moved, and copied, to
another place in the column, and what was copied can be pasted into this plan or another one. Each
is one edit, undone as one.

**The column's boxes.** `columnBoxes(plan)` gives the column as a tool shows it, between Start and
End: a list of **boxes**, in order, each either
- `{ kind: "tipGroup", key, tipType, probes, stages }`: an ordinary tip group, as `tipGroups` gives
  it (its stages owned by no randomization); or
- `{ kind: "randomization", id, tipGroups }`: a randomization, with the tip groups of its stages
  (in stage order; each holding one or more of its stages, as its sources share tips, and none of
  another's: section 3, "Sharing tips"), or `[]` while it has none; or
- `{ kind: "transferTable", id, tipGroups }` (2026-11-05): a transfer table, with the tip groups of
  its stages, in stage order, each holding exactly one of its stages (section 3, "Transfer
  tables"). A transfer table always has stages.

Every tip group of the plan is in exactly one box. A randomization without stages is placed where
it sits (section 3, "Randomizations"): just before the box whose first stage is its `beforeId`, or
last for `null`; several at one place in the order of `randomizations`. (This is the order the
page's Stages column already shows; the page takes it from here, so there's one copy of the rule.)

**Items** (`docs/glossary.md`), the things a move or copy takes, each one of:
- `{ kind: "stage", id }`: a stage (a mix step included);
- `{ kind: "tipGroup", id }`: an **ordinary** tip group (one in a `"tipGroup"` box, not one of a
  randomization's own), named by its first stage's ID (an ID, not `START`, so it names the same
  group however the tips are keyed);
- `{ kind: "randomization", id }`: a randomization;
- `{ kind: "transferTable", id }` (2026-11-05): a transfer table.

A list of items is taken in **column order**, whatever order it's given in. A stage in a tip group or
randomization that's also listed is part of it already, so it's left out; an item listed twice
counts once.

**Places**, where they go, in terms of `columnBoxes` of the plan as it was before the edit:
- `{ kind: "between", index }`: between boxes, just before box `index` (`0` above the first box;
  the number of boxes, below the last);
- `{ kind: "inTipGroup", index, position }`: inside the ordinary tip group that is box `index`,
  just before its stage at `position` (`0` at its top; the number of its stages, at its bottom);
- `{ kind: "inTransferTable", index, position }` (Andy, 2026-11-05): inside the transfer table that
  is box `index`, just before its stage at `position` (`0` at its top; the number of its stages, at
  its bottom). Only for that transfer table's own stages (below, "Moving inside a transfer table").

A place may point at something that's itself being moved. It then means:
- `inTipGroup`: just before the first stage of that group, at `position` or after it, that isn't
  being moved; or at the group's end if there's none. `inTransferTable` likewise, within the
  transfer table.
- `between`: just before the first box, at `index` or after it, that isn't being moved and isn't
  left with no stages by the move; or below the last box if there's none. (A randomization that
  hasn't run is a box with no stages of its own: it stays, and counts.)

**The container rule** (ADR 0014; `docs/glossary.md`): **containers** are ordinary tip groups,
randomizations and transfer tables; stages (mix steps included) are what goes inside them. A
transfer table follows every rule written here for a randomization, except where it says otherwise.
- A tip group moved or copied brings its tip change (tip type and probes) and its stages, in order.
- A randomization moved or copied brings all of itself: its sources, wells to fill, seed, volume,
  settings, tips, and its stages, in its tip groups as they were (stages sharing tips still share
  them; none shares tips with a stage outside it).
- A tip group, randomization or transfer table goes only **between** boxes. A place inside a tip
  group is refused for a list holding one.
- A transfer table moved or copied brings all of itself: its `table`, `sources`, and its stages,
  each on tips of its own as they were (its settings and tips are its stages').
- Stages put **inside** a tip group join it, in their column order, and use its tips. Put at its
  top, the first of them becomes the group's first stage, and the group's tip change moves onto it
  (so a group keeps its tips whichever stage is first).
- Stages put **between** boxes keep the tips they had: each run of consecutive stages (in column
  order) that came from one tip group becomes one new tip group, loading that tip group's tip type
  and probes. This holds for a randomization's tip groups too (copied stages from one of them, now
  ordinary stages, form one tip group; since 2026-11-05 such a group may hold several stages). When
  pasting, "came from one tip group" is the copied stages' `group` (below).
- The tip group a stage leaves **keeps its tips**: if its first stage left, its tip change moves
  onto its new first stage. A tip group left with no stages is gone, and its tip change with it.
- A tip group that's the place stages are put into is never left empty, even if all its own stages
  are being moved, so it keeps its tips: its tip change moves onto its first stage after the edit.
- After the edit, the first stage's tips are the `START` ones, as always (section 3, "Tip changes
  and tip groups"); so moving a tip group to the top makes its tips the `START` tips, and the group
  that was first gets a tip change of its own loading the tips it had.

**Moving** (`moveItems(plan, items, place)`) keeps every stage's ID, name, settings and transfers;
only where things are changes: `stageOrder`, `tipChanges`, the operation list's order (its blocks
follow the stage order, ADR 0011, each stage's transfers in the same order as before), and the
randomizations' places. A stage owned by a randomization can't be moved on its own (ADR 0014): a
list holding one whose randomization isn't listed too is refused. **Nothing changes** when the new
`stageOrder`, `tipChanges` (tip types and probes by key) and `randomizations` (compared in column
order) would all equal the old ones: then the same plan object is given back, with `randomizations`
as it was (from the review of the build, 2026-11-02: a list only out of column order isn't a change
the user made). (Moving a tip group's last stage between boxes
just below its group does change something: it becomes a tip group of its own, with the same tips,
so the group splits.)

**Moving inside a transfer table** (Andy, 2026-11-05): a transfer table's stages can be moved to
another place **inside the same transfer table** (an `inTransferTable` place), never out of it. Its
stages are tip groups of one stage each, so moving a stage moves its tip change with it. The list of
items must be stages of that one transfer table only (any other item, or a stage of another
transfer table, with an `inTransferTable` place is refused). The move:
- puts the moved stages, in their column order, just before the place's stage, keeping each one's
  ID, name, settings, transfers and its own tip change (one that becomes the plan's first stage
  takes the `START` tips set to its tips, as updating does, and the stage that was first gets a tip
  change of its own loading the tips it had);
- **moves their columns in `table` to match**, so the column order and the stage order stay one
  thing: each moved stage's column (the one whose trimmed header is its component) is taken out of
  the grid, and put back, in the same order, just before the column of the stage at the place (or,
  at the bottom, just after the column of the transfer table's last stage that isn't moved).
  Columns that make no stage, and blank-header columns, stay where they are among the others; the
  label column never moves;
- sets `stages` in the new order, and a randomization whose `beforeId` was the table's old first
  stage (sitting above it, run or not) now has its new first stage; nothing else changes. So the transfer table **doesn't go out of
  date**: its columns draw on what their wells hold just before it, which a reorder doesn't change.
A move giving the same order gives back the same plan. Outside its table, a transfer table's stage
can't be moved (as below).

**The operation list after a move** is rebuilt: a new operation list holding every stage's
transfers, stage by stage in the new stage order, each stage's in the order it had, added with the
operation list's own `add`. So each transfer's position may change, and its stage, source,
destination and volume don't.

**Copying** (`copyItems(plan, items, place)`) puts copies at the place and leaves the originals.
It's the same as `pasteItems(plan, copyOf(plan, items), place)`:
- `copyOf(plan, items)` gives the items as **copied items**: plain data (JSON, below), independent
  of this plan's IDs, so they can be kept and pasted later, here or into another plan.
- `pasteItems(plan, copied, place)` puts them at the place, following the container rule.
- Each copied stage is a **new stage** (a new ID from the stage list), with the same name, settings
  and transfers. A copy of a stage owned by a randomization is an ordinary stage, owned by none.
- A copied transfer table is a **new transfer table** (2026-11-05): the next free ID (`t` and one
  more than the largest number in use), the copied `table` and `sources`, and the copies of its
  stages as its `stages`, each with its component and on tips of its own loading the tips it had.
  It fills the same labeled wells as the original (Andy, 2026-11-05: as a copied randomization
  does), so it usually makes overfills, shown as any others. Copies of its stages copied alone are
  ordinary stages, owned by nothing, as a randomization's are.
- A copied randomization is a **new randomization**: the next free ID (`r` and one more than the
  largest number in use, as `addRandomization` gives), the copied values, and the copies of its
  stages as its `stages`, each with its source's well, in the same tip groups as the original's
  (a stage that started new tips starts new tips loading the tips it had; one that shared the tips
  of the stage before it shares the copy's), each keeping its settings. A copy of a run
  randomization has `null` `settings`, `tipType` and `probes`, as the original has (since
  2026-11-05, item 20). Its `beforeId` follows
  from where it lands. The box just below it already starts a tip group (it's between boxes), so it
  keeps its own tips. Stages left over from its last run (section 3, "Randomizations": a source
  taken out, not run again) are copied too, as the plan holds them.
  It fills the same wells as the original (Andy, 2026-11-01: that's what copying means), so it
  usually makes overfills, shown as any others.

**Copied items** are JSON, so a tool can put them on the system clipboard as text:

```js
{
  format: "biomek-tools copied items",
  version: 4,
  items: [
    { kind: "stage", stage, tips, group },   // tips: the tip change of the tip group it came from
    { kind: "tipGroup", tips, stages: [stage, …] },
    { kind: "randomization", randomization, stages: [{ labware, well, stage, tips }, …] },  // tips may be null
    { kind: "transferTable", transferTable, stages: [{ component, stage, tips }, …] },      // version 4
  ],
}
```

A transfer table's **`transferTable`** holds its `table` and `sources`, and its **`stages`** each
owned stage's component, the stage itself, and the tips of its tip group (never `null`: each starts
its own).

**Copied items version 5** (2026-11-05, a randomization's settings on its stages, item 20): the
same form as version 4, except that a randomization's `settings`, `tipType` and `probes` are
`null` when it has owned stages in the copy, and given when it has none, as in a plan (section 3,
"Randomizations"). `copyOf` writes version 5; `pasteItems` reads versions 1 to 5. **In a version 1
to 4 copy**, a randomization with owned stages has its `settings`, `tipType` and `probes` checked as
before and then **dropped** (`null`), since its stages and their `tips` hold them; one without
stages keeps them. A version 5 copy breaking the rule is refused with the form message (`Can't
paste: item 2 isn't a stage, tip group or randomization as the transfer designer copies them.`).
A pasted randomization's stages keep the settings and tips they were copied with.

**Copied items version 4** (2026-11-05, transfer tables): items may be transfer tables. `copyOf`
wrote version 4 until version 5 (above); `pasteItems` reads versions 1 to 5, and a transfer table item in a version 1 to 3
copy is refused with the form message, unchanged (`Can't paste: item 2 isn't a stage, tip group or
randomization as the transfer designer copies them.`; kept as it is in every version so existing
copies and tests keep their wording). A pasted transfer table is checked as `setTransferTables`
checks a plan file's (its `table`'s and `sources`' form, each stage's component one of its table's
headers, trimmed, none twice: the same rule a plan file's gets), with the messages prefixed `Can't
paste: item 2: `, except that **`sources` keys naming no component in this plan aren't refused**:
they're dropped, as `removeComponent` drops them, and the column's header then names no component,
so the pasted transfer table is out of date (copied from a plan with a component this one lacks).
Whether its stages match what it would make isn't checked: a copy pasted where its sources hold
something else is out of date, as a plan file can be.

where a stage entry's **`group`** numbers the tip groups its stages came from, from 1, in column
order, so stages with the same number came from one tip group (from the build, 2026-11-02: without
it, two stages copied from different tip groups with the same tips couldn't be told apart, and a
paste would join them where a move keeps them apart); a **stage** is `{ name, settings, transfers:
[{ source, destination, volume }, …] }` (its
transfers in order, each well `{ labware, well }`), **tips** is `{ tipType, probes }`, and a
randomization's **randomization** holds its `sources`, `fill`, `seed`, `volume`, `settings`,
`tipType` and `probes` (each source with its `sharesTips` from version 3), and its `stages` give
each owned stage's source well with the stage itself and, for a stage that starts a tip group, the
tips of that tip group, or `null` for a stage that shares the tips of the stage before it (from
version 3; the first entry's `tips` is never `null`).
`items` is in column order, as `copyOf` gives it.

**Copied items version 3** (2026-11-05, shared tips): each randomization's sources have
`sharesTips`, and an owned stage's `tips` may be `null`. `copyOf` wrote version 3 until version 4
(above); `pasteItems` reads versions 1 to 4. In version 1 and 2 copies, each source that is an object must not have
`sharesTips` (one that has it is refused with the form message, `Can't paste: item 2 isn't a stage,
tip group or randomization as the transfer designer copies them.`, as a plan file version 6 to 9
refuses it; a source that isn't an object is left to `setRandomization`'s checks), and is then read
with `sharesTips` `false`; every owned stage's `tips` must be an object, as before. In version 3,
**whether its stages share isn't checked against its sources**, as for plan files: a copy whose
sources' `sharesTips` disagree with which owned stages have `tips` `null` (e.g. A2 sharing but its
stage with tips of its own, or the reverse) pastes, with its stages in the tip groups the copy
gives, and the pasted randomization is out of date, so Update brings them together. In version 3, a randomization's sources
must have exactly `labware`, `well`, `replicates`, `filler` and `sharesTips` (checked by
`setRandomization`'s rules), and its first owned stage's `tips` can't be `null`
(`Can't paste: item 2 isn't a stage, tip group or randomization as the transfer designer copies
them.`, the form message).

**Copied items version 2** (2026-11-02, with several filler wells): the same form as version 1,
whose randomizations may have several filler wells. `copyOf` wrote version 2 until version 3
(below); `pasteItems` reads versions 1 and 2 with the same checks, so a build that knows only version 1 refuses a copy holding
several filler wells as newer, rather than with a confusing message (as plan files go to version
8).

**Pasting checks everything**, as opening a plan file does (ADR 0010): copied items may come from
another plan or the system clipboard, so they're never trusted. `pasteItems` refuses, changing
nothing, anything that isn't copied items in this form (version 1, 2, 3, 4 or 5), and checks every value with
the rules of the edit that would make it: names (`renameStage`), settings (`changeStageSettings`),
transfers (`addTransfer`: wells on this plan's deck, the stage rule, a mix step's wells), tips
(`setTipType`, `setTipProbes`), a randomization's values (`setRandomization`) and its stages (as
`setRandomizations` checks a plan file's: no well twice, none a mix step; a stage's well needn't be
one of its sources, since a plan may hold a stage left over from the last run), with their own
messages, prefixed `Can't paste: item 2: ` (e.g. `Can't paste: item 2: "Z99" isn't a well on Plate1.
Its wells are A1 to H12.`).

**Where randomizations sit afterwards.** After any move or paste, `transferTables` is in column
order (2026-11-05), and `randomizations` is in column order, each one with stages has its `beforeId` set to the stage just after its last stage (or
`null`), and each without stages has its `beforeId` set to the first stage of the next box below
it that has one (or `null`), so section 3's rules about where a randomization sits keep holding.

**What's given back.** `moveItems`, `copyItems` and `pasteItems` each give `{ plan, placed }`:
`placed` is the moved or pasted things, as items of the new plan, in column order (copies by their
new IDs), so a tool can select them.

### Moving wells
(Andy, 2026-11-02; roadmap, item 12 of v0.2.0.) A reservoir warped in the autoclave in an earlier
experiment, and some troughs couldn't be used, so different wells were used than planned. **Moving
a well** puts everything the plan does with one well onto another, so the plan does the same as
before from a different well, and the files the tool writes name the wells actually used. It's one
edit, undone as one.

**A well in use** (`isWellUsed(plan, well)`; `docs/glossary.md`) is a well the plan names anywhere:
- in its starting contents;
- as the source or destination of a transfer (a mix step's mixed wells included);
- in its well labels;
- in a randomization: as a source, a well to fill, or the well of one of its stages;
- in a transfer table: as one of a column's source wells (2026-11-05).

**What can move** (`moveWell(plan, from, to)`): one well at a time, `from` and `to` each `{ labware,
well }`, on any labware, not only between troughs (Andy: every well is the same to the tool, so
limiting it would only add a special case). `from` must be in use; `to` must not be (a move never
swaps or merges two wells' uses: Andy, 2026-11-02; swapping would put the other well's liquid into
the warped one, and merging mixes two liquids in one well). A randomization's **well to fill**
(`isWellToFill(plan, well)`) can't be moved (Andy, 2026-11-02): wells to fill are kept in deck order
(section 3, "Randomizations"), so a moved one could change its place in the pool, and a later run
would give different wells even with the same seed. A randomization's **sources** can be moved:
they keep the order given, so a moved source keeps its place, and the same seed gives the same
wells.

**What a move changes:** `from` is replaced by `to` wherever the plan names it, and nothing else
changes:
- **starting contents:** `from`'s entry becomes `to`'s, in the same place in the list, with the same
  components;
- **transfers:** each transfer from or into `from` (a mix step's mixed well: both ends) gets `to` in
  its place, with the operation list's `replace`, so every transfer keeps its place, stage and
  volume, and every other stored transfer is shared;
- **well labels:** `from`'s label becomes `to`'s, placed exactly as removing `from`'s label and then
  giving `to` that label with `setWellLabel` would place it (so `to` comes last among its labware's
  labeled wells, and a labware new to `wellLabels` comes last in it; plan files write them in that
  order); a labware left with no labeled wells is left out of `wellLabels`;
- **randomizations:** each source at `from` gets `to` (keeping its place, replicates, filler and
  `sharesTips`), and
  so does each of its stages' entries at `from`; wells to fill never change (above). A stage's name,
  given when its randomization ran, stays as it was;
- **transfer tables** (2026-11-05): each source well at `from` gets `to`, keeping its place in its
  list. Its table doesn't change: its destinations are found by label, which moves with the well.

Since `to` wasn't in use, every rule the plan kept still holds with it in `from`'s place (the stage
rule, a mix step's wells, no well twice in a randomization), so nothing else is checked. A move may
cause **contents problems**, such as a trough's contents moved into a plate well that holds far
less; they're found and reported as any edit's are (section 3, "Contents problems"), and the file
writer refuses the plan until they're fixed.

### Configuration
Two files in `config/` (ADR 0009), which this module's tests check:
- **`config/pipetting-modes.js`** exports `PIPETTING_MODES`: a list of
  `{ name, technique, mixingTechnique, liquidType, ends }`, e.g.
  `{ name: "Slow", technique: "Operation", mixingTechnique: "OperationMix", liquidType: "Slow", ends: ["source", "destination"] }`.
  `name`, `technique` and `liquidType` are names; `mixingTechnique` is a name different from
  `technique`, or `null` if the mode can't mix; `liquidType` also follows Biomek's rule for liquid
  type names (letters, digits and underscores, starting with a letter; B56358AF, 9-4); `ends` is a
  non-empty list of `"source"` and `"destination"`, each at most once. No two modes share a name;
  for each end, no technique-and-liquid-type pair appears twice among its modes' `technique`s and
  `mixingTechnique`s together (or reading a stage's mode back, or whether it mixes, would be
  ambiguous); and each end has at least one mode. The lab's modes: Slow, Medium and Fast mix with
  `OperationMix` (Andy's technique, which works with any liquid type; `biomek.md`), and Non-Contact
  can't mix (`null`). It replaces `config/techniques.js` and
  `config/liquid-types.js`, which are removed (Andy, 2026-10-26: each name is then written once).
  The names are the ones used in the general-purpose method (`biomek.md`, 2026-10-27).
  It also exports `DEFAULT_PIPETTING_MODE`, the name of the mode a new plan's stage uses at both
  ends, e.g. `"Medium"`; it must be a mode usable at both ends.
- **`config/tip-types.js`** exports `TIP_TYPES`: a non-empty list of tip type names, e.g.
  `["BC230", "BC1070"]`, each a name, none repeated.
- **`config/mixing.js`** (new) exports `DEFAULT_MIX`: the mix an end gets when mixing is switched
  on, `{ share: 90, times: 3, speed: 400 }` (90% of the well, 3 times, at 400 µL/s; Andy,
  2026-10-29). It must be a mix the stage list accepts (`stage-list.md`). It also exports
  `MIX_STEP_MODE`, the technique and liquid type of a mix step at both ends,
  `{ technique: "MixOnly2", liquidType: "Medium" }` (Andy's mix-only technique; its liquid type
  doesn't matter, since every mix speed comes from the worklist; Andy, 2026-10-29): names, the
  liquid type following Biomek's rule, and the technique none of the pipetting modes' techniques or
  mixing techniques, so a mix step is never read as a mode; and `MIX_STEP_VOLUME`, a mixed well's
  placeholder transfer volume in µL, `1` (Andy, 2026-10-30), a number above 0. (The file also holds
  `SHORT_MIX_SHARE`, which the `mix-volumes` module's tests check; `mix-volumes.md`.)
- **`config/tip-types.js`** also exports `DEFAULT_PROBE_COUNT`: how many probes a new plan's first
  tips go on, the first that many (`probesFor`). A whole number from 1 to 8; `4` (Andy, 2026-10-30).
  It's in `config/` because it may change (CLAUDE.md, "No hard-coded configuration").
- **`config/concentration-units.js`** also exports, for stock tables (2026-11-05),
  `UNIT_SPELLINGS`: other ways of writing a unit that a stock table's header may use, each read as
  the configured unit it names, `{ uM: "µM", "μM": "µM", x: "×", X: "×", "g/l": "g/L", "mg/l":
  "mg/L", "cells/ml": "cells/mL" }` (`μM` with the Greek letter mu, U+03BC; `µM` in the units with
  the micro sign, U+00B5). This module's tests check it: every value is a `unit` of
  `CONCENTRATION_UNITS`, and no key is one (so a spelling never hides a unit). Andy, 2026-11-05: kept
  to these, so units are read strictly.

## 4. Interface
The module exports the functions and constants below. None changes the plan or the values it's
given; "returns the plan with …" means a new plan.

**Plans**
| Function | Returns |
|---|---|
| `emptyPlan()` | `{ plan, stageId }`: a plan with no components, starting contents, transfers, labels, well labels, randomizations or transfer tables, no experiment name (`""`), one stage (`NEW_STAGE_NAME`, default settings), and `START` tips of the first tip type; and that stage's ID. |
| `setExperimentName(plan, name)` | the plan with the experiment called `name`, its spaces at the ends removed; `""` (or only spaces) gives no name. Throws if `name` isn't text, or isn't a valid experiment name (`checkExperimentName`, `file-writer.md`). An unchanged name gives the same plan back. |
| `defaultSettings()` | a stage's default settings (section 3, "Stages"). |
| `probesFor(count)` | the first `count` probes, e.g. `4` → `[1, 2, 3, 4]`. Throws unless `count` is a whole number from 1 to 8. |

**Pipetting modes**
| Function | Returns |
|---|---|
| `modesFor(end)` | the pipetting modes usable at `end` (`"source"` or `"destination"`), in `config/` order. |
| `modeSettings(end, name, mixes)` | the settings for that mode at that end, e.g. `("source", "Slow")` → `{ sourceTechnique: "Operation", sourceLiquidType: "Slow" }`; with `mixes` `true`, the mode's mixing technique: `("source", "Slow", true)` → `{ sourceTechnique: "OperationMix", sourceLiquidType: "Slow" }`. `mixes` defaults to `false`. Throws if there's no such mode for that end, or `mixes` is `true` and the mode can't mix. |
| `modeOf(end, settings)` | the name of the mode that a stage's `settings` use at `end`, matching either of its techniques, or `null` if none matches. |

**Stages**
| Function | Returns |
|---|---|
| `NEW_STAGE_NAME` | (a constant) `"New stage"`. |
| `NEW_MIX_STEP_NAME` | (a constant) `"New mix step"`. |
| `stageOrder(plan)` | the stage IDs in stage order (the plan's `stageOrder`). |
| `stageNamed(plan, id)` | a stage as the messages name it, its place in the stage order and its name, e.g. `Stage 5, “Drug A”` (2026-11-05, item 20: so a tool naming a stage uses the same words). |
| `FIRST_RUN_PROPERTIES` | (a constant) `["settings", "tipType", "probes"]`: a randomization's values for its first run, `null` once it has stages (section 3, "Randomizations"; 2026-11-05, item 20). |
| `addStage(plan, beforeId, { takeTips })` | `{ plan, id }`: the plan with a new transfer stage before stage `beforeId` (or last, for `null`), and its ID; its settings copied from the nearest transfer stage (section 3, "Stages"). `takeTips` defaults to `false`. Throws if `beforeId` isn't a stage or `null`. |
| `addMixStep(plan, beforeId, { takeTips })` | the same for a new mix step called `NEW_MIX_STEP_NAME`, its settings copied from the nearest mix step, or the default mix step settings (section 3, "Mix steps"). |
| `addStageWithNewTips(plan, beforeId)` | `{ plan, id }`: the plan with a new transfer stage before stage `beforeId` (or last, for `null`) in a tip group of its own, and its ID, as one edit (section 3, "Tip changes and tip groups"). Throws as `addStage` does. |
| `addMixStepWithNewTips(plan, beforeId)` | the same for a new mix step (as `addMixStep` makes it). |
| `isMixStep(plan, id)` | `true` if stage `id` is a mix step; `false` for a transfer stage or an ID that isn't a stage. |
| `mixWells(plan, id, wells)` | the plan with mix step `id` mixing each of `wells` (each `{ labware, well }`, on the deck) it doesn't mix yet, as one edit; the same plan if it mixes them all already. Throws if `id` isn't a mix step, or a well isn't on the deck. |
| `unmixWell(plan, id, well)` | the plan without mix step `id`'s mixed well `well`. Throws if `id` isn't a mix step, or it doesn't mix `well`. |
| `renameStage(plan, id, name)` | the plan with stage `id` named `name` (the stage list checks it). |
| `changeStageSettings(plan, id, settings)` | the plan with stage `id`'s settings replaced (the stage list checks them, then this module checks that each end's technique matches its mixing; section 3, "Mixing"). |
| `setStageMix(plan, id, end, mix)` | the plan with stage `id` mixing at `end` (`"source"` or `"destination"`) as `mix`, a mix or `null` (`stage-list.md`), and that end's technique switched to match (section 3, "Mixing"). Throws if `id` isn't a stage, `end` isn't an end, the end's technique and liquid type aren't one of the modes, the stage list refuses the mix, or `mix` isn't `null` and the mode can't mix. |
| `canRemoveStage(plan, id)` | `true` if `id` is a stage and not the only one. |
| `removeStage(plan, id)` | the plan without stage `id`, its transfers or a tip change keyed by it. Throws if `canRemoveStage` is `false`. |
| `stageEnds(plan)` | for each stage with transfers, in run order, `{ stage, transfersDone }`: how many transfers have run when it ends, e.g. `[{ stage: "1", transfersDone: 4 }, { stage: "2", transfersDone: 8 }]`. |
| `stagesWithContentsProblem(plan)` | a `Set` of the IDs of stages with a contents problem of any kind (section 3). A problem of the starting contents (`operationIndex` `null`) names no stage. |
| `stagesWithMixProblem(plan)` | a `Set` of the IDs of stages with a mix problem (`mix-volumes.md`). |
| `DEFAULT_MIX` | (a constant) the default mix from `config/mixing.js`, e.g. `{ share: 90, times: 3, speed: 400 }`, frozen, re-exported so a tool takes all the transfer designer's configuration from one place. |

**Transfers**
| Function | Returns |
|---|---|
| `addTransfer(plan, transfer)` | the plan with `transfer` added to its stage (section 3, "Transfers"); the stage order is unchanged. Throws if the operation list refuses it (its message), a well isn't on the deck, or the stage isn't in the plan. |
| `addTransfers(plan, transfers)` | the plan with each of `transfers` added in turn, as one edit. Throws, adding none, if any can't be added. |
| `changeVolume(plan, position, volume)` | the plan with the transfer at `position` given `volume` (the operation list checks both). |
| `removeTransfer(plan, position)` | the plan without the transfer at `position` (the operation list checks it); the stage order is unchanged. |
| `transfersIn(plan, id)` | stage `id`'s transfers, in order, each with its `position` added, e.g. `[{ type: "transfer", source: …, destination: …, volume: 50, stage: "2", position: 4 }]`. A stage without transfers, or an ID that isn't a stage, gives `[]`. |

**Tip changes**
| Function | Returns |
|---|---|
| `START` | (a constant) `"start"`. Re-exported from the `tip-groups` shared module (`tip-groups.md`). |
| `tipChangeAt(plan, key)` | the tip change at `key` (`START` or a stage ID), or `null`. |
| `canAddTipChange(plan, beforeId)` | `true` if `beforeId` is a stage, not the first in the stage order, without a tip change before it. |
| `addTipChange(plan, beforeId)` | the plan with a tip change before stage `beforeId`, loading the tip type and probes in use there. Throws if `canAddTipChange` is `false`. |
| `setTipType(plan, key, tipType)` | the plan with the tip change at `key` loading `tipType`. Throws if there's none at `key`, or `tipType` isn't in `TIP_TYPES`. |
| `setTipProbes(plan, key, probes)` | the plan with the tip change at `key` loading tips on `probes` (section 3, "Tip changes and tip groups"), stored smallest first. Throws if there's none at `key`, or `probes` isn't a list of probe numbers (below). |
| `removeTipChange(plan, key)` | the plan without the tip change at `key`. Throws for `START`, or if there's none at `key`. |
| `tipGroups(plan)` | the tip groups, in stage order, each with the tip change that starts it: `{ key, tipType, stages, probes }` each, `stages` being stage IDs in stage order and `probes` the probes that get tips, smallest first. Re-exported from the `tip-groups` shared module, which the file writer uses too (`tip-groups.md`; Andy, 2026-10-28). |
| `tipsUsed(plan)` | how many tips of each tip type the run loads (section 3, "Tip changes and tip groups"), as a new list each time: `{ tipType, count }` each, in `TIP_TYPES` order, only types with a count above 0, e.g. `[{ tipType: "BC230", count: 32 }, { tipType: "BC1070", count: 8 }]`; `[]` when the plan has no transfers. |

**Components and starting contents**
| Function | Returns |
|---|---|
| `addComponent(plan, name, color)` | the plan with a new component last, carrying no constituents and with no osmolality (`null`). If `name` is text, spaces at its ends are removed first. Throws if the name isn't a name or is used, or the color isn't text or is used. |
| `renameComponent(plan, oldName, newName)` | the plan with the component renamed, in the list and in every well. `newName` is trimmed as in `addComponent`; if it's then `oldName`, the plan is returned unchanged. Throws as for a new name. |
| `setComponentColor(plan, name, color)` | the plan with the component drawn in `color`. Throws if the color isn't text, or another component has it. |
| `removeComponent(plan, name)` | the plan without the component, in the list or in any well. |
| `countWellsWith(plan, name)` | how many wells hold the component at the start. |
| `addToWells(plan, wells, name, volume)` | the plan with `volume` µL of the component added to each of `wells`, each a well on the deck (`deck.checkWell`), each once. Throws if the component isn't in the plan, the volume isn't above 0, or a well isn't on the deck. |
| `emptyWells(plan, wells)` | the plan with `wells` empty at the start. Never throws for a well that's already empty. |
| `setConstituents(plan, name, constituents)` | the plan with component `name` carrying `constituents` (section 3, "Constituents"), replacing what it carried; names trimmed as `checkConstituents` does. Throws if there's no such component, then as `checkConstituents` does, then if a constituent's family differs from its name's family in another component. |
| `concentrationsOf(plan, snapshot, end)` | the well's concentrations (section 3, "Constituents"): `wellConcentrations(snapshot.volumeFractionsOf(end?.labware, end?.well), plan.components)`, a list of `{ name, family, value }` (`concentrations.md`), `[]` for a well carrying nothing. `snapshot` is a `ContentsSnapshot` of this plan; `end` is `{ labware, well }`, checked by `snapshot.volumeFractionsOf` only. |
| `seedingDensitiesOf(plan, snapshot, end)` | the well's seeding densities (section 3, "Seeding densities"): for each entry of `concentrationsOf(plan, snapshot, end)` whose family is the cells' (`isCellFamily`), `{ name, value }`, `value` in cells/cm² (`seedingDensity`, `concentrations.md`), in that order; `[]` when the well's labware type has no growth area (`growthAreaOf`, `deck.md`) or the well carries no cells. E.g. Plate1 A1 holding 100 µL, 10% from a suspension of Cells at 1500000 cells/mL, on a type with a growth area of 0.32 cm²: `[{ name: "Cells", value: 46875 }]`. Throws as `concentrationsOf` does, then as `growthAreaOf` does. |
| `setOsmolality(plan, name, osmolality)` | the plan with component `name` having `osmolality` (section 3, "Osmolality"): a number of mOsm/kg, 0 or more, or `null` for none. The same plan if it already has that value. Throws if there's no such component, then as `checkOsmolality` does (`osmolality.md`). |
| `osmolalityOf(plan, snapshot, end)` | the well's osmolality (section 3, "Osmolality"): `wellOsmolality(snapshot.volumeFractionsOf(end?.labware, end?.well), plan.components)`, `{ value, missing }` (`osmolality.md`), e.g. `{ value: 270, missing: [] }` or `{ value: null, missing: ["Buffer B"] }`; `{ value: null, missing: [] }` for an empty well. `snapshot` and `end` as for `concentrationsOf`. |
| `readStockTable(plan, table, colors)` | `{ stocks, problems }`: the stock table read against the plan (section 3, "Stock tables"), each stock `{ row, name, color, constituents, osmolality }`, each problem `{ row, column, message }`. `colors` is the list new components' colors are taken from, in order. Throws if `table` isn't in its form, then if `colors` isn't a list of text (section 5). |
| `addStocks(plan, table, colors)` | the plan with every stock of `readStockTable(plan, table, colors)` added as a component, in row order, with its color, constituents and osmolality: one new plan. Throws as `readStockTable` does, then its first problem's message, then if there are no stocks. |
| `stockTable(plan)` | the plan's components as a stock table, a list of rows of text (section 3, "Stock tables"), e.g. `[["Name", "Osmolality", "Hy-Soy (g/L)"], ["Media", "300", "4"], ["Water", "0", ""]]`; `[["Name"]]` with no components. |
| `copyDeck(plan, snapshot, point)` | the copied deck at the snapshot's point (section 3, "Copied decks"): `{ format, version, point, components, wells, wellLabels, labwareLabels }`, plain data. Throws if `point` isn't non-blank text, then if the snapshot has a problem other than an overfill. |
| `pasteDeck(plan, copied, colors)` | the plan with the copied deck added to its starting contents, components and labels (section 3, "Copied decks"): one new plan. Throws, pasting none, at the first problem, in section 3's order. |
| `COPIED_DECK_FORMAT`, `COPIED_DECK_VERSION` | `"biomek-tools copied deck"` and `1`: the `format` and latest `version` a copied deck carries, so a caller can recognize one on the clipboard. |

`renameComponent`, `setComponentColor`, `removeComponent`, `setConstituents` and `setOsmolality`
throw first if there's no component with that name.

**Labware**
| Function | Returns |
|---|---|
| `labwareUsed(plan)` | the names of the labware the plan uses, in the deck's order. |
| `labelOf(plan, name)` | the labware's label, or its name if it has none. |
| `setLabel(plan, name, label)` | the plan with the labware labeled `label` (section 3). Throws if the labware isn't on the deck, the label isn't text, or another labware has that label. |
| `setLabels(plan, labels)` | the plan with its labels replaced by `labels`, an object of labware names and labels, e.g. `{ Plate: "Assay plate", Deep: "Drug plate" }` (section 3). Throws if `labels` isn't an object, a labware isn't on the deck, a label isn't text, is blank, has spaces at its ends or is its own labware's name, or two labware would show one label. |

**Well labels**
| Function | Returns |
|---|---|
| `wellLabelOf(plan, end)` | the label of well `end` (`{ labware, well }`), e.g. `"Cond 1"`, or `null` if it has none. Throws if `end` isn't a well on the deck (`deck.checkWell`). |
| `setWellLabel(plan, end, label)` | the plan with well `end` labeled `label`, or its label removed if `label` is blank (section 3, "Well labels"). Throws if `end` isn't a well on the deck, or `label` isn't text. |
| `setWellLabels(plan, labels)` | the plan with its well labels replaced by `labels`, in the form of `wellLabels` (section 3), e.g. `{ Deep: { A1: "Cond 1" } }`. Throws if `labels` isn't an object, a labware isn't on the deck, a labware's wells aren't an object or are empty, a well isn't on its labware's grid, or a label isn't text, is blank, or has spaces at its ends. |


**Randomizations**
| Function | Returns |
|---|---|
| `addRandomization(plan, beforeId, { seed, volume })` | `{ plan, id }`: the plan with a new randomization last in `randomizations`, sitting before stage `beforeId` (or last, for `null`), with no sources, wells to fill or stages, the `seed` and `volume` given (each may be `null`), and, for its first run, the settings of the nearest transfer stage and the tips in use just before its place (section 3, "Where a new randomization's settings come from"; since 2026-11-05, item 20); and its ID. Throws if `beforeId` isn't a place a randomization can sit (section 3), or `seed` or `volume` isn't valid. |
| `randomizationAt(plan, id)` | the randomization with ID `id`, or `null`. |
| `randomizationOf(plan, stageId)` | the ID of the randomization that owns stage `stageId`, or `null`. |
| `setRandomization(plan, id, changes)` | the plan with the randomization's `sources`, `fill`, `seed`, `volume`, `settings`, `tipType` and `probes` replaced by those in `changes` (any of them; the others kept), checked as section 3 says, `fill` put in deck order and `probes` smallest first. `settings`, `tipType` and `probes` can be given only while it has no stages (its first run's; section 3). Its `stages` and `beforeId` don't change. Gives back the same plan if nothing changes. Throws if there's no such randomization, or anything is invalid (section 5). |
| `placeRandomization(plan, id, beforeId)` | the plan with a randomization that has no stages sitting before `beforeId` instead. Throws if it has stages, or `beforeId` isn't a place it can sit. |
| `randomizationProblems(plan, id)` | the randomization's problems, as messages, in order (section 3); `[]` if it can run. |
| `sourceGroups(sources)` | the source groups of `sources` (section 3, "Sharing tips"), as lists of indexes, e.g. `[[0, 1, 2], [3]]`; `[]` for no sources. The first source starts a group whatever its `sharesTips`. Throws if `sources` isn't a list of objects each with `sharesTips` `true` or `false`. |
| `setSourceSharesTips(sources, index, shares)` | `sources` with source `index` sharing the tips before it (`true`) or starting new tips (`false`); the same list if unchanged. Throws as section 5 says. |
| `moveSource(sources, from, place)` | `sources` with the source at `from` moved to `place` by the container rule (section 3, "Sharing tips"); the same list if nothing changes. Throws as section 5 says. |
| `removeSources(sources, indexes)` | `sources` without those at `indexes`, each group they leave keeping its tips. Throws as section 5 says. |
| `fillerShares(plan, id)` | how many of the filler's wells each filler well fills, `[{ index, count }]` in `sources`' order (section 3, "The filler's shares"); `[]` with no filler wells; `null` if the volume or the spare wells aren't known yet. |
| `isRandomizationOutOfDate(plan, id)` | `true` if the randomization has run and has problems now, or a run now would give different stages (section 3, "Out of date"). |
| `tipSetsToMake(plan, id)` | how many sets of new tips a run now would load for the randomization: the tip groups among the stages a trial run gives it (section 3, "Sets of new tips a run makes"); `null` while it has problems. |
| `sourceName(plan, id, source)` | a source's name (section 3), e.g. `"Cond 1"`, `"Drug A +2"` or `"Deep A1"`. |
| `randomizationStageValues(plan, id)` | its stages' shared values, each `null` where they differ (section 3). Throws if there's no randomization `id`. |
| `runRandomization(plan, id, forAll = {})` | the plan with the randomization run (section 3, "Running"), then `forAll`'s values (any of `sourceMode`, `sourceMixes`, `destinationMode`, `destinationMixes`, `tipType`, `probes`) set on every stage it owns or every tip change starting one of its source groups (step 9), as one edit; its `settings`, `tipType` and `probes` then `null`. Throws `forAll`'s first wrong value's message (section 5), then its first problem's message if it has any, changing nothing. |
| `removeRandomization(plan, id)` | the plan without the randomization and its stages. Throws if there's no such randomization, or its stages are all the plan's stages. |
| `canRemoveRandomization(plan, id)` | `true` unless its stages are all the plan's stages. |
| `setRandomizations(plan, randomizations)` | the plan with its randomizations replaced by `randomizations`, each in the form of section 3, `stages` included, for a list already in the plan's own form, such as one read from a plan file. Strict (order of checks below). Throws `Randomization 2: ` and the problem's message if not. |

`removeTipChange` and `removeStage` follow section 3's two rules for the stage after a
randomization.

**Transfer tables** (section 3, "Transfer tables"; 2026-11-05)
| Function | Returns |
|---|---|
| `readTransferTable(plan, table)` | `{ columns, problems }`: the table read against the plan (section 3, "Reading the table"). Throws if `table` isn't in its form (section 5). |
| `stockWellsOf(plan, component)` | the wells holding only `component` at Start, in deck order, each `{ labware, well }`; `[]` if none. Throws if there's no such component. |
| `transferTableProblems(plan, draft, at)` | the draft's problems, `{ row, column, message }` each, in order; `[]` if it can be added or updated. `at` is a stage ID or `null`. Throws if the draft isn't in its form, or `at` isn't a stage or `null`. |
| `sourceSplit(plan, draft, component, at)` | how a column's transfers split among its wells, `[{ well, count }]` in its `sources` order (section 3), from the column as `readTransferTable` reads it (other problems in the draft don't stop it, and its wells needn't be stock wells), for a caller showing the split while the draft is being edited. Throws if the draft or `at` isn't in its form (as `transferTableProblems`), then if the component's column has no amount, or no wells in `sources`. |
| `transferTableStages(plan, draft, at, { id, renamedFrom })` | the stages adding or updating would give, `[{ component, stage, transfers, settings, tips }]` in column order. `id` defaults to `null`, `renamedFrom` to `{}`. Throws the first problem's message if the draft has any. |
| `addTransferTable(plan, draft, beforeId)` | `{ plan, id }`: the plan with a new transfer table and its stages before stage `beforeId` (or last, for `null`), as one edit. Throws if `beforeId` isn't a place it can sit, or the draft has problems (the first one's message). |
| `updateTransferTable(plan, id, draft, { renamedFrom })` | the plan with the transfer table remade from `draft`, as one edit (section 3, "Updating"); the same plan if nothing would change. Throws if there's no such transfer table, or the draft has problems. |
| `transferTableAt(plan, id)` | the transfer table with ID `id`, or `null`. |
| `transferTableOf(plan, stageId)` | the ID of the transfer table owning stage `stageId`, or `null`. |
| `isTransferTableOutOfDate(plan, id)` | `true` if its draft has problems now, or would give different stages now (section 3, "Out of date"). Throws if there's no such transfer table. |
| `removeTransferTable(plan, id)` | the plan without the transfer table and its stages. Throws if there's no such transfer table, or its stages are all the plan's stages. |
| `canRemoveTransferTable(plan, id)` | `true` unless its stages are all the plan's stages. |
| `setTransferTables(plan, transferTables)` | the plan with its transfer tables replaced by `transferTables`, each in the form of section 3, for a list already in the plan's own form, such as one read from a plan file. Strict (order of checks below). Throws `Transfer table 2: ` and the problem's message if not. |

The edits refused on a transfer table's stages (section 3, "Where it sits") throw as section 5 says.

**Moving and copying** (section 3, "Moving and copying")
| Function | Returns |
|---|---|
| `columnBoxes(plan)` | the column's boxes, in order: `{ kind: "tipGroup", key, tipType, probes, stages }`, `{ kind: "randomization", id, tipGroups }` or `{ kind: "transferTable", id, tipGroups }`. |
| `moveItems(plan, items, place)` | `{ plan, placed }`: the plan with `items` moved to `place`, as one edit; the same plan, and `placed` the items, if nothing would change. Throws as section 5 says. |
| `copyOf(plan, items)` | the copied items for `items` (plain data, JSON). Throws if `items` isn't a list of items of this plan. |
| `copyItems(plan, items, place)` | `{ plan, placed }`: the plan with copies of `items` at `place`, as one edit: `pasteItems(plan, copyOf(plan, items), place)`. |
| `pasteItems(plan, copied, place)` | `{ plan, placed }`: the plan with the copied items at `place`, each stage and randomization a new one, as one edit. Throws as section 5 says. |

**Moving wells** (section 3, "Moving wells")
| Function | Returns |
|---|---|
| `isWellUsed(plan, well)` | `true` if the plan uses `well` (`{ labware, well }`) anywhere: starting contents, a transfer, a well label, a randomization, or a transfer table's sources. Throws if `well` isn't a well on the deck (`deck.checkWell`). |
| `isWellToFill(plan, well)` | `true` if `well` is one of a randomization's wells to fill. Throws if `well` isn't a well on the deck. |
| `moveWell(plan, from, to)` | the plan with well `from` replaced by well `to` wherever it names it, as one edit. Throws as section 5 says. |

## 5. Errors
Each message says what's wrong and how to fix it, in the plan's own terms. A failed edit changes
nothing: the plan given is never touched. Messages from the shared modules (`operation-list`,
`stage-list`, `deck`, `input-checks`) pass through unchanged. Values are shown with `describeValue`
(`error-messages` module), and lists of names with `listNames` (`input-checks` module).

| Problem | Message |
|---|---|
| `probesFor`: not a whole number from 1 to 8 | `The number of probes must be a whole number from 1 to 8, but got 9.` |
| `modeSettings`: no such mode for that end | `"Non-Contact" isn't a pipetting mode for the source. The modes for the source are "Fast", "Medium", "Slow".` |
| `modeSettings`: `mixes` is `true` and the mode can't mix | `Non-Contact can't mix, so it can't be used at the destination while the destination mixes. Turn the destination's mixing off first.` |
| `changeStageSettings`: an end mixes, but its technique is its mode's non-mixing one | `The source mixes, so its technique must be "OperationMix" (Medium's technique for mixing), but it's "Operation".` |
| `changeStageSettings`: an end doesn't mix, but its technique is its mode's mixing one | `The destination doesn't mix, so its technique must be "Operation" (Medium's technique without mixing), but it's "OperationMix".` |
| `changeStageSettings`: an end mixes with a mode that can't mix | `The destination mixes, but Non-Contact can't mix. Turn the destination's mixing off, or choose another mode.` |
| `setStageMix`: `id` isn't a stage | `There's no stage "9" in the plan.` |
| `setStageMix`: `end` isn't `"source"` or `"destination"` | `The end must be "source" or "destination", but got "middle".` |
| `setStageMix`: the end isn't one of the modes | `The source's technique and liquid type aren't one of the pipetting modes, so its mixing can't be switched. Choose a mode for it first.` |
| `setStageMix`: switching mixing on with a mode that can't mix | `Non-Contact can't mix. Choose another mode for the destination first.` |
| `addStage`: `beforeId` isn't a stage or `null` | `There's no stage "9" to add a stage before.` |
| `addStageWithNewTips`, `addMixStepWithNewTips`: `beforeId` isn't a stage or `null` | as `addStage` (or `addMixStep`): `There's no stage "9" to add a stage before.` |
| `removeStage`: the only stage | `A plan needs at least one stage, so its only stage can't be removed.` |
| `addTransfer`: the stage isn't in the plan | `There's no stage "9" in the plan to add this transfer to.` |
| `addTransfer`, `addTransfers`: a transfer into a mix step that isn't a mixed well (from a well into itself, of `MIX_STEP_VOLUME`) | `Stage 2, “Mix plate”, is a mix step: it only mixes wells. Add this transfer to a transfer stage.` |
| `changeVolume`: a mix step's mixed well | `A mix step's wells are mixed with its own settings, so their volume can't be changed.` |
| `mixWells`, `unmixWell`: `id` isn't a mix step | `Stage 2, “Drugs”, isn't a mix step, so it can't mix wells.` (or `There's no stage "9" in the plan.`) |
| `unmixWell`: the mix step doesn't mix that well | `Stage 2, “Mix plate”, doesn't mix Plate1 A2.` |
| `mixWells`: `wells` isn't a list of wells | `The wells to mix must be a list of wells, like [{ labware: "Plate1", well: "A1" }], but got null.` |
| `unmixWell`: `well` isn't a well | `The well to stop mixing must be a well, like { labware: "Plate1", well: "A1" }, but got undefined.` |
| `changeStageSettings`: `MIX_STEP_MODE`'s technique at one end only | `"MixOnly2" only mixes, so it's used at both ends of a mix step or at neither.` (naming `MIX_STEP_MODE`'s technique) |
| `changeStageSettings`: a mix step with a source mix | `A mix step mixes after dispensing only, so it can't have a source mix.` |
| `changeStageSettings`: a mix step without a destination mix | `A mix step needs a destination mix: that's what it does.` |
| `changeStageSettings`: a stage with transfers changing kind | `Stage 2, “Drugs”, has transfers, so it can't become a mix step.` (or `Stage 2, “Mix plate”, has mixed wells, so it can't become a transfer stage.`) |
| `addTipChange`: `beforeId` isn't a stage | `There's no stage "9" to add new tips before.` |
| `addTipChange`: it's the first stage | `The first stage always starts with new tips, so there can't be another tip change before it.` |
| `addTipChange`: there's one there already | `There are already new tips before stage "2".` |
| `setTipType`, `setTipProbes`, `removeTipChange`: none at `key` | `There are no new tips before stage "2".` |
| `setTipType`: not a known tip type | `"BC50" isn't a tip type. Choose one of "BC230", "BC1070".` |
| `removeTipChange`: `START` | `The run always starts by loading tips, so the first tips can't be removed.` |
| `setTipProbes`: `probes` isn't a list, or is empty | `The probes must be a list of probe numbers from 1 to 8, like [1, 2, 3, 4], but got "1,2".` |
| `setTipProbes`: a probe isn't a whole number from 1 to 8 | `Probe numbers must be whole numbers from 1 to 8, but got 9.` The first such value is named. |
| `setTipProbes`: a probe appears twice | `Probe 3 is listed more than once. List each probe once.` |
| No component with that name | `There's no component called "Dye" in this plan. Add it to the plan's components first.` |
| A component name isn't a name | `checkName`'s messages, naming `component name`. |
| A component name is used | `There's already a component called "Media". Choose a different name.` |
| A color isn't text, or is blank | `A component's color must be text, like "#4e79a7", but got null.` |
| A color is used by another component | `Drug_A already has that color. Choose a different one.` |
| `addToWells`: volume not a number above 0 | `The volume to add must be a number of microliters above 0, like 100, but got 0.` |
| `setConstituents`: the list, an entry, a name, an amount or a unit is wrong | `checkConstituents`'s messages (`concentrations.md`, section 5). |
| `setConstituents`: a constituent's family differs from its name's in another component | `Hy-Soy is in g/L in Feeding media. Give it a unit of that kind (g/L, mg/L), or a different name.` The component and unit are the first other component's carrying that name (section 3, "Constituents"); the units listed are `unitsOf` that unit's family (`concentrations.md`), joined by `, `. |
| `setOsmolality`: not a number of mOsm/kg, 0 or more, or `null` | `checkOsmolality`'s message (`osmolality.md`, section 5), naming the component, e.g. `The osmolality of Media must be a number of mOsm/kg, 0 or more, like 300, or none if it isn't known, but got -5.` |
| `readStockTable`, `addStocks`: `table` isn't a non-empty list of rows, each a non-empty list of the same number of cells, each text | As transfer tables' form message, for a stock table: `A stock table must be a list of rows, each a list of the same number of cells, each text, but got 5.` (or `… but row 3 has 4 cells and row 1 has 5.` / `… but row 2, cell 3 is null.` / `… but got [].`). |
| `readStockTable`, `addStocks`: `colors` isn't a list of text | `The colors must be a list of color texts, like ["#4e79a7"], but got 5.` |
| Stock table: a header is blank over a column with text (column index `c`, shown as `c + 1`) | `Column 3 has no header. Give it one, like “Hy-Soy (g/L)”.` |
| Stock table: a second osmolality column | `There are two Osmolality columns. Keep one.` |
| Stock table: a header without its unit in brackets at the end | `“KCl” needs its unit in brackets, like “KCl (g/L)”.` |
| Stock table: a header with a blank name | `“(mM)” needs a constituent's name before its unit, like “Drug A (mM)”.` |
| Stock table: a unit the tool doesn't know | `“g” in “NaCl (g)” isn't a unit the tool knows. Use one of M, mM, µM, nM, g/L, mg/L, %, ×, cells/mL.` (the units of `CONCENTRATION_UNITS`, in order, joined by `, `) |
| Stock table: a constituent name in two columns | `“Drug A” has two columns. Give each constituent one column.` |
| Stock table: a row with a blank name (row index `r`, shown as `r + 1`: the header is row 1, as in the spreadsheet and in transfer tables' messages) | `Row 5 has no name. Give the stock a name, or take the row out.` |
| Stock table: a name already in the plan | `“Media” is already in the plan. Rename the row, or take it out.` |
| Stock table: a name in an earlier row | `“Feed” is in the table twice. Each stock needs its own name.` |
| Stock table: an amount that isn't a number | `Buffer B's KCl must be a number, like 4, but is “two”.` (the row's name, or `Row 5` if blank, numbered as above; the column's constituent name; the cell's trimmed text) |
| Stock table: an osmolality that isn't a number | `Buffer B's osmolality must be a number, like 300, but is “high”.` |
| Stock table: a row's try throws | The thrown message, prefixed with the row's name and a colon: `Drug A stock: Hy-Soy is in g/L in Feeding media. Give it a unit of that kind (g/L, mg/L), or a different name.` |
| Stock table: no color left for a row | `There's no free color for Feed. Two components can't share one, and all 30 are taken. Take some rows out, or remove a component.` (30 is `colors.length`) |
| `addStocks`: no stocks | `The stock table has no stocks to add. Give it at least one row under the header.` |
| `copyDeck`: `point` isn't non-blank text | `The point a deck is copied at must be text, like "At the end, after all stages", but got 5.` |
| `copyDeck`: a problem other than an overfill at the point | `The deck can't be copied at this point: a transfer before it draws more than a well can give. Fix the overdraws first, or copy from an earlier point.` |
| `pasteDeck`: not a copied deck (not an object, the wrong properties or format) | `This isn't a copied deck: copy one with Copy deck in the transfer designer.` |
| `pasteDeck`: a version above `COPIED_DECK_VERSION`, or not a whole number from 1 | `This deck was copied by a newer version of the transfer designer (copied deck version 2; this one reads up to 1). Use the newer version.` / for a version that isn't a whole number from 1, the not-a-copied-deck message. |
| `pasteDeck`: `point`, `components`, `wells` or a label object not in its form | `This copied deck is damaged: its wells must be a list of { labware, well, components }, but got 5.` (naming the part: `its point must be text`, `its components must be a list of { name, color, constituents, osmolality }`, `its wells …`, `its well labels must be an object like { Plate1: { A1: "Cond 1" } }`, `its labware labels must be an object like { Plate1: "Assay plate" }`; a well listed twice: `… but Plate1 A1 is listed twice.`) |
| `pasteDeck`: a component already in the plan differs | `Media is already in this plan with different contents or osmolality. Rename one of them, or make them match, then paste again.` |
| `pasteDeck`: no free color | `There's no free color for Media: all 30 are taken. Remove a component first.` (30 is `colors.length`) |
| `pasteDeck`: a well already labeled differently | `Assay plate A1 is already named “Cond 2” here, but “Cond 1” in the copy. Rename one of them, then paste again.` |
| `pasteDeck`: a labware already labeled differently | `Plate1 is labeled “Plate A” here, but “Assay plate” in the copy. Rename one of them, then paste again.` |
| `setLabel`: label isn't text | `A label must be text, like "Assay plate", but got 5.` |
| `setLabel`: another labware has that label | `Deep already has the label "Drug plate". Choose a different one.` |
| `setLabels`: `labels` isn't an object (including `null` and lists) | `The labels must be an object of labware names and labels, like { Plate: "Assay plate" }, but got a list.` |
| `setLabels`: a label isn't text | `The label for Plate must be text, like "Assay plate", but got 5.` |
| `setLabels`: a label is blank | `The label for Plate is blank. A labware without a label is left out of the labels.` |
| `setLabels`: a label has spaces at its ends | `The label for Plate, " Assay plate", has spaces at the start or end. Remove them.` |
| `setLabels`: a label is its own labware's name | `The label for Plate is its own name. A labware without a label is left out of the labels.` |
| `setExperimentName`: `name` isn't text, or isn't a valid experiment name | `checkExperimentName`'s messages (`file-writer.md`, section 5), unchanged, e.g. `The experiment name can't contain " " (a space). …` |
| `setLabels`: two labware would show one label | `Plate and Deep would both show as "Drug plate". Give each labware a different label.` (the pair in the deck's order) |
| `wellLabelOf`, `setWellLabel`: `end` isn't a well on the deck | `deck.checkWell`'s messages, unchanged, e.g. `"Z99" isn't a well on Plate. Its wells are A1 to H12.` |
| `setWellLabel`: label isn't text | `A well's label must be text, like "Cond 1", but got 5.` |
| `setWellLabels`: `labels` isn't an object (including `null` and lists) | `The well labels must be an object of labware names, each holding an object of wells and labels, like { Deep: { A1: "Cond 1" } }, but got a list.` |
| `setWellLabels`: a labware isn't on the deck | the deck's message, e.g. `There's no labware "Bench" on the deck. The deck has "Plate", "Deep", "Res".` |
| `setWellLabels`: a labware's wells aren't an object (including `null` and lists) | `The well labels for Deep must be an object of wells and labels, like { A1: "Cond 1" }, but got 5.` |
| `setWellLabels`: a labware's wells are empty | `The well labels for Deep are empty. A labware without labeled wells is left out of the well labels.` |
| `setWellLabels`: a well isn't on its labware's grid | the deck's message, e.g. `"Z99" isn't a well on Deep. Its wells are A1 to H12.` |
| `setWellLabels`: a label isn't text | `The label for Deep A1 must be text, like "Cond 1", but got 5.` |
| `setWellLabels`: a label is blank | `The label for Deep A1 is blank. A well without a label is left out of the well labels.` |
| `setWellLabels`: a label has spaces at its ends | `The label for Deep A1, " Cond 1", has spaces at the start or end. Remove them.` |
| A randomization's `id` isn't one of the plan's | `There's no randomization "r9" in the plan.` |
| `addRandomization`, `placeRandomization`: `beforeId` isn't a stage or `null` | `There's no stage "9" to add a randomization before.` |
| `addRandomization`, `placeRandomization`: `beforeId` is inside a tip group; `setRandomizations` (loading a file): a stored `beforeId` inside a tip group or inside another randomization | `A randomization sits between tip groups, so it can't go before stage 3, “Drugs”.` (A `beforeId` inside another randomization's stages, given to `addRandomization` or `placeRandomization`, gets the "stay together" message below; 2026-11-05, item 20.) |
| `placeRandomization`: it has stages | `This randomization has run, so it sits where its stages are.` |
| `setRandomization`: `changes` isn't an object, or gives a property it can't change | `The changes to a randomization must be an object of "sources", "fill", "seed", "volume", "settings", "tipType" and "probes", but got "stages".` (naming the first wrong property, or the value) |
| `sources` or `fill` isn't a list | `A randomization's sources must be a list, but got 5.` (or `wells to fill`) |
| a source isn't an object with exactly `labware`, `well`, `replicates`, `filler` and `sharesTips` | `Source 2 must be an object with exactly "labware", "well", "replicates", "filler" and "sharesTips".` |
| `sharesTips` isn't `true` or `false` | `Source 2's "sharesTips" must be true or false, but got "yes".` |
| the first source's `sharesTips` is `true` | `Source 1 is the first source, so it starts on new tips: its "sharesTips" must be false. A randomization never shares tips with stages outside it.` |
| a source or well to fill isn't a well on the deck | `Source 2: ` or `Well to fill 3: `, then `deck.checkWell`'s message |
| a well is a source twice, or to fill twice | `Deep A1 is a source twice. List each source once.` / `Plate1 B2 is a well to fill twice. List each once.` |
| a well is both a source and a well to fill | `Deep A1 is both a source and a well to fill. A well can be only one.` |
| replicates aren't a whole number of at least 1, or `null` | `Source 2's replicates must be a whole number of at least 1, or null, but got 1.5.` |
| `filler` isn't `true` or `false` | `Source 2's "filler" must be true or false, but got "yes".` |
| a filler well has replicates | `Source 3 is a filler well, so its replicates must be null, but got 4.` |
| `setRandomizations`: two entries in `stages` name filler wells of one randomization | `Randomization 2: its filler has two stages.` (An entry naming a filler well that isn't the first is accepted, as a plan between `setRandomization` and a run holds it; the filler stage's transfers may draw from any of its filler wells.) |
| `fillerShares`, `isRandomizationOutOfDate`, `tipSetsToMake`: no such randomization | `There's no randomization "r9" in the plan.` (as for the other randomization functions) |
| seed not a whole number from 1 to 999,999, or `null` | `A randomization's seed must be a whole number from 1 to 999,999, or null, but got 0.` |
| volume not a number above 0, or `null` | `A randomization's volume must be a number of µL above 0, or null, but got 0.` |
| settings refused | the stage list's message, or the mixing rule's (section 3), unchanged |
| settings are a mix step's | `A randomization's transfers move liquid, so its settings can't be a mix step's.` |
| `settings`, `tipType` or `probes` given (even unchanged) once it has stages (2026-11-05, item 20) | `This randomization has run, so its settings and tips are its stages': change them on the stages, or all at once when running it.` |
| tip type or probes refused | `setTipType`'s or `setTipProbes`' message, unchanged |
| `runRandomization` with problems | the first problem's message (section 3) |
| `removeRandomization`: its stages are all the plan's stages | `This randomization's stages are all the plan's stages, and a plan needs at least one. Add a stage outside it first.` |
| `removeTipChange`: the tip change of a stage a randomization without stages sits before | `A randomization sits before stage 2, “Top up”, between tip groups, so these tips can't be removed.` |
| `removeTipChange`: the tip change after a randomization | `This tip change keeps stage 7, “Media”, off the randomization's tips. A randomization never shares tips with other stages.` (`… never shares tips.` until 2026-11-05) |
| `setRandomizations`: not a list, or a randomization isn't an object with exactly its ten properties | `The randomizations must be a list, but got 5.` / `Randomization 2 must be an object with exactly "id", "beforeId", "sources", "fill", "seed", "volume", "settings", "tipType", "probes" and "stages".` |
| `setRandomizations`: `settings`, `tipType` and `probes` not all `null` once it has stages, or any `null` while it has none (2026-11-05, item 20) | `Randomization 2 has stages, so its "settings", "tipType" and "probes" must be null: its stages hold them.` / `Randomization 2 hasn't run, so it needs "settings", "tipType" and "probes" for its first run.` |
| `runRandomization`: `forAll` isn't an object of only `sourceMode`, `sourceMixes`, `destinationMode`, `destinationMixes`, `tipType` and `probes` | `The settings for every stage must be an object of "sourceMode", "sourceMixes", "destinationMode", "destinationMixes", "tipType" and "probes", but got "speed".` (naming the first wrong property, or the value) |
| `runRandomization`: a mode in `forAll` isn't one for its end, or `…Mixes` isn't `true` or `false` | `modeSettings`' message for that end (e.g. `"Fastest" isn't a pipetting mode for the source. …`) / `Whether the source mixes must be true or false, but got "yes".` |
| `runRandomization`: `forAll` turns mixing on at an end whose mode (given, or a stage's own) can't mix | `modeSettings`' message: `Non-Contact can't mix, so it can't be used at the destination while the destination mixes. Turn the destination's mixing off first.` (checked before anything changes, for every stage it owns or would make) |
| `runRandomization`: `forAll`'s `tipType` or `probes` | `setTipType`'s or `setTipProbes`' message |
| `runRandomization`: `forAll` gives an end's mixing without its mode, and a stage's end isn't one of the modes, or (mixing on) its mode can't mix | `Stage 5, “Drug A”, uses Non-Contact at the destination, which can't mix. Choose a mode for every stage, or change that stage first.` / `Stage 5, “Drug A”, doesn't use one of the modes at the source. Choose a mode for every stage, or change that stage first.` (`source` or `destination`; the first stage in stage order) |
| an edit of an owned stage's transfers (`addTransfer`, `addTransfers`, `changeVolume`, `removeTransfer`) | `Stage 5, “Drug A”, is part of a randomization: change its sources and wells in the randomization.` |
| `renameStage` of an owned stage | `Stage 5, “Drug A”, is part of a randomization: it's named after its source.` |
| `removeStage` of an owned stage | `Stage 5, “Drug A”, is part of a randomization: take its source out of the randomization, or remove the whole randomization.` |
| `removeTipChange` of an owned stage's tip change, or `addTipChange` before an owned stage | `Stage 5, “Drug A”, is part of a randomization: which of its stages share tips is set by its sources.` |
| `addStage`, `addMixStep` without `takeTips` just after its last stage | `A stage added here would share the randomization's tips. Add it with new tips, from the seam between tip groups.` |
| adding a stage, mix step, randomization or transfer table inside it (a `beforeId` that's an owned stage but its first), or a stage or mix step with `takeTips` before its first stage | `A randomization's stages stay together: add before its first stage or after its last.` |
| `setRandomizations`: an ID isn't `"r"` and a whole number of at least 1, or is repeated | `Randomization 2's ID must be "r" and a whole number, like "r1", but got "x".` / `Randomizations 1 and 3 both have the ID "r2".` |
| `setRandomizations`: `fill` not in deck order, or `probes` not smallest first | `Randomization 2: its wells to fill must be in deck order, but Plate1 B3 comes before Plate1 B2.` / `Randomization 2: its probes must be listed smallest first.` |
| `setRandomizations`: `stages` isn't a list of `{ labware, well, stage }`, names a stage not in the plan, names one stage twice, or gives one well two stages | `Randomization 2: its stages must be a list of objects with exactly "labware", "well" and "stage".` / `Randomization 2: its stage "9" isn't in the plan.` / `Stage "5" belongs to two randomizations, 1 and 2.` (or, in one, `Randomization 2: stage "5" is listed twice.`) / `Randomization 2: Deep A4 has two stages.` (A stage whose well is no longer a source is accepted: `setRandomization` leaves it until the next run, so a plan between those edits saves and opens.) |
| `setRandomizations`: its stages aren't consecutive, aren't in stage order, share a tip group with a stage outside it (its first stage doesn't start a tip group, or the stage just after its last doesn't), or one is a mix step | `Randomization 2: its stages must come one after another, in stage order.` / `Randomization 2: stage "5" shares tips with a stage outside the randomization. A randomization never shares tips with other stages.` (naming its first stage, or its last stage when the stage after it is the one sharing) / `Randomization 2: stage "5" is a mix step.` (Until 2026-11-05 each stage had to be the only stage of its tip group, `stage "5" must be the only stage of its tip group.`; now its stages may share tip groups with each other. Whether they share as its sources say isn't checked here: a plan saved after `setRandomization` and before a run can differ, and `isRandomizationOutOfDate` reports it.) |
| `sourceGroups`, `setSourceSharesTips`, `moveSource`, `removeSources`: `sources` isn't a list of objects each with `sharesTips` `true` or `false` | `The sources must be a list of objects, each with "sharesTips" true or false, but got 5.` (naming the list, or the first entry that isn't one) |
| `setSourceSharesTips`, `moveSource`: the index isn't one of the list's | `There's no source at index 7: the list has 4 sources (indexes 0 to 3).` (one source: `the list has 1 source (index 0).`; none: `There's no source at index 0: the list has no sources.`) |
| `setSourceSharesTips`: `shares` isn't `true` or `false` | `Whether a source shares tips must be true or false, but got "yes".` |
| `setSourceSharesTips`: the first source set to share | `The first source always starts on new tips, so it can't share tips: a randomization never shares tips with stages outside it.` |
| `moveSource`: a place that isn't one of the two forms, or its index is outside the list's groups | `The place must be between source groups (index 0 to 3) or inside one, but got {"kind":"between","index":9}.` (the largest real index; the place as JSON) |
| `moveSource`: `inGroup`'s position is outside its group | `Source group 1 has positions 0 to 2, but got 5.` |
| `removeSources`: `indexes` isn't a list of the list's indexes, each once | `The sources to remove must be a list of indexes from 0 to 3, each once, but got [1, 1].` (one source: `… a list of index 0, at most once, but got [1].`; none: `There are no sources to remove, but got [0].`) |
| `setRandomizations`: `beforeId` isn't a place it can sit | `Randomization 2: ` and `addRandomization`'s message |

| `moveItems`, `copyOf`, `copyItems`: `items` isn't a non-empty list | `The things to move must be a list of stages, tip groups, randomizations or transfer tables, but got 5.` (transfer tables named since 2026-11-05) (`copy` for `copyOf` and `copyItems`) |
| an item isn't `{ kind, id }` with a known kind | `Item 2 must be { kind, id }, with kind "stage", "tipGroup", "randomization" or "transferTable", but got "box".` |
| an item's stage isn't in the plan | `There's no stage "9" in the plan.` |
| a `tipGroup` item's ID isn't the first stage of an ordinary tip group | `Stage "3" doesn't start a tip group, so it can't name one.` |
| an item's randomization isn't in the plan | `There's no randomization "r9" in the plan.` (as above) |
| a place isn't one of the three forms, or its index is outside the column | `The place must be between boxes (index 0 to 4), inside a tip group or inside a transfer table, but got {"kind":"between","index":9}.` (the column's real largest index; the place as JSON) |
| `inTipGroup`'s position is outside its tip group | `Box 2 has positions 0 to 3, but got 7.` |
| `inTipGroup` names a randomization's box | `Box 3 is a randomization: nothing can be put inside it.` |
| a tip group or randomization put inside a tip group | `A tip group or randomization can't go inside another tip group: put it between tip groups.` |
| `moveItems`: a randomization's stage without its randomization | `Stage 5, “Drug A”, belongs to a randomization, which moves its stages with it: move the whole randomization, or copy the stage.` |
| `pasteItems`: not copied items (not an object, wrong `format`, `items` not a non-empty list) | `Can't paste: this isn't stages, tip groups, randomizations or transfer tables copied from the transfer designer.` (The per-item form message, `Can't paste: item 2 isn't a stage, tip group or randomization as the transfer designer copies them.`, stays as it is.) |
| `pasteItems`: a newer version | `Can't paste: these were copied by a newer version of the tools (version 3).` |
| `pasteItems`: an entry isn't in its form | `Can't paste: item 2 isn't a stage, tip group or randomization as the transfer designer copies them.` |
| `pasteItems`: a value refused by the edit that would make it | `Can't paste: item 2: ` and that edit's message, e.g. `Can't paste: item 2: "Z99" isn't a well on Plate1. Its wells are A1 to H12.` (Messages pass through unchanged, so the operation list's stage rule names the new stage's ID and an operation number, which the user never sees; roadmap, "Technical debt", "Some messages use internal terms".) |
| `pasteItems`: two stages for one well, or a stage that's a mix step, in a randomization | `Can't paste: item 2: Deep A1 has two stages.` / `Can't paste: item 2: its stage for Deep A1 is a mix step.` |
| A transfer table's `id` isn't one of the plan's | `There's no transfer table "t9" in the plan.` |
| `readTransferTable`, and every function taking a draft: `table` isn't a non-empty list of rows, each a non-empty list of the same number of cells, each text | `A transfer table must be a list of rows, each a list of the same number of cells, each text, but got 5.` (naming the value, or the first row or cell that's wrong: `… but row 3 has 4 cells and row 1 has 5.` / `… but row 2, cell 3 is null.` / `… but got [].`). One row, or one column, is accepted (it adds nothing). |
| a draft isn't an object with exactly `table` and `sources` | `A transfer table's draft must be an object with exactly "table" and "sources", but got 5.` |
| `sources` isn't an object of lists | `A transfer table's sources must be an object of component names, each with a list of wells, like { Media: [{ labware: "Res1", well: "1" }] }, but got 5.` |
| a `sources` key isn't a component | `A transfer table draws Dye from wells, but there's no component called "Dye" in this plan.` |
| a source list is empty, a well isn't on the deck, or a well is listed twice | `Media's source wells are empty. List at least one, or leave Media out.` / `Media's source well 2: ` and `deck.checkWell`'s message / `Res1 1 is one of Media's source wells twice. List each once.` |
| `stockWellsOf`: no such component | as for components: `There's no component called "Dye" in this plan. Add it to the plan's components first.` |
| `sourceSplit`: the component's column isn't in the draft, or makes no stage; or it has no wells | `Media has no column with an amount in this table.` / `Choose a well for Media to draw from.` |
| `addTransferTable`, `updateTransferTable`, `transferTableStages`: the draft has problems | the first problem's message |
| `addTransferTable`: `beforeId` isn't a stage or `null` | `There's no stage "9" to add a transfer table before.` |
| `addTransferTable`: `beforeId` is inside a tip group | `A transfer table sits between tip groups, so it can't go before stage 3, “Drugs”.` (Inside a transfer table or a randomization: each one's "stay together" message.) |
| `transferTableProblems`, `sourceSplit`, `transferTableStages`: `at` isn't a stage or `null` | `There's no stage "9" in the plan.` |
| `removeTransferTable`: its stages are all the plan's stages | `This transfer table's stages are all the plan's stages, and a plan needs at least one. Add a stage outside it first.` |
| an edit of its stages' transfers (`addTransfer`, `addTransfers`, `changeVolume`, `removeTransfer`) | `Stage 3, “Media”, is part of a transfer table: change its amounts in the table.` |
| `renameStage` of one of its stages | `Stage 3, “Media”, is part of a transfer table: it's named after its component.` |
| `removeStage` of one of its stages | `Stage 3, “Media”, is part of a transfer table: clear its column in the table, or remove the whole table.` |
| `removeTipChange` of one of its stages | `Every stage of a transfer table starts on new tips, so these can't be removed.` |
| `removeTipChange` of the stage just after it | `This tip change keeps stage 7, “Wash”, off the transfer table's tips. A transfer table never shares tips with other stages.` |
| `addStage`, `addMixStep` without `takeTips` just after its last stage (a `beforeId` that's the stage after it, or `null` when it's last) | `A stage added here would share the transfer table's tips. Add it with new tips, from the seam between tip groups.` |
| adding a stage, mix step, randomization or transfer table inside it (a `beforeId` that's one of its stages but its first), or a stage or mix step with `takeTips` before its first stage | `A transfer table's stages stay together, each on its own tips: add before its first stage or after its last.` |
| `moveItems`: one of its stages without the transfer table, to a place outside its own transfer table | `Stage 3, “Media”, belongs to a transfer table, which moves its stages with it: move it within the table, move the whole transfer table, or copy the stage.` |
| `inTipGroup` names a transfer table's box | `Box 3 is a transfer table: only its own stages can be moved inside it.` |
| `inTransferTable` names a box that isn't a transfer table, or with items that aren't only that transfer table's stages | `Box 3 isn't a transfer table.` / `Box 3 is a transfer table: only its own stages can be moved inside it.` |
| `inTransferTable`'s position is outside its stages | as for `inTipGroup`: `Box 2 has positions 0 to 3, but got 7.` |
| `setTransferTables`: not a list, or an entry isn't an object with exactly its four properties | `The transfer tables must be a list, but got 5.` / `Transfer table 2 must be an object with exactly "id", "table", "sources" and "stages".` |
| `setTransferTables`: an ID isn't `"t"` and a whole number of at least 1, or is repeated | `Transfer table 2's ID must be "t" and a whole number, like "t1", but got "x".` / `Transfer tables 1 and 3 both have the ID "t2".` |
| `setTransferTables`: `stages` isn't a non-empty list of `{ component, stage }`, names a stage not in the plan or twice, a component twice, or a component that isn't one of its table's headers (trimmed) | `Transfer table 2: its stages must be a non-empty list of objects with exactly "component" and "stage".` / `Transfer table 2: its stage "9" isn't in the plan.` / `Transfer table 2: stage "5" is listed twice.` / `Transfer table 2: Media has two stages.` / `Transfer table 2: its stage for Dye has no column in its table.` |
| `setTransferTables`: a stage isn't named after its component | `Transfer table 2: stage "5" must be named “Media”, after its component.` |
| `setTransferTables`: its stages aren't in its columns' order, aren't consecutive in stage order, one isn't the only stage of its tip group, or one is a mix step | `Transfer table 2: its stages must be in the order of its columns.` / `Transfer table 2: its stages must come one after another, in stage order.` / `Transfer table 2: stage "5" shares tips with another stage. Every stage of a transfer table starts on new tips.` / `Transfer table 2: stage "5" is a mix step.` |
| `setTransferTables`: a randomization without stages sits before one of its stages other than its first | `Randomization 2 sits before stage "5", inside transfer table 1. A randomization sits between tip groups.` |
| `setTransferTables`: a stage is owned by another transfer table, or by a randomization | `Stage "5" belongs to two transfer tables, 1 and 2.` / `Stage "5" belongs to transfer table 2 and randomization 1.` |
| `pasteItems`: a transfer table item in a version 1 to 3 copy | the form message: `Can't paste: item 2 isn't a stage, tip group or randomization as the transfer designer copies them.` |
| `pasteItems`: a transfer table's values or stages refused | `Can't paste: item 2: ` and `setTransferTables`' message without its `Transfer table 2: ` prefix, e.g. `Can't paste: item 2: its stage for Dye has no column in its table.` |
| `isWellUsed`, `isWellToFill`, `moveWell`: a well isn't on the deck | `deck.checkWell`'s messages, unchanged, e.g. `"Z99" isn't a well on Plate1. Its wells are A1 to H12.` |
| `moveWell`: `to` is `from` | `Res1 3 is where it is already. Choose another well to move it to.` |
| `moveWell`: `from` isn't in use | `The plan doesn't use Res1 7, so there's nothing to move.` |
| `moveWell`: `from` is a randomization's well to fill | `Wells a randomization fills can't be moved.` (Andy, 2026-11-02: the short form) |
| `moveWell`: `to` is in use | `Plate1 A1 is already used in the plan. Move to a well the plan doesn't use.` |

`moveWell`'s messages name a well by its labware's name in the deck description and the well, as this
module's other messages do (e.g. `Res1 3`); a tool may show its own wording instead.

**Order of checks.** The first problem found is reported:
- `addTransfer`: the operation list's checks of the transfer (its form, then the stage rule), then
  its source well on the deck, then its destination well (`deck`'s messages), then its stage in the
  plan, then, for a mix step, that it's a mixed well. So a badly formed transfer gets the operation
  list's message, never a confusing one from a later check.
- `addTipChange`: in the table's order (not a stage, the first stage, already has new tips), then
  a randomization's stage (2026-11-05, item 20).
- `removeTipChange`: `START`, then none at `key`, then the transfer table refusals (its stage's,
  then the stage just after it), then a randomization's stage, then the stage just after a
  randomization's last stage, then a stage a randomization without stages sits before.
- `setTipType`: none at `key`, then the tip type.
- `changeStageSettings`: the stage list's checks, then the source's mixing, then the
  destination's, then the mix step checks in the table's order (one end only, source mix,
  destination mix, change of kind).
- `mixWells`: the mix step, then the list, then each well on the deck.
- `setStageMix`: the stage, then the end, then the end's mode, then the stage list's checks of the
  mix, then whether the mode can mix.
- `setTipProbes`: none at `key`, then the list, then each probe in order, then repeats. (These three
  messages moved here from the stage list, unchanged, with probes, on 2026-10-30.)
- `addComponent`: the name (`checkName`, then used), then the color (text, then used).
- `renameComponent`: the component exists, then the new name.
- `setComponentColor`: the component exists, then the color.
- `addToWells`: the component exists, then the volume, then each well in turn.
- `setConstituents`: the component exists, then `checkConstituents` (the whole list), then each
  constituent's family against the other components, in list order.
- `setOsmolality`: the component exists, then `checkOsmolality`.
- `setLabel`: the labware, then the label is text, then (after trimming) no other labware has it.
- `setWellLabel`: the well (`deck.checkWell`'s order), then the label is text.
- `setRandomization`: the randomization, then `changes`' form, then in this order whichever are
  given: `sources` (the list, then each source's form, well, replicates, filler and `sharesTips` in
  turn, then repeats, then each filler well's replicates, in order, then the first source's
  `sharesTips`), `fill` (the list, then each well, then
  repeats), a well in both (on the result), `seed`, `volume`, then, if any of `settings`, `tipType`
  and `probes` is given, whether it has stages (refused if so), then `settings` (the stage list,
  the mixing rule, then not a mix step's), `tipType`, `probes`.
- `runRandomization`: the randomization, then `forAll`'s form, then its values in the order
  `sourceMode`, `sourceMixes`, `destinationMode`, `destinationMixes`, `tipType`, `probes`, then
  the problems (`randomizationProblems`), then step 9's refusals (a mode can't mix with mixing
  on, then a stage whose end isn't one of the modes or can't mix), first stage first, checked on the
  run's result before it's given back.
- `addRandomization`, `placeRandomization`: the randomization (for `placeRandomization`), whether
  it has stages, then `beforeId` inside another randomization's stages (the "stay together"
  message), then `beforeId` a stage, then inside a transfer table, then a place it can sit; then
  `seed`, then `volume`.
- `setRandomizations`: the list; then each randomization in turn: its form (exactly its
  properties), its ID, the checks of `setRandomization` on its values (`settings`, `tipType` and
  `probes` only when not `null`), `fill`'s order and `probes`' order, then `stages` (form, then
  whether `settings`, `tipType` and `probes` are `null` exactly when `stages` isn't empty, each stage in the plan, not twice, no well twice,
  consecutive and in stage order, sharing no tip group with a stage outside it (its first stage,
  then the stage after its last), not a mix step); then IDs repeated,
  then stages owned by two randomizations; then, against the whole new list, each `beforeId` (a
  place it can sit, so never inside another randomization's stages).
- `sourceGroups`, `setSourceSharesTips`, `moveSource`, `removeSources`: the list, then the index
  (`from`, `index`, or each of `indexes`), then `shares` or the place (its form and range, then its
  position), then, for `setSourceSharesTips`, the first source set to share.
- `setWellLabels`: that `labels` is an object; then each labware in turn, in the order it holds
  them: on the deck, its wells an object, not empty, then each of its wells in turn: on the grid,
  then its label is text, not blank, without spaces at its ends.
- `moveItems`, `copyOf`, `copyItems`: the list, then each item in turn (its form, then that it's
  in the plan, then for a tip group that its ID starts one); then the place's form and range, then
  a randomization's or transfer table's box, then the container rule; then, for `moveItems`, a
  randomization's stage without its randomization, then a transfer table's stage without its
  transfer table (unless the place is inside its own transfer table).
- `readTransferTable`: the table's form (the list, then each row in turn: a list, its length,
  then each cell text); then the problems, in reading order (section 3).
- A draft (`transferTableProblems`, `sourceSplit`, `transferTableStages`, `addTransferTable`,
  `updateTransferTable`): for `updateTransferTable` the transfer table first; then the draft's form
  (an object with exactly its two properties, then `table`'s form, then `sources`: an object, then
  each key in its order: a component, then its list, then each well on the deck, then repeats);
  then `at` (or `beforeId`: a stage or `null`, then a place it can sit); then the problems, the
  table's in reading order, then "adds nothing", then each column's sources in column order (no
  stock well, no wells chosen, a well that isn't a stock well, a well the table fills; for each,
  the first such in its list).
- The refusals for a transfer table's stages come after the edit's own checks that the stage (or
  `beforeId`, or tip change) exists, and before any other check.
- `setTransferTables`: the list; then each transfer table in turn: its form (exactly its
  properties), its ID, `table`'s form, `sources`' form (as a draft's), then `stages` (form, each
  stage in the plan, not twice, each component a column's header, no component twice, each stage
  named after its component, in the columns' order, consecutive and in stage order, each the only
  stage of its tip group (its first, then each after it), not a mix step); then IDs repeated; then
  stages owned by two transfer tables; then a stage owned by a transfer table and a randomization;
  then each randomization without stages, in order, sitting before a transfer table's stage other
  than its first.
- `addStage`, `addMixStep`: `beforeId` a stage or `null`, then the transfer table refusals (inside
  it, `takeTips` before its first stage, then just after its last stage), then the randomization
  refusals in the same order (inside it, `takeTips` before its first stage, then just after its
  last stage).
- `addStageWithNewTips`, `addMixStepWithNewTips`: `beforeId` a stage or `null`, then inside a
  transfer table, then inside a randomization.
- `moveWell`: `from` on the deck, then `to` on the deck (`deck.checkWell`'s order), then the same
  well, then `from` in use, then `from` a well to fill, then `to` in use.
- `pasteItems`: the copied items' form and version, then each item in turn, in order (its form,
  then its values in the order its edits check them: name, settings, each transfer, tips, then a
  randomization's values and stages); then the place, as above.
- `setLabels`: that `labels` is an object; then each entry in turn, in the order it holds them: its
  labware on the deck (`deck`'s message), then its label: text, not blank, no spaces at its ends,
  not its own labware's name; then, on the new table as a whole, that no two labware show one label
  (counting a labware without a label by its name), naming the first such pair in the deck's order.

## 6. Test cases
Each becomes at least one unit test in `transfer-designer.test.js`, inside
`describe("transfer-designer", …)`. Each row of section 5 has at least one test, and so does each
order of checks.

**Configuration**
- `config/pipetting-modes.js`: each mode's properties are exactly `name`, `technique`,
  `mixingTechnique`, `liquidType`, `ends`; names valid and unique; `mixingTechnique` a valid name
  other than `technique`, or `null`; liquid types follow Biomek's rule; `ends` valid; for each end,
  no technique-and-liquid-type pair repeated among its modes' techniques and mixing techniques; each
  end has at least one mode; `DEFAULT_PIPETTING_MODE` names a mode usable at both ends.
- `config/tip-types.js`: a non-empty list of valid names, none repeated; `DEFAULT_PROBE_COUNT` a
  whole number from 1 to 8.
- `config/mixing.js`: `DEFAULT_MIX` is accepted by the stage list as a mix (a stage given it at
  either end, with the mixing technique, is accepted); `DEFAULT_MIX` as exported here can't be
  changed.

**Plans and modes**
- `defaultSettings()` gives `DEFAULT_PIPETTING_MODE`'s technique and liquid type at both ends,
  `sourceMix` and `destinationMix` `null`, and nothing else (no probes).
- `emptyPlan()` gives one stage named `NEW_STAGE_NAME` with default settings, `START` tips of the
  first tip type on the first `DEFAULT_PROBE_COUNT` probes (`[1, 2, 3, 4]`), an experiment name of `""`, no
  well labels (`{}`), no randomizations (`[]`), and nothing else; its `stageId` is
  that stage.
- `setExperimentName` sets `"Exp36"`; trims `" Exp36 "` to `"Exp36"`; `""` and `"  "` remove the
  name; giving the name it already has returns the same plan; `5`, `"Exp 36"` and a name of 41
  characters throw with `checkExperimentName`'s messages, leaving the plan unchanged.
- `probesFor` gives `[1]` for 1 and all eight for 8; 0, 9, 2.5 and `"4"` throw.
- `modeSettings` and `modeOf` round-trip every mode at every end it allows, with `mixes` `false`
  and, for a mode that can mix, `true`; a mode not allowed at an end throws; `mixes` `true` with
  Non-Contact throws; settings matching no mode give `null`.

**Stages and stage order**
- After every kind of edit, the stage order holds every stage exactly once, and the operation
  list's blocks (`groupByStage()`) are in the same order as those stages in the stage order.
- `addStage` before a stage puts it there in `stageOrder`; with `null`, last; it's called
  `NEW_STAGE_NAME` and copies the settings of the nearest transfer stage before it; added before the
  first stage, the nearest after it. Its mixes are copied too: copying a stage with a `sourceMix`
  and a `destinationMix` gives a stage with the same mixes, techniques and liquid types.

**Mix steps**
- `addMixStep` gives a stage called `NEW_MIX_STEP_NAME`, with `isMixStep` `true`; with no other mix
  step, the default mix step settings (built from `MIX_STEP_MODE` and `DEFAULT_MIX`, not from fixed
  values: CLAUDE.md, "Tests follow `config/`"); with one before it whose `destinationMix` differs,
  that mix; with none before it but one after, that one's.
- **Own kind:** `addStage` right after a mix step copies the transfer stage before the mix step,
  not the mix step; `addMixStep` right after a transfer stage copies the nearest mix step, or the
  defaults. With only mix steps, `addStage` gives the default settings.
- `isMixStep` is `false` for a transfer stage and for an ID that isn't a stage.
- `mixWells` with three wells adds three transfers, each from the well into itself of
  `MIX_STEP_VOLUME`, in the mix step; given one it mixes already and one it doesn't, it adds one;
  given only wells it mixes, it returns the same plan. Refused: a transfer stage; a well not on the
  deck. Each leaves the plan unchanged.
- `unmixWell` removes that well's transfer only; refused for a well the mix step doesn't mix.
- `mixWells` refuses `null`, a single well (not in a list) and a list holding `5`; `unmixWell`
  refuses `undefined` and `"A1"`; each with its message, never a crash.
- `changeStageSettings` refuses each mix step row of section 5: `MIX_STEP_MODE`'s technique at the
  destination only; a mix step with a source mix; one without a destination mix; a stage holding a
  transfer between two wells given `MIX_STEP_MODE` settings; a mix step holding mixed wells given a
  pipetting mode's settings. It accepts either change of kind for a stage without transfers.
- A plan file whose mix step has a source mix, or no destination mix, is refused with `stage N: `
  and that message (`plan-file.md`, check 6).
- **Own kind, at the start:** `addStage` before a mix step that comes first in the stage order,
  with a transfer stage after it, copies that transfer stage.
- `addTransfer` into a mix step refuses a transfer between two wells, and a well into itself of
  any volume but `MIX_STEP_VOLUME`; accepts a well into itself of `MIX_STEP_VOLUME`. `changeVolume`
  refuses a mix step's transfer.
- A mix step's mixed well holding at least `MIX_STEP_VOLUME` changes no well's contents; a well
  holding less above its dead volume is a contents problem (`stagesWithContentsProblem`).
- In the table of which parts of the plan each edit may change: `addMixStep` changes `stageList`
  and `stageOrder` (and `tipChanges` with `takeTips`, as `addStage`); `mixWells` and `unmixWell`
  only `operationList`.
- `config/mixing.js`: `MIX_STEP_MODE`'s technique and liquid type are names, the liquid type
  follows Biomek's rule, and the technique isn't any pipetting mode's technique or mixing technique;
  `MIX_STEP_VOLUME` is a number above 0.
- `addStage` with `takeTips` before a stage with a tip change moves the tip change to the new stage;
  without it, the new stage joins the tip group before.
- `addStage` before the first stage keeps the `START` tips first.
- `addStage` before a stage that isn't in the plan throws.
- `addStageWithNewTips`, in a plan of three stages with `START` tips on BC230 `[1, 2]` and a tip
  change of BC1070 `[1, 2, 3, 4]` before stage 3:
  - before stage 3 (the first of its tip group): the new stage comes just before stage 3, with a
    tip change of its own loading BC230 `[1, 2]` (the tips in use there); stage 3's tip change is
    unchanged; the tip groups are stages 1 and 2, the new stage, then stage 3;
  - before stage 2 (inside a tip group): the new stage gets a tip change of BC230 `[1, 2]`, and so
    does stage 2, which had none; four tip groups;
  - before stage 1: the new stage is first, with the `START` tips (BC230 `[1, 2]`), unchanged; old
    stage 1 gets a tip change of BC230 `[1, 2]`; no tip change is keyed by the new stage;
  - with `null`: the new stage is last, with a tip change of BC1070 `[1, 2, 3, 4]` (the tips in use
    at the end), and nothing after it changes;
  - the new stage's settings are copied as `addStage`'s are, and it has no transfers;
  - before a stage that isn't in the plan throws `addStage`'s error, and the plan given is
    unchanged.
- (In these cases "stage 3" and the others name the original stages by ID; their places in the
  stage order change once the new stage is in.)
- `addMixStepWithNewTips` adds a mix step (`isMixStep`), named `NEW_MIX_STEP_NAME`, as
  `addStageWithNewTips` adds a stage, in the same plan: before stage 3, before stage 1 and with
  `null`, with the same tip changes as the cases above.
- In the table of which parts of the plan each edit may change, `addStageWithNewTips` and
  `addMixStepWithNewTips` change `stageList`, `stageOrder` and `tipChanges`.
- `removeStage` removes a stage with transfers, and its transfers, and takes it out of the stage
  order, leaving the others in their order; a tip change keyed by it goes; removing the only stage
  throws.
- Removing the first stage, when the second has its own tip change, makes that tip change the
  `START` one, with its tip type and probes.
- `renameStage` and `changeStageSettings` change only that stage; the stage list's errors pass
  through.
- `stageEnds` counts transfers cumulatively in run order, leaving out stages without transfers.
- `stagesWithContentsProblem` names the stage whose transfer draws more than a well's usable
  volume, and the stage whose transfer fills a well over its capacity, and no other; with only a
  well that starts over its capacity, it's empty. (On the real deck, with `D` and `C` taken from
  `config/labware-types.js` for the labware chosen, as `contents-tracking.md` does.)

**Mixing**
- `setStageMix` on a Medium source with `{ share: 90, times: 3, speed: 400 }` gives `sourceMix`
  that mix and `sourceTechnique` `"OperationMix"`, keeping `sourceLiquidType` and the destination's
  settings; `setStageMix` with `null` gives `sourceMix` `null` and `sourceTechnique` `"Operation"`.
  The same at the destination.
- `setStageMix` with a different mix on an end that already mixes changes the mix and keeps
  `"OperationMix"`.
- `setStageMix` refuses: a stage that isn't in the plan; an end `"middle"`; an end whose technique
  and liquid type aren't a mode's; switching on at a Non-Contact destination; a mix the stage list
  refuses (its message, e.g. a share of `0`). Each leaves the plan unchanged.
- `changeStageSettings` refuses a mix with `"Operation"`, no mix with `"OperationMix"`, and a mix
  at a Non-Contact destination, each with its message; it accepts any mixing at an end whose
  technique and liquid type aren't a mode's.
- `addStage` after a stage that mixes gives a stage that passes the check (it copies matching
  settings).
- `setStageMix` giving the mix the end already has (equal values, or `null` on an end that doesn't
  mix) returns the same plan.
- In the table of which parts of the plan each edit may change, `setStageMix` changes only
  `stageList`.
- **Tests and REPL examples written before mixing layer (b)** that give a stage a mix while its
  technique is `"Operation"` (e.g. `addStage` copying a stage that mixes; the plan file's mixing
  plan; the `transfer-designer` REPL topic) now give it with `setStageMix`, or with
  `"OperationMix"`, since the rule refuses the old way. What each test checks doesn't change.
- `stagesWithMixProblem` names a stage whose destination mix is under the minimum (an empty well given
  0.05 µL, mixed at 90%), and no other; a plan without mixing gives an empty `Set`.

**Transfers**
- A stage's first transfer goes before the next stage in the stage order with transfers (or last);
  later ones go after the stage's others.
- `addTransfers` adds all, in order, as one plan; if one fails, the plan is unchanged and the error is
  the operation list's.
- A transfer to a well not on the deck, or in a stage not in the plan, throws; a transfer that's
  `null` gives the operation list's message.
- `changeVolume` changes only that transfer's volume; the other transfers are the very same objects
  as before (sharing).
- `removeTransfer` removes only that transfer.
- With stages 1, 2 and 3, each with one transfer, removing stage 2's transfer leaves the stage order
  1, 2, 3; removing stage 3's leaves 1, 2, 3 too.
- Giving a stage its first transfer leaves the stage order as it was:
  - an empty plan's stage 1, then stage 2 added last; stage 2's first transfer leaves 1, 2 (not
    2, 1);
  - stages 1 and 2 with transfers, then stage 3 and stage 4 each added before stage 2 (1, 3, 4, 2);
    stage 4's first transfer leaves 1, 3, 4, 2 (not 1, 4, 3, 2);
  - stage 1 with transfers, stage 2 added last, stage 3 added before stage 2, stage 4 added last
    (1, 3, 2, 4); stage 4's first transfer leaves 1, 3, 2, 4 (two stages without transfers above it,
    in the opposite order to how they were added).
- In the first of those, with a tip change before stage 2, stage 1 is still first after stage 2's
  first transfer, with the `START` tips, and the tip change is still keyed by stage 2.
- `transfersIn` gives each transfer's position, and `[]` for a stage without transfers and for an ID
  that isn't a stage.

**Tip changes**
- `tipGroups` and `START` are tested in `tip-groups.test.js` (`tip-groups.md`); here, `tipGroups`
  re-exported from this module gives the same groups as the shared module's.
- `addTipChange` takes the tip type and probes in use (with `START` on `[1, 2]`, a tip change added
  before stage 2 has `[1, 2]`); adding before the first stage, twice in one place, or before a stage
  that isn't in the plan throws; `canAddTipChange` is `false` for each.
- `setTipType` with a known type works; an unknown one throws; it leaves the probes as they were.
- `setTipProbes` sets `[1, 2, 3, 4]`; stores `[3, 1, 2]` as `[1, 2, 3]`; accepts `[1]` and all
  eight; leaves the tip type as it was; with none at `key` throws.
- `setTipProbes` errors: `"1,2"`, `[]` and `null` give the probes-list error; `[0]`, `[9]`,
  `[2.5]` and `["1"]` give the probe-number error, and `[1, 9, 10]` names `9`; `[3, 1, 3]` gives
  the repeated-probe error, naming 3.
- Changing the `probes` list given to `setTipProbes` afterwards doesn't change the plan.
- `removeTipChange` merges the two tip groups; for `START` it throws.
- `tipsUsed` (tip types named from `TIP_TYPES`, not written out, and counts from `probesFor`, so
  changing `config/` breaks no test; CLAUDE.md, "Tests follow `config/`"). "The first tip type" is
  `TIP_TYPES[0]` and "the second" `TIP_TYPES[1]`; each test that uses the second runs only when
  `TIP_TYPES` has at least 2 entries (and is skipped otherwise), so shortening the list breaks no
  test:
  - a new plan (no transfers) gives `[]`;
  - one stage with a transfer and the `START` tips on `probesFor(DEFAULT_PROBE_COUNT)` gives one
    entry, the first tip type, counting `DEFAULT_PROBE_COUNT`;
  - section 3's example gives the first type 12 and the second 2, in `TIP_TYPES` order, though the
    second type's tips come before the first's last ones in the run;
  - a plan using only the second tip type (the `START` tips set to it) gives only that type;
  - the list is in `TIP_TYPES` order, not run order: the `START` tips set to the second tip type
    with a transfer, then a tip change to the first tip type with a transfer, lists the first type
    first;
  - two tip groups of the same type and probes, each with transfers, count twice;
  - a tip group whose stages have no transfers counts nothing, and adding one transfer to it makes
    it count; a group with a transfer stage without transfers and one with transfers counts in
    full;
  - the `START` tip group's stages have no transfers and a later tip group's do (a tip change
    loading the second tip type, or the first on other probes, before a later stage with a
    transfer): only the later group counts, and the `START` tips count nothing;
  - a group whose only stage is a mix step mixing one well counts;
  - a randomization that has run counts the tips of its stages' tip changes, with nothing done for
    it: the count equals the sum over `tipGroups` with transfers;
  - a randomization whose sources A1 to A3 share tips (the filler on new tips of its own) counts
    that group's tips once: running it adds the tips of two tip changes to its tip type's count
    (A1 to A3's, and the filler's, each loading the randomization's probes), where the same
    randomization with no source sharing adds four (counts from the randomization's tip type and
    probes, not written out);
  - a plan with a contents problem is still counted;
  - **it matches the Biomek files:** for each of the plans above that has transfers, except the
    one with a contents problem, the counts equal what `writeRunFiles(plan, timestamp)`
    (`file-writer.md`) loads, so the two can't drift apart. The timestamp is a fixed `Date` (e.g.
    `new Date(2026, 9, 28, 1, 57, 32)`), and each plan is given an experiment name and set up to
    have no problems, so `writeRunFiles` accepts it: every transfer's draw is covered by starting
    contents, and the mix-step plan gets starting contents so its mixed well holds enough to mix
    (no mix problem) and the mix step's draw is covered. To read the files: take `Stages.csv`'s
    rows (after the header) whose `NewTip` is `1` (the tip-change rows); strip the double quotes
    from each one's `LoadProbes` (the file writer quotes a field holding a comma, e.g.
    `"1,2,3,4"`; a single probe is written `1`, unquoted); count its comma-separated probe numbers;
    and add the counts up by the row's `TipType`. The result, in `TIP_TYPES` order, equals
    `tipsUsed(plan)`;
  - changing the list it returned doesn't change the next one.

**Components and starting contents**
- `addComponent` refuses a used name or color, and a blank name; it trims the name.
- `renameComponent` renames in every well, keeping each well's components in order; to a used name
  it throws; to its own name (also with spaces at the ends) it returns the plan unchanged.
- `removeComponent` empties wells left with nothing.
- `addToWells` adds on top: 500 then 1000 µL gives 1500 µL; other components stay; 0, −5 and
  `"10"` throw; a component not in the plan throws; a well listed twice gets the volume once.
- `emptyWells` empties only those wells; the components stay; an empty well is left as it is.
- `addComponent` gives the new component `constituents: []`, its properties in the order `name`,
  `color`, `constituents`. (The existing tests that compare a component to `{ name, color }` are
  updated to this shape: the specification changed, not the tests' purpose.)
- `setConstituents` replaces the list: setting `[{ Dye 10 mM }]` then `[{ Dye 5 mM }]` leaves one
  constituent at 5; setting `[]` leaves none; names are trimmed; the given list isn't changed, and
  changing it afterwards doesn't change the plan.
- `setConstituents` throws for a component not in the plan, and passes on `checkConstituents`'s
  messages (a bad amount, a unit not configured) unchanged.
- One family per name: with Hy-Soy at 4 g/L in "Feeding media", setting Hy-Soy at 10 mM in
  another component throws the family message naming Feeding media and g/L, the units from
  `unitsOf`; with two other components carrying Hy-Soy, the first in the plan's order is named,
  with its own unit; Hy-Soy at 500 mg/L (the same family) is accepted; in the only component
  carrying Hy-Soy, changing it from g/L to mM is accepted; two constituents in the list being set,
  Hy-Soy in g/L then Drug A in mM, are checked each against the other components only. (Units in
  these tests are named by symbol and read from `config/concentration-units.js`, as
  `concentrations.md`, section 6, says.)
- The order of checks: a component that doesn't exist is reported before a bad list; a bad amount
  (`checkConstituents`) before a family clash in a later entry.
- `renameComponent` keeps the component's constituents, including one named as the component
  was; `removeComponent` removes them; `setComponentColor` keeps them.
- `concentrationsOf` with a well 20% from a component carrying Dye at 10 mM gives
  `[{ name: "Dye", family: family("mM"), value: 0.2 × 10 × factor("mM") }]` (within 1e-12); an
  empty well, or one holding only components without constituents, gives `[]`; after a transfer of
  50 µL from a trough of that component into a well holding 1000 µL of Media, the well's value is
  `10 × factor("mM") × 50 / 1050` at the snapshot after that transfer, and `[]` at the snapshot
  before it.
- `concentrationsOf` checks the well through the snapshot only: a well of `5` throws the
  snapshot's message naming `volumeFractionsOf`; an `end` of `undefined` throws its labware
  message.
- `concentrationsOf` with a well 10% from a component carrying `Cells` in `CELL_DENSITY_UNIT`
  (`config/concentration-units.js`) at 1500000 gives one entry in `familyOf(CELL_DENSITY_UNIT)`,
  value `0.1 × 1500000`.

**Seeding densities** (the labware is found in `DECK` by its type's growth area, never named:
one whose `growthAreaOf` isn't `null`, and one whose is; the area and volume are taken from
`growthAreaOf` and `totalVolumeOf`, so changing `config/` never breaks a test)
- On labware with a growth area, a well holding `V` µL, 10% from a component carrying Cells at
  1500000 cells/mL: `[{ name: "Cells", value: seedingDensity(0.1 × 1500000, V, growthAreaOf(that
  labware)) }]` (within 1e-12 of the value).
- The same well also holding Dye in mM gives only the Cells entry; a well carrying no cells, an
  empty well, and a well carrying cells on labware without a growth area each give `[]`.
- Two components carrying Cells add before the seeding density is worked out (one entry).
- The volume is the whole well's, dead volume included: a well holding just its dead volume of the
  suspension gives `seedingDensity(1500000, deadVolumeOf(labware), growthAreaOf(labware))`, not 0.
- After a transfer that adds Media to the well, the cell density falls but the seeding density at
  the snapshot after it is the same as before (the cells are the same; only the liquid grew), within
  1e-12; after a transfer that takes half the well away, it halves.
- Errors: an `end` of `undefined` throws the snapshot's labware message (as `concentrationsOf`); a
  labware `"Bench"` holding nothing in the snapshot throws the deck's no-such-labware message.
- Inputs aren't changed.
- The REPL (`scripts/repl.js`): `seedingDensitiesOf` in the transfer designer's topic, with a plan
  whose component carries Cells, on a labware with a growth area and on one without (labware
  named as they're named in `config/deck.js` today, e.g. `Plate1` and `Deep1`).

**Osmolality** (2026-11-05)
- `addComponent` gives the new component `osmolality: null`, its properties in the order `name`,
  `color`, `constituents`, `osmolality`. (The existing tests that compare a component to `{ name,
  color, constituents }` are updated to this shape: the specification changed, not the tests'
  purpose.)
- `setOsmolality` sets `300`, then `290.5`; `0` is kept as `0`, not as none; `null` removes it; a
  value above 1000 (e.g. `2800`) is accepted. Setting the value it already has (also `null` on a
  component with none) gives back the same plan object.
- `setOsmolality` throws for a component not in the plan (reported before a bad value), and passes
  on `checkOsmolality`'s message for `-5`, `"300"`, `NaN`, `Infinity` and `undefined`, naming the
  component.
- `renameComponent` keeps the osmolality; `setComponentColor` and `setConstituents` keep it, and
  `setOsmolality` keeps the constituents; `removeComponent` removes it with the component.
- `osmolalityOf` with a well holding only Media at 300 gives `{ value: 300, missing: [] }`; after a
  transfer of 100 µL of Water (0) into a well holding 900 µL of Media (300), the well gives
  `value` 270 (within 1e-9 mOsm/kg, as `osmolality.md` compares) at the snapshot after that transfer and 300 at the snapshot before it;
  with Water given no osmolality instead, `{ value: null, missing: ["Water"] }` after the transfer
  and `{ value: 300, missing: [] }` before; an empty well gives `{ value: null, missing: [] }`.
- `osmolalityOf` checks the well through the snapshot only, as `concentrationsOf` does: a well of
  `5` throws the snapshot's message naming `volumeFractionsOf`.
- Osmolality never reaches the Biomek files: `writeRunFiles` (`file-writer.md`) gives identical
  files (names and texts) for a plan with experiment name, starting contents and transfers whose
  components have osmolalities (`300`, `0`) and for the same plan with every osmolality `null`.
- The REPL's `transfer-designer` topic loads `setOsmolality` and `osmolalityOf`, with an example
  of each beside `concentrationsOf`'s (CLAUDE.md, "Keep the REPL complete").

**Stock tables** (2026-11-05). Tests pass `COMPONENT_COLORS` as `colors` unless they say
otherwise, and work out expected colors from it (CLAUDE.md, "Tests follow `config/`").
- **The form:** `readStockTable` and `addStocks` throw the form message for `[]`, `5`, a row that's
  `[]`, rows of different lengths and a cell that's `null`; then the colors message for `colors` of
  `5` and `[5]`. A header alone (`[["Name"]]`) reads as `{ stocks: [], problems: [] }`.
- **The example:** the header `Name`, `Osmolality`, `Hy-Soy (g/L)`, `Yeast (g/L)`, `Drug A (mM)`,
  `DMSO (%)`, rows `Feed` `310` `4` `0.5` `` ``, `Drug A 10mM` `1450` `` `` `10` `100`, `Water` `0`
  (rest blank), on a plan with Media: three stocks with the first three free colors in
  `COMPONENT_COLORS` order (Media's taken), Feed carrying Hy-Soy 4 g/L and Yeast 0.5 g/L, Drug A
  10mM carrying Drug A 10 mM and DMSO 100 %, Water nothing with osmolality 0; no problems.
  `addStocks` gives a plan whose components are Media then those three, each as read.
- **Headers:** `osmolality`, `OSMOLALITY (mOsm/kg)` and `Osmolality(mOsm/kg)` are osmolality
  columns; `Osmolality (mosm/kg)` isn't (it's read as a constituent named Osmolality in an
  unknown unit: a problem). Every `unit` of `CONCENTRATION_UNITS` in brackets is read as itself,
  and every key of `UNIT_SPELLINGS` as its value (the expectations built from the two lists, not
  written out); `(UM)`, `(G/L)`, `(mm)`, `(mg/mL)` and `(% v/v)` are unknown units when they're
  neither a unit nor a spelling (checked against the configuration, so a test of one that becomes
  configured is skipped rather than wrong); `( mM )` is mM; `Salt (A) (mM)` is the constituent
  `Salt (A)` in mM. The unknown-unit message lists `CONCENTRATION_UNITS`' units in order. Each header
  problem in section 5 is reported at its cell, and the cells under it aren't read (a bad amount
  under it gives no second problem).
- **Ignored:** a fully blank column between two others, and a fully blank row, give no problem and
  no stock, and the problems after them keep their places (row and column indexes count them).
- **Names:** a blank name in a row with text; `Media` when the plan has Media (and ` Media ` with
  spaces); a name repeated in a later row (the later row is the problem): each at its name cell, in
  section 5's words. The rows with a name problem aren't tried, so they take no color and the next
  row takes the color they would have taken.
- **Amounts:** `4`, `0.5`, `.5`, `4.`, `1,500,000` (1500000), `1.5e6` and `1e-7` are read; blank,
  `0` and `0.0` add nothing; `-4`, `+4`, `4 g`, `two`, `1.2.3`, `e5`, `0x10` and `1e400` are problems
  at their cell. Cells in a row whose name is a problem are still read (a bad amount there is a
  second problem, its message naming the row by name, or `Row N` for a blank one, N the row index
  plus 1).
  The same for osmolality, except `0` is the value 0 (and `-5` a problem).
- **Trying rows:** on a plan where Feeding media carries Hy-Soy in g/L, a table with a `Hy-Soy (mM)`
  column gives a whole-row problem to every row with an amount in it, each with `setConstituents`'s
  message (naming Feeding media) prefixed with its own row's name and `: `; rows without an amount
  there are added. Problems come in section 3's reading order.
- **What's tried:** a table with one bad header (`KCl`) and two good rows tries and colors both rows
  (their `color` not `null`), reading only the good columns. A row whose try fails takes no color:
  in a table of three rows where the second fails its try, the third row gets the color the second
  would have had.
- **Colors:** with `colors` of two colors, one taken by the plan, a table of three rows gives the free
  one to the first row and a whole-row problem to the second and third; `color` is `null` for rows
  with a problem.
- **Adding:** `addStocks` throws the first problem's message when there are problems, and the no-
  stocks message for a header alone; it doesn't change the plan it's given; its result is one plan
  (undone as one edit by `plan-history`).
- **Writing out:** `stockTable` of an empty plan is `[["Name"]]`; of a plan with no osmolalities has
  no Osmolality column; with Drug B in µM in one component and mM in another (first met in µM), the
  mM one's 0.5 mM is written under `Drug B (µM)` as 0.5 × the mM factor ÷ the µM factor, worked out
  from `CONCENTRATION_UNITS` (`500` with today's factors); a 0.0003 mM amount in a µM column is
  written without floating-point noise (`0.3` with today's factors, not `0.30000000000000004`); an osmolality of `1e-7` is `1e-7`; constituent columns follow first-met
  order; components follow the plan's order.
- **Round trip:** for a plan of several components (with osmolality, without, one carrying cells
  at 1500000 cells/mL, one carrying nothing), `addStocks(emptyPlan(), stockTable(plan),
  COMPONENT_COLORS)` gives the same names, osmolalities and constituents (amounts compared after
  converting to the base unit, within 1e-9 relative), with no problems.
- **Configuration:** in `transfer-designer.test.js` only (ADR 0009: the module that uses it), not in
  `concentrations.test.js`: every value of `UNIT_SPELLINGS` is a `unit` of `CONCENTRATION_UNITS`, and
  no key is one.

**The REPL** (`scripts/repl.js`): `readStockTable`, `addStocks` and `stockTable` in the transfer
designer's topic, with an example of each (CLAUDE.md, "Keep the REPL complete").

**Copied decks** (2026-11-06). A test plan, built in a helper: Media (osmolality 300) and Drug A
(Drug A 10 mM) at Start in a reservoir trough and a deep well, one stage moving 180 µL of Media and
20 µL of Drug A into one plate well, labeled `Cond 1`, its plate labeled `Assay plate`. Labware and
wells are taken from `config/deck.js` by type, not named (CLAUDE.md, "Tests follow `config/`"), and
tests pass `COMPONENT_COLORS` as `colors` unless they say otherwise.
- **Copying at the end:** three wells in `listContents()` order, the trough and deep well left with
  their starting volumes minus what the stage drew, the plate well holding both components; both
  components with their details; both labels; `format`, `version` and `point` as given. Copying at
  Start gives the starting contents. A component no listed well holds isn't copied; a well emptied
  to 0 µL isn't listed; a component below `NEGLIGIBLE_MICROLITERS` in a well is left out of it.
- **Refused:** a snapshot after an overdraw, and after a draw into the dead volume, throw the
  copy's message; a snapshot whose only problem is an overfill is copied, with the overfilled
  volume. `point` of `5` or `"  "` throws its message.
- **Pasting into an empty plan** (`emptyPlan()`) gives starting contents, components (with their
  colors, constituents and osmolality) and labels such that `copyDeck` of the result at Start
  equals the copy (but `point`). The result is one plan; the given plan is unchanged.
- **Pasting on top:** into a plan already holding 100 µL of Media in the plate well, its Media is
  280 µL after the paste; pasting the same copy twice doubles the volumes and changes nothing
  else.
- **Components:** a plan with Media at osmolality 300 and its own color keeps that color and
  pastes; with Media at 290, or carrying a constituent the copy's doesn't, it throws the mismatch
  message and pastes nothing; a new component whose copied color is taken gets the first free color
  of `colors`; with `colors` of one taken color, the no-free-color message.
- **Labels:** a well already labeled `Cond 1` pastes; labeled `Cond 2`, the well message (naming
  the labware by its label); a labware labeled `Assay plate` pastes; labeled `Plate A`, the labware
  message; another labware already labeled `Assay plate`, `setLabel`'s message.
- **The form:** `pasteDeck` throws the not-a-copied-deck message for `5`, `null`, `{}`, copied items
  (`COPIED_ITEMS_FORMAT`) and an extra property; the newer-version message for `COPIED_DECK_VERSION
  + 1`; the damaged message for each part listed in section 5, and for a well listed twice.
- **Round trip through text:** `pasteDeck(emptyPlan().plan, JSON.parse(JSON.stringify(copyDeck(…))),
  COMPONENT_COLORS)` gives the same as pasting the object.
- Nothing reaches the Biomek files differently: `writeRunFiles` for a plan whose starting contents
  came from a paste equals that for the same starting contents made by `addToWells`.

**The REPL** (`scripts/repl.js`): `copyDeck` and `pasteDeck` in the transfer designer's topic, with an
example of each (CLAUDE.md, "Keep the REPL complete").

**Labware**
- `labwareUsed` lists starting contents', transfers' and well labels' labware in deck order; a
  labware with only a well label is listed.
- `setLabel` trims; a blank label, or the labware's own name, removes it; a label that isn't text,
  or labware not on the deck, throws; `labelOf` falls back to the name.
- `setLabel` refuses a label another labware has (also with spaces at the ends), and the name of
  another labware without a label; giving a labware the label it already has changes nothing.
- `setLabels` sets the whole table: `{ Plate: "Deep", Deep: "D1" }` is accepted (in that order too),
  and so is swapping two labware's labels; `{}` removes every label.
- `setLabels` refuses `null` and a list, labware not on the deck, a label of `5`, `""`, `"  "`,
  `" Assay plate"` and `"Plate"` for Plate, and `{ Plate: "Deep" }` while Deep has no label in the
  new table, each with its message; a refused table leaves the plan unchanged.

**Well labels**
- `emptyPlan()`'s `wellLabels` is `{}`; `wellLabelOf` gives `null` for any well of it.
- `setWellLabel` labels `{ labware: "Deep", well: "A1" }` `"Cond 1"`, and `wellLabelOf` gives
  `"Cond 1"`; `wellLabels` is `{ Deep: { A1: "Cond 1" } }`. A reservoir trough (`"5"`) can be
  labeled.
- `setWellLabel` trims `"  Cond 1 "` to `"Cond 1"`; `""` and `"   "` remove the label, and removing
  a labware's last label removes the labware from `wellLabels`; removing a label a well doesn't
  have gives back the same plan, and so does giving a well the label it has.
- Two wells may share a label; a label with spaces inside (`"Cond 1"`) and with other characters
  (`"Drug A 10 µM"`) is accepted.
- `setWellLabel` with `5` as the label, a well not on the grid, and labware not on the deck, each
  throws with its message; `wellLabelOf` with a well not on the deck throws.
- `setWellLabels` sets the whole table: `{ Deep: { A1: "Cond 1", A2: "Cond 1" }, Res: { "5":
  "Media" } }` is accepted; `{}` removes every label.
- `setWellLabels` refuses `null` and a list; labware not on the deck; `{ Deep: 5 }`, `{ Deep: [] }`
  and `{ Deep: {} }`; a well `"Z99"`; and labels of `5`, `""`, `"  "` and `" Cond 1"`, each with its
  message; a refused table leaves the plan unchanged.
- Order of checks: `setWellLabel(plan, { labware: "Deep", well: "Z99" }, 5)` reports the well, not
  the label; `{ Bench: 5 }` reports the labware, not its wells; `{ Deep: { Z99: 5 } }`
  reports the well, not the label.
- Labeling a well leaves its contents, the transfers and everything else as they were.

**Randomizations**
Set up a plan with Deep A1 to A3 holding `Drug A`, `Drug B` and `Media`, one stage with a transfer
before, one after (each with tips of its own), and Plate1's B2 to C11 (20 wells) to fill.
- `addRandomization` before the second stage: `r1`, sitting there, with the defaults and the given
  seed and volume; a second one is `r2`; after removing `r1`, the next is `r3`. `beforeId` unknown,
  a stage inside a tip group, a seed of `0` and a volume of `-1` each throw.
- `setRandomization` sets sources and wells, with any number of filler wells; `fill` given in any
  order comes back in deck order; every row of section 5 it can give, with its message, leaving the
  plan unchanged; unchanged values give back the same plan; `stages` and `beforeId` never change.
- `randomizationProblems`: each message of section 3, in order, using `sourceName`, with the
  singular forms; `[]` when it can run.
- `sourceName`: a labeled source gives its label; `Drug A` alone gives `Drug A`; a well holding
  three components gives the one with most and ` +2`, the first on a tie; an empty well gives its
  labware's label and well name; contents are those just before the randomization (a well filled
  by the first stage is named after what it holds then).
- `runRandomization` with A1 and A2 at 8 replicates and A3 the filler (4 wells): three stages, in
  source order, named after their sources, just before the second stage, each the only stage of
  its tip group (as no source shares tips; "Sharing tips" below tests sharing), with `settings`, `tipType` and `probes`; 8, 8 and 4 transfers of `volume` from
  each source, into every well to fill exactly once; the stage after keeps its tips;
  `randomizationOf` gives `r1` for each new stage and `null` for the others; `stages` and
  `beforeId` as section 3 says; the assignment matches `assignPool` with the same pool.
- On an exact fit (A1 and A2 at 10), the filler gets no stage; two stages.
- **Several filler wells** (Res1 2, 3 and 4 each holding Media 750 µL above the trough's dead
  volume, A1 at 6 replicates, 24 wells to fill, volume 100): `fillerShares` gives `7`, `7` and `4`;
  a run makes two stages, A1's and one filler stage, named `Media`, on its own tips, whose entry in
  `stages` names Res1 2; it draws 7 transfers from Res1 2, 7 from Res1 3 and 4 from Res1 4, each
  well to fill from the share it fell in (in `fill`'s order); running again gives the same
  transfers; the pool is the same as with one filler well (the same seed gives every well to fill
  the same source, A1 or the filler, as with Res1 2 alone the filler).
- **Shares:** a filler well with less than one transfer above its dead volume takes `0`, and the
  next takes the wells; the last filler well takes all the rest even beyond its usable volume, which
  is then an overdraw; a usable volume of exactly `n` transfers (and one within a millionth of a µL
  under it, from rounding) gives `n`; filler wells listed in another order share in that order; `[]`
  with no filler wells; `null` with `volume` `null`, and with a source's replicates `null`.
- **One liquid:** filler wells holding Media and Media with DMSO (any amount), or Media in one and
  Buffer in another, give `The filler wells hold different liquids.` (last in the order of
  problems); the same components in the same proportions at different volumes, and a filler well
  holding nothing beside one holding Media, give no problem.
- **Out of date:** `false` before any run and right after a run; after topping up a filler well so
  the shares change: `true`; running again: `false`. After an edit that changes no share (a top-up
  that still fits the same transfers): `false`. After every filler well's Media is replaced by
  Buffer in the same volumes: `true` (the name), and a run renames the stage `Buffer`. After a
  problem appears (filler wells holding different liquids): `true`. A source's stage keeps its
  name if nothing it holds changed. The trial run leaves the plan given unchanged.
- **Renaming on a run:** after the component Media is renamed Buffer (`renameComponent`), the filler
  stage's name differs from what a run would give: out of date; a run renames it; one undo brings
  back the old name.
- **The filler stage after changes** (each run after the first): the first filler well unmarked
  (now taking replicates): it keeps the old stage as its own, and the filler gets a new stage keyed
  to the new first filler well; a filler well added in front: the filler keeps its stage, its entry
  re-keyed to the new first; the first filler well's share `0` (holding less than one transfer above
  its dead volume): the stage is kept, keyed to it, drawing only from the others; the first filler
  well empty and a later one holding Media: the stage is named `Media`; the first filler well
  labeled `Main media`: named `Main media`.
- **More shares:** a filler well holding nothing between two holding Media: share `0`, no one-liquid
  problem; too many replicates (the pool's problem): every share `0`; only filler wells: every well
  to fill shared; the same Media with DMSO mix reached through different transfers (fractions
  differing only by arithmetic): no problem.
- **Copying:** `copyOf` writes version 5 (since 2026-11-05, item 20; versions 2, 3 and 4 before); a run randomization with three filler wells, copied and
  pasted (`copyItems`), gives a randomization with the same filler wells, one filler stage and its
  transfers from each; a version 1 copy pastes as before; version 6 is refused as newer (version 3, then 4, then 5 before; 2026-11-05).
- **`setRandomizations`:** accepts a filler stage entry naming a filler well that isn't the first;
  refuses two entries naming filler wells of one randomization with its message.
- **Moving wells with filler wells:** `isWellUsed` is `true` for a filler well that isn't the first
  (no entry in `stages`); moving it moves its transfers and changes no entry; moving the first
  filler well moves the entry; moving a filler well onto labware of another dead volume makes the
  randomization out of date; moving an empty, unlabeled source onto other labware changes its
  name, so out of date.
- **Two randomizations:** updating the first, so a later randomization's filler well holds more,
  makes the later one out of date; each is checked against its own trial run.
- **Unknown ID:** `fillerShares` and `isRandomizationOutOfDate` throw the no-randomization
  message.
- Run again with nothing changed: the same transfers, the same stage IDs and names. With a new seed:
  the same stages, different wells (for two chosen seeds). With a new volume: the same wells, the
  new volume on every transfer.
- **Settings on its stages** (2026-11-05, item 20):
  - `addRandomization` before a stage whose settings are Slow at the source and whose tip group is
    BC1070 on 8 probes: its `settings` are that stage's, `tipType` `"BC1070"`, `probes` all eight;
    at the start of a plan: the first transfer stage's settings and the `START` tips; in a plan with
    only mix steps, `defaultSettings()`.
  - A first run gives every stage `settings` and every group's tips `tipType` and `probes`; after
    it, `settings`, `tipType` and `probes` are `null`.
  - After a run, `changeStageSettings` on one stage (aspirate Slow) and `setTipType` on another
    group's tip change (BC1070): not out of date; running again (nothing else changed) keeps both,
    and every other stage and group as it was.
  - `setStageMix` and `setTipProbes` on an owned stage work as on any stage.
  - A source added after a run, between A1 (aspirate Slow, BC1070) and A2 (Medium, BC230): its new
    stage gets A1's settings and, on new tips, A1's group's tips; added first: A1's settings (the
    nearest after) and A1's tips.
  - A source whose `sharesTips` turns `false` (splitting a group): the new group's first stage, which
    didn't start a group before, gets the tips of the group before it; turning it back `true`: it
    loses its tip change and shares again.
  - `forAll` with `destinationMode` `"Fast"` only: every owned stage's destination is Fast, each
    source end as it was; with `sourceMixes` `true`: every source end mixes, keeping a stage's own
    mix where it had one and `DEFAULT_MIX` elsewhere; `sourceMode` a mode that can't mix on stages
    that mix at the source: that end's mixing turns off; `sourceMixes` `true` with such a mode
    throws `modeSettings`' message, changing nothing; `tipType` and `probes`: every group's tip
    change; `{}`: as no `forAll`. A wrong property or value throws its message.
  - `setRandomization` with `settings`, `tipType` or `probes` after a run throws its message (even
    with the same values); before a run it works as before.
  - `setRandomizations` refuses a run randomization with `settings` not `null`, and one with
    stages `[]` and `settings` `null`, each with its message.
  - Copied items: `copyOf` writes version 5, a run randomization's `settings`, `tipType` and
    `probes` `null`; a version 4 copy of a run randomization with settings pastes with them
    dropped and its stages' own settings and tips; a version 5 copy breaking the rule is refused
    with the form message; version 6 is refused as newer.
  - **Regression fixture** (`tests/fixtures/shared-tips/`): opening `randomized-plan-v9.json` and
    running `r1` with no `forAll` still gives exactly the fixture's files.
  - **Protection** (each with its message, changing nothing): `addTransfer`, `changeVolume`,
    `removeTransfer`, `renameStage`, `removeStage` on an owned stage; `removeTipChange` of a
    group's tip change; `addTipChange` before a stage sharing tips; `addStage` before its second
    stage, with `takeTips` before its first, and without `takeTips` just after its last; allowed:
    `addStageWithNewTips` just after its last, and `addStage` without `takeTips` before its first
    when it's the plan's first (its first stage getting its own tip change with the tips it had).
    A run, `removeRandomization`, `moveItems` and `moveWell` still change its stages.
  - **Starting settings:** `addRandomization` with a mix step just before its place takes the
    transfer stage before the mix step; with only mix steps before it, the nearest transfer stage
    after it.
  - **Tips kept on a later run:** A1 and A2 sharing tips set to BC1070, A1 taken out and run: A2's
    group keeps BC1070; a source turned to share tips with the group above joins its tips.
  - **Nothing kept, or a new filler stage:** every source replaced, the old first stage Slow on
    BC1070: every new stage Slow and every group BC1070; the filler wells replaced (the old filler
    stage aspirating Fast on BC1070 on 8 probes, the others on BC230): the new filler stage Fast on BC1070, 8 probes, while
    the other stages keep theirs.
  - **`forAll` refused:** `destinationMixes` `true` with a stage dispensing Non-Contact, and
    `sourceMixes` `false` with a stage whose source end isn't one of the modes, each throwing its
    message naming that stage, the plan unchanged; `forAll` `tipType` when the randomization's
    first stage is the plan's first: `START`'s tip change gets it.
  - **`randomizationStageValues`:** the example of section 3; all stages alike gives every value;
    a stage whose end isn't one of the modes gives that mode `null`; before a run, its own values;
    after a group's tips change with its ✎ (`setTipType`), `tipType` `null`; an unknown ID throws.
- After `setRandomization` takes A2 out of `sources`, its stage is still in `stages`
  (`randomizationOf` still `r1`); the next run removes it. After adding A4: a new stage after the
  last, on new tips. Replacing the only source of a randomization whose stage is the plan's only
  stage runs without error (new stage first).
- Added before the run's first stage: its first stage gets the `START` tips, set to its tips, and
  the old first stage a tip change of its own loading the tips it had.
- `removeStage` of the stage a randomization sits before moves it to the next stage, or `null`; of
  the stage just after a randomization's last stage, gives the stage after that its own tips.
  `removeTipChange` of that stage's tip change throws its message.
- `placeRandomization` moves one that hasn't run; one that has, throws.
- `runRandomization` with a problem throws its message, leaving the plan unchanged.
- `removeRandomization` takes out the randomization and its stages; the tip change the run added
  after it stays; with no stages, only the randomization; when its stages are all the plan's
  stages, it throws, and `canRemoveRandomization` is `false`.
- `setRandomizations` accepts the randomizations of a plan after running (the round trip a plan file
  makes), and refuses each of its rows in section 5, in the order of checks, prefixed
  `Randomization N: `.
- `setRandomizations` accepts a randomization whose stage's well was taken out of its sources
  before a rerun; refuses one well with two stages; refuses a randomization sitting before another
  one's second stage, even when loading both at once (from a plan with none).
- Every function leaves the plan given unchanged; in the table of which parts each edit may change,
  `addRandomization`, `setRandomization` and `placeRandomization` change only `randomizations`;
  `runRandomization` and `removeRandomization` change `randomizations`, `stageList`, `stageOrder`,
  `operationList` and `tipChanges`; `removeStage` may change `randomizations` too. The plan that
  table's edits run on holds a randomization that has run.
- `emptyPlan()`'s `randomizations` is `[]`.

**The REPL** (`scripts/repl.js`): the randomization functions in the transfer designer's topic, with
an example that adds, sets up and runs one; and a topic of its own for `random-pool`.

**Sharing tips** (2026-11-05). Existing tests whose sources lack `sharesTips` are given
`sharesTips: false` on every source (the specification changed, not the tests' purpose); the
two existing tests of `removeTipChange`'s message after a randomization expect its new ending,
`A randomization never shares tips with other stages.` (the message changed, section 5); the
Randomizations set-up above serves, with Deep A4 holding `Drug A` at a second concentration where
four sources are needed.
- **Regression fixture** (`tests/fixtures/shared-tips/`, whose `README.md` says how it was made).
  It was captured from the code before this change was built, so these tests show that a
  randomization whose sources all start new tips gives the same Biomek files as before. **It's a
  regression fixture, not a golden file**: Andy hasn't verified its files, so it shows "unchanged",
  not "correct". Never edit it to make a test pass. The tests, in `transfer-designer.test.js`
  (they use `plan-file` and `file-writer` to read and write, as the page does):
  - `randomized-plan-v9.json`, opened with `planFromText`, then `writeRunFiles(plan, new
    Date(2026, 10, 5, 9, 30, 0))`, gives exactly the files in `biomek-files-before/`: the same
    names, in the same order (`Setup.csv`, `Stages.csv`, `Stage01_A.csv` to `Stage06_A.csv`), and
    each file's text equal character for character (line endings included) to the fixture file's.
  - The same after Update with nothing changed: the opened plan's randomization `r1` isn't out of
    date, and after `runRandomization(plan, "r1")` the files are again exactly the fixture's.
  - **With two adjacent sources sharing:** the opened plan, `setRandomization` with Deep1 A2's
    `sharesTips` `true` (sharing Deep1 A1's tips), then `runRandomization`: in `Stages.csv`, the
    rows of the tip group holding Deep1 A1's and Deep1 A2's stages begin with exactly one
    tip-change row (`NewTip` `1`, with `TipType` and `LoadProbes` as in the fixture) followed by
    the two stages' transfer rows (`NewTip` `0`) with no tip-change row between them; there's one
    fewer row with `NewTip` `1` overall than in the fixture's `Stages.csv` (the column names are
    `file-writer.md`'s, section 3, "`Stages.csv`, the stage worklist"); every transfer row and
    every Transfer From File file is as in the fixture (the same wells to each source, since
    sharing changes no well's source).
- **`sourceGroups`:** `[]` for no sources; `false, true, true, false, true` gives `[[0, 1, 2], [3,
  4]]`; every `false` gives one group per source; a first source with `true` (as a caller's list
  might hold) still starts a group; refusals with their messages.
- **`setSourceSharesTips`:** joining (`true` on a group's first, not the list's first) merges it
  and the sources sharing its tips into the group above; splitting (`false` inside a group) makes
  it and the sources after it in that group a new group; setting the list's first to `true` is
  refused; an unchanged value gives the same list; entries whose value didn't change are the same
  objects, and other properties (e.g. `replicatesText`) are kept.
- **`moveSource`:** each example of section 3, "Sharing tips"; a source moved between groups at
  each index (`0`, between two, the end) gets `false`; into a group at each position: at the top it
  starts the group and the old first shares; elsewhere it shares; a group's first moved away hands
  its tips to the next (`false`); a group's only source moved away leaves no empty group; moving to
  the very top (`between` 0) gives it `false` and the old first keeps `false`; a place pointing at
  the moved source (its own group's position, its own position + 1, `between` its own group's
  index when it's the group's only source) gives the same list; a move that changes only
  `sharesTips` (a group's first moved to `between` just above its own group, while the next shares
  it) isn't the same list; refusals with their messages, in the order of checks.
- **`removeSources`:** removing a group's first hands its tips to the next; removing every source of
  a group removes the group; removing the list's first leaves the new first `false`;
  `removeSources(s, [])` gives the same list `s`; refusals, including with a list of one source and
  an empty list (their messages, section 5).
- **The first source made `false`:** given a list whose first source holds `true`,
  `setSourceSharesTips` (on another source, its value unchanged), `moveSource` (a place that moves
  nothing) and `removeSources(s, [])` each give a new list, not the same one, whose first entry is a
  copy with `sharesTips` `false` and every other entry the same object.
- **No source at an index:** `setSourceSharesTips` and `moveSource` with index `7` on four
  sources, `1` on one source and `0` on none give the three forms of the message.
- **`tipSetsToMake`:** A1, A2 and A3 sharing and the filler on new tips: `2`; every source on new
  tips: the number of stages a run makes (`4`); on an exact fit with the filler starting a group of
  its own: the groups that get a stage only (A1 to A3 sharing: `1`); A2 sharing but A3 not: `3`;
  `null` with a problem (no seed); the same before and after a run; the plan given unchanged;
  throws for `r9` with its message.
- **A run with shared tips** (A1, A2, A3 at 4 replicates, A4 the filler; A2 and A3 sharing A1's
  tips, A4 not): four stages in source order; A1's stage has a tip change (or `START`) loading
  `tipType` and `probes`; A2's and A3's have none, so `tipGroups` gives one group of three stages
  then the filler's alone; `columnBoxes` gives the randomization's box with two tip groups; the
  stage after the randomization keeps its own tip change; the stage before it isn't joined.
- **The filler's place:** with the first filler well sharing the tips of the source above it, the
  filler's stage is in that source's group; with a later filler well marked as sharing, it changes
  nothing about the filler's stage, but the source after it in `sources` (if it shares) is in the
  filler's group; on an exact fit (no filler stage) a source sharing the filler's tips shares the
  tips of the source before the filler instead (the group's first stage that exists starts its
  tips); a source that gets no stage at the start of a group: the group's next stage starts its
  tips.
- **Rerunning with new sharing:** after a run with every source on new tips, set A2 to share
  (`setRandomization`): out of date (`isRandomizationOutOfDate` `true`); a run takes out A2's tip
  change; the transfers and stage IDs are unchanged. Set back to `false`: out of date; a run gives
  A2 a tip change again. Each as one undo with `plan-history`.
- **Reordering:** after a run, sources reordered (`setRandomization` with A3, A1, A2): out of date;
  a run puts the stages in the order A3, A1, A2 (the same stage IDs, moved), consecutive, where the
  first was; the operation list's blocks follow the new stage order; stages outside it keep their
  places and tips; the wells each source gets match `assignPool` of the reordered pool (so differ
  from before for the chosen seed). A randomization without stages sitting before its first stage
  still sits above it after the run.
- **Reordering with shared tips:** A3 moved to the top of the group A1, A2, A3 (`moveSource`), then
  run: A3's stage first with new tips, A1 and A2 sharing it.
- **At the top of the plan:** a randomization whose first stage is the plan's first, its sources
  reordered and run: the new first stage's tips are `START`'s (set to `tipType` and `probes`), no
  tip change is keyed by the first stage, and the old first stage, if it shares, has none.
- **Unchanged:** every source `false`: a run gives the same plan as before this change (each stage
  alone in its tip group, the same tip changes); running twice with nothing changed gives the same
  stage order and tip changes.
- **`setRandomization`:** a source with `sharesTips` missing, `"yes"`, or `true` on the first source
  is refused with its message; changing only `sharesTips` gives a new plan (not the same plan), and
  so does changing only the sources' order (the same sources and values, A3, A1, A2 for A1, A2,
  A3).
- **Plans saved before this change, stages out of the sources' order** (section 3, "Out of
  date"): a run randomization set with `setRandomizations` as a pre-change run could leave it:
  sources Res1 1 (taking 2 replicates), Res1 2 (the filler) and Deep A1 (2 replicates), every
  `sharesTips` `false`, its stages in the order Res1 1, Deep A1, Res1 2 (each on tips of its own),
  as unmarking the first of two filler wells and running again left it: accepted;
  `isRandomizationOutOfDate` is `true`; a run puts its stages in the order Res1 1, Res1 2, Deep A1
  (the same stage IDs and transfers) and it's no longer out of date.
- **`setRandomizations`:** accepts a run randomization whose stages share tip groups with each
  other; refuses one whose first stage shares the tip group of the stage before it, and one whose
  last stage shares with the stage after it, each with `stage "N" shares tips with a stage outside
  the randomization…`; accepts one whose stored `sharesTips` don't match its stages (out of date).
- **Removing a stage inside a shared group:** `removeStage` is never offered for an owned stage,
  but `removeStage` of the stage just after a randomization whose last group shares still gives the
  next stage its own tips.
- **Moving and copying:** moving a run randomization with shared tips keeps its tip groups;
  `copyOf` writes version 3 with `sharesTips` on each source and `tips` `null` on each sharing
  stage; pasting it gives the same tip groups, and the pasted randomization passes
  `setRandomizations`; a version 2 copy pastes with every source `false` and each stage alone; a
  version 3 copy whose first owned stage's `tips` is `null` is refused with the form message; a
  version 6 copy is refused as newer; copying one stage of a shared group gives an ordinary stage
  with that group's tips; copying two stages of one shared group and pasting `between` boxes gives
  one tip group.
- **To the top of the plan:** a run randomization whose sources A1, A2 and A3 share (A1 new tips)
  and whose filler is on new tips, sitting below a tip group, moved (`moveItems`) to `between` 0:
  its first stage's tips are `START`'s (`tipType` and `probes`), no tip change is keyed by it, A2's
  and A3's stages have no tip change, the filler's stage has its own, and the old first tip group's
  first stage gets a tip change loading the tips `START` had; it isn't out of date. Copied
  (`copyItems`) to `between` 0: the same for the copy, the original unchanged.
- **Copied items version 1 and 2 with `sharesTips`:** a version 1 copy, and a version 2 copy, whose
  randomization's source has `sharesTips` (`false` or `true`) is refused with the form message,
  `Can't paste: item N isn't a stage, tip group or randomization as the transfer designer copies
  them.`; a version 2 source that is `null` is refused with `setRandomization`'s message for a
  source that isn't an object, after `Can't paste: item N: `; a version 2 copy whose second owned
  stage's `tips` is `null` is refused with the form message.
- **Copied items version 3 disagreeing:** a version 3 copy whose sources say A2 shares A1's tips
  but whose A2 stage has `tips` (its own tip group), and one whose sources say no source shares but
  whose A2 stage has `tips` `null`: each pastes, with its stages in the tip groups the copy gives,
  and the pasted randomization is out of date; Update puts its tips as its sources say.
- **Moving wells:** moving a source that shares tips keeps its `sharesTips`.

**The REPL** (`scripts/repl.js`): `sourceGroups`, `setSourceSharesTips`, `moveSource` and
`removeSources` in the transfer designer's topic, with an example that groups three sources, moves
one to the top of its group, and runs the randomization to show the tip groups.

**Transfer tables** (2026-11-05). A test plan, built in a helper: components Media, Drug A and
DMSO; Res1 1 holding Media 3,000 µL, Res1 2 holding Media 10,000 µL, Deep1 A1 Drug A 1,000 µL,
Deep1 A3 DMSO 1,000 µL, Deep1 A4 holding Media and DMSO (a mix); Plate1 A1 to A3 labeled `Control`,
B1 to B3 `A low`; one stage, `New stage`. Volumes and counts in these tests are worked out from
`config/labware-types.js`'s dead volumes, never named (CLAUDE.md, "Tests follow config/").
- **Reading:** a header row and two rows give one column per component, each amount's wells in deck
  order; cells' spaces are trimmed; `1,500` reads as 1500, `2.5` and `.5` as numbers; blank, `0`,
  `0.0` add nothing; a column with no amounts is listed with `amounts` `[]`.
- **Each reading problem** of section 3's table, with its `row`, `column` and message; `-5`, `1e3`,
  `lots` and `5 µL` aren't amounts; a cell under a problem header or in a problem row gives no
  amount problem of its own; problems come in reading order.
- **The form:** `readTransferTable` throws for `[]`, a row that's `[]`, rows of different lengths,
  and a cell that isn't text, each with section 5's message; a one-row table and a one-column table
  are read (no amounts, no problems), and their draft's only problem is "adds nothing".
- **Blank rows:** a fully blank row between two rows (and one at the end) is ignored: no problem,
  no amounts, and the rows after it keep their row numbers in messages.
- **Stock wells:** Media gives Res1 1 then Res1 2 (deck order), not Deep1 A4; a component in no well
  gives `[]`; after `emptyWells` of Res1 1, only Res1 2.
- **A draft's problems:** "adds nothing" when every amount is blank; no stock well; no wells chosen
  (key missing); a chosen well holding a mix (Deep1 A4) or another component; a source well that's
  also a destination: a stock of Media labeled `Control` (a label a row uses), and Drug A's column
  filling Res1 2 (labeled) while Media draws from Res1 2; in section 3's order; `[]` for a good
  draft. An empty source list, a well off the deck or listed twice, and a key that
  isn't a component are refused as the draft's form (thrown).
- **The split:** Media at 190 µL into 12 wells from Res1 1 then Res1 2: Res1 1 takes as many whole
  transfers as fit in its usable volume (worked out from the dead volume) and Res1 2 the rest; a
  well with room for exactly `n` transfers takes `n`; a first well with no room passes every
  transfer on; with rows of 300 and then 100 µL, a well stops at the first transfer that doesn't
  fit, and later, smaller ones go to the next well too; contents are those just before `at` (a
  stage before `at` drawing from Res1 1 lowers its share; one after it doesn't); `sourceSplit`
  works while another column has a problem.
- **Copying the nearest transfer stage:** with a transfer stage on Slow and then a mix step just
  before `at`, the first new column copies the transfer stage's settings (not the mix step's) and
  that stage's tips.
- **Adding:** a draft of Media, Drug A and DMSO (DMSO blank in every row) before stage 1: two
  stages, named Media and Drug A, in column order, before stage 1, each the only stage of its tip
  group, stage 1 keeping its tips; their transfers as `transferTableStages` gives them; with no
  stage before, the first gets `defaultSettings()` and the `START` tips' type and probes, and the
  second the first's; added at the end after a stage on Slow with BC1070 on 8 probes: both get
  those; `transferTables` holds `t1` with the table and sources copied (changing the draft
  afterwards changes nothing) and `stages` `[{ component: "Media", stage }, { component: "Drug A",
  stage }]`; one edit (one undo state); a second table is `t2`.
- **Where it can be added:** `null`; the first stage of a tip group; before a randomization's first
  stage or another transfer table's first stage (it goes above); refused before a stage inside a
  tip group, a randomization or a transfer table.
- **Updating:** after setting the Media stage to Slow and its tips to BC1070 on 8 probes, an update
  changing Media's amounts keeps the stage's ID, settings and tips and replaces its transfers; a
  column added (DMSO amounts) between Media and Drug A gets a new stage between them with Media's
  settings and tips (the column before it); a column cleared (Drug A all blank) loses its stage;
  after two columns swap places in the table, the stages are in the new column order, keeping their
  IDs; the stage just after the table keeps its tip change; one edit; nothing to change gives the
  same plan.
- **`renamedFrom`:** the header Media changed to DMSO with `{ DMSO: "Media" }`: the Media stage is
  kept (same ID, settings, tips), renamed DMSO, with DMSO's transfers; without it, the Media stage
  is removed and DMSO gets a new stage copying the column before it (or the stage before the
  table); an entry whose old component has no stage, or whose stage another column keeps, is
  ignored.
- **Randomizations around an update:** a randomization without stages sitting before the transfer
  table's first stage still sits before its first stage after an update that removes that stage
  (its column cleared), and after one that reorders its columns so another stage is first;
  `setTransferTables` refuses a not-run randomization sitting before a stage of it other than its
  first, with its message.
- **A run randomization above a reorder** (from the code review, 2026-11-05): a randomization run
  just above a transfer table (its `beforeId` the table's first stage) has the new first stage as
  its `beforeId` after moving the table's second stage to position 0, and after an update whose
  first column is cleared and a new column added before the second; `setRandomizations` accepts the
  result.
- **`transferTableStages` with an `id`:** gives the same with `at` `null` as with its first stage.
- **Out of date:** `false` right after adding and after updating; `true` after relabeling one of its
  wells, emptying a stock at Start, adding a stage before it that draws from Res1 1 (changing the
  split), or `removeComponent` of Drug A, or the transfer table moved (`moveItems`) below a stage that draws
from Res1 1 (changing the split); `false` again after updating (for the removed component,
  after its column is deleted from the draft); still `false` after changing a stage's settings or
  tips (`changeStageSettings`, `setStageMix`, `setTipType`, `setTipProbes`).
- **Renaming a component:** Media renamed DMEM renames the header cell (also one written ` Media `,
  which becomes `DMEM`), the `sources` key, the `stages` entry and the stage's name, in one edit; the
  table stays up to date; undo brings all of it back.
- **Removing a component:** Drug A removed: its `sources` key goes, its header stays, the table is
  out of date, its stage is still owned.
- **Protection:** each refusal of section 5 for a transfer table's stage: adding, removing and
  changing a transfer's volume, renaming, removing the stage, removing its tip change, removing the
  tip change just after it, adding a stage, mix step, randomization or transfer table before its
  second stage, and `takeTips` before its first; `addStage` and `addMixStep` without `takeTips`
  before the stage just after it, and with `null` when it's last, refused with their own message;
  and each allowed edit works: `changeStageSettings`, `setStageMix`, `setTipType`, `setTipProbes`,
  `addStage` before its first stage without `takeTips` (the new stage joins the tip group above),
  `addStageWithNewTips` and `addMixStepWithNewTips` before its first stage and just after its last
  (new tips of their own, the stage below keeping its tips).
- **Adding above a first transfer table:** with the transfer table's first stage the plan's first,
  `addStage` (and `addMixStep`) without `takeTips` before it: the new stage is first, on the
  `START` tips, and the transfer table's first stage has a tip change loading the tips it had
  (each of its stages still the only stage of its tip group). `removeStage` of the stage just after it gives the next stage a tip
  change loading the removed one's tips.
- **Removing:** takes out the table and its stages; tip changes on the stage after it stay; refused,
  and `canRemoveTransferTable` `false`, when its stages are all the plan's; a randomization without
  stages sitting before its first stage then sits before the stage just after it (or `null`).
- **Its own edits skip the refusals:** updating (removing a cleared column's stage, replacing
  transfers), removing, `renameComponent` (renaming its stage) and `moveWell` (its transfers) all
  work on its stages, and `removeStage`'s randomization rules still apply in them.
- **`setTransferTables`:** accepts what adding gives; each refusal of section 5, in the order of
  checks, including a stage owned by a randomization and a transfer table.
- **`columnBoxes`:** a transfer table is a `transferTable` box whose tip groups each hold one stage;
  a randomization's and a transfer table's boxes side by side are two boxes.
- **Moving and copying:** moving a transfer table between boxes keeps its stages, settings and tips;
  refused inside a tip group; a stage of it alone is refused; `copyOf` writes version 4, with
  `transferTable` and `stages`; a pasted copy is a new transfer table (the next free ID) with new
  stages, each on its own tips as copied, and the same table and sources; a version 3 copy holding
  a transfer table item is refused with the form message; **moving inside it** (Andy, 2026-11-05):
the second of three stages moved to position 0 makes it first in the stage order and in `stages`,
its column first among the component columns in `table` (a blank-header column and a column making
no stage staying where they are among the others), each stage keeping its ID, settings and its own
tip change, the stage just after the table keeping its tips, one edit, not out of date; to the
bottom (position 3), its column last among the stages' columns; with the table's first stage the
plan's first, moving another to the top gives it the `START` tips and the old first a tip change
of its own; the same order gives the same plan; a stage moved inside another transfer table, an
ordinary stage moved into one, a tip group or randomization put there, and a table's stage moved
between boxes are refused with section 5's messages; a pasted table whose stage names a
  component without a column is refused with `Can't paste: item 1: its stage for Dye has no column
  in its table.`; a copy whose `sources` name a component this plan lacks (and whose header names
  it) pastes, without that key, and is out of date; copies of its stages copied alone are ordinary
  stages, owned by nothing.
- **Moving wells, transfer order:** with `Control` on Plate1 A1 to A3, moving A1 to H9 (past A2
  and A3, so its transfers come in another order) leaves the transfer table up to date, and an
  update then gives back the same plan; with Media drawing from Res1 1 then Res1 2 (Res1 1 giving
  all but the last transfer), moving `A low`'s B1 to H9 makes H9 the last transfer, drawing from
  Res1 2 instead of B3: out of date.
- **Moving wells:** `isWellUsed` is `true` for a source well with no starting contents and no
  transfers (one emptied at Start after adding); Res1 1 is in use (a source); moving it to Res1 5 puts Res1 5 in Res1 1's place in
  `sources` and in the transfers, and the table stays up to date; moving a labeled destination moves
  its label and transfers, and it stays up to date.
- **Immutability:** every function above leaves the plan and the draft given unchanged; a plan's
  `table` and `sources` are frozen.

**The REPL** (`scripts/repl.js`): `readTransferTable`, `addTransferTable`, `updateTransferTable` and
`isTransferTableOutOfDate` in the transfer designer's topic, with an example building a two-column
table on the real deck (`Res1`, `Deep1`, `Plate1`).

**Moving and copying**
Set up a plan with Res1 troughs 1 and 2 holding `Media` and `Drug`, and four stages in two tip
groups, each with a transfer: `Media` and `Drug` on BC230 tips (`START`), then `Top-up` and `Wash`
on BC1070 tips; and a randomization that has run, with two stages, after them.
- `columnBoxes`: two tip group boxes, then the randomization's, with its two one-stage tip groups;
  a randomization that hasn't run sits before its `beforeId`'s box, or last; two at one place in
  the order of `randomizations`; every tip group in exactly one box.
- **A stage into another tip group** (`Top-up` to position 1 of box 0): `Media`, `Top-up`, `Drug`
  on BC230; `Wash` alone on BC1070, its group keeping its tips (the tip change now keyed by
  `Wash`); every stage keeps its ID, name, settings and transfers; the operation list's blocks
  follow the new stage order, each stage's transfers in their old order.
- **A stage to the top of a tip group** (`Wash` to position 0 of box 0): `Wash` is first, on the
  `START` BC230 tips; `Top-up` keeps BC1070.
- **A stage between boxes** (`Top-up` to `between` 0): a tip group of its own on BC1070, first, so
  its tips are the `START` ones; `Media` and `Drug` get a tip change loading BC230 on the probes
  they had.
- **Stages from two tip groups between boxes** (`Drug` and `Top-up` to the end): two new tip groups,
  BC230 then BC1070; `Media` alone; `Wash` alone.
- **Stages from one tip group together** (`Media` and `Drug` between the BC1070 group and the
  randomization): one tip group, BC230, with both.
- **A tip group moved** to the top and to the end; **a randomization moved** to the top: its stages
  stay each on tips of their own, `randomizationOf` still names it, `beforeId` is the stage after
  its last; the stage after it has tips of its own.
- **A randomization that hasn't run, moved**: its `beforeId` is the first stage of the next box with
  one, or `null`; `randomizations` is in column order.
- **The last stage of a tip group moved away**: the group is gone, with its tip change; the first
  stage of the first group moved away: the rest keep the `START` tips.
- **Moving every stage of the target tip group into itself** (its only stage to position 0 of its
  own box): the same plan.
- **Nothing changes**: a stage dropped where it is, a tip group just before or after itself; the
  same plan object is given back.
- **Copies**: `copyItems` of a stage, a tip group and a randomization: new IDs, the same names,
  settings and transfers; the originals unchanged; a copied randomization gets the next free ID
  and owns the copies of its stages; a copy of a randomization's stage is owned by none and keeps
  its own tips between boxes.
- **Copied items as JSON**: `copyOf` gives data that survives `JSON.stringify` and `JSON.parse`;
  pasting it into a different plan gives the same stages, tips and transfers;
  `copyOf` doesn't change the plan.
- **Items**: listed out of column order, they're placed in column order; a stage inside a listed tip
  group is left out; an item listed twice counts once.
- **Refusals**, each with its message and the plan unchanged: every row of section 5 in this
  section, including a tip group and a randomization put inside a tip group, a randomization's stage
  moved without its randomization (copying it is fine), and a place outside the column.
- **Pasting checks**: wrong format, a newer version, an entry not in its form, a well not on the
  deck, refused settings, a transfer breaking the stage rule, a transfer into a mix step that isn't
  a mixed well, an unknown tip type, a randomization's refused value, and
  a randomization with two stages for one well; each refused with `Can't paste: ` and its message.
- **Places pointing at moved things**: group [A, B, C], A and B moved to position 0 or 1 of their
  own group: unchanged order, the same plan (position 1 means just before B, the first stage there
that isn't moving); A moved to position 2: B, A, C, the tip change on B.
  A tip group moved `between` at its own index or just below itself: the same plan. A tip group's
  only stage moved, with the place `between` that group's index: lands where the group was.
- **Splitting**: a tip group's last stage moved `between` just below its group: a new tip group,
  same tips; not the same plan.
- **Randomizations around moves**: moving the box an unrun randomization sits before: the
  randomization stays at its place in the column (before the next box), its `beforeId` updated;
  moving away the stage just after a run randomization, and moving a stage into the tip group just
  after it: the stage after the randomization still has its own tip change.
- **Pasting at the top**: into `inTipGroup` position 0 of the first box: the pasted stage is first,
  on the `START` tips (the group's); the old first stage has no tip change of its own.
- **A copied randomization with a leftover stage** (a source taken out, not run again): `copyOf` and
  `pasteItems` keep the leftover stage, and the pasted plan's randomizations pass
  `setRandomizations`.
- **Copies from two tip groups with the same tips**: two BC230 tip groups, one stage copied from
  each and pasted `between` boxes: two tip groups, as moving them gives; two stages copied from one
  tip group: one.
- **Pasting into a new plan** (`emptyPlan()`, whose one stage is `New stage`): a copied tip group
  pasted `between` 0 lands above `New stage`, whose tips become a tip change of its own.
- **Position out of range** in `inTipGroup`: its message.
- **Overdraws after a move**: moving `Drug` (drawing from a trough `Media` fills) before a stage
  that fills it gives a contents problem in `Drug`'s stage (`stagesWithContentsProblem`).
- **`placed`**: the moved items with their IDs; for copies, the new IDs; for a tip group, its first
  stage's ID; in column order.
- **Immutability**: every edit leaves the plan given unchanged; parts it didn't change are the same
  objects; `moveItems` changes only `stageOrder`, `tipChanges`, `operationList` and
  `randomizations`.

**The REPL** (`scripts/repl.js`): `columnBoxes`, `moveItems`, `copyOf`, `copyItems` and
`pasteItems` in the transfer designer's topic, with an example that moves a stage into another tip
group and pastes a copied tip group into an empty plan.

**Moving wells**
- `isWellUsed`: `false` for every well of `emptyPlan()`; `true` for a well with starting contents,
  for a transfer's source, for its destination, for a mix step's mixed well, for a well with only a
  label, for a randomization's source, its well to fill, and the well of a stage it owns whose
  source was since taken out (section 3, "Randomizations"); `false` for an unused well on the same
  labware.
- `isWellToFill`: `true` for a randomization's well to fill, `false` for its source and for a well
  no randomization fills.
- **A trough moved to another trough:** `Res1 3` holds Media, is labeled `Media stock`, and is the
  source of two transfers in stage 1 and one in stage 2. Moving it to `Res1 7`: the starting
  contents entry is `Res1 7`'s, in the same place, with the same components; the three transfers
  draw from `Res1 7`, each in its place, stage and volume; `wellLabelOf` gives `Media stock` for
  `Res1 7` and `null` for `Res1 3`, and `Res1` stays in `wellLabels` only while it has another
  labeled well; `isWellUsed` is `false` for `Res1 3`; contents tracking gives every other well the
  same contents after every stage as before the move.
- **A destination moved:** a plate well that only receives transfers moved to another plate well:
  the transfers fill the new well, and the old one is empty after every stage.
- **A mix step's well moved:** both ends of its mixed-well transfer are the new well.
- **To other labware:** a trough holding more than a plate well's capacity moved to a plate well:
  the move is allowed and the plan has an overfill (`stagesWithContentsProblem` and contents
  tracking report it).
- **A randomization's source moved:** its source keeps its place in `sources`, with its replicates
  and filler, and its stage's entry in `stages` names the new well; running it again with the same
  seed gives every well to fill the same source as before the move.
- **More uses moved together:** a well that's the source of a transfer in one stage and the
  destination of one in another: both move. A source of a randomization that hasn't run (`stages`
  empty): its `sources` entry moves. A randomization's stage entry whose well is no longer one of its
  sources (built with `setRandomizations`, as a plan file can hold it): the entry moves, and
  `isWellUsed` is `true` for that well even with no transfers from it.
- **Labels land as `setWellLabel` places them:** with `Res1` labeling `1`, `3` and `5`, moving `3`
  to `9` gives `Res1`'s labels in the order `1`, `5`, `9`; moving `Res1 3` (the only labeled well
  of `Res1`) to `Plate1 A1` when `Deep1` has labels gives `wellLabels` `Deep1` then `Plate1`.
- **Plan files:** a plan with a randomization whose source was moved is saved with `planToText` and
  opened with `planFromText`, giving the same plan (`setRandomizations` accepts it).
- **Refusals**, each with its message, leaving the plan unchanged: `to` the same as `from`; `from`
  not in use; `from` a randomization's well to fill; `to` with starting contents, `to` a transfer's
  destination, `to` with only a label, `to` a randomization's source, `to` only the well of a randomization's
  stage entry, and `to` a randomization's well to fill; `from` or `to` not on the deck.
- **Order of checks:** both wells off the deck reports `from`'s; `to` the same as an unused `from`
  reports the same well, not `from` unused; an unused `from` with a `to` in use reports `from`; a
  `from` that's a well to fill with a `to` in use reports the well to fill.
- **Sharing:** `moveWell` changes only `startingContents`, `operationList`, `wellLabels` and
  `randomizations`, and each only if the moved well is in it; the operation list shares every
  transfer that doesn't touch `from`.
- **Undo:** with `plan-history`, one undo brings back the plan before the move.

**The REPL** (`scripts/repl.js`): `isWellUsed`, `isWellToFill` and `moveWell` in the transfer
designer's topic, with an example that moves a labeled trough to another trough and shows its
transfers and label following it.

**Immutability and sharing**
- Every edit leaves the plan it was given unchanged.
- After any edit, parts it didn't change are the very same objects in the new plan.
- In the table of which parts of the plan each edit may change, `setWellLabel` and `setWellLabels`
  change only `wellLabels`; no other edit changes it. The plan that table's edits run on holds well
  labels, so the check means something.

**The REPL** (`scripts/repl.js`): `tipsUsed` in the transfer designer's topic, with an example of
two tip types and one of a tip group without transfers counting nothing.

**The REPL** (`scripts/repl.js`): `wellLabelOf`, `setWellLabel` and `setWellLabels` in the transfer
designer's topic, with examples; the plan file topic's examples of older and newer versions follow
the new version (e.g. version 5 opening, version 7 refused).
