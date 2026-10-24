# 7. A standard deck, a setup worklist, and one Transfer From File file per stage

Date: 2026-10-21

## Status
Proposed. It builds on ADR 0006, which is also still proposed; both can be accepted together.

## Context
ADR 0006 plans one general-purpose method, built once in Biomek Software and driven by files the tool
writes. Whether that could work depended on what a worklist row can control. Tests in simulation on
2026-10-21 answered most of it (`docs/domain/biomek.md`, "Worklist-driven steps"):
- a row can set wells, volume, labware, the transfer file, liquid type, technique, probes, tip type,
  and whether tips are changed;
- Instrument Setup's well volumes, but not its liquid types, can come from variables, and a one-row
  "setup worklist" can supply them from a file;
- validation catches overdraws, tip overfill and unknown technique names, but not a technique
  unsuited to the tip.

Speed comes from several probes working side by side, and Transfer From File plans that across
many transfers. Measured on the real instrument (test 22, `biomek.md`): 24 transfers took 2 min 52 s
with one probe, whether row by row or in one Transfer From File file, and 35 s with all eight probes
in one file. Andy wants the tool, not Biomek,
to decide technique, liquid type, tip type, how many probes to use, and when tips change.

## Decision
**A standard deck.** The general-purpose method has a fixed set of labware at fixed positions, with
fixed names. Every well that can hold a starting volume has a variable named after its labware and
well (e.g. `Src_A1`), set up once in Instrument Setup's Show Well Properties.

**Two files drive each run:**
1. A **setup worklist**: one row with every well's starting volume. The method's first Worklist
   step reads it and contains the Instrument Setup step.
2. A **stage worklist**: one row per **stage** (`docs/glossary.md`), a group of operations that can
   run in any order and share one set of settings. Each row names a Transfer From File file and the
   stage's settings: the technique and liquid type at the sources and at the destinations
   (amended 2026-10-23, below), tip type, the probes to use, the probes to load, and whether tips
   are changed first. If the method takes the source and destination labware types
   from variables (below), the row also gives them; the tool looks them up from the deck
   description, not from the stage (amended 2026-10-23, below).

Inside the stage worklist's loop: an If step (`NewTip=1`) unloads all tips and loads tips on
`=LoadProbes` of `=TipType`; then one Transfer From File step runs `=TransferFile` with
`=Probes`, `=LiquidType` and `=Technique` (amended 2026-10-23: one technique and one liquid type
for each end, below). Its tip type, in the box next to Load, is also
`=TipType`, with Load unchecked: Transfer From File needs it to know which tips are on
(`biomek.md`). **"Split large volumes" is always checked,** so a transfer larger than the tip
holds is made in as many trips as needed.

**Tips are loaded by looking ahead.** When tips are changed, the tool loads tips on the largest set
of probes any stage needs until the next change, so no stage ever needs a probe without a tip, and
tips are never loaded partway. The probes each stage uses are chosen per stage, trading time
against tips.

**Volumes in the files are rounded to 3 decimal places** (1 nL). Biomek keeps 15 significant
digits (`biomek.md`), so this isn't a Biomek limit: it keeps arithmetic leftovers such as
`10.000000000000002` out of the files, at a precision already far finer than a pipette delivers.

**The tool checks what Biomek doesn't,** before writing any file: that each technique suits its tip
type, volume and liquid type (from a table of the lab's techniques in `config/`). Because large
volumes are split, a transfer's volume isn't limited by the tip's capacity.

**Amended 2026-10-23 (Andy): separate techniques and liquid types for sources and destinations.**
As first written, a stage had one technique and one liquid type, used at both ends: the Transfer
From File step took `=Technique` and `=LiquidType` in both its source and its destination
configuration. But Transfer From File sets them separately at each end (B56358AF, 22-13 and 22-14),
and the lab needs that: for example, aspirating slowly, then dispensing above the liquid so the tip
stays clean, or into it to avoid bubbles or to mix. So a stage has a source technique, a source
liquid type, a destination technique and a destination liquid type, and the stage worklist has a
column for each; the source configuration takes the source ones and the destination configuration
the destination ones. The columns' names are set in the file writer's specification. Separate
variables at the two ends weren't tested in simulation (`biomek.md`, "Not yet known").

**Amended 2026-10-23 (Andy): labware types come from a deck description, not from stages.** As
first written, this ADR listed the source and destination labware types among a stage's settings.
A labware's type is a fact about the labware, not the stage, so it is stated once, in a **deck
description** in `config/` (each labware's name, exactly as in the general-purpose method; its
grid; and its labware type), and looked up from there. A stage can then never disagree with the
labware its transfers use. Transfer From File still needs all of a step's sources to be one labware
type, and all its destinations one labware type (B56358AF, 22-13), so the file writer refuses a
stage whose sources, or whose destinations, aren't all one labware type, using the labware its
transfers name.

## Consequences
- Each experiment is a few generated files; the method itself never changes.
- Labware outside the standard deck needs a new or edited general-purpose method.
- Liquid types can't be set on wells in Instrument Setup, only per stage in Transfer From File.
- A stage is the unit for settings: transfers that differ in liquid type or technique, at either
  end, or in tip type or probes go in different stages, and so do transfers whose source or destination labware types
  differ (taken from the deck description; amended 2026-10-23). Within a stage, Transfer
  From File chooses the order, so a well that is filled and then drawn from must have those
  transfers in different stages.
- A Transfer From File step has one source labware type and one destination labware type
  (B56358AF, 22-13, 22-14 and 22-18), so a stage's labware types, looked up from the deck
  description, must reach the step. Either the
  step takes them from variables, or the method has one Transfer From File step per combination of
  labware types, chosen by If steps (as Exp37 used separate steps). Which one is still to be
  tested.
- Replacing only some tips (e.g. one contaminated probe) isn't possible; tips are always all
  unloaded. An `UnloadProbes` column could add this later.
- Speed was measured on the real instrument (test 22, `biomek.md`). Whether a real run, unlike
  simulation, catches a technique unsuited to the tip is still to be checked.
