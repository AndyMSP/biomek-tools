# stage-list — specification

> **Draft (2026-10-23).** Written for v0.2.0 (ADR 0008). Still to review: whether a stage must have
> all its settings when it is added; that settings are checked for form only, not against the
> technique list; that `remove` doesn't know about transfers; that IDs can come back after undo;
> and the wording.

## 1. Purpose
`stage-list.js` holds the stages of a **plan** (`docs/glossary.md`): each stage's ID, name and settings. A **stage**
(`docs/glossary.md`) is a group of operations that run in any order and share one set of settings.
On the Biomek, each stage becomes one row of the stage worklist (ADR 0007).

It also makes stage IDs. Each transfer in the operation list names its stage by one of these IDs, and
this list is where the file writer and the page look up that stage's name and settings (ADR 0008).

It holds no transfers and knows nothing about the run order. The order stages run in is the order of
their transfers in the operation list, and nowhere else. This list's order means nothing; stages are
looked up by ID.

## 2. Scope
Version 1 lets code add a stage (which makes its ID), rename it, change its settings, remove it, and
look stages up.

Not in version 1 (see `docs/roadmap.md`):
- **Checking settings against the configuration**, such as whether a technique is in the technique
  list, suits the tip type, or a labware type exists. This module checks only that each setting has
  the right form (section 3). Where those checks live is an open decision (roadmap, "Open
  decisions").
- **Knowing about transfers.** Removing a stage that still has transfers isn't refused here; the page
  removes or moves its transfers first (section 3).
- **Which probes get tips** (`LoadProbes` in ADR 0007). The file writer works that out by looking
  ahead over the stages in run order; it isn't a setting.
- **Replacing only some tips** (an `UnloadProbes` setting, ADR 0007).
- **Mixing** settings.
- **Saving and loading** the list as a file.

## 3. Data model
**The list**
- A stage list is an instance of the `StageList` class, created with `new StageList()`. A new list
  is empty.
- A list is **immutable**, like the operation list: adding, renaming, changing or removing a stage
  returns a new list and leaves the original unchanged, so code must keep the result. The page keeps
  each version of the operation list and stage list together, so undo can go back to both (ADR 0008).
- The list keeps its own copy of everything it's given. Changing an object after passing it in never
  changes the list, and stages read from the list can't be changed.

**A stage**
```js
{
  id: "3",
  name: "Seeding",
  settings: {
    technique: "Span8 Water 230 Default",
    liquidType: "Water",
    tipType: "BC230",
    probes: [1, 2, 3, 4, 5, 6, 7, 8],
    sourceLabwareType: "BCDeep96Round",
    destinationLabwareType: "Greiner655087",
    changeTipsFirst: true
  }
}
```
(The technique and labware type names above are examples only, not the lab's.)

- `id` is made by the list; code never chooses one (below).
- `name` is chosen by the user: text that isn't blank and has no whitespace at the start or end.
  Two stages may have the same name (for example two "Seeding" stages).
- `settings` is an object with exactly seven properties. Any missing or extra property is rejected,
  so a typo such as `tiptype` is caught rather than stored. As in the operation list, only properties
  the object holds itself count.

**Settings**

| Setting | What it is | Form |
|---|---|---|
| `technique` | the Biomek technique, by name, as in Biomek Software | a name (below) |
| `liquidType` | the Biomek liquid type, by name | a name |
| `tipType` | the tip type, by name, e.g. `BC230` | a name |
| `probes` | which probes the stage's Transfer From File step uses | a list of probe numbers (below) |
| `sourceLabwareType` | the labware type of every source in the stage | a name |
| `destinationLabwareType` | the labware type of every destination in the stage | a name |
| `changeTipsFirst` | whether all tips are unloaded and new ones loaded before the stage | `true` or `false` |

- A **name** is text that isn't blank and has no whitespace at the start or end (`checkName`,
  `input-checks` module). Biomek finds these only by their exact names (`biomek.md`), so stray spaces
  would make it fail.
- **`probes`** is a list of at least one probe number. A probe number is a whole number from 1 to 8
  (the Span-8's probes, numbered as in Biomek Software). No number may appear twice. The list stores
  the numbers sorted from smallest to largest, whatever order they were given in, so `[3, 1]` is
  stored as `[1, 3]`. The file writer turns it into Biomek's text form, `"1,3"`.
- The first stage to run must load tips, so its `changeTipsFirst` must be `true`. That depends on the
  run order, which this list doesn't know, so the file writer checks it, not this module.

**IDs**
- An ID is text: the number of the stage as it was added, counting from 1: `"1"`, `"2"`, `"3"` … It
  is text because the operation list's `stage` property is text.
- The list keeps a counter of the next ID. Removing a stage never moves the counter back, so a
  removed stage's ID is never given to another stage in later versions of the list.
- An ID carries no meaning: it isn't the stage's name or its position in the run. Code never reads
  anything from an ID except whether two are the same.
- Each version of the list carries its own counter. Going back to an earlier version (undo) also goes
  back to its counter, so after an undo the next stage added can get an ID used in the undone
  version. That's safe, because the operation list kept with that earlier version doesn't name that
  ID either.

**Removing**
- `remove` takes a stage out. It doesn't check whether transfers still name it, because this module
  doesn't see the operation list. A transfer naming a stage that isn't in the stage list would leave
  the file writer with no settings for it, so the page removes a stage only after removing or moving
  its transfers. (The file writer refuses a transfer whose stage isn't in the stage list.)
- A stage with no transfers can stay in the list. It has no place in the run order and isn't run
  (ADR 0008).

## 4. Interface
The module exports one class, `StageList`.

| Member | Visibility | Description |
|---|---|---|
| `constructor()` | public | Creates an empty list. Takes no arguments. |
| `add(name, settings)` | public | Checks `name` and `settings` and returns `{ stageList, id }`: a **new** list holding the new stage, and the ID it was given. The original list is unchanged. Throws if `name` or `settings` isn't valid. |
| `rename(id, name)` | public | Returns a **new** list in which stage `id` has the name `name`; its ID and settings are unchanged. Throws if `id` isn't in the list or `name` isn't valid. |
| `changeSettings(id, settings)` | public | Returns a **new** list in which stage `id` has the settings `settings`, which replace all its settings; its ID and name are unchanged. Throws if `id` isn't in the list or `settings` isn't valid. |
| `remove(id)` | public | Returns a **new** list without stage `id`. Throws if `id` isn't in the list. |
| `has(id)` | public | Returns `true` if stage `id` is in the list, otherwise `false`. Never throws. |
| `get(id)` | public | Returns stage `id`, as `{ id, name, settings }`, which can't be changed. Throws if `id` isn't in the list. |
| `listStages()` | public | Returns every stage, in the order they were added, as a new list each time. That order means nothing about the run order. |
| `#stages` | private | The stored stages. |
| `#nextNumber` | private | The number the next stage's ID will be made from. Starts at 1. |

`add` returns two things because the list is immutable: the caller needs the new list to keep, and
the ID to put on the stage's transfers.

Example:
```js
let stages = new StageList();
const added = stages.add("Seeding", seedingSettings);
stages = added.stageList;
added.id;                                   // "1"

stages = stages.rename("1", "Seeding, part 1");
stages = stages.changeSettings("1", { ...seedingSettings, changeTipsFirst: false });
stages.get("1").settings.changeTipsFirst;   // false
stages = stages.remove("1");
stages.has("1");                            // false
```

## 5. Errors
`add`, `rename`, `changeSettings`, `remove` and `get` check their inputs and throw an `Error` whose
message says what is wrong and how to fix it. Values are shown with `describeValue`
(`error-messages` module).

| Problem | Message |
|---|---|
| `id` isn't in the list (any type of value) | `There's no stage "9" in the stage list.` |
| `name` not text, blank, or with whitespace at the start or end | `checkName`'s three messages, naming `stage name`: `The stage name must be text, but got 5.` |
| `settings` isn't an object (including `null` and lists) | `A stage's settings must be an object with technique, liquidType, tipType, probes, sourceLabwareType, destinationLabwareType and changeTipsFirst, but got null.` |
| A setting is missing | `A stage's settings need technique, liquidType, tipType, probes, sourceLabwareType, destinationLabwareType and changeTipsFirst, but are missing "tipType".` With several, all are listed in that order. |
| Extra settings | `A stage's settings can only have technique, liquidType, tipType, probes, sourceLabwareType, destinationLabwareType and changeTipsFirst, but also got "tiptype".` With several, all are listed in the order they appear. |
| A name setting not text, blank, or with whitespace at the start or end | `checkName`'s three messages, naming the setting in words: `technique`, `liquid type`, `tip type`, `source labware type`, `destination labware type`. E.g. `The tip type " BC230" has spaces at the start or end. Remove them.` |
| `probes` isn't a list, or is empty | `The probes must be a list of probe numbers from 1 to 8, like [1, 2, 3, 4], but got "1,2".` |
| A probe isn't a whole number from 1 to 8 | `Probe numbers must be whole numbers from 1 to 8, but got 9.` The first such value is named. |
| A probe appears twice | `Probe 3 is listed more than once. List each probe once.` |
| `changeTipsFirst` isn't `true` or `false` | `Whether to change tips first must be true or false, but got "yes".` |

The checks run in this order: `id` (for `rename`, `changeSettings`, `remove`, `get`), then `name`
(for `add` and `rename`), then `settings`: the object check, missing settings, extra settings, then
each setting in the order of the settings table (section 3). The first problem found is reported.

A failed call changes nothing: the original list is never touched, and a failed `add` doesn't use up
an ID.

## 6. Test cases
Each becomes at least one unit test in `stage-list.test.js`, inside `describe("stage-list", …)`.

**Adding and IDs**
- A new list is empty: `listStages()` returns `[]`.
- `add` returns `{ stageList, id }`; the new list holds the stage with that ID, name and settings;
  the original list is still empty.
- Three adds give IDs `"1"`, `"2"`, `"3"`.
- Two stages may have the same name; they get different IDs.
- After adding stages `"1"` and `"2"` and removing `"2"`, the next add gets `"3"`.
- A failed `add` doesn't use up an ID: after one, the next good add gets the ID it would have got.
- An earlier version keeps its own counter: adding to it again gives the ID it would have given.

**Settings**
- `probes` `[3, 1, 2]` is stored as `[1, 2, 3]`.
- `probes` `[1]` and `[1, 2, 3, 4, 5, 6, 7, 8]` are accepted.
- `changeTipsFirst` `false` is accepted.

**Renaming, changing, removing, looking up**
- `rename` changes only the name; ID and settings are unchanged; the original list is unchanged.
- `changeSettings` replaces all the settings; ID and name are unchanged; the original list is
  unchanged.
- `remove` takes out only that stage; `has` then gives `false` for it and `true` for the others.
- `has` gives `false` for an ID never used, and for values that aren't text, such as `1` and `null`,
  without throwing.
- `get` returns the stage's ID, name and settings.
- `listStages()` gives stages in the order they were added, including after a rename or a change of
  settings.

**Immutability and copies**
- Changing the settings object passed to `add` afterwards, including its `probes` list, doesn't
  change the list.
- Changing what `listStages()` returns doesn't change the list.
- Changing a stage returned by `get` or `listStages()`, or its settings, or its `probes`, throws, and
  the list is unchanged.
- An earlier list is unchanged after later adds, renames, changes and removals.

**Errors** (each row of section 5 has at least one test, including:)
- `rename`, `changeSettings`, `remove` and `get` with `"9"`, and with `9`, give the not-in-list error.
- Names `5`, `""`, `"   "` and `" Seeding"` give their errors, in `add` and in `rename`.
- Settings `null`, `"x"` and `[]` give the object error; `[]` ends `but got a list.`
- Settings missing `tipType` give the missing error; missing `technique` and `probes` name both, in
  that order.
- Settings with an extra `tiptype` give the extra-setting error.
- Each name setting given `5`, `""` and `" BC230"` gives its error, naming the setting in words.
- `probes` `"1,2"`, `[]` and `null` give the probes-list error.
- `probes` `[0]`, `[9]`, `[2.5]` and `["1"]` give the probe-number error; `[1, 9, 10]` names `9`.
- `probes` `[3, 1, 3]` gives the repeated-probe error, naming 3.
- `changeTipsFirst` `"yes"` and `1` give its error.
- Checks run in order: `rename("9", "")` reports the missing stage; settings with a bad technique and
  a bad tip type report the technique.
