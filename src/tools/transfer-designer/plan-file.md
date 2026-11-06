# plan-file — specification

> **Draft (2026-10-26; format version 2, 2026-10-28; format versions 3 and 4, 2026-10-30).** Written
> for v0.2.0, from ADR 0010 and the transfer designer preview, where saving and opening plans were
> tried (2026-10-25), the experiment name added (2026-10-28), probes moved to the tip changes
> (2026-10-30, version 3), and stages' mixes added (2026-10-30, version 4). It becomes Final once
> its code is built and Andy has tested the page.
>
> **Draft change (2026-11-01, format version 5):** well labels (`wellLabels`; `transfer-designer.md`,
> "Well labels"), the second part of v0.2.0's item 9 (sections 2 to 6). Versions 1 to 4 open with no
> well labels. It becomes Final once built and tested by Andy.
>
> **Draft change (2026-11-01, format version 6):** randomizations (`randomizations`;
> `transfer-designer.md`, "Randomizations"; ADR 0012), the third part of v0.2.0's item 9 (sections
> 2 to 6). Versions 1 to 5 open with none. It becomes Final once built and tested by Andy.
>
> **Draft change (2026-11-01, format version 7):** each component's constituents (`constituents`;
> `transfer-designer.md`, "Constituents"; ADR 0013), sections 2 to 6. Versions 1 to 6 open with
> components carrying nothing. It becomes Final once built and tested by Andy.
>
> **Draft change (2026-11-02, format version 8):** a randomization may have several filler wells
> (`transfer-designer.md`, "Randomizations"; item 13 of v0.2.0), sections 2 to 6. Nothing else
> changes: a version 8 file holds what a version 7 file does, so where this specification says a
> version 7 file, a version 8 file is meant too. Written in the hands-off workflow; it becomes
> Final once built and tested by Andy.
>
> **Draft change (2026-11-05, format version 9, osmolality; ADR 0016):** each component's
> osmolality (`osmolality`; `transfer-designer.md`, "Osmolality"), sections 2 to 6. Versions 1 to 8
> open with components having none. Where this specification says a version 7 or 8 file (its
> tests included), a version 9 file is meant too, its components having `osmolality` as well; the
> tip-change ranges that said "versions 3 to 6" or "3 to 7" now say "3 to 9". Written in the hands-off
> workflow (CLAUDE.md, "Workflows"), so the choices made for Andy are listed in its pull request.
> It becomes Final once built and tested by Andy.
>
> **Draft change (2026-11-05, cell density, item 16 of v0.2.0):** a new unit, cells/mL, in
> `config/concentration-units.js` (`concentrations.md`, "Cells"). **No new format version**
> (section 3, "Units in a file"); one test added (section 6). Written in the hands-off workflow.
>
> **Draft change (2026-11-05, format version 10, shared tips; ADR 0018):** each randomization
> source's `sharesTips` (`transfer-designer.md`, "Sharing tips"), and a randomization's stages may
> share tip groups with each other (section 3, "Version 10"), sections 2 to 6. Version 9
> (osmolality) is on this branch, so version 10 adds `sharesTips` to it, and versions 1 to 9 open
> with every source on new tips. **Built on #134 (merged into this branch); merge #134 first.**
> Shaped in a preview Andy approved on 2026-11-05 and written in the hands-off workflow (CLAUDE.md,
> "Workflows"), so the choices made for Andy are listed in its pull request. It becomes Final once
> built and tested by Andy.
>
> **Draft change (2026-11-05, format version 11, transfer tables; ADR 0019):** a plan's transfer
> tables (`transferTables`; `transfer-designer.md`, "Transfer tables"), sections 2 to 6. Versions 1
> to 10 open with none. Written in the hands-off workflow (CLAUDE.md, "Workflows"), so the choices
> made for Andy are listed in its pull request. It becomes Final once built and tested by Andy.

## 1. Purpose
`plan-file.js` turns a **plan** (`docs/glossary.md`) into the text of a **plan file**, and a plan
file's text back into a plan (ADR 0010). It is the only module that knows what a plan file holds.

The text is JSON, a standard text format for data, so a plan file can be read in any text editor and
needs nothing installed. A tool decides where the text goes: a file the user saves, or anywhere else
it keeps a copy of the plan.

Opening a file checks everything in it, using the transfer designer's own rules
(`transfer-designer.md`), so a plan made from a file is as valid as one made by editing. A file that
fails any check isn't opened in part.

**Opening is strict** (Andy, 2026-10-26): anything the tool would never write, such as an extra
property or a stage's transfers split apart, is refused with a message saying what and where,
never quietly tidied. The tool always writes valid files, so such a file was damaged or edited by
hand, and that's better reported than changed.

## 2. Scope
Version 1 writes format version 11, and reads versions 11, 10, 9, 8, 7, 6, 5, 4, 3, 2 and 1 (below). Version 2
added the experiment name (Andy, 2026-10-28). Version 3 moved probes from the stages to the tip
changes (Andy, 2026-10-30; ADR 0007, "Tip changes"). Version 4 adds each stage's mixes, `sourceMix`
and `destinationMix` (Andy, 2026-10-30; ADR 0007, "Mixing"). Version 5 adds the well labels, and
version 6 the randomizations (Andy, 2026-11-01). Version 7 adds each component's constituents (ADR
0013; Andy, 2026-11-01). Version 8 lets a randomization have several filler wells (Andy,
2026-11-02), so a tool that knows only version 7 refuses such a file as newer, rather than with a
confusing message about two fillers; its properties are those of version 7. Version 9 adds each
component's osmolality (ADR 0016; Andy, 2026-11-05). Version 10 adds whether each randomization
source shares tips (ADR 0018; Andy, 2026-11-05). Version 11 adds the transfer tables (ADR 0019;
Andy, 2026-11-05). Older plans still open
(ADR 0010, "Consequences"): version 1, with no experiment name; versions 1 and 2, with each tip
change loading every probe its stages used, which is exactly where look-ahead loading put tips, so
the same tips go on; versions 1 to 3, with no mixing, since plans couldn't mix before version 4;
versions 1 to 4, with no well labels; versions 1 to 5, with no randomizations; versions 1 to 6, with
components carrying no constituents; versions 1 to 8, with components having no osmolality;
versions 6 to 9, with every randomization source on new tips (`sharesTips` `false`); versions 1 to
10, with no transfer tables.

Not in version 1:
- **Upgrading files in place.** A version 1 to 10 file stays as it is; saving the plan again writes
  version 11.
- **Undo history, and how a plan was being viewed** (such as which stage is open). A plan file holds
  only the plan (ADR 0010; `plan-history.md`).

## 3. Data model

### The format name and version
- **`PLAN_FILE_FORMAT`** is `"biomek-tools transfer plan"`, so a file can be recognized as a plan
  file.
- **`PLAN_FILE_VERSION`** is `11`, the format version written: it goes up only when what a plan file
  holds changes, not with every release of the tools (ADR 0010).

They are constants in the module, not in `config/`: changing either one means changing how files are
read and written, which is a change to the code.

### What a plan file holds (version 9; version 10 below)
A plan file is written as one JSON object with these properties, in this order:

```json
{
  "format": "biomek-tools transfer plan",
  "version": 9,
  "savedBy": "transfer designer v0.2.0",
  "experimentName": "Exp36",
  "components": [{ "name": "Media", "color": "#4e79a7", "constituents": [], "osmolality": 300 },
                 { "name": "Dye stock", "color": "#f28e2b",
                   "constituents": [{ "name": "Dye", "amount": 10, "unit": "mM" }],
                   "osmolality": null }],
  "startingContents": [{ "labware": "Res", "well": "1", "components": { "Media": 12000 } }],
  "stages": [{ "id": "1", "name": "Seeding", "settings": { "sourceTechnique": "…", "…": "…" } }],
  "operations": [{ "type": "transfer", "source": { "labware": "Res", "well": "1" },
                   "destination": { "labware": "Plate", "well": "A1" }, "volume": 50, "stage": "1" }],
  "tipChanges": { "start": { "tipType": "BC1070", "probes": [1, 2, 3, 4] } },
  "labwareLabels": { "Plate": "Assay plate" },
  "wellLabels": { "Deep": { "A1": "Cond 1", "A2": "Cond 2" } },
  "randomizations": [{ "id": "r1", "beforeId": null, "sources": [{ "labware": "Deep", "well": "A1",
                       "replicates": 4, "filler": false }], "fill": [ … ], "seed": 37, "volume": 50,
                       "settings": { … }, "tipType": "BC230", "probes": [1, 2, 3, 4],
                       "stages": [{ "labware": "Deep", "well": "A1", "stage": "2" }] }]
}
```

- `format`, `version`: as above.
- `savedBy`: which tool and version saved the file, as text given by the tool, e.g.
  `"transfer designer v0.2.0"`. It's for information only, such as finding where a troublesome file
  came from, and never decides whether a file opens (ADR 0010), so opening a file doesn't check it:
  it may even be missing.
- `experimentName`: the plan's experiment name, or `""` if it has none (`transfer-designer.md`).
- `components`, `startingContents`, `tipChanges`, `labwareLabels`, `wellLabels`, `randomizations`:
  the plan's parts of the same names, as `transfer-designer.md` describes them.
- `stages`: every stage, **in stage order** (the plan's `stageOrder`), each `{ id, name,
  settings }`, its settings as the stage list holds them, mixes included (`stage-list.md`). So the
  file needs no separate list of the order (ADR 0011).
- `operations`: every operation, in the operation list's order (`listOperations()`).

**Version 8** files hold the same properties, with `"version": 8`, but each component is
`{ name, color, constituents }`, with no `osmolality`. **Version 7** files hold exactly the same
properties as version 8, with `"version": 7`; they're read with the same rules as version 8 (several
filler wells in one are accepted: no tool wrote them, and refusing them would add a rule for
nothing). **Version 6** files hold the same properties, with
`"version": 6`, but each component is `{ name, color }` only, with no `constituents`. **Version 5**
files are like version 6, with `"version": 5`, but no `randomizations`.
**Version 4** files are like version 5, with `"version": 4`, but no `wellLabels`.
**Version 3** files are like version 4, with `"version": 3`, but a stage's `settings` have no
`sourceMix` or `destinationMix`. **Version 2** files are like version 3, with `"version": 2`, but a
stage's `settings` also hold `probes` (a list of probe numbers), and a tip change is `{ tipType }`
only. **Version 1** files
are like version 2 without `experimentName`, with `"version": 1`.

### Version 10 (shared tips, 2026-11-05)
A version 10 file holds exactly what a version 9 file holds, with `"version": 10`, except that each
randomization's sources are each `{ labware, well, replicates, filler, sharesTips }` (in that
order), `sharesTips` being `true` or `false` (`transfer-designer.md`, "Sharing tips"):

```json
"sources": [{ "labware": "Deep", "well": "A1", "replicates": 4, "filler": false, "sharesTips": false },
            { "labware": "Deep", "well": "A2", "replicates": 4, "filler": false, "sharesTips": true }]
```

- **Versions 6 to 9**: each source is `{ labware, well, replicates, filler }`, as before, with no
  `sharesTips`; on opening, each gets `sharesTips` `false` before `setRandomizations` checks it, so
  every source starts on new tips, as every randomization did then. A version 6 to 9 source *with*
  `sharesTips` is refused (below), as is a version 10 or 11 source without it.
- **Its stages may share tip groups with each other** in any version (`setRandomizations` now
  accepts it; `transfer-designer.md`, section 5), though no tool wrote such a file before version
  10. Whether they share as the sources say isn't a check on opening: a plan saved between an edit
  of its sources and a run can differ, and opens out of date, as it was saved.
- Why a new version: a version 9 tool would refuse a source with `sharesTips` as not having exactly
  its properties, with a confusing message; a new version makes it say the file is newer (ADR 0010).

The text is written with an indent of 2 spaces, so it's easy to read. Volumes are written at full
precision; JSON keeps numbers exactly, so a plan reads back with the same volumes.

### Version 11 (transfer tables, 2026-11-05)
A version 11 file holds exactly what a version 10 file holds, with `"version": 11`, and one more
property, last: **`transferTables`**, the plan's transfer tables, in the plan's order, each
`{ id, table, sources, stages }` in that order, as `transfer-designer.md` describes them ("Transfer
tables"), its `stages` entries each `{ component, stage }`:

```json
"transferTables": [{ "id": "t1",
                     "table": [["Dest Well Label", "Media"], ["Control", "190"]],
                     "sources": { "Media": [{ "labware": "Res1", "well": "1" }] },
                     "stages": [{ "component": "Media", "stage": "3" }] }]
```

- A version 1 to 10 file has no `transferTables` and opens with none; a version 1 to 10 file *with*
  it is refused as having an extra property, and a version 11 file without it as missing it.
- The settings and tips of a transfer table's stages are in `stages` and `tipChanges`, as any
  stage's: the transfer table holds none.
- Whether its stages match what it would make now isn't a check on opening: a plan whose sources
  were emptied, or a well relabeled, before saving opens out of date, as it was saved.
- Why a new version: a version 10 tool would refuse the extra property with a message that doesn't
  say the file is newer (ADR 0010).

### Units in a file
A constituent's `unit` is checked against the configuration when the file opens
(`setConstituents`, through `checkConstituents`), not by the format. So adding a unit to
`config/concentration-units.js`, such as cells/mL (2026-11-05), **doesn't change the format** and
needs no new version (ADR 0010: the version goes up only when what a plan file holds changes; a
constituent is still `{ name, amount, unit }`). A file using a unit an older build doesn't know is
refused by that build with `checkConstituents`' own message, which names the unit and lists the
ones it knows (e.g. `component 2: The unit of "Cells" must be one of mM, µM, g/L, %, ×, but got
"cells/mL".`), so it's clear why; the fix is the newer build. A unit made offered or display-only
changes nothing in files either.

### Stage IDs are renumbered on opening
The stage list makes its own IDs and can't be given one (`stage-list.md`, "IDs"). So opening a file
adds its stages afresh, in the file's order, which is the stage order, and they get new IDs, `"1"`,
`"2"`, `"3"` … The file's IDs are used only to match its transfers, tip changes and randomizations to its stages,
and are then replaced by the new ones. The plan's `stageOrder` is the stages in the file's order.
(For example, a file whose stages are `"2"`, `"5"` and `"7"` opens with stages `"1"`, `"2"` and
`"3"`.)

### Checks on opening
Opening a file checks, in this order:
1. **The text is JSON**, and holds an object.
2. **The format**: `format` is `PLAN_FILE_FORMAT`.
3. **The version**: `version` is `11`, `10`, `9`, `8`, `7`, `6`, `5`, `4`, `3`, `2` or `1`.
4. **The properties**: exactly those listed above for the file's version, none missing (except
   `savedBy`) and none extra. So version 2 to 11 files need `experimentName`, and a version 1 file
   can't have it; version 5 to 11 files need `wellLabels`, and a version 1 to 4 file can't have it;
   version 6 to 11 files need `randomizations`, and a version 1 to 5 file can't have it; version 11
   files need `transferTables`, and a version 1 to 10 file can't have it. (Versions 7
   to 10 add no property of their own: version 7's and version 9's changes are inside each
   component, check 5, and version 8's and version 10's inside randomizations, check 13.)
   `components`, `startingContents`, `stages`, `operations`, `randomizations` and `transferTables`
   are lists;
   `tipChanges`, `labwareLabels` and `wellLabels` are objects.
5. **Components**, each an object with exactly `name`, `color`, in a version 7 to 11 file
   `constituents` (a version 1 to 6 component can't have it), and in a version 9 to 11 file `osmolality`
   (a version 1 to 8 component can't have it), then added as `addComponent` would
   add it: a name and a color, each unique. The name must already be a name (`checkName`): it
   isn't trimmed, so it always matches the names in the starting contents. In a version 7 to 10
   file, its constituents are then set as `setConstituents` would set them (`transfer-designer.md`,
   "Constituents"), with one check first: if `constituents` is a list, each of its entries that is
   an object with a text `name` has that name checked by `checkName` (subject `constituent name`)
   **untrimmed**, so `" Dye"` is refused rather than trimmed, as the component's name is; anything
   else (a list that isn't one, an entry that isn't an object, a name that isn't text) is left to
   `setConstituents`, whose messages say what's wrong. Then `setConstituents`. The family rule
   holds across the file's components, in file order, so a file with Hy-Soy in g/L in component 1
   and in mM in component 2 is refused at component 2. In a version 9 to 11 file, its osmolality is then
   set as `setOsmolality` would set it (`transfer-designer.md`, "Osmolality"): a number of mOsm/kg,
   0 or more, or `null`, so `-5` or `"300"` is refused, never tidied. A version 1 to 8 component
   opens with none (`null`). The per-component property list is version-aware (`name` and
   `color`, plus `constituents` from version 7, plus `osmolality` from version 9), as the
   file-level properties are.
6. **Stages**: at least one. Each is an object with exactly `id`, `name` and `settings`; `id` is a
   name (`checkName`), not `"start"` (which would be confused with the start tips), and different
   from every other stage's; `name` and `settings` are checked by the
   stage list. In a version 1 or 2 file, `settings` must also hold `probes`, checked as
   `setTipProbes` checks probes (`transfer-designer.md`), and taken out before the stage list
   checks the rest. Then, in a version 1, 2 or 3 file, `settings` can't hold `sourceMix` or
   `destinationMix` (plans couldn't mix then), and both are added as `null` before the stage list
   checks them, so the stage doesn't mix.
7. **Operations**, each in turn: checked by the operation list (its form and the stage rule), then
   its source and destination on the deck (`deck.checkWell`), then its `stage` one of the file's
   stages. **Each stage's transfers are together**, as the operation list always keeps them: a file
   whose transfers are in stages `"1", "2", "1"` is refused rather than reordered. **The stages'
   transfers come in the order of `stages`**, as the transfer designer always keeps them (ADR 0011):
   with stages `"1"`, `"2"` in that order, transfers in stage `"2"` then stage `"1"` are refused.
8. **Starting contents**, first as a whole, as `contents-tracking` checks them (their form, each
   well at most once, volumes 0 or more), so a well listed twice is refused before anything is
   built; then each entry in turn: its well on the deck, each component it names in `components`, no
   volume of 0, and at least one component. The tool never writes a 0 or a well holding nothing
   (`addToWells` adds only volumes above 0, and an emptied well is left out), so opening refuses
   both. The plan's starting contents are then the file's, in its order.
9. **Tip changes**: there's one at `"start"`; every other key is one of the file's stages, but not
   the first in `stages`. In a version 3 to 11 file, each is an object with exactly `tipType`, one of
   `TIP_TYPES`, and `probes`, set with `setTipProbes` (so checked as it checks them). In a version 1
   or 2 file, each is an object with exactly `tipType`, and its probes are **every probe its stages
   used**, smallest first: the stages from it up to the next tip change, in the file's stage order
   (for example, stages with `[1, 2]` and `[1, 2, 3, 4]` give `[1, 2, 3, 4]`). That's what
   look-ahead loading put tips on, so the run loads the same tips. A stage that used fewer probes
   than its tips now uses all of them (ADR 0007, "Tip changes").
10. **Labels**: all at once, as `setLabels` checks and sets them (`transfer-designer.md`): judged
    as a whole table, so any labels the tool wrote open, and strictly, so a label with spaces at
    its ends, a blank one, or one equal to its labware's name is refused rather than tidied.
11. **The experiment name** (version 2): `""`, or a name `checkExperimentName` accepts
    (`file-writer.md`), set with `setExperimentName`. It's never tidied: a name the tool would
    refuse is refused. A version 1 file opens with no experiment name.
12. **Well labels** (versions 5 to 11): all at once, as `setWellLabels` checks and sets them
    (`transfer-designer.md`), so strictly: a label with spaces at its ends, a blank one, or a
    labware listed with no wells is refused rather than tidied. A version 1 to 4 file opens with no
    well labels.
13. **Randomizations** (versions 6 to 11), in these steps, in this order:
    1. **Just enough form to renumber**: each is an object, and its `beforeId` is text or `null`,
       and its `stages` a list of objects whose `stage` is text (else `setRandomizations`' own
       message for that form, after `randomizations: `).
    2. **Every stage ID named is one of the file's stages** (`beforeId` and each of `stages`'
       `stage`).
    3. **The sources' form by version** (new in version 10; after step 2, before step 4): if a
       randomization's `sources` is a list, each entry that is an object (not `null`, not a list)
       must, in a version 10 or 11 file, have `sharesTips`, and in a version 6 to 9 file must not.
       Anything else about the sources is left to `setRandomizations` in step 5: `sources` that
       isn't a list, or an entry that isn't an object, is skipped here and reported there with its
       own message. Randomizations are taken in order and, within one, sources in order; the first
       source found wrong is reported. Then, in a version 6 to 9 file, each source that is an
       object gets `sharesTips: false`.
    4. **Renumbering**: their stage IDs (`beforeId`, each of `stages`' `stage`) are changed to the
       stages' new IDs (above).
    5. **`setRandomizations`** (`transfer-designer.md`) checks and sets them all at once.

    So a file with both a stage ID that isn't the file's and a source with the wrong form reports
    the stage ID. A version 1 to 5 file opens with no randomizations.
14. **Transfer tables** (version 11), in these steps, in this order:
    1. **Just enough form to renumber**: each is an object whose `stages` is a list of objects
       whose `stage` is text (else `setTransferTables`' own message for that form, after
       `transfer tables: `).
    2. **Every stage ID named is one of the file's stages.**
    3. **Renumbering**: each `stage` is changed to the stage's new ID.
    4. **`setTransferTables`** (`transfer-designer.md`) checks and sets them all at once, after the
       randomizations, so a stage owned by both is reported there.

    A version 1 to 10 file opens with no transfer tables.
The first problem found is reported (section 5).

## 4. Interface
The module exports two constants and two functions.

| Member | Description |
|---|---|
| `PLAN_FILE_FORMAT` | `"biomek-tools transfer plan"`. |
| `PLAN_FILE_VERSION` | `11`, the version written. Versions 11 to 1 are read. |
| `planToText(plan, savedBy)` | Returns the plan file's text for `plan` (section 3). `savedBy` is text naming the tool and its version, e.g. `"transfer designer v0.2.0"`. Throws if `savedBy` isn't a name (`checkName`). |
| `planFromText(text)` | Returns the plan in `text`, checked (section 3). Throws if anything in it is wrong, saying what and where. |

Example:
```js
const text = planToText(plan, "transfer designer v0.2.0");
const opened = planFromText(text);   // the same plan, with stages renumbered from "1"
```

## 5. Errors
Every message from `planFromText` starts `This file can't be opened: `, then says what's wrong, and
where for anything in a list. Places in lists count from 1, as people count (`transfer 3` is the
third). Messages from other modules (`transfer-designer`, `operation-list`, `stage-list`, `deck`,
`contents-tracking`, `input-checks`) follow the place, unchanged: `This file can't be opened: transfer
3: There's no labware "Bench" on the deck. The deck has "Plate", "Deep", "Res".`

| Problem | Message (after `This file can't be opened: `) |
|---|---|
| Not JSON, or not an object | `it isn't a plan file: its contents aren't the JSON a plan file holds.` |
| `format` isn't `PLAN_FILE_FORMAT` | `it isn't a transfer plan saved by this tool.` |
| `version` is a whole number above `PLAN_FILE_VERSION` | `it was saved by a newer version of the tools (plan format 12). Open it with that version or a later one.` |
| `version` is anything else | `its plan format version, "x", isn't one this tool knows.` |
| A property is missing | `it's missing "stages".` With several, all are listed (`listNames`), in the order of section 3. |
| An extra property | `it has "notes", which a plan file doesn't have.` With several, all are listed, in the order they appear. |
| A property of the wrong kind | `"stages" must be a list.` / `"tipChanges" must be an object.` |
| A component, stage or tip change isn't an object with exactly its properties | `component 2 must be an object with exactly "name", "color", "constituents" and "osmolality".` (in a version 9 to 11 file; `… "name", "color" and "constituents".` in versions 7 and 8; `… "name" and "color".` in versions 1 to 6. And `stage 1 … "id", "name" and "settings"`; `the tip change at "start" … "tipType" and "probes"` in versions 3 to 11, `… "tipType"` in versions 1 and 2.) |
| A component, stage, transfer or starting-contents entry is refused by its module | `component 2: …`, `stage 1: …`, `transfer 3: …`, `starting contents, entry 4: …`, then that module's message (for a component, `addComponent`'s, `setConstituents`'s or `setOsmolality`'s, e.g. `component 2: Constituent 1 needs name, amount and unit, but is missing "unit".`, or `component 2: The osmolality of Media must be a number of mOsm/kg, 0 or more, like 300, or none if it isn't known, but got -5.`). |
| A constituent's name has spaces at its ends | `component 2: ` and `checkName`'s message (not trimmed). |
| No stages | `it has no stages; a plan always has at least one.` |
| Two stages with one ID | `stages 1 and 3 both have the ID "2".` |
| A stage's ID is `"start"` | `stage 2 has the ID "start", which is kept for the tips at the start of the run.` |
| A transfer's stage isn't in the file | `transfer 3 is in stage "9", which isn't one of the file's stages.` |
| A stage's transfers aren't together | `stage "1"'s transfers aren't together: transfer 3 is in stage "2", between transfers of stage "1".` |
| Stages' transfers out of the order of `stages` | `transfer 3 is in stage "1", which comes before stage "2" in the stages, but after transfers of stage "2".` |
| A component in the starting contents isn't in `components` | `starting contents, entry 4, holds "Dye", which isn't one of the file's components.` |
| A starting-contents volume is 0 | `starting contents, entry 4, has 0 µL of "Media"; a well lists only what it holds.` |
| A starting-contents entry holds nothing | `starting contents, entry 4, holds nothing; a well that holds nothing is left out.` |
| The starting contents are refused as a whole (`contents-tracking`) | `starting contents: ` and its message, e.g. for a well listed twice. |
| The labels are refused (`setLabels`) | `labels: ` and its message. |
| The well labels are refused (`setWellLabels`) | `well labels: ` and its message, e.g. `well labels: The label for Deep A1 is blank. A well without a label is left out of the well labels.` |
| A randomization names a stage that isn't one of the file's (`beforeId` or one of its `stages`) | `randomization 1 names stage "9", which isn't one of the file's stages.` |
| The randomizations are refused (`setRandomizations`) | `randomizations: ` and its message, e.g. `randomizations: Randomization 1: its stages must come one after another, in stage order.` |
| A randomization's source has `sharesTips` in a version 6 to 9 file, or lacks it in a version 10 or 11 file | `randomization 1, source 2, has "sharesTips", which a version 9 file's sources don't have.` / `randomization 1, source 2, is missing "sharesTips", which a version 11 file's sources have.` (with the file's version) |
| A transfer table names a stage that isn't one of the file's | `transfer table 1 names stage "9", which isn't one of the file's stages.` |
| The transfer tables are refused (`setTransferTables`) | `transfer tables: ` and its message, e.g. `transfer tables: Transfer table 1: stage "2" shares tips with another stage. Every stage of a transfer table starts on new tips.` |
| The experiment name is refused (`checkExperimentName`) | `the experiment name: ` and its message. |
| No tip change at `"start"` | `it has no tips at the start of the run.` |
| A tip change at a stage that isn't in the file, or at the first stage | `a tip change is before stage "9", which isn't one of the file's stages.` / `a tip change is before stage "1", the first stage, which always starts with the tips at "start".` |
| A tip type isn't in `TIP_TYPES` | `the tip change at "2" loads "BC50", which isn't one of "BC230", "BC1070".` |
| A tip change's probes are refused (`setTipProbes`; versions 3 to 11) | `the tip change at "2": ` and its message, e.g. `Probe numbers must be whole numbers from 1 to 8, but got 9.` |
| A stage has no `probes` (versions 1 and 2) | `stage 2's settings are missing "probes", which a version 2 file's stages have.` (with the file's version) |
| A stage's probes are refused (versions 1 and 2) | `stage 2: ` and `setTipProbes`'s message, e.g. `Probe 3 is listed more than once. List each probe once.` |
| A stage's settings hold a mix (versions 1 to 3) | `stage 2's settings have "sourceMix", which a version 3 file's stages don't have.` (with the file's version, naming the first such setting) |

Stage IDs in messages are the file's own, so they can be found in the file.

## 6. Test cases
Each becomes at least one unit test in `plan-file.test.js`, inside `describe("plan-file", …)`. Each
row of section 5 has at least one test.

**Saving**
- `planToText` gives JSON with exactly the properties of section 3, in that order, with the format,
  the version and the `savedBy` given, indented by 2 spaces.
- `savedBy` of `5`, `""` and `" v0.2.0"` throws.

**Round trip**
- A plan with components, starting contents, three stages (one without transfers, between the
  other two), transfers, a tip change and a label, saved and opened, gives the same stage order,
  stage names and settings, transfers (volumes included, e.g. `2.5` and `0.1`), tip changes,
  components and labels.
- `planToText` writes the stages in stage order, not the order they were added: a stage added
  before the first is written first.
- A plan whose stages have IDs `"2"`, `"5"` and `"7"` opens with IDs `"1"`, `"2"` and `"3"`, its
  transfers and tip changes following them.
- An `emptyPlan()`, saved and opened, gives a plan with the same contents, and is written as version
  10, with `"wellLabels": {}` and `"randomizations": []`. (The existing tests of the version written
  are updated to version 10 (section 6, "Version 10"), and those of a component's exact properties to the four properties:
  the specification changed, not the tests' purpose.)
- A component is written with its properties in the order `name`, `color`, `constituents`,
  `osmolality`, and each constituent as `name`, `amount`, `unit`.
- Constituents: a plan whose components carry `[]`, `[{ Dye 10 mM }]` and two constituents in
  different families (Hy-Soy 4 g/L, Drug A 10 µM), saved and opened, gives the same constituents,
  in order, amounts at full precision (e.g. `0.1`).
- Cells (2026-11-05): a plan whose component carries `Cells` at `1500000` in `CELL_DENSITY_UNIT`
  (`config/concentration-units.js`), saved and opened, gives the same constituent; the file is
  still written as `PLAN_FILE_VERSION` (unchanged), and the amount is written as JSON writes the
  number (`1500000`).
- Randomizations: a plan with a randomization that has run (and one that hasn't, sitting before a
  stage), saved and opened, gives the same randomizations, their `beforeId` and `stage`s following
  the renumbered stages (a file whose stages are `"2"`, `"5"` and `"7"`).
- Well labels: a plan with `{ Deep: { A1: "Cond 1", A2: "Cond 1" }, Res: { "5": "Media" } }`, saved
  and opened, gives the same well labels.
- Stages keep their mixes: a stage with `sourceMix` `{ share: 90, times: 3, speed: 400 }` and
  `destinationMix` `null`, saved and opened, gives the same mixes.
- Tip changes keep their probes: `START` on `[1, 2, 3, 4]` and a tip change on `[1]`, saved and
  opened, give the same probes.

**Version 9** (2026-11-05)
- Osmolality: a plan whose components have `300`, `0`, `290.5` and none (`null`), saved and opened,
  gives the same osmolalities (`0` stays `0`, not none; `null` stays `null`).
- A version 8 file (as saved before osmolality, its components `{ name, color, constituents }`)
  opens, every component with `osmolality` `null`, and its randomizations with several filler
  wells as before.
- A version 8 file whose component *has* `osmolality` is refused as not having exactly its
  properties (naming `"name", "color" and "constituents"`); a version 9 file whose component lacks
  `osmolality` is refused the same way (naming all four).
- A version 9 component whose `osmolality` is `-5`, `"300"` or `{}` is refused with
  `component N: ` and `checkOsmolality`'s message, naming the component.
- Checks within a component run in order: in a version 9 component with a bad constituent and a
  bad osmolality, the constituent is reported.
- Older files open with no osmolality too: a version 6 file's components (`{ name, color }`) and a
  version 1 file's open with `osmolality` `null`.
- **Existing tests keep their files' versions.** The tests above that use a version 7 or 8 file
  (in "Version 8" and "Refusing") stay as they are, with version 7 or 8 files, since those
  versions still open; only new tests, and tests of what's written, use version 9.

**Version 8** (2026-11-02)
- A plan whose randomization has three filler wells, run, is saved (now as version 10) and opened as
  the same plan (its filler wells, its one filler stage and that stage's transfers from each well).
- A version 7 file holding a randomization with two filler wells opens; a version 7 file as saved
  before (one filler) opens as before.
- A file whose randomization's filler stage entry names a filler well that isn't the first opens;
  one with two entries naming filler wells of one randomization is refused with `randomizations: `
  and `Randomization 1: its filler has two stages.`

**Version 10** (2026-11-05, shared tips)
- A plan whose run randomization has sources sharing tips (A1 new tips, A2 and A3 sharing, the
  filler new tips), saved, is written as version 10 with `sharesTips` on each source in the order
  `labware`, `well`, `replicates`, `filler`, `sharesTips`, and opens as the same plan: the same
  sharing, the same tip groups (A1, A2 and A3's stages in one), not out of date.
- A plan whose randomization hasn't run, with a source sharing tips, saved and opened, keeps the
  sharing (so closing a card with sharing set keeps it across a reload).
- A version 9 file (and a version 6 file) holding a run randomization opens with every source
  `sharesTips` `false`, the same as before.
- A version 9 file whose source has `sharesTips`, and a version 10 file whose source lacks it, are
  refused with their messages, naming the randomization and source.
- A version 10 file whose first source has `sharesTips` `true` is refused with `randomizations: `
  and `setRandomizations`' message (`Randomization 1: Source 1 is the first source…`).
- A version 10 file whose randomization's first stage shares the tip group of the stage before it
  is refused with `randomizations: ` and `Randomization 1: stage "N" shares tips with a stage outside
  the randomization. …`; one whose sources say A2 shares but whose stages don't (saved before a
  run) opens, out of date.
- **Check 13's order** (section 3): a version 10 file whose randomization names stage `"9"` (not
  one of the file's) and whose source lacks `sharesTips` reports the stage
  (`randomization 1 names stage "9", …`); a version 10 file whose source lacks `sharesTips` and
  which `setRandomizations` would also refuse (e.g. its `seed` is `-1`) reports the missing
  `sharesTips`.
- **A source that isn't an object** is skipped by the version check and left to
  `setRandomizations`: a version 9 file, and a version 6 file, whose randomization's second source
  is `null` (and one where it's `5`) is refused with `randomizations: ` and `setRandomizations`'
  message for a source that isn't an object, not with a `sharesTips` message; so is a version 10
  file whose second source is `null`. A version 9 file whose `sources` is `{}` is refused with
  `setRandomizations`' message for `sources` that isn't a list.
- **Existing tests whose version numbers change** (the specification changed, not the tests'
  purpose; each keeps what it tests):
  - "the format and version are the specification's": `PLAN_FILE_VERSION` is `10`.
  - "an empty plan, saved and opened, … is written as version 9 …": version 10, in its name and its
    check.
  - "a randomization with three filler wells, run, is saved (now as version 9) …": version 10.
  - "saving an opened version 4 file writes version 9 …" and "saving an opened version 3 file
    writes version 9 …": version 10, in their names and checks.
  - "a version above this one was saved by a newer version of the tools": version `11`, with the
    message `… (plan format 11). Open it with that version or a later one.`
  - The helper `asVersion8` (a version 10 file as a version 8 file) also drops `sharesTips` from
    each randomization source, so version 8 and 7 files made from a run randomization stay as they
    were saved. A new helper, `asVersion9` (the same, keeping each component's `osmolality`, with
    `"version": 9`), makes the version 9 files of the tests above.
  - The three tests that name "a version 9 component" (osmolality refused or missing, and a bad
    constituent before a bad osmolality) open a version 9 file made by `asVersion9`, as their names
    say; their messages don't change (a version 10 component has the same four properties).
  - No other test's version or message changes: tests of version 1 to 8 files keep their files'
    versions.

**Version 11** (2026-11-05, transfer tables)
- A plan with a transfer table (two columns, Media from Res1 1 then Res1 2, Drug A from Deep1 A1),
  its Media stage set to Slow with BC1070 tips on 8 probes, saved, is written as version 11 with
  `transferTables` last, each in the order `id`, `table`, `sources`, `stages`, and opens as the same
  plan: the same table (cell texts exactly, spaces included), sources in order, stages renumbered,
  the stage's settings and tips, not out of date.
- A plan with a transfer table out of date (a well relabeled after adding), saved and opened, is
  still out of date.
- A version 10 file opens with `transferTables` `[]`; a version 10 file *with* `transferTables` is
  refused as having an extra property; a version 11 file without it as missing it, and one whose
  `transferTables` is an object with the wrong-kind message.
- A version 11 file whose transfer table names stage `"9"` is refused with `transfer table 1 names
  stage "9", …`; one whose stages share a tip group, or whose stage isn't named after its
  component, is refused with `transfer tables: ` and `setTransferTables`' message; one whose stage
  is also a randomization's is refused with `transfer tables: Stage "N" belongs to transfer table
  1 and randomization 1.` (renumbered IDs).
- **Existing tests whose version numbers change** (the specification changed, not the tests'
  purpose): `PLAN_FILE_VERSION` is `11`; the tests saving and checking "version 10" (an empty plan;
  three filler wells; an opened version 3 or 4 file saved again; a run randomization with shared
  tips) check version 11, with `"transferTables": []` where an empty plan's file is compared whole;
  "a version above this one" uses version `12` and its message. A helper `asVersion10` (a version
  11 file without `transferTables`, `"version": 10`) makes the version 10 files the shared-tips
  tests open; the helpers for older versions also drop `transferTables`. No other test's version or
  message changes.

**Refusing**
- Text that isn't JSON, and JSON that's a list, give the not-a-plan-file message.
- `version` `11` gives the newer-version message; `0`, `"2"` and `1.5` give the unknown-version
  message.
- **Version 6:** a version 6 file (as saved before constituents, its components `{ name, color }`)
  opens, every component carrying `[]`; a version 6 file whose component *has* `constituents` is
  refused as not having exactly its properties (naming `"name" and "color"`); a version 7 file
  whose component lacks `constituents` is refused the same way (naming all three). A version 7
  component whose `constituents` is `{}`, or whose constituent has an amount of `0` or a unit of
  `"mg/mL"`, is refused with `component N: ` and `checkConstituents`'s message; one with Hy-Soy in
  g/L and, in a later component, Hy-Soy in mM is refused with `component N: ` and the family
  message naming the earlier component; a constituent named `" Dye"` is refused with
  `component N: ` and `checkName`'s message, not trimmed; the untrimmed check runs over the whole
  list before `setConstituents`, so `[null, { name: " Dye", … }]` reports `" Dye"`, and
  `[null, { name: "Dye", … }]` reports the `null` through `setConstituents`.
- **Version 5:** a version 5 file (as saved before randomizations) opens, with none; a version 5
  file *with* `randomizations` is refused as having an extra property; a version 6 or 7 file without it
  is refused as missing it, and one whose `randomizations` is an object gets the wrong-kind message.
  A randomization naming stage `"9"` gets its message; one refused by `setRandomizations` gets
  `randomizations: ` and its message.
- **Version 4:** a version 4 file (as saved before well labels) opens, with no well labels; a
  version 4 file *with* `wellLabels` is refused as having an extra property; a version 7 file
  without it is refused as missing it; a version 7 file whose `wellLabels` is a list gets the
  wrong-kind message (`"wellLabels" must be an object.`).
- **Well labels are strict:** a version 7 file with the label `" Cond 1"`, a blank label, a labware
  with `{}`, or a well not on the grid is refused with `well labels: ` and `setWellLabels`'s
  message, not tidied.
- **Mixing must match the technique:** a version 7 file whose stage 2 has a `sourceMix` with
  `sourceTechnique` `"Operation"` (Medium) is refused with `stage 2: ` and the transfer designer's
  message (`transfer-designer.md`, section 3, "Mixing"); with `"OperationMix"` it opens.
- **Version 3:** a version 3 file (as saved before mixing) opens, each stage with `sourceMix` and
  `destinationMix` `null`; a version 3 file whose stage has a `sourceMix` gets the stage-mix
  message; a version 7 stage without `sourceMix` gets the stage list's missing-setting message.
- **Version 2:** a version 2 file (as saved before 2026-10-30) opens, with no mixing: stages with probes `[1, 2]`
  and `[1, 2, 3, 4]` under `START`, and `[1]` under a tip change before the third stage, give
  `START` on `[1, 2, 3, 4]` and that tip change on `[1]`; the stages' settings have no probes.
  A version 2 stage without `probes` gets the missing-probes message; one with `[3, 1, 3]` gets
  `stage N: ` and the repeated-probe message. A version 2 tip change with `probes` is refused as
  not having exactly its properties; so is a version 3 to 11 tip change without them, and a version
  3 to 10 stage with `probes` is refused by the stage list as an extra setting.
- **Version 1:** a version 1 file (as saved before 2026-10-28, without `experimentName`, with probes
  in its stages) opens, with an experiment name of `""` and probes as for version 2; a version 1
  file *with* `experimentName` is refused as having an extra property; a version 2 file without it
  is refused as missing it.
- **The experiment name:** a plan named `"Exp36"`, saved and opened, keeps its name; one with no
  name saves `"experimentName": ""` and opens with none; a file with `"Exp 36"` or `5` is refused
  with `the experiment name: ` and `checkExperimentName`'s message.
- A file without `savedBy`, and one whose `savedBy` is `5`, open: it isn't checked.
- A file with transfers in stages `"1", "2", "1"` is refused.
- A file whose third transfer names labware not on the deck names `transfer 3`.
- A file whose transfers come in stage `"2"` then stage `"1"`, with the stages listed `"1"`, `"2"`,
  is refused; so is a file with a tip change keyed by the first stage.
- Two labware with one label are refused.
- Labels the tool can write open: `{ "Plate": "Deep", "Deep": "D1" }`, and two labels swapped.
- A label with spaces at its ends, a blank label, and a label equal to its labware's name are
  refused, not tidied.
- Starting contents with a volume of 0, an entry holding nothing, and a well listed twice are
  refused; the well listed twice is refused by the whole check, before any entry's own checks.
- A component named `" Media"` is refused (`checkName`), not trimmed.
- A stage with the ID `"start"` is refused.
- Checks run in order: a file with a bad version and a missing property reports the version.
