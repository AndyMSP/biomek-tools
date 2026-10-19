# randomizer — specification

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

**Fixed wells** have contents given in the inputs. Each is either:
- a **fixed-contents well**, holding the fixed contents, or
- an **override well**, holding its own override contents.

**Fixed contents**: the contents given to every fixed well that isn't overridden.

Every well in the result is exactly one of the four **well types**: replicate, filler,
fixed-contents or override.

## 4. Inputs

### Condition list
Each condition has a name and a number of replicates. The conditions are in the order given.
- Names are text, at least one character. A name with a space (or other whitespace) at the start or
  end is rejected, not trimmed, so a name always matches its source exactly, e.g. when it is later
  matched against another tool's file. The same applies to the fixed contents, overrides and the
  filler.
- Replicates are whole numbers of at least 1.
- Two conditions in the list can't have the same name. A condition may share its name with the
  filler or the fixed contents (see Shared names).
- The list may be empty. Every open well then gets the filler.

### Fixed and open wells
Every well is either **fixed** (its contents are given in the inputs) or **open** (it receives a
randomly ordered replicate or the filler). Whether a well is fixed or open is given in the inputs
(`fixedWells`), never worked out from its contents.

### Fixed contents and overrides
If any fixed well isn't overridden, the fixed contents must be named (e.g. "PBS"); there is no
default. If every fixed well is overridden, no fixed contents are needed. Individual fixed wells can
be **overridden** with different contents (e.g. A1: "Blank", H12: "Standard"). Overrides apply only to fixed wells.

### Filler
If the open wells outnumber the replicates, a filler must be named (e.g. "PBS") for the spare open
wells. Filler wells are placed randomly, so they can't be overridden individually. If there are no
spare open wells, no filler is needed.

### Seed
A whole number from 1 to 999,999.

### Shared names
The same name may appear in several places: "PBS" could be the fixed contents, the filler and a
condition at once. The two lists treat them as the same contents, while each well's type still
records which role put it there.

## 5. Assignment rules
1. Build the list of items to place: each condition repeated by its number of replicates, in the
   order the conditions are listed, followed by the filler once for each spare open well.
2. Put the list in a random order with a Fisher–Yates shuffle, driven by the seeded random number
   generator (`random` module) started from the seed.
3. Create a new, empty layout (`layout` module) on `GRID_96`. Fill the open wells in standard well
   order (A1, A2 … H12, skipping fixed wells), taking the next item from the shuffled list for each.
4. Fixed wells get the fixed contents, or their override.

The inputs are never changed, and each run creates a new layout. The **result** holds three things:
- **the layout**: what each well contains;
- **the well types**: each well's type (see Terms), recorded alongside the layout because the layout
  holds only names, and a shared name such as "PBS" doesn't say which role put it in a well;
- **the seed** used.

For example, on a two-well plate where A1 is fixed and A2 is open:
```js
{
  layout,      // a Layout where A1 holds { name: "Static" } and A2 holds { name: "Condition 1" }
  wellTypes: { A1: "fixed-contents", A2: "replicate" },
  seed: 37,
}
```

Each well is equally likely to receive any of the items. (A 32-bit seed can't reach every possible
arrangement of a full plate, but every arrangement it produces is a fair shuffle; see ADR 0003.)

**Reproducibility.** The same condition list *in the same order*, the same fixed wells, contents,
overrides and filler, and the same seed always give the same plate, on any computer. Changing the
order of the conditions, or any replicate count, can change the plate, even with the same seed.
Renaming a condition doesn't: the same wells receive the new name. To recreate a plate exactly,
record the inputs in full along with the seed. (Saving and reloading inputs is on
the roadmap.)

## 6. Outputs
Randomizing gives:
- **The randomized plate**: every well's contents and type (the result, section 5).
- **The seed** used.
- **Contents → wells**: each distinct contents with the wells that hold it, in standard well order,
  e.g. `Condition 1: B4, D9, F2, G7`. Listed in this order: conditions as listed, then the filler,
  then the fixed contents, then overrides; a name already listed isn't repeated. This is the
  list used at the bench while plating.
- **Well → contents**: all 96 wells in standard order, each with its contents. This is the list used
  to label results; pasted into Excel, it can also be sorted or filtered by contents.

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

| Problem | Message |
|---|---|
| Condition name empty | `Row 3: the condition name is empty.` |
| Condition name with a space at the start or end | `Row 3: the condition name has a space at the start or end. Remove it.` |
| Replicates not a whole number of at least 1 | `Row 3: replicates must be a whole number of at least 1, but got "four".` |
| Duplicate condition name | `Row 5: "Condition 2" is already listed in row 2.` |
| Too many replicates | `The conditions need 64 wells, but only 60 are open. Remove 4 replicates or open 4 more wells.` |
| Spare open wells, no filler | `12 open wells are left over. Name a filler for them.` |
| Fixed wells without an override, no contents | `Name the contents of the fixed wells.` |
| Fixed contents or filler with a space at the start or end | `The fixed contents have a space at the start or end. Remove it.` / `The filler has a space at the start or end. Remove it.` |
| Seed not a whole number, or out of range | `The seed must be a whole number from 1 to 999,999, but got 0.` |

An empty condition list is not an error (see section 4).

**Overrides.** The page is designed so that bad overrides can't be entered (see
`randomizer-page.md`). The logic still checks them as a safety net, with these messages:

| Problem | Message |
|---|---|
| Override well not on the grid | The grid's own message, e.g. `"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.` |
| Override well isn't fixed | `D4 has an override but isn't a fixed well.` |
| Same well overridden twice | `A1 is overridden more than once.` |
| Override name empty | `The override for A1 has no name.` |
| Override name with a space at the start or end | `The override for A1 has a space at the start or end. Remove it.` |

## 8. Files and interface
The randomizer's folder, `src/tools/randomizer/`, holds:

| File | Job |
|---|---|
| `randomizer.md` | This specification: the tool's logic. |
| `randomizer-page.md` | The page's specification. |
| `randomizer.js` | The logic: checking the inputs, randomizing, and building the two lists and their copy text. No screen code, so it is tested in Node. |
| `randomizer.test.js` | Its tests. |
| `randomizer.html`, `randomizer.css`, `randomizer-page.js` | The page; see `randomizer-page.md`. |

### Inputs
The logic takes the inputs as one object:

| Property | Description |
|---|---|
| `fixedWells` | A `WellSelection` (`well-selection` module) on `GRID_96`; selected wells are fixed, the rest open. |
| `conditions` | A list of `{ name, replicates }`, in the order the conditions are listed. |
| `fixedContents` | Text; `""` if none was named. |
| `overrides` | A list of `{ well, name }`. |
| `filler` | Text; `""` if none was named. |
| `seed` | The seed. |

`replicates` and `seed` may be any value; anything that isn't valid is reported as it was given
(e.g. `but got "four"`).

### Functions
`randomizer.js` exports:

| Function | Returns |
|---|---|
| `findProblems(inputs)` | Every problem as a list of messages (section 7); `[]` if there are none. |
| `randomize(inputs)` | The result (section 5). Throws an `Error` whose message is the first problem, if there are any. |
| `contentsToWells(inputs, result)` | The contents → wells list as rows `{ contents, wells }`, in the order of section 6. |
| `wellToContents(result)` | The well → contents list as rows `{ well, contents }`, in standard well order. |
| `contentsToWellsText(inputs, result)` | The contents → wells copy text (section 6). |
| `wellToContentsText(result)` | The well → contents copy text (section 6). |

## 9. Test cases
Tests use names that are clearly test data, not real experiments.

### Main example
- Fixed wells: the outer ring (36 wells), contents `Static`.
- Conditions: `Condition 1` … `Condition 12`, 4 replicates each (48 replicates).
- Open wells: 60, so 12 are spare; filler `Spare`.

### Checks
These apply to every setup below, not only the main example. They use each well's type, so they
work even when names are shared.
1. **Replicate wells**: each condition has exactly as many replicate wells as its replicate count.
2. **Filler wells**: the number of filler wells equals the open wells minus the replicates, and every
   filler well holds the filler.
3. **Fixed wells**: every fixed well is either a fixed-contents well holding the fixed
   contents, or an override well holding its override.
4. **Complete**: all 96 wells have contents and a type, and the open wells are exactly the replicate
   and filler wells.
5. **Reproducible**: running the same inputs and seed twice gives identical plates.
6. **Outputs agree with the plate**: the contents → wells list and the well → contents list both
   match the plate exactly.

### Setups
- The main example.
- **Empty list**: the main example with no conditions; 36 `Static` fixed-contents wells and 60
  `Spare` filler wells.
- **No fixed wells**: all 96 wells open; `Condition 1` … `Condition 12`, 4 replicates each, so 48
  `Spare`.
- **Exact fit**: no fixed wells; `Condition 1` … `Condition 12`, 8 replicates each, exactly filling
  all 96 wells. No filler is needed and none appears.
- **Scattered fixed wells**: fixed wells A1, B5, D6, E7, G11 and H12 (edge and interior), holding
  `Static`; 90 open wells; `Condition 1` … `Condition 12`, 7 replicates each (84), so 6 `Spare`.
  Checks that open wells are filled correctly around fixed wells anywhere on the plate, not only at
  the ends of rows.
- **Overrides**: the main example with A1 overridden to `Override 1` and H12 to `Override 2`.
- **Overrides on two wells each**: the golden-file setup with seed 999,000 below.
- **Every fixed well overridden**: fixed wells A1 and H12 overridden to `Override 1` and
  `Override 2`, fixed contents `""`; `Condition 1` … `Condition 12`, 4 replicates each, filler
  `Spare`. No fixed contents are needed, and none is reported missing.
- **Shared names**: the main example plus a condition `Static` with 4 replicates, and filler `Static`
  (52 replicates, 8 filler wells). The contents → wells list shows `Static` once, with all 48 of its
  wells (36 fixed-contents, 4 replicate, 8 filler).

### Seeds
- **Different seeds**: two chosen seeds give different plates on the main example. (Different seeds
  *can* give the same plate in tiny setups, so this is checked only for specific seeds on the main
  example, where a match is effectively impossible. Because results are reproducible, the test
  always gives the same answer.)

### Golden files
Two setups are each run once and recorded in `tests/fixtures/`, and a test confirms each result never
changes:
- `randomizer-main-seed-37.json`: the main example with seed 37.
- `randomizer-overrides-seed-999000.json`: seed 999,000; fixed wells A1, A12, B5, D6, E7, G11,
  H1 and H12, with `Override 1` in A1 and H12, `Override 2` in B5 and G11, `Override 3` in D6 and
  E7, and fixed contents `Static` in A12 and H1; `Condition 1` … `Condition 10`, 7 replicates each
  (70); filler `Spare` in the remaining 18 open wells. It contains all four well types.

They are snapshots, not a comparison with the Exp37 spreadsheet, which used a different
algorithm; the checks above already confirm they are correct. Each is JSON, one entry
`{ well, contents, type }` per well in standard order. They were generated once, when they were
created; their inputs are kept in `tests/fixtures/randomizer-golden-setups.js`, and tests only read
the files. There is deliberately no script to regenerate them, so a failing test can't be "fixed" by
rewriting them. If a test ever fails, the cause must be found; a golden file is never edited or
regenerated to make a test pass. Regenerating them is only for a deliberate change to the
algorithm, which needs a new ADR (see ADR 0003).

### Errors
One test per error in section 7, checking the message:
- Condition list: an empty name, replicates that aren't a whole number of at least 1 (e.g. `0`,
  `1.5`, `"four"`), and a duplicate name, each reported with its row.
- Too many replicates for the open wells.
- Spare open wells with no filler; fixed wells with no contents.
- Seed out of range (`0`, `1000000`) or not a whole number (`2.5`).
- Names with a space at the start or end: a condition (`" Condition 1"`), the fixed contents
  (`"Static "`) and the filler (`" Spare"`).
- Overrides (the safety-net messages): a well not on the grid (`"I1"`), a well that isn't fixed,
  a well overridden twice, an empty name, and a name with a space at the start or end.

### Checking
- `findProblems` returns `[]` for every setup above.
- With several problems at once (e.g. an empty condition name, no fixed contents and seed `0`), it
  returns all of them, in the order of section 7's tables.
- `randomize` throws the first problem's message.

### Inputs unchanged
- After `randomize`, the conditions list, overrides and fixed wells passed in are unchanged, and two
  runs give two separate layouts.

### Copy text
- Each copy text is tab-separated, one line per row as described in section 6, with no header row.
