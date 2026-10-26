# 11. The plan keeps the order of its stages in a list

Date: 2026-10-26

## Status
Accepted (Andy, 2026-10-26). Amends ADR 0008: the operation list is no longer the only place that
holds the order of stages.

## Context
ADR 0008 made the operation list the one source of truth for order: the order of the stages is the
order of their transfers' blocks, and nothing else stores it. That works for every stage that has
transfers. A stage without transfers has no block, so it had no place.

But the transfer designer shows stages without transfers, and the user puts them where they want
them: a new stage starts empty, and is added before a chosen stage. So the preview, and then the
transfer designer's specification, added `plannedBefore`: a note for each stage without transfers
saying which stage it goes just before. The **stage order** was then worked out from two sources:
the operation list for stages with transfers, and the notes for the rest.

Each crossing between the two sources needed a rule to keep them in agreement, and each rule came
from a bug (all found 2026-10-26):
- a stage that lost its last transfer moved to the end, until it was given a note;
- two stages planned before the same stage had no defined order, until a tie rule was added;
- a stage getting its first transfer let stages without transfers above it move below it (found by
  Claude Code before building), until every note was re-pointed on each first transfer.

Two places that must agree are what "one source of truth" exists to avoid, and the rules to keep
them agreeing kept growing. Each new kind of edit would need checking against all of them.

## Decision
**The plan keeps its stage order as a list of stage IDs, `stageOrder`.** It holds every stage
exactly once. It is the one source of truth for the order of stages, with or without transfers.
- Adding a stage inserts its ID into the list; removing a stage takes it out.
- Getting a first transfer or losing a last one doesn't touch the list.
- `plannedBefore`, and every rule that kept it in agreement, are gone.

**The operation list keeps its blocks in the same order.** It still holds each stage's transfers
together (ADR 0008), and the transfer designer places a stage's first transfer just before the
next stage in `stageOrder` that has transfers, or last. So the operation list's order always
follows `stageOrder`, and `contents-tracking` and the file writer, which read the operation list,
are unchanged. The **run order** is still the stages with transfers in the operation list's order,
which is now always `stageOrder` with the stages without transfers left out.

The list lives in the plan, not in the stage list. The stage list stays a lookup by ID whose own
order means nothing (`stage-list.md`), so the shared module doesn't change.

**A plan file holds its stages in stage order** (ADR 0010), so opening one rebuilds `stageOrder`
from that order, and needs no separate field.

## Consequences
- The transfer designer's specification (`transfer-designer.md`) loses `plannedBefore` and its
  rules, and gains `stageOrder`. Its code is changed to match.
- `plan-file.md` saves the stages in stage order instead of saving `plannedBefore`, and checks on
  opening that the transfers' blocks follow that order. Nothing has been released, so the format
  version stays 1.
- The order of the stages can only change by adding or removing a stage. Moving a stage (roadmap,
  "Later") would be a change to the list, and the operation list's blocks would follow it.
- The operation list and `stageOrder` both hold an order. They can't disagree, because only the
  transfer designer edits both, through one rule, and its tests check after every kind of edit
  that the blocks follow `stageOrder`.
