# well-maps — specification

> **Draft (2026-11-08).** Written for v0.2.0 in the hands-off workflow (CLAUDE.md, "Workflows"), from
> a preview Andy shaped and approved on 2026-11-08 (item 26 of v0.2.0; ADR 0020). It becomes Final
> once Andy has tested the page built from it and used a well map in his analysis.

## 1. Purpose
`well-maps.js` makes each randomization's **well map** (`docs/glossary.md`): a CSV file listing, for
every well the randomization filled from one of its sources, the plate, the well, and which source
it got. It's for **data analysis** (Andy, 2026-11-08): one row per well, so it can be sorted,
filtered and looked up against plate-reader results in Excel. It goes in the run's `Records` folder
in the Biomek files' zip (ADR 0020), named after the randomization.

It's part of the transfer designer, not shared: it reads the transfer designer's plan. The page puts
the files in the zip (`transfer-designer-page.md`, section 5).

## 2. Scope
Not in version 1, decided with Andy on 2026-11-08:
- **The filler.** Wells filled from filler wells aren't listed: the map holds the wells compared in
  the analysis. (A missing well then looks the same as an empty one; Andy accepted this, and it can
  be added later.)
- **The labware's Biomek name.** The `Plate` column holds the label only, the name the user knows
  (or the Biomek name when the labware has no label, as everywhere a label is shown).
- **A plate-shaped grid** (rows A to H, columns 1 to 12). Considered; the list suits analysis.
- **Excel's own reading of labels.** A field is written exactly as the label is. Excel, opening the
  file by double-click, reads a field starting `+`, `-`, `=` or `@` as a formula (`+ctrl` shows
  `#NAME?`) and some like `1-2` as dates; R and pandas read them as written. Kept exact (2026-11-08)
  so analysis code gets the real labels; in Excel, Data → From Text/CSV with the column set to Text
  keeps them, and labels like `ctrl+` avoid it.
- **The component name** for a source without a well label: it's named by its well (`Res1 9`), not
  by what it holds, since the label is what the user gave it for analysis.
- **Which source well**, when several sources share a label: they appear under the one label, which
  is what analysis wants (the same condition).

## 3. Data model

### Inputs
**The plan**, as the transfer designer keeps it (`transfer-designer.md`). Plans are made only
through the transfer designer's checks, so the plan isn't checked again. The caller makes well maps
only when no randomization is out of date (the page checks this before writing files; section 5 of
`transfer-designer-page.md`), so each randomization's stages match its sources.

### Output
`wellMaps(plan)` gives one file per randomization that has run (its `stages` isn't empty), in the
order of the plan's `randomizations`, each `{ name, text }`:
- `name`: the randomization's name, then ` well map.csv`, e.g. `HySoy_dose well map.csv`. Names
  follow the experiment name's rule and are unique in the plan (`transfer-designer.md`,
  "Randomizations"), so file names are plain ASCII, and never collide with each other or with
  `LABWARE_SHEET_FILE_NAME` (it doesn't end ` well map.csv`).
- `text`: the CSV (below).

A randomization that hasn't run has no file. A plan without randomizations gives `[]`.

### The CSV
- **A header row,** `Plate,Well,Source`, then **one row per well**: for each stage the randomization
  owns (`stages`) whose well is one of its sources with `filler: false`, each transfer of that stage
  (`transfersIn`) gives a row for its destination:
  - `Plate`: the destination labware's label, or its name with none (`labelOf`), e.g.
    `Feeding DWP` or `Plate1`;
  - `Well`: the destination's well name, e.g. `B2` (or `5` on a reservoir);
  - `Source`: the source well's well label (`wellLabelOf`), or, with none, its labware's name, a
    space and its well name, e.g. `Hy-Soy 100 g/L` or `Res1 9`. (The Biomek name, not the label,
    so `Res1 9` reads as a well, since a labware label may hold spaces.)
- **Order:** rows by destination labware in the deck's order (`labwareNames`), then by well in its
  grid's order (`gridOf(labware).wellNames()`, `deck.md` and `well-grid.md`: `A1, A2 … A12, B1 …`), whatever order the stages and
  transfers come in. A well appears once: a randomization fills each of its wells to fill once.
- **The CSV's rules** (as the file writer's, `file-writer.md`, "How values are written", except for
  the BOM): every line ends with **CRLF**, the last included; a field holding a comma, a double quote,
  or a line break is put in double quotes, with each double quote inside doubled (**RFC 4180**), e.g.
  `"Drug ""A"", 10 mM"`; no other field is quoted.
- **A UTF-8 byte order mark** (BOM, the hidden character written `\uFEFF` in JavaScript) starts the text, unlike the Biomek's
  files (2026-11-08): labels can hold `µ`, and Excel reads a CSV without one in the wrong character
  set, showing `Âµ`. Excel, R's readr and Python's pandas all read the BOM correctly. The `zip`
  module stores the text as UTF-8, so the file starts with the bytes `EF BB BF`.

## 4. Interface
| Function | Takes | Returns |
|---|---|---|
| `wellMaps(plan)` | a plan | the files, a list of `{ name, text }` (section 3), new each time |

It doesn't change the plan.

`WELL_MAP_SUFFIX`, `" well map.csv"`, is in `config/records.js` (`labware-sheet.md`, section 4),
beside the other names of the Records folder's files; this module's tests check it (it ends `.csv`,
and with a name of 40 characters stays a name `zip` accepts).

### The REPL
`scripts/repl.js` gains a topic, `well-maps`, with `wellMaps` and a small plan with one run, named
randomization ready to try (CLAUDE.md, "Keep the REPL complete"). The `transfer-designer` topic
gains `renameRandomization`, and the `file-writer` topic `checkNameRule`, in their lists of what's
loaded.

### Building it
This topic's build starts only once item 25's build (#144: `config/records.js`, `labwareSheet` and the
Records folder in Write files) is on the branch it's built on; it adds `WELL_MAP_SUFFIX` to that
file, never creates it.

## 5. Errors
None: the plan is the transfer designer's, already checked (section 3).

## 6. Test cases
Each becomes at least one unit test in `well-maps.test.js`, inside `describe("well-maps", …)`. Tests
build plans with the transfer designer's own edits (`addRandomization`, `setRandomization`,
`runRandomization`, `renameRandomization`, `setLabel`, `setWellLabel`). Labware is picked from
`labwareNames()` by its labware type (the first reservoir, the first two 96-well plates;
`labwareTypeOf`, `gridOf`), never named, so a change to `config/deck.js` doesn't break them (CLAUDE.md,
"Tests follow config/"); `Res1` and `Plate1` below stand for those picks.

- A plan without randomizations gives `[]`; one with a randomization that hasn't run gives `[]`.
- A run randomization named `HySoy_dose`, with sources `Res1 9` (labeled `Hy-Soy 100 g/L`, 3
  replicates) and `Res1 10` (unlabeled, 2 replicates) and filler `Res1 12`, filling 8 wells of
  `Plate1` labeled `Cells`, gives one file, `HySoy_dose well map.csv`, starting with the BOM, then
  `Plate,Well,Source\r\n`, then 5 rows (no filler rows): 3 with `Cells,<well>,Hy-Soy 100 g/L` and 2
  with `Cells,<well>,Res1 10`, the wells being exactly those the transfers of the two sources' stages
  go to, in grid order.
- Rows across two labware (wells to fill on `Plate1` and `Plate2`) come `Plate1`'s first, each in
  grid order; on a reservoir, wells are numbered and sorted as numbers (`2` before `10`).
- An unlabeled destination labware shows its name (`Plate1`).
- Two randomizations give two files, in the plan's order, each with its own rows.
- Quoting: a source label `Drug "A", 10 mM` gives the field `"Drug ""A"", 10 mM"`; a label with `µ`
  is written as is; a field without a comma or quote isn't quoted.
- Every line ends `\r\n`, the last included.
- The text's first character is the BOM, checked by its code (`charCodeAt(0)` is `0xFEFF`); code and
  tests write it `"\uFEFF"`, never as the invisible character itself.
- Two sources with the same well label give rows with the same `Source`.
- The plan is unchanged afterwards.
- **The configuration:** `WELL_MAP_SUFFIX` ends `.csv`; a 40-character name plus it is a name `zip`
  accepts. Tests build expected file names from `WELL_MAP_SUFFIX`, never from the text ` well
  map.csv` (CLAUDE.md, "Tests follow config/").
