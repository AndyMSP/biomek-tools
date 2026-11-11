# trash — specification

> **Draft (2026-11-11).** Written for v0.2.0 (roadmap, item 32), from the preview Andy shaped on
> 2026-11-11, where the trash was tried and three bugs in putting things back were found and fixed
> (below, "Why the place rules are as they are"). Written in the hands-off workflow (CLAUDE.md,
> "Workflows"), so the choices made for Andy are listed in its pull request. Still to review: every
> message. It becomes Final once built and tested by Andy.

## 1. Purpose
`trash.js` keeps what's deleted from a plan, so it can be **put back**: the transfer designer's
**trash** (`docs/glossary.md`; ADR 0024). It works out what each deleted thing was and where it
sat, where putting it back puts it, and how the trash changes with each delete, put back, undo and
redo. It holds no page code (CLAUDE.md, "Separate logic from the UI"); how the trash looks and is
used is the page's (`transfer-designer-page.md`, section 7, "The trash").

It builds on `transfer-designer` and doesn't repeat it: deleting is `deleteItems`, a deleted thing
is kept as **copied items** (`copyOf`), and putting it back is a paste (`pasteItems`), so the
container rule and every check of pasting apply as they do for Ctrl+V (`transfer-designer.md`,
"Moving and copying" and "Deleting").

## 2. Scope
Version 1 makes the trash's entries for deleted things, adds them to a trash of at most
`TRASH_LIMIT` entries, works out where an entry goes back, puts it back (at that place or at one
the caller gives), empties the trash, undoes and redoes its changes, and turns a trash into text
and back for keeping in the browser.

Not in version 1:
- **The trash in plan files.** It's kept by the browser, not the plan (ADR 0024), so it isn't in
  plan files and isn't tied to a plan.
- **Putting back an entry that came from another plan by itself.** It can be put at a place the
  caller gives (a drag), never at a place the trash finds (below, "Neighbors").
- **Several entries put back as one.** Each entry goes back on its own (Andy, 2026-11-11: "one
  trash entry per thing deleted"); Undo still undoes a whole delete at once.

## 3. Data model

### The trash
A trash is a plain object that's **never changed after it's made**: every function returns a new
one, as plans are (`transfer-designer.md`, "The plan").

```js
{
  entries:       [entry, …],          // the order below
  putBackIds:    { "3": "17", … },    // a deleted stage's ID → the ID it was put back as
  nextEntryId:   5,                   // the next entry's ID
  nextDeletion:  3,                   // the next delete's number
}
```

`emptyTrash()` gives `{ entries: [], putBackIds: {}, nextEntryId: 1, nextDeletion: 1 }`.

**Order.** `entries` is newest delete first; within one delete, in **column order** (the order
the deleted things had in the column), so a delete of S02 and S05 lists S02 above S05, above
anything deleted earlier. (Precisely: by `deletion`, largest first, then by `id`, smallest first.)
Every function keeps this order, including when undo puts entries back (below).

**At most `TRASH_LIMIT` entries** (`config/trash.js`, below). Adding more drops the oldest
(the last in the order); what's dropped can't be put back, but undoing the delete that dropped it
brings it back (below, "Undo and redo").

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
  stages:        ["3"],             // its stages' IDs, in stage order ([] for an unrun randomization)
  before:        ["1", "2"],        // the IDs of the stages above it, in stage order
  after:         ["4", "5", …],     // the IDs of the stages below it, in stage order
  group:         ["3", "4", "5", "6"],  // a stage of an ordinary tip group: that group's stages, in order; else null
  names:         { "1": "S01 Media row A", … },   // every stage's name in the plan when it was deleted
}
```

- `before` and `after` leave out its own stages; for an unrun randomization, which has none, they
  split the stage order at its `beforeId` (all of them in `before` for `null`).
- `group` is the stage's tip group as `columnBoxes` gives it, itself included; `null` for a stage of
  a randomization or transfer table (which can only be deleted with its owner,
  `transfer-designer.md`, "Deleting") and for every other kind.
- `copied` is the copied items for that one item, as `copyOf` writes them today. Copied items
  don't hold a randomization's name (`transfer-designer.md`, "Moving and copying"), so `name` keeps
  it, to give it back on putting back (below).

**`trashEntriesFor(plan, items, deletedAt)`** makes them, from the plan **before** the delete:
one entry per item of `items`, taken as `deleteItems` takes them (column order, a stage of a listed
container left out, repeats once), so a caller can pass `deleteItems`' `deleted` or the items it
asked to delete. Entries made here have no `id` or `deletion` yet: `addToTrash` gives them. It
checks the items as `deleteItems` does (its messages), and `deletedAt` (text). For a caller
removing one thing by another edit (`removeStage`, `removeRandomization`, `removeTransferTable`),
it's called with that one item.

### Adding
**`addToTrash(trash, entries)`** gives `{ trash, change }`: the trash with `entries` added as one
delete (all with the trash's `nextDeletion`, then one more; each a new `id`, from `nextEntryId`,
in the order given), in the order above, dropping the oldest beyond `TRASH_LIMIT`; and the
**change** `{ added, removed }`: the entries added, with their IDs, and those dropped. With no
entries, the trash and an empty change (`{ added: [], removed: [] }`).

### Putting back
**`putBackPlace(plan, trash, id)`** gives where entry `id` goes back in `plan`, as a place
(`transfer-designer.md`, "Moving and copying": `between` or `inTipGroup`), or `null` when it has
no place in this plan. **`putBack(plan, trash, id, place)`** puts it back:
`{ plan, placed, trash, change }`.

**Neighbors.** A place is found next to a **neighbor**: a stage that was beside the entry when it
was deleted. A neighbor counts only if it's in `plan` **as the same stage**: a stage ID of the
entry's (`before`, `after` or `group`) counts if
- `plan` has a stage with that ID **and the name it had when the entry was deleted**
  (`names`); or else
- it was put back since (`putBackIds` holds it) and the ID it was put back as counts, by the same
  test, still against the name in `names` (following `putBackIds` again, and so on; an ID seen
  twice ends the search, so a loop can't hang it).

The name is checked (Andy, 2026-11-11, found in the preview: a plan opened after a delete has
stages with the same IDs, 1, 2, 3 …, and putting back placed things next to unrelated stages).
A renamed neighbor doesn't count, nor does a stage of another plan, or one given a deleted
stage's ID again after an undo (`plan-history.md`, "Recording clears redo"), unless it has the
same name; then the place found may be wrong, and the user can move it. (Claude's choice: plans
have no identity of their own to check, and IDs plus names are what there is.)

**The place**, tried in this order, the first neighbor found deciding:
1. **A stage of an ordinary tip group** (`group` isn't `null`) goes back **into its tip group**:
   just below the nearest of its groupmates above it (in `group`, going up) that counts; or else
   just above the nearest of its groupmates below it (going down). "Just below" a stage of an
   ordinary tip group is `inTipGroup` at its position plus one, "just above" at its position. So
   the first stage of a group goes back to the top of its group, taking the group's tips (the
   container rule: the group's tip change moves onto it), as it was. (If that groupmate is now a
   stage of a randomization or transfer table, which `pasteItems` can't put a stage inside: just
   below, or above, that box, `between`.)
2. **Otherwise** (a stage whose groupmates are all gone, a tip group, a randomization, a transfer
   table), it goes **between tip groups**: just below the box of the nearest stage above it that
   counts (`before`, going up), `between` that box's index plus one; or else just above the box of
   the nearest stage below it (`after`, going down), `between` that box's index. A stage going back
   between tip groups keeps its tips, as a tip group of its own (the container rule).
3. **No neighbor counts:** `null`.

**Why the place rules are as they are** (the preview's bugs, 2026-11-11, so the tests cover each):
- *By groupmate, before neighbor:* S03, its group's first stage, went back below S02, the stage
  above it, at the bottom of the group above. Going back next to its groupmates keeps it in its
  own group.
- *Following put-back IDs:* deleted together and put back one at a time, S03 and S04 lost each
  other, since S03 came back as a new stage (a paste gives new IDs). `putBackIds` lets S04 find it.
- *Names:* above.

**`putBack(plan, trash, id, place)`**, with `place` `undefined` for `putBackPlace`'s (a caller
dragging an entry gives the place it was dropped on):
- refuses an `id` that isn't in the trash, and `place` `undefined` when `putBackPlace` is `null`;
- pastes the entry's `copied` at the place (`pasteItems`, whose refusals pass through unchanged);
- **gives a randomization its name back**: a pasted randomization gets a new name
  (`transfer-designer.md`, "Moving and copying"), so if the entry has a `name` and no other
  randomization of the new plan has it, the pasted one is renamed to it (`renameRandomization`),
  in the same edit (Claude's choice, 2026-11-11: its well map is named after it, so a put-back
  randomization should be the same one); otherwise it keeps the pasted name;
- notes, in `putBackIds`, each of the entry's `stages` → the ID of the pasted stage in the same
  place (the pasted items' stages in column order, matching `stages` one for one);
- takes the entry out of the trash.

It gives `{ plan, placed, trash, change }`: the plan with it put back, as one edit; `placed`,
`pasteItems`' (the randomization's item after a rename); the new trash; and the change
`{ added: [], removed: [the entry] }`.

### Emptying
**`clearTrash(trash)`** gives `{ trash, change }`: a trash with no entries and no `putBackIds`
(keeping `nextEntryId` and `nextDeletion`, so IDs are never given twice), and the change
`{ added: [], removed: [every entry] }`. A caller emptying the trash at the user's request needn't
keep the change; one emptying it as part of an edit (the page's Reset) keeps it, so undo brings the
entries back.

### Undo and redo
A caller that keeps undo and redo of plans (`plan-history.md`) keeps, with each recorded edit
that changed the trash, that edit's **change**, and applies it again as the edit is undone or
redone:
- **`undoTrashChange(trash, change)`**: the trash without the entries in `change.added` (by `id`;
  ones no longer there are skipped), and with the entries in `change.removed` that aren't in it,
  each in its place in the order above, dropping the oldest beyond `TRASH_LIMIT`.
- **`redoTrashChange(trash, change)`**: the reverse: without `change.removed`, with `change.added`.

So undoing a delete takes its entries out of the trash, undoing a put back puts the entry back in
the trash, and undoing Reset brings back what Reset emptied, whatever else happened to the trash
in between (an entry put back or emptied in the meantime simply isn't there to take out).
`putBackIds` isn't undone: an ID it holds is only followed while the stage it names counts (above),
so an old one does no harm.

### Keeping the trash as text
A caller keeps the trash in the browser as text (the page: local storage).
**`trashToText(trash)`** gives JSON:

```js
{ "format": "biomek-tools trash", "version": 1, "entries": [ … ], "putBackIds": { … },
  "nextEntryId": 5, "nextDeletion": 3 }
```

**`trashFromText(text)`** reads it back, and **never throws**: anything it can't read gives
`emptyTrash()` (Claude's choice: the trash is a convenience, and a damaged one shouldn't stop the
page opening; the page says nothing). It can't be read when: the text isn't JSON; isn't an object
with exactly those six properties; `format` isn't `"biomek-tools trash"`; `version` isn't `1` (a
newer one included); `nextEntryId` or `nextDeletion` isn't a whole number of at least 1;
`putBackIds` isn't an object whose values are all text; `entries` isn't a list; or an entry isn't
an object with exactly the properties above, each of its kind (`id` and `deletion` whole numbers of
at least 1, below `nextEntryId` and `nextDeletion`; `id` unique; `kind` one of the four; `name`
text or `null`; `stageCount` and `transferCount` whole numbers of at least 0; `deletedAt` text that
`Date` reads as a date; `copied` an object; `stages`, `before` and `after` lists of text; `group`
`null` or a list of text; `names` an object whose values are text). `copied` isn't checked here:
`pasteItems` checks it when it's put back, and refuses it with its message. Entries out of order
are put in order; more than `TRASH_LIMIT` keeps the newest `TRASH_LIMIT`.

### Configuration
`config/trash.js` (data only, ADR 0009):
- **`TRASH_LIMIT`**: the most entries the trash keeps, `20` (Andy, 2026-11-11, from the preview).
  A whole number of at least 1; this module's tests check it.

## 4. Interface
None of these changes what it's given.

| Function | Returns |
|---|---|
| `emptyTrash()` | a trash with no entries (section 3). |
| `trashEntriesFor(plan, items, deletedAt)` | the entries for deleting `items` from `plan`, one per item in column order, without `id` or `deletion`. Throws as section 5 says. |
| `addToTrash(trash, entries)` | `{ trash, change }`: the trash with `entries` added as one delete, and the change. |
| `putBackPlace(plan, trash, id)` | the place entry `id` goes back to in `plan`, or `null` (section 3, "Putting back"). Throws if there's no entry `id`. |
| `putBack(plan, trash, id, place)` | `{ plan, placed, trash, change }`: entry `id` put back at `place`, or at `putBackPlace`'s with `place` `undefined`, as one edit. Throws as section 5 says. |
| `clearTrash(trash)` | `{ trash, change }`: the trash emptied, and the change. |
| `undoTrashChange(trash, change)` | the trash with `change` undone. |
| `redoTrashChange(trash, change)` | the trash with `change` made again. |
| `trashToText(trash)` | the trash as JSON text. |
| `trashFromText(text)` | the trash `text` holds, or `emptyTrash()` if it can't be read. Never throws. |
| `TRASH_FORMAT`, `TRASH_VERSION` | (constants) `"biomek-tools trash"` and `1`. |
| `TRASH_LIMIT` | (a constant) re-exported from `config/trash.js`. |

## 5. Errors
| Problem | Message |
|---|---|
| `trashEntriesFor`: `items` or an item refused | `deleteItems`' messages, unchanged (`transfer-designer.md`, section 5) |
| `trashEntriesFor`: `deletedAt` isn't text | `When it was deleted must be text, like "2026-11-11T05:28:41.000Z", but got 5.` |
| `putBackPlace`, `putBack`: no entry with `id` | `There's no entry 9 in the trash.` |
| `putBack`: no place given, and none found | `Its place isn't in this plan: drag it where it should go.` |
| `putBack`: `pasteItems` refuses | its message, unchanged (`Can't paste: …`) |

Order of checks: `trashEntriesFor`: the items (as `deleteItems`), then `deletedAt`. `putBack`: the
entry, then the place (a given place is checked by `pasteItems`), then the paste.

## 6. Test cases
Each becomes at least one unit test in `trash.test.js`, inside `describe("trash", …)`. Each row of
section 5 has at least one test. Andy asked (2026-11-11) for these to be **very thorough**: the
preview showed putting back to be easy to get wrong.

**The test plan with a bit of everything**, a fixture shared with `transfer-designer.test.js`:
`tests/fixtures/delete-test-plan.js`, exporting
- `deleteTestPlan()`: a plan built with the transfer designer's own edits (so it's valid by
  construction), with components Media, Drug A, Drug B and Dye in the reservoir and the deep-well
  plate, and stages named so each keeps its name when stages are renumbered, in this column order:
  [S01 Media row A, S02 Media row B] on the `START` tips; [S03 Drug A, S04 Drug B, S05 Dye row B,
  S06 Mix row A (a mix step)] on new tips; [S07 Media row C] alone; [S08 Dye row C, S09 Media row
  H]; a **run randomization** (Drug A and Drug B, 4 replicates each, Media the filler, rows D and E;
  three stages, each on tips of its own); [S10 Media row G, S11 Dye row G]; and a **transfer
  table** (Media and Dye into wells labeled `Control` and `Dyed` in row F; two stages). Every stage
  has transfers. Tip types and probes differ between groups where `TIP_TYPES` and the probes allow
  (the first group on `TIP_TYPES[0]` on 4 probes, the next on `TIP_TYPES[1]` on 2 probes when there
  is one, and so on, worked out from `config/`, never written out), so a test can tell the groups'
  tips apart.
- `stageIdOf(plan, name)`: the ID of the stage called `name` (`S03 Drug A`, or just `S03`, its
  first word).
- `planOutline(plan)`: the plan **up to its IDs**, for comparing a plan after putting back with the
  one before the delete: the column's boxes in order (`columnBoxes`), each tip group as its tip
  type, probes and stages, each stage as its name, kind, settings and transfers (in operation
  order, as source, destination and volume); each randomization as its name, sources, fill, seed,
  volume and tip groups; each transfer table as its table, sources and tip groups; and the
  components, starting contents, labware labels, well labels and experiment name as they are.
  Stage, randomization and transfer table IDs, and `beforeId`, aren't in it.
(The plan the preview used, `Delete-test plan.json`, was made the same way.)

**Configuration**
- `TRASH_LIMIT` is a whole number of at least 1. The tests below take the limit from it (CLAUDE.md,
  "Tests follow `config/`"): "the limit" is `TRASH_LIMIT`.

**Entries**
- `trashEntriesFor` of each kind, from the test plan: a stage (S04: `kind`, `name`, `stageCount`
  1, `transferCount` its transfers, `stages` [its ID], `before` and `after` the stage order around
  it, `group` S03's group's four IDs, `names` every stage's name, `copied` equal to `copyOf(plan,
  [item])`); a mix step (S06, its mixed wells counted as transfers); a tip group (S03's: `group`
  `null`, four stages); a randomization (its name, three stages, `group` `null`); an unrun
  randomization (no stages; `before` and `after` split at its `beforeId`, or all `before` for
  `null`); a transfer table (`name` `null`, two stages).
- Several items: one entry each, in column order, given out of order; a stage of a listed tip group
  left out; an item listed twice, once.
- `deletedAt` kept as given; its error; the item errors as `deleteItems`'.

**Adding and the limit**
- `addToTrash` numbers entries from `nextEntryId`, gives each delete one `deletion`, and orders
  newest delete first, column order within one (S02 and S05 deleted together: S02 then S05, above
  an earlier delete's entry).
- Adding past the limit drops the oldest; the change's `removed` holds them; one delete of more
  things than the limit keeps the first `TRASH_LIMIT` in the order (its last ones dropped).
- Adding no entries: the same trash, an empty change.

**Putting back: round trips** (the heart of it). For each case below, from the test plan: delete
the things with `deleteItems` in **one** delete, add `trashEntriesFor` of `deleted` to an empty
trash, then put the entries back with `putBack` and no place, **one at a time, in every order**
(every permutation: 2 for two things, 6 for three), and check after the last that
`planOutline` equals the test plan's, and that the trash is empty. Each put back is checked to
give a place (`putBackPlace` not `null`) before it's done.
1. S02 and S03 (either side of a group boundary).
2. S03 and S04 (a group's first stage and the next).
3. S03, S04 and S05 (a group's first three, leaving S06 alone in it).
4. S07, S08 and S09 (a lone group, then the whole next group).
5. S01 (the plan's first stage) and S01 with S02 (the whole first group, as stages).
6. S11 (the last ordinary stage) and S10 with S11.
7. S09 and S10 (either side of the randomization).
8. S03's tip group, and S03's tip group with S02 and S07 (stages around it).
9. The first tip group, as a tip group.
10. S06 (a mix step) and S05 with S06.
11. The randomization; the randomization with S09 and S10; and an unrun randomization added
    before S07.
12. The transfer table; the transfer table with S11.
13. S01, S03's tip group and the randomization (mixed kinds, spread out).
14. S06, S11 and the transfer table.

**Putting back: the same, deleted one at a time.** Cases 1, 2, 4, 7 and 13 again, but each thing
deleted in a delete of its own (in column order, and in reverse), then put back in every order:
the same outline.

**Putting back: after other edits** (each checking where it lands, not the whole outline):
- Its neighbor above moved to another tip group: S04 deleted, S03 moved into S01's group: S04 goes
  back just below S03, in S01's group.
- Its groupmate above renamed: S04 deleted, S03 renamed: S04 goes back just above S05 (the
  groupmate below).
- Every groupmate gone: S04 deleted, then S03, S05 and S06 deleted in another delete (not put
  back): S04 goes back between tip groups, just below S02's group, on its own tips.
- Its neighbors deleted and put back first (a new ID each): S04 deleted, S03 deleted, S03 put back,
  then S04: just below the new S03 (by `putBackIds`).
- Put back twice over: S03 deleted and put back, deleted again and put back again, then S04
  (deleted with the first S03) goes back below it (following two IDs).
- New stages added beside its neighbor after the delete: S04 deleted, a stage added just below S03:
  S04 goes back just below S03, above the new stage (Andy accepted this, 2026-11-11: dragging is
  there for an exact spot).
- A neighbor's ID reused by a new stage with another name (an undo, then a new stage): that stage
  doesn't count.
- A tip group deleted, then the stages either side of it moved apart: it goes back just below the
  box of the stage that was above it.
- A randomization put back takes its name again; if another randomization has taken the name since,
  it keeps the pasted one; its well map is named after it again (`well-maps.md`).

**Another plan**
- An entry deleted from the test plan, `putBackPlace` on `emptyPlan()`: `null`; `putBack` with no
  place refuses with its message; with a place, it pastes there.
- A plan with **the same IDs but other names** (the test plan with every stage renamed): `null`.
- A plan with **the same names but other IDs** (the test plan saved and opened after stages were
  added at the top, so IDs shift; or stages copied and pasted into a new plan): `null` unless an
  ID and name both match.

**`putBack` itself**
- A given place is used instead of the found one (pasted at the top, `between` 0).
- `placed` is `pasteItems`'; `putBackIds` gains one ID per stage of the entry; the entry is gone
  from the trash; the change is `{ added: [], removed: [entry] }`.
- Errors: no such entry; no place; a damaged `copied` (an entry read from text with a wrong
  `copied`): `pasteItems`' message, the trash unchanged.

**Emptying, undo and redo**
- `clearTrash`: no entries, no `putBackIds`, the counters kept; the change removes every entry.
- `undoTrashChange` of a delete's change takes its entries out; of a put back's puts the entry
  back in its place in the order; of a clear brings every entry back in order; `redoTrashChange`
  of each does it again. Undo after the entries were put back or emptied meanwhile: nothing to take
  out, no error. Re-adding past the limit drops the oldest.
- A sequence like the page's: delete S03, delete S07, put back S03, undo (S03 in the trash
  again), undo (S07's entry gone), redo, redo: the trash as after each step, compared in full.

**Text**
- `trashToText` then `trashFromText` gives an equal trash (entries, order, `putBackIds`,
  counters), for an empty trash and one with an entry of each kind.
- Unreadable, each giving `emptyTrash()` without throwing: not JSON; `null`; a list; a missing or
  extra property; another `format`; version 2; `nextEntryId` 0 or 1.5; an entry with each property
  missing or of the wrong kind in turn; two entries with one `id`; an `id` at or above
  `nextEntryId`; `deletedAt` that isn't a date; `putBackIds` with a number value.
- Entries out of order come back in order; more than the limit keeps the newest.

**Immutability**: no function changes the trash, entries, plan or change it's given.

**The REPL** (`scripts/repl.js`): a `trash` topic, with an example that deletes two stages of the
test plan, adds them to the trash, puts one back, and shows the trash after each step.
