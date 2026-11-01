# randomizer — specification

> **Draft change (2026-11-01):** the assignment (section 5, steps 1 to 3) is now done by the shared
> `random-pool` module (`random-pool.md`), with the open wells as the pool, so the randomizer and the
> transfer designer's randomizations share one copy of the randomizing logic (ADR 0012). The rules,
> results and golden files don't change. It becomes Final once built and tested by Andy.

## 1. Purpose
The randomizer assigns an experiment's conditions to random wells on a plate, to spread position
effects such as edge drying or uneven seeding evenly across conditions. It takes a list of
conditions with how many replicates each needs, and which wells are fixed and what they contain. The
replicates are put in a random order and placed into the remaining (open) wells. The result is
reproducible: the same inputs and seed always give the same plate. The outputs are the randomized
plate and two lists: where each condition went, and what each well contains.

## 2. Scope
Version 1 randomizes a single 96-well plate (`GRID_96`).

Not in version 1 (see `docs/roadmap.md`): several plates, constrained randomization (e.g. one
replicate per quadrant), other plate formats, saving and reloading inputs, Celigo labeling, and
Biomek output.

How the inputs are entered on screen, and what version 1 of the page leaves out, is in
`randomizer-page.md`.

## 3. Terms
**Open wells** are filled by the random assignment. Each is either:
- a **replicate well**, holding one replicate of a condition, or
- a **filler well**, holding the filler.

**Fixed wells** have contents given in the inputs. Each fixed well holds the name of the
**fixed-contents entry** it belongs to.

**Fixed-contents entry**: one name together with the wells that hold it, e.g. `Static` in the 36 outer
wells, or `Blank` in A1 and H12 (in code, `{ name, wells }`, where `wells` is a `WellSelection`). The
fixed contents are a list of these entries.

Every well in the result is exactly one of the three **well types**: replicate, filler or fixed.

## 4. Inputs

### Condition list
Each condition has a name and a number of replicates. The conditions are in the order given.
- Names are text, at least one character. A name with a space (or other whitespace) at the start or
  end is rejected, not trimmed, so a name always matches its source exactly, e.g. when it is later
  matched against another tool's file. The same applies to the fixed-contents names and the filler.
- Replicates are whole numbers of at least 1.
- Two conditions in the list can't have the same name. A condition may share its name with the
  filler or a fixed-contents entry (see Shared names).
- The list may be empty. Every open well then gets the filler.
- A **completely empty row**, with no name and missing replicates (section 7), is skipped: it gets no
  messages, places nothing, and doesn't count toward the replicates or spare wells. It still counts
  for the row numbers in messages, so they match the table, and `matchesInputs` still compares it
  exactly, so adding or removing an empty row makes a result out of date. A row with only a name, or
  only replicates, is not empty and is checked as usual.

### Fixed contents
The fixed contents are a list of entries, in the order given. Each entry has a name and a set of wells
(a `WellSelection`, `well-selection` module).
- A well is **fixed** if it belongs to an entry, and **open** otherwise. Whether a well is fixed is
  given by the entries, never worked out from its contents.
- Each fixed well belongs to exactly one entry.
- An entry may have no wells. It is allowed, and it isn't listed in the outputs.
- An entry's name follows the same rules as a condition's name. A name may be empty only while the
  entry has no wells.
- Two entries can't have the same name.

### Placing and opening wells
Two functions change which wells belong to which entry. They keep each well in at most one entry, so
callers (such as the page) never edit the selections directly:
- `placeName(fixedContents, wells, entry)` puts the entry's name in the given wells: each well is
  removed from every other entry, then added to `entry`. `wells` is a list of well names, e.g. `["A2"]`
  for one well, or a box from `wellsInBox` (`well-grid` module). `entry` is one of the entries in
  `fixedContents` itself, not its position, so it still means the same entry after others are
  removed or renamed.
- `openWells(fixedContents, wells)` removes each given well from every entry, so it becomes open.

Placing a name in a well that already holds it, or opening a well that is already open, changes
nothing and isn't an error. Both functions change the entries' selections in place and return
nothing. Each well name is checked first; if any is invalid, the grid's own message is thrown and
nothing is changed.

Renaming an entry needs no function: changing its `name` keeps its wells.

### Filler
If the open wells outnumber the replicates, a filler must be named (e.g. "PBS") for the spare open
wells. Filler wells are placed randomly, so they can't be given individual contents. If there are no
spare open wells, no filler is needed.

**Spare wells.** `spareWellCount(inputs)` gives the number of spare open wells: the open wells minus
the total replicates, or 0 if the replicates don't fit. It is `null` while any replicate count isn't
valid, because the total isn't known yet. For the main example (section 9) it is 12.

### Seed
A whole number from 1 to 999,999.

**A random seed.** `randomSeed(randomNumber)` turns a random number from 0 up to (but not including)
1, such as `Math.random()` gives, into a seed: `Math.floor(randomNumber × 999,999) + 1`, so every seed
from 1 to 999,999 is equally likely, e.g. 0 → 1, 0.5 → 500,000 and 0.9999999 → 999,999. It is given
the random number rather than calling `Math.random()` itself, so it can be tested. Anything other than
a number from 0 up to 1 throws `randomSeed needs a number from 0 up to 1, like Math.random() gives, but
got 2.`

### Shared names
The same name may appear in several places: "PBS" could be a fixed-contents entry, the filler and a
condition at once. The two lists treat them as the same contents, while each well's type still
records which role put it there.

## 5. Assignment rules
1. Build the list of items to place: each condition repeated by its number of replicates, in the
   order the conditions are listed, followed by the filler once for each spare open well.
2. Put the list in a random order with a Fisher–Yates shuffle, driven by the seeded random number
   generator (`random` module) started from the seed.
3. Create a new, empty layout (`layout` module) on `GRID_96`. Fill the open wells in standard well
   order (A1, A2 … H12, skipping fixed wells), taking the next item from the shuffled list for each.
4. Each fixed well gets the name of its fixed-contents entry.

Steps 1 to 3 are done by `assignPool` (`random-pool.md`). The pool: an item per condition row that
isn't completely empty, keyed `"row 1"`, `"row 2"` … by its row number, with its replicates, in
row order; then, if a filler is named, one more item keyed `"filler"` with `replicates` `null`,
and `filler` set to `"filler"` (`null` when the filler is `""`); the open wells, in standard order,
as `wells`; and the seed. (Keys are rows, not names, since a condition may share its name with the
filler.) `randomize` puts each assigned well's row's condition name, or the filler's name, in the
well, with the type `assignPool` gives (`replicate` or `filler`). `randomSeed` (section 4) moves to
`random-pool` too, and `randomizer.js` re-exports it. The golden files (section 9) confirm the
plates are the same as before.

The inputs are never changed, and each run creates a new layout. The **result** holds three things:
- **the layout**: what each well contains;
- **the well types**: each well's type (see Terms), recorded alongside the layout because the layout
  holds only names, and a shared name such as "PBS" doesn't say which role put it in a well;
- **the inputs**: a copy of the inputs the result was made from, including the seed. It is a copy, so
  later changes to the inputs (e.g. `placeName`, or renaming an entry) don't change it: the
  conditions are new objects, and each fixed-contents entry has a new `WellSelection` holding the same
  wells.

For example, on a two-well plate where A1 is fixed and A2 is open:
```js
{
  layout,      // a Layout where A1 holds { name: "Static" } and A2 holds { name: "Condition 1" }
  wellTypes: { A1: "fixed", A2: "replicate" },
  inputs,      // a copy: conditions, fixedContents, filler, and seed 37
}
```

Each well is equally likely to receive any of the items. (A 32-bit seed can't reach every possible
arrangement of a full plate, but every arrangement it produces is a fair shuffle; see ADR 0003.)

**Reproducibility.** The same condition list *in the same order*, the same fixed contents, the same
filler and the same seed always give the same plate, on any computer. Changing the order of the
conditions, or any replicate count, can change the plate, even with the same seed. Renaming a
condition doesn't: the same wells receive the new name. Because the result keeps a copy of its
inputs, it always records exactly how it was made. (Saving and reloading inputs is on the roadmap.)

**Matching inputs.** `matchesInputs(result, inputs)` returns `true` if `inputs` are exactly the
inputs the result was made from, and `false` otherwise. Everything is compared exactly: the
conditions (names, replicates and order), the fixed-contents entries (names, wells and order), the
filler and the seed. The page uses it to show that a result is out of date (see
`randomizer-page.md`).

## 6. Outputs
Randomizing gives:
- **The randomized plate**: every well's contents and type (the result, section 5).
- **The seed** used, from the result's copy of the inputs.
- **Contents → wells**: each distinct contents with the wells that hold it, in standard well order,
  e.g. `Condition 1: B4, D9, F2, G7`, listed in the listing order below, skipping names no well
  holds. The order comes from the result's copy of the inputs. This is the list used at the bench
  while plating.
- **Well → contents**: all 96 wells in standard order, each with its contents. This is the list used
  to label results; pasted into Excel, it can also be sorted or filtered by contents.

**Listing order.** `listingOrder(inputs)` gives every name in the inputs once, in this order:
conditions as listed, then the filler, then the fixed-contents entries as listed. Empty names are
left out, and a name already listed isn't repeated, so a shared name keeps the first role it appears
in. Each name comes with that **role** (`condition`, `filler` or `fixed`) and its **position** in that
role's own list, counting from 0. For example, with conditions `Condition 1` and `Static`, filler
`Spare`, and fixed contents `Static` then `Blank`:
```js
[
  { name: "Condition 1", role: "condition", position: 0 },
  { name: "Static",      role: "condition", position: 1 },  // the fixed "Static" shares this one
  { name: "Spare",       role: "filler",    position: 0 },
  { name: "Blank",       role: "fixed",     position: 1 },  // Blank is fixed contents 2
]
```
It includes names no well holds. Contents → wells uses it for its order; the page uses it to give
each name a color that stays the same while other roles are edited (see `randomizer-page.md`).

Each list also has a **copy text**: the list as tab-separated text, so it pastes into Excel as
columns. The copy text has **no header row**, because it is often pasted into other programs that
wouldn't know what to do with one. The copy texts are for people. Later integrations, such as Biomek
output and Celigo labeling, will use the same information directly from the plate data inside the
tool, not the copy texts.
- Contents → wells: two columns (contents, wells), one row per contents, with its wells in one cell
  separated by commas and spaces, e.g. `Condition 1⇥B4, D9, F2, G7` (⇥ is a tab).
- Well → contents: two columns (well, contents), one row per well, e.g. `A1⇥Static`.

## 7. Errors
The logic checks every input itself, because it is tested in Node without the screen and may later
be used by other tools. A checking function returns **every** problem at once, as a list of messages
that say what is wrong and how to fix it (an empty list if there are none). Randomizing with
inputs that have problems throws an `Error` whose message is the first problem.

How the page shows these messages is in `randomizer-page.md`.

Fixed-contents entries are numbered from 1 in the order listed, as conditions are numbered by row.

| Problem | Message |
|---|---|
| Condition name empty | `Row 3: the condition name is empty.` |
| Condition name with a space at the start or end | `Row 3: the condition name has a space at the start or end. Remove it.` |
| Replicates missing | `Row 3: the number of replicates is missing.` |
| Replicates not a whole number of at least 1 | `Row 3: replicates must be a whole number of at least 1, but got "four".` |
| Duplicate condition name | `Row 5: "Condition 2" is already listed in row 2.` |
| Too many replicates | `The conditions need 64 wells, but only 60 are open. Remove 4 replicates or open 4 more wells.` |
| Spare open wells, no filler | `12 open wells are left over. Name a filler for them.` |
| Fixed-contents entry with wells but no name | `Fixed contents 2 is placed on the plate but has no name.` |
| Fixed-contents name with a space at the start or end | `Fixed contents 2 has a space at the start or end. Remove it.` |
| Duplicate fixed-contents name | `Fixed contents 3: "Static" is already listed in fixed contents 1.` |
| Filler with a space at the start or end | `The filler has a space at the start or end. Remove it.` |
| Seed missing | `The seed is missing.` |
| Seed not a whole number, or out of range | `The seed must be a whole number from 1 to 999,999, but got 0.` |

A replicate count or seed is **missing** if it is `""`, text of only spaces, `undefined` or `null`, as
when its box is empty. A missing value gets the "missing" message instead of the "whole number"
one.

An empty condition list is not an error, and neither is a fixed-contents entry with no wells, with
or without a name (see section 4).

Problems are listed in the table's order: the conditions row by row, then the open wells, then the
fixed-contents entries one by one, then the filler, then the seed. Within a row or an entry, its
problems follow the table's order. A duplicate fixed-contents name is reported even if the entry has
no wells; a blank name is reported as empty, never as a duplicate.

**A well in two entries.** `placeName` and `openWells` keep each well in at most one entry, so this
can only happen if a caller builds the entries some other way. The logic still checks it as a safety
net, once per well, in standard well order, after all the problems above:
`A1 is in two fixed contents: "Static" and "Blank".` A well in three or more entries gets one message
naming the first two.

`placeName` and `openWells` throw rather than report: an invalid well name throws the grid's own
message (e.g. `"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.`), and an `entry`
that isn't in `fixedContents` throws `The entry to place must be one of the fixed contents.` If both
are wrong, the entry's message is thrown.

## 8. Files and interface
The randomizer's folder, `src/tools/randomizer/`, holds:

| File | Job |
|---|---|
| `randomizer.md` | This specification: the tool's logic. |
| `randomizer-page.md` | The page's specification. |
| `randomizer.js` | The logic: checking the inputs, placing and opening fixed wells, randomizing, matching a result to inputs, and building the two lists and their copy text. No screen code, so it is tested in Node. |
| `randomizer.test.js` | Its tests. |
| `randomizer.html`, `randomizer.css`, `randomizer-page.js` | The page; see `randomizer-page.md`. |

### Inputs
The logic takes the inputs as one object:

| Property | Description |
|---|---|
| `conditions` | A list of `{ name, replicates }`, in the order the conditions are listed. |
| `fixedContents` | A list of `{ name, wells }`, in the order the entries are listed, where `wells` is a `WellSelection` on `GRID_96`. |
| `filler` | Text; `""` if none was named. |
| `seed` | The seed. |

`replicates` and `seed` may be any value; anything that isn't valid is reported as it was given
(e.g. `but got "four"`).

### Functions
`randomizer.js` exports:

| Function | Returns |
|---|---|
| `findProblems(inputs)` | Every problem as a list of messages (section 7); `[]` if there are none. |
| `placeName(fixedContents, wells, entry)` | Nothing; puts the entry's name in the wells (section 4). |
| `openWells(fixedContents, wells)` | Nothing; makes the wells open (section 4). |
| `randomize(inputs)` | The result (section 5). Throws an `Error` whose message is the first problem, if there are any. |
| `matchesInputs(result, inputs)` | `true` if `inputs` are exactly the result's inputs (section 5). |
| `listingOrder(inputs)` | Every name once, as `{ name, role, position }`, in listing order (section 6). |
| `spareWellCount(inputs)` | The number of spare open wells, or `null` while a replicate count isn't valid (section 4). |
| `randomSeed(randomNumber)` | A seed from 1 to 999,999 made from a random number from 0 up to 1 (section 4). |
| `contentsToWells(result)` | The contents → wells list as rows `{ contents, wells }`, in the order of section 6. |
| `wellToContents(result)` | The well → contents list as rows `{ well, contents }`, in standard well order. |
| `contentsToWellsText(result)` | The contents → wells copy text (section 6). |
| `wellToContentsText(result)` | The well → contents copy text (section 6). |

## 9. Test cases
Tests use names that are clearly test data, not real experiments.

### Main example
- Fixed contents: one entry, `Static`, in the outer ring (36 wells).
- Conditions: `Condition 1` … `Condition 12`, 4 replicates each (48 replicates).
- Open wells: 60, so 12 are spare; filler `Spare`.

### Checks
These apply to every setup below, not only the main example. They use each well's type, so they
work even when names are shared.
1. **Replicate wells**: each condition has exactly as many replicate wells as its replicate count.
2. **Filler wells**: the number of filler wells equals the open wells minus the replicates, and every
   filler well holds the filler.
3. **Fixed wells**: every well in a fixed-contents entry is a fixed well holding that entry's name,
   and there are no other fixed wells.
4. **Complete**: all 96 wells have contents and a type, and the open wells are exactly the replicate
   and filler wells.
5. **Reproducible**: running the same inputs and seed twice gives identical plates.
6. **Outputs agree with the plate**: the contents → wells list and the well → contents list both
   match the plate exactly.

### Setups
- The main example.
- **Empty list**: the main example with no conditions; 36 `Static` fixed wells and 60 `Spare` filler
  wells.
- **No fixed wells**: no fixed-contents entries, so all 96 wells are open; `Condition 1` …
  `Condition 12`, 4 replicates each, so 48 `Spare`.
- **Exact fit**: no fixed wells; `Condition 1` … `Condition 12`, 8 replicates each, exactly filling
  all 96 wells. No filler is needed and none appears.
- **Scattered fixed wells**: one entry, `Static`, in A1, B5, D6, E7, G11 and H12 (edge and interior);
  90 open wells; `Condition 1` … `Condition 12`, 7 replicates each (84), so 6 `Spare`. Checks that
  open wells are filled correctly around fixed wells anywhere on the plate, not only at the ends of
  rows.
- **Several fixed contents**: the main example with A1 in an entry `Fixed 1`, H12 in an entry
  `Fixed 2`, and the other 34 outer wells in `Static`.
- **Fixed contents on two wells each**: the golden-file setup with seed 999,000 below.
- **Unused entries**: the main example plus an entry `Unused` with no wells and an entry named `""`
  with no wells. There are no problems, and neither appears in the outputs.
- **Empty rows**: the main example with completely empty rows (`{ name: "", replicates: "" }`)
  before the first condition, between two conditions and after the last. No problems are reported,
  and the plate is exactly the main example's.
- **Shared names**: the main example plus a condition `Static` with 4 replicates, and filler `Static`
  (52 replicates, 8 filler wells). The contents → wells list shows `Static` once, with all 48 of its
  wells (36 fixed, 4 replicate, 8 filler).

### Placing and opening wells
- `placeName` on open wells puts them in the entry; on a well in another entry, it moves the well to
  this entry, so the well is in only one entry.
- `placeName` with a box from `wellsInBox("B2", "C4")` places all 6 wells.
- Placing a well already in the entry, or opening a well that is already open, changes nothing.
- `openWells` removes wells from whichever entry holds them.
- Renaming an entry keeps its wells.
- An invalid well (`"I1"`, `"b2"`) throws the grid's message and changes nothing, even when other
  wells in the same call are valid.
- An `entry` that isn't in `fixedContents` throws its message.

### Matching inputs
- `matchesInputs(result, inputs)` is `true` for the inputs the result was made from.
- It is `false` after changing the seed, the filler, a condition's name or replicates, the order of
  the conditions, an entry's name, the order of the entries, or which wells an entry holds, or after
  adding a completely empty row; and `true` again after changing it back.
- The result's inputs are a copy: calling `placeName` or renaming an entry after `randomize` doesn't
  change `result.inputs`.

### Listing order
- For the example in section 6, `listingOrder` returns exactly the list shown.
- Empty names (an unnamed fixed-contents entry, an empty filler) are left out.
- Positions count within each role and include unused entries: with fixed contents `Unused` (no
  wells) then `Blank`, `Blank` has position 1.
- Adding a condition doesn't change any filler or fixed-contents position.

### Spare wells and random seeds
(The `randomSeed` cases below move to `random-pool.test.js`, with `randomSeed`; here, a test checks
that `randomizer.js` re-exports the same function.)
- `spareWellCount` is 12 for the main example, 0 for the exact fit, 0 when the replicates don't fit,
  and `null` when a replicate count is `"four"` or missing (in a row that isn't completely empty).
  Completely empty rows don't change it.
- `randomSeed(0)` is 1, `randomSeed(0.5)` is 500000 and `randomSeed(0.9999999999)` is 999999; for many
  numbers from 0 up to 1 the seed is always a whole number from 1 to 999,999, and `findProblems` accepts
  it.
- `randomSeed(1)`, `randomSeed(-0.1)` and `randomSeed("0.5")` throw its message.

### Seeds
- **Different seeds**: two chosen seeds give different plates on the main example. (Different seeds
  *can* give the same plate in tiny setups, so this is checked only for specific seeds on the main
  example, where a match is effectively impossible. Because results are reproducible, the test
  always gives the same answer.)

### Golden files
Two setups are each run once and recorded in `tests/fixtures/`, and a test confirms each result never
changes:
- `randomizer-main-seed-37.json`: the main example with seed 37.
- `randomizer-fixed-entries-seed-999000.json`: seed 999,000; fixed-contents entries `Static` in A12
  and H1, `Override 1` in A1 and H12, `Override 2` in B5 and G11, and `Override 3` in D6 and E7;
  `Condition 1` … `Condition 10`, 7 replicates each (70); filler `Spare` in the remaining 18 open
  wells. It contains all three well types. (The entry names come from the time before entries
  replaced overrides, and are kept so the file's contents don't change.)

They are snapshots, not a comparison with the Exp37 spreadsheet, which used a different
algorithm; the checks above already confirm they are correct. Each is JSON, one entry
`{ well, contents, type }` per well in standard order. They were generated once, when they were
created; their inputs are kept in `tests/fixtures/randomizer-golden-setups.js`, and tests only read
the files. There is deliberately no script to regenerate them, so a failing test can't be "fixed" by
rewriting them. If a test ever fails, the cause must be found; a golden file is never edited or
regenerated to make a test pass. Regenerating them is only for a deliberate change to the
algorithm, which needs a new ADR (see ADR 0003).

**Format changes.** A deliberate change to the files' format, such as renaming a well type, may be
made by editing the files, if the pull request's diff shows that nothing else changed. This was done
once: when fixed-contents entries replaced overrides, the fixed wells' type changed from
`fixed-contents` or `override` to `fixed`, and the second file was renamed from
`randomizer-overrides-seed-999000.json`. Every replicate and filler line stayed the same, which shows
the assignment didn't change.

### Errors
One test per error in section 7, checking the message:
- Condition list (a row with only a name or only replicates is checked, not skipped): an empty
  name, missing replicates (`""`, `"  "`), replicates that aren't a whole
  number of at least 1 (e.g. `0`, `1.5`, `"four"`), and a duplicate name, each reported with its row.
- Too many replicates for the open wells.
- Spare open wells with no filler.
- Fixed contents: an entry with wells but no name, a name with a space at the start or end
  (`"Static "`), and a duplicate name, each reported with its number.
- The filler with a space at the start (`" Spare"`).
- Seed missing (`""`), out of range (`0`, `1000000`) or not a whole number (`2.5`).
- A condition name with a space at the start (`" Condition 1"`).
- The safety net: a well in two entries.

### Checking
- `findProblems` returns `[]` for every setup above.
- With several problems at once (e.g. an empty condition name, an entry with wells but no name, and
  seed `0`), it returns all of them, in the order of section 7's table, followed by any wells in two
  entries.
- `randomize` throws the first problem's message.

### Inputs unchanged
- After `randomize`, the conditions list and the fixed-contents entries (names and wells) passed in
  are unchanged, and two runs give two separate layouts.

### Copy text
- Each copy text is tab-separated, one line per row as described in section 6, with no header row.
