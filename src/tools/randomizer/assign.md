# assign — specification

> Experiment branch: written without section-by-section review, to see a complete randomizer.

## 1. Purpose
`assign.js` is the randomizer's core. It checks the user's inputs, builds the list of items to place
(each condition's replicates, then the filler), shuffles it with the seeded generator, and fills the
open wells of a layout with it. Fixed wells get the fixed contents or their override. It implements
sections 5 and 7 of `randomizer.md`.

## 2. Inputs
One object:

| Property | Description |
|---|---|
| `fixedWells` | A `WellSelection`; selected wells are fixed, the rest are open. Its grid is the plate. |
| `conditions` | A list of rows `{ name, replicates }`, in the order listed. Names are trimmed. |
| `fixedContents` | Text; the contents of fixed wells that aren't overridden. Trimmed. |
| `overrides` | A list of rows `{ well, name }`, each giving one fixed well its own contents. Trimmed. |
| `filler` | Text; the contents of spare open wells. Trimmed. |
| `seed` | A whole number from 1 to 999,999. |

## 3. Interface
| Export | Description |
|---|---|
| `findProblems(inputs)` | Returns every problem with the inputs as a list of messages, in the order below; `[]` if none. Never throws for bad user input. |
| `randomize(inputs)` | Returns the result, or throws an `Error` whose message is the first problem. |
| `WELL_TYPES` | The four well types: `replicate`, `filler`, `fixed-contents`, `override`. |

The result is `{ layout, wellTypes, seed }`: a `Layout` holding every well's contents, a `Map` from
well name to its well type, and the seed used.

## 4. Behavior
1. Build the items: each condition's name repeated by its replicates, in listed order (type
   `replicate`), then the filler once for each spare open well (type `filler`).
2. Shuffle them with `new SeededRandom(seed).shuffled(items)`.
3. Give the open wells (`fixedWells.unselectedWells()`, standard order) the shuffled items in turn.
4. Give each fixed well its override (type `override`) or else the fixed contents
   (type `fixed-contents`).

Fixed contents are needed only if some fixed well has no override; a filler only if there are spare
open wells. Unneeded ones are ignored.

## 5. Problems
Checked in this order. Rows are numbered from 1.

| Problem | Message |
|---|---|
| Condition name empty | `Row 3: the condition name is empty.` |
| Replicates not a whole number of at least 1 | `Row 3: replicates must be a whole number of at least 1, but got "four".` |
| Duplicate condition name | `Row 5: "Condition 2" is already listed in row 2.` |
| Override well not on the grid | `Override row 1: ` followed by the grid's own message |
| Override well isn't fixed | `Override row 1: D4 isn't a fixed well. Fix it, or remove the override.` |
| Override well already overridden | `Override row 3: A1 is already overridden in row 1.` |
| Override contents empty | `Override row 1: the contents name is empty.` |
| Too many replicates (only checked if every condition row is valid) | `The conditions need 64 wells, but only 60 are open. Remove 4 replicates or open 4 more wells.` |
| Spare open wells, no filler | `12 open wells are left over. Name a filler for them.` (1: `1 open well is left over. Name a filler for it.`) |
| Fixed wells without override, no contents | `Name the contents of the fixed wells.` |
| Seed | `The seed must be a whole number from 1 to 999,999, but got 0.` |

Counts of 1 use the singular (`1 replicate`, `1 more well`, `only 1 is open`).

## 6. Test cases
The setups and checks of `randomizer.md` section 8, plus:
- `findProblems` returns `[]` for each valid setup, and several problems at once when there are
  several.
- Overrides: the problems above; an override on a fixed well with no fixed contents needed.
- Golden file: the main example with seed 37 matches `tests/fixtures/randomizer-main-seed-37.json`
  (to be checked by Andy).
