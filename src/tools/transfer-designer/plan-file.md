# plan-file — specification

> **Draft (2026-10-26; format version 2, 2026-10-28).** Written for v0.2.0, from ADR 0010 and the
> transfer designer preview, where saving and opening plans were tried (2026-10-25), and the
> experiment name added (2026-10-28). It becomes Final once its code is built and Andy
> has tested the page.

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
Version 1 writes format version 2, and reads versions 2 and 1 (below). Version 2 adds the
experiment name (Andy, 2026-10-28). Plans saved as version 1, before plans had an experiment name,
still open, with no experiment name (ADR 0010, "Consequences").

Not in version 1:
- **Upgrading files in place.** A version 1 file stays as it is; saving the plan again writes
  version 2.
- **Undo history, and how a plan was being viewed** (such as which stage is open). A plan file holds
  only the plan (ADR 0010; `plan-history.md`).

## 3. Data model

### The format name and version
- **`PLAN_FILE_FORMAT`** is `"biomek-tools transfer plan"`, so a file can be recognized as a plan
  file.
- **`PLAN_FILE_VERSION`** is `2`, the format version written: it goes up only when what a plan file holds
  changes, not with every release of the tools (ADR 0010).

They are constants in the module, not in `config/`: changing either one means changing how files are
read and written, which is a change to the code.

### What a plan file holds (version 2)
A plan file is written as one JSON object with these properties, in this order:

```json
{
  "format": "biomek-tools transfer plan",
  "version": 2,
  "savedBy": "transfer designer v0.2.0",
  "experimentName": "Exp36",
  "components": [{ "name": "Media", "color": "#4e79a7" }],
  "startingContents": [{ "labware": "Res", "well": "1", "components": { "Media": 12000 } }],
  "stages": [{ "id": "1", "name": "Seeding", "settings": { "sourceTechnique": "…", "…": "…" } }],
  "operations": [{ "type": "transfer", "source": { "labware": "Res", "well": "1" },
                   "destination": { "labware": "Plate", "well": "A1" }, "volume": 50, "stage": "1" }],
  "tipChanges": { "start": { "tipType": "BC1070" } },
  "labwareLabels": { "Plate": "Assay plate" }
}
```

- `format`, `version`: as above.
- `savedBy`: which tool and version saved the file, as text given by the tool, e.g.
  `"transfer designer v0.2.0"`. It's for information only, such as finding where a troublesome file
  came from, and never decides whether a file opens (ADR 0010), so opening a file doesn't check it:
  it may even be missing.
- `experimentName`: the plan's experiment name, or `""` if it has none (`transfer-designer.md`).
- `components`, `startingContents`, `tipChanges`, `labwareLabels`: the plan's parts of the same
  names, as `transfer-designer.md` describes them.
- `stages`: every stage, **in stage order** (the plan's `stageOrder`), each `{ id, name,
  settings }`. So the file needs no separate list of the order (ADR 0011).
- `operations`: every operation, in the operation list's order (`listOperations()`).

**Version 1** files hold the same properties except `experimentName`, with `"version": 1`.

The text is written with an indent of 2 spaces, so it's easy to read. Volumes are written at full
precision; JSON keeps numbers exactly, so a plan reads back with the same volumes.

### Stage IDs are renumbered on opening
The stage list makes its own IDs and can't be given one (`stage-list.md`, "IDs"). So opening a file
adds its stages afresh, in the file's order, which is the stage order, and they get new IDs, `"1"`,
`"2"`, `"3"` … The file's IDs are used only to match its transfers and tip changes to its stages,
and are then replaced by the new ones. The plan's `stageOrder` is the stages in the file's order.
(For example, a file whose stages are `"2"`, `"5"` and `"7"` opens with stages `"1"`, `"2"` and
`"3"`.)

### Checks on opening
Opening a file checks, in this order:
1. **The text is JSON**, and holds an object.
2. **The format**: `format` is `PLAN_FILE_FORMAT`.
3. **The version**: `version` is `2` or `1`.
4. **The properties**: exactly those listed above for the file's version, none missing (except
   `savedBy`) and none extra. So a version 2 file needs `experimentName`, and a version 1 file
   can't have it.
   `components`, `startingContents`, `stages` and `operations` are lists; `tipChanges` and
   `labwareLabels` are objects.
5. **Components**, each an object with exactly `name` and `color`, then added as `addComponent`
   would add it: a name and a color, each unique. The name must already be a name (`checkName`): it
   isn't trimmed, so it always matches the names in the starting contents.
6. **Stages**: at least one. Each is an object with exactly `id`, `name` and `settings`; `id` is a
   name (`checkName`), not `"start"` (which would be confused with the start tips), and different
   from every other stage's; `name` and `settings` are checked by the
   stage list.
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
   the first in `stages`; each is an object with exactly `tipType`, one of `TIP_TYPES`.
10. **Labels**: all at once, as `setLabels` checks and sets them (`transfer-designer.md`): judged
    as a whole table, so any labels the tool wrote open, and strictly, so a label with spaces at
    its ends, a blank one, or one equal to its labware's name is refused rather than tidied.
11. **The experiment name** (version 2): `""`, or a name `checkExperimentName` accepts
    (`file-writer.md`), set with `setExperimentName`. It's never tidied: a name the tool would
    refuse is refused. A version 1 file opens with no experiment name.
The first problem found is reported (section 5).

## 4. Interface
The module exports two constants and two functions.

| Member | Description |
|---|---|
| `PLAN_FILE_FORMAT` | `"biomek-tools transfer plan"`. |
| `PLAN_FILE_VERSION` | `2`, the version written. Versions 2 and 1 are read. |
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
| `version` is a whole number above `PLAN_FILE_VERSION` | `it was saved by a newer version of the tools (plan format 3). Open it with that version or a later one.` |
| `version` is anything else | `its plan format version, "x", isn't one this tool knows.` |
| A property is missing | `it's missing "stages".` With several, all are listed (`listNames`), in the order of section 3. |
| An extra property | `it has "notes", which a plan file doesn't have.` With several, all are listed, in the order they appear. |
| A property of the wrong kind | `"stages" must be a list.` / `"tipChanges" must be an object.` |
| A component, stage or tip change isn't an object with exactly its properties | `component 2 must be an object with exactly "name" and "color".` (And `stage 1 … "id", "name" and "settings"`, `the tip change at "start" … "tipType"`.) |
| A component, stage, transfer or starting-contents entry is refused by its module | `component 2: …`, `stage 1: …`, `transfer 3: …`, `starting contents, entry 4: …`, then that module's message. |
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
| The experiment name is refused (`checkExperimentName`) | `the experiment name: ` and its message. |
| No tip change at `"start"` | `it has no tips at the start of the run.` |
| A tip change at a stage that isn't in the file, or at the first stage | `a tip change is before stage "9", which isn't one of the file's stages.` / `a tip change is before stage "1", the first stage, which always starts with the tips at "start".` |
| A tip type isn't in `TIP_TYPES` | `the tip change at "2" loads "BC50", which isn't one of "BC230", "BC1070".` |

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
- An `emptyPlan()`, saved and opened, gives a plan with the same contents, and is written as version 2.

**Refusing**
- Text that isn't JSON, and JSON that's a list, give the not-a-plan-file message.
- `version` `3` gives the newer-version message; `0`, `"2"` and `1.5` give the unknown-version
  message.
- **Version 1:** a version 1 file (as saved before 2026-10-28, without `experimentName`) opens,
  with an experiment name of `""`; a version 1 file *with* `experimentName` is refused as having an
  extra property; a version 2 file without it is refused as missing it.
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
