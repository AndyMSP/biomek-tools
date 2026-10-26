# plan-history — specification

> **Draft (2026-10-26).** Written for v0.2.0, from the transfer designer preview, where undo and redo
> were tried (2026-10-24 to 2026-10-26). Still to review: the wording.

## 1. Purpose
`plan-history.js` gives the transfer designer undo and redo. It keeps the versions of what the tool
is editing, one **step** per version: the earlier ones (for undo), the current one, and the later
ones (for redo, after an undo).

It doesn't know what a step holds. The transfer designer's steps are its plan (`docs/glossary.md`)
together with the stage that's open, so that undo also goes back to the stage the edit was made in;
another tool could keep other steps. A step is kept as it is given, so it must not be changed
afterwards: the plan's parts are immutable (the operation list and stage list are; ADR 0008), and
the tool replaces a step rather than changing it.

## 2. Scope
Version 1 records a new step, replaces the current step, undoes and redoes, and says whether undo or
redo is possible.

Not in version 1:
- **A limit** on how many steps are kept. A plan is small, and a session's edits number in the
  hundreds at most.
- **Grouping** several steps into one undo step. A tool that wants several changes undone together
  makes them as one step (the transfer designer does, e.g. adding many transfers at once).
- **Keeping the history** when a plan is saved or the page is reloaded. A plan file holds only the
  plan (ADR 0010).

## 3. Data model
- A history is an instance of the `PlanHistory` class, created with `new PlanHistory(step)`, where
  `step` is the first current step. A new history has nothing to undo or redo.
- A history is **immutable**, like the operation list and stage list: recording, replacing, undoing
  and redoing return a new history and leave the original unchanged, so code must keep the result.
- It holds, privately: the earlier steps, oldest first; the current step; and the later steps, the
  next one first.

**Recording clears redo.** A new step after an undo throws away the later steps, as editors usually
do. This matters here: after an undo, the stage list can give a new stage an ID that a later,
undone step also used (`stage-list.md`, "IDs"), so a redo could otherwise bring back a second stage
with the same ID.

**Replacing isn't an edit.** `replacePresent` swaps the current step without making an undo step and
without touching redo. The transfer designer uses it for changes that aren't edits of the plan, such
as which stage is open: undo then skips straight to the plan's last edit.

## 4. Interface
The module exports one class, `PlanHistory`.

| Member | Visibility | Description |
|---|---|---|
| `constructor(step)` | public | Creates a history whose current step is `step`, with nothing to undo or redo. `step` may be any value. |
| `present` | public (getter) | The current step. |
| `record(step)` | public | Returns a **new** history in which `step` is current, the old current step can be undone back to, and there is nothing to redo. |
| `replacePresent(step)` | public | Returns a **new** history in which `step` is current, with the same steps to undo and redo. |
| `canUndo()` | public | `true` if there's an earlier step to go back to. |
| `canRedo()` | public | `true` if there's a later step to go forward to. |
| `undo()` | public | Returns a **new** history in which the latest earlier step is current, and the old current step can be redone. With nothing to undo, returns this history unchanged. |
| `redo()` | public | Returns a **new** history in which the next later step is current, and the old current step can be undone back to. With nothing to redo, returns this history unchanged. |
| `#past` | private | The earlier steps, oldest first. |
| `#present` | private | The current step. |
| `#future` | private | The later steps, the next one first. |

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
history = history.undo();          // present "b": replacing made no undo step
```

## 5. Errors
None of the members takes input that can be wrong: a step may be any value, and undo and redo with
nothing to do change nothing. So nothing throws.

## 6. Test cases
Each becomes at least one unit test in `plan-history.test.js`, inside `describe("plan-history", …)`.

- A new history's `present` is the step it was made with; `canUndo()` and `canRedo()` are `false`.
- `record` makes the new step current; `canUndo()` is `true`; `undo()` gives back the old step.
- Several records, then several undos, go back through the steps newest first; redos go forward
  again in order.
- After an undo, `record` clears redo: `canRedo()` is `false`, and `redo()` changes nothing.
- `replacePresent` makes the step current without adding an undo step: after it, `undo()` goes to the
  step before the replaced one; with steps to redo, `canRedo()` stays `true` and `redo()` still works.
- `undo()` with nothing to undo, and `redo()` with nothing to redo, return a history whose `present`
  is unchanged, and don't throw.
- Immutability: after `record`, `replacePresent`, `undo` and `redo`, the original history's `present`,
  `canUndo()` and `canRedo()` are unchanged.
- Steps are kept as given: an object passed to `record` is the same object `present` returns later.
