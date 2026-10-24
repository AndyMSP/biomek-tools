# operation-list — specification

> **Draft (2026-10-23).** Stages added for v0.2.0 (ADR 0008). Still to review: everything about
> stages and `insert`, and in particular the choice that **every transfer must have a stage**, which
> means the existing tests here and in `contents-tracking` add one to the transfers they build.

## 1. Purpose
`operation-list.js` holds an ordered list of operations: everything the tools decide should happen,
in the order it was planned, kept in memory. Each operation is an object whose `type` says what kind
of operation it is. Version 1 has one type, `transfer`: one liquid move, from a labware and well, to a
labware and well, with a volume in microliters (µL).

It is the single source of truth for three later pieces, each of which reads only the operation types
it uses:
- **Biomek output**: the file writer turns the list into a worklist, and any files the worklist
  names, for the general-purpose method (ADR 0006).
- **Volume tracking**: replays the transfers in order to work out what each well holds.
- **The transfer designer**: each drag on the page adds a transfer.

Each transfer belongs to a **stage** (`docs/glossary.md`), named by the stage's ID. The list keeps
each stage's transfers together, so the order of the stages is simply the order of their transfers,
and the list stays the one source of truth for order (ADR 0008). A stage's name and settings are
kept elsewhere, in the stage list.

It doesn't know how the operations were chosen (by the randomizer, by hand, or another way). Tip
changes are planned as a later type (see section 2).

## 2. Scope
Version 1 holds operations of one type, `transfer`, each in a stage. It lets code add or insert
transfers, read the list back in order, and read it grouped by stage. It refuses any change that
would split a stage.

Not in version 1 (see `docs/roadmap.md`):
- **Tip changes.** Planned as a second operation type. How they are represented depends on how the
  Span-8 changes tips, which isn't known yet.
- **Other per-operation instructions**, such as mixing.
- **Removing operations.** Undo doesn't need it, because earlier lists are kept unchanged.
- **Stage names and settings**, such as technique or tip type. They belong to the stage list
  (ADR 0008).
- **Checking against labware**, such as whether a well exists on the named labware or a volume fits
  in it. This module doesn't do it.
- **Concentrations.** Volume tracking calculates them from the list; they are never stored in it.
- **Saving and loading** the list as a file.
- **Biomek file formats.** Turning the list into a worklist is the file writer's job.

## 3. Data model
**The list**
- An operation list is an instance of the `OperationList` class, created with `new OperationList()`.
  A new list is empty.
- Operations are kept in the order they were added or inserted. This is the planned order. Stages
  run in this order; within a stage, the Biomek may not follow it, because a Transfer From File
  step decides its own order (B56358AF, 22-25).
- A list is **immutable**: it never changes after it's created. Adding or inserting an operation
  returns a new list, and leaves the original unchanged, so code must keep the result:
  `list = list.add(transfer)`. This differs from `Layout` and `WellSelection`, which are
  mutable. The operation list is immutable because undo, of any kind of edit, needs earlier versions
  to stay as they were, and because several modules (volume tracking, the file writer, pages) share
  the same list; none of them can change it under the others.
- The list keeps its own copy of each operation it's given. Changing an object after adding it never
  changes the list, and operations read from the list can't be changed.
- Every operation is an object with a `type` property naming its kind. Version 1 accepts only
  `"transfer"`, and rejects any other type. As with a transfer's properties (below), `type` counts
  only if the object holds it itself.
- Code that uses the list reads only the operation types, and the properties, it needs, so new types
  or properties added later don't affect it.

**A transfer**
```js
{
  type: "transfer",
  source: { labware: "Reagents", well: "A1" },
  destination: { labware: "Plate 1", well: "D4" },
  volume: 50,
  stage: "3"
}
```
- A transfer is an object with exactly five properties: `type`, `source`, `destination`, `volume`
  and `stage`. `type` is always `"transfer"`.
- `source` and `destination` are each an object with exactly two properties, `labware` and `well`.
- Any missing or extra property is rejected, at either level, so a typo such as `volme` or `wel` is
  caught rather than stored.
- Only properties the object holds itself (its own properties) count: one it gets from elsewhere,
  such as a class, is treated as missing, because it wouldn't be copied.
- `labware` is text that isn't blank (it has at least one character that isn't whitespace) and has
  no whitespace at the start or end. It must match the method's labware name exactly for the Biomek
  to find it (B56358AF, 22-11 and 22-12).
- `well` is text that isn't blank and has no whitespace at the start or end.
- `volume` is a number of microliters (B56358AF, 22-12), 0 or more. Text (such as `"50"`), `NaN`,
  `Infinity` and negative numbers are rejected. There is no maximum and no limit on decimal places.
- `stage` is the ID of the transfer's stage: text that isn't blank and has no whitespace at the start
  or end. The stage list makes IDs; this module only compares them, exactly. An ID carries no
  meaning: it isn't the stage's name or position.

**Stages are consecutive**
- A stage's transfers are always next to each other in the list, with no other stage's transfers
  between them: one block per stage. For example, stages `"1", "1", "2", "2", "3"` are allowed;
  `"1", "2", "1"` is not, because stage `"1"` is split.
- `add` and `insert` refuse any operation that would split a stage, whether by joining its own
  stage away from that stage's block, or by landing inside another stage's block. So a list with a
  split stage can't exist.
- The order of the blocks is the order the stages run.

## 4. Interface
The module exports one class, `OperationList`.

| Member | Visibility | Description |
|---|---|---|
| `constructor()` | public | Creates an empty list. Takes no arguments. |
| `add(operation)` | public | Checks `operation` (see section 3) and returns a **new** list with a copy of it at the end. The original list is unchanged. Throws if the operation isn't valid or would split a stage. The same as `insert(operation, length)`. |
| `insert(operation, position)` | public | Like `add`, but puts the copy at `position`, counting from 0: the operations from `position` on move one place later. `position` is a whole number from 0 to the number of operations. Throws if the operation isn't valid, the position isn't, or it would split a stage. |
| `listOperations()` | public | Returns the operations in order, as a new list each time. The operations in it can't be changed. |
| `groupByStage()` | public | Returns the stages in run order, each with its operations in order, e.g. `[{ stage: "1", operations: [ … ] }, { stage: "2", operations: [ … ] }]`, as a new list each time. An empty list gives `[]`. |
| `#operations` | private | The stored operations, in order. |

Example:
```js
let list = new OperationList();
list = list.add({
  type: "transfer",
  source: { labware: "Reagents", well: "A1" },
  destination: { labware: "Plate 1", well: "D4" },
  volume: 50,
});
list.listOperations();   // [{ type: "transfer", source: …, destination: …, volume: 50, stage: "1" }]

list = list.insert(otherTransfer, 0);   // otherTransfer is now first
list.groupByStage();     // [{ stage: "1", operations: [ … ] }, …]
```

## 5. Errors
`add` and `insert` check the operation and throw an `Error` whose message says what is wrong and how
to fix it.
Values in messages are shown with `describeValue` (`error-messages` module), so text appears in
quotes, a list as `a list` and any other object as `an object`.

| Problem | Message |
|---|---|
| Operation isn't an object (including `null` and lists) | `An operation must be an object with a type, like { type: "transfer", … }, but got null.` |
| `type` missing or not text | `An operation needs a type, like "transfer", but got undefined.` |
| `type` isn't a known type | `"tranfer" isn't an operation type. The only type is "transfer".` |
| A transfer property is missing | `A transfer needs source, destination, volume and stage, but is missing "volume".` With several, all are listed in that order: `but is missing "source", "volume".` |
| A transfer has extra properties | `A transfer can only have type, source, destination, volume and stage, but also got "volme".` With several, all are listed in the order they appear. |
| `source` or `destination` isn't an object (including `null` and lists) | `The source must be an object with a labware and a well, like { labware: "Plate 1", well: "A1" }, but got "A1".` |
| `labware` or `well` missing | `The source needs a labware and a well, but is missing "well".` With both, both are listed: `but is missing "labware", "well".` |
| Extra property in `source` or `destination` | `The destination can only have a labware and a well, but also got "wel".` With several, all are listed in the order they appear. |
| `labware` or `well` not text | `The source labware must be text, but got 5.` |
| `labware` or `well` blank | `The destination well is blank. Give it at least one character that isn't a space.` |
| `labware` or `well` has whitespace at the start or end | `The source labware " Plate 1" has spaces at the start or end. Remove them.` |
| `volume` not a number, or less than 0 | `The volume must be a number of microliters, 0 or more, like 50, but got -5.` |
| `stage` not text, blank, or with whitespace at the start or end | The same three messages as `labware`, naming `stage`: `The stage must be text, but got 3.` |
| `insert`'s position isn't a whole number from 0 to the number of operations | `The position must be a whole number from 0 to 5, the number of operations in the list, but got 7.` |
| The operation would join its own stage away from that stage's block | `This transfer would split stage "1", whose transfers are at positions 0–3. Put it next to them, at a position from 0 to 4.` |
| The operation would land inside another stage's block | `This transfer would split stage "2", whose transfers are at positions 4–6. Put it before or after that stage, at position 4 or 7.` |

The checks run in the order of the table, for all of `source`, then all of `destination`, then
`volume`, then `stage`, then the position, then the stage rule. Within `source` and `destination`, every check on `labware` runs before any check on
`well`. The first problem found is reported. Each message names the end being checked (source or
destination), so it's clear which half of the transfer to fix.

In JavaScript a list (an array) and `null` both count as objects, so they are named in the object
rows to make sure those checks reject them explicitly. `NaN` and `Infinity` count as numbers, so the
volume check rejects them explicitly.

A failed `add` or `insert` changes nothing: the original list is never touched.

For a single-operation block, positions are written as one number: `at position 4`, not `4–4`.

## 6. Test cases
Each becomes at least one unit test in `operation-list.test.js`.

**Creating and adding**
- A new list is empty: `listOperations()` returns `[]`.
- `add` returns a new list containing the transfer, and the original list is still empty.
- Adding three transfers keeps them in the order they were added.
- A transfer with the same source and destination is accepted.
- A volume of `0` is accepted, and so is a decimal such as `2.5`.

**Inserting**
- `insert(t, 0)` on a list of stage `"1"` transfers puts `t` first; `insert(t, length)` is the same
  as `add(t)`.
- Inserting in the middle of a stage's block, with that stage's ID, is accepted.
- A new stage can be inserted between two blocks, before the first, or after the last.
- `insert` returns a new list; the original is unchanged.

**Stages**
- Stages `"1", "1", "2", "2", "3"` (built by `add`) give three groups from `groupByStage()`, in that
  order, each with its operations in order.
- An empty list gives `[]` from `groupByStage()`.
- Adding stage `"1"` after stage `"2"` has started (list `"1", "2"`) throws the join-away error:
  `This transfer would split stage "1", whose transfers are at position 0. Put it next to them, at a
  position from 0 to 1.`
- Inserting a stage `"3"` transfer inside stage `"2"`'s block throws the land-inside error for stage
  `"2"`, naming its positions and the two allowed positions.
- Inserting a stage `"2"` transfer at the very edge of another stage's block (just before its first
  or just after its last) is accepted when stage `"2"` has no other transfers.
- Two stages may have the same name elsewhere, but here only IDs matter: `"1"` and `"01"` are
  different stages.
- Changing what `groupByStage()` returns doesn't change the list.

**Immutability and copies**
- Changing the object passed to `add` afterwards, including its `source`, doesn't change the list.
- Changing the list returned by `listOperations()`, for example removing an item, doesn't change the
  list.
- Changing a returned operation, or its `source` or `destination`, throws, and the list is
  unchanged.
- An earlier list is unchanged after later adds. (Undo relies on this.)
- The list's stored operations can't be reached or replaced from outside.

**Errors** (each row of section 5 has at least one test, including:)
- Operation `null`, `"transfer"`, `5` and `[]` give the object error; `[]` gives a message ending
  `but got a list.`
- An operation with no `type`, and one with `type: 5`, give the type error.
- `type: "tranfer"` gives the unknown-type error.
- A transfer missing `volume` gives the missing error; one missing `source` and `volume` names both.
- A transfer with `volme: 50` alongside its four valid properties gives the extra-property error.
- `source: "A1"` and `destination: null` give the source and destination object errors.
- `source: {}` gives the missing error naming both `"labware"` and `"well"`.
- `destination: { labware: "Plate 1", wel: "D4" }` gives the missing error for `"well"`, because
  missing properties are checked before extra ones.
- `destination: { labware: "Plate 1", well: "D4", volme: 50 }` gives the extra-property error.
- `labware` and `well` values `5`, `""`, `"   "`, `" Plate 1"` and `"Plate 1 "` each give their error,
  for both source and destination.
- Volume `"50"`, `NaN`, `Infinity` and `-5` give the volume error.
- A transfer without `stage` gives the missing error; `stage` values `3`, `""` and `" 1"` give their
  errors.
- `insert` positions `-1`, `2.5`, `"0"` and one more than the number of operations give the position
  error.
- A property that comes from a class rather than the object itself counts as missing, including
  `type`.
- Checks run in order: an operation with a bad source and a bad volume reports the source.
- Within an end, `labware` is checked fully before `well`: `source: { labware: " Plate 1", well: 5 }`
  reports the labware's whitespace error.
