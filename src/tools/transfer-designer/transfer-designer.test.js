// Unit tests for transfer-designer.js. Each test comes from the "Test cases" section of
// transfer-designer.md, and each row of its error table and each order of checks has one.
//
// They use the real config/pipetting-modes.js, config/tip-types.js and config/deck.js, and also check
// the first two (ADR 0009). Tests find what they need in the config files rather than naming it, so
// they still pass when the configuration changes.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PIPETTING_MODES, DEFAULT_PIPETTING_MODE } from "../../../config/pipetting-modes.js";
import { TIP_TYPES } from "../../../config/tip-types.js";
import { DECK } from "../../../config/deck.js";
import { checkName } from "../../shared/input-checks/input-checks.js";
import { tipGroups as sharedTipGroups } from "../../shared/tip-groups/tip-groups.js";
import {
  NEW_STAGE_NAME,
  START,
  emptyPlan,
  setExperimentName,
  defaultSettings,
  probesFor,
  modesFor,
  modeSettings,
  modeOf,
  stageOrder,
  addStage,
  renameStage,
  changeStageSettings,
  canRemoveStage,
  removeStage,
  stageEnds,
  stagesWithOverdraw,
  addTransfer,
  addTransfers,
  changeVolume,
  removeTransfer,
  transfersIn,
  tipChangeAt,
  canAddTipChange,
  addTipChange,
  setTipType,
  removeTipChange,
  tipGroups,
  addComponent,
  renameComponent,
  setComponentColor,
  removeComponent,
  countWellsWith,
  addToWells,
  emptyWells,
  labwareUsed,
  labelOf,
  setLabel,
  setLabels,
} from "./transfer-designer.js";

// Two 96-well labware and the numbered (reservoir) labware, found in DECK.
const [PLATE, OTHER_PLATE] = DECK.filter((entry) => entry.grid === "GRID_96").map(
  (entry) => entry.name,
);
const RESERVOIR = DECK.find((entry) => entry.grid === "GRID_1X12_NUMBERED").name;

// The parts every plan has.
const PLAN_PARTS = [
  "components",
  "startingContents",
  "operationList",
  "stageList",
  "stageOrder",
  "tipChanges",
  "labwareLabels",
  "experimentName",
];

// A transfer in `stage` from the reservoir's trough 1 into `well` on PLATE. The reservoir is never
// a destination in these tests, so such transfers never break the stage rule,
// e.g. transferTo("2", "B3") → { type: "transfer", source: { labware: "Res", well: "1" }, … }.
function transferTo(stage, well, volume = 50) {
  return {
    type: "transfer",
    source: { labware: RESERVOIR, well: "1" },
    destination: { labware: PLATE, well },
    volume,
    stage,
  };
}

// A plan with `count` stages, "1" to `count`, each added last, and none with transfers yet.
function planWithStages(count) {
  let { plan } = emptyPlan();
  for (let added = 1; added < count; added += 1) {
    plan = addStage(plan, null).plan;
  }
  return plan;
}

// The plan with one transfer added to each of `stages`, in turn, each into its own well of PLATE
// (A1, A2, …), e.g. withTransfersIn(plan, ["1", "2"]).
function withTransfersIn(plan, stages) {
  return stages.reduce(
    (planSoFar, stage, index) => addTransfer(planSoFar, transferTo(stage, `A${index + 1}`)),
    plan,
  );
}

// The stages of each transfer in the plan's operation list, in order, e.g. ["1", "3", "2"].
function stagesOfTransfers(plan) {
  return plan.operationList.listOperations().map((operation) => operation.stage);
}

// Everything a plan holds, as text, so a test can check a plan is unchanged by comparing before and
// after. The two lists are written out through their own methods.
function snapshot(plan) {
  return JSON.stringify({
    ...plan,
    operationList: plan.operationList.listOperations(),
    stageList: plan.stageList.listStages(),
  });
}

// A well on the reservoir, e.g. trough("1") → { labware: "Res", well: "1" }.
function trough(well) {
  return { labware: RESERVOIR, well };
}

// A plan with components Media and Dye, and some starting contents: trough 1 holds 1000 µL of Media
// and 10 µL of Dye, trough 2 holds 500 µL of Dye.
function planWithContents() {
  let { plan } = emptyPlan();
  plan = addComponent(plan, "Media", "#4e79a7");
  plan = addComponent(plan, "Dye", "#e15759");
  plan = addToWells(plan, [trough("1")], "Media", 1000);
  plan = addToWells(plan, [trough("1"), trough("2")], "Dye", 10);
  plan = addToWells(plan, [trough("2")], "Dye", 490);
  return plan;
}

// The message checkName gives for a component name that isn't text, e.g. for 5.
function componentNameNotTextMessage(got) {
  return `The component name must be text, but got ${got}.`;
}

describe("transfer-designer", () => {
  // --- Configuration: config/pipetting-modes.js ---

  test("each pipetting mode has exactly name, technique, liquidType and ends", () => {
    for (const mode of PIPETTING_MODES) {
      assert.deepEqual(Object.keys(mode).sort(), ["ends", "liquidType", "name", "technique"]);
    }
  });

  test("each mode's name, technique and liquid type pass checkName, and no two names repeat", () => {
    for (const mode of PIPETTING_MODES) {
      assert.doesNotThrow(() => checkName(mode.name, "mode name"));
      assert.doesNotThrow(() => checkName(mode.technique, "technique"));
      assert.doesNotThrow(() => checkName(mode.liquidType, "liquid type"));
    }
    const names = PIPETTING_MODES.map((mode) => mode.name);
    assert.equal(new Set(names).size, names.length);
  });

  test("each liquid type follows Biomek's rule: letters, digits and underscores, starting with a letter", () => {
    for (const mode of PIPETTING_MODES) {
      assert.match(mode.liquidType, /^[A-Za-z][A-Za-z0-9_]*$/, mode.name);
    }
  });

  test('each mode\'s ends is a non-empty list of "source" and "destination", each at most once', () => {
    for (const mode of PIPETTING_MODES) {
      assert.ok(Array.isArray(mode.ends) && mode.ends.length > 0, mode.name);
      assert.ok(
        mode.ends.every((end) => end === "source" || end === "destination"),
        mode.name,
      );
      assert.equal(new Set(mode.ends).size, mode.ends.length, mode.name);
    }
  });

  test("no two modes for one end share both technique and liquid type, and each end has a mode", () => {
    for (const end of ["source", "destination"]) {
      const modes = PIPETTING_MODES.filter((mode) => mode.ends.includes(end));
      assert.ok(modes.length > 0, end);
      const pairs = modes.map((mode) => JSON.stringify([mode.technique, mode.liquidType]));
      assert.equal(new Set(pairs).size, pairs.length, end);
    }
  });

  test("DEFAULT_PIPETTING_MODE names a mode usable at both ends", () => {
    const mode = PIPETTING_MODES.find((candidate) => candidate.name === DEFAULT_PIPETTING_MODE);
    assert.ok(mode !== undefined);
    assert.ok(mode.ends.includes("source") && mode.ends.includes("destination"));
  });

  // --- Configuration: config/tip-types.js ---

  test("TIP_TYPES is a non-empty list of valid names, none repeated", () => {
    assert.ok(Array.isArray(TIP_TYPES) && TIP_TYPES.length > 0);
    for (const tipType of TIP_TYPES) {
      assert.doesNotThrow(() => checkName(tipType, "tip type"));
    }
    assert.equal(new Set(TIP_TYPES).size, TIP_TYPES.length);
  });

  // --- Plans and modes ---

  test("defaultSettings() gives the default mode's technique and liquid type at both ends, and probes 1 to 8", () => {
    const mode = PIPETTING_MODES.find((candidate) => candidate.name === DEFAULT_PIPETTING_MODE);
    assert.deepEqual(defaultSettings(), {
      sourceTechnique: mode.technique,
      sourceLiquidType: mode.liquidType,
      destinationTechnique: mode.technique,
      destinationLiquidType: mode.liquidType,
      probes: [1, 2, 3, 4, 5, 6, 7, 8],
    });
  });

  test("emptyPlan() gives one stage with default settings, START tips of the first tip type, no experiment name, and nothing else", () => {
    const { plan, stageId } = emptyPlan();
    assert.deepEqual(Object.keys(plan).sort(), [...PLAN_PARTS].sort());
    assert.deepEqual(plan.stageList.listStages(), [
      { id: stageId, name: NEW_STAGE_NAME, settings: defaultSettings() },
    ]);
    assert.equal(NEW_STAGE_NAME, "New stage");
    assert.deepEqual(plan.tipChanges, { [START]: { tipType: TIP_TYPES[0] } });
    assert.deepEqual(plan.components, []);
    assert.deepEqual(plan.startingContents, []);
    assert.deepEqual(plan.operationList.listOperations(), []);
    assert.deepEqual(plan.stageOrder, [stageId]);
    assert.deepEqual(plan.labwareLabels, {});
    assert.equal(plan.experimentName, "");
  });

  test('setExperimentName sets a name, trims it, and removes it for "" or only spaces', () => {
    const { plan } = emptyPlan();
    const named = setExperimentName(plan, "Exp36");
    assert.equal(named.experimentName, "Exp36");
    assert.equal(setExperimentName(plan, " Exp36 ").experimentName, "Exp36");
    assert.equal(setExperimentName(named, "").experimentName, "");
    assert.equal(setExperimentName(named, "  ").experimentName, "");
  });

  test("setExperimentName with the name the plan already has returns the same plan", () => {
    const named = setExperimentName(emptyPlan().plan, "Exp36");
    assert.equal(setExperimentName(named, "Exp36"), named);
    assert.equal(setExperimentName(named, " Exp36 "), named);
    const unnamed = emptyPlan().plan;
    assert.equal(setExperimentName(unnamed, ""), unnamed);
  });

  test("setExperimentName refuses a name that isn't text, has a space, or is too long, with checkExperimentName's messages, leaving the plan unchanged", () => {
    const plan = setExperimentName(emptyPlan().plan, "Exp36");
    const before = snapshot(plan);
    assert.throws(() => setExperimentName(plan, 5), {
      message: 'The experiment name must be text, like "Exp36", but got 5.',
    });
    assert.throws(() => setExperimentName(plan, "Exp 36"), {
      message: /^The experiment name can't contain " " \(a space\)\./,
    });
    assert.throws(() => setExperimentName(plan, "E".repeat(41)), {
      message: "The experiment name is 41 characters long; it can be at most 40.",
    });
    assert.equal(snapshot(plan), before);
  });

  test("stageOrder(plan) gives the plan's stageOrder", () => {
    const plan = addStage(planWithStages(2), "2").plan;
    assert.equal(stageOrder(plan), plan.stageOrder);
    assert.deepEqual(stageOrder(plan), ["1", "3", "2"]);
  });

  test("probesFor gives [1] for 1 and all eight for 8", () => {
    assert.deepEqual(probesFor(1), [1]);
    assert.deepEqual(probesFor(4), [1, 2, 3, 4]);
    assert.deepEqual(probesFor(8), [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('probesFor refuses 0, 9, 2.5 and "4"', () => {
    for (const [count, shown] of [
      [0, "0"],
      [9, "9"],
      [2.5, "2.5"],
      ["4", '"4"'],
    ]) {
      assert.throws(() => probesFor(count), {
        message: `The number of probes must be a whole number from 1 to 8, but got ${shown}.`,
      });
    }
  });

  test("modesFor lists the modes usable at an end, in config order", () => {
    for (const end of ["source", "destination"]) {
      assert.deepEqual(
        modesFor(end).map((mode) => mode.name),
        PIPETTING_MODES.filter((mode) => mode.ends.includes(end)).map((mode) => mode.name),
      );
    }
  });

  test("modeSettings and modeOf round-trip every mode at every end it allows", () => {
    for (const mode of PIPETTING_MODES) {
      for (const end of mode.ends) {
        const settings = { ...defaultSettings(), ...modeSettings(end, mode.name) };
        assert.deepEqual(modeSettings(end, mode.name), {
          [`${end}Technique`]: mode.technique,
          [`${end}LiquidType`]: mode.liquidType,
        });
        assert.equal(modeOf(end, settings), mode.name, `${mode.name} at the ${end}`);
      }
    }
  });

  test("modeSettings refuses a mode not allowed at an end, naming the modes there are", () => {
    const destinationOnly = PIPETTING_MODES.find((mode) => !mode.ends.includes("source"));
    const sourceNames = PIPETTING_MODES.filter((mode) => mode.ends.includes("source"))
      .map((mode) => `"${mode.name}"`)
      .join(", ");
    assert.throws(() => modeSettings("source", destinationOnly.name), {
      message: `"${destinationOnly.name}" isn't a pipetting mode for the source. The modes for the source are ${sourceNames}.`,
    });
  });

  test("modeOf gives null for settings that match no mode", () => {
    const settings = { ...defaultSettings(), sourceTechnique: "Unknown_Technique" };
    assert.equal(modeOf("source", settings), null);
    assert.equal(modeOf("destination", settings), DEFAULT_PIPETTING_MODE);
  });

  // --- Stages and stage order ---

  test("a stage added before the first, given its first transfer, runs first (2, 1)", () => {
    let plan = withTransfersIn(planWithStages(1), ["1"]);
    plan = addStage(plan, "1").plan;
    plan = addTransfer(plan, transferTo("2", "B1"));
    assert.deepEqual(stagesOfTransfers(plan), ["2", "1"]);
    assert.deepEqual(stageOrder(plan), ["2", "1"]);
  });

  test("addStage before a stage puts it there; with null, last; it's called NEW_STAGE_NAME", () => {
    const plan = withTransfersIn(planWithStages(2), ["1", "2"]);
    const before = addStage(plan, "2");
    assert.deepEqual(stageOrder(before.plan), ["1", before.id, "2"]);
    assert.equal(before.plan.stageList.get(before.id).name, NEW_STAGE_NAME);
    const last = addStage(plan, null);
    assert.deepEqual(stageOrder(last.plan), ["1", "2", last.id]);
  });

  test("addStage copies the settings of the stage before it, or the first stage's when added first", () => {
    let plan = planWithStages(2);
    const firstSettings = { ...defaultSettings(), probes: [1] };
    const secondSettings = { ...defaultSettings(), probes: [1, 2, 3] };
    plan = changeStageSettings(plan, "1", firstSettings);
    plan = changeStageSettings(plan, "2", secondSettings);

    const last = addStage(plan, null);
    assert.deepEqual(last.plan.stageList.get(last.id).settings, secondSettings);
    const middle = addStage(plan, "2");
    assert.deepEqual(middle.plan.stageList.get(middle.id).settings, firstSettings);
    const first = addStage(plan, "1");
    assert.deepEqual(first.plan.stageList.get(first.id).settings, firstSettings);
  });

  test("addStage with takeTips before a stage with a tip change moves the tip change to the new stage", () => {
    const plan = addTipChange(planWithStages(3), "3");
    const { plan: added, id } = addStage(plan, "3", { takeTips: true });
    assert.deepEqual(tipChangeAt(added, id), { tipType: TIP_TYPES[0] });
    assert.equal(tipChangeAt(added, "3"), null);
    assert.deepEqual(
      tipGroups(added).map((group) => group.stages),
      [
        ["1", "2"],
        [id, "3"],
      ],
    );
  });

  test("addStage without takeTips before a stage with a tip change joins the tip group before", () => {
    const plan = addTipChange(planWithStages(3), "3");
    const { plan: added, id } = addStage(plan, "3");
    assert.deepEqual(tipChangeAt(added, "3"), { tipType: TIP_TYPES[0] });
    assert.deepEqual(
      tipGroups(added).map((group) => group.stages),
      [
        ["1", "2", id],
        ["3"],
      ],
    );
  });

  test("addStage before the first stage keeps the START tips first", () => {
    const plan = setTipType(planWithStages(1), START, TIP_TYPES.at(-1));
    for (const takeTips of [false, true]) {
      const { plan: added, id } = addStage(plan, "1", { takeTips });
      assert.deepEqual(stageOrder(added), [id, "1"]);
      assert.deepEqual(added.tipChanges, { [START]: { tipType: TIP_TYPES.at(-1) } });
      assert.equal(tipGroups(added)[0].key, START);
    }
  });

  test("addStage before a stage that isn't in the plan throws", () => {
    assert.throws(() => addStage(planWithStages(1), "9"), {
      message: `There's no stage "9" to add a stage before.`,
    });
  });

  test("removeStage removes a stage and its transfers, takes it out of the stage order leaving the others in their order, and its tip change goes", () => {
    let plan = withTransfersIn(planWithStages(3), ["1", "2", "3"]);
    plan = addTipChange(plan, "2");
    const { plan: withFour, id: four } = addStage(plan, "2");
    const removed = removeStage(withFour, "2");
    assert.equal(removed.stageList.has("2"), false);
    assert.deepEqual(stagesOfTransfers(removed), ["1", "3"]);
    assert.deepEqual(stageOrder(removed), ["1", four, "3"]);
    assert.equal(tipChangeAt(removed, "2"), null);
  });

  test("removing the only stage throws, and canRemoveStage is false for it", () => {
    const plan = planWithStages(1);
    assert.equal(canRemoveStage(plan, "1"), false);
    assert.throws(() => removeStage(plan, "1"), {
      message: "A plan needs at least one stage, so its only stage can't be removed.",
    });
  });

  test("removeStage of a stage that isn't in the plan gives the stage list's message", () => {
    const plan = planWithStages(2);
    assert.equal(canRemoveStage(plan, "9"), false);
    assert.equal(canRemoveStage(plan, "2"), true);
    assert.throws(() => removeStage(plan, "9"), {
      message: `There's no stage "9" in the stage list.`,
    });
  });

  test("removing the first stage, when the second has its own tip change, makes that the START one", () => {
    let plan = addTipChange(planWithStages(2), "2");
    plan = setTipType(plan, "2", TIP_TYPES.at(-1));
    const removed = removeStage(plan, "1");
    assert.deepEqual(removed.tipChanges, { [START]: { tipType: TIP_TYPES.at(-1) } });
  });

  test("renameStage and changeStageSettings change only that stage", () => {
    const plan = planWithStages(2);
    const renamed = renameStage(plan, "2", "Drugs");
    assert.equal(renamed.stageList.get("2").name, "Drugs");
    assert.deepEqual(renamed.stageList.get("1"), plan.stageList.get("1"));

    const settings = { ...defaultSettings(), probes: [1, 2] };
    const changed = changeStageSettings(plan, "2", settings);
    assert.deepEqual(changed.stageList.get("2").settings, settings);
    assert.deepEqual(changed.stageList.get("1"), plan.stageList.get("1"));
  });

  test("renameStage and changeStageSettings pass on the stage list's errors", () => {
    const plan = planWithStages(1);
    assert.throws(() => renameStage(plan, "1", " Drugs"), {
      message: 'The stage name " Drugs" has spaces at the start or end. Remove them.',
    });
    assert.throws(() => changeStageSettings(plan, "9", defaultSettings()), {
      message: `There's no stage "9" in the stage list.`,
    });
  });

  test("stageEnds counts transfers cumulatively in run order, leaving out stages without transfers", () => {
    const plan = withTransfersIn(planWithStages(3), ["1", "1", "3"]);
    assert.deepEqual(stageEnds(plan), [
      { stage: "1", transfersDone: 2 },
      { stage: "3", transfersDone: 3 },
    ]);
  });

  test("stagesWithOverdraw names the stage whose transfer draws more than a well holds, and no other", () => {
    let plan = addComponent(planWithStages(3), "Media", "#4e79a7");
    plan = addToWells(plan, [trough("1"), trough("2")], "Media", 100);
    plan = addTransfer(plan, transferTo("1", "A1", 60));
    plan = addTransfer(plan, transferTo("2", "A2", 60));
    // From trough 2, which stage 2's overdraw didn't empty.
    plan = addTransfer(plan, { ...transferTo("3", "A3", 10), source: trough("2") });
    assert.deepEqual(stagesWithOverdraw(plan), new Set(["2"]));
  });

  // --- Transfers ---

  test("a stage's first transfer goes before the next stage with transfers, or last; later ones after its others", () => {
    let plan = withTransfersIn(planWithStages(2), ["1", "2"]);
    const { plan: withThree, id } = addStage(plan, "2");
    plan = addTransfer(withThree, transferTo(id, "B1"));
    assert.deepEqual(stagesOfTransfers(plan), ["1", id, "2"]);
    const { plan: withFour, id: last } = addStage(plan, null);
    assert.deepEqual(stagesOfTransfers(addTransfer(withFour, transferTo(last, "B3"))), [
      "1",
      id,
      "2",
      last,
    ]);
    plan = addTransfer(plan, transferTo(id, "B2"));
    assert.deepEqual(stagesOfTransfers(plan), ["1", id, id, "2"]);
  });

  test("addTransfers adds all, in order, as one plan", () => {
    const plan = planWithStages(1);
    const added = addTransfers(plan, [transferTo("1", "A1"), transferTo("1", "A2")]);
    assert.deepEqual(
      added.operationList.listOperations().map((operation) => operation.destination.well),
      ["A1", "A2"],
    );
  });

  test("addTransfers with one that fails throws the operation list's message, and the plan is unchanged", () => {
    const plan = planWithStages(1);
    const before = snapshot(plan);
    const bad = { ...transferTo("1", "A2"), volme: 50 };
    assert.throws(() => addTransfers(plan, [transferTo("1", "A1"), bad]), {
      message: 'A transfer can only have type, source, destination, volume and stage, but also got "volme".',
    });
    assert.equal(snapshot(plan), before);
  });

  test("a transfer to a well not on the deck throws the deck's message", () => {
    assert.throws(() => addTransfer(planWithStages(1), transferTo("1", "Z99")), {
      message: `"Z99" isn't a well on ${PLATE}. Its wells are A1 to H12.`,
    });
  });

  test("a transfer in a stage not in the plan throws", () => {
    assert.throws(() => addTransfer(planWithStages(1), transferTo("9", "A1")), {
      message: `There's no stage "9" in the plan to add this transfer to.`,
    });
  });

  test("a transfer that's null gives the operation list's message", () => {
    assert.throws(() => addTransfer(planWithStages(1), null), {
      message:
        'An operation must be an object with a type, like { type: "transfer", … }, but got null.',
    });
  });

  test("addTransfer checks the operation list's form, then the stage rule, then the source, the destination, and the stage", () => {
    const plan = withTransfersIn(planWithStages(1), ["1"]); // Res 1 → Plate A1, stage 1
    // Badly formed and in a stage that isn't in the plan: the form is reported.
    assert.throws(() => addTransfer(plan, { ...transferTo("9", "Z99"), volume: -1 }), {
      message: "The volume must be a number of microliters, 0 or more, like 50, but got -1.",
    });
    // Breaks the stage rule and its destination isn't on the deck: the stage rule is reported.
    const fromA1 = {
      ...transferTo("1", "Z99"),
      source: { labware: PLATE, well: "A1" },
    };
    assert.throws(() => addTransfer(plan, fromA1), {
      message: new RegExp(`^This transfer's source, ${PLATE} A1, is a destination in stage "1"`),
    });
    // Source and destination both not on the deck, stage not in the plan: the source is reported.
    const badEnds = {
      ...transferTo("9", "Z99"),
      source: { labware: RESERVOIR, well: "13" },
    };
    assert.throws(() => addTransfer(plan, badEnds), {
      message: `"13" isn't a well on ${RESERVOIR}. Its wells are 1 to 12.`,
    });
    // Destination not on the deck, stage not in the plan: the destination is reported.
    assert.throws(() => addTransfer(plan, transferTo("9", "Z99")), {
      message: `"Z99" isn't a well on ${PLATE}. Its wells are A1 to H12.`,
    });
  });

  test("changeVolume changes only that transfer's volume; the other transfers are the very same objects", () => {
    const plan = withTransfersIn(planWithStages(2), ["1", "1", "2"]);
    const changed = changeVolume(plan, 1, 25);
    const before = plan.operationList.listOperations();
    const after = changed.operationList.listOperations();
    assert.deepEqual(after[1], { ...before[1], volume: 25 });
    assert.equal(after[0], before[0]);
    assert.equal(after[2], before[2]);
  });

  test("changeVolume passes on the operation list's errors", () => {
    const plan = withTransfersIn(planWithStages(1), ["1"]);
    assert.throws(() => changeVolume(plan, 3, 25), {
      message: "The position to replace must be a whole number from 0 to 0, but got 3.",
    });
    assert.throws(() => changeVolume(plan, 0, -5), {
      message: "The volume must be a number of microliters, 0 or more, like 50, but got -5.",
    });
  });

  test("removeTransfer removes only that transfer", () => {
    const plan = withTransfersIn(planWithStages(1), ["1", "1", "1"]);
    const before = plan.operationList.listOperations();
    const removed = removeTransfer(plan, 1);
    assert.deepEqual(removed.operationList.listOperations(), [before[0], before[2]]);
  });

  test("with stages 1, 2 and 3 each with one transfer, removing stage 2's, then stage 3's, keeps the order 1, 2, 3", () => {
    const plan = withTransfersIn(planWithStages(3), ["1", "2", "3"]);
    const withoutTwo = removeTransfer(plan, 1);
    assert.deepEqual(stageOrder(withoutTwo), ["1", "2", "3"]);
    assert.deepEqual(stageOrder(removeTransfer(plan, 2)), ["1", "2", "3"]);
    assert.deepEqual(stageOrder(removeTransfer(withoutTwo, 1)), ["1", "2", "3"]);
  });

  test("first transfer: an empty plan's stage 1, then stage 2 added last; stage 2's first transfer leaves 1, 2", () => {
    const plan = planWithStages(2);
    assert.deepEqual(stageOrder(withTransfersIn(plan, ["2"])), ["1", "2"]);
  });

  test("first transfer: stages 1, 3, 4, 2; stage 4's first transfer leaves 1, 3, 4, 2", () => {
    let plan = withTransfersIn(planWithStages(2), ["1", "2"]);
    plan = addStage(plan, "2").plan; // stage 3
    plan = addStage(plan, "2").plan; // stage 4
    assert.deepEqual(stageOrder(plan), ["1", "3", "4", "2"]);
    plan = addTransfer(plan, transferTo("4", "B1"));
    assert.deepEqual(stageOrder(plan), ["1", "3", "4", "2"]);
  });

  test("first transfer: stages 1, 3, 2, 4; stage 4's first transfer leaves 1, 3, 2, 4", () => {
    let plan = withTransfersIn(planWithStages(1), ["1"]);
    plan = addStage(plan, null).plan; // stage 2
    plan = addStage(plan, "2").plan; // stage 3
    plan = addStage(plan, null).plan; // stage 4
    assert.deepEqual(stageOrder(plan), ["1", "3", "2", "4"]);
    plan = addTransfer(plan, transferTo("4", "B1"));
    assert.deepEqual(stageOrder(plan), ["1", "3", "2", "4"]);
  });

  test("first transfer: with a tip change before stage 2, stage 1 stays first with the START tips", () => {
    let plan = addTipChange(planWithStages(2), "2");
    plan = withTransfersIn(plan, ["2"]);
    assert.deepEqual(stageOrder(plan), ["1", "2"]);
    assert.deepEqual(
      tipGroups(plan).map((group) => [group.key, group.stages]),
      [
        [START, ["1"]],
        ["2", ["2"]],
      ],
    );
  });

  test("transfersIn gives each transfer's position, and [] for a stage without transfers or an ID that isn't a stage", () => {
    const plan = withTransfersIn(planWithStages(3), ["1", "2", "2"]);
    const operations = plan.operationList.listOperations();
    assert.deepEqual(transfersIn(plan, "2"), [
      { ...operations[1], position: 1 },
      { ...operations[2], position: 2 },
    ]);
    assert.deepEqual(transfersIn(plan, "3"), []);
    assert.deepEqual(transfersIn(plan, "9"), []);
  });

  // --- Tip changes ---

  test("tipGroups re-exported from this module gives the same groups as the shared module's", () => {
    // tipGroups and START themselves are tested in tip-groups.test.js (tip-groups.md).
    let plan = planWithStages(4);
    plan = changeStageSettings(plan, "2", { ...defaultSettings(), probes: [1, 2, 3, 4] });
    plan = addTipChange(plan, "3");
    plan = setTipType(plan, "3", TIP_TYPES.at(-1));
    assert.deepEqual(tipGroups(plan), sharedTipGroups(plan));
    assert.equal(tipGroups(plan).length, 2);
  });

  test("addTipChange takes the tip type in use", () => {
    let plan = addTipChange(planWithStages(3), "2");
    plan = setTipType(plan, "2", TIP_TYPES.at(-1));
    plan = addTipChange(plan, "3");
    assert.deepEqual(tipChangeAt(plan, "3"), { tipType: TIP_TYPES.at(-1) });
    assert.equal(canAddTipChange(planWithStages(3), "2"), true);
  });

  test("addTipChange before the first stage throws, and canAddTipChange is false", () => {
    const plan = planWithStages(2);
    assert.equal(canAddTipChange(plan, "1"), false);
    assert.throws(() => addTipChange(plan, "1"), {
      message:
        "The first stage always starts with new tips, so there can't be another tip change before it.",
    });
  });

  test("addTipChange twice in one place throws, and canAddTipChange is false", () => {
    const plan = addTipChange(planWithStages(2), "2");
    assert.equal(canAddTipChange(plan, "2"), false);
    assert.throws(() => addTipChange(plan, "2"), {
      message: `There are already new tips before stage "2".`,
    });
  });

  test("addTipChange before a stage that isn't in the plan throws, and canAddTipChange is false", () => {
    const plan = planWithStages(2);
    assert.equal(canAddTipChange(plan, "9"), false);
    assert.throws(() => addTipChange(plan, "9"), {
      message: `There's no stage "9" to add new tips before.`,
    });
  });

  test("setTipType with a known type works; an unknown one throws", () => {
    const plan = setTipType(planWithStages(1), START, TIP_TYPES.at(-1));
    assert.deepEqual(tipChangeAt(plan, START), { tipType: TIP_TYPES.at(-1) });
    const tipTypeNames = TIP_TYPES.map((tipType) => `"${tipType}"`).join(", ");
    assert.throws(() => setTipType(plan, START, "BC50"), {
      message: `"BC50" isn't a tip type. Choose one of ${tipTypeNames}.`,
    });
  });

  test("setTipType and removeTipChange throw where there's no tip change", () => {
    const plan = planWithStages(2);
    const message = `There are no new tips before stage "2".`;
    assert.throws(() => setTipType(plan, "2", TIP_TYPES[0]), { message });
    assert.throws(() => removeTipChange(plan, "2"), { message });
  });

  test("setTipType checks for a tip change before the tip type", () => {
    assert.throws(() => setTipType(planWithStages(2), "2", "BC50"), {
      message: `There are no new tips before stage "2".`,
    });
  });

  test("removeTipChange merges the two tip groups; for START it throws", () => {
    const plan = addTipChange(planWithStages(3), "2");
    const removed = removeTipChange(plan, "2");
    assert.deepEqual(
      tipGroups(removed).map((group) => group.stages),
      [["1", "2", "3"]],
    );
    assert.equal(tipChangeAt(removed, "2"), null);
    assert.throws(() => removeTipChange(plan, START), {
      message: "The run always starts by loading tips, so the first tips can't be removed.",
    });
  });

  // --- Components and starting contents ---

  test("addComponent adds a component last, with its name trimmed", () => {
    let { plan } = emptyPlan();
    plan = addComponent(plan, "Media", "#4e79a7");
    plan = addComponent(plan, "  Drug_A ", "#f28e2b");
    assert.deepEqual(plan.components, [
      { name: "Media", color: "#4e79a7" },
      { name: "Drug_A", color: "#f28e2b" },
    ]);
  });

  test("addComponent refuses a used name, a used color and a blank name", () => {
    const plan = addComponent(emptyPlan().plan, "Media", "#4e79a7");
    assert.throws(() => addComponent(plan, " Media", "#000000"), {
      message: `There's already a component called "Media". Choose a different name.`,
    });
    assert.throws(() => addComponent(plan, "Dye", "#4e79a7"), {
      message: "Media already has that color. Choose a different one.",
    });
    assert.throws(() => addComponent(plan, "   ", "#000000"), {
      message: "The component name is blank. Give it at least one character that isn't a space.",
    });
    assert.throws(() => addComponent(plan, 5, "#000000"), {
      message: componentNameNotTextMessage("5"),
    });
  });

  test("a color that isn't text, or is blank, is refused", () => {
    const plan = emptyPlan().plan;
    assert.throws(() => addComponent(plan, "Media", null), {
      message: `A component's color must be text, like "#4e79a7", but got null.`,
    });
    assert.throws(() => addComponent(plan, "Media", "  "), {
      message: `A component's color must be text, like "#4e79a7", but got "  ".`,
    });
  });

  test("addComponent checks the name (checkName, then used), then the color (text, then used)", () => {
    const plan = addComponent(emptyPlan().plan, "Media", "#4e79a7");
    assert.throws(() => addComponent(plan, 5, null), { message: componentNameNotTextMessage("5") });
    assert.throws(() => addComponent(plan, "Media", null), {
      message: `There's already a component called "Media". Choose a different name.`,
    });
    assert.throws(() => addComponent(plan, "Dye", null), {
      message: `A component's color must be text, like "#4e79a7", but got null.`,
    });
  });

  test("renameComponent renames in every well, keeping each well's components in order", () => {
    const plan = renameComponent(planWithContents(), "Media", "Medium");
    assert.deepEqual(plan.components[0], { name: "Medium", color: "#4e79a7" });
    assert.deepEqual(plan.startingContents, [
      { labware: RESERVOIR, well: "1", components: { Medium: 1000, Dye: 10 } },
      { labware: RESERVOIR, well: "2", components: { Dye: 500 } },
    ]);
    assert.deepEqual(Object.keys(plan.startingContents[0].components), ["Medium", "Dye"]);
  });

  test("renameComponent to a used name throws; to its own name (also with spaces) returns the plan unchanged", () => {
    const plan = planWithContents();
    assert.throws(() => renameComponent(plan, "Media", "Dye"), {
      message: `There's already a component called "Dye". Choose a different name.`,
    });
    assert.equal(renameComponent(plan, "Media", "Media"), plan);
    assert.equal(renameComponent(plan, "Media", " Media  "), plan);
  });

  test("renameComponent, setComponentColor and removeComponent throw for a component that isn't there, checked first", () => {
    const plan = planWithContents();
    const message = `There's no component called "Water" in this plan. Add it to the plan's components first.`;
    assert.throws(() => renameComponent(plan, "Water", 5), { message });
    assert.throws(() => setComponentColor(plan, "Water", null), { message });
    assert.throws(() => removeComponent(plan, "Water"), { message });
  });

  test("setComponentColor recolors; another component's color throws", () => {
    const plan = planWithContents();
    const recolored = setComponentColor(plan, "Dye", "#59a14f");
    assert.deepEqual(recolored.components[1], { name: "Dye", color: "#59a14f" });
    assert.throws(() => setComponentColor(plan, "Dye", "#4e79a7"), {
      message: "Media already has that color. Choose a different one.",
    });
    assert.doesNotThrow(() => setComponentColor(plan, "Dye", "#e15759"));
  });

  test("removeComponent empties wells left with nothing", () => {
    const plan = removeComponent(planWithContents(), "Dye");
    assert.deepEqual(plan.components, [{ name: "Media", color: "#4e79a7" }]);
    assert.deepEqual(plan.startingContents, [
      { labware: RESERVOIR, well: "1", components: { Media: 1000 } },
    ]);
  });

  test("countWellsWith counts the wells holding a component at the start", () => {
    const plan = planWithContents();
    assert.equal(countWellsWith(plan, "Dye"), 2);
    assert.equal(countWellsWith(plan, "Media"), 1);
    assert.equal(countWellsWith(plan, "Water"), 0);
  });

  test("addToWells adds on top: 500 then 1000 µL gives 1500 µL; other components stay", () => {
    let plan = planWithContents();
    plan = addToWells(plan, [trough("3")], "Media", 500);
    plan = addToWells(plan, [trough("3")], "Media", 1000);
    plan = addToWells(plan, [trough("1")], "Media", 500);
    assert.deepEqual(plan.startingContents, [
      { labware: RESERVOIR, well: "1", components: { Media: 1500, Dye: 10 } },
      { labware: RESERVOIR, well: "2", components: { Dye: 500 } },
      { labware: RESERVOIR, well: "3", components: { Media: 1500 } },
    ]);
  });

  test('addToWells refuses 0, -5 and "10"', () => {
    const plan = planWithContents();
    for (const [volume, shown] of [
      [0, "0"],
      [-5, "-5"],
      ["10", '"10"'],
    ]) {
      assert.throws(() => addToWells(plan, [trough("1")], "Media", volume), {
        message: `The volume to add must be a number of microliters above 0, like 100, but got ${shown}.`,
      });
    }
  });

  test("addToWells refuses a component not in the plan", () => {
    assert.throws(() => addToWells(planWithContents(), [trough("1")], "Water", 10), {
      message: `There's no component called "Water" in this plan. Add it to the plan's components first.`,
    });
  });

  test("addToWells gives a well listed twice the volume once", () => {
    const plan = addToWells(planWithContents(), [trough("4"), trough("4")], "Media", 100);
    assert.deepEqual(plan.startingContents.at(-1), {
      labware: RESERVOIR,
      well: "4",
      components: { Media: 100 },
    });
  });

  test("addToWells checks the component, then the volume, then each well in turn", () => {
    const plan = planWithContents();
    const badWells = [trough("13"), { labware: PLATE, well: "Z99" }];
    assert.throws(() => addToWells(plan, badWells, "Water", 0), {
      message: `There's no component called "Water" in this plan. Add it to the plan's components first.`,
    });
    assert.throws(() => addToWells(plan, badWells, "Media", 0), {
      message: "The volume to add must be a number of microliters above 0, like 100, but got 0.",
    });
    assert.throws(() => addToWells(plan, badWells, "Media", 10), {
      message: `"13" isn't a well on ${RESERVOIR}. Its wells are 1 to 12.`,
    });
  });

  test("emptyWells empties only those wells; the components stay; an empty well is left as it is", () => {
    const plan = emptyWells(planWithContents(), [trough("2"), trough("7")]);
    assert.deepEqual(plan.startingContents, [
      { labware: RESERVOIR, well: "1", components: { Media: 1000, Dye: 10 } },
    ]);
    assert.deepEqual(
      plan.components.map((component) => component.name),
      ["Media", "Dye"],
    );
  });

  // --- Labware ---

  test("labwareUsed lists starting contents' and transfers' labware in deck order", () => {
    let plan = addComponent(planWithStages(1), "Media", "#4e79a7");
    plan = addToWells(plan, [{ labware: OTHER_PLATE, well: "A1" }], "Media", 100);
    plan = addTransfer(plan, transferTo("1", "B2"));
    const deckOrder = DECK.map((entry) => entry.name);
    const expected = deckOrder.filter((name) => [PLATE, OTHER_PLATE, RESERVOIR].includes(name));
    assert.deepEqual(labwareUsed(plan), expected);
    assert.deepEqual(labwareUsed(planWithStages(1)), []);
  });

  test("setLabel trims; a blank label, or the labware's own name, removes it; labelOf falls back to the name", () => {
    const plan = planWithStages(1);
    assert.equal(labelOf(plan, PLATE), PLATE);
    const labelled = setLabel(plan, PLATE, "  Assay plate ");
    assert.equal(labelOf(labelled, PLATE), "Assay plate");
    for (const label of ["   ", PLATE, ` ${PLATE} `]) {
      const removed = setLabel(labelled, PLATE, label);
      assert.deepEqual(removed.labwareLabels, {});
      assert.equal(labelOf(removed, PLATE), PLATE);
    }
  });

  test("setLabel refuses labware not on the deck, then a label that isn't text", () => {
    const plan = planWithStages(1);
    assert.throws(() => setLabel(plan, PLATE, 5), {
      message: `A label must be text, like "Assay plate", but got 5.`,
    });
    assert.throws(() => setLabel(plan, "Bench", 5), {
      message: new RegExp(`^There's no labware "Bench" on the deck\\.`),
    });
  });

  test("setLabel refuses a label another labware has (also with spaces), and another labware's name", () => {
    const plan = setLabel(planWithStages(1), OTHER_PLATE, "Drug plate");
    assert.throws(() => setLabel(plan, PLATE, " Drug plate "), {
      message: `${OTHER_PLATE} already has the label "Drug plate". Choose a different one.`,
    });
    assert.throws(() => setLabel(plan, PLATE, RESERVOIR), {
      message: `${RESERVOIR} already has the label "${RESERVOIR}". Choose a different one.`,
    });
  });

  test("setLabel refuses going back to the name when another labware has that name as its label", () => {
    let plan = setLabel(planWithStages(1), PLATE, "Assay plate");
    plan = setLabel(plan, OTHER_PLATE, PLATE);
    assert.throws(() => setLabel(plan, PLATE, ""), {
      message: `${OTHER_PLATE} already has the label "${PLATE}". Choose a different one.`,
    });
  });

  test("giving a labware the label it already has changes nothing", () => {
    const plan = setLabel(planWithStages(1), PLATE, "Assay plate");
    assert.equal(setLabel(plan, PLATE, " Assay plate"), plan);
    const unlabelled = planWithStages(1);
    assert.equal(setLabel(unlabelled, PLATE, ""), unlabelled);
  });

  test("setLabels sets the whole table, judged as a whole", () => {
    const plan = planWithStages(1);
    // PLATE shows OTHER_PLATE's name, which is free because OTHER_PLATE has its own label; given in
    // that order, one label at a time would refuse it.
    const labels = { [PLATE]: OTHER_PLATE, [OTHER_PLATE]: "D1" };
    const labelled = setLabels(plan, labels);
    assert.deepEqual(labelled.labwareLabels, labels);
    assert.equal(labelOf(labelled, PLATE), OTHER_PLATE);
    assert.deepEqual(setLabels(labelled, {}).labwareLabels, {});
  });

  test("setLabels swaps two labware's labels in one step", () => {
    const plan = setLabels(planWithStages(1), { [PLATE]: "Cells", [OTHER_PLATE]: "Drugs" });
    const swapped = setLabels(plan, { [PLATE]: "Drugs", [OTHER_PLATE]: "Cells" });
    assert.deepEqual(swapped.labwareLabels, { [PLATE]: "Drugs", [OTHER_PLATE]: "Cells" });
  });

  test("setLabels refuses labels that aren't an object", () => {
    const plan = planWithStages(1);
    for (const [labels, got] of [[null, "null"], [[], "a list"], ["Plate", '"Plate"']]) {
      assert.throws(() => setLabels(plan, labels), {
        message: `The labels must be an object of labware names and labels, like { Plate: "Assay plate" }, but got ${got}.`,
      });
    }
  });

  test("setLabels refuses labware not on the deck", () => {
    assert.throws(() => setLabels(planWithStages(1), { Bench: "Spare" }), {
      message: new RegExp(`^There's no labware "Bench" on the deck\\.`),
    });
  });

  test("setLabels refuses a label it would otherwise have to tidy, each with its message", () => {
    const plan = planWithStages(1);
    const cases = [
      [5, `The label for ${PLATE} must be text, like "Assay plate", but got 5.`],
      ["", `The label for ${PLATE} is blank. A labware without a label is left out of the labels.`],
      ["  ", `The label for ${PLATE} is blank. A labware without a label is left out of the labels.`],
      [
        " Assay plate",
        `The label for ${PLATE}, " Assay plate", has spaces at the start or end. Remove them.`,
      ],
      [PLATE, `The label for ${PLATE} is its own name. A labware without a label is left out of the labels.`],
    ];
    for (const [label, message] of cases) {
      assert.throws(() => setLabels(plan, { [PLATE]: label }), { message });
    }
  });

  test("setLabels refuses two labware that would show one label, naming the pair in deck order", () => {
    const plan = planWithStages(1);
    // OTHER_PLATE has no label in the new table, so it shows its own name.
    assert.throws(() => setLabels(plan, { [PLATE]: OTHER_PLATE }), {
      message: `${PLATE} and ${OTHER_PLATE} would both show as "${OTHER_PLATE}". Give each labware a different label.`,
    });
    assert.throws(() => setLabels(plan, { [OTHER_PLATE]: "Drug plate", [PLATE]: "Drug plate" }), {
      message: `${PLATE} and ${OTHER_PLATE} would both show as "Drug plate". Give each labware a different label.`,
    });
  });

  test("setLabels checks in order: the object, then each entry's labware then label, then the table", () => {
    const plan = planWithStages(1);
    // The first entry's label is wrong and the second's labware isn't on the deck: the first entry
    // is reported.
    assert.throws(() => setLabels(plan, { [PLATE]: 5, Bench: "Spare" }), {
      message: new RegExp(`^The label for ${PLATE} must be text`),
    });
    // The labware is checked before its label.
    assert.throws(() => setLabels(plan, { Bench: 5 }), {
      message: new RegExp(`^There's no labware "Bench" on the deck\\.`),
    });
    // A shared label is reported only once every entry passes: here the second entry's label is
    // wrong, though the first already shares a label.
    assert.throws(() => setLabels(plan, { [PLATE]: OTHER_PLATE, [RESERVOIR]: "" }), {
      message: new RegExp(`^The label for ${RESERVOIR} is blank\\.`),
    });
  });

  test("a refused label table leaves the plan unchanged", () => {
    const plan = setLabels(planWithStages(1), { [PLATE]: "Assay plate" });
    const before = snapshot(plan);
    assert.throws(() => setLabels(plan, { [PLATE]: OTHER_PLATE }));
    assert.equal(snapshot(plan), before);
  });

  // --- Immutability and sharing ---

  // Each edit, made on a plan with something in every part, and the parts it may change.
  const EDITS = [
    ["addStage", (plan) => addStage(plan, "2").plan, ["stageList", "stageOrder"]],
    ["renameStage", (plan) => renameStage(plan, "1", "Seeding"), ["stageList"]],
    [
      "changeStageSettings",
      (plan) => changeStageSettings(plan, "1", { ...defaultSettings(), probes: [1] }),
      ["stageList"],
    ],
    ["removeStage", (plan) => removeStage(plan, "3"), ["operationList", "stageList", "stageOrder", "tipChanges"]],
    ["addTransfer", (plan) => addTransfer(plan, transferTo("1", "C1")), ["operationList"]],
    ["changeVolume", (plan) => changeVolume(plan, 0, 25), ["operationList"]],
    ["removeTransfer", (plan) => removeTransfer(plan, 0), ["operationList"]],
    ["addTipChange", (plan) => addTipChange(plan, "3"), ["tipChanges"]],
    ["setTipType", (plan) => setTipType(plan, "2", TIP_TYPES.at(-1)), ["tipChanges"]],
    ["removeTipChange", (plan) => removeTipChange(plan, "2"), ["tipChanges"]],
    ["addComponent", (plan) => addComponent(plan, "Water", "#76b7b2"), ["components"]],
    ["renameComponent", (plan) => renameComponent(plan, "Dye", "Drug"), ["components", "startingContents"]],
    ["setComponentColor", (plan) => setComponentColor(plan, "Dye", "#59a14f"), ["components"]],
    ["removeComponent", (plan) => removeComponent(plan, "Dye"), ["components", "startingContents"]],
    ["addToWells", (plan) => addToWells(plan, [trough("5")], "Media", 10), ["startingContents"]],
    ["emptyWells", (plan) => emptyWells(plan, [trough("2")]), ["startingContents"]],
    ["setLabel", (plan) => setLabel(plan, PLATE, "Cells"), ["labwareLabels"]],
    ["setLabels", (plan) => setLabels(plan, { [PLATE]: "Cells" }), ["labwareLabels"]],
    ["setExperimentName", (plan) => setExperimentName(plan, "Exp37"), ["experimentName"]],
  ];

  // A plan with something in every part: components and starting contents, stages 1 and 2 with
  // transfers, stage 3 without, a tip change before stage 2, a label and an experiment name.
  function fullPlan() {
    let plan = withTransfersIn(planWithContents(), ["1"]);
    plan = addStage(plan, null).plan;
    plan = addStage(plan, null).plan;
    plan = addTransfer(plan, transferTo("2", "B1"));
    plan = addTipChange(plan, "2");
    plan = setLabel(plan, OTHER_PLATE, "Drug plate");
    return setExperimentName(plan, "Exp36");
  }

  test("every edit leaves the plan it was given unchanged", () => {
    for (const [name, edit] of EDITS) {
      const plan = fullPlan();
      const before = snapshot(plan);
      edit(plan);
      assert.equal(snapshot(plan), before, name);
    }
  });

  test("after any edit, parts it didn't change are the very same objects in the new plan", () => {
    for (const [name, edit, changedParts] of EDITS) {
      const plan = fullPlan();
      const edited = edit(plan);
      for (const part of PLAN_PARTS.filter((candidate) => !changedParts.includes(candidate))) {
        assert.equal(edited[part], plan[part], `${name}: ${part}`);
      }
    }
  });

  // More edits that move stages or blocks, beyond EDITS: each made on fullPlan(), in which stage 1
  // has one transfer, stage 2 has one, and stage 3 has none.
  const ORDER_EDITS = [
    ["addStage, last", (plan) => addStage(plan, null).plan],
    ["addStage before the first, taking tips", (plan) => addStage(plan, "1", { takeTips: true }).plan],
    ["addTransfer, a stage's first", (plan) => addTransfer(plan, transferTo("3", "C2"))],
    [
      "addTransfer, the first of a stage added in the middle",
      (plan) => {
        const { plan: added, id } = addStage(plan, "2");
        return addTransfer(added, transferTo(id, "C3"));
      },
    ],
    ["addTransfers", (plan) => addTransfers(plan, [transferTo("3", "C4"), transferTo("1", "C5")])],
    ["removeStage, with transfers", (plan) => removeStage(plan, "2")],
  ];

  test("after every kind of edit, the stage order holds every stage once, and the operation list's blocks follow it", () => {
    for (const [name, edit] of [...EDITS, ...ORDER_EDITS]) {
      const edited = edit(fullPlan());
      const order = stageOrder(edited);
      const stages = edited.stageList.listStages().map((stage) => stage.id);
      assert.deepEqual([...order].sort(), [...stages].sort(), `${name}: every stage`);
      assert.equal(new Set(order).size, order.length, `${name}: each once`);
      const blocks = edited.operationList.groupByStage().map((group) => group.stage);
      assert.deepEqual(
        blocks,
        order.filter((id) => blocks.includes(id)),
        `${name}: blocks in stage order`,
      );
    }
  });

  test("starting contents entries an edit didn't change are the very same objects", () => {
    const plan = planWithContents();
    const edited = addToWells(plan, [trough("1")], "Media", 10);
    assert.equal(edited.startingContents[1], plan.startingContents[1]);
  });

  test("a plan can't be changed: its parts are frozen", () => {
    const plan = planWithContents();
    assert.throws(() => {
      plan.components.push({ name: "Water", color: "#000000" });
    }, TypeError);
    assert.throws(() => {
      plan.startingContents[0].components.Media = 5;
    }, TypeError);
  });
});
