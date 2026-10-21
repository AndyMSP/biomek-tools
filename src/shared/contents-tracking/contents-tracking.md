# contents-tracking — specification

> **Work in progress (draft, 2026-10-20).** Sections 1–4 are agreed. Section 5 (Errors) and section 6
> (Test cases) are still to be written. Nothing here is implemented yet.

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
It also reports when a transfer takes more liquid than its source well holds at that point, and which
wells are affected as a result.

Other operation types, when they're added, are skipped unless they change what's in a well.

Not in version 1 (see `docs/roadmap.md`):
- **Final concentrations** in units such as mM. These need each component's stock concentration,
  such as "Dye is 10 mM." Version 1 gives each component's volume fraction of a well (e.g. 10%); a
  later version multiplies that by the stock concentration (10% × 10 mM = 1 mM final).
- **Well capacities**, such as warning when a well overfills. These need labware types.
- **Dead volume**, the liquid a well holds that a tip can't reach.
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

**Contents after operations**

The same shape as the starting contents, so it could be used as starting contents:
- It lists every well that held something at the start or was reached by a transfer.
- A well that has been emptied is listed with empty components, `{}`.
- The order of wells, and of components within a well, isn't specified.

**Applying a transfer**

The transfer's volume leaves the source in proportion to everything in it, and the same amounts of
each component are added to the destination.

**Problems**

One entry for each transfer that requested more than its source well held at that point, in the
order they occur:
```js
{ operationIndex: 2, labware: "Plate 2", well: "D5", requested: 60, available: 50 }
```
- `operationIndex` is the transfer's position in `listOperations()`, counting from 0.
- `labware` and `well` are the source well.
- `requested` is the transfer's volume, and `available` is what the source held at that point, both
  in µL. The transfer moves `available`, which empties the source, and the replay carries on.

**Affected wells**

One entry for each well whose contents differ from the plan because of one or more problems:
```js
{ labware: "Plate 2", well: "D7", causes: [2, 3] }
```
- `causes` lists the `operationIndex` of each problem that reached this well, from lowest to
  highest, each once.
- A problem affects its source well and its destination well.
- Any transfer from an affected well passes all of that well's causes to its destination, combined
  with any causes the destination already has.

**Tiny amounts**
- Amounts are calculated with ordinary decimal arithmetic, at full precision. The module gives one
  set of values and never rounds them.
- When a transfer takes everything in a well, the arithmetic can leave tiny leftovers, such as
  0.00000000000000003 µL or a tiny negative amount. So after each transfer, if a well's **total**
  volume is below 0.000001 µL (one picoliter), the well is treated as empty, `{}`.
- Components in a well that isn't empty are kept, however small. For example, a well after nine
  10-fold dilutions still holds 0.0000001 µL of Dye, and that's real.
- A transfer counts as taking too much only if it requests more than the source holds by more than
  0.000001 µL.
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
*To be written.*

## 6. Test cases
*To be written.*
