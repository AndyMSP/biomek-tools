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

Doing every transfer as its own worklist row would be slow, because Transfer From File plans how to
use the probes across many transfers and a row-by-row loop can't. Andy wants the tool, not Biomek,
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
   stage's settings: liquid type, technique, tip type, the probes to use, the probes to load, and
   whether tips are changed first.

Inside the stage worklist's loop: an If step (`NewTip=1`) unloads all tips and loads tips on
`=LoadProbes` of `=TipType`; then one Transfer From File step runs `=TransferFile` with
`=Probes`, `=LiquidType` and `=Technique`. Its tip type, in the box next to Load, is also
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

## Consequences
- Each experiment is a few generated files; the method itself never changes.
- Labware outside the standard deck needs a new or edited general-purpose method.
- Liquid types can't be set on wells in Instrument Setup, only per stage in Transfer From File.
- A stage is the unit for settings: transfers that differ in liquid type, technique, tip type or
  probes go in different stages. Within a stage, Transfer From File chooses the order, so a well
  that is filled and then drawn from must have those transfers in different stages.
- Replacing only some tips (e.g. one contaminated probe) isn't possible; tips are always all
  unloaded. An `UnloadProbes` column could add this later.
- How fast this is on the real instrument, and whether a real run matches simulation, are still to
  be checked.
