# 19. Transfer tables: a pasted table kept as one unit that owns its stages

Date: 2026-11-05

## Status
Proposed (Andy, 2026-11-05: decided while shaping previews that day; written in the hands-off
workflow, so it stands as a proposal until he merges its pull request). (ADR number 17 was never
used: no ADR, branch or pull request names it, so this one takes the next number after 0018 rather
than filling the gap, to avoid confusion with any reference to an unwritten 0017.)

## Context
Experiments are planned in Excel: a sheet saying how much of each component goes into each
condition's wells. Entering that in the transfer designer meant dragging every transfer by hand,
which is slow and error-prone, the work the project exists to remove. A first preview turned a
pasted table into ordinary stages; Andy wanted it to stay one unit, as a randomization does, so the
table and its stages can't drift apart and it can be edited and updated later.

## Decision
**A transfer table is part of a plan** (Andy, 2026-11-05): a grid of cell texts (a header row of
component names, then one row per well label, each cell the µL to add), with each component's
source wells, in order. It **owns** one stage per component with an amount, in column order, each
on new tips, and sits between tip groups like a randomization. It's made and edited through a
**wizard** (a dialog: Table, Sources, Review), started from a seam's button.

- **Pipetting settings and tips live only on its stages** (Andy, 2026-11-05: "creating two sources
  of truth" was the concern), edited with each stage's and tip change's ✎ as for any stage. The
  transfer table stores none, and an update keeps each stage's, matched by component (a column
  renamed in the wizard keeps its old stage's).
- **Its stages' transfers, names, seams and existence change only through it**, and this is
  enforced in the logic, not only by the page (unlike randomizations, whose protection is the
  page's alone; roadmap, "Technical debt").
- **A row fills every well with its label**, so replicates need one row; **a column can draw from
  several wells**, used in order with whole transfers, as a randomization's filler does.
- **One paste per wizard**, then the grid is edited in place (cells, rows, columns); a different
  table is a new wizard.
- **Out of date is flagged, never fixed by itself**, as for a randomization: when the plan changes
  so its stages differ from what it would make, it's a problem, and the Biomek files wait for
  Update.
- **Renaming a component renames its columns and stage**, as a rename already reaches every well.

## Consequences
- Plan files gain transfer tables (format version 11); copied items gain them (version 4).
- The file writer needs nothing new: its stages are ordinary stages to it.
- A transfer table's amounts are volumes; final concentrations turned into volumes from each
  stock's constituents could come later.
- Randomizations still keep a copy of their settings on their card; making them work like transfer
  tables is on the roadmap ("Later").

## Amendment (2026-11-06): a column can be named by a well label

A column's header can now be a **well label** as well as a component (Andy, 2026-11-06; roadmap
item 24), matched exactly, and the column then draws from the wells with that label, whatever they
hold, so a premix or a dilution made earlier in the run can be a source. A header that's a
component still draws only from wells holding nothing but it at Start; one that's both offers both
kinds of well. What a labeled well holds is never checked: its transfers are ordinary transfers,
and an empty or overdrawn well shows as a contents problem, as any other (Andy: "shouldn't it just
create the transfers and problems will be traceable as always?"). So "one stage per component"
above now reads "one stage per column": a column's name is a component's or a well label.
Nothing new is stored: `sources` and `stages` are keyed by the column's name, as before.
