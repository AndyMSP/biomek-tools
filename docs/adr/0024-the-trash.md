# 24. Deleting several things at once, and a trash to drag deleted things out of

Date: 2026-11-11

## Status
Proposed (Andy, 2026-11-11: shaped in a preview the same night; written in the hands-off workflow,
so it stands as a proposal until he merges its pull request). It updates ADR 0014, whose version had
no Cut or Delete.

## Context
Andy asked for an easier delete (select stages, tip groups, randomizations or transfer tables and
press Delete, or choose Delete from the right-click menu) and for a trash can: somewhere deleted
things go, so they can be brought back later, even after other edits (Undo can't bring back one
thing without undoing everything after it).

The preview also had **Put back**: a button that put an entry back where it was, by itself. It went
wrong in the preview, and two reviews of its specifications found it still couldn't be made
reliable:
- Things deleted together came back out of order (S02 and S03, either side of a tip group
  boundary), and things deleted separately came back in the wrong order or the wrong tip groups
  (S04, then S03; S07, S08 and S09 one at a time; S03, then the rest of its group).
- Where something was can only be described by the stages around it, and a plan has no lasting way
  to name a stage: stage IDs are renumbered from 1 whenever a plan is opened or the page reloads,
  so any gap or reordering changes them; a pasted stage gets a new ID; a new stage can take a
  deleted one's ID only after an undo or a reopen (`stage-list.md`, "IDs"); and names repeat (`New
  stage`). Another plan or another tab mixed up what the trash remembered.
- Moving, splitting, joining or renaming things after a delete sent things to the wrong place.

Alongside, Andy found that removing a tip group's first stage joined the rest of the group to the
tips before it, which the logic specification said on purpose but nobody wanted.

## Decision
- **Deleting** is one logic edit, `deleteItems`, of any mix of items (`transfer-designer.md`,
  "Deleting"). A stage of a randomization or transfer table can't be deleted without its owner
  (it's one source's or one column's), and the last stage of a plan can't be deleted.
- **Removing a tip group's first stage moves its tip change to the next stage of the group**, so the
  group keeps its tips, as moving the stage away already did (ADR 0014's container rule). This is
  now the one rule for every removal of a stage.
- **The trash is drag-out only** (Andy, 2026-11-11, 01:51): every deleted thing becomes an entry,
  kept as copied items, and getting one back is dragging it to a gap, which pastes it there. The
  trash never works out where something was. **Undo is the exact way to bring back a recent
  delete**, since it restores the plan as it was.
- **The trash is kept by the browser, not the plan** (local storage, shared by the designer's tabs).
  It isn't in plan files, isn't part of what's saved or written for the Biomek, and isn't tied to
  a plan: dragging an entry into another plan is pasting into it. Its changes go with Undo and Redo
  of the edits that made them, Reset included; Empty trash isn't an edit.
- **One entry per deleted thing**, so each can be dragged on its own; Undo still undoes a whole
  delete at once.
- **The trash's rules are a logic module** (`trash.md`), tested in Node, thoroughly, as Andy asked.

## Consequences
- Deleting is safe and quick: one key, no question, a visible animation, an Undo button, and the
  trash for later. Plan files don't change; what a plan writes for the Biomek changes only where a
  removed first stage now leaves its group's tips in place, as intended.
- The trash is simple and can't put anything in the wrong place by itself: the user chooses where an
  entry goes. Bringing back something deleted long ago takes a drag to the right gap.
- The trash can't follow a plan to another computer or browser, and a private window forgets it.
- A dragged-out stage, tip group or transfer table is a pasted copy, with new IDs; a randomization
  gets its name back when it's free, so its well map keeps its name.
