# plan-history — specification

> **Draft (2026-10-26).** Written for v0.2.0, from the transfer designer preview, where undo and redo
> were tried (2026-10-24 to 2026-10-26). It becomes Final once its code is built and Andy has tested
> the page.

## 1. Purpose
`plan-history.js` gives the transfer designer undo and redo. It keeps the versions of what the tool
is editing, one **state** per version: the earlier ones (for undo), the current one, and the later
ones (for redo, after an undo). "State" is the usual term for undo and redo; "step" would clash with
Biomek's own meaning (a step of a method; `docs/glossary.md`).

It doesn't know what a state holds. The transfer designer's states are its plan (`docs/glossary.md`)
together with the stage that's open, so that undo also goes back to the stage the edit was made in;
another tool could keep other states. A state is kept as it is given, so it must not be changed
afterwards: the plan's parts are immutable (the operation list and stage list are; ADR 0008), and
the tool replaces a state rather than changing it.

The history lasts only while the tool is open: a plan file holds only the plan (ADR 0010), so
saving, opening or reloading never keeps or brings back undo and redo.

## 2. Scope
Version 1 records a new state, replaces the current state, undoes and redoes, says whether undo or
redo is possible, and keeps at most a set number of earlier states.

## 3. Data model
- A history is an instance of the `PlanHistory` class, created with `new PlanHistory(state)`, where
  `state` is the first current state. A new history has nothing to undo or redo.
- A history is **immutable**, like the operation list and stage list: recording, replacing, undoing
  and redoing return a new history and leave the original unchanged, so code must keep the result.
- It holds, privately: the earlier states, oldest first; the current state; and the later states, the
  next one first.

**Recording clears redo.** A new state after an undo throws away the later states, as editors usually
do. This matters here: after an undo, the stage list can give a new stage an ID that a later,
undone state also used (`stage-list.md`, "IDs"), so a redo could otherwise bring back a second stage
with the same ID.

**Several changes, one state.** Each recorded state is one undo. A tool that wants several changes
undone together makes them in one state and records that (the transfer designer does, e.g. adding
many transfers at once).

**At most `UNDO_STATES_KEPT` earlier states are kept** (Andy, 2026-10-26), a number in
`config/undo.js`: 1,000 for now. Recording one more drops the oldest, so undo can't go back further
than that. Later states (for redo) are never more than the earlier ones were, so they need no limit
of their own.

What the limit costs depends on states **sharing** what they have in common (structural sharing):
the plan's parts are immutable, so a new state can point to the same transfers as the state before
it, and stores only what changed plus its own list of references, about 8 bytes per transfer. The
operation list shares this way when transfers are added, inserted, removed or replaced
(`operation-list.md`). Measured with the preview's code (2026-10-26), for a plan of about 1,000
transfers:
- with sharing: about 13 kB per state, so about 13 MB at the limit;
- without it (the preview rebuilt the whole list to change one volume): about 156 kB per state, so
  about 156 MB at the limit, enough to slow an older lab PC.

So every edit the tool makes must share unchanged transfers rather than rebuild the list. The tests check
`config/undo.js` (ADR 0009): `UNDO_STATES_KEPT` is a whole number of at least 1.

**Replacing isn't an edit.** `replacePresent` swaps the current state without adding a state to undo back to, and
without touching redo. The transfer designer uses it for changes that aren't edits of the plan, such
as which stage is open: undo then skips straight to the plan's last edit.

## 4. Interface
The module exports one class, `PlanHistory`.

| Member | Visibility | Description |
|---|---|---|
| `constructor(state)` | public | Creates a history whose current state is `state`, with nothing to undo or redo. `state` may be any value. |
| `present` | public (getter) | The current state. |
| `record(state)` | public | Returns a **new** history in which `state` is current, the old current state can be undone back to, and there is nothing to redo. If that makes more than `UNDO_STATES_KEPT` earlier states, the oldest is dropped. |
| `replacePresent(state)` | public | Returns a **new** history in which `state` is current, with the same states to undo and redo. |
| `canUndo()` | public | `true` if there's an earlier state to go back to. |
| `canRedo()` | public | `true` if there's a later state to go forward to. |
| `undo()` | public | Returns a **new** history in which the latest earlier state is current, and the old current state can be redone. With nothing to undo, returns this history unchanged. |
| `redo()` | public | Returns a **new** history in which the next later state is current, and the old current state can be undone back to. With nothing to redo, returns this history unchanged. |
| `#past` | private | The earlier states, oldest first. |
| `#present` | private | The current state. |
| `#future` | private | The later states, the next one first. |

`undo` and `redo` with nothing to do return the history unchanged rather than throwing, because
asking is harmless: a tool can call them straight from a key press.

Example:
```js
let history = new PlanHistory("a");
history = history.record("b");
history = history.record("c");
history = history.undo();          // present "b"; can redo
history.canRedo();                 // true
history = history.record("d");     // present "d"; "c" is gone
history.canRedo();                 // false
history = history.replacePresent("d, viewed");
history = history.undo();          // present "b": replacing added nothing to undo
```

## 5. Errors
None of the members takes input that can be wrong: a state may be any value, and undo and redo with
nothing to do change nothing. So nothing throws.

## 6. Test cases
Each becomes at least one unit test in `plan-history.test.js`, inside `describe("plan-history", …)`.

- A new history's `present` is the state it was made with; `canUndo()` and `canRedo()` are `false`.
- `record` makes the new state current; `canUndo()` is `true`; `undo()` gives back the old state.
- Several records, then several undos, go back through the states newest first; redos go forward
  again in order.
- After an undo, `record` clears redo: `canRedo()` is `false`, and `redo()` changes nothing.
- `replacePresent` makes the state current without adding a state to undo back to: after it, `undo()` goes to the
  state before the replaced one; with states to redo, `canRedo()` stays `true` and `redo()` still works.
- `undo()` with nothing to undo, and `redo()` with nothing to redo, return a history whose `present`
  is unchanged, and don't throw.
- Immutability: after `record`, `replacePresent`, `undo` and `redo`, the original history's `present`,
  `canUndo()` and `canRedo()` are unchanged.
- With `UNDO_STATES_KEPT` + 1 records after the first state, `UNDO_STATES_KEPT` undos are possible
  and the next isn't; the state undo stops at is the second state, so the first was dropped. (The
  test reads the number from `config/undo.js`.)
- Redo still works after the limit has dropped old states.
- `config/undo.js`: `UNDO_STATES_KEPT` is a whole number of at least 1.
- States are kept as given: an object passed to `record` is the same object `present` returns later.
