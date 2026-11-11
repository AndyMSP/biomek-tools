# trash — specification

> **Draft (2026-11-11).** Written for v0.2.0 (roadmap, item 32), from the preview Andy shaped on
> 2026-11-11. Revised the same night: two reviews of the specifications showed that **putting an
> entry back where it was** couldn't be made reliable (ADR 0024), so Andy dropped it (2026-11-11,
> 01:51): the trash is **drag-out only**, and Undo is the exact way to bring back a recent delete.
> Written in the hands-off workflow (CLAUDE.md, "Workflows"), so the choices made for Andy are
> listed in its pull request. Still to review: every message. It becomes Final once built and
> tested by Andy.

## 1. Purpose
`trash.js` keeps what's deleted from a plan, so it can be pasted again later: the transfer
designer's **trash** (`docs/glossary.md`; ADR 0024). It makes the trash's entries, takes one out
when it's pasted, empties the trash, undoes and redoes its changes, and turns a trash into text and
back. It holds no page code (CLAUDE.md, "Separate logic from the UI"); how the trash looks and is
used is the page's (`transfer-designer-page.md`, section 7, "The trash").

It builds on `transfer-designer` and doesn't repeat it: deleting is `deleteItems`, a deleted thing
is kept as **copied items** (`copyOf`), and pasting it is `pasteItems`, so the container rule and
every check of pasting apply as for any paste (`transfer-designer.md`, "Moving and copying" and
"Deleting").

## 2. Scope
Version 1 adds what a delete took to a trash of at most `TRASH_LIMIT` entries, pastes an entry at a
place the caller gives (taking it out of the trash), empties the trash, undoes and redoes its
changes, and turns a trash into text and back, for a caller to keep.

Not in version 1:
- **Putting an entry back where it was by itself** (ADR 0024: dropped by Andy, 2026-11-11). The
  trash doesn't know where anything was; a caller gives the place. Undo brings back a recent delete
  exactly.
- **The trash in plan files.** It's kept apart from the plan, isn't in plan files and isn't tied to
  a plan: an entry can be pasted into any plan.
- **Several entries pasted as one.**

## 3. Data model

### The trash
A trash is a plain object that's **never changed after it's made**: every function returns a new
one, as plans are (`transfer-designer.md`, "The plan").

```js
{
  entries:      [entry, …],     // the order below
  nextEntryId:  5,              // the next entry's ID
  nextDeletion: 3,              // the next delete's number
}
```

`emptyTrash()` gives `{ entries: [], nextEntryId: 1, nextDeletion: 1 }`.

**Order.** Newest delete first; within one delete, in **column order** (the order the deleted
things had in the column). Precisely: by `deletion`, largest first, then by `id`, smallest first.
Every function keeps this order, including when undo puts entries back.

**At most `TRASH_LIMIT` entries** (`config/trash.js`, below). Adding more drops the oldest (the
last in the order).

### Entries
**One entry per deleted thing** (Andy, 2026-11-11). A deleted thing is an **item**
(`docs/glossary.md`): a stage (a mix step included), an ordinary tip group, a randomization or a
transfer table. An entry:

```js
{
  id:            4,               // a whole number, from the trash's nextEntryId
  deletion:      2,               // the delete it came from; entries of one delete share it
  kind:          "stage",         // "stage", "tipGroup", "randomization" or "transferTable"
  name:          "S03 Drug A",    // a stage's or randomization's name; null for the others
  stageCount:    1,               // how many stages it held (0 for a randomization that hasn't run)
  transferCount: 3,               // how many transfers (a mix step's mixed wells included)
  deletedAt:     "2026-11-11T05:28:41.000Z",   // when, as the caller gave it (ISO 8601 text)
  copied:        { format: "biomek-tools copied items", … },   // copyOf(plan, [item])
}
```

`copied` is the copied items for that one item, as `copyOf` writes them. Copied items don't hold a
randomization's name (`transfer-designer.md`, "Moving and copying"), so `name` keeps it, to give it
back when it's pasted (below).

### Adding
**`addDeleted(trash, plan, items, deletedAt)`** gives `{ trash, change }`, for a caller that
deletes `items` from `plan` (the plan **before** the delete):
1. It checks `items` exactly as `deleteItems` does, its refusals included (a randomization's or
   transfer table's stage without its owner; every stage of the plan), with its messages; then
   `deletedAt`: text that `Date` reads as a date.
2. It makes one entry per item, taken as `deleteItems` takes them (column order, a stage of a listed
   container left out, repeats once), each with the trash's `nextDeletion` (then one more) and a new
   `id` from `nextEntryId`, in column order.
3. It adds them, in the order above, dropping the oldest beyond `TRASH_LIMIT`.

The **change** is `{ added, removed }`: `added`, the new entries the trash **kept** (with their
IDs; in a delete of more things than the limit, those dropped at once aren't in it); `removed`, the
entries that were **in the trash before** and were dropped. So undoing the change gives back the
trash exactly as it was.

A caller removing one thing by another edit (removing a stage, a randomization or a transfer table)
calls it with that one item.

### Pasting an entry
**`pasteEntry(plan, trash, id, place)`** pastes entry `id` at `place` (a place of
`transfer-designer.md`, "Moving and copying"), as one edit:
1. It refuses an `id` that isn't in the trash.
2. It pastes the entry's `copied` at `place` (`pasteItems`, whose refusals pass through unchanged,
   the trash unchanged).
3. **It gives a randomization its name back**: a pasted randomization gets a new name, so it's
   renamed to the entry's `name` (`renameRandomization`), in the same edit (Claude's choice,
   2026-11-11: its well map is named after it), **only when** that name passes a randomization
   name's rule (the experiment name's rule, `transfer-designer.md`, "Randomizations") and **no
   other randomization of the new plan has it, ignoring capitals** (`HySoy_dose` and
   `hysoy_dose` are the same). Otherwise it keeps the pasted name, and nothing is refused:
   `renameRandomization` is never called when it would throw. (An entry read back from text may
   hold a name that breaks the rule; `trashFromText` checks only that it's text.)
4. It takes the entry out of the trash.

It gives `{ plan, placed, trash, change }`: the plan with it pasted; `placed`, `pasteItems`' (the
randomization's item, after a rename); the new trash; and the change `{ added: [], removed: [the
entry] }`.

### Emptying
**`clearTrash(trash)`** gives `{ trash, change }`: the trash with no entries (keeping its counters,
so IDs are never given twice), and the change `{ added: [], removed: [every entry] }`. A caller
emptying the trash as part of an edit of the plan keeps the change, so undoing that edit brings the
entries back.

### Undo and redo
A caller that keeps undo and redo of plans (`plan-history.md`) keeps, with each recorded edit that
changed the trash, that edit's **change**, and applies it as the edit is undone or redone:
- **`undoTrashChange(trash, change)`**: the trash without the entries in `change.added` (by `id`;
  ones no longer there are skipped), and with the entries in `change.removed` that aren't in it,
  each in its place in the order above, dropping the oldest beyond `TRASH_LIMIT`.
- **`redoTrashChange(trash, change)`**: the reverse: without `change.removed`, with `change.added`.

So undoing a delete takes its entries out, undoing a paste of an entry puts it back in the trash,
and undoing an edit that emptied the trash brings back what it emptied, whatever else happened to
the trash in between (an entry emptied meanwhile simply isn't there to take out). Redoing a delete
may drop older entries again, past the limit, if others were added since; that's accepted
(Claude's choice: the limit holds).

### Keeping the trash as text
**`trashToText(trash)`** gives JSON:

```js
{ "format": "biomek-tools trash", "version": 1, "entries": [ … ], "nextEntryId": 5, "nextDeletion": 3 }
```

**`trashFromText(text)`** reads it back, and **never throws** (Claude's choice: the trash is a
convenience, and a damaged one shouldn't stop a tool opening):
- **The frame.** Anything else gives `emptyTrash()`: the text isn't JSON; isn't an object with
  exactly those five properties; `format` isn't `"biomek-tools trash"`; `version` isn't `1` (a
  newer one included); `nextEntryId` or `nextDeletion` isn't a whole number of at least 1; or
  `entries` isn't a list.
- **Each entry.** One that can't be read is **dropped**, and the others kept: one that isn't an
  object with exactly the properties above, each of its kind (`id` a whole number of at least 1,
  below `nextEntryId`; `deletion` a whole number of at least 1, below `nextDeletion`; `kind` one of
  the four; `name` text or `null`; `stageCount` and `transferCount` whole numbers of at least 0;
  `deletedAt` text that `Date` reads as a date; `copied` an object). Of two entries with one `id`,
  the later is dropped. `copied` isn't checked here: `pasteItems` checks it when it's pasted, and
  refuses it with its message.

Entries out of order are put in order; more than `TRASH_LIMIT` keeps the newest `TRASH_LIMIT`.

### Configuration
`config/trash.js` (data only, ADR 0009):
- **`TRASH_LIMIT`**: the most entries the trash keeps, `20` (Andy, 2026-11-11, from the preview).
  A whole number of at least 1; this module's tests check it.

## 4. Interface
None of these changes what it's given.

| Function | Returns |
|---|---|
| `emptyTrash()` | a trash with no entries. |
| `addDeleted(trash, plan, items, deletedAt)` | `{ trash, change }`: the trash with an entry for each of `items` deleted from `plan` (the plan before the delete), as one delete, and the change. Throws as section 5 says. |
| `pasteEntry(plan, trash, id, place)` | `{ plan, placed, trash, change }`: entry `id` pasted at `place`, as one edit, and taken out of the trash. Throws as section 5 says. |
| `clearTrash(trash)` | `{ trash, change }`: the trash emptied, and the change. |
| `undoTrashChange(trash, change)` | the trash with `change` undone. |
| `redoTrashChange(trash, change)` | the trash with `change` made again. |
| `trashToText(trash)` | the trash as JSON text. |
| `trashFromText(text)` | the trash `text` holds, as much of it as can be read. Never throws. |
| `TRASH_FORMAT`, `TRASH_VERSION` | (constants) `"biomek-tools trash"` and `1`. |
| `TRASH_LIMIT` | (a constant) re-exported from `config/trash.js`. |

## 5. Errors
| Problem | Message |
|---|---|
| `addDeleted`: `items` or an item refused, or a refusal of `deleteItems` | `deleteItems`' messages, unchanged (`transfer-designer.md`, section 5) |
| `addDeleted`: `deletedAt` isn't text `Date` reads as a date | `When it was deleted must be a date as text, like "2026-11-11T05:28:41.000Z", but got 5.` |
| `pasteEntry`: no entry with `id` | `There's no entry 9 in the trash.` |
| `pasteEntry`: `pasteItems` refuses (the place, or the entry's `copied`) | its message, unchanged (`Can't paste: …`, or the place's message) |

Order of checks: `addDeleted`: the items and `deleteItems`' refusals (in `deleteItems`' order),
then `deletedAt`. `pasteEntry`: the entry, then the paste.

## 6. Test cases
Each becomes at least one unit test in `trash.test.js`, inside `describe("trash", …)`. Each row of
section 5 has at least one test. Andy asked (2026-11-11) for these to be **very thorough**.

**The test plan with a bit of everything**, a fixture shared with `transfer-designer.test.js` and
the browser walk-through: `tests/fixtures/delete-test-plan.js`, exporting
- `deleteTestPlan()`: a plan built with the transfer designer's own edits (so it's valid by
  construction), that **can be written as Biomek files**, with:
  - **the experiment name** `DeleteTest` (`setExperimentName`);
  - **labware**: the deck's first reservoir and first 96-well plate, taken from `config/deck.js`
    by kind, never by name (CLAUDE.md, "Tests follow `config/`"); below, "the plate";
  - **components** Media, Drug A, Drug B and Dye, in troughs 1 to 4 of the reservoir. **Each trough
    is filled with what the plan draws from it, above its dead volume, and a margin**: its labware
    type's `deadVolume` (`config/labware-types.js`), plus `DEFAULT_TRANSFER_VOLUME` times the number
    of transfers below that draw from it, plus one more `DEFAULT_TRANSFER_VOLUME`. Every volume in
    the plan is `DEFAULT_TRANSFER_VOLUME`, and the transfers drawn are: Media 28 (S01, S02, S07,
    S09 and S10, 4 each; the randomization's filler, 4; the transfer table's Media column, 4), Drug
    A 8 (S03, 4; the randomization, 4), Drug B 8 (S04, 4; the randomization, 4) and Dye 14 (S05, S08
    and S11, 4 each; the transfer table's Dye column, 2). (Until 2026-11-11 each trough held
    `DEFAULT_FILL_VOLUME`, below the reservoir's dead volume, so nothing could be drawn and the
    Biomek files couldn't be written.)
  - **stages**, named so each keeps its name when stages are renumbered, each with transfers of
    `DEFAULT_TRANSFER_VOLUME` from its component's trough into the plate's wells its name gives
    (`row A`: A1 to A4; and so on), in this column order and tip groups:
    1. [S01 Media row A, S02 Media row B]: the `START` tips, `TIP_TYPES[0]` on `probesFor(4)`;
    2. [S03 Drug A row A, S04 Drug B row B, S05 Dye row B, S06 Mix row A (a mix step mixing A1 to
       A4)]: `TIP_TYPES[1]` (or `TIP_TYPES[0]` when there's one) on `probesFor(2)`;
    3. [S07 Media row C]: `TIP_TYPES[0]` on `probesFor(8)`;
    4. [S08 Dye row C, S09 Media row H]: `TIP_TYPES[0]` on `probesFor(1)`;
    5. a **run randomization**, `Randomization1`, added before S10: sources the Drug A and Drug B
       troughs, 4 replicates each, the Media trough the filler, wells to fill D1 to D6 and E1 to E6
       of the plate (12 wells: 4 + 4 + 4 filler), seed `7`, volume `DEFAULT_TRANSFER_VOLUME`, run
       so it has **three stages** (Drug A, Drug B, Media), each on tips of its own (its first run's
       settings and tips from the stage before it, so `TIP_TYPES[0]` on `probesFor(1)`);
    6. [S10 Media row G, S11 Dye row G]: `TIP_TYPES[0]` on `probesFor(4)`;
    7. a **transfer table**, added last: the plate's F1 and F2 labeled `Control` and F3 and F4
       `Dyed` (`setWellLabel`); the table `[["Dest Well Label", "Media", "Dye"], ["Control", V,
       ""], ["Dyed", V, V]]`, `V` being `DEFAULT_TRANSFER_VOLUME` as text; sources Media from trough
       1 and Dye from trough 4; so **two stages**, Media (into F1 to F4) and Dye (into F3 and F4),
       their settings as `addTransferTable` gives them, then each one's tip change set to
       `TIP_TYPES[0]` on `probesFor(3)` (`setTipType`, `setTipProbes`, as a transfer table's
       stages' tips are edited).
  So groups 1 to 4 have different tips whatever `TIP_TYPES` holds.
- `stageIdOf(plan, name)`: the ID of the stage called `name` (or just its first word, `S03`).
- `planOutline(plan)`: the plan **up to its IDs**: the column's boxes in order (`columnBoxes`), each
  tip group as its tip type, probes and stages, each stage as its name, kind, settings and
  transfers (in operation order, as source, destination and volume); each randomization as its
  name, sources, fill, seed, volume and tip groups; each transfer table as its table, sources and
  tip groups; where an unrun randomization sits, as its place among the boxes; and the components,
  starting contents, labware labels, well labels and experiment name. Stage, randomization and
  transfer table IDs, and `beforeId`, aren't in it.
- `biomekOutput(plan)`: the plan's Biomek files, `writeRunFiles(plan, timestamp)`
  (`file-writer.md`) with the fixed timestamp `new Date(2026, 10, 11, 12, 0, 0)`, as its folder
  name and its list of `{ name, text }`, and the plan's `tipsUsed`.

**The test plan itself**, so every test below starts from a plan that works:
- it has the stages, tip groups and tips listed above, in that order, and the randomization has
  three stages;
- each trough holds what's listed above, worked out from `config/` as above, and the transfers
  drawn from each trough are the counts listed;
- `stagesWithContentsProblem` and `stagesWithMixProblem` are empty;
- `writeRunFiles` succeeds (`biomekOutput` doesn't throw), which it doesn't with a contents problem
  of any kind, the starting contents' included (`file-writer.md`, section 5); and `planToText` then
  `planFromText` gives the same plan.

**Configuration**
- `TRASH_LIMIT` is a whole number of at least 1. The tests below take the limit from it: "the
  limit" is `TRASH_LIMIT`.

**Entries**
- `addDeleted` of each kind, from the test plan: a stage (S04: `kind`, `name`, `stageCount` 1,
  `transferCount` its transfers, `copied` equal to `copyOf(plan, [item])`); a mix step (S06, its
  mixed wells counted as transfers); a tip group (group 2: `name` `null`, 4 stages); a randomization
  (its name, 3 stages); an unrun randomization (0 stages, 0 transfers); a transfer table (`name`
  `null`, 2 stages).
- Several items: one entry each, in column order, given out of order; a stage of a listed tip group
  left out; an item listed twice, once.
- `deleteItems`' refusals (a randomization's stage alone; every stage): its message, the trash
  unchanged; `deletedAt`'s error for `5`, `"yesterday"` and `"2026-13-45"`; `deletedAt` kept as
  given.

**Adding and the limit**
- Entries numbered from `nextEntryId`, one `deletion` per delete, newest delete first, column order
  within one (S02 and S05 deleted together: S02 then S05, above an earlier delete's entry).
- Adding past the limit drops the oldest; the change's `removed` holds them.
- One delete of more things than the limit (a plan with the limit plus 2 stages, each in its own tip
  group, all but one deleted, onto a trash holding one entry): the trash keeps the first
  `TRASH_LIMIT` of the new entries; `added` holds only those; `removed` only the entry there before;
  undoing the change gives back the trash as it was, compared in full.

**Delete then paste at the original place.** For each case, from the test plan: delete the things, adding
each delete's entries with `addDeleted`; then paste each entry with `pasteEntry` at the place it
had, **in the reverse order of the deletes** (within one delete, in column order), each place
written out in the test (worked out by hand from `columnBoxes` of the plan at that point, e.g. S03
`inTipGroup` position 0 of group 2's box, so it takes the group's tips); and check after the last
that `planOutline` and `biomekOutput` equal the test plan's, and the trash is empty.
- **One delete:** S02 and S03 (either side of a group boundary); S03 and S04 (a group's first two);
  S03, S04 and S05; S07, S08 and S09 (a lone group and the next group); S01; S01 and S02; S11; S10
  and S11; S09 and S10 (either side of the randomization); group 2 as a tip group; group 2 with S02
  and S07; group 1 as a tip group; S06 (a mix step); S05 and S06; the randomization; the
  randomization with S09 and S10; an unrun randomization added before S07, alone and with S07; the
  transfer table; the transfer table with S11; S01, group 2 and the randomization; S06, S11 and the
  transfer table.
- **Separate deletes:** S04, then S03; S03, then S04; S07, then
  S08, then S09; S09, then S08, then S07; S03, then group 2; S03, S04 and S05, then S06; S02, then
  S03; S09, then S10; S10, then the randomization; an unrun randomization added before S07, then
  S07; one added before S03, then group 1.
- A randomization pasted takes its name again (`Randomization1`, pasted where it was: the plan's
  outline equal to the test plan's).
- It keeps the pasted name, the paste not refused, when: another randomization has the name; another
  has it in other capitals (a randomization added and renamed `RANDOMIZATION1` before the paste);
  the entry's `name` breaks the rule (an entry read back from text with `name` `"bad name"`, with a
  space, and one with a name of 41 characters).

**Pasting elsewhere**
- An entry pasted into `emptyPlan()` (`between` 0): the same stages, settings, tips and transfers
  as `copyOf` gave; pasting into another plan is a paste like any.
- `pasteItems`' refusals pass through, the trash unchanged: a tip group at an `inTipGroup` place; a
  place out of range; an entry whose `copied` is damaged (read from text with a wrong `copied`); an
  entry whose `copied` names a well not on the deck (a stage's transfer to the plate's `Z99`,
  written into the entry's text and read back with `trashFromText`, which doesn't check `copied`):
  `pasteItems`' message for that well.
- No such entry: its message.
- The change is `{ added: [], removed: [entry] }`; `placed` is `pasteItems`'.

**Emptying, undo and redo**
- `clearTrash`: no entries, counters kept; the change removes every entry.
- `undoTrashChange` of a delete's change takes its entries out; of a paste's puts the entry back in
  its place; of a clear brings every entry back in order; `redoTrashChange` of each does it again.
  Undo after the entries were emptied meanwhile: nothing to take out, no error. Redoing a delete
  past the limit drops older entries again (accepted).
- Sequences like a tool's, the trash compared in full after every step, applying the changes as a
  plan history would:
  - delete S03, delete S07, paste S03's entry, undo (back in the trash), undo (S07's entry gone),
    redo, redo;
  - delete S03 and S04, paste S03's entry, undo, paste S04's, then S03's;
  - delete S04, undo, redo, paste it;
  - delete S03, empty the trash as part of an edit (a Reset: the plan replaced with `emptyPlan()`),
    undo (S03's entry back), paste it into the plan where it was: the test plan's outline.

**Text**
- `trashToText` then `trashFromText` gives an equal trash, for an empty trash and one with an entry
  of each kind.
- The frame unreadable, each giving `emptyTrash()` without throwing: not JSON; `null`; a list; a
  missing or extra property; another `format`; version 2; `nextEntryId` 0 or 1.5; `nextDeletion` 0;
  `entries` not a list.
- One entry unreadable, dropped and the others kept: each property missing or of the wrong kind in
  turn, among them `stageCount` -1, `kind` `"box"`, `deletedAt` `"not a date"`, `deletion` at or
  above `nextDeletion`, `id` at or above `nextEntryId`; two entries with one `id` (the later
  dropped).
- Entries out of order come back in order; more than the limit keeps the newest.

**Immutability**: no function changes the trash, entries, plan or change it's given.

**The REPL** (`scripts/repl.js`): a `trash` topic, with an example that deletes two stages of the
test plan, shows the trash, pastes one entry into a new plan, and shows the trash again.
