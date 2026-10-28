# 6. Run experiments as worklists for one general-purpose method

Date: 2026-10-20

## Status
Proposed. The plan depended on what a general-purpose method can vary per worklist row. That has now
been checked, in simulation on 2026-10-21 and by building and testing the method on 2026-10-27
(`docs/domain/biomek.md`), so it is ready for Andy to accept, together with ADR 0007. Once accepted,
it amends ADR 0005.

## Context
ADR 0005 decided that the tool writes only Transfer From File files, for methods built in Biomek
Software and described to the tool.

The goal has since grown: the tool should define the whole method, including decisions such as when
tips are changed. That gives better traceability and more customizable tools. Biomek Software is
used only because it is the only interface, and it lacks the features to set up our experiments
easily. It is a graphical interface with no documented way to be driven by a program (pending Beckman's
answer; see option 3).

ADR 0005's reasons against generating methods still hold: the method file's structure isn't
documented, and Script steps are "not currently supported for end-user applications" (B56358AF,
27-9). So the question is how to get full control within those limits.

Options considered:
1. **One general-purpose method, driven by a file.** Build one method in Biomek Software, once: a
   Worklist loop whose steps take their settings (source, destination, volume and so on) from the
   worklist's columns. The tool writes the worklist, and the worklist is the experiment's method. The
   Biomek method acts as an **interpreter**: a fixed program that carries out instructions given to
   it as data. Uses only supported features.
2. **Generate the exported `.json` method file**, by studying how exported methods change as they are
   edited. Most control, but undocumented, so any software update could break it without warning.
3. **A programming interface (API) or automation add-on from Beckman.** Not known whether one exists;
   Andy is asking Beckman.
4. **Automate the graphical interface** by scripting mouse clicks. Very fragile.

## Decision
Option 1. The tool keeps an ordered record of everything it decides (the `operation-list` module) and
turns it into a worklist, plus any files the worklist names, for one general-purpose method built in
Biomek Software.

Option 2 is not pursued for now. Option 3 is open, waiting for Beckman's answer; a supported interface
would be reconsidered. Option 4 is ruled out.

## Consequences
- The tool, not the method, decides things like tip changes, so they can be traced and changed per
  experiment.
- What the general-purpose method can vary from one worklist row to the next has been checked
  (2026-10-21 and 2026-10-27; `biomek.md`). A row can set nearly everything the tool needs,
  including tip changes, techniques, liquid types and mixing, and If steps can choose what runs.
  Labware types can't come from variables, so the method has one Transfer From File step per pair
  of labware types (ADR 0007).
- Option 2 is still not pursued, but the method file was edited once, by script, to give the
  general-purpose method its 792 starting-volume variables (2026-10-27; `biomek.md`, "Methods and
  their files"). That set up the one method; it doesn't generate methods. The scripts are kept
  outside the repository, as reference only.
- The method description from ADR 0005 now mainly describes this one method: its labware, and where
  the worklist and its files go on the Biomek PC.
- The general-purpose method must itself be built carefully and tested in simulation, since every
  experiment depends on it.
