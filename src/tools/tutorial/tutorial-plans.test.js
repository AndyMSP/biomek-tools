// Unit tests for tutorial-plans.js. Each test comes from the "Test cases" section of
// tutorial-plans.md (section 7).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { COMPONENT_COLORS } from "../../../config/component-colors.js";
import { replay } from "../../shared/contents-tracking/contents-tracking.js";
import {
  START,
  stageOrder,
  transfersIn,
  tipChangeAt,
  stagesWithMixProblem,
  wellLabelOf,
} from "../transfer-designer/transfer-designer.js";
import { planToText, planFromText } from "../transfer-designer/plan-file.js";
import { startingPlan, startingPlanText, STARTING_PLAN_NAMES } from "./tutorial-plans.js";
import { tutorialById, stepState } from "./tutorial.js";

// What a plan file says saved it, in these tests.
const SAVED_BY = "transfer designer tutorial v0.2.0-test";

// The culture wells, B2 to D5, row by row.
const CULTURE_WELLS = ["B", "C", "D"].flatMap((row) => [2, 3, 4, 5].map((column) => `${row}${column}`));

// The plan's stage names, in stage order.
function stageNames(plan) {
  return stageOrder(plan).map((id) => plan.stageList.get(id).name);
}

// What each well holds at the start, as { "Res1 1": { "Base media": 6000 }, … }.
function startingVolumes(plan) {
  return Object.fromEntries(
    plan.startingContents.map((entry) => [`${entry.labware} ${entry.well}`, { ...entry.components }]),
  );
}

// The plan's components as [name, constituents] pairs.
function componentsOf(plan) {
  return plan.components.map((component) => [
    component.name,
    component.constituents.map(({ name, amount, unit }) => ({ name, amount, unit })),
  ]);
}

// A view of `plan` with nothing of the page's own set.
function viewOf(plan) {
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
  };
}

describe("tutorial-plans", () => {
  test("STARTING_PLAN_NAMES lists the five plans in order", () => {
    assert.deepEqual(STARTING_PLAN_NAMES, ["empty", "firstRunDone", "conditionStocks", "tableStocks", "conditionMedia"]);
  });

  test("each plan survives a round trip through a plan file", () => {
    for (const name of STARTING_PLAN_NAMES) {
      const text = startingPlanText(name, SAVED_BY);
      assert.equal(planToText(planFromText(text), SAVED_BY), text, name);
      assert.equal(JSON.parse(text).savedBy, SAVED_BY);
    }
  });

  test("each plan is made fresh each call", () => {
    assert.notEqual(startingPlan("firstRunDone"), startingPlan("firstRunDone"));
  });

  test("empty: the empty plan as it is", () => {
    const plan = startingPlan("empty");
    assert.equal(plan.experimentName, "");
    assert.deepEqual(plan.components, []);
    assert.deepEqual(plan.startingContents, []);
    assert.deepEqual(stageNames(plan), ["New stage"]);
    assert.equal(plan.operationList.listOperations().length, 0);
  });

  test("firstRunDone: tutorial 1's end", () => {
    const plan = startingPlan("firstRunDone");
    assert.equal(plan.experimentName, "Practice1");
    assert.deepEqual(plan.labwareLabels, { Plate1: "Culture plate" });
    assert.deepEqual(plan.wellLabels, {});
    assert.deepEqual(componentsOf(plan), [
      ["Base media", []],
      ["Cells", []],
    ]);
    assert.deepEqual(startingVolumes(plan), { "Res1 1": { "Base media": 6000 }, "Res1 2": { Cells: 3000 } });
    assert.deepEqual(stageNames(plan), ["Base media", "Cells"]);
    const [media, cells] = stageOrder(plan);
    assert.notEqual(tipChangeAt(plan, cells), null);
    // Stage `id`'s transfers as [source, destination, volume].
    const routes = (id) =>
      transfersIn(plan, id).map((transfer) => [
        `${transfer.source.labware} ${transfer.source.well}`,
        `${transfer.destination.labware} ${transfer.destination.well}`,
        transfer.volume,
      ]);
    assert.deepEqual(routes(media), CULTURE_WELLS.map((well) => ["Res1 1", `Plate1 ${well}`, 100]));
    assert.deepEqual(routes(cells), CULTURE_WELLS.map((well) => ["Res1 2", `Plate1 ${well}`, 50]));
    // Default settings and tips throughout: both tip changes load the same tips as a new plan.
    assert.deepEqual(tipChangeAt(plan, cells), tipChangeAt(plan, START));
  });

  test("conditionStocks: four stocks in Res1", () => {
    const plan = startingPlan("conditionStocks");
    assert.equal(plan.experimentName, "Practice3");
    assert.deepEqual(plan.labwareLabels, {});
    assert.deepEqual(componentsOf(plan), [
      ["Base media", []],
      ["Glucose", [{ name: "Glucose", amount: 50, unit: "g/L" }]],
      ["Yeast extract", [{ name: "Yeast extract", amount: 50, unit: "g/L" }]],
      ["Cells", [{ name: "Cells", amount: 1e6, unit: "cells/mL" }]],
    ]);
    assert.deepEqual(startingVolumes(plan), {
      "Res1 1": { "Base media": 6000 },
      "Res1 2": { Glucose: 3000 },
      "Res1 3": { "Yeast extract": 3000 },
      "Res1 4": { Cells: 3000 },
    });
    assert.deepEqual(stageNames(plan), ["New stage"]);
    assert.equal(plan.operationList.listOperations().length, 0);
  });

  test("tableStocks: three stocks in Res1", () => {
    const plan = startingPlan("tableStocks");
    assert.equal(plan.experimentName, "Practice4");
    assert.deepEqual(
      componentsOf(plan).map(([name]) => name),
      ["Base media", "Glucose", "Yeast extract"],
    );
    assert.deepEqual(startingVolumes(plan), {
      "Res1 1": { "Base media": 6000 },
      "Res1 2": { Glucose: 3000 },
      "Res1 3": { "Yeast extract": 3000 },
    });
    assert.deepEqual(stageNames(plan), ["New stage"]);
  });

  test("conditionMedia: four condition media in Deep1, named, and PBS", () => {
    const plan = startingPlan("conditionMedia");
    assert.equal(plan.experimentName, "Practice5");
    assert.deepEqual(plan.labwareLabels, { Deep1: "Conditions" });
    assert.deepEqual(
      componentsOf(plan),
      ["Control media", "Glucose media", "Yeast media", "Both media", "PBS"].map((name) => [name, []]),
    );
    assert.deepEqual(startingVolumes(plan), {
      "Deep1 A1": { "Control media": 1500 },
      "Deep1 A2": { "Glucose media": 1500 },
      "Deep1 A3": { "Yeast media": 1500 },
      "Deep1 A4": { "Both media": 1500 },
      "Res1 1": { PBS: 4000 },
    });
    assert.deepEqual(
      ["A1", "A2", "A3", "A4"].map((well) => wellLabelOf(plan, { labware: "Deep1", well })),
      ["Control", "With glucose", "With yeast", "Both"],
    );
    assert.deepEqual(stageNames(plan), ["New stage"]);
  });

  test("each plan has no contents problem and no mix problem", () => {
    for (const name of STARTING_PLAN_NAMES) {
      const plan = startingPlan(name);
      assert.deepEqual(replay(plan.startingContents, plan.operationList).listProblems(), [], name);
      assert.equal(stagesWithMixProblem(plan).size, 0, name);
    }
  });

  test("firstRunDone matches what tutorial 1's steps make, for the steps that read only the plan", () => {
    const tutorial = tutorialById("first-run");
    const plan = startingPlan("firstRunDone");
    // Steps 1, 3, 5 to 10: their done reads the plan (step 5 also reads addingComponent, false here).
    for (const index of [1, 3, 5, 6, 7, 8, 9, 10]) {
      assert.equal(stepState(tutorial.steps[index], viewOf(plan), false).done, true, `step ${index}`);
    }
  });

  test("colors follow COMPONENT_COLORS", () => {
    for (const name of STARTING_PLAN_NAMES) {
      const plan = startingPlan(name);
      plan.components.forEach((component, index) => {
        assert.equal(component.color, COMPONENT_COLORS[index], `${name}: ${component.name}`);
      });
    }
  });

  test("an unknown name throws", () => {
    assert.throws(() => startingPlan("x"), { message: `There's no starting plan named "x".` });
    assert.throws(() => startingPlanText("full", SAVED_BY), { message: `There's no starting plan named "full".` });
  });
});
