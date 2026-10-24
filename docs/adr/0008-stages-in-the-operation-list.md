# 8. Stages: each operation names its stage, the operation list keeps stages consecutive, settings live in a stage list

Date: 2026-10-23

## Status
Accepted (Andy, 2026-10-23).

## Context
A stage is a group of operations that share one set of settings and run as one Transfer From File
file (`docs/glossary.md`, ADR 0007). For v0.2.0 the user builds stages on the page, and each stage
has its own settings: technique, liquid type, tip type, probes, source and destination labware types,
and whether tips are changed first. The file writer needs to know, for every transfer, which stage
it belongs to and that stage's settings.

Three ways of storing this were discussed (roadmap, "Open decisions", 2026-10-22): one set of
settings for the whole plan; settings named on each operation; or "stage" entries inside the
operation list that apply to the operations after them. The first can't express user-built stages.
The third silently changes a transfer's settings when it is inserted or moved.

Two needs came up while deciding:
- **Names can repeat.** A user may split seeding into several stages to limit contamination, and
  each is honestly called "Seeding".
- **One source of truth for order.** `contents-tracking` replays transfers in operation-list order.
  If stages ran in some other order, the contents the tool shows could differ from what the Biomek
  produces.

## Decision
**Each transfer names its stage by ID.** A transfer gains a `stage` property holding the ID of its
stage. The ID is made by the tool and never shown or typed. It carries no meaning: it is neither the
stage's name nor its position, and a deleted stage's ID is never reused.

**A separate stage list holds each stage's ID, name and settings,** and makes new IDs. The name is
chosen by the user, and two stages may have the same name. The operation list holds only the ID, so
renaming a stage changes nothing in the operation list. The stage list's order means nothing; it is
looked up by ID.

**A stage's transfers are consecutive in the operation list,** one block per stage, with no other
stage's transfers in between. The order of the blocks is the order the stages run, so the operation
list stays the one source of truth for order. Nothing else stores the run order.

**The operation list keeps blocks together** by choosing where each transfer goes, so a split stage
can't exist, even when the list is built in code. `add` puts a transfer right after the last
transfer of its stage, or at the end if its stage is new; `insertBeforeStage` starts a new stage just
before an existing one; `remove` takes one transfer out. Code never gives a position when adding.
(Amended 2026-10-23, before any code: an earlier draft had an "insert at a position" method that
refused positions which would split a stage. Placing by stage needs no such checks.)
The operation list also groups its transfers by stage, for the file writer. Both the rule and the
grouping read only the operation list (the order and each transfer's stage ID), which is why they
live there rather than in the stage list.

**Settings stay out of the operation list.** It describes what moves where; a stage's settings
describe how the Biomek does it, need their own checks (for example against the technique list), and
are of no interest to `contents-tracking`.

## Consequences
- `operation-list` changes: transfers gain a `stage` property; `add` places transfers by stage; the
  list gains `insertBeforeStage` and `remove`, checks the stage rule as transfers are added, and
  groups transfers by stage. Its specification is
  updated first.
- A new `stage-list` module holds stages (ID, name, settings) and makes IDs.
- The file writer needn't check for split stages, because the operation list can't hold one.
- The page keeps each step's operation list and stage list together, for undo.
- A stage with no transfers yet has no place in the run order; it isn't run.
- `contents-tracking` doesn't need to know about stages: the order it replays is the order the
  Biomek runs stage by stage. Within a stage the Biomek may reorder transfers, but the stage rule (no
  well both source and destination within a stage; roadmap, "Technical debt") means that order
  doesn't change the result.
- Running a stage's transfers, then another stage's, then the first stage's again needs a third
  stage. That is deliberate: it is what the Biomek will actually do.
