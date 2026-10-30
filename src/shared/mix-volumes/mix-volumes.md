# mix-volumes — specification

> **Draft (2026-10-30).** Written for v0.2.0, mixing layer (b), from ADR 0007 ("Mixing") and the
> mixing preview. Still to review: the mix volume limits are stand-ins (section 3; roadmap,
> "Technical debt"). It becomes Final once built and the files it feeds have run on the Biomek.

## 1. Purpose
`mix-volumes.js` works out how many µL each stage-worklist row mixes, at each end that mixes, and
finds the mixes that work out to nothing.

A stage stores each mix as a **share** of the well (`stage-list.md`), but each row of the stage
worklist takes one mix volume in µL for each end, and Biomek can't work out a volume per well
itself (`biomek.md`, "Mixing"). So the tool works it out from what the wells hold (ADR 0007,
"Mixing").

It's shared because more than one module needs the same answer: the file writer, to write the mix
columns and to refuse a plan with a mix that works out to nothing (`file-writer.md`), and the
transfer designer, to report those stages as problems as soon as they appear, as it does overdraws
(`transfer-designer.md`; Andy, 2026-10-30).

## 2. Scope
Version 1 works out mix volumes for transfer stages, one per row.

Not in version 1:
- **Mix steps** (`docs/glossary.md`): a stage that only mixes. They come with the page's mixing
  (roadmap, mixing layer (c)).
- **How short a mix is for each well** (a well mixed under 40% of what it holds; roadmap, mixing
  layer (c)).
- **Splitting a stage into rows by well volume**, so fuller wells mix closer to their share
  (roadmap, "Later").

## 3. Data model
**Input:** a plan, as the transfer designer holds it (`transfer-designer.md`, section 3). The module
reads its starting contents, operation list, stage list, stage order and tip changes. It doesn't
check the plan: plans are made only through the transfer designer's checks.

**Rows.** Each stage with transfers runs as one row per substage (`substages.md`), in stage order.
A stage without transfers isn't run, so it has no rows.

**What a well holds when it's mixed** (ADR 0007, "Mixing"). A stage's rows run one after another,
in order (`biomek.md`, "Order between rows is respected by validation"), but within a row Biomek
chooses the order of the transfers (B56358AF, 22-25). So the tool takes the least a well can hold
when it's mixed, whatever that order, assuming the row's draws from it come first:
- **Before the row**, a well holds what it held before the stage (contents tracking with the
  operations up to the stage's first transfer; `contents-tracking.md`, `replay`), plus what the
  stage's earlier rows dispensed into it, minus what they drew from it.
- **A source** is mixed before each draw from it. The least it holds then is what it held before the
  row, minus **everything the row draws from it**, plus its **smallest draw** in the row.
- **A destination** is mixed after each dispense into it. The least it holds then is what it held
  before the row, minus everything the row draws from it (usually nothing), plus its **smallest
  dispense** in the row.
- What a well holds is never taken below 0. Below 0 means the stage has an overdraw, which is its
  own problem and is fixed first (`contents-tracking.md`; `file-writer.md` checks overdraws before
  mix problems).

So a well that's both drawn from and dispensed into in one stage is judged by what it holds at its
own row. For example, Plate1 A1 holds 100 µL; row A draws 95 µL from it, then row B dispenses 10 µL
into it: as row A's source it holds at least 100 µL when mixed, and as row B's destination 15 µL.

A row's **emptiest well** at an end is the well that holds the least then; with a tie, the first of
them in the row's transfer order.

**A row's mix volume** at an end whose mix isn't `null`:
1. the mix's share of what the emptiest well holds then: `share / 100 × held`;
2. rounded to a whole number of thousandths of a µL (nearest), then **down** to a whole number of
   tenths, so no well mixes more than it holds: 90% of 120 µL is `108`; 75% of 120 µL is `90`, not
   `89.9`; 90% of 0.05 µL is `0`;
3. no more than the **mix volume limit** of the row's tip type (the tip type of its stage's tip
   group, `tip-groups.md`), from `config/` (below).

So every well in the row mixes the same volume, and wells that hold more mix less than their share.
An end whose mix is `null` has no mix volume.

**A mix problem** is a row whose mix volume at an end works out to `0`: its emptiest well holds
nothing, or too little, when it's mixed. We don't know what Biomek does with a 0 µL mix, so the plan
can't be written to files until it's fixed (Andy, 2026-10-30). A stage with a mix problem at either
end of any row **has a mix problem**.

### Configuration
`config/tip-types.js` (ADR 0009) also exports `MIX_VOLUME_LIMITS`: the most each tip type can mix,
in µL, as an object with one entry for each tip type in `TIP_TYPES`, e.g.
`{ BC230: 200, BC1070: 1000 }`. The file's header comment says this module's tests check
`MIX_VOLUME_LIMITS` (and the transfer designer's tests the rest). These are **stand-ins** (roadmap, "Technical debt"): about what a
BC230 tip holds in one trip, and what a 1 mL syringe holds in one draw with air gaps (`biomek.md`,
"Volumes and tips"), not checked as mix volumes on the instrument. This module's tests check the
file: each tip type has exactly one limit, a number above 0, and there are no others.

## 4. Interface
The module exports one function. It changes nothing.

| Export | Takes | Returns |
|---|---|---|
| `mixVolumes(plan)` | a plan | `{ stages, problems }`, new each time. |

- `stages`: each stage with transfers, in stage order, as `{ stage, rows }`: `stage` is its ID;
  `rows` are its substages in order (`substagesOf`), each as the substage plus `sourceMixVolume` and
  `destinationMixVolume`: the row's mix volume at that end in µL, or `null` if that end doesn't mix.
  A volume of `0` is given as `0`, and is also a problem.
- `problems`: each mix problem, in stage order, then row order, source before destination, as
  `{ stage, end, labware, well, held }`: the stage's ID; `"source"` or `"destination"`; the row's
  emptiest well at that end; and what it holds when it's mixed, in µL, rounded to 3 decimal places
  (so `0.30000000000000004` is `0.3`).

Example, a stage whose destination mix is `{ share: 90, times: 3, speed: 400 }` on BC230 tips,
dispensing 20 µL into Plate1 A1 (empty before the stage) and 100 µL into Plate1 A2 (holding 50 µL
before it):
```js
mixVolumes(plan).stages[0].rows[0].destinationMixVolume;  // 18 (90% of 20 µL, A1's least)
mixVolumes(plan).problems;                                  // []
```

## 5. Errors
None of its own. Plans come only from the transfer designer, and `MIX_VOLUME_LIMITS` is checked by
this module's tests.

## 6. Test cases
Each becomes at least one unit test in `mix-volumes.test.js`, inside `describe("mix-volumes", …)`.
The tests build plans through the transfer designer's edits (`transfer-designer.md`), so every plan
is one the page could make, and find labware by grid and labware type in `DECK`.

**Configuration**
- `MIX_VOLUME_LIMITS` has exactly one entry for each tip type in `TIP_TYPES`, each a number above 0.

**Volumes**
- A plan whose stages don't mix gives every row `null` at both ends, and no problems.
- A stage without transfers isn't listed; a stage that splits into two substages has two rows, in
  substage order.
- **Destination:** the example above gives `18`: A1 held 0 before the stage plus its one dispense of
  20 µL, the least of the two wells.
- **Smallest dispense:** a destination dispensed into twice in a row, 30 µL and 10 µL, holding 50 µL
  before the stage, holds `60` at least when mixed, so at 50% the row mixes `30`.
- **Source:** a row's only source, holding 1000 µL and drawn from three times, 100, 50 and 200 µL,
  holds 650 after the stage; its least when mixed is `700`, so at 90% on BC1070 tips the row mixes
  `630`.
- **Its own stage, not the whole plan:** a destination filled again by a later stage is judged by
  what it held before its own stage; a source drawn from by an earlier stage is judged by what it
  held after that.
- **Earlier rows count:** the example in section 3 (Plate1 A1 holding 100 µL, row A drawing 95 µL
  from it, row B dispensing 10 µL into it) gives row A's source `100` held and row B's destination
  `15` held, so at 90% row B mixes `13.5`.
- **Draws and dispenses in one row:** a well holding 50 µL that a row both draws 40 µL from and
  dispenses 30 µL into holds at least `40` as that row's destination (50 − 40 + 30).
- **Never below 0:** a stage with an overdraw from a source gives that source `0` held, and a mix
  problem, besides its overdraw.
- **Rounding:** 75% of 120 µL gives `90`; 90% of 99.99 µL gives `89.9` (89.991 rounded down); 33%
  of 10 µL gives `3.3`.
- **The tip limit:** a mix that works out above `MIX_VOLUME_LIMITS` of the stage's tip type gives
  the limit: 90% of 1000 µL on BC230 tips gives `200`; on BC1070 tips, `900`. The tip type is the
  stage's tip group's, so a tip change before the stage changes it.
- **Each row on its own:** in a stage with two substages, each row's volume comes from its own
  wells only.
- **Both ends:** a stage mixing at both ends gives both volumes in each row.

**Problems**
- A destination that's empty before the stage and gets 0.05 µL, mixed at 90%, gives `0` and one
  problem: `{ stage, end: "destination", labware, well, held: 0.05 }`.
- A source drawn empty by the stage, with a smallest draw of 0.1 µL, mixed at 50%, gives `0` and a
  problem naming it.
- With two wells holding equally little, the problem names the first in the row's transfer order.
- Problems are listed in stage order, then row order, source before destination.
- A row whose mix works out to `0.1` has no problem.

- `held` is rounded to 3 decimal places.

**Purity**
- The plan is unchanged after `mixVolumes`, and two calls give equal results.

**REPL:** a `mix-volumes` topic in `scripts/repl.js` (CLAUDE.md), showing a mixing plan's volumes
and a mix problem.
