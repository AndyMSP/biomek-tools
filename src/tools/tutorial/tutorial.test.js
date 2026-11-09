// Unit tests for tutorial.js. Each test comes from the "Test cases" section of tutorial.md (section
// 9). Each tutorial is walked through step by step: the plan is changed with the transfer designer's
// logic as the step asks the reader to, and the page facts a step reads are set in the view, so
// each step's done is seen false before its edits and true after.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { LABWARE_TYPES } from "../../../config/labware-types.js";
import { DECK } from "../../../config/deck.js";
import { TIP_TYPES, MIX_VOLUME_LIMITS, DEFAULT_PROBE_COUNT } from "../../../config/tip-types.js";
import { DEFAULT_PIPETTING_MODE } from "../../../config/pipetting-modes.js";
import { BASE_FOLDER } from "../../../config/paths.js";
import { DEFAULT_MIX } from "../../../config/mixing.js";
import {
  START,
  emptyPlan,
  setExperimentName,
  setLabel,
  addComponent,
  addToWells,
  renameStage,
  addTransfers,
  addStageWithNewTips,
  setConstituents,
  changeVolume,
  removeTransfer,
  changeStageSettings,
  modeSettings,
  setStageMix,
  setWellLabel,
  setTipProbes,
  probesFor,
  stageOrder,
  transfersIn,
  addTransferTable,
  updateTransferTable,
  addRandomization,
  setRandomization,
  renameRandomization,
  runRandomization,
} from "../transfer-designer/transfer-designer.js";
import { startingPlan, STARTING_PLAN_NAMES } from "./tutorial-plans.js";
import {
  TUTORIALS,
  tutorialById,
  stepState,
  parseMarkup,
  parseInline,
  PRACTICE_TABLE_TEXT,
  stageAt,
  transfersFrom,
  startVolume,
  hasComponent,
  carries,
  stageNameHas,
  startsNewTips,
  tipProbes,
  aspirateMode,
  dispenseMode,
  mixesBeforeAspirating,
  mixesAfterDispensing,
  wellLabelText,
  tracesAtEnd,
  totalAtEnd,
  totalAfterStage,
  isOut,
  isOpen,
} from "./tutorial.js";

// A labware's type, from the deck description, e.g. typeOf("Res1") → the DeepReservoir12 entry.
function typeOf(labware) {
  return LABWARE_TYPES[DECK.find((entry) => entry.name === labware).labwareType];
}

// A view of `plan` as the page would give it, with nothing open but Start, nothing out, and
// `overrides` on top.
function viewOf(plan, overrides = {}) {
  return {
    plan,
    open: START,
    labwareOut: [],
    message: null,
    problemCount: 0,
    pointedWell: null,
    editingBox: null,
    addingComponent: false,
    transferListsShown: [],
    headerBox: null,
    dialog: null,
    randomizationCard: null,
    ...overrides,
  };
}

// The step at `index` of the tutorial with that ID.
function stepOf(id, index) {
  return tutorialById(id).steps[index];
}

// stepState of the step at `index` of tutorial `id` with `view`.
function stateOf(id, index, view, wasDone = false) {
  return stepState(stepOf(id, index), view, wasDone);
}

// The text of every run of a parsed body, joined, for checking what a body says.
function bodyText(body) {
  const runsText = (runs) => runs.map((run) => run.text).join("");
  return body
    .map((block) => {
      if (block.items !== undefined) {
        return block.items.map(runsText).join("\n");
      }
      if (block.rows !== undefined) {
        return block.rows.map((row) => row.map(runsText).join(" | ")).join("\n");
      }
      return runsText(block.runs);
    })
    .join("\n");
}

// A well on the deck.
function at(labware, well) {
  return { labware, well };
}

// One transfer of `volume` from `source` into each of `wells` of `labware`, in stage `stage`.
function transfersInto(source, labware, wells, volume, stage) {
  return wells.map((well) => ({ type: "transfer", source, destination: at(labware, well), volume, stage }));
}

// The culture wells, B2 to D5, row by row.
const CULTURE_WELLS = ["B", "C", "D"].flatMap((row) => [2, 3, 4, 5].map((column) => `${row}${column}`));

// The plan with stage `n` dispensing Non-Contact.
function dispensingNonContact(plan, n) {
  const id = stageAt(plan, n);
  const settings = plan.stageList.get(id).settings;
  return changeStageSettings(plan, id, { ...settings, ...modeSettings("destination", "Non-Contact") });
}

// A walk-through check: done is false for `view` before and true for `after`.
function assertStepDoneByEdit(id, index, before, after) {
  assert.equal(stateOf(id, index, before).done, false, `${id} step ${index} is done before its edits`);
  assert.equal(stateOf(id, index, after).done, true, `${id} step ${index} isn't done after its edits`);
}

// The steps on their tutorial's starting plan that are done at once: those whose done is the absence
// of what the step before adds (tutorial 2, steps 5 and 8).
const DONE_AT_ONCE = new Set(["checking 5", "checking 8"]);

describe("tutorial", () => {
  describe("the tutorials", () => {
    test("five, in menu order, with unique IDs", () => {
      assert.deepEqual(
        TUTORIALS.map((tutorial) => tutorial.id),
        ["first-run", "checking", "conditions", "transfer-tables", "randomizing"],
      );
      assert.deepEqual(
        TUTORIALS.map((tutorial) => tutorial.title),
        ["Your first run", "Checking your plan", "Making conditions", "Transfer tables", "Randomizing a plate"],
      );
      assert.equal(new Set(TUTORIALS.map((tutorial) => tutorial.id)).size, 5);
    });

    test("each starts and ends with a step without done", () => {
      for (const tutorial of TUTORIALS) {
        assert.equal(tutorial.steps[0].done, undefined, tutorial.id);
        assert.equal(tutorial.steps.at(-1).done, undefined, tutorial.id);
      }
    });

    test("each names a starting plan that tutorial-plans makes", () => {
      for (const tutorial of TUTORIALS) {
        assert.ok(STARTING_PLAN_NAMES.includes(tutorial.startPlan), tutorial.id);
        assert.doesNotThrow(() => startingPlan(tutorial.startPlan));
      }
    });

    test("every step has a title, and its body parses on its starting plan's view", () => {
      for (const tutorial of TUTORIALS) {
        const view = viewOf(startingPlan(tutorial.startPlan));
        tutorial.steps.forEach((step, index) => {
          assert.equal(typeof step.title, "string", `${tutorial.id} ${index}`);
          assert.ok(step.title.length > 0);
          const body = typeof step.body === "function" ? step.body(view) : step.body;
          assert.ok(parseMarkup(body).length > 0, `${tutorial.id} ${index} has an empty body`);
        });
      }
    });

    test("menu entries: summaries and minutes", () => {
      for (const tutorial of TUTORIALS) {
        assert.ok(tutorial.summary.length > 0);
        assert.ok(Number.isInteger(tutorial.minutes) && tutorial.minutes > 0);
      }
      assert.equal(tutorialById("conditions").minutes, 15);
      assert.equal(tutorialById("nothing"), null);
    });

    test("the tutorials can't be changed", () => {
      assert.ok(Object.isFrozen(TUTORIALS));
      assert.ok(Object.isFrozen(TUTORIALS[0]));
      assert.ok(Object.isFrozen(TUTORIALS[0].steps));
    });
  });

  describe("parseMarkup", () => {
    test("a paragraph, joining its lines", () => {
      assert.deepEqual(parseMarkup("One line\nand another."), [
        { kind: "paragraph", runs: [{ kind: "text", text: "One line and another." }] },
      ]);
    });

    test("a numbered list keeps its first number", () => {
      assert.deepEqual(parseMarkup("2. Second\n3. Third"), [
        {
          kind: "numbered",
          start: 2,
          items: [[{ kind: "text", text: "Second" }], [{ kind: "text", text: "Third" }]],
        },
      ]);
    });

    test("a bulleted list, a note and a warning", () => {
      assert.deepEqual(parseMarkup("- a\n- b\n\n> quiet\n\n! loud"), [
        { kind: "bulleted", items: [[{ kind: "text", text: "a" }], [{ kind: "text", text: "b" }]] },
        { kind: "note", runs: [{ kind: "text", text: "quiet" }] },
        { kind: "warning", runs: [{ kind: "text", text: "loud" }] },
      ]);
    });

    test("a table, with empty cells", () => {
      const [table] = parseMarkup("| Name | A | B |\n| Control | 1000 |  |");
      assert.equal(table.kind, "table");
      assert.deepEqual(table.rows, [
        [[{ kind: "text", text: "Name" }], [{ kind: "text", text: "A" }], [{ kind: "text", text: "B" }]],
        [[{ kind: "text", text: "Control" }], [{ kind: "text", text: "1000" }], []],
      ]);
    });

    test("each inline mark, alone and together", () => {
      assert.deepEqual(parseMarkup("**bold**")[0].runs, [{ kind: "bold", text: "bold" }]);
      assert.deepEqual(parseMarkup("`code`")[0].runs, [{ kind: "code", text: "code" }]);
      assert.deepEqual(parseMarkup("[Enter]")[0].runs, [{ kind: "key", text: "Enter" }]);
      assert.deepEqual(parseMarkup("Press [Ctrl]+[V] in **Paste**, then type `Practice1` ✎ ‹ › ⟳.")[0].runs, [
        { kind: "text", text: "Press " },
        { kind: "key", text: "Ctrl" },
        { kind: "text", text: "+" },
        { kind: "key", text: "V" },
        { kind: "text", text: " in " },
        { kind: "bold", text: "Paste" },
        { kind: "text", text: ", then type " },
        { kind: "code", text: "Practice1" },
        { kind: "text", text: " ✎ ‹ › ⟳." },
      ]);
    });

    test("marks inside list items and notes", () => {
      const [list, note] = parseMarkup("1. Click **Save**.\n\n> Press [Escape].");
      assert.deepEqual(list.items[0], [
        { kind: "text", text: "Click " },
        { kind: "bold", text: "Save" },
        { kind: "text", text: "." },
      ]);
      assert.deepEqual(note.runs[1], { kind: "key", text: "Escape" });
    });

    test("parseInline: the inline marks, alone and together, and no block marks", () => {
      assert.deepEqual(parseInline("A1 `Control`"), [
        { kind: "text", text: "A1 " },
        { kind: "code", text: "Control" },
      ]);
      assert.deepEqual(parseInline("**Bold** then [Esc]"), [
        { kind: "bold", text: "Bold" },
        { kind: "text", text: " then " },
        { kind: "key", text: "Esc" },
      ]);
      assert.deepEqual(parseInline("- not a list"), [{ kind: "text", text: "- not a list" }]);
      assert.deepEqual(parseInline("> not a note"), [{ kind: "text", text: "> not a note" }]);
      assert.deepEqual(parseInline("1. not numbered"), [{ kind: "text", text: "1. not numbered" }]);
      assert.deepEqual(parseInline(""), []);
    });

    test("text holding < or & stays text", () => {
      assert.deepEqual(parseMarkup("a <b> & c")[0].runs, [{ kind: "text", text: "a <b> & c" }]);
    });

    test("a line starting with none of the block marks is a paragraph", () => {
      assert.equal(parseMarkup("-not a list")[0].kind, "paragraph");
      assert.equal(parseMarkup("1.5 µL")[0].kind, "paragraph");
    });
  });

  describe("no HTML in the steps", () => {
    test("no body contains <, on its tutorial's starting plan", () => {
      for (const tutorial of TUTORIALS) {
        const view = viewOf(startingPlan(tutorial.startPlan));
        tutorial.steps.forEach((step, index) => {
          const body = typeof step.body === "function" ? step.body(view) : step.body;
          assert.ok(!body.includes("<"), `${tutorial.id} step ${index}`);
        });
      }
    });
  });

  describe("each step's done and target", () => {
    test("on a view of its starting plan, every step with done gives false, except those done at once", () => {
      for (const tutorial of TUTORIALS) {
        const view = viewOf(startingPlan(tutorial.startPlan));
        tutorial.steps.forEach((step, index) => {
          if (step.done === undefined) {
            return;
          }
          const expected = DONE_AT_ONCE.has(`${tutorial.id} ${index}`);
          assert.equal(stepState(step, view, false).done, expected, `${tutorial.id} step ${index}`);
        });
      }
    });

    test("a step without done gives its target whatever the view", () => {
      for (const tutorial of TUTORIALS) {
        const plan = startingPlan(tutorial.startPlan);
        tutorial.steps.forEach((step, index) => {
          if (step.done !== undefined || step.target === undefined) {
            return;
          }
          for (const view of [viewOf(plan), viewOf(plan, { open: "end", labwareOut: ["Res1"] })]) {
            const state = stepState(step, view, false);
            assert.equal(state.done, true);
            assert.deepEqual(state.target, step.target(view), `${tutorial.id} step ${index}`);
          }
        });
      }
    });

    test("tutorial 1, Your first run, step by step", () => {
      const id = "first-run";
      let plan = startingPlan("empty");
      let out = [];
      // A view of the plan as it is now, with the labware out now and `overrides` on top.
      const view = (overrides = {}) => viewOf(plan, { labwareOut: out, ...overrides });

      // 1. Name the experiment, and its warning for a name not starting with Practice.
      let before = view();
      plan = setExperimentName(plan, "Exp36");
      assert.match(bodyText(stateOf(id, 1, view()).body), /start the name with Practice/);
      assert.equal(stateOf(id, 1, view()).done, false);
      plan = setExperimentName(plan, "practice1");
      assertStepDoneByEdit(id, 1, before, view());
      assert.doesNotMatch(bodyText(stateOf(id, 1, view()).body), /start the name with/);
      assert.deepEqual(stateOf(id, 1, before).target, { kind: "button", name: "experimentName" });

      // 2. Bring out the labware: Res1's chip, then Plate1's.
      assert.deepEqual(stateOf(id, 2, view()).target, { kind: "trayChip", labware: "Res1" });
      before = view();
      out = ["Res1"];
      assert.deepEqual(stateOf(id, 2, view()).target, { kind: "trayChip", labware: "Plate1" });
      assert.deepEqual(stateOf(id, 2, view()).checklist, {
        inline: true,
        items: [
          { done: true, text: "Res1" },
          { done: false, text: "Plate1" },
        ],
      });
      out = ["Res1", "Plate1"];
      assertStepDoneByEdit(id, 2, before, view());
      assert.equal(stateOf(id, 2, view()).target, null);

      // 3. Rename the plate.
      before = view();
      plan = setLabel(plan, "Plate1", "Culture plate");
      assertStepDoneByEdit(id, 3, before, view());

      // 4. Start: no done, rings Start.
      assert.deepEqual(stateOf(id, 4, view()).target, { kind: "entry", key: START });

      // 5. Add the components, done only once the + New box is closed.
      before = view();
      plan = addComponent(addComponent(plan, "Base media", "#4e79a7"), "Cells", "#f28e2b");
      assert.equal(stateOf(id, 5, view({ addingComponent: true })).done, false);
      assertStepDoneByEdit(id, 5, before, view());

      // 6. Fill the troughs: Res1 1 rung until it's filled, then Res1 2.
      before = view();
      plan = addToWells(plan, [at("Res1", "1")], "Base media", 6000);
      assert.deepEqual(stateOf(id, 6, view()).target, { kind: "well", labware: "Res1", well: "2" });
      assert.equal(stateOf(id, 6, view()).done, false);
      plan = addToWells(plan, [at("Res1", "2")], "Cells", 3000);
      assertStepDoneByEdit(id, 6, before, view());

      // 7. Rename stage 1: its entry, then the editing box while open, then its ✎.
      const stage1 = stageAt(plan, 1);
      assert.deepEqual(stateOf(id, 7, view()).target, { kind: "entry", key: stage1 });
      assert.deepEqual(stateOf(id, 7, view({ open: stage1 })).target, { kind: "stagePencil", id: stage1 });
      assert.deepEqual(stateOf(id, 7, view({ open: stage1, editingBox: { kind: "stage", key: stage1 } })).target, {
        kind: "editingBox",
      });
      before = view();
      plan = renameStage(plan, stage1, "Base media");
      assertStepDoneByEdit(id, 7, before, view());

      // 8. Media into the plate: done at 12 transfers.
      before = view({ open: stage1 });
      plan = addTransfers(plan, transfersInto(at("Res1", "1"), "Plate1", CULTURE_WELLS.slice(0, 11), 100, stage1));
      assert.equal(stateOf(id, 8, view({ open: stage1 })).done, false);
      assert.match(bodyText(stateOf(id, 8, view()).body), /: 11 so far\./);
      plan = addTransfers(plan, transfersInto(at("Res1", "1"), "Plate1", ["D5"], 100, stage1));
      assertStepDoneByEdit(id, 8, before, view({ open: stage1 }));
      assert.deepEqual(stateOf(id, 8, view()).keepClear, [{ kind: "labware", labware: "Plate1" }]);

      // 9. A Cells stage with new tips: the seam above End, then stage 2's ✎.
      assert.deepEqual(stateOf(id, 9, view()).target, { kind: "endSeam" });
      before = view();
      const added = addStageWithNewTips(plan, null);
      plan = added.plan;
      assert.deepEqual(stateOf(id, 9, view({ open: added.id })).target, { kind: "stagePencil", id: added.id });
      plan = renameStage(plan, added.id, "Cells");
      assertStepDoneByEdit(id, 9, before, view({ open: added.id }));

      // 10. Cells into the wells.
      before = view();
      plan = addTransfers(plan, transfersInto(at("Res1", "2"), "Plate1", CULTURE_WELLS, 50, added.id));
      assertStepDoneByEdit(id, 10, before, view());

      // 11. Walk through: done once End is open.
      assertStepDoneByEdit(id, 11, view(), view({ open: "end" }));

      // 12. Save, 13. Write files.
      assertStepDoneByEdit(
        id,
        12,
        view(),
        view({ message: { text: "Saved the plan as transfer plan 2026-11-08.json.", kind: "ok" } }),
      );
      assert.deepEqual(stateOf(id, 13, view()).target, { kind: "button", name: "biomekFiles" });
      assert.deepEqual(stateOf(id, 13, view({ headerBox: "biomek" })).target, { kind: "button", name: "writeFiles" });
      assertStepDoneByEdit(
        id,
        13,
        view({ message: { text: "Saved the plan as transfer plan 2026-11-08.json.", kind: "ok" } }),
        view({ message: { text: "Saved 2026-11-08_120000_Practice1.zip, in your downloads. Unzip it…", kind: "ok" } }),
      );

      // The plan made here is the next tutorial's starting plan, as far as its logic goes.
      const fromPlans = startingPlan("firstRunDone");
      assert.equal(totalAtEnd(plan, "Plate1", "B2"), totalAtEnd(fromPlans, "Plate1", "B2"));
    });

    test("tutorial 2, Checking your plan, step by step", () => {
      const id = "checking";
      let plan = startingPlan("firstRunDone");
      const out = ["Res1", "Plate1"];
      // A view of the plan as it is now, with the labware out now and `overrides` on top.
      const view = (overrides = {}) => viewOf(plan, { labwareOut: out, ...overrides });
      const [media, cells] = stageOrder(plan);

      // 1. Look at B2: no done, rings it.
      assert.deepEqual(stateOf(id, 1, view()).target, { kind: "well", labware: "Plate1", well: "B2" });

      // 2. Cell density: Start's entry, then Cells' ✎, then the box.
      assert.deepEqual(stateOf(id, 2, view({ open: cells })).target, { kind: "entry", key: START });
      assert.deepEqual(stateOf(id, 2, view()).target, { kind: "componentPencil", name: "Cells" });
      assert.deepEqual(stateOf(id, 2, view({ editingBox: { kind: "component", key: "Cells" } })).target, {
        kind: "editingBox",
      });
      let before = view();
      plan = setConstituents(plan, "Cells", [{ name: "Cells", amount: 1e6, unit: "cells/mL" }]);
      assertStepDoneByEdit(id, 2, before, view());

      // 3. Change a volume: the entry, Show transfers, then the row's volume.
      assert.deepEqual(stateOf(id, 3, view()).target, { kind: "entry", key: media });
      assert.deepEqual(stateOf(id, 3, view({ open: media })).target, { kind: "showTransfers", id: media });
      assert.deepEqual(stateOf(id, 3, view({ open: media, transferListsShown: [media] })).target, {
        kind: "transferVolume",
        id: media,
        source: at("Res1", "1"),
        destination: at("Plate1", "B2"),
      });
      before = view();
      const b2 = transfersFrom(plan, 1, at("Res1", "1"), "Plate1", "B2")[0];
      plan = changeVolume(plan, b2.position, 120);
      assertStepDoneByEdit(id, 3, before, view());

      // 4. Overfill B2: N reads the same before and after the transfer.
      const textBefore = bodyText(stateOf(id, 4, view({ open: cells })).body);
      assert.match(textBefore, new RegExp(`B2 now holds ${120 + 50 + 300} µL, more than the ${typeOf("Plate1").capacity} µL`));
      assert.deepEqual(stateOf(id, 4, view()).target, { kind: "entry", key: cells });
      assert.deepEqual(stateOf(id, 4, view({ open: cells })).target, { kind: "well", labware: "Res1", well: "2" });
      const unfilled = plan;
      plan = addTransfers(plan, transfersInto(at("Res1", "2"), "Plate1", ["B2"], 300, cells));
      assert.equal(bodyText(stateOf(id, 4, view({ open: cells })).body), textBefore);
      assertStepDoneByEdit(id, 4, view({ open: cells }), view({ open: cells, problemCount: 1 }));
      assert.deepEqual(stateOf(id, 4, view({ problemCount: 1 })).target, null);

      // 5. Undo it.
      assertStepDoneByEdit(id, 5, view({ problemCount: 1 }), view({ problemCount: 0 }));
      plan = unfilled;

      // 6. Into the dead volume: S, U and R from the plan and config.
      const dead = typeOf("Res1").deadVolume;
      assert.match(
        bodyText(stateOf(id, 6, view()).body),
        new RegExp(`keeps ${dead} µL .* started with 3000 µL and the cells use 600 µL, so only ${3000 - 600 - dead} µL`),
      );
      before = view({ open: cells });
      plan = addTransfers(plan, transfersInto(at("Res1", "2"), "Res1", ["5"], 500, cells));
      assert.equal(stateOf(id, 6, view({ open: cells })).done, false);
      assertStepDoneByEdit(id, 6, before, view({ open: cells, problemCount: 1 }));

      // 7. Fix it at the start.
      assert.deepEqual(stateOf(id, 7, view({ open: cells })).target, { kind: "entry", key: START });
      assert.deepEqual(stateOf(id, 7, view()).target, { kind: "well", labware: "Res1", well: "2" });
      before = view({ problemCount: 1 });
      plan = addToWells(plan, [at("Res1", "2")], "Cells", 1000);
      assertStepDoneByEdit(id, 7, before, view({ problemCount: 0 }));

      // 8. Remove the test transfer.
      assert.deepEqual(stateOf(id, 8, view({ open: cells, transferListsShown: [cells] })).target, {
        kind: "transferRemove",
        id: cells,
        source: at("Res1", "2"),
        destination: at("Res1", "5"),
      });
      before = view();
      plan = removeTransfer(plan, transfersFrom(plan, 2, at("Res1", "2"), "Res1", "5")[0].position);
      assertStepDoneByEdit(id, 8, before, view());

      // 9. A possible trace, sticky once seen.
      assert.deepEqual(stateOf(id, 9, view()).target, { kind: "entry", key: "end" });
      assert.deepEqual(stateOf(id, 9, view({ open: "end" })).target, { kind: "well", labware: "Res1", well: "2" });
      assertStepDoneByEdit(id, 9, view({ open: "end" }), view({ open: "end", pointedWell: at("Res1", "2") }));
      assert.equal(stateOf(id, 9, view({ open: "end" }), true).done, true);

      // 10. Non-Contact, then looking at End: the traces are gone. Sticky, like step 9.
      assert.deepEqual(stateOf(id, 10, view()).target, { kind: "entry", key: cells });
      const atTrough = { open: "end", pointedWell: at("Res1", "2") };
      assert.equal(stateOf(id, 10, view(atTrough)).done, false);
      before = view();
      plan = dispensingNonContact(plan, 2);
      assert.equal(stateOf(id, 10, view()).done, false);
      assert.deepEqual(stateOf(id, 10, view()).target, { kind: "entry", key: "end" });
      assert.deepEqual(stateOf(id, 10, view({ open: "end" })).target, { kind: "well", labware: "Res1", well: "2" });
      assertStepDoneByEdit(id, 10, before, view(atTrough));
      assert.equal(stateOf(id, 10, view({ open: "end" }), true).done, true);
      assert.deepEqual(tracesAtEnd(plan, "Res1", "2"), []);

      // 11. Following trough 2: 4000 at Start, 4000 after Base media, 3400 after Cells.
      assert.match(bodyText(stateOf(id, 11, view()).body), /4000 µL at Start, still 4000 after Base media, 3400 after Cells/);
    });

    test("tutorial 3, Making conditions, step by step", () => {
      const id = "conditions";
      let plan = startingPlan("conditionStocks");
      let out = ["Res1"];
      // A view of the plan as it is now, with the labware out now and `overrides` on top.
      const view = (overrides = {}) => viewOf(plan, { labwareOut: out, ...overrides });

      // 1. Bring out and rename Deep1.
      let before = view();
      out = ["Res1", "Deep1"];
      assert.deepEqual(stateOf(id, 1, view()).target, { kind: "labwareHeading", labware: "Deep1" });
      plan = setLabel(plan, "Deep1", "Conditions");
      assertStepDoneByEdit(id, 1, before, view());

      // 2. Base media into A1 to A4.
      const s1 = stageAt(plan, 1);
      before = view();
      plan = renameStage(plan, s1, "Base media");
      assert.deepEqual(stateOf(id, 2, view()).target, { kind: "well", labware: "Res1", well: "1" });
      plan = addTransfers(plan, transfersInto(at("Res1", "1"), "Deep1", ["A1"], 1000, s1));
      plan = addTransfers(plan, transfersInto(at("Res1", "1"), "Deep1", ["A2", "A3", "A4"], 800, s1));
      assertStepDoneByEdit(id, 2, before, view());

      // 3. A Glucose stage with new tips, mixing after dispensing.
      before = view();
      const glucose = addStageWithNewTips(plan, null);
      plan = renameStage(glucose.plan, glucose.id, "Glucose");
      assert.equal(stateOf(id, 3, view()).done, false);
      plan = setStageMix(plan, glucose.id, "destination", DEFAULT_MIX);
      assertStepDoneByEdit(id, 3, before, view());
      assert.match(
        bodyText(stateOf(id, 3, view()).body),
        new RegExp(`a ${TIP_TYPES[0]} tip mixes at most ${MIX_VOLUME_LIMITS[TIP_TYPES[0]]} µL`),
      );

      // 4. Add the glucose.
      before = view();
      plan = addTransfers(plan, transfersInto(at("Res1", "2"), "Deep1", ["A2"], 200, glucose.id));
      plan = addTransfers(plan, transfersInto(at("Res1", "2"), "Deep1", ["A4"], 100, glucose.id));
      assertStepDoneByEdit(id, 4, before, view());

      // 5. Yeast extract: a new stage with new tips already mixes, copying the stage before it.
      before = view();
      assert.deepEqual(stateOf(id, 5, view()).target, { kind: "endSeam" });
      const yeast = addStageWithNewTips(plan, null);
      assert.equal(mixesAfterDispensing(yeast.plan, 3), true);
      plan = renameStage(yeast.plan, yeast.id, "Yeast extract");
      assert.deepEqual(stateOf(id, 5, view()).target, { kind: "well", labware: "Res1", well: "3" });
      plan = addTransfers(plan, transfersInto(at("Res1", "3"), "Deep1", ["A3"], 200, yeast.id));
      plan = addTransfers(plan, transfersInto(at("Res1", "3"), "Deep1", ["A4"], 100, yeast.id));
      assertStepDoneByEdit(id, 5, before, view());

      // 6. Name the conditions.
      before = view();
      for (const [well, label] of [["A1", "Control"], ["A2", "Glucose"], ["A3", "Yeast"]]) {
        plan = setWellLabel(plan, at("Deep1", well), label);
      }
      assert.deepEqual(stateOf(id, 6, view()).target, { kind: "well", labware: "Deep1", well: "A4" });
      plan = setWellLabel(plan, at("Deep1", "A4"), "Both");
      assertStepDoneByEdit(id, 6, before, view());

      // 7. Swap Res1 for the culture plate.
      before = view();
      assert.deepEqual(stateOf(id, 7, view()).target, { kind: "trayChip", labware: "Res1" });
      out = ["Deep1", "Plate1"];
      plan = setLabel(plan, "Plate1", "Culture plate");
      assertStepDoneByEdit(id, 7, before, view());

      // 8. To plate: a new stage that doesn't mix, then each condition down its column.
      before = view();
      const toPlate = addStageWithNewTips(plan, null);
      plan = renameStage(toPlate.plan, toPlate.id, "To plate");
      assert.equal(stateOf(id, 8, view()).checklist.items[0].done, false);
      plan = setStageMix(plan, toPlate.id, "destination", null);
      assert.deepEqual(stateOf(id, 8, view()).target, { kind: "well", labware: "Deep1", well: "A1" });
      [
        ["A1", "2"],
        ["A2", "3"],
        ["A3", "4"],
        ["A4", "5"],
      ].forEach(([well, column]) => {
        plan = addTransfers(
          plan,
          transfersInto(at("Deep1", well), "Plate1", ["B", "C", "D"].map((row) => `${row}${column}`), 100, toPlate.id),
        );
      });
      assertStepDoneByEdit(id, 8, before, view());

      // 9. Bring the stocks back.
      before = view();
      out = ["Res1", "Plate1"];
      assertStepDoneByEdit(id, 9, before, view());

      // 10. Gentle pipetting: Slow, mixing before aspirating.
      before = view();
      const cellsStage = addStageWithNewTips(plan, null);
      plan = renameStage(cellsStage.plan, cellsStage.id, "Cells");
      const settings = plan.stageList.get(cellsStage.id).settings;
      plan = changeStageSettings(plan, cellsStage.id, { ...settings, ...modeSettings("source", "Slow") });
      assert.equal(stateOf(id, 10, view()).done, false);
      plan = setStageMix(plan, cellsStage.id, "source", DEFAULT_MIX);
      assert.equal(aspirateMode(plan, 5), "Slow");
      assertStepDoneByEdit(id, 10, before, view());

      // 11. Cells into the 12 wells.
      before = view();
      plan = addTransfers(plan, transfersInto(at("Res1", "4"), "Plate1", CULTURE_WELLS, 50, cellsStage.id));
      assertStepDoneByEdit(id, 11, before, view());

      // 12. 8 probes for the Cells stage's tips.
      assert.deepEqual(stateOf(id, 12, view()).target, { kind: "tipPencil", key: cellsStage.id });
      before = view();
      plan = setTipProbes(plan, cellsStage.id, probesFor(8));
      assertStepDoneByEdit(id, 12, before, view());

      // 13. Walk through to End, with no problems.
      assert.deepEqual(stateOf(id, 13, view()).target, { kind: "trayChip", labware: "Deep1" });
      out = ["Res1", "Deep1", "Plate1"];
      assertStepDoneByEdit(id, 13, view(), view({ open: "end" }));

      // 14. B2's possible traces at End.
      assert.deepEqual(tracesAtEnd(plan, "Plate1", "B2"), ["Glucose", "Yeast extract"]);
      assertStepDoneByEdit(id, 14, view({ open: "end" }), view({ open: "end", pointedWell: at("Plate1", "B2") }));
      assert.equal(stateOf(id, 14, view({ open: "end" }), true).done, true);
    });

    test("tutorial 3, step 5: a new stage with new tips copies the mixing of the stage before it", () => {
      let plan = startingPlan("conditionStocks");
      const glucose = addStageWithNewTips(plan, null);
      plan = setStageMix(glucose.plan, glucose.id, "destination", DEFAULT_MIX);
      const yeast = addStageWithNewTips(plan, null);
      assert.equal(mixesAfterDispensing(yeast.plan, 3), true);
    });

    test("tutorial 4, Transfer tables, step by step", () => {
      const id = "transfer-tables";
      let plan = startingPlan("tableStocks");
      let out = ["Res1"];
      // A view of the plan as it is now, with the labware out now and `overrides` on top.
      const view = (overrides = {}) => viewOf(plan, { labwareOut: out, ...overrides });

      // 1. Name the wells.
      let before = view();
      out = ["Res1", "Deep1"];
      assert.deepEqual(stateOf(id, 1, view()).target, { kind: "well", labware: "Deep1", well: "A1" });
      for (const [well, label] of [["A1", "Control"], ["A2", "With glucose"], ["A3", "With yeast"], ["A4", "Both"]]) {
        plan = setWellLabel(plan, at("Deep1", well), label);
      }
      assertStepDoneByEdit(id, 1, before, view());

      // 2. Paste the table: the seam, then the dialog, then its main button.
      assert.deepEqual(stateOf(id, 2, view()).target, { kind: "endSeam" });
      const wizardEmpty = view({ dialog: { kind: "wizard", step: "table", hasTable: false } });
      const wizardFull = view({ dialog: { kind: "wizard", step: "table", hasTable: true } });
      assert.deepEqual(stateOf(id, 2, wizardEmpty).target, { kind: "dialog" });
      assert.equal(stateOf(id, 2, wizardFull).target, null);
      assertStepDoneByEdit(id, 2, wizardEmpty, wizardFull);
      assert.deepEqual(stateOf(id, 2, view()).target, { kind: "endSeam" });
      assert.deepEqual(stepOf(id, 2).copy, { label: "Copy this table", text: PRACTICE_TABLE_TEXT });
      assert.equal(
        PRACTICE_TABLE_TEXT,
        "Well name\tBase media\tGlucose\tYeast extract\nControl\t1000\t\t\nWith glucose\t800\t200\t\nWith yeast\t800\t\t200\nBoth\t800\t100\t100",
      );
      const markupTable = stateOf(id, 2, view()).body.find((block) => block.kind === "table");
      assert.equal(markupTable.rows.length, 5);
      assert.deepEqual(markupTable.rows[1].map((cell) => cell.map((run) => run.text).join("")), ["Control", "1000", "", ""]);

      // 3. Add: the plan has a transfer table.
      const table = PRACTICE_TABLE_TEXT.split("\n").map((row) => row.split("\t"));
      const sources = {
        "Base media": [at("Res1", "1")],
        Glucose: [at("Res1", "2")],
        "Yeast extract": [at("Res1", "3")],
      };
      before = wizardFull;
      const added = addTransferTable(plan, { table, sources }, null);
      plan = added.plan;
      assertStepDoneByEdit(id, 3, before, view());

      // 5. Make Both stronger: the table's ✎, then the wizard's main button.
      assert.deepEqual(stateOf(id, 5, view()).target, { kind: "tablePencil", id: added.id });
      assert.deepEqual(stateOf(id, 5, view({ dialog: { kind: "wizard", step: "review", hasTable: true } })).target, {
        kind: "dialogMain",
      });
      before = view();
      const stronger = table.map((row) => (row[0] === "Both" ? ["Both", "700", "150", "150"] : row));
      plan = updateTransferTable(plan, added.id, { table: stronger, sources });
      assertStepDoneByEdit(id, 5, before, view());

      // 6. Mix on the Glucose stage.
      const glucoseId = stageOrder(plan).find((stage) => plan.stageList.get(stage).name === "Glucose");
      const n = stageOrder(plan).indexOf(glucoseId) + 1;
      assert.deepEqual(stateOf(id, 6, view()).target, { kind: "entry", key: glucoseId });
      before = view();
      plan = setStageMix(plan, glucoseId, "destination", DEFAULT_MIX);
      assert.equal(mixesAfterDispensing(plan, n), true);
      assertStepDoneByEdit(id, 6, before, view());
    });

    test("tutorial 5, Randomizing a plate, step by step", () => {
      const id = "randomizing";
      let plan = startingPlan("conditionMedia");
      let out = ["Res1", "Deep1"];
      // A view of the plan as it is now, with the labware out now and `overrides` on top.
      const view = (overrides = {}) => viewOf(plan, { labwareOut: out, ...overrides });
      const sourceList = [
        { name: "Control", replicatesText: "", filler: false },
        { name: "With glucose", replicatesText: "", filler: false },
        { name: "With yeast", replicatesText: "", filler: false },
        { name: "Both", replicatesText: "", filler: false },
        { name: "PBS", replicatesText: "", filler: false },
      ];
      // The open card as the view gives it, with `changes` on top.
      const cardOf = (changes) => ({
        id: "r1",
        tab: "sources",
        sources: sourceList,
        fillCount: 0,
        volumeText: "50",
        seedText: "360310",
        ...changes,
      });

      // 1. Plate1 out, a randomization named Layout.
      let before = view();
      out = ["Res1", "Deep1", "Plate1"];
      assert.deepEqual(stateOf(id, 1, view()).target, { kind: "endSeam" });
      const added = addRandomization(plan, null, { seed: 360310, volume: 50 });
      plan = added.plan;
      assert.deepEqual(stateOf(id, 1, view()).target, { kind: "card", part: "name" });
      plan = renameRandomization(plan, added.id, "layout");
      assertStepDoneByEdit(id, 1, before, view());

      // 2. Sources: the ✎ while the card is closed; Deep1 A1; Res1 1; PBS's Filler.
      assert.deepEqual(stateOf(id, 2, view()).target, { kind: "randomizationPencil", id: added.id });
      assert.deepEqual(stateOf(id, 2, view({ randomizationCard: cardOf({ sources: [] }) })).target, {
        kind: "well",
        labware: "Deep1",
        well: "A1",
      });
      assert.deepEqual(stateOf(id, 2, view({ randomizationCard: cardOf({ sources: sourceList.slice(0, 4) }) })).target, {
        kind: "well",
        labware: "Res1",
        well: "1",
      });
      assert.deepEqual(stateOf(id, 2, view({ randomizationCard: cardOf() })).target, { kind: "cardFiller", name: "PBS" });
      const withFiller = sourceList.map((source) => (source.name === "PBS" ? { ...source, filler: true } : source));
      assertStepDoneByEdit(id, 2, view({ randomizationCard: cardOf() }), view({ randomizationCard: cardOf({ sources: withFiller }) }));
      assert.equal(stateOf(id, 2, view()).done, false);

      // 3. 12 replicates each.
      const twelve = withFiller.map((source) => (source.filler ? source : { ...source, replicatesText: "12" }));
      assertStepDoneByEdit(
        id,
        3,
        view({ randomizationCard: cardOf({ sources: withFiller }) }),
        view({ randomizationCard: cardOf({ sources: twelve }) }),
      );

      // 4. 60 wells to fill: the tab, then the plate.
      assert.deepEqual(stateOf(id, 4, view({ randomizationCard: cardOf() })).target, { kind: "card", part: "tabFill" });
      assert.deepEqual(stateOf(id, 4, view({ randomizationCard: cardOf({ tab: "fill" }) })).target, {
        kind: "well",
        labware: "Plate1",
        well: "B2",
      });
      assertStepDoneByEdit(
        id,
        4,
        view({ randomizationCard: cardOf({ tab: "fill", fillCount: 59 }) }),
        view({ randomizationCard: cardOf({ tab: "fill", fillCount: 60 }) }),
      );

      // 5. Volume 100, Randomize.
      assert.deepEqual(stateOf(id, 5, view({ randomizationCard: cardOf() })).target, { kind: "card", part: "volume" });
      assert.deepEqual(stateOf(id, 5, view({ randomizationCard: cardOf({ volumeText: "100" }) })).target, {
        kind: "card",
        part: "run",
      });
      before = view();
      const inner = ["B", "C", "D", "E", "F", "G"].flatMap((row) =>
        [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((column) => at("Plate1", `${row}${column}`)),
      );
      plan = setRandomization(plan, added.id, {
        sources: ["A1", "A2", "A3", "A4"]
          .map((well) => ({ labware: "Deep1", well, replicates: 12, filler: false, sharesTips: false }))
          .concat([{ labware: "Res1", well: "1", replicates: null, filler: true, sharesTips: false }]),
        fill: inner,
        volume: 100,
      });
      plan = runRandomization(plan, added.id);
      assertStepDoneByEdit(id, 5, before, view());

      // 7. A new seed: done once it has run with seed 37 and its card is closed.
      before = view();
      plan = runRandomization(setRandomization(plan, added.id, { seed: 37 }), added.id);
      assert.equal(stateOf(id, 7, view({ randomizationCard: cardOf({ seedText: "37" }) })).done, false);
      assertStepDoneByEdit(id, 7, before, view());

      // 8. The well map's zip.
      assertStepDoneByEdit(id, 8, view(), view({ message: { text: "Saved 2026-11-08_1_Practice5.zip.", kind: "ok" } }));
    });
  });

  describe("stepState", () => {
    test("a sticky step stays done once seen; one that isn't sticky doesn't", () => {
      const view = viewOf(startingPlan("empty"));
      const sticky = { title: "t", body: "b", sticky: true, done: () => false };
      const plain = { title: "t", body: "b", done: () => false };
      assert.equal(stepState(sticky, view, true).done, true);
      assert.equal(stepState(sticky, view, false).done, false);
      assert.equal(stepState(plain, view, true).done, false);
    });

    test("a step whose body, target or done throws gives done false, no target, an empty body", () => {
      const view = viewOf(startingPlan("empty"), { labwareOut: ["Res1"] });
      // A step function that throws.
      const thrower = () => {
        throw new Error("broken");
      };
      for (const step of [
        { title: "t", body: thrower, done: () => false },
        { title: "t", body: "b", target: thrower, done: () => false },
        { title: "t", body: "b", target: () => ({ kind: "undo" }), done: thrower },
      ]) {
        const state = stepState(step, view, false);
        assert.equal(state.done, false);
        assert.equal(state.target, null);
        assert.deepEqual(state.body, []);
        assert.deepEqual(state.checklist, { inline: false, items: [] });
        assert.deepEqual(state.keepClear, [{ kind: "labware", labware: "Res1" }]);
      }
    });

    test("a step on a null view (before the page has drawn) doesn't throw", () => {
      for (const tutorial of TUTORIALS) {
        for (const step of tutorial.steps) {
          assert.doesNotThrow(() => stepState(step, null, false));
        }
      }
    });

    test("the target is null once the step is done; the default keep-clear is every labware out", () => {
      const view = viewOf(startingPlan("empty"), { labwareOut: ["Res1", "Plate1"] });
      const state = stateOf("first-run", 2, view);
      assert.equal(state.done, true);
      assert.equal(state.target, null);
      assert.deepEqual(state.keepClear, [
        { kind: "labware", labware: "Res1" },
        { kind: "labware", labware: "Plate1" },
      ]);
    });
  });

  describe("helpers", () => {
    // A small plan: Media in Res1 1, two stages (the second on new tips), labels and transfers.
    function smallPlan() {
      let plan = addComponent(emptyPlan().plan, "Media", "#4e79a7");
      plan = setConstituents(plan, "Media", [{ name: "Cells", amount: 2e5, unit: "cells/mL" }]);
      plan = addToWells(plan, [at("Res1", "1")], "Media", 5000);
      const first = stageAt(plan, 1);
      plan = renameStage(plan, first, "Fill");
      plan = addTransfers(plan, transfersInto(at("Res1", "1"), "Plate1", ["A1", "A2"], 100, first));
      const second = addStageWithNewTips(plan, null);
      plan = renameStage(second.plan, second.id, "Top Up");
      plan = addTransfers(plan, transfersInto(at("Res1", "1"), "Plate1", ["A1"], 50, second.id));
      return setWellLabel(plan, at("Plate1", "A1"), "Control");
    }

    test("stageAt counts stages from 1", () => {
      const plan = smallPlan();
      assert.equal(stageAt(plan, 1), stageOrder(plan)[0]);
      assert.equal(stageAt(plan, 2), stageOrder(plan)[1]);
      assert.equal(stageAt(plan, 3), null);
      assert.equal(stageAt(plan, 0), null);
    });

    test("transfersFrom, by labware and by well; [] for no such stage", () => {
      const plan = smallPlan();
      assert.equal(transfersFrom(plan, 1, at("Res1", "1"), "Plate1").length, 2);
      assert.equal(transfersFrom(plan, 1, at("Res1", "1"), "Plate1", "A2").length, 1);
      assert.equal(transfersFrom(plan, 1, at("Res1", "2"), "Plate1").length, 0);
      assert.deepEqual(transfersFrom(plan, 5, at("Res1", "1"), "Plate1"), []);
    });

    test("names compare without regard to capitals or spaces at the ends", () => {
      const plan = smallPlan();
      assert.equal(startVolume(plan, "Res1", "1", " media "), 5000);
      assert.equal(startVolume(plan, "Res1", "2", "Media"), 0);
      assert.equal(hasComponent(plan, "MEDIA"), true);
      assert.equal(hasComponent(plan, "Cells"), false);
      assert.equal(carries(plan, "media", "CELLS/mL"), true);
      assert.equal(carries(plan, "Media", "g/L"), false);
      assert.equal(stageNameHas(plan, 2, " UP "), true);
      assert.equal(stageNameHas(plan, 1, "up"), false);
    });

    test("startsNewTips: stage 1 always, a later stage only with a tip change", () => {
      let plan = smallPlan();
      assert.equal(startsNewTips(plan, 1), true);
      assert.equal(startsNewTips(plan, 2), true);
      assert.equal(startsNewTips(plan, 3), false);
      const sameTips = startingPlan("empty");
      assert.equal(startsNewTips(sameTips, 1), true);
      plan = setTipProbes(plan, stageAt(plan, 2), probesFor(8));
      assert.equal(tipProbes(plan, 2), 8);
      assert.equal(tipProbes(plan, 1), DEFAULT_PROBE_COUNT);
    });

    test("modes and mixing", () => {
      let plan = smallPlan();
      assert.equal(aspirateMode(plan, 1), DEFAULT_PIPETTING_MODE);
      assert.equal(dispenseMode(plan, 1), DEFAULT_PIPETTING_MODE);
      plan = dispensingNonContact(plan, 1);
      assert.equal(dispenseMode(plan, 1), "Non-Contact");
      assert.equal(mixesBeforeAspirating(plan, 2), false);
      plan = setStageMix(plan, stageAt(plan, 2), "source", DEFAULT_MIX);
      assert.equal(mixesBeforeAspirating(plan, 2), true);
      assert.equal(mixesAfterDispensing(plan, 2), false);
      assert.equal(aspirateMode(plan, 9), null);
    });

    test("wellLabelText", () => {
      const plan = smallPlan();
      assert.equal(wellLabelText(plan, "Plate1", "A1"), "Control");
      assert.equal(wellLabelText(plan, "Plate1", "A2"), "");
    });

    test("tracesAtEnd on a plan with a known trace", () => {
      const plan = startingPlan("firstRunDone");
      assert.deepEqual(tracesAtEnd(plan, "Res1", "2"), ["Base media"]);
      assert.deepEqual(tracesAtEnd(plan, "Res1", "1"), []);
    });

    test("totalAtEnd and totalAfterStage", () => {
      const plan = smallPlan();
      assert.equal(totalAtEnd(plan, "Plate1", "A1"), 150);
      assert.equal(totalAfterStage(plan, 0, "Plate1", "A1"), 0);
      assert.equal(totalAfterStage(plan, 1, "Plate1", "A1"), 100);
      assert.equal(totalAfterStage(plan, 2, "Plate1", "A1"), 150);
      assert.equal(totalAfterStage(plan, 0, "Res1", "1"), 5000);
      assert.equal(totalAfterStage(plan, 1, "Res1", "1"), 4800);
    });

    test("isOut and isOpen", () => {
      const view = viewOf(emptyPlan().plan, { labwareOut: ["Res1"], open: "end" });
      assert.equal(isOut(view, "Res1"), true);
      assert.equal(isOut(view, "Plate1"), false);
      assert.equal(isOpen(view, "end"), true);
      assert.equal(isOpen(view, START), false);
    });

    test("transfersIn is what transfersFrom filters", () => {
      const plan = smallPlan();
      assert.equal(transfersIn(plan, stageAt(plan, 1)).length, 2);
    });
  });

  describe("configuration", () => {
    test("bodies show {dead}, {capacity}, {tip}, {mixLimit} and {folder} from config/", () => {
      const tip = TIP_TYPES[0];
      const dead = typeOf("Res1").deadVolume;
      const capacity = typeOf("Plate1").capacity;
      const firstRunView = viewOf(startingPlan("empty"));
      assert.ok(bodyText(stateOf("first-run", 6, firstRunView).body).includes(`keeps ${dead} µL the tips can't reach`));
      assert.ok(bodyText(stateOf("first-run", 14, firstRunView).body).includes(`Unzip it into ${BASE_FOLDER}.`));
      const checkingView = viewOf(startingPlan("firstRunDone"));
      assert.ok(bodyText(stateOf("checking", 4, checkingView).body).includes(`more than the ${capacity} µL`));
      assert.ok(bodyText(stateOf("checking", 6, checkingView).body).includes(`keeps ${dead} µL`));
      const conditionsView = viewOf(startingPlan("conditionStocks"));
      assert.ok(
        bodyText(stateOf("conditions", 3, conditionsView).body).includes(
          `a ${tip} tip mixes at most ${MIX_VOLUME_LIMITS[tip]} µL`,
        ),
      );
      assert.ok(
        bodyText(stateOf("conditions", 12, conditionsView).body).includes(
          `New tips · ${tip} · ${DEFAULT_PROBE_COUNT} tips`,
        ),
      );
      assert.ok(
        bodyText(stateOf("conditions", 10, conditionsView).body).includes(`↑ Slow ⟳   ↓ ${DEFAULT_PIPETTING_MODE}`),
      );
    });
  });
});
