# mix-volumes — specification

> **Draft (2026-10-30).** Written for v0.2.0, mixing layer (b), from ADR 0007 ("Mixing") and the
> mixing preview. Still to review: the mix volume limits are stand-ins (section 3; roadmap,
> "Technical debt"). It becomes Final once built and the files it feeds have run on the Biomek.
>
> **Draft change (2026-10-30, mixing layer (c1)):** each row also gives, for each well it mixes,
> what share of the well that is, and whether it's short (sections 2, 3, 4 and 6).
>
> **Draft change (2026-10-30, mixing layer (c1), later):** a mix problem is a mix volume under the
> minimum mix volume, `MIN_MIX_VOLUME` (1.1 µL), not only 0 µL (Andy, 2026-10-30; sections 1, 3
> and 6).

## 1. Purpose
`mix-volumes.js` works out how many µL each stage-worklist row mixes, at each end that mixes, and
finds the mixes that work out to too little to run.

A stage stores each mix as a **share** of the well (`stage-list.md`), but each row of the stage
worklist takes one mix volume in µL for each end, and Biomek can't work out a volume per well
itself (`biomek.md`, "Mixing"). So the tool works it out from what the wells hold (ADR 0007,
"Mixing").

It's shared because more than one module needs the same answer: the file writer, to write the mix
columns and to refuse a plan with a mix that works out to too little (`file-writer.md`), and the
transfer designer, to report those stages as problems as soon as they appear, as it does overdraws
(`transfer-designer.md`; Andy, 2026-10-30).

## 2. Scope
Version 1 works out mix volumes for transfer stages, one per row.

Not in version 1:
- **Mix steps** (`docs/glossary.md`): a stage that only mixes. They come with the page's mixing
  (roadmap, mixing layer (c)).
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

Within a stage, no well is both a source and a destination (the operation list's stage rule,
`operation-list.md`), except a transfer from a well into itself. So a destination is never drawn
from by its stage unless it's mixed into itself, and earlier rows only ever add to a destination or
take from a source. Judging each well at its own row still matters: a source drawn from by row A
holds less by row B, and a well-to-itself transfer holds what the well held before the row, not
that plus the transfer.

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

**How much of each well is mixed.** Every well in a row mixes the row's volume, so a well that
holds more than the emptiest mixes a smaller share of itself. For each well a row mixes, its
**mixed share** is the row's mix volume as a percentage of what that well holds when it's mixed
(worked out as for the emptiest well, above): `volume / held × 100`, or `0` if it holds nothing. A
mix is **short** if its mixed share is under `SHORT_MIX_SHARE` (Andy, 2026-10-29: 40%, whatever the
cause, whether the emptiest well or the tips' limit). A short mix isn't a problem: the plan can
still be written, and a tool shows it as a warning.

**A mix problem** is a row whose mix volume at an end is **under `MIN_MIX_VOLUME`**, the minimum
mix volume (1.1 µL): its emptiest well holds too little when it's mixed. Such a mix wouldn't run on
the Biomek: a mix runs on a transfer of 1 µL (Andy, 2026-10-30), and mix volumes needn't be
accurate, only possible. So the plan can't be written to files until it's fixed (Andy,
2026-10-30). A stage with a mix problem at either end of any row **has a mix problem**.

### Configuration
`config/tip-types.js` (ADR 0009) also exports `MIX_VOLUME_LIMITS`: the most each tip type can mix,
in µL, as an object with one entry for each tip type in `TIP_TYPES`, e.g.
`{ BC230: 200, BC1070: 1000 }`. The file's header comment says this module's tests check
`MIX_VOLUME_LIMITS` (and the transfer designer's tests the rest). These are **stand-ins** (roadmap, "Technical debt"): about what a
BC230 tip holds in one trip, and what a 1 mL syringe holds in one draw with air gaps (`biomek.md`,
"Volumes and tips"), not checked as mix volumes on the instrument. This module's tests check the
file: each tip type has exactly one limit, a number above 0, and there are no others.

`config/mixing.js` (ADR 0009, new) exports `MIN_MIX_VOLUME`: the smallest mix volume that runs, in
µL: `1.1` (Andy, 2026-10-30: a mix runs on a transfer of 1 µL, so it needs more than that). A
number above 0, checked by this module's tests. It also exports `SHORT_MIX_SHARE`: the mixed share, in percent, below
which a mix is short: `40` (Andy, 2026-10-29). A number above 0 and at most 100, checked by this
module's tests. (The file also holds `DEFAULT_MIX`, which the transfer designer's tests check;
`transfer-designer.md`.) Its header comment says which tests check which value.

## 4. Interface
The module exports one function. It changes nothing.

| Export | Takes | Returns |
|---|---|---|
| `mixVolumes(plan)` | a plan | `{ stages, problems }`, new each time. |

- `stages`: each stage with transfers, in stage order, as `{ stage, rows }`: `stage` is its ID;
  `rows` are its substages in order (`substagesOf`), each as the substage plus `sourceMixVolume` and
  `destinationMixVolume`: the row's mix volume at that end in µL, or `null` if that end doesn't mix;
  and `mixedWells`: each well the row mixes, as `{ end, labware, well, held, share, short }`: the
  end; the well; what it holds when it's mixed (µL, rounded to 3 decimal places); its mixed share
  (percent, not rounded); and whether it's short. Source wells come first, then destination wells,
  each well once per end, in the order of the row's transfers. An end that doesn't mix has none.
  A volume under `MIN_MIX_VOLUME` is given as it is (e.g. `0.8` or `0`), and is also a problem.
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
- **Earlier rows count:** a source holding 100 µL, drawn 60 µL by row A and 30 µL by row B (two
  rows, different destination labware types), holds at least `40` when row B mixes it (100 − 60 −
  30 + 30), so at 90% row B mixes `36`.
- **A well into itself:** a transfer of 10 µL from a well holding 50 µL into itself, alone in its
  stage, mixed at both ends at 90%, holds `50` at each end (50 − 10 + 10), so both mix `45`.
- **Never below 0:** a source holding 10 µL drawn from twice in one row, 30 µL and 5 µL (an
  overdraw), holds `0` when mixed (10 − 35 + 5 is below 0), so its mix is a problem besides the
  overdraw. (One draw alone can't go below 0: the rule gives back what the well held before.)
- **Rounding:** 75% of 120 µL gives `90`; 90% of 99.99 µL gives `89.9` (89.991 rounded down); 33%
  of 10 µL gives `3.3`.
- **The tip limit:** a mix that works out above `MIX_VOLUME_LIMITS` of the stage's tip type gives
  the limit: 90% of 1000 µL on BC230 tips gives `200`; on BC1070 tips, `900`. The tip type is the
  stage's tip group's, so a tip change before the stage changes it.
- **Each row on its own:** in a stage with two substages, each row's volume comes from its own
  wells only.
- **Both ends:** a stage mixing at both ends gives both volumes in each row.

**Mixed shares**
- The example in section 4 gives two destination wells: A1, `held` `20`, `share` `90`, not short;
  A2, `held` `150`, `share` `12` (18 ÷ 150 × 100), short.
- A mix capped at the tips' limit is short when the share it gives is under 40%: 200 µL of a source
  holding 1000 µL (BC230 tips) gives `share` `20`, short.
- A well holding nothing when mixed gives `share` `0`, short.
- A share of exactly `40` isn't short; `39.99` is.
- A well a row draws from twice is listed once, with what it holds as the emptiest-well rule works
  it out; an end that doesn't mix lists no wells; a row that doesn't mix has `mixedWells` `[]`.
- `config/mixing.js`: `SHORT_MIX_SHARE` is a number above 0 and at most 100.

**Problems**
- A destination that's empty before the stage and gets 0.05 µL, mixed at 90%, gives `0` and one
  problem: `{ stage, end: "destination", labware, well, held: 0.05 }`.
- A destination holding 0.9 µL when mixed, at 90%, gives `0.8` and a problem; holding 1.2 µL gives
  `1` (1.08 rounded down) and a problem; holding 1.25 µL gives `1.1` (1.125 rounded down) and no
  problem.
- A source drawn empty by the stage, with a smallest draw of 0.1 µL, mixed at 50%, gives `0` and a
  problem naming it.
- With two wells holding equally little, the problem names the first in the row's transfer order.
- Problems are listed in stage order, then row order, source before destination.
- `config/mixing.js`: `MIN_MIX_VOLUME` is a number above 0.

- `held` is rounded to 3 decimal places.

**Purity**
- The plan is unchanged after `mixVolumes`, and two calls give equal results.

**REPL:** a `mix-volumes` topic in `scripts/repl.js` (CLAUDE.md), showing a mixing plan's volumes
and a mix problem.
