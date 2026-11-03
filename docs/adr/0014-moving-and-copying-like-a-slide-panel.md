# 14. Moving and copying in the Stages column, like PowerPoint's slide panel

Date: 2026-11-01

## Status
Accepted (Andy, 2026-11-02: decided while shaping a preview on 2026-11-01, written in the hands-off
workflow, and accepted by merging #128).

## Context
Stages could be added and removed, but not moved or copied. Repeating part of an experiment meant
building its stages again, and putting a stage in the wrong place meant removing it and building it
again (roadmap, "Later": "Editing the list further").

Three things make it harder than moving rows in a list:
- **Tips aren't part of a stage.** A tip change sits between stages, and starts a tip group
  (`docs/glossary.md`). Moving a stage raises the question of what happens to the tips it had and to
  the tips of the place it lands.
- **A randomization owns its stages** (ADR 0012), each on tips of its own, and they must always match
  its card.
- **Many ways to do it.** In the preview (2026-11-01), rules invented one question at a time (tips
  follow the stage, or the place? which gap does Paste use?) felt complicated, and Andy asked for the
  design people already know.

## Decision
**Follow PowerPoint's slide panel** (Andy, 2026-11-01), the closest well-known design to a column of
stages in groups (its sections are like tip groups):
- click selects; Shift-click selects a run; Ctrl-click adds or takes one away; clicking a tip
  group's heading selects the whole group, as clicking a section's heading does;
- dragging moves what's selected; holding Ctrl while dropping copies it;
- Ctrl+C copies, and Ctrl+V pastes below what's selected, also into another plan;
- right-click offers Copy, Paste above and Paste below on a stage or a heading, and Paste here on a
  gap between them (Andy, 2026-11-01: clicking a gap to set where Ctrl+V pastes, as PowerPoint does,
  was tried and dropped: our gaps are 10px and hold the seam's buttons, so it was hard to find).
  Duplicate (Ctrl+D) was offered and declined.

Box selection (dragging a box over things) was considered and set aside: it's standard on a
two-dimensional surface, rare in a list, and a list has little empty space to start a box from.

**The container rule** decides what happens to tips (Andy, 2026-11-01). **Containers** are ordinary
tip groups (not a randomization's own) and randomizations; what goes inside them is stages, mix
steps included. (Anything that can be selected, moved or copied, a stage or a container, is an
**item**: `docs/glossary.md`.)
- a container moved or copied **brings everything with it**: its tips and its stages;
- a container can't go **inside another container**: tip groups and randomizations go only between
  tip groups;
- a stage put **inside a tip group adopts that group's tips**;
- a stage put **between tip groups keeps the tips its old container had**, as a tip group of its own;
- the container a stage leaves **keeps its own tips**; one left with no stages disappears.

A randomization's stages can't be moved on their own, since their order and wells come from its card
(Andy, 2026-11-01). They can be copied: a copy is an ordinary stage.

## Consequences
- One rule covers moving, copying and pasting, wherever they're dropped; nothing is handed from one
  stage to another behind the user's back.
- The transfer designer gains edits that move and copy whole parts of the column, as one undoable
  edit each, and a plain-data form of what was copied, so it can travel between plans
  (`transfer-designer.md`, "Moving and copying").
- Moving a stage can make its transfers draw from wells before they're filled: those are overdraws,
  shown as any others, and Undo takes the move back.
- Copying a randomization copies its wells to fill too, so the copy usually overfills them; that's
  what copying means, and the marks show it.
- Not in this version: cut (Ctrl+X) and Delete, moving a transfer to another stage, and moving a
  transfer within its stage (which wouldn't change the run: the Biomek orders a stage's transfers
  itself, B56358AF 22-25).
