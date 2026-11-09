# possible-contamination — specification

> **Draft (2026-11-08).** Written for v0.2.0 (item 27), from a preview Andy shaped on 2026-11-08
> (roadmap, item 27; ADR 0021). Written in the hands-off workflow (CLAUDE.md, "Workflows"), so
> the choices made for Andy are listed in its pull request (#146). Still to review: the whole
> specification, by Andy's test of the build.

## 1. Purpose
`possible-contamination.js` works out a plan's **possible traces** (`docs/glossary.md`, "Possible
trace") at a point in the run: for each well, the components a tip could have carried into it
although the plan doesn't put them there.

It follows **tips, not liquid**, so it's a module of its own, beside `contents-tracking`, which
follows the liquid and which it uses for what each well holds. The rules are ADR 0021's: a tip
carries whatever it touches to every well it enters afterwards, until the next tip change, in
either direction (a used tip can contaminate the source it draws from), and the module assumes the
worst wherever the order isn't known.

It's shared, as `tip-groups` is, because it reads a plan as the transfer designer holds it and
isn't about any one page; the transfer designer is its first user.

## 2. Scope
Version 1 works out each well's possible traces at the end of any stage, or at the start.

Not in version 1:
- **Which wells could have reached a well.** Tried in the preview as outlines on the deck and
  dropped (Andy, 2026-11-08): it can't tell a harmless contact from one that matters.
- **How a trace came** (its route: which stage brought it, where the tip picked it up). Tried in the
  preview and dropped for now (Andy, 2026-11-08): too much text in a big experiment.
- **Components that never count**, such as water. Every component counts for now (Andy,
  2026-11-08).
- **How much** of a trace could have arrived. A possible trace is a yes or no; nothing here is
  measured.
- **A point part-way through a stage.** Within a stage the Biomek chooses the order and which probe
  does which transfer (B56358AF, 22-25), so only a stage's end is a point.
- **Checking the plan.** The plan is made only through the transfer designer's checks, so it isn't
  checked again here (as in `tip-groups`).

## 3. The rules
The module goes through the stages that have transfers, in run order (`operationList`'s
`groupByStage()`), up to the point asked for. It keeps, for each well, the components that could
have reached it so far (**what has reached it**), and, for the tips of the current tip group, the
components they could be carrying (**what the tips carry**). Both start empty.

For each stage:
1. **New tips.** If the stage's tip group (`tipGroups`, `tip-groups.md`) differs from the previous
   stage-with-transfers' tip group, or it's the first, the tips carry nothing.
2. **The stage's wells.** Every source and destination of the stage's transfers is **touched**.
   Which of them **pass traces on** to the tips:
   - every source (a tip draws from inside its liquid);
   - every destination, unless the stage's dispense doesn't touch the liquid: its
     `destinationTechnique` is the `technique` of a destination pipetting mode whose
     `touchesLiquid` is `false` (section 7). A technique that isn't any mode's (for example after
     `config/` changes) counts as touching, so the module errs towards showing a trace.
3. **What a well passes on:** every component it holds at the stage's start or at its end
   (`contents-tracking`'s snapshots at those two points), plus what has reached it by the stage's
   start. Both ends count because the order within the stage isn't known. A well that holds
   nothing and has nothing reaching it passes nothing on.
4. **The tips** then carry what they carried, plus what every well passing traces on passes on.
5. **Every touched well**, whether or not it passes traces on (a non-contact destination still
   receives what comes out of the tip with the liquid), has everything the tips now carry added to
   what has reached it.

**A well's possible traces** at the point are what has reached it, less the components it holds
there (`contents-tracking`'s snapshot at the point), in the plan's component order.

What follows from the rules (each is a test, section 6):
- Within one stage, any well can reach any other, in either direction.
- Across stages of one tip group, earlier stages reach later ones, never the reverse.
- A contaminated well passes its traces on to whatever touches it later, in any tip group: new tips
  don't help when a source already carries a trace.
- A component reaches a well only if some well held it, or carried it, when a tip touched that
  well: a reservoir that gets yeast after the last tip touched it passes no yeast on.

## 4. Interface
The module exports one function. It changes nothing.

| Export | Takes | Returns |
|---|---|---|
| `possibleTraces(plan, operationCount)` | a plan, and how many operations have run: 0 (the start) or the number done at the end of a stage with transfers | a `PossibleTraces` (below) for that point |

`plan` is read for `components` (their order), `startingContents`, `operationList`, `stageList`
(each stage's `settings.destinationTechnique`), `stageOrder` and `tipChanges` (through
`tipGroups`). The page gets `operationCount` the way it gets the deck's (`transfer-designer-page.md`,
section 11), so it's always a stage's end or 0.

**`PossibleTraces`** has one method:

| Method | Returns |
|---|---|
| `tracesOf(labware, well)` | the well's possible traces, component names in the plan's component order, e.g. `["Yeast"]`; `[]` for a well with none, including one no transfer touched. A new list each time. |

Example:

```js
const traces = possibleTraces(plan, 6);   // after the stage ending with operation 6
traces.tracesOf("Deep1", "A3");             // ["Yeast"]
traces.tracesOf("Deep1", "A1");             // []
```

Speed: in the preview, a plan of 1,000 transfers in 50 stages took about 70 ms in Node, replaying
the contents once per stage end. That's fast enough for the page to work it out when a contents card
first needs it (`transfer-designer-page.md`, section 6), so the module needn't do better in version
1.

## 5. Errors
`possibleTraces` checks `operationCount`; `tracesOf` checks its arguments, as `contents-tracking`'s
methods do. Messages:

| When | Message |
|---|---|
| `operationCount` isn't a whole number, or is out of range | as `contents-tracking`'s `replay` (`contents-tracking.md`, section 5, "Operation list and operation count"), e.g. `The operation count must be from 0 to 12, the number of operations in the list, but got 13.` The check may be left to `replay` itself, as long as it happens before anything else. |
| `operationCount` falls part-way through a stage | `Possible traces are worked out only at the start or at a stage's end, since the order within a stage isn't known, but 5 operations is part-way through stage 2, “Yeast”. Use 4 or 6.` The stage is named by its place in the stage order (from 1) and its name, as the transfer designer's messages name stages; the module builds the text from the plan itself (a shared module doesn't import a tool's). The two counts are those at the stage's start and end. |
| `labware` or `well` isn't text, blank, or has spaces at its ends | as `contents-tracking`'s methods that take a labware and a well (`contents-tracking.md`, section 5), naming `tracesOf`, e.g. `The labware given to tracesOf is blank. Give it at least one character that isn't a space.` |

## 6. Test cases
Each becomes at least one unit test in `possible-contamination.test.js`, inside
`describe("possible-contamination", …)`. The tests build plans with the transfer designer's own
functions (`emptyPlan`, `addComponent`, `addToWells`, `addTransfer`, `addStage`,
`addStageWithNewTips`, `changeStageSettings`, `modeSettings`), so they're plans the designer could
make. Pipetting modes are found from `PIPETTING_MODES` by `touchesLiquid`, not by name (CLAUDE.md,
"Tests follow `config/`").

The example plan (used by several tests): Res1 1 holds Water, 2 Yeast, 3 Hy-Soy, 4 NaOH. Stage 1,
"Water": Water to Deep1 A1 to A4. New tips; stage 2, "Yeast": Yeast to A2 and A4. Same tips; stage
3, "Hy-Soy": Hy-Soy to A3 and A4. New tips; stage 4, "NaOH", destinations with a mode that doesn't
touch the liquid: NaOH to A1 to A4. New tips; stage 5, "More Hy-Soy": Hy-Soy (Res1 3) to A5.

- At 0 (the start), every well's traces are `[]`.
- **Earlier stages of a tip group reach later ones:** after stage 3, A3 has `["Yeast"]`; after
  stage 2, it has `[]`.
- **Not the reverse:** after stage 3, A2 has no Hy-Soy (stage 3's wells don't reach stage 2's).
- **New tips start clean:** after stage 4, A1 has `[]` (stage 4's tips are new, and its
  destinations don't pass anything on).
- **A non-contact destination still receives:** in a plan like the example's but with stage 4 on
  the same tips as stage 3, A1 has `Yeast` and `Hy-Soy` after stage 4.
- **A non-contact destination doesn't pass on:** one stage, on new tips, takes Water from one
  source into two destinations, one starting with Yeast and the other with Hy-Soy. With a
  non-touching mode at the destinations, the Hy-Soy well has no Yeast, the Yeast well no Hy-Soy, and
  the source neither. With a touching mode, each destination has the other's component, and the
  source has both.
- **A contaminated source carries it on, even with new tips:** after stage 5, A5 has `Water` and
  `Yeast` (Res1 3 received them from stage 3's used tips), in the plan's component order.
- **Within a stage, both directions:** two sources and two contact destinations in one stage, each
  source with a different component; each destination has the other source's component, and each
  source has the other's.
- **What a well held at the time:** a reservoir that gets yeast (by a transfer, on new tips) only
  after the last stage whose tips touched it passes no yeast to the wells those tips reached.
- **Held components aren't traces:** A4 holds Yeast and Hy-Soy, so neither is among its traces.
- **A technique that isn't any mode's counts as touching:** a stage whose `destinationTechnique` is
  set (through the stage list) to a name no mode uses passes its destinations' contents on.
- **Stages without transfers** don't change anything, and don't end a tip group early.
- **Mix steps:** a mix step's well (a transfer from the well into itself) passes on and receives.
- Errors: each row of section 5, including a count part-way through a stage, naming the counts
  before and after it; and `tracesOf` with blank and non-text arguments.
- `tracesOf` returns a new list each time: changing it doesn't change the next result.

## 7. Configuration
`config/pipetting-modes.js` (`transfer-designer.md`, "Configuration") gains one property per mode,
**`touchesLiquid`**: `true` if pipetting in this mode touches the liquid in the well, `false` if not.
The lab's modes: Slow, Medium and Fast `true`; Non-Contact `false`. A mode usable at the source must
have `true` (a tip draws from inside the liquid). Non-Contact's `false` is what its name and
technique say; whether a technique's dispense touches the liquid isn't verified on the instrument
yet (`docs/domain/biomek.md`, "Not yet known"), and the config file's comment says so.

The tests of `transfer-designer.js`'s configuration check the new property (`transfer-designer.md`,
"Configuration").
