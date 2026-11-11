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
- **A fresh tip for every well**: nothing is carried from one well to the next;
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
- **A fresh tip for every well** batches the wells in **probe order** (down each column, as the
  Span-8's probes sit) in batches of as many wells as there are probes, starting a new batch at
  each labware, so a mix step never reaches into two labware types (the file writer would split it
  into substages on the same tips).
- **One tip for wells with the same contents** groups wells by what they hold just before the box,
  the same components in shares within 0.000001 of each other (the filler wells' rule, one function
  for both), in probe order of first appearance.
- **Its mix steps change only through it**, enforced in the logic: their wells, names, mix and tips
  included, since the grouping depends on the probes and a tip group changed alone would break "a
  fresh tip for every well". Every mix step uses the standard mix (`DEFAULT_MIX`, `MIX_STEP_MODE`)
  and is named by its place, `Mix 1 of 12`.
- **Out of date is flagged, never fixed by itself**, as for randomizations and transfer tables: when
  what its wells hold, or where they are, would group them differently, it's a problem, and the
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
  probes and at most N wells, mixes each well with its own probe and never takes a tip into a second
  well (`biomek.md`, "Not yet known"). Transfer From File chooses its own order (B56358AF, 22-25).
  A simulation run must check this before any real run with a mixing box; if it fails, this way
  needs one mix step per well, or another remedy.
- A mixing box's mix steps can't use another mix. If one is needed, the wizard can gain a Mix row
  later.
