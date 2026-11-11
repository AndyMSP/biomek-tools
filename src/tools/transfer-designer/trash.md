# trash — specification

> **Draft (2026-11-11).** Written for v0.2.0 (roadmap, item 32), from the preview Andy shaped on
> 2026-11-11, where the trash was tried and three bugs in putting things back were found and fixed
> (section 3, "Why the place rules are as they are"). Revised the same day from the review of the
> specifications, which found that things deleted in separate deletes didn't go back right: the
> trash now keeps a **remembered stage order** and **group keys** (section 3). Written in the
> hands-off workflow (CLAUDE.md, "Workflows"), so the choices made for Andy are listed in its pull
> request. Still to review: every message. It becomes Final once built and tested by Andy.

## 1. Purpose
`trash.js` keeps what's deleted from a plan, so it can be **put back**: the transfer designer's
**trash** (`docs/glossary.md`; ADR 0024). It works out what each deleted thing was and where it
sat, where putting it back puts it, and how the trash changes with each delete, put back, undo and
redo. It holds no page code (CLAUDE.md, "Separate logic from the UI"); how the trash looks and is
used is the page's (`transfer-designer-page.md`, section 7, "The trash").

It builds on `transfer-designer` and doesn't repeat it: deleting is `deleteItems`, a deleted thing
is kept as **copied items** (`copyOf`), and putting it back is a paste (`pasteItems`), so the
container rule and every check of pasting apply as they do for any paste (`transfer-designer.md`,
"Moving and copying" and "Deleting").

## 2. Scope
Version 1 adds what a delete took to a trash of at most `TRASH_LIMIT` entries, works out where an
entry goes back, puts it back (at that place or at one the caller gives), empties the trash, undoes
and redoes its changes, and turns a trash into text and back, for a caller to keep.

Not in version 1:
- **The trash in plan files.** It's kept apart from the plan (ADR 0024), so it isn't in plan files
  and isn't tied to a plan.
- **Putting back into another plan by itself.** An entry can be put at a place the caller gives in
  any plan, but the trash finds a place only in a plan holding at least one stage it remembers
  (section 3, "Which stages count").
- **Several entries put back as one.** Each entry goes back on its own (Andy, 2026-11-11: "one
  trash entry per thing deleted").

## 3. Data model

### The trash
A trash is a plain object that's **never changed after it's made**: every function returns a new
one, as plans are (`transfer-designer.md`, "The plan"). It holds the entries, and the trash's
**memory** of the plan's stages, which is what lets it find places:

```js
{
  entries:      [entry, …],                       // the order below
  memory: {
    order:      [{ stage: "1" }, { entry: 4, index: 0 }, { stage: "2" }, …],  // the remembered stage order
    names:      { "1": "S01 Media row A", … },    // each remembered plan stage's name
    keys:       { "1": "g1", "2": "g1", … },      // each remembered plan stage's group key, or null
    nextGroupKey: 3,                              // the next group key's number
  },
  nextEntryId:  5,                                // the next entry's ID
  nextDeletion: 3,                                // the next delete's number
}
```

`emptyTrash()` gives `{ entries: [], memory: { order: [], names: {}, keys: {}, nextGroupKey: 1 },
nextEntryId: 1, nextDeletion: 1 }`.

**Order of the entries.** `entries` is newest delete first; within one delete, in **column order**
(the order the deleted things had in the column). Precisely: by `deletion`, largest first, then by
`id`, smallest first. Every function keeps this order, including when undo puts entries back.

**At most `TRASH_LIMIT` entries** (`config/trash.js`, below). Adding more drops the oldest (the
last in the order); what's dropped can't be put back, but undoing the delete that dropped it brings
it back (below, "Undo and redo").

### Entries
**One entry per deleted thing** (Andy, 2026-11-11: in the preview, a delete of several things was
one entry put back at one place, and S02 and S03, deleted together, came back out of order). A
deleted thing is an **item** (`docs/glossary.md`): a stage (a mix step included), an ordinary tip
group, a randomization or a transfer table. An entry:

```js
{
  id:            4,                 // a whole number, from the trash's nextEntryId
  deletion:      2,                 // the delete it came from; entries of one delete share it
  kind:          "stage",           // "stage", "tipGroup", "randomization" or "transferTable"
  name:          "S03 Drug A",      // a stage's or randomization's name; null for the others
  stageCount:    1,                 // how many stages it held
  transferCount: 3,                 // how many transfers (a mix step's mixed wells included)
  deletedAt:     "2026-11-11T05:28:41.000Z",   // when, as the caller gave it (ISO 8601 text)
  copied:        { format: "biomek-tools copied items", … },   // copyOf(plan, [item])
  stages:        [{ name: "S03 Drug A", key: "g2" }],  // its stages, in stage order: name and group key
  randomizationsAbove: [{ id: "r2", name: "Randomization2" }],   // see "Randomizations that haven't run"
  randomizationsBelow: [],
}
```

- `stages` is `[]` for a randomization that hasn't run. A stage's `key` is its group key (below)
  when the entry was made; `null` for a randomization's or transfer table's stages.
- `copied` is the copied items for that one item, as `copyOf` writes them. Copied items don't hold
  a randomization's name (`transfer-designer.md`, "Moving and copying"), so `name` keeps it, to give
  it back on putting back (below).

### The remembered stage order
The **remembered stage order** (`memory.order`) is the plan's stage order as the trash last saw
it, with the stages of entries still in the trash kept in their places. Each element is either
- `{ stage: id }`: a stage of the plan when the trash last saw it, by its ID; or
- `{ entry: id, index }`: the stage at `index` of entry `id`'s `stages` (a **trashed stage**); or
  `{ entry: id, index: null }` for a randomization that hasn't run, marking where it sat (just
  before the stage it sat before, or last).

Trashed stages are named by their entry, not their old ID, because the plan may give a deleted
stage's ID to a new stage (`stage-list.md`, "IDs"), often at once: delete the last stage, add one.

**Which stages count.** A `{ stage: id }` element **counts** in a plan when the plan has a stage
with that ID **and** the name `memory.names` remembers for it (Andy, 2026-11-11, from the preview:
a plan opened after a delete has stages with the same IDs, 1, 2, 3 …, and putting back placed
things next to unrelated stages). A stage renamed since, a stage of another plan, or a new stage
given an old ID with another name doesn't count. One given an old ID with the same name does (for
example several stages all called `New stage`): the trash can't tell it apart, so the place found
may then be wrong, and the user can drag the entry instead (Claude's choice: plans have no identity
of their own to check, and IDs plus names are what there is).

**Bringing the memory up to date with a plan**, `remember(trash, plan)` (not exported; used before
every delete and every put back), gives a new memory in four steps:
1. **Keep** from `memory.order`, in order: each `{ stage }` element that counts in `plan`, and each
   trashed-stage element whose entry is still in the trash. Drop the rest.
2. **Merge** with the plan's stage order: start with every stage of `plan`, in stage order, each as
   `{ stage: id }`. Then go through the kept elements in order, keeping an **anchor**, at first
   "before the first element": a kept `{ stage }` element moves the anchor to that stage; a kept
   trashed-stage element is inserted just after the anchor, and becomes the anchor. So each trashed
   stage follows the nearest earlier remembered stage that still counts, wherever that stage is now,
   and trashed stages that were together stay together, in their order.
3. **Group keys** (below), for every stage of `plan`.
4. **Names**: `names` becomes every stage of `plan`'s name, by ID.

It also says whether **any element counted** in step 1; when none did, the trash finds no place in
this plan (below).

### Group keys
A **group key** names a tip group so that "the same tip group" survives deletes, put backs and
renamed IDs: text, `"g"` and a number from `memory.nextGroupKey` (`"g1"`, `"g2"` …), never a stage
ID, so a new stage can't take one by chance. In step 3 above, each **ordinary tip group** of the
plan (`columnBoxes`' `"tipGroup"` boxes), in column order, gets a key:
- the **recorded keys** of its stages are the keys `memory.keys` holds for those of its stages
  that counted in step 1;
- its key is the recorded key held by most of its stages (a tie: the one held by its earliest
  stage among them), unless an earlier tip group in this step already took that key, in which case
  the next most held, and so on; with none left, a **new key** (`nextGroupKey`, then one more);
- every stage of the group gets that key. A randomization's and a transfer table's stages get
  `null`.

So when a tip group's first stage is deleted, its tip change moves to the next stage
(`transfer-designer.md`, "Stages") and the rest of the group still holds its key; a stage moved
into another group takes that group's key once most of the group holds it; and a stage put back
takes the key its entry recorded (below, "Putting back").

### Adding
**`addDeleted(trash, plan, items, deletedAt)`** gives `{ trash, change }`, for a caller that
deletes `items` from `plan` (the plan **before** the delete):
1. It checks `items` exactly as `deleteItems` does, its refusals included (a randomization's or
   transfer table's stage without its owner; every stage of the plan), with its messages, and
   `deletedAt`: text that `Date` reads as a date.
2. It brings the memory up to date with `plan` (`remember`).
3. It makes one entry per item, taken as `deleteItems` takes them (column order, a stage of a listed
   container left out, repeats once), each with the trash's `nextDeletion` (then one more) and a
   new `id` from `nextEntryId`, in column order. Each entry's `stages` gets each of its stages' name
   and key from the up-to-date memory; its `randomizationsAbove` and `randomizationsBelow` are
   found as below.
4. In the remembered order, each of the entry's stages' `{ stage }` elements becomes `{ entry: id,
   index }`; for a randomization that hasn't run, `{ entry: id, index: null }` is inserted just
   before the element of the stage it sits before (or last).
5. It adds the entries, in the order above, dropping the oldest beyond `TRASH_LIMIT`.

The **change** is `{ added, removed, memoryBefore, memoryAfter }`: `added`, the new entries the
trash kept (with their IDs; any of them dropped by the limit, in a delete of more things than the
limit, isn't in it); `removed`, the entries that were in the trash before and were dropped; and the
memory before step 2 and after step 4.

A caller removing one thing by another edit (removing a stage, a randomization or a transfer table)
calls it with that one item.

### Randomizations that haven't run
A randomization without stages sits before a stage (`transfer-designer.md`, "Randomizations"), so
deleting or putting back stages beside it can move it to the wrong side. An entry records:
- `randomizationsAbove`: the randomizations without stages sitting just above it, between the
  stage before its first stage and its first stage (those whose `beforeId` is its first stage);
- `randomizationsBelow`: those sitting just below it (whose `beforeId` is the stage just after its
  last stage, or `null` when it's last).
Each by its ID and name, in the order of the plan's `randomizations`. For a randomization that
hasn't run (no stages), both are `[]`.

When it's put back (below), in the same edit, after the paste: each randomization of
`randomizationsAbove` that's in the plan with the same name and still has no stages, and now sits
just below what was put back (its `beforeId` the stage just after the put-back stages, or `null`
when they're last), is placed before the first put-back stage (`placeRandomization`); each of
`randomizationsBelow` that's in the plan with the same name, has no stages and now sits before the
first put-back stage is placed before the stage just after the put-back stages (or `null`). One
`placeRandomization` refuses is left where it is.

### Putting back
**`putBackPlace(plan, trash, id)`** gives where entry `id` goes back in `plan`, as a place
(`transfer-designer.md`, "Moving and copying": `between` or `inTipGroup`), or `null` when it has
none. It works on the memory brought up to date with `plan` (`remember`), and gives `null` when no
remembered stage counted in `plan`. Otherwise, with the entry's trashed stages where the merge put
them, and **present** meaning a stage of `plan` (in the merged order as `{ stage }`):

**A stage** (`kind` `"stage"`), with key `K`:
1. Just **below** the nearest present stage **before** it in the merged order with key `K`
   (`inTipGroup`, at that stage's position in its box plus one); or else
2. just **above** the nearest present stage **after** it with key `K` (`inTipGroup`, at that stage's
   position). So a group's first stage goes back to the top of its group and takes the group's tips
   (the container rule moves the group's tip change onto it), as it was; or else
3. into a **tip group of its own, in its remembered place** (below).

Stages with key `K` are always in ordinary tip groups (a randomization's and transfer table's stages
have `null`), so these places are always inside an ordinary tip group.

**A tip group** (`kind` `"tipGroup"`): its key is the key held by most of its `stages` (as above).
When a present stage has that key (a stage of the group deleted earlier and put back, or one left
when the rest of the group was deleted), it goes back **into that tip group**, as its stages: just
below the nearest present stage with the key before its first stage in the merged order, or else
just above the nearest one after its last; its `copied` tip group is pasted as its stages (one
copied stage item each, in order, with the tip group's `tips` and `group` 1), since a tip group
can't be pasted inside another. Otherwise it goes back **as a tip group, in its remembered place**.

**A randomization or a transfer table**: in its remembered place.

**In its remembered place** means between boxes (`between`): just **below the box** of the nearest
present stage before the entry's first trashed stage in the merged order (for an unrun
randomization, before its marker), `between` that box's index plus one; or else just **above the box**
of the nearest present stage after its last, `between` that box's index; or else (the plan has no
stages, which can't be: a plan always has one) `between` 0. A stage's box is the box `columnBoxes`
puts it in (an ordinary tip group, a randomization or a transfer table). A stage going back between
tip groups keeps its tips, as a tip group of its own (the container rule).

**Why the place rules are as they are** (each has its tests, section 6):
- *Group keys, before neighbors* (the preview, 2026-11-11): S03, its group's first stage, went back
  below S02, the stage above it, at the bottom of the group above. Going back beside a stage of its
  own group keeps it in its group, with its tips.
- *Trashed stages kept in the remembered order* (the review, 2026-11-11): each entry's neighbors were
  a snapshot taken without the stages already in the trash, so things deleted in separate deletes
  went back wrong (S04, then S03, deleted: S04, S03, S05, S06; S07, S08 and S09 deleted one at a
  time: three groups in the wrong order). Now an earlier-deleted stage keeps its place among the
  others, so putting back in any order rebuilds the plan.
- *A put-back stage takes its place in the memory* (the preview, 2026-11-11): S03 and S04, deleted
  together and put back one at a time, lost each other, since S03 came back with a new ID.
- *Names:* above, "Which stages count".

**`putBack(plan, trash, id, place)`** puts entry `id` back, with `place` `undefined` or `null` for
`putBackPlace`'s, or a place the caller gives:
1. It refuses an `id` that isn't in the trash, and, with no place given, an entry `putBackPlace`
   gives `null` for.
2. It pastes the entry's `copied` at the place (`pasteItems`, whose refusals pass through
   unchanged; for a tip group going into a tip group, as its stages, above). If the paste places a
   different number of stages than the entry's `stages` (a damaged entry), it refuses, changing
   nothing.
3. **It gives a randomization its name back**: a pasted randomization gets a new name
   (`transfer-designer.md`, "Moving and copying"), so if no other randomization of the new plan has
   the entry's `name`, the pasted one is renamed to it (`renameRandomization`), in the same edit
   (Claude's choice, 2026-11-11: its well map is named after it, so a put-back randomization should
   be the same one); otherwise it keeps the pasted name.
4. It places the randomizations that haven't run (above).
5. **It updates the memory**: brought up to date with the plan before the paste (`remember`), then
   each of the entry's trashed-stage elements (`{ entry: id, index }`) becomes `{ stage: newId }`,
   the pasted stage in the same place (the pasted stages, in stage order, match `stages` one for
   one), with `names[newId]` its name and `keys[newId]` the key its entry recorded; an unrun
   randomization's marker is removed. With a place the caller gives, the elements are moved to
   where the pasted stages now are: just after the element of the stage before the first of them in
   the new plan's stage order (or first). So a stage put back counts as a neighbor for the entries
   left, under its new ID.
6. It takes the entry out of the trash.

It gives `{ plan, placed, trash, change }`: the plan with it put back, as one edit; `placed`,
`pasteItems`' (the randomization's item, after a rename); the new trash; and the change
`{ added: [], removed: [the entry], memoryBefore, memoryAfter }`.

### Emptying
**`clearTrash(trash)`** gives `{ trash, change }`: the trash with no entries (keeping its memory and
counters: the trashed-stage elements left are dropped the next time the memory is brought up to
date, and IDs are never given twice), and the change `{ added: [], removed: [every entry],
memoryBefore, memoryAfter }`, both memories the trash's own. A caller emptying the trash as part of
an edit of the plan keeps the change, so undoing that edit brings the entries back.

### Undo and redo
A caller that keeps undo and redo of plans (`plan-history.md`) keeps, with each recorded edit that
changed the trash, that edit's **change**, and applies it again as the edit is undone or redone:
- **`undoTrashChange(trash, change)`**: the trash without the entries in `change.added` (by `id`;
  ones no longer there are skipped), with the entries in `change.removed` that aren't in it, each in
  its place in the order above, dropping the oldest beyond `TRASH_LIMIT`, and with
  `change.memoryBefore` as its memory.
- **`redoTrashChange(trash, change)`**: the reverse: without `change.removed`, with `change.added`,
  and with `change.memoryAfter`.

So undoing a delete takes its entries out of the trash, undoing a put back puts the entry back in
the trash and its stage back among the trashed stages, and undoing an edit that emptied the trash
brings back what it emptied, whatever else happened to the trash in between (an entry emptied in
the meantime simply isn't there to take out). Redoing a delete may drop older entries again, past
the limit, if others were added since; that's accepted (Claude's choice: the limit holds).

### Keeping the trash as text
**`trashToText(trash)`** gives JSON:

```js
{ "format": "biomek-tools trash", "version": 1, "entries": [ … ], "memory": { … },
  "nextEntryId": 5, "nextDeletion": 3 }
```

**`trashFromText(text)`** reads it back, and **never throws** (Claude's choice: the trash is a
convenience, and a damaged one shouldn't stop a tool opening). It reads in three parts:
- **The frame.** Anything else gives `emptyTrash()`: the text isn't JSON; isn't an object with
  exactly those six properties; `format` isn't `"biomek-tools trash"`; `version` isn't `1` (a newer
  one included); `nextEntryId` or `nextDeletion` isn't a whole number of at least 1; or `entries`
  isn't a list.
- **Each entry.** One that can't be read is **dropped**, and the others kept: one that isn't an
  object with exactly the properties above, each of its kind (`id` a whole number of at least 1,
  below `nextEntryId`; `deletion` a whole number of at least 1, below `nextDeletion`; `kind` one of
  the four; `name` text or `null`; `stageCount` and `transferCount` whole numbers of at least 0;
  `deletedAt` text that `Date` reads as a date; `copied` an object; `stages` a list of objects with
  exactly `name` (text) and `key` (text or `null`); `randomizationsAbove` and `randomizationsBelow`
  lists of objects with exactly `id` and `name`, both text). Of two entries with one `id`, the
  later is dropped. `copied` isn't checked here: `pasteItems` checks it when it's put back, and
  refuses it with its message.
- **The memory.** If it isn't an object with exactly `order` (a list whose elements are each
  exactly `{ stage }` with text, or `{ entry, index }` with a whole number of at least 1 and a whole
  number of at least 0 or `null`), `names` (an object of text), `keys` (an object of text or
  `null`) and `nextGroupKey` (a whole number of at least 1, above every key's number), the entries
  are kept with an empty memory (`order` `[]`, `names` and `keys` `{}`, `nextGroupKey` 1, or one
  more than the largest number in the entries' keys), so they can be dragged but no place is found
  for them.

Entries out of order are put in order; more than `TRASH_LIMIT` keeps the newest `TRASH_LIMIT`.

### Configuration
`config/trash.js` (data only, ADR 0009):
- **`TRASH_LIMIT`**: the most entries the trash keeps, `20` (Andy, 2026-11-11, from the preview).
  A whole number of at least 1; this module's tests check it.

## 4. Interface
None of these changes what it's given.

| Function | Returns |
|---|---|
| `emptyTrash()` | a trash with no entries and no memory (section 3). |
| `addDeleted(trash, plan, items, deletedAt)` | `{ trash, change }`: the trash with an entry for each of `items` deleted from `plan` (the plan before the delete), as one delete, and the change. Throws as section 5 says. |
| `putBackPlace(plan, trash, id)` | the place entry `id` goes back to in `plan`, or `null` (section 3, "Putting back"). Throws if there's no entry `id`. |
| `putBack(plan, trash, id, place)` | `{ plan, placed, trash, change }`: entry `id` put back at `place`, or at `putBackPlace`'s with `place` `undefined` or `null`, as one edit. Throws as section 5 says. |
| `clearTrash(trash)` | `{ trash, change }`: the trash emptied, and the change. |
| `undoTrashChange(trash, change)` | the trash with `change` undone. |
| `redoTrashChange(trash, change)` | the trash with `change` made again. |
| `trashToText(trash)` | the trash as JSON text. |
| `trashFromText(text)` | the trash `text` holds, as much of it as can be read (section 3). Never throws. |
| `TRASH_FORMAT`, `TRASH_VERSION` | (constants) `"biomek-tools trash"` and `1`. |
| `TRASH_LIMIT` | (a constant) re-exported from `config/trash.js`. |

## 5. Errors
| Problem | Message |
|---|---|
| `addDeleted`: `items` or an item refused, or a refusal of `deleteItems` | `deleteItems`' messages, unchanged (`transfer-designer.md`, section 5) |
| `addDeleted`: `deletedAt` isn't text `Date` reads as a date | `When it was deleted must be a date as text, like "2026-11-11T05:28:41.000Z", but got 5.` |
| `putBackPlace`, `putBack`: no entry with `id` | `There's no entry 9 in the trash.` |
| `putBack`: no place given, and none found | `Its place isn't in this plan: drag it where it should go.` |
| `putBack`: `pasteItems` refuses | its message, unchanged (`Can't paste: …`) |
| `putBack`: the paste places a different number of stages than the entry holds | `This entry can't be put back: it doesn't hold the stages it should. Empty the trash or leave it.` |

Order of checks: `addDeleted`: the items and `deleteItems`' refusals (in `deleteItems`' order),
then `deletedAt`. `putBack`: the entry, then the place (a given place is checked by `pasteItems`),
then the paste, then the number of stages.

## 6. Test cases
Each becomes at least one unit test in `trash.test.js`, inside `describe("trash", …)`. Each row of
section 5 has at least one test. Andy asked (2026-11-11) for these to be **very thorough**: the
preview showed putting back to be easy to get wrong.

**The test plan with a bit of everything**, a fixture shared with `transfer-designer.test.js` and
the browser walk-through: `tests/fixtures/delete-test-plan.js`, exporting
- `deleteTestPlan()`: a plan built with the transfer designer's own edits (so it's valid by
  construction), with:
  - **labware**: the deck's first reservoir (`Res1` in today's `config/deck.js`) and first 96-well
    plate (taken from `config/deck.js` by kind, never by name, CLAUDE.md "Tests follow `config/`");
  - **components** Media, Drug A, Drug B and Dye, in troughs 1 to 4 of the reservoir, each
    `DEFAULT_FILL_VOLUME`;
  - **stages**, named so each keeps its name when stages are renumbered, each with transfers of
    `DEFAULT_TRANSFER_VOLUME` from its component's trough into the wells its name gives (`row A`:
    A1 to A4; and so on), in this column order and tip groups:
    1. [S01 Media row A, S02 Media row B]: the `START` tips, `TIP_TYPES[0]` on `probesFor(4)`;
    2. [S03 Drug A row A, S04 Drug B row B, S05 Dye row B, S06 Mix row A (a mix step mixing A1 to
       A4)]: `TIP_TYPES[1]` (or `TIP_TYPES[0]` when there's one) on `probesFor(2)`;
    3. [S07 Media row C]: `TIP_TYPES[0]` on `probesFor(8)`;
    4. [S08 Dye row C, S09 Media row H]: `TIP_TYPES[0]` on `probesFor(1)`;
    5. a **run randomization**, `Randomization1`: sources Drug A and Drug B troughs, 4 replicates
       each, Media the filler, wells to fill D1 to E4, seed `7`, run so it has three stages, each on
       tips of its own (its first run's settings and tips from the stage before it);
    6. [S10 Media row G, S11 Dye row G]: `TIP_TYPES[0]` on `probesFor(4)`;
    7. a **transfer table** of Media and Dye into wells labeled `Control` (F1, F2) and `Dyed` (F3,
       F4): two stages.
  So groups 1, 2, 3 and 4 have different tips whatever `TIP_TYPES` holds.
- `stageIdOf(plan, name)`: the ID of the stage called `name` (`S03 Drug A row A`, or just `S03`,
  its first word).
- `planOutline(plan)`: the plan **up to its IDs**, for comparing a plan after putting back with the
  one before the delete: the column's boxes in order (`columnBoxes`), each tip group as its tip
  type, probes and stages, each stage as its name, kind, settings and transfers (in operation
  order, as source, destination and volume); each randomization as its name, sources, fill, seed,
  volume and tip groups; each transfer table as its table, sources and tip groups; and the
  components, starting contents, labware labels, well labels and experiment name as they are.
  Stage, randomization and transfer table IDs, and `beforeId`, aren't in it; where an unrun
  randomization sits is, as its place among the boxes.
- `biomekOutput(plan)`: the plan's Biomek files, `writeRunFiles` (`file-writer.md`) with the
  experiment name `DeleteTest` and a fixed timestamp, as a list of `{ name, text }`, and its
  `tipsUsed`; so a round trip can show that what goes to the Biomek is the same.

**Configuration**
- `TRASH_LIMIT` is a whole number of at least 1. The tests below take the limit from it (CLAUDE.md,
  "Tests follow `config/`"): "the limit" is `TRASH_LIMIT`.

**Entries**
- `addDeleted` of each kind, from the test plan: a stage (S04: `kind`, `name`, `stageCount` 1,
  `transferCount` its transfers, `stages` its name and group 2's key, `copied` equal to
  `copyOf(plan, [item])`); a mix step (S06, its mixed wells counted as transfers); a tip group
  (group 2: four stages, one key); a randomization (its name, three stages with key `null`); an
  unrun randomization (no stages; its marker in the order before S07); a transfer table (`name`
  `null`, two stages).
- Several items: one entry each, in column order, given out of order; a stage of a listed tip group
  left out; an item listed twice, once.
- `deleteItems`' refusals: a randomization's stage alone, every stage: its message, the trash
  unchanged.
- `deletedAt` kept as given; its error for `5`, for `"yesterday"` and for `"2026-13-45"`.
- The remembered order after a delete: the plan's stages as `{ stage }`, the deleted ones as
  `{ entry, index }`, in their places; group keys `g1` to `g4` for groups 1 to 4 and `g5` for group
  6, `null` for the randomization's and transfer table's stages.
- `randomizationsAbove` and `randomizationsBelow`: an unrun randomization added before S07, then S07
  deleted: above `[it]`; group 1 deleted with one sitting before S03: below `[it]`.

**Adding and the limit**
- `addDeleted` numbers entries from `nextEntryId`, gives each delete one `deletion`, and orders
  newest delete first, column order within one (S02 and S05 deleted together: S02 then S05, above
  an earlier delete's entry).
- Adding past the limit drops the oldest; the change's `removed` holds them.
- One delete of more things than the limit (a plan with the limit plus 2 stages in their own tip
  groups, all but one deleted): the trash keeps the first `TRASH_LIMIT` of them in the order; the
  change's `added` holds only those, `removed` only the entries in the trash before; undoing the
  change gives back the trash as it was before, compared in full.

**Putting back: round trips, one delete** (the heart of it). For each case below, from the test
plan: delete the things with `deleteItems` in **one** delete, with `addDeleted` on an empty trash,
then put the entries back with `putBack` and no place, **one at a time, in every order** (every
permutation: 2 for two things, 6 for three), and check that each has a place before it's put back,
and after the last that `planOutline` and `biomekOutput` equal the test plan's, and that the trash
is empty.
1. S02 and S03 (either side of a group boundary).
2. S03 and S04 (a group's first stage and the next).
3. S03, S04 and S05 (a group's first three, leaving S06 alone in it).
4. S07, S08 and S09 (a lone group, then the whole next group).
5. S01 (the plan's first stage), and S01 with S02 (the whole first group, as stages).
6. S11 (the last ordinary stage), and S10 with S11.
7. S09 and S10 (either side of the randomization).
8. Group 2 as a tip group, and group 2 with S02 and S07 (stages around it).
9. Group 1, as a tip group.
10. S06 (a mix step), and S05 with S06.
11. The randomization; the randomization with S09 and S10; and an unrun randomization added before
    S07, alone and with S07.
12. The transfer table; the transfer table with S11.
13. S01, group 2 and the randomization (mixed kinds, spread out).
14. S06, S11 and the transfer table.

**Putting back: round trips, separate deletes** (the review's failing cases, 2026-11-11). The same
checks, but each thing deleted in a delete of its own, in the order given, then put back in every
order:
15. S04, then S03 (the old trash gave S04, S03, S05, S06).
16. S03, then S04.
17. S07, then S08, then S09 (the old trash gave group 2, [S08, S09], [S07]).
18. S09, then S08, then S07 (the old trash gave [S08] and [S09] as two groups).
19. S03, then group 2 (S04 to S06, as a tip group) (the old trash left S03 in a group of its own).
20. S03, S04 and S05 together, then S06 (a group's remaining stage deleted later).
21. S02, then S03; S03, then S02.
22. S09, then S10, either side of the randomization; and S10, then the randomization.
23. An unrun randomization added before S07, then S07 (the old trash put S07 back below it); and
    one added before S03, then group 1 (the old trash put group 1 back below it).
24. Cases 1, 2, 4, 7 and 13 again, each thing in a delete of its own, in column order and in
    reverse.

**Putting back: after other edits** (each checking where it lands, not the whole outline):
- Its groupmate above moved to another tip group: S04 deleted, S03 moved into group 1: S04 goes back
  into group 2, at its top, above S05 (S03, moved, holds group 1's key once most of group 1 holds
  it).
- Its groupmate above renamed: S04 deleted, S03 renamed: S03 doesn't count, so S04 goes back at the
  top of group 2, above the renamed S03 (into its group, but not beside it).
- Every groupmate gone for good: S04 deleted, then S03, S05 and S06 deleted and the trash emptied:
  S04 goes back into a tip group of its own, just below group 1's box, on its own tips.
- A new stage added beside its neighbor after the delete: S04 deleted, a stage added just below S03:
  S04 goes back just below S03, above the new stage (Andy accepted this, 2026-11-11: dragging is
  there for an exact spot).
- Deleted, put back, deleted again: S03 and S04 deleted; S03 put back; S03 deleted again; S04 put
  back, then S03: the outline as before.
- The last stage deleted and a new one added (the plan gives it the deleted stage's ID): the new
  stage doesn't count as the deleted one, and the deleted one goes back in its place.
- Several stages called `New stage` (a plan of four, all `New stage`, in two tip groups): delete
  the second, add a stage (which may take an old ID with the same name): its place is found and is
  within its tip group; the test states which, from the rules, so a change shows.
- A tip group deleted, then the stages either side of it moved apart: it goes back just below the
  box of the stage that was above it.
- The randomization run again after S10 and S11 are deleted (its stages new stages, if a run gives
  new IDs; the test checks either way): S10 and S11 go back below the nearest remembered stage that
  still counts, the test stating which box.
- A randomization put back takes its name again; if another randomization has taken the name since,
  it keeps the pasted one; its well map is named after it again (`well-maps.md`).
- A place the caller gives is used instead of the found one (`between` 0), and the memory then puts
  the put-back stage where it landed: an entry deleted beside it finds it there.

**Another plan**
- An entry deleted from the test plan, `putBackPlace` on `emptyPlan()`: `null`; `putBack` with no
  place (and with `null`) refuses with its message; with a place, it pastes there.
- A plan with **the same IDs but other names** (the test plan with every stage renamed): `null`.
- A plan with **the same names but other IDs** (the test plan's stages copied and pasted into a new
  plan): `null`.

**`putBack` itself**
- `placed` is `pasteItems`'; the entry is gone from the trash; the change is `{ added: [], removed:
  [entry], memoryBefore, memoryAfter }`; the memory names each pasted stage with the entry's key.
- A tip group going back into its tip group is pasted as its stages, with the group's tips.
- Errors: no such entry; no place; an entry whose `copied` is damaged (read from text):
  `pasteItems`' message, the trash unchanged; an entry whose `copied` holds a different number of
  stages than `stages`: its message.

**Emptying, undo and redo**
- `clearTrash`: no entries, the memory and counters kept; the change removes every entry.
- `undoTrashChange` of a delete's change takes its entries out and restores the memory; of a put
  back's puts the entry back in its place and the memory; of a clear brings every entry back in
  order; `redoTrashChange` of each does it again. Undo after the entries were emptied meanwhile:
  nothing to take out, no error. Re-adding past the limit drops the oldest; redoing a delete past
  the limit drops older entries again (accepted).
- Sequences like a tool's, each compared in full after every step, and the plan outline after the
  last:
  - delete S03, delete S07, put back S03, undo (S03's entry back), undo (S07's entry gone), redo,
    redo;
  - put back S03 (of S03 and S04 deleted together), undo, then put back S04, then S03;
  - delete S04, undo, redo, put back S04;
  - delete S03, empty the trash as part of an edit (a Reset: the plan replaced with `emptyPlan()`),
    undo, put back S03.

**Text**
- `trashToText` then `trashFromText` gives an equal trash (entries, order, memory, counters), for an
  empty trash and one with an entry of each kind.
- The frame unreadable, each giving `emptyTrash()` without throwing: not JSON; `null`; a list; a
  missing or extra property; another `format`; version 2; `nextEntryId` 0 or 1.5; `nextDeletion` 0;
  `entries` not a list.
- One entry unreadable, dropped and the others kept: each property missing or of the wrong kind in
  turn, among them `stageCount` -1, `kind` `"box"`, `deletedAt` `"not a date"`, `deletion` at or
  above `nextDeletion`, `id` at or above `nextEntryId`; two entries with one `id` (the later
  dropped).
- The memory unreadable (not an object; `order` with an element `{ stage: 5 }`; `keys` with a
  number; `nextGroupKey` 0): the entries kept, the memory empty, `putBackPlace` `null` for each.
- Entries out of order come back in order; more than the limit keeps the newest.

**Immutability**: no function changes the trash, entries, plan or change it's given.

**The REPL** (`scripts/repl.js`): a `trash` topic, with an example that deletes two stages of the
test plan in separate deletes, puts them back in the other order, and shows the trash after each
step.
