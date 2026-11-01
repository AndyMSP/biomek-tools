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
- `deck`: the labware on the deck, their grids, and which wells exist.

Beside it in this tool are two other logic modules, `plan-history` (undo and redo of plans) and
`plan-file` (saving and opening plans; ADR 0010), and the page (`transfer-designer-page.md`).

## 2. Scope
Version 1 creates an empty plan; adds, removes and changes stages, transfers, tip changes,
components, starting contents, labware labels, well labels and the experiment name; and answers questions about a plan: its stage
order, its tip groups, the stages with a contents problem or a mix problem, where each stage ends, and
the labware it uses.

Not in version 1 (see `docs/roadmap.md`):
- **Moving** a stage, or a transfer within its stage. A transfer can be removed and added again.
- **Final concentrations**, smarter
  staging (the tool forming stages itself).
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
  components:       [{ name: "Media", color: "#4e79a7" }, …],
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
  offered is up to the tool). No two components share a name, or a color, so they can always be
  told apart where colors are drawn. A component may be in the list without being in any well yet.
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
  were added (so several sitting at one place are in that order). The file writer never reads them: their stages are ordinary stages to it.
- **`experimentName`**: the experiment's name (`docs/glossary.md`, "Experiment name"), or `""`
  until the user gives one (Andy, 2026-10-28). A name follows the file writer's rule,
  `checkExperimentName` (`file-writer.md`): letters, digits, hyphens and underscores, 1 to 40
  characters. It's part of the plan, so renaming is an edit like any other: undone and redone, kept
  in the browser copy, and saved in the plan file (`plan-file.md`).

### Stage order
The **stage order** is the order of all the plan's stages, with or without transfers: the order a
tool shows them in, and the order they will run in. The plan keeps it as its own list,
`stageOrder`, the one source of truth for it (ADR 0011). It changes only when a stage is added
(its ID is inserted) or removed (its ID is taken out). Adding or removing transfers never changes
it.

**The operation list follows it.** Its blocks, one per stage with transfers (ADR 0008), are always
in the same order as those stages in `stageOrder`: a stage's first transfer is placed to keep it so
(section 3, "Transfers"). So the **run order** of ADR 0008, the stages with transfers in the
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
  at least 1, or `null` (not given yet). At most one source is the **filler** (`filler: true`): it
  fills the wells the replicates leave over, and its `replicates` is always `null`. Any well may be
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
   place in `sources`, with its replicates; the filler's key, or `null`; the wells to fill, keyed
   `"well 1"`, `"well 2"` … by their place in `fill`; the seed. `assignPool` gives each well to
   fill its source.
2. **The place**: the stage just after its last owned stage, or, with none, `beforeId` (`null`:
   last). Noted before anything changes.
3. **New stages first**: each source that gets wells but has no stage in `stages` (the filler may
   get none, on an exact fit: then it gets no stage; Andy, to confirm) gets one, added with
   `addStageWithNewTips` (section 3, "Tip changes and tip groups") before the place, in `sources`'
   order, **named** as its source is (below). So every new stage has new tips, and the stage after
   keeps the tips it had.
4. **Then old stages go**: each stage in `stages` whose source is no longer in `sources`, or now
   gets no wells, is removed (`removeStage`). (New stages come first, so a run never tries to
   remove a plan's only stage.)
5. **Each source's stage**: its transfers replaced by one transfer of `volume` from the source to
   each of its wells, in `fill`'s order; its settings set to `settings` (as `changeStageSettings`);
   its tip change set to `tipType` and `probes` (its own, or `START`'s if it's the run's first
   stage). Its name is kept.
6. `stages` lists them in stage order, and `beforeId` is set (above).

With the same sources, replicates, filler, wells to fill and seed, a run gives every well the same
source as before, so running again only applies changed settings, tips or volume; a new seed
shuffles again (Andy, 2026-11-01).

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

**Removing** (`removeRandomization`) takes out the randomization and every stage it owns, as one
edit (Andy, 2026-11-01). Tip changes its runs added elsewhere (on the stage after it) stay: the
tool never takes tips away or joins tip groups by itself.

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

`renameComponent`, `setComponentColor` and `removeComponent` throw first if there's no component
with that name.

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
| `sourceName(plan, id, source)` | a source's name (section 3), e.g. `"Cond 1"`, `"Drug A +2"` or `"Deep A1"`. |
| `runRandomization(plan, id)` | the plan with the randomization run (section 3). Throws its first problem's message if it has any. |
| `removeRandomization(plan, id)` | the plan without the randomization and its stages. Throws if there's no such randomization, or its stages are all the plan's stages. |
| `canRemoveRandomization(plan, id)` | `true` unless its stages are all the plan's stages. |
| `setRandomizations(plan, randomizations)` | the plan with its randomizations replaced by `randomizations`, each in the form of section 3, `stages` included, for a list already in the plan's own form, such as one read from a plan file. Strict (order of checks below). Throws `Randomization 2: ` and the problem's message if not. |

`removeTipChange` and `removeStage` follow section 3's two rules for the stage after a
randomization.

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
| two fillers | `Sources 1 and 3 are both the filler. Only one source can be.` |
| the filler has replicates | `Source 3 is the filler, so its replicates must be null, but got 4.` |
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
| `setRandomizations`: `stages` isn't a list of `{ labware, well, stage }`, names a stage not in the plan, names one stage twice, or a well that isn't one of its sources | `Randomization 2: its stages must be a list of objects with exactly "labware", "well" and "stage".` / `Randomization 2: its stage "9" isn't in the plan.` / `Stage "5" belongs to two randomizations, 1 and 2.` (or, in one, `Randomization 2: stage "5" is listed twice.`) / `Randomization 2: Deep A4 has a stage but isn't one of its sources.` |
| `setRandomizations`: its stages aren't consecutive, aren't in stage order, aren't each alone in a tip group, or one is a mix step | `Randomization 2: its stages must come one after another, in stage order.` / `Randomization 2: stage "5" must be the only stage of its tip group.` / `Randomization 2: stage "5" is a mix step.` |
| `setRandomizations`: `beforeId` isn't a place it can sit | `Randomization 2: ` and `addRandomization`'s message |

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
- `setLabel`: the labware, then the label is text, then (after trimming) no other labware has it.
- `setWellLabel`: the well (`deck.checkWell`'s order), then the label is text.
- `setRandomization`: the randomization, then `changes`' form, then in this order whichever are
  given: `sources` (the list, then each source's form, well, replicates and filler in turn, then
  repeats, then two fillers, then the filler's replicates), `fill` (the list, then each well, then
  repeats), a well in both (on the result), `seed`, `volume`, `settings` (the stage list, the mixing
  rule, then not a mix step's), `tipType`, `probes`.
- `addRandomization`, `placeRandomization`: the randomization (for `placeRandomization`), whether
  it has stages, `beforeId` a stage, then a place it can sit; then `seed`, then `volume`.
- `setRandomizations`: the list; then each randomization in turn: its form (exactly its
  properties), its ID, the checks of `setRandomization` on its values, `fill`'s order and
  `probes`' order, `beforeId`, then `stages` (form, each stage in the plan, not twice, its well a
  source, consecutive and in stage order, each alone in its tip group, not a mix step); then IDs
  repeated, then stages owned by two randomizations.
- `setWellLabels`: that `labels` is an object; then each labware in turn, in the order it holds
  them: on the deck, its wells an object, not empty, then each of its wells in turn: on the grid,
  then its label is text, not blank, without spaces at its ends.
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

**Components and starting contents**
- `addComponent` refuses a used name or color, and a blank name; it trims the name.
- `renameComponent` renames in every well, keeping each well's components in order; to a used name
  it throws; to its own name (also with spaces at the ends) it returns the plan unchanged.
- `removeComponent` empties wells left with nothing.
- `addToWells` adds on top: 500 then 1000 µL gives 1500 µL; other components stay; 0, −5 and
  `"10"` throw; a component not in the plan throws; a well listed twice gets the volume once.
- `emptyWells` empties only those wells; the components stay; an empty well is left as it is.

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
- `setRandomization` sets sources and wells; `fill` given in any order comes back in deck order;
  every row of section 5 it can give, with its message, leaving the plan unchanged; unchanged
  values give back the same plan; `stages` and `beforeId` never change.
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
- Every function leaves the plan given unchanged; in the table of which parts each edit may change,
  `addRandomization`, `setRandomization` and `placeRandomization` change only `randomizations`;
  `runRandomization` and `removeRandomization` change `randomizations`, `stageList`, `stageOrder`,
  `operationList` and `tipChanges`; `removeStage` may change `randomizations` too. The plan that
  table's edits run on holds a randomization that has run.
- `emptyPlan()`'s `randomizations` is `[]`.

**The REPL** (`scripts/repl.js`): the randomization functions in the transfer designer's topic, with
an example that adds, sets up and runs one; and a topic of its own for `random-pool`.

**Immutability and sharing**
- Every edit leaves the plan it was given unchanged.
- After any edit, parts it didn't change are the very same objects in the new plan.
- In the table of which parts of the plan each edit may change, `setWellLabel` and `setWellLabels`
  change only `wellLabels`; no other edit changes it. The plan that table's edits run on holds well
  labels, so the check means something.

**The REPL** (`scripts/repl.js`): `wellLabelOf`, `setWellLabel` and `setWellLabels` in the transfer
designer's topic, with examples; the plan file topic's examples of older and newer versions follow
the new version (e.g. version 5 opening, version 7 refused).
