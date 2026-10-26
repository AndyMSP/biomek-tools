# operation-list — specification

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
Version 1 holds operations of one type, `transfer`, each in a stage. It lets code add a transfer to
its stage, start a new stage before another, remove a transfer, read the list back in order, and
read it grouped by stage. A stage can never be split, and it refuses a transfer that breaks the
stage rule.

Not in version 1 (see `docs/roadmap.md`):
- **Tip changes.** Planned as a second operation type. How they are represented depends on how the
  Span-8 changes tips, which isn't known yet.
- **Other per-operation instructions**, such as mixing.
- **Moving a stage** that already has transfers, or moving a transfer within its stage.
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
- Operations are kept in run order, which `add` and `insertBeforeStage` work out from each
  transfer's stage (below). This is the planned order. Stages
  run in this order; within a stage, the Biomek may not follow it, because a Transfer From File
  step decides its own order (B56358AF, 22-25).
- A list is **immutable**: it never changes after it's created. Adding, inserting, removing or
  replacing an operation returns a new list, and leaves the original unchanged, so code must keep the result:
  `list = list.add(transfer)`. This differs from `Layout` and `WellSelection`, which are
  mutable. The operation list is immutable because undo, of any kind of edit, needs earlier versions
  to stay as they were, and because several modules (volume tracking, the file writer, pages) share
  the same list; none of them can change it under the others.
- The list keeps its own copy of each operation it's given. Changing an object after adding it never
  changes the list, and operations read from the list can't be changed.
- **Unchanged operations are shared** (structural sharing, Andy, 2026-10-26). A new list stores a
  copy only of the operation that was added or replaced; for every other operation it keeps the very
  same stored operation as the list it came from, not a copy. That's safe because stored operations
  can't be changed, and it keeps each version small: an editor that keeps many versions for undo
  (`plan-history.md` in the transfer designer) stores only what each edit changed, plus a list of
  references, about 8 bytes per operation.
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
  between them: one block per stage. For example, stages `"1", "1", "2", "2", "3"` are possible;
  `"1", "2", "1"` is not.
- The list keeps this true by choosing where each transfer goes, so code never gives a position
  when adding:
  - `add` puts a transfer right after the last transfer of its stage. If its stage has no
    transfers yet, the transfer goes at the end of the list, starting a new stage that runs last.
  - `insertBeforeStage` starts a new stage just before an existing one, so it runs earlier.
  - `remove` takes out one transfer; the rest stay in order, so no stage can be split.
- The order of the blocks is the order the stages run.

**The stage rule**
- Within one stage, no well may be both a source and a destination. Within a stage the Biomek
  chooses its own order, so a well used both ways could be read before or after it is filled
  (roadmap, "Technical debt": this simple rule is a known shortcut).
- `add` and `insertBeforeStage` refuse a transfer whose source is a destination of another transfer
  in the same stage, or whose destination is a source of one.
- A transfer from a well into the same well (for example, to mix) gets no exemption. It doesn't
  change what the well holds, but whether its draw is possible depends on whether it runs before or
  after the stage's other transfers into or out of that well, and the Biomek chooses that order. A
  transfer is checked only against the other transfers in its stage, so a self-transfer on its own
  is accepted.
- A well is the same if both its labware and its well match exactly.

## 4. Interface
The module exports one class, `OperationList`.

| Member | Visibility | Description |
|---|---|---|
| `constructor()` | public | Creates an empty list. Takes no arguments. |
| `add(operation)` | public | Checks `operation` (see section 3) and returns a **new** list with a copy of it right after the last transfer of its stage, or at the end if its stage is new. The original list is unchanged. Throws if the operation isn't valid or breaks the stage rule. |
| `insertBeforeStage(operation, stage)` | public | Like `add`, but for a transfer whose stage is new: puts the copy just before the first transfer of `stage`, so the new stage runs right before that one. Throws if the operation isn't valid, `stage` isn't in the list, the operation's stage already has transfers (use `add`), or it breaks the stage rule. |
| `remove(position)` | public | Returns a **new** list without the operation at `position` (counting from 0, as in `listOperations()`). The original list is unchanged. Throws if `position` isn't a whole number from 0 to one less than the number of operations. |
| `replace(position, operation)` | public | Checks `operation` (see section 3) and returns a **new** list with a copy of it at `position`, in place of the operation there; every other operation keeps its place (and is shared, above). `operation` must be in the same stage as the operation it replaces, so the order of the stages can't change; to move a transfer to another stage, remove it and add it again. The stage rule is checked against the stage's other transfers, not the one being replaced. The original list is unchanged. Throws if `position` isn't valid, the operation isn't valid, its stage differs, or it breaks the stage rule. |
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
  stage: "1",
});
list.listOperations();   // [{ type: "transfer", source: …, destination: …, volume: 50, stage: "1" }]

list = list.insertBeforeStage(washTransfer, "1");   // washTransfer's new stage runs before stage "1"
list = list.replace(0, { ...firstTransfer, volume: 75 });   // same transfer, new volume
list = list.remove(0);                               // takes out the first transfer
list.groupByStage();     // [{ stage: "1", operations: [ … ] }, …]
```

## 5. Errors
`add`, `insertBeforeStage` and `remove` check their inputs and throw an `Error` whose message says what is wrong and how
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
| `insertBeforeStage`: `stage` not text, blank, or with whitespace at the start or end | The same three messages, naming `stage to insert before`: `The stage to insert before must be text, but got 2.` |
| `insertBeforeStage`: `stage` isn't in the list | `There's no stage "9" in the list to insert before.` |
| `insertBeforeStage`: the operation's stage already has transfers | `Stage "1" already has transfers, so a transfer in it can't start a new stage. Use add to add it to stage "1".` |
| The source is a destination in the same stage | `This transfer's source, Plate 1 A1, is a destination in stage "1" (operation 3). Within a stage, no well can be both a source and a destination. Put this transfer in another stage.` |
| The destination is a source in the same stage | `This transfer's destination, Plate 1 A1, is a source in stage "1" (operation 3). Within a stage, no well can be both a source and a destination. Put this transfer in another stage.` |
| `remove`: position isn't a whole number from 0 to one less than the number of operations | `The position to remove must be a whole number from 0 to 4, but got 7.` With an empty list: `There are no operations to remove.` |
| `replace`: position isn't a whole number from 0 to one less than the number of operations | `The position to replace must be a whole number from 0 to 4, but got 7.` With an empty list: `There are no operations to replace.` |
| `replace`: the operation's stage isn't the stage of the operation it replaces | `A replacement must stay in stage "1", the stage of operation 2, but is in stage "2". To move a transfer to another stage, remove it and add it again.` |

The checks run in the order of the table, for all of `source`, then all of `destination`, then
`volume`, then `stage`; then, for `insertBeforeStage`, its `stage` argument; then the stage rule
(source before destination). `replace` checks `position` first, then the operation as above, then
that its stage is the same, then the stage rule. Operation numbers in messages are positions in `listOperations()`,
counting from 0; when several transfers conflict, the first one is named. Within `source` and `destination`, every check on `labware` runs before any check on
`well`. The first problem found is reported. Each message names the end being checked (source or
destination), so it's clear which half of the transfer to fix.

In JavaScript a list (an array) and `null` both count as objects, so they are named in the object
rows to make sure those checks reject them explicitly. `NaN` and `Infinity` count as numbers, so the
volume check rejects them explicitly.

A failed `add`, `insertBeforeStage`, `remove` or `replace` changes nothing: the original list is never
touched.

## 6. Test cases
Each becomes at least one unit test in `operation-list.test.js`.

**Creating and adding**
- A new list is empty: `listOperations()` returns `[]`.
- `add` returns a new list containing the transfer, and the original list is still empty.
- Adding three transfers keeps them in the order they were added.
- A transfer with the same source and destination is accepted.
- `add` places a transfer by its stage (see "Placing by stage").
- A volume of `0` is accepted, and so is a decimal such as `2.5`.

**Placing by stage**
- Adding transfers in stages `"1", "2", "1"` gives the order `"1", "1", "2"`: the second stage `"1"`
  transfer goes right after the first, before stage `"2"`.
- Within a stage, transfers keep the order they were added.
- A transfer in a new stage goes at the end.
- `insertBeforeStage(t, "2")` with `t` in new stage `"3"`, on a list `"1", "2"`, gives `"1", "3", "2"`;
  inserting before the first stage puts it first.
- After that, `add` with stage `"3"` puts the transfer after stage `"3"`'s transfer, before stage
  `"2"`.
- `insertBeforeStage` returns a new list; the original is unchanged.

**Removing**
- `remove(1)` on a list of three takes out the middle transfer; the others keep their order.
- Removing a stage's only transfer removes that stage from `groupByStage()`.
- `remove` returns a new list; the original is unchanged.

**Replacing**
- `replace(1, …)` on a list of three, with the middle transfer's volume changed, gives a list whose
  middle transfer has the new volume; the others keep their order and values.
- `replace` returns a new list; the original is unchanged, including the replaced operation's volume.
- In stage `"1"`, with a transfer into Plate 1 A1 and another from Plate 1 B1, replacing the second
  with one from Plate 1 A1 is refused with the "source is a destination" message.
- Replacing a transfer with a changed copy of itself is accepted: it's checked against the stage's
  other transfers, not against the one it replaces.
- Replacing a transfer with one in another stage gives the different-stage message, even if that
  stage is in the list.

**Sharing**
- After `add`, every operation that was in the original list is the very same object (`===`) in the
  new list's `listOperations()`.
- After `remove`, every remaining operation is the very same object as in the original list.
- After `replace(position, …)`, every operation except the one at `position` is the very same object
  as in the original list; the one at `position` is a new object.
- After `insertBeforeStage`, every operation that was in the original list is the very same object.

**Grouping**
- Stages `"1", "1", "2", "2", "3"` give three groups from `groupByStage()`, in that order, each with
  its operations in order.
- An empty list gives `[]`.
- Changing what `groupByStage()` returns doesn't change the list.
- Stage IDs are compared exactly: `"1"` and `"01"` are different stages.

**The stage rule**
- In stage `"1"`, a transfer into Plate 1 A1, then one out of Plate 1 A1, is refused with the
  "source is a destination" message; the other way round gives the "destination is a source" message.
- The same two transfers in different stages are accepted.
- A transfer from Plate 1 A1 into Plate 1 A1 is accepted on its own in a stage.
- In one stage, a transfer into Plate 1 A1 and then one from Plate 1 A1 into Plate 1 A1 is refused
  with the "source is a destination" message; a transfer from Plate 1 A1 into Plate 1 A1 and then one
  into Plate 1 A1 is refused with the "destination is a source" message.
- Two transfers from Plate 1 A1 into Plate 1 A1 in one stage are refused.
- Wells with the same well name on different labware don't conflict: into Plate 1 A1 and out of
  Plate 2 A1 in one stage is accepted.
- `insertBeforeStage` starts a new stage with one transfer, which has nothing to conflict with, so
  the rule never refuses it there, including a transfer from a well into itself.

**Immutability and copies**
- Changing the object passed to `add` afterwards, including its `source`, doesn't change the list.
- Changing the list returned by `listOperations()`, for example removing an item, doesn't change the
  list.
- Changing a returned operation, or its `source` or `destination`, throws, and the list is
  unchanged.
- An earlier list is unchanged after later adds. (Undo relies on this.)
- The list's stored operations can't be reached or replaced from outside.

**Errors** (each row of section 5 has at least one test, including:)
- `replace` with position `7` on a list of five, `-1`, `1.5` and `"1"`, and any position on an empty
  list, give their messages.
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
- `insertBeforeStage` with stage `5`, `""` or `" 1"` gives the text errors; with stage `"9"` (not in
  the list) the not-in-list error; with a transfer whose stage already has transfers, the "use add"
  error.
- `remove` with `-1`, `2.5`, `"0"` and the number of operations gives the position error; `remove(0)`
  on an empty list gives "There are no operations to remove."
- A property that comes from a class rather than the object itself counts as missing, including
  `type`.
- Checks run in order: an operation with a bad source and a bad volume reports the source.
- Within an end, `labware` is checked fully before `well`: `source: { labware: " Plate 1", well: 5 }`
  reports the labware's whitespace error.
