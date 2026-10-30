# 7. A standard deck, a setup worklist and a stage worklist

Date: 2026-10-21. Rewritten 2026-10-27, after the method was built and tested.

## Status
Accepted (Andy, 2026-10-28), together with ADR 0006, which it builds on.

Rewritten on 2026-10-27 to describe the general-purpose method as built (Andy chose a rewrite over
another amendment). Earlier versions are in the git history; "History", below, lists what changed
when, so references such as "ADR 0007, amended 2026-10-26" still have a meaning.

## Context
ADR 0006 plans one general-purpose method, built once in Biomek Software and driven by files the tool
writes. Whether that could work depended on what a worklist row can control. Tests in simulation on
2026-10-21, and building and testing the method itself on 2026-10-27, answered most of it
(`docs/domain/biomek.md`, "Worklist-driven steps" and "Building the general-purpose method"):
- a row can set the transfer file, liquid type and technique (separately at the sources and at the
  destinations), probes, tip type, whether tips are changed, and how to mix;
- Instrument Setup's well volumes, but not its liquid types, can come from variables, and a one-row
  **setup worklist** can supply them from a file;
- a Worklist step's file can come from a variable, but a worklist's variables exist only inside its
  own loop;
- Transfer From File needs all of a step's sources to be one labware type, and all its destinations
  one labware type (B56358AF, 22-13), and those labware types can only be picked from a dropdown,
  not set by a variable;
- validation catches overdraws, tip overfill, wells outside a labware's grid, and unknown technique
  and liquid type names, but not a technique unsuited to the tip.

Speed comes from several probes working side by side, and Transfer From File plans that across
many transfers. Measured on the real instrument (test 22, `biomek.md`): 24 transfers took 2 min 52 s
with one probe, whether row by row or in one Transfer From File file, and 35 s with all eight probes
in one file. Andy wants the tool, not Biomek, to decide technique, liquid type, tip type, how many
probes to use, when tips change, and how to mix.

## Decision

### A standard deck
The general-purpose method has a fixed set of labware with fixed names, stated once in a **deck
description** in `config/` (each labware's name, exactly as in the method; its grid; and its labware
type; `src/shared/deck/deck.md`). Today's deck: Res1 and Res2 (DeepReservoir12), Deep1 and Deep2
(BCDeep96Square), and Plate1 to Plate6 (BCFlat96).

- **The tool never knows deck positions** (Andy). Positions are set in the method; the user matches
  labware names to positions on the Biomek screen. Labware is identified by name only, so positions
  can change without changing the tool.
- **Every position used must be reachable by any set of probes,** since the tool chooses probes per
  tip change. Probes 1 and 2 can't reach the front row (P14; `biomek.md`).
- **Every well has a starting-volume variable** named `Vol_<labware>_<well>`, e.g. `Vol_Plate1_A1`,
  or `Vol_Res1_5` for a reservoir trough (reservoir wells are numbered). They are set once, in
  Instrument Setup's Show Well Properties: 792 for today's deck.

### The method
```
Start
Worklist                        the setup worklist, at a fixed path
    Instrument Setup            each well's volume = its Vol_ variable
    Worklist                    =StageWorklist, the stage worklist
        If NewTip=1
            Unload Tips         all 8 probes
            Load Tips           =TipType tips on =LoadProbes
        If SrcLabwareType="DeepReservoir12" And DestLabwareType="DeepReservoir12"
            Transfer From File
        ... one If step and Transfer From File step for each of the 9 pairs of labware types
    End Worklist
End Worklist
Finish                          report on all labware data
```

- **The stage worklist's loop is inside the setup worklist's,** because a worklist's variables exist
  only inside its own loop: the stage worklist's path is a column of the setup worklist.
- **One Transfer From File step per pair of labware types,** each inside an If step testing the
  row's `SrcLabwareType` and `DestLabwareType`, because the step's labware types can't come from
  variables. With three labware types there are nine pairs, and all nine are built, so any
  substage (below) has a step to run it.
- **Every Transfer From File step is set up the same way:** File Name `=TransferFile`, "File has a
  header row" checked, columns by number (1 to 5); probes `=Probes`; tip type `=TipType` in the box
  next to Load, with Load unchecked (Transfer From File needs it to know which tips are on;
  `biomek.md`); "Split large volumes" checked, so a transfer larger than the tip holds is made in as
  many trips as needed; "Skip zero volume transfers" checked; `=SrcTechnique` and `=SrcLiquidType`
  at the sources; `=DestTechnique` and `=DestLiquidType` at the destinations.

### The files that drive each run
1. **A setup worklist,** at the fixed path the method names, replaced for each run. One row:
   `StageWorklist` first (the stage worklist's full path, first so it's visible at a glance), then
   one `Vol_` column per well, giving every well's starting volume.
2. **A stage worklist:** one row per tip change or substage, in the order they run. Its columns:
   `NewTip, TipType, LoadProbes, TransferFile, Probes, SrcTechnique, SrcLiquidType, DestTechnique,
   DestLiquidType, SrcLabwareType, DestLabwareType, SrcMixVolume, SrcMixTimes, SrcMixSpeed,
   DestMixVolume, DestMixTimes, DestMixSpeed`.
   - A **tip-change row** (`NewTip` 1) gives the tip type and the probes to load, and leaves the
     other columns empty.
   - A **transfer row** (`NewTip` 0) gives one substage's Transfer From File file and settings. Its
     tip type and probes are those of the latest tip change before it. Its labware types are looked
     up in the deck description from the labware its transfers use, not set by the user. Its mix
     columns are empty when it doesn't mix.
3. **One Transfer From File file per substage,** with a header row and the columns `SourceLabware,
   SourceWell, DestLabware, DestWell, Volume`.

Where the stage worklist and Transfer From File files are written is set in the file writer's
specification.

### Stages and substages
A **stage** (`docs/glossary.md`) is a group of operations that can run in any order and share one
set of settings: the technique and liquid type at the sources and at the destinations. (Its probes
are its tip change's, below.) The file writer splits each stage into **substages**: the stage's
transfers that share one source labware type and one destination labware type. Each substage is one transfer
row, with the stage's settings. A stage's substages are consecutive rows, in any order among
themselves, since order within a stage isn't fixed anyway.

### Tip changes
A **tip change** (`docs/glossary.md`) is its own row, between stages: it unloads all tips and loads
tips of one type. The run always starts with one. **A tip change chooses its probes** (Andy,
2026-10-30): it loads tips on those probes (`LoadProbes`), and every transfer row until the next
tip change uses all of them (`Probes`). There's never a benefit to a stage using fewer probes than
have tips, so choosing probes for every stage was wasted effort; a stage that must use fewer probes
gets a tip change of its own. (Until 2026-10-30 each stage chose its probes, and a tip change loaded
the largest set any stage before the next tip change needed, "by looking ahead".)

### Mixing
The method supports mixing, and the tool offers it (Andy, 2026-10-29 and 2026-10-30, from the
mixing preview). A stage can mix at its sources before aspirating, and at its destinations after
dispensing, each with its own volume, number of times and speed. Mixing is done by techniques that
read the mix columns:
- **A technique that mixes** (Andy's OperationMix) mixes before aspirating with `=SrcMixVolume`,
  `=SrcMixTimes` and `=SrcMixSpeed`, and after dispensing with the `=DestMix...` variables. Where a
  row doesn't mix, it uses a technique that doesn't (e.g. Operation), because a technique that
  mixes rejects 0 mix times.
- **Mixing on its own,** without moving liquid, is a stage whose transfers go from a well to itself,
  with a volume above 0, using a technique that only mixes (Andy's MixOnly2) at both ends, whose
  template mixes only at the dispense end. Biomek doesn't change the well's volume, and the tool
  doesn't count those transfers in its contents tracking. The tool calls such a stage a **mix
  step** (`docs/glossary.md`).

How the tool decides the mix columns:
- **A stage holds a mix for each end,** `sourceMix` and `destinationMix`: none, or a **share** of
  the well (a percentage), a number of **times** and a **speed** (µL/s). The page offers mixing as
  on or off; switching it on copies the **default mix** from `config/` (90% of the well, 3 times, at
  400 µL/s; Andy, 2026-10-29). The values are stored, not just "on", so options can be offered later
  without changing the plan format, and a saved plan keeps the mix it was made with even if the
  default changes.
- **One mix volume per row, worked out by the tool.** Each stage-worklist row takes one mix volume
  for each end, and Biomek can't work out a volume per well itself (the manual shows no way:
  `biomek.md`). So the tool works it out, from what the wells hold (contents tracking): the share
  of the least any of the row's wells holds when it's mixed, rounded down to 0.1 µL, and no more
  than the **mix volume limit** of the stage's tip type, from `config/`. So no well mixes more than
  it holds, and no mix asks a tip for more than it can take. A source is mixed before each draw and
  a destination after each dispense. A stage's rows run in order, but within a row Biomek chooses
  the order, so the tool takes the least a well can hold when it's mixed: what it held before its
  row, less everything the row draws from it, plus its smallest draw (a source) or smallest
  dispense (a destination) (`mix-volumes.md`); a mix step's well, what it holds as the stage
  starts. Wells holding much more than the stage's emptiest are mixed less than their share;
  the page shows how much (`transfer-designer-page.md`).
- **A mix that works out to 0 µL is a problem** (Andy, 2026-10-30), a **mix problem**
  (`docs/glossary.md`): its emptiest well holds too little when it's mixed, and what Biomek does
  with a 0 µL mix isn't known. It's shown as soon as it appears, as an overdraw is, and the files
  can't be written until it's fixed.
- **The technique follows the mixing.** Each pipetting mode in `config/` names the technique used
  when that end doesn't mix and the one used when it does (Operation and OperationMix), or none if
  the mode can't mix there (Non-Contact). Switching mixing on or off at an end switches that end's
  stored technique in the same edit, so the stored technique is always the one Biomek gets.
- **A mix step** uses its own mode, from `config/` (MixOnly2 at both ends), and its `destinationMix`,
  since MixOnly2 mixes at the dispense end.

### Volumes and checks
- **Volumes in the files are rounded to 3 decimal places** (1 nL). Biomek keeps 15 significant
  digits (`biomek.md`), so this isn't a Biomek limit: it keeps arithmetic leftovers such as
  `10.000000000000002` out of the files, at a precision already far finer than a pipette delivers.
- **The tool checks what Biomek doesn't,** before writing any file: that each technique suits its
  tip type, volume and liquid type (from a table of the lab's techniques in `config/`). Because
  large volumes are split, a transfer's volume isn't limited by the tip's capacity.

## Consequences
- Each experiment is a few generated files; the method itself never changes from one experiment to
  the next.
- Labware outside the standard deck means editing the method: adding its If and Transfer From File
  steps, and setting its wells' volume variables, by hand or with the reference scripts kept in the
  claude.ai project (`biomek.md`, "Methods and their files"). The deck description must change to
  match.
- The stage worklist's columns, and the If steps' conditions, are an interface between the method
  and the file writer: changing either means changing the other, and testing again.
- Since every pair of labware types has its step, the file writer never has to refuse a pair. But a
  step whose dropdowns name the wrong labware types might not be caught if the wrong type has the
  same number of wells (`biomek.md`, "Not yet known"), so each step's labware types are checked by
  eye when the method is built or edited.
- Liquid types in Instrument Setup can't come from variables (the field takes the text literally;
  `biomek.md`), so the tool sets liquid types only per stage, in Transfer From File.
- A stage is the unit for settings: transfers that differ in technique or liquid type, at either
  end, go in different stages (and, once the tool offers mixing, in how they mix). Labware types don't separate stages, since
  the file writer splits a stage into substages; tip type doesn't either, since it belongs to tip
  changes. One stage can take several stage-worklist rows, one per substage.
- Within a stage, Transfer From File chooses the order, so a well that is filled and then drawn from
  must have those transfers in different stages.
- The user decides where tips change, between any two stages, with what tip type and on which
  probes. Using fewer probes for one stage costs a tip change, and so new tips.
- Replacing only some tips (e.g. one contaminated probe) isn't possible; tips are always all
  unloaded. An `UnloadProbes` column could add this later.
- Speed was measured on the real instrument (test 22, `biomek.md`). Whether a real run, unlike
  simulation, catches a technique unsuited to the tip is still to be checked.

## History
- **2026-10-21:** first written: a standard deck, a setup worklist, and a stage worklist with one
  Transfer From File file per stage.
- **2026-10-23 (Andy):** separate techniques and liquid types for the sources and the destinations;
  labware types come from the deck description, not from stages.
- **2026-10-26 (Andy):** a stage may mix labware types, and the file writer splits it into
  substages; tip changes are rows of their own, chosen by one If step with Then and Else.
- **2026-10-27:** rewritten after building and testing the method (Method6 to Method32, `biomek.md`):
  nested worklists; one If step for tip changes and one per pair of labware types, in place of Then
  and Else; all nine pairs built; the stage worklist's columns, including mixing; `Vol_` variable
  names; the tool never knows deck positions; every position reachable by any probes.
- **2026-10-30 (Andy):** a tip change chooses its probes, and every stage until the next tip change
  uses all of them, replacing per-stage probes and look-ahead tip loading.
- **2026-10-30 (Andy):** how the tool decides the mix columns (from the mixing preview): a mix for
  each end of a stage as a share of the well, times and speed; one mix volume per row, worked out
  by the tool and capped at the tip's limit; the technique following the mixing; mix steps.
