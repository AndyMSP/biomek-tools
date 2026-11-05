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

> **Draft change (2026-11-05, tips used, item 17 of v0.2.0):** `tipsUsed`, how many tips of each
> tip type the run loads, for a tool to show (sections 2, 3, 4 and 6; Andy, 2026-11-05). It counts
> exactly the tips the Biomek files load, so it changes no Biomek files. Written in the hands-off
> workflow (CLAUDE.md, "Workflows"), so the choices made for Andy are listed in its pull request.
> It becomes Final once built and tested by Andy.

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
- `concentrations`: what a well's mixture carries, from what its components carry (ADR 0013).

Beside it in this tool are two other logic modules, `plan-history` (undo and redo of plans) and
`plan-file` (saving and opening plans; ADR 0010), and the page (`transfer-designer-page.md`).

## 2. Scope
Version 1 creates an empty plan; adds, removes, changes, moves and copies stages (and moves and
copies tip groups and randomizations); adds, removes and changes transfers, tip changes,
components (with their constituents), starting contents, labware labels, well labels and the
experiment name; and answers questions about a plan: its stage order, its tip groups, the tips it
uses, the stages
with a contents problem or a mix problem, where each stage ends, the labware it uses, and what
each well carries (its concentrations).

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
  components:       [{ name: "Media", color: "#4e79a7", constituents: [] },
                     { name: "Dye stock", color: "#f28e2b",
                       constituents: [{ name: "Dye", amount: 10, unit: "mM" }] }, …],
  startingContents: [{ labware: "Res", well: "1", components: { Media: 12000 } }, …],
  operationList:    /* an OperationList */,
  stageList:        /* a StageList */,
  stageOrder:       ["1", "3", "2"],
  tipChanges:       { start: { tipType: "BC1070", probes: [1, 2, 3, 4, 5, 6, 7, 8] },
                      "2": { tipType: "BC230", probes: [1, 2, 3, 4] } },
  labwareLabels:    { Plate: "Assay plate" },
  wellLabels:       { Deep: { A1: "Cond 1", A2: "Cond 2" } },
  randomizations:   [/* a randomization, below */],
  experimentName:   "Exp36",
}
```

- **`components`**: the liquids the user has named (`docs/glossary.md`, "Component"), in the order
  they were added. Each has a `name` (a name: text, not blank, no whitespace at the start or end,
  as `checkName` in `input-checks`) and a `color` (text, e.g. `"#4e79a7"`; which colors are
  offered is up to the tool) and `constituents` (`concentrations.md`, section 3: a list of
  `{ name, amount, unit }`, in the user's order, possibly empty; "Constituents", below), its
  properties in that order (`name`, `color`, `constituents`), since plan files write them as
  they are. No two
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
  in every well too; removing takes the component out of every well (a well left empty is no
  longer listed). Renaming a component to its own name changes nothing.
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
  sources:   [{ labware: "Deep", well: "A1", replicates: 4, filler: false }, …],
  fill:      [{ labware: "Plate1", well: "B2" }, …],
  seed:      37,                   // or null
  volume:    50,                   // µL per transfer, or null
  settings:  { /* a stage's six settings */ },
  tipType:   "BC230",
  probes:    [1, 2, 3, 4],
  stages:    [{ labware: "Deep", well: "A1", stage: "5" }, …],   // what its last run made
}
```

- **`sources`**: wells on the deck, each once, in the order given. `replicates` is a whole number of
  at least 1, or `null` (not given yet). Any number of sources may be **filler wells** (`filler:
  true`), each with `replicates` always `null`; together they're the **filler**, which fills the
  wells the replicates leave over, drawing from the filler wells in their order in `sources` (Andy,
  2026-11-02: one well can't always hold enough filler). Any well may be
  a source, whatever it holds (Andy, 2026-11-01: never guessed from contents); one that holds
  nothing at that point just makes overdraws.
- **`fill`**: the wells to fill, on any labware, each once, none of them a source, kept in the
  deck's order of labware and each labware's grid order (`wellNames()`), whatever order they were
  given in, so the same wells always form the same pool.
- **`seed`**: a whole number from 1 to 999,999, or `null`. **`volume`**: a number above 0, or
  `null`.
- **`settings`**: the settings every one of its stages gets (`stage-list.md`; the mixing rule of
  section 3 applies). They can't be a mix step's (`MIX_STEP_MODE`). **`tipType`** and **`probes`**:
  the tips every one of its stages' tip changes load (as `setTipType` and `setTipProbes` check
  them; `probes` stored smallest first).
- **`stages`**: the stages it **owns**, one per source its last run gave a stage, in stage order,
  each with its source's well. Only running and removing change it, so a source taken out of
  `sources` keeps its stage here until the next run removes it.

**Where it sits.** Once it owns stages, it sits where they are: they're consecutive in the stage
order, and each is the only stage of its tip group. Until then, it sits just before stage
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

**It owns its stages** (Andy, 2026-11-01): they're changed only through it, so they always match
what it last ran with. `randomizationOf(plan, stageId)` says which randomization owns a stage. The
caller offers no other edit of an owned stage, its transfers or its tip change (the other edits
here don't refuse them; roadmap, "Technical debt"). Two rules keep its stages on tips of their own
whatever else is edited:
- `removeTipChange` refuses the tip change of the stage just after a randomization's last stage:
  `This tip change keeps stage 7, “Media”, off the randomization's tips. A randomization never
  shares tips.`
- `removeStage`, removing the stage just after a randomization's last stage, gives the next stage
  a tip change loading the tips the removed one used, if it has none.
- `removeTipChange` also refuses the tip change of a stage a randomization without stages sits
  before: `A randomization sits before stage 2, “Top up”, between tip groups, so these tips can't
  be removed.`

**Running** (`runRandomization`), when it has no problems (below), as one edit:
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
   order, **named** as its source is (below). So every new stage has new tips, and the stage after
   keeps the tips it had.
4. **Then old stages go**: each stage in `stages` whose source is no longer in `sources`, or now
   gets no wells (for the filler's stage: the filler as a whole gets none), and each other entry
   naming a filler well (step 3), is removed (`removeStage`). (New stages come first, so a run never
   tries to remove a plan's only stage.)
5. **Each source's stage**: its transfers replaced by one transfer of `volume` from the source to
   each of its wells, in `fill`'s order (the filler's stage: from the filler well each well was
   shared to, in `fill`'s order); its settings set to `settings` (as `changeStageSettings`);
   its tip change set to `tipType` and `probes` (its own, or `START`'s if it's the run's first
   stage). It's **named** as its source is now: `sourceName` of its source, and for the filler's
   stage, of the first filler well that holds something just before the randomization (its label,
   if it has one, counts as for any source), or of the first filler well if none holds anything.
   So a run renames a stage whose source holds something else since the last run (Andy,
   2026-11-03). Contents just before the randomization are replayed once per run, not once per
   source.
6. `stages` lists them in stage order, and `beforeId` is set (above).

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

With the same sources, replicates, filler, wells to fill and seed, a run gives every well the same
source as before, so running again only applies changed settings, tips or volume; a new seed
shuffles again (Andy, 2026-11-01).

**Out of date** (`isRandomizationOutOfDate(plan, id)`; Andy, 2026-11-02 and 2026-11-03). A
randomization's stages are what its last run made; other edits never rerun it. A run's result
depends on its own values and, through the filler's shares, on what the filler wells hold, and a
stage's name on what its source holds, so an edit elsewhere can leave its stages different from
what a run would make now. A randomization is **out of date** when it has run (its `stages` isn't
empty) and either it now has problems (checked first: a run would refuse), or running it now (on a
copy, thrown away) would give different stages: a different number of stages, or, for any of its
stages in order, a different source well, name, or list of transfers (each one's source,
destination and volume, in order). Stage IDs aren't compared, since a run may make them fresh.
One that hasn't run is never out of date. Throws if there's no randomization `id`. (A plan saved
before names were compared, whose sources' contents changed after a run, opens out of date; one
Update clears it.) A tool shows it and lets the user run it again; nothing
reruns it by itself (Andy: it could rearrange a plate already checked).

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

### Moving and copying
(Andy, 2026-11-01; ADR 0014.) Stages, tip groups and randomizations can be moved, and copied, to
another place in the column, and what was copied can be pasted into this plan or another one. Each
is one edit, undone as one.

**The column's boxes.** `columnBoxes(plan)` gives the column as a tool shows it, between Start and
End: a list of **boxes**, in order, each either
- `{ kind: "tipGroup", key, tipType, probes, stages }`: an ordinary tip group, as `tipGroups` gives
  it (its stages owned by no randomization); or
- `{ kind: "randomization", id, tipGroups }`: a randomization, with the tip groups of its stages
  (each holding one stage, in stage order), or `[]` while it has none.

Every tip group of the plan is in exactly one box. A randomization without stages is placed where
it sits (section 3, "Randomizations"): just before the box whose first stage is its `beforeId`, or
last for `null`; several at one place in the order of `randomizations`. (This is the order the
page's Stages column already shows; the page takes it from here, so there's one copy of the rule.)

**Items** (`docs/glossary.md`), the things a move or copy takes, each one of:
- `{ kind: "stage", id }`: a stage (a mix step included);
- `{ kind: "tipGroup", id }`: an **ordinary** tip group (one in a `"tipGroup"` box, not one of a
  randomization's own), named by its first stage's ID (an ID, not `START`, so it names the same
  group however the tips are keyed);
- `{ kind: "randomization", id }`: a randomization.

A list of items is taken in **column order**, whatever order it's given in. A stage in a tip group or
randomization that's also listed is part of it already, so it's left out; an item listed twice
counts once.

**Places**, where they go, in terms of `columnBoxes` of the plan as it was before the edit:
- `{ kind: "between", index }`: between boxes, just before box `index` (`0` above the first box;
  the number of boxes, below the last);
- `{ kind: "inTipGroup", index, position }`: inside the ordinary tip group that is box `index`,
  just before its stage at `position` (`0` at its top; the number of its stages, at its bottom).

A place may point at something that's itself being moved. It then means:
- `inTipGroup`: just before the first stage of that group, at `position` or after it, that isn't
  being moved; or at the group's end if there's none.
- `between`: just before the first box, at `index` or after it, that isn't being moved and isn't
  left with no stages by the move; or below the last box if there's none. (A randomization that
  hasn't run is a box with no stages of its own: it stays, and counts.)

**The container rule** (ADR 0014; `docs/glossary.md`): **containers** are ordinary tip groups and
randomizations; stages (mix steps included) are what goes inside them.
- A tip group moved or copied brings its tip change (tip type and probes) and its stages, in order.
- A randomization moved or copied brings all of itself: its sources, wells to fill, seed, volume,
  settings, tips, and its stages, each still on tips of its own.
- A tip group or randomization goes only **between** boxes. A place inside a tip group is refused
  for a list holding one.
- Stages put **inside** a tip group join it, in their column order, and use its tips. Put at its
  top, the first of them becomes the group's first stage, and the group's tip change moves onto it
  (so a group keeps its tips whichever stage is first).
- Stages put **between** boxes keep the tips they had: each run of consecutive stages (in column
  order) that came from one tip group becomes one new tip group, loading that tip group's tip type
  and probes. A stage that came from a randomization's tip group is a tip group of its own. When
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
- A copied randomization is a **new randomization**: the next free ID (`r` and one more than the
  largest number in use, as `addRandomization` gives), the copied values, and the copies of its
  stages as its `stages`, each with its source's well and in a tip group of its own, loading the
  tips that stage had (normally the randomization's `tipType` and `probes`). Its `beforeId` follows
  from where it lands. The box just below it already starts a tip group (it's between boxes), so it
  keeps its own tips. Stages left over from its last run (section 3, "Randomizations": a source
  taken out, not run again) are copied too, as the plan holds them.
  It fills the same wells as the original (Andy, 2026-11-01: that's what copying means), so it
  usually makes overfills, shown as any others.

**Copied items** are JSON, so a tool can put them on the system clipboard as text:

```js
{
  format: "biomek-tools copied items",
  version: 2,
  items: [
    { kind: "stage", stage, tips, group },   // tips: the tip change of the tip group it came from
    { kind: "tipGroup", tips, stages: [stage, …] },
    { kind: "randomization", randomization, stages: [{ labware, well, stage, tips }, …] },
  ],
}
```

where a stage entry's **`group`** numbers the tip groups its stages came from, from 1, in column
order, so stages with the same number came from one tip group (from the build, 2026-11-02: without
it, two stages copied from different tip groups with the same tips couldn't be told apart, and a
paste would join them where a move keeps them apart); a **stage** is `{ name, settings, transfers:
[{ source, destination, volume }, …] }` (its
transfers in order, each well `{ labware, well }`), **tips** is `{ tipType, probes }`, and a
randomization's **randomization** holds its `sources`, `fill`, `seed`, `volume`, `settings`,
`tipType` and `probes`, and its `stages` give each owned stage's source well with the stage itself
and the tips of its own tip group.
`items` is in column order, as `copyOf` gives it.

**Copied items version 2** (2026-11-02, with several filler wells): the same form as version 1,
whose randomizations may have several filler wells. `copyOf` writes version 2; `pasteItems` reads
versions 1 and 2 with the same checks, so a build that knows only version 1 refuses a copy holding
several filler wells as newer, rather than with a confusing message (as plan files go to version
8).

**Pasting checks everything**, as opening a plan file does (ADR 0010): copied items may come from
another plan or the system clipboard, so they're never trusted. `pasteItems` refuses, changing
nothing, anything that isn't copied items in this form (version 1 or 2), and checks every value with
the rules of the edit that would make it: names (`renameStage`), settings (`changeStageSettings`),
transfers (`addTransfer`: wells on this plan's deck, the stage rule, a mix step's wells), tips
(`setTipType`, `setTipProbes`), a randomization's values (`setRandomization`) and its stages (as
`setRandomizations` checks a plan file's: no well twice, none a mix step; a stage's well needn't be
one of its sources, since a plan may hold a stage left over from the last run), with their own
messages, prefixed `Can't paste: item 2: ` (e.g. `Can't paste: item 2: "Z99" isn't a well on Plate1.
Its wells are A1 to H12.`).

**Where randomizations sit afterwards.** After any move or paste, `randomizations` is in column
order, each one with stages has its `beforeId` set to the stage just after its last stage (or
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
- in a randomization: as a source, a well to fill, or the well of one of its stages.

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
- **randomizations:** each source at `from` gets `to` (keeping its place, replicates and filler), and
  so does each of its stages' entries at `from`; wells to fill never change (above). A stage's name,
  given when its randomization ran, stays as it was.

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

## 4. Interface
The module exports the functions and constants below. None changes the plan or the values it's
given; "returns the plan with …" means a new plan.

**Plans**
| Function | Returns |
|---|---|
| `emptyPlan()` | `{ plan, stageId }`: a plan with no components, starting contents, transfers, labels, well labels or randomizations, no experiment name (`""`), one stage (`NEW_STAGE_NAME`, default settings), and `START` tips of the first tip type; and that stage's ID. |
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
| `addComponent(plan, name, color)` | the plan with a new component last. If `name` is text, spaces at its ends are removed first. Throws if the name isn't a name or is used, or the color isn't text or is used. |
| `renameComponent(plan, oldName, newName)` | the plan with the component renamed, in the list and in every well. `newName` is trimmed as in `addComponent`; if it's then `oldName`, the plan is returned unchanged. Throws as for a new name. |
| `setComponentColor(plan, name, color)` | the plan with the component drawn in `color`. Throws if the color isn't text, or another component has it. |
| `removeComponent(plan, name)` | the plan without the component, in the list or in any well. |
| `countWellsWith(plan, name)` | how many wells hold the component at the start. |
| `addToWells(plan, wells, name, volume)` | the plan with `volume` µL of the component added to each of `wells`, each a well on the deck (`deck.checkWell`), each once. Throws if the component isn't in the plan, the volume isn't above 0, or a well isn't on the deck. |
| `emptyWells(plan, wells)` | the plan with `wells` empty at the start. Never throws for a well that's already empty. |
| `setConstituents(plan, name, constituents)` | the plan with component `name` carrying `constituents` (section 3, "Constituents"), replacing what it carried; names trimmed as `checkConstituents` does. Throws if there's no such component, then as `checkConstituents` does, then if a constituent's family differs from its name's family in another component. |
| `concentrationsOf(plan, snapshot, end)` | the well's concentrations (section 3, "Constituents"): `wellConcentrations(snapshot.volumeFractionsOf(end?.labware, end?.well), plan.components)`, a list of `{ name, family, value }` (`concentrations.md`), `[]` for a well carrying nothing. `snapshot` is a `ContentsSnapshot` of this plan; `end` is `{ labware, well }`, checked by `snapshot.volumeFractionsOf` only. |

`renameComponent`, `setComponentColor`, `removeComponent` and `setConstituents` throw first if
there's no component with that name.

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
| `addRandomization(plan, beforeId, { seed, volume })` | `{ plan, id }`: the plan with a new randomization last in `randomizations`, sitting before stage `beforeId` (or last, for `null`), with no sources, wells to fill or stages, the `seed` and `volume` given (each may be `null`), `defaultSettings()`, the first tip type, and `probesFor(DEFAULT_PROBE_COUNT)`; and its ID. Throws if `beforeId` isn't a place a randomization can sit (section 3), or `seed` or `volume` isn't valid. |
| `randomizationAt(plan, id)` | the randomization with ID `id`, or `null`. |
| `randomizationOf(plan, stageId)` | the ID of the randomization that owns stage `stageId`, or `null`. |
| `setRandomization(plan, id, changes)` | the plan with the randomization's `sources`, `fill`, `seed`, `volume`, `settings`, `tipType` and `probes` replaced by those in `changes` (any of them; the others kept), checked as section 3 says, `fill` put in deck order and `probes` smallest first. Its `stages` and `beforeId` don't change. Gives back the same plan if nothing changes. Throws if there's no such randomization, or anything is invalid (section 5). |
| `placeRandomization(plan, id, beforeId)` | the plan with a randomization that has no stages sitting before `beforeId` instead. Throws if it has stages, or `beforeId` isn't a place it can sit. |
| `randomizationProblems(plan, id)` | the randomization's problems, as messages, in order (section 3); `[]` if it can run. |
| `fillerShares(plan, id)` | how many of the filler's wells each filler well fills, `[{ index, count }]` in `sources`' order (section 3, "The filler's shares"); `[]` with no filler wells; `null` if the volume or the spare wells aren't known yet. |
| `isRandomizationOutOfDate(plan, id)` | `true` if the randomization has run and has problems now, or a run now would give different stages (section 3, "Out of date"). |
| `sourceName(plan, id, source)` | a source's name (section 3), e.g. `"Cond 1"`, `"Drug A +2"` or `"Deep A1"`. |
| `runRandomization(plan, id)` | the plan with the randomization run (section 3). Throws its first problem's message if it has any. |
| `removeRandomization(plan, id)` | the plan without the randomization and its stages. Throws if there's no such randomization, or its stages are all the plan's stages. |
| `canRemoveRandomization(plan, id)` | `true` unless its stages are all the plan's stages. |
| `setRandomizations(plan, randomizations)` | the plan with its randomizations replaced by `randomizations`, each in the form of section 3, `stages` included, for a list already in the plan's own form, such as one read from a plan file. Strict (order of checks below). Throws `Randomization 2: ` and the problem's message if not. |

`removeTipChange` and `removeStage` follow section 3's two rules for the stage after a
randomization.

**Moving and copying** (section 3, "Moving and copying")
| Function | Returns |
|---|---|
| `columnBoxes(plan)` | the column's boxes, in order: `{ kind: "tipGroup", key, tipType, probes, stages }` or `{ kind: "randomization", id, tipGroups }`. |
| `moveItems(plan, items, place)` | `{ plan, placed }`: the plan with `items` moved to `place`, as one edit; the same plan, and `placed` the items, if nothing would change. Throws as section 5 says. |
| `copyOf(plan, items)` | the copied items for `items` (plain data, JSON). Throws if `items` isn't a list of items of this plan. |
| `copyItems(plan, items, place)` | `{ plan, placed }`: the plan with copies of `items` at `place`, as one edit: `pasteItems(plan, copyOf(plan, items), place)`. |
| `pasteItems(plan, copied, place)` | `{ plan, placed }`: the plan with the copied items at `place`, each stage and randomization a new one, as one edit. Throws as section 5 says. |

**Moving wells** (section 3, "Moving wells")
| Function | Returns |
|---|---|
| `isWellUsed(plan, well)` | `true` if the plan uses `well` (`{ labware, well }`) anywhere: starting contents, a transfer, a well label, or a randomization. Throws if `well` isn't a well on the deck (`deck.checkWell`). |
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
| `addRandomization`, `placeRandomization`: `beforeId` is inside a tip group, or inside another randomization | `A randomization sits between tip groups, so it can't go before stage 3, “Drugs”.` |
| `placeRandomization`: it has stages | `This randomization has run, so it sits where its stages are.` |
| `setRandomization`: `changes` isn't an object, or gives a property it can't change | `The changes to a randomization must be an object of "sources", "fill", "seed", "volume", "settings", "tipType" and "probes", but got "stages".` (naming the first wrong property, or the value) |
| `sources` or `fill` isn't a list | `A randomization's sources must be a list, but got 5.` (or `wells to fill`) |
| a source isn't an object with exactly `labware`, `well`, `replicates` and `filler` | `Source 2 must be an object with exactly "labware", "well", "replicates" and "filler".` |
| a source or well to fill isn't a well on the deck | `Source 2: ` or `Well to fill 3: `, then `deck.checkWell`'s message |
| a well is a source twice, or to fill twice | `Deep A1 is a source twice. List each source once.` / `Plate1 B2 is a well to fill twice. List each once.` |
| a well is both a source and a well to fill | `Deep A1 is both a source and a well to fill. A well can be only one.` |
| replicates aren't a whole number of at least 1, or `null` | `Source 2's replicates must be a whole number of at least 1, or null, but got 1.5.` |
| `filler` isn't `true` or `false` | `Source 2's "filler" must be true or false, but got "yes".` |
| a filler well has replicates | `Source 3 is a filler well, so its replicates must be null, but got 4.` |
| `setRandomizations`: two entries in `stages` name filler wells of one randomization | `Randomization 2: its filler has two stages.` (An entry naming a filler well that isn't the first is accepted, as a plan between `setRandomization` and a run holds it; the filler stage's transfers may draw from any of its filler wells.) |
| `fillerShares`, `isRandomizationOutOfDate`: no such randomization | `There's no randomization "r9" in the plan.` (as for the other randomization functions) |
| seed not a whole number from 1 to 999,999, or `null` | `A randomization's seed must be a whole number from 1 to 999,999, or null, but got 0.` |
| volume not a number above 0, or `null` | `A randomization's volume must be a number of µL above 0, or null, but got 0.` |
| settings refused | the stage list's message, or the mixing rule's (section 3), unchanged |
| settings are a mix step's | `A randomization's transfers move liquid, so its settings can't be a mix step's.` |
| tip type or probes refused | `setTipType`'s or `setTipProbes`' message, unchanged |
| `runRandomization` with problems | the first problem's message (section 3) |
| `removeRandomization`: its stages are all the plan's stages | `This randomization's stages are all the plan's stages, and a plan needs at least one. Add a stage outside it first.` |
| `removeTipChange`: the tip change of a stage a randomization without stages sits before | `A randomization sits before stage 2, “Top up”, between tip groups, so these tips can't be removed.` |
| `removeTipChange`: the tip change after a randomization | `This tip change keeps stage 7, “Media”, off the randomization's tips. A randomization never shares tips.` |
| `setRandomizations`: not a list, or a randomization isn't an object with exactly its ten properties | `The randomizations must be a list, but got 5.` / `Randomization 2 must be an object with exactly "id", "beforeId", "sources", "fill", "seed", "volume", "settings", "tipType", "probes" and "stages".` |
| `setRandomizations`: an ID isn't `"r"` and a whole number of at least 1, or is repeated | `Randomization 2's ID must be "r" and a whole number, like "r1", but got "x".` / `Randomizations 1 and 3 both have the ID "r2".` |
| `setRandomizations`: `fill` not in deck order, or `probes` not smallest first | `Randomization 2: its wells to fill must be in deck order, but Plate1 B3 comes before Plate1 B2.` / `Randomization 2: its probes must be listed smallest first.` |
| `setRandomizations`: `stages` isn't a list of `{ labware, well, stage }`, names a stage not in the plan, names one stage twice, or gives one well two stages | `Randomization 2: its stages must be a list of objects with exactly "labware", "well" and "stage".` / `Randomization 2: its stage "9" isn't in the plan.` / `Stage "5" belongs to two randomizations, 1 and 2.` (or, in one, `Randomization 2: stage "5" is listed twice.`) / `Randomization 2: Deep A4 has two stages.` (A stage whose well is no longer a source is accepted: `setRandomization` leaves it until the next run, so a plan between those edits saves and opens.) |
| `setRandomizations`: its stages aren't consecutive, aren't in stage order, aren't each alone in a tip group, or one is a mix step | `Randomization 2: its stages must come one after another, in stage order.` / `Randomization 2: stage "5" must be the only stage of its tip group.` / `Randomization 2: stage "5" is a mix step.` |
| `setRandomizations`: `beforeId` isn't a place it can sit | `Randomization 2: ` and `addRandomization`'s message |

| `moveItems`, `copyOf`, `copyItems`: `items` isn't a non-empty list | `The things to move must be a list of stages, tip groups or randomizations, but got 5.` (`copy` for `copyOf` and `copyItems`) |
| an item isn't `{ kind, id }` with a known kind | `Item 2 must be { kind, id }, with kind "stage", "tipGroup" or "randomization", but got "box".` |
| an item's stage isn't in the plan | `There's no stage "9" in the plan.` |
| a `tipGroup` item's ID isn't the first stage of an ordinary tip group | `Stage "3" doesn't start a tip group, so it can't name one.` |
| an item's randomization isn't in the plan | `There's no randomization "r9" in the plan.` (as above) |
| a place isn't one of the two forms, or its index is outside the column | `The place must be between boxes (index 0 to 4) or inside a tip group, but got {"kind":"between","index":9}.` (the column's real largest index; the place as JSON) |
| `inTipGroup`'s position is outside its tip group | `Box 2 has positions 0 to 3, but got 7.` |
| `inTipGroup` names a randomization's box | `Box 3 is a randomization: nothing can be put inside it.` |
| a tip group or randomization put inside a tip group | `A tip group or randomization can't go inside another tip group: put it between tip groups.` |
| `moveItems`: a randomization's stage without its randomization | `Stage 5, “Drug A”, belongs to a randomization, which moves its stages with it: move the whole randomization, or copy the stage.` |
| `pasteItems`: not copied items (not an object, wrong `format`, `items` not a non-empty list) | `Can't paste: this isn't stages, tip groups or randomizations copied from the transfer designer.` |
| `pasteItems`: a newer version | `Can't paste: these were copied by a newer version of the tools (version 3).` |
| `pasteItems`: an entry isn't in its form | `Can't paste: item 2 isn't a stage, tip group or randomization as the transfer designer copies them.` |
| `pasteItems`: a value refused by the edit that would make it | `Can't paste: item 2: ` and that edit's message, e.g. `Can't paste: item 2: "Z99" isn't a well on Plate1. Its wells are A1 to H12.` (Messages pass through unchanged, so the operation list's stage rule names the new stage's ID and an operation number, which the user never sees; roadmap, "Technical debt", "Some messages use internal terms".) |
| `pasteItems`: two stages for one well, or a stage that's a mix step, in a randomization | `Can't paste: item 2: Deep A1 has two stages.` / `Can't paste: item 2: its stage for Deep A1 is a mix step.` |
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
- `addTipChange`: in the table's order.
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
- `setLabel`: the labware, then the label is text, then (after trimming) no other labware has it.
- `setWellLabel`: the well (`deck.checkWell`'s order), then the label is text.
- `setRandomization`: the randomization, then `changes`' form, then in this order whichever are
  given: `sources` (the list, then each source's form, well, replicates and filler in turn, then
  repeats, then each filler well's replicates, in order), `fill` (the list, then each well, then
  repeats), a well in both (on the result), `seed`, `volume`, `settings` (the stage list, the mixing
  rule, then not a mix step's), `tipType`, `probes`.
- `addRandomization`, `placeRandomization`: the randomization (for `placeRandomization`), whether
  it has stages, `beforeId` a stage, then a place it can sit; then `seed`, then `volume`.
- `setRandomizations`: the list; then each randomization in turn: its form (exactly its
  properties), its ID, the checks of `setRandomization` on its values, `fill`'s order and
  `probes`' order, then `stages` (form, each stage in the plan, not twice, no well twice,
  consecutive and in stage order, each alone in its tip group, not a mix step); then IDs repeated,
  then stages owned by two randomizations; then, against the whole new list, each `beforeId` (a
  place it can sit, so never inside another randomization's stages).
- `setWellLabels`: that `labels` is an object; then each labware in turn, in the order it holds
  them: on the deck, its wells an object, not empty, then each of its wells in turn: on the grid,
  then its label is text, not blank, without spaces at its ends.
- `moveItems`, `copyOf`, `copyItems`: the list, then each item in turn (its form, then that it's
  in the plan, then for a tip group that its ID starts one); then the place's form and range, then
  a randomization's box, then the container rule; then, for `moveItems`, a randomization's stage
  without its randomization.
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
  its tip group, with `settings`, `tipType` and `probes`; 8, 8 and 4 transfers of `volume` from
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
- **Copying:** `copyOf` writes version 2; a run randomization with three filler wells, copied and
  pasted (`copyItems`), gives a randomization with the same filler wells, one filler stage and its
  transfers from each; a version 1 copy pastes as before; version 3 is refused as newer.
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
  the same stages, different wells (for two chosen seeds). With new settings, tips or volume: the
  same wells, the new settings on every stage and tip change.
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
