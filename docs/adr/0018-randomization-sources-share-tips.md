# 18. A randomization's sources can share tips

Date: 2026-11-05

## Status
Proposed (Andy, 2026-11-05: shaped in a preview he approved, "The current preview's randomization
changes are good!"; written in the hands-off workflow, so it stands as a proposal until he merges
its pull request).

## Context
A randomization (ADR 0012) makes one stage per source, and until now each started on new tips, so
nothing could carry one source's liquid into another. That makes it the plan's heaviest use of
tips: a randomization of 12 sources on 8 probes loads 96 tips.

Often sources are related: the same drug at increasing concentrations, run lowest first. Carrying a
little of a lower concentration into a higher one is harmless, so the lab would share tips between
them, as it does by hand. Andy wants to choose, source by source, whether new tips come before it.
He doesn't want to choose tip types or probes per source: one randomization, one Tips setting.

Two things had to be settled with it:
- **Order now matters to the tips**, so the user must be able to reorder sources (lowest
  concentration first), and the stages must follow that order. A run used to keep the stages it had
  already made where they were, so reordering sources would not have reordered stages.
- **How to show and edit the sharing** without inventing a second way of working: the Stages
  column already groups stages into tip groups, with seams that add, split and (by moving) join, and
  the container rule for what moving does to tips (ADR 0014).

## Decision
- **Each source says whether its stage shares the tips of the source before it** (`sharesTips`), and
  sources that share form a **source group** (`docs/glossary.md`). Every source starts in a group of
  its own, so a randomization behaves as before until the user joins sources.
- **The first source always starts new tips**: a randomization still never shares tips with stages
  outside it (ADR 0012's rule, kept). Its stages may now share tip groups with each other.
- **The card shows source groups as the Stages column shows tip groups** (Andy, 2026-11-05): boxes
  in alternating blue and sand, with seams whose tip button joins two boxes or splits one, and rows
  dragged onto seams, following **the container rule** (ADR 0014): dropped inside a box a source
  shares its tips; dropped between boxes it gets new tips; a box a source leaves keeps its tips.
- **A run puts the stages in the sources' order**, existing stages included, and gives new tips
  only where a source group starts. The logic does this (`transfer-designer.md`), not the page.
- **Reordering sources changes the random layout** even with the same seed, since the pool numbers
  sources by their place in the list (Andy accepted this, 2026-11-05). Reordering is a change to the
  randomization, and Update reruns it.

Considered and not done: tip type and probes per source (Andy: not wanted); setting every source's
sharing at once from the All sources row (Andy didn't ask for it after trying the preview);
keeping the random layout stable when sources are reordered (it would need the pool to number
sources by something other than their place, such as their well, which would change every existing
randomization's layout).

## Consequences
- **Fewer tip changes in the Biomek files** when sources share: fewer tip-change rows in the stage
  worklist, and fewer tips loaded. The files' format doesn't change; the file writer already writes
  a tip change only where the plan has one. This changes what goes into the Biomek files, so it's
  Andy's call when he merges.
- Plan files hold each source's sharing (format version 10), and copied items too (version 3).
- Checks that assumed each of a randomization's stages was alone in its tip group change: a plan
  file, or a paste, may hold a randomization whose stages share tip groups, but never one that shares
  with a stage outside it.
- Cross-contamination between shared sources is the user's choice; the tool doesn't judge which
  sources are safe to share.
- **It amends ADR 0012**, whose randomization made one stage per source "each on new tips", and
  **ADR 0014**, whose randomization's stages were "each on tips of its own": a randomization's
  stages may now share tips with each other, never with stages outside it. Their Status lines point
  here; their text is left as it was decided.
- **Plans saved before this change may open out of date**: a run then left stages it had already
  made where they were, so a randomization's stage order could differ from its sources' order (e.g.
  after unmarking its first filler well). Now a run puts them in the sources' order, so such a
  randomization reads as out of date, and Update reorders its stages, changing the order of their
  rows and files in the Biomek files (`transfer-designer.md`, "Out of date").
