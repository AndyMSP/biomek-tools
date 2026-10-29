# tip-groups — specification

> **Final (2026-10-29).** Written for v0.2.0, moving the transfer designer's `tipGroups` into a
> shared module (Andy, 2026-10-28); built in #85, and used by the file writer since #86.

## 1. Purpose
`tip-groups.js` works out a plan's **tip groups** (`docs/glossary.md`, "Tip group"): the stages
that run on the same tips, from one tip change to the next, and which probes get tips for each
group, by looking ahead (ADR 0007, "Tip changes").

It's shared because more than one module needs exactly the same answer: the transfer designer, to
show tip groups on the page, and the file writer, to write a tip-change row before each group
(`file-writer.md`). Keeping the logic in one function means the two can't disagree (CLAUDE.md,
"Don't repeat yourself").

It moves `tipGroups` and `START` out of `transfer-designer.js` unchanged: what they return, and the
transfer designer's behavior, stay the same.

## 2. Scope
Version 1 works out tip groups from a plan, as the transfer designer holds it.

Not in version 1:
- **Changing tip changes.** Adding, moving and removing them stays in the transfer designer
  (`transfer-designer.md`, "Tip changes and tip groups").
- **Checking the plan.** The plan is made only through the transfer designer's checks, so it isn't
  checked again here.

## 3. Data model
From a plan (`transfer-designer.md`, section 3), the module reads only:
- `stageOrder`: the stage IDs in stage order;
- `tipChanges`: the tip changes, each `{ tipType }`, keyed by `START` or by the stage ID they come
  just before;
- `stageList`: each stage's settings, for its `probes`.

**`START`** is the text `"start"`, the key of the tip change before the first stage. Stage IDs are
numbers written as text, so no stage is ever called `"start"`.

**A tip group** is `{ key, tipType, stages, probes }`:
- `key`: the key of the tip change that starts it, `START` or a stage ID;
- `tipType`: that tip change's tip type;
- `stages`: the group's stage IDs, in stage order;
- `probes`: every probe any of the group's stages uses, each once, smallest first: the probes that
  get tips.

The first stage in the stage order always starts the `START` group. Any later stage with a tip
change keyed by its ID starts a new group. Every other stage joins the group before it. Stages are
grouped whether or not they have transfers; whether a group is written to a file is the file
writer's decision.

## 4. Interface
The module exports one constant and one function. The function changes nothing.

| Export | Takes | Returns |
|---|---|---|
| `START` | (a constant) | `"start"` |
| `tipGroups(plan)` | a plan | its tip groups, in stage order, as a new list each time, e.g. `[{ key: "start", tipType: "BC230", stages: ["1", "2"], probes: [1, 2, 3, 4] }, { key: "3", tipType: "BC1070", stages: ["3"], probes: [1] }]` |

`transfer-designer.js` imports both and **re-exports** them (passes them on under the same names),
so modules that import them from the transfer designer, such as its page and `plan-file.js`, don't
change (`transfer-designer.md`, section 4).

## 5. Errors
None of its own. `tipGroups` is given plans the transfer designer made, which always have a
`START` tip change and stage IDs that are in the stage list.

## 6. Test cases
Each becomes at least one unit test in `tip-groups.test.js`, inside `describe("tip-groups", …)`.
The tests build plans directly, from a `StageList` (`stage-list.md`) and plain `stageOrder` and
`tipChanges`, so this shared module's tests don't depend on a tool.

- `START` is `"start"`.
- A plan with one stage and only the `START` tip change gives one group, keyed `START`, with that
  stage and its probes.
- A plan with a tip change before its third stage gives two groups: the first two stages, then the
  rest, each with its tip change's key and tip type.
- **Probes:** a group whose stages use `[1, 2]` and `[1, 2, 3, 4]` gives `[1, 2, 3, 4]`; one whose
  stages use `[1]` and `[3, 5]` gives `[1, 3, 5]`; and a stage listing `[8, 1]` gives `[1, 8]`
  (smallest first).
- **Stage order, not stage IDs:** with a stage order of `["1", "3", "2"]` and a tip change keyed
  `"2"`, the groups are `["1", "3"]` and `["2"]`.
- A stage without transfers is still in its group.
- Calling `tipGroups` twice gives equal results, and changing the list it returned doesn't change
  the next one.

The transfer designer's own tests that use `tipGroups` keep working through the re-export; its
test of probes in tip groups (`transfer-designer.md`, section 6) moves here.
