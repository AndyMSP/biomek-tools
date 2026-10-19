# Biomek i5 (Span-8): verified facts

Each fact gives its source. Manuals are cited by part number and section; they are not committed.

## Transfer From File step
- Reads a comma-delimited text file (`.txt` or `.csv`); each row is one well-to-well transfer.
  *(B56358AF, ch. 22, Transfer From File Step, p. 22-2 and 22-8.)*
- Columns can give source position, source well, destination position, destination well and volume;
  which column means what is chosen in the step, and the file may have a header row.
  *(B56358AF, ch. 22, p. 22-8 to 22-12.)*
- Positions may be deck positions (`P4`) or labware names (`Source1`); a named labware must exist on
  the deck. *(B56358AF, ch. 22, p. 22-11 and 22-12.)*
- Wells may be alphanumeric (`A1`–`H12`) or numbered (1–96), even mixed in one file.
  *(B56358AF, ch. 22, p. 22-11 and 22-12.)*
- Volumes are in µL. "Skip zero volume transfers" ignores rows with volume 0.
  *(B56358AF, ch. 22, p. 22-12.)*

## Files that ran on the instrument (Exp37, October 2026)
Source: the Exp37 files and the guide "Biomek Randomized Plate Transfer Files" (Andrew Stone,
2026-10-13/14); verified on instrument with method Exp37_V0.
- Header exactly `SourceLabware,SourceWell,DestLabware,DestWell,Volume`.
- Plain ASCII, commas only, no spaces, CRLF line endings, no blank lines, no line after the last row.
- Reservoir wells are plain numbers (`5`), plate wells letter + number (`D3`).
- Worklist: header `CellFile,MixFile`; each row holds full Windows paths, so the run folder must sit
  at `C:\Users\Beckman Coulter\Desktop\<Experiment ID>\`.
- Exp37 method values (labware names, wells, volumes) are in `config/exp37-method.js`.

## Not yet confirmed
- Whether a line break after the last row is actually rejected, or only our convention.
- The largest volume and number of decimal places the Volume column accepts.
