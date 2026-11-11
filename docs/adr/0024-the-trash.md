# 24. Deleted things go into a trash kept by the browser, one entry each, and go back beside the same neighbors

Date: 2026-11-11

## Status
Proposed (Andy, 2026-11-11: shaped in a preview the same night; written in the hands-off workflow,
so it stands as a proposal until he merges its pull request). It updates ADR 0014, whose version had no Cut or
Delete, and its container rule now covers removing a stage too.

## Context
Andy asked for an easier delete (select stages, tip groups, randomizations or transfer tables and
press Delete or choose Delete from the right-click menu) and for a trash can: somewhere deleted
things go, so they can be dragged back, or put back where they were, even after other edits (Undo
can't bring back one thing without undoing everything after it). In the preview, three questions
came up, and the first tries at putting things back went wrong in three ways:
- A delete of several Ctrl-clicked things was one entry with one place, so S02 and S03 (either side
  of a tip group boundary) came back out of order.
- Each stage remembered its neighbors by stage ID, but a stage put back is a pasted copy with a new
  ID, so S03 and S04, deleted together, lost each other when put back one at a time.
- A plan opened after a delete has stages with the same IDs (1, 2, 3 …), so putting back placed
  things next to unrelated stages.

Alongside, Andy found that removing a tip group's first stage joined the rest of the group to the
tips before it, which the logic specification said on purpose but nobody wanted.

## Decision
- **Deleting** is one logic edit, `deleteItems`, of any mix of items (`transfer-designer.md`,
  "Deleting"). A stage of a randomization or transfer table can't be deleted without its owner
  (it's one source's or one column's), and the last stage of a plan can't be deleted.
- **Removing a tip group's first stage moves its tip change to the next stage of the group**, so the
  group keeps its tips, as moving the stage away already did (ADR 0014's container rule). This is
  now the one rule for every removal of a stage.
- **The trash is kept by the browser, not the plan** (local storage, shared by the designer's tabs).
  It isn't in plan files, isn't part of what's saved or written for the Biomek, and isn't tied to
  a plan: a deleted stage can be dragged into another plan. Its changes go with Undo and Redo of the
  edits that made them, Reset included; Empty trash isn't an edit.
- **One entry per deleted thing.** Putting each back on its own makes each place simple to find;
  Undo still undoes a whole delete at once.
- **Putting back finds the same neighbors.** The trash remembers the plan's stage order with the
  deleted stages kept in their places, and which tip group each stage belongs to (a group key that
  survives deletes), so things deleted in separate deletes can be put back in any order and rebuild
  the plan (found in the review of the specifications: neighbors recorded once, when each was
  deleted, went wrong). A stage goes back into its old tip group, beside the nearest stage of it
  still there; anything else goes between tip groups, beside the box of the nearest stage that was
  above (or else below) it. A remembered stage counts only if it's the same stage: the same ID
  **and the same name** as the trash remembers. In a plan where none counts, Put back is
  unavailable and the entry can only be dragged.
- **The trash's rules are a logic module** (`trash.md`), not page code as in the preview, so they're
  tested in Node, thoroughly, as Andy asked.

## Consequences
- Deleting is safe and quick: one key, no question, a visible animation, an Undo button, and the
  trash for later. Plan files and the Biomek's files don't change; what a plan writes changes only
  where a removed first stage now leaves its group's tips in place, as intended.
- The trash can't follow a plan to another computer or browser, and a private window forgets it.
- Matching neighbors by ID and name can be fooled by a stage given a deleted stage's ID and the same
  name (after an undo), and misses a renamed neighbor: the place found may then be wrong or missing,
  and the user drags the entry instead. Plans have no identity of their own to check.
- A put-back stage, tip group or transfer table is a pasted copy, with new IDs; a randomization gets
  its name back when it's free, so its well map keeps its name.
