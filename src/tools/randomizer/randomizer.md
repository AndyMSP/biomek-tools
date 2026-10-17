# randomizer — specification

## 1. Purpose
The randomizer assigns an experiment's conditions to random wells on a plate, to spread position
effects such as edge drying or uneven seeding evenly across conditions. The user lists the conditions
and how many replicates each needs, and chooses which wells are fixed and what they contain. The
replicates are put in a random order and placed into the remaining (open) wells. The result is
reproducible: the same inputs and seed always give the same plate. The outputs are the randomized
plate and two lists: where each condition went, and what each well contains.

## 2. Scope
Version 1 randomizes a single 96-well plate (`GRID_96`).

Not in version 1 (see `docs/roadmap.md`): several plates, constrained randomization (e.g. one
replicate per quadrant), other plate formats, saving and reloading inputs, Celigo labeling, and
Biomek output.

## 3. Terms
**Open wells** are filled by the random assignment. Each is either:
- a **replicate well**, holding one replicate of a condition, or
- a **filler well**, holding the filler.

**Fixed wells** have contents set by the user. Each is either:
- a **fixed-contents well**, holding the fixed contents, or
- an **override well**, holding its own override contents.

**Fixed contents**: the contents given to every fixed well that isn't overridden.

Every well in the result is exactly one of the four **well types**: replicate, filler,
fixed-contents or override.

## 4. Inputs

### Condition list
Each condition has a name and a number of replicates. The user can type conditions in one row at a
time, or paste rows copied from Excel (two columns: name, then replicates), then edit, add or remove
rows in the tool. Pasted rows are added to any already there.
- Names are text, at least one character. Spaces at the start or end are removed.
- Replicates are whole numbers of at least 1.
- Two conditions in the list can't have the same name. A condition may share its name with the
  filler or the fixed contents (see Shared names).
- Header rows are not skipped; a pasted header is reported as an error like any other bad row.
- The list may be empty. Every open well then gets the filler.

### Fixed and open wells
Every well is either **fixed** (its contents are set by the user) or **open** (it receives a
randomly ordered replicate or the filler).
- The user clicks wells on a drawn plate to mark them fixed or open.
- A "fix the outer ring" button marks the 36 edge wells (`isEdgeWell`) as fixed in one step; they
  can still be clicked individually afterwards.
- By default no wells are fixed.
- Whether a well is fixed or open is chosen by the user, never by its contents.

### Fixed contents and overrides
If any wells are fixed, the user names their contents (e.g. "PBS"); there is no preset. The user can
then **override** individual fixed wells with different contents (e.g. A1: "Blank",
H12: "Standard"). Overrides apply only to fixed wells.

### Filler
If the open wells outnumber the replicates, the user names a filler (e.g. "PBS") for the spare open
wells. Filler wells are placed randomly, so they can't be overridden individually. If there are no
spare open wells, no filler is needed.

### Seed
A whole number from 1 to 999,999. When the tool opens, it suggests a random seed (using
`Math.random()`), shown in an editable box; the user can keep it or type another, and a button picks
a new random one.

### Shared names
The same name may appear in several places: "PBS" could be the fixed contents, the filler and a
condition at once. The copied lists treat them as the same contents, while each well's type still
records which role put it there.

## 5. Assignment rules
1. Build the list of items to place: each condition repeated by its number of replicates, in the
   order the conditions are listed, followed by the filler once for each spare open well.
2. Put the list in a random order with a Fisher–Yates shuffle, driven by the seeded random number
   generator (`random` module) started from the seed.
3. Fill the open wells in standard well order (A1, A2 … H12, skipping fixed wells), taking the next
   item from the shuffled list for each.
4. Fixed wells get the fixed contents, or their override.
5. Each well in the result records both its contents and its well type (see Terms).

Every possible arrangement is equally likely.

**Reproducibility.** The same condition list *in the same order*, the same fixed wells, contents,
overrides and filler, and the same seed always give the same plate, on any computer. Changing the
order of the conditions, or any replicate count, can change the plate, even with the same seed.
Renaming a condition doesn't: the same wells receive the new name. To recreate a plate exactly,
record the inputs in full along with the seed. (Saving and reloading inputs is on
the roadmap.)

## 6. Outputs
After randomizing, the tool shows:
- **The randomized plate**: a drawn 96-well plate showing every well's contents, with each well's
  type shown (e.g. by shading).
- **The seed** used.
- **Contents → wells**: each distinct contents with the wells that hold it, in standard well order,
  e.g. `Condition 1: B4, D9, F2, G7`. Listed in this order: conditions as listed, then the filler,
  then the fixed contents, then overrides; a name already listed isn't repeated. This is the
  list used at the bench while plating.
- **Well → contents**: all 96 wells in standard order, each with its contents. This is the list used
  to label results; pasted into Excel, it can also be sorted or filtered by contents.

Each list has a **Copy** button that copies it as tab-separated text with a header row, so it pastes
into Excel as columns. The copied lists are for people. Later integrations, such as Biomek output and
Celigo labeling, will use the same information directly from the plate data inside the tool, not
the copied text.
- Contents → wells: two columns, `Contents` and `Wells`, one row per contents, with its wells in one
  cell separated by commas and spaces.
- Well → contents: two columns, `Well` and `Contents`, one row per well.

## 7. Errors
The calculation code checks every input itself and throws an `Error` with a message that says what
is wrong and how to fix it, because it is tested in Node without the screen and may later be used by
other tools.

On screen, the same messages act as guidance: the Randomize button stays disabled while any input
is incomplete or invalid, and the messages are shown beside it, saying what is still needed.

| Problem | Message |
|---|---|
| Condition name empty | `Row 3: the condition name is empty.` |
| Replicates not a whole number of at least 1 | `Row 3: replicates must be a whole number of at least 1, but got "four".` |
| Duplicate condition name | `Row 5: "Condition 2" is already listed in row 2.` |
| Too many replicates | `The conditions need 64 wells, but only 60 are open. Remove 4 replicates or open 4 more wells.` |
| Spare open wells, no filler | `12 open wells are left over. Name a filler for them.` |
| Fixed wells, no contents | `Name the contents of the fixed wells.` |
| Seed not a whole number, or out of range | `The seed must be a whole number from 1 to 999,999, but got 0.` |

An empty condition list is not an error (see section 4).

## 8. Test cases
Tests use names that are clearly test data, not real experiments.

### Main example
- Fixed wells: the outer ring (36 wells), contents `PBS`.
- Conditions: `Condition 1` … `Condition 12`, 4 replicates each (48 replicates).
- Open wells: 60, so 12 are spare; filler `Spare`.

### Checks
These apply to every setup below, not only the main example. They use each well's type, so they
work even when names are shared.
1. **Replicate wells**: each condition has exactly as many replicate wells as its replicate count.
2. **Filler wells**: the number of filler wells equals the open wells minus the replicates, and every
   filler well holds the filler.
3. **Fixed wells**: every well the user fixed is either a fixed-contents well holding the fixed
   contents, or an override well holding its override.
4. **Complete**: all 96 wells have contents and a type, and the open wells are exactly the replicate
   and filler wells.
5. **Reproducible**: running the same inputs and seed twice gives identical plates.
6. **Outputs agree with the plate**: the contents → wells list and the well → contents list both
   match the plate exactly.

### Setups
- The main example.
- **Empty list**: no conditions; every open well holds `Spare`.
- **No fixed wells**: all 96 wells open.
- **Exact fit**: replicates exactly fill the open wells; no filler is needed and none appears.
- **Overrides**: the main example with A1 overridden to `Override 1` and H12 to `Override 2`.
- **Shared names**: the main example plus a condition `PBS` with 4 replicates, and filler `PBS`
  (52 replicates, 8 filler wells). The contents → wells list shows `PBS` once, with all 48 of its
  wells (36 fixed-contents, 4 replicate, 8 filler).

### Seeds
- **Different seeds**: two chosen seeds give different plates on the main example. (Different seeds
  *can* give the same plate in tiny setups, so this is checked only for specific seeds on the main
  example, where a match is effectively impossible. Because results are reproducible, the test
  always gives the same answer.)
- **Golden file**: the main example with seed 37 is run once, checked by Andy, and recorded in
  `tests/fixtures/`. A test confirms the result never changes. If it ever fails, the cause must be
  found; the golden file is never edited to make the test pass.

### Errors
One test per error in section 7, checking the message:
- Condition list: an empty name, replicates that aren't a whole number of at least 1 (e.g. `0`,
  `1.5`, `"four"`), and a duplicate name, each reported with its row.
- Too many replicates for the open wells.
- Spare open wells with no filler; fixed wells with no contents.
- Seed out of range (`0`, `1000000`) or not a whole number (`2.5`).

### Copy text
- Copying each list gives tab-separated text with a header row and the rows described in section 6.
