# Exp37: the lab's first file-driven Biomek method

How Exp37 was set up on the Biomek. It is the only method so far that ran from generated files, so it is
the working example for any tool that writes Biomek files. Facts about the software in general are in
`biomek.md`.

Sources, unless noted:
- **Exp37 package**: the 62 transfer files and their guide, `Biomek_Randomized_Plate_Transfer_Files_V1.docx`.
  The files were made with `randomizer_V3.xlsx` (seed 37) and run on the Biomek; the package is dated
  2026-10-14.
- **Exp37 deck layout workbook** (`Exp37_Biomek_Deck_Layout`, Transfer Steps sheet).

These are Andy's files, not committed.

## The experiment in short
- There are two culture plates, `MsNAC` and `SF9`, with the same randomized layout.
- There are 12 conditions, in deep wells D1–D12 of `Deep`.
- The 36 outer wells of each plate always hold PBS. The 60 inside wells (rows B–G, columns 2–11) are
  shuffled with a seed.

## Method Exp37_V0
| Step | What it does | Files |
|---|---|---|
| 8 | Media: one Transfer From File step per condition, 100 µL from its deep well into its wells on both plates | 12 (`Step8a` … `Step8l`, one letter per condition, D1 = a) |
| 9 | PBS: 200 µL into every PBS well on both plates, from reservoir wells 5, 6, then 7, 32 transfers each | 1 |
| 10–13 | Cells, then mixing, run by a Worklist step (below) | 48 (12 per step) |
| 10 | The worklist itself | 1 |

That makes 62 files in all.

- **Step 8 is fixed to 12 conditions.** For a different number of conditions, add or remove Transfer
  From File steps in the method, one per condition.
- **Steps 10–13 adapt** to any number of conditions, because the worklist lists the files.

### The cell worklist (step 10)
*(Exp37 deck layout workbook.)*
- The loop variable is `row`, and the step loops over the entire worklist. The columns are
  `CellFile,MixFile`.
- Inside the loop:
  - Transfer From File `=CellFile`: 50 µL, BC230 tip on probe 1, load and keep the tip, aspirate
    mix 75 µL × 2.
  - Transfer From File `=MixFile`: 100 µL, the same tip, then unload.
- Cells come from `Deep` F1/F2 for `MsNAC` and H1/H2 for `SF9`. They alternate by condition:
  conditions a, c, e … use the first well, and b, d, f … the second.
- The worklist was used because Transfer From File doesn't keep row order (`biomek.md`), and the
  cells must be mixed before every draw.

## Labware and deck
| Name in the method | What it is | Notes |
|---|---|---|
| `Res` | 12-well reservoir, vertical troughs, wells numbered 1–12 | PBS in 5, 6, 7 |
| `Deep` | 96 deep-well plate, about 2.2 mL per well | Conditions D1–D12; cells F1/F2, H1/H2 |
| `MsNAC`, `SF9` | 96-well culture plates | Same layout on both |

**Dead volumes,** measured by Andy on 2026-10-08:
- reservoir trough: 2 mL;
- deep well: 200 µL.

## File conventions that worked
Every Exp37 file follows these rules. Rules the manual requires are marked; the rest are our
convention, and the software may accept more.
- The header is exactly `SourceLabware,SourceWell,DestLabware,DestWell,Volume`. (A header row is
  optional to the software; this one is ours.)
- Labware names match the method exactly (manual: `biomek.md`).
- Reservoir wells are written as numbers (`5`); plate wells as letter + number (`D3`). (The manual
  allows either form for any labware.)
- Volumes are whole microliters.
- The text is plain ASCII, with commas only, no spaces and no blank lines, CRLF line endings, and
  **no line break after the last row**.
- Rows are in well column order (A1, B1 … H1, A2 …), plate `MsNAC` first, then `SF9`.

## Folder layout on the Biomek PC
The worklist holds **full paths**, so the run folder must be exactly
`C:\Users\Beckman Coulter\Desktop\<Experiment ID>\` (for example `...\Desktop\Exp37\`).

```
Exp37\
    Exp37_Step9_PBS.csv
    Exp37_Step10_Worklist.csv
    Step8_Media_seed37\       Exp37_Step8a.csv … Exp37_Step8l.csv
    Step10-13_Cells\
        Step10_MsNAC_cells\   Exp37_Step10a.csv … Exp37_Step10l.csv
        Step11_MsNAC_mix\     Exp37_Step11a.csv … Exp37_Step11l.csv
        Step12_SF9_cells\     Exp37_Step12a.csv … Exp37_Step12l.csv
        Step13_SF9_mix\       Exp37_Step13a.csv … Exp37_Step13l.csv
```

If the Biomek can't find a file, check three things:
- the folder is at that Desktop path;
- the Experiment ID matches;
- the names end in `.csv`, not `.csv.txt`.

## Earlier tools for Exp37
These came before biomek-tools; they are references, not code to copy:
- `randomizer_V2.xlsx` and `randomizer_V3.xlsx`, the spreadsheet randomizers;
- `Randomizer_V7.html`, a single-file tool that wrote all 62 files.

biomek-tools' randomizer is a general rewrite with its own random generator (ADR 0003), so a seed from
the spreadsheets doesn't give the same plate in it.
