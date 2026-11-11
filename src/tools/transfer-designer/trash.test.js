// Tests for trash.js, from trash.md, section 6. They start from the test plan with a bit of
// everything (tests/fixtures/delete-test-plan.js), and take the trash's limit from config/trash.js:
// a test needing more entries kept than the limit allows is skipped, its name saying so, so
// changing TRASH_LIMIT never breaks a test (CLAUDE.md, "Tests follow config/").

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { TRASH_LIMIT as CONFIGURED_TRASH_LIMIT } from "../../../config/trash.js";
import { DEFAULT_TRANSFER_VOLUME } from "../../../config/default-volumes.js";
import { deadVolumeOf } from "../../shared/deck/deck.js";
import {
  emptyTrash,
  addDeleted,
  pasteEntry,
  clearTrash,
  undoTrashChange,
  redoTrashChange,
  trashToText,
  trashFromText,
  trashTextProblem,
  TRASH_FORMAT,
  TRASH_VERSION,
  TRASH_LIMIT,
} from "./trash.js";
import {
  emptyPlan,
  addStage,
  addStageWithNewTips,
  addRandomization,
  renameRandomization,
  randomizationAt,
  deleteItems,
  copyOf,
  pasteItems,
  tipGroups,
  stagesWithContentsProblem,
  stagesWithMixProblem,
} from "./transfer-designer.js";
import { planToText, planFromText } from "./plan-file.js";
import {
  deleteTestPlan,
  stageIdOf,
  planOutline,
  biomekOutput,
  troughVolume,
  trough,
  TROUGHS,
  TRANSFERS_DRAWN,
  GROUP_TIPS,
  TABLE_TIPS,
} from "../../../tests/fixtures/delete-test-plan.js";

// When the tests' things were deleted, as a tool would give it.
const NOW = "2026-11-11T05:28:41.000Z";

// The skip option for a test needing `count` entries kept: false (run it) when TRASH_LIMIT allows,
// otherwise the reason, which the test's name also gives.
function needsLimit(count) {
  return TRASH_LIMIT < count && `needs TRASH_LIMIT ≥ ${count}`;
}

// Places in the column: between boxes, and inside a tip group's box.
function between(index) {
  return { kind: "between", index };
}
function inGroup(index, position) {
  return { kind: "inTipGroup", index, position };
}

// Items of a plan made from the test plan, by stage name (or first word): a stage, the tip group it
// starts, a randomization by name (Randomization1, the run one, by default), and the transfer table.
function st(plan, name) {
  return { kind: "stage", id: stageIdOf(plan, name) };
}
function tg(plan, name) {
  return { kind: "tipGroup", id: stageIdOf(plan, name) };
}
function rz(plan, name = "Randomization1") {
  return { kind: "randomization", id: plan.randomizations.find((entry) => entry.name === name).id };
}
function tt(plan) {
  return { kind: "transferTable", id: plan.transferTables[0].id };
}

// The test plan with an unrun randomization (Randomization2) added before the stage called `name`.
function withUnrunBefore(name) {
  const plan = deleteTestPlan();
  return addRandomization(plan, stageIdOf(plan, name), { seed: 3, volume: 10 }).plan;
}

// The unrun randomization withUnrunBefore adds.
function unrun(plan) {
  return rz(plan, "Randomization2");
}

// A tip group as these tests write it: its tips and its stages' short names (S01 to S11 by their
// first word, others by their whole name).
function groupsOf(plan) {
  return tipGroups(plan).map((group) => ({
    tips: { tipType: group.tipType, probes: group.probes },
    stages: group.stages.map((id) => {
      const { name } = plan.stageList.get(id);
      return /^S\d\d /.test(name) ? name.slice(0, 3) : name;
    }),
  }));
}

// A trash holding `count` entries, each from its own delete of S04 from the test plan, the newest
// last made.
function trashOfDeletes(count, plan = deleteTestPlan()) {
  let trash = emptyTrash();
  for (let made = 0; made < count; made += 1) {
    trash = addDeleted(trash, plan, [st(plan, "S04")], NOW).trash;
  }
  return trash;
}

// Everything a value holds, as text, to check it's unchanged.
function snapshot(value) {
  return JSON.stringify(value, (key, inner) => {
    if (inner !== null && typeof inner === "object" && typeof inner.listOperations === "function") {
      return inner.listOperations();
    }
    if (inner !== null && typeof inner === "object" && typeof inner.listStages === "function") {
      return inner.listStages();
    }
    return inner;
  });
}

// The text of `trash` with its first entry changed by `change`, a function given a copy of the
// entry that returns the entry to write (or undefined to leave the property out).
function withFirstEntryChanged(trash, change) {
  const data = JSON.parse(trashToText(trash));
  data.entries[0] = change({ ...data.entries[0] });
  return JSON.stringify(data);
}

// The text of a trash with its frame's properties replaced by `changes` (undefined leaves one out).
function frameText(trash, changes) {
  const data = { ...JSON.parse(trashToText(trash)), ...changes };
  return JSON.stringify(data);
}

// A trash with one entry of each kind: a stage (S04), a tip group (group 2), the run randomization,
// an unrun one and the transfer table, each its own delete, in that order.
function trashOfEachKind() {
  const plan = withUnrunBefore("S07");
  let trash = emptyTrash();
  for (const item of [st(plan, "S04"), tg(plan, "S03"), rz(plan), unrun(plan), tt(plan)]) {
    trash = addDeleted(trash, plan, [item], NOW).trash;
  }
  return trash;
}

// Runs a delete-then-paste case: from `start`, each of `deletes` (functions giving the items, from
// the plan at that point) deleted in turn with its entries added; then each entry pasted at the
// place `pastes` gives, in the reverse order of the deletes (within one delete, in column order).
// Checks that the plan's outline and Biomek output are the starting plan's, and the trash empty.
function assertRoundTrip(start, deletes, pastes) {
  let plan = start;
  let trash = emptyTrash();
  const byDelete = [];
  for (const itemsOf of deletes) {
    const items = itemsOf(plan);
    const added = addDeleted(trash, plan, items, NOW);
    trash = added.trash;
    byDelete.push(added.change.added);
    plan = deleteItems(plan, items).plan;
  }
  const order = byDelete.reverse().flat();
  assert.equal(order.length, pastes.length, "one place for each entry");
  order.forEach((entry, index) => {
    const pasted = pasteEntry(plan, trash, entry.id, pastes[index]);
    plan = pasted.plan;
    trash = pasted.trash;
  });
  assert.deepEqual(planOutline(plan), planOutline(start));
  assert.deepEqual(biomekOutput(plan), biomekOutput(start));
  assert.deepEqual(trash.entries, []);
}

// The delete-then-paste cases of one delete: a name, the starting plan, the items, and the places,
// in paste order (column order). Boxes of the test plan: 0 group 1, 1 group 2, 2 group 3, 3 group 4,
// 4 the randomization, 5 group 6, 6 the transfer table; with an unrun randomization before S07,
// it's box 2 and the rest move up one.
const ONE_DELETE_CASES = [
  ["S02 and S03, either side of a group boundary", deleteTestPlan, (p) => [st(p, "S02"), st(p, "S03")], [inGroup(0, 1), inGroup(1, 0)]],
  ["S03 and S04, a group's first two", deleteTestPlan, (p) => [st(p, "S03"), st(p, "S04")], [inGroup(1, 0), inGroup(1, 1)]],
  ["S03, S04 and S05", deleteTestPlan, (p) => [st(p, "S03"), st(p, "S04"), st(p, "S05")], [inGroup(1, 0), inGroup(1, 1), inGroup(1, 2)]],
  [
    "S07, S08 and S09, a lone group and the next group",
    deleteTestPlan,
    (p) => [st(p, "S07"), st(p, "S08"), st(p, "S09")],
    [between(2), between(3), inGroup(3, 1)],
  ],
  ["S01", deleteTestPlan, (p) => [st(p, "S01")], [inGroup(0, 0)]],
  ["S01 and S02", deleteTestPlan, (p) => [st(p, "S01"), st(p, "S02")], [between(0), inGroup(0, 1)]],
  ["S11", deleteTestPlan, (p) => [st(p, "S11")], [inGroup(5, 1)]],
  ["S10 and S11", deleteTestPlan, (p) => [st(p, "S10"), st(p, "S11")], [between(5), inGroup(5, 1)]],
  ["S09 and S10, either side of the randomization", deleteTestPlan, (p) => [st(p, "S09"), st(p, "S10")], [inGroup(3, 1), inGroup(5, 0)]],
  ["group 2 as a tip group", deleteTestPlan, (p) => [tg(p, "S03")], [between(1)]],
  [
    "group 2 with S02 and S07",
    deleteTestPlan,
    (p) => [st(p, "S02"), tg(p, "S03"), st(p, "S07")],
    [inGroup(0, 1), between(1), between(2)],
  ],
  ["group 1 as a tip group", deleteTestPlan, (p) => [tg(p, "S01")], [between(0)]],
  ["S06, a mix step", deleteTestPlan, (p) => [st(p, "S06")], [inGroup(1, 3)]],
  ["S05 and S06", deleteTestPlan, (p) => [st(p, "S05"), st(p, "S06")], [inGroup(1, 2), inGroup(1, 3)]],
  ["the randomization", deleteTestPlan, (p) => [rz(p)], [between(4)]],
  [
    "the randomization with S09 and S10",
    deleteTestPlan,
    (p) => [st(p, "S09"), rz(p), st(p, "S10")],
    [inGroup(3, 1), between(4), inGroup(5, 0)],
  ],
  ["an unrun randomization before S07, alone", () => withUnrunBefore("S07"), (p) => [unrun(p)], [between(2)]],
  ["an unrun randomization before S07, with S07", () => withUnrunBefore("S07"), (p) => [unrun(p), st(p, "S07")], [between(2), between(3)]],
  ["the transfer table", deleteTestPlan, (p) => [tt(p)], [between(6)]],
  ["the transfer table with S11", deleteTestPlan, (p) => [st(p, "S11"), tt(p)], [inGroup(5, 1), between(6)]],
  [
    "S01, group 2 and the randomization",
    deleteTestPlan,
    (p) => [st(p, "S01"), tg(p, "S03"), rz(p)],
    [inGroup(0, 0), between(1), between(4)],
  ],
  [
    "S06, S11 and the transfer table",
    deleteTestPlan,
    (p) => [st(p, "S06"), st(p, "S11"), tt(p)],
    [inGroup(1, 3), inGroup(5, 1), between(6)],
  ],
];

// The delete-then-paste cases of separate deletes: a name, the starting plan, each delete's items,
// and the places in paste order (the last delete's entries first).
const SEPARATE_DELETE_CASES = [
  ["S04, then S03", deleteTestPlan, [(p) => [st(p, "S04")], (p) => [st(p, "S03")]], [inGroup(1, 0), inGroup(1, 1)]],
  ["S03, then S04", deleteTestPlan, [(p) => [st(p, "S03")], (p) => [st(p, "S04")]], [inGroup(1, 0), inGroup(1, 0)]],
  [
    "S07, then S08, then S09",
    deleteTestPlan,
    [(p) => [st(p, "S07")], (p) => [st(p, "S08")], (p) => [st(p, "S09")]],
    [between(2), inGroup(2, 0), between(2)],
  ],
  [
    "S09, then S08, then S07",
    deleteTestPlan,
    [(p) => [st(p, "S09")], (p) => [st(p, "S08")], (p) => [st(p, "S07")]],
    [between(2), between(3), inGroup(3, 1)],
  ],
  ["S03, then group 2", deleteTestPlan, [(p) => [st(p, "S03")], (p) => [tg(p, "S04")]], [between(1), inGroup(1, 0)]],
  [
    "S03, S04 and S05, then S06",
    deleteTestPlan,
    [(p) => [st(p, "S03"), st(p, "S04"), st(p, "S05")], (p) => [st(p, "S06")]],
    [between(1), inGroup(1, 0), inGroup(1, 1), inGroup(1, 2)],
  ],
  ["S02, then S03", deleteTestPlan, [(p) => [st(p, "S02")], (p) => [st(p, "S03")]], [inGroup(1, 0), inGroup(0, 1)]],
  ["S09, then S10", deleteTestPlan, [(p) => [st(p, "S09")], (p) => [st(p, "S10")]], [inGroup(5, 0), inGroup(3, 1)]],
  ["S10, then the randomization", deleteTestPlan, [(p) => [st(p, "S10")], (p) => [rz(p)]], [between(4), inGroup(5, 0)]],
  [
    "an unrun randomization before S07, then S07",
    () => withUnrunBefore("S07"),
    [(p) => [unrun(p)], (p) => [st(p, "S07")]],
    [between(2), between(2)],
  ],
  [
    "an unrun randomization before S03, then group 1",
    () => withUnrunBefore("S03"),
    [(p) => [unrun(p)], (p) => [tg(p, "S01")]],
    [between(0), between(1)],
  ],
];

describe("trash", () => {
  // --- The test plan itself ---

  test("the test plan has its stages, tip groups and tips in order, and the randomization three stages", () => {
    const plan = deleteTestPlan();
    const [t1, t2, t3, t4, t6] = [1, 2, 3, 4, 6].map((group) => GROUP_TIPS[group]);
    assert.deepEqual(groupsOf(plan), [
      { tips: t1, stages: ["S01", "S02"] },
      { tips: t2, stages: ["S03", "S04", "S05", "S06"] },
      { tips: t3, stages: ["S07"] },
      { tips: t4, stages: ["S08", "S09"] },
      { tips: t4, stages: ["Drug A"] },
      { tips: t4, stages: ["Drug B"] },
      { tips: t4, stages: ["Media"] },
      { tips: t6, stages: ["S10", "S11"] },
      { tips: TABLE_TIPS, stages: ["Media"] },
      { tips: TABLE_TIPS, stages: ["Dye"] },
    ]);
    assert.equal(randomizationAt(plan, rz(plan).id).stages.length, 3);
    // Groups 1 to 4 have different tips whatever TIP_TYPES holds.
    const tips = [t1, t2, t3, t4].map((group) => JSON.stringify(group));
    assert.equal(new Set(tips).size, 4);
  });

  test("each trough holds what the plan draws from it above its dead volume, and a margin, and the transfers drawn are the counts listed", () => {
    const plan = deleteTestPlan();
    for (const [component, well] of Object.entries(TROUGHS)) {
      const entries = plan.startingContents.filter((entry) => entry.labware === trough(well).labware && entry.well === well);
      assert.equal(entries.length, 1, component);
      assert.deepEqual(entries[0].components, {
        [component]: deadVolumeOf(trough(well).labware) + DEFAULT_TRANSFER_VOLUME * (TRANSFERS_DRAWN[component] + 1),
      });
      assert.deepEqual(entries[0].components, { [component]: troughVolume(component) });
      const drawn = plan.operationList
        .listOperations()
        .filter((operation) => operation.source.labware === trough(well).labware && operation.source.well === well);
      assert.equal(drawn.length, TRANSFERS_DRAWN[component], component);
      assert.ok(drawn.every((operation) => operation.volume === DEFAULT_TRANSFER_VOLUME));
    }
  });

  test("the test plan has no contents or mix problem, its Biomek files can be written, and it survives a plan file", () => {
    const plan = deleteTestPlan();
    assert.deepEqual([...stagesWithContentsProblem(plan)], []);
    assert.deepEqual([...stagesWithMixProblem(plan)], []);
    assert.doesNotThrow(() => biomekOutput(plan));
    // Opening a plan file renumbers stage IDs (plan-file.md), so the plan is compared up to its IDs.
    const reopened = planFromText(planToText(plan, "trash tests"));
    assert.deepEqual(planOutline(reopened), planOutline(plan));
    assert.deepEqual(biomekOutput(reopened), biomekOutput(plan));
  });

  // --- Configuration ---

  test("TRASH_LIMIT is a whole number of at least 1, re-exported unchanged", () => {
    assert.ok(Number.isInteger(CONFIGURED_TRASH_LIMIT) && CONFIGURED_TRASH_LIMIT >= 1);
    assert.equal(TRASH_LIMIT, CONFIGURED_TRASH_LIMIT);
    assert.equal(TRASH_FORMAT, "biomek-tools trash");
    assert.equal(TRASH_VERSION, 1);
  });

  test("emptyTrash has no entries and counters at 1", () => {
    assert.deepEqual(emptyTrash(), { entries: [], nextEntryId: 1, nextDeletion: 1 });
  });

  // --- Entries ---

  test("addDeleted of a stage: its kind, name, one stage, its transfers, and its copied items", () => {
    const plan = deleteTestPlan();
    const item = st(plan, "S04");
    const { trash, change } = addDeleted(emptyTrash(), plan, [item], NOW);
    assert.deepEqual(trash.entries, [
      {
        id: 1,
        deletion: 1,
        kind: "stage",
        name: "S04 Drug B row B",
        stageCount: 1,
        transferCount: 4,
        deletedAt: NOW,
        copied: copyOf(plan, [item]),
      },
    ]);
    assert.deepEqual(change, { added: trash.entries, removed: [] });
    assert.equal(trash.nextEntryId, 2);
    assert.equal(trash.nextDeletion, 2);
  });

  test("addDeleted of a mix step counts its mixed wells as transfers", () => {
    const plan = deleteTestPlan();
    const [entry] = addDeleted(emptyTrash(), plan, [st(plan, "S06")], NOW).trash.entries;
    assert.equal(entry.kind, "stage");
    assert.equal(entry.name, "S06 Mix row A");
    assert.equal(entry.stageCount, 1);
    assert.equal(entry.transferCount, 4);
  });

  test("addDeleted of a tip group, the randomization, an unrun one and the transfer table", () => {
    const plan = withUnrunBefore("S07");
    const entryOf = (item) => addDeleted(emptyTrash(), plan, [item], NOW).trash.entries[0];
    const group = entryOf(tg(plan, "S03"));
    assert.deepEqual([group.kind, group.name, group.stageCount, group.transferCount], ["tipGroup", null, 4, 16]);
    assert.deepEqual(group.copied, copyOf(plan, [tg(plan, "S03")]));
    const randomization = entryOf(rz(plan));
    assert.deepEqual(
      [randomization.kind, randomization.name, randomization.stageCount, randomization.transferCount],
      ["randomization", "Randomization1", 3, 12],
    );
    const notRun = entryOf(unrun(plan));
    assert.deepEqual([notRun.kind, notRun.name, notRun.stageCount, notRun.transferCount], ["randomization", "Randomization2", 0, 0]);
    const table = entryOf(tt(plan));
    assert.deepEqual([table.kind, table.name, table.stageCount, table.transferCount], ["transferTable", null, 2, 6]);
  });

  test("addDeleted of several items: one entry each, in column order though given out of order; a stage of a listed tip group left out; an item listed twice once (needs TRASH_LIMIT ≥ 3)", { skip: needsLimit(3) }, () => {
    const plan = deleteTestPlan();
    const { trash } = addDeleted(
      emptyTrash(),
      plan,
      [tt(plan), st(plan, "S04"), st(plan, "S09"), tg(plan, "S03"), st(plan, "S09")],
      NOW,
    );
    assert.deepEqual(
      trash.entries.map((entry) => [entry.id, entry.kind, entry.name]),
      [[1, "tipGroup", null], [2, "stage", "S09 Media row H"], [3, "transferTable", null]],
    );
    assert.ok(trash.entries.every((entry) => entry.deletion === 1));
  });

  test("addDeleted refuses as deleteItems does, with its messages, the trash unchanged", () => {
    const plan = deleteTestPlan();
    const trash = trashOfDeletes(1);
    const before = snapshot(trash);
    const ownedStage = { kind: "stage", id: randomizationAt(plan, rz(plan).id).stages[0].stage };
    assert.throws(() => addDeleted(trash, plan, [ownedStage], NOW), {
      message: "Stage 10, “Drug A”, belongs to a randomization: delete the whole randomization, or change it in its card.",
    });
    const everyGroup = ["S01", "S03", "S07", "S08", "S10"].map((name) => tg(plan, name));
    assert.throws(() => addDeleted(trash, plan, [...everyGroup, rz(plan), tt(plan)], NOW), {
      message: "That's every stage in the plan, and a plan needs at least one. Leave one stage, or add a new one first.",
    });
    assert.throws(() => addDeleted(trash, plan, 5, NOW), {
      message: "The things to delete must be a list of stages, tip groups, randomizations or transfer tables, but got 5.",
    });
    assert.equal(snapshot(trash), before);
  });

  test("addDeleted refuses a deletedAt that isn't a date as text; the items are checked first; deletedAt is kept as given", () => {
    const plan = deleteTestPlan();
    for (const [deletedAt, shown] of [[5, "5"], ["yesterday", '"yesterday"'], ["2026-13-45", '"2026-13-45"']]) {
      assert.throws(() => addDeleted(emptyTrash(), plan, [st(plan, "S04")], deletedAt), {
        message: `When it was deleted must be a date as text, like "2026-11-11T05:28:41.000Z", but got ${shown}.`,
      });
    }
    assert.throws(() => addDeleted(emptyTrash(), plan, [], 5), {
      message: "The things to delete must be a list of stages, tip groups, randomizations or transfer tables, but got an empty list.",
    });
    const given = "2026-11-10T23:59:00-05:00";
    assert.equal(addDeleted(emptyTrash(), plan, [st(plan, "S04")], given).trash.entries[0].deletedAt, given);
  });

  // --- Adding and the limit ---

  test("entries are numbered from nextEntryId, one deletion per delete, newest delete first, column order within one (needs TRASH_LIMIT ≥ 3)", { skip: needsLimit(3) }, () => {
    const plan = deleteTestPlan();
    let trash = addDeleted(emptyTrash(), plan, [st(plan, "S09")], NOW).trash;
    trash = addDeleted(trash, plan, [st(plan, "S05"), st(plan, "S02")], NOW).trash;
    assert.deepEqual(
      trash.entries.map((entry) => [entry.id, entry.deletion, entry.name.slice(0, 3)]),
      [[2, 2, "S02"], [3, 2, "S05"], [1, 1, "S09"]],
    );
    assert.equal(trash.nextEntryId, 4);
    assert.equal(trash.nextDeletion, 3);
  });

  test("adding past the limit drops the oldest, and the change's removed holds it", () => {
    const full = trashOfDeletes(TRASH_LIMIT);
    assert.equal(full.entries.length, TRASH_LIMIT);
    const oldest = full.entries.at(-1);
    const plan = deleteTestPlan();
    const { trash, change } = addDeleted(full, plan, [st(plan, "S07")], NOW);
    assert.equal(trash.entries.length, TRASH_LIMIT);
    assert.equal(trash.entries[0].name, "S07 Media row C");
    assert.equal(trash.entries.some((entry) => entry.id === oldest.id), false);
    assert.deepEqual(change.removed, [oldest]);
    assert.deepEqual(change.added, [trash.entries[0]]);
    // Undo gives back the entries exactly, keeping the counters so no ID is given twice.
    assert.deepEqual(undoTrashChange(trash, change), {
      ...full,
      nextEntryId: trash.nextEntryId,
      nextDeletion: trash.nextDeletion,
    });
  });

  test("one delete of more things than the limit keeps the first TRASH_LIMIT of them; added holds only those, removed only the entry there before; undo gives the trash back", () => {
    // TRASH_LIMIT + 2 stages, each in its own tip group.
    let plan = emptyPlan().plan;
    for (let added = 1; added < TRASH_LIMIT + 2; added += 1) {
      plan = addStageWithNewTips(plan, null).plan;
    }
    assert.equal(tipGroups(plan).length, TRASH_LIMIT + 2);
    const before = addDeleted(emptyTrash(), plan, [{ kind: "stage", id: plan.stageOrder[0] }], NOW).trash;
    const items = plan.stageOrder.slice(1).map((id) => ({ kind: "stage", id }));
    const { trash, change } = addDeleted(before, plan, items, NOW);
    assert.deepEqual(
      trash.entries.map((entry) => entry.id),
      items.slice(0, TRASH_LIMIT).map((item, index) => before.nextEntryId + index),
    );
    assert.deepEqual(change.added, trash.entries);
    assert.deepEqual(change.removed, before.entries);
    assert.deepEqual(undoTrashChange(trash, change), { ...before, nextEntryId: trash.nextEntryId, nextDeletion: trash.nextDeletion });
    assert.deepEqual(undoTrashChange(trash, change).entries, before.entries);
  });

  // --- Delete then paste at the original place ---

  for (const [name, start, itemsOf, pastes] of ONE_DELETE_CASES) {
    test(`delete then paste where it was, one delete: ${name} (needs TRASH_LIMIT ≥ ${pastes.length})`, { skip: needsLimit(pastes.length) }, () => {
      assertRoundTrip(start(), [itemsOf], pastes);
    });
  }

  for (const [name, start, deletes, pastes] of SEPARATE_DELETE_CASES) {
    test(`delete then paste where it was, separate deletes: ${name} (needs TRASH_LIMIT ≥ ${pastes.length})`, { skip: needsLimit(pastes.length) }, () => {
      assertRoundTrip(start(), deletes, pastes);
    });
  }

  test("a randomization pasted where it was takes its name again", () => {
    const plan = deleteTestPlan();
    const { trash } = addDeleted(emptyTrash(), plan, [rz(plan)], NOW);
    const deleted = deleteItems(plan, [rz(plan)]).plan;
    const pasted = pasteEntry(deleted, trash, trash.entries[0].id, between(4));
    assert.equal(randomizationAt(pasted.plan, pasted.placed[0].id).name, "Randomization1");
    assert.deepEqual(planOutline(pasted.plan), planOutline(plan));
  });

  // The name pasteItems alone gives the entry's randomization in `plan`.
  function pastedNameIn(plan, entry, place) {
    const pasted = pasteItems(plan, entry.copied, place);
    return randomizationAt(pasted.plan, pasted.placed[0].id).name;
  }

  test("a pasted randomization keeps its pasted name, the paste not refused, when another randomization has the name, in any capitals", () => {
    const plan = deleteTestPlan();
    const { trash } = addDeleted(emptyTrash(), plan, [rz(plan)], NOW);
    const entry = trash.entries[0];
    // Pasted into the test plan, which still has Randomization1.
    const intoFull = pasteEntry(plan, trash, entry.id, between(4));
    const fullName = randomizationAt(intoFull.plan, intoFull.placed[0].id).name;
    assert.notEqual(fullName, "Randomization1");
    assert.equal(fullName, pastedNameIn(plan, entry, between(4)));
    // Another randomization, renamed RANDOMIZATION1, in a plan without the original.
    const deleted = deleteItems(plan, [rz(plan)]).plan;
    const added = addRandomization(deleted, stageIdOf(deleted, "S07"), { seed: 1, volume: 5 });
    const shouting = renameRandomization(added.plan, added.id, "RANDOMIZATION1");
    const intoShouting = pasteEntry(shouting, trash, entry.id, between(5));
    const shoutingName = randomizationAt(intoShouting.plan, intoShouting.placed[0].id).name;
    assert.notEqual(shoutingName.toLowerCase(), "randomization1");
    assert.equal(shoutingName, pastedNameIn(shouting, entry, between(5)));
  });

  test("a pasted randomization keeps its pasted name when the entry's name breaks the rule: a space, or 41 characters", () => {
    const plan = deleteTestPlan();
    const { trash } = addDeleted(emptyTrash(), plan, [rz(plan)], NOW);
    const deleted = deleteItems(plan, [rz(plan)]).plan;
    for (const badName of ["bad name", "R".repeat(41)]) {
      const read = trashFromText(withFirstEntryChanged(trash, (entry) => ({ ...entry, name: badName })));
      assert.equal(read.entries[0].name, badName);
      const pasted = pasteEntry(deleted, read, read.entries[0].id, between(4));
      const name = randomizationAt(pasted.plan, pasted.placed[0].id).name;
      assert.notEqual(name, badName);
      assert.equal(name, pastedNameIn(deleted, read.entries[0], between(4)));
    }
  });

  // --- Pasting elsewhere ---

  test("an entry pasted into an empty plan gives the same stages, settings, tips and transfers as its copied items", () => {
    const plan = deleteTestPlan();
    for (const item of [st(plan, "S04"), tg(plan, "S03"), rz(plan), tt(plan)]) {
      const { trash } = addDeleted(emptyTrash(), plan, [item], NOW);
      const entry = trash.entries[0];
      const empty = emptyPlan().plan;
      const pasted = pasteEntry(empty, trash, entry.id, between(0));
      const byPaste = pasteItems(empty, entry.copied, between(0));
      assert.deepEqual(planOutline(pasted.plan), planOutline(byPaste.plan), item.kind);
      assert.deepEqual(copyOf(pasted.plan, pasted.placed), entry.copied, item.kind);
    }
  });

  test("pasteItems' refusals pass through, the trash unchanged: a tip group inside one, a place out of range", () => {
    const plan = deleteTestPlan();
    const { trash } = addDeleted(emptyTrash(), plan, [tg(plan, "S03")], NOW);
    const deleted = deleteItems(plan, [tg(plan, "S03")]).plan;
    const before = snapshot(trash);
    const entry = trash.entries[0];
    for (const place of [inGroup(0, 1), between(99)]) {
      let expected = null;
      try {
        pasteItems(deleted, entry.copied, place);
      } catch (error) {
        expected = error.message;
      }
      assert.notEqual(expected, null);
      assert.throws(() => pasteEntry(deleted, trash, entry.id, place), { message: expected });
    }
    assert.equal(snapshot(trash), before);
  });

  test("an entry whose copied is damaged, or names a well not on the deck, is refused with pasteItems' message", () => {
    const plan = deleteTestPlan();
    const { trash } = addDeleted(emptyTrash(), plan, [st(plan, "S04")], NOW);
    const damaged = trashFromText(withFirstEntryChanged(trash, (entry) => ({ ...entry, copied: { format: "nope" } })));
    assert.equal(damaged.entries.length, 1);
    const offDeck = trashFromText(
      withFirstEntryChanged(trash, (entry) => {
        const copied = JSON.parse(JSON.stringify(entry.copied));
        copied.items[0].stage.transfers[0].destination.well = "Z99";
        return { ...entry, copied };
      }),
    );
    for (const read of [damaged, offDeck]) {
      let expected = null;
      try {
        pasteItems(plan, read.entries[0].copied, between(0));
      } catch (error) {
        expected = error.message;
      }
      assert.match(expected, /^Can't paste/);
      const before = snapshot(read);
      assert.throws(() => pasteEntry(plan, read, read.entries[0].id, between(0)), { message: expected });
      assert.equal(snapshot(read), before);
    }
    assert.throws(() => pasteEntry(plan, offDeck, offDeck.entries[0].id, between(0)), { message: /Z99/ });
  });

  test("pasteEntry of no such entry: its message", () => {
    assert.throws(() => pasteEntry(deleteTestPlan(), trashOfDeletes(1), 9, between(0)), {
      message: "There's no entry 9 in the trash.",
    });
  });

  test("pasteEntry's change is { added: [], removed: [entry] }, placed is pasteItems', and the entry leaves the trash", () => {
    const plan = deleteTestPlan();
    const { trash } = addDeleted(emptyTrash(), plan, [st(plan, "S04")], NOW);
    const entry = trash.entries[0];
    const pasted = pasteEntry(plan, trash, entry.id, between(0));
    assert.deepEqual(pasted.change, { added: [], removed: [entry] });
    assert.deepEqual(pasted.placed, pasteItems(plan, entry.copied, between(0)).placed);
    assert.deepEqual(pasted.trash, { ...trash, entries: [] });
  });

  // --- Emptying, undo and redo ---

  test("clearTrash: no entries, counters kept; the change removes every entry", () => {
    const trash = trashOfDeletes(Math.min(TRASH_LIMIT, 3));
    const { trash: cleared, change } = clearTrash(trash);
    assert.deepEqual(cleared, { entries: [], nextEntryId: trash.nextEntryId, nextDeletion: trash.nextDeletion });
    assert.deepEqual(change, { added: [], removed: trash.entries });
  });

  test("undo and redo of a delete's, a paste's and a clear's change (needs TRASH_LIMIT ≥ 3)", { skip: needsLimit(3) }, () => {
    const plan = deleteTestPlan();
    const one = addDeleted(emptyTrash(), plan, [st(plan, "S04")], NOW);
    const two = addDeleted(one.trash, plan, [st(plan, "S07"), st(plan, "S09")], NOW);
    // Undo keeps the counters, so no ID is given twice.
    assert.deepEqual(undoTrashChange(two.trash, two.change), {
      ...one.trash,
      nextEntryId: two.trash.nextEntryId,
      nextDeletion: two.trash.nextDeletion,
    });
    assert.deepEqual(redoTrashChange(undoTrashChange(two.trash, two.change), two.change), two.trash);
    // A paste of the middle entry (S07's), undone: back in its place; redone: out again.
    const s07 = two.trash.entries.find((entry) => entry.name.startsWith("S07"));
    const pasted = pasteEntry(plan, two.trash, s07.id, between(0));
    assert.deepEqual(undoTrashChange(pasted.trash, pasted.change), two.trash);
    assert.deepEqual(redoTrashChange(two.trash, pasted.change), pasted.trash);
    // A clear, undone: every entry back in order; redone: empty again.
    const cleared = clearTrash(two.trash);
    assert.deepEqual(undoTrashChange(cleared.trash, cleared.change), two.trash);
    assert.deepEqual(redoTrashChange(two.trash, cleared.change), cleared.trash);
  });

  test("undo of a delete after its entries were emptied meanwhile: nothing to take out, no error", () => {
    const plan = deleteTestPlan();
    const { trash, change } = addDeleted(emptyTrash(), plan, [st(plan, "S04")], NOW);
    const cleared = clearTrash(trash).trash;
    assert.deepEqual(undoTrashChange(cleared, change), cleared);
  });

  test("redoing a delete past the limit drops older entries again (accepted)", () => {
    const plan = deleteTestPlan();
    const first = addDeleted(emptyTrash(), plan, [st(plan, "S04")], NOW);
    const undone = undoTrashChange(first.trash, first.change);
    assert.deepEqual(undone.entries, []);
    // Meanwhile another caller fills the trash to the limit with newer deletes.
    let filled = undone;
    for (let made = 0; made < TRASH_LIMIT; made += 1) {
      filled = addDeleted(filled, plan, [st(plan, "S07")], NOW).trash;
    }
    const redone = redoTrashChange(filled, first.change);
    assert.equal(redone.entries.length, TRASH_LIMIT);
    // The redone entry is the oldest, from delete 1, so it's the one dropped.
    assert.equal(redone.entries.some((entry) => entry.id === first.change.added[0].id), false);
    assert.deepEqual(redone, filled);
  });

  test("undo of a paste whose entry would be the oldest past the limit drops it at once, the trash unchanged; redo then changes nothing", () => {
    const plan = deleteTestPlan();
    // A trash at the limit whose oldest entry is S03's.
    let trash = addDeleted(emptyTrash(), plan, [st(plan, "S03")], NOW).trash;
    for (let made = 1; made < TRASH_LIMIT; made += 1) {
      trash = addDeleted(trash, plan, [st(plan, "S04")], NOW).trash;
    }
    assert.equal(trash.entries.length, TRASH_LIMIT);
    const s03 = trash.entries.at(-1);
    assert.equal(s03.name, "S03 Drug A row A");
    const pasted = pasteEntry(plan, trash, s03.id, between(0));
    // Entries added by a delete not undone, until the trash is at the limit again, all newer.
    let after = pasted.trash;
    while (after.entries.length < TRASH_LIMIT) {
      after = addDeleted(after, plan, [st(plan, "S07")], NOW).trash;
    }
    const undone = undoTrashChange(after, pasted.change);
    assert.deepEqual(undone, after);
    assert.deepEqual(redoTrashChange(undone, pasted.change), after);
  });

  test("a tool's sequence: delete S03, delete S07, paste S03's entry, undo, undo, redo, redo (needs TRASH_LIMIT ≥ 2)", { skip: needsLimit(2) }, () => {
    const plan = deleteTestPlan();
    const t0 = emptyTrash();
    const d1 = addDeleted(t0, plan, [st(plan, "S03")], NOW);
    const p1 = deleteItems(plan, [st(plan, "S03")]).plan;
    const d2 = addDeleted(d1.trash, p1, [st(p1, "S07")], NOW);
    const p2 = deleteItems(p1, [st(p1, "S07")]).plan;
    const s03 = d1.change.added[0];
    const paste = pasteEntry(p2, d2.trash, s03.id, inGroup(1, 0));
    assert.deepEqual(paste.trash.entries, d2.change.added);
    const undoPaste = undoTrashChange(paste.trash, paste.change);
    assert.deepEqual(undoPaste, d2.trash);
    const undoDelete = undoTrashChange(undoPaste, d2.change);
    assert.deepEqual(undoDelete.entries, d1.trash.entries);
    const redoDelete = redoTrashChange(undoDelete, d2.change);
    assert.deepEqual(redoDelete, d2.trash);
    const redoPaste = redoTrashChange(redoDelete, paste.change);
    assert.deepEqual(redoPaste, paste.trash);
  });

  test("a tool's sequence: delete S03 and S04, paste S03's entry, undo, paste S04's, then S03's (needs TRASH_LIMIT ≥ 2)", { skip: needsLimit(2) }, () => {
    const plan = deleteTestPlan();
    const items = [st(plan, "S03"), st(plan, "S04")];
    const deleted = addDeleted(emptyTrash(), plan, items, NOW);
    const after = deleteItems(plan, items).plan;
    const [s03, s04] = deleted.change.added;
    const first = pasteEntry(after, deleted.trash, s03.id, inGroup(1, 0));
    assert.deepEqual(first.trash.entries, [s04]);
    const undone = undoTrashChange(first.trash, first.change);
    assert.deepEqual(undone, deleted.trash);
    const pasteS04 = pasteEntry(after, undone, s04.id, inGroup(1, 0));
    assert.deepEqual(pasteS04.trash.entries, [s03]);
    const pasteS03 = pasteEntry(pasteS04.plan, pasteS04.trash, s03.id, inGroup(1, 0));
    assert.deepEqual(pasteS03.trash.entries, []);
    assert.deepEqual(planOutline(pasteS03.plan), planOutline(plan));
  });

  test("a tool's sequence: delete S04, undo, redo, paste it", () => {
    const plan = deleteTestPlan();
    const deleted = addDeleted(emptyTrash(), plan, [st(plan, "S04")], NOW);
    const undone = undoTrashChange(deleted.trash, deleted.change);
    assert.deepEqual(undone.entries, []);
    const redone = redoTrashChange(undone, deleted.change);
    assert.deepEqual(redone, deleted.trash);
    const after = deleteItems(plan, [st(plan, "S04")]).plan;
    const pasted = pasteEntry(after, redone, deleted.change.added[0].id, inGroup(1, 1));
    assert.deepEqual(pasted.trash.entries, []);
    assert.deepEqual(planOutline(pasted.plan), planOutline(plan));
  });

  test("a tool's sequence: delete S03, an edit replacing the plan that empties the trash, undo (S03 back), paste it where it was", () => {
    const plan = deleteTestPlan();
    // The states a tool's history would hold: { plan, trashChange }, and the trash beside them.
    const deleted = addDeleted(emptyTrash(), plan, [st(plan, "S03")], NOW);
    const afterDelete = { plan: deleteItems(plan, [st(plan, "S03")]).plan, trashChange: deleted.change };
    const reset = clearTrash(deleted.trash);
    const afterReset = { plan: emptyPlan().plan, trashChange: reset.change };
    assert.deepEqual(reset.trash.entries, []);
    // Undo out of afterReset: back to afterDelete's plan, afterReset's change undone.
    const trash = undoTrashChange(reset.trash, afterReset.trashChange);
    assert.deepEqual(trash, deleted.trash);
    const pasted = pasteEntry(afterDelete.plan, trash, deleted.change.added[0].id, inGroup(1, 0));
    assert.deepEqual(planOutline(pasted.plan), planOutline(plan));
    assert.deepEqual(pasted.trash.entries, []);
  });

  // --- Text ---

  test("trashToText then trashFromText gives an equal trash: empty, and with an entry of each kind", () => {
    assert.deepEqual(trashFromText(trashToText(emptyTrash())), emptyTrash());
    const trash = trashOfEachKind();
    const text = trashToText(trash);
    assert.deepEqual(Object.keys(JSON.parse(text)), ["format", "version", "entries", "nextEntryId", "nextDeletion"]);
    assert.deepEqual(trashFromText(text), TRASH_LIMIT >= 5 ? trash : { ...trash, entries: trash.entries.slice(0, TRASH_LIMIT) });
  });

  // The frame cases trashFromText can't read, each a name and text.
  function unreadableFrames() {
    const trash = trashOfDeletes(1);
    return [
      ["not JSON", "{ not json"],
      ["null", "null"],
      ["a list", "[]"],
      ["a missing property", frameText(trash, { nextDeletion: undefined })],
      ["an extra property", frameText(trash, { note: "x" })],
      ["another format", frameText(trash, { format: "biomek-tools plan" })],
      ["nextEntryId 0", frameText(trash, { nextEntryId: 0 })],
      ["nextEntryId 1.5", frameText(trash, { nextEntryId: 1.5 })],
      ["nextDeletion 0", frameText(trash, { nextDeletion: 0 })],
      ["entries not a list", frameText(trash, { entries: {} })],
      ["version 0", frameText(trash, { version: 0 })],
      ["version \"1\"", frameText(trash, { version: "1" })],
    ];
  }

  test("a frame that can't be read gives emptyTrash() without throwing, version 2 included", () => {
    for (const [name, text] of [...unreadableFrames(), ["version 2", frameText(trashOfDeletes(1), { version: 2 })]]) {
      assert.deepEqual(trashFromText(text), emptyTrash(), name);
    }
    for (const value of [5, null, undefined, {}]) {
      assert.deepEqual(trashFromText(value), emptyTrash());
    }
  });

  // The entry cases trashFromText drops, each a name and a change to a stage entry (S04's); a
  // randomization's and a transfer table's are made by kindChanges below.
  const UNREADABLE_ENTRY_CHANGES = [
    ["id missing", (entry) => ({ ...entry, id: undefined })],
    ["id 0", (entry) => ({ ...entry, id: 0 })],
    ["id text", (entry) => ({ ...entry, id: "1" })],
    ["id at nextEntryId", (entry) => ({ ...entry, id: 2 })],
    ["deletion missing", (entry) => ({ ...entry, deletion: undefined })],
    ["deletion 1.5", (entry) => ({ ...entry, deletion: 1.5 })],
    ["deletion at nextDeletion", (entry) => ({ ...entry, deletion: 2 })],
    ["kind missing", (entry) => ({ ...entry, kind: undefined })],
    ['kind "box"', (entry) => ({ ...entry, kind: "box" })],
    ["name missing", (entry) => ({ ...entry, name: undefined })],
    ["name null for a stage", (entry) => ({ ...entry, name: null })],
    ["name a number", (entry) => ({ ...entry, name: 4 })],
    ["stageCount missing", (entry) => ({ ...entry, stageCount: undefined })],
    ["stageCount -1", (entry) => ({ ...entry, stageCount: -1 })],
    ["stageCount text", (entry) => ({ ...entry, stageCount: "1" })],
    ["transferCount missing", (entry) => ({ ...entry, transferCount: undefined })],
    ["transferCount 2.5", (entry) => ({ ...entry, transferCount: 2.5 })],
    ["deletedAt missing", (entry) => ({ ...entry, deletedAt: undefined })],
    ['deletedAt "not a date"', (entry) => ({ ...entry, deletedAt: "not a date" })],
    ["deletedAt a number", (entry) => ({ ...entry, deletedAt: 5 })],
    ["copied missing", (entry) => ({ ...entry, copied: undefined })],
    ["copied null", (entry) => ({ ...entry, copied: null })],
    ["copied a list", (entry) => ({ ...entry, copied: [] })],
    ["copied text", (entry) => ({ ...entry, copied: "{}" })],
    ['an extra property, note: "x"', (entry) => ({ ...entry, note: "x" })],
    ["name null for a randomization", (entry) => ({ ...entry, kind: "randomization", name: null })],
    ["name text for a tip group", (entry) => ({ ...entry, kind: "tipGroup", name: "Group" })],
    ["name text for a transfer table", (entry) => ({ ...entry, kind: "transferTable", name: "Table" })],
  ];

  // A trash of two deletes, S04's then S07's, whose older entry (S04's, id 1, deletion 1) is
  // changed by `change`, as text; the counters are then 3, so the cases above are named for a
  // trash whose counters are 2: they're given in its terms by moving "at nextEntryId" and "at
  // nextDeletion" up to 3.
  function twoEntryTextWith(change) {
    const plan = deleteTestPlan();
    let trash = addDeleted(emptyTrash(), plan, [st(plan, "S04")], NOW).trash;
    trash = addDeleted(trash, plan, [st(plan, "S07")], NOW).trash;
    const data = JSON.parse(trashToText(trash));
    const index = data.entries.findIndex((entry) => entry.id === 1);
    const changed = change({ ...data.entries[index] });
    if (changed.id === 2) {
      changed.id = 3;
    }
    if (changed.deletion === 2) {
      changed.deletion = 3;
    }
    data.entries[index] = changed;
    return { text: JSON.stringify(data), kept: trash.entries.filter((entry) => entry.id !== 1) };
  }

  test("an entry that can't be read is dropped, the others kept: each property missing or of the wrong kind in turn, an extra property, a name not as its kind has it, copied not a plain object (needs TRASH_LIMIT ≥ 2)", { skip: needsLimit(2) }, () => {
    for (const [name, change] of UNREADABLE_ENTRY_CHANGES) {
      const { text, kept } = twoEntryTextWith(change);
      assert.deepEqual(trashFromText(text).entries, kept, name);
      assert.equal(trashTextProblem(text), "damaged", name);
    }
  });

  test("of two entries with one id, the later is dropped (needs TRASH_LIMIT ≥ 2)", { skip: needsLimit(2) }, () => {
    const plan = deleteTestPlan();
    let trash = addDeleted(emptyTrash(), plan, [st(plan, "S04")], NOW).trash;
    trash = addDeleted(trash, plan, [st(plan, "S07")], NOW).trash;
    const data = JSON.parse(trashToText(trash));
    // In the text's order, S07's (id 2) comes first; S04's is given id 2 too, and so dropped.
    data.entries[1] = { ...data.entries[1], id: 2 };
    const text = JSON.stringify(data);
    assert.deepEqual(trashFromText(text).entries, [trash.entries[0]]);
    assert.equal(trashTextProblem(text), "damaged");
  });

  test("entries out of order come back in order; more than the limit keeps the newest", () => {
    const trash = trashOfDeletes(TRASH_LIMIT);
    const data = JSON.parse(trashToText(trash));
    const reversed = JSON.stringify({ ...data, entries: [...data.entries].reverse() });
    assert.deepEqual(trashFromText(reversed), trash);
    assert.equal(trashTextProblem(reversed), null);
    // One more entry than the limit, older than all the rest: it's left out.
    const older = { ...data.entries.at(-1), id: data.nextEntryId, deletion: 1 };
    const oldestFirst = data.entries.map((entry) => ({ ...entry, deletion: entry.deletion + 1 }));
    const tooMany = JSON.stringify({
      ...data,
      entries: [older, ...oldestFirst],
      nextEntryId: data.nextEntryId + 1,
      nextDeletion: data.nextDeletion + 1,
    });
    const read = trashFromText(tooMany);
    assert.equal(read.entries.length, TRASH_LIMIT);
    assert.equal(read.entries.some((entry) => entry.id === older.id), false);
    assert.equal(trashTextProblem(tooMany), null);
  });

  test("trashTextProblem: null for trashToText of an empty trash and of one with an entry of each kind", () => {
    assert.equal(trashTextProblem(trashToText(emptyTrash())), null);
    assert.equal(trashTextProblem(trashToText(trashOfEachKind())), null);
  });

  test('trashTextProblem: "newer" for version 2, with valid properties and with properties version 1 doesn\'t know', () => {
    const trash = trashOfDeletes(1);
    assert.equal(trashTextProblem(frameText(trash, { version: 2 })), "newer");
    assert.equal(trashTextProblem(frameText(trash, { version: 2, shelves: [], entries: "elsewhere" })), "newer");
    assert.equal(trashTextProblem(JSON.stringify({ format: TRASH_FORMAT, version: 7 })), "newer");
  });

  test('trashTextProblem: "damaged" for every unreadable frame (version 2 aside), for 5 and null; it never throws', () => {
    for (const [name, text] of unreadableFrames()) {
      assert.equal(trashTextProblem(text), "damaged", name);
    }
    for (const value of [5, null, undefined, {}, [], "", "null"]) {
      assert.doesNotThrow(() => trashTextProblem(value));
      assert.equal(trashTextProblem(value), "damaged");
    }
  });

  // --- Immutability ---

  test("no function changes the trash, entries, plan or change it's given", () => {
    const plan = deleteTestPlan();
    const planBefore = snapshot(plan);
    const trash = trashOfDeletes(Math.min(TRASH_LIMIT, 2));
    const trashBefore = snapshot(trash);
    const added = addDeleted(trash, plan, [st(plan, "S07"), rz(plan)], NOW);
    const addedBefore = snapshot(added);
    const pasted = pasteEntry(plan, added.trash, added.trash.entries[0].id, between(0));
    const pastedChangeBefore = snapshot(pasted.change);
    clearTrash(added.trash);
    undoTrashChange(added.trash, added.change);
    redoTrashChange(added.trash, added.change);
    undoTrashChange(pasted.trash, pasted.change);
    redoTrashChange(pasted.trash, pasted.change);
    trashToText(added.trash);
    assert.equal(snapshot(plan), planBefore);
    assert.equal(snapshot(trash), trashBefore);
    assert.equal(snapshot(added), addedBefore);
    assert.equal(snapshot(pasted.change), pastedChangeBefore);
  });
});
