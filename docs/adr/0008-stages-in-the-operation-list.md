# 8. Stages: each operation names its stage, stages are consecutive, settings live in a stage list

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

**A separate stage list holds each stage's ID, name and settings.** The name is chosen by the user,
and two stages may have the same name. The operation list holds only the ID, so renaming a stage
changes nothing in the operation list.

**A stage's transfers are consecutive in the operation list,** one block per stage, with no other
stage's transfers in between. The order of the blocks is the order the stages run, so the operation
list stays the one source of truth for order. Nothing else stores the run order.

**Keeping blocks together:** the page inserts each new transfer after its stage's last transfer,
which needs an "insert at a position" method on the operation list. `OperationList.add` doesn't check
stages, so a split stage can still be built in code; the file writer checks and refuses one, naming
the stage and the transfer that splits it.

## Consequences
- `operation-list` changes: transfers gain a `stage` property, and the list gains an insert method.
  Both need its specification updated first.
- A new `stage-list` module holds stages (ID, name, settings), makes IDs, checks that each stage's
  transfers are consecutive, and groups transfers into stages for the file writer.
- `contents-tracking` doesn't need to know about stages: the order it replays is the order the
  Biomek runs stage by stage. Within a stage the Biomek may reorder transfers, but the stage rule (no
  well both source and destination within a stage; roadmap, "Technical debt") means that order
  doesn't change the result.
- Running a stage's transfers, then another stage's, then the first stage's again needs a third
  stage. That is deliberate: it is what the Biomek will actually do.
