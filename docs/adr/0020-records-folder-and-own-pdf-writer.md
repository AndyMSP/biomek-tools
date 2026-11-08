# 20. Files for people go in a Records folder, and PDFs are written by our own code

Date: 2026-11-08

## Status
Proposed (Andy, 2026-11-08: decided while shaping previews that day; written in the hands-off
workflow, so it stands as a proposal until he merges its pull request).

## Context
Write files saves one zip holding the run's folder, with the files the Biomek reads (`Setup.csv`,
`Stages.csv` and the Transfer From File files; `file-writer.md`). Andy wants files for people in the
same zip: a sheet saying which Biomek name each labware has (its label in the plan, e.g.
`Feeding DWP` is `Deep1`), and, for each randomization, a well map for data analysis.

Two questions came up:
1. **Where in the zip.** The run's folder is what the method is pointed at on the Biomek PC. Extra
   CSV files there look like Biomek files and aren't.
2. **What format the sheet is.** Lab PCs must open the tools' outputs with nothing installed
   (CLAUDE.md). Previews of the same sheet as a PDF and as an HTML page were compared (2026-11-08).
   HTML is simpler to make and its tables paste into Excel as columns; a PDF is a fixed page, the
   usual format for a record, opened by Edge's own viewer. Making a PDF in the browser usually means
   a library (a new dependency, a few hundred kilobytes). A PDF that uses only the fonts every PDF
   reader has built in (Helvetica) can be written as plain ASCII text, so it fits the project's own
   `zip` module, which takes text, unchanged.

## Decision
- **Files for people go in a `Records` folder inside the run's folder** (Andy, 2026-11-08), so the
  Biomek's files stay exactly as they were, and the records can be copied elsewhere in one go:
  `<run folder>/Records/Labware sheet.pdf`, and later the well maps.
- **The labware sheet is a PDF** (Andy, 2026-11-08), one page: the experiment name, the zip's name,
  when it was made, a table of each labware the plan uses (its label, Biomek name, labware type,
  and whether it's filled before the run or starts empty), the deck's labware the plan doesn't use,
  and the tips the run uses of each type. No check boxes (tried and dropped, 2026-11-08), no wells
  (tried and dropped: the sheet's job is the labware's names).
- **The PDF is written by our own code**, a shared module `pdf`, as zips are by `zip` (Andy,
  2026-10-28, for the zip): only what the project needs (text in Helvetica and Helvetica-Bold,
  lines, gray boxes), written as plain ASCII, so it's short enough to read and check in full and adds
  no dependency. Andy asked how big it is before deciding (about 60 lines in the preview; a few
  hundred with the project's comments, checks and tests).
- **The zip itself is unchanged** (Andy, 2026-11-08): it still holds the run's folder. Windows'
  Extract All suggests a folder named after the zip, so the run's folder lands one level down when
  extracted to the default place; changing the zip or its message was considered and declined, as
  either could confuse.

## Consequences
- Text on the sheet can be selected, copied and searched, but a PDF has no table structure: a table
  copied from it pastes as text, not columns, as in most published PDFs (2026-11-08). Data meant for
  analysis goes in CSV files beside it, as the well maps do.
- Only characters Helvetica has in the PDF's standard Windows character set can appear. A label
  holding other characters (an arrow, Greek letters, Chinese) shows `?` in their place on the sheet;
  the plan and the page are unaffected.
- The `Records` folder is the place for any later file meant for people rather than the Biomek.
- A PDF needing more (other fonts, images, many pages of flowing text) would mean revisiting this
  decision, probably for a library.
