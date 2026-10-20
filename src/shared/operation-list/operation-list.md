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

It doesn't know how the operations were chosen (by the randomizer, by hand, or another way). Tip
changes are planned as a later type (see section 2).

## 2. Scope
Version 1 holds operations of one type, `transfer`, and lets code add transfers and read the list
back in order.

Not in version 1 (see `docs/roadmap.md`):
- **Tip changes.** Planned as a second operation type. How they are represented depends on how the
  Span-8 changes tips, which isn't known yet.
- **Other per-operation instructions**, such as mixing.
- **Editing the list:** removing operations (for undo) and inserting them. Planned for the transfer
  designer.
- **Checking against labware**, such as whether a well exists on the named labware or a volume fits
  in it. This module doesn't do it.
- **Concentrations.** Volume tracking calculates them from the list; they are never stored in it.
- **Saving and loading** the list as a file.
- **Biomek file formats.** Turning the list into a worklist is the file writer's job.

## 3. Data model
**The list**
- An operation list is an instance of the `OperationList` class, created with `new OperationList()`.
  A new list is empty.
- Operations are kept in the order they were added. This is the planned order, not necessarily the
  order the Biomek pipettes: a Transfer From File step decides its own order (B56358AF, 22-25).
- A list is **immutable**: it never changes after it's created. Adding an operation returns a new
  list with the operation at the end, and leaves the original unchanged, so code must keep the
  result: `list = list.add(transfer)`. This differs from `Layout` and `WellSelection`, which are
  mutable. The operation list is immutable because undo, of any kind of edit, needs earlier versions
  to stay as they were, and because several modules (volume tracking, the file writer, pages) share
  the same list; none of them can change it under the others.
- The list keeps its own copy of each operation it's given. Changing an object after adding it never
  changes the list, and operations read from the list can't be changed.
- Every operation is an object with a `type` property naming its kind. Version 1 accepts only
  `"transfer"`, and rejects any other type.
- Code that uses the list reads only the operation types, and the properties, it needs, so new types
  or properties added later don't affect it.

**A transfer**
```js
{
  type: "transfer",
  source: { labware: "Reagents", well: "A1" },
  destination: { labware: "Plate 1", well: "D4" },
  volume: 50
}
```
- A transfer is an object with exactly four properties: `type`, `source`, `destination` and
  `volume`. `type` is always `"transfer"`.
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

## 4. Interface
The module exports one class, `OperationList`.

| Member | Visibility | Description |
|---|---|---|
| `constructor()` | public | Creates an empty list. Takes no arguments. |
| `add(operation)` | public | Checks `operation` (see section 3) and returns a **new** list with a copy of it at the end. The original list is unchanged. Throws if the operation isn't valid. |
| `listOperations()` | public | Returns the operations in order, as a new list each time. The operations in it can't be changed. |
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
list.listOperations();   // [{ type: "transfer", source: …, destination: …, volume: 50 }]
```

## 5. Errors
`add` checks the operation and throws an `Error` whose message says what is wrong and how to fix it.
Values in messages are shown with `describeValue` (`error-messages` module), so text appears in
quotes, a list as `a list` and any other object as `an object`.

| Problem | Message |
|---|---|
| Operation isn't an object (including `null` and lists) | `An operation must be an object with a type, like { type: "transfer", … }, but got null.` |
| `type` missing or not text | `An operation needs a type, like "transfer", but got undefined.` |
| `type` isn't a known type | `"tranfer" isn't an operation type. The only type is "transfer".` |
| A transfer property is missing | `A transfer needs source, destination and volume, but is missing "volume".` With several, all are listed in that order: `but is missing "source", "volume".` |
| A transfer has extra properties | `A transfer can only have type, source, destination and volume, but also got "volme".` With several, all are listed in the order they appear. |
| `source` or `destination` isn't an object (including `null` and lists) | `The source must be an object with a labware and a well, like { labware: "Plate 1", well: "A1" }, but got "A1".` |
| `labware` or `well` missing | `The source needs a labware and a well, but is missing "well".` |
| Extra property in `source` or `destination` | `The destination can only have a labware and a well, but also got "wel".` |
| `labware` or `well` not text | `The source labware must be text, but got 5.` |
| `labware` or `well` blank | `The destination well is blank. Give it at least one character that isn't a space.` |
| `labware` or `well` has whitespace at the start or end | `The source labware " Plate 1" has spaces at the start or end. Remove them.` |
| `volume` not a number, or less than 0 | `The volume must be a number of microliters, 0 or more, like 50, but got -5.` |

The checks run in the order of the table, for all of `source`, then all of `destination`, then
`volume`. The first problem found is reported. Each message names the end being checked (source or
destination), so it's clear which half of the transfer to fix.

In JavaScript a list (an array) and `null` both count as objects, so they are named in the object
rows to make sure those checks reject them explicitly. `NaN` and `Infinity` count as numbers, so the
volume check rejects them explicitly.

A failed `add` changes nothing: the original list is never touched.

## 6. Test cases
Each becomes at least one unit test in `operation-list.test.js`.

**Creating and adding**
- A new list is empty: `listOperations()` returns `[]`.
- `add` returns a new list containing the transfer, and the original list is still empty.
- Adding three transfers keeps them in the order they were added.
- A transfer with the same source and destination is accepted.
- A volume of `0` is accepted, and so is a decimal such as `2.5`.

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
- `destination: { labware: "Plate 1", wel: "D4" }` gives the missing error for `"well"`, because
  missing properties are checked before extra ones.
- `destination: { labware: "Plate 1", well: "D4", volme: 50 }` gives the extra-property error.
- `labware` and `well` values `5`, `""`, `"   "`, `" Plate 1"` and `"Plate 1 "` each give their error,
  for both source and destination.
- Volume `"50"`, `NaN`, `Infinity` and `-5` give the volume error.
- A property that comes from a class rather than the object itself counts as missing.
- Checks run in order: an operation with a bad source and a bad volume reports the source.
