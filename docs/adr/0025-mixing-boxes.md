# 25. Mixing boxes: mix steps made from wells and a way to mix, kept as one unit

Date: 2026-11-11

## Status
Proposed (Andy, 2026-11-11: shaped in a preview he approved that day; written in the hands-off
workflow, so it stands as a proposal until he merges its pull request). (ADR 0024 is taken by the
open `easy-delete` pull request, #153, so this one is 0025.)

## Context
Mixing many wells means building mix steps by hand: deciding which wells can share a set of tips,
adding a mix step for each group, clicking its wells, and giving each its tips. Done carelessly, a
tip carries one well's liquid into the next. Andy wanted a way to pick the wells and say how to mix
them, and have the mix steps made for him. Two ways for now:
- **A fresh tip for every well**: meant to carry nothing from one well to the next, each well
  mixed by a tip of its own (not verified: see "Consequences" and `biomek.md`, "Not yet known");
- **One tip for wells with the same contents**: wells holding the same components in the same
  shares share a tip, using fewer tips without carrying anything that matters.
More ways may come.

The preview kept a mixing box as a transfer table with an extra `mixing` field, didn't save it in
plan files and refused to copy it. Those were shortcuts for trying the idea, not a design.

## Decision
**A mixing box is part of a plan and a container of its own kind** (`transfer-designer.md`,
"Mixing boxes"), sitting between tip groups like a transfer table, owning the mix steps it made,
each in a tip group of its own. It stores only its **way to mix** and its mix steps: its wells are
its mix steps' mixed wells and its tips their tip changes, so nothing is held twice (as ADR 0019
decided for transfer tables).

- **Ways to mix are a list of rules**, each turning the wells (in probe order) into groups, one mix
  step per group; a new way is a new entry, and nothing else changes.
- **Both ways also group by volume** (Andy, 2026-11-11, decision A): wells share a mix step only if
  they hold about the same volume, the largest at most `MIX_VOLUME_TOLERANCE` percent (in
  `config/mixing.js`) above the smallest, judged on the whole group so it can't chain. Reason: a mix
  step mixes every well with one volume, worked out from its emptiest well (`mix-volumes.md`), so a
  fuller well would be under-mixed without a warning. Rejected: warning about mixed volumes (leaves
  the fix to the user), and splitting a stage's rows by well volume in the file writer (fixes every
  mix step, but changes the file writer; still on the Later list).
- **A fresh tip for every well** takes the wells in **probe order** (down each column, as the
  Span-8's probes sit) in batches that each hold **wells of one column of one labware** (Andy,
  2026-11-11, decision B: "make sure batches are vertical lines as well — it does them all at once
  that way"), **in rows right next to each other** (Andy, 2026-11-11 11:42), at most as many as
  there are probes with tips: a batch starts again at each new column, each new labware, at any
  gap (a well not in the row directly below the batch's last well), when it's full, and at a
  volume break. So on 4 probes A1, C1 and E1 are three mix steps. Reason: a column batch of
  adjacent rows matches how the probes sit, one row apart, so the Span-8 can mix it in one pass
  (to be checked in simulation); A1, C1 and E1 can't be reached in one pass. A new
  batch at each labware also keeps a mix step out of two labware types, which the file writer would
  split into substages on the same tips. Rejected: batches across columns within a labware, a
  new batch only at each labware type, and batches that skip rows. Its cost is more mix steps and tips when the wells are in
  rows (A1 to A12 on any probes is 12 mix steps).
- **Reservoir troughs are refused for a fresh tip** (Andy, 2026-11-11, decision C) until the
  simulation test has checked several probes in one trough: every probe of a mix step may enter the
  same trough, and whether 8 probes can draw from one trough is unknown, so a fresh tip might not be
  fresh. A trough here is any well of a grid with one row (a one-row lettered labware and a one-well
  reservoir included), the case where each column holds one well. One tip for wells with the same
  contents takes them. A fresh-tip box that comes to hold a trough anyway (a well moved into one,
  or a plan file) is out of date, so the Biomek files wait and Update gives the refusal.
- **One tip for wells with the same contents** groups wells by what they hold just before the box,
  the same components in shares within 0.000001 of each other (the filler wells' rule, one function
  for both), and about the same volume, in probe order of first appearance.
- **Empty wells can be picked** (Andy, 2026-11-11, decision D): they group only with other empty
  wells, and their mix step's overdraw, an existing contents problem, stops the Biomek files until
  it's fixed, so no new refusal is needed.
- **Its mix steps change only through it**, enforced in the logic: their wells, names, mix and tips
  included, since the grouping depends on the probes and a tip group changed alone would break "a
  fresh tip for every well". Every mix step uses the standard mix (`DEFAULT_MIX`, `MIX_STEP_MODE`)
  and is named by its place, `Mix 1 of 12`.
- **Out of date is flagged, never fixed by itself**, as for randomizations and transfer tables: when
  what its wells hold, or where they are, would group them differently, or its mix steps aren't on
  the standard mix as it now is (after `DEFAULT_MIX` changes), it's a problem, and the
  Biomek files wait for Update, which remakes it in place as one edit.
- **It moves, copies, pastes and is removed as a whole**, by the container rule (ADR 0014).
- **Made and edited in a wizard in the Stages column**, not a dialog over the page, since its wells
  are picked on the deck.

## Consequences
- Plan files gain mixing boxes (format version 14); copied items gain them (version 6).
- The file writer needs nothing new: a mixing box writes only mix steps and tip changes, which the
  tool already writes. So what goes into the Biomek files changes only as any mix steps a user could
  build by hand would change them.
- **Not verified:** "a fresh tip for every well" assumes the Biomek, given a mix step with tips on N
  probes and at most N wells of one column in adjacent rows, mixes each well with its own probe, in one pass, and
  never takes a tip into a second well (`biomek.md`, "Not yet known"). Transfer From File chooses its own order (B56358AF, 22-25).
  A simulation run must check this before any real run with a mixing box; if it fails, this way
  needs one mix step per well, or another remedy.
- A mixing box's mix steps can't use another mix. If one is needed, the wizard can gain a Mix row
  later.
