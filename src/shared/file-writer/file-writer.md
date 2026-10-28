# file-writer — specification

> **Draft (2026-10-28).** Written for v0.2.0, from ADR 0007 and the general-purpose method as built
> and tested on 2026-10-27 (`docs/domain/biomek.md`). Sections 5 (Errors) and 6 (Test
> cases) are still to be written. It becomes Final once its code is built and the files it
> writes have run on the Biomek.

## 1. Purpose
`file-writer.js` turns a **plan** (`docs/glossary.md`) into the files the general-purpose method
runs (ADR 0007): a **setup worklist**, a **stage worklist**, and one **Transfer From File** file per
**substage**. It only makes the files' names and text; the caller saves them.

It is shared because each tool builds its own plan (Andy, 2026-10-27): the transfer designer now,
and the randomizer's link to the Biomek later (roadmap, v0.2.0 item 9).

Its inputs are a plan, an experiment name, a timestamp, the deck description (through the `deck`
module) and the paths in `config/` (section 3).

It decides nothing about the plan: the stages, their settings and the tip changes are the plan's.
Labware labels (`docs/glossary.md`) are never used in the files, which name labware only by its
name in the deck description.

It can refuse a plan. A refused plan gets no files (section 5).

## 2. Scope
Version 1 writes the setup worklist; the stage worklist, with a tip-change row before each tip group
and a transfer row for each substage, in stage order; and the Transfer From File files. It splits
stages into substages, loads tips by looking ahead (ADR 0007), gives each transfer row the tip type
of the tip change before it, and rounds volumes to 3 decimal places.

Not in version 1:
- **Checking techniques against tip types** (roadmap, "Technical debt").
- **Dead volume** (roadmap, "Technical debt").
- **Mixing.** The general-purpose method supports it (ADR 0007), but plans don't hold it yet
  (roadmap, "Later"); the mix columns are written empty.
- **Replacing only some tips** (ADR 0007, "Consequences").
- **Well capacities**, to warn about overfilling (roadmap, "Later").
- **Resuming after an interruption** (roadmap, "Later").
- **A run code** (roadmap, "Later"): a code in the setup worklist that the method asks for before it
  starts, so it can't run an old setup worklist by mistake. Until then, each run's files go in a
  folder of their own, and the method's setup worklist is pointed at that folder's `Setup.csv`
  before each run (Andy, 2026-10-28). ADR 0007 plans a fixed path instead; this is a temporary
  choice (roadmap, "Technical debt").

## 3. Data model

### Inputs
- **A plan**, as the transfer designer holds it (`transfer-designer.md`, section 3). The file writer
  uses:
  - its starting contents, for each well's starting volume: the sum of the well's components;
  - its operation list, for the transfers;
  - its stage list, for each stage's settings;
  - its stage order;
  - its tip changes.

  It doesn't use the components' names or colors, or the labware labels.

  A stage has a **stage ID**, a fixed label the stage list gives it when it's made (`stage-list.md`),
  which says nothing about where the stage comes; and a **place in the stage order**, its position
  in the list of stages, which is the number the transfer designer page shows beside it. The two
  needn't match: a stage with ID `"3"` may come second. This specification always says which it
  means.
- **The experiment name**, typed by the user: letters, digits, hyphens and underscores only, 1 to 40
  characters (Andy, 2026-10-28). The limit keeps every path well under Windows' 260-character limit
  for a path.
- **A timestamp** (a recorded date and time): when the files are made, given by the caller as a
  JavaScript `Date`, in the computer's local time. The file writer never reads the clock itself, so
  it is a **pure function**: its result depends only on its inputs, and it changes nothing else.
  That makes it **deterministic**: the same inputs always give the same files, so tests can check
  them exactly.
- **The deck description**, through the `deck` module (`deck.md`): each labware's grid and labware
  type.
- **The base folder** on the Biomek PC: `BASE_FOLDER` in a new configuration file,
  `config/paths.js` (ADR 0009), `C:\Users\Beckman Coulter\Desktop\Ento\` (Andy, 2026-10-28). Each
  run's folder goes inside it.

### Outputs
The file writer returns a folder name and the names and contents of the files for that folder. It
saves nothing: the caller saves the files, all in one folder with that name, inside the base folder,
so each run's folder holds everything that run used (Andy, 2026-10-28).

#### The folder name
The timestamp, an underscore, then the experiment name, e.g. `2026-10-28_015732_Exp36`. The
timestamp is written year-month-day, an underscore, then hours, minutes and seconds on a 24-hour
clock, every part with leading zeros (four digits for the year, two for the rest): 9:07:02 am on
5 January 2026 is `2026-01-05_090702`. This follows **ISO 8601**, the international standard for
writing dates and times largest unit first, but with an underscore instead of its `T` and without
its colons, which Windows doesn't allow in folder names. Folders then sort by time in Windows
Explorer.

#### `Setup.csv`, the setup worklist
A header row and one data row.
- Its first column is `StageWorklist`, holding the absolute path of `Stages.csv` (below).
- Then one column per well on the deck, named `Vol_<labware>_<well>` (e.g. `Vol_Plate1_A1`,
  `Vol_Res1_5`), labware in the deck's order and wells in their grid's order. Each holds the well's
  starting volume in µL, or 0 if the well starts empty: every volume variable in the method needs a
  value.

#### `Stages.csv`, the stage worklist
A header row with the 17 columns of ADR 0007, then one row per tip change or substage, in run order.
- **A tip-change row** (`NewTip` 1) comes before each tip group (`docs/glossary.md`) that has stages
  with transfers. It gives `TipType`, the tip change's tip type, and `LoadProbes`, every probe that
  any stage in the group uses, in ascending order, e.g. `1,2,3,4` (look-ahead loading, ADR 0007).
  Its other columns are empty. A tip group whose stages have no transfers gets no row, so no tips
  are loaded for nothing.
- **Then one transfer row per substage** (`NewTip` 0), for each stage with transfers, in stage order
  (a stage without transfers isn't run; `transfer-designer.md`, "Stage order"). Each row gives:
  - `TipType`: its tip group's tip type;
  - `TransferFile`: the absolute path of its Transfer From File file;
  - `Probes`: the stage's probes, in ascending order;
  - `SrcTechnique`, `SrcLiquidType`, `DestTechnique` and `DestLiquidType`: the stage's settings;
  - `SrcLabwareType` and `DestLabwareType`: the substage's labware types, from the deck description;
  - the six mix columns, empty (section 2).

  `LoadProbes` is empty.

#### The Transfer From File files
One per substage, named `Stage<n>_<letter>.csv`, e.g. `Stage03_A.csv`.
- `<n>` is the stage's place in the stage order (the number the transfer designer page shows beside
  it), not its stage ID, written with two digits: a stage with ID `"3"` that comes second writes
  `Stage02_A.csv`.
- The letters `A`, `B`, … are the stage's substages, in the order their first transfers come in the
  operation list.
- Each file has a header row, `SourceLabware,SourceWell,DestLabware,DestWell,Volume`, then one row
  per transfer, in operation-list order. Wells are written as their grid names them: `A1` on a
  plate, `5` on a reservoir.

### How values are written
The files are **CSV** (comma-separated values): each row is one line, and each value in it is a
**field**, separated from the next by a comma.
- **Absolute paths:** a file refers to another only by its **absolute path**, a path that starts
  from the drive letter: the base folder, the folder name and the file name, e.g.
  `C:\Users\Beckman Coulter\Desktop\Ento\2026-10-28_015732_Exp36\Stages.csv`. (A relative path,
  such as `Stages.csv` on its own, would be read relative to some other folder; the manual always
  asks for full paths, B56358AF 22-9 and chapter 27.)
- **Volumes** are rounded to 3 decimal places (ADR 0007) and written without trailing zeros: `10`,
  `10.5`, `0.125`.
- **Quoting:** a field that contains a comma is put in double quotes, e.g. `"1,2"`, as **RFC 4180**
  (the standard that defines the CSV format) describes. No other field is quoted.
- **Line endings:** every line ends with **CRLF**, the two characters Windows ends a line with
  (carriage return, then line feed), including the last line. There is no **byte order mark**
  (BOM), a hidden character at the start of a file that some programs add and that breaks the first
  column's name (`biomek.md`). This is the format every file used on 2026-10-27, Method23 to
  Method32. (`biomek.md` also notes that Exp37's Transfer From File files left out the last line
  break; both work.)

## 4. Interface
The module exports three functions. None changes its inputs, and none reads the clock or saves
anything (section 3).

| Function | Takes | Returns | Throws |
|---|---|---|---|
| `writeRunFiles(plan, experimentName, timestamp)` | a plan, an experiment name and a timestamp (a `Date`), as in section 3, "Inputs" | `{ folderName, files }`: the folder name, and the files as a list of `{ name, text }`, in this order: `Setup.csv`, `Stages.csv`, then the Transfer From File files in the order `Stages.csv` names them | if the experiment name or timestamp isn't valid, or the plan is refused (section 5); nothing is returned then, so a refused plan gets no files |
| `checkExperimentName(name)` | any value | nothing | if `name` isn't a valid experiment name (section 3). It's exported so a tool can check a name as the user types it, with the same rule |
| `folderNameFor(timestamp, experimentName)` | a timestamp and an experiment name | the folder name, e.g. `"2026-10-28_015732_Exp36"` | if either isn't valid |

`writeRunFiles` uses `folderNameFor` and `checkExperimentName`, so a name the page accepted is
always accepted here.

Example:
```js
const { folderName, files } = writeRunFiles(plan, "Exp36", new Date(2026, 9, 28, 1, 57, 32));
folderName;                       // "2026-10-28_015732_Exp36"
files.map((file) => file.name);   // ["Setup.csv", "Stages.csv", "Stage01_A.csv", "Stage02_A.csv", "Stage02_B.csv"]
files[1].text.split("\r\n")[1];   // '1,BC230,"1,2,3,4",,,,,,,,,,,,,,'  (the first tip-change row)
```
(In a JavaScript `Date`, months count from 0, so `9` is October.)

### Configuration
`config/paths.js` (ADR 0009) exports `BASE_FOLDER`, the base folder on the Biomek PC, e.g.
`"C:\\Users\\Beckman Coulter\\Desktop\\Ento\\"` (each `\\` in JavaScript text is one backslash).
This module's tests check it: it's text; it starts with a drive letter, a colon and a backslash
(`C:\`); it ends with a backslash; and it holds none of the characters Windows refuses in a path
(`/ * ? " < > |`, or a colon after the drive letter) and no comma, which would split a field
(section 3, "How values are written").
