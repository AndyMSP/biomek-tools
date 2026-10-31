# file-writer — specification

> **Draft (2026-10-28).** Written for v0.2.0, from ADR 0007 and the general-purpose method as built
> and tested on 2026-10-27 (`docs/domain/biomek.md`). It becomes Final once its code is built and
> the files it writes have run on the Biomek.
>
> **Draft change (2026-10-30):** probes come from the tip changes, not the stages (ADR 0007, "Tip
> changes"; section 3, `Stages.csv`, and section 6).
>
> **Draft change (2026-10-30, well capacities and dead volume, item 11 of v0.2.0):** contents
> tracking's three kinds of problem (a draw into the dead volume, an overdraw, an overfill), each
> refused with its own message, and a well that starts over its capacity (sections 5 and 6).
>
> **Draft change (2026-10-30, mixing layer (b)):** the mix columns are written from each stage's
> mixes, with volumes from the `mix-volumes` module, and a plan with a mix under the minimum is
> refused (ADR 0007, "Mixing"; sections 2, 3, 5 and 6). Substages come from the `substages` shared
> module, unchanged.

## 1. Purpose
`file-writer.js` turns a **plan** (`docs/glossary.md`) into the files the general-purpose method
runs (ADR 0007): a **setup worklist**, a **stage worklist**, and one **Transfer From File** file per
**substage**. It only makes the files' names and text; the caller saves them.

It is shared because each tool builds its own plan (Andy, 2026-10-27): the transfer designer now,
and the randomizer's link to the Biomek later (roadmap, v0.2.0 item 9).

Its inputs are a plan (with its experiment name), a timestamp, the deck description (through the `deck`
module) and the paths in `config/` (section 3).

It decides nothing about the plan: the stages, their settings and the tip changes are the plan's.
Labware labels (`docs/glossary.md`) are never used in the files, which name labware only by its
name in the deck description.

It can refuse a plan. A refused plan gets no files (section 5).

## 2. Scope
Version 1 writes the setup worklist; the stage worklist, with a tip-change row before each tip group
and a transfer row for each substage, in stage order; and the Transfer From File files. It splits
stages into substages, loads tips on each tip change's probes (ADR 0007, "Tip changes"), gives each
transfer row the tip type and probes of the tip change before it, writes each row's mixing (ADR
0007, "Mixing"), and rounds volumes to 3 decimal places.

Not in version 1:
- **Checking techniques against tip types** (roadmap, "Technical debt").
- **Dead volume** (roadmap, "Technical debt").
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
  - its stage list, for each stage's settings, mixes included;
  - its stage order;
  - its tip changes;
  - its **experiment name** (`docs/glossary.md`; `transfer-designer.md`), for the folder's name. A
    plan with no name (`""`) is refused (section 5): the folder is named after it. Taking the name
    from the plan, not as a separate input, means the files can never be named after something
    other than the plan they hold (Andy, 2026-10-28).

  It doesn't use the components' names or colors, or the labware labels.

  Stages are split into substages by the `substages` shared module (`substages.md`), and each row's
  mix volumes come from the `mix-volumes` shared module (`mix-volumes.md`), which the transfer
  designer uses too, so the tool and the files always agree.

  A stage has a **stage ID**, a fixed label the stage list gives it when it's made (`stage-list.md`),
  which says nothing about where the stage comes; and a **place in the stage order**, its position
  in the list of stages, which is the number the transfer designer page shows beside it. The two
  needn't match: a stage with ID `"3"` may come second. This specification always says which it
  means.
- **The rule for an experiment name** is this module's, `checkExperimentName` (section 4): letters,
  digits, hyphens and underscores only, 1 to 40 characters (Andy, 2026-10-28). The limit keeps every
  path well under Windows' 260-character limit for a path. The transfer designer checks a plan's
  name with it, so a plan's name always passes.
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
  with transfers. It gives `TipType`, the tip change's tip type, and `LoadProbes`, the tip change's
  probes, in ascending order, e.g. `1,2,3,4` (ADR 0007, "Tip changes"). Tip groups and their tip
  types and probes come from the `tip-groups` shared module, which the transfer designer uses too
  (Andy, 2026-10-28), so both always agree.
  Its other columns are empty. A tip group whose stages have no transfers gets no row, so no tips
  are loaded for nothing.
- **Then one transfer row per substage** (`NewTip` 0), for each stage with transfers, in stage order
  (a stage without transfers isn't run; `transfer-designer.md`, "Stage order"). Each row gives:
  - `TipType`: its tip group's tip type;
  - `TransferFile`: the absolute path of its Transfer From File file;
  - `Probes`: its tip group's probes, in ascending order: the same as the tip-change row's
    `LoadProbes`, since every stage uses all the probes its tips are on;
  - `SrcTechnique`, `SrcLiquidType`, `DestTechnique` and `DestLiquidType`: the stage's settings;
  - `SrcLabwareType` and `DestLabwareType`: the substage's labware types, from the deck description;
  - the six mix columns, `SrcMixVolume`, `SrcMixTimes`, `SrcMixSpeed`, `DestMixVolume`,
    `DestMixTimes` and `DestMixSpeed`. At an end whose mix isn't `null`: the row's mix volume at
    that end (`mix-volumes`), and the mix's `times` and `speed`. At an end that doesn't mix, its
    three columns are empty. Where the end's technique is one of the pipetting modes', it's already
    the mixing one when the end mixes, since the transfer designer keeps them matched
    (`transfer-designer.md`, "Mixing"), so Biomek uses the columns (`biomek.md`, "Mixing"). Where
    it isn't one of the modes, the columns follow the stage's mix just the same: whether that
    technique mixes is up to whoever chose it, since the tool can't know.

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
  `10.5`, `0.125`. Mix volumes and mix speeds are written the same way (a mix volume is already a
  whole number of tenths: `108`, `89.9`); mix times are whole numbers: `3`.
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
| `writeRunFiles(plan, timestamp)` | a plan (holding its experiment name) and a timestamp (a `Date`), as in section 3, "Inputs" | `{ folderName, files }`: the folder name, and the files as a list of `{ name, text }`, in this order: `Setup.csv`, `Stages.csv`, then the Transfer From File files in the order `Stages.csv` names them | if the timestamp isn't valid, or the plan is refused, including for having no experiment name (section 5); nothing is returned then, so a refused plan gets no files |
| `checkExperimentName(name)` | any value | nothing | if `name` isn't a valid experiment name (section 3). It's exported so a tool can check a name as the user types it, with the same rule |
| `folderNameFor(timestamp, experimentName)` | a timestamp and an experiment name | the folder name, e.g. `"2026-10-28_015732_Exp36"` | if either isn't valid |

`writeRunFiles` uses `folderNameFor` and `checkExperimentName` on the plan's name, so a name the
page accepted is always accepted here.

Example:
```js
// plan.experimentName is "Exp36"
const { folderName, files } = writeRunFiles(plan, new Date(2026, 9, 28, 1, 57, 32));
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

## 5. Errors
Each message says what's wrong and how to fix it. Values are shown with `describeValue`
(`error-messages` module). Stages are named by their place in the stage order and their name, as
the transfer designer page shows them, never by their stage ID. Volumes in messages are written as
in the files (section 3, "How values are written").

| Problem | Message |
|---|---|
| The experiment name isn't text (`checkExperimentName`, `folderNameFor`, `writeRunFiles`) | `The experiment name must be text, like "Exp36", but got 5.` |
| The experiment name is blank | `Type an experiment name, such as "Exp36".` |
| The experiment name is longer than 40 characters | `The experiment name is 45 characters long; it can be at most 40.` |
| The experiment name holds a character other than a letter, digit, hyphen or underscore | `The experiment name can't contain " " (a space). Use only letters, digits, hyphens (-) and underscores (_), e.g. "Exp36_repeat".` It names the first such character; a space is called "a space". |
| The timestamp isn't a valid `Date` (`folderNameFor`, `writeRunFiles`) | `The timestamp must be a valid date, but got "2026-10-28".` |
| The plan isn't an object holding `startingContents`, `operationList`, `stageList`, `stageOrder`, `tipChanges` and `experimentName` | `The plan must be an object like the transfer designer makes, but got null.` |
| The plan has no experiment name (`""`) | `Name the experiment first: the files' folder is named after it.` |
| The plan has no transfers | `There's nothing to write: the plan has no transfers. Add transfers to a stage first.` |
| A stage with transfers comes later than 99th in the stage order, so its file name has no room for its place (section 3) | `Stage 104, "Wash", is too far down the list: file names have room for 99 stages. Remove some stages before it.` |
| A well **starts over its capacity** (`contents-tracking`, an `"overfill"` with `operationIndex` `null`) (Andy, 2026-10-30) | `Plate1 B1 starts with 400 µL, over its 360 µL capacity. Fix the starting contents before writing the files.` |
| A stage has a **contents problem** (`contents-tracking`): a transfer **draws into the dead volume** (Andy, 2026-10-30) | `Stage 3, "Seeding", draws into a dead volume: transfer #5 asks Res1 5 for 400 µL, but only 300 µL is above its 2000 µL dead volume. Fix it before writing the files.` |
| … an **overdraw**: a transfer asks a well for more than it holds (Andy, 2026-10-28) | `Stage 3, "Seeding", has an overdraw: transfer #5 asks Plate1 A1 for 60 µL, but it holds 50 µL. Fix it before writing the files.` |
| … an **overfill**: a transfer fills a well over its capacity (Andy, 2026-10-30) | `Stage 3, "Seeding", overfills Plate1 A1: transfer #5 brings it to 380 µL, over its 360 µL capacity. Fix it before writing the files.` |
| A stage has a **mix problem**: a mix volume under `MIN_MIX_VOLUME`, because its emptiest well holds too little when it's mixed (`mix-volumes`) (Andy, 2026-10-30) | `Stage 3, "Seeding", mixes Plate1 A2 after dispensing when it holds only 0.9 µL: 90% of that is 0.8 µL, and a mix needs at least 1 µL. Turn that mixing off, or put more in the well first.` (The example uses today's minimum, 1 µL; the message gives `MIN_MIX_VOLUME`, and the tests build theirs from it.) For a source, "before aspirating". It names the stage's first mix problem (`mix-volumes`, `problems`), and the well by its labware's name, as the files do; volumes are written as in the files. |
| A transfer's volume is 0 once rounded to 3 decimal places, so Biomek would skip it ("Skip zero volume transfers", ADR 0007) | `Stage 2, "Media", has a transfer of 0.0004 µL, which is 0 µL to 3 decimal places, so the Biomek would skip it. Use at least 0.001 µL.` |

A contents problem names the stage's first problem in contents tracking's order, the transfer by
its position in the operation list counting from 1 (as the transfer designer's page does), the
well by its labware's name, and volumes as the files write them.

**Order of checks.** For `writeRunFiles`: the timestamp, then the plan: its form (including that it
holds `experimentName`), then its experiment name (none, then `checkExperimentName`), then whether
it has transfers,
then whether a well starts over its capacity, then the stages in stage order, each checked for its
place, then its contents problems, then its mix problems, then its volumes. The first problem found
is reported,
and no files are returned.

Problems the plan's own modules already prevent (a well not on the deck, a stage's settings that
aren't valid) aren't checked again: the plan is made only through their checks
(`transfer-designer.md`).

## 6. Test cases
Each becomes at least one unit test in `file-writer.test.js`, inside `describe("file-writer", …)`.
Each row of section 5 has at least one test. The tests build plans through the transfer designer's
own edits (`transfer-designer.md`), so every plan is one the page could make. They use the real
`config/` files, and find labware by grid and labware type in `DECK` rather than naming it, so they
still pass when the deck changes (as `deck.test.js` does).

**Configuration** (`config/paths.js`, ADR 0009)
- `BASE_FOLDER` is text, starts with a drive letter, a colon and a backslash, ends with a
  backslash, and holds none of `/ * ? " < > |`, no colon after the drive letter, and no comma.

**The experiment name and the folder name**
- `checkExperimentName` accepts `"Exp36"`, `"Exp36_repeat"`, `"A-1"`, `"x"` and a name of 40
  characters.
- It refuses, each with its message: `5` and `null` (not text); `""` (blank); a name of 41
  characters; `"Exp 36"` (names "a space"); `"Exp36,b"`, `"Exp/36"` and `"Expé36"` (each names
  its character).
- `folderNameFor(new Date(2026, 9, 28, 1, 57, 32), "Exp36")` gives `"2026-10-28_015732_Exp36"`.
- Leading zeros: `new Date(2026, 0, 5, 9, 7, 2)` gives `"2026-01-05_090702_…"`; and
  `new Date(2026, 11, 31, 23, 59, 59)` gives `"2026-12-31_235959_…"`.
- `folderNameFor` refuses `new Date("not a date")` and the text `"2026-10-28"` (not a valid date),
  and a bad name with `checkExperimentName`'s message.

**`Setup.csv`**
- The header is `StageWorklist`, then one `Vol_<labware>_<well>` per well on the deck, labware in
  `DECK`'s order and wells in grid order: as many columns as there are wells, plus one (793 for
  today's deck).
- `StageWorklist` holds `BASE_FOLDER`, the folder name, a backslash and `Stages.csv`.
- A well holding 500 µL of one component and 250 µL of another gives `750`; an empty well gives
  `0`; a reservoir well's column is named with its number, e.g. `Vol_<reservoir>_5`.

**`Stages.csv`**
- The header is ADR 0007's 17 columns, in order.
- A plan with one stage, one substage and the start tip change gives two rows: a tip-change row
  (`1`, the tip type, the tip change's probes, then 14 empty fields) and a transfer row (`0`, the
  tip type, an empty `LoadProbes`, the file's absolute path, the same probes, the stage's four
  technique and liquid-type settings, the two labware types from `DECK`, then 6 empty mix fields).
- Probes `[1, 2]` are written `"1,2"` (quoted); probes `[1]` are written `1` (not quoted).
- **Mixing:** a stage mixing at the source `{ share: 90, times: 3, speed: 400 }` and not at the
  destination writes its row's source mix volume (as `mix-volumes` gives it), `3` and `400` in the
  `SrcMix…` columns, and leaves the `DestMix…` columns empty; the reverse for a stage mixing only at
  the destination; a stage mixing at both ends fills all six. Its row's `SrcTechnique` (or
  `DestTechnique`) is the mixing technique stored in the stage.
- **One mix volume per row:** a mixing stage that splits into two substages writes each row's own
  mix volume.
- **A mix step** (`transfer-designer.md`, "Mix steps") is written like any stage: its row has
  `MIX_STEP_MODE`'s technique and liquid type at both ends, empty `SrcMix…` columns, and the row's
  destination mix volume with `DEFAULT_MIX`'s times and speed in the `DestMix…` columns; its
  Transfer From File file lists each mixed well from itself into itself, with `MIX_STEP_VOLUME` as
  its volume. (Nothing in this module changes for mix steps; the test shows they come out right.)
- A mix speed of `150.5` is written `150.5`; a mix volume of `89.9` is written `89.9`.
- The test written before mixing layer (b), that a stage's mixes are ignored and the mix columns
  written empty, is replaced by these tests: the behavior it checked has changed. Its plan gave a
  mix with `"Operation"`, which the transfer designer now refuses.
- **Probes from the tip change:** a tip change on `[1, 2, 3, 4]` gives `LoadProbes` `"1,2,3,4"`,
  and every transfer row in its group `Probes` `"1,2,3,4"`; a second tip change on `[1, 3, 5]`
  gives `"1,3,5"` in its rows.
- **Two tip groups:** a tip change before the third stage gives a second tip-change row just
  before that stage's transfer rows, and those rows carry its tip type.
- **Stages without transfers:** a stage without transfers gets no row and no file; a tip group
  whose stages have no transfers gets no tip-change row.

**Places and stage IDs**
- With a stage order of `["1", "3", "2"]`, stage `"3"` writes `Stage02_A.csv` and stage `"2"`
  writes `Stage03_A.csv`.
- A stage without transfers still counts for the places after it: with three stages and the
  second empty, the third writes `Stage03_A.csv`.
- A stage at place 99 is written as `Stage99_A.csv`.

**Substages and Transfer From File files**
- A stage whose transfers go from a reservoir to a plate, then a plate to a deep-well plate, then a
  reservoir to a plate again gives two transfer rows and two files: `…_A` (reservoir to plate,
  holding both of those transfers, in operation-list order) and `…_B` (plate to deep-well plate),
  each row with its own labware types.
- Each file's header is `SourceLabware,SourceWell,DestLabware,DestWell,Volume`; a reservoir well is
  written as its number, a plate well as its name.
- `files` lists `Setup.csv`, `Stages.csv`, then the Transfer From File files in the order
  `Stages.csv` names them.

**How values are written**
- Volumes `10`, `10.5`, `0.125`, `1/3` and `10.000000000000002` are written `10`, `10.5`,
  `0.125`, `0.333` and `10`.
- Every line of every file ends with CRLF, the last line included; no file starts with a byte order
  mark; and only fields containing a comma are quoted.

**Refusing** (section 5)
- Each row of section 5 gives its message, with no files: a plan that isn't an object; an empty
  plan; a stage at place 100 with transfers; a well that starts over its capacity; a stage with a
  draw into the dead volume, one with an overdraw and one with an overfill (each named by place
  and name, with the transfer, the well and the volumes; on the real deck, with the capacity and
  dead volume taken from `config/labware-types.js` for the labware chosen); a stage with a mix problem at the destination (the message above) and one at the source ("before
  aspirating"); a transfer of `0.0004` µL.
- A stage at place 100 *without* transfers is accepted (it isn't written).
- A plan with no experiment name gives its message, with no files.
- Order of checks: a bad timestamp with a plan with no name reports the timestamp; a plan with no
  name and no transfers reports the name; a plan with no transfers and a bad timestamp reports the
  timestamp; a well starting over capacity and an overdraw in stage 1 reports the starting
  well; a plan with an overdraw in stage 4 and a
  zero-rounding volume in stage 2 reports stage 2's; a stage with both an overdraw and a mix problem
  reports the overdraw; a stage with a mix problem and a zero-rounding volume reports the mix
  problem.

**Purity**
- The plan is unchanged after `writeRunFiles`, and two calls with the same inputs give identical
  results.

### Golden files
A **golden file** is a saved copy of output that has been verified correct (CLAUDE.md, "Testing").
The tests above each check one part of the output; golden files check whole runs at once, so a
mistake no part-by-part test thought of still shows (Andy, 2026-10-28). There are two:

- **A coverage plan:** a small plan built to use every feature at least once: several tip groups,
  one of them with no transfers; a stage without transfers; a stage that splits into substages;
  reservoirs as sources and as destinations; a stage past 9th in the stage order (two-digit file
  names); and volumes that need rounding.
- **Exp37,** made in the transfer designer and run through the tool. Exp37 mixes (`exp37.md`), so
  this one is made only once plans can hold mixing (roadmap, "Later"): without its mixing it
  wouldn't be Exp37.

Each is saved in `tests/fixtures/` as the files the writer made, the plan they came from (a plan
file, `plan-file.md`, which holds the experiment name), and the timestamp used. **It is saved only after its
files have run correctly on the Biomek,** in simulation and then for real, with the Finish step's
report checked; the fixture records which runs (method name and date) verified it. The files are
copied in by hand, exactly as they ran. No test or script creates or rewrites them, and they are
never edited to make a test pass (CLAUDE.md, "Testing").

The test, for each golden file: open its plan file (`planFromText`), call `writeRunFiles` with its
timestamp, and check that it gives the same folder name, the same file names
in the same order, and each file's text identical to its golden file, character for character.
Nothing is written to disk: the writer returns the files in memory, and the test only reads the
fixtures.

These tests are added when their fixtures exist; until then, this part of the specification is
waiting on the Biomek runs (roadmap, v0.2.0 item 8).
