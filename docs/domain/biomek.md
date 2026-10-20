# Biomek i5 and Biomek Software

Facts about the instrument and its software that the tools rely on. Each fact gives its source:
a manual part number with chapter and page, or an observation on the instrument with its date.
Manuals are cited, not committed. They are in the claude.ai project "Biomek Implementation".

Manuals cited:
- **B56358AF**: Biomek i-Series Software Reference Manual.
- **B54473AD**: Biomek i-Series instructions manual, including the tutorials.

Last checked against the manuals: 2026-10-20.

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
- Does the software reject a file with a line break after the last row, or is "no final line break"
  only our convention from Exp37?
- The largest volume, and the number of decimal places, accepted in a volume column.
- What happens when a worklist row names a file that doesn't exist: an error, or a skipped row?
