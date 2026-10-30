// Unit tests for tip-groups.js. Each test comes from the "Test cases" section of tip-groups.md.
//
// They build plans directly, from a plain stageOrder and tipChanges, so these tests don't depend on
// a tool. tipGroups reads only those two parts of a plan, so the plans here hold nothing else unless
// a test needs it.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { OperationList } from "../operation-list/operation-list.js";
import { START, tipGroups } from "./tip-groups.js";

// Two tip types. tip-groups never checks them against config/, so these needn't be in it.
const FIRST_TIPS = "BC230";
const OTHER_TIPS = "BC1070";

// A plan whose stages are "1", "2", … up to `stageCount`, in that order unless `stageOrder` is
// given, with the START tip change on `startProbes` and any other tip changes in `tipChanges`,
// e.g. makePlan(3, { tipChanges: { 3: { tipType: "BC1070", probes: [1] } } }).
function makePlan(stageCount, { startProbes = [1, 2, 3, 4], tipChanges = {}, stageOrder = null } = {}) {
  const ids = Array.from({ length: stageCount }, (_, index) => String(index + 1));
  return {
    stageOrder: stageOrder ?? ids,
    tipChanges: { [START]: { tipType: FIRST_TIPS, probes: startProbes }, ...tipChanges },
  };
}

describe("tip-groups", () => {
  test('START is "start"', () => {
    assert.equal(START, "start");
  });

  test("one stage with only the START tip change gives one group, keyed START, with its probes", () => {
    const plan = makePlan(1, { startProbes: [1, 2, 3, 4] });
    assert.deepEqual(tipGroups(plan), [
      { key: START, tipType: FIRST_TIPS, stages: ["1"], probes: [1, 2, 3, 4] },
    ]);
  });

  test("a tip change before the third stage gives two groups, each with its key and tip type", () => {
    const plan = makePlan(4, {
      startProbes: [1],
      tipChanges: { 3: { tipType: OTHER_TIPS, probes: [1] } },
    });
    assert.deepEqual(tipGroups(plan), [
      { key: START, tipType: FIRST_TIPS, stages: ["1", "2"], probes: [1] },
      { key: "3", tipType: OTHER_TIPS, stages: ["3", "4"], probes: [1] },
    ]);
  });

  test("probes: each group's probes are its tip change's, whatever its stages are", () => {
    const plan = makePlan(5, {
      startProbes: [1, 2, 3, 4],
      tipChanges: { 3: { tipType: OTHER_TIPS, probes: [1] }, 5: { tipType: OTHER_TIPS, probes: [1, 8] } },
    });
    assert.deepEqual(
      tipGroups(plan).map((group) => group.probes),
      [[1, 2, 3, 4], [1], [1, 8]],
    );
  });

  test("changing the probes list a group returned doesn't change the plan's tip change", () => {
    const plan = makePlan(1, { startProbes: [1, 2] });
    tipGroups(plan)[0].probes.push(9);
    assert.deepEqual(plan.tipChanges[START].probes, [1, 2]);
  });

  test("groups follow the stage order, not the stage IDs", () => {
    const plan = makePlan(3, {
      stageOrder: ["1", "3", "2"],
      tipChanges: { 2: { tipType: OTHER_TIPS, probes: [1] } },
    });
    assert.deepEqual(
      tipGroups(plan).map((group) => group.stages),
      [["1", "3"], ["2"]],
    );
  });

  test("a stage without transfers is still in its group", () => {
    // Stage "1" has a transfer and stage "2" has none; both are in the START group.
    const operationList = new OperationList().add({
      type: "transfer",
      source: { labware: "Res", well: "1" },
      destination: { labware: "Plate", well: "A1" },
      volume: 50,
      stage: "1",
    });
    const plan = { ...makePlan(2, { startProbes: [1, 2] }), operationList };
    assert.deepEqual(tipGroups(plan), [
      { key: START, tipType: FIRST_TIPS, stages: ["1", "2"], probes: [1, 2] },
    ]);
  });

  test("calling tipGroups twice gives equal results, and changing one result doesn't change the next", () => {
    const plan = makePlan(2, {
      startProbes: [1],
      tipChanges: { 2: { tipType: OTHER_TIPS, probes: [2] } },
    });
    const first = tipGroups(plan);
    assert.deepEqual(first, tipGroups(plan));
    first.pop();
    first[0].stages.push("9");
    first[0].probes.push(9);
    assert.deepEqual(tipGroups(plan), [
      { key: START, tipType: FIRST_TIPS, stages: ["1"], probes: [1] },
      { key: "2", tipType: OTHER_TIPS, stages: ["2"], probes: [2] },
    ]);
  });
});
