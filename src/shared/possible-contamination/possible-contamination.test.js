// Unit tests for possible-contamination.js. Each test comes from the "Test cases" section of
// possible-contamination.md.
//
// They build plans through the transfer designer's edits, so every plan is one the designer could
// make. Following "Tests follow config/" (CLAUDE.md), pipetting modes are found in PIPETTING_MODES
// by touchesLiquid and ends, not by name, and labware in DECK by grid, with volumes worked out from
// their capacities, so changing config/ never breaks a test.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DECK } from "../../../config/deck.js";
import { PIPETTING_MODES } from "../../../config/pipetting-modes.js";
import { gridOf, capacityOf } from "../deck/deck.js";
import { GRID_96, GRID_1X12_NUMBERED } from "../well-grid/well-grid.js";
import {
  DEFAULT_MIX,
  emptyPlan,
  addComponent,
  addToWells,
  addTransfer,
  addStage,
  addStageWithNewTips,
  addMixStep,
  mixWells,
  renameStage,
  changeStageSettings,
  setStageMix,
  modeSettings,
  removeStage,
} from "../../tools/transfer-designer/transfer-designer.js";
import { possibleTraces } from "./possible-contamination.js";

// The reservoir ("Res1" in the specification) and the 96-well labware with the largest capacity
// ("Deep1"), found in DECK by well grid and capacity.
const RESERVOIR = DECK.find((entry) => gridOf(entry.name) === GRID_1X12_NUMBERED);
const DEEP = DECK.filter((entry) => gridOf(entry.name) === GRID_96).reduce((largest, entry) =>
  capacityOf(entry.name) > capacityOf(largest.name) ? entry : largest,
);

// A transfer's volume: a tenth of a deep well, so four transfers into one well never overfill it.
const VOLUME = capacityOf(DEEP.name) / 10;
// What a reservoir well starts with: full, so no transfer draws into its dead volume.
const RESERVOIR_VOLUME = capacityOf(RESERVOIR.name);

// A pipetting mode that doesn't touch the liquid, at the destination, and one that does and can
// mix, usable at both ends.
const NON_TOUCHING = PIPETTING_MODES.find(
  (mode) => !mode.touchesLiquid && mode.ends.includes("destination"),
);
const TOUCHING = PIPETTING_MODES.find(
  (mode) => mode.touchesLiquid && mode.ends.includes("destination") && mode.mixingTechnique !== null,
);

// The example plan's components, in its order, each with its own color.
const WATER = "Water";
const YEAST = "Yeast";
const HY_SOY = "Hy-Soy";
const NAOH = "NaOH";
const COMPONENTS = [
  [WATER, "#4e79a7"],
  [YEAST, "#f28e2b"],
  [HY_SOY, "#e15759"],
  [NAOH, "#76b7b2"],
];

// A reservoir well, e.g. res("1") → { labware: "Res1", well: "1" }.
function res(well) {
  return { labware: RESERVOIR.name, well };
}

// A deep-well plate well, e.g. deep("A3") → { labware: "Deep1", well: "A3" }.
function deep(well) {
  return { labware: DEEP.name, well };
}

// A new plan with the example's four components and no starting contents, and its one stage's ID:
// { plan, stageId }.
function planWithComponents() {
  let { plan, stageId } = emptyPlan();
  for (const [name, color] of COMPONENTS) {
    plan = addComponent(plan, name, color);
  }
  return { plan, stageId };
}

// The plan with transfers of VOLUME from `source` to each of `destinations`, in stage `id`.
function withTransfers(plan, id, source, destinations) {
  return destinations.reduce(
    (planSoFar, destination) =>
      addTransfer(planSoFar, { type: "transfer", source, destination, volume: VOLUME, stage: id }),
    plan,
  );
}

// The plan with stage `id` dispensing in `mode` at the destination, without mixing.
function withDestinationMode(plan, id, mode) {
  const settings = plan.stageList.get(id).settings;
  return changeStageSettings(plan, id, {
    ...settings,
    ...modeSettings("destination", mode.name),
    destinationMix: null,
  });
}

// The number of operations done at the end of stage `id`, which must have transfers, e.g. 6.
function countAtEnd(plan, id) {
  let count = 0;
  for (const { stage, operations } of plan.operationList.groupByStage()) {
    count += operations.length;
    if (stage === id) {
      return count;
    }
  }
  throw new Error(`Stage ${id} has no transfers.`);
}

// The example plan of the specification, section 6, and its stage IDs: { plan, ids: [s1, …, s5] }.
// With `stage4SharesTips`, stage 4 is on stage 3's tips instead of new ones. With `stage3IntoA4`,
// stage 3 is on new tips and also dispenses into A4, in `stage3Mode` at the destination.
function examplePlan({ stage4SharesTips = false, stage3IntoA4 = false, stage3Mode = TOUCHING } = {}) {
  let { plan, stageId: first } = planWithComponents();
  COMPONENTS.forEach(([name], place) => {
    plan = addToWells(plan, [res(String(place + 1))], name, RESERVOIR_VOLUME);
  });
  plan = withDestinationMode(renameStage(plan, first, "Water"), first, TOUCHING);
  plan = withTransfers(plan, first, res("1"), ["A1", "A2", "A3", "A4"].map(deep));

  const second = addStageWithNewTips(plan, null);
  plan = withTransfers(renameStage(second.plan, second.id, "Yeast"), second.id, res("2"), [
    deep("A2"),
    deep("A4"),
  ]);

  const third = stage3IntoA4 ? addStageWithNewTips(plan, null) : addStage(plan, null);
  plan = withDestinationMode(renameStage(third.plan, third.id, "Hy-Soy"), third.id, stage3Mode);
  const stage3Wells = stage3IntoA4 ? [deep("A3"), deep("A4")] : [deep("A3")];
  plan = withTransfers(plan, third.id, res("3"), stage3Wells);

  const fourth = stage4SharesTips ? addStage(plan, null) : addStageWithNewTips(plan, null);
  plan = withDestinationMode(renameStage(fourth.plan, fourth.id, "NaOH"), fourth.id, NON_TOUCHING);
  plan = withTransfers(plan, fourth.id, res("4"), ["A1", "A2", "A3", "A4"].map(deep));

  const fifth = addStageWithNewTips(plan, null);
  plan = withDestinationMode(renameStage(fifth.plan, fifth.id, "More Hy-Soy"), fifth.id, TOUCHING);
  plan = withTransfers(plan, fifth.id, res("3"), [deep("A5")]);

  return { plan, ids: [first, second.id, third.id, fourth.id, fifth.id] };
}

// A one-stage plan on new tips: Water from Res1 1 into Deep1 A1, which starts with Yeast, and A2,
// which starts with Hy-Soy, with the stage's settings changed by `settingsOf(settings)`.
function oneStagePlan(settingsOf) {
  let { plan, stageId } = planWithComponents();
  plan = addToWells(plan, [res("1")], WATER, RESERVOIR_VOLUME);
  plan = addToWells(plan, [deep("A1")], YEAST, VOLUME);
  plan = addToWells(plan, [deep("A2")], HY_SOY, VOLUME);
  plan = changeStageSettings(plan, stageId, settingsOf(plan.stageList.get(stageId).settings));
  plan = withTransfers(plan, stageId, res("1"), [deep("A1"), deep("A2")]);
  return { plan, stageId };
}

// The settings with the destination in `mode`, without mixing.
function atDestination(mode) {
  return (settings) => ({ ...settings, ...modeSettings("destination", mode.name), destinationMix: null });
}

// The traces of `well` ({ labware, well }) in `traces`, e.g. tracesAt(traces, deep("A3")).
function tracesAt(traces, well) {
  return traces.tracesOf(well.labware, well.well);
}

describe("possible-contamination", () => {
  test("at the start, every well's traces are []", () => {
    const { plan } = examplePlan();
    const traces = possibleTraces(plan, 0);
    for (const well of [res("1"), res("2"), res("3"), res("4"), ...["A1", "A2", "A3", "A4", "A5"].map(deep)]) {
      assert.deepEqual(tracesAt(traces, well), [], well.well);
    }
  });

  test("earlier stages of a tip group reach later ones", () => {
    const { plan, ids } = examplePlan();
    assert.deepEqual(tracesAt(possibleTraces(plan, countAtEnd(plan, ids[2])), deep("A3")), [YEAST]);
    assert.deepEqual(tracesAt(possibleTraces(plan, countAtEnd(plan, ids[1])), deep("A3")), []);
  });

  test("later stages of a tip group don't reach earlier ones", () => {
    const { plan, ids } = examplePlan();
    const traces = possibleTraces(plan, countAtEnd(plan, ids[2]));
    assert.ok(!tracesAt(traces, deep("A2")).includes(HY_SOY));
  });

  test("new tips start clean", () => {
    const { plan, ids } = examplePlan();
    assert.deepEqual(tracesAt(possibleTraces(plan, countAtEnd(plan, ids[3])), deep("A1")), []);
  });

  test("a non-contact destination still receives what the tips carry", () => {
    const { plan, ids } = examplePlan({ stage4SharesTips: true });
    const traces = possibleTraces(plan, countAtEnd(plan, ids[3]));
    assert.deepEqual(tracesAt(traces, deep("A1")), [YEAST, HY_SOY]);
  });

  test("a non-contact destination doesn't pass on; a touching one does", () => {
    const nonContact = oneStagePlan(atDestination(NON_TOUCHING));
    const quiet = possibleTraces(nonContact.plan, countAtEnd(nonContact.plan, nonContact.stageId));
    assert.deepEqual(tracesAt(quiet, deep("A1")), []);
    assert.deepEqual(tracesAt(quiet, deep("A2")), []);
    assert.deepEqual(tracesAt(quiet, res("1")), []);

    const contact = oneStagePlan(atDestination(TOUCHING));
    const traces = possibleTraces(contact.plan, countAtEnd(contact.plan, contact.stageId));
    assert.deepEqual(tracesAt(traces, deep("A1")), [HY_SOY]);
    assert.deepEqual(tracesAt(traces, deep("A2")), [YEAST]);
    assert.deepEqual(tracesAt(traces, res("1")), [YEAST, HY_SOY]);
  });

  test("a contaminated source carries its traces on, even with new tips, in component order", () => {
    const { plan, ids } = examplePlan();
    const traces = possibleTraces(plan, countAtEnd(plan, ids[4]));
    assert.deepEqual(tracesAt(traces, deep("A5")), [WATER, YEAST]);
  });

  test("within a stage, traces go in both directions", () => {
    let { plan, stageId } = planWithComponents();
    plan = addToWells(plan, [res("1")], YEAST, RESERVOIR_VOLUME);
    plan = addToWells(plan, [res("2")], HY_SOY, RESERVOIR_VOLUME);
    plan = withDestinationMode(plan, stageId, TOUCHING);
    plan = withTransfers(plan, stageId, res("1"), [deep("A1")]);
    plan = withTransfers(plan, stageId, res("2"), [deep("A2")]);
    const traces = possibleTraces(plan, countAtEnd(plan, stageId));
    assert.deepEqual(tracesAt(traces, deep("A1")), [HY_SOY]);
    assert.deepEqual(tracesAt(traces, deep("A2")), [YEAST]);
    assert.deepEqual(tracesAt(traces, res("1")), [HY_SOY]);
    assert.deepEqual(tracesAt(traces, res("2")), [YEAST]);
  });

  test("a tip carries what a well held when it touched it, not what it holds later", () => {
    let { plan, stageId: first } = planWithComponents();
    plan = addToWells(plan, [res("1")], WATER, RESERVOIR_VOLUME);
    plan = addToWells(plan, [res("2")], YEAST, RESERVOIR_VOLUME);
    plan = withDestinationMode(plan, first, TOUCHING);
    plan = withTransfers(plan, first, res("1"), [deep("A1")]);
    const second = addStageWithNewTips(plan, null);
    plan = withTransfers(second.plan, second.id, res("2"), [res("1")]);
    const traces = possibleTraces(plan, countAtEnd(plan, second.id));
    assert.deepEqual(tracesAt(traces, deep("A1")), []);
  });

  test("components a well holds aren't its traces", () => {
    const { plan, ids } = examplePlan();
    const traces = possibleTraces(plan, countAtEnd(plan, ids[2]));
    assert.deepEqual(tracesAt(traces, deep("A4")), []);
    assert.deepEqual(tracesAt(traces, deep("A2")), []);
  });

  test("within a stage, a destination already holding something passes it on", () => {
    const touching = examplePlan({ stage3IntoA4: true });
    assert.deepEqual(
      tracesAt(possibleTraces(touching.plan, countAtEnd(touching.plan, touching.ids[2])), deep("A3")),
      [YEAST],
    );
    const nonContact = examplePlan({ stage3IntoA4: true, stage3Mode: NON_TOUCHING });
    assert.deepEqual(
      tracesAt(possibleTraces(nonContact.plan, countAtEnd(nonContact.plan, nonContact.ids[2])), deep("A3")),
      [],
    );
  });

  test("a technique and liquid type that aren't any mode's count as touching", () => {
    const known = new Set(PIPETTING_MODES.flatMap((mode) => [mode.technique, mode.mixingTechnique]));
    const technique = ["Custom_Technique", "Custom_Technique_2"].find((name) => !known.has(name));
    const { plan, stageId } = oneStagePlan((settings) => ({
      ...settings,
      destinationTechnique: technique,
      destinationLiquidType: "Custom_Liquid",
      destinationMix: null,
    }));
    const traces = possibleTraces(plan, countAtEnd(plan, stageId));
    assert.deepEqual(tracesAt(traces, deep("A1")), [HY_SOY]);
    assert.deepEqual(tracesAt(traces, deep("A2")), [YEAST]);
  });

  test("matching a mode that doesn't touch needs both its technique and its liquid type", () => {
    const otherLiquidType = PIPETTING_MODES.find(
      (mode) => mode.liquidType !== NON_TOUCHING.liquidType,
    ).liquidType;
    const { plan, stageId } = oneStagePlan((settings) => ({
      ...settings,
      destinationTechnique: NON_TOUCHING.technique,
      destinationLiquidType: otherLiquidType,
      destinationMix: null,
    }));
    const traces = possibleTraces(plan, countAtEnd(plan, stageId));
    assert.deepEqual(tracesAt(traces, deep("A1")), [HY_SOY]);
  });

  test("a destination that mixes touches the liquid", () => {
    const mixing = oneStagePlan(atDestination(TOUCHING));
    const plan = setStageMix(mixing.plan, mixing.stageId, "destination", DEFAULT_MIX);
    const traces = possibleTraces(plan, countAtEnd(plan, mixing.stageId));
    assert.deepEqual(tracesAt(traces, deep("A1")), [HY_SOY]);
    assert.deepEqual(tracesAt(traces, deep("A2")), [YEAST]);
  });

  test("a stage without transfers and without a tip change keeps the tips; one with a tip change starts new ones", () => {
    const { plan, ids } = examplePlan();
    const sameTips = addStage(plan, ids[2]).plan;
    assert.deepEqual(
      tracesAt(possibleTraces(sameTips, countAtEnd(sameTips, ids[2])), deep("A3")),
      [YEAST],
    );
    const newTips = addStageWithNewTips(plan, ids[2]).plan;
    assert.deepEqual(
      tracesAt(possibleTraces(newTips, countAtEnd(newTips, ids[2])), deep("A3")),
      [],
    );
  });

  test("a mix step's wells pass on and receive", () => {
    let { plan, stageId } = planWithComponents();
    plan = addToWells(plan, [deep("A1")], YEAST, VOLUME);
    plan = addToWells(plan, [deep("A2")], WATER, VOLUME);
    const mixStep = addMixStep(plan, null);
    plan = removeStage(mixStep.plan, stageId);
    plan = mixWells(plan, mixStep.id, [deep("A1"), deep("A2")]);
    const traces = possibleTraces(plan, countAtEnd(plan, mixStep.id));
    assert.deepEqual(tracesAt(traces, deep("A2")), [YEAST]);
    assert.deepEqual(tracesAt(traces, deep("A1")), [WATER]);
  });

  test("an operation count that isn't a whole number is refused, including one left out", () => {
    const { plan } = examplePlan();
    for (const [count, shown] of [
      [undefined, "undefined"],
      [null, "null"],
      [2.5, "2.5"],
      ["3", '"3"'],
      [Number.NaN, "NaN"],
    ]) {
      assert.throws(() => possibleTraces(plan, count), {
        message: `The operation count must be a whole number, like 3, but got ${shown}.`,
      });
    }
    assert.throws(() => possibleTraces(plan), {
      message: "The operation count must be a whole number, like 3, but got undefined.",
    });
  });

  test("an operation count out of range is refused", () => {
    const { plan } = examplePlan();
    const total = plan.operationList.listOperations().length;
    for (const count of [-1, total + 1]) {
      assert.throws(() => possibleTraces(plan, count), {
        message: `The operation count must be from 0 to ${total}, the number of operations in the list, but got ${count}.`,
      });
    }
  });

  test("an operation count part-way through a stage is refused, naming the stage and the counts at its ends", () => {
    const { plan, ids } = examplePlan();
    const start = countAtEnd(plan, ids[0]);
    const end = countAtEnd(plan, ids[1]);
    assert.throws(() => possibleTraces(plan, start + 1), {
      message:
        "Possible traces are worked out only at the start or at a stage's end, since the order " +
        `within a stage isn't known, but ${start + 1} operations is part-way through stage 2, ` +
        `“Yeast”. Use ${start} or ${end}.`,
    });
    assert.throws(() => possibleTraces(plan, 1), {
      message:
        "Possible traces are worked out only at the start or at a stage's end, since the order " +
        "within a stage isn't known, but 1 operation is part-way through stage 1, “Water”. " +
        `Use 0 or ${start}.`,
    });
  });

  test("tracesOf refuses a labware or well that isn't text, is blank or has spaces at its ends", () => {
    const { plan } = examplePlan();
    const traces = possibleTraces(plan, 0);
    assert.throws(() => traces.tracesOf(5, "A1"), {
      message: "The labware given to tracesOf must be text, but got 5.",
    });
    assert.throws(() => traces.tracesOf("   ", "A1"), {
      message: "The labware given to tracesOf is blank. Give it at least one character that isn't a space.",
    });
    assert.throws(() => traces.tracesOf(` ${DEEP.name}`, "A1"), {
      message: `The labware given to tracesOf " ${DEEP.name}" has spaces at the start or end. Remove them.`,
    });
    assert.throws(() => traces.tracesOf(DEEP.name), {
      message: "The well given to tracesOf must be text, but got undefined.",
    });
    assert.throws(() => traces.tracesOf(DEEP.name, ""), {
      message: "The well given to tracesOf is blank. Give it at least one character that isn't a space.",
    });
    assert.throws(() => traces.tracesOf(DEEP.name, "A1 "), {
      message: 'The well given to tracesOf "A1 " has spaces at the start or end. Remove them.',
    });
  });

  test("tracesOf returns a new list each time", () => {
    const { plan, ids } = examplePlan();
    const traces = possibleTraces(plan, countAtEnd(plan, ids[2]));
    tracesAt(traces, deep("A3")).push(NAOH);
    assert.deepEqual(tracesAt(traces, deep("A3")), [YEAST]);
  });
});
