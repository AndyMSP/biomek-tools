# Biomek i5 and Biomek Software

Facts about the instrument and its software that the tools rely on. Each fact gives its source:
a manual part number with chapter and page, or an observation on the instrument with its date.
Manuals are cited, not committed. They are in the claude.ai project "Biomek Implementation".

Manuals cited:
- **B56358AF**: Biomek i-Series Software Reference Manual.
- **B54473AD**: Biomek i-Series instructions manual, including the tutorials.

Last checked against the manuals: 2026-10-20. Simulation tests: 2026-10-21.

## Our instrument
- Biomek i5 with a Span-8 pod and 1 mL syringes. *(Lab setup.)*

## Transfer From File step
The step our tools write files for. It moves liquid well to well, reading each transfer from a file.
- It is a Span-8 step. *(B56358AF, chapter 22, Table 22.1.)*
- The file must be comma-delimited text, `.csv` or `.txt`; each row ends with a line break.
  *(B56358AF, 22-2 and 22-9.)*
- The step is given the file's **full path and file name**. *(B56358AF, 22-9.)*
- A header row is optional; with "File has a header row", the first row names the columns.
  *(B56358AF, 22-10.)*
- The file must contain at least the source wells. It may also give the source labware, destination
  labware, destination wells and volume; if it gives all of them, each row is one well-to-well
  transfer. *(B56358AF, 22-8.)*
- Labware columns may hold deck positions (`P4`) or labware names. If names are used, **labware
  with exactly that name must be on the deck**. *(B56358AF, 22-11 and 22-12.)*
- Well columns may hold well names (`A1`–`H12`) or well numbers (`1`–`96`), even mixed in one
  file. *(B56358AF, 22-11 and 22-12.)*
- Volumes are in microliters (µL). *(B56358AF, 22-12.)*
- "Skip zero volume transfers" ignores rows with a volume of 0. *(B56358AF, 22-12.)*
- One source configuration covers all sources: liquid type, technique and pipetting height are set
  per step, not per row, and if the file gives the source positions, all sources must be the same
  labware type. The same holds for destinations. *(B56358AF, 22-13, 22-14 and 22-18.)* So
  transfers that need different liquid types or techniques go in separate steps, each with its
  own file.
- **The step does not keep the file's row order.** It "automatically determines the most
  efficient way to complete the transfer." *(B56358AF, 22-25.)* When order matters, for example
  mixing a source before every draw, use a Worklist step instead (below). *(Also observed during
  Tutorials chapter 10, 2026-10-06; project training log.)*
- Save files from Excel as "CSV (Comma delimited)", not "CSV UTF-8": the byte order mark (BOM)
  that UTF-8 adds breaks the first column name. *(Observed during Tutorials chapter 10,
  2026-10-06; project training log.)*

## Worklist step
A loop: it runs the steps inside it once per row of a text file, setting variables from that row.
*(B56358AF, 27-5 and 27-6.)*
- The file is `.csv` (from a spreadsheet) or `.txt` (from a text editor), with values separated by
  commas. *(B56358AF, 27-6.)*
- Column headers name the variables; each later row gives their values for one pass.
  *(B54473AD, Glossary, "Worklist Variable".)*
- Quotation marks must come in pairs. *(B56358AF, 27-6.)*
- The file is read again on every run, so edits apply to the next run. *(B56358AF, 27-6.)*
- **The file must stay at its original path,** or the method can't find it. *(B56358AF, 27-6.)*
- The loop variable can't have the same name as a column. *(B56358AF, 27-8.)*
- A Transfer From File step inside a Worklist can take its file name from a worklist column, so
  one worklist row can run one file. *(How the Exp37 method was built; see `exp37.md`.)*

## If steps, variables and expressions
- The **If** step runs its "Then" substeps if a condition is true and its "Else" substeps if it is
  false. The condition must be a VBScript or JScript expression and can refer to variables defined
  in other steps. *(B56358AF, 25-6 to 25-8.)*
- A variable is used by typing `=` and its name into a step's configuration, for example `=AspValue`
  in a Transfer step's Volume field. *(B56358AF, 26-2.)* It can go in any field where its value is a
  valid entry; text can't go in a field that expects a number. *(B56358AF, 26-6.)*
- An expression can go anywhere a variable can, for example `="P" & count` to name positions P1 to
  P10 in a Loop. VBScript expressions start with `=`, JScript expressions with `==`.
  *(B56358AF, 26-6 and 26-7.)*
- Expressions in step fields and If conditions are documented features. Only the Script and
  Scripted Let steps carry the note "not currently supported for end-user applications".
  *(B56358AF, 27-9 and 27-11.)*
- **Wells from a variable:** in the Span-8 Aspirate and Dispense steps, "Specify Selection as Text"
  (right-click the labware) may take a variable or expression. It sets the **first** well: the
  first selected probe uses it, and other probes follow from it by the Spacing setting. Wells are
  given as numbers, counted left to right and then down (A1 = 1, A12 = 12, B1 = 13 on a 96-well
  plate). *(B56358AF, 22-50 and 22-58; the Serial Dilution step says the same, 22-32.)* Verified in
  simulation, and it works in the Transfer step too (see "Worklist-driven steps", below).
- The other documented way to choose wells from a file is the **Define Pattern** step, which can
  read a pattern from a comma-delimited file. In a Loop, the pattern can change on each iteration
  as defined by the file. *(B56358AF, 27-14 onward.)*

## Worklist-driven steps
*(Verified in simulation, 2026-10-21, on our Biomek i5 Span-8, BC230 and BC1070 tips, BCFlat96
plates named `Source` and `Dest`. Methods `test1`–`test21` and their files are in
`C:\Users\Beckman Coulter\Desktop\Andy\Tests`. "Worked" means it validated and the simulation did
what the file said.)*

**What a worklist row can set**

| Setting | Where | How | Result |
|---|---|---|---|
| Source and destination well | Span-8 Aspirate and Dispense; Transfer | right-click the plate graphic → Specify Selection as Text → `=SrcWell` | works, with **well numbers** only |
| Volume | Aspirate, Dispense, Transfer | Volume `=Volume` | works |
| Labware (plate) | Aspirate, Dispense, Transfer | Position `=SrcPlate`, a labware name | works |
| Transfer file | Transfer From File | File Name `=TransferFile`, a full path | works; columns must be numbers (below) |
| Liquid type | Transfer From File, source and destination | `=LiquidType` | works |
| Technique | Transfer From File, source and destination | `=Technique` | works |
| Probes | Load Tips; Transfer From File | right-click a probe number → Specify Selection as Text → `=Probes` | works, e.g. `"1,2,3,4"` |
| Tip type | Load Tips | tip type `=TipType`, e.g. `BC230`, `BC1070` | works, loads from the matching box |
| Whether to change tips | If step around Unload Tips + Load Tips | condition `NewTip=1` | works |
| Plate's starting volume | Instrument Setup, labware properties, Known volume | `=StartVolume` | works |
| Each well's starting volume | Instrument Setup, Show Well Properties, Amount | `=VolA1` | works |
| Liquid type in Instrument Setup | per well or per plate | `=LiqA1` | **doesn't work**: the field takes the text literally |

**Details**
- **Wells in Specify Selection as Text are numbers,** counted left to right then down
  (number = (row − 1) × columns + column; A1 = 1, B1 = 13, C1 = 25, D1 = 37 checked). Well
  names such as `A1` are rejected, typed or from a variable: *"Bad well expression: =SrcWell"*.
  Transfer From File files accept names (above, and Exp37).
- **If conditions** are a script expression with no leading `=`, e.g. `NewTip=1`; `UnloadProbes<>""`
  tests for an empty value.
- **A worklist runs once per row,** so a one-row file works as "read these settings from a file". A
  **setup worklist** holding the Instrument Setup step, placed before the transfers, supplies the
  starting volumes, and they still apply after its End Worklist. A row of 288 columns was read in
  full.
- **Transfer From File with `=TransferFile`:** Biomek can't read the file in advance (*"Cannot
  display file specified by an expression"*), so the column boxes take **column numbers** (1–5),
  with "File has a header row" checked. Column names typed there don't stick.
- **Probe lists contain commas,** so they are quoted in the worklist: `"1,2,3,4"`.
- **Unload Tips with all eight probes** is fine when some or none of them have tips.
- **Tips stay on between stages** (worklist rows) unless a step unloads them; a later stage can use
  some of the probes that hold tips (test 17).
- **Error messages show the field's expression, not its value,** e.g. *"Unable to find technique
  "=Technique""* for an unknown technique name.

**What validation checks**
- Validation replays the worklist's rows ("passes") and tracks well volumes from Instrument Setup,
  including liquid added by earlier rows. Problems are reported only once validation passes the
  end of the Worklist (e.g. selecting Finish), on the step concerned.
- **Drawing more than a well holds** is caught: *"Error during pass #4: Cannot pipette 180.000 µL;
  the well only has 150.000 µL in it."*
- **Overfilling a tip** is caught: *"Error during pass #1: Too much aspirated into tip(s); max volume
  is 230 µL and a total of 300 µL has been aspirated."* The 230 µL is the total drawn, air gaps
  included.
- **An unknown technique name** is caught: *"Unable to find technique "=Technique"."*
- **A technique that doesn't suit the tip is not caught.** A technique's compatible tip types only
  filter which techniques the step's list offers. A technique set to allow only 1070 µL tips ran
  with BC230 tips, from a variable, with no warning. So the tool must check techniques against tips
  itself.
- A BCFlat96 well's maximum volume is 362.76 µL (labware properties).

**Transfer From File files** *(test 23, 2026-10-21)*
- **A line break after the last row is accepted.** Our files still leave it out, as in Exp37, to keep
  one tested format.
- **A 0 µL row with "Skip zero volume transfers" off goes through the aspirate and dispense motions
  but moves no liquid** (checked on the real instrument; the simulation looks as if it aspirates).
- **Volumes with up to 4 decimal places are accepted and tracked exactly:** 10.5, 10.25, 10.125 and
  10.0625 µL ended up in their wells as written, and the source well held 200 − 40.9375 =
  159.0625 µL.
- **Volumes bigger than the tip (test 24, 2026-10-22):** with "Split large volumes" checked in
  Transfer From File, a 300 µL transfer with BC230 tips validated and ran in 2 trips (the size of
  each trip wasn't visible). The export showed the source well down from 340 to 40 µL and the
  destination at 300 µL. Without it, the same transfer fails validation (test 20). With it checked,
  volumes that fit in one tip (20 and 200 µL with BC230) still take one trip each (test 24b).
- **Decimal places (test 23e, 2026-10-22):** volumes with 1 to 25 decimal places were all accepted.
  The export shows each volume to **15 significant digits**: 10.1234567891234 (13 decimals) came out
  exactly, and anything longer was rounded to 10.1234567891235; a source well showed
  139.876543210876. This is the standard double-precision number Windows programs use (the same as
  JavaScript's numbers), so Biomek keeps as much precision as our tool does.
- **A worklist row naming a file that doesn't exist is caught at validation:** *"Error during pass
  #2: Cannot open file "C:\...\test23d_batch2.csv" : The specified file was not found"*. The row
  isn't skipped (2026-10-22).
- Biomek can **export every well's volume** after a run, as a CSV with the columns
  `SequentialID,Name,Barcode,Well,Volume,Liquid` (one row per well of each labware). This could check
  the tool's contents tracking against Biomek's own.

**Speed** *(test 22, real instrument, air only, 2026-10-22)*

The same 24 transfers of 20 µL, from Source A1–H1 into Dest columns 1–3, keeping the same tips:

| Run | How | Time |
|---|---|---|
| A | row-by-row: one worklist row per transfer, Aspirate + Dispense, probe 1 | 2 min 52 s |
| B | one Transfer From File file, probe 1 | 2 min 52 s |
| C | the same file, all 8 probes | 35 s |

- A worklist row per transfer adds **no measurable time** over Transfer From File with one probe
  (about 7 s per transfer either way).
- **Using 8 probes was about 5 times faster.** The speed comes from probes working side by side, not
  from Transfer From File itself. This layout suited 8 probes perfectly (8 sources in one column into
  8 destinations in one column); other layouts may gain less.
- Each run started with a full tip box: a method's Instrument Setup assumes a full box at the start,
  so used tips must be replaced between real runs.

**"No tip box type specified"** *(2026-10-21 evening; solved 2026-10-22)*
- After test 23b ran on the real instrument and the software was switched back to simulation, methods
  that had validated earlier (tests 14, 15 and 23) failed with *"Error during pass #1: No tip box type
  specified"* on their Transfer From File step. In those methods, tips are loaded by a fixed Load
  BC230 Tips step before the Worklist, and Transfer From File doesn't load tips itself.
- In the failing methods, Transfer From File's tip-type box was empty and its Load box couldn't be
  checked, and the Source section showed no plate graphic. Restarting Biomek Software cleared it for
  one run only; restarting the computer didn't help.
- **Test 19 still validated.** It loads tips inside the Worklist, with the tip type set explicitly
  (`=TipType`), as ADR 0007 plans.
- *Checked the next day, 2026-10-22:* the error was still there after an overnight shutdown. In tests
  14, 15 and 23, with the Transfer From File step fixed to **probe 1 only**, it fails every time, even
  with the step deleted and re-added, and with an Unload Tips (all eight probes) step added at the
  start. With **probe 2 only**, or **all eight probes**, the same methods validate and run every
  time. In a brand-new method, the step's Load box works. Right-clicking Use probes → Use Disposable
  Tips selects all eight probes, so probe 1 isn't set up as a fixed tip.
- **Solved, 2026-10-22:** Transfer From File keeps a **tip type in the box next to Load, even with
  Load unchecked**, and uses it to know which tips are on the probes. When that box is empty, or
  names tips that aren't on the deck (e.g. after removing a BC1070 box), validation fails with *"No
  tip box type specified"* or *"You must specify what tips to use"*. **Fix:** check Load (it may only
  allow this after clicking between steps and toggling settings back and forth), choose the tip type,
  then uncheck Load; the tip type stays. Fixed tests 14 and 22b. Why probe 2 alone or all eight
  probes worked without it is not known.
- The box accepts a variable: with `=TipType` there (Load still unchecked), test 22b validated and
  ran. So with stages of different tip types, the box follows the stage's tip type.

## Methods and their files
- A method can be exported as a `.bmf` file, which carries everything needed to run it, or as a
  `.json` file, which carries only the steps and their settings; labware and techniques must already
  exist in the project that imports it. *(B56358AF, 13-11 and 13-14.)*
- The manual doesn't describe the structure of the `.json` file. Writing one ourselves would mean
  copying the structure of an exported method, which could break with any software update. *(No
  description found in B56358AF, chapter 13; checked 2026-10-20.)*
- `.csv` files used by Transfer From File, Worklist and Define Pattern steps are **not** included
  in exported `.bmf` or `.imp` files. They must be copied to the other computer separately.
  *(B56358AF, 13-11.)*
- Project items (techniques, labware, tip types) are exported separately, as an `.imp` file.
  *(B56358AF, 13-11; chapter 6.)*

## Script steps
- The Script and Scripted Let steps run VBScript or JScript inside a method, but are "not currently
  supported for end-user applications". *(B56358AF, 27-9 and 27-11.)* Our tools don't rely on them.

## Running safely
- **Simulation mode** runs a method on an animated model of the instrument, with no liquid or tips
  used. Choose "Simulate" under Utilities > Hardware Setup; note the original name to switch back.
  The instrument must be homed when switching back to hardware. *(B54473AD, 8-17.)*
- Lab rule: run every new method, or new set of files, in simulation before a real run.
  *(Lab practice.)*

## Interruptions and logs
- **Light curtain break:** the instrument stops; pressing OK on the message moves the pods back and
  the method resumes. An aspirate or dispense that was cut off is not resumed part-way: "The entire
  pipetting operation must be restarted." *(B56358AF, A-15 and A-16.)* Don't use the light curtain
  to pause a method; it may affect pipetting. Use Pause. *(B54473AD, Safety Notice.)*
- **Run-time errors** offer Retry (repeat the interrupted move, then continue), Ignore (skip it and
  continue; the manual warns this can cause mishandled labware or collisions) or Abort.
  *(B56358AF, A-13 to A-15.)*
- **After an Abort** (and so, presumably, a power loss), "the method may not be continued from the
  point the error occurred." *(B56358AF, A-17.)* The manual describes no restart. Ways to rerun only
  what's left: disable steps that already ran ("Biomek Software ignores any disabled steps",
  B56358AF, 12-17), and start a Worklist from a later row with "Loop from line" (27-9). Instrument
  Setup then has to match what is actually left in the wells.
- **Logs** are all on by default, in `C:\Users\Public\Public Documents\Biomek5\Logs`, as text files.
  Every log's header gives the method and its start time, each line starts with a date and time,
  and the last line gives the time the method ended. *(B56358AF, 16-7 to 16-9.)*
  - **Span8Transfer** log: one line per transfer, with source and destination position, labware
    name and well number, probe, amount and technique. *(16-12, 16-13.)*
  - **Span8Pipetting** log: one line per aspirate and per dispense, with position, labware name, well
    number, amount and technique. *(16-11, 16-12.)*
  - **Errors** log: each error or interruption, with its exact message. *(16-10.)*

## Liquid types
- **Liquid type names** may contain only letters, digits and underscores, and must start with a
  letter. *(B56358AF, 9-4.)*
- A liquid type sets how liquid is drawn and pushed: aspirate and dispense speeds (µL/s), delays,
  trailing air gap and blowout volumes, and prewet overage. A technique sets heights and
  movements, and can override the liquid type's values. *(B56358AF, 7-8 to 7-12 and 9-3.)*

## Volumes and tips
*(Project training log, 2026-10-06, unless noted.)*
- A 1 mL syringe holds about 1000 µL per draw, including air gaps.
- BC230 tips hold about 200 µL of liquid per trip. For more, use "Split large volumes" or 1070 µL
  tips.
- Beckman publishes no accuracy specification per syringe size. Before relying on volumes below
  about 20 µL, check them gravimetrically or with dye.
- Each technique's volume range sets its practical minimum (see the Technique Browser).

## Not yet known
Questions to answer before relying on the answer:
- The largest volume accepted in a volume column.
- Where exactly the per-well volume export is in the software.
- Whether a real run behaves like simulation for everything in "Worklist-driven steps", in
  particular that a technique unsuited to the tip still isn't caught.
- Whether Transfer From File's source and destination **labware type** can come from variables
  (e.g. `=SrcType`). If not, a method needs one Transfer From File step per combination of labware
  types.
- What happens with an **unknown liquid type name** from a variable (`=LiquidType`): whether
  validation catches it, as it does an unknown technique, or Biomek uses the default liquid type
  (B56358AF, 9-1) without a warning.
- Whether a labware's **type in Instrument Setup** can come from a variable. If not, putting a
  different plate type in a deck position means changing the general-purpose method, whatever the
  tool stores.
- Whether a **reservoir's** per-trough starting volumes can come from variables in Show Well
  Properties, as plate wells can (test 8).
- Whether **8 probes can draw from one reservoir trough** at the same time in Transfer From File.
- Whether a technique's **dispense touches the liquid** already in the destination well, for
  example because of its dispense height. A tip that touches the liquid can carry it to later wells
  (roadmap idea "Possible contamination").
- Whether the logs are written line by line as the run goes, so that after an Abort or a power loss
  the Span8Transfer log lists every transfer that was done. To test: abort a run part-way and
  compare the log with what happened. Also try a light-curtain break mid-run, and restarting a
  Worklist from a later row with "Loop from line".
