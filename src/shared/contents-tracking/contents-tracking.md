# contents-tracking — specification

> **Draft (2026-10-30).** Reopened for item 11 of v0.2.0 (well capacities and dead volume): the
> three kinds of problem, and the usable volume. Final once Andy has tested the page built from it.

## 1. Purpose
`contents-tracking.js` works out what each well contains after a series of operations. It starts
from the contents of the wells before the first operation, and replays the transfers of an operation
list in order (see `operation-list.md`).

For each well, it gives the volume of each named component in microliters (µL), such as
`{ Dye: 5, Media: 10, Water: 85 }`. A well's total volume and each component's volume fraction are
calculated from those amounts, never stored separately.

It assumes each well is well mixed, so liquid taken from a well has the well's current mixture. It is
a pure calculation: the same starting contents and operation list always give the same result, and
nothing is changed. It can give the contents after any number of operations, not just the whole
list, so code can show a timeline, and a problem names the operation that caused it.

It is used by:
- **the transfer designer**, to show each well's contents as transfers are planned;
- **checking before Biomek output**, to catch problems such as drawing more than a well holds before
  files are written.

## 2. Scope
Version 1 takes the starting contents of the wells and an operation list, and works out the µL of
each named component in each well after any number of operations. A well's total volume and each
component's volume fraction (its share of the well, e.g. 10% Dye) are calculated from those amounts.
It also reports **problems**: a transfer that asks for more than its source well has above its
dead volume, and a well filled over its capacity; and which wells are affected as a result. Each
labware's capacity and dead volume come from the `deck` module (`deck.md`); labware the deck
doesn't know has neither, so only its arithmetic is tracked.

Other operation types, when they're added, are skipped unless they change what's in a well.

Not in version 1 (see `docs/roadmap.md`):
- **Final concentrations** in units such as mM. These need each component's stock concentration,
  such as "Dye is 10 mM." Version 1 gives each component's volume fraction of a well (e.g. 10%); a
  later version multiplies that by the stock concentration (10% × 10 mM = 1 mM final).
- **Spilling.** A well filled over its capacity is reported, but its contents are tracked as if
  the liquid had fit, since what spills can't be known.
- **A working maximum** below the capacity, such as headroom for mixing (roadmap, item 11).
- **Losses**, such as evaporation, liquid left on tips, or pipetting inaccuracy. Version 1 assumes
  every transfer moves exactly its volume.
- **Saving and loading** starting contents.
- **Showing the results**, including a timeline. That belongs to pages.

## 3. Data model
**Starting contents**

A list with one entry per well that holds something at the start:
```js
[
  { labware: "Reagents", well: "A1", components: { Dye: 1000 } },
  { labware: "Reagents", well: "A2", components: { Media: 1000 } },
  { labware: "Plate 1", well: "B3", components: { Media: 180, Water: 20 } }
]
```
- `labware` and `well` follow the same rules as in a transfer: text that isn't blank and has no
  whitespace at the start or end.
- `components` maps each component's name to its volume in µL. A name follows the same text rule; a
  volume is a number, 0 or more. A volume of 0 is accepted and treated as absent.
- Each well appears at most once. Wells that aren't listed start empty.
- Labware, well and component names are compared exactly, including capital letters and spaces:
  `"a1"` and `"A1"` are different wells. This matches `operation-list`, where labware names must
  match the Biomek method's names exactly.

**Contents after operations**

The same shape as the starting contents, so it could be used as starting contents:
- It lists every well that held something at the start, or was the source or destination of a
  transfer. A source counts even if it never held anything, because a tip still went into it.
- A well that has been emptied is listed with empty components, `{}`.
- The order of wells, and of components within a well, isn't specified.

**Capacity, dead volume and usable volume**

For a labware the deck knows (`hasLabware`, `deck.md`), its capacity is `capacityOf(labware)` and
its dead volume `deadVolumeOf(labware)`. A well's **usable volume** is what it holds minus its
labware's dead volume, never below 0: a trough holding 2300 µL with a 2000 µL dead volume has
300 µL usable; one holding 1500 µL has 0. For labware the deck doesn't know, the dead volume is 0
(the usable volume is what the well holds) and there is no capacity.

**Applying a transfer**

The transfer's volume leaves the source in proportion to everything in it, and the same amounts of
each component are added to the destination. A transfer can take only the source's usable volume:
if it asks for more, it moves the usable volume and is recorded as a problem (below).

**Problems**

One entry for each problem, in the order they occur, each with a `kind`:

- **`"dead-volume"`**: a transfer asked its source for more than its usable volume, but not more
  than it held. The tip would reach into the dead volume and draw air.
  ```js
  { kind: "dead-volume", operationIndex: 2, labware: "Res", well: "5",
    requested: 400, held: 2300, deadVolume: 2000, available: 300 }
  ```
- **`"overdraw"`**: a transfer asked its source for more than it held at all. The same entry
  shape as `"dead-volume"`, e.g. `requested: 60, held: 50, deadVolume: 20, available: 30`.
- **`"overfill"`**: a well is over its capacity: a transfer took its destination over, or a well
  starts over. Reported once per crossing: a transfer into a well that's already over capacity
  isn't a new problem, and a well that starts over is a problem of the start only.
  ```js
  { kind: "overfill", operationIndex: 4, labware: "Plate 2", well: "A1", held: 380, capacity: 360 }
  { kind: "overfill", operationIndex: null, labware: "Plate 2", well: "B1", held: 400, capacity: 360 }
  ```

In every entry:
- `operationIndex` is the transfer's position in `listOperations()`, counting from 0; `null` for
  a well that starts over its capacity.
- `labware` and `well` are the source well for a draw, the destination for an overfill.
- Volumes are in µL: `requested` is the transfer's volume; `held` what the well held when the
  transfer was asked (for an overfill, what it holds after it); `deadVolume` the labware's;
  `available` the usable volume, which the transfer moves; `capacity` the labware's.

A draw problem is `"dead-volume"` or `"overdraw"`, never both: `"overdraw"` when `requested` is
more than `held`, else `"dead-volume"`. Labware the deck doesn't know can have `"overdraw"`
problems only (its dead volume is 0 and it has no capacity).

Problems come in the order they occur: the starting overfills first, in the starting contents'
order, then each transfer's, a draw problem before an overfill of the same transfer.

**Affected wells**

One entry for each well whose contents differ from the plan because of one or more draw problems
(`"dead-volume"` or `"overdraw"`):
```js
{ labware: "Plate 2", well: "D7", causes: [2, 3] }
```
- `causes` lists the `operationIndex` of each draw problem that reached this well, from lowest to
  highest, each once.
- A draw problem affects its source well and its destination well.
- An overfill affects no well: the contents are tracked as the plan says (section 2, "Spilling").
- Any transfer from an affected well passes all of that well's causes to its destination, combined
  with any causes the destination already has.
- The order of the affected wells isn't specified.

**Tiny amounts**
- Amounts are calculated with ordinary decimal arithmetic, at full precision. The module gives one
  set of values and never rounds them.
- When a transfer takes everything in a well, the arithmetic can leave tiny leftovers, such as
  0.00000000000000003 µL or a tiny negative amount. So after each transfer, if a well's **total**
  volume is below 0.000001 µL (one picoliter), the well is treated as empty, `{}`.
- Components in a well that isn't empty are kept, however small. For example, a well after nine
  10-fold dilutions still holds 0.0000001 µL of Dye, and that's real.
- A transfer counts as taking too much only if it requests more than the source's usable volume by
  more than 0.000001 µL, and as an overdraw only if it requests more than the source holds by more
  than that. A transfer that requests more by less than that isn't a problem, and moves the usable
  volume, as a draw problem does, so no amount goes below 0. Likewise a well counts as over its
  capacity only by more than 0.000001 µL.
- Rounding for display is left to pages.

One picoliter is far smaller than anything a pipette can move, and far larger than rounding
leftovers. It is a named constant in the code, not lab configuration.

## 4. Interface
The module exports one function and one class.

| Member | Description |
|---|---|
| `replay(startingContents, operationList, operationCount)` | Checks the starting contents, then applies the first `operationCount` operations of `operationList` (an `OperationList`), in order. Returns a `ContentsSnapshot`. `operationCount` is optional: leave it out to apply every operation. |
| `ContentsSnapshot` | The contents, problems and affected wells at one moment. Made only by `replay`; immutable. |

**`ContentsSnapshot` members**

| Member | Description |
|---|---|
| `listContents()` | The contents list, as a new list each time. |
| `listProblems()` | The problems list, as a new list each time. |
| `listAffected()` | The affected-wells list, as a new list each time. |
| `componentsOf(labware, well)` | One well's components, e.g. `{ Dye: 10, Media: 90 }`. A well that has never held anything gives `{}`. |
| `totalVolumeOf(labware, well)` | One well's total volume in µL, e.g. `100`. |
| `usableVolumeOf(labware, well)` | One well's usable volume in µL: its total minus its labware's dead volume, never below 0, and 0 when the difference is below 0.000001 µL (section 3, "Tiny amounts"), so a mixture drawn down to exactly the dead volume reads as 0 usable despite arithmetic leftovers. Callers take the usable volume from here rather than subtracting themselves. |
| `volumeFractionsOf(labware, well)` | Each component's volume fraction, from 0 to 1, e.g. `{ Dye: 0.1, Media: 0.9 }`. An empty well gives `{}`. |
| `causesOf(labware, well)` | The well's causes, e.g. `[2, 3]`, or `[]` if it isn't affected. |

Example:
```js
const after   = replay(startingContents, list);      // after every operation
const earlier = replay(startingContents, list, 3);   // after the first 3
after.componentsOf("Plate 2", "D7");                 // { Dye: 20, Media: 25, Water: 25 }
after.causesOf("Plate 2", "D7");                     // [2, 3]
```

## 5. Errors
`replay` and the `ContentsSnapshot` methods that take a labware and a well check their inputs. When
something is wrong they throw an `Error` whose message says what's wrong and how to fix it. Values in
messages are shown with `describeValue` (`error-messages` module), so text appears in quotes, a list
as `a list` and any other object as `an object`.

**Starting contents**

Entries are numbered by their position in the list, counting from 0, like `operationIndex`.

| Problem | Message |
|---|---|
| Starting contents isn't a list | `The starting contents must be a list of wells, like [{ labware: "Plate 1", well: "A1", components: { Water: 100 } }], but got an object.` |
| An entry isn't an object (including `null` and lists) | `Starting contents entry 2 must be an object with a labware, a well and components, but got "A1".` |
| An entry is missing properties | `Starting contents entry 2 needs labware, well and components, but is missing "components".` With several, all are listed in that order. |
| An entry has extra properties | `Starting contents entry 2 can only have labware, well and components, but also got "volume".` With several, all are listed in the order they appear. |
| `labware` or `well` not text | `The labware in starting contents entry 2 must be text, but got 5.` |
| `labware` or `well` blank | `The well in starting contents entry 2 is blank. Give it at least one character that isn't a space.` |
| `labware` or `well` has whitespace at the start or end | `The labware in starting contents entry 2 " Plate 1" has spaces at the start or end. Remove them.` |
| `components` isn't an object (including `null` and lists) | `The components in starting contents entry 2 must be an object of names and volumes, like { Water: 100 }, but got 100.` |
| A component name is blank or has whitespace at the start or end | `The component name in starting contents entry 2 " Dye" has spaces at the start or end. Remove them.` |
| A component volume isn't a number, or is less than 0 | `The volume of "Dye" in starting contents entry 2 must be a number of microliters, 0 or more, like 50, but got -5.` |
| The same well appears twice | `Plate 1 A1 is in the starting contents twice, in entries 0 and 4. List each well once.` |

As in `operation-list`, only an entry's own properties count; a property that comes from a class
counts as missing.

**Operation list and operation count**

| Problem | Message |
|---|---|
| `operationList` isn't an `OperationList` | `The operation list must be an OperationList, made with new OperationList() and add, but got a list.` |
| `operationCount` isn't a whole number | `The operation count must be a whole number, like 3, but got 2.5.` |
| `operationCount` is less than 0 or more than the number of operations | `The operation count must be from 0 to 5, the number of operations in the list, but got 7.` |

Leaving out `operationCount`, or passing `undefined`, means "apply every operation" and isn't an
error. `null` is an error. `replay` doesn't check individual operations, because `OperationList`
checked each one when it was added.

`replay` checks in the order of the tables: every entry of the starting contents in turn (each
entry's checks in table order, `labware` before `well`, and its components one at a time, each name
before its volume), then the operation list, then the operation
count. The first problem found is reported. `NaN` and `Infinity` count as numbers in JavaScript, so
the volume and count checks reject them by name.

A transfer that asks for more than its source's usable volume, or that fills a well over its
capacity, is not an error. It is recorded as a problem (section 3), and the replay carries on.

**Methods that take a labware and a well**

`componentsOf`, `totalVolumeOf`, `usableVolumeOf`, `volumeFractionsOf` and `causesOf` check `labware`, then `well`,
with the same text rules. Each message names the method:

| Problem | Message |
|---|---|
| Not text (including left out) | `The well given to componentsOf must be text, but got undefined.` |
| Blank | `The labware given to causesOf is blank. Give it at least one character that isn't a space.` |
| Whitespace at the start or end | `The well given to totalVolumeOf " A1" has spaces at the start or end. Remove them.` |

A labware and well the snapshot has no record of counts as an empty well, not an error, because the
snapshot doesn't know which labware exist. A misspelled name therefore reads as empty. Callers should
take names from the layout.

## 6. Test cases
Each becomes at least one unit test in `contents-tracking.test.js`. Amounts are compared allowing a
difference of up to 0.000000001 µL, because decimal arithmetic leaves tiny leftovers (section 3).

The examples use these starting contents unless a case says otherwise:
```js
[
  { labware: "Reagents", well: "A1", components: { Dye: 1000 } },
  { labware: "Plate 1", well: "A1", components: { Media: 90 } },
  { labware: "Plate 1", well: "B1", components: { Water: 50 } }
]
```

**Starting contents**
- With no operations, `listContents()` gives the starting contents.
- An empty starting contents `[]` with no operations gives `[]`.
- A component with volume `0` is left out: `{ Dye: 0, Water: 100 }` gives `{ Water: 100 }`, and an
  entry whose components are all `0` is listed with `{}`.
- A well that isn't listed gives `{}`, `0`, `{}` and `[]` from the four `...Of` methods.
- Names are compared exactly: `"a1"` and `"A1"` in the same labware are two different wells, not
  a duplicate, and `componentsOf("Plate 1", "a1")` doesn't find `"A1"`.

**Applying transfers**
- 10 µL from Reagents A1 to Plate 1 A1: Plate 1 A1 holds `{ Dye: 10, Media: 90 }`, Reagents A1 holds
  `{ Dye: 990 }`.
- Then 50 µL from Plate 1 A1 to Plate 1 A2 (empty): each holds `{ Dye: 5, Media: 45 }`. The mixture
  leaves in proportion.
- `totalVolumeOf` for Plate 1 A1 gives `100` after the first transfer, and `volumeFractionsOf` gives
  `{ Dye: 0.1, Media: 0.9 }`.
- A transfer of 0 µL changes no amounts.
- A transfer whose source and destination are the same well leaves it unchanged.
- Taking a well's whole volume leaves it listed with `{}`.
- Every well named by an applied transfer, as source or destination, is listed in `listContents()`.
- Serial dilution: Reagents A1 holds `{ Dye: 100 }`, and Plate 1 A1 to A9 each hold
  `{ Media: 90 }`. 10 µL goes from Reagents A1 to Plate 1 A1, then from A1 to A2, and so on to A9.
  Plate 1 A9 holds Dye 0.0000001 µL (10 × 0.1⁸), kept, not removed.

**Operation count**
- `operationCount` 0 gives the starting contents.
- With three transfers, `operationCount` 2 gives the contents after the first two.
- Leaving out `operationCount`, and passing `undefined`, both apply every operation.
- `operationCount` equal to the number of operations is accepted.

**Problems and affected wells** (on labware the deck doesn't know, where the dead volume is 0)
- 60 µL from Plate 1 B1 (holding 50) to Plate 1 B2, as operation 0: `listProblems()` gives
  `[{ kind: "overdraw", operationIndex: 0, labware: "Plate 1", well: "B1", requested: 60, held: 50,
  deadVolume: 0, available: 50 }]`. B1 holds `{}`, B2 holds `{ Water: 50 }`, and both have causes
  `[0]`.
- The replay carries on: a later transfer from B2 to B3 gives B3 causes `[0]`.
- A transfer from a well that has never held anything is a problem with `available: 0`.
- Causes combine: if B3 then receives a transfer from a second problem, operation 2, its causes are
  `[0, 2]`, from lowest to highest, each once.
- A well reached only by transfers with no problem upstream isn't listed in `listAffected()`, and
  `causesOf` gives `[]`.
- Problems are listed in the order the operations occur.
- An overdraw from a well to itself is a problem, the well is affected, and its contents are
  unchanged.
- Labware the deck doesn't know gets no overfill: a well on Plate 1 holding 1,000,000 µL has no
  problem.

**Dead volume and capacity** (on the real deck: the tests find a labware in `DECK` and take its
capacity and dead volume from `config/labware-types.js`, so changing the numbers never breaks
them; `D` is the dead volume and `C` the capacity of the labware chosen.)
- A well holding `D + 100` with a transfer of 100 µL from it: no problem; it holds `D` afterwards.
- A well holding `D + 100` with a transfer of 150 µL from it: one `"dead-volume"` problem with
  `requested: 150, held: D + 100, deadVolume: D, available: 100`; the well holds `D` afterwards
  (100 moved), and both wells have the transfer in their causes.
- A well holding `D + 100` with a transfer of `D + 150` µL from it: one `"overdraw"` problem with
  `held: D + 100, available: 100`; 100 moved.
- A well holding `D` exactly, or less, has 0 usable: a transfer of 1 µL from it is a
  `"dead-volume"` problem with `available: 0`, and nothing moves. (Only if `D` is above 0; for a
  labware with `D` of 0 the case is an overdraw.)
- Requesting 0.0000005 µL more than the usable volume isn't a problem; 0.000002 µL more is.
- `usableVolumeOf` gives `100` for a well holding `D + 100`, `0` for one holding `D` or less,
  and `0` for a well of two components holding `D + 150` after a draw of 150 µL, whatever leftover
  the arithmetic leaves (e.g. 2150 + 150 drawn 300 leaves 2000.0000000000002); on labware the deck
  doesn't know, it equals `totalVolumeOf`.
- A well holding `C - 10` receiving 20 µL: one `"overfill"` problem with
  `operationIndex` the transfer's, `held: C + 10, capacity: C`; the well holds `C + 10`, and
  neither well is affected (`listAffected()` doesn't list it; `causesOf` gives `[]`).
- A well holding `C - 10` receiving 10 µL exactly: no problem. Receiving `10 + 0.0000005` µL: no
  problem; `10 + 0.000002`: a problem.
- The transfer that takes a well over capacity is the problem, and a second transfer into the
  well, now over, isn't: two transfers of 20 µL into a well holding `C - 10` give one problem,
  the first's.
- A well that starts holding `C + 1` gives an `"overfill"` problem with `operationIndex: null`
  before any transfer's problem, and a transfer into it adds no overfill.
- One transfer with both: from a well holding `D + 50` asking 60 µL into a well holding `C - 10`:
  a `"dead-volume"` problem then an `"overfill"` problem (50 moved, so the destination holds
  `C + 40`), in that order.
- Problems of several kinds are listed in the order they occur.

**Tiny amounts**
- A well holding `{ Water: 0.30000000000000004 }` (0.1 + 0.2 in JavaScript) gives `{}` after a
  transfer of 0.3 µL from it, and there is no problem.
- Requesting 0.0000005 µL more than the source holds isn't a problem; requesting 0.000002 µL more
  is.

**Immutability and copies**
- `replay` doesn't change the starting contents or the operation list passed to it.
- Changing the starting contents after `replay` doesn't change the snapshot.
- Changing a list or object returned by `listContents()`, `listProblems()`, `listAffected()` or an
  `...Of` method doesn't change the snapshot.
- Two `replay` calls with the same inputs give equal results.
- `ContentsSnapshot` can't be made except by `replay`: calling `new ContentsSnapshot()` throws.

**Errors** (each row of section 5 has at least one test, including:)
- Starting contents `null`, `{}` and `"A1"` give the list error.
- Entries `null`, `5` and `[]` give the entry error, naming the entry's position.
- An entry missing `components`, and one missing `labware` and `well`, give the missing error; an
  entry with `volume: 50` alongside valid properties gives the extra-property error.
- `labware` and `well` values `5`, `""`, `"   "`, `" Plate 1"` and `"Plate 1 "` each give their
  error.
- `components` values `100`, `null` and `[]` give the components error.
- Component names `""` and `" Dye"` give their errors.
- Component volumes `"50"`, `NaN`, `Infinity` and `-5` give the volume error.
- The same labware and well in entries 0 and 4 gives the duplicate error naming both entries.
- An operation list given as a plain list of transfers gives the operation-list error.
- `operationCount` values `2.5`, `"3"`, `null`, `NaN`, `-1` and one more than the number of
  operations give their errors.
- Checks run in order: a bad entry 1 and a bad operation count report entry 1.
- Each `...Of` method rejects a `labware` or `well` of `5`, `""` or `" A1"`, naming the method.
