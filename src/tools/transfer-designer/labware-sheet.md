# labware-sheet — specification

> **Draft (2026-11-08).** Written for v0.2.0 in the hands-off workflow (CLAUDE.md, "Workflows"), from
> a preview Andy shaped and approved on 2026-11-08 (ADR 0020). It becomes Final once Andy has tested
> the page built from it and opened a sheet in Edge.

## 1. Purpose
`labware-sheet.js` makes the **labware sheet** (`docs/glossary.md`): a one-page PDF saying, for a
plan, which Biomek name each labware has. Each labware the plan uses is listed by its label, as the
user knows it (e.g. `Feeding DWP`), beside its name in the deck description, as the Biomek knows it
(e.g. `Deep1`), with its labware type and whether it's filled before the run. Below, the deck's
labware the plan doesn't use, and the tips the run uses. It's a record kept with the run's files, in
their `Records` folder (ADR 0020), so it also names the zip it came with.

It's part of the transfer designer, not shared: it reads the transfer designer's plan. It writes the
PDF with the shared `pdf` module (`pdf.md`). The page puts it in the zip (`transfer-designer-page.md`,
section 5).

## 2. Scope
Version 1 is one page, US Letter. The deck description holds ten labware and two tip types, so the
sheet always fits; a test checks that it does for the deck in `config/` (section 6).

Not in version 1: wells, volumes or contents (tried in a preview and dropped, 2026-11-08: the sheet's
job is the labware's names); check boxes (tried and dropped); where each labware sits on the deck
(the tool never knows deck positions; ADR 0007).

## 3. Data model

### Inputs
- **The plan**, as the transfer designer keeps it (`transfer-designer.md`). Plans are made only
  through the transfer designer's checks, so the plan isn't checked again.
- **The folder name**: the run's folder name from the file writer (`folderNameFor`, `file-writer.md`),
  e.g. `2026-11-08_134118_Exp36-feeding`. Text, not blank.
- **When it was made**: a valid JavaScript `Date`, the moment the files were worked out (the caller
  passes the moment the folder name was made from), shown in the computer's local time. Like the file
  writer, the module never reads the clock itself.

### What the sheet holds
`labwareSheetContent(plan, folderName, made)` gives the sheet's content as plain data:
- `experimentName`: the plan's experiment name, passed through `toPdfText` (`pdf.md`).
- `zipName`: the folder name and `.zip`, e.g. `2026-11-08_134118_Exp36-feeding.zip`, passed through
  `toPdfText`. (The file writer's names never need it; cleaning them anyway means the module never
  passes the PDF text it can't show, whatever it's given; from the build's review, 2026-11-08.)
- `made`: the moment, written `YYYY-MM-DD HH:MM` (24-hour clock, leading zeros), e.g.
  `2026-11-08 13:41`.
- `labware`: one entry per labware the plan uses (`labwareUsed`, `transfer-designer.md`: starting
  contents, transfers and well labels), in the deck's order, each `{ label, name, labwareType,
  beforeRun }`:
  - `label`: `labelOf(plan, name)` (`transfer-designer.md`: its labware label, or its name with
    none), passed through `toPdfText` (`pdf.md`), so a character the PDF can't show becomes `?`;
  - `name`: its name in the deck description, e.g. `Deep1`;
  - `labwareType`: its labware type (`labwareTypeOf`, `deck.md`), e.g. `BCDeep96Square`;
  - `beforeRun`: `"Fill first"` if any of its wells has starting contents, otherwise
    `"Starts empty"`.
- `unused`: the names of the deck's labware not in `labware`, in the deck's order (`labwareNames`,
  `deck.md`), e.g. `["Plate2", "Plate3"]`; `[]` if the plan uses them all.
- `tips`: the tips the run uses, `tipsUsed(plan)` (`transfer-designer.md`), e.g.
  `[{ tipType: "BC230", count: 20 }, { tipType: "BC1070", count: 16 }]`.

### The page's layout
`labwareSheetPages(content)` lays the content out as the pages `writePdf` takes (`pdf.md`): one page
of `LABWARE_SHEET_PAGE`'s size (`config/records.js`, section 4), with these items, top to bottom.
Positions are in points from the bottom-left corner (`pdf.md`, "Coordinates"); `y` is a running
position that starts at the page's height less the margin, 54, and moves down by the amounts given.
The left edge is 54 and the right edge is the page's width less 54 (558 on Letter); every item is
black unless a gray is given. These numbers match the preview Andy approved.

1. `Labware sheet`, bold, 18. Then `y` down 22.
2. `Plan: <experimentName>`, 10. Then `y` down 14.
3. `Files:`, 10, then the zip's name, bold, 10, starting at 54 + the width of `Files: ` (with its
   space; `textWidth`). With a 40-character name of wide letters this can pass the right edge by a
   few dozen points, still on the paper; real names fit, and it isn't shortened. Then `y` down 14.
4. `Sheet made: <made>`, 10. Then `y` down 28.
5. `Labware`, bold, 13. Then `y` down 8.
6. **The labware table**, with columns starting at 54, 184, 294 and 424, headed `Your label`,
   `Biomek name`, `Labware type` and `Before the run`:
   - the heading row: a box from the left edge to the right edge, from `y` − 18 up to `y`, gray
     0.92; then `y` down 13 and each heading, bold, 10, at its column's start + 4; then `y` down 5;
   - each row: `y` down 18; its four values, 10, each at its column's start + 4, the Biomek name
     bold; a line 0.3 thick from the left edge to the right edge at `y` − 6.
   - **A label too wide for its column** (its width at 10 more than 122 points, the column's 130 less
     4 on each side) is shortened: characters are dropped from its end, and `...` added, until it
     fits, e.g. a long label ending `…Plate for the drug screen` shows as `…Plate for the dru...`.
7. `y` down 22 (whether or not anything follows). If `unused` isn't empty: `Not used in this plan:
   ` and the names separated by `, `, 9.5, at x 54. If that's wider than the page between the edges
   (`textWidth`), it's broken into lines **greedily**: each line takes as many names as fit, breaks
   just after a comma, dropping the space that followed it, and the next line starts at x 54, `y`
   down 13 for each further line.
8. `y` down 34. `Tips`, bold, 13. Then `y` down 8.
9. **The tips table**, as the labware table, with columns starting at 54 and 184, headed `Tip type`
   and `Tips used`, a row per entry of `tips`: its tip type, bold, and its count. With no tips (a plan
   without transfers): instead of the table, `y` down 13 and `No tips: the plan has no transfers.`,
   10. (The page never shows this: the file writer refuses a plan without transfers first. It's here
   so the module handles every plan.)

`labwareSheet(plan, folderName, made)` gives the file: `{ name: LABWARE_SHEET_FILE_NAME, text }`,
`text` being `writePdf(labwareSheetPages(labwareSheetContent(plan, folderName, made)))`.

## 4. Interface
| Function | Takes | Returns |
|---|---|---|
| `labwareSheetContent(plan, folderName, made)` | section 3's inputs | the content (section 3), a new object each time |
| `labwareSheetPages(content)` | content as `labwareSheetContent` gives it | the pages for `writePdf`: a list of one page |
| `labwareSheet(plan, folderName, made)` | section 3's inputs | `{ name, text }`: the file's name in the `Records` folder and the PDF's text |

None changes its inputs.

### Configuration
A new configuration file, **`config/records.js`** (data only; ADR 0009), holds the files for people
that go in the zip (ADR 0020):
- `RECORDS_FOLDER`: `"Records"`, the folder inside the run's folder that holds them;
- `LABWARE_SHEET_FILE_NAME`: `"Labware sheet.pdf"`;
- `LABWARE_SHEET_PAGE`: `{ width: 612, height: 792 }`, US Letter in points.

This module's tests check the file (ADR 0009): `RECORDS_FOLDER` and `LABWARE_SHEET_FILE_NAME` are
names `zip` accepts in a path (printable ASCII, no `/` or `\`, not `.` or `..`), the file name ends
`.pdf`, and the page's size is one `writePdf` accepts.

### The REPL
`scripts/repl.js` gains a topic, `labware-sheet`, with the three functions and a small plan ready to
try, e.g. `labwareSheetContent(plan, "2026-11-08_134118_Exp36", new Date())`.

## 5. Errors
These are mistakes in the calling code, not in what a user typed. Values are shown with
`describeValue` (`error-messages` module).

| Problem | Message |
|---|---|
| The folder name isn't text, or is blank | `The folder name for the labware sheet must be text, like "2026-11-08_134118_Exp36", but got null.` |
| `made` isn't a valid `Date` | `When the labware sheet was made must be a valid date, but got "2026-11-08".` |

The folder name is checked before the date.

## 6. Test cases
Each becomes at least one unit test in `labware-sheet.test.js`, inside `describe("labware-sheet",
…)`. Tests build plans with the transfer designer's own edits, and work out labware names, types and
counts from `config/` (CLAUDE.md, "Tests follow config/"): labware is picked from `labwareNames()`
by its labware type (e.g. the first and second deep-well plates, the first reservoir), never named,
so `Res1`, `Deep1` and `Deep2` below stand for those picks. A plan whose content is compared is given
an experiment name (`setExperimentName`), so the name is checked.

**The content**
- A plan with starting contents in `Res1`, a transfer from `Res1` into `Deep1`, a well label on
  `Deep2` and labels `Res A` on `Res1` and `Feeding DWP` on `Deep1` gives `labware` in the deck's
  order: `Feeding DWP`/`Deep1`/its type/`Starts empty`, `Deep2`/`Deep2`/its type/`Starts empty`
  (no label: its name), `Res A`/`Res1`/its type/`Fill first`; `unused` is every other labware in
  the deck's order.
- A labware with only a labware label and nothing else isn't listed (`labwareUsed` counts well
  labels but not labware labels).
- `zipName` is the folder name and `.zip`; `made` for `new Date(2026, 10, 8, 9, 5, 7)` is
  `2026-11-08 09:05`.
- `tips` equals `tipsUsed(plan)`; a plan without transfers gives `[]`.
- A label `Drug → plate` gives `Drug ? plate`; a folder name holding `→` gives a `zipName` with `?`.
- The plan is unchanged afterwards.

**The layout**
- The page is `LABWARE_SHEET_PAGE`'s size.
- The title, plan, files, made and heading lines are at the section 3 positions, worked out from
  `LABWARE_SHEET_PAGE` (CLAUDE.md, "Tests follow config/"): the title at its height − 54, `Plan:` 22
  below it, the zip's name at x 54 + `textWidth("Files: ", 10, false)`, the right edge at its width −
  54. (On Letter: 738, 716 and 558.)
- The labware table: its heading box, then per row its values at the column starts + 4 and its line,
  each row 18 points below the last; the Biomek name bold and the others regular.
- A label of 40 `W`s is shortened to fit 122 points and ends `...`; a label that fits isn't changed.
- No unused labware: no `Not used` line. Content given directly to `labwareSheetPages` with 30
  unused names of 20 characters each gives several lines, each within the edges and ending with a
  comma except the last.
- No tips: `No tips: the plan has no transfers.` and no tips table.
- The deck in `config/` with every labware used and every tip type gives a page whose lowest item
  is above the bottom margin (54).

**The file**
- `labwareSheet` gives `LABWARE_SHEET_FILE_NAME` and text that starts `%PDF-1.4` and holds each
  label, Biomek name, type and the zip's name as PDF strings.

**The configuration** (section 4), and **refusing** (section 5): each row's message.
