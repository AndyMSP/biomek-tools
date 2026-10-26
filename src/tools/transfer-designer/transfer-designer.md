# transfer-designer — specification

> **Draft (2026-10-26).** Written for v0.2.0, from the transfer designer preview, where these rules
> were tried with Andy (2026-10-24 to 2026-10-26). Still to review: the wording of the messages, and
> whether any rule here belongs in a shared module instead.

## 1. Purpose
`transfer-designer.js` holds the transfer designer's rules: what a **plan** (`docs/glossary.md`) is,
and every edit that can be made to one, each checked so that a plan is always valid. A tool shows a
plan and passes on what the user does; every rule about what that means lives here, so it can be
tested in Node (CLAUDE.md, "Separate logic from the UI").

It builds on the shared modules, and doesn't repeat what they do:
- `operation-list`: the transfers, in run order, by stage (ADR 0008);
- `stage-list`: each stage's ID, name and settings;
- `contents-tracking`: what every well holds at any point, and overdraws;
- `deck`: the labware on the deck, their grids, and which wells exist.

Three other modules in this tool sit beside it: `plan-history` (undo and redo of plans),
`plan-file` (saving and opening plans; ADR 0010), and the page (`transfer-designer-page.md`).

## 2. Scope
Version 1 creates an empty plan; adds, removes and changes stages, transfers, tip changes,
components, starting contents and labware labels; and answers questions about a plan: its run
order, the stages sharing each set of tips, the stages with an overdraw, where each stage ends, and
the labware it uses.

Not in version 1 (see `docs/roadmap.md`):
- **Moving** a stage, or a transfer within its stage. A transfer can be removed and added again.
- **Mixing**, final concentrations, smarter staging (the tool forming stages itself).
- **Checking techniques against tip types** (roadmap, "Technical debt").
- **Dead volume** (roadmap, "Technical debt").
- **Which transfer runs short when a stage draws from an overdrawn well more than once** (roadmap,
  "Technical debt"): within a stage the Biomek chooses the order (B56358AF, 22-25), but contents
  tracking replays the planned order, so the wells it marks are one possible outcome. The stage
  with the overdraw is known for certain.

## 3. Data model

### The plan
A plan is a plain object, **never changed after it's made**: every edit returns a new plan and
leaves the old one as it was, so undo can keep old plans (`plan-history.md`). A new plan shares every
part the edit didn't change with the plan it came from, and the operation list shares unchanged
transfers (`operation-list.md`, "Unchanged operations are shared"), so keeping many plans costs
little. So every edit here changes only what it must: for example, changing a transfer's volume uses
the operation list's `replace`, never a rebuilt list.

```js
{
  components:       [{ name: "Media", color: "#4e79a7" }, …],
  startingContents: [{ labware: "Res", well: "1", components: { Media: 12000 } }, …],
  operationList:    /* an OperationList */,
  stageList:        /* a StageList */,
  plannedBefore:    { "3": "2" },
  tipChanges:       { start: { tipType: "BC1070" }, "2": { tipType: "BC230" } },
  labwareLabels:    { Plate: "Assay plate" },
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
- **`stageList`**: the stages, with their five settings (`stage-list.md`).
- **`plannedBefore`**: where each stage **without transfers** runs, which the operation list can't
  say, since its order comes from transfers (ADR 0008): the ID of the stage it runs just before, or
  `null` to run last. A stage's entry is removed once it has transfers.
- **`tipChanges`**: the plan's tip changes (`docs/glossary.md`, "Tip change"), each `{ tipType }`,
  by where they happen: **`START`** (the text `"start"`), before the first stage, always there; or a
  stage's ID, just before that stage. There is never one keyed by the first stage to run: that
  stage's tips are the `START` ones.
- **`labwareLabels`**: the label the user gave each labware (`docs/glossary.md`, "Labware label"),
  by the labware's name in the deck description. A labware without one is labelled by that name.

### Run order
The **run order** is the order stages run in: the stages with transfers in the operation list's
order (`groupByStage()`), with each stage without transfers placed just before the stage its
`plannedBefore` names (or last, for `null`, or if that stage is gone). Stages in `stageList` that
can't be placed this way go last, in the order they were added.

### Stages
- A new stage is called **`NEW_STAGE_NAME`**, `"New stage"` (Andy, 2026-10-25: a number in the name
  stopped matching the stage's place once one was inserted). Stage names needn't be unique
  (`stage-list.md`).
- A new stage's settings are copied from the stage that will run just before it, or, with none
  before it, from the first one in the run order; in an empty plan, the **default settings**: the
  first pipetting mode for each end (below), and all eight probes.
- A stage is added **before** a given stage (or last). With **take tips**, a tip change keyed by that
  stage moves onto the new stage, so the new stage is the first to use those tips; without it, the
  new stage uses the tips before that tip change (Andy, 2026-10-25: so a stage can be added at the
  top of a set of tips, or at the end of the set before).
- **Any stage but the last one left can be removed**, and its transfers go with it (Andy,
  2026-10-26). A tip change keyed by it goes too; stages planned to run before it now run before the
  stage that followed it.
- **A stage may mix labware types.** The file writer splits it into substages (ADR 0007, amended
  2026-10-26), so nothing here refuses it.
- How many probes a stage uses is chosen as a number: the stage gets the first that many probes
  (`probesFor(4)` → `[1, 2, 3, 4]`; Andy, 2026-10-24: choosing which probes would be too much).

### Pipetting modes
A stage's techniques and liquid types are chosen as **pipetting modes** (`docs/glossary.md`), listed
in `config/pipetting-modes.js` (below). A mode at one end sets that end's technique and liquid type
together. Reading back, a stage's technique and liquid type at an end give its mode, or none if they
aren't one of the modes (for example, after the modes in `config/` change).

### Transfers
- A transfer is added to a stage. If that stage already has transfers, it goes after them (the
  operation list's `add`). If it's the stage's first, it goes just before the next stage in the run
  order that has transfers (`insertBeforeStage`), or last if none does, so the stage runs where it
  was planned.
- Several transfers can be added as **one edit** (for example, one source into each of many
  wells): all are added, or, if any can't be, none.
- A transfer's volume can be changed in place, keeping its position and stage (`replace`).
- Positions are positions in the operation list, counting from 0, as in `listOperations()`.

### Tip changes and sets of tips
- The run starts with the `START` tip change, which can't be removed. Another can be added just
  before any stage except the first in the run order, at most one per place. It loads the tip type
  already in use there, until changed. Removing one leaves the stages after it on the tips before it.
- A **set of tips** is a tip change and the stages that use its tips, in run order: from it to the
  next tip change. Tips go on as many probes as the most any of those stages uses (ADR 0007,
  "Tips are loaded by looking ahead").
- After stages are added or removed, a tip change keyed by the stage that's now first to run
  becomes the `START` one (its tip type replaces the `START` one's), so there's never one before
  the first stage but `START`.

### Components and starting contents
- Components are added by name and color, renamed, recolored and removed. Renaming changes the name
  in every well too; removing takes the component out of every well (a well left empty is no
  longer listed).
- **Adding to wells adds**: a volume of a component added to wells goes on top of what each holds,
  like pipetting it in (Andy, 2026-10-25): 500 µL of Media plus 1000 µL of Media is 1500 µL; other
  components stay. The volume must be a number above 0.
- Emptying wells removes everything they hold at the start. The components stay in the list.

### Overdraws
`contents-tracking` reports each transfer that asks a well for more than it holds. A stage **has an
overdraw** if any of its transfers is one (but see "Not in version 1").

### Labware
- The labware a plan **uses** are those in its starting contents or in any transfer, in the deck's
  order.
- A labware's label is set as text; spaces at the ends are removed, and a blank label, or one equal
  to the labware's name, goes back to the name.

### Configuration
Two files in `config/` (ADR 0009), which this module's tests check:
- **`config/pipetting-modes.js`** exports `PIPETTING_MODES`: a list of
  `{ name, technique, liquidType, ends }`, e.g.
  `{ name: "Slow", technique: "StandIn_Slow", liquidType: "Cells", ends: ["source", "destination"] }`.
  `name`, `technique` and `liquidType` are names; `liquidType` also follows Biomek's rule for liquid
  type names (letters, digits and underscores, starting with a letter; B56358AF, 9-4); `ends` is a
  non-empty list of `"source"` and `"destination"`, each at most once. No two modes share a name,
  and each end has at least one mode. It replaces `config/techniques.js` and
  `config/liquid-types.js`, which are removed (Andy, 2026-10-26: each name is then written once).
  The names are stand-ins until checked in Biomek Software (roadmap, "Technical debt").
- **`config/tip-types.js`** exports `TIP_TYPES`: a non-empty list of tip type names, e.g.
  `["BC230", "BC1070"]`, each a name, none repeated.

## 4. Interface
Every function takes plain values and returns plain values; none changes the plan it's given.
"Returns the plan with …" means a new plan.

**Plans**
| Function | Returns |
|---|---|
| `emptyPlan()` | `{ plan, stageId }`: a plan with no components, starting contents, transfers or labels, one stage (`NEW_STAGE_NAME`, default settings), and `START` tips of the first tip type; and that stage's ID. |
| `defaultSettings()` | a stage's default settings (section 3, "Stages"). |
| `probesFor(count)` | the first `count` probes, e.g. `4` → `[1, 2, 3, 4]`. Throws unless `count` is a whole number from 1 to 8. |

**Pipetting modes**
| Function | Returns |
|---|---|
| `modesFor(end)` | the pipetting modes usable at `end` (`"source"` or `"destination"`), in `config/` order. |
| `modeSettings(end, name)` | the settings for that mode at that end, e.g. `("source", "Slow")` → `{ sourceTechnique: "StandIn_Slow", sourceLiquidType: "Cells" }`. Throws if there's no such mode for that end. |
| `modeOf(end, settings)` | the name of the mode that a stage's `settings` use at `end`, or `null` if none matches. |

**Stages**
| Function | Returns |
|---|---|
| `NEW_STAGE_NAME` | (a constant) `"New stage"`. |
| `runOrder(plan)` | the stage IDs in run order. |
| `addStage(plan, beforeId, { takeTips })` | `{ plan, id }`: the plan with a new stage before stage `beforeId` (or last, for `null`), and its ID. `takeTips` defaults to `false`. Throws if `beforeId` isn't a stage or `null`. |
| `renameStage(plan, id, name)` | the plan with stage `id` named `name` (the stage list checks it). |
| `changeStageSettings(plan, id, settings)` | the plan with stage `id`'s settings replaced (the stage list checks them). |
| `canRemoveStage(plan, id)` | `true` if `id` is a stage and not the only one. |
| `removeStage(plan, id)` | the plan without stage `id`, its transfers or a tip change keyed by it. Throws if `canRemoveStage` is `false`. |
| `stageEnds(plan)` | for each stage with transfers, in run order, `{ stage, transfersDone }`: how many transfers have run when it ends, e.g. `[{ stage: "1", transfersDone: 4 }, { stage: "2", transfersDone: 8 }]`. |
| `stagesWithOverdraw(plan)` | a `Set` of the IDs of stages with an overdraw. |

**Transfers**
| Function | Returns |
|---|---|
| `addTransfer(plan, transfer)` | the plan with `transfer` added to its stage (section 3, "Transfers"). Throws if a well isn't on the deck, the stage isn't in the plan, or the operation list refuses it (its message). |
| `addTransfers(plan, transfers)` | the plan with each of `transfers` added in turn, as one edit. Throws, adding none, if any can't be added. |
| `changeVolume(plan, position, volume)` | the plan with the transfer at `position` given `volume` (the operation list checks it). |
| `removeTransfer(plan, position)` | the plan without the transfer at `position`. |
| `transfersIn(plan, id)` | stage `id`'s transfers, in order. |

**Tip changes**
| Function | Returns |
|---|---|
| `START` | (a constant) `"start"`. |
| `tipChangeAt(plan, key)` | the tip change at `key` (`START` or a stage ID), or `null`. |
| `canAddTipChange(plan, beforeId)` | `true` if a tip change can be added just before stage `beforeId`. |
| `addTipChange(plan, beforeId)` | the plan with a tip change before stage `beforeId`, loading the tip type in use there. Throws if `canAddTipChange` is `false`. |
| `setTipType(plan, key, tipType)` | the plan with the tip change at `key` loading `tipType`. Throws if there's none at `key`, or `tipType` isn't in `TIP_TYPES`. |
| `removeTipChange(plan, key)` | the plan without the tip change at `key`. Throws for `START`, or if there's none at `key`. |
| `tipGroups(plan)` | the sets of tips, in run order: `{ key, tipType, stages, probes }` each, `stages` being stage IDs in run order and `probes` the probes that get tips. |

**Components and starting contents**
| Function | Returns |
|---|---|
| `addComponent(plan, name, color)` | the plan with a new component last. Throws if the name isn't a name or is used, or the color isn't text or is used. Spaces at the ends of the name are removed. |
| `renameComponent(plan, oldName, newName)` | the plan with the component renamed, in the list and in every well. Throws as for a new name. |
| `setComponentColor(plan, name, color)` | the plan with the component drawn in `color`. Throws if another component has it. |
| `removeComponent(plan, name)` | the plan without the component, in the list or in any well. |
| `countWellsWith(plan, name)` | how many wells hold the component at the start. |
| `addToWells(plan, wells, name, volume)` | the plan with `volume` µL of the component added to each of `wells` (wells on the deck, `deck.checkWell`). Throws if the component isn't in the plan, a well isn't on the deck, or the volume isn't above 0. |
| `emptyWells(plan, wells)` | the plan with `wells` empty at the start. |

`renameComponent`, `setComponentColor` and `removeComponent` throw if there's no component with
that name.

**Labware**
| Function | Returns |
|---|---|
| `labwareUsed(plan)` | the names of the labware the plan uses, in the deck's order. |
| `labelOf(plan, name)` | the labware's label, or its name if it has none. |
| `setLabel(plan, name, label)` | the plan with the labware labelled `label` (section 3). Throws if the labware isn't on the deck. |

## 5. Errors
Each message says what's wrong and how to fix it, in the plan's own terms. A failed edit changes
nothing: the plan given is never touched. Messages from the shared modules (`operation-list`,
`stage-list`, `deck`, `input-checks`) pass through unchanged.

| Problem | Message |
|---|---|
| `probesFor`: not a whole number from 1 to 8 | `The number of probes must be a whole number from 1 to 8, but got 9.` |
| `modeSettings`: no such mode for that end | `"Non-Contact" isn't a pipetting mode for the source. The modes for the source are Fast, Medium and Slow.` |
| `addStage`: `beforeId` isn't a stage or `null` | `There's no stage "9" to add a stage before.` |
| `removeStage`: the only stage | `A plan needs at least one stage, so its only stage can't be removed.` |
| A transfer's stage isn't in the plan | `There's no stage "9" in the plan to add this transfer to.` |
| `addTipChange`: there's one there already, or it's before the first stage | `There are already new tips before stage "2".` / `The first stage always starts with new tips, so there can't be another tip change before it.` |
| `setTipType`, `removeTipChange`: none at `key` | `There are no new tips before stage "2".` |
| `setTipType`: not a known tip type | `"BC50" isn't a tip type. Choose one of BC230 and BC1070.` |
| `removeTipChange`: `START` | `The run always starts by loading tips, so the first tips can't be removed.` |
| A component name isn't a name | `checkName`'s messages, naming `component name`. |
| A component name is used | `There's already a component called "Media". Choose a different name.` |
| A color isn't text, or is blank | `A component's color must be text, like "#4e79a7", but got null.` |
| A color is used by another component | `Drug_A already has that color. Choose a different one.` |
| No component with that name | `There's no component called "Dye" in this plan. Add it to the plan's components first.` |
| `addToWells`: volume not a number above 0 | `The volume to add must be a number of microliters above 0, like 100, but got 0.` |
| `setLabel`: labware not on the deck | `deck`'s message. |

The first problem found is reported, in the order the table lists them for each function.

## 6. Test cases
Each becomes at least one unit test in `transfer-designer.test.js`, inside
`describe("transfer-designer", …)`.

**Configuration**
- `config/pipetting-modes.js`: each mode's properties are exactly `name`, `technique`,
  `liquidType`, `ends`; names valid and unique; liquid types follow Biomek's rule; `ends` valid;
  each end has at least one mode.
- `config/tip-types.js`: a non-empty list of valid names, none repeated.

**Plans and modes**
- `emptyPlan()` gives one stage named `NEW_STAGE_NAME` with default settings, `START` tips of the
  first tip type, and nothing else; its `stageId` is that stage.
- `probesFor` gives `[1]` for 1 and all eight for 8; 0, 9 and 2.5 throw.
- `modeSettings` and `modeOf` round-trip every mode at every end it allows; a mode not allowed at an
  end throws; settings matching no mode give `null`.

**Stages and run order**
- Stages with transfers run in operation-list order; a stage without transfers runs just before its
  planned stage, or last.
- `addStage` before a stage puts it there in `runOrder`; with `null`, last; it's called
  `NEW_STAGE_NAME` and copies the settings of the stage before it.
- `addStage` with `takeTips` before a stage with a tip change moves the tip change to the new stage;
  without it, the new stage joins the set of tips before.
- `addStage` before the first stage keeps the `START` tips first.
- `removeStage` removes a stage with transfers, and its transfers; stages planned before it now run
  before the stage after it; a tip change keyed by it goes; removing the only stage throws.
- `stageEnds` counts transfers cumulatively in run order.
- `stagesWithOverdraw` names the stage whose transfer draws more than a well holds, and no other.

**Transfers**
- A stage's first transfer goes before the next stage with transfers; later ones go after the
  stage's others; the stage's `plannedBefore` entry goes.
- `addTransfers` adds all, in order, as one plan; if one fails, the plan is unchanged and the error is
  the operation list's.
- A transfer to a well not on the deck, or in a stage not in the plan, throws.
- `changeVolume` changes only that transfer's volume; the other transfers are the very same objects
  as before (sharing).
- `removeTransfer` removes only that transfer.

**Tip changes**
- `tipGroups` of a plan with `START` and a tip change before its third stage gives two sets; each
  set's `probes` are the most its stages use.
- `addTipChange` takes the tip type in use; adding before the first stage, or twice in one place,
  throws.
- `setTipType` with a known type works; an unknown one throws.
- `removeTipChange` merges the two sets; for `START` it throws.

**Components and starting contents**
- `addComponent` refuses a used name or color, and a blank name; it trims the name.
- `renameComponent` renames in every well, keeping each well's components in order; to a used name
  it throws.
- `removeComponent` empties wells left with nothing.
- `addToWells` adds on top: 500 then 1000 µL gives 1500 µL; other components stay; 0, −5 and
  `"10"` throw; a component not in the plan throws.
- `emptyWells` empties only those wells; the components stay.

**Labware**
- `labwareUsed` lists starting contents' and transfers' labware in deck order.
- `setLabel` trims; a blank label, or the labware's own name, removes it; `labelOf` falls back to
  the name.

**Immutability and sharing**
- Every edit leaves the plan it was given unchanged.
- After any edit, parts it didn't change are the very same objects in the new plan.
