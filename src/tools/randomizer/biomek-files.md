# biomek-files — specification

> Experiment branch: written without section-by-section review. Exp37 method only.

## 1. Purpose
`biomek-files.js` turns a randomized plate into the Transfer From File and Worklist files of the
Exp37 Biomek method (Exp37_V0), using the values in `config/exp37-method.js`. The rules come from
the guide "Biomek Randomized Plate Transfer Files" (whose Exp37 files ran on the instrument) and
the Biomek software manual B56358AF, chapter 22, Transfer From File Step.

## 2. Files
Both culture plates (`MsNAC`, `SF9`) get the same layout. For experiment ID `Exp37` and seed 37:

| File | Path in the run folder | Rows after the header |
|---|---|---|
| Media, one per condition | `Step8_Media_seed37/Exp37_Step8a.csv` … | Deep source well of that condition → its replicate wells, 100 µL, plate 1 then plate 2 |
| PBS | `Exp37_Step9_PBS.csv` | Res wells 5, 6, 7 (32 transfers each, in turn) → every well holding `PBS`, 200 µL, plate 1 then plate 2 |
| Cells, per plate and condition | `Step10-13_Cells/Step10_MsNAC_cells/Exp37_Step10a.csv` …, `Step12_SF9_cells/Exp37_Step12a.csv` … | Deep F1/F2 (MsNAC) or H1/H2 (SF9), alternating by condition → that condition's wells, 50 µL |
| Mix, per plate and condition | `Step10-13_Cells/Step11_MsNAC_mix/Exp37_Step11a.csv` …, `Step13_SF9_mix/…` | Each of that condition's wells to itself, 100 µL |
| Worklist | `Exp37_Step10_Worklist.csv` | One row per cell file and its mix file: MsNAC a… then SF9 a…, full Windows paths |

- Letters follow the condition list: row 1 = `a` … row 26 = `z`, row 27 = `aa`.
- Transfer files start with exactly `SourceLabware,SourceWell,DestLabware,DestWell,Volume`; the
  worklist with `CellFile,MixFile`.
- Plain ASCII, commas only, no spaces, CRLF between lines, no blank lines, no line break after the
  last row.
- Wells run down each column (A1, B1 … H1, then A2).
- Everything sits in one folder named after the experiment ID, downloaded as one zip. The worklist's
  paths assume it is unzipped to `C:\Users\Beckman Coulter\Desktop\<experiment ID>\`.

## 3. Interface
| Export | Description |
|---|---|
| `findBiomekProblems(inputs, result, method, experimentId)` | Problems that stop the files being made, as messages. |
| `uncoveredContents(inputs, result, method)` | Contents on the plate that no file fills (e.g. an override `Blank`), as rows `{ contents, wells }`. They must be added by hand. |
| `buildBiomekFiles(inputs, result, method, experimentId)` | The files, as `{ path, text }` with `/` between folders, inside a folder named after the experiment ID. |

## 4. Problems
| Problem | Message |
|---|---|
| Experiment ID empty or with characters other than letters, digits, `-` and `_` | `Give an experiment ID of letters, digits, - and _ only, like Exp37.` |
| More conditions than source wells | `The Exp37 method has source wells for 12 conditions, but 13 are listed.` |
| More PBS wells than the reservoir wells supply | `The plates need 100 PBS transfers, but reservoir wells 5, 6, 7 supply 96.` |

## 5. Test cases
- A small known plate gives exactly the expected text for a media, PBS, cell, mix and worklist file.
- The main example (with filler and fixed contents `PBS`) gives 12 + 1 + 24 + 24 + 1 = 62 files.
- Every file follows the format rules in section 2.
- Each problem above; uncovered contents are listed.
