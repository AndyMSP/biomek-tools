// Unit tests for transfer-designer.js. Each test comes from the "Test cases" section of
// transfer-designer.md, and each row of its error table and each order of checks has one.
//
// They use the real config/pipetting-modes.js, config/tip-types.js and config/deck.js, and also check
// the first two, and DEFAULT_MIX, MIX_STEP_MODE and MIX_STEP_VOLUME in config/mixing.js (ADR 0009). Tests find what they need in the config files rather than naming it, so
// they still pass when the configuration changes.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PIPETTING_MODES, DEFAULT_PIPETTING_MODE } from "../../../config/pipetting-modes.js";
import { TIP_TYPES, DEFAULT_PROBE_COUNT } from "../../../config/tip-types.js";
import { DECK } from "../../../config/deck.js";
import { gridOf, capacityOf, deadVolumeOf, growthAreaOf } from "../../shared/deck/deck.js";
import { GRID_96, GRID_1X12_NUMBERED } from "../../shared/well-grid/well-grid.js";
import {
  DEFAULT_MIX as CONFIGURED_DEFAULT_MIX,
  MIN_MIX_VOLUME,
  MIX_STEP_MODE,
  MIX_STEP_VOLUME,
} from "../../../config/mixing.js";
import { checkName } from "../../shared/input-checks/input-checks.js";
import { describeValue } from "../../shared/error-messages/error-messages.js";
import { tipGroups as sharedTipGroups } from "../../shared/tip-groups/tip-groups.js";
import { replay } from "../../shared/contents-tracking/contents-tracking.js";
import { writeRunFiles } from "../../shared/file-writer/file-writer.js";
import {
  NEW_STAGE_NAME,
  NEW_MIX_STEP_NAME,
  START,
  DEFAULT_MIX,
  emptyPlan,
  setExperimentName,
  defaultSettings,
  probesFor,
  modesFor,
  modeSettings,
  modeOf,
  stageOrder,
  addStage,
  addMixStep,
  addStageWithNewTips,
  addMixStepWithNewTips,
  isMixStep,
  mixWells,
  unmixWell,
  renameStage,
  changeStageSettings,
  setStageMix,
  canRemoveStage,
  removeStage,
  stageEnds,
  stagesWithContentsProblem,
  stagesWithMixProblem,
  addTransfer,
  addTransfers,
  changeVolume,
  removeTransfer,
  transfersIn,
  tipChangeAt,
  canAddTipChange,
  addTipChange,
  setTipType,
  setTipProbes,
  removeTipChange,
  tipsUsed,
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
  wellLabelOf,
  setWellLabel,
  setWellLabels,
  addRandomization,
  randomizationAt,
  randomizationOf,
  setRandomization,
  placeRandomization,
  randomizationProblems,
  fillerShares,
  isRandomizationOutOfDate,
  sourceName,
  sourceGroups,
  setSourceSharesTips,
  moveSource,
  removeSources,
  tipSetsToMake,
  runRandomization,
  randomizationStageValues,
  removeRandomization,
  canRemoveRandomization,
  renameRandomization,
  setRandomizations,
  setConstituents,
  concentrationsOf,
  setOsmolality,
  osmolalityOf,
  seedingDensitiesOf,
  columnBoxes,
  moveItems,
  copyOf,
  copyItems,
  pasteItems,
  deleteItems,
  COPIED_ITEMS_FORMAT,
  COPIED_ITEMS_VERSION,
  isWellUsed,
  isWellToFill,
  moveWell,
  readTransferTable,
  stockWellsOf,
  sourceWellsOf,
  hasComponentNamed,
  transferTableProblems,
  sourceSplit,
  transferTableStages,
  addTransferTable,
  updateTransferTable,
  removeTransferTable,
  canRemoveTransferTable,
  transferTableAt,
  transferTableOf,
  isTransferTableOutOfDate,
  setTransferTables,
  readStockTable,
  addStocks,
  stockTable,
  copyDeck,
  pasteDeck,
  COPIED_DECK_FORMAT,
  COPIED_DECK_VERSION,
} from "./transfer-designer.js";
import { PlanHistory } from "./plan-history.js";
import { planToText, planFromText } from "./plan-file.js";
import { assignPool } from "../../shared/random-pool/random-pool.js";
import {
  CONCENTRATION_UNITS,
  CELL_DENSITY_UNIT,
  UNIT_SPELLINGS,
} from "../../../config/concentration-units.js";
import { COMPONENT_COLORS } from "../../../config/component-colors.js";
import {
  deleteTestPlan,
  stageIdOf,
  planOutline,
  biomekOutput,
  GROUP_TIPS,
  TABLE_TIPS,
} from "../../../tests/fixtures/delete-test-plan.js";
import { familyOf, unitsOf, seedingDensity } from "../../shared/concentrations/concentrations.js";

// Two 96-well labware and the numbered (reservoir) labware, found in DECK.
const [PLATE, OTHER_PLATE] = DECK.filter((entry) => gridOf(entry.name) === GRID_96).map(
  (entry) => entry.name,
);
const RESERVOIR = DECK.find((entry) => gridOf(entry.name) === GRID_1X12_NUMBERED).name;

// A 96-well labware other than PLATE and OTHER_PLATE, for well labels on labware that's otherwise
// unused (the last 96-well labware in DECK).
const LABELED_ONLY = DECK.filter((entry) => gridOf(entry.name) === GRID_96).at(-1).name;

// A 96-well labware of a different labware type from PLATE's (a deep-well plate), for a
// randomization's sources.
const DEEP = DECK.find(
  (entry) => gridOf(entry.name) === GRID_96 && entry.labwareType !== DECK.find((plate) => plate.name === PLATE).labwareType,
).name;

// The parts every plan has.
const PLAN_PARTS = [
  "components",
  "startingContents",
  "operationList",
  "stageList",
  "stageOrder",
  "tipChanges",
  "labwareLabels",
  "wellLabels",
  "randomizations",
  "transferTables",
  "experimentName",
];

// A new plan's START tip change: the first tip type, on the first DEFAULT_PROBE_COUNT probes.
// A new object each time.
function startTips() {
  return { tipType: TIP_TYPES[0], probes: probesFor(DEFAULT_PROBE_COUNT) };
}

// A stage's settings that differ from the default at the source: the last source mode that isn't
// the default one, with the default at the destination. Lets a test tell two stages' settings apart.
function otherSettings() {
  const otherMode = modesFor("source")
    .filter((mode) => mode.name !== DEFAULT_PIPETTING_MODE)
    .at(-1);
  return { ...defaultSettings(), ...modeSettings("source", otherMode.name) };
}

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

// A plan with stages "1" to "5", each with a transfer, in tip groups [1, 2] on the START tips and
// [3, 4, 5] on the second tip type on probes [1, 2], keyed by "3" (the specification's example of
// removing a tip group's first stage). Needs at least 2 tip types.
function planWithFirstStageTips() {
  let plan = withTransfersIn(planWithStages(5), ["1", "2", "3", "4", "5"]);
  plan = addTipChange(plan, "3");
  plan = setTipType(plan, "3", TIP_TYPES[1]);
  return setTipProbes(plan, "3", [1, 2]);
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

// The mix the specification's examples use. A new object each time.
function exampleMix() {
  return { share: 90, times: 3, speed: 400 };
}

// A pipetting mode that can mix, usable at both ends, and one that can't (Non-Contact, at the
// destination only), found in PIPETTING_MODES.
const MIXING_MODE = PIPETTING_MODES.find(
  (mode) => mode.mixingTechnique !== null && mode.name === DEFAULT_PIPETTING_MODE,
);
const NON_MIXING_MODE = PIPETTING_MODES.find((mode) => mode.mixingTechnique === null);

// The default mix step settings, built from config/mixing.js: MIX_STEP_MODE at both ends, no source
// mix, and DEFAULT_MIX at the destination (transfer-designer.md, "Mix steps"). A new object each
// time.
function mixStepDefaults() {
  return {
    sourceTechnique: MIX_STEP_MODE.technique,
    sourceLiquidType: MIX_STEP_MODE.liquidType,
    destinationTechnique: MIX_STEP_MODE.technique,
    destinationLiquidType: MIX_STEP_MODE.liquidType,
    sourceMix: null,
    destinationMix: { ...CONFIGURED_DEFAULT_MIX },
  };
}

// A well on PLATE, e.g. plateWell("A1") → { labware: "Plate1", well: "A1" }.
function plateWell(well) {
  return { labware: PLATE, well };
}

// The transfer that mixes `well` in mix step `stage`: from the well into itself, of
// MIX_STEP_VOLUME.
function mixedWell(stage, well) {
  return { type: "transfer", source: well, destination: well, volume: MIX_STEP_VOLUME, stage };
}

// The plan with mix step `id`'s destination mix changed to `mix` (accepted, since a mix step's
// technique isn't one of the modes', so the mixing rule doesn't check it).
function withMixStepMix(plan, id, mix) {
  return changeStageSettings(plan, id, { ...plan.stageList.get(id).settings, destinationMix: mix });
}

// The message checkName gives for a component name that isn't text, e.g. for 5.
function componentNameNotTextMessage(got) {
  return `The component name must be text, but got ${got}.`;
}

// Units for the constituent tests, named by symbol as concentrations.md, section 6, allows, with
// everything else about them read from config/concentration-units.js: a molar unit, a mass unit
// (the base, factor 1) and a mass unit of another scale, and the offered units in the file's order.
const MOLAR_UNIT = "mM";
const MASS_UNIT = "g/L";
const MASS_SUBUNIT = CONCENTRATION_UNITS.find(
  (entry) => entry.family === familyOf(MASS_UNIT) && entry.unit !== MASS_UNIT,
).unit;
const OFFERED_UNITS = CONCENTRATION_UNITS.filter((entry) => entry.offered).map((entry) => entry.unit);

// The factor of the unit with symbol `unit`, from the file.
function factorOf(unit) {
  return CONCENTRATION_UNITS.find((entry) => entry.unit === unit).factor;
}

// A constituent { name, amount, unit }. A new object each time.
function constituentOf(name, amount, unit) {
  return { name, amount, unit };
}

// The family message for `name`, carried in `unit` by component `component`, the units from unitsOf.
function familyMessage(name, unit, component) {
  return `${name} is in ${unit} in ${component}. Give it a unit of that kind (${unitsOf(familyOf(unit)).join(", ")}), or a different name.`;
}

// planWithContents plus a component "Feeding media" carrying Hy-Soy at 4 of the mass unit.
function planWithFeedingMedia() {
  let plan = addComponent(planWithContents(), "Feeding media", "#59a14f");
  return setConstituents(plan, "Feeding media", [constituentOf("Hy-Soy", 4, MASS_UNIT)]);
}

// Whether `actual` is within 1e-12 of `expected`, relative to the value (concentrations.md).
function assertWithin(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) <= Math.abs(expected) * 1e-12,
    `${actual} is within 1e-12 of ${expected}`,
  );
}

// Asserts that an osmolality `actual` is within 1e-9 mOsm/kg of `expected`, an absolute difference
// as osmolality.md compares, so an expected 0 still allows arithmetic leftovers.
function assertOsmolalityWithin(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} is within 1e-9 of ${expected}`);
}

// A plan where DEEP A1 (a deep well, so 1000 µL fits) holds 900 µL of Media (osmolality `media`) and one transfer in stage "1"
// brings 100 µL of Water (osmolality `water`) into it from trough 5, which holds enough over its
// dead volume to give the full 100 µL, e.g. waterIntoMediaPlan(300, 0).
function waterIntoMediaPlan(media, water) {
  let { plan } = emptyPlan();
  plan = addComponent(plan, "Media", "#4e79a7");
  plan = addComponent(plan, "Water", "#76b7b2");
  plan = setOsmolality(plan, "Media", media);
  plan = setOsmolality(plan, "Water", water);
  plan = addToWells(plan, [{ labware: DEEP, well: "A1" }], "Media", 900);
  plan = addToWells(plan, [trough("5")], "Water", deadVolumeOf(RESERVOIR) + 1000);
  return addTransfer(plan, {
    type: "transfer",
    source: trough("5"),
    destination: { labware: DEEP, well: "A1" },
    volume: 100,
    stage: "1",
  });
}

// A labware with a growth area and one without, found in DECK by growthAreaOf, never named.
const GROWING = DECK.find((entry) => growthAreaOf(entry.name) !== null).name;
const NOT_GROWING = DECK.find(
  (entry) => growthAreaOf(entry.name) === null && gridOf(entry.name) === GRID_96,
).name;

// The well { labware, well }, e.g. wellOn("Plate1", "A1").
function wellOn(labware, well) {
  return { labware, well };
}

// planWithContents plus a component "Suspension" carrying Cells at 1500000 in CELL_DENSITY_UNIT.
function planWithCells() {
  const plan = addComponent(planWithContents(), "Suspension", "#f28e2b");
  return setConstituents(plan, "Suspension", [constituentOf("Cells", 1500000, CELL_DENSITY_UNIT)]);
}

// The plan with `well` holding `volume` µL: 10% Suspension and 90% Media.
function withCellsIn(plan, well, volume) {
  const withSuspension = addToWells(plan, [well], "Suspension", volume * 0.1);
  return addToWells(withSuspension, [well], "Media", volume * 0.9);
}

describe("transfer-designer", () => {
  // --- Configuration: config/pipetting-modes.js ---

  test("each pipetting mode has exactly name, technique, mixingTechnique, liquidType, ends and touchesLiquid", () => {
    for (const mode of PIPETTING_MODES) {
      assert.deepEqual(Object.keys(mode).sort(), [
        "ends",
        "liquidType",
        "mixingTechnique",
        "name",
        "technique",
        "touchesLiquid",
      ]);
    }
  });

  test("each mode's touchesLiquid is a boolean, true for every mode usable at the source", () => {
    for (const mode of PIPETTING_MODES) {
      assert.equal(typeof mode.touchesLiquid, "boolean", mode.name);
      if (mode.ends.includes("source")) {
        assert.equal(mode.touchesLiquid, true, mode.name);
      }
    }
  });

  test("a mode that doesn't touch the liquid can't mix", () => {
    for (const mode of PIPETTING_MODES.filter((candidate) => !candidate.touchesLiquid)) {
      assert.equal(mode.mixingTechnique, null, mode.name);
    }
  });

  test("the lab's modes: Slow, Medium and Fast touch the liquid; Non-Contact doesn't", () => {
    // Whether the mode called `name` touches the liquid, e.g. "Slow" → true.
    const touchesOf = (name) => PIPETTING_MODES.find((mode) => mode.name === name).touchesLiquid;
    for (const name of ["Slow", "Medium", "Fast"]) {
      assert.equal(touchesOf(name), true, name);
    }
    assert.equal(touchesOf("Non-Contact"), false);
  });

  test("each mode's mixingTechnique is a valid name other than its technique, or null", () => {
    for (const mode of PIPETTING_MODES) {
      if (mode.mixingTechnique !== null) {
        assert.doesNotThrow(() => checkName(mode.mixingTechnique, "technique"), mode.name);
        assert.notEqual(mode.mixingTechnique, mode.technique, mode.name);
      }
    }
  });

  test("the lab's modes: Slow, Medium and Fast mix with OperationMix; Non-Contact can't mix", () => {
    // The mixing technique of the mode called `name`, e.g. "Medium" → "OperationMix".
    const mixingOf = (name) => PIPETTING_MODES.find((mode) => mode.name === name).mixingTechnique;
    for (const name of ["Slow", "Medium", "Fast"]) {
      assert.equal(mixingOf(name), "OperationMix", name);
    }
    assert.equal(mixingOf("Non-Contact"), null);
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

  test("for each end, no technique-and-liquid-type pair repeats among its modes' techniques and mixing techniques, and each end has a mode", () => {
    for (const end of ["source", "destination"]) {
      const modes = PIPETTING_MODES.filter((mode) => mode.ends.includes(end));
      assert.ok(modes.length > 0, end);
      const pairs = modes.flatMap((mode) =>
        [mode.technique, mode.mixingTechnique]
          .filter((technique) => technique !== null)
          .map((technique) => JSON.stringify([technique, mode.liquidType])),
      );
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

  test("DEFAULT_PROBE_COUNT is a whole number from 1 to 8", () => {
    assert.ok(Number.isInteger(DEFAULT_PROBE_COUNT));
    assert.ok(DEFAULT_PROBE_COUNT >= 1 && DEFAULT_PROBE_COUNT <= 8);
  });

  // --- Configuration: config/mixing.js ---

  test("DEFAULT_MIX is accepted by the stage list as a mix, at either end, with the mixing technique", () => {
    const plan = planWithStages(1);
    for (const end of ["source", "destination"]) {
      const settings = {
        ...defaultSettings(),
        ...modeSettings(end, MIXING_MODE.name, true),
        [`${end}Mix`]: DEFAULT_MIX,
      };
      const changed = changeStageSettings(plan, "1", settings);
      assert.deepEqual(changed.stageList.get("1").settings[`${end}Mix`], DEFAULT_MIX, end);
    }
  });

  test("DEFAULT_MIX is config/mixing.js's default mix, and as exported here can't be changed", () => {
    assert.deepEqual(DEFAULT_MIX, CONFIGURED_DEFAULT_MIX);
    assert.ok(Object.isFrozen(DEFAULT_MIX));
    assert.throws(() => {
      DEFAULT_MIX.share = 50;
    }, TypeError);
    assert.equal(DEFAULT_MIX.share, CONFIGURED_DEFAULT_MIX.share);
  });

  test("config/mixing.js: MIX_STEP_MODE's technique and liquid type are names, the liquid type follows Biomek's rule, and the technique is no mode's technique or mixing technique", () => {
    assert.deepEqual(Object.keys(MIX_STEP_MODE).sort(), ["liquidType", "technique"]);
    assert.doesNotThrow(() => checkName(MIX_STEP_MODE.technique, "technique"));
    assert.doesNotThrow(() => checkName(MIX_STEP_MODE.liquidType, "liquid type"));
    assert.match(MIX_STEP_MODE.liquidType, /^[A-Za-z][A-Za-z0-9_]*$/);
    for (const mode of PIPETTING_MODES) {
      assert.notEqual(MIX_STEP_MODE.technique, mode.technique, mode.name);
      assert.notEqual(MIX_STEP_MODE.technique, mode.mixingTechnique, mode.name);
    }
  });

  test("config/mixing.js: MIX_STEP_VOLUME is a number above 0", () => {
    assert.ok(Number.isFinite(MIX_STEP_VOLUME) && MIX_STEP_VOLUME > 0);
  });

  // --- Plans and modes ---

  test("defaultSettings() gives the default mode's technique and liquid type at both ends, sourceMix and destinationMix null, and nothing else", () => {
    const mode = PIPETTING_MODES.find((candidate) => candidate.name === DEFAULT_PIPETTING_MODE);
    assert.deepEqual(defaultSettings(), {
      sourceTechnique: mode.technique,
      sourceLiquidType: mode.liquidType,
      destinationTechnique: mode.technique,
      destinationLiquidType: mode.liquidType,
      sourceMix: null,
      destinationMix: null,
    });
  });

  test("emptyPlan() gives one stage with default settings, START tips of the first tip type on the first DEFAULT_PROBE_COUNT probes, no experiment name, no well labels, and nothing else", () => {
    const { plan, stageId } = emptyPlan();
    assert.deepEqual(Object.keys(plan).sort(), [...PLAN_PARTS].sort());
    assert.deepEqual(plan.stageList.listStages(), [
      { id: stageId, name: NEW_STAGE_NAME, settings: defaultSettings() },
    ]);
    assert.equal(NEW_STAGE_NAME, "New stage");
    assert.deepEqual(plan.tipChanges, { [START]: startTips() });
    assert.equal(plan.tipChanges[START].probes.length, DEFAULT_PROBE_COUNT);
    assert.equal(plan.tipChanges[START].probes[0], 1);
    assert.deepEqual(plan.components, []);
    assert.deepEqual(plan.startingContents, []);
    assert.deepEqual(plan.operationList.listOperations(), []);
    assert.deepEqual(plan.stageOrder, [stageId]);
    assert.deepEqual(plan.labwareLabels, {});
    assert.deepEqual(plan.wellLabels, {});
    assert.deepEqual(plan.transferTables, []);
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

  test("modeSettings and modeOf round-trip every mode at every end it allows, with mixes false and, for a mode that can mix, true", () => {
    for (const mode of PIPETTING_MODES) {
      for (const end of mode.ends) {
        const settings = { ...defaultSettings(), ...modeSettings(end, mode.name) };
        assert.deepEqual(modeSettings(end, mode.name), {
          [`${end}Technique`]: mode.technique,
          [`${end}LiquidType`]: mode.liquidType,
        });
        assert.deepEqual(modeSettings(end, mode.name, false), modeSettings(end, mode.name));
        assert.equal(modeOf(end, settings), mode.name, `${mode.name} at the ${end}`);
        if (mode.mixingTechnique !== null) {
          const mixing = { ...defaultSettings(), ...modeSettings(end, mode.name, true) };
          assert.deepEqual(modeSettings(end, mode.name, true), {
            [`${end}Technique`]: mode.mixingTechnique,
            [`${end}LiquidType`]: mode.liquidType,
          });
          assert.equal(modeOf(end, mixing), mode.name, `${mode.name} mixing at the ${end}`);
        }
      }
    }
  });

  test('modeSettings("source", "Slow", true) gives OperationMix with Slow\'s liquid type', () => {
    assert.deepEqual(modeSettings("source", "Slow", true), {
      sourceTechnique: "OperationMix",
      sourceLiquidType: "Slow",
    });
  });

  test("modeSettings with mixes true refuses a mode that can't mix", () => {
    assert.throws(() => modeSettings("destination", NON_MIXING_MODE.name, true), {
      message:
        `${NON_MIXING_MODE.name} can't mix, so it can't be used at the destination while the ` +
        "destination mixes. Turn the destination's mixing off first.",
    });
  });

  test("modeSettings checks the mode for the end before whether it can mix", () => {
    assert.throws(() => modeSettings("source", NON_MIXING_MODE.name, true), {
      message: new RegExp(`^"${NON_MIXING_MODE.name}" isn't a pipetting mode for the source\\.`),
    });
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

  test("addStage copies the settings of the nearest transfer stage before it; added before the first stage, the nearest after it", () => {
    let plan = planWithStages(2);
    const firstSettings = otherSettings();
    const secondSettings = defaultSettings();
    assert.notDeepEqual(firstSettings, secondSettings);
    plan = changeStageSettings(plan, "1", firstSettings);
    plan = changeStageSettings(plan, "2", secondSettings);

    const last = addStage(plan, null);
    assert.deepEqual(last.plan.stageList.get(last.id).settings, secondSettings);
    const middle = addStage(plan, "2");
    assert.deepEqual(middle.plan.stageList.get(middle.id).settings, firstSettings);
    const first = addStage(plan, "1");
    assert.deepEqual(first.plan.stageList.get(first.id).settings, firstSettings);
  });

  test("addStage copies the mixes too: copying a stage with a sourceMix and a destinationMix gives the same mixes, techniques and liquid types", () => {
    let plan = planWithStages(2);
    plan = changeStageSettings(plan, "1", otherSettings());
    plan = setStageMix(plan, "1", "source", { share: 90, times: 3, speed: 400 });
    plan = setStageMix(plan, "1", "destination", { share: 50, times: 2, speed: 100 });
    const mixingSettings = plan.stageList.get("1").settings;

    const middle = addStage(plan, "2");
    assert.deepEqual(middle.plan.stageList.get(middle.id).settings, mixingSettings);
    const first = addStage(plan, "1");
    assert.deepEqual(first.plan.stageList.get(first.id).settings, mixingSettings);
    const last = addStage(plan, null);
    assert.deepEqual(last.plan.stageList.get(last.id).settings, defaultSettings());
  });

  test("addStage with takeTips before a stage with a tip change moves the tip change to the new stage", () => {
    const plan = addTipChange(planWithStages(3), "3");
    const { plan: added, id } = addStage(plan, "3", { takeTips: true });
    assert.deepEqual(tipChangeAt(added, id), startTips());
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
    assert.deepEqual(tipChangeAt(added, "3"), startTips());
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
      assert.deepEqual(added.tipChanges, { [START]: { ...startTips(), tipType: TIP_TYPES.at(-1) } });
      assert.equal(tipGroups(added)[0].key, START);
    }
  });

  test("addStage before a stage that isn't in the plan throws", () => {
    assert.throws(() => addStage(planWithStages(1), "9"), {
      message: `There's no stage "9" to add a stage before.`,
    });
  });

  // --- Adding in a tip group of its own: addStageWithNewTips and addMixStepWithNewTips ---

  // The specification's plan for these cases: three stages, START tips of the first tip type on
  // probes [1, 2], and a tip change of the last tip type on probes [1, 2, 3, 4] before stage 3.
  function planWithTwoTipGroups() {
    let plan = setTipProbes(planWithStages(3), START, [1, 2]);
    plan = addTipChange(plan, "3");
    plan = setTipType(plan, "3", TIP_TYPES.at(-1));
    return setTipProbes(plan, "3", [1, 2, 3, 4]);
  }

  // The START tips and stage 3's tips in planWithTwoTipGroups(). New objects each time.
  function firstTips() {
    return { tipType: TIP_TYPES[0], probes: [1, 2] };
  }
  function laterTips() {
    return { tipType: TIP_TYPES.at(-1), probes: [1, 2, 3, 4] };
  }

  // The stages of each tip group in the plan, e.g. [["1", "2"], ["3"]].
  function groupStages(plan) {
    return tipGroups(plan).map((group) => group.stages);
  }

  // The two functions under test, each with the kind of stage it adds, so each case runs for both.
  const ADD_WITH_NEW_TIPS = [
    ["addStageWithNewTips", addStageWithNewTips, NEW_STAGE_NAME, false],
    ["addMixStepWithNewTips", addMixStepWithNewTips, NEW_MIX_STEP_NAME, true],
  ];

  test("addStageWithNewTips and addMixStepWithNewTips before the first stage of a tip group: the new stage gets a tip change loading the tips in use there; that stage's tip change is unchanged", () => {
    for (const [name, add, stageName, mixStep] of ADD_WITH_NEW_TIPS) {
      const { plan, id } = add(planWithTwoTipGroups(), "3");
      assert.deepEqual(stageOrder(plan), ["1", "2", id, "3"], name);
      assert.equal(plan.stageList.get(id).name, stageName, name);
      assert.equal(isMixStep(plan, id), mixStep, name);
      assert.deepEqual(tipChangeAt(plan, id), firstTips(), name);
      assert.deepEqual(tipChangeAt(plan, "3"), laterTips(), name);
      assert.deepEqual(tipChangeAt(plan, START), firstTips(), name);
      assert.deepEqual(groupStages(plan), [["1", "2"], [id], ["3"]], name);
    }
  });

  test("addStageWithNewTips inside a tip group: the new stage and the stage after it each get a tip change loading the tips in use there", () => {
    const { plan, id } = addStageWithNewTips(planWithTwoTipGroups(), "2");
    assert.deepEqual(stageOrder(plan), ["1", id, "2", "3"]);
    assert.deepEqual(tipChangeAt(plan, id), firstTips());
    assert.deepEqual(tipChangeAt(plan, "2"), firstTips());
    assert.deepEqual(tipChangeAt(plan, "3"), laterTips());
    assert.deepEqual(groupStages(plan), [["1"], [id], ["2"], ["3"]]);
  });

  test("addStageWithNewTips and addMixStepWithNewTips before stage 1: the new stage is first with the START tips, unchanged, and old stage 1 gets a tip change loading them", () => {
    for (const [name, add, , mixStep] of ADD_WITH_NEW_TIPS) {
      const { plan, id } = add(planWithTwoTipGroups(), "1");
      assert.deepEqual(stageOrder(plan), [id, "1", "2", "3"], name);
      assert.equal(isMixStep(plan, id), mixStep, name);
      assert.deepEqual(tipChangeAt(plan, START), firstTips(), name);
      assert.equal(tipChangeAt(plan, id), null, name);
      assert.deepEqual(tipChangeAt(plan, "1"), firstTips(), name);
      assert.deepEqual(tipChangeAt(plan, "3"), laterTips(), name);
      assert.deepEqual(groupStages(plan), [[id], ["1", "2"], ["3"]], name);
      assert.equal(tipGroups(plan)[0].key, START, name);
    }
  });

  test("addStageWithNewTips and addMixStepWithNewTips with null: the new stage is last, with a tip change loading the tips in use at the end, and nothing after it changes", () => {
    for (const [name, add, , mixStep] of ADD_WITH_NEW_TIPS) {
      const given = planWithTwoTipGroups();
      const { plan, id } = add(given, null);
      assert.deepEqual(stageOrder(plan), ["1", "2", "3", id], name);
      assert.equal(isMixStep(plan, id), mixStep, name);
      assert.deepEqual(tipChangeAt(plan, id), laterTips(), name);
      assert.deepEqual(plan.tipChanges, { ...given.tipChanges, [id]: laterTips() }, name);
      assert.deepEqual(groupStages(plan), [["1", "2"], ["3"], [id]], name);
    }
  });

  test("addStageWithNewTips copies settings as addStage does, and the new stage has no transfers", () => {
    let given = withTransfersIn(planWithTwoTipGroups(), ["1", "2"]);
    given = changeStageSettings(given, "2", otherSettings());
    const expected = addStage(given, "3");
    const { plan, id } = addStageWithNewTips(given, "3");
    assert.equal(id, expected.id);
    assert.deepEqual(plan.stageList.get(id), expected.plan.stageList.get(expected.id));
    assert.deepEqual(plan.stageList.get(id).settings, otherSettings());
    assert.deepEqual(transfersIn(plan, id), []);
  });

  test("addMixStepWithNewTips makes the mix step as addMixStep does", () => {
    const given = planWithTwoTipGroups();
    const { plan, id } = addMixStepWithNewTips(given, "3");
    const expected = addMixStep(given, "3");
    assert.deepEqual(plan.stageList.get(id), expected.plan.stageList.get(expected.id));
    assert.deepEqual(plan.stageList.get(id).settings, mixStepDefaults());
  });

  test("addStageWithNewTips and addMixStepWithNewTips before a stage that isn't in the plan throw addStage's error, and the plan given is unchanged", () => {
    for (const [name, add] of ADD_WITH_NEW_TIPS) {
      const given = planWithTwoTipGroups();
      const before = snapshot(given);
      assert.throws(() => add(given, "9"), {
        message: `There's no stage "9" to add a stage before.`,
      }, name);
      assert.equal(snapshot(given), before, name);
    }
  });

  test("removeStage removes a stage and its transfers, takes it out of the stage order leaving the others in their order, and no tip change stays keyed by it", () => {
    let plan = withTransfersIn(planWithStages(3), ["1", "2", "3"]);
    plan = addTipChange(plan, "2");
    const { plan: withFour, id: four } = addStage(plan, "2");
    const removed = removeStage(withFour, "2");
    assert.equal(removed.stageList.has("2"), false);
    assert.deepEqual(stagesOfTransfers(removed), ["1", "3"]);
    assert.deepEqual(stageOrder(removed), ["1", four, "3"]);
    assert.equal(tipChangeAt(removed, "2"), null);
  });

  test("removing a tip group's first stage keeps the group's tips: its tip change moves to the next stage of the group", { skip: TIP_TYPES.length < 2 && "needs 2 tip types" }, () => {
    const plan = planWithFirstStageTips();
    const groupsBefore = tipGroups(plan).map(({ tipType, probes }) => ({ tipType, probes }));

    const withoutThree = removeStage(plan, "3");
    assert.deepEqual(tipGroups(withoutThree).map(({ key, stages }) => ({ key, stages })), [
      { key: START, stages: ["1", "2"] },
      { key: "4", stages: ["4", "5"] },
    ]);
    assert.deepEqual(tipChangeAt(withoutThree, "4"), { tipType: TIP_TYPES[1], probes: [1, 2] });
    assert.equal(tipChangeAt(withoutThree, "3"), null);
    assert.deepEqual(
      tipGroups(withoutThree).map(({ tipType, probes }) => ({ tipType, probes })),
      groupsBefore,
    );

    const withoutFour = removeStage(withoutThree, "4");
    assert.deepEqual(tipGroups(withoutFour).map(({ key, stages }) => ({ key, stages })), [
      { key: START, stages: ["1", "2"] },
      { key: "5", stages: ["5"] },
    ]);
    assert.deepEqual(tipChangeAt(withoutFour, "5"), { tipType: TIP_TYPES[1], probes: [1, 2] });

    const withoutFive = removeStage(withoutFour, "5");
    assert.deepEqual(tipGroups(withoutFive).map(({ key, stages }) => ({ key, stages })), [
      { key: START, stages: ["1", "2"] },
    ]);
    assert.deepEqual(withoutFive.tipChanges, { [START]: startTips() });
  });

  test("removing a tip group's only stage takes its tip change with it, and the next group keeps its own", () => {
    // Groups [1, 2], [3] and [4, 5]: 3 alone, 4 on the last tip type on [1].
    let plan = withTransfersIn(planWithStages(5), ["1", "2", "3", "4", "5"]);
    plan = addTipChange(plan, "3");
    plan = addTipChange(plan, "4");
    plan = setTipType(plan, "4", TIP_TYPES.at(-1));
    plan = setTipProbes(plan, "4", [1]);
    const removed = removeStage(plan, "3");
    assert.deepEqual(removed.tipChanges, {
      [START]: startTips(),
      4: { tipType: TIP_TYPES.at(-1), probes: [1] },
    });
  });

  test("removing the last stage in the stage order, first of its group, takes its tip change with it", () => {
    let plan = withTransfersIn(planWithStages(3), ["1", "2", "3"]);
    plan = addTipChange(plan, "3");
    const removed = removeStage(plan, "3");
    assert.deepEqual(removed.tipChanges, { [START]: startTips() });
    assert.deepEqual(stageOrder(removed), ["1", "2"]);
  });

  test("removing a stage in the middle of a tip group moves no tip change", () => {
    const plan = planWithFirstStageTips();
    const removed = removeStage(plan, "4");
    assert.deepEqual(removed.tipChanges, plan.tipChanges);
    assert.deepEqual(tipGroups(removed).map(({ stages }) => stages), [["1", "2"], ["3", "5"]]);
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

  test("removing the first stage, when the second has its own tip change, makes that the START one, with its tip type and probes", () => {
    let plan = addTipChange(planWithStages(2), "2");
    plan = setTipType(plan, "2", TIP_TYPES.at(-1));
    plan = setTipProbes(plan, "2", [1]);
    const removed = removeStage(plan, "1");
    assert.deepEqual(removed.tipChanges, { [START]: { tipType: TIP_TYPES.at(-1), probes: [1] } });
  });

  test("renameStage and changeStageSettings change only that stage", () => {
    const plan = planWithStages(2);
    const renamed = renameStage(plan, "2", "Drugs");
    assert.equal(renamed.stageList.get("2").name, "Drugs");
    assert.deepEqual(renamed.stageList.get("1"), plan.stageList.get("1"));

    const settings = otherSettings();
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

  test("stagesWithContentsProblem names the stage whose transfer draws more than a well's usable volume, and no other", () => {
    // Each trough holds 100 µL above the reservoir's dead volume (D).
    const D = deadVolumeOf(RESERVOIR);
    let plan = addComponent(planWithStages(3), "Media", "#4e79a7");
    plan = addToWells(plan, [trough("1"), trough("2")], "Media", D + 100);
    plan = addTransfer(plan, transferTo("1", "A1", 60));
    plan = addTransfer(plan, transferTo("2", "A2", 60));
    // From trough 2, which stage 2's draw into the dead volume didn't touch.
    plan = addTransfer(plan, { ...transferTo("3", "A3", 10), source: trough("2") });
    assert.deepEqual(stagesWithContentsProblem(plan), new Set(["2"]));
  });

  test("stagesWithContentsProblem names the stage whose transfer fills a well over its capacity, and no other", () => {
    // Trough 1 holds plenty above its dead volume; A2 starts 10 µL under the plate's capacity (C).
    const C = capacityOf(PLATE);
    let plan = addComponent(planWithStages(3), "Media", "#4e79a7");
    plan = addToWells(plan, [trough("1")], "Media", deadVolumeOf(RESERVOIR) + 1000);
    plan = addToWells(plan, [{ labware: PLATE, well: "A2" }], "Media", C - 10);
    plan = addTransfer(plan, transferTo("1", "A1", 20));
    plan = addTransfer(plan, transferTo("2", "A2", 20));
    plan = addTransfer(plan, transferTo("3", "A3", 20));
    assert.deepEqual(stagesWithContentsProblem(plan), new Set(["2"]));
  });

  test("stagesWithContentsProblem is empty with only a well that starts over its capacity", () => {
    let plan = addComponent(planWithStages(2), "Media", "#4e79a7");
    plan = addToWells(plan, [trough("1")], "Media", deadVolumeOf(RESERVOIR) + 1000);
    plan = addToWells(plan, [{ labware: PLATE, well: "B1" }], "Media", capacityOf(PLATE) + 1);
    plan = addTransfer(plan, transferTo("1", "A1", 20));
    assert.deepEqual(stagesWithContentsProblem(plan), new Set());
  });

  // --- Mix steps ---

  test("NEW_MIX_STEP_NAME is \"New mix step\"", () => {
    assert.equal(NEW_MIX_STEP_NAME, "New mix step");
  });

  test("addMixStep with no other mix step gives a stage called NEW_MIX_STEP_NAME, a mix step, with the default mix step settings, placed as addStage places a stage", () => {
    const plan = withTransfersIn(planWithStages(2), ["1", "2"]);
    const before = addMixStep(plan, "2");
    assert.deepEqual(stageOrder(before.plan), ["1", before.id, "2"]);
    const { name, settings } = before.plan.stageList.get(before.id);
    assert.equal(name, NEW_MIX_STEP_NAME);
    assert.equal(isMixStep(before.plan, before.id), true);
    assert.deepEqual(settings, mixStepDefaults());
    const last = addMixStep(plan, null);
    assert.deepEqual(stageOrder(last.plan), ["1", "2", last.id]);
    assert.deepEqual(last.plan.stageList.get(last.id).settings, mixStepDefaults());
  });

  test("addMixStep copies the nearest mix step before it, with its own destinationMix", () => {
    const otherMix = { share: 50, times: 2, speed: 100 };
    assert.notDeepEqual(otherMix, CONFIGURED_DEFAULT_MIX);
    let { plan, id: mixStep } = addMixStep(planWithStages(2), "2");
    plan = withMixStepMix(plan, mixStep, otherMix);
    const { plan: added, id } = addMixStep(plan, null);
    assert.deepEqual(added.stageList.get(id).settings, { ...mixStepDefaults(), destinationMix: otherMix });
  });

  test("addMixStep with no mix step before it but one after copies that one", () => {
    const otherMix = { share: 50, times: 2, speed: 100 };
    let { plan, id: mixStep } = addMixStep(planWithStages(2), null);
    plan = withMixStepMix(plan, mixStep, otherMix);
    const { plan: added, id } = addMixStep(plan, "1");
    assert.deepEqual(stageOrder(added), [id, "1", "2", mixStep]);
    assert.deepEqual(added.stageList.get(id).settings.destinationMix, otherMix);
  });

  test("own kind: addStage right after a mix step copies the transfer stage before the mix step, not the mix step", () => {
    let plan = changeStageSettings(planWithStages(2), "1", otherSettings());
    const { plan: withMixStep, id: mixStep } = addMixStep(plan, "2");
    // Stage order 1, mix step, 2: a stage right after the mix step copies stage 1.
    const { plan: added, id } = addStage(withMixStep, "2");
    assert.deepEqual(stageOrder(added), ["1", mixStep, id, "2"]);
    assert.deepEqual(added.stageList.get(id).settings, otherSettings());
    assert.equal(isMixStep(added, id), false);
  });

  test("own kind: addMixStep right after a transfer stage copies the nearest mix step, or gives the defaults", () => {
    const otherMix = { share: 50, times: 2, speed: 100 };
    const plan = planWithStages(2);
    const defaults = addMixStep(plan, "2");
    assert.deepEqual(defaults.plan.stageList.get(defaults.id).settings, mixStepDefaults());

    let { plan: withMixStep, id: mixStep } = addMixStep(plan, "1");
    withMixStep = withMixStepMix(withMixStep, mixStep, otherMix);
    // Stage order: mix step, 1, 2. A mix step right after stage 2 copies the mix step, not stage 2.
    const { plan: added, id } = addMixStep(withMixStep, null);
    assert.deepEqual(added.stageList.get(id).settings, { ...mixStepDefaults(), destinationMix: otherMix });
  });

  test("own kind: with only mix steps, addStage gives the default settings", () => {
    let { plan, id: mixStep } = addMixStep(planWithStages(1), null);
    plan = changeStageSettings(plan, "1", otherSettings());
    plan = removeStage(plan, "1");
    assert.deepEqual(stageOrder(plan), [mixStep]);
    const { plan: added, id } = addStage(plan, null);
    assert.deepEqual(added.stageList.get(id).settings, defaultSettings());
    assert.equal(added.stageList.get(id).name, NEW_STAGE_NAME);
  });

  test("addMixStep with takeTips before a stage with a tip change moves the tip change to the mix step; it refuses a stage that isn't in the plan", () => {
    const plan = addTipChange(planWithStages(3), "3");
    const { plan: added, id } = addMixStep(plan, "3", { takeTips: true });
    assert.deepEqual(tipChangeAt(added, id), startTips());
    assert.equal(tipChangeAt(added, "3"), null);
    assert.throws(() => addMixStep(plan, "9"), {
      message: `There's no stage "9" to add a stage before.`,
    });
  });

  test("isMixStep is false for a transfer stage and for an ID that isn't a stage", () => {
    const plan = planWithStages(1);
    assert.equal(isMixStep(plan, "1"), false);
    assert.equal(isMixStep(plan, "9"), false);
  });

  test("mixWells with three wells adds three transfers, each from the well into itself of MIX_STEP_VOLUME, in the mix step", () => {
    const { plan, id } = addMixStep(planWithStages(1), null);
    const wells = [plateWell("A1"), plateWell("A2"), { labware: RESERVOIR, well: "3" }];
    const mixed = mixWells(plan, id, wells);
    assert.deepEqual(
      transfersIn(mixed, id).map(({ position, ...transfer }) => transfer),
      wells.map((well) => mixedWell(id, well)),
    );
    assert.equal(mixed.operationList.listOperations().length, 3);
  });

  test("mixWells given one well it mixes already and one it doesn't adds one; given only wells it mixes, it returns the same plan", () => {
    let { plan, id } = addMixStep(planWithStages(1), null);
    plan = mixWells(plan, id, [plateWell("A1")]);
    const more = mixWells(plan, id, [plateWell("A1"), plateWell("A2")]);
    assert.deepEqual(
      transfersIn(more, id).map((transfer) => transfer.source.well),
      ["A1", "A2"],
    );
    assert.equal(mixWells(more, id, [plateWell("A2"), plateWell("A1")]), more);
  });

  test("mixWells given a well twice mixes it once", () => {
    const { plan, id } = addMixStep(planWithStages(1), null);
    const mixed = mixWells(plan, id, [plateWell("B2"), plateWell("B2")]);
    assert.equal(transfersIn(mixed, id).length, 1);
  });

  test("mixWells refuses a transfer stage, a stage that isn't in the plan, and a well not on the deck, each leaving the plan unchanged", () => {
    let { plan, id } = addMixStep(planWithStages(1), null);
    plan = renameStage(plan, "1", "Drugs");
    const before = snapshot(plan);
    assert.throws(() => mixWells(plan, "1", [plateWell("A1")]), {
      message: "Stage 1, “Drugs”, isn't a mix step, so it can't mix wells.",
    });
    assert.throws(() => mixWells(plan, "9", [plateWell("A1")]), {
      message: `There's no stage "9" in the plan.`,
    });
    assert.throws(() => mixWells(plan, id, [plateWell("A1"), plateWell("Z99")]), {
      message: /Z99/,
    });
    assert.equal(snapshot(plan), before);
  });

  test("mixWells checks the stage before the wells", () => {
    const plan = planWithStages(1);
    assert.throws(() => mixWells(plan, "1", [plateWell("Z99")]), {
      message: /isn't a mix step/,
    });
  });

  test("unmixWell removes that well's transfer only", () => {
    let { plan, id } = addMixStep(withTransfersIn(planWithStages(1), ["1"]), null);
    plan = mixWells(plan, id, [plateWell("A1"), plateWell("A2"), plateWell("A3")]);
    const unmixed = unmixWell(plan, id, plateWell("A2"));
    assert.deepEqual(
      transfersIn(unmixed, id).map((transfer) => transfer.source.well),
      ["A1", "A3"],
    );
    assert.equal(transfersIn(unmixed, "1").length, 1);
  });

  test("unmixWell refuses a well the mix step doesn't mix, and a stage that isn't a mix step", () => {
    let { plan, id } = addMixStep(planWithStages(1), null);
    plan = renameStage(plan, id, "Mix plate");
    plan = mixWells(plan, id, [plateWell("A1")]);
    assert.throws(() => unmixWell(plan, id, plateWell("A2")), {
      message: `Stage 2, “Mix plate”, doesn't mix ${PLATE} A2.`,
    });
    assert.throws(() => unmixWell(plan, "1", plateWell("A1")), {
      message: "Stage 1, “New stage”, isn't a mix step, so it can't mix wells.",
    });
    assert.throws(() => unmixWell(plan, "9", plateWell("A1")), {
      message: `There's no stage "9" in the plan.`,
    });
  });

  test("mixWells refuses null, a single well not in a list, and a list holding 5, each with its message", () => {
    const { plan, id } = addMixStep(planWithStages(1), null);
    assert.throws(() => mixWells(plan, id, null), {
      message:
        'The wells to mix must be a list of wells, like [{ labware: "Plate1", well: "A1" }], but got null.',
    });
    assert.throws(() => mixWells(plan, id, plateWell("A1")), {
      message: /^The wells to mix must be a list of wells, like \[\{ labware: "Plate1", well: "A1" \}\], but got /,
    });
    assert.throws(() => mixWells(plan, id, [5]), {
      message: /^A well on the deck must be an object like .+, but got 5\.$/,
    });
  });

  test("mixWells checks the mix step before the list", () => {
    const plan = planWithStages(1);
    assert.throws(() => mixWells(plan, "1", null), { message: /isn't a mix step/ });
  });

  test("unmixWell refuses undefined and \"A1\", each with its message", () => {
    let { plan, id } = addMixStep(planWithStages(1), null);
    plan = mixWells(plan, id, [plateWell("A1")]);
    assert.throws(() => unmixWell(plan, id, undefined), {
      message:
        'The well to stop mixing must be a well, like { labware: "Plate1", well: "A1" }, but got undefined.',
    });
    assert.throws(() => unmixWell(plan, id, "A1"), {
      message:
        'The well to stop mixing must be a well, like { labware: "Plate1", well: "A1" }, but got "A1".',
    });
  });

  test("changeStageSettings refuses MIX_STEP_MODE's technique at the destination only", () => {
    const plan = planWithStages(1);
    const settings = { ...defaultSettings(), destinationTechnique: MIX_STEP_MODE.technique };
    assert.throws(() => changeStageSettings(plan, "1", settings), {
      message: `"${MIX_STEP_MODE.technique}" only mixes, so it's used at both ends of a mix step or at neither.`,
    });
  });

  test("changeStageSettings refuses a mix step with a source mix, and one without a destination mix, leaving the plan unchanged", () => {
    const { plan, id } = addMixStep(planWithStages(1), null);
    const before = snapshot(plan);
    assert.throws(
      () => changeStageSettings(plan, id, { ...mixStepDefaults(), sourceMix: exampleMix() }),
      { message: "A mix step mixes after dispensing only, so it can't have a source mix." },
    );
    assert.throws(() => changeStageSettings(plan, id, { ...mixStepDefaults(), destinationMix: null }), {
      message: "A mix step needs a destination mix: that's what it does.",
    });
    assert.equal(snapshot(plan), before);
  });

  test("changeStageSettings checks the source mix before the destination mix", () => {
    const { plan, id } = addMixStep(planWithStages(1), null);
    const settings = { ...mixStepDefaults(), sourceMix: exampleMix(), destinationMix: null };
    assert.throws(() => changeStageSettings(plan, id, settings), { message: /can't have a source mix/ });
  });

  test("changeStageSettings refuses a stage with transfers changing kind, either way, leaving the plan unchanged", () => {
    let plan = renameStage(withTransfersIn(planWithStages(1), ["1"]), "1", "Drugs");
    let id;
    ({ plan, id } = addMixStep(plan, null));
    plan = renameStage(plan, id, "Mix plate");
    plan = mixWells(plan, id, [plateWell("B1")]);
    const before = snapshot(plan);
    assert.throws(() => changeStageSettings(plan, "1", mixStepDefaults()), {
      message: "Stage 1, “Drugs”, has transfers, so it can't become a mix step.",
    });
    assert.throws(() => changeStageSettings(plan, id, defaultSettings()), {
      message: "Stage 2, “Mix plate”, has mixed wells, so it can't become a transfer stage.",
    });
    assert.equal(snapshot(plan), before);
  });

  test("changeStageSettings checks a mix step's mixes before a change of kind", () => {
    const plan = withTransfersIn(planWithStages(1), ["1"]);
    assert.throws(() => changeStageSettings(plan, "1", { ...mixStepDefaults(), destinationMix: null }), {
      message: /needs a destination mix/,
    });
  });

  test("changeStageSettings accepts either change of kind for a stage without transfers", () => {
    const { plan, id } = addMixStep(planWithStages(1), null);
    const toMixStep = changeStageSettings(plan, "1", mixStepDefaults());
    assert.equal(isMixStep(toMixStep, "1"), true);
    const toTransferStage = changeStageSettings(plan, id, defaultSettings());
    assert.equal(isMixStep(toTransferStage, id), false);
  });

  test("own kind, at the start: addStage before a mix step that comes first, with a transfer stage after it, copies that transfer stage", () => {
    let plan = changeStageSettings(planWithStages(1), "1", otherSettings());
    let mixStep;
    ({ plan, id: mixStep } = addMixStep(plan, "1"));
    assert.deepEqual(stageOrder(plan), [mixStep, "1"]);
    const { plan: added, id } = addStage(plan, mixStep);
    assert.deepEqual(stageOrder(added), [id, mixStep, "1"]);
    assert.deepEqual(added.stageList.get(id).settings, otherSettings());
  });

  test("addTransfer into a mix step refuses a transfer between two wells and a well into itself of any other volume; accepts a well into itself of MIX_STEP_VOLUME", () => {
    let { plan, id } = addMixStep(planWithStages(1), null);
    plan = renameStage(plan, id, "Mix plate");
    const message =
      "Stage 2, “Mix plate”, is a mix step: it only mixes wells. Add this transfer to a transfer stage.";
    assert.throws(() => addTransfer(plan, { ...transferTo(id, "A1"), volume: MIX_STEP_VOLUME }), {
      message,
    });
    assert.throws(
      () => addTransfer(plan, { ...mixedWell(id, plateWell("A1")), volume: MIX_STEP_VOLUME + 1 }),
      { message },
    );
    assert.throws(() => addTransfers(plan, [mixedWell(id, plateWell("A1")), transferTo(id, "A2")]), {
      message,
    });
    const added = addTransfer(plan, mixedWell(id, plateWell("A1")));
    assert.equal(transfersIn(added, id).length, 1);
  });

  test("addTransfer checks the stage is in the plan before whether it's a mix step", () => {
    const { plan } = addMixStep(planWithStages(1), null);
    assert.throws(() => addTransfer(plan, transferTo("9", "A1")), {
      message: `There's no stage "9" in the plan to add this transfer to.`,
    });
  });

  test("a well is mixed at most once in a mix step: the stage rule refuses it twice", () => {
    let { plan, id } = addMixStep(planWithStages(1), null);
    plan = mixWells(plan, id, [plateWell("A1")]);
    assert.throws(() => addTransfer(plan, mixedWell(id, plateWell("A1"))), {
      message: /Within a stage, no well can be both a source and a destination/,
    });
  });

  test("changeVolume refuses a mix step's transfer", () => {
    let { plan, id } = addMixStep(withTransfersIn(planWithStages(1), ["1"]), null);
    plan = mixWells(plan, id, [plateWell("A1")]);
    const position = transfersIn(plan, id)[0].position;
    assert.throws(() => changeVolume(plan, position, 5), {
      message: "A mix step's wells are mixed with its own settings, so their volume can't be changed.",
    });
    // A transfer stage's volume still changes.
    assert.doesNotThrow(() => changeVolume(plan, 0, 25));
  });

  test("a mixed well holding at least MIX_STEP_VOLUME above its dead volume changes no well's contents; a well holding less above it is a contents problem", () => {
    const D = deadVolumeOf(PLATE);
    let plan = addComponent(planWithStages(1), "Media", "#4e79a7");
    plan = addToWells(plan, [plateWell("A1")], "Media", D + MIX_STEP_VOLUME);
    plan = addToWells(plan, [plateWell("A2")], "Media", D + MIX_STEP_VOLUME / 2);
    let { plan: withMixStep, id } = addMixStep(plan, null);
    const full = mixWells(withMixStep, id, [plateWell("A1")]);
    const contents = (candidate) => replay(candidate.startingContents, candidate.operationList).listContents();
    assert.deepEqual(contents(full), contents(withMixStep));
    assert.deepEqual(stagesWithContentsProblem(full), new Set());
    const short = mixWells(full, id, [plateWell("A2")]);
    assert.deepEqual(stagesWithContentsProblem(short), new Set([id]));
  });

  // --- Mixing ---

  test("setStageMix on a Medium source switches on mixing and OperationMix, keeping the liquid type and the destination's settings; null switches back", () => {
    for (const end of ["source", "destination"]) {
      const other = end === "source" ? "destination" : "source";
      const plan = planWithStages(1);
      const before = plan.stageList.get("1").settings;
      const mixing = setStageMix(plan, "1", end, exampleMix());
      const settings = mixing.stageList.get("1").settings;
      assert.deepEqual(settings[`${end}Mix`], exampleMix(), end);
      assert.equal(settings[`${end}Technique`], "OperationMix", end);
      assert.equal(settings[`${end}LiquidType`], before[`${end}LiquidType`], end);
      for (const setting of ["Technique", "LiquidType", "Mix"]) {
        assert.deepEqual(settings[`${other}${setting}`], before[`${other}${setting}`], end);
      }
      const off = setStageMix(mixing, "1", end, null).stageList.get("1").settings;
      assert.equal(off[`${end}Mix`], null, end);
      assert.equal(off[`${end}Technique`], "Operation", end);
      assert.deepEqual(off, before, end);
    }
  });

  test("setStageMix with a different mix on an end that mixes changes the mix and keeps OperationMix", () => {
    const plan = setStageMix(planWithStages(1), "1", "source", exampleMix());
    const changed = setStageMix(plan, "1", "source", { share: 50, times: 2, speed: 100 });
    const settings = changed.stageList.get("1").settings;
    assert.deepEqual(settings.sourceMix, { share: 50, times: 2, speed: 100 });
    assert.equal(settings.sourceTechnique, "OperationMix");
  });

  test("setStageMix giving the mix the end already has returns the same plan", () => {
    const plan = setStageMix(planWithStages(1), "1", "source", exampleMix());
    assert.equal(setStageMix(plan, "1", "source", exampleMix()), plan);
    assert.equal(setStageMix(plan, "1", "destination", null), plan);
  });

  test("setStageMix refuses a stage that isn't in the plan, an end that isn't one, an end that isn't a mode, a mode that can't mix and a mix the stage list refuses, each leaving the plan unchanged", () => {
    let plan = planWithStages(1);
    plan = changeStageSettings(plan, "1", {
      ...defaultSettings(),
      ...modeSettings("destination", NON_MIXING_MODE.name),
    });
    const custom = changeStageSettings(plan, "1", {
      ...defaultSettings(),
      sourceTechnique: "Custom_Technique",
    });
    const before = snapshot(plan);
    assert.throws(() => setStageMix(plan, "9", "source", exampleMix()), {
      message: `There's no stage "9" in the plan.`,
    });
    assert.throws(() => setStageMix(plan, "1", "middle", exampleMix()), {
      message: 'The end must be "source" or "destination", but got "middle".',
    });
    assert.throws(() => setStageMix(custom, "1", "source", exampleMix()), {
      message:
        "The source's technique and liquid type aren't one of the pipetting modes, so its mixing " +
        "can't be switched. Choose a mode for it first.",
    });
    assert.throws(() => setStageMix(plan, "1", "destination", exampleMix()), {
      message: `${NON_MIXING_MODE.name} can't mix. Choose another mode for the destination first.`,
    });
    assert.throws(() => setStageMix(plan, "1", "source", { share: 0, times: 3, speed: 400 }), {
      message:
        "The source mix's share must be a number above 0 and at most 100 (a percentage of the well), but got 0.",
    });
    assert.equal(snapshot(plan), before);
  });

  test("setStageMix checks the stage, then the end, then the end's mode, then the mix, then whether the mode can mix", () => {
    let plan = planWithStages(1);
    plan = changeStageSettings(plan, "1", {
      ...defaultSettings(),
      ...modeSettings("destination", NON_MIXING_MODE.name),
    });
    const custom = changeStageSettings(plan, "1", {
      ...plan.stageList.get("1").settings,
      sourceTechnique: "Custom_Technique",
    });
    const badMix = { share: 0, times: 3, speed: 400 };
    assert.throws(() => setStageMix(plan, "9", "middle", badMix), { message: /^There's no stage/ });
    assert.throws(() => setStageMix(custom, "1", "middle", badMix), { message: /^The end must be/ });
    assert.throws(() => setStageMix(custom, "1", "source", badMix), {
      message: /^The source's technique and liquid type aren't one of the pipetting modes/,
    });
    assert.throws(() => setStageMix(plan, "1", "destination", badMix), {
      message: /^The destination mix's share must be/,
    });
  });

  test("changeStageSettings refuses a mix with the mode's technique, no mix with its mixing technique, and a mix with a mode that can't mix", () => {
    const plan = planWithStages(1);
    const before = snapshot(plan);
    assert.throws(
      () => changeStageSettings(plan, "1", { ...defaultSettings(), sourceMix: exampleMix() }),
      {
        message: `The source mixes, so its technique must be "${MIXING_MODE.mixingTechnique}" (${MIXING_MODE.name}'s technique for mixing), but it's "${MIXING_MODE.technique}".`,
      },
    );
    assert.throws(
      () =>
        changeStageSettings(plan, "1", {
          ...defaultSettings(),
          ...modeSettings("destination", MIXING_MODE.name, true),
        }),
      {
        message: `The destination doesn't mix, so its technique must be "${MIXING_MODE.technique}" (${MIXING_MODE.name}'s technique without mixing), but it's "${MIXING_MODE.mixingTechnique}".`,
      },
    );
    assert.throws(
      () =>
        changeStageSettings(plan, "1", {
          ...defaultSettings(),
          ...modeSettings("destination", NON_MIXING_MODE.name),
          destinationMix: exampleMix(),
        }),
      {
        message: `The destination mixes, but ${NON_MIXING_MODE.name} can't mix. Turn the destination's mixing off, or choose another mode.`,
      },
    );
    assert.equal(snapshot(plan), before);
  });

  test("changeStageSettings accepts matching mixing, and any mixing at an end that isn't one of the modes", () => {
    const plan = planWithStages(1);
    const matching = {
      ...defaultSettings(),
      ...modeSettings("source", MIXING_MODE.name, true),
      sourceMix: exampleMix(),
    };
    assert.deepEqual(changeStageSettings(plan, "1", matching).stageList.get("1").settings, matching);
    const customMixing = { ...defaultSettings(), sourceTechnique: "Custom", sourceMix: exampleMix() };
    assert.doesNotThrow(() => changeStageSettings(plan, "1", customMixing));
    const customNotMixing = { ...defaultSettings(), sourceTechnique: "OperationMix", sourceLiquidType: "Custom" };
    assert.doesNotThrow(() => changeStageSettings(plan, "1", customNotMixing));
  });

  test("changeStageSettings checks the stage list's checks, then the source's mixing, then the destination's", () => {
    const plan = planWithStages(1);
    const bothWrong = {
      ...defaultSettings(),
      sourceMix: exampleMix(),
      destinationMix: exampleMix(),
    };
    assert.throws(() => changeStageSettings(plan, "1", { ...bothWrong, sourceTechnique: "" }), {
      message: /source technique/,
    });
    assert.throws(() => changeStageSettings(plan, "1", bothWrong), {
      message: /^The source mixes/,
    });
    assert.throws(
      () =>
        changeStageSettings(plan, "1", {
          ...bothWrong,
          ...modeSettings("source", MIXING_MODE.name, true),
        }),
      { message: /^The destination mixes/ },
    );
  });

  test("addStage after a stage that mixes gives a stage that passes the check", () => {
    const plan = setStageMix(planWithStages(1), "1", "source", exampleMix());
    const { plan: added, id } = addStage(plan, null);
    const settings = added.stageList.get(id).settings;
    assert.deepEqual(settings.sourceMix, exampleMix());
    assert.doesNotThrow(() => changeStageSettings(added, id, settings));
  });

  test("stagesWithMixProblem names a stage whose destination mix is under the minimum, and no other; a plan without mixing gives an empty Set", () => {
    let plan = addComponent(planWithStages(2), "Media", "#4e79a7");
    plan = addToWells(plan, [trough("1")], "Media", 1000);
    // Stage 1 fills A1 with ten times MIN_MIX_VOLUME, so at 90% it mixes well over the minimum;
    // stage 2 fills A2 with 0.05 µL, so at 90% it mixes 0 (rounded down to tenths), under it.
    plan = addTransfer(plan, transferTo("1", "A1", 10 * MIN_MIX_VOLUME));
    plan = addTransfer(plan, transferTo("2", "A2", 0.05));
    assert.deepEqual(stagesWithMixProblem(plan), new Set());
    plan = setStageMix(plan, "1", "destination", exampleMix());
    assert.deepEqual(stagesWithMixProblem(plan), new Set());
    plan = setStageMix(plan, "2", "destination", exampleMix());
    assert.deepEqual(stagesWithMixProblem(plan), new Set(["2"]));
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
    plan = setTipProbes(plan, START, [1, 2, 3, 4]);
    plan = addTipChange(plan, "3");
    plan = setTipType(plan, "3", TIP_TYPES.at(-1));
    plan = setTipProbes(plan, "3", [1]);
    assert.deepEqual(tipGroups(plan), sharedTipGroups(plan));
    assert.equal(tipGroups(plan).length, 2);
    assert.deepEqual(
      tipGroups(plan).map((group) => group.probes),
      [[1, 2, 3, 4], [1]],
    );
  });

  test("addTipChange takes the tip type and probes in use", () => {
    let plan = addTipChange(planWithStages(3), "2");
    plan = setTipType(plan, "2", TIP_TYPES.at(-1));
    plan = setTipProbes(plan, "2", [1, 2]);
    plan = addTipChange(plan, "3");
    assert.deepEqual(tipChangeAt(plan, "3"), { tipType: TIP_TYPES.at(-1), probes: [1, 2] });
    assert.equal(canAddTipChange(planWithStages(3), "2"), true);
    // With START on [1, 2], a tip change added before stage 2 has [1, 2].
    const startOnTwo = setTipProbes(planWithStages(2), START, [1, 2]);
    assert.deepEqual(tipChangeAt(addTipChange(startOnTwo, "2"), "2").probes, [1, 2]);
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

  test("setTipType with a known type works, leaving the probes as they were; an unknown one throws", () => {
    const onOne = setTipProbes(planWithStages(1), START, [1]);
    const plan = setTipType(onOne, START, TIP_TYPES.at(-1));
    assert.deepEqual(tipChangeAt(plan, START), { tipType: TIP_TYPES.at(-1), probes: [1] });
    const tipTypeNames = TIP_TYPES.map((tipType) => `"${tipType}"`).join(", ");
    assert.throws(() => setTipType(plan, START, "BC50"), {
      message: `"BC50" isn't a tip type. Choose one of ${tipTypeNames}.`,
    });
  });

  test("setTipType, setTipProbes and removeTipChange throw where there's no tip change", () => {
    const plan = planWithStages(2);
    const message = `There are no new tips before stage "2".`;
    assert.throws(() => setTipType(plan, "2", TIP_TYPES[0]), { message });
    assert.throws(() => setTipProbes(plan, "2", [1]), { message });
    assert.throws(() => removeTipChange(plan, "2"), { message });
  });

  test("setTipType checks for a tip change before the tip type", () => {
    assert.throws(() => setTipType(planWithStages(2), "2", "BC50"), {
      message: `There are no new tips before stage "2".`,
    });
  });

  test("setTipProbes sets the probes, stored smallest first, leaving the tip type as it was", () => {
    const plan = setTipType(planWithStages(1), START, TIP_TYPES.at(-1));
    assert.deepEqual(tipChangeAt(setTipProbes(plan, START, [1, 2, 3, 4]), START), {
      tipType: TIP_TYPES.at(-1),
      probes: [1, 2, 3, 4],
    });
    assert.deepEqual(tipChangeAt(setTipProbes(plan, START, [3, 1, 2]), START).probes, [1, 2, 3]);
    assert.deepEqual(tipChangeAt(setTipProbes(plan, START, [1]), START).probes, [1]);
    assert.deepEqual(
      tipChangeAt(setTipProbes(plan, START, [1, 2, 3, 4, 5, 6, 7, 8]), START).probes,
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
  });

  test("setTipProbes on a tip change before a stage changes only that tip change", () => {
    const plan = addTipChange(planWithStages(2), "2");
    const changed = setTipProbes(plan, "2", [5, 6]);
    assert.deepEqual(tipChangeAt(changed, "2"), { tipType: TIP_TYPES[0], probes: [5, 6] });
    assert.deepEqual(tipChangeAt(changed, START), startTips());
  });

  test('setTipProbes refuses "1,2", [] and null with the probes-list error', () => {
    const plan = planWithStages(1);
    const start = "The probes must be a list of probe numbers from 1 to 8, like [1, 2, 3, 4], but got";
    for (const [probes, shown] of [["1,2", '"1,2"'], [[], "a list"], [null, "null"]]) {
      assert.throws(() => setTipProbes(plan, START, probes), { message: `${start} ${shown}.` });
    }
  });

  test('setTipProbes refuses [0], [9], [2.5] and ["1"] with the probe-number error; [1, 9, 10] names 9', () => {
    const plan = planWithStages(1);
    const cases = [
      [[0], "0"],
      [[9], "9"],
      [[2.5], "2.5"],
      [["1"], '"1"'],
      [[1, 9, 10], "9"],
    ];
    for (const [probes, shown] of cases) {
      assert.throws(() => setTipProbes(plan, START, probes), {
        message: `Probe numbers must be whole numbers from 1 to 8, but got ${shown}.`,
      });
    }
  });

  test("setTipProbes refuses [3, 1, 3] with the repeated-probe error, naming 3", () => {
    assert.throws(() => setTipProbes(planWithStages(1), START, [3, 1, 3]), {
      message: "Probe 3 is listed more than once. List each probe once.",
    });
  });

  test("setTipProbes checks for a tip change, then the list, then each probe, then repeats", () => {
    const plan = planWithStages(2);
    assert.throws(() => setTipProbes(plan, "2", [9, 9]), {
      message: `There are no new tips before stage "2".`,
    });
    assert.throws(() => setTipProbes(plan, START, [9, 9]), {
      message: "Probe numbers must be whole numbers from 1 to 8, but got 9.",
    });
  });

  test("changing the probes list given to setTipProbes afterwards doesn't change the plan", () => {
    const probes = [2, 1];
    const plan = setTipProbes(planWithStages(1), START, probes);
    probes.push(9);
    probes[0] = 7;
    assert.deepEqual(tipChangeAt(plan, START).probes, [1, 2]);
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

  // --- Tips used ---

  // A plan with `count` stages (planWithStages) that writeRunFiles accepts once it has transfers:
  // named, with a component Media filling the reservoir's trough 1, which transferTo draws from.
  function tipsPlanWithStages(count) {
    let plan = addComponent(planWithStages(count), "Media", "#4e79a7");
    plan = addToWells(plan, [trough("1")], "Media", capacityOf(RESERVOIR));
    return setExperimentName(plan, "Exp36");
  }

  // Section 3's example (transfer-designer.md, "Tips used"), with the first and second tip types:
  // START tips of the first type on [1, 2, 3, 4] before stages 1 and 2, the second type on [1, 2]
  // before stage 3, the first on all eight probes before stage 4, and the second on [1] before
  // stage 5, which has no transfers; stages 1 to 4 have one transfer each.
  function tipsExamplePlan() {
    let plan = setTipProbes(tipsPlanWithStages(5), START, [1, 2, 3, 4]);
    plan = setTipProbes(setTipType(addTipChange(plan, "3"), "3", TIP_TYPES[1]), "3", [1, 2]);
    // A new tip change copies the tips in use there (the second type, here), so its type is set.
    plan = setTipProbes(setTipType(addTipChange(plan, "4"), "4", TIP_TYPES[0]), "4", probesFor(8));
    plan = setTipProbes(setTipType(addTipChange(plan, "5"), "5", TIP_TYPES[1]), "5", [1]);
    return withTransfersIn(plan, ["1", "2", "3", "4"]);
  }

  // A plan using only the second tip type: the START tips set to it, and stage 1 with a transfer.
  function secondTypeOnlyPlan() {
    return withTransfersIn(setTipType(tipsPlanWithStages(1), START, TIP_TYPES[1]), ["1"]);
  }

  // Two stages run as the second tip type then the first: the START tips set to the second type
  // before stage 1, and a tip change to the first type (on the probes it copies) before stage 2,
  // each stage with a transfer.
  function secondTypeFirstPlan() {
    const plan = setTipType(addTipChange(setTipType(tipsPlanWithStages(2), START, TIP_TYPES[1]), "2"), "2", TIP_TYPES[0]);
    return withTransfersIn(plan, ["1", "2"]);
  }

  // Two tip groups of the first type on the same probes (the second tip change copies the first),
  // each with a transfer.
  function twoSameGroupsPlan() {
    return withTransfersIn(addTipChange(tipsPlanWithStages(2), "2"), ["1", "2"]);
  }

  // Three stages: the START group (stage 1) with a transfer, and a group of the first type on all
  // eight probes holding stage 2, without transfers, and stage 3, with `stage3Transfer` deciding
  // whether stage 3 has one.
  function partlyEmptyGroupPlan(stage3Transfer) {
    const plan = setTipProbes(addTipChange(tipsPlanWithStages(3), "2"), "2", probesFor(8));
    return withTransfersIn(plan, stage3Transfer ? ["1", "3"] : ["1"]);
  }

  // Two stages: the START group (stage 1) without transfers, and a tip change before stage 2, with a
  // transfer, of `tipType` on `probes`.
  function emptyStartGroupPlan(tipType, probes) {
    const plan = setTipType(addTipChange(tipsPlanWithStages(2), "2"), "2", tipType);
    return withTransfersIn(setTipProbes(plan, "2", probes), ["2"]);
  }

  // Stage 1 without transfers, then a mix step on tips of its own mixing PLATE A1, which holds half
  // its capacity of Media, so it mixes enough (no mix problem) and its draw is covered: { plan, id }.
  function mixStepGroupPlan() {
    const base = addToWells(tipsPlanWithStages(1), [plateWell("A1")], "Media", capacityOf(PLATE) / 2);
    const { plan, id } = addMixStepWithNewTips(base, null);
    return { plan: mixWells(plan, id, [plateWell("A1")]), id };
  }

  // The tips Stages.csv loads (transfer-designer.md, section 6, "it matches the Biomek files"): from
  // the rows whose NewTip is 1, the number of probes in LoadProbes, added up by TipType, in
  // TIP_TYPES order, e.g. [{ tipType: "BC230", count: 4 }].
  function tipsLoadedByFiles(plan) {
    const { files } = writeRunFiles(plan, new Date(2026, 9, 28, 1, 57, 32));
    const [header, ...rows] = files.find((file) => file.name === "Stages.csv").text.split("\r\n");
    const columns = header.split(",");
    const counts = new Map();
    for (const row of rows.filter((line) => line !== "")) {
      // A comma inside double quotes is part of its field, so split only at commas followed by an
      // even number of quotes.
      const fields = row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      const field = (name) => fields[columns.indexOf(name)];
      if (field("NewTip") === "1") {
        const probes = field("LoadProbes").replaceAll('"', "").split(",");
        counts.set(field("TipType"), (counts.get(field("TipType")) ?? 0) + probes.length);
      }
    }
    return TIP_TYPES.filter((tipType) => counts.has(tipType)).map((tipType) => ({
      tipType,
      count: counts.get(tipType),
    }));
  }

  // The tips counted from tipGroups: for each group with a transfer in any of its stages, its
  // probes, added up by tip type, in TIP_TYPES order.
  function tipsFromGroups(plan) {
    const counts = new Map();
    for (const group of tipGroups(plan)) {
      if (group.stages.some((id) => transfersIn(plan, id).length > 0)) {
        counts.set(group.tipType, (counts.get(group.tipType) ?? 0) + group.probes.length);
      }
    }
    return TIP_TYPES.filter((tipType) => counts.has(tipType)).map((tipType) => ({
      tipType,
      count: counts.get(tipType),
    }));
  }

  // Whether TIP_TYPES has a second tip type, for the tests that use one (skipped otherwise).
  const NO_SECOND_TIP_TYPE = TIP_TYPES.length < 2;

  test("tipsUsed of a new plan, with no transfers, is []", () => {
    assert.deepEqual(tipsUsed(emptyPlan().plan), []);
  });

  test("tipsUsed of one stage with a transfer on the START tips counts DEFAULT_PROBE_COUNT tips of the first type", () => {
    assert.deepEqual(tipsUsed(withTransfersIn(planWithStages(1), ["1"])), [
      { tipType: TIP_TYPES[0], count: DEFAULT_PROBE_COUNT },
    ]);
  });

  test("tipsUsed of section 3's example gives the first type 12 and the second 2, in TIP_TYPES order", { skip: NO_SECOND_TIP_TYPE }, () => {
    assert.deepEqual(tipsUsed(tipsExamplePlan()), [
      { tipType: TIP_TYPES[0], count: 12 },
      { tipType: TIP_TYPES[1], count: 2 },
    ]);
  });

  test("tipsUsed of a plan using only the second tip type gives only that type", { skip: NO_SECOND_TIP_TYPE }, () => {
    assert.deepEqual(tipsUsed(secondTypeOnlyPlan()), [
      { tipType: TIP_TYPES[1], count: DEFAULT_PROBE_COUNT },
    ]);
  });

  test("tipsUsed lists tip types in TIP_TYPES order, not run order", { skip: NO_SECOND_TIP_TYPE }, () => {
    assert.deepEqual(tipsUsed(secondTypeFirstPlan()), [
      { tipType: TIP_TYPES[0], count: DEFAULT_PROBE_COUNT },
      { tipType: TIP_TYPES[1], count: DEFAULT_PROBE_COUNT },
    ]);
  });

  test("tipsUsed counts two tip groups of the same type and probes, each with transfers, twice", () => {
    assert.deepEqual(tipsUsed(twoSameGroupsPlan()), [
      { tipType: TIP_TYPES[0], count: 2 * DEFAULT_PROBE_COUNT },
    ]);
  });

  test("tipsUsed counts nothing for a tip group without transfers, and adding one makes it count in full", () => {
    assert.deepEqual(tipsUsed(partlyEmptyGroupPlan(false)), [
      { tipType: TIP_TYPES[0], count: DEFAULT_PROBE_COUNT },
    ]);
    assert.deepEqual(tipsUsed(partlyEmptyGroupPlan(true)), [
      { tipType: TIP_TYPES[0], count: DEFAULT_PROBE_COUNT + 8 },
    ]);
  });

  test("tipsUsed leaves out the START tips when their group has no transfers: the first type on other probes", () => {
    assert.deepEqual(tipsUsed(emptyStartGroupPlan(TIP_TYPES[0], [7, 8])), [
      { tipType: TIP_TYPES[0], count: 2 },
    ]);
  });

  test("tipsUsed leaves out the START tips when their group has no transfers: the second type", { skip: NO_SECOND_TIP_TYPE }, () => {
    assert.deepEqual(tipsUsed(emptyStartGroupPlan(TIP_TYPES[1], [1, 2, 3])), [
      { tipType: TIP_TYPES[1], count: 3 },
    ]);
  });

  test("tipsUsed counts a tip group whose only stage is a mix step mixing one well", () => {
    const { plan, id } = mixStepGroupPlan();
    assert.deepEqual(tipsUsed(plan), [
      { tipType: tipChangeAt(plan, id).tipType, count: tipChangeAt(plan, id).probes.length },
    ]);
  });

  test("tipsUsed counts a run randomization through its stages' tip changes: the sum over tipGroups with transfers", () => {
    const { plan } = runRandomizationPlan();
    assert.ok(tipGroups(plan).length > 2, "the randomization's stages have tip changes of their own");
    assert.deepEqual(tipsUsed(plan), tipsFromGroups(plan));
  });

  test("tipsUsed counts a plan with a contents problem as it stands", () => {
    const plan = withTransfersIn(planWithStages(1), ["1"]);
    assert.ok(stagesWithContentsProblem(plan).size > 0, "the plan has a contents problem");
    assert.deepEqual(tipsUsed(plan), [{ tipType: TIP_TYPES[0], count: DEFAULT_PROBE_COUNT }]);
  });

  test("tipsUsed matches the tips the Biomek files load", () => {
    const plans = [
      ["one stage with a transfer", withTransfersIn(tipsPlanWithStages(1), ["1"])],
      ["two groups of the same type and probes", twoSameGroupsPlan()],
      ["a group without transfers", partlyEmptyGroupPlan(false)],
      ["a group with a stage without transfers", partlyEmptyGroupPlan(true)],
      ["the START group without transfers", emptyStartGroupPlan(TIP_TYPES[0], [7, 8])],
      ["a mix step's group", mixStepGroupPlan().plan],
      ["a run randomization", setExperimentName(runRandomizationPlan().plan, "Exp36")],
    ];
    if (!NO_SECOND_TIP_TYPE) {
      plans.push(
        ["section 3's example", tipsExamplePlan()],
        ["only the second type", secondTypeOnlyPlan()],
        ["the second type run before the first", secondTypeFirstPlan()],
        ["the START group without transfers, second type", emptyStartGroupPlan(TIP_TYPES[1], [1, 2, 3])],
      );
    }
    for (const [name, plan] of plans) {
      assert.deepEqual(tipsUsed(plan), tipsLoadedByFiles(plan), name);
    }
  });

  test("changing the list tipsUsed returned doesn't change the next one", () => {
    const plan = withTransfersIn(planWithStages(1), ["1"]);
    const first = tipsUsed(plan);
    first[0].count = 99;
    first.push({ tipType: "BC50", count: 1 });
    assert.deepEqual(tipsUsed(plan), [{ tipType: TIP_TYPES[0], count: DEFAULT_PROBE_COUNT }]);
  });

  // --- Components and starting contents ---

  test("addComponent adds a component last, with its name trimmed", () => {
    let { plan } = emptyPlan();
    plan = addComponent(plan, "Media", "#4e79a7");
    plan = addComponent(plan, "  Drug_A ", "#f28e2b");
    assert.deepEqual(plan.components, [
      { name: "Media", color: "#4e79a7", constituents: [], osmolality: null },
      { name: "Drug_A", color: "#f28e2b", constituents: [], osmolality: null },
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
    assert.deepEqual(plan.components[0], { name: "Medium", color: "#4e79a7", constituents: [], osmolality: null });
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
    assert.deepEqual(recolored.components[1], { name: "Dye", color: "#59a14f", constituents: [], osmolality: null });
    assert.throws(() => setComponentColor(plan, "Dye", "#4e79a7"), {
      message: "Media already has that color. Choose a different one.",
    });
    assert.doesNotThrow(() => setComponentColor(plan, "Dye", "#e15759"));
  });

  test("removeComponent empties wells left with nothing", () => {
    const plan = removeComponent(planWithContents(), "Dye");
    assert.deepEqual(plan.components, [{ name: "Media", color: "#4e79a7", constituents: [], osmolality: null }]);
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

  // --- Constituents ---

  test("addComponent gives the new component constituents: [], after name and color", () => {
    const plan = addComponent(emptyPlan().plan, "Media", "#4e79a7");
    assert.deepEqual(Object.keys(plan.components[0]), [
      "name",
      "color",
      "constituents",
      "osmolality",
    ]);
    assert.deepEqual(plan.components[0].constituents, []);
  });

  test("setConstituents replaces the list, trims names, and copies the given list", () => {
    let plan = planWithContents();
    plan = setConstituents(plan, "Dye", [constituentOf(" Dye ", 10, MOLAR_UNIT)]);
    assert.deepEqual(plan.components[1].constituents, [constituentOf("Dye", 10, MOLAR_UNIT)]);
    plan = setConstituents(plan, "Dye", [constituentOf("Dye", 5, MOLAR_UNIT)]);
    assert.deepEqual(plan.components[1].constituents, [constituentOf("Dye", 5, MOLAR_UNIT)]);
    assert.deepEqual(setConstituents(plan, "Dye", []).components[1].constituents, []);
    const given = [constituentOf("Dye", 7, MOLAR_UNIT)];
    const before = JSON.stringify(given);
    const edited = setConstituents(plan, "Dye", given);
    assert.equal(JSON.stringify(given), before);
    given[0].amount = 99;
    given.push(constituentOf("Other", 1, MOLAR_UNIT));
    assert.deepEqual(edited.components[1].constituents, [constituentOf("Dye", 7, MOLAR_UNIT)]);
  });

  test("setConstituents throws for a component not in the plan, and passes on checkConstituents' messages", () => {
    const plan = planWithContents();
    assert.throws(() => setConstituents(plan, "Water", []), {
      message: `There's no component called "Water" in this plan. Add it to the plan's components first.`,
    });
    assert.throws(() => setConstituents(plan, "Dye", [constituentOf("Dye", 0, MOLAR_UNIT)]), {
      message: 'The amount of "Dye" must be a number above 0, like 10, but got 0.',
    });
    assert.throws(() => setConstituents(plan, "Dye", [constituentOf("Dye", 10, "mg/mL")]), {
      message: `The unit of "Dye" must be one of ${OFFERED_UNITS.join(", ")}, but got "mg/mL".`,
    });
  });

  test("one family per name: a constituent in another component's family is refused, naming that component", () => {
    const plan = planWithFeedingMedia();
    assert.throws(
      () => setConstituents(plan, "Dye", [constituentOf("Hy-Soy", 10, MOLAR_UNIT)]),
      { message: familyMessage("Hy-Soy", MASS_UNIT, "Feeding media") },
    );
  });

  test("one family per name: with two other components carrying the name, the first in the plan is named", () => {
    // Media comes before Feeding media in the plan's order, and carries Hy-Soy in another unit.
    let plan = planWithFeedingMedia();
    plan = setConstituents(plan, "Media", [constituentOf("Hy-Soy", 2, MASS_SUBUNIT)]);
    assert.throws(
      () => setConstituents(plan, "Dye", [constituentOf("Hy-Soy", 10, MOLAR_UNIT)]),
      { message: familyMessage("Hy-Soy", MASS_SUBUNIT, "Media") },
    );
    // Removing Media leaves Feeding media as the first carrying Hy-Soy, in its own unit.
    const withoutMedia = removeComponent(plan, "Media");
    assert.throws(
      () => setConstituents(withoutMedia, "Dye", [constituentOf("Hy-Soy", 10, MOLAR_UNIT)]),
      { message: familyMessage("Hy-Soy", MASS_UNIT, "Feeding media") },
    );
  });

  test("one family per name: the same family in another unit is accepted; the only carrier may change family", () => {
    const plan = planWithFeedingMedia();
    assert.doesNotThrow(() =>
      setConstituents(plan, "Dye", [constituentOf("Hy-Soy", 500, MASS_SUBUNIT)]),
    );
    const changed = setConstituents(plan, "Feeding media", [
      constituentOf("Hy-Soy", 10, MOLAR_UNIT),
    ]);
    assert.equal(changed.components.at(-1).constituents[0].unit, MOLAR_UNIT);
  });

  test("one family per name: each constituent of the list being set is checked against the other components only", () => {
    const plan = planWithFeedingMedia();
    assert.doesNotThrow(() =>
      setConstituents(plan, "Dye", [
        constituentOf("Hy-Soy", 4, MASS_UNIT),
        constituentOf("Drug A", 1, MOLAR_UNIT),
      ]),
    );
  });

  test("setConstituents checks the component, then the list, then each family in list order", () => {
    const plan = planWithFeedingMedia();
    assert.throws(() => setConstituents(plan, "Water", "Dye"), {
      message: `There's no component called "Water" in this plan. Add it to the plan's components first.`,
    });
    assert.throws(
      () =>
        setConstituents(plan, "Dye", [
          constituentOf("Dye", "ten", MOLAR_UNIT),
          constituentOf("Hy-Soy", 10, MOLAR_UNIT),
        ]),
      { message: 'The amount of "Dye" must be a number above 0, like 10, but got "ten".' },
    );
  });

  test("renameComponent and setComponentColor keep constituents; removeComponent removes them", () => {
    let plan = planWithContents();
    plan = setConstituents(plan, "Dye", [constituentOf("Dye", 10, MOLAR_UNIT)]);
    const renamed = renameComponent(plan, "Dye", "Dye stock");
    assert.deepEqual(renamed.components[1].constituents, [constituentOf("Dye", 10, MOLAR_UNIT)]);
    const recolored = setComponentColor(plan, "Dye", "#59a14f");
    assert.deepEqual(recolored.components[1].constituents, [constituentOf("Dye", 10, MOLAR_UNIT)]);
    const removed = removeComponent(plan, "Dye");
    assert.ok(!removed.components.some((component) => component.name === "Dye"));
    assert.deepEqual(removed.components.flatMap((component) => component.constituents), []);
  });

  test("concentrationsOf gives a well's concentrations from a snapshot", () => {
    let plan = planWithContents();
    plan = setConstituents(plan, "Dye", [constituentOf("Dye", 10, MOLAR_UNIT)]);
    // Trough 3: 20% Dye, 80% Media.
    plan = addToWells(plan, [trough("3")], "Dye", 200);
    plan = addToWells(plan, [trough("3")], "Media", 800);
    const start = replay(plan.startingContents, plan.operationList, 0);
    const result = concentrationsOf(plan, start, trough("3"));
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Dye");
    assert.equal(result[0].family, familyOf(MOLAR_UNIT));
    assertWithin(result[0].value, 0.2 * 10 * factorOf(MOLAR_UNIT));
    // An empty well, and a well holding only components without constituents.
    assert.deepEqual(concentrationsOf(plan, start, trough("9")), []);
    plan = addToWells(plan, [trough("4")], "Media", 100);
    const startAgain = replay(plan.startingContents, plan.operationList, 0);
    assert.deepEqual(concentrationsOf(plan, startAgain, trough("4")), []);
  });

  test("concentrationsOf follows a transfer: the well's value at the snapshot after it, [] before", () => {
    let plan = planWithContents();
    plan = setConstituents(plan, "Dye", [constituentOf("Dye", 10, MOLAR_UNIT)]);
    plan = addToWells(plan, [{ labware: PLATE, well: "A1" }], "Media", 1000);
    // A trough of Dye holding well over its dead volume, so the transfer draws the full 50 µL.
    plan = addToWells(plan, [trough("5")], "Dye", deadVolumeOf(RESERVOIR) + 1000);
    plan = addTransfer(plan, {
      type: "transfer",
      source: trough("5"),
      destination: { labware: PLATE, well: "A1" },
      volume: 50,
      stage: "1",
    });
    const before = replay(plan.startingContents, plan.operationList, 0);
    const after = replay(plan.startingContents, plan.operationList, 1);
    assert.deepEqual(concentrationsOf(plan, before, { labware: PLATE, well: "A1" }), []);
    const result = concentrationsOf(plan, after, { labware: PLATE, well: "A1" });
    assert.equal(result.length, 1);
    assertWithin(result[0].value, (10 * factorOf(MOLAR_UNIT) * 50) / 1050);
  });

  test("concentrationsOf checks the well through the snapshot only", () => {
    const plan = planWithContents();
    const start = replay(plan.startingContents, plan.operationList, 0);
    assert.throws(() => concentrationsOf(plan, start, { labware: RESERVOIR, well: 5 }), {
      message: "The well given to volumeFractionsOf must be text, but got 5.",
    });
    assert.throws(() => concentrationsOf(plan, start, undefined), {
      message: "The labware given to volumeFractionsOf must be text, but got undefined.",
    });
  });

  // --- Osmolality ---

  test("addComponent gives the new component osmolality: null, last of its properties", () => {
    const plan = addComponent(emptyPlan().plan, "Media", "#4e79a7");
    assert.equal(plan.components[0].osmolality, null);
    assert.equal(Object.keys(plan.components[0]).at(-1), "osmolality");
  });

  test("setOsmolality sets values, keeps 0 as 0, removes with null, and has no upper limit", () => {
    let plan = planWithContents();
    plan = setOsmolality(plan, "Media", 300);
    assert.equal(plan.components[0].osmolality, 300);
    plan = setOsmolality(plan, "Media", 290.5);
    assert.equal(plan.components[0].osmolality, 290.5);
    plan = setOsmolality(plan, "Media", 0);
    assert.equal(plan.components[0].osmolality, 0);
    plan = setOsmolality(plan, "Media", 2800);
    assert.equal(plan.components[0].osmolality, 2800);
    plan = setOsmolality(plan, "Media", null);
    assert.equal(plan.components[0].osmolality, null);
    assert.equal(plan.components[1].osmolality, null);
  });

  test("setOsmolality with the value the component already has gives back the same plan", () => {
    const plan = setOsmolality(planWithContents(), "Media", 300);
    assert.equal(setOsmolality(plan, "Media", 300), plan);
    assert.equal(setOsmolality(plan, "Dye", null), plan);
  });

  test("setOsmolality throws for a component not in the plan, before a bad value", () => {
    const plan = planWithContents();
    const before = snapshot(plan);
    assert.throws(() => setOsmolality(plan, "Buffer", -5), {
      message:
        'There\'s no component called "Buffer" in this plan. Add it to the plan\'s components first.',
    });
    assert.equal(snapshot(plan), before);
  });

  test("setOsmolality passes on checkOsmolality's message, naming the component", () => {
    const plan = planWithContents();
    for (const [value, shown] of [
      [-5, "-5"],
      ["300", '"300"'],
      [NaN, "NaN"],
      [Infinity, "Infinity"],
      [undefined, "undefined"],
    ]) {
      assert.throws(() => setOsmolality(plan, "Media", value), {
        message: `The osmolality of Media must be a number of mOsm/kg, 0 or more, like 300, or none if it isn't known, but got ${shown}.`,
      });
    }
  });

  test("renaming, recoloring and setting constituents keep the osmolality; removing removes it", () => {
    let plan = setOsmolality(planWithContents(), "Dye", 300);
    assert.equal(renameComponent(plan, "Dye", "Dye stock").components[1].osmolality, 300);
    assert.equal(setComponentColor(plan, "Dye", "#59a14f").components[1].osmolality, 300);
    const withConstituents = setConstituents(plan, "Dye", [constituentOf("Dye", 10, MOLAR_UNIT)]);
    assert.equal(withConstituents.components[1].osmolality, 300);
    const both = setOsmolality(withConstituents, "Dye", 250);
    assert.deepEqual(both.components[1].constituents, [constituentOf("Dye", 10, MOLAR_UNIT)]);
    const removed = removeComponent(plan, "Dye");
    assert.ok(!removed.components.some((component) => component.name === "Dye"));
  });

  test("osmolalityOf gives a well of only Media its osmolality, and an empty well none", () => {
    let plan = setOsmolality(planWithContents(), "Media", 300);
    plan = addToWells(plan, [trough("3")], "Media", 500);
    const start = replay(plan.startingContents, plan.operationList, 0);
    assert.deepEqual(osmolalityOf(plan, start, trough("3")), { value: 300, missing: [] });
    assert.deepEqual(osmolalityOf(plan, start, trough("9")), { value: null, missing: [] });
  });

  test("osmolalityOf follows a transfer of Water at 0 into Media at 300: 270 after, 300 before", () => {
    const plan = waterIntoMediaPlan(300, 0);
    const well = { labware: DEEP, well: "A1" };
    const before = osmolalityOf(plan, replay(plan.startingContents, plan.operationList, 0), well);
    const after = osmolalityOf(plan, replay(plan.startingContents, plan.operationList, 1), well);
    assertOsmolalityWithin(before.value, 300);
    assert.deepEqual(before.missing, []);
    assertOsmolalityWithin(after.value, 270);
    assert.deepEqual(after.missing, []);
  });

  test("osmolalityOf names Water when it has no value, after the transfer only", () => {
    const plan = waterIntoMediaPlan(300, null);
    const well = { labware: DEEP, well: "A1" };
    const before = replay(plan.startingContents, plan.operationList, 0);
    const after = replay(plan.startingContents, plan.operationList, 1);
    assert.deepEqual(osmolalityOf(plan, after, well), { value: null, missing: ["Water"] });
    assert.deepEqual(osmolalityOf(plan, before, well), { value: 300, missing: [] });
  });

  test("osmolalityOf checks the well through the snapshot only", () => {
    const plan = planWithContents();
    const start = replay(plan.startingContents, plan.operationList, 0);
    assert.throws(() => osmolalityOf(plan, start, { labware: RESERVOIR, well: 5 }), {
      message: "The well given to volumeFractionsOf must be text, but got 5.",
    });
  });

  test("osmolality never reaches the Biomek files", () => {
    const withValues = setExperimentName(waterIntoMediaPlan(300, 0), "Exp36");
    const withNone = setOsmolality(setOsmolality(withValues, "Media", null), "Water", null);
    assert.equal(withNone.components.every((component) => component.osmolality === null), true);
    const timestamp = new Date(2026, 10, 5, 9, 7, 2);
    assert.deepEqual(writeRunFiles(withValues, timestamp), writeRunFiles(withNone, timestamp));
  });

  test("concentrationsOf gives a well's cells in the cells' family", () => {
    let plan = planWithCells();
    plan = addToWells(plan, [trough("3")], "Suspension", 100);
    plan = addToWells(plan, [trough("3")], "Media", 900);
    const start = replay(plan.startingContents, plan.operationList, 0);
    const result = concentrationsOf(plan, start, trough("3"));
    assert.equal(result.length, 1);
    assert.equal(result[0].family, familyOf(CELL_DENSITY_UNIT));
    assertWithin(result[0].value, 0.1 * 1500000);
  });

  // --- Seeding densities (labware found in DECK by its growth area, never named) ---

  test("seedingDensitiesOf gives a well's cells per cm² of its growth area", () => {
    const volume = capacityOf(GROWING) / 2;
    const plan = withCellsIn(planWithCells(), wellOn(GROWING, "A1"), volume);
    const start = replay(plan.startingContents, plan.operationList, 0);
    const result = seedingDensitiesOf(plan, start, wellOn(GROWING, "A1"));
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Cells");
    assert.deepEqual(Object.keys(result[0]).sort(), ["name", "value"]);
    assertWithin(result[0].value, seedingDensity(0.1 * 1500000, volume, growthAreaOf(GROWING)));
  });

  test("seedingDensitiesOf gives only cells, and [] for no cells, an empty well or labware without a growth area", () => {
    const volume = capacityOf(GROWING) / 2;
    let plan = setConstituents(planWithCells(), "Dye", [constituentOf("Dye", 10, MOLAR_UNIT)]);
    plan = withCellsIn(plan, wellOn(GROWING, "A1"), volume);
    plan = addToWells(plan, [wellOn(GROWING, "A1")], "Dye", 10);
    plan = addToWells(plan, [wellOn(GROWING, "A2")], "Dye", 10);
    plan = withCellsIn(plan, wellOn(NOT_GROWING, "A1"), capacityOf(NOT_GROWING) / 2);
    const start = replay(plan.startingContents, plan.operationList, 0);
    const result = seedingDensitiesOf(plan, start, wellOn(GROWING, "A1"));
    assert.deepEqual(
      result.map((entry) => entry.name),
      ["Cells"],
    );
    assert.deepEqual(seedingDensitiesOf(plan, start, wellOn(GROWING, "A2")), []);
    assert.deepEqual(seedingDensitiesOf(plan, start, wellOn(GROWING, "A3")), []);
    assert.deepEqual(seedingDensitiesOf(plan, start, wellOn(NOT_GROWING, "A1")), []);
    // The same well's cells are still there as a cell density.
    assert.equal(concentrationsOf(plan, start, wellOn(NOT_GROWING, "A1")).length, 1);
  });

  test("seedingDensitiesOf adds cells from two components before working out the density", () => {
    let plan = addComponent(planWithCells(), "Second suspension", "#76b7b2");
    plan = setConstituents(plan, "Second suspension", [constituentOf("Cells", 500000, CELL_DENSITY_UNIT)]);
    const well = wellOn(GROWING, "A1");
    // Half the well's capacity, from config/, so a change there never breaks this test.
    const total = capacityOf(GROWING) / 2;
    plan = addToWells(plan, [well], "Suspension", total * 0.1);
    plan = addToWells(plan, [well], "Second suspension", total * 0.2);
    plan = addToWells(plan, [well], "Media", total * 0.7);
    const start = replay(plan.startingContents, plan.operationList, 0);
    const result = seedingDensitiesOf(plan, start, well);
    assert.equal(result.length, 1);
    const cellDensity = 0.1 * 1500000 + 0.2 * 500000;
    assertWithin(result[0].value, seedingDensity(cellDensity, total, growthAreaOf(GROWING)));
  });

  test("seedingDensitiesOf counts the whole well, dead volume included", () => {
    const well = wellOn(GROWING, "A1");
    const plan = addToWells(planWithCells(), [well], "Suspension", deadVolumeOf(GROWING));
    const start = replay(plan.startingContents, plan.operationList, 0);
    const result = seedingDensitiesOf(plan, start, well);
    assertWithin(
      result[0].value,
      seedingDensity(1500000, deadVolumeOf(GROWING), growthAreaOf(GROWING)),
    );
    assert.ok(result[0].value > 0);
  });

  test("adding Media keeps the seeding density; taking half the well away halves it", () => {
    const well = wellOn(GROWING, "A1");
    const volume = capacityOf(GROWING) / 2;
    let plan = withCellsIn(planWithCells(), well, volume);
    // A trough of Media well over its dead volume, so the transfer draws the full volume.
    plan = addToWells(plan, [trough("5")], "Media", deadVolumeOf(RESERVOIR) + 1000);
    plan = addTransfer(plan, {
      type: "transfer",
      source: trough("5"),
      destination: well,
      volume: capacityOf(GROWING) / 4,
      stage: "1",
    });
    // Half the well, taken in a stage of its own (a well can't be a source and a destination in
    // one stage), and within its usable volume.
    const taken = (volume + capacityOf(GROWING) / 4) / 2;
    assert.ok(taken <= volume + capacityOf(GROWING) / 4 - deadVolumeOf(GROWING));
    plan = addStage(plan, null).plan;
    plan = addTransfer(plan, {
      type: "transfer",
      source: well,
      destination: wellOn(GROWING, "A2"),
      volume: taken,
      stage: "2",
    });
    const before = seedingDensitiesOf(plan, replay(plan.startingContents, plan.operationList, 0), well);
    const afterMedia = replay(plan.startingContents, plan.operationList, 1);
    const afterTaking = replay(plan.startingContents, plan.operationList, 2);
    assert.ok(
      concentrationsOf(plan, afterMedia, well)[0].value <
        concentrationsOf(plan, replay(plan.startingContents, plan.operationList, 0), well)[0].value,
    );
    assertWithin(seedingDensitiesOf(plan, afterMedia, well)[0].value, before[0].value);
    assertWithin(seedingDensitiesOf(plan, afterTaking, well)[0].value, before[0].value / 2);
  });

  test("seedingDensitiesOf throws as concentrationsOf does, then as growthAreaOf does", () => {
    const plan = planWithCells();
    const start = replay(plan.startingContents, plan.operationList, 0);
    assert.throws(() => seedingDensitiesOf(plan, start, undefined), {
      message: "The labware given to volumeFractionsOf must be text, but got undefined.",
    });
    const deckNames = DECK.map((entry) => `"${entry.name}"`).join(", ");
    assert.throws(() => seedingDensitiesOf(plan, start, { labware: "Bench", well: "A1" }), {
      message: `There's no labware "Bench" on the deck. The deck has ${deckNames}.`,
    });
  });

  test("seedingDensitiesOf doesn't change its inputs", () => {
    const well = wellOn(GROWING, "A1");
    const plan = withCellsIn(planWithCells(), well, capacityOf(GROWING) / 2);
    const start = replay(plan.startingContents, plan.operationList, 0);
    const planBefore = planToText(plan, "test");
    const startBefore = JSON.stringify(start.volumeFractionsOf(well.labware, well.well));
    const endBefore = JSON.stringify(well);
    seedingDensitiesOf(plan, start, well);
    assert.equal(planToText(plan, "test"), planBefore);
    assert.equal(JSON.stringify(start.volumeFractionsOf(well.labware, well.well)), startBefore);
    assert.equal(JSON.stringify(well), endBefore);
  });

  // --- Labware ---

  test("labwareUsed lists starting contents', transfers' and well labels' labware in deck order", () => {
    let plan = addComponent(planWithStages(1), "Media", "#4e79a7");
    plan = addToWells(plan, [{ labware: OTHER_PLATE, well: "A1" }], "Media", 100);
    plan = addTransfer(plan, transferTo("1", "B2"));
    plan = setWellLabel(plan, { labware: LABELED_ONLY, well: "A1" }, "Cond 1");
    const deckOrder = DECK.map((entry) => entry.name);
    const expected = deckOrder.filter((name) =>
      [PLATE, OTHER_PLATE, RESERVOIR, LABELED_ONLY].includes(name),
    );
    assert.deepEqual(labwareUsed(plan), expected);
    assert.deepEqual(labwareUsed(planWithStages(1)), []);
  });

  test("labwareUsed lists a labware with only a well label", () => {
    const plan = setWellLabel(planWithStages(1), { labware: LABELED_ONLY, well: "B2" }, "Cond 1");
    assert.deepEqual(labwareUsed(plan), [LABELED_ONLY]);
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

  // --- Well labels ---

  test("emptyPlan()'s wellLabels is {}, and wellLabelOf gives null for any of its wells", () => {
    const { plan } = emptyPlan();
    assert.deepEqual(plan.wellLabels, {});
    assert.equal(wellLabelOf(plan, plateWell("A1")), null);
    assert.equal(wellLabelOf(plan, trough("5")), null);
  });

  test("setWellLabel labels a plate well and a reservoir trough; wellLabelOf gives the label", () => {
    const plan = setWellLabel(planWithStages(1), plateWell("A1"), "Cond 1");
    assert.equal(wellLabelOf(plan, plateWell("A1")), "Cond 1");
    assert.deepEqual(plan.wellLabels, { [PLATE]: { A1: "Cond 1" } });
    const withTrough = setWellLabel(plan, trough("5"), "Media");
    assert.equal(wellLabelOf(withTrough, trough("5")), "Media");
    assert.deepEqual(withTrough.wellLabels, {
      [PLATE]: { A1: "Cond 1" },
      [RESERVOIR]: { 5: "Media" },
    });
  });

  test('setWellLabel trims; "" and "   " remove the label, and removing a labware\'s last label removes the labware', () => {
    const plan = setWellLabel(planWithStages(1), plateWell("A1"), "  Cond 1 ");
    assert.equal(wellLabelOf(plan, plateWell("A1")), "Cond 1");
    const two = setWellLabel(plan, plateWell("A2"), "Cond 2");
    for (const blank of ["", "   "]) {
      const one = setWellLabel(two, plateWell("A2"), blank);
      assert.equal(wellLabelOf(one, plateWell("A2")), null);
      assert.deepEqual(one.wellLabels, { [PLATE]: { A1: "Cond 1" } });
      assert.deepEqual(setWellLabel(plan, plateWell("A1"), blank).wellLabels, {});
    }
  });

  test("setWellLabel gives back the same plan when removing a label the well doesn't have, or giving the label it has", () => {
    const plan = planWithStages(1);
    assert.equal(setWellLabel(plan, plateWell("A1"), ""), plan);
    const labeled = setWellLabel(plan, plateWell("A1"), "Cond 1");
    assert.equal(setWellLabel(labeled, plateWell("A1"), "Cond 1"), labeled);
    assert.equal(setWellLabel(labeled, plateWell("A1"), " Cond 1 "), labeled);
    assert.equal(setWellLabel(labeled, plateWell("A2"), "  "), labeled);
  });

  test("two wells may share a label; labels with spaces inside and other characters are accepted", () => {
    let plan = setWellLabel(planWithStages(1), plateWell("A1"), "Cond 1");
    plan = setWellLabel(plan, plateWell("A2"), "Cond 1");
    plan = setWellLabel(plan, plateWell("A3"), "Drug A 10 µM");
    assert.deepEqual(plan.wellLabels, {
      [PLATE]: { A1: "Cond 1", A2: "Cond 1", A3: "Drug A 10 µM" },
    });
  });

  test("setWellLabel refuses a label that isn't text, a well not on the grid and labware not on the deck; wellLabelOf refuses a well not on the deck", () => {
    const plan = planWithStages(1);
    const before = snapshot(plan);
    assert.throws(() => setWellLabel(plan, plateWell("A1"), 5), {
      message: 'A well\'s label must be text, like "Cond 1", but got 5.',
    });
    assert.throws(() => setWellLabel(plan, plateWell("Z99"), "Cond 1"), {
      message: `"Z99" isn't a well on ${PLATE}. Its wells are A1 to H12.`,
    });
    assert.throws(() => setWellLabel(plan, { labware: "Bench", well: "A1" }, "Cond 1"), {
      message: new RegExp(`^There's no labware "Bench" on the deck\\.`),
    });
    assert.throws(() => wellLabelOf(plan, plateWell("Z99")), {
      message: `"Z99" isn't a well on ${PLATE}. Its wells are A1 to H12.`,
    });
    assert.equal(snapshot(plan), before);
  });

  test("setWellLabels sets the whole table; {} removes every label", () => {
    const plan = planWithStages(1);
    const labels = { [PLATE]: { A1: "Cond 1", A2: "Cond 1" }, [RESERVOIR]: { 5: "Media" } };
    const labeled = setWellLabels(plan, labels);
    assert.deepEqual(labeled.wellLabels, labels);
    assert.equal(wellLabelOf(labeled, trough("5")), "Media");
    assert.deepEqual(setWellLabels(labeled, {}).wellLabels, {});
  });

  test("changing the table given to setWellLabels afterwards doesn't change the plan", () => {
    const labels = { [PLATE]: { A1: "Cond 1" } };
    const plan = setWellLabels(planWithStages(1), labels);
    labels[PLATE].A1 = "Changed";
    labels[OTHER_PLATE] = { A1: "New" };
    assert.deepEqual(plan.wellLabels, { [PLATE]: { A1: "Cond 1" } });
  });

  test("setWellLabels refuses a table that isn't an object", () => {
    const plan = planWithStages(1);
    for (const [labels, got] of [[null, "null"], [[], "a list"], [5, "5"]]) {
      assert.throws(() => setWellLabels(plan, labels), {
        message: `The well labels must be an object of labware names, each holding an object of wells and labels, like { Deep: { A1: "Cond 1" } }, but got ${got}.`,
      });
    }
  });

  test("setWellLabels refuses labware not on the deck, wells that aren't an object or are empty, and a well not on the grid", () => {
    const plan = planWithStages(1);
    assert.throws(() => setWellLabels(plan, { Bench: { A1: "Cond 1" } }), {
      message: new RegExp(`^There's no labware "Bench" on the deck\\.`),
    });
    for (const [wells, got] of [[5, "5"], [[], "a list"], [null, "null"]]) {
      assert.throws(() => setWellLabels(plan, { [PLATE]: wells }), {
        message: `The well labels for ${PLATE} must be an object of wells and labels, like { A1: "Cond 1" }, but got ${got}.`,
      });
    }
    assert.throws(() => setWellLabels(plan, { [PLATE]: {} }), {
      message: `The well labels for ${PLATE} are empty. A labware without labeled wells is left out of the well labels.`,
    });
    assert.throws(() => setWellLabels(plan, { [PLATE]: { Z99: "Cond 1" } }), {
      message: `"Z99" isn't a well on ${PLATE}. Its wells are A1 to H12.`,
    });
  });

  test("setWellLabels refuses a label it would otherwise have to tidy, each with its message, leaving the plan unchanged", () => {
    const plan = setWellLabel(planWithStages(1), plateWell("B1"), "Kept");
    const before = snapshot(plan);
    const blank = `The label for ${PLATE} A1 is blank. A well without a label is left out of the well labels.`;
    const cases = [
      [5, `The label for ${PLATE} A1 must be text, like "Cond 1", but got 5.`],
      ["", blank],
      ["  ", blank],
      [" Cond 1", `The label for ${PLATE} A1, " Cond 1", has spaces at the start or end. Remove them.`],
    ];
    for (const [label, message] of cases) {
      assert.throws(() => setWellLabels(plan, { [PLATE]: { A1: label } }), { message });
    }
    assert.equal(snapshot(plan), before);
  });

  test("order of checks: setWellLabel reports the well before the label; setWellLabels the labware before its wells, and the well before its label", () => {
    const plan = planWithStages(1);
    assert.throws(() => setWellLabel(plan, plateWell("Z99"), 5), {
      message: new RegExp(`^"Z99" isn't a well on ${PLATE}\\.`),
    });
    assert.throws(() => setWellLabels(plan, { Bench: 5 }), {
      message: new RegExp(`^There's no labware "Bench" on the deck\\.`),
    });
    assert.throws(() => setWellLabels(plan, { [PLATE]: { Z99: 5 } }), {
      message: new RegExp(`^"Z99" isn't a well on ${PLATE}\\.`),
    });
    // Labware in the order the table holds them: the first is reported.
    assert.throws(() => setWellLabels(plan, { [PLATE]: { A1: "" }, Bench: {} }), {
      message: new RegExp(`^The label for ${PLATE} A1 is blank\\.`),
    });
  });

  test("labeling a well leaves its contents, the transfers and everything else as they were", () => {
    const plan = withTransfersIn(planWithContents(), ["1"]);
    const labeled = setWellLabel(plan, trough("1"), "Media stock");
    for (const part of PLAN_PARTS.filter((candidate) => candidate !== "wellLabels")) {
      assert.equal(labeled[part], plan[part], part);
    }
  });

  // --- Randomizations ---

  // The plan the randomization tests use (transfer-designer.md, section 6): DEEP A1 to A3 holding
  // Drug A, Drug B and Media; stage 1 with a transfer, then stage 2, on tips of its own, with one;
  // components Drug A, Drug B and Media.
  function randomizingPlan() {
    let { plan } = emptyPlan();
    plan = addComponent(plan, "Drug A", "#4e79a7");
    plan = addComponent(plan, "Drug B", "#e15759");
    plan = addComponent(plan, "Media", "#59a14f");
    const amount = capacityOf(DEEP);
    plan = addToWells(plan, [deepWell("A1")], "Drug A", amount);
    plan = addToWells(plan, [deepWell("A2")], "Drug B", amount);
    plan = addToWells(plan, [deepWell("A3")], "Media", amount);
    plan = addToWells(plan, [trough("1")], "Media", capacityOf(RESERVOIR));
    plan = addTransfer(plan, transferTo("1", "A1"));
    plan = addStageWithNewTips(plan, null).plan;
    return addTransfer(plan, transferTo("2", "A2"));
  }

  // A well on DEEP, e.g. deepWell("A1").
  function deepWell(well) {
    return { labware: DEEP, well };
  }

  // A source, e.g. source("A1", 8), source("A3", null, true) for the filler, or source("A2", 8,
  // false, true) for one sharing the tips of the source before it.
  function source(well, replicates, filler = false, sharesTips = false) {
    return { labware: DEEP, well, replicates, filler, sharesTips };
  }

  // The 20 wells to fill: PLATE's B2 to B11 and C2 to C11, in deck order.
  function wellsToFill() {
    return [...GRID_96.wellsInBox("B2", "C11")].map(plateWell);
  }

  // The plan with a randomization before stage 2, set up with A1 and A2 at 8 replicates, A3 the
  // filler, the 20 wells to fill, seed 37 and a volume of 10 µL: { plan, id }.
  function setUpRandomization(plan = randomizingPlan(), beforeId = "2") {
    const { plan: added, id } = addRandomization(plan, beforeId, { seed: 37, volume: 10 });
    const set = setRandomization(added, id, {
      sources: [source("A1", 8), source("A2", 8), source("A3", null, true)],
      fill: wellsToFill(),
    });
    return { plan: set, id };
  }

  // The plan with the set-up randomization run: { plan, id }.
  function runRandomizationPlan() {
    const { plan, id } = setUpRandomization();
    return { plan: runRandomization(plan, id), id };
  }

  // The wells each of a run randomization's stages fills, as "labware well" text, by stage ID.
  function destinationsByStage(plan, id) {
    return Object.fromEntries(
      randomizationAt(plan, id).stages.map(({ stage }) => [
        stage,
        transfersIn(plan, stage).map((transfer) => `${transfer.destination.labware} ${transfer.destination.well}`),
      ]),
    );
  }

  test("emptyPlan() has no randomizations", () => {
    assert.deepEqual(emptyPlan().plan.randomizations, []);
  });

  test("addRandomization adds one before a stage with the defaults and the seed and volume given", () => {
    const plan = randomizingPlan();
    const { plan: added, id } = addRandomization(plan, "2", { seed: 37, volume: 50 });
    assert.equal(id, "r1");
    assert.deepEqual(randomizationAt(added, id), {
      id: "r1",
      name: "Randomization1",
      beforeId: "2",
      sources: [],
      fill: [],
      seed: 37,
      volume: 50,
      settings: defaultSettings(),
      tipType: TIP_TYPES[0],
      probes: probesFor(DEFAULT_PROBE_COUNT),
      stages: [],
    });
    assert.equal(randomizationAt(added, "r9"), null);
    const second = addRandomization(added, null, { seed: null, volume: null });
    assert.equal(second.id, "r2");
    assert.equal(randomizationAt(second.plan, "r2").beforeId, null);
    const third = addRandomization(removeRandomization(second.plan, "r1"), "1", {
      seed: 1,
      volume: 1,
    });
    assert.equal(third.id, "r3");
  });

  test("addRandomization refuses a stage that isn't one, one inside a tip group, and a bad seed or volume, in that order", () => {
    const plan = addStage(randomizingPlan(), null).plan;
    assert.throws(() => addRandomization(plan, "9", { seed: 0, volume: -1 }), {
      message: `There's no stage "9" to add a randomization before.`,
    });
    assert.throws(() => addRandomization(plan, "3", { seed: 0, volume: -1 }), {
      message: "A randomization sits between tip groups, so it can't go before stage 3, “New stage”.",
    });
    assert.throws(() => addRandomization(plan, "2", { seed: 0, volume: -1 }), {
      message: "A randomization's seed must be a whole number from 1 to 999,999, or null, but got 0.",
    });
    for (const seed of [1000000, 1.5, "37"]) {
      assert.throws(() => addRandomization(plan, "2", { seed, volume: 5 }), /seed must be/);
    }
    assert.throws(() => addRandomization(plan, "2", { seed: 37, volume: -1 }), {
      message: "A randomization's volume must be a number of µL above 0, or null, but got -1.",
    });
    assert.throws(() => addRandomization(plan, "2", { seed: 37, volume: 0 }), /volume must be/);
  });

  test("setRandomization sets sources and wells to fill, the wells in deck order and the probes smallest first", () => {
    const { plan, id } = addRandomization(randomizingPlan(), "2", { seed: 37, volume: 10 });
    const fill = [plateWell("C3"), { labware: OTHER_PLATE, well: "A1" }, plateWell("B2")];
    const set = setRandomization(plan, id, {
      sources: [source("A1", 4), source("A3", null, true)],
      fill,
      probes: [3, 1],
      tipType: TIP_TYPES.at(-1),
      seed: 5,
      volume: 2.5,
      settings: otherSettings(),
    });
    const randomization = randomizationAt(set, id);
    assert.deepEqual(randomization.sources, [source("A1", 4), source("A3", null, true)]);
    assert.deepEqual(randomization.fill, [plateWell("B2"), plateWell("C3"), { labware: OTHER_PLATE, well: "A1" }]);
    assert.deepEqual(randomization.probes, [1, 3]);
    assert.equal(randomization.tipType, TIP_TYPES.at(-1));
    assert.equal(randomization.seed, 5);
    assert.equal(randomization.volume, 2.5);
    assert.deepEqual(randomization.settings, otherSettings());
    assert.equal(randomization.beforeId, "2");
    assert.deepEqual(randomization.stages, []);
    // Only randomizations change.
    for (const part of PLAN_PARTS.filter((candidate) => candidate !== "randomizations")) {
      assert.equal(set[part], plan[part], part);
    }
  });

  test("setRandomization with unchanged values gives back the same plan", () => {
    const { plan, id } = setUpRandomization();
    assert.equal(setRandomization(plan, id, {}), plan);
    assert.equal(setRandomization(plan, id, { seed: 37, fill: [...wellsToFill()].reverse() }), plan);
  });

  test("setRandomization never changes a run randomization's stages or beforeId", () => {
    const { plan, id } = runRandomizationPlan();
    const before = randomizationAt(plan, id);
    const set = randomizationAt(setRandomization(plan, id, { sources: [source("A1", 20)] }), id);
    assert.deepEqual(set.stages, before.stages);
    assert.equal(set.beforeId, before.beforeId);
  });

  test("setRandomization refuses each invalid value with its message, leaving the plan unchanged", () => {
    const { plan, id } = setUpRandomization();
    const before = snapshot(plan);
    const cases = [
      [
        { stages: [] },
        'The changes to a randomization must be an object of "sources", "fill", "seed", "volume", "settings", "tipType" and "probes", but got "stages".',
      ],
      [
        null,
        'The changes to a randomization must be an object of "sources", "fill", "seed", "volume", "settings", "tipType" and "probes", but got null.',
      ],
      [{ sources: 5 }, "A randomization's sources must be a list, but got 5."],
      [{ fill: 5 }, "A randomization's wells to fill must be a list, but got 5."],
      [
        { sources: [source("A1", 1), { labware: DEEP, well: "A2" }] },
        'Source 2 must be an object with exactly "labware", "well", "replicates", "filler" and "sharesTips".',
      ],
      [
        { sources: [source("A1", 1), source("Z9", 1)] },
        new RegExp(`^Source 2: "Z9" isn't a well on ${DEEP}\\.`),
      ],
      [
        { fill: [plateWell("B2"), plateWell("B3"), plateWell("Z9")] },
        new RegExp(`^Well to fill 3: "Z9" isn't a well on ${PLATE}\\.`),
      ],
      [
        { sources: [source("A1", 1), source("A1", 2)] },
        `${DEEP} A1 is a source twice. List each source once.`,
      ],
      [
        { fill: [plateWell("B2"), plateWell("B2")] },
        `${PLATE} B2 is a well to fill twice. List each once.`,
      ],
      [
        { sources: [source("A1", 1), { ...plateWell("B2"), replicates: 1, filler: false, sharesTips: false }] },
        `${PLATE} B2 is both a source and a well to fill. A well can be only one.`,
      ],
      [
        { sources: [source("A1", 1), source("A2", 1.5)] },
        "Source 2's replicates must be a whole number of at least 1, or null, but got 1.5.",
      ],
      [
        { sources: [source("A1", 1), { ...source("A2", 1), filler: "yes" }] },
        `Source 2's "filler" must be true or false, but got "yes".`,
      ],
      [
        { sources: [source("A1", 1), source("A2", 1), source("A3", 4, true)] },
        "Source 3 is a filler well, so its replicates must be null, but got 4.",
      ],
      [
        { sources: [source("A1", null, true), source("A2", 1), source("A3", 4, true)] },
        "Source 3 is a filler well, so its replicates must be null, but got 4.",
      ],
      [
        { seed: 0 },
        "A randomization's seed must be a whole number from 1 to 999,999, or null, but got 0.",
      ],
      [
        { volume: 0 },
        "A randomization's volume must be a number of µL above 0, or null, but got 0.",
      ],
      [{ settings: { ...defaultSettings(), probes: [1] } }, /probes/],
      [
        { settings: { ...defaultSettings(), sourceMix: exampleMix() } },
        /^The source mixes, so its technique must be/,
      ],
      [
        { settings: mixStepDefaults() },
        "A randomization's transfers move liquid, so its settings can't be a mix step's.",
      ],
      [{ tipType: "BC50" }, `"BC50" isn't a tip type. Choose one of ${TIP_TYPES.map((tip) => `"${tip}"`).join(", ")}.`],
      [{ probes: [9] }, "Probe numbers must be whole numbers from 1 to 8, but got 9."],
      [{ probes: [3, 1, 3] }, "Probe 3 is listed more than once. List each probe once."],
    ];
    for (const [changes, message] of cases) {
      assert.throws(
        () => setRandomization(plan, id, changes),
        message instanceof RegExp ? { message } : { message },
        JSON.stringify(changes),
      );
    }
    assert.throws(() => setRandomization(plan, "r9", {}), {
      message: `There's no randomization "r9" in the plan.`,
    });
    assert.equal(snapshot(plan), before);
  });

  test("setRandomization checks in its order: the randomization, the changes, sources, fill, both, seed, volume, settings, tip type, probes", () => {
    const { plan, id } = setUpRandomization();
    const allBad = {
      sources: [source("A1", 1), source("A1", 1)],
      fill: [plateWell("B2"), plateWell("B2")],
      seed: 0,
      volume: 0,
      settings: mixStepDefaults(),
      tipType: "BC50",
      probes: [9],
    };
    assert.throws(() => setRandomization(plan, "r9", { ...allBad, stages: [] }), /no randomization/);
    assert.throws(() => setRandomization(plan, id, { ...allBad, stages: [] }), /changes to a randomization/);
    const remaining = [/is a source twice/, /is a well to fill twice/];
    let changes = { ...allBad };
    assert.throws(() => setRandomization(plan, id, changes), remaining[0]);
    changes = { ...changes, sources: [source("A1", 1), { ...plateWell("C2"), replicates: 1, filler: false, sharesTips: false }] };
    assert.throws(() => setRandomization(plan, id, changes), remaining[1]);
    changes = { ...changes, fill: [plateWell("B2")] };
    // The well in both is judged on the result: C2 is still a well to fill until fill is given.
    assert.throws(() => setRandomization(plan, id, { sources: changes.sources }), /both a source and a well to fill/);
    for (const [property, good, pattern] of [
      ["seed", 1, /seed must be/],
      ["volume", 1, /volume must be/],
      ["settings", defaultSettings(), /can't be a mix step's/],
      ["tipType", TIP_TYPES[0], /isn't a tip type/],
      ["probes", [1], { message: /^Probe numbers/ }],
    ]) {
      assert.throws(() => setRandomization(plan, id, changes), pattern, property);
      changes = { ...changes, [property]: good };
    }
    setRandomization(plan, id, changes);
  });

  test("randomizationProblems gives each problem's message, in order, and [] when it can run", () => {
    const { plan, id } = addRandomization(randomizingPlan(), "2", { seed: null, volume: null });
    assert.deepEqual(randomizationProblems(plan, id), [
      "Pick at least one source.",
      "Pick the wells to fill.",
      "Type a seed.",
      "Set the volume.",
    ]);
    const onlyFiller = setRandomization(plan, id, {
      sources: [source("A3", null, true)],
      fill: wellsToFill(),
      seed: 37,
      volume: 10,
    });
    assert.deepEqual(randomizationProblems(onlyFiller, id), ["Add a source that isn't the filler."]);
    const missing = setRandomization(onlyFiller, id, {
      sources: [source("A1", null), source("A2", 8)],
    });
    assert.deepEqual(randomizationProblems(missing, id), ["Drug A needs a number of replicates."]);
    const tooMany = setRandomization(missing, id, { sources: [source("A1", 30), source("A2", 34)] });
    assert.deepEqual(randomizationProblems(tooMany, id), ["64 replicates, but only 20 wells to fill."]);
    const oneWell = setRandomization(tooMany, id, { fill: [plateWell("B2")] });
    assert.deepEqual(randomizationProblems(oneWell, id), ["64 replicates, but only 1 well to fill."]);
    const leftOver = setRandomization(missing, id, { sources: [source("A1", 4), source("A2", 4)] });
    assert.deepEqual(randomizationProblems(leftOver, id), [
      "12 wells left over: make a source the filler, or unpick them.",
    ]);
    const oneLeft = setRandomization(leftOver, id, { sources: [source("A1", 10), source("A2", 9)] });
    assert.deepEqual(randomizationProblems(oneLeft, id), [
      "1 well left over: make a source the filler, or unpick them.",
    ]);
    const { plan: ready } = setUpRandomization();
    assert.deepEqual(randomizationProblems(ready, "r1"), []);
  });

  test("randomizationProblems leaves out the pool's follow-on problems with no sources or no wells to fill", () => {
    const { plan, id } = addRandomization(randomizingPlan(), "2", { seed: 37, volume: 10 });
    const noSources = setRandomization(plan, id, { fill: wellsToFill() });
    assert.deepEqual(randomizationProblems(noSources, id), ["Pick at least one source."]);
    const noWells = setRandomization(plan, id, { sources: [source("A1", 8), source("A2", null)] });
    assert.deepEqual(randomizationProblems(noWells, id), ["Pick the wells to fill."]);
    const noWellsWithSeedMissing = setRandomization(noWells, id, { seed: null });
    assert.deepEqual(randomizationProblems(noWellsWithSeedMissing, id), ["Pick the wells to fill.", "Type a seed."]);
  });

  test("sourceName: a well label, the main component, ' +N', the first on a tie, or the labware's label and well", () => {
    let { plan, id } = setUpRandomization();
    assert.equal(sourceName(plan, id, deepWell("A1")), "Drug A");
    plan = setWellLabel(plan, deepWell("A1"), "Cond 1");
    assert.equal(sourceName(plan, id, deepWell("A1")), "Cond 1");
    plan = addToWells(plan, [deepWell("A4")], "Drug B", 10);
    plan = addToWells(plan, [deepWell("A4")], "Drug A", 30);
    plan = addToWells(plan, [deepWell("A4")], "Media", 30);
    assert.equal(sourceName(plan, id, deepWell("A4")), "Drug A +2");
    plan = setLabel(plan, DEEP, "Drugs");
    assert.equal(sourceName(plan, id, deepWell("A5")), "Drugs A5");
    // Contents just before the randomization: stage 1 fills PLATE A1 with Media first.
    assert.equal(sourceName(plan, id, plateWell("A1")), "Media");
    // PLATE A2 is filled by stage 2, after the randomization, so it's still empty then.
    assert.equal(sourceName(plan, id, plateWell("A2")), `${PLATE} A2`);
  });

  test("runRandomization makes a stage per source, in source order, named, each on tips of its own, filling every well once", () => {
    const { plan: setUp, id } = setUpRandomization();
    const randomization = randomizationAt(setUp, id);
    const plan = runRandomization(setUp, id);
    const run = randomizationAt(plan, id);
    const stageIds = run.stages.map((owned) => owned.stage);
    assert.equal(stageIds.length, 3);
    assert.deepEqual(stageOrder(plan), ["1", ...stageIds, "2"]);
    assert.deepEqual(
      stageIds.map((stage) => plan.stageList.get(stage).name),
      ["Drug A", "Drug B", "Media"],
    );
    assert.deepEqual(
      run.stages.map(({ labware, well }) => ({ labware, well })),
      [deepWell("A1"), deepWell("A2"), deepWell("A3")],
    );
    for (const stage of stageIds) {
      assert.deepEqual(plan.stageList.get(stage).settings, randomization.settings);
      assert.deepEqual(tipChangeAt(plan, stage), { tipType: randomization.tipType, probes: randomization.probes });
      assert.equal(randomizationOf(plan, stage), id);
    }
    assert.equal(randomizationOf(plan, "1"), null);
    assert.equal(randomizationOf(plan, "2"), null);
    // Each the only stage of its tip group, and the stage after keeps its tips.
    for (const group of tipGroups(plan)) {
      if (group.stages.some((stage) => stageIds.includes(stage))) {
        assert.equal(group.stages.length, 1);
      }
    }
    assert.deepEqual(tipChangeAt(plan, "2"), tipChangeAt(setUp, "2"));
    assert.equal(run.beforeId, "2");
    const destinations = destinationsByStage(plan, id);
    assert.deepEqual(
      stageIds.map((stage) => destinations[stage].length),
      [8, 8, 4],
    );
    const filled = Object.values(destinations).flat();
    assert.deepEqual([...filled].sort(), wellsToFill().map((end) => `${end.labware} ${end.well}`).sort());
    for (const stage of stageIds) {
      for (const transfer of transfersIn(plan, stage)) {
        assert.equal(transfer.volume, 10);
      }
    }
    // The assignment matches assignPool's with the same pool.
    const assignment = assignPool({
      items: [
        { key: "source 1", replicates: 8 },
        { key: "source 2", replicates: 8 },
        { key: "source 3", replicates: null },
      ],
      filler: "source 3",
      wells: wellsToFill().map((_, index) => `well ${index + 1}`),
      seed: 37,
    });
    const expected = { [stageIds[0]]: [], [stageIds[1]]: [], [stageIds[2]]: [] };
    for (const { well, key } of assignment) {
      const end = wellsToFill()[Number(well.split(" ")[1]) - 1];
      expected[stageIds[Number(key.split(" ")[1]) - 1]].push(`${end.labware} ${end.well}`);
    }
    assert.deepEqual(destinations, expected);
  });

  test("runRandomization: on an exact fit, the filler gets no stage", () => {
    const { plan, id } = setUpRandomization();
    const exact = setRandomization(plan, id, {
      sources: [source("A1", 10), source("A2", 10), source("A3", null, true)],
    });
    const run = runRandomization(exact, id);
    assert.equal(randomizationAt(run, id).stages.length, 2);
  });

  test("running again: nothing changed keeps everything; a new seed shuffles; a new volume keeps the wells", () => {
    const { plan, id } = runRandomizationPlan();
    const again = runRandomization(plan, id);
    assert.deepEqual(randomizationAt(again, id), randomizationAt(plan, id));
    assert.deepEqual(again.operationList.listOperations(), plan.operationList.listOperations());
    assert.deepEqual(again.stageList.listStages(), plan.stageList.listStages());

    const reseeded = runRandomization(setRandomization(plan, id, { seed: 38 }), id);
    assert.deepEqual(randomizationAt(reseeded, id).stages, randomizationAt(plan, id).stages);
    assert.notDeepEqual(destinationsByStage(reseeded, id), destinationsByStage(plan, id));

    // Settings and tips are the stages' own once it has run (2026-11-05, item 20), so only the volume
    // is changed here; "settings on its stages" below covers them.
    const changed = runRandomization(setRandomization(plan, id, { volume: 20 }), id);
    assert.deepEqual(destinationsByStage(changed, id), destinationsByStage(plan, id));
    for (const { stage } of randomizationAt(changed, id).stages) {
      assert.deepEqual(changed.stageList.get(stage).settings, plan.stageList.get(stage).settings);
      assert.ok(transfersIn(changed, stage).every((transfer) => transfer.volume === 20));
    }
  });

  test("a source taken out keeps its stage until the next run; a source added gets a new stage last, on new tips", () => {
    const { plan, id } = runRandomizationPlan();
    const [first, second, third] = randomizationAt(plan, id).stages;
    const withoutA2 = setRandomization(plan, id, {
      sources: [source("A1", 8), source("A3", null, true)],
    });
    assert.equal(randomizationOf(withoutA2, second.stage), id);
    assert.equal(randomizationAt(withoutA2, id).stages.length, 3);
    const rerun = runRandomization(withoutA2, id);
    assert.deepEqual(
      randomizationAt(rerun, id).stages.map((owned) => owned.stage),
      [first.stage, third.stage],
    );
    assert.equal(rerun.stageList.has(second.stage), false);

    const withA4 = setRandomization(rerun, id, {
      sources: [source("A1", 8), source("A3", null, true), source("A4", 2)],
    });
    const added = runRandomization(withA4, id);
    const stages = randomizationAt(added, id).stages;
    assert.equal(stages.length, 3);
    assert.deepEqual(stageOrder(added), ["1", first.stage, third.stage, stages[2].stage, "2"]);
    assert.deepEqual(tipChangeAt(added, stages[2].stage), tipChangeAt(added, first.stage));
    assert.equal(added.stageList.get(stages[2].stage).name, `${DEEP} A4`);
  });

  test("replacing the only source of a randomization whose stage is the plan's only stage runs", () => {
    let { plan } = emptyPlan();
    plan = addRandomization(plan, "1", { seed: 37, volume: 10 }).plan;
    plan = setRandomization(plan, "r1", { sources: [source("A1", 2)], fill: wellsToFill().slice(0, 2) });
    plan = runRandomization(plan, "r1");
    plan = removeStage(plan, "1");
    assert.equal(stageOrder(plan).length, 1);
    plan = setRandomization(plan, "r1", { sources: [source("A2", 2)] });
    const run = runRandomization(plan, "r1");
    assert.equal(stageOrder(run).length, 1);
    assert.equal(randomizationAt(run, "r1").stages[0].well, "A2");
  });

  test("added before the run's first stage: its first stage gets START, set to its tips, and the old first stage its own", () => {
    const plan = setTipProbes(randomizingPlan(), START, [1, 2]);
    const startBefore = tipChangeAt(plan, START);
    const { plan: setUp, id } = setUpRandomization(plan, "1");
    const set = setRandomization(setUp, id, { probes: [1, 2, 3], tipType: TIP_TYPES.at(-1) });
    const run = runRandomization(set, id);
    const stages = randomizationAt(run, id).stages.map((owned) => owned.stage);
    assert.equal(stageOrder(run)[0], stages[0]);
    assert.deepEqual(tipChangeAt(run, START), { tipType: TIP_TYPES.at(-1), probes: [1, 2, 3] });
    assert.deepEqual(tipChangeAt(run, "1"), startBefore);
  });

  test("removeStage moves a randomization sitting before it to the next stage, giving it tips", () => {
    let plan = addStage(randomizingPlan(), null).plan; // stage 3, in stage 2's tip group
    plan = addRandomization(plan, "2", { seed: 37, volume: 10 }).plan;
    const removed = removeStage(plan, "2");
    assert.equal(randomizationAt(removed, "r1").beforeId, "3");
    assert.deepEqual(tipChangeAt(removed, "3"), tipChangeAt(plan, "2"));
    const last = addRandomization(randomizingPlan(), "2", { seed: 37, volume: 10 }).plan;
    assert.equal(randomizationAt(removeStage(last, "2"), "r1").beforeId, null);
  });

  test("removing the stage just after a randomization gives the stage after that its own tips; removeTipChange there throws", () => {
    let plan = addStage(randomizingPlan(), null).plan; // stage 3, in stage 2's tip group
    const { plan: setUp, id } = setUpRandomization(plan);
    plan = runRandomization(setUp, id);
    assert.throws(() => removeTipChange(plan, "2"), {
      message: "This tip change keeps stage 5, “New stage”, off the randomization's tips. A randomization never shares tips with other stages.".replace(
        "stage 5, “New stage”",
        `stage ${stageOrder(plan).indexOf("2") + 1}, “${plan.stageList.get("2").name}”`,
      ),
    });
    const removed = removeStage(plan, "2");
    assert.deepEqual(tipChangeAt(removed, "3"), tipChangeAt(plan, "2"));
    assert.equal(randomizationAt(removed, id).beforeId, "3");
  });

  test("removeTipChange refuses the tips of a stage a randomization that hasn't run sits before", () => {
    const plan = addRandomization(randomizingPlan(), "2", { seed: 37, volume: 10 }).plan;
    assert.throws(() => removeTipChange(plan, "2"), {
      message: "A randomization sits before stage 2, “New stage”, between tip groups, so these tips can't be removed.",
    });
  });

  test("adding a stage that takes the tips of the stage a randomization sits before moves it onto the new stage", () => {
    const plan = addRandomization(randomizingPlan(), "2", { seed: 37, volume: 10 }).plan;
    const { plan: added, id } = addStage(plan, "2", { takeTips: true });
    assert.equal(randomizationAt(added, "r1").beforeId, id);
    const withNewTips = addStageWithNewTips(plan, "2");
    assert.equal(randomizationAt(withNewTips.plan, "r1").beforeId, "2");
  });

  test("a stage added with new tips just after a run randomization becomes its beforeId", () => {
    const { plan, id } = runRandomizationPlan();
    const { plan: added, id: newId } = addStageWithNewTips(plan, "2");
    assert.equal(randomizationAt(added, id).beforeId, newId);
    // So its tips are kept: removing stage 2's tips is now allowed, and the new stage's isn't.
    removeTipChange(added, "2");
    assert.throws(() => removeTipChange(added, newId), /never shares tips with other stages\.$/);
  });

  test("placeRandomization moves one that hasn't run; one that has throws", () => {
    let plan = addStageWithNewTips(randomizingPlan(), null).plan;
    plan = addRandomization(plan, "2", { seed: 37, volume: 10 }).plan;
    const placed = placeRandomization(plan, "r1", "3");
    assert.equal(randomizationAt(placed, "r1").beforeId, "3");
    for (const part of PLAN_PARTS.filter((candidate) => candidate !== "randomizations")) {
      assert.equal(placed[part], plan[part], part);
    }
    assert.equal(placeRandomization(plan, "r1", "2"), plan);
    assert.throws(() => placeRandomization(plan, "r9", "2"), /no randomization "r9"/);
    assert.throws(() => placeRandomization(plan, "r1", "9"), {
      message: `There's no stage "9" to add a randomization before.`,
    });
    const run = runRandomizationPlan();
    assert.throws(() => placeRandomization(run.plan, run.id, "1"), {
      message: "This randomization has run, so it sits where its stages are.",
    });
  });

  test("a randomization can sit before another's first stage, but not before its later stages", () => {
    const { plan, id } = runRandomizationPlan();
    const [first, second] = randomizationAt(plan, id).stages;
    addRandomization(plan, first.stage, { seed: 1, volume: 1 });
    assert.throws(() => addRandomization(plan, second.stage, { seed: 1, volume: 1 }), {
      message: "A randomization's stages stay together: add before its first stage or after its last.",
    });
  });

  test("runRandomization with a problem throws its message, leaving the plan unchanged", () => {
    const { plan, id } = addRandomization(randomizingPlan(), "2", { seed: 37, volume: null });
    const before = snapshot(plan);
    assert.throws(() => runRandomization(plan, id), { message: "Pick at least one source." });
    assert.equal(snapshot(plan), before);
  });

  test("removeRandomization takes out it and its stages; the tips it added stay", () => {
    const { plan: setUp, id } = setUpRandomization();
    assert.equal(canRemoveRandomization(setUp, id), true);
    const unrun = removeRandomization(setUp, id);
    assert.deepEqual(unrun.randomizations, []);
    assert.equal(unrun.stageList, setUp.stageList);

    let plan = addStage(randomizingPlan(), null).plan;
    plan = removeTipChange(plan, "2");
    const run = runRandomization(setUpRandomization(plan, null).plan, "r1");
    const lastBefore = stageOrder(run).at(-1);
    const removed = removeRandomization(run, "r1");
    assert.deepEqual(stageOrder(removed), ["1", "2", "3"]);
    assert.deepEqual(removed.randomizations, []);
    assert.equal(transfersIn(removed, lastBefore).length, 0);
    assert.equal(canRemoveRandomization(removed, "r1"), false);

    // The tip change a run added on the stage after it stays: before the run's first stage, the old
    // first stage got one loading the first tips, which become the first tips again.
    const first = setTipProbes(randomizingPlan(), START, [1, 2]);
    const { plan: before, id: firstId } = setUpRandomization(first, "1");
    const runFirst = runRandomization(setRandomization(before, firstId, { probes: [1] }), firstId);
    assert.deepEqual(tipChangeAt(removeRandomization(runFirst, firstId), START), tipChangeAt(first, START));
  });

  test("removeRandomization throws when its stages are all the plan's stages", () => {
    let { plan } = emptyPlan();
    plan = addRandomization(plan, "1", { seed: 37, volume: 10 }).plan;
    plan = setRandomization(plan, "r1", { sources: [source("A1", 2)], fill: wellsToFill().slice(0, 2) });
    plan = removeStage(runRandomization(plan, "r1"), "1");
    assert.equal(canRemoveRandomization(plan, "r1"), false);
    assert.throws(() => removeRandomization(plan, "r1"), {
      message:
        "This randomization's stages are all the plan's stages, and a plan needs at least one. Add a stage outside it first.",
    });
    assert.throws(() => removeRandomization(plan, "r9"), /no randomization "r9"/);
  });

  // --- Randomization names (2026-11-08) ---

  test("names: new randomizations are Randomization and the smallest free number, capitals aside", () => {
    let { plan } = addRandomization(randomizingPlan(), "2");
    plan = addRandomization(plan, null).plan;
    assert.equal(randomizationAt(plan, "r1").name, "Randomization1");
    assert.equal(randomizationAt(plan, "r2").name, "Randomization2");
    plan = renameRandomization(plan, "r1", "HySoy_dose");
    assert.equal(randomizationAt(addRandomization(plan, null).plan, "r3").name, "Randomization1");
    const lowered = renameRandomization(plan, "r1", "randomization1");
    assert.equal(randomizationAt(addRandomization(lowered, null).plan, "r3").name, "Randomization3");
  });

  test("names: a randomization's name comes right after its ID", () => {
    const { plan, id } = addRandomization(randomizingPlan(), "2");
    assert.deepEqual(Object.keys(randomizationAt(plan, id)).slice(0, 3), ["id", "name", "beforeId"]);
  });

  test("renameRandomization renames one that hasn't run and one that has, changing nothing else", () => {
    const { plan: setUp, id } = setUpRandomization();
    const renamedSetUp = renameRandomization(setUp, id, "HySoy_dose");
    assert.equal(randomizationAt(renamedSetUp, id).name, "HySoy_dose");
    const run = runRandomization(setUp, id);
    const renamed = renameRandomization(run, id, "HySoy_dose");
    assert.deepEqual(randomizationAt(renamed, id), { ...randomizationAt(run, id), name: "HySoy_dose" });
    for (const part of ["stageList", "stageOrder", "operationList", "tipChanges"]) {
      assert.equal(renamed[part], run[part], part);
    }
    assert.equal(isRandomizationOutOfDate(renamed, id), false);
    // The plan is immutable, so undoing is the caller's: the plan before still has the old name.
    assert.equal(randomizationAt(run, id).name, "Randomization1");
  });

  test("renameRandomization gives back the same plan for the same name", () => {
    const { plan, id } = setUpRandomization();
    assert.equal(renameRandomization(plan, id, "Randomization1"), plan);
  });

  test("renameRandomization refuses a name breaking the rule, with a randomization's words", () => {
    const { plan, id } = setUpRandomization();
    const rule = 'Use only letters, digits, hyphens (-) and underscores (_), e.g. "HySoy_dose".';
    const cases = [
      ["AA levels", `A randomization's name can't contain " " (a space). ${rule}`],
      ["", 'Type a name for the randomization, such as "HySoy_dose".'],
      ["   ", 'Type a name for the randomization, such as "HySoy_dose".'],
      ["R".repeat(41), "A randomization's name is 41 characters long; it can be at most 40."],
      ["Drug/A", `A randomization's name can't contain "/". ${rule}`],
      ["µ", `A randomization's name can't contain "µ". ${rule}`],
      [5, `A randomization's name must be text, like "HySoy_dose", but got 5.`],
    ];
    for (const [name, message] of cases) {
      assert.throws(() => renameRandomization(plan, id, name), { message }, String(name));
    }
    assert.throws(() => renameRandomization(plan, "r9", "HySoy_dose"), {
      message: `There's no randomization "r9" in the plan.`,
    });
    // The randomization is checked before the name.
    assert.throws(() => renameRandomization(plan, "r9", "AA levels"), /no randomization "r9"/);
  });

  test("renameRandomization refuses another's name, capitals aside, but allows its own in other capitals", () => {
    let { plan, id } = setUpRandomization();
    plan = renameRandomization(plan, id, "HySoy_dose");
    const second = addRandomization(plan, null);
    plan = second.plan;
    const message = 'Another randomization is already named "HySoy_dose". Choose a different name.';
    assert.throws(() => renameRandomization(plan, second.id, "HySoy_dose"), { message });
    assert.throws(() => renameRandomization(plan, second.id, "hysoy_dose"), { message });
    assert.equal(randomizationAt(renameRandomization(plan, id, "HYSOY_DOSE"), id).name, "HYSOY_DOSE");
  });

  test("pasting: a copy of a named randomization gets a new default name, never the original's", () => {
    let { plan, id } = setUpRandomization();
    plan = renameRandomization(plan, id, "HySoy_dose");
    const end = { kind: "between", index: columnBoxes(plan).length };
    const { plan: pasted, placed } = copyItems(plan, [{ kind: "randomization", id }], end);
    assert.equal(randomizationAt(pasted, placed[0].id).name, "Randomization1");
    assert.equal(copyOf(plan, [{ kind: "randomization", id }]).version, 5);
  });

  test("pasting two randomizations at once into a plan holding Randomization1 gives Randomization2 and Randomization3", () => {
    let { plan, id } = setUpRandomization();
    const second = addRandomization(plan, null);
    plan = renameRandomization(second.plan, second.id, "HySoy_dose");
    const end = { kind: "between", index: columnBoxes(plan).length };
    const items = [
      { kind: "randomization", id },
      { kind: "randomization", id: second.id },
    ];
    const { plan: pasted, placed } = copyItems(plan, items, end);
    const names = placed.map((entry) => randomizationAt(pasted, entry.id).name);
    assert.deepEqual(names, ["Randomization2", "Randomization3"]);
  });

  test("setRandomizations refuses a randomization without a name, a name breaking the rule, and two named alike", () => {
    const { plan, id } = runRandomizationPlan();
    const good = () => JSON.parse(JSON.stringify(randomizationAt(plan, id)));
    const notRun = (name) => ({ ...asNotRun(good()), id: "r2", name, beforeId: null });
    const { name, ...unnamed } = good();
    assert.equal(name, "Randomization1");
    assert.throws(() => setRandomizations(plan, [unnamed]), {
      message: /^Randomization 1 must be an object with exactly "id", "name", "beforeId"/,
    });
    assert.throws(() => setRandomizations(plan, [good(), notRun("AA levels")]), {
      message: /^Randomization 2: A randomization's name can't contain " " \(a space\)\./,
    });
    // The name is checked after the ID and before the values.
    assert.throws(() => setRandomizations(plan, [good(), { ...notRun("AA levels"), id: "x" }]), /ID must be "r"/);
    assert.throws(() => setRandomizations(plan, [good(), { ...notRun("AA levels"), seed: 0 }]), /name can't contain/);
    const third = { ...notRun("Randomization1"), id: "r3" };
    assert.throws(() => setRandomizations(plan, [good(), notRun("HySoy_dose"), third]), {
      message: 'Randomizations 1 and 3 are both named "Randomization1".',
    });
    assert.throws(() => setRandomizations(plan, [good(), notRun("HySoy_dose"), { ...third, name: "RANDOMIZATION1" }]), {
      message:
        'Randomizations 1 and 3 are named "Randomization1" and "RANDOMIZATION1", which differ only in capitals.',
    });
    // IDs repeated are reported before names repeated.
    assert.throws(() => setRandomizations(plan, [good(), { ...notRun("Randomization1"), id: "r1" }]), /both have the ID/);
    const accepted = setRandomizations(plan, [{ ...good(), name: "Randomization7" }, notRun("HySoy_dose")]);
    assert.deepEqual(
      accepted.randomizations.map((randomization) => randomization.name),
      ["Randomization7", "HySoy_dose"],
    );
  });

  test("setRandomizations accepts a plan's own randomizations after running", () => {
    const { plan } = runRandomizationPlan();
    const withSecond = addRandomization(plan, null, { seed: 5, volume: null }).plan;
    const copied = JSON.parse(JSON.stringify(withSecond.randomizations));
    const set = setRandomizations({ ...withSecond, randomizations: [] }, copied);
    assert.deepEqual(set.randomizations, withSecond.randomizations);
  });

  test("setRandomizations accepts a stage whose well was taken out of the sources before a rerun", () => {
    const { plan, id } = runRandomizationPlan();
    const dropped = setRandomization(plan, id, {
      sources: randomizationAt(plan, id).sources.filter((entry) => entry.well !== "A2"),
    });
    const copied = JSON.parse(JSON.stringify(dropped.randomizations));
    assert.ok(copied[0].stages.some((owned) => owned.well === "A2"));
    const set = setRandomizations({ ...dropped, randomizations: [] }, copied);
    assert.deepEqual(set.randomizations, dropped.randomizations);
  });

  test("setRandomizations refuses one sitting before another's second stage, even when loading both at once", () => {
    const { plan, id } = runRandomizationPlan();
    const owner = JSON.parse(JSON.stringify(randomizationAt(plan, id)));
    const sitting = { ...asNotRun(owner), id: "r2", name: "Randomization2", beforeId: owner.stages[1].stage };
    assert.throws(
      () => setRandomizations({ ...plan, randomizations: [] }, [sitting, owner]),
      { message: /^Randomization 1: A randomization sits between tip groups, so it can't go before stage / },
    );
  });

  test("setRandomizations refuses each wrong randomization, prefixed, in its order of checks", () => {
    const { plan, id } = runRandomizationPlan();
    const good = () => JSON.parse(JSON.stringify(randomizationAt(plan, id)));
    const stageIds = good().stages.map((owned) => owned.stage);
    const second = (changes) => [
      good(),
      { ...asNotRun(good()), id: "r2", name: "Randomization2", beforeId: null, ...changes },
    ];
    const cases = [
      [5, "The randomizations must be a list, but got 5."],
      [
        [good(), { ...good(), extra: 1 }],
        'Randomization 2 must be an object with exactly "id", "name", "beforeId", "sources", "fill", "seed", "volume", "settings", "tipType", "probes" and "stages".',
      ],
      [second({ id: "x" }), `Randomization 2's ID must be "r" and a whole number, like "r1", but got "x".`],
      [second({ id: "r0" }), /ID must be "r"/],
      [second({ seed: 0 }), "Randomization 2: A randomization's seed must be a whole number from 1 to 999,999, or null, but got 0."],
      [second({ sources: [source("A1", 1), source("A1", 1)] }), `Randomization 2: ${DEEP} A1 is a source twice. List each source once.`],
      [
        second({ fill: [plateWell("B3"), plateWell("B2")] }),
        `Randomization 2: its wells to fill must be in deck order, but ${PLATE} B3 comes before ${PLATE} B2.`,
      ],
      [second({ probes: [2, 1] }), "Randomization 2: its probes must be listed smallest first."],
      [
        [{ ...good(), stages: [{ stage: stageIds[0] }] }],
        'Randomization 1: its stages must be a list of objects with exactly "labware", "well" and "stage".',
      ],
      [[{ ...good(), stages: [{ ...good().stages[0], stage: "9" }] }], `Randomization 1: its stage "9" isn't in the plan.`],
      [
        [{ ...good(), stages: [good().stages[0], good().stages[0]] }],
        `Randomization 1: stage "${stageIds[0]}" is listed twice.`,
      ],
      [
        [{ ...good(), stages: [good().stages[0], { ...good().stages[0], stage: stageIds[1] }] }],
        `Randomization 1: ${DEEP} ${good().stages[0].well} has two stages.`,
      ],
      [
        [{ ...good(), stages: [good().stages[0], good().stages[2]] }],
        "Randomization 1: its stages must come one after another, in stage order.",
      ],
      [
        [{ ...good(), stages: [good().stages[1], good().stages[0]] }],
        "Randomization 1: its stages must come one after another, in stage order.",
      ],
      [
        [
          good(),
          { ...asNotRun(good()), id: "r2", name: "Randomization2", beforeId: null },
          { ...asNotRun(good()), id: "r2", name: "Randomization3", beforeId: null },
        ],
        'Randomizations 2 and 3 both have the ID "r2".',
      ],
      [
        [good(), { ...good(), id: "r2", name: "Randomization2" }],
        `Stage "${stageIds[0]}" belongs to two randomizations, 1 and 2.`,
      ],
      [second({ beforeId: "9" }), `Randomization 2: There's no stage "9" to add a randomization before.`],
      [second({ beforeId: stageIds[1] }), /^Randomization 2: A randomization sits between tip groups/],
    ];
    for (const [randomizations, message] of cases) {
      assert.throws(
        () => setRandomizations(plan, randomizations),
        { message },
        JSON.stringify(randomizations).slice(0, 80),
      );
    }
    // Sharing no tip group with a stage outside it (its stages may share with each other, since
    // 2026-11-05), and not a mix step.
    const shared = removeTipChange(addStage(randomizingPlan(), null).plan, "2");
    const sharedSetUp = setUpRandomization(shared, "1");
    const sharedRun = runRandomization(sharedSetUp.plan, "r1");
    const owned = randomizationAt(sharedRun, "r1").stages;
    const joined = withParts(sharedRun, { tipChanges: { ...sharedRun.tipChanges } });
    delete joined.tipChanges[owned[1].stage];
    assert.equal(setRandomizations(joined, sharedRun.randomizations).randomizations.length, 1);
    const middle = runRandomizationPlan().plan;
    const middleFirst = randomizationAt(middle, "r1").stages[0].stage;
    const firstShares = withParts(middle, { tipChanges: { ...middle.tipChanges } });
    delete firstShares.tipChanges[middleFirst];
    assert.throws(() => setRandomizations(firstShares, middle.randomizations), {
      message:
        `Randomization 1: stage "${middleFirst}" shares tips with a stage outside the randomization. ` +
        "A randomization never shares tips with other stages.",
    });
    const after = stageOrder(sharedRun)[stageOrder(sharedRun).indexOf(owned.at(-1).stage) + 1];
    const lastShares = withParts(sharedRun, { tipChanges: { ...sharedRun.tipChanges } });
    delete lastShares.tipChanges[after];
    assert.throws(() => setRandomizations(lastShares, sharedRun.randomizations), {
      message:
        `Randomization 1: stage "${owned.at(-1).stage}" shares tips with a stage outside the randomization. ` +
        "A randomization never shares tips with other stages.",
    });
    const asMixStep = changeStageSettings(
      removeTransfersOf(sharedRun, owned[0].stage),
      owned[0].stage,
      mixStepDefaults(),
    );
    assert.throws(() => setRandomizations(asMixStep, sharedRun.randomizations), {
      message: `Randomization 1: stage "${owned[0].stage}" is a mix step.`,
    });
  });

  // A copy of `plan` with `changes`, made directly, for a test that needs a plan the edits would
  // never make.
  function withParts(plan, changes) {
    return { ...plan, ...changes };
  }

  // The plan without stage `stage`'s transfers. A randomization's stage refuses removeTransfer
  // (since 2026-11-05, item 20), so they're removed with the randomizations set aside, then put back:
  // a plan the edits would never make.
  function removeTransfersOf(plan, stage) {
    let without = withParts(plan, { randomizations: [] });
    for (const { position } of transfersIn(plan, stage).reverse()) {
      without = removeTransfer(without, position);
    }
    return withParts(without, { randomizations: plan.randomizations });
  }

  // A randomization `randomization` (as stored) as one that hasn't run: no stages, and first-run
  // settings and tips, which a run randomization holds as null (since 2026-11-05, item 20).
  function asNotRun(randomization) {
    return {
      ...randomization,
      stages: [],
      settings: defaultSettings(),
      tipType: TIP_TYPES[0],
      probes: probesFor(DEFAULT_PROBE_COUNT),
    };
  }

  // --- Several filler wells ---

  // A filler well on the reservoir: trough `well`, replicates null, filler true.
  function fillerTrough(well) {
    return { ...trough(well), replicates: null, filler: true, sharesTips: false };
  }

  // The usable volume each filler trough holds in fillerPlan: µL above the reservoir's dead volume.
  const FILLER_USABLE = 750;

  // The volume of each of fillerPlan's transfers, in µL.
  const FILLER_VOLUME = 100;

  // The 24 wells fillerPlan fills: PLATE's D1 to E12, in deck order.
  function fillerWellsToFill() {
    return [...GRID_96.wellsInBox("D1", "E12")].map(plateWell);
  }

  // randomizingPlan with troughs 2, 3 and 4 each holding Media FILLER_USABLE above the reservoir's
  // dead volume, and a randomization before stage 2 (not run): DEEP A1 at 6 replicates, then
  // troughs 2, 3 and 4 as filler wells, fillerWellsToFill, seed 37, FILLER_VOLUME µL: { plan, id }.
  // So the filler fills 18 wells, shared 7, 7 and 4 (section 6, "Several filler wells").
  function fillerPlan(base = randomizingPlan()) {
    let plan = addToWells(base, [trough("2"), trough("3"), trough("4")], "Media", deadVolumeOf(RESERVOIR) + FILLER_USABLE);
    const added = addRandomization(plan, "2", { seed: 37, volume: FILLER_VOLUME });
    plan = setRandomization(added.plan, added.id, {
      sources: [source("A1", 6), fillerTrough("2"), fillerTrough("3"), fillerTrough("4")],
      fill: fillerWellsToFill(),
    });
    return { plan, id: added.id };
  }

  // fillerPlan, run: { plan, id }.
  function runFillerPlan() {
    const { plan, id } = fillerPlan();
    return { plan: runRandomization(plan, id), id };
  }

  // The plan with trough `well` holding exactly `usable` µL above the reservoir's dead volume, of
  // `component` (Media by default), at the start.
  function withTroughHolding(plan, well, usable, component = "Media") {
    return addToWells(emptyWells(plan, [trough(well)]), [trough(well)], component, deadVolumeOf(RESERVOIR) + usable);
  }

  // The stage of a run randomization whose entry names a well of RESERVOIR (its filler stage), as
  // { labware, well, stage }, or undefined.
  function fillerEntry(plan, id) {
    return randomizationAt(plan, id).stages.find((owned) => owned.labware === RESERVOIR);
  }

  // The source wells of a stage's transfers, in order, as trough numbers, e.g. ["2", "2", "3"].
  function sourceTroughs(plan, stage) {
    return transfersIn(plan, stage).map((transfer) => transfer.source.well);
  }

  // How many of `shares` ([{ index, count }]) each filler well fills, e.g. [7, 7, 4].
  function counts(shares) {
    return shares.map((share) => share.count);
  }

  test("fillerShares: three filler wells each FILLER_USABLE above their dead volume share the filler's wells in order", () => {
    const { plan, id } = fillerPlan();
    const spare = fillerWellsToFill().length - 6;
    const fit = Math.floor(FILLER_USABLE / FILLER_VOLUME);
    assert.deepEqual(fillerShares(plan, id), [
      { index: 1, count: fit },
      { index: 2, count: fit },
      { index: 3, count: spare - 2 * fit },
    ]);
    assert.deepEqual(counts(fillerShares(plan, id)), [7, 7, 4]);
  });

  test("several filler wells: a run makes one filler stage, named, on its own tips, drawing from each in turn", () => {
    const { plan: setUp, id } = fillerPlan();
    const plan = runRandomization(setUp, id);
    const run = randomizationAt(plan, id);
    assert.equal(run.stages.length, 2);
    const [own, filler] = run.stages;
    assert.deepEqual({ labware: own.labware, well: own.well }, deepWell("A1"));
    assert.deepEqual({ labware: filler.labware, well: filler.well }, trough("2"));
    assert.equal(plan.stageList.get(filler.stage).name, "Media");
    assert.equal(tipGroups(plan).find((group) => group.stages.includes(filler.stage)).stages.length, 1);
    const [first, second, last] = counts(fillerShares(setUp, id));
    assert.deepEqual(sourceTroughs(plan, filler.stage), [
      ...Array(first).fill("2"),
      ...Array(second).fill("3"),
      ...Array(last).fill("4"),
    ]);
    // The filler's wells, in fill's order, shared out in that order.
    const fillerDestinations = transfersIn(plan, filler.stage).map((transfer) => transfer.destination.well);
    const inFillOrder = fillerWellsToFill()
      .map((end) => end.well)
      .filter((well) => fillerDestinations.includes(well));
    assert.deepEqual(fillerDestinations, inFillOrder);
    // Running again gives the same transfers.
    const again = runRandomization(plan, id);
    assert.deepEqual(again.operationList.listOperations(), plan.operationList.listOperations());
    assert.deepEqual(randomizationAt(again, id), run);
  });

  test("several filler wells: the pool is the same as with the first filler well alone the filler", () => {
    const { plan: setUp, id } = fillerPlan();
    const several = runRandomization(setUp, id);
    const alone = runRandomization(
      setRandomization(setUp, id, { sources: [source("A1", 6), fillerTrough("2")] }),
      id,
    );
    const wellsOf = (plan) =>
      randomizationAt(plan, id).stages.map(({ stage }) =>
        transfersIn(plan, stage).map((transfer) => transfer.destination.well).sort(),
      );
    assert.deepEqual(wellsOf(several), wellsOf(alone));
  });

  test("fillerShares: under one transfer takes 0, the last takes all the rest, exact fits and rounding", () => {
    const { plan, id } = fillerPlan();
    const spare = fillerWellsToFill().length - 6;
    const fit = Math.floor(FILLER_USABLE / FILLER_VOLUME);
    // Less than one transfer above its dead volume: 0, and the next takes the wells.
    const low = withTroughHolding(plan, "2", FILLER_VOLUME / 2);
    assert.deepEqual(counts(fillerShares(low, id)), [0, fit, spare - fit]);
    // The last takes all the rest, beyond its usable volume: a contents problem on its stage.
    const run = runRandomization(low, id);
    assert.ok(stagesWithContentsProblem(run).has(fillerEntry(run, id).stage));
    // Exactly n transfers gives n, and so does a millionth of a µL under it, from rounding.
    const exact = withTroughHolding(plan, "2", 5 * FILLER_VOLUME);
    assert.equal(fillerShares(exact, id)[0].count, 5);
    const rounded = withTroughHolding(plan, "2", 5 * FILLER_VOLUME - 0.0000005);
    assert.equal(fillerShares(rounded, id)[0].count, 5);
  });

  test("fillerShares: filler wells listed in another order share in that order", () => {
    const { plan: setUp, id } = fillerPlan();
    const spare = fillerWellsToFill().length - 6;
    const fit = Math.floor(FILLER_USABLE / FILLER_VOLUME);
    const plan = withTroughHolding(setUp, "4", 2 * FILLER_VOLUME);
    assert.deepEqual(counts(fillerShares(plan, id)), [fit, fit, spare - 2 * fit]);
    const reordered = setRandomization(plan, id, {
      sources: [source("A1", 6), fillerTrough("4"), fillerTrough("2"), fillerTrough("3")],
    });
    assert.deepEqual(fillerShares(reordered, id), [
      { index: 1, count: 2 },
      { index: 2, count: fit },
      { index: 3, count: spare - 2 - fit },
    ]);
  });

  test("fillerShares: [] with no filler wells; null with no volume or a source's replicates null", () => {
    const { plan, id } = fillerPlan();
    const noFiller = setRandomization(plan, id, { sources: [source("A1", 24)] });
    assert.deepEqual(fillerShares(noFiller, id), []);
    assert.equal(fillerShares(setRandomization(plan, id, { volume: null }), id), null);
    const missing = setRandomization(plan, id, {
      sources: [source("A1", null), fillerTrough("2"), fillerTrough("3")],
    });
    assert.equal(fillerShares(missing, id), null);
  });

  test("fillerShares: an empty filler well takes 0 with no problem; too many replicates gives every share 0; only filler wells share every well", () => {
    const { plan: setUp, id } = fillerPlan();
    const spare = fillerWellsToFill().length - 6;
    const fit = Math.floor(FILLER_USABLE / FILLER_VOLUME);
    const withEmpty = setRandomization(setUp, id, {
      sources: [source("A1", 6), fillerTrough("2"), fillerTrough("7"), fillerTrough("3")],
    });
    assert.deepEqual(counts(fillerShares(withEmpty, id)), [fit, 0, spare - fit]);
    assert.deepEqual(randomizationProblems(withEmpty, id), []);
    const tooMany = setRandomization(setUp, id, { sources: [source("A1", 30), fillerTrough("2"), fillerTrough("3")] });
    assert.deepEqual(counts(fillerShares(tooMany, id)), [0, 0]);
    const onlyFiller = setRandomization(setUp, id, {
      sources: [fillerTrough("2"), fillerTrough("3"), fillerTrough("4")],
    });
    const shares = counts(fillerShares(onlyFiller, id));
    assert.deepEqual(shares, [fit, fit, fillerWellsToFill().length - 2 * fit]);
  });

  test("one liquid: different components or proportions are a problem, last in order; same proportions, or an empty well, aren't", () => {
    let { plan, id } = fillerPlan();
    plan = addComponent(plan, "DMSO", "#f28e2b");
    plan = addComponent(plan, "Buffer", "#76b7b2");
    const message = "The filler wells hold different liquids.";
    const withDmso = addToWells(plan, [trough("3")], "DMSO", 1);
    assert.deepEqual(randomizationProblems(withDmso, id), [message]);
    const withBuffer = withTroughHolding(plan, "4", FILLER_USABLE, "Buffer");
    assert.deepEqual(randomizationProblems(withBuffer, id), [message]);
    // Last in the order of problems.
    assert.deepEqual(randomizationProblems(setRandomization(withBuffer, id, { seed: null, volume: null }), id), [
      "Type a seed.",
      "Set the volume.",
      message,
    ]);
    // The same components in the same proportions at different volumes: one liquid.
    let mixed = addToWells(plan, [trough("2")], "DMSO", (deadVolumeOf(RESERVOIR) + FILLER_USABLE) / 99);
    mixed = withTroughHolding(mixed, "3", FILLER_USABLE / 2);
    mixed = addToWells(mixed, [trough("3")], "DMSO", (deadVolumeOf(RESERVOIR) + FILLER_USABLE / 2) / 99);
    mixed = setRandomization(mixed, id, { sources: [source("A1", 6), fillerTrough("2"), fillerTrough("3")] });
    assert.deepEqual(randomizationProblems(mixed, id), []);
    // A filler well holding nothing beside one holding Media.
    const empty = setRandomization(plan, id, { sources: [source("A1", 6), fillerTrough("7"), fillerTrough("2")] });
    assert.deepEqual(randomizationProblems(empty, id), []);
    assert.throws(() => runRandomization(withDmso, id), { message });
  });

  test("one liquid: the same Media and DMSO mix reached through different transfers is one liquid", () => {
    let { plan, id } = fillerPlan();
    plan = addComponent(plan, "DMSO", "#f28e2b");
    // Trough 2 holds a 99:1 mix at the start; trough 3 gets the same mix from trough 6 in stage 1,
    // so its fractions come from arithmetic and differ from trough 2's only in their last digits.
    // (Only the fractions matter to this check, so these volumes needn't follow the dead volume.)
    plan = emptyWells(plan, [trough("2"), trough("3")]);
    plan = addToWells(plan, [trough("2")], "Media", 2970);
    plan = addToWells(plan, [trough("2")], "DMSO", 30);
    plan = addToWells(plan, [trough("6")], "Media", 3 * 2970);
    plan = addToWells(plan, [trough("6")], "DMSO", 3 * 30);
    plan = addTransfer(plan, { type: "transfer", source: trough("6"), destination: trough("3"), volume: 2900, stage: "1" });
    plan = setRandomization(plan, id, { sources: [source("A1", 6), fillerTrough("2"), fillerTrough("3")] });
    const contents = replay(plan.startingContents, plan.operationList, plan.operationList.listOperations().length);
    assert.notDeepEqual(contents.volumeFractionsOf(RESERVOIR, "2"), contents.volumeFractionsOf(RESERVOIR, "3"));
    assert.deepEqual(randomizationProblems(plan, id), []);
  });

  test("out of date: false before and right after a run; a top-up that changes the shares makes it true until the next run", () => {
    const { plan: setUp, id } = fillerPlan();
    assert.equal(isRandomizationOutOfDate(setUp, id), false);
    const plan = runRandomization(setUp, id);
    assert.equal(isRandomizationOutOfDate(plan, id), false);
    const before = snapshot(plan);
    const toppedUp = addToWells(plan, [trough("2")], "Media", 2 * FILLER_VOLUME);
    assert.equal(isRandomizationOutOfDate(toppedUp, id), true);
    assert.equal(snapshot(plan), before);
    assert.equal(isRandomizationOutOfDate(runRandomization(toppedUp, id), id), false);
    // A top-up that still fits the same transfers.
    const small = addToWells(plan, [trough("2")], "Media", FILLER_VOLUME * 0.3);
    assert.deepEqual(fillerShares(small, id), fillerShares(plan, id));
    assert.equal(isRandomizationOutOfDate(small, id), false);
  });

  test("out of date: another liquid in every filler well (the name), and a problem, make it true; a run renames the stage", () => {
    let { plan, id } = runFillerPlan();
    plan = addComponent(plan, "Buffer", "#76b7b2");
    plan = addComponent(plan, "DMSO", "#f28e2b");
    let buffered = plan;
    for (const well of ["2", "3", "4"]) {
      buffered = withTroughHolding(buffered, well, FILLER_USABLE, "Buffer");
    }
    assert.equal(isRandomizationOutOfDate(buffered, id), true);
    const rerun = runRandomization(buffered, id);
    assert.equal(rerun.stageList.get(fillerEntry(rerun, id).stage).name, "Buffer");
    assert.equal(fillerEntry(rerun, id).stage, fillerEntry(plan, id).stage);
    // A source's stage keeps its name if nothing it holds changed.
    const own = randomizationAt(plan, id).stages[0].stage;
    assert.equal(rerun.stageList.get(own).name, plan.stageList.get(own).name);
    // A problem appears: filler wells holding different liquids.
    assert.equal(isRandomizationOutOfDate(addToWells(plan, [trough("3")], "DMSO", 1), id), true);
  });

  test("renaming on a run: a component renamed makes it out of date; a run renames the stage; one undo brings back the old name", () => {
    const { plan, id } = runFillerPlan();
    const renamed = renameComponent(plan, "Media", "Buffer");
    assert.equal(isRandomizationOutOfDate(renamed, id), true);
    const stage = fillerEntry(plan, id).stage;
    let history = new PlanHistory(renamed);
    history = history.record(runRandomization(renamed, id));
    assert.equal(history.present.stageList.get(stage).name, "Buffer");
    history = history.undo();
    assert.equal(history.present.stageList.get(stage).name, "Media");
  });

  test("the filler stage after changes: the first filler well unmarked keeps it as its own; the filler gets a new one", () => {
    const { plan, id } = runFillerPlan();
    const old = fillerEntry(plan, id).stage;
    const unmarked = setRandomization(plan, id, {
      sources: [source("A1", 6), { ...trough("2"), replicates: 2, filler: false, sharesTips: false }, fillerTrough("3"), fillerTrough("4")],
    });
    const run = runRandomization(unmarked, id);
    const stages = randomizationAt(run, id).stages;
    assert.equal(stages.length, 3);
    assert.equal(stages.find((owned) => owned.labware === RESERVOIR && owned.well === "2").stage, old);
    const newFiller = stages.find((owned) => owned.labware === RESERVOIR && owned.well === "3");
    assert.notEqual(newFiller.stage, old);
    assert.ok(!plan.stageList.has(newFiller.stage));
    assert.deepEqual([...new Set(sourceTroughs(run, newFiller.stage))], ["3", "4"]);
    assert.deepEqual([...new Set(sourceTroughs(run, old))], ["2"]);
  });

  test("the filler stage after changes: a filler well added in front keeps the stage, re-keyed", () => {
    let { plan, id } = runFillerPlan();
    const old = fillerEntry(plan, id).stage;
    plan = addToWells(plan, [trough("5")], "Media", deadVolumeOf(RESERVOIR) + FILLER_USABLE);
    plan = setRandomization(plan, id, {
      sources: [source("A1", 6), fillerTrough("5"), fillerTrough("2"), fillerTrough("3"), fillerTrough("4")],
    });
    const run = runRandomization(plan, id);
    assert.deepEqual(fillerEntry(run, id), { ...trough("5"), stage: old });
    assert.equal(randomizationAt(run, id).stages.length, 2);
    assert.deepEqual([...new Set(sourceTroughs(run, old))], ["5", "2", "3"]);
  });

  test("the filler stage after changes: the first filler well's share 0 keeps the stage, keyed to it, drawing from the others", () => {
    const { plan, id } = runFillerPlan();
    const old = fillerEntry(plan, id).stage;
    const low = withTroughHolding(plan, "2", FILLER_VOLUME / 2);
    const run = runRandomization(low, id);
    assert.deepEqual(fillerEntry(run, id), { ...trough("2"), stage: old });
    assert.deepEqual([...new Set(sourceTroughs(run, old))], ["3", "4"]);
  });

  test("the filler stage's name: the first filler well holding something, or a label", () => {
    const { plan, id } = fillerPlan();
    const emptyFirst = runRandomization(emptyWells(plan, [trough("2")]), id);
    assert.equal(emptyFirst.stageList.get(fillerEntry(emptyFirst, id).stage).name, "Media");
    const labeled = runRandomization(setWellLabel(plan, trough("2"), "Main media"), id);
    assert.equal(labeled.stageList.get(fillerEntry(labeled, id).stage).name, "Main media");
    const allEmpty = runRandomization(emptyWells(plan, [trough("2"), trough("3"), trough("4")]), id);
    assert.equal(allEmpty.stageList.get(fillerEntry(allEmpty, id).stage).name, `${RESERVOIR} 2`);
  });

  test("copying: a run randomization with three filler wells pastes with the same filler wells and one filler stage; version 1 pastes", () => {
    const { plan, id } = runFillerPlan();
    const copied = copyOf(plan, [{ kind: "randomization", id }]);
    assert.equal(copied.version, 5);
    const end = { kind: "between", index: columnBoxes(plan).length };
    const { plan: pasted, placed } = copyItems(plan, [{ kind: "randomization", id }], end);
    const copy = randomizationAt(pasted, placed[0].id);
    assert.deepEqual(copy.sources, randomizationAt(plan, id).sources);
    assert.equal(copy.stages.length, 2);
    const fillerCopy = fillerEntry(pasted, copy.id);
    assert.deepEqual(sourceTroughs(pasted, fillerCopy.stage), sourceTroughs(plan, fillerEntry(plan, id).stage));
    // A version 1 copy pastes as before.
    const { plan: fromVersion1 } = pasteItems(plan, copiedAsVersion(copied, 1), end);
    assert.equal(fromVersion1.randomizations.length, 2);
  });

  // Copied items (copyOf's, version 5) as an older version, 1 or 2, holds them: each randomization's
  // sources without sharesTips, and, as before version 5, a run randomization holding settings and
  // tips: its first stage's, as every run then gave every stage. Its owned stages must all have tips
  // (none sharing).
  function copiedAsVersion(copied, version) {
    const older = JSON.parse(JSON.stringify(copied));
    older.version = version;
    for (const item of older.items.filter((candidate) => candidate.kind === "randomization")) {
      item.randomization.sources = item.randomization.sources.map(({ sharesTips, ...rest }) => rest);
      if (item.stages.length > 0) {
        Object.assign(item.randomization, { settings: item.stages[0].stage.settings, ...item.stages[0].tips });
      }
    }
    return older;
  }

  test("setRandomizations: a filler stage entry naming a filler well that isn't the first is accepted; two filler entries are refused", () => {
    const { plan, id } = runFillerPlan();
    const stored = JSON.parse(JSON.stringify(plan.randomizations));
    stored[0].stages[1].well = "3";
    assert.equal(setRandomizations(plan, stored).randomizations[0].stages[1].well, "3");
    const twoFillerStages = JSON.parse(JSON.stringify(randomizationAt(plan, id)));
    twoFillerStages.sources[0] = { ...source("A1", null), filler: true };
    assert.throws(() => setRandomizations(plan, [twoFillerStages]), {
      message: "Randomization 1: its filler has two stages.",
    });
  });

  test("moving wells with filler wells: a later filler well is in use and moves its transfers only; the first moves the entry", () => {
    const { plan, id } = runFillerPlan();
    const entries = randomizationAt(plan, id).stages;
    assert.equal(isWellUsed(plan, trough("3")), true);
    const movedLater = moveWell(plan, trough("3"), trough("9"));
    assert.deepEqual(randomizationAt(movedLater, id).stages, entries);
    assert.ok(sourceTroughs(movedLater, fillerEntry(plan, id).stage).includes("9"));
    assert.ok(!sourceTroughs(movedLater, fillerEntry(plan, id).stage).includes("3"));
    assert.equal(isRandomizationOutOfDate(movedLater, id), false);
    const movedFirst = moveWell(plan, trough("2"), trough("9"));
    assert.deepEqual(fillerEntry(movedFirst, id), { ...trough("9"), stage: fillerEntry(plan, id).stage });
  });

  test("moving wells with filler wells: onto labware of another dead volume, or an empty source onto other labware, makes it out of date", () => {
    const { plan, id } = runFillerPlan();
    // DEEP's dead volume differs from the reservoir's: trough 3's usable volume and share change.
    assert.notEqual(deadVolumeOf(DEEP), deadVolumeOf(RESERVOIR));
    const ontoDeep = moveWell(plan, trough("3"), deepWell("H1"));
    assert.equal(isRandomizationOutOfDate(ontoDeep, id), true);
    // An empty, unlabeled source is named by its labware and well.
    let { plan: withEmpty } = fillerPlan();
    withEmpty = setRandomization(withEmpty, id, {
      sources: [source("A1", 6), source("H5", 1), fillerTrough("2"), fillerTrough("3"), fillerTrough("4")],
    });
    withEmpty = runRandomization(withEmpty, id);
    assert.equal(isRandomizationOutOfDate(withEmpty, id), false);
    const moved = moveWell(withEmpty, deepWell("H5"), { labware: OTHER_PLATE, well: "H12" });
    assert.equal(isRandomizationOutOfDate(moved, id), true);
  });

  test("two randomizations: updating the first so a later one's filler well holds more makes only the later one out of date", () => {
    let plan = randomizingPlan();
    plan = addToWells(plan, [trough("5"), trough("6")], "Media", deadVolumeOf(RESERVOIR));
    plan = addToWells(plan, [trough("6")], "Media", 3 * FILLER_VOLUME);
    const first = addRandomization(plan, "2", { seed: 3, volume: 5 * FILLER_VOLUME });
    plan = setRandomization(first.plan, first.id, { sources: [{ ...trough("1"), replicates: 1, filler: false, sharesTips: false }], fill: [trough("5")] });
    plan = runRandomization(plan, first.id);
    const second = addRandomization(plan, null, { seed: 4, volume: FILLER_VOLUME });
    plan = setRandomization(second.plan, second.id, {
      sources: [source("A2", 2), fillerTrough("5"), fillerTrough("6")],
      fill: [...GRID_96.wellsInBox("F1", "F10")].map(plateWell),
    });
    plan = runRandomization(plan, second.id);
    assert.deepEqual(counts(fillerShares(plan, second.id)), [5, 3]);
    assert.equal(isRandomizationOutOfDate(plan, second.id), false);
    const updated = runRandomization(setRandomization(plan, first.id, { volume: 8 * FILLER_VOLUME }), first.id);
    assert.equal(isRandomizationOutOfDate(updated, first.id), false);
    assert.equal(isRandomizationOutOfDate(updated, second.id), true);
  });

  test("out of date: after its filler stage is removed, it's out of date, without throwing", () => {
    const { plan, id } = runFillerPlan();
    // removeStage refuses an owned stage since 2026-11-05 (item 20), so it's removed with the
    // randomizations set aside: a plan the edits no longer make, kept as a check that nothing throws.
    const withoutRandomizations = removeStage(withParts(plan, { randomizations: [] }), fillerEntry(plan, id).stage);
    const removed = withParts(withoutRandomizations, { randomizations: plan.randomizations });
    assert.equal(isRandomizationOutOfDate(removed, id), true);
  });

  test("the filler stage after changes: two replicate sources made fillers keep one stage", () => {
    let { plan, id } = fillerPlan();
    const taking = (well) => ({ ...trough(well), replicates: 9, filler: false, sharesTips: false });
    const takers = [source("A1", 6), taking("2"), taking("3")];
    plan = runRandomization(setRandomization(plan, id, { sources: takers }), id);
    const [, second, third] = randomizationAt(plan, id).stages;
    const fillers = [source("A1", 6), fillerTrough("2"), fillerTrough("3")];
    plan = setRandomization(plan, id, { sources: fillers });
    const run = runRandomization(plan, id);
    const stages = randomizationAt(run, id).stages;
    assert.equal(stages.length, 2);
    assert.deepEqual(fillerEntry(run, id), second);
    assert.equal(run.stageList.has(third.stage), false);
    assert.equal(isRandomizationOutOfDate(run, id), false);
  });

  test("the filler stage after changes: an exact fit leaves only the replicate source's", () => {
    const { plan, id } = runFillerPlan();
    const old = fillerEntry(plan, id).stage;
    const exact = setRandomization(plan, id, {
      sources: [
        source("A1", fillerWellsToFill().length),
        fillerTrough("2"),
        fillerTrough("3"),
        fillerTrough("4"),
      ],
    });
    const run = runRandomization(exact, id);
    assert.deepEqual(
      randomizationAt(run, id).stages.map(({ labware, well }) => ({ labware, well })),
      [deepWell("A1")],
    );
    assert.equal(run.stageList.has(old), false);
  });

  test("out of date: a new volume not yet run, or an entry keyed to another filler well", () => {
    const { plan, id } = runFillerPlan();
    // A smaller volume that still fits the same whole transfers in each filler well, so only the
    // transfers' volume differs.
    const fit = Math.floor(FILLER_USABLE / FILLER_VOLUME);
    const revolumed = setRandomization(plan, id, { volume: FILLER_USABLE / (fit + 0.9) });
    assert.deepEqual(fillerShares(revolumed, id), fillerShares(plan, id));
    assert.equal(isRandomizationOutOfDate(revolumed, id), true);
    // Only the entry's source well differs: the same name and transfers, keyed to trough 3.
    const stored = JSON.parse(JSON.stringify(plan.randomizations));
    stored[0].stages.find((owned) => owned.labware === RESERVOIR).well = "3";
    assert.equal(isRandomizationOutOfDate(setRandomizations(plan, stored), id), true);
  });

  test("pasting a randomization with two entries naming filler wells is refused", () => {
    const { plan, id } = runFillerPlan();
    const copied = copyOf(plan, [{ kind: "randomization", id }]);
    copied.items[0].randomization.sources[0] = { ...source("A1", null), filler: true };
    assert.throws(() => pasteItems(plan, copied, { kind: "between", index: 0 }), {
      message: "Can't paste: item 1: its filler has two stages.",
    });
  });

  test("fillerShares and isRandomizationOutOfDate throw for an unknown randomization", () => {
    const { plan } = fillerPlan();
    for (const action of [() => fillerShares(plan, "r9"), () => isRandomizationOutOfDate(plan, "r9")]) {
      assert.throws(action, { message: `There's no randomization "r9" in the plan.` });
    }
  });

  // --- Sharing tips (2026-11-05; transfer-designer.md, section 3, "Sharing tips") ---

  // The regression fixture (tests/fixtures/shared-tips/README.md): a randomized plan saved before
  // shared tips was built, and the Biomek files it gave then.
  const SHARED_TIPS_FIXTURE = new URL("../../../tests/fixtures/shared-tips/", import.meta.url);

  // The fixture's timestamp: the one its Biomek files were written with.
  const FIXTURE_TIMESTAMP = new Date(2026, 10, 5, 9, 30, 0);

  // The fixture's plan, opened with planFromText.
  function fixturePlan() {
    return planFromText(readFileSync(new URL("randomized-plan-v9.json", SHARED_TIPS_FIXTURE), "utf8"));
  }

  // The text of one of the fixture's Biomek files, e.g. fixtureFile("Stages.csv").
  function fixtureFile(name) {
    return readFileSync(new URL(`biomek-files-before/${name}`, SHARED_TIPS_FIXTURE), "utf8");
  }

  // The names of the fixture's Biomek files, in the order writeRunFiles gave them.
  const FIXTURE_FILE_NAMES = [
    "Setup.csv",
    "Stages.csv",
    ...["01", "02", "03", "04", "05", "06"].map((number) => `Stage${number}_A.csv`),
  ];

  // Stages.csv's rows (CRLF line endings), each as its fields' text, without the header and the
  // empty text after the last line ending. The fields this test reads (NewTip, TipType, LoadProbes,
  // TransferFile) come before any quoted field holding a comma except LoadProbes, which is read
  // whole.
  function stageRows(text) {
    return text
      .split("\r\n")
      .slice(1, -1)
      .map((line) => {
        const match = /^(\d),([^,]*),("[^"]*"|[^,]*),([^,]*),/.exec(line);
        return { line, newTip: match[1], tipType: match[2], loadProbes: match[3], transferFile: match[4] };
      });
  }

  test("regression fixture: the opened plan gives exactly the captured Biomek files", () => {
    const { files } = writeRunFiles(fixturePlan(), FIXTURE_TIMESTAMP);
    assert.deepEqual(files.map((file) => file.name), FIXTURE_FILE_NAMES);
    for (const file of files) {
      assert.equal(file.text, fixtureFile(file.name), file.name);
    }
  });

  test("regression fixture: Update with nothing changed gives exactly the captured Biomek files again", () => {
    const plan = fixturePlan();
    assert.equal(isRandomizationOutOfDate(plan, "r1"), false);
    const { files } = writeRunFiles(runRandomization(plan, "r1"), FIXTURE_TIMESTAMP);
    assert.deepEqual(files.map((file) => file.name), FIXTURE_FILE_NAMES);
    for (const file of files) {
      assert.equal(file.text, fixtureFile(file.name), file.name);
    }
  });

  test("regression fixture: with Deep1 A2 sharing Deep1 A1's tips, one tip-change row goes and nothing else changes", () => {
    const plan = fixturePlan();
    const sources = randomizationAt(plan, "r1").sources.map((entry, index) =>
      index === 1 ? { ...entry, sharesTips: true } : entry,
    );
    assert.equal(sources[1].well, "A2");
    const shared = runRandomization(setRandomization(plan, "r1", { sources }), "r1");
    const { files } = writeRunFiles(shared, FIXTURE_TIMESTAMP);
    const rows = stageRows(files.find((file) => file.name === "Stages.csv").text);
    const before = stageRows(fixtureFile("Stages.csv"));
    // Deep1 A1's and A2's Transfer From File files, named by their stages' places among the stages
    // with transfers.
    const withTransfers = stageOrder(shared).filter((id) => transfersIn(shared, id).length > 0);
    // The Transfer From File file of the stage for Deep1 `well`, e.g. "Stage02_A.csv".
    const fileOf = (well) => {
      const { stage } = randomizationAt(shared, "r1").stages.find((owned) => owned.well === well);
      return `Stage${String(withTransfers.indexOf(stage) + 1).padStart(2, "0")}_A.csv`;
    };
    const first = rows.findIndex((row) => row.transferFile.endsWith(`\\${fileOf("A1")}`));
    const beforeFirst = before.findIndex((row) => row.transferFile.endsWith(`\\${fileOf("A1")}`));
    // Exactly one tip-change row, as in the fixture, then the two stages' transfer rows.
    assert.equal(rows[first - 1].newTip, "1");
    assert.deepEqual(
      [rows[first - 1].tipType, rows[first - 1].loadProbes],
      [before[beforeFirst - 1].tipType, before[beforeFirst - 1].loadProbes],
    );
    assert.equal(rows[first].newTip, "0");
    assert.equal(rows[first + 1].newTip, "0");
    assert.ok(rows[first + 1].transferFile.endsWith(`\\${fileOf("A2")}`));
    // How many of `list`'s rows are tip changes.
    const tipChanges = (list) => list.filter((row) => row.newTip === "1").length;
    assert.equal(tipChanges(rows), tipChanges(before) - 1);
    // Every transfer row and Transfer From File file as in the fixture.
    // The text of `list`'s transfer rows, in order.
    const transferRows = (list) => list.filter((row) => row.newTip === "0").map((row) => row.line);
    assert.deepEqual(transferRows(rows), transferRows(before));
    assert.deepEqual(files.map((file) => file.name), FIXTURE_FILE_NAMES);
    for (const file of files.filter((candidate) => candidate.name.startsWith("Stage0"))) {
      assert.equal(file.text, fixtureFile(file.name), file.name);
    }
  });

  // A list of sources for the list functions, from a picture of its groups, e.g. "A B | C D": A and
  // B share tips, C starts new tips and D shares them. Each source is { name, sharesTips }.
  function sourceList(picture) {
    return picture.split(" | ").flatMap((group) =>
      group.split(" ").map((name, place) => ({ name, sharesTips: place > 0 })),
    );
  }

  // The picture of a list of sources (sourceList's form), e.g. "A B | C D"; a first source sharing
  // tips is shown with a "+" before it.
  function pictureOf(sources) {
    return sources
      .map((entry, index) => `${index > 0 && !entry.sharesTips ? "| " : ""}${index === 0 && entry.sharesTips ? "+" : ""}${entry.name}`)
      .join(" ");
  }

  // A list of four sources whose first shares tips, as a caller's list might hold it: "+A B | C D".
  function firstSharingList() {
    const list = sourceList("A B | C D");
    return [{ ...list[0], sharesTips: true }, ...list.slice(1)];
  }

  test("sourceGroups: none, mixed sharing, every source on new tips, and a first source sharing", () => {
    assert.deepEqual(sourceGroups([]), []);
    const shares = [false, true, true, false, true];
    assert.deepEqual(
      sourceGroups(shares.map((sharesTips) => ({ sharesTips }))),
      [[0, 1, 2], [3, 4]],
    );
    assert.deepEqual(sourceGroups(sourceList("A | B | C")), [[0], [1], [2]]);
    assert.deepEqual(sourceGroups(firstSharingList()), [[0, 1], [2, 3]]);
  });

  test("sourceGroups refuses what isn't a list of sources, naming the list or the first wrong entry", () => {
    // The message for a list that isn't one of sources, naming `got`.
    const message = (got) =>
      `The sources must be a list of objects, each with "sharesTips" true or false, but got ${got}.`;
    assert.throws(() => sourceGroups(5), { message: message("5") });
    assert.throws(() => sourceGroups([{ sharesTips: false }, { sharesTips: "yes" }]), { message: message("an object") });
    assert.throws(() => sourceGroups([{ sharesTips: false }, null]), { message: message("null") });
  });

  test("setSourceSharesTips: joining, splitting, an unchanged value, and what's kept", () => {
    const list = sourceList("A B | C D | E");
    assert.equal(pictureOf(setSourceSharesTips(list, 2, true)), "A B C D | E");
    assert.equal(pictureOf(setSourceSharesTips(list, 1, false)), "A | B | C D | E");
    assert.equal(pictureOf(setSourceSharesTips(list, 3, false)), "A B | C | D | E");
    assert.equal(setSourceSharesTips(list, 1, true), list);
    assert.equal(setSourceSharesTips(list, 0, false), list);
    // Entries whose value didn't change are the same objects; other properties are kept.
    const withText = list.map((entry) => ({ ...entry, replicatesText: "4" }));
    const joined = setSourceSharesTips(withText, 2, true);
    assert.deepEqual(joined.map((entry, index) => entry === withText[index]), [true, true, false, true, true]);
    assert.deepEqual(joined[2], { name: "C", sharesTips: true, replicatesText: "4" });
    assert.deepEqual(withText[2].sharesTips, false);
  });

  test("setSourceSharesTips refuses, in order: the list, the index, the value, the first source sharing", () => {
    const list = sourceList("A | B");
    assert.throws(() => setSourceSharesTips(5, 9, "yes"), { message: /^The sources must be a list of objects/ });
    assert.throws(() => setSourceSharesTips(list, 9, "yes"), {
      message: "There's no source at index 9: the list has 2 sources (indexes 0 to 1).",
    });
    assert.throws(() => setSourceSharesTips(list, 0, "yes"), {
      message: 'Whether a source shares tips must be true or false, but got "yes".',
    });
    assert.throws(() => setSourceSharesTips(list, 0, true), {
      message:
        "The first source always starts on new tips, so it can't share tips: a randomization never shares tips with stages outside it.",
    });
  });

  test("no source at an index: setSourceSharesTips and moveSource give each form of the message", () => {
    const cases = [
      [sourceList("A | B | C | D"), 7, "There's no source at index 7: the list has 4 sources (indexes 0 to 3)."],
      [sourceList("A"), 1, "There's no source at index 1: the list has 1 source (index 0)."],
      [[], 0, "There's no source at index 0: the list has no sources."],
    ];
    for (const [list, index, message] of cases) {
      assert.throws(() => setSourceSharesTips(list, index, false), { message });
      assert.throws(() => moveSource(list, index, { kind: "between", index: 0 }), { message });
    }
  });

  test("moveSource: the specification's three examples", () => {
    const list = sourceList("A B | C D");
    assert.equal(pictureOf(moveSource(list, 3, { kind: "inGroup", index: 0, position: 1 })), "A D B | C");
    assert.equal(pictureOf(moveSource(list, 0, { kind: "between", index: 2 })), "B | C D | A");
    assert.deepEqual(sourceGroups(moveSource(list, 0, { kind: "between", index: 2 })), [[0], [1, 2], [3]]);
    assert.equal(pictureOf(moveSource(list, 2, { kind: "inGroup", index: 0, position: 0 })), "C A B | D");
  });

  test("moveSource between groups: at each index the source gets new tips of its own", () => {
    const list = sourceList("A B | C D | E");
    assert.equal(pictureOf(moveSource(list, 3, { kind: "between", index: 0 })), "D | A B | C | E");
    assert.equal(pictureOf(moveSource(list, 1, { kind: "between", index: 1 })), "A | B | C D | E");
    assert.equal(pictureOf(moveSource(list, 0, { kind: "between", index: 3 })), "B | C D | E | A");
  });

  test("moveSource into a group: at its top it starts the group and the old first shares; elsewhere it shares", () => {
    const list = sourceList("A B | C D | E");
    assert.equal(pictureOf(moveSource(list, 4, { kind: "inGroup", index: 1, position: 0 })), "A B | E C D");
    assert.equal(pictureOf(moveSource(list, 4, { kind: "inGroup", index: 1, position: 1 })), "A B | C E D");
    assert.equal(pictureOf(moveSource(list, 4, { kind: "inGroup", index: 1, position: 2 })), "A B | C D E");
    assert.equal(pictureOf(moveSource(list, 0, { kind: "inGroup", index: 2, position: 1 })), "B | C D | E A");
  });

  test("moveSource: a group's first moved away hands its tips to the next; its only source leaves no empty group", () => {
    const list = sourceList("A B | C D | E");
    assert.equal(pictureOf(moveSource(list, 2, { kind: "inGroup", index: 0, position: 2 })), "A B C | D | E");
    const moved = moveSource(list, 4, { kind: "inGroup", index: 0, position: 1 });
    assert.equal(pictureOf(moved), "A E B | C D");
    assert.equal(sourceGroups(moved).length, 2);
  });

  test("moveSource to the very top gives it new tips, and the old first keeps its own", () => {
    const moved = moveSource(sourceList("A B | C"), 2, { kind: "between", index: 0 });
    assert.equal(pictureOf(moved), "C | A B");
  });

  test("moveSource: a place pointing at the moved source gives the same list", () => {
    const list = sourceList("A B | C | D E");
    assert.equal(moveSource(list, 1, { kind: "inGroup", index: 0, position: 1 }), list);
    assert.equal(moveSource(list, 1, { kind: "inGroup", index: 0, position: 2 }), list);
    assert.equal(moveSource(list, 0, { kind: "inGroup", index: 0, position: 0 }), list);
    assert.equal(moveSource(list, 2, { kind: "between", index: 1 }), list);
    assert.equal(moveSource(list, 2, { kind: "between", index: 2 }), list);
    assert.equal(moveSource(list, 2, { kind: "inGroup", index: 1, position: 0 }), list);
    assert.equal(moveSource(list, 2, { kind: "inGroup", index: 1, position: 1 }), list);
  });

  test("moveSource: a move that changes only sharesTips isn't the same list", () => {
    const list = sourceList("A | B C");
    const moved = moveSource(list, 1, { kind: "between", index: 1 });
    assert.notEqual(moved, list);
    assert.equal(pictureOf(moved), "A | B | C");
    assert.equal(moved[0], list[0]);
    assert.equal(moved[1], list[1]);
  });

  test("moveSource refuses, in order: the list, the index, the place's form and range, its position", () => {
    const list = sourceList("A B | C D");
    assert.throws(() => moveSource(5, 9, null), { message: /^The sources must be a list of objects/ });
    assert.throws(() => moveSource(list, 9, null), { message: "There's no source at index 9: the list has 4 sources (indexes 0 to 3)." });
    for (const place of [null, { kind: "between", index: 9 }, { kind: "inGroup", index: 2, position: 0 }, { kind: "inTipGroup", index: 0, position: 0 }, { kind: "between", index: -1 }]) {
      assert.throws(() => moveSource(list, 0, place), {
        message: `The place must be between source groups (index 0 to 2) or inside one, but got ${JSON.stringify(place)}.`,
      });
    }
    assert.throws(() => moveSource(list, 0, { kind: "inGroup", index: 1, position: 5 }), {
      message: "Source group 1 has positions 0 to 2, but got 5.",
    });
  });

  test("removeSources: a group's first hands its tips on, a whole group goes, the list's first, and none", () => {
    const list = sourceList("A B C | D E | F");
    assert.equal(pictureOf(removeSources(list, [3])), "A B C | E | F");
    assert.equal(pictureOf(removeSources(list, [4, 3])), "A B C | F");
    assert.equal(pictureOf(removeSources(list, [0])), "B C | D E | F");
    assert.equal(pictureOf(removeSources(list, [0, 1])), "C | D E | F");
    assert.equal(pictureOf(removeSources(list, [1, 5])), "A C | D E");
    assert.equal(removeSources(list, []), list);
    const removed = removeSources(list, [4]);
    assert.equal(removed[0], list[0]);
  });

  test("removeSources refuses indexes that aren't the list's, each once, with each form of the message", () => {
    const four = sourceList("A B | C D");
    assert.throws(() => removeSources(four, [1, 1]), {
      message: "The sources to remove must be a list of indexes from 0 to 3, each once, but got [1, 1].",
    });
    assert.throws(() => removeSources(four, 1), {
      message: "The sources to remove must be a list of indexes from 0 to 3, each once, but got 1.",
    });
    assert.throws(() => removeSources(sourceList("A"), [1]), {
      message: "The sources to remove must be a list of index 0, at most once, but got [1].",
    });
    assert.throws(() => removeSources([], [0]), { message: "There are no sources to remove, but got [0]." });
    assert.throws(() => removeSources(5, [0]), { message: /^The sources must be a list of objects/ });
  });

  test("the first source made false: each list function given a first source sharing gives a new list", () => {
    for (const result of [
      (list) => setSourceSharesTips(list, 1, true),
      (list) => moveSource(list, 1, { kind: "inGroup", index: 0, position: 1 }),
      (list) => removeSources(list, []),
    ]) {
      const list = firstSharingList();
      const made = result(list);
      assert.notEqual(made, list);
      assert.notEqual(made[0], list[0]);
      assert.deepEqual(made[0], { name: "A", sharesTips: false });
      assert.deepEqual(made.slice(1).map((entry, index) => entry === list[index + 1]), [true, true, true]);
    }
  });

  // The tips the shared-tips plan's randomization loads: the last tip type, on the first two probes,
  // so they can be told from the START tips where the configuration allows.
  function sharingTips() {
    return { tipType: TIP_TYPES.at(-1), probes: [1, 2] };
  }

  // randomizingPlan with DEEP A4 holding Drug A at a second concentration (half Drug A, half Media),
  // and a randomization sitting before stage `beforeId`, set up with A1, A2 and A3 at 4 replicates and
  // A4 the filler, each source's sharesTips from `shares`, the 20 wells to fill, seed 37, 10 µL and
  // sharingTips(): { plan, id }.
  function sharingPlan(shares = [false, true, true, false], { beforeId = "2", base = randomizingPlan() } = {}) {
    let plan = addToWells(base, [deepWell("A4")], "Drug A", capacityOf(DEEP) / 2);
    plan = addToWells(plan, [deepWell("A4")], "Media", capacityOf(DEEP) / 2);
    const { plan: added, id } = addRandomization(plan, beforeId, { seed: 37, volume: 10 });
    const set = setRandomization(added, id, {
      sources: [
        source("A1", 4, false, shares[0]),
        source("A2", 4, false, shares[1]),
        source("A3", 4, false, shares[2]),
        source("A4", null, true, shares[3]),
      ],
      fill: wellsToFill(),
      ...sharingTips(),
    });
    return { plan: set, id };
  }

  // The stage a run randomization made for its source `well` on DEEP, e.g. "4".
  function stageFor(plan, id, well) {
    return randomizationAt(plan, id).stages.find((owned) => owned.well === well).stage;
  }

  test("a run with shared tips: one tip group for A1 to A3, the filler's alone, nothing outside joined", () => {
    const { plan: setUp, id } = sharingPlan();
    const plan = runRandomization(setUp, id);
    const stages = randomizationAt(plan, id).stages.map((owned) => owned.stage);
    assert.deepEqual(randomizationAt(plan, id).stages.map((owned) => owned.well), ["A1", "A2", "A3", "A4"]);
    assert.deepEqual(tipChangeAt(plan, stages[0]), sharingTips());
    assert.equal(tipChangeAt(plan, stages[1]), null);
    assert.equal(tipChangeAt(plan, stages[2]), null);
    assert.deepEqual(tipChangeAt(plan, stages[3]), sharingTips());
    const groups = tipGroups(plan);
    assert.deepEqual(groups.map((group) => group.stages), [["1"], stages.slice(0, 3), [stages[3]], ["2"]]);
    const box = columnBoxes(plan).find((candidate) => candidate.kind === "randomization");
    assert.deepEqual(box.tipGroups.map((group) => group.stages), [stages.slice(0, 3), [stages[3]]]);
    assert.deepEqual(tipChangeAt(plan, "2"), tipChangeAt(setUp, "2"));
    assert.deepEqual(tipChangeAt(plan, START), tipChangeAt(setUp, START));
  });

  test("tipsUsed: a run whose sources A1 to A3 share tips counts that group's tips once", () => {
    const { tipType, probes } = sharingTips();
    // How many tips of the randomization's tip type `planned` uses.
    const countOf = (planned) => tipsUsed(planned).find((entry) => entry.tipType === tipType)?.count ?? 0;
    // How many tips running the randomization set up with `shares` adds to that count.
    const addedByRun = (shares) => {
      const { plan, id } = sharingPlan(shares);
      return countOf(runRandomization(plan, id)) - countOf(plan);
    };
    assert.equal(addedByRun([false, true, true, false]), 2 * probes.length);
    assert.equal(addedByRun([false, false, false, false]), 4 * probes.length);
  });

  test("the filler's place: its stage is in its first filler well's group, at its place", () => {
    // The first filler well sharing the tips of the source above it.
    let { plan, id } = sharingPlan([false, false, false, true]);
    plan = runRandomization(plan, id);
    assert.equal(tipChangeAt(plan, stageFor(plan, id, "A4")), null);
    // A later filler well marked as sharing: the filler's stage is unchanged, and the source after
    // it (sharing) is in the filler's group.
    let withTwo = addToWells(randomizingPlan(), [trough("2"), trough("3")], "Media", capacityOf(RESERVOIR));
    withTwo = addToWells(withTwo, [deepWell("A4")], "Drug A", capacityOf(DEEP));
    const added = addRandomization(withTwo, "2", { seed: 37, volume: 10 });
    // The sources, trough 3's sharesTips being `shares`.
    const sources = (shares) => [
      source("A1", 4),
      { ...fillerTrough("2"), sharesTips: false },
      { ...fillerTrough("3"), sharesTips: shares },
      source("A4", 4, false, true),
    ];
    // The plan run with sources(shares).
    const run = (shares) =>
      runRandomization(setRandomization(added.plan, added.id, { sources: sources(shares), fill: wellsToFill() }), added.id);
    // Trough 3 starting a group of its own: A4, sharing trough 3's tips, starts them, since trough 3
    // has no stage. Trough 3 sharing: A4 is in the filler's group, sharing its tips.
    const apart = run(false);
    const together = run(true);
    // The filler's stage in `planned`.
    const fillerOf = (planned) => fillerEntry(planned, added.id).stage;
    assert.deepEqual(randomizationAt(apart, added.id).stages.map((owned) => owned.well), ["A1", "2", "A4"]);
    assert.deepEqual(randomizationAt(together, added.id).stages, randomizationAt(apart, added.id).stages);
    for (const planned of [apart, together]) {
      assert.notEqual(tipChangeAt(planned, fillerOf(planned)), null);
    }
    assert.deepEqual(stagesById(together), stagesById(apart));
    assert.notEqual(tipChangeAt(apart, stageFor(apart, added.id, "A4")), null);
    assert.equal(tipChangeAt(together, stageFor(together, added.id, "A4")), null);
  });

  test("the filler's place on an exact fit: the group's first stage that exists starts its tips", () => {
    const exactFill = wellsToFill().slice(0, 12);
    // The filler sharing A2's tips, and A3 sharing the filler's: A2 and A3 share.
    let { plan, id } = sharingPlan([false, false, true, true]);
    plan = runRandomization(setRandomization(plan, id, { fill: exactFill }), id);
    assert.deepEqual(randomizationAt(plan, id).stages.map((owned) => owned.well), ["A1", "A2", "A3"]);
    assert.notEqual(tipChangeAt(plan, stageFor(plan, id, "A2")), null);
    assert.equal(tipChangeAt(plan, stageFor(plan, id, "A3")), null);
    // A filler with no stage at the start of a group: the group's next stage starts its tips.
    let reordered = sharingPlan([false, false, false, false]);
    plan = setRandomization(reordered.plan, reordered.id, {
      sources: [source("A1", 4), source("A4", null, true), source("A2", 4, false, true), source("A3", 4)],
      fill: exactFill,
    });
    plan = runRandomization(plan, reordered.id);
    assert.deepEqual(randomizationAt(plan, reordered.id).stages.map((owned) => owned.well), ["A1", "A2", "A3"]);
    for (const well of ["A1", "A2", "A3"]) {
      assert.deepEqual(tipChangeAt(plan, stageFor(plan, reordered.id, well)), sharingTips(), well);
    }
  });

  test("tipSetsToMake: shared, unshared, an exact fit, a problem, before and after a run, and r9", () => {
    const shared = sharingPlan();
    const before = snapshot(shared.plan);
    assert.equal(tipSetsToMake(shared.plan, shared.id), 2);
    assert.equal(snapshot(shared.plan), before);
    assert.equal(tipSetsToMake(runRandomization(shared.plan, shared.id), shared.id), 2);
    const apart = sharingPlan([false, false, false, false]);
    assert.equal(tipSetsToMake(apart.plan, apart.id), 4);
    const exact = setRandomization(shared.plan, shared.id, { fill: wellsToFill().slice(0, 12) });
    assert.equal(tipSetsToMake(exact, shared.id), 1);
    const a3Apart = sharingPlan([false, true, false, false]);
    assert.equal(tipSetsToMake(a3Apart.plan, a3Apart.id), 3);
    assert.equal(tipSetsToMake(setRandomization(shared.plan, shared.id, { seed: null }), shared.id), null);
    assert.throws(() => tipSetsToMake(shared.plan, "r9"), { message: `There's no randomization "r9" in the plan.` });
  });

  test("rerunning with new sharing: out of date, a run takes out or gives back A2's tips, each one undo", () => {
    const { plan: setUp, id } = sharingPlan([false, false, false, false]);
    const plan = runRandomization(setUp, id);
    const a2 = stageFor(plan, id, "A2");
    assert.notEqual(tipChangeAt(plan, a2), null);
    const sharing = setRandomization(plan, id, {
      sources: setSourceSharesTips(randomizationAt(plan, id).sources, 1, true),
    });
    assert.equal(isRandomizationOutOfDate(sharing, id), true);
    const shared = runRandomization(sharing, id);
    assert.equal(tipChangeAt(shared, a2), null);
    assert.equal(isRandomizationOutOfDate(shared, id), false);
    assert.deepEqual(stagesById(shared), stagesById(plan));
    assert.deepEqual(randomizationAt(shared, id).stages, randomizationAt(plan, id).stages);
    const apart = setRandomization(shared, id, {
      sources: setSourceSharesTips(randomizationAt(shared, id).sources, 1, false),
    });
    assert.equal(isRandomizationOutOfDate(apart, id), true);
    const apartRun = runRandomization(apart, id);
    assert.deepEqual(tipChangeAt(apartRun, a2), sharingTips());
    let history = new PlanHistory(plan);
    history = history.record(shared);
    history = history.record(apartRun);
    assert.equal(history.undo().present, shared);
    assert.equal(history.undo().undo().present, plan);
  });

  test("reordering: out of date; a run puts the stages in the new order where the first was, with the reordered pool's wells", () => {
    let { plan, id } = runRandomizationPlan();
    // A randomization that hasn't run, sitting before the run one's first stage.
    const sitting = addRandomization(plan, randomizationAt(plan, id).stages[0].stage, { seed: 1, volume: 1 });
    plan = sitting.plan;
    const [a1, a2, a3] = randomizationAt(plan, id).sources;
    const reordered = setRandomization(plan, id, { sources: [a3, a1, a2] });
    assert.equal(isRandomizationOutOfDate(reordered, id), true);
    const run = runRandomization(reordered, id);
    // The stage for DEEP `well` in `planned`.
    const stageOf = (planned, well) => stageFor(planned, id, well);
    const ids = ["A3", "A1", "A2"].map((well) => stageOf(plan, well));
    assert.deepEqual(randomizationAt(run, id).stages.map((owned) => owned.stage), ids);
    assert.deepEqual(stageOrder(run), ["1", ...ids, "2"]);
    assert.deepEqual(blocksOf(run), stageOrder(run).filter((stage) => transfersIn(run, stage).length > 0));
    assert.deepEqual(tipChangeAt(run, "2"), tipChangeAt(plan, "2"));
    assert.deepEqual(tipChangeAt(run, START), tipChangeAt(plan, START));
    assert.equal(isRandomizationOutOfDate(run, id), false);
    // The wells each source gets follow assignPool of the reordered pool.
    const assignment = assignPool({
      items: [
        { key: "source 1", replicates: null },
        { key: "source 2", replicates: 8 },
        { key: "source 3", replicates: 8 },
      ],
      filler: "source 1",
      wells: wellsToFill().map((_, index) => `well ${index + 1}`),
      seed: 37,
    });
    const expected = Object.fromEntries(ids.map((stage) => [stage, []]));
    for (const { well, key } of assignment) {
      const end = wellsToFill()[Number(well.split(" ")[1]) - 1];
      expected[ids[Number(key.split(" ")[1]) - 1]].push(`${end.labware} ${end.well}`);
    }
    assert.deepEqual(destinationsByStage(run, id), expected);
    // The randomization that hasn't run still sits above it.
    assert.equal(randomizationAt(run, sitting.id).beforeId, ids[0]);
    const boxes = columnBoxes(run).map((box) => box.id ?? box.key);
    assert.ok(boxes.indexOf(sitting.id) === boxes.indexOf(id) - 1);
  });

  test("reordering with shared tips: A3 moved to the top of its group starts the tips, A1 and A2 share them", () => {
    let { plan, id } = sharingPlan([false, true, true, false]);
    plan = runRandomization(plan, id);
    const sources = moveSource(randomizationAt(plan, id).sources, 2, { kind: "inGroup", index: 0, position: 0 });
    const run = runRandomization(setRandomization(plan, id, { sources }), id);
    assert.deepEqual(randomizationAt(run, id).stages.map((owned) => owned.well), ["A3", "A1", "A2", "A4"]);
    assert.deepEqual(tipChangeAt(run, stageFor(run, id, "A3")), sharingTips());
    assert.equal(tipChangeAt(run, stageFor(run, id, "A1")), null);
    assert.equal(tipChangeAt(run, stageFor(run, id, "A2")), null);
  });

  test("at the top of the plan: the new first stage takes START's tips, and no tip change is keyed by it", () => {
    let { plan, id } = sharingPlan([false, false, false, false], { beforeId: "1" });
    plan = runRandomization(plan, id);
    const firstBefore = stageOrder(plan)[0];
    assert.equal(firstBefore, stageFor(plan, id, "A1"));
    const [a1, a2, a3, a4] = randomizationAt(plan, id).sources;
    // A3 first, A1 sharing its tips.
    const reordered = [a3, { ...a1, sharesTips: true }, a2, a4];
    const run = runRandomization(setRandomization(plan, id, { sources: reordered }), id);
    const a3Stage = stageFor(run, id, "A3");
    assert.equal(stageOrder(run)[0], a3Stage);
    assert.deepEqual(tipChangeAt(run, START), sharingTips());
    assert.equal(tipChangeAt(run, a3Stage), null);
    assert.equal(tipChangeAt(run, firstBefore), null);
    assert.equal(isRandomizationOutOfDate(run, id), false);
  });

  test("unchanged: with every source on new tips, a run gives each stage its own tips, and running twice changes nothing", () => {
    const { plan: setUp, id } = sharingPlan([false, false, false, false]);
    const plan = runRandomization(setUp, id);
    for (const { stage } of randomizationAt(plan, id).stages) {
      assert.deepEqual(tipChangeAt(plan, stage), sharingTips(), stage);
      assert.deepEqual(tipGroups(plan).find((group) => group.stages.includes(stage)).stages, [stage]);
    }
    const again = runRandomization(plan, id);
    assert.deepEqual(stageOrder(again), stageOrder(plan));
    assert.deepEqual(again.tipChanges, plan.tipChanges);
    assert.equal(again.stageOrder, plan.stageOrder);
    assert.equal(again.tipChanges, plan.tipChanges);
  });

  test("setRandomization: sharesTips missing, \"yes\" or true on the first source is refused; sharing or order alone is a change", () => {
    const { plan, id } = sharingPlan([false, false, false, false]);
    const sources = randomizationAt(plan, id).sources;
    const { sharesTips, ...withoutSharing } = sources[1];
    assert.throws(() => setRandomization(plan, id, { sources: [sources[0], withoutSharing] }), {
      message: 'Source 2 must be an object with exactly "labware", "well", "replicates", "filler" and "sharesTips".',
    });
    assert.throws(() => setRandomization(plan, id, { sources: [sources[0], { ...sources[1], sharesTips: "yes" }] }), {
      message: `Source 2's "sharesTips" must be true or false, but got "yes".`,
    });
    assert.throws(() => setRandomization(plan, id, { sources: [{ ...sources[0], sharesTips: true }, sources[1]] }), {
      message:
        'Source 1 is the first source, so it starts on new tips: its "sharesTips" must be false. A randomization never shares tips with stages outside it.',
    });
    // The first source's sharing is checked after its replicates and the repeats.
    assert.throws(
      () => setRandomization(plan, id, { sources: [{ ...sources[0], sharesTips: true }, sources[0]] }),
      /is a source twice/,
    );
    const shared = setRandomization(plan, id, { sources: setSourceSharesTips(sources, 1, true) });
    assert.notEqual(shared, plan);
    assert.equal(randomizationAt(shared, id).sources[1].sharesTips, true);
    const reordered = setRandomization(plan, id, { sources: [sources[2], sources[0], sources[1], sources[3]] });
    assert.notEqual(reordered, plan);
  });

  test("a plan saved before this change, stages out of their sources' order, opens out of date and Update reorders them", () => {
    let plan = addToWells(randomizingPlan(), [trough("2")], "Media", capacityOf(RESERVOIR));
    const added = addRandomization(plan, "2", { seed: 37, volume: 10 });
    plan = setRandomization(added.plan, added.id, {
      sources: [
        { ...trough("1"), replicates: 2, filler: false, sharesTips: false },
        { ...fillerTrough("2"), sharesTips: false },
        source("A1", 2),
      ],
      fill: wellsToFill(),
    });
    const run = runRandomization(plan, added.id);
    // Saved as a run before this change could leave it: Res1 1, Deep A1, then Res1 2 (each on tips
    // of its own), as unmarking the first of two filler wells and running again left it.
    const file = JSON.parse(planToText(run, "transfer designer test"));
    const [res1, res2, deep] = randomizationAt(run, added.id).stages.map((owned) => owned.stage);
    const oldOrder = file.stages.map((stage) => stage.id).filter((stage) => stage !== res2);
    oldOrder.splice(oldOrder.indexOf(deep) + 1, 0, res2);
    file.stages = oldOrder.map((stage) => file.stages.find((candidate) => candidate.id === stage));
    file.operations = oldOrder.flatMap((stage) => file.operations.filter((operation) => operation.stage === stage));
    const stored = file.randomizations[0].stages;
    file.randomizations[0].stages = [res1, deep, res2].map((stage) => stored.find((owned) => owned.stage === stage));
    const opened = planFromText(JSON.stringify(file));
    // The source wells of the randomization's stages in `planned`, in its order.
    const wellsInOrder = (planned) => randomizationAt(planned, added.id).stages.map((owned) => owned.well);
    assert.deepEqual(wellsInOrder(opened), ["1", "A1", "2"]);
    assert.equal(isRandomizationOutOfDate(opened, added.id), true);
    const updated = runRandomization(opened, added.id);
    assert.deepEqual(wellsInOrder(updated), ["1", "2", "A1"]);
    assert.deepEqual(
      randomizationAt(updated, added.id).stages.map((owned) => owned.stage),
      [0, 2, 1].map((index) => randomizationAt(opened, added.id).stages[index].stage),
    );
    assert.deepEqual(stagesById(updated), stagesById(opened));
    assert.equal(isRandomizationOutOfDate(updated, added.id), false);
  });

  test("setRandomizations: stages sharing with each other are accepted; stored sharing they don't follow is accepted, out of date", () => {
    let { plan, id } = sharingPlan();
    plan = runRandomization(plan, id);
    assert.equal(setRandomizations(plan, plan.randomizations).randomizations.length, 1);
    const stored = JSON.parse(JSON.stringify(plan.randomizations));
    stored[0].sources[1].sharesTips = false;
    const disagreeing = setRandomizations(plan, stored);
    assert.equal(isRandomizationOutOfDate(disagreeing, id), true);
  });

  test("removing the stage just after a randomization whose last group shares still gives the next stage its own tips", () => {
    let { plan, id } = sharingPlan([false, false, true, true], { base: addStage(randomizingPlan(), null).plan });
    plan = runRandomization(plan, id);
    assert.equal(tipChangeAt(plan, stageFor(plan, id, "A4")), null);
    assert.equal(tipChangeAt(plan, "3"), null);
    const removed = removeStage(plan, "2");
    assert.deepEqual(tipChangeAt(removed, "3"), tipChangeAt(plan, "2"));
  });

  test("moving and copying a randomization with shared tips keeps its tip groups; copied items version 3", () => {
    let { plan, id } = sharingPlan();
    plan = runRandomization(plan, id);
    // How many stages each tip group of `randomization`'s box holds in `planned`.
    const groupsIn = (planned, randomization) =>
      columnBoxes(planned).find((box) => box.id === randomization).tipGroups.map((group) => group.stages.length);
    assert.deepEqual(groupsIn(plan, id), [3, 1]);
    const { plan: moved } = moveItems(plan, [randomizationItem(id)], between(columnBoxes(plan).length));
    assert.deepEqual(groupsIn(moved, id), [3, 1]);
    assert.equal(isRandomizationOutOfDate(moved, id), false);
    const copied = copyOf(plan, [randomizationItem(id)]);
    assert.equal(copied.version, 5);
    assert.equal(COPIED_ITEMS_VERSION, 5);
    assert.deepEqual(copied.items[0].randomization.sources.map((entry) => entry.sharesTips), [false, true, true, false]);
    assert.deepEqual(copied.items[0].stages.map((owned) => owned.tips), [sharingTips(), null, null, sharingTips()]);
    const { plan: pasted, placed } = pasteItems(plan, copied, between(columnBoxes(plan).length));
    assert.deepEqual(groupsIn(pasted, placed[0].id), [3, 1]);
    assert.equal(setRandomizations(pasted, pasted.randomizations).randomizations.length, 2);
    assert.equal(isRandomizationOutOfDate(pasted, placed[0].id), false);
  });

  test("copied items: a version 2 copy pastes each stage alone; version 3 with a first owned stage sharing, and version 6, are refused", () => {
    const { plan: apartPlan, id: apartId } = sharingPlan([false, false, false, false]);
    const apart = runRandomization(apartPlan, apartId);
    const version2 = copiedAsVersion(copyOf(apart, [randomizationItem(apartId)]), 2);
    const { plan: pasted, placed } = pasteItems(apart, version2, between(0));
    const copy = randomizationAt(pasted, placed[0].id);
    assert.deepEqual(copy.sources.map((entry) => entry.sharesTips), [false, false, false, false]);
    const box = columnBoxes(pasted).find((candidate) => candidate.id === copy.id);
    assert.deepEqual(box.tipGroups.map((group) => group.stages.length), [1, 1, 1, 1]);
    let { plan, id } = sharingPlan();
    plan = runRandomization(plan, id);
    const copied = copyOf(plan, [randomizationItem(id)]);
    copied.items[0].stages[0].tips = null;
    assert.throws(() => pasteItems(plan, copied, between(0)), {
      message: "Can't paste: item 1 isn't a stage, tip group or randomization as the transfer designer copies them.",
    });
    assert.throws(() => pasteItems(plan, { ...copyOf(plan, [randomizationItem(id)]), version: 6 }, between(0)), {
      message: "Can't paste: these were copied by a newer version of the tools (version 6).",
    });
  });

  test("copying stages of a shared group: one alone takes the group's tips; two pasted between boxes form one tip group", () => {
    let { plan, id } = sharingPlan();
    plan = runRandomization(plan, id);
    const a2 = stageFor(plan, id, "A2");
    const a3 = stageFor(plan, id, "A3");
    const one = copyOf(plan, [stageItem(a2)]);
    assert.deepEqual(one.items[0].tips, sharingTips());
    const { plan: pasted, placed } = copyItems(plan, [stageItem(a2), stageItem(a3)], between(columnBoxes(plan).length));
    const group = tipGroups(pasted).find((candidate) => candidate.stages.includes(placed[0].id));
    assert.deepEqual(group.stages, placed.map((item) => item.id));
    assert.deepEqual({ tipType: group.tipType, probes: group.probes }, sharingTips());
    assert.equal(randomizationOf(pasted, placed[0].id), null);
  });

  test("to the top of the plan: moved or copied there, the randomization's first stage takes START's tips", () => {
    let { plan, id } = sharingPlan();
    plan = runRandomization(plan, id);
    const startBefore = tipChangeAt(plan, START);
    // Checks `randomization` in `planned` is at the top, on START's tips, with its sharing kept.
    const check = (planned, randomization) => {
      // The stage for DEEP `well`.
      const stage = (well) => stageFor(planned, randomization, well);
      assert.equal(stageOrder(planned)[0], stage("A1"));
      assert.deepEqual(tipChangeAt(planned, START), sharingTips());
      assert.equal(tipChangeAt(planned, stage("A1")), null);
      assert.equal(tipChangeAt(planned, stage("A2")), null);
      assert.equal(tipChangeAt(planned, stage("A3")), null);
      assert.deepEqual(tipChangeAt(planned, stage("A4")), sharingTips());
      assert.deepEqual(tipChangeAt(planned, "1"), startBefore);
      assert.equal(isRandomizationOutOfDate(planned, randomization), false);
    };
    const { plan: moved } = moveItems(plan, [randomizationItem(id)], between(0));
    check(moved, id);
    const { plan: copiedPlan, placed } = copyItems(plan, [randomizationItem(id)], between(0));
    check(copiedPlan, placed[0].id);
    assert.deepEqual(randomizationAt(copiedPlan, id), randomizationAt(plan, id));
    assert.deepEqual(tipChangeAt(copiedPlan, stageFor(plan, id, "A1")), sharingTips());
  });

  test("copied items version 1 and 2 whose source has sharesTips are refused; a version 2 source that's null gets setRandomization's message", () => {
    const { plan: apartPlan, id } = sharingPlan([false, false, false, false]);
    const plan = runRandomization(apartPlan, id);
    const formMessage = "Can't paste: item 1 isn't a stage, tip group or randomization as the transfer designer copies them.";
    for (const version of [1, 2]) {
      for (const sharesTips of [false, true]) {
        const older = copiedAsVersion(copyOf(plan, [randomizationItem(id)]), version);
        older.items[0].randomization.sources[1].sharesTips = sharesTips;
        assert.throws(() => pasteItems(plan, older, between(0)), { message: formMessage }, `${version} ${sharesTips}`);
      }
    }
    const withNull = copiedAsVersion(copyOf(plan, [randomizationItem(id)]), 2);
    withNull.items[0].randomization.sources[1] = null;
    assert.throws(() => pasteItems(plan, withNull, between(0)), {
      message:
        'Can\'t paste: item 1: Source 2 must be an object with exactly "labware", "well", "replicates", "filler" and "sharesTips".',
    });
  });

  test("copied items: a version 2 copy whose second owned stage's tips are null is refused", () => {
    const { plan: apartPlan, id } = sharingPlan([false, false, false, false]);
    const plan = runRandomization(apartPlan, id);
    const older = copiedAsVersion(copyOf(plan, [randomizationItem(id)]), 2);
    older.items[0].stages[1].tips = null;
    assert.throws(() => pasteItems(plan, older, between(0)), {
      message: "Can't paste: item 1 isn't a stage, tip group or randomization as the transfer designer copies them.",
    });
  });

  test("copied items version 3 whose sources and stages disagree paste as the copy gives, out of date, and Update brings them together", () => {
    let { plan, id } = sharingPlan([false, false, false, false]);
    plan = runRandomization(plan, id);
    // The sources say A2 shares A1's tips, but its stage has tips of its own.
    const sharingSaid = copyOf(plan, [randomizationItem(id)]);
    sharingSaid.items[0].randomization.sources[1].sharesTips = true;
    // The sources say no source shares, but A2's stage shares.
    const apartSaid = copyOf(plan, [randomizationItem(id)]);
    apartSaid.items[0].stages[1].tips = null;
    for (const [copied, groups, sharesAfterUpdate] of [
      [sharingSaid, [1, 1, 1, 1], true],
      [apartSaid, [2, 1, 1], false],
    ]) {
      const { plan: pasted, placed } = pasteItems(plan, copied, between(columnBoxes(plan).length));
      const copy = placed[0].id;
      const box = columnBoxes(pasted).find((candidate) => candidate.id === copy);
      assert.deepEqual(box.tipGroups.map((group) => group.stages.length), groups);
      assert.equal(isRandomizationOutOfDate(pasted, copy), true);
      const updated = runRandomization(pasted, copy);
      assert.equal(tipChangeAt(updated, stageFor(updated, copy, "A2")) === null, sharesAfterUpdate);
      assert.equal(isRandomizationOutOfDate(updated, copy), false);
    }
  });

  test("moving wells: moving a source that shares tips keeps its sharesTips", () => {
    const { plan, id } = sharingPlan();
    const moved = moveWell(plan, deepWell("A2"), deepWell("H1"));
    assert.deepEqual(randomizationAt(moved, id).sources[1], { ...deepWell("H1"), replicates: 4, filler: false, sharesTips: true });
  });

  // --- Moving wells ---

  // The plan the trough-move tests use (section 6, "Moving wells"): components Media and Dye; Res 1
  // holding Dye, Res 3 holding Media, labeled "Media stock"; stage 1 with two transfers from Res 3 (into PLATE A1 and
  // A2) and stage 2 with one (into A3), plus a transfer from Res 1 into A4 in stage 2 that doesn't
  // touch Res 3.
  function troughMovePlan() {
    let { plan } = emptyPlan();
    plan = addComponent(plan, "Media", "#4e79a7");
    plan = addComponent(plan, "Dye", "#e15759");
    // Each trough the transfers draw from holds its dead volume and 1000 µL more, so the plan has no
    // contents problems before a move.
    const filled = deadVolumeOf(RESERVOIR) + 1000;
    plan = addToWells(plan, [trough("1")], "Dye", filled);
    plan = addToWells(plan, [trough("3")], "Media", filled);
    plan = addToWells(plan, [trough("5")], "Dye", 1000);
    plan = setWellLabel(plan, trough("3"), "Media stock");
    plan = addTransfer(plan, { ...transferTo("1", "A1"), source: trough("3") });
    plan = addTransfer(plan, { ...transferTo("1", "A2"), source: trough("3") });
    plan = addStage(plan, null).plan;
    plan = addTransfer(plan, { ...transferTo("2", "A3"), source: trough("3") });
    return addTransfer(plan, transferTo("2", "A4"));
  }

  // The contents of every well after each operation of `plan`, as text by well, leaving out the
  // wells in `skipped` (each { labware, well }), so two plans can be compared well by well.
  function contentsAfterEachOperation(plan, skipped) {
    const skippedKeys = new Set(skipped.map((end) => `${end.labware} ${end.well}`));
    const count = plan.operationList.listOperations().length;
    const steps = [];
    for (let done = 0; done <= count; done += 1) {
      const snapshotAt = replay(plan.startingContents, plan.operationList, done);
      steps.push(
        snapshotAt
          .listContents()
          .filter((entry) => !skippedKeys.has(`${entry.labware} ${entry.well}`))
          .map((entry) => JSON.stringify(entry))
          .sort(),
      );
    }
    return steps;
  }

  // `base` (randomizingPlan by default) with a randomization that hasn't run, last, whose wells have
  // no other use there: its sources DEEP E1 and E2 (the filler), holding nothing, and its wells to
  // fill PLATE F1 and F2. So a test of one of a randomization's uses fails if that rule is taken
  // out: { plan, id }.
  function bareRandomizationPlan(base = randomizingPlan()) {
    const { plan, id } = addRandomization(base, null, { seed: 5, volume: 10 });
    return {
      plan: setRandomization(plan, id, {
        sources: [source("E1", 1), source("E2", null, true)],
        fill: [plateWell("F1"), plateWell("F2")],
      }),
      id,
    };
  }

  test("isWellUsed: false for every well of an empty plan", () => {
    const { plan } = emptyPlan();
    for (const { name } of DECK) {
      for (const well of gridOf(name).wellNames()) {
        assert.equal(isWellUsed(plan, { labware: name, well }), false, `${name} ${well}`);
      }
    }
  });

  test("isWellUsed: true for starting contents, a source, a destination, a mixed well and a label only", () => {
    let plan = planWithContents();
    // From trough 11, which holds nothing, so only the transfer uses it.
    plan = addTransfer(plan, { ...transferTo("1", "B2"), source: trough("11") });
    let mixStep = addMixStep(plan, null);
    plan = mixWells(mixStep.plan, mixStep.id, [plateWell("C3")]);
    plan = setWellLabel(plan, { labware: LABELED_ONLY, well: "D4" }, "Cond 1");
    assert.equal(isWellUsed(plan, trough("2")), true, "starting contents");
    assert.equal(isWellUsed(plan, trough("11")), true, "a source");
    assert.equal(isWellUsed(plan, plateWell("B2")), true, "a destination");
    assert.equal(isWellUsed(plan, plateWell("C3")), true, "a mixed well");
    assert.equal(isWellUsed(plan, { labware: LABELED_ONLY, well: "D4" }), true, "a label only");
    assert.equal(isWellUsed(plan, plateWell("H12")), false, "an unused well on the same labware");
    assert.equal(isWellUsed(plan, trough("12")), false, "an unused trough");
  });

  test("isWellUsed: true for a randomization's source, its well to fill, and a stage entry whose source was taken out", () => {
    const { plan: bare } = bareRandomizationPlan();
    assert.equal(isWellUsed(bare, deepWell("E1")), true, "a source");
    assert.equal(isWellUsed(bare, plateWell("F1")), true, "a well to fill");
    assert.equal(isWellUsed(bare, deepWell("H12")), false, "an unused well");
    // A stage entry whose well is no longer a source and has no other use (G7), as a plan file can
    // hold it after its source was taken out and the well emptied.
    const { plan } = runRandomizationPlan();
    const stored = JSON.parse(JSON.stringify(plan.randomizations));
    stored[0].stages.find((owned) => owned.well === "A2").well = "G7";
    const loaded = setRandomizations(plan, stored);
    assert.equal(isWellUsed(loaded, deepWell("G7")), true, "a stage entry");
  });

  test("isWellToFill: true for a well to fill, false for a source and for a well no randomization fills", () => {
    const { plan } = setUpRandomization();
    assert.equal(isWellToFill(plan, plateWell("B2")), true);
    assert.equal(isWellToFill(plan, deepWell("A1")), false);
    assert.equal(isWellToFill(plan, plateWell("H12")), false);
  });

  test("isWellUsed and isWellToFill throw deck.checkWell's message for a well off the deck", () => {
    const { plan } = emptyPlan();
    const off = { labware: PLATE, well: "Z99" };
    const message = { message: `"Z99" isn't a well on ${PLATE}. Its wells are A1 to H12.` };
    assert.throws(() => isWellUsed(plan, off), message);
    assert.throws(() => isWellToFill(plan, off), message);
  });

  test("moveWell: a trough moved to another trough takes its contents, transfers and label", () => {
    const plan = troughMovePlan();
    const moved = moveWell(plan, trough("3"), trough("7"));
    assert.deepEqual(moved.startingContents, [
      plan.startingContents[0],
      { labware: RESERVOIR, well: "7", components: plan.startingContents[1].components },
      plan.startingContents[2],
    ]);
    const before = plan.operationList.listOperations();
    const after = moved.operationList.listOperations();
    assert.equal(after.length, before.length);
    after.forEach((operation, position) => {
      const expectedSource =
        before[position].source.well === "3" ? trough("7") : before[position].source;
      assert.deepEqual(operation, { ...before[position], source: expectedSource }, `transfer ${position}`);
    });
    assert.equal(wellLabelOf(moved, trough("7")), "Media stock");
    assert.equal(wellLabelOf(moved, trough("3")), null);
    assert.equal(Object.hasOwn(moved.wellLabels, RESERVOIR), true);
    assert.equal(isWellUsed(moved, trough("3")), false);
    assert.deepEqual(
      contentsAfterEachOperation(moved, [trough("3"), trough("7")]),
      contentsAfterEachOperation(plan, [trough("3"), trough("7")]),
    );
    const at = (candidate, well) =>
      replay(candidate.startingContents, candidate.operationList).componentsOf(RESERVOIR, well);
    assert.deepEqual(at(moved, "7"), at(plan, "3"));
  });

  test("moveWell: the labware stays in wellLabels only while it has another labeled well", () => {
    const plan = troughMovePlan();
    assert.equal(Object.hasOwn(moveWell(plan, trough("3"), plateWell("H1")).wellLabels, RESERVOIR), false);
    const twoLabels = setWellLabel(plan, trough("1"), "Dye stock");
    assert.deepEqual(moveWell(twoLabels, trough("3"), plateWell("H1")).wellLabels[RESERVOIR], { 1: "Dye stock" });
  });

  test("moveWell: a destination moved leaves the old well empty after every stage", () => {
    let plan = troughMovePlan();
    const moved = moveWell(plan, plateWell("A1"), plateWell("H1"));
    for (let done = 0; done <= plan.operationList.listOperations().length; done += 1) {
      const snapshotAt = replay(moved.startingContents, moved.operationList, done);
      assert.equal(snapshotAt.totalVolumeOf(PLATE, "A1"), 0, `after ${done}`);
    }
    assert.deepEqual(
      replay(moved.startingContents, moved.operationList).componentsOf(PLATE, "H1"),
      replay(plan.startingContents, plan.operationList).componentsOf(PLATE, "A1"),
    );
  });

  test("moveWell: a mix step's mixed well moves at both ends", () => {
    let plan = troughMovePlan();
    const mixStep = addMixStep(plan, null);
    plan = mixWells(mixStep.plan, mixStep.id, [plateWell("A1")]);
    const moved = moveWell(plan, plateWell("A1"), plateWell("H1"));
    const [transfer] = transfersIn(moved, mixStep.id);
    assert.deepEqual(transfer.source, plateWell("H1"));
    assert.deepEqual(transfer.destination, plateWell("H1"));
    assert.equal(transfer.volume, mixedWell(mixStep.id, plateWell("H1")).volume);
  });

  test("moveWell: a trough holding more than a plate well's capacity, moved to a plate well, is allowed and overfills", () => {
    const plan = troughMovePlan();
    assert.ok(plan.startingContents[1].components.Media > capacityOf(PLATE));
    assert.deepEqual(replay(plan.startingContents, plan.operationList).listProblems(), []);
    const moved = moveWell(plan, trough("3"), plateWell("H1"));
    const problems = replay(moved.startingContents, moved.operationList).listProblems();
    assert.ok(problems.some((problem) => problem.labware === PLATE && problem.well === "H1"));

    // A trough a transfer fills past a plate well's capacity: the overfill is the stage's, so
    // stagesWithContentsProblem reports it too. (An overfill at the start belongs to no stage.)
    let filled = addStage(plan, null).plan;
    filled = addTransfer(filled, {
      type: "transfer",
      source: trough("1"),
      destination: trough("9"),
      volume: capacityOf(PLATE) + 1,
      stage: "3",
    });
    assert.deepEqual(stagesWithContentsProblem(filled), new Set());
    const filledMoved = moveWell(filled, trough("9"), plateWell("H1"));
    assert.deepEqual(stagesWithContentsProblem(filledMoved), new Set(["3"]));
  });

  test("moveWell: a randomization's source keeps its place, and running again with the seed gives the same wells", () => {
    const { plan, id } = runRandomizationPlan();
    const moved = moveWell(plan, deepWell("A2"), deepWell("H2"));
    const randomization = randomizationAt(moved, id);
    assert.deepEqual(randomization.sources, [source("A1", 8), source("H2", 8), source("A3", null, true)]);
    const before = randomizationAt(plan, id).stages;
    assert.deepEqual(
      randomization.stages,
      before.map((owned) => (owned.well === "A2" ? { ...owned, well: "H2" } : owned)),
    );
    assert.deepEqual(randomization.fill, randomizationAt(plan, id).fill);
    const rerun = runRandomization(moved, id);
    assert.deepEqual(destinationsByStage(rerun, id), destinationsByStage(plan, id));
    // The stage's name, given when it ran, stays as it was.
    const ownedA2 = before.find((owned) => owned.well === "A2").stage;
    assert.equal(moved.stageList.get(ownedA2).name, plan.stageList.get(ownedA2).name);
  });

  test("moveWell: a source of one transfer and destination of another both move", () => {
    let plan = troughMovePlan();
    plan = addStage(plan, null).plan;
    plan = addTransfer(plan, {
      type: "transfer",
      source: plateWell("A1"),
      destination: plateWell("B1"),
      volume: 10,
      stage: "3",
    });
    const moved = moveWell(plan, plateWell("A1"), plateWell("H1"));
    assert.deepEqual(transfersIn(moved, "1")[0].destination, plateWell("H1"));
    assert.deepEqual(transfersIn(moved, "3")[0].source, plateWell("H1"));
  });

  test("moveWell: a source of a randomization that hasn't run moves in its sources", () => {
    const { plan, id } = setUpRandomization();
    assert.deepEqual(randomizationAt(plan, id).stages, []);
    const moved = moveWell(plan, deepWell("A1"), deepWell("H1"));
    assert.deepEqual(randomizationAt(moved, id).sources[0], source("H1", 8));
    assert.deepEqual(moved.startingContents[0], { ...plan.startingContents[0], well: "H1" });
  });

  test("moveWell: a stage entry whose well is no longer a source moves", () => {
    const { plan, id } = runRandomizationPlan();
    const stored = JSON.parse(JSON.stringify(plan.randomizations));
    const ownedA2 = stored[0].stages.find((owned) => owned.well === "A2");
    // A stage entry for a well that isn't among the sources, as a plan file can hold it.
    ownedA2.well = "G7";
    const loaded = setRandomizations(plan, stored);
    assert.equal(isWellUsed(loaded, deepWell("G7")), true);
    const moved = moveWell(loaded, deepWell("G7"), deepWell("G8"));
    assert.deepEqual(
      randomizationAt(moved, id).stages.find((owned) => owned.stage === ownedA2.stage),
      { ...ownedA2, well: "G8" },
    );
  });

  test("moveWell: a label lands where setWellLabel would put it", () => {
    let plan = troughMovePlan();
    plan = setWellLabels(plan, { [RESERVOIR]: { 1: "One", 3: "Three", 5: "Five" } });
    const moved = moveWell(plan, trough("3"), trough("9"));
    assert.deepEqual(Object.keys(moved.wellLabels[RESERVOIR]), ["1", "5", "9"]);
    assert.equal(moved.wellLabels[RESERVOIR]["9"], "Three");

    let other = troughMovePlan();
    other = setWellLabels(other, { [DEEP]: { A1: "Cond 1" }, [RESERVOIR]: { 3: "Media stock" } });
    const toPlate = moveWell(other, trough("3"), plateWell("H1"));
    assert.deepEqual(Object.keys(toPlate.wellLabels), [DEEP, PLATE]);
  });

  test("moveWell: a plan with a moved randomization source is saved and opened as the same plan", () => {
    const { plan } = runRandomizationPlan();
    const moved = moveWell(plan, deepWell("A2"), deepWell("H2"));
    const text = planToText(moved, "transfer designer v0.2.0");
    const opened = planFromText(text);
    // Opening renumbers the stages from "1" (plan-file.md), so the stage IDs are left out.
    const withoutStageIds = (candidate) => ({
      startingContents: candidate.startingContents,
      wellLabels: candidate.wellLabels,
      sources: candidate.randomizations.map((randomization) => randomization.sources),
      fill: candidate.randomizations.map((randomization) => randomization.fill),
      stageWells: candidate.randomizations.map((randomization) =>
        randomization.stages.map(({ labware, well }) => ({ labware, well })),
      ),
      transfers: candidate.operationList
        .listOperations()
        .map(({ source, destination, volume }) => ({ source, destination, volume })),
    });
    assert.deepEqual(withoutStageIds(opened), withoutStageIds(moved));
  });

  test("moveWell refuses each wrong move with its message, leaving the plan unchanged", () => {
    // A run randomization (for its stage entries), and a second, not run, on wells with no other use.
    let { plan } = bareRandomizationPlan(runRandomizationPlan().plan);
    plan = setWellLabel(plan, plateWell("H11"), "Only a label");
    plan = addToWells(plan, [deepWell("H1")], "Media", 10);
    const stored = JSON.parse(JSON.stringify(plan.randomizations));
    stored[0].stages.find((owned) => owned.well === "A2").well = "G7";
    const withEntry = setRandomizations(plan, stored);
    const before = snapshot(withEntry);
    const cases = [
      [deepWell("A1"), deepWell("A1"), `${DEEP} A1 is where it is already. Choose another well to move it to.`],
      [deepWell("H12"), deepWell("H11"), `The plan doesn't use ${DEEP} H12, so there's nothing to move.`],
      [plateWell("B2"), plateWell("H1"), "Wells a randomization fills can't be moved."],
    ];
    const inUse = (end) => `${end.labware} ${end.well} is already used in the plan. Move to a well the plan doesn't use.`;
    const usedTargets = [
      deepWell("H1"), // only starting contents
      plateWell("A1"), // a transfer's destination
      plateWell("H11"), // only a label
      deepWell("E1"), // only a randomization's source
      deepWell("G7"), // only the well of a randomization's stage entry
      plateWell("F1"), // only a randomization's well to fill
    ];
    for (const target of usedTargets) {
      cases.push([trough("1"), target, inUse(target)]);
    }
    cases.push([{ labware: PLATE, well: "Z99" }, trough("2"), `"Z99" isn't a well on ${PLATE}. Its wells are A1 to H12.`]);
    cases.push([trough("1"), { labware: PLATE, well: "Z99" }, `"Z99" isn't a well on ${PLATE}. Its wells are A1 to H12.`]);
    for (const [from, to, message] of cases) {
      assert.throws(() => moveWell(withEntry, from, to), { message }, `${JSON.stringify(from)} → ${JSON.stringify(to)}`);
    }
    assert.equal(snapshot(withEntry), before);
  });

  test("moveWell checks in its order: from on the deck, to on the deck, the same well, from in use, a well to fill, to in use", () => {
    const { plan } = runRandomizationPlan();
    const offFrom = { labware: PLATE, well: "Z98" };
    const offTo = { labware: PLATE, well: "Z99" };
    assert.throws(() => moveWell(plan, offFrom, offTo), {
      message: `"Z98" isn't a well on ${PLATE}. Its wells are A1 to H12.`,
    });
    assert.throws(() => moveWell(plan, deepWell("H12"), deepWell("H12")), {
      message: `${DEEP} H12 is where it is already. Choose another well to move it to.`,
    });
    assert.throws(() => moveWell(plan, deepWell("H12"), deepWell("A1")), {
      message: `The plan doesn't use ${DEEP} H12, so there's nothing to move.`,
    });
    assert.throws(() => moveWell(plan, plateWell("B2"), deepWell("A1")), {
      message: "Wells a randomization fills can't be moved.",
    });
  });

  test("moveWell changes only the parts that name the moved well, and shares every other transfer", () => {
    const plan = troughMovePlan();
    const moved = moveWell(plan, trough("3"), trough("7"));
    for (const part of PLAN_PARTS.filter((name) => !["startingContents", "operationList", "wellLabels"].includes(name))) {
      assert.equal(moved[part], plan[part], part);
    }
    assert.equal(moved.startingContents[0], plan.startingContents[0]);
    assert.equal(moved.startingContents[2], plan.startingContents[2]);
    const before = plan.operationList.listOperations();
    const after = moved.operationList.listOperations();
    assert.equal(after[3], before[3], "the transfer from Res 1 is shared");
    assert.notEqual(after[0], before[0]);

    // A well used only as a destination: starting contents, well labels and randomizations stay.
    const destination = moveWell(plan, plateWell("A4"), plateWell("H4"));
    assert.equal(destination.startingContents, plan.startingContents);
    assert.equal(destination.wellLabels, plan.wellLabels);
    assert.equal(destination.randomizations, plan.randomizations);

    // A well with only a label: only well labels change.
    const labeled = setWellLabel(plan, plateWell("H11"), "Spare");
    const labelMoved = moveWell(labeled, plateWell("H11"), plateWell("H12"));
    assert.equal(labelMoved.operationList, labeled.operationList);
    assert.equal(labelMoved.startingContents, labeled.startingContents);
  });

  test("moveWell: a randomization that doesn't use the moved well is the very same object", () => {
    const { plan, id } = runRandomizationPlan();
    const moved = moveWell(plan, trough("1"), trough("9"));
    assert.equal(moved.randomizations, plan.randomizations);
    assert.equal(randomizationAt(moved, id), randomizationAt(plan, id));
  });

  test("moveWell: one undo with plan-history brings back the plan before the move", () => {
    const plan = troughMovePlan();
    let history = new PlanHistory(plan);
    history = history.record(moveWell(plan, trough("3"), trough("7")));
    assert.equal(history.undo().present, plan);
  });

  // --- Moving and copying ---

  // The two tip types the moving tests use: the first and the last in config/tip-types.js.
  const FIRST_TIPS = TIP_TYPES[0];
  const OTHER_TIPS = TIP_TYPES.at(-1);

  // The plan the moving tests use (transfer-designer.md, section 6, "Moving and copying"): RESERVOIR
  // troughs 1 and 2 holding Media and Drug; stages "1" Media and "2" Drug on FIRST_TIPS (START),
  // then "3" Top-up and "4" Wash on OTHER_TIPS, each with a transfer into PLATE (A1 to A4); and a
  // randomization "r1" that has run, with two stages, "5" and "6", after them.
  function movingPlan() {
    let { plan } = emptyPlan();
    plan = addComponent(plan, "Media", "#4e79a7");
    plan = addComponent(plan, "Drug", "#e15759");
    plan = addToWells(plan, [trough("1")], "Media", capacityOf(RESERVOIR));
    plan = addToWells(plan, [trough("2")], "Drug", capacityOf(RESERVOIR));
    plan = renameStage(plan, "1", "Media");
    plan = renameStage(addStage(plan, null).plan, "2", "Drug");
    plan = renameStage(addStageWithNewTips(plan, null).plan, "3", "Top-up");
    plan = renameStage(addStage(plan, null).plan, "4", "Wash");
    plan = setTipType(plan, "3", OTHER_TIPS);
    plan = addTransfers(plan, [
      transferTo("1", "A1"),
      { ...transferTo("2", "A2"), source: trough("2") },
      transferTo("3", "A3"),
      transferTo("4", "A4"),
    ]);
    const { plan: added, id } = addRandomization(plan, null, { seed: 37, volume: 10 });
    const set = setRandomization(added, id, {
      sources: [
        { labware: DEEP, well: "A1", replicates: 2, filler: false, sharesTips: false },
        { labware: DEEP, well: "A2", replicates: 2, filler: false, sharesTips: false },
      ],
      fill: [...GRID_96.wellsInBox("B1", "B4")].map(plateWell),
    });
    return runRandomization(set, id);
  }

  // Items and places, e.g. stageItem("3") → { kind: "stage", id: "3" }.
  function stageItem(id) {
    return { kind: "stage", id };
  }
  function groupItem(id) {
    return { kind: "tipGroup", id };
  }
  function randomizationItem(id) {
    return { kind: "randomization", id };
  }
  function between(index) {
    return { kind: "between", index };
  }
  function inGroup(index, position) {
    return { kind: "inTipGroup", index, position };
  }

  // The plan's tip groups as [tip type, stage IDs], e.g. [["BC230", ["1", "2"]], …].
  function groupsOf(plan) {
    return tipGroups(plan).map((group) => [group.tipType, group.stages]);
  }

  // Each stage's name, settings and transfers (without positions), by ID, to check a move keeps them.
  function stagesById(plan) {
    return Object.fromEntries(
      stageOrder(plan).map((id) => {
        const { name, settings } = plan.stageList.get(id);
        const transfers = transfersIn(plan, id).map(({ position, ...transfer }) => transfer);
        return [id, { name, settings, transfers }];
      }),
    );
  }

  // The operation list's stages, one per block, in order, e.g. ["1", "3", "2"].
  function blocksOf(plan) {
    return plan.operationList.groupByStage().map((group) => group.stage);
  }

  // A stage's name, settings and transfers (source, destination and volume), for comparing a copy
  // with its original.
  function stageContents(plan, id) {
    const { name, settings } = plan.stageList.get(id);
    const transfers = transfersIn(plan, id).map(({ source, destination, volume }) => ({ source, destination, volume }));
    return { name, settings, transfers };
  }

  test("columnBoxes gives two tip groups, then the randomization with its two one-stage tip groups", () => {
    const plan = movingPlan();
    const boxes = columnBoxes(plan);
    assert.deepEqual(
      boxes.map((box) => box.kind),
      ["tipGroup", "tipGroup", "randomization"],
    );
    assert.deepEqual(boxes[0], { kind: "tipGroup", key: START, tipType: FIRST_TIPS, probes: probesFor(DEFAULT_PROBE_COUNT), stages: ["1", "2"] });
    assert.equal(boxes[1].key, "3");
    assert.deepEqual(boxes[1].stages, ["3", "4"]);
    assert.equal(boxes[2].id, "r1");
    assert.deepEqual(boxes[2].tipGroups.map((group) => group.stages), [["5"], ["6"]]);
    // Every tip group is in exactly one box.
    const inBoxes = boxes.flatMap((box) => (box.kind === "tipGroup" ? [box.key] : box.tipGroups.map((group) => group.key)));
    assert.deepEqual(inBoxes, tipGroups(plan).map((group) => group.key));
  });

  test("columnBoxes puts a randomization that hasn't run before its beforeId's box, or last, several in the list's order", () => {
    let plan = movingPlan();
    plan = addRandomization(plan, "3", { seed: 1, volume: 1 }).plan;
    plan = addRandomization(plan, null, { seed: 2, volume: 1 }).plan;
    plan = addRandomization(plan, "3", { seed: 3, volume: 1 }).plan;
    const boxes = columnBoxes(plan);
    assert.deepEqual(
      boxes.map((box) => (box.kind === "tipGroup" ? box.key : box.id)),
      [START, "r2", "r4", "3", "r1", "r3"],
    );
    assert.deepEqual(boxes[1].tipGroups, []);
  });

  test("moveItems: a stage into another tip group takes its tips, and every stage keeps its ID, name, settings and transfers", () => {
    const plan = movingPlan();
    const { plan: moved, placed } = moveItems(plan, [stageItem("3")], inGroup(0, 1));
    assert.deepEqual(groupsOf(moved).slice(0, 2), [
      [FIRST_TIPS, ["1", "3", "2"]],
      [OTHER_TIPS, ["4"]],
    ]);
    assert.ok(Object.hasOwn(moved.tipChanges, "4"));
    assert.equal(Object.hasOwn(moved.tipChanges, "3"), false);
    assert.deepEqual(stagesById(moved), stagesById(plan));
    assert.deepEqual(blocksOf(moved), stageOrder(moved).filter((id) => blocksOf(plan).includes(id)));
    assert.deepEqual(placed, [stageItem("3")]);
  });

  test("moveItems: a stage to the top of a tip group gets the START tips; the stage it left keeps its group's tips", () => {
    const { plan: moved } = moveItems(movingPlan(), [stageItem("4")], inGroup(0, 0));
    assert.deepEqual(stageOrder(moved).slice(0, 4), ["4", "1", "2", "3"]);
    assert.equal(tipChangeAt(moved, START).tipType, FIRST_TIPS);
    assert.equal(tipChangeAt(moved, "3").tipType, OTHER_TIPS);
    assert.equal(tipChangeAt(moved, "1"), null);
  });

  test("moveItems: a stage between boxes keeps its tips; at the top they become the START tips", () => {
    const plan = movingPlan();
    const { plan: moved } = moveItems(plan, [stageItem("3")], between(0));
    assert.deepEqual(groupsOf(moved).slice(0, 3), [
      [OTHER_TIPS, ["3"]],
      [FIRST_TIPS, ["1", "2"]],
      [OTHER_TIPS, ["4"]],
    ]);
    assert.deepEqual(tipChangeAt(moved, "1"), tipChangeAt(plan, START));
  });

  test("moveItems: stages from two tip groups between boxes make two new tip groups", () => {
    const { plan: moved } = moveItems(movingPlan(), [stageItem("2"), stageItem("3")], between(3));
    assert.deepEqual(stageOrder(moved), ["1", "4", "5", "6", "2", "3"]);
    assert.deepEqual(groupsOf(moved).slice(0, 2), [
      [FIRST_TIPS, ["1"]],
      [OTHER_TIPS, ["4"]],
    ]);
    assert.deepEqual(groupsOf(moved).slice(-2), [
      [FIRST_TIPS, ["2"]],
      [OTHER_TIPS, ["3"]],
    ]);
    assert.equal(randomizationAt(moved, "r1").beforeId, "2");
  });

  test("moveItems: stages from one tip group, moved together, make one tip group", () => {
    const { plan: moved } = moveItems(movingPlan(), [stageItem("1"), stageItem("2")], between(2));
    assert.deepEqual(groupsOf(moved).slice(0, 2), [
      [OTHER_TIPS, ["3", "4"]],
      [FIRST_TIPS, ["1", "2"]],
    ]);
  });

  test("moveItems: a tip group moved to the top and to the end brings its tips and stages", () => {
    const plan = movingPlan();
    const top = moveItems(plan, [groupItem("3")], between(0)).plan;
    assert.deepEqual(groupsOf(top).slice(0, 2), [
      [OTHER_TIPS, ["3", "4"]],
      [FIRST_TIPS, ["1", "2"]],
    ]);
    const end = moveItems(plan, [groupItem("1")], between(3)).plan;
    assert.deepEqual(stageOrder(end), ["3", "4", "5", "6", "1", "2"]);
    assert.equal(tipChangeAt(end, START).tipType, OTHER_TIPS);
    assert.equal(tipChangeAt(end, "1").tipType, FIRST_TIPS);
    assert.equal(randomizationAt(end, "r1").beforeId, "1");
  });

  test("moveItems: a randomization moved to the top keeps its stages on tips of their own", () => {
    const plan = movingPlan();
    const { plan: moved, placed } = moveItems(plan, [randomizationItem("r1")], between(0));
    assert.deepEqual(stageOrder(moved), ["5", "6", "1", "2", "3", "4"]);
    assert.equal(randomizationOf(moved, "5"), "r1");
    assert.equal(randomizationOf(moved, "6"), "r1");
    assert.equal(randomizationAt(moved, "r1").beforeId, "1");
    assert.ok(Object.hasOwn(moved.tipChanges, "6"));
    assert.ok(Object.hasOwn(moved.tipChanges, "1"));
    assert.deepEqual(tipChangeAt(moved, "1"), tipChangeAt(plan, START));
    assert.deepEqual(placed, [randomizationItem("r1")]);
    // Still a valid plan: its randomizations pass the plan file's checks.
    setRandomizations(moved, JSON.parse(JSON.stringify(moved.randomizations)));
  });

  test("moveItems: a randomization that hasn't run, moved, sits before the next box's first stage, and the list is in column order", () => {
    let plan = movingPlan();
    plan = addRandomization(plan, null, { seed: 5, volume: 5 }).plan;
    const top = moveItems(plan, [randomizationItem("r2")], between(0)).plan;
    assert.equal(randomizationAt(top, "r2").beforeId, "1");
    assert.deepEqual(top.randomizations.map((randomization) => randomization.id), ["r2", "r1"]);
    const back = moveItems(top, [randomizationItem("r2")], between(4)).plan;
    assert.equal(randomizationAt(back, "r2").beforeId, null);
    assert.deepEqual(back.randomizations.map((randomization) => randomization.id), ["r1", "r2"]);
  });

  test("moveItems: a tip group whose stages all move away is gone; the first group's first stage moved away leaves the START tips", () => {
    const plan = movingPlan();
    const emptied = moveItems(plan, [stageItem("3"), stageItem("4")], inGroup(0, 2)).plan;
    assert.deepEqual(groupsOf(emptied)[0], [FIRST_TIPS, ["1", "2", "3", "4"]]);
    assert.equal(Object.hasOwn(emptied.tipChanges, "3"), false);
    assert.equal(Object.hasOwn(emptied.tipChanges, "4"), false);
    const firstAway = moveItems(plan, [stageItem("1")], inGroup(1, 2)).plan;
    assert.deepEqual(groupsOf(firstAway).slice(0, 2), [
      [FIRST_TIPS, ["2"]],
      [OTHER_TIPS, ["3", "4", "1"]],
    ]);
  });

  test("moveItems: a tip group's only stage moved to the top of its own box gives the same plan", () => {
    const plan = addTipChange(movingPlan(), "4");
    const result = moveItems(plan, [stageItem("4")], inGroup(2, 0));
    assert.equal(result.plan, plan);
    assert.deepEqual(result.placed, [stageItem("4")]);
  });

  test("moveItems: a stage dropped where it is, or a tip group just before or after itself, gives the same plan", () => {
    const plan = movingPlan();
    for (const [items, place] of [
      [[stageItem("2")], inGroup(0, 1)],
      [[stageItem("2")], inGroup(0, 2)],
      [[groupItem("1")], between(0)],
      [[groupItem("1")], between(1)],
      [[groupItem("3")], between(2)],
      [[randomizationItem("r1")], between(3)],
    ]) {
      assert.equal(moveItems(plan, items, place).plan, plan, JSON.stringify(place));
    }
  });

  test("moveItems: a move that changes nothing on a plan whose randomizations aren't in column order gives the very same plan", () => {
    let plan = movingPlan();
    // r2 is added last but sits at the top, so the list ["r1", "r2"] isn't in column order.
    plan = addRandomization(plan, "1", { seed: 5, volume: 5 }).plan;
    assert.deepEqual(plan.randomizations.map((randomization) => randomization.id), ["r1", "r2"]);
    assert.equal(columnBoxes(plan)[0].id, "r2");
    const result = moveItems(plan, [stageItem("2")], inGroup(1, 2));
    assert.equal(result.plan, plan);
    assert.equal(result.plan.randomizations, plan.randomizations);
  });

  test("copyItems: a copied stage is a new stage with the same name, settings and transfers; the original stays", () => {
    const plan = movingPlan();
    const { plan: copied, placed } = copyItems(plan, [stageItem("2")], inGroup(1, 0));
    const newId = placed[0].id;
    assert.ok(!plan.stageList.has(newId));
    assert.deepEqual(stageContents(copied, newId), stageContents(plan, "2"));
    assert.deepEqual(groupsOf(copied).slice(0, 2), [
      [FIRST_TIPS, ["1", "2"]],
      [OTHER_TIPS, [newId, "3", "4"]],
    ]);
    assert.deepEqual(stageContents(copied, "2"), stageContents(plan, "2"));
  });

  test("copyItems: a copied tip group brings new stages with its tips", () => {
    const plan = movingPlan();
    const { plan: copied, placed } = copyItems(plan, [groupItem("3")], between(0));
    const [first, second] = stageOrder(copied);
    assert.deepEqual(placed, [groupItem(first)]);
    assert.deepEqual(groupsOf(copied)[0], [OTHER_TIPS, [first, second]]);
    assert.deepEqual(stageContents(copied, first), stageContents(plan, "3"));
    assert.deepEqual(stageContents(copied, second), stageContents(plan, "4"));
    assert.deepEqual(stageOrder(copied).slice(2, 6), ["1", "2", "3", "4"]);
  });

  test("copyItems: a copied randomization gets the next free ID and owns the copies of its stages", () => {
    const plan = movingPlan();
    const { plan: copied, placed } = copyItems(plan, [randomizationItem("r1")], between(1));
    assert.deepEqual(placed, [randomizationItem("r2")]);
    const copy = randomizationAt(copied, "r2");
    const original = randomizationAt(plan, "r1");
    for (const property of ["sources", "fill", "seed", "volume", "settings", "tipType", "probes"]) {
      assert.deepEqual(copy[property], original[property], property);
    }
    assert.deepEqual(copy.stages.map(({ labware, well }) => ({ labware, well })), original.stages.map(({ labware, well }) => ({ labware, well })));
    copy.stages.forEach((owned, index) => {
      assert.ok(!plan.stageList.has(owned.stage));
      assert.deepEqual(stageContents(copied, owned.stage), stageContents(plan, original.stages[index].stage));
    });
    assert.deepEqual(stageOrder(copied).slice(0, 4), ["1", "2", ...copy.stages.map((owned) => owned.stage)]);
    assert.equal(copy.beforeId, "3");
    assert.deepEqual(copied.randomizations.map((randomization) => randomization.id), ["r2", "r1"]);
    setRandomizations(copied, JSON.parse(JSON.stringify(copied.randomizations)));
  });

  test("copyItems: a copy of a randomization's stage is owned by none and keeps its own tips between boxes", () => {
    const plan = movingPlan();
    const { plan: copied, placed } = copyItems(plan, [stageItem("5")], between(0));
    const newId = placed[0].id;
    assert.equal(randomizationOf(copied, newId), null);
    assert.equal(stageOrder(copied)[0], newId);
    assert.deepEqual(
      { tipType: tipChangeAt(copied, START).tipType, probes: tipChangeAt(copied, START).probes },
      { tipType: tipChangeAt(plan, "5").tipType, probes: tipChangeAt(plan, "5").probes },
    );
  });

  test("copyOf gives plain data that survives JSON, and pasting it into another plan gives the same stages, tips and transfers", () => {
    const plan = movingPlan();
    const before = snapshot(plan);
    const copied = copyOf(plan, [groupItem("3")]);
    assert.equal(snapshot(plan), before);
    assert.equal(copied.format, "biomek-tools copied items");
    assert.equal(copied.version, 5);
    assert.equal(COPIED_ITEMS_FORMAT, copied.format);
    assert.equal(COPIED_ITEMS_VERSION, copied.version);
    const throughJson = JSON.parse(JSON.stringify(copied));
    assert.deepEqual(throughJson, copied);
    const other = emptyPlan().plan;
    const { plan: pasted } = pasteItems(other, throughJson, between(1));
    const newIds = stageOrder(pasted).slice(1);
    assert.deepEqual(newIds.map((id) => stageContents(pasted, id)), ["3", "4"].map((id) => stageContents(plan, id)));
    assert.deepEqual(groupsOf(pasted)[1], [OTHER_TIPS, newIds]);
  });

  test("items listed out of column order are taken in column order; a stage in a listed group is left out; twice counts once", () => {
    const plan = movingPlan();
    const { placed } = moveItems(
      plan,
      [stageItem("4"), groupItem("1"), stageItem("2"), stageItem("4")],
      between(3),
    );
    assert.deepEqual(placed, [groupItem("1"), stageItem("4")]);
    const copied = copyOf(plan, [stageItem("4"), stageItem("1")]);
    assert.deepEqual(copied.items.map((item) => item.stage.name), ["Media", "Wash"]);
  });

  test("moveItems, copyOf and copyItems refuse each wrong list, item and place, with the plan unchanged", () => {
    const plan = movingPlan();
    const before = snapshot(plan);
    const cases = [
      [() => moveItems(plan, 5, between(0)), "The things to move must be a list of stages, tip groups, randomizations or transfer tables, but got 5."],
      [() => copyOf(plan, []), "The things to copy must be a list of stages, tip groups, randomizations or transfer tables, but got an empty list."],
      [() => copyItems(plan, 5, between(0)), "The things to copy must be a list of stages, tip groups, randomizations or transfer tables, but got 5."],
      [
        () => moveItems(plan, [stageItem("1"), { kind: "box", id: "1" }], between(0)),
        'Item 2 must be { kind, id }, with kind "stage", "tipGroup", "randomization" or "transferTable", but got "box".',
      ],
      [() => moveItems(plan, [stageItem("9")], between(0)), 'There\'s no stage "9" in the plan.'],
      [() => moveItems(plan, [groupItem("2")], between(0)), 'Stage "2" doesn\'t start a tip group, so it can\'t name one.'],
      [() => moveItems(plan, [groupItem("5")], between(0)), 'Stage "5" doesn\'t start a tip group, so it can\'t name one.'],
      [() => moveItems(plan, [randomizationItem("r9")], between(0)), 'There\'s no randomization "r9" in the plan.'],
      [
        () => moveItems(plan, [stageItem("1")], between(9)),
        'The place must be between boxes (index 0 to 3), inside a tip group or inside a transfer table, but got {"kind":"between","index":9}.',
      ],
      [
        () => moveItems(plan, [stageItem("1")], { kind: "over", index: 0 }),
        'The place must be between boxes (index 0 to 3), inside a tip group or inside a transfer table, but got {"kind":"over","index":0}.',
      ],
      [() => moveItems(plan, [stageItem("1")], inGroup(1, 7)), "Box 1 has positions 0 to 2, but got 7."],
      [() => moveItems(plan, [stageItem("1")], inGroup(2, 0)), "Box 2 is a randomization: nothing can be put inside it."],
      [
        () => moveItems(plan, [groupItem("3")], inGroup(0, 1)),
        "A tip group or randomization can't go inside another tip group: put it between tip groups.",
      ],
      [
        () => copyItems(plan, [randomizationItem("r1")], inGroup(0, 1)),
        "A tip group or randomization can't go inside another tip group: put it between tip groups.",
      ],
      [
        () => moveItems(plan, [stageItem("5")], between(0)),
        `Stage 5, “${plan.stageList.get("5").name}”, belongs to a randomization, which moves its stages ` +
          "with it: move the whole randomization, or copy the stage.",
      ],
    ];
    for (const [action, message] of cases) {
      assert.throws(action, { message });
    }
    assert.equal(snapshot(plan), before);
    // Copying a randomization's stage is fine.
    copyItems(plan, [stageItem("5")], between(0));
  });

  test("moveItems checks the list, then each item, then the place, then the container rule, then a randomization's stage", () => {
    const plan = movingPlan();
    assert.throws(() => moveItems(plan, [stageItem("9")], between(9)), { message: 'There\'s no stage "9" in the plan.' });
    assert.throws(() => moveItems(plan, [groupItem("3")], inGroup(2, 0)), { message: /is a randomization/ });
    assert.throws(() => moveItems(plan, [stageItem("5"), groupItem("1")], inGroup(1, 0)), { message: /can't go inside/ });
  });

  // Copied items holding one stage of `stage` (a copied stage, { name, settings, transfers }) with
  // the START tips of a new plan.
  function copiedStageItems(stage) {
    return {
      format: "biomek-tools copied items",
      version: 1,
      items: [{ kind: "stage", stage, tips: startTips(), group: 1 }],
    };
  }

  // A copied stage: "Pasted", the default settings, and one transfer from trough 1 into PLATE A1.
  function copiedStage(changes = {}) {
    return {
      name: "Pasted",
      settings: defaultSettings(),
      transfers: [{ source: trough("1"), destination: plateWell("A1"), volume: 50 }],
      ...changes,
    };
  }

  test("pasteItems refuses what isn't copied items, a newer version, and an entry not in its form", () => {
    const plan = movingPlan();
    const notCopied = "Can't paste: this isn't stages, tip groups, randomizations or transfer tables copied from the transfer designer.";
    for (const copied of [
      "text",
      null,
      { format: "something else", version: 1, items: [] },
      { ...copiedStageItems(copiedStage()), items: [] },
      { ...copiedStageItems(copiedStage()), extra: 1 },
    ]) {
      assert.throws(() => pasteItems(plan, copied, between(0)), { message: notCopied });
    }
    assert.throws(() => pasteItems(plan, { ...copiedStageItems(copiedStage()), version: 6 }, between(0)), {
      message: "Can't paste: these were copied by a newer version of the tools (version 6).",
    });
    const second = { kind: "stage", stage: copiedStage(), tips: { tipType: FIRST_TIPS }, group: 2 };
    assert.throws(
      () => pasteItems(plan, { ...copiedStageItems(copiedStage()), items: [copiedStageItems(copiedStage()).items[0], second] }, between(0)),
      { message: "Can't paste: item 2 isn't a stage, tip group or randomization as the transfer designer copies them." },
    );
  });

  test("pasteItems checks every value with the edit that would make it, prefixed", () => {
    const plan = movingPlan();
    const before = snapshot(plan);
    const mixStep = addMixStep(emptyPlan().plan, null);
    const mixStepSettings = mixStep.plan.stageList.get(mixStep.id).settings;
    const nonMixingSettings = {
      ...defaultSettings(),
      ...modeSettings("destination", NON_MIXING_MODE.name),
      destinationMix: exampleMix(),
    };
    const cases = [
      [copiedStage({ transfers: [{ source: trough("1"), destination: plateWell("Z99"), volume: 50 }] }), `"Z99" isn't a well on ${PLATE}. Its wells are A1 to H12.`],
      [copiedStage({ name: " " }), null],
      [copiedStage({ settings: nonMixingSettings }), null],
      [
        copiedStage({
          transfers: [
            { source: trough("1"), destination: plateWell("A1"), volume: 50 },
            { source: plateWell("A1"), destination: plateWell("A2"), volume: 50 },
          ],
        }),
        null,
      ],
      [copiedStage({ settings: mixStepSettings }), null],
    ];
    for (const [stage, ownMessage] of cases) {
      let expected;
      try {
        // The message the edit itself gives, made on a plan with a stage to edit.
        const target = emptyPlan();
        let edited = renameStage(target.plan, target.stageId, stage.name);
        edited = changeStageSettings(edited, target.stageId, stage.settings);
        addTransfers(edited, stage.transfers.map((transfer) => ({ type: "transfer", ...transfer, stage: target.stageId })));
        assert.fail("the case should be refused");
      } catch (error) {
        expected = error.message;
      }
      if (ownMessage !== null) {
        assert.equal(expected, ownMessage);
      }
      const copied = { ...copiedStageItems(copiedStage()), items: [copiedStageItems(copiedStage()).items[0], { kind: "stage", stage, tips: startTips(), group: 2 }] };
      // Messages may name the stage by its ID or place and a transfer by its position, which differ
      // in the plan pasted into, so those numbers are left out of the comparison.
      const withoutPlaces = (message) =>
        message.replace(/Stage \d+,/g, "Stage N,").replace(/stage "\d+" \(operation \d+\)/g, 'stage "N"');
      assert.throws(
        () => pasteItems(plan, copied, between(0)),
        (error) => withoutPlaces(error.message) === withoutPlaces(`Can't paste: item 2: ${expected}`),
      );
    }
    assert.throws(
      () => pasteItems(plan, { ...copiedStageItems(copiedStage()), items: [{ kind: "stage", stage: copiedStage(), tips: { tipType: "BC9", probes: [1] }, group: 1 }] }, between(0)),
      { message: `Can't paste: item 1: "BC9" isn't a tip type. Choose one of ${TIP_TYPES.map((type) => `"${type}"`).join(", ")}.` },
    );
    assert.throws(
      () => pasteItems(plan, { ...copiedStageItems(copiedStage()), items: [{ kind: "stage", stage: copiedStage(), tips: { tipType: FIRST_TIPS, probes: [9] }, group: 1 }] }, between(0)),
      { message: /^Can't paste: item 1: Probe numbers must be whole numbers/ },
    );
    assert.equal(snapshot(plan), before);
  });

  test("pasteItems refuses a randomization's refused value, and two stages for one well", () => {
    const plan = movingPlan();
    const copied = copyOf(plan, [randomizationItem("r1")]);
    const badSeed = JSON.parse(JSON.stringify(copied));
    badSeed.items[0].randomization.seed = 0;
    assert.throws(() => pasteItems(plan, badSeed, between(0)), {
      message: /^Can't paste: item 1: A randomization's seed must be a whole number/,
    });
    const twice = JSON.parse(JSON.stringify(copied));
    twice.items[0].stages[1].well = twice.items[0].stages[0].well;
    assert.throws(() => pasteItems(plan, twice, between(0)), {
      message: `Can't paste: item 1: ${DEEP} A1 has two stages.`,
    });
  });

  test("pasteItems refuses a randomization whose stage is a mix step", () => {
    const plan = movingPlan();
    const copied = copyOf(plan, [randomizationItem("r1")]);
    // A mix step with no mixed wells, so its settings pass and only the randomization's rule refuses it.
    copied.items[0].stages[0].stage = {
      name: "Mix",
      settings: mixStepDefaults(),
      transfers: [],
    };
    assert.throws(() => pasteItems(plan, copied, between(0)), {
      message: `Can't paste: item 1: its stage for ${DEEP} A1 is a mix step.`,
    });
  });

  test("pasteItems checks the copied items before the place", () => {
    const plan = movingPlan();
    const copied = copyOf(plan, [stageItem("2")]);
    copied.items[0].stage.transfers[0].destination.well = "Z99";
    assert.throws(() => pasteItems(plan, copied, between(99)), {
      message: `Can't paste: item 1: "Z99" isn't a well on ${PLATE}. Its wells are A1 to H12.`,
    });
    assert.throws(() => pasteItems(plan, { format: "other" }, between(99)), {
      message: "Can't paste: this isn't stages, tip groups, randomizations or transfer tables copied from the transfer designer.",
    });
  });

  test("places pointing at moved things: within one tip group", () => {
    let plan = movingPlan();
    plan = addStage(plan, "5").plan; // "7", the third stage of the OTHER_TIPS group: [3, 4, 7]
    assert.deepEqual(columnBoxes(plan)[1].stages, ["3", "4", "7"]);
    for (const position of [0, 1, 2]) {
      assert.equal(moveItems(plan, [stageItem("3"), stageItem("4")], inGroup(1, position)).plan, plan, `position ${position}`);
    }
    // Position 1 is just before "4", the first stage there that isn't moving: where "3" already is.
    assert.equal(moveItems(plan, [stageItem("3")], inGroup(1, 1)).plan, plan);
    const moved = moveItems(plan, [stageItem("3")], inGroup(1, 2)).plan;
    assert.deepEqual(columnBoxes(moved)[1].stages, ["4", "3", "7"]);
    assert.equal(columnBoxes(moved)[1].key, "4");
    assert.equal(tipChangeAt(moved, "4").tipType, OTHER_TIPS);
  });

  test("places pointing at moved things: a tip group at or just below itself, and a lone stage at its group's index", () => {
    const plan = addTipChange(movingPlan(), "4");
    assert.equal(moveItems(plan, [groupItem("3")], between(1)).plan, plan);
    assert.equal(moveItems(plan, [groupItem("3")], between(2)).plan, plan);
    assert.equal(moveItems(plan, [stageItem("4")], between(2)).plan, plan);
  });

  test("a tip group's last stage moved between boxes just below its group splits it, with the same tips", () => {
    const plan = movingPlan();
    const { plan: moved } = moveItems(plan, [stageItem("4")], between(2));
    assert.notEqual(moved, plan);
    assert.deepEqual(groupsOf(moved).slice(1, 3), [
      [OTHER_TIPS, ["3"]],
      [OTHER_TIPS, ["4"]],
    ]);
  });

  test("moving the box a randomization that hasn't run sits before keeps the randomization in its place", () => {
    let plan = movingPlan();
    plan = addRandomization(plan, "3", { seed: 5, volume: 5 }).plan;
    const moved = moveItems(plan, [groupItem("3")], between(0)).plan;
    assert.deepEqual(
      columnBoxes(moved).map((box) => (box.kind === "tipGroup" ? box.key : box.id)),
      [START, "1", "r2", "r1"],
    );
    assert.equal(randomizationAt(moved, "r2").beforeId, "5");
    setRandomizations(moved, JSON.parse(JSON.stringify(moved.randomizations)));
  });

  test("the stage just after a run randomization keeps its own tips when stages around it move", () => {
    let plan = movingPlan();
    plan = addStageWithNewTips(plan, null).plan; // "7", just after the randomization
    plan = addStage(plan, null).plan; // "8", in 7's group
    const away = moveItems(plan, [stageItem("7")], inGroup(0, 0)).plan;
    assert.ok(Object.hasOwn(away.tipChanges, "8"));
    assert.equal(randomizationAt(away, "r1").beforeId, "8");
    const into = moveItems(plan, [stageItem("1")], inGroup(3, 0)).plan;
    assert.ok(Object.hasOwn(into.tipChanges, "1"));
    assert.equal(randomizationAt(into, "r1").beforeId, "1");
    for (const edited of [away, into]) {
      setRandomizations(edited, JSON.parse(JSON.stringify(edited.randomizations)));
    }
  });

  test("pasting at the top of the first tip group puts the stage first, on the START tips", () => {
    const plan = movingPlan();
    const { plan: pasted, placed } = pasteItems(plan, copyOf(plan, [stageItem("4")]), inGroup(0, 0));
    assert.equal(stageOrder(pasted)[0], placed[0].id);
    assert.equal(tipChangeAt(pasted, START).tipType, FIRST_TIPS);
    assert.equal(tipChangeAt(pasted, "1"), null);
  });

  test("a copied randomization with a stage left over from its last run keeps it, and passes setRandomizations", () => {
    const run = movingPlan();
    const dropped = setRandomization(run, "r1", {
      sources: randomizationAt(run, "r1").sources.filter((entry) => entry.well !== "A2"),
    });
    const copied = copyOf(dropped, [randomizationItem("r1")]);
    assert.equal(copied.items[0].stages.length, 2);
    const { plan: pasted } = pasteItems(dropped, copied, between(0));
    assert.equal(randomizationAt(pasted, "r2").stages.length, 2);
    setRandomizations(pasted, JSON.parse(JSON.stringify(pasted.randomizations)));
  });

  test("copies from two tip groups with the same tips paste as two tip groups, as moving them gives; from one tip group, as one", () => {
    // "3" gets FIRST_TIPS too, so both tip groups load the same tips.
    const plan = setTipType(movingPlan(), "3", FIRST_TIPS);
    const copied = copyOf(plan, [stageItem("2"), stageItem("3")]);
    assert.deepEqual(copied.items.map((item) => item.group), [1, 2]);
    const { plan: pasted, placed } = pasteItems(plan, copied, between(3));
    const ids = placed.map((item) => item.id);
    assert.deepEqual(groupsOf(pasted).slice(-2), [
      [FIRST_TIPS, [ids[0]]],
      [FIRST_TIPS, [ids[1]]],
    ]);
    const moved = moveItems(plan, [stageItem("2"), stageItem("3")], between(3)).plan;
    assert.deepEqual(groupsOf(moved).slice(-2), [
      [FIRST_TIPS, ["2"]],
      [FIRST_TIPS, ["3"]],
    ]);
    const fromOne = copyOf(plan, [stageItem("1"), stageItem("2")]);
    assert.deepEqual(fromOne.items.map((item) => item.group), [1, 1]);
    const { plan: joined, placed: joinedPlaced } = pasteItems(plan, fromOne, between(3));
    assert.deepEqual(groupsOf(joined).at(-1), [FIRST_TIPS, joinedPlaced.map((item) => item.id)]);
  });

  test("a run randomization's two stages, copied together, paste as two tip groups", () => {
    const plan = movingPlan();
    const copied = copyOf(plan, [stageItem("5"), stageItem("6")]);
    assert.deepEqual(copied.items.map((item) => item.group), [1, 2]);
    const { plan: pasted, placed } = pasteItems(plan, copied, between(0));
    assert.deepEqual(
      groupsOf(pasted).slice(0, 2).map(([, stages]) => stages),
      placed.map((item) => [item.id]),
    );
  });

  test("pasteItems refuses a stage entry whose group isn't a whole number from 1", () => {
    const plan = movingPlan();
    for (const group of [0, 1.5, "1", undefined]) {
      const copied = copyOf(plan, [stageItem("2")]);
      if (group === undefined) {
        delete copied.items[0].group;
      } else {
        copied.items[0].group = group;
      }
      assert.throws(() => pasteItems(plan, copied, between(0)), {
        message: "Can't paste: item 1 isn't a stage, tip group or randomization as the transfer designer copies them.",
      });
    }
  });

  test("a copied tip group pasted at the top of a new plan lands above New stage, which gets tips of its own", () => {
    const plan = movingPlan();
    const { plan: empty, stageId } = emptyPlan();
    const { plan: pasted } = pasteItems(empty, copyOf(plan, [groupItem("3")]), between(0));
    assert.equal(stageOrder(pasted).at(-1), stageId);
    assert.equal(pasted.stageList.get(stageId).name, NEW_STAGE_NAME);
    assert.deepEqual(tipChangeAt(pasted, stageId), tipChangeAt(empty, START));
    assert.equal(tipChangeAt(pasted, START).tipType, OTHER_TIPS);
  });

  test("moving a stage before the stage that fills its source makes a contents problem in it", () => {
    let { plan } = emptyPlan();
    plan = addComponent(plan, "Media", "#4e79a7");
    plan = addToWells(plan, [trough("1")], "Media", capacityOf(RESERVOIR));
    plan = renameStage(plan, "1", "Media");
    plan = addTransfer(plan, { type: "transfer", source: trough("1"), destination: trough("3"), volume: capacityOf(RESERVOIR) / 2, stage: "1" });
    plan = renameStage(addStage(plan, null).plan, "2", "Drug");
    plan = addTransfer(plan, { ...transferTo("2", "A1", 10), source: trough("3") });
    assert.equal(stagesWithContentsProblem(plan).size, 0);
    const { plan: moved } = moveItems(plan, [stageItem("2")], inGroup(0, 0));
    assert.deepEqual([...stagesWithContentsProblem(moved)], ["2"]);
  });

  test("placed lists the moved or pasted things in column order, copies by their new IDs", () => {
    const plan = movingPlan();
    assert.deepEqual(moveItems(plan, [randomizationItem("r1"), stageItem("4"), groupItem("1")], between(0)).placed, [
      groupItem("1"),
      stageItem("4"),
      randomizationItem("r1"),
    ]);
    const { placed } = copyItems(plan, [stageItem("4"), groupItem("1"), randomizationItem("r1")], between(3));
    assert.deepEqual(placed.map((item) => item.kind), ["tipGroup", "stage", "randomization"]);
    assert.deepEqual(placed.map((item) => item.id), ["7", "9", "r2"]);
  });

  test("moveItems changes only stageOrder, tipChanges, operationList and randomizations, and leaves its plan unchanged", () => {
    const plan = movingPlan();
    const before = snapshot(plan);
    const { plan: moved } = moveItems(plan, [groupItem("3")], between(0));
    assert.equal(snapshot(plan), before);
    for (const part of PLAN_PARTS.filter((name) => !["stageOrder", "tipChanges", "operationList", "randomizations"].includes(name))) {
      assert.equal(moved[part], plan[part], part);
    }
    assert.equal(moved.stageList, plan.stageList);
  });

  // --- Deleting (section 3, "Deleting"; tests/fixtures/delete-test-plan.js) ---

  // The tips of the test plan's groups, and its randomization's and transfer table's tip groups.
  const T1 = GROUP_TIPS[1];
  const T2 = GROUP_TIPS[2];
  const T3 = GROUP_TIPS[3];
  const T4 = GROUP_TIPS[4];
  const T6 = GROUP_TIPS[6];
  const RANDOMIZATION_GROUPS = [g(T4, "Drug A"), g(T4, "Drug B"), g(T4, "Media")];
  const TABLE_GROUPS = [g(TABLE_TIPS, "Media"), g(TABLE_TIPS, "Dye")];

  // A tip group as the deleting tests write it: its tips and its stages' short names.
  function g(tips, ...stages) {
    return { tips, stages };
  }

  // A stage's short name: S01 to S11 by their first word, other stages (a randomization's or
  // transfer table's) by their whole name.
  function shortName(plan, id) {
    const { name } = plan.stageList.get(id);
    return /^S\d\d /.test(name) ? name.slice(0, 3) : name;
  }

  // The plan's tip groups, in order, as g() writes them.
  function deleteGroupsOf(plan) {
    return tipGroups(plan).map((group) => g(
      { tipType: group.tipType, probes: group.probes },
      ...group.stages.map((id) => shortName(plan, id)),
    ));
  }

  // The test plan's own tip groups, written out.
  function fullGroups() {
    return [
      g(T1, "S01", "S02"),
      g(T2, "S03", "S04", "S05", "S06"),
      g(T3, "S07"),
      g(T4, "S08", "S09"),
      ...RANDOMIZATION_GROUPS,
      g(T6, "S10", "S11"),
      ...TABLE_GROUPS,
    ];
  }

  // Items of the test plan, by stage name (or first word): a stage, the tip group it starts, the
  // run randomization Randomization1, the transfer table, and owned stages by their place.
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
  function randomizationStage(plan, index) {
    return { kind: "stage", id: randomizationAt(plan, rz(plan).id).stages[index].stage };
  }
  function tableStage(plan, index) {
    return { kind: "stage", id: plan.transferTables[0].stages[index].stage };
  }

  // Asserts two plans are the same, part by part, the two lists through their own methods.
  function assertSamePlan(actual, expected) {
    for (const part of PLAN_PARTS) {
      const written = (plan) =>
        part === "operationList"
          ? plan.operationList.listOperations()
          : part === "stageList"
            ? plan.stageList.listStages()
            : plan[part];
      assert.deepEqual(written(actual), written(expected), part);
    }
  }

  // True if the plan has a transfer in stage `id`.
  function hasTransfersIn(plan, id) {
    return plan.operationList.listOperations().some((operation) => operation.stage === id);
  }

  // The test plan with an unrun randomization added before the stage called `name` (or, for null,
  // last), and that randomization's item.
  function withUnrunBefore(name) {
    const plan = deleteTestPlan();
    const beforeId = name === null ? null : stageIdOf(plan, name);
    const added = addRandomization(plan, beforeId, { seed: 3, volume: 10 });
    return { plan: added.plan, item: { kind: "randomization", id: added.id } };
  }

  test("deleteItems: the test plan has the tip groups the deleting tests start from", () => {
    assert.deepEqual(deleteGroupsOf(deleteTestPlan()), fullGroups());
  });

  test("deleteItems: a stage in the middle of a group goes with its transfers; its group keeps its tips", () => {
    const plan = deleteTestPlan();
    const s04 = stageIdOf(plan, "S04");
    const { plan: after, removed, deleted } = deleteItems(plan, [st(plan, "S04")]);
    assert.equal(after.stageList.has(s04), false);
    assert.equal(hasTransfersIn(after, s04), false);
    assert.deepEqual(deleteGroupsOf(after), [
      g(T1, "S01", "S02"), g(T2, "S03", "S05", "S06"), g(T3, "S07"), g(T4, "S08", "S09"),
      ...RANDOMIZATION_GROUPS, g(T6, "S10", "S11"), ...TABLE_GROUPS,
    ]);
    assert.equal(removed, 1);
    assert.deepEqual(deleted, [st(plan, "S04")]);
  });

  test("deleteItems: a group's first stage goes; the rest keep the group's tip type and probes, keyed by the next stage", () => {
    const plan = deleteTestPlan();
    const { plan: after } = deleteItems(plan, [st(plan, "S03")]);
    assert.deepEqual(deleteGroupsOf(after), [
      g(T1, "S01", "S02"), g(T2, "S04", "S05", "S06"), g(T3, "S07"), g(T4, "S08", "S09"),
      ...RANDOMIZATION_GROUPS, g(T6, "S10", "S11"), ...TABLE_GROUPS,
    ]);
    assert.deepEqual(tipChangeAt(after, stageIdOf(plan, "S04")), T2);
  });

  test("deleteItems: a mix step goes with its mixed wells", () => {
    const plan = deleteTestPlan();
    const s06 = stageIdOf(plan, "S06");
    assert.equal(hasTransfersIn(plan, s06), true);
    const { plan: after } = deleteItems(plan, [st(plan, "S06")]);
    assert.equal(hasTransfersIn(after, s06), false);
    assert.deepEqual(deleteGroupsOf(after), [
      g(T1, "S01", "S02"), g(T2, "S03", "S04", "S05"), g(T3, "S07"), g(T4, "S08", "S09"),
      ...RANDOMIZATION_GROUPS, g(T6, "S10", "S11"), ...TABLE_GROUPS,
    ]);
  });

  test("deleteItems: a lone group's stage takes its group and tip change with it; the next group is unchanged", () => {
    const plan = deleteTestPlan();
    const s07 = stageIdOf(plan, "S07");
    const { plan: after } = deleteItems(plan, [st(plan, "S07")]);
    assert.equal(tipChangeAt(after, s07), null);
    assert.deepEqual(deleteGroupsOf(after), [
      g(T1, "S01", "S02"), g(T2, "S03", "S04", "S05", "S06"), g(T4, "S08", "S09"),
      ...RANDOMIZATION_GROUPS, g(T6, "S10", "S11"), ...TABLE_GROUPS,
    ]);
  });

  test("deleteItems: the plan's first stage goes; the next is on the START tips, which keep their tip type and probes", () => {
    const plan = deleteTestPlan();
    const { plan: after } = deleteItems(plan, [st(plan, "S01")]);
    assert.deepEqual(tipChangeAt(after, START), T1);
    assert.deepEqual(deleteGroupsOf(after), [
      g(T1, "S02"), g(T2, "S03", "S04", "S05", "S06"), g(T3, "S07"), g(T4, "S08", "S09"),
      ...RANDOMIZATION_GROUPS, g(T6, "S10", "S11"), ...TABLE_GROUPS,
    ]);
  });

  test("deleteItems: S11, the last ordinary stage, goes; S10 is alone in its group", () => {
    const plan = deleteTestPlan();
    const { plan: after } = deleteItems(plan, [st(plan, "S11")]);
    assert.deepEqual(deleteGroupsOf(after), [
      g(T1, "S01", "S02"), g(T2, "S03", "S04", "S05", "S06"), g(T3, "S07"), g(T4, "S08", "S09"),
      ...RANDOMIZATION_GROUPS, g(T6, "S10"), ...TABLE_GROUPS,
    ]);
  });

  test("deleteItems: an ordinary tip group goes with every stage and its tip change; the groups either side are unchanged", () => {
    const plan = deleteTestPlan();
    const s03 = stageIdOf(plan, "S03");
    const { plan: after, removed, deleted } = deleteItems(plan, [tg(plan, "S03")]);
    assert.equal(tipChangeAt(after, s03), null);
    for (const name of ["S03", "S04", "S05", "S06"]) {
      assert.equal(after.stageList.has(stageIdOf(plan, name)), false, name);
    }
    assert.deepEqual(deleteGroupsOf(after), [
      g(T1, "S01", "S02"), g(T3, "S07"), g(T4, "S08", "S09"),
      ...RANDOMIZATION_GROUPS, g(T6, "S10", "S11"), ...TABLE_GROUPS,
    ]);
    assert.equal(removed, 4);
    assert.deepEqual(deleted, [tg(plan, "S03")]);
  });

  test("deleteItems: the first tip group goes; the next is first, on the START tips set to its own tip type and probes", () => {
    const plan = deleteTestPlan();
    const { plan: after } = deleteItems(plan, [tg(plan, "S01")]);
    assert.deepEqual(tipChangeAt(after, START), T2);
    assert.equal(tipChangeAt(after, stageIdOf(plan, "S03")), null);
    assert.deepEqual(deleteGroupsOf(after), [
      g(T2, "S03", "S04", "S05", "S06"), g(T3, "S07"), g(T4, "S08", "S09"),
      ...RANDOMIZATION_GROUPS, g(T6, "S10", "S11"), ...TABLE_GROUPS,
    ]);
  });

  test("deleteItems: a randomization goes with its three stages, as removeRandomization gives; S10 keeps its own tips", () => {
    const plan = deleteTestPlan();
    const { plan: after, removed, deleted } = deleteItems(plan, [rz(plan)]);
    assertSamePlan(after, removeRandomization(plan, rz(plan).id));
    assert.deepEqual(tipChangeAt(after, stageIdOf(plan, "S10")), T6);
    assert.equal(removed, 3);
    assert.deepEqual(deleted, [rz(plan)]);
  });

  test("deleteItems: a randomization that hasn't run goes and nothing else changes, removing no stages", () => {
    const { plan, item } = withUnrunBefore("S07");
    const { plan: after, removed, deleted } = deleteItems(plan, [item]);
    assertSamePlan(after, deleteTestPlan());
    assert.equal(removed, 0);
    assert.deepEqual(deleted, [item]);
  });

  test("deleteItems: a transfer table goes with its stages, as removeTransferTable gives", () => {
    const plan = deleteTestPlan();
    const { plan: after, removed } = deleteItems(plan, [tt(plan)]);
    assertSamePlan(after, removeTransferTable(plan, tt(plan).id));
    assert.deepEqual(deleteGroupsOf(after), [
      g(T1, "S01", "S02"), g(T2, "S03", "S04", "S05", "S06"), g(T3, "S07"), g(T4, "S08", "S09"),
      ...RANDOMIZATION_GROUPS, g(T6, "S10", "S11"),
    ]);
    assert.equal(removed, 2);
  });

  test("deleteItems: each kind alone is one edit, one PlanHistory record undoing it to the very same plan", () => {
    const plan = deleteTestPlan();
    const items = [
      st(plan, "S04"), st(plan, "S03"), st(plan, "S06"), st(plan, "S07"), st(plan, "S01"), st(plan, "S11"),
      tg(plan, "S03"), tg(plan, "S01"), rz(plan), tt(plan),
    ];
    for (const item of items) {
      const history = new PlanHistory({ plan }).record({ plan: deleteItems(plan, [item]).plan });
      assert.equal(history.undo().present.plan, plan, JSON.stringify(item));
    }
  });

  // The "Mixed and scattered" cases: a name, the items (from the test plan), the tip groups left,
  // and the stages removed.
  const MIXED_CASES = [
    [
      "S02 and S05, from two groups",
      (plan) => [st(plan, "S02"), st(plan, "S05")],
      [g(T1, "S01"), g(T2, "S03", "S04", "S06"), g(T3, "S07"), g(T4, "S08", "S09"), ...RANDOMIZATION_GROUPS, g(T6, "S10", "S11"), ...TABLE_GROUPS],
      2,
    ],
    [
      "S02 and S03, either side of a group boundary",
      (plan) => [st(plan, "S02"), st(plan, "S03")],
      [g(T1, "S01"), g(T2, "S04", "S05", "S06"), g(T3, "S07"), g(T4, "S08", "S09"), ...RANDOMIZATION_GROUPS, g(T6, "S10", "S11"), ...TABLE_GROUPS],
      2,
    ],
    [
      "S03 and S04, a group's first two",
      (plan) => [st(plan, "S03"), st(plan, "S04")],
      [g(T1, "S01", "S02"), g(T2, "S05", "S06"), g(T3, "S07"), g(T4, "S08", "S09"), ...RANDOMIZATION_GROUPS, g(T6, "S10", "S11"), ...TABLE_GROUPS],
      2,
    ],
    [
      "S07, S08 and S09, a lone group and the whole next group",
      (plan) => [st(plan, "S07"), st(plan, "S08"), st(plan, "S09")],
      [g(T1, "S01", "S02"), g(T2, "S03", "S04", "S05", "S06"), ...RANDOMIZATION_GROUPS, g(T6, "S10", "S11"), ...TABLE_GROUPS],
      3,
    ],
    [
      "S01, S03's tip group and the randomization",
      (plan) => [st(plan, "S01"), tg(plan, "S03"), rz(plan)],
      [g(T1, "S02"), g(T3, "S07"), g(T4, "S08", "S09"), g(T6, "S10", "S11"), ...TABLE_GROUPS],
      8,
    ],
    [
      "S06, S11 and the transfer table",
      (plan) => [st(plan, "S06"), st(plan, "S11"), tt(plan)],
      [g(T1, "S01", "S02"), g(T2, "S03", "S04", "S05"), g(T3, "S07"), g(T4, "S08", "S09"), ...RANDOMIZATION_GROUPS, g(T6, "S10")],
      4,
    ],
    [
      "S09 and S10, either side of the randomization",
      (plan) => [st(plan, "S09"), st(plan, "S10")],
      [g(T1, "S01", "S02"), g(T2, "S03", "S04", "S05", "S06"), g(T3, "S07"), g(T4, "S08"), ...RANDOMIZATION_GROUPS, g(T6, "S11"), ...TABLE_GROUPS],
      2,
    ],
  ];

  // The plan after `items` are removed one edit at a time, as section 3, "Deleting", says:
  // randomizations and transfer tables first, in column order, then the stages left, in column
  // order (a tip group's stages each), with removeRandomization, removeTransferTable and removeStage.
  function removedOneByOne(plan, items) {
    let removing = plan;
    for (const item of items.filter((entry) => entry.kind === "randomization")) {
      removing = removeRandomization(removing, item.id);
    }
    for (const item of items.filter((entry) => entry.kind === "transferTable")) {
      removing = removeTransferTable(removing, item.id);
    }
    const groups = tipGroups(plan);
    const stages = items.flatMap((item) => {
      if (item.kind === "stage") {
        return [item.id];
      }
      return item.kind === "tipGroup" ? groups.find((group) => group.stages[0] === item.id).stages : [];
    });
    for (const id of stages) {
      removing = removeStage(removing, id);
    }
    return removing;
  }

  for (const [name, itemsOf, expected, count] of MIXED_CASES) {
    test(`deleteItems, mixed and scattered: ${name}: the stages and tips left, the stages removed, the items deleted`, () => {
      const plan = deleteTestPlan();
      const before = snapshot(plan);
      const items = itemsOf(plan);
      const { plan: after, removed, deleted } = deleteItems(plan, items);
      assert.deepEqual(deleteGroupsOf(after), expected);
      assert.equal(removed, count);
      assert.deepEqual(deleted, items);
      assert.equal(snapshot(plan), before);
    });

    test(`deleteItems, mixed and scattered: ${name}: the same outline and Biomek output as the removals one by one`, () => {
      const plan = deleteTestPlan();
      const items = itemsOf(plan);
      const { plan: after } = deleteItems(plan, items);
      const oneByOne = removedOneByOne(plan, items);
      assert.deepEqual(planOutline(after), planOutline(oneByOne));
      assert.deepEqual(biomekOutput(after), biomekOutput(oneByOne));
    });
  }

  test("deleteItems: S09 and S10 either side of the randomization leave its place and tips as removeStage does, the stage after it on tips of its own", () => {
    const plan = deleteTestPlan();
    const s11 = stageIdOf(plan, "S11");
    const { plan: after } = deleteItems(plan, [st(plan, "S09"), st(plan, "S10")]);
    const viaRemoveStage = removeStage(removeStage(plan, stageIdOf(plan, "S09")), stageIdOf(plan, "S10"));
    assert.equal(randomizationAt(after, rz(plan).id).beforeId, randomizationAt(viaRemoveStage, rz(plan).id).beforeId);
    assert.equal(randomizationAt(after, rz(plan).id).beforeId, s11);
    assert.deepEqual(tipChangeAt(after, s11), T6);
    assert.deepEqual(after.tipChanges, viaRemoveStage.tipChanges);
  });

  test("deleteItems: an unrun randomization before S07 moves to S08 when S07 is deleted, as through removeStage", () => {
    const { plan, item } = withUnrunBefore("S07");
    const { plan: after } = deleteItems(plan, [st(plan, "S07")]);
    const s08 = stageIdOf(plan, "S08");
    assert.equal(randomizationAt(after, item.id).beforeId, s08);
    assert.equal(randomizationAt(removeStage(plan, stageIdOf(plan, "S07")), item.id).beforeId, s08);
  });

  test("deleteItems: an unrun randomization before S07, with S07's and S08's tip groups deleted, sits before the run randomization's first stage, as through removeStage", () => {
    const { plan, item } = withUnrunBefore("S07");
    const { plan: after } = deleteItems(plan, [tg(plan, "S07"), tg(plan, "S08")]);
    const firstOwned = randomizationStage(plan, 0).id;
    assert.equal(randomizationAt(after, item.id).beforeId, firstOwned);
    let oneByOne = plan;
    for (const name of ["S07", "S08", "S09"]) {
      oneByOne = removeStage(oneByOne, stageIdOf(plan, name));
    }
    assert.equal(randomizationAt(oneByOne, item.id).beforeId, firstOwned);
  });

  test("deleteItems: an unrun randomization before S03, with S03's tip group deleted, sits before S07, as through removeStage", () => {
    const { plan, item } = withUnrunBefore("S03");
    const { plan: after } = deleteItems(plan, [tg(plan, "S03")]);
    const s07 = stageIdOf(plan, "S07");
    assert.equal(randomizationAt(after, item.id).beforeId, s07);
    let oneByOne = plan;
    for (const name of ["S03", "S04", "S05", "S06"]) {
      oneByOne = removeStage(oneByOne, stageIdOf(plan, name));
    }
    assert.equal(randomizationAt(oneByOne, item.id).beforeId, s07);
  });

  test("deleteItems: an unrun randomization before the transfer table's first stage sits last when the table is deleted, as removeTransferTable leaves it", () => {
    const plan = deleteTestPlan();
    const added = addRandomization(plan, tableStage(plan, 0).id, { seed: 3, volume: 10 });
    const { plan: after } = deleteItems(added.plan, [tt(added.plan)]);
    assert.equal(randomizationAt(after, added.id).beforeId, null);
    assert.equal(randomizationAt(removeTransferTable(added.plan, tt(added.plan).id), added.id).beforeId, null);
  });

  test("deleteItems of each stage removeStage can remove gives the same plan as removeStage, removing 1", () => {
    const plan = deleteTestPlan();
    const ordinary = plan.stageOrder.filter(
      (id) => randomizationOf(plan, id) === null && transferTableOf(plan, id) === null,
    );
    assert.equal(ordinary.length, 11);
    for (const id of ordinary) {
      const { plan: after, removed } = deleteItems(plan, [{ kind: "stage", id }]);
      assertSamePlan(after, removeStage(plan, id));
      assert.equal(removed, 1, id);
    }
  });

  test("deleteItems: the Biomek files can be written after every mixed case", () => {
    for (const [name, itemsOf] of MIXED_CASES) {
      const plan = deleteTestPlan();
      assert.doesNotThrow(() => biomekOutput(deleteItems(plan, itemsOf(plan)).plan), name);
    }
  });

  test("deleteItems: items given out of column order are deleted in column order", () => {
    const plan = deleteTestPlan();
    const { deleted, removed } = deleteItems(plan, [tt(plan), st(plan, "S02"), tg(plan, "S03")]);
    assert.deepEqual(deleted, [st(plan, "S02"), tg(plan, "S03"), tt(plan)]);
    assert.equal(removed, 7);
  });

  test("deleteItems: a stage of a listed tip group, randomization or transfer table is left out of deleted and not counted twice; an item listed twice counts once", () => {
    const plan = deleteTestPlan();
    const inGroup = deleteItems(plan, [st(plan, "S04"), tg(plan, "S03")]);
    assert.deepEqual(inGroup.deleted, [tg(plan, "S03")]);
    assert.equal(inGroup.removed, 4);
    const inRandomization = deleteItems(plan, [randomizationStage(plan, 1), rz(plan)]);
    assert.deepEqual(inRandomization.deleted, [rz(plan)]);
    assert.equal(inRandomization.removed, 3);
    const inTable = deleteItems(plan, [tableStage(plan, 0), tt(plan)]);
    assert.deepEqual(inTable.deleted, [tt(plan)]);
    assert.equal(inTable.removed, 2);
    for (const { stage } of plan.transferTables[0].stages) {
      assert.equal(inTable.plan.stageList.has(stage), false);
    }
    const twice = deleteItems(plan, [st(plan, "S04"), st(plan, "S04")]);
    assert.deepEqual(twice.deleted, [st(plan, "S04")]);
    assert.equal(twice.removed, 1);
  });

  // The refusal messages for the test plan's owned stages: Drug A is stage 10 and Drug B stage 11
  // (after S01 to S09); the transfer table's Media is stage 15 (after the randomization's three
  // stages and S10 and S11).
  const DRUG_A_REFUSAL = "Stage 10, “Drug A”, belongs to a randomization: delete the whole randomization, or change it in its card.";
  const DRUG_B_REFUSAL = "Stage 11, “Drug B”, belongs to a randomization: delete the whole randomization, or change it in its card.";
  const TABLE_MEDIA_REFUSAL = "Stage 15, “Media”, belongs to a transfer table: delete the whole transfer table, or change it in its wizard.";
  const EVERY_STAGE_REFUSAL = "That's every stage in the plan, and a plan needs at least one. Leave one stage, or add a new one first.";

  test("deleteItems refuses a randomization's stage alone, or with other things, and a transfer table's stage alone, the plan unchanged", () => {
    const plan = deleteTestPlan();
    const before = snapshot(plan);
    assert.throws(() => deleteItems(plan, [randomizationStage(plan, 0)]), { message: DRUG_A_REFUSAL });
    assert.throws(() => deleteItems(plan, [st(plan, "S02"), randomizationStage(plan, 0), tg(plan, "S03")]), {
      message: DRUG_A_REFUSAL,
    });
    assert.throws(() => deleteItems(plan, [tableStage(plan, 0)]), { message: TABLE_MEDIA_REFUSAL });
    assert.equal(snapshot(plan), before);
  });

  test("deleteItems with a randomization's and a transfer table's stage names the first in column order, the randomization's", () => {
    const plan = deleteTestPlan();
    assert.throws(() => deleteItems(plan, [tableStage(plan, 0), randomizationStage(plan, 1)]), {
      message: DRUG_B_REFUSAL,
    });
  });

  test("deleteItems refuses every stage of the plan: every item listed; every tip group, the randomization and the table; a plan of one stage", () => {
    const plan = deleteTestPlan();
    const before = snapshot(plan);
    const everyStage = [
      ...plan.stageOrder
        .filter((id) => randomizationOf(plan, id) === null && transferTableOf(plan, id) === null)
        .map((id) => ({ kind: "stage", id })),
      rz(plan),
      tt(plan),
    ];
    assert.throws(() => deleteItems(plan, everyStage), { message: EVERY_STAGE_REFUSAL });
    const everyGroup = [
      ...["S01", "S03", "S07", "S08", "S10"].map((name) => tg(plan, name)),
      rz(plan),
      tt(plan),
    ];
    assert.throws(() => deleteItems(plan, everyGroup), { message: EVERY_STAGE_REFUSAL });
    assert.equal(snapshot(plan), before);
    const single = planWithStages(1);
    assert.throws(() => deleteItems(single, [{ kind: "stage", id: "1" }]), { message: EVERY_STAGE_REFUSAL });
    assert.throws(() => deleteItems(single, [{ kind: "tipGroup", id: "1" }]), { message: EVERY_STAGE_REFUSAL });
  });

  test("deleteItems gives moveItems' list and item messages, with delete", () => {
    const plan = deleteTestPlan();
    const s04 = stageIdOf(plan, "S04");
    const cases = [
      [5, "The things to delete must be a list of stages, tip groups, randomizations or transfer tables, but got 5."],
      [[], "The things to delete must be a list of stages, tip groups, randomizations or transfer tables, but got an empty list."],
      [
        [{ kind: "box", id: "1" }],
        `Item 1 must be { kind, id }, with kind "stage", "tipGroup", "randomization" or "transferTable", but got "box".`,
      ],
      [[{ kind: "stage", id: "99" }], `There's no stage "99" in the plan.`],
      [[{ kind: "tipGroup", id: s04 }], `Stage ${describeValue(s04)} doesn't start a tip group, so it can't name one.`],
    ];
    for (const [items, message] of cases) {
      assert.throws(() => deleteItems(plan, items), { message });
      // copyOf checks the list and items the same way, with its own verb.
      if (typeof items === "object" && items.length > 0) {
        assert.throws(() => copyOf(plan, items), { message });
      }
    }
    // A randomization or transfer table that isn't there: the same message as moveItems'.
    for (const missing of [{ kind: "randomization", id: "r9" }, { kind: "transferTable", id: "t9" }]) {
      let moveMessage = null;
      try {
        moveItems(plan, [missing], between(0));
      } catch (error) {
        moveMessage = error.message;
      }
      assert.notEqual(moveMessage, null);
      assert.throws(() => deleteItems(plan, [missing]), { message: moveMessage });
    }
  });

  test("deleteItems checks in order: a bad item before an owned stage; an owned stage before every stage", () => {
    const plan = deleteTestPlan();
    assert.throws(() => deleteItems(plan, [randomizationStage(plan, 0), { kind: "stage", id: "99" }]), {
      message: `There's no stage "99" in the plan.`,
    });
    const everyOrdinaryAndOwned = [
      ...plan.stageOrder.filter((id) => transferTableOf(plan, id) === null).map((id) => ({ kind: "stage", id })),
      tt(plan),
    ];
    assert.throws(() => deleteItems(plan, everyOrdinaryAndOwned), { message: DRUG_A_REFUSAL });
  });

  test("deleteItems doesn't refuse: a plan left with one stage; only an unrun randomization", () => {
    const plan = deleteTestPlan();
    const allButS11 = [
      ...["S01", "S03", "S07", "S08"].map((name) => tg(plan, name)),
      rz(plan),
      st(plan, "S10"),
      tt(plan),
    ];
    const { plan: after, removed } = deleteItems(plan, allButS11);
    assert.deepEqual(deleteGroupsOf(after), [g(T6, "S11")]);
    assert.equal(removed, plan.stageOrder.length - 1);
    const { plan: lone, id } = addRandomization(planWithStages(1), null, { seed: 1, volume: 5 });
    const unrunOnly = deleteItems(lone, [{ kind: "randomization", id }]);
    assert.deepEqual(unrunOnly.plan.randomizations, []);
    assert.equal(unrunOnly.removed, 0);
  });

  // --- Immutability and sharing ---

  // Each edit, made on a plan with something in every part, and the parts it may change.
  const EDITS = [
    ["addStage", (plan) => addStage(plan, "2").plan, ["stageList", "stageOrder"]],
    ["addMixStep", (plan) => addMixStep(plan, "2").plan, ["stageList", "stageOrder"]],
    [
      "addMixStep, taking tips",
      (plan) => addMixStep(plan, "2", { takeTips: true }).plan,
      ["stageList", "stageOrder", "tipChanges"],
    ],
    [
      "addStageWithNewTips",
      (plan) => addStageWithNewTips(plan, "3").plan,
      ["stageList", "stageOrder", "tipChanges"],
    ],
    [
      "addMixStepWithNewTips",
      (plan) => addMixStepWithNewTips(plan, "3").plan,
      ["stageList", "stageOrder", "tipChanges"],
    ],
    ["mixWells", (plan) => mixWells(plan, mixStepOf(plan), [plateWell("H1")]), ["operationList"]],
    ["unmixWell", (plan) => unmixWell(plan, mixStepOf(plan), plateWell("A1")), ["operationList"]],
    ["renameStage", (plan) => renameStage(plan, "1", "Seeding"), ["stageList"]],
    ["changeStageSettings", (plan) => changeStageSettings(plan, "1", otherSettings()), ["stageList"]],
    ["setStageMix", (plan) => setStageMix(plan, "1", "source", exampleMix()), ["stageList"]],
    ["removeStage", (plan) => removeStage(plan, "3"), ["operationList", "stageList", "stageOrder", "tipChanges"]],
    ["addTransfer", (plan) => addTransfer(plan, transferTo("1", "C1")), ["operationList"]],
    ["changeVolume", (plan) => changeVolume(plan, 0, 25), ["operationList"]],
    ["removeTransfer", (plan) => removeTransfer(plan, 0), ["operationList"]],
    ["addTipChange", (plan) => addTipChange(plan, "3"), ["tipChanges"]],
    ["setTipType", (plan) => setTipType(plan, "2", TIP_TYPES.at(-1)), ["tipChanges"]],
    ["setTipProbes", (plan) => setTipProbes(plan, "2", [1]), ["tipChanges"]],
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
    ["setWellLabel", (plan) => setWellLabel(plan, plateWell("A2"), "Cond 2"), ["wellLabels"]],
    ["setWellLabels", (plan) => setWellLabels(plan, { [PLATE]: { A3: "Cond 3" } }), ["wellLabels"]],
    [
      "addRandomization",
      (plan) => addRandomization(plan, "2", { seed: 5, volume: 5 }).plan,
      ["randomizations"],
    ],
    ["setRandomization", (plan) => setRandomization(plan, "r1", { seed: 99 }), ["randomizations"]],
    [
      "placeRandomization",
      (plan) => placeRandomization(addRandomization(plan, "2", { seed: 5, volume: 5 }).plan, "r2", "1"),
      ["randomizations"],
    ],
    [
      "runRandomization",
      (plan) => runRandomization(setRandomization(plan, "r1", { seed: 99, volume: 7 }), "r1"),
      ["randomizations", "stageList", "stageOrder", "operationList", "tipChanges"],
    ],
    [
      "runRandomization with forAll",
      (plan) =>
        runRandomization(plan, "r1", {
          destinationMode: OTHER_DESTINATION_MODE,
          sourceMixes: true,
          tipType: TIP_TYPES.at(-1),
          probes: [1, 2],
        }),
      ["randomizations", "stageList", "operationList", "tipChanges"],
    ],
    [
      "removeRandomization",
      (plan) => removeRandomization(plan, "r1"),
      ["randomizations", "stageList", "stageOrder", "operationList", "tipChanges"],
    ],
    [
      "moveItems",
      (plan) => moveItems(plan, [{ kind: "tipGroup", id: "2" }], { kind: "between", index: 0 }).plan,
      ["stageOrder", "tipChanges", "operationList", "randomizations"],
    ],
    [
      "copyItems",
      (plan) => copyItems(plan, [{ kind: "stage", id: "2" }], { kind: "between", index: 0 }).plan,
      ["stageList", "stageOrder", "tipChanges", "operationList", "randomizations"],
    ],
    [
      "pasteItems",
      (plan) =>
        pasteItems(plan, copyOf(plan, [{ kind: "randomization", id: "r1" }]), { kind: "between", index: 1 }).plan,
      ["stageList", "stageOrder", "tipChanges", "operationList", "randomizations"],
    ],
    [
      "deleteItems",
      (plan) => deleteItems(plan, [{ kind: "stage", id: "3" }, { kind: "randomization", id: "r1" }]).plan,
      ["operationList", "stageList", "stageOrder", "tipChanges", "randomizations", "transferTables"],
    ],
    [
      "moveWell",
      (plan) => moveWell(plan, trough("1"), trough("12")),
      ["startingContents", "operationList", "wellLabels", "randomizations"],
    ],
  ];

  // A plan with something in every part: components and starting contents, stages 1 and 2 with
  // transfers, stage 3 without, a mix step mixing PLATE A1, a tip change before stage 2, a
  // label, a well label, an experiment name, and, last, a randomization "r1" that has run.
  function fullPlan() {
    let plan = withTransfersIn(planWithContents(), ["1"]);
    plan = addStage(plan, null).plan;
    plan = addStage(plan, null).plan;
    plan = addTransfer(plan, transferTo("2", "B1"));
    const { plan: withMixStep, id: mixStep } = addMixStep(plan, null);
    plan = mixWells(withMixStep, mixStep, [plateWell("A1")]);
    plan = addTipChange(plan, "2");
    plan = setLabel(plan, OTHER_PLATE, "Drug plate");
    plan = setWellLabel(plan, plateWell("A1"), "Cond 1");
    plan = setExperimentName(plan, "Exp36");
    plan = addRandomization(plan, null, { seed: 37, volume: 5 }).plan;
    plan = setRandomization(plan, "r1", {
      sources: [trough("1"), trough("2")].map((end) => ({ ...end, replicates: 2, filler: false, sharesTips: false })),
      fill: [...GRID_96.wellsInBox("D1", "D4")].map(plateWell),
    });
    return runRandomization(plan, "r1");
  }

  // The ID of the mix step in a plan made by fullPlan().
  function mixStepOf(plan) {
    return stageOrder(plan).find((id) => isMixStep(plan, id));
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
  // has one transfer, stage 2 has one, and stage 3 has none. (Its run randomization is last, so
  // addStage can't add last without joining its tips since 2026-11-05, item 20: it adds just
  // before it instead.)
  const ORDER_EDITS = [
    [
      "addStage, just before the randomization",
      (plan) => addStage(plan, randomizationAt(plan, "r1").stages[0].stage).plan,
    ],
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
    ["addMixStep before the first, taking tips", (plan) => addMixStep(plan, "1", { takeTips: true }).plan],
    [
      "mixWells, the first of a mix step added in the middle",
      (plan) => {
        const { plan: added, id } = addMixStep(plan, "2");
        return mixWells(added, id, [plateWell("C6"), plateWell("C7")]);
      },
    ],
    ["removeStage, a mix step", (plan) => removeStage(plan, mixStepOf(plan))],
    ["addStageWithNewTips before the first", (plan) => addStageWithNewTips(plan, "1").plan],
    ["addMixStepWithNewTips, last", (plan) => addMixStepWithNewTips(plan, null).plan],
    ["addStageWithNewTips, last", (plan) => addStageWithNewTips(plan, null).plan],
    [
      "runRandomization, a source added and one taken out",
      (plan) => {
        const sources = [trough("2"), trough("3")].map((end) => ({ ...end, replicates: 2, filler: false, sharesTips: false }));
        return runRandomization(setRandomization(plan, "r1", { sources }), "r1");
      },
    ],
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

  // --- Transfer tables (transfer-designer.md, section 6, "Transfer tables") ---

  // The usable volume of a well holding `held` µL on `labware`, from config/labware-types.js's dead
  // volumes, so these tests never name a dead volume.
  function usableOf(labware, held) {
    return held - deadVolumeOf(labware);
  }

  // The sources form message (section 5), ending with `got`, the value named as describeValue names
  // it, e.g. sourcesFormMessage("5").
  function sourcesFormMessage(got) {
    return (
      "A transfer table's sources must be an object of names (a component or a well label), each with a " +
      `list of wells, like { Media: [{ labware: "Res1", well: "1" }] }, but got ${got}.`
    );
  }

  // The test plan: components Media, Drug A and DMSO; Res1 1 holding Media 3,000 µL, Res1 2 Media
  // 10,000 µL, Deep1 A1 Drug A 1,000 µL, Deep1 A3 DMSO 1,000 µL, Deep1 A4 Media and DMSO (a mix);
  // Plate1 A1 to A3 labeled "Control", B1 to B3 "A low"; one stage, "New stage".
  function tablePlan() {
    let { plan } = emptyPlan();
    plan = addComponent(plan, "Media", "#4e79a7");
    plan = addComponent(plan, "Drug A", "#e15759");
    plan = addComponent(plan, "DMSO", "#59a14f");
    plan = addToWells(plan, [trough("1")], "Media", 3000);
    plan = addToWells(plan, [trough("2")], "Media", 10000);
    plan = addToWells(plan, [deepWell("A1")], "Drug A", 1000);
    plan = addToWells(plan, [deepWell("A3")], "DMSO", 1000);
    plan = addToWells(plan, [deepWell("A4")], "Media", 500);
    plan = addToWells(plan, [deepWell("A4")], "DMSO", 500);
    for (const well of ["A1", "A2", "A3"]) {
      plan = setWellLabel(plan, plateWell(well), "Control");
    }
    for (const well of ["B1", "B2", "B3"]) {
      plan = setWellLabel(plan, plateWell(well), "A low");
    }
    return plan;
  }

  // The example table: Media into both rows, Drug A into "A low", DMSO blank everywhere. A new
  // grid each time.
  function exampleTable() {
    return [
      ["Dest Well Label", "Media", "Drug A", "DMSO"],
      ["Control", "190", "", ""],
      ["A low", "190", "2", ""],
    ];
  }

  // The example draft: the example table, Media from Res1 1 then Res1 2, Drug A from Deep1 A1.
  function exampleDraft() {
    return { table: exampleTable(), sources: { Media: [trough("1"), trough("2")], "Drug A": [deepWell("A1")] } };
  }

  // The test plan with the example draft added before stage `beforeId` (default: at the end):
  // { plan, id }.
  function withExampleTable(plan = tablePlan(), beforeId = null) {
    return addTransferTable(plan, exampleDraft(), beforeId);
  }

  // The stage IDs a transfer table owns, in order, e.g. ["2", "3"].
  function tableStages(plan, id) {
    return transferTableAt(plan, id).stages.map((owned) => owned.stage);
  }

  // A draft from a stored transfer table, to edit and update, e.g. draftOf(plan, "t1").
  function draftOf(plan, id) {
    const { table, sources } = transferTableAt(plan, id);
    return { table: table.map((row) => [...row]), sources: { ...sources } };
  }

  // A transfer's source, destination and volume, e.g. for comparing transfers.
  function outlineOf({ source, destination, volume }) {
    return { source: { ...source }, destination: { ...destination }, volume };
  }

  // A stage's transfers as outlines.
  function outlinesIn(plan, stage) {
    return transfersIn(plan, stage).map(outlineOf);
  }

  // A place inside the transfer table that is box `index`, before its stage at `position`.
  function inTable(index, position) {
    return { kind: "inTransferTable", index, position };
  }

  // The index of transfer table `id`'s box in the column.
  function tableBoxIndex(plan, id) {
    return columnBoxes(plan).findIndex((box) => box.kind === "transferTable" && box.id === id);
  }

  // A plan whose transfer table holds three stages (Media, Drug A and DMSO), added at the end, with
  // a blank-header column and a column making no stage among its columns: { plan, id }.
  function threeStageTablePlan() {
    const table = [
      ["Label", "Media", "", "Drug A", "DMSO"],
      ["Control", "190", "", "", "5"],
      ["A low", "190", "", "2", "5"],
    ];
    const sources = { Media: [trough("1"), trough("2")], "Drug A": [deepWell("A1")], DMSO: [deepWell("A3")] };
    return addTransferTable(tablePlan(), { table, sources }, null);
  }

  test("readTransferTable reads one column per component, each amount's wells in deck order, trimming cells", () => {
    const plan = tablePlan();
    const { columns, problems } = readTransferTable(plan, [
      [" Label ", " Media ", "Drug A", "DMSO"],
      [" Control ", " 1,500 ", "2.5", ""],
      ["A low", "0", ".5", "0.0"],
    ]);
    assert.deepEqual(problems, []);
    assert.deepEqual(columns, [
      {
        column: 1,
        component: "Media",
        isComponent: true,
        labelWells: [],
        amounts: [{ row: 1, label: "Control", wells: ["A1", "A2", "A3"].map(plateWell), volume: 1500 }],
      },
      {
        column: 2,
        component: "Drug A",
        isComponent: true,
        labelWells: [],
        amounts: [
          { row: 1, label: "Control", wells: ["A1", "A2", "A3"].map(plateWell), volume: 2.5 },
          { row: 2, label: "A low", wells: ["B1", "B2", "B3"].map(plateWell), volume: 0.5 },
        ],
      },
      { column: 3, component: "DMSO", isComponent: true, labelWells: [], amounts: [] },
    ]);
  });

  test("readTransferTable: a label's wells come in deck order, whatever order they were labeled in", () => {
    let plan = tablePlan();
    plan = setWellLabel(plan, deepWell("H12"), "Control");
    plan = setWellLabel(plan, plateWell("H1"), "Control");
    const { columns } = readTransferTable(plan, [["L", "Media"], ["Control", "10"]]);
    assert.deepEqual(columns[0].amounts[0].wells, [
      ...["A1", "A2", "A3", "H1"].map(plateWell),
      deepWell("H12"),
    ]);
  });

  test("readTransferTable gives each reading problem with its row, column and message, in reading order", () => {
    const plan = tablePlan();
    const { problems } = readTransferTable(plan, [
      ["L", "Drug C", "Media", "Media", "", ""],
      ["Control", "lots", "-5", "x", "", "3"],
      ["", "1", "1", "1", "", ""],
      ["Control", "1", "1", "1", "", ""],
      ["Cond 9", "1", "1", "1", "", ""],
      ["A low", "1", "1e3", "1", "", ""],
      ["A low2", "1", "5 µL", "1", "", ""],
    ]);
    assert.deepEqual(problems, [
      { row: 0, column: 1, message: "“Drug C” isn't a component or a well label in the plan." },
      { row: 0, column: 3, message: "“Media” is in more than one column. Each component or label gets one column." },
      { row: 0, column: 5, message: "Column 6 has amounts but no component or label." },
      { row: 1, column: 2, message: "Control, Media: “-5” isn't an amount in µL." },
      { row: 2, column: 0, message: "Row 3 has no well label." },
      { row: 3, column: 0, message: "“Control” is in more than one row." },
      { row: 4, column: 0, message: "No well is labeled “Cond 9”." },
      { row: 5, column: 2, message: "A low, Media: “1e3” isn't an amount in µL." },
      { row: 6, column: 0, message: "No well is labeled “A low2”." },
    ]);
  });

  test("readTransferTable: “lots” and “5 µL” aren't amounts", () => {
    const plan = tablePlan();
    const { problems } = readTransferTable(plan, [["L", "Media", "Drug A"], ["Control", "lots", "5 µL"]]);
    assert.deepEqual(
      problems.map((problem) => problem.message),
      ["Control, Media: “lots” isn't an amount in µL.", "Control, Drug A: “5 µL” isn't an amount in µL."],
    );
  });

  test("readTransferTable refuses a table not in its form, naming what's wrong", () => {
    const plan = tablePlan();
    const start =
      "A transfer table must be a list of rows, each a list of the same number of cells, each text, but ";
    assert.throws(() => readTransferTable(plan, 5), { message: `${start}got 5.` });
    assert.throws(() => readTransferTable(plan, []), { message: `${start}got [].` });
    assert.throws(() => readTransferTable(plan, [["L", "Media"], []]), { message: `${start}row 2 is [].` });
    assert.throws(() => readTransferTable(plan, [["L", "M", "D", "X", "Y"], ["a", "b", "c", "d", "e"], ["a", "b", "c", "d"]]), {
      message: `${start}row 3 has 4 cells and row 1 has 5.`,
    });
    assert.throws(() => readTransferTable(plan, [["L", "Media", "x"], ["a", "b", null]]), {
      message: `${start}row 2, cell 3 is null.`,
    });
  });

  test("a one-row table and a one-column table are read with no amounts, and their draft's only problem is that it adds nothing", () => {
    const plan = tablePlan();
    for (const table of [[["L", "Media"]], [["L"], ["Control"]]]) {
      const { columns, problems } = readTransferTable(plan, table);
      assert.deepEqual(problems, []);
      assert.ok(columns.every((column) => column.amounts.length === 0));
      assert.deepEqual(transferTableProblems(plan, { table, sources: {} }, null), [
        { row: null, column: null, message: "The table adds nothing: every amount is blank or 0." },
      ]);
    }
  });

  test("readTransferTable ignores fully blank rows, which keep the rows after them numbered by place", () => {
    const plan = tablePlan();
    const { columns, problems } = readTransferTable(plan, [
      ["L", "Media"],
      ["Control", "10"],
      [" ", ""],
      ["", "x"],
      ["", ""],
    ]);
    assert.deepEqual(problems, [{ row: 3, column: 0, message: "Row 4 has no well label." }]);
    assert.equal(columns[0].amounts.length, 1);
  });

  test("stockWellsOf gives the wells holding only that component at Start, in deck order", () => {
    const plan = tablePlan();
    assert.deepEqual(stockWellsOf(plan, "Media"), [trough("1"), trough("2")]);
    const withEmpty = addComponent(plan, "Water", "#76b7b2");
    assert.deepEqual(stockWellsOf(withEmpty, "Water"), []);
    assert.deepEqual(stockWellsOf(emptyWells(plan, [trough("1")]), "Media"), [trough("2")]);
    assert.throws(() => stockWellsOf(plan, "Dye"), {
      message: 'There\'s no component called "Dye" in this plan. Add it to the plan\'s components first.',
    });
  });

  test("transferTableProblems lists a draft's problems in section 3's order, and [] for a good one", () => {
    let plan = tablePlan();
    assert.deepEqual(transferTableProblems(plan, exampleDraft(), null), []);
    const blank = { table: [["L", "Media"], ["Control", ""]], sources: {} };
    assert.deepEqual(transferTableProblems(plan, blank, null).map((problem) => problem.message), [
      "The table adds nothing: every amount is blank or 0.",
    ]);
    plan = addComponent(plan, "Water", "#76b7b2");
    const table = [["L", "Water", "Media", "Drug A", "DMSO"], ["Control", "1", "1", "1", "1"]];
    const sources = { "Drug A": [deepWell("A3")], DMSO: [deepWell("A4")] };
    assert.deepEqual(transferTableProblems(plan, { table, sources }, null), [
      { row: null, column: 1, message: "No well holds only Water at Start. Fill one with Water at Start first, or label the well to draw from “Water”." },
      { row: null, column: 2, message: "Choose a well for Media to draw from." },
      { row: null, column: 3, message: `${DEEP} A3 doesn't hold only Drug A at Start, so Drug A can't draw from it.` },
      { row: null, column: 4, message: `${DEEP} A4 doesn't hold only DMSO at Start, so DMSO can't draw from it.` },
    ]);
  });

  test("transferTableProblems: a source well the table also fills is a problem", () => {
    let plan = setWellLabel(tablePlan(), trough("1"), "Control");
    const table = [["L", "Media"], ["Control", "10"]];
    assert.deepEqual(transferTableProblems(plan, { table, sources: { Media: [trough("1")] } }, null).map((p) => p.message), [
      `${RESERVOIR} 1 is both a source of Media and a well the table fills. Choose another well.`,
    ]);
    plan = setWellLabel(tablePlan(), trough("2"), "Spike");
    const spiked = [["L", "Media", "Drug A"], ["Control", "10", ""], ["Spike", "", "2"]];
    const sources = { Media: [trough("1"), trough("2")], "Drug A": [deepWell("A1")] };
    assert.deepEqual(transferTableProblems(plan, { table: spiked, sources }, null).map((p) => p.message), [
      `${RESERVOIR} 2 is both a source of Media and a well the table fills. Choose another well.`,
    ]);
  });

  test("a draft's form is checked, with section 5's messages", () => {
    const plan = tablePlan();
    const table = exampleTable();
    assert.throws(() => transferTableProblems(plan, 5, null), {
      message: 'A transfer table\'s draft must be an object with exactly "table" and "sources", but got 5.',
    });
    assert.throws(() => transferTableProblems(plan, { table, sources: 5 }, null), {
      message: sourcesFormMessage("5"),
    });
    assert.deepEqual(transferTableProblems(plan, { table, sources: { ...exampleDraft().sources, Dye: [trough("1")] } }, null), []);
    assert.throws(() => transferTableProblems(plan, { table, sources: { Media: [] } }, null), {
      message: "Media's source wells are empty. List at least one, or leave Media out.",
    });
    assert.throws(() => transferTableProblems(plan, { table, sources: { Media: [trough("1"), { labware: PLATE, well: "Z99" }] } }, null), {
      message: /^Media's source well 2: "Z99" isn't a well on /,
    });
    assert.throws(() => transferTableProblems(plan, { table, sources: { Media: [trough("1"), trough("1")] } }, null), {
      message: `${RESERVOIR} 1 is one of Media's source wells twice. List each once.`,
    });
    assert.throws(() => transferTableProblems(plan, exampleDraft(), "9"), { message: 'There\'s no stage "9" in the plan.' });
    assert.throws(() => sourceSplit(plan, exampleDraft(), "Media", "9"), { message: 'There\'s no stage "9" in the plan.' });
    assert.throws(() => transferTableStages(plan, exampleDraft(), "9"), { message: 'There\'s no stage "9" in the plan.' });
  });

  test("sourceSplit: each well takes whole transfers until the next doesn't fit, the last the rest", () => {
    let plan = tablePlan();
    const wells = [...GRID_96.wellsInBox("C1", "C12")];
    for (const well of wells) {
      plan = setWellLabel(plan, plateWell(well), "More");
    }
    const table = [["L", "Media"], ["More", "190"]];
    const draft = { table, sources: { Media: [trough("1"), trough("2")] } };
    const first = Math.floor(usableOf(RESERVOIR, 3000) / 190);
    assert.deepEqual(sourceSplit(plan, draft, "Media", null), [
      { well: trough("1"), count: first },
      { well: trough("2"), count: wells.length - first },
    ]);
    // A well with room for exactly n transfers takes n.
    const exact = addToWells(emptyWells(plan, [trough("1")]), [trough("1")], "Media", deadVolumeOf(RESERVOIR) + 4 * 190);
    assert.deepEqual(sourceSplit(exact, draft, "Media", null).map((entry) => entry.count), [4, wells.length - 4]);
    // A first well with no room passes every transfer on.
    const none = addToWells(emptyWells(plan, [trough("1")]), [trough("1")], "Media", deadVolumeOf(RESERVOIR));
    assert.deepEqual(sourceSplit(none, draft, "Media", null).map((entry) => entry.count), [0, wells.length]);
  });

  test("sourceSplit: a well stops at the first transfer that doesn't fit, and later smaller ones go on too", () => {
    let plan = tablePlan();
    plan = addToWells(emptyWells(plan, [trough("1")]), [trough("1")], "Media", deadVolumeOf(RESERVOIR) + 350);
    const table = [["L", "Media"], ["Control", "300"], ["A low", "100"]];
    const draft = { table, sources: { Media: [trough("1"), trough("2")] } };
    // 300 fits once (350), then 300 doesn't fit in the 50 left: everything after goes to Res1 2.
    assert.deepEqual(sourceSplit(plan, draft, "Media", null).map((entry) => entry.count), [1, 5]);
  });

  test("sourceSplit uses what the wells hold just before `at`, and works while another column has a problem", () => {
    let plan = tablePlan();
    const draft = { table: [["L", "Media", "Drug C"], ["Control", "190", "1"]], sources: { Media: [trough("1"), trough("2")] } };
    const fits = Math.floor(usableOf(RESERVOIR, 3000) / 190);
    assert.deepEqual(sourceSplit(plan, draft, "Media", null)[0].count, Math.min(fits, 3));
    // A stage before `at` drawing from Res1 1 lowers its share; one after it doesn't.
    plan = addTransfer(plan, { ...transferTo("1", "H12", usableOf(RESERVOIR, 3000) - 190), source: trough("1") });
    const { plan: withSecond, id: second } = addStageWithNewTips(plan, null);
    assert.deepEqual(sourceSplit(withSecond, draft, "Media", second)[0].count, 1);
    assert.deepEqual(sourceSplit(withSecond, draft, "Media", "1")[0].count, Math.min(fits, 3));
    assert.throws(() => sourceSplit(plan, draft, "Drug A", null), { message: "Drug A has no column with an amount in this table." });
    assert.throws(() => sourceSplit(plan, { ...draft, sources: {} }, "Media", null), {
      message: "Choose a well for Media to draw from.",
    });
  });

  test("a new transfer table's first stage copies the nearest transfer stage before it, not a mix step, and its tips", () => {
    let plan = tablePlan();
    plan = changeStageSettings(plan, "1", otherSettings());
    plan = setTipType(plan, START, TIP_TYPES.at(-1));
    const { plan: mixAdded, id: mixId } = addMixStepWithNewTips(plan, null);
    const withMix = setTipType(mixAdded, mixId, TIP_TYPES[0]);
    const [first] = transferTableStages(withMix, exampleDraft(), null);
    assert.deepEqual(first.settings, otherSettings());
    assert.deepEqual(first.tips, { tipType: TIP_TYPES.at(-1), probes: startTips().probes });
  });

  test("addTransferTable adds one stage per column with an amount, in column order, each on its own tips", () => {
    const plan = tablePlan();
    const { plan: added, id } = withExampleTable(plan, "1");
    assert.equal(id, "t1");
    const stages = tableStages(added, id);
    assert.deepEqual(stageOrder(added), [...stages, "1"]);
    assert.deepEqual(stages.map((stage) => added.stageList.get(stage).name), ["Media", "Drug A"]);
    for (const group of tipGroups(added)) {
      assert.equal(group.stages.length, 1);
    }
    assert.deepEqual(tipChangeAt(added, "1"), startTips());
    const expected = transferTableStages(plan, exampleDraft(), "1");
    assert.deepEqual(stages.map((stage) => outlinesIn(added, stage)), expected.map((entry) => entry.transfers));
    // No stage before: the first gets the default settings and the START tips; the second the first's.
    assert.deepEqual(added.stageList.get(stages[0]).settings, defaultSettings());
    assert.deepEqual(added.stageList.get(stages[1]).settings, defaultSettings());
    assert.deepEqual(tipChangeAt(added, START), startTips());
    assert.deepEqual(tipChangeAt(added, stages[1]), startTips());
    assert.deepEqual(added.transferTables, [
      { id: "t1", table: exampleTable(), sources: exampleDraft().sources, stages: [
        { component: "Media", stage: stages[0] },
        { component: "Drug A", stage: stages[1] },
      ] },
    ]);
  });

  test("addTransferTable at the end copies the stage before it; copies its draft; the next is t2", () => {
    let plan = tablePlan();
    plan = changeStageSettings(plan, "1", otherSettings());
    plan = setTipType(plan, START, TIP_TYPES.at(-1));
    plan = setTipProbes(plan, START, probesFor(8));
    const draft = exampleDraft();
    const { plan: added, id } = addTransferTable(plan, draft, null);
    for (const stage of tableStages(added, id)) {
      assert.deepEqual(added.stageList.get(stage).settings, otherSettings());
      assert.deepEqual(tipChangeAt(added, stage), { tipType: TIP_TYPES.at(-1), probes: probesFor(8) });
    }
    draft.table[1][1] = "5";
    draft.sources.Media.push(trough("3"));
    assert.equal(transferTableAt(added, id).table[1][1], "190");
    assert.equal(transferTableAt(added, id).sources.Media.length, 2);
    assert.equal(new PlanHistory(plan).record(added).undo().present, plan);
    assert.equal(addTransferTable(added, exampleDraft(), null).id, "t2");
  });

  test("addTransferTable: where it can be added", () => {
    const plan = tablePlan();
    const { plan: withTable, id } = withExampleTable(plan, null);
    // Before another transfer table's first stage: it goes above.
    const first = tableStages(withTable, id)[0];
    const { plan: above, id: second } = addTransferTable(withTable, exampleDraft(), first);
    assert.equal(stageOrder(above).indexOf(tableStages(above, second).at(-1)) + 1, stageOrder(above).indexOf(first));
    assert.throws(() => addTransferTable(withTable, exampleDraft(), tableStages(withTable, id)[1]), {
      message: "A transfer table's stages stay together, each on its own tips: add before its first stage or after its last.",
    });
    // Inside a tip group.
    const { plan: twoInGroup, id: inGroupId } = addStage(plan, null);
    assert.throws(() => addTransferTable(twoInGroup, exampleDraft(), inGroupId), {
      message: `A transfer table sits between tip groups, so it can't go before stage 2, “${NEW_STAGE_NAME}”.`,
    });
    assert.throws(() => addTransferTable(plan, exampleDraft(), "9"), {
      message: 'There\'s no stage "9" to add a transfer table before.',
    });
    // Before a randomization's first stage, but not inside it.
    let randomized = addStageWithNewTips(plan, null).plan;
    const { plan: withR, id: rId } = addRandomization(randomized, null, { seed: 3, volume: 10 });
    randomized = setRandomization(withR, rId, {
      sources: [
        { labware: DEEP, well: "A1", replicates: 1, filler: false, sharesTips: false },
        { labware: DEEP, well: "A3", replicates: 1, filler: false, sharesTips: false },
      ],
      fill: [plateWell("H1"), plateWell("H2")],
    });
    randomized = runRandomization(randomized, rId);
    const owned = randomizationAt(randomized, rId).stages.map((entry) => entry.stage);
    assert.equal(addTransferTable(randomized, exampleDraft(), owned[0]).id, "t1");
    assert.throws(() => addTransferTable(randomized, exampleDraft(), owned[1]), {
      message: "A randomization's stages stay together: add before its first stage or after its last.",
    });
  });

  test("addTransferTable and updateTransferTable refuse a draft with problems with the first one's message", () => {
    const plan = tablePlan();
    const bad = { table: [["L", "Drug C"], ["Control", "1"]], sources: {} };
    assert.throws(() => addTransferTable(plan, bad, null), { message: "“Drug C” isn't a component or a well label in the plan." });
    assert.throws(() => transferTableStages(plan, bad, null), { message: "“Drug C” isn't a component or a well label in the plan." });
    const { plan: added, id } = withExampleTable();
    assert.throws(() => updateTransferTable(added, id, bad), { message: "“Drug C” isn't a component or a well label in the plan." });
    assert.throws(() => updateTransferTable(added, "t9", bad), { message: 'There\'s no transfer table "t9" in the plan.' });
  });

  test("updateTransferTable keeps a stage's ID, settings and tips, replacing its transfers", () => {
    let { plan, id } = withExampleTable();
    const [media, drug] = tableStages(plan, id);
    plan = changeStageSettings(plan, media, otherSettings());
    plan = setTipType(plan, media, TIP_TYPES.at(-1));
    plan = setTipProbes(plan, media, probesFor(8));
    const draft = draftOf(plan, id);
    draft.table[1][1] = "100";
    const updated = updateTransferTable(plan, id, draft);
    assert.deepEqual(tableStages(updated, id), [media, drug]);
    assert.deepEqual(updated.stageList.get(media).settings, otherSettings());
    assert.deepEqual(tipChangeAt(updated, media), { tipType: TIP_TYPES.at(-1), probes: probesFor(8) });
    assert.deepEqual(outlinesIn(updated, media).map((transfer) => transfer.volume), [100, 100, 100, 190, 190, 190]);
    assert.equal(transferTableAt(updated, id).table[1][1], "100");
    assert.equal(new PlanHistory(plan).record(updated).undo().present, plan);
    assert.equal(updateTransferTable(updated, id, draftOf(updated, id)), updated);
  });

  test("updateTransferTable: a column added gets a new stage copying the column before it; a column cleared loses its stage", () => {
    let { plan, id } = withExampleTable();
    plan = addStageWithNewTips(plan, null).plan;
    const after = stageOrder(plan).at(-1);
    const [media, drug] = tableStages(plan, id);
    plan = changeStageSettings(plan, media, otherSettings());
    plan = setTipType(plan, media, TIP_TYPES.at(-1));
    const draft = draftOf(plan, id);
    draft.table = [
      ["Dest Well Label", "Media", "DMSO", "Drug A"],
      ["Control", "190", "5", ""],
      ["A low", "190", "5", "2"],
    ];
    draft.sources.DMSO = [deepWell("A3")];
    const updated = updateTransferTable(plan, id, draft);
    const stages = tableStages(updated, id);
    assert.equal(stages.length, 3);
    assert.deepEqual([stages[0], stages[2]], [media, drug]);
    assert.equal(updated.stageList.get(stages[1]).name, "DMSO");
    assert.deepEqual(updated.stageList.get(stages[1]).settings, otherSettings());
    assert.equal(tipChangeAt(updated, stages[1]).tipType, TIP_TYPES.at(-1));
    assert.deepEqual(stageOrder(updated).slice(-4), [...stages, after]);
    assert.ok(tipChangeAt(updated, after) !== null);
    for (const group of tipGroups(updated)) {
      assert.equal(group.stages.length, 1);
    }
    // Drug A cleared: its stage goes.
    const cleared = draftOf(updated, id);
    cleared.table = cleared.table.map((row, index) => (index === 0 ? row : [row[0], row[1], row[2], ""]));
    const without = updateTransferTable(updated, id, cleared);
    assert.deepEqual(tableStages(without, id), [media, stages[1]]);
    assert.equal(without.stageList.has(drug), false);
    assert.ok(tipChangeAt(without, after) !== null);
  });

  test("updateTransferTable: after two columns swap places, the stages follow, keeping their IDs", () => {
    const { plan, id } = withExampleTable();
    const [media, drug] = tableStages(plan, id);
    const draft = draftOf(plan, id);
    draft.table = draft.table.map(([label, m, d, x]) => [label, d, m, x]);
    const updated = updateTransferTable(plan, id, draft);
    assert.deepEqual(tableStages(updated, id), [drug, media]);
    assert.deepEqual(stageOrder(updated).slice(-2), [drug, media]);
    assert.deepEqual(tipChangeAt(updated, media), startTips());
    assert.equal(isTransferTableOutOfDate(updated, id), false);
    assert.deepEqual(
      updated.operationList.groupByStage().map((group) => group.stage),
      stageOrder(updated).filter((stage) => transfersIn(updated, stage).length > 0),
    );
  });

  test("updateTransferTable with renamedFrom keeps the old column's stage, renamed", () => {
    let { plan, id } = withExampleTable();
    const [media] = tableStages(plan, id);
    plan = changeStageSettings(plan, media, otherSettings());
    const draft = draftOf(plan, id);
    draft.table = draft.table.map(([label, media, drug]) => [label, media, drug]);
    draft.table[0][1] = "DMSO";
    draft.sources.DMSO = [deepWell("A3")];
    const renamed = updateTransferTable(plan, id, draft, { renamedFrom: { DMSO: "Media" } });
    assert.equal(tableStages(renamed, id)[0], media);
    assert.equal(renamed.stageList.get(media).name, "DMSO");
    assert.deepEqual(renamed.stageList.get(media).settings, otherSettings());
    assert.deepEqual(outlinesIn(renamed, media)[0].source, deepWell("A3"));
    // Without it, the Media stage goes and DMSO gets a new one, copying the stage before the table.
    const plain = updateTransferTable(plan, id, draft);
    assert.equal(plain.stageList.has(media), false);
    assert.deepEqual(plain.stageList.get(tableStages(plain, id)[0]).settings, defaultSettings());
    // Entries that don't apply are ignored: an old component with no stage, or a stage another column keeps.
    const ignored = updateTransferTable(plan, id, draft, { renamedFrom: { DMSO: "Water", Media: "Drug A" } });
    assert.deepEqual(stageOrder(ignored).length, stageOrder(plain).length);
    assert.equal(ignored.stageList.has(media), false);
    const both = draftOf(plan, id);
    both.table = [["L", "Media", "Drug A", "DMSO"], ["Control", "190", "", "1"], ["A low", "190", "2", "1"]];
    both.sources.DMSO = [deepWell("A3")];
    const keptByOwn = updateTransferTable(plan, id, both, { renamedFrom: { DMSO: "Media" } });
    assert.equal(tableStages(keptByOwn, id)[0], media);
    assert.notEqual(tableStages(keptByOwn, id)[2], media);
    assert.throws(() => updateTransferTable(plan, id, draft, { renamedFrom: 5 }), {
      message: /^renamedFrom must be an object/,
    });
  });

  // The test plan with a randomization run just before stage 1, then the three-stage table added
  // there, between them: { plan, id, rId }. The randomization's beforeId is the table's first stage.
  function runRandomizationAboveTable() {
    let plan = tablePlan();
    const { plan: withR, id: rId } = addRandomization(plan, "1", { seed: 3, volume: 10 });
    plan = setRandomization(withR, rId, {
      sources: [{ labware: DEEP, well: "A3", replicates: 1, filler: false, sharesTips: false }],
      fill: [plateWell("H1")],
    });
    plan = runRandomization(plan, rId);
    const table = [["Label", "Media", "Drug A", "DMSO"], ["Control", "190", "", "5"], ["A low", "190", "2", "5"]];
    const sources = { Media: [trough("1"), trough("2")], "Drug A": [deepWell("A1")], DMSO: [deepWell("A3")] };
    const added = addTransferTable(plan, { table, sources }, "1");
    return { plan: added.plan, id: added.id, rId };
  }

  test("a run randomization just above a transfer table follows its new first stage after a move inside it", () => {
    const { plan, id, rId } = runRandomizationAboveTable();
    const [media, drug] = tableStages(plan, id);
    assert.equal(randomizationAt(plan, rId).beforeId, media);
    const { plan: moved } = moveItems(plan, [stageItem(drug)], inTable(tableBoxIndex(plan, id), 0));
    assert.equal(randomizationAt(moved, rId).beforeId, drug);
    assert.equal(setRandomizations(moved, moved.randomizations).randomizations.length, 1);
    assert.equal(moveItems(plan, [stageItem(media)], inTable(tableBoxIndex(plan, id), 0)).plan, plan);
  });

  test("a run randomization just above a transfer table follows its new first stage after an update", () => {
    const { plan, id, rId } = runRandomizationAboveTable();
    const draft = draftOf(plan, id);
    // Media cleared, and DMSO moved before Drug A.
    draft.table = [["Label", "Media", "DMSO", "Drug A"], ["Control", "", "5", ""], ["A low", "", "5", "2"]];
    const updated = updateTransferTable(plan, id, draft);
    const stages = tableStages(updated, id);
    assert.deepEqual(stages.map((stage) => updated.stageList.get(stage).name), ["DMSO", "Drug A"]);
    assert.equal(randomizationAt(updated, rId).beforeId, stages[0]);
    assert.equal(setRandomizations(updated, updated.randomizations).randomizations.length, 1);
  });

  test("transferTableStages with an id gives the same with `at` null as with its first stage", () => {
    const { plan, id } = withExampleTable();
    const first = tableStages(plan, id)[0];
    assert.deepEqual(
      transferTableStages(plan, exampleDraft(), null, { id }),
      transferTableStages(plan, exampleDraft(), first, { id }),
    );
    assert.deepEqual(
      transferTableStages(plan, exampleDraft(), null, { id }).map((entry) => entry.stage),
      tableStages(plan, id),
    );
  });

  test("a randomization without stages above a transfer table stays above it through updates", () => {
    let { plan, id } = withExampleTable();
    const [media] = tableStages(plan, id);
    const { plan: withR, id: rId } = addRandomization(plan, media, { seed: 1, volume: 1 });
    plan = withR;
    // Its first column cleared: the stage it sat before goes.
    const cleared = draftOf(plan, id);
    cleared.table = cleared.table.map(([label, , drug, dmso]) => [label, "", drug, dmso]);
    const updated = updateTransferTable(plan, id, cleared);
    assert.equal(randomizationAt(updated, rId).beforeId, tableStages(updated, id)[0]);
    // Its columns reordered, so another stage is first.
    const swapped = draftOf(plan, id);
    swapped.table = swapped.table.map(([label, m, d, x]) => [label, d, m, x]);
    const reordered = updateTransferTable(plan, id, swapped);
    assert.equal(randomizationAt(reordered, rId).beforeId, tableStages(reordered, id)[0]);
    // setTransferTables refuses one sitting before a stage other than its first.
    const inside = setRandomizations(setTransferTables(plan, []), [
      { ...randomizationAt(plan, rId), beforeId: tableStages(plan, id)[1] },
    ]);
    assert.throws(() => setTransferTables(inside, plan.transferTables), {
      message: `Randomization 1 sits before stage "${tableStages(plan, id)[1]}", inside transfer table 1. A randomization sits between tip groups.`,
    });
  });

  test("isTransferTableOutOfDate: false after adding and updating, true after edits it depends on", () => {
    const { plan, id } = withExampleTable(tablePlan(), "1");
    assert.equal(isTransferTableOutOfDate(plan, id), false);
    const relabeled = setWellLabel(plan, plateWell("A1"), "");
    assert.equal(isTransferTableOutOfDate(relabeled, id), true);
    assert.equal(isTransferTableOutOfDate(updateTransferTable(relabeled, id, draftOf(relabeled, id)), id), false);
    assert.equal(isTransferTableOutOfDate(emptyWells(plan, [trough("2")]), id), true);
    // A stage after it drawing from Res1 1 doesn't change the split; one before it does.
    const drawing = addTransfer(plan, { ...transferTo("1", "H12", 900), source: trough("1") });
    assert.equal(isTransferTableOutOfDate(drawing, id), false);
    const { plan: before, id: beforeId } = addStageWithNewTips(plan, tableStages(plan, id)[0]);
    const drawsBefore = addTransfer(before, { ...transferTo(beforeId, "H12", 900), source: trough("1") });
    assert.equal(isTransferTableOutOfDate(drawsBefore, id), true);
    assert.equal(isTransferTableOutOfDate(updateTransferTable(drawsBefore, id, draftOf(drawsBefore, id)), id), false);
    // Moved below a stage that draws from Res1 1.
    const tableFirst = withExampleTable(addTransfer(tablePlan(), { ...transferTo("1", "H12", 900), source: trough("1") }), "1");
    assert.equal(isTransferTableOutOfDate(tableFirst.plan, tableFirst.id), false);
    const { plan: movedDown } = moveItems(tableFirst.plan, [{ kind: "transferTable", id: tableFirst.id }], between(columnBoxes(tableFirst.plan).length));
    assert.equal(isTransferTableOutOfDate(movedDown, tableFirst.id), true);
    // A component a header names removed; false again once its column is deleted.
    const removed = removeComponent(plan, "Drug A");
    assert.equal(isTransferTableOutOfDate(removed, id), true);
    const draft = draftOf(removed, id);
    draft.table = draft.table.map(([label, media, , dmso]) => [label, media, dmso]);
    assert.equal(isTransferTableOutOfDate(updateTransferTable(removed, id, draft), id), false);
    // Settings and tips aren't compared.
    const [media] = tableStages(plan, id);
    let set = changeStageSettings(plan, media, otherSettings());
    set = setStageMix(set, media, "source", exampleMix());
    set = setTipType(set, START, TIP_TYPES.at(-1));
    set = setTipProbes(set, tableStages(plan, id)[1], [1]);
    assert.equal(isTransferTableOutOfDate(set, id), false);
    assert.throws(() => isTransferTableOutOfDate(plan, "t9"), { message: 'There\'s no transfer table "t9" in the plan.' });
  });

  test("renameComponent renames a transfer table's header cells, sources, stages and stage, in one edit", () => {
    let { plan, id } = withExampleTable();
    const draft = draftOf(plan, id);
    draft.table[0][1] = " Media ";
    plan = updateTransferTable(plan, id, draft);
    const renamed = renameComponent(plan, "Media", "DMEM");
    const table = transferTableAt(renamed, id);
    assert.equal(table.table[0][1], "DMEM");
    assert.deepEqual(Object.keys(table.sources), ["DMEM", "Drug A"]);
    assert.equal(table.stages[0].component, "DMEM");
    assert.equal(renamed.stageList.get(table.stages[0].stage).name, "DMEM");
    assert.equal(isTransferTableOutOfDate(renamed, id), false);
    assert.equal(new PlanHistory(plan).record(renamed).undo().present, plan);
  });

  test("removeComponent keeps its key in a transfer table's sources, and its header and stage", () => {
    const { plan, id } = withExampleTable();
    const removed = removeComponent(plan, "Drug A");
    const table = transferTableAt(removed, id);
    assert.deepEqual(Object.keys(table.sources), ["Media", "Drug A"]);
    assert.equal(table.table[0][2], "Drug A");
    assert.equal(transferTableOf(removed, table.stages[1].stage), id);
    assert.equal(isTransferTableOutOfDate(removed, id), true);
  });

  test("a transfer table's stages refuse edits from outside, with section 5's messages", () => {
    let { plan, id } = withExampleTable(tablePlan(), null);
    plan = addStageWithNewTips(plan, null).plan;
    const wash = stageOrder(plan).at(-1);
    plan = renameStage(plan, wash, "Wash");
    const [media, drug] = tableStages(plan, id);
    const position = transfersIn(plan, media)[0].position;
    const amounts = "Stage 2, “Media”, is part of a transfer table: change its amounts in the table.";
    assert.throws(() => addTransfer(plan, transferTo(media, "H1")), { message: amounts });
    assert.throws(() => addTransfers(plan, [transferTo(media, "H1")]), { message: amounts });
    assert.throws(() => changeVolume(plan, position, 5), { message: amounts });
    assert.throws(() => removeTransfer(plan, position), { message: amounts });
    assert.throws(() => renameStage(plan, media, "X"), {
      message: "Stage 2, “Media”, is part of a transfer table: it's named after its component.",
    });
    assert.throws(() => removeStage(plan, media), {
      message: "Stage 2, “Media”, is part of a transfer table: clear its column in the table, or remove the whole table.",
    });
    assert.throws(() => removeTipChange(plan, drug), {
      message: "Every stage of a transfer table starts on new tips, so these can't be removed.",
    });
    assert.throws(() => removeTipChange(plan, wash), {
      message: "This tip change keeps stage 4, “Wash”, off the transfer table's tips. A transfer table never shares tips with other stages.",
    });
    const together = "A transfer table's stages stay together, each on its own tips: add before its first stage or after its last.";
    assert.throws(() => addStage(plan, drug), { message: together });
    assert.throws(() => addMixStep(plan, drug, { takeTips: true }), { message: together });
    assert.throws(() => addStageWithNewTips(plan, drug), { message: together });
    assert.throws(() => addMixStepWithNewTips(plan, drug), { message: together });
    assert.throws(() => addRandomization(plan, drug), { message: together });
    const { plan: notRun, id: rId } = addRandomization(plan, null);
    assert.throws(() => placeRandomization(notRun, rId, drug), { message: together });
    assert.throws(() => addTransferTable(plan, exampleDraft(), drug), { message: together });
    assert.throws(() => addStage(plan, media, { takeTips: true }), { message: together });
    const shares = "A stage added here would share the transfer table's tips. Add it with new tips, from the seam between tip groups.";
    assert.throws(() => addStage(plan, wash), { message: shares });
    assert.throws(() => addMixStep(plan, wash), { message: shares });
    assert.throws(() => addTipChange(plan, drug), { message: `There are already new tips before stage "${drug}".` });
    const last = withExampleTable().plan;
    assert.throws(() => addStage(last, null), { message: shares });
    assert.throws(() => addMixStep(last, null), { message: shares });
  });

  test("a transfer table's stages allow pipetting edits and stages added beside it on new tips", () => {
    let { plan, id } = withExampleTable(addStageWithNewTips(tablePlan(), null).plan, null);
    const [media, drug] = tableStages(plan, id);
    const before = stageOrder(plan)[1];
    plan = changeStageSettings(plan, media, otherSettings());
    plan = setStageMix(plan, media, "destination", exampleMix());
    plan = setTipType(plan, drug, TIP_TYPES.at(-1));
    plan = setTipProbes(plan, drug, [1, 2]);
    assert.deepEqual(tipChangeAt(plan, drug), { tipType: TIP_TYPES.at(-1), probes: [1, 2] });
    // addStage before its first stage without takeTips joins the tip group above.
    const { plan: joined, id: joinedId } = addStage(plan, media);
    assert.ok(tipGroups(joined).some((group) => group.stages.includes(before) && group.stages.includes(joinedId)));
    for (const add of [addStageWithNewTips, addMixStepWithNewTips]) {
      for (const beforeId of [media, null]) {
        const { plan: added, id: newId } = add(plan, beforeId);
        assert.ok(tipChangeAt(added, newId) !== null);
        assert.ok(tipChangeAt(added, media) !== null);
        assert.equal(isTransferTableOutOfDate(added, id), false);
      }
    }
  });

  test("adding above a transfer table that starts the plan keeps its first stage's tips", () => {
    let plan = setTipType(tablePlan(), START, TIP_TYPES.at(-1));
    const added = withExampleTable(plan, "1");
    plan = removeStage(added.plan, "1");
    const [media] = tableStages(plan, added.id);
    for (const add of [addStage, addMixStep]) {
      const { plan: above, id: newId } = add(plan, media);
      assert.equal(stageOrder(above)[0], newId);
      assert.deepEqual(tipChangeAt(above, media), { tipType: TIP_TYPES.at(-1), probes: startTips().probes });
      for (const stage of tableStages(above, added.id)) {
        assert.equal(tipGroups(above).find((group) => group.stages.includes(stage)).stages.length, 1);
      }
    }
  });

  test("removeStage of the stage just after a transfer table gives the next stage the removed one's tips", () => {
    let { plan, id } = withExampleTable();
    plan = addStageWithNewTips(plan, null).plan;
    const next = stageOrder(plan).at(-1);
    plan = setTipType(plan, next, TIP_TYPES.at(-1));
    plan = addStage(plan, null).plan;
    const last = stageOrder(plan).at(-1);
    const removed = removeStage(plan, next);
    assert.deepEqual(tipChangeAt(removed, last), { tipType: TIP_TYPES.at(-1), probes: startTips().probes });
    assert.equal(isTransferTableOutOfDate(removed, id), false);
  });

  test("removeTransferTable takes out the table and its stages, keeping the tips after it", () => {
    let { plan, id } = withExampleTable(tablePlan(), "1");
    const stages = tableStages(plan, id);
    const { plan: withR, id: rId } = addRandomization(plan, stages[0]);
    plan = withR;
    const removed = removeTransferTable(plan, id);
    assert.deepEqual(removed.transferTables, []);
    assert.deepEqual(stageOrder(removed), ["1"]);
    assert.deepEqual(tipChangeAt(removed, START), startTips());
    assert.equal(randomizationAt(removed, rId).beforeId, "1");
    assert.equal(new PlanHistory(plan).record(removed).undo().present, plan);
    const only = removeStage(withExampleTable().plan, "1");
    assert.equal(canRemoveTransferTable(only, "t1"), false);
    assert.equal(canRemoveTransferTable(only, "t9"), false);
    assert.equal(canRemoveTransferTable(plan, id), true);
    assert.throws(() => removeTransferTable(only, "t1"), {
      message: "This transfer table's stages are all the plan's stages, and a plan needs at least one. Add a stage outside it first.",
    });
    assert.throws(() => removeTransferTable(plan, "t9"), { message: 'There\'s no transfer table "t9" in the plan.' });
    // At the end: a randomization before it then sits at the end.
    let { plan: atEnd, id: endId } = withExampleTable();
    const { plan: endR, id: endRId } = addRandomization(atEnd, tableStages(atEnd, endId)[0]);
    assert.equal(randomizationAt(removeTransferTable(endR, endId), endRId).beforeId, null);
  });

  test("a transfer table's own edits change its stages despite the refusals", () => {
    let { plan, id } = withExampleTable();
    const [media, drug] = tableStages(plan, id);
    const cleared = draftOf(plan, id);
    cleared.table = cleared.table.map(([label, m, , x]) => [label, m, "", x]);
    assert.equal(updateTransferTable(plan, id, cleared).stageList.has(drug), false);
    assert.equal(removeTransferTable(plan, id).stageList.has(media), false);
    assert.equal(renameComponent(plan, "Media", "DMEM").stageList.get(media).name, "DMEM");
    const moved = moveWell(plan, trough("1"), trough("5"));
    assert.deepEqual(outlinesIn(moved, media)[0].source, trough("5"));
  });

  test("setTransferTables accepts what adding gives, and refuses each wrong value in order", () => {
    const { plan, id } = withExampleTable(addStageWithNewTips(tablePlan(), null).plan, null);
    const stored = transferTableAt(plan, id);
    const [media, drug] = stored.stages.map((owned) => owned.stage);
    assert.deepEqual(setTransferTables(plan, plan.transferTables).transferTables, plan.transferTables);
    // A list of one stored transfer table with `changes`.
    const withChanges = (changes) => [{ ...stored, ...changes }];
    const cases = [
      [5, "The transfer tables must be a list, but got 5."],
      [[5], 'Transfer table 1 must be an object with exactly "id", "table", "sources" and "stages".'],
      [withChanges({ id: "x" }), 'Transfer table 1\'s ID must be "t" and a whole number, like "t1", but got "x".'],
      [withChanges({ table: [] }), "Transfer table 1: A transfer table must be a list of rows, each a list of the same number of cells, each text, but got []."],
      [withChanges({ sources: { "  ": [trough("1")] } }), `Transfer table 1: ${sourcesFormMessage('"  "')}`],
      [withChanges({ stages: [] }), 'Transfer table 1: its stages must be a non-empty list of objects with exactly "component" and "stage".'],
      [withChanges({ stages: [{ component: "Media", stage: "9" }] }), 'Transfer table 1: its stage "9" isn\'t in the plan.'],
      [withChanges({ stages: [{ component: "Media", stage: media }, { component: "Drug A", stage: media }] }), `Transfer table 1: stage "${media}" is listed twice.`],
      [withChanges({ stages: [{ component: "Dye", stage: media }] }), "Transfer table 1: its stage for Dye has no column in its table."],
      [withChanges({ stages: [{ component: "Media", stage: media }, { component: "Media", stage: drug }] }), "Transfer table 1: Media has two stages."],
      [withChanges({ stages: [{ component: "DMSO", stage: media }] }), `Transfer table 1: stage "${media}" must be named “DMSO”, after its component.`],
    ];
    for (const [value, message] of cases) {
      assert.throws(() => setTransferTables(plan, value), { message });
    }
    // In its columns' order.
    const swappedTable = stored.table.map(([label, m, d, x]) => [label, d, m, x]);
    assert.throws(
      () => setTransferTables(plan, withChanges({ stages: [{ component: "Media", stage: media }, { component: "Drug A", stage: drug }], table: swappedTable })),
      { message: "Transfer table 1: its stages must be in the order of its columns." },
    );
    // Consecutive, in stage order (the plan's stages are "1", "2", then the table's).
    const base = setTransferTables(plan, []);
    const apart = renameStage(base, "2", "Media");
    assert.throws(
      () => setTransferTables(apart, withChanges({ stages: [{ component: "Media", stage: "2" }, { component: "Drug A", stage: drug }] })),
      { message: "Transfer table 1: its stages must come one after another, in stage order." },
    );
    // Each the only stage of its tip group: its first, then each after it, then the last.
    const sharedFirst = removeTipChange(base, media);
    assert.throws(() => setTransferTables(sharedFirst, plan.transferTables), {
      message: `Transfer table 1: stage "${media}" shares tips with another stage. Every stage of a transfer table starts on new tips.`,
    });
    const sharedSecond = removeTipChange(base, drug);
    assert.throws(() => setTransferTables(sharedSecond, plan.transferTables), {
      message: `Transfer table 1: stage "${drug}" shares tips with another stage. Every stage of a transfer table starts on new tips.`,
    });
    const { plan: tailPlan, id: tailId } = withExampleTable();
    const tail = addStage(setTransferTables(tailPlan, []), null).plan;
    assert.throws(() => setTransferTables(tail, tailPlan.transferTables), {
      message: `Transfer table 1: stage "${tableStages(tailPlan, tailId)[1]}" shares tips with another stage. Every stage of a transfer table starts on new tips.`,
    });
    // A mix step.
    const emptyDrug = removeTransfersOf(base, drug);
    const mixed = changeStageSettings(emptyDrug, drug, mixStepDefaults());
    assert.throws(() => setTransferTables(mixed, plan.transferTables), {
      message: `Transfer table 1: stage "${drug}" is a mix step.`,
    });
    // IDs repeated; stages owned twice; a stage owned by a randomization too.
    const second = addTransferTable(plan, exampleDraft(), null).plan;
    const [firstTable, secondTable] = second.transferTables;
    assert.throws(() => setTransferTables(second, [firstTable, { ...secondTable, id: "t1" }]), {
      message: 'Transfer tables 1 and 2 both have the ID "t1".',
    });
    assert.throws(() => setTransferTables(plan, [stored, { ...stored, id: "t2" }]), {
      message: `Stage "${media}" belongs to two transfer tables, 1 and 2.`,
    });
  });

  test("setTransferTables refuses a stage owned by a transfer table and a randomization", () => {
    let plan = tablePlan();
    const { plan: withR, id: rId } = addRandomization(plan, null, { seed: 3, volume: 10 });
    plan = setRandomization(withR, rId, {
      sources: [{ labware: DEEP, well: "A1", replicates: 1, filler: false, sharesTips: false }],
      fill: [plateWell("H1")],
    });
    plan = runRandomization(plan, rId);
    const owned = randomizationAt(plan, rId).stages[0].stage;
    // A randomization's stage refuses renameStage (since 2026-11-05, item 20), so it's renamed with
    // the randomizations set aside: a plan the edits would never make.
    plan = withParts(renameStage(withParts(plan, { randomizations: [] }), owned, "Media"), {
      randomizations: plan.randomizations,
    });
    const table = { id: "t1", table: [["L", "Media"], ["Control", "1"]], sources: {}, stages: [{ component: "Media", stage: owned }] };
    assert.throws(() => setTransferTables(plan, [table]), {
      message: `Stage "${owned}" belongs to transfer table 1 and randomization 1.`,
    });
  });

  test("columnBoxes gives a transfer table as one box, each of its tip groups holding one stage", () => {
    let { plan, id } = withExampleTable();
    const { plan: withR, id: rId } = addRandomization(plan, null);
    plan = withR;
    const boxes = columnBoxes(plan);
    assert.deepEqual(boxes.map((box) => box.kind), ["tipGroup", "transferTable", "randomization"]);
    assert.equal(boxes[1].id, id);
    assert.deepEqual(boxes[1].tipGroups.map((group) => group.stages), tableStages(plan, id).map((stage) => [stage]));
    assert.equal(boxes[2].id, rId);
  });

  test("moving a transfer table between boxes keeps its stages, settings and tips; it can't go inside a tip group, and its stage can't move alone", () => {
    let { plan, id } = withExampleTable();
    const [media] = tableStages(plan, id);
    plan = changeStageSettings(plan, media, otherSettings());
    plan = setTipType(plan, media, TIP_TYPES.at(-1));
    const { plan: moved, placed } = moveItems(plan, [{ kind: "transferTable", id }], between(0));
    assert.deepEqual(placed, [{ kind: "transferTable", id }]);
    assert.deepEqual(stageOrder(moved), [...tableStages(plan, id), "1"]);
    assert.deepEqual(moved.stageList.get(media).settings, otherSettings());
    assert.deepEqual(tipChangeAt(moved, START).tipType, TIP_TYPES.at(-1));
    assert.ok(tipChangeAt(moved, "1") !== null);
    assert.equal(isTransferTableOutOfDate(moved, id), false);
    assert.throws(() => moveItems(plan, [{ kind: "transferTable", id }], inGroup(0, 0)), {
      message: "A tip group or randomization can't go inside another tip group: put it between tip groups.",
    });
    assert.throws(() => moveItems(plan, [stageItem(media)], between(0)), {
      message: "Stage 2, “Media”, belongs to a transfer table, which moves its stages with it: move it within the table, move the whole transfer table, or copy the stage.",
    });
    assert.throws(() => moveItems(plan, [stageItem("1")], inGroup(1, 0)), {
      message: "Box 1 is a transfer table: only its own stages can be moved inside it.",
    });
  });

  test("copying a transfer table writes version 5 and pastes a new transfer table with new stages", () => {
    let { plan, id } = withExampleTable();
    const [media] = tableStages(plan, id);
    plan = setTipType(plan, media, TIP_TYPES.at(-1));
    const copied = copyOf(plan, [{ kind: "transferTable", id }]);
    assert.equal(copied.version, 5);
    assert.deepEqual(copied.items[0].transferTable, { table: exampleTable(), sources: exampleDraft().sources });
    assert.deepEqual(copied.items[0].stages.map((entry) => [entry.component, entry.tips.tipType]), [
      ["Media", TIP_TYPES.at(-1)],
      ["Drug A", TIP_TYPES[0]],
    ]);
    const { plan: pasted, placed } = pasteItems(plan, copied, between(columnBoxes(plan).length));
    assert.deepEqual(placed, [{ kind: "transferTable", id: "t2" }]);
    const copy = transferTableAt(pasted, "t2");
    assert.deepEqual(copy.table, exampleTable());
    assert.deepEqual(copy.sources, exampleDraft().sources);
    assert.equal(copy.stages.some((owned) => tableStages(plan, id).includes(owned.stage)), false);
    assert.equal(tipChangeAt(pasted, copy.stages[0].stage).tipType, TIP_TYPES.at(-1));
    for (const owned of copy.stages) {
      assert.equal(tipGroups(pasted).find((group) => group.stages.includes(owned.stage)).stages.length, 1);
    }
    assert.deepEqual(setTransferTables(pasted, pasted.transferTables).transferTables, pasted.transferTables);
    // A stage of it copied alone is an ordinary stage.
    const { plan: alone, placed: alonePlaced } = copyItems(plan, [stageItem(media)], between(0));
    assert.equal(transferTableOf(alone, alonePlaced[0].id), null);
    // A version 3 copy holding a transfer table item is refused with the form message.
    assert.throws(() => pasteItems(plan, { ...copied, version: 3 }, between(0)), {
      message: "Can't paste: item 1 isn't a stage, tip group or randomization as the transfer designer copies them.",
    });
  });

  test("pasting a transfer table checks its values; sources naming no component here are kept", () => {
    const { plan, id } = withExampleTable();
    const copied = copyOf(plan, [{ kind: "transferTable", id }]);
    const badStage = structuredClone(copied);
    badStage.items[0].stages[1].component = "Dye";
    assert.throws(() => pasteItems(plan, badStage, between(0)), {
      message: "Can't paste: item 1: its stage for Dye has no column in its table.",
    });
    // Into a plan without Drug A: its key is kept, and the pasted table is out of date.
    let other = tablePlan();
    other = removeComponent(other, "Drug A");
    const { plan: pasted, placed } = pasteItems(other, copied, between(1));
    const copy = transferTableAt(pasted, placed[0].id);
    assert.deepEqual(Object.keys(copy.sources), ["Media", "Drug A"]);
    assert.equal(isTransferTableOutOfDate(pasted, copy.id), true);
    assert.throws(() => pasteItems(plan, copied, inTable(1, 0)), {
      message: "Box 1 is a transfer table: only its own stages can be moved inside it.",
    });
  });

  test("moving a stage inside its transfer table reorders its stages and its columns, keeping its tips", () => {
    let { plan, id } = threeStageTablePlan();
    plan = addStageWithNewTips(plan, null).plan;
    const after = stageOrder(plan).at(-1);
    const [media, drug, dmso] = tableStages(plan, id);
    plan = setTipType(plan, drug, TIP_TYPES.at(-1));
    const index = tableBoxIndex(plan, id);
    const { plan: moved, placed } = moveItems(plan, [stageItem(drug)], inTable(index, 0));
    assert.deepEqual(placed, [stageItem(drug)]);
    assert.deepEqual(tableStages(moved, id), [drug, media, dmso]);
    assert.deepEqual(stageOrder(moved), ["1", drug, media, dmso, after]);
    assert.deepEqual(transferTableAt(moved, id).table[0], ["Label", "Drug A", "Media", "", "DMSO"]);
    assert.equal(tipChangeAt(moved, drug).tipType, TIP_TYPES.at(-1));
    assert.equal(tipChangeAt(moved, media).tipType, TIP_TYPES[0]);
    assert.ok(tipChangeAt(moved, after) !== null);
    assert.equal(isTransferTableOutOfDate(moved, id), false);
    assert.equal(new PlanHistory(plan).record(moved).undo().present, plan);
    // To the bottom: its column last among the stages' columns.
    const { plan: bottom } = moveItems(plan, [stageItem(media)], inTable(index, 3));
    assert.deepEqual(tableStages(bottom, id), [drug, dmso, media]);
    assert.deepEqual(transferTableAt(bottom, id).table[0], ["Label", "", "Drug A", "DMSO", "Media"]);
    // The same order gives the same plan.
    assert.equal(moveItems(plan, [stageItem(media)], inTable(index, 1)).plan, plan);
  });

  test("moving a transfer table's stage to the top of a table that starts the plan gives it the START tips", () => {
    let { plan, id } = threeStageTablePlan();
    plan = removeStage(plan, "1");
    const [media, drug] = tableStages(plan, id);
    plan = setTipType(plan, drug, TIP_TYPES.at(-1));
    const { plan: moved } = moveItems(plan, [stageItem(drug)], inTable(0, 0));
    assert.equal(stageOrder(moved)[0], drug);
    assert.equal(tipChangeAt(moved, START).tipType, TIP_TYPES.at(-1));
    assert.equal(tipChangeAt(moved, drug), null);
    assert.equal(tipChangeAt(moved, media).tipType, TIP_TYPES[0]);
  });

  test("moving inside a transfer table refuses anything but its own stages, with section 5's messages", () => {
    let { plan, id } = threeStageTablePlan();
    const second = addTransferTable(plan, exampleDraft(), null);
    plan = second.plan;
    const index = tableBoxIndex(plan, id);
    const otherIndex = tableBoxIndex(plan, second.id);
    const [media] = tableStages(plan, id);
    const ownOnly = (box) => `Box ${box} is a transfer table: only its own stages can be moved inside it.`;
    assert.throws(() => moveItems(plan, [stageItem(media)], inTable(otherIndex, 0)), { message: ownOnly(otherIndex) });
    assert.throws(() => moveItems(plan, [stageItem("1")], inTable(index, 0)), { message: ownOnly(index) });
    assert.throws(() => moveItems(plan, [groupItem("1")], inTable(index, 0)), { message: ownOnly(index) });
    assert.throws(() => moveItems(plan, [{ kind: "transferTable", id: second.id }], inTable(index, 0)), { message: ownOnly(index) });
    assert.throws(() => moveItems(plan, [stageItem(media)], inTable(0, 0)), { message: "Box 0 isn't a transfer table." });
    assert.throws(() => moveItems(plan, [stageItem(media)], inTable(index, 7)), {
      message: `Box ${index} has positions 0 to 3, but got 7.`,
    });
    assert.throws(() => moveItems(plan, [stageItem(media)], between(0)), {
      message: /belongs to a transfer table, which moves its stages with it/,
    });
  });

  test("moving wells, transfer order: a destination moved past another with its label keeps the table up to date", () => {
    const { plan, id } = withExampleTable();
    const moved = moveWell(plan, plateWell("A1"), plateWell("H9"));
    assert.equal(isTransferTableOutOfDate(moved, id), false);
    assert.equal(updateTransferTable(moved, id, draftOf(moved, id)), moved);
  });

  test("moving wells, transfer order: a move that changes how a column splits among its wells makes it out of date", () => {
    const { plan, id } = withExampleTable();
    const [media] = tableStages(plan, id);
    const fromSecond = outlinesIn(plan, media).filter((transfer) => transfer.source.well === "2");
    assert.deepEqual(fromSecond.map((transfer) => transfer.destination), [plateWell("B3")]);
    const moved = moveWell(plan, plateWell("B1"), plateWell("H9"));
    assert.equal(isTransferTableOutOfDate(moved, id), true);
  });

  test("moving wells: a transfer table's source well is in use, and moving it keeps the table up to date", () => {
    let { plan, id } = withExampleTable();
    plan = emptyWells(plan, [trough("2")]);
    assert.equal(isWellUsed(plan, trough("2")), true);
    plan = addToWells(plan, [trough("2")], "Media", 10000);
    const moved = moveWell(plan, trough("1"), trough("5"));
    assert.deepEqual(transferTableAt(moved, id).sources.Media, [trough("5"), trough("2")]);
    assert.equal(isTransferTableOutOfDate(moved, id), false);
    // A3 to A4 keeps the label's wells in the same deck order (section 3, "Out of date", compares
    // transfers in order).
    const destination = moveWell(plan, plateWell("A3"), plateWell("A4"));
    assert.equal(wellLabelOf(destination, plateWell("A4")), "Control");
    assert.equal(isTransferTableOutOfDate(destination, id), false);
    const sourceOnly = setTransferTables(tablePlan(), []);
    assert.equal(isWellUsed(sourceOnly, trough("3")), false);
  });

  // --- Transfer tables: label-named columns (transfer-designer.md, section 6, item 24) ---

  // The test plan (tablePlan) with Deep1 A4 (the Media and DMSO mix) labeled "Premix", and Deep1 B1
  // (holding DMSO) and Deep1 B2 (empty) labeled "Media".
  function labelPlan() {
    let plan = tablePlan();
    plan = setWellLabel(plan, deepWell("A4"), "Premix");
    plan = addToWells(plan, [deepWell("B1")], "DMSO", 1000);
    plan = setWellLabel(plan, deepWell("B1"), "Media");
    return setWellLabel(plan, deepWell("B2"), "Media");
  }

  // A draft with one column, `name`, adding `volume` µL into every "Control" well, drawing from
  // `wells`, e.g. oneColumnDraft("Premix", [deepWell("A4")]).
  function oneColumnDraft(name, wells, volume = "10") {
    return { table: [["L", name], ["Control", volume]], sources: { [name]: wells } };
  }

  // The problems' messages of a draft on `plan`, at the end.
  function problemMessages(plan, draft) {
    return transferTableProblems(plan, draft, null).map((problem) => problem.message);
  }

  test("label-named columns, reading: a label header, a component and label header, and the header problems", () => {
    const plan = labelPlan();
    const { columns, problems } = readTransferTable(plan, [["L", "Premix ", "Media"], ["Control", "10", "5"]]);
    assert.deepEqual(problems, []);
    const controls = ["A1", "A2", "A3"].map(plateWell);
    assert.deepEqual(columns, [
      {
        column: 1,
        component: "Premix",
        isComponent: false,
        labelWells: [deepWell("A4")],
        amounts: [{ row: 1, label: "Control", wells: controls, volume: 10 }],
      },
      {
        column: 2,
        component: "Media",
        isComponent: true,
        labelWells: [deepWell("B1"), deepWell("B2")],
        amounts: [{ row: 1, label: "Control", wells: controls, volume: 5 }],
      },
    ]);
    const bad = readTransferTable(plan, [["L", "Drug C", "Premix", "Premix", "", "premix"], ["Control", "1", "1", "1", "1", ""]]);
    assert.deepEqual(bad.problems, [
      { row: 0, column: 1, message: "“Drug C” isn't a component or a well label in the plan." },
      { row: 0, column: 3, message: "“Premix” is in more than one column. Each component or label gets one column." },
      { row: 0, column: 4, message: "Column 5 has amounts but no component or label." },
      { row: 0, column: 5, message: "“premix” isn't a component or a well label in the plan." },
    ]);
  });

  test("hasComponentNamed: true for a component, exactly; false for a label, another case or a non-name", () => {
    const plan = labelPlan();
    assert.equal(hasComponentNamed(plan, "Media"), true);
    assert.equal(hasComponentNamed(plan, "media"), false);
    assert.equal(hasComponentNamed(plan, "Premix"), false);
    assert.equal(hasComponentNamed(plan, 5), false);
  });

  test("sourceWellsOf: stock wells, then labeled wells, each in deck order, a labeled stock well once", () => {
    let plan = labelPlan();
    assert.deepEqual(sourceWellsOf(plan, "Media"), [trough("1"), trough("2"), deepWell("B1"), deepWell("B2")]);
    assert.deepEqual(sourceWellsOf(plan, "Premix"), [deepWell("A4")]);
    assert.deepEqual(sourceWellsOf(plan, " Premix "), [deepWell("A4")]);
    assert.deepEqual(sourceWellsOf(plan, "premix"), []);
    assert.deepEqual(sourceWellsOf(plan, "Drug A"), [deepWell("A1")]);
    assert.deepEqual(sourceWellsOf(plan, "Drug C"), []);
    plan = setWellLabel(plan, trough("2"), "Media");
    assert.deepEqual(sourceWellsOf(plan, "Media"), [trough("1"), trough("2"), deepWell("B1"), deepWell("B2")]);
    assert.throws(() => sourceWellsOf(plan, 5), {
      message: "A column's name must be a component or a well label, but got 5.",
    });
    assert.throws(() => sourceWellsOf(plan, "  "), {
      message: 'A column\'s name must be a component or a well label, but got "  ".',
    });
  });

  test("label-named columns, a draft's problems: a labeled well may hold anything; others give their messages", () => {
    let plan = labelPlan();
    assert.deepEqual(problemMessages(plan, oneColumnDraft("Premix", [deepWell("A4")])), []);
    assert.deepEqual(problemMessages(plan, oneColumnDraft("Media", [deepWell("B2")])), []);
    assert.deepEqual(problemMessages(plan, { table: oneColumnDraft("Premix", []).table, sources: {} }), [
      "Choose a well for “Premix” to draw from.",
    ]);
    assert.deepEqual(problemMessages(plan, oneColumnDraft("Premix", [trough("1")])), [
      `${RESERVOIR} 1 isn't labeled “Premix”, so “Premix” can't draw from it.`,
    ]);
    assert.deepEqual(problemMessages(plan, oneColumnDraft("Media", [deepWell("A1")])), [
      `${DEEP} A1 doesn't hold only Media at Start and isn't labeled “Media”, so Media can't draw from it.`,
    ]);
    assert.deepEqual(problemMessages(plan, oneColumnDraft("Drug A", [deepWell("A4")])), [
      `${DEEP} A4 doesn't hold only Drug A at Start, so Drug A can't draw from it.`,
    ]);
    // Both DMSO stocks emptied (Deep1 B1 holds only DMSO in this plan too).
    plan = emptyWells(plan, [deepWell("A3"), deepWell("B1")]);
    assert.deepEqual(problemMessages(plan, oneColumnDraft("DMSO", [deepWell("A3")])), [
      "No well holds only DMSO at Start. Fill one with DMSO at Start first, or label the well to draw from “DMSO”.",
    ]);
    assert.deepEqual(problemMessages(plan, oneColumnDraft("Control", [plateWell("A1")])), [
      `${PLATE} A1 is both a source of “Control” and a well the table fills. Choose another well.`,
    ]);
  });

  test("label-named columns, adding: a stage named after the label, drawing from the mixed well", () => {
    const plan = labelPlan();
    const { plan: added, id } = addTransferTable(plan, oneColumnDraft("Premix", [deepWell("A4")]), null);
    const [stage] = tableStages(added, id);
    assert.deepEqual(transferTableAt(added, id).stages, [{ component: "Premix", stage }]);
    assert.equal(added.stageList.get(stage).name, "Premix");
    assert.deepEqual(
      outlinesIn(added, stage),
      ["A1", "A2", "A3"].map((well) => ({ source: deepWell("A4"), destination: plateWell(well), volume: 10 })),
    );
    // The mix is drawn in proportion: half Media and half DMSO, as contents tracking gives it.
    const end = replay(added.startingContents, added.operationList);
    assert.deepEqual(end.componentsOf(DEEP, "A4"), { Media: 485, DMSO: 485 });
    assert.deepEqual(end.componentsOf(PLATE, "A1"), { Media: 5, DMSO: 5 });
    // An empty labeled well has no table problem: its transfers show the ordinary contents problem.
    const empty = addTransferTable(plan, oneColumnDraft("Media", [deepWell("B2")]), null);
    assert.deepEqual(stagesWithContentsProblem(empty.plan), new Set(tableStages(empty.plan, empty.id)));
  });

  test("label-named columns, splitting: two labeled wells split by what each holds just before the table", () => {
    let plan = labelPlan();
    plan = emptyWells(plan, [deepWell("B1")]);
    plan = addToWells(plan, [deepWell("B1")], "DMSO", deadVolumeOf(DEEP) + 2 * 190 + 50);
    plan = addToWells(plan, [deepWell("B2")], "DMSO", 1000);
    const draft = oneColumnDraft("Media", [deepWell("B1"), deepWell("B2")], "190");
    assert.deepEqual(problemMessages(plan, draft), []);
    assert.deepEqual(sourceSplit(plan, draft, "Media", null), [
      { well: deepWell("B1"), count: 2 },
      { well: deepWell("B2"), count: 1 },
    ]);
    // Deep1 B1 emptied (down to its dead volume) by an earlier stage: every transfer draws from B2.
    const drawn = addTransfer(plan, {
      ...transferTo("1", "H12", usableOf(DEEP, deadVolumeOf(DEEP) + 2 * 190 + 50)),
      source: deepWell("B1"),
    });
    assert.deepEqual(sourceSplit(drawn, draft, "Media", null), [
      { well: deepWell("B1"), count: 0 },
      { well: deepWell("B2"), count: 3 },
    ]);
    const [entry] = transferTableStages(drawn, draft, null);
    assert.ok(entry.transfers.every((transfer) => transfer.source.well === "B2"));
  });

  test("label-named columns, out of date: the label cleared or moved; not a change in what one source well holds, a move, or a second labeled well", () => {
    const { plan, id } = addTransferTable(labelPlan(), oneColumnDraft("Premix", [deepWell("A4")]), null);
    assert.equal(isTransferTableOutOfDate(plan, id), false);
    const cleared = setWellLabel(plan, deepWell("A4"), "");
    assert.equal(isTransferTableOutOfDate(cleared, id), true);
    assert.equal(isTransferTableOutOfDate(setWellLabel(cleared, deepWell("A5"), "Premix"), id), true);
    const moreDmso = addTransfer(plan, { ...transferTo("1", "A4", 100), source: deepWell("A3"), destination: deepWell("A4") });
    assert.equal(isTransferTableOutOfDate(moreDmso, id), false);
    const moved = moveWell(plan, deepWell("A4"), deepWell("A6"));
    assert.deepEqual(transferTableAt(moved, id).sources.Premix, [deepWell("A6")]);
    assert.equal(isTransferTableOutOfDate(moved, id), false);
    const second = setWellLabel(plan, deepWell("A5"), "Premix");
    assert.equal(isTransferTableOutOfDate(second, id), false);
    assert.deepEqual(sourceWellsOf(second, "Premix"), [deepWell("A4"), deepWell("A5")]);
  });

  test("label-named columns, renameComponent: a component header that's also a label follows the component; a label header isn't touched", () => {
    const table = [["L", "Media", "Premix"], ["Control", "10", ""], ["A low", "", "5"]];
    const { plan, id } = addTransferTable(labelPlan(), { table, sources: { Media: [deepWell("B1")], Premix: [deepWell("A4")] } }, null);
    assert.equal(isTransferTableOutOfDate(plan, id), false);
    const renamed = renameComponent(plan, "Media", "DMEM");
    const stored = transferTableAt(renamed, id);
    assert.deepEqual(stored.table[0], ["L", "DMEM", "Premix"]);
    assert.deepEqual(Object.keys(stored.sources), ["DMEM", "Premix"]);
    assert.deepEqual(stored.stages.map((owned) => owned.component), ["DMEM", "Premix"]);
    assert.equal(renamed.stageList.get(stored.stages[0].stage).name, "DMEM");
    assert.equal(renamed.stageList.get(stored.stages[1].stage).name, "Premix");
    // Deep1 B1 is labeled "Media", not "DMEM", so it's no longer a source well of the column.
    assert.equal(isTransferTableOutOfDate(renamed, id), true);
  });

  test("label-named columns, renameComponent to a column's name: refused with both columns, else an unused key gives way", () => {
    const both = [["L", "Media", "Premix"], ["Control", "10", "5"]];
    const { plan } = addTransferTable(labelPlan(), { table: both, sources: { Media: [trough("1")], Premix: [deepWell("A4")] } }, null);
    assert.throws(() => renameComponent(plan, "Media", "Premix"), {
      message: "A transfer table already has a column “Premix”. Choose another name, or change that column first.",
    });
    // No Media column: an unused Media key replaces an unused Premix key, in Media's place.
    const unused = { table: [["L", "Drug A"], ["Control", "1"]], sources: { Media: [trough("1")], "Drug A": [deepWell("A1")], Premix: [deepWell("A4")] } };
    const added = addTransferTable(labelPlan(), unused, null);
    const renamed = renameComponent(added.plan, "Media", "Premix");
    assert.deepEqual(transferTableAt(renamed, added.id).sources, { Premix: [trough("1")], "Drug A": [deepWell("A1")] });
    // A Premix column whose key is in use keeps it; the unused Media key goes.
    const used = { table: [["L", "Premix"], ["Control", "1"]], sources: { Media: [trough("1")], Premix: [deepWell("A4")] } };
    const withUsed = addTransferTable(labelPlan(), used, null);
    const renamedUsed = renameComponent(withUsed.plan, "Media", "Premix");
    assert.deepEqual(transferTableAt(renamedUsed, withUsed.id).sources, { Premix: [deepWell("A4")] });
  });

  test("label-named columns, removeComponent: the key stays; up to date only while the header is a label and its wells are labeled", () => {
    const table = [["L", "DMSO"], ["Control", "10"]];
    const stock = addTransferTable(tablePlan(), { table, sources: { DMSO: [deepWell("A3")] } }, null);
    const removed = removeComponent(stock.plan, "DMSO");
    assert.deepEqual(Object.keys(transferTableAt(removed, stock.id).sources), ["DMSO"]);
    assert.equal(isTransferTableOutOfDate(removed, stock.id), true);
    const labeledPlan = setWellLabel(tablePlan(), deepWell("A3"), "DMSO");
    const labeled = addTransferTable(labeledPlan, { table, sources: { DMSO: [deepWell("A3")] } }, null);
    assert.equal(isTransferTableOutOfDate(removeComponent(labeled.plan, "DMSO"), labeled.id), false);
    // Drawing from a stock well that isn't labeled, with another well labeled DMSO: out of date.
    const otherLabeled = setWellLabel(tablePlan(), deepWell("A5"), "DMSO");
    const fromStock = addTransferTable(otherLabeled, { table, sources: { DMSO: [deepWell("A3")] } }, null);
    assert.equal(isTransferTableOutOfDate(removeComponent(fromStock.plan, "DMSO"), fromStock.id), true);
  });

  test("label-named columns, pasting: the key is kept; up to date only where the plan's labeled wells are its sources", () => {
    const { plan, id } = addTransferTable(labelPlan(), oneColumnDraft("Premix", [deepWell("A4")]), null);
    const copied = copyOf(plan, [{ kind: "transferTable", id }]);
    // The test plan with Deep1 A4 labeled `label`.
    const withLabel = (label) => setWellLabel(tablePlan(), deepWell("A4"), label);
    for (const [target, outOfDate] of [
      [tablePlan(), true],
      [withLabel("Premix"), false],
      [setWellLabel(tablePlan(), deepWell("A5"), "Premix"), true],
    ]) {
      const { plan: pasted, placed } = pasteItems(target, copied, between(1));
      const copy = transferTableAt(pasted, placed[0].id);
      assert.deepEqual(copy.sources, { Premix: [deepWell("A4")] });
      assert.equal(isTransferTableOutOfDate(pasted, copy.id), outOfDate);
    }
  });

  test("label-named columns, the form: a key naming no component is accepted; a blank key is refused", () => {
    const plan = labelPlan();
    assert.deepEqual(problemMessages(plan, oneColumnDraft("Premix", [deepWell("A4")])), []);
    for (const key of ["", "  "]) {
      assert.throws(() => transferTableProblems(plan, { table: exampleTable(), sources: { [key]: [trough("1")] } }, null), {
        message: sourcesFormMessage(`"${key}"`),
      });
    }
  });

  test("label-named columns, settings by name: an update keeps a label column's stage, also through renamedFrom", () => {
    let { plan, id } = addTransferTable(labelPlan(), oneColumnDraft("Premix", [deepWell("A4")]), null);
    const [stage] = tableStages(plan, id);
    plan = changeStageSettings(plan, stage, otherSettings());
    const changed = updateTransferTable(plan, id, oneColumnDraft("Premix", [deepWell("A4")], "20"));
    assert.deepEqual(tableStages(changed, id), [stage]);
    assert.deepEqual(changed.stageList.get(stage).settings, otherSettings());
    const relabeled = setWellLabel(plan, deepWell("A5"), "Premix 2");
    const renamed = updateTransferTable(relabeled, id, oneColumnDraft("Premix 2", [deepWell("A5")]), {
      renamedFrom: { "Premix 2": "Premix" },
    });
    assert.deepEqual(tableStages(renamed, id), [stage]);
    assert.equal(renamed.stageList.get(stage).name, "Premix 2");
    assert.deepEqual(renamed.stageList.get(stage).settings, otherSettings());
  });

  test("transfer table functions leave the plan and the draft unchanged; a plan's table and sources are frozen", () => {
    const plan = tablePlan();
    const before = snapshot(plan);
    const draft = exampleDraft();
    const draftBefore = JSON.stringify(draft);
    readTransferTable(plan, draft.table);
    stockWellsOf(plan, "Media");
    sourceWellsOf(plan, "Media");
    transferTableProblems(plan, draft, null);
    sourceSplit(plan, draft, "Media", null);
    transferTableStages(plan, draft, null);
    const { plan: added, id } = addTransferTable(plan, draft, null);
    const addedBefore = snapshot(added);
    updateTransferTable(added, id, draftOf(added, id));
    isTransferTableOutOfDate(added, id);
    removeTransferTable(addStageWithNewTips(added, null).plan, id);
    setTransferTables(added, added.transferTables);
    assert.equal(snapshot(plan), before);
    assert.equal(snapshot(added), addedBefore);
    assert.equal(JSON.stringify(draft), draftBefore);
    const stored = transferTableAt(added, id);
    assert.throws(() => {
      stored.table[0][0] = "x";
    }, TypeError);
    assert.throws(() => {
      stored.sources.Media.push(trough("3"));
    }, TypeError);
  });

  test("transferTableAt and transferTableOf find transfer tables and their stages", () => {
    const { plan, id } = withExampleTable();
    assert.equal(transferTableAt(plan, id).id, id);
    assert.equal(transferTableAt(plan, "t9"), null);
    assert.equal(transferTableOf(plan, tableStages(plan, id)[0]), id);
    assert.equal(transferTableOf(plan, "1"), null);
  });

  // --- A randomization's settings on its stages (2026-11-05, item 20) ---

  // Modes found in the configuration, never named: a source mode other than the default (the one
  // otherSettings() uses), a destination mode other than the default that can mix, and the end a
  // mode that can't mix is used at (NON_MIXING_MODE).
  const OTHER_SOURCE_MODE = modeOf("source", otherSettings());
  const OTHER_DESTINATION_MODE = modesFor("destination").find(
    (mode) => mode.name !== DEFAULT_PIPETTING_MODE && mode.mixingTechnique !== null,
  ).name;
  const CANT_MIX_END = NON_MIXING_MODE.ends.at(-1);

  // Tips that differ from sharingTips() (the last tip type on two probes) and from a new plan's
  // START tips (the first tip type on DEFAULT_PROBE_COUNT probes): the first tip type, on every probe.
  function otherTips() {
    return { tipType: TIP_TYPES[0], probes: probesFor(8) };
  }

  // `settings` with `end` using the mode called `name` (mixing as `mixes` says, with DEFAULT_MIX),
  // e.g. withMode(defaultSettings(), "source", "Slow").
  function withMode(settings, end, name, mixes = false) {
    return { ...settings, ...modeSettings(end, name, mixes), [`${end}Mix`]: mixes ? { ...DEFAULT_MIX } : null };
  }

  // sharingPlan with every source on new tips (A1, A2, A3 and the filler A4), run: { plan, id }.
  function runApartPlan() {
    const { plan, id } = sharingPlan([false, false, false, false]);
    return { plan: runRandomization(plan, id), id };
  }

  // The tips stage `stage` loads or shares: its tip group's { tipType, probes }.
  function tipsOfStage(plan, stage) {
    const { tipType, probes } = tipGroups(plan).find((group) => group.stages.includes(stage));
    return { tipType, probes };
  }

  // The key of the tip change starting the tip group of stage `stage`: the stage itself, or START.
  function tipKeyOf(plan, stage) {
    return stageOrder(plan)[0] === stage ? START : stage;
  }

  // The plan with stage `stage`'s settings set to `settings` and its tip group's tips to `tips`.
  function withStageSettingsAndTips(plan, stage, settings, tips) {
    const key = tipKeyOf(plan, stage);
    const changed = changeStageSettings(plan, stage, settings);
    return setTipProbes(setTipType(changed, key, tips.tipType), key, tips.probes);
  }

  test("addRandomization starts from the nearest transfer stage before its place and the tips in use there", () => {
    let plan = changeStageSettings(randomizingPlan(), "1", otherSettings());
    plan = setTipProbes(setTipType(plan, START, otherTips().tipType), START, otherTips().probes);
    const { plan: added, id } = addRandomization(plan, "2", { seed: 37, volume: 10 });
    const randomization = randomizationAt(added, id);
    assert.deepEqual(randomization.settings, otherSettings());
    assert.equal(randomization.tipType, otherTips().tipType);
    assert.deepEqual(randomization.probes, otherTips().probes);
    // At the start of the plan: the first transfer stage's settings and the START tips.
    const atStart = randomizationAt(addRandomization(plan, "1").plan, "r1");
    assert.deepEqual(atStart.settings, otherSettings());
    assert.deepEqual({ tipType: atStart.tipType, probes: atStart.probes }, otherTips());
    // Only mix steps: the default settings.
    let mixOnly = emptyPlan().plan;
    mixOnly = addMixStep(mixOnly, null).plan;
    mixOnly = removeStage(mixOnly, "1");
    assert.deepEqual(randomizationAt(addRandomization(mixOnly, null).plan, "r1").settings, defaultSettings());
  });

  test("addRandomization's starting settings: a mix step just before is passed over; with only mix steps before, the nearest transfer stage after", () => {
    let plan = changeStageSettings(randomizingPlan(), "1", otherSettings());
    const { plan: withMix, id: mixStep } = addMixStepWithNewTips(plan, null);
    plan = setTipType(withMix, mixStep, otherTips().tipType);
    const { plan: added, id } = addRandomization(plan, null);
    // Stage 2 is the transfer stage just before the mix step; the tips are the mix step's own.
    assert.deepEqual(randomizationAt(added, id).settings, plan.stageList.get("2").settings);
    assert.equal(randomizationAt(added, id).tipType, otherTips().tipType);
    // Only a mix step before its place: stage 1's (the nearest after).
    let mixFirst = changeStageSettings(randomizingPlan(), "1", otherSettings());
    const { plan: withFirstMix, id: firstMix } = addMixStepWithNewTips(mixFirst, "1");
    mixFirst = withFirstMix;
    assert.equal(stageOrder(mixFirst)[0], firstMix);
    assert.deepEqual(randomizationAt(addRandomization(mixFirst, "1").plan, "r1").settings, otherSettings());
  });

  test("a first run gives every stage the randomization's settings and every group its tips; then they're null", () => {
    let { plan, id } = sharingPlan([false, true, false, false]);
    plan = setRandomization(plan, id, { settings: otherSettings() });
    const run = runRandomization(plan, id);
    const randomization = randomizationAt(run, id);
    for (const { stage } of randomization.stages) {
      assert.deepEqual(run.stageList.get(stage).settings, otherSettings());
      assert.deepEqual(tipsOfStage(run, stage), sharingTips());
    }
    assert.equal(randomization.settings, null);
    assert.equal(randomization.tipType, null);
    assert.equal(randomization.probes, null);
  });

  test("after a run, a stage's settings and a group's tips changed on their own stay through a run, and don't make it out of date", () => {
    const { plan: run, id } = runApartPlan();
    const a1 = stageFor(run, id, "A1");
    const a2 = stageFor(run, id, "A2");
    let plan = changeStageSettings(run, a1, otherSettings());
    plan = setTipType(plan, a2, otherTips().tipType);
    assert.equal(isRandomizationOutOfDate(plan, id), false);
    const again = runRandomization(plan, id);
    assert.deepEqual(again.stageList.get(a1).settings, otherSettings());
    assert.equal(tipChangeAt(again, a2).tipType, otherTips().tipType);
    for (const { stage } of randomizationAt(again, id).stages) {
      assert.deepEqual(again.stageList.get(stage).settings, plan.stageList.get(stage).settings);
      assert.deepEqual(tipsOfStage(again, stage), tipsOfStage(plan, stage));
    }
  });

  test("setStageMix and setTipProbes work on a randomization's stage as on any stage", () => {
    const { plan, id } = runApartPlan();
    const a3 = stageFor(plan, id, "A3");
    const mixed = setStageMix(plan, a3, "destination", exampleMix());
    assert.deepEqual(mixed.stageList.get(a3).settings.destinationMix, exampleMix());
    const probes = setTipProbes(plan, a3, [1]);
    assert.deepEqual(tipChangeAt(probes, a3).probes, [1]);
  });

  test("a source added after a run starts like its neighbor: the nearest kept source before it, else after it", () => {
    const { plan: run, id } = runApartPlan();
    const a1 = stageFor(run, id, "A1");
    let plan = withStageSettingsAndTips(run, a1, otherSettings(), otherTips());
    plan = addToWells(plan, [deepWell("A5")], "Drug B", capacityOf(DEEP));
    const sources = randomizationAt(plan, id).sources;
    const between = runRandomization(
      setRandomization(plan, id, { sources: [sources[0], source("A5", 1), ...sources.slice(1)] }),
      id,
    );
    const a5 = stageFor(between, id, "A5");
    assert.deepEqual(between.stageList.get(a5).settings, otherSettings());
    assert.ok(tipChangeAt(between, a5) !== null);
    assert.deepEqual(tipsOfStage(between, a5), otherTips());
    const first = runRandomization(setRandomization(plan, id, { sources: [source("A5", 1), ...sources] }), id);
    const firstA5 = stageFor(first, id, "A5");
    assert.deepEqual(first.stageList.get(firstA5).settings, otherSettings());
    assert.deepEqual(tipsOfStage(first, firstA5), otherTips());
  });

  test("a source split from its group starts new tips like the group before; joined again, it shares", () => {
    const { plan: setUp, id } = sharingPlan([false, true, true, false]);
    const run = runRandomization(setUp, id);
    const a2 = stageFor(run, id, "A2");
    assert.equal(tipChangeAt(run, a2), null);
    const sources = randomizationAt(run, id).sources;
    const split = runRandomization(setRandomization(run, id, { sources: setSourceSharesTips(sources, 1, false) }), id);
    assert.deepEqual(tipChangeAt(split, a2), tipsOfStage(run, stageFor(run, id, "A1")));
    const joined = runRandomization(setRandomization(split, id, { sources }), id);
    assert.equal(tipChangeAt(joined, a2), null);
  });

  test("forAll: a mode alone sets that end of every stage, each other end as it was; {} is no forAll", () => {
    const { plan: run, id } = runApartPlan();
    const a1 = stageFor(run, id, "A1");
    const plan = changeStageSettings(run, a1, otherSettings());
    const fast = runRandomization(plan, id, { destinationMode: OTHER_DESTINATION_MODE });
    for (const { stage } of randomizationAt(fast, id).stages) {
      const settings = fast.stageList.get(stage).settings;
      assert.equal(modeOf("destination", settings), OTHER_DESTINATION_MODE);
      assert.equal(modeOf("source", settings), modeOf("source", plan.stageList.get(stage).settings));
    }
    assert.equal(modeOf("source", fast.stageList.get(a1).settings), OTHER_SOURCE_MODE);
    assert.equal(snapshot(runRandomization(plan, id, {})), snapshot(runRandomization(plan, id)));
  });

  test("forAll: mixing turned on keeps a stage's own mix and gives the others DEFAULT_MIX; a mode that can't mix turns mixing off", () => {
    const { plan: run, id } = runApartPlan();
    const [first, ...others] = randomizationAt(run, id).stages.map((owned) => owned.stage);
    const end = CANT_MIX_END;
    const plan = setStageMix(run, first, end, exampleMix());
    const mixing = runRandomization(plan, id, { [`${end}Mixes`]: true });
    assert.deepEqual(mixing.stageList.get(first).settings[`${end}Mix`], exampleMix());
    for (const stage of others) {
      assert.deepEqual(mixing.stageList.get(stage).settings[`${end}Mix`], DEFAULT_MIX);
      assert.equal(modeOf(end, mixing.stageList.get(stage).settings), modeOf(end, plan.stageList.get(stage).settings));
    }
    const offs = runRandomization(mixing, id, { [`${end}Mode`]: NON_MIXING_MODE.name });
    for (const { stage } of randomizationAt(offs, id).stages) {
      assert.equal(offs.stageList.get(stage).settings[`${end}Mix`], null);
      assert.equal(modeOf(end, offs.stageList.get(stage).settings), NON_MIXING_MODE.name);
    }
    const before = snapshot(mixing);
    assert.throws(() => runRandomization(mixing, id, { [`${end}Mode`]: NON_MIXING_MODE.name, [`${end}Mixes`]: true }), {
      message: `${NON_MIXING_MODE.name} can't mix, so it can't be used at the ${end} while the ${end} mixes. Turn the ${end}'s mixing off first.`,
    });
    assert.equal(snapshot(mixing), before);
  });

  test("forAll: tipType and probes go to every group's tip change, START's for a group starting the plan", () => {
    const { plan: setUp, id } = sharingPlan([false, true, false, false]);
    const run = runRandomization(setUp, id);
    const set = runRandomization(run, id, { tipType: otherTips().tipType, probes: [1, 2, 3] });
    for (const { stage } of randomizationAt(set, id).stages) {
      assert.deepEqual(tipsOfStage(set, stage), { tipType: otherTips().tipType, probes: [1, 2, 3] });
    }
    // Stages 1 and 2 (outside it) keep their tips.
    assert.deepEqual(tipChangeAt(set, START), tipChangeAt(run, START));
    assert.deepEqual(tipChangeAt(set, "2"), tipChangeAt(run, "2"));
    // Its first stage the plan's first: START's tip change gets it.
    const { plan: atTop, id: topId } = sharingPlan([false, false, false, false], { beforeId: "1" });
    const firstRun = runRandomization(atTop, topId);
    assert.equal(stageOrder(firstRun)[0], randomizationAt(firstRun, topId).stages[0].stage);
    const top = runRandomization(firstRun, topId, { tipType: otherTips().tipType });
    assert.equal(tipChangeAt(top, START).tipType, otherTips().tipType);
  });

  test("forAll: a wrong property or value is refused with its message, before the problems, changing nothing", () => {
    const { plan, id } = runApartPlan();
    const before = snapshot(plan);
    const cases = [
      [
        { speed: 3 },
        'The settings for every stage must be an object of "sourceMode", "sourceMixes", "destinationMode", "destinationMixes", "tipType" and "probes", but got "speed".',
      ],
      [
        null,
        'The settings for every stage must be an object of "sourceMode", "sourceMixes", "destinationMode", "destinationMixes", "tipType" and "probes", but got null.',
      ],
      [{ sourceMode: "Fastest" }, /^"Fastest" isn't a pipetting mode for the source\. /],
      [{ sourceMixes: "yes" }, 'Whether the source mixes must be true or false, but got "yes".'],
      [{ destinationMode: "Fastest" }, /^"Fastest" isn't a pipetting mode for the destination\. /],
      [{ destinationMixes: 1 }, "Whether the destination mixes must be true or false, but got 1."],
      [{ tipType: "BC50" }, `"BC50" isn't a tip type. Choose one of ${TIP_TYPES.map((tip) => `"${tip}"`).join(", ")}.`],
      [{ probes: [9] }, /^Probe numbers must be whole numbers from 1 to 8/],
      // The order: sourceMode before sourceMixes before destinationMode.
      [{ destinationMode: "Fastest", sourceMixes: "yes" }, 'Whether the source mixes must be true or false, but got "yes".'],
    ];
    for (const [forAll, message] of cases) {
      assert.throws(() => runRandomization(plan, id, forAll), { message }, JSON.stringify(forAll));
    }
    // forAll before the randomization's problems.
    const problem = setRandomization(plan, id, { seed: null });
    assert.throws(() => runRandomization(problem, id, { speed: 3 }), { message: /^The settings for every stage/ });
    assert.throws(() => runRandomization(problem, id, {}), { message: "Type a seed." });
    assert.equal(snapshot(plan), before);
  });

  test("forAll refused: mixing on where a stage's own mode can't mix, and mixing given where a stage's end isn't one of the modes", () => {
    const { plan: run, id } = runApartPlan();
    const [, a2, a3] = randomizationAt(run, id).stages.map((owned) => owned.stage);
    const end = CANT_MIX_END;
    const plan = changeStageSettings(run, a2, withMode(run.stageList.get(a2).settings, end, NON_MIXING_MODE.name));
    const before = snapshot(plan);
    assert.throws(() => runRandomization(plan, id, { [`${end}Mixes`]: true }), {
      message: `Stage ${stageOrder(plan).indexOf(a2) + 1}, “${plan.stageList.get(a2).name}”, uses ${NON_MIXING_MODE.name} at the ${end}, which can't mix. Choose a mode for every stage, or change that stage first.`,
    });
    const custom = changeStageSettings(plan, a3, {
      ...plan.stageList.get(a3).settings,
      sourceTechnique: "Custom_Technique",
      sourceLiquidType: "Custom_Liquid",
    });
    assert.throws(() => runRandomization(custom, id, { sourceMixes: false }), {
      message: `Stage ${stageOrder(custom).indexOf(a3) + 1}, “${custom.stageList.get(a3).name}”, doesn't use one of the modes at the source. Choose a mode for every stage, or change that stage first.`,
    });
    // A mode given puts it right; an end not given is kept as it is.
    const fixed = runRandomization(custom, id, { sourceMode: DEFAULT_PIPETTING_MODE });
    assert.equal(modeOf("source", fixed.stageList.get(a3).settings), DEFAULT_PIPETTING_MODE);
    assert.equal(runRandomization(custom, id, { destinationMode: DEFAULT_PIPETTING_MODE }).stageList.get(a3).settings.sourceTechnique, "Custom_Technique");
    assert.equal(snapshot(plan), before);
  });

  test("setRandomization refuses settings, tip type or probes once it has stages, even unchanged; before a run they're set", () => {
    const { plan: setUp, id } = sharingPlan();
    assert.deepEqual(randomizationAt(setRandomization(setUp, id, { settings: otherSettings() }), id).settings, otherSettings());
    const run = runRandomization(setUp, id);
    const message =
      "This randomization has run, so its settings and tips are its stages': change them on the stages, or all at once when running it.";
    for (const changes of [{ settings: defaultSettings() }, { tipType: TIP_TYPES[0] }, { probes: [1] }, { settings: null }]) {
      assert.throws(() => setRandomization(run, id, changes), { message }, JSON.stringify(changes));
    }
    // Checked after the volume, before the settings themselves.
    assert.throws(() => setRandomization(run, id, { volume: 0, settings: 5 }), /volume must be/);
  });

  test("setRandomizations refuses a run randomization holding settings, and one without stages holding none", () => {
    const { plan, id } = runApartPlan();
    const stored = () => JSON.parse(JSON.stringify(randomizationAt(plan, id)));
    assert.throws(() => setRandomizations(plan, [{ ...stored(), settings: defaultSettings() }]), {
      message: 'Randomization 1 has stages, so its "settings", "tipType" and "probes" must be null: its stages hold them.',
    });
    const notRun = { ...asNotRun(stored()), id: "r2", name: "Randomization2", beforeId: null };
    assert.throws(() => setRandomizations(plan, [stored(), { ...notRun, settings: null }]), {
      message: `Randomization 2 hasn't run, so it needs "settings", "tipType" and "probes" for its first run.`,
    });
    assert.throws(() => setRandomizations(plan, [stored(), { ...notRun, tipType: null }]), /Randomization 2 hasn't run/);
    assert.equal(setRandomizations(plan, [stored(), notRun]).randomizations.length, 2);
    // The order: its values (when not null), then the stages' form, then this rule, then each stage.
    const holding = { ...stored(), settings: defaultSettings() };
    assert.throws(() => setRandomizations(plan, [{ ...holding, tipType: "BC50" }]), {
      message: /^Randomization 1: "BC50" isn't a tip type/,
    });
    assert.throws(() => setRandomizations(plan, [{ ...holding, stages: [{ stage: "9" }] }]), {
      message: /^Randomization 1: its stages must be a list of objects/,
    });
    assert.throws(() => setRandomizations(plan, [{ ...holding, stages: [{ ...holding.stages[0], stage: "99" }] }]), {
      message: /^Randomization 1 has stages, so its/,
    });
  });

  test("copied items version 5: a run randomization's settings are null; a version 4 copy pastes them dropped; a version 5 copy breaking the rule is refused", () => {
    const { plan: run, id } = runApartPlan();
    const a1 = stageFor(run, id, "A1");
    const plan = withStageSettingsAndTips(run, a1, otherSettings(), otherTips());
    const copied = copyOf(plan, [randomizationItem(id)]);
    assert.equal(copied.version, 5);
    assert.deepEqual(
      FIRST_RUN_VALUES.map((property) => copied.items[0].randomization[property]),
      [null, null, null],
    );
    // A version 4 copy, holding settings and tips as written then: dropped; its stages keep theirs.
    const version4 = JSON.parse(JSON.stringify(copied));
    version4.version = 4;
    Object.assign(version4.items[0].randomization, { settings: defaultSettings(), ...sharingTips() });
    const { plan: pasted, placed } = pasteItems(plan, version4, between(columnBoxes(plan).length));
    const copy = randomizationAt(pasted, placed[0].id);
    assert.deepEqual(FIRST_RUN_VALUES.map((property) => copy[property]), [null, null, null]);
    assert.deepEqual(pasted.stageList.get(copy.stages[0].stage).settings, otherSettings());
    assert.deepEqual(tipsOfStage(pasted, copy.stages[0].stage), otherTips());
    assert.equal(setRandomizations(pasted, pasted.randomizations).randomizations.length, 2);
    // A version 4 copy's settings are still checked.
    const badVersion4 = JSON.parse(JSON.stringify(version4));
    badVersion4.items[0].randomization.tipType = "BC50";
    assert.throws(() => pasteItems(plan, badVersion4, between(0)), { message: /^Can't paste: item 1: "BC50" isn't a tip type/ });
    // A version 5 copy breaking the rule.
    const formMessage = "Can't paste: item 1 isn't a stage, tip group or randomization as the transfer designer copies them.";
    const holding = JSON.parse(JSON.stringify(copied));
    holding.items[0].randomization.settings = defaultSettings();
    assert.throws(() => pasteItems(plan, holding, between(0)), { message: formMessage });
    const { plan: notRunPlan, id: notRunId } = sharingPlan();
    const missing = copyOf(notRunPlan, [randomizationItem(notRunId)]);
    assert.deepEqual(missing.items[0].randomization.settings, notRunPlan.randomizations[0].settings);
    missing.items[0].randomization.probes = null;
    assert.throws(() => pasteItems(notRunPlan, missing, between(0)), { message: formMessage });
    assert.throws(() => pasteItems(plan, { ...copied, version: 6 }, between(0)), {
      message: "Can't paste: these were copied by a newer version of the tools (version 6).",
    });
  });

  // A randomization's values for its first run, null once it has stages.
  const FIRST_RUN_VALUES = ["settings", "tipType", "probes"];

  test("a randomization's stages are protected: edits of their transfers, names, places and tip sharing are refused, changing nothing", () => {
    const { plan: setUp, id } = sharingPlan([false, true, false, false]);
    const plan = runRandomization(setUp, id);
    const [first, second, third] = randomizationAt(plan, id).stages.map((owned) => owned.stage);
    const named = (stage) => `Stage ${stageOrder(plan).indexOf(stage) + 1}, “${plan.stageList.get(stage).name}”`;
    const before = snapshot(plan);
    const position = transfersIn(plan, first)[0].position;
    const transfersMessage = `${named(first)}, is part of a randomization: change its sources and wells in the randomization.`;
    assert.throws(() => addTransfer(plan, transferTo(first, "H12")), { message: transfersMessage });
    assert.throws(() => addTransfers(plan, [transferTo(first, "H12")]), { message: transfersMessage });
    assert.throws(() => changeVolume(plan, position, 3), { message: transfersMessage });
    assert.throws(() => removeTransfer(plan, position), { message: transfersMessage });
    assert.throws(() => renameStage(plan, first, "Mine"), {
      message: `${named(first)}, is part of a randomization: it's named after its source.`,
    });
    assert.throws(() => removeStage(plan, first), {
      message: `${named(first)}, is part of a randomization: take its source out of the randomization, or remove the whole randomization.`,
    });
    assert.throws(() => removeTipChange(plan, third), {
      message: `${named(third)}, is part of a randomization: which of its stages share tips is set by its sources.`,
    });
    assert.throws(() => addTipChange(plan, second), {
      message: `${named(second)}, is part of a randomization: which of its stages share tips is set by its sources.`,
    });
    const together = "A randomization's stages stay together: add before its first stage or after its last.";
    assert.throws(() => addStage(plan, second), { message: together });
    assert.throws(() => addStage(plan, third), { message: together });
    assert.throws(() => addStage(plan, first, { takeTips: true }), { message: together });
    assert.throws(() => addMixStep(plan, first, { takeTips: true }), { message: together });
    assert.throws(() => addStageWithNewTips(plan, third), { message: together });
    assert.throws(() => addMixStepWithNewTips(plan, third), { message: together });
    assert.throws(() => addRandomization(plan, third), { message: together });
    const { plan: notRun, id: notRunId } = addRandomization(plan, "2");
    assert.throws(() => placeRandomization(notRun, notRunId, third), { message: together });
    const joins = "A stage added here would share the randomization's tips. Add it with new tips, from the seam between tip groups.";
    assert.throws(() => addStage(plan, "2"), { message: joins });
    assert.throws(() => addMixStep(plan, "2"), { message: joins });
    assert.equal(snapshot(plan), before);
    // Allowed: new tips just after its last stage, and a stage taking stage 2's tips.
    const { plan: afterLast, id: newId } = addStageWithNewTips(plan, "2");
    assert.equal(stageOrder(afterLast).indexOf(newId), stageOrder(plan).indexOf("2"));
    assert.equal(randomizationAt(afterLast, id).beforeId, newId);
    addStage(plan, "2", { takeTips: true });
    // At the end of a plan whose last stage is its own: refused without new tips.
    const { plan: lastSetUp, id: lastId } = sharingPlan([false, false, false, false], { beforeId: null });
    const last = runRandomization(lastSetUp, lastId);
    assert.throws(() => addStage(last, null), { message: joins });
    assert.equal(stageOrder(addStageWithNewTips(last, null).plan).length, stageOrder(last).length + 1);
  });

  test("addStage before a randomization that starts the plan: the new stage takes START, its first stage keeps its tips", () => {
    const { plan: setUp, id } = sharingPlan([false, false, false, false], { beforeId: "1" });
    const plan = runRandomization(setUp, id);
    const first = randomizationAt(plan, id).stages[0].stage;
    const { plan: added, id: newId } = addStage(plan, first);
    assert.equal(stageOrder(added)[0], newId);
    assert.deepEqual(tipChangeAt(added, first), tipChangeAt(plan, START));
    assert.equal(setRandomizations(added, added.randomizations).randomizations.length, 1);
  });

  test("a randomization's own edits still change its stages: a run, removeRandomization, moveItems and moveWell", () => {
    const { plan, id } = runApartPlan();
    const smaller = setRandomization(plan, id, { sources: randomizationAt(plan, id).sources.slice(1) });
    assert.equal(randomizationAt(runRandomization(smaller, id), id).stages.length, 3);
    assert.equal(removeRandomization(plan, id).randomizations.length, 0);
    const { plan: moved } = moveItems(plan, [randomizationItem(id)], between(0));
    assert.equal(stageOrder(moved)[0], randomizationAt(plan, id).stages[0].stage);
    const movedWell = moveWell(plan, deepWell("A1"), deepWell("H12"));
    assert.equal(randomizationAt(movedWell, id).stages[0].well, "H12");
  });

  test("tips kept on a later run: a group whose first source is taken out keeps its tips; a source sharing again joins the group above", () => {
    const { plan: setUp, id } = sharingPlan([false, true, false, false]);
    const run = runRandomization(setUp, id);
    const a1 = stageFor(run, id, "A1");
    const a2 = stageFor(run, id, "A2");
    const plan = setTipType(run, a1, otherTips().tipType);
    const sources = randomizationAt(plan, id).sources;
    const withoutA1 = runRandomization(setRandomization(plan, id, { sources: removeSources(sources, [0]) }), id);
    assert.equal(tipsOfStage(withoutA1, a2).tipType, otherTips().tipType);
    // A3 turned to share A1 and A2's tips: it joins them.
    const a3 = stageFor(plan, id, "A3");
    const joined = runRandomization(setRandomization(plan, id, { sources: setSourceSharesTips(sources, 2, true) }), id);
    assert.equal(tipChangeAt(joined, a3), null);
    assert.equal(tipsOfStage(joined, a3).tipType, otherTips().tipType);
  });

  test("the removal rule's reach: a run after a sharing group's first source is taken out keys the group's tips, the same tip type and probes, by the next source's stage", () => {
    const { plan: setUp, id } = sharingPlan([false, true, false, false]);
    const run = runRandomization(setUp, id);
    const a1 = stageFor(run, id, "A1");
    const a2 = stageFor(run, id, "A2");
    let plan = setTipType(run, a1, otherTips().tipType);
    plan = setTipProbes(plan, a1, [1, 3]);
    const sources = randomizationAt(plan, id).sources;
    const withoutA1 = runRandomization(setRandomization(plan, id, { sources: removeSources(sources, [0]) }), id);
    assert.equal(withoutA1.stageList.has(a1), false);
    assert.deepEqual(tipChangeAt(withoutA1, a2), { tipType: otherTips().tipType, probes: [1, 3] });
  });

  test("nothing kept: every new stage starts like the old first stage; new filler wells start like the old filler stage", () => {
    const { plan: run, id } = runApartPlan();
    const [a1, a2, a3, filler] = randomizationAt(run, id).stages.map((owned) => owned.stage);
    let plan = withStageSettingsAndTips(run, a1, otherSettings(), otherTips());
    plan = addToWells(plan, [deepWell("A5"), deepWell("A6"), deepWell("A7")], "Drug B", capacityOf(DEEP));
    // No filler among the new sources (7 + 7 + 6 fill the 20 wells): a new filler stage would start
    // like the old filler stage, which the run removes (step 3's first rule).
    const replaced = runRandomization(
      setRandomization(plan, id, {
        sources: [source("A5", 7), source("A6", 7, false, true), source("A7", 6)],
      }),
      id,
    );
    assert.equal(randomizationAt(replaced, id).stages.length, 3);
    for (const { stage } of randomizationAt(replaced, id).stages) {
      assert.deepEqual(replaced.stageList.get(stage).settings, otherSettings());
      assert.deepEqual(tipsOfStage(replaced, stage), otherTips());
    }
    // The filler wells replaced: the new filler stage starts like the old one.
    const fillerSettings = withMode(defaultSettings(), "destination", OTHER_DESTINATION_MODE);
    let fillerPlan = withStageSettingsAndTips(run, filler, fillerSettings, otherTips());
    fillerPlan = addToWells(fillerPlan, [deepWell("A8")], "Media", capacityOf(DEEP));
    const sources = randomizationAt(fillerPlan, id).sources;
    const newFiller = runRandomization(
      setRandomization(fillerPlan, id, { sources: [...sources.slice(0, 3), source("A8", null, true)] }),
      id,
    );
    const newFillerStage = stageFor(newFiller, id, "A8");
    assert.equal(newFiller.stageList.has(filler), false);
    assert.deepEqual(newFiller.stageList.get(newFillerStage).settings, fillerSettings);
    assert.deepEqual(tipsOfStage(newFiller, newFillerStage), otherTips());
    for (const stage of [a1, a2, a3]) {
      assert.deepEqual(newFiller.stageList.get(stage).settings, fillerPlan.stageList.get(stage).settings);
      assert.deepEqual(tipsOfStage(newFiller, stage), tipsOfStage(fillerPlan, stage));
    }
  });

  test("randomizationStageValues gives its stages' shared values, null where they differ", () => {
    const { plan: run, id } = runApartPlan();
    const [a1, a2, a3] = randomizationAt(run, id).stages.map((owned) => owned.stage);
    const shared = randomizationStageValues(run, id);
    assert.deepEqual(shared, {
      sourceMode: DEFAULT_PIPETTING_MODE,
      sourceMixes: false,
      destinationMode: DEFAULT_PIPETTING_MODE,
      destinationMixes: false,
      tipType: sharingTips().tipType,
      probeCount: sharingTips().probes.length,
    });
    // The section 3 example: one stage aspirating another mode, every one dispensing the other mode.
    let plan = runRandomization(run, id, { destinationMode: OTHER_DESTINATION_MODE });
    plan = changeStageSettings(plan, a3, withMode(plan.stageList.get(a3).settings, "source", OTHER_SOURCE_MODE));
    assert.deepEqual(randomizationStageValues(plan, id), {
      sourceMode: null,
      sourceMixes: false,
      destinationMode: OTHER_DESTINATION_MODE,
      destinationMixes: false,
      tipType: sharingTips().tipType,
      probeCount: sharingTips().probes.length,
    });
    // A stage whose end isn't one of the modes; a group's tips changed with its ✎.
    const custom = changeStageSettings(run, a1, {
      ...run.stageList.get(a1).settings,
      destinationTechnique: "Custom_Technique",
      destinationLiquidType: "Custom_Liquid",
    });
    assert.equal(randomizationStageValues(custom, id).destinationMode, null);
    assert.equal(randomizationStageValues(setTipType(run, a2, otherTips().tipType), id).tipType, null);
    assert.equal(randomizationStageValues(setTipProbes(run, a2, [1]), id).probeCount, null);
    // Before a run: its own values.
    const { plan: setUp, id: setUpId } = sharingPlan();
    const own = setRandomization(setUp, setUpId, { settings: withMode(defaultSettings(), "source", OTHER_SOURCE_MODE, true) });
    assert.deepEqual(randomizationStageValues(own, setUpId), {
      sourceMode: OTHER_SOURCE_MODE,
      sourceMixes: true,
      destinationMode: DEFAULT_PIPETTING_MODE,
      destinationMixes: false,
      tipType: sharingTips().tipType,
      probeCount: sharingTips().probes.length,
    });
    assert.throws(() => randomizationStageValues(run, "r9"), { message: `There's no randomization "r9" in the plan.` });
  });

  // --- Stock tables (2026-11-05; transfer-designer.md, section 6, "Stock tables") ---

  // The start of a stock table's form message.
  const STOCK_FORM =
    "A stock table must be a list of rows, each a list of the same number of cells, each text, but";

  // The configured units, in the file's order, as the unknown-unit message lists them.
  const CONFIGURED_UNITS = CONCENTRATION_UNITS.map((entry) => entry.unit);

  // The unknown-unit message for unit text `written` in header `header`.
  function unknownUnitMessage(written, header) {
    return `“${written}” in “${header}” isn't a unit the tool knows. Use one of ${CONFIGURED_UNITS.join(", ")}.`;
  }

  // The colors of COMPONENT_COLORS that none of `plan`'s components has, in order.
  function freeColors(plan) {
    const taken = new Set(plan.components.map((component) => component.color));
    return COMPONENT_COLORS.filter((color) => !taken.has(color));
  }

  // A plan whose one component is Media, drawn in the first color of COMPONENT_COLORS.
  function planWithMedia() {
    return addComponent(emptyPlan().plan, "Media", COMPONENT_COLORS[0]);
  }

  // The specification's example stock table: Feed, Drug A 10mM and Water. A new table each time.
  function exampleStockTable() {
    return [
      ["Name", "Osmolality", "Hy-Soy (g/L)", "Yeast (g/L)", "Drug A (mM)", "DMSO (%)"],
      ["Feed", "310", "4", "0.5", "", ""],
      ["Drug A 10mM", "1450", "", "", "10", "100"],
      ["Water", "0", "", "", "", ""],
    ];
  }

  // The problems readStockTable gives for `table` on `plan`, with COMPONENT_COLORS.
  function stockProblems(plan, table) {
    return readStockTable(plan, table, COMPONENT_COLORS).problems;
  }

  // The amount readStockTable reads from a cell `text` under a "Salt (mM)" column, or the problem
  // message it gives for it, as { amount } or { message }; amount undefined when nothing is read.
  function readAmountCell(text) {
    const table = [
      ["Name", "Salt (mM)"],
      ["Feed", text],
    ];
    const { stocks, problems } = readStockTable(emptyPlan().plan, table, COMPONENT_COLORS);
    if (problems.length > 0) {
      return { message: problems[0].message, at: [problems[0].row, problems[0].column] };
    }
    return { amount: stocks[0].constituents[0]?.amount };
  }

  // The osmolality readStockTable reads from a cell `text` under an Osmolality column, or the
  // problem message it gives, as { osmolality } or { message }.
  function readOsmolalityCell(text) {
    const table = [
      ["Name", "Osmolality"],
      ["Feed", text],
    ];
    const { stocks, problems } = readStockTable(emptyPlan().plan, table, COMPONENT_COLORS);
    if (problems.length > 0) {
      return { message: problems[0].message };
    }
    return { osmolality: stocks[0].osmolality };
  }

  test("stock tables: readStockTable and addStocks throw the form message", () => {
    const plan = planWithMedia();
    const cases = [
      [[], `${STOCK_FORM} got [].`],
      [5, `${STOCK_FORM} got 5.`],
      [[["Name"], []], `${STOCK_FORM} row 2 is [].`],
      [[["Name", "Salt (mM)"], ["Feed"]], `${STOCK_FORM} row 2 has 1 cell and row 1 has 2.`],
      [[["Name", null]], `${STOCK_FORM} row 1, cell 2 is null.`],
    ];
    for (const [table, message] of cases) {
      assert.throws(() => readStockTable(plan, table, COMPONENT_COLORS), { message });
      assert.throws(() => addStocks(plan, table, COMPONENT_COLORS), { message });
    }
  });

  test("stock tables: the form is checked before the colors, then the colors message", () => {
    const plan = planWithMedia();
    assert.throws(() => readStockTable(plan, 5, 5), { message: `${STOCK_FORM} got 5.` });
    for (const [colors, shown] of [
      [5, "5"],
      [[5], "a list"],
    ]) {
      const message = `The colors must be a list of color texts, like ["#4e79a7"], but got ${shown}.`;
      assert.throws(() => readStockTable(plan, [["Name"]], colors), { message });
      assert.throws(() => addStocks(plan, [["Name"]], colors), { message });
    }
  });

  test("stock tables: a header alone reads as no stocks and no problems", () => {
    assert.deepEqual(readStockTable(planWithMedia(), [["Name"]], COMPONENT_COLORS), {
      stocks: [],
      problems: [],
    });
  });

  test("stock tables: the example reads as three stocks with the first free colors", () => {
    const plan = planWithMedia();
    const free = freeColors(plan);
    assert.deepEqual(readStockTable(plan, exampleStockTable(), COMPONENT_COLORS), {
      stocks: [
        {
          row: 1,
          name: "Feed",
          color: free[0],
          constituents: [constituentOf("Hy-Soy", 4, "g/L"), constituentOf("Yeast", 0.5, "g/L")],
          osmolality: 310,
        },
        {
          row: 2,
          name: "Drug A 10mM",
          color: free[1],
          constituents: [constituentOf("Drug A", 10, "mM"), constituentOf("DMSO", 100, "%")],
          osmolality: 1450,
        },
        { row: 3, name: "Water", color: free[2], constituents: [], osmolality: 0 },
      ],
      problems: [],
    });
  });

  test("stock tables: addStocks adds the example's stocks after Media, each as read", () => {
    const plan = planWithMedia();
    const { stocks } = readStockTable(plan, exampleStockTable(), COMPONENT_COLORS);
    const added = addStocks(plan, exampleStockTable(), COMPONENT_COLORS);
    assert.deepEqual(
      added.components.map((component) => component.name),
      ["Media", "Feed", "Drug A 10mM", "Water"],
    );
    assert.deepEqual(added.components[0], plan.components[0]);
    stocks.forEach((stock, index) => {
      assert.deepEqual(added.components[index + 1], {
        name: stock.name,
        color: stock.color,
        constituents: stock.constituents,
        osmolality: stock.osmolality,
      });
    });
  });

  test("stock tables: osmolality headers in any capitals, with or without (mOsm/kg)", () => {
    for (const header of ["osmolality", "OSMOLALITY (mOsm/kg)", "Osmolality(mOsm/kg)", "Osmolality ( mOsm/kg )"]) {
      const { stocks, problems } = readStockTable(
        emptyPlan().plan,
        [
          ["Name", header],
          ["Feed", "300"],
        ],
        COMPONENT_COLORS,
      );
      assert.deepEqual(problems, [], header);
      assert.equal(stocks[0].osmolality, 300, header);
    }
  });

  test("stock tables: Osmolality (mosm/kg) is a constituent in an unknown unit", () => {
    assert.deepEqual(stockProblems(emptyPlan().plan, [["Name", "Osmolality (mosm/kg)"]]), [
      { row: 0, column: 1, message: unknownUnitMessage("mosm/kg", "Osmolality (mosm/kg)") },
    ]);
  });

  test("stock tables: every configured unit and every spelling is read as its unit", () => {
    const written = [
      ...CONFIGURED_UNITS.map((unit) => [unit, unit]),
      ...Object.entries(UNIT_SPELLINGS),
    ];
    for (const [text, unit] of written) {
      const { stocks, problems } = readStockTable(
        emptyPlan().plan,
        [
          ["Name", `Salt (${text})`],
          ["Feed", "4"],
        ],
        COMPONENT_COLORS,
      );
      assert.deepEqual(problems, [], text);
      assert.deepEqual(stocks[0].constituents, [constituentOf("Salt", 4, unit)], text);
    }
  });

  test("stock tables: units that are neither a unit nor a spelling are unknown", () => {
    for (const text of ["UM", "G/L", "mm", "mg/mL", "% v/v"]) {
      const configured = CONFIGURED_UNITS.includes(text) || Object.hasOwn(UNIT_SPELLINGS, text);
      if (configured) {
        continue;
      }
      const header = `Salt (${text})`;
      assert.deepEqual(stockProblems(emptyPlan().plan, [["Name", header]]), [
        { row: 0, column: 1, message: unknownUnitMessage(text, header) },
      ]);
    }
  });

  test("stock tables: spaces inside the brackets, and brackets in the name, are read", () => {
    const { stocks, problems } = readStockTable(
      emptyPlan().plan,
      [
        ["Name", "Drug ( mM )", "Salt (A) (mM)"],
        ["Feed", "1", "2"],
      ],
      COMPONENT_COLORS,
    );
    assert.deepEqual(problems, []);
    assert.deepEqual(stocks[0].constituents, [
      constituentOf("Drug", 1, "mM"),
      constituentOf("Salt (A)", 2, "mM"),
    ]);
  });

  test("stock tables: each header problem is at its cell, and the cells under it aren't read", () => {
    const table = [
      ["Name", "", "Osmolality", "osmolality", "KCl", "(mM)", "NaCl (g)", "Drug A (mM)", "Drug A (µM)"],
      ["Feed", "x", "300", "x", "x", "x", "x", "1", "x"],
    ];
    const { stocks, problems } = readStockTable(emptyPlan().plan, table, COMPONENT_COLORS);
    assert.deepEqual(problems, [
      { row: 0, column: 1, message: "Column 2 has no header. Give it one, like “Hy-Soy (g/L)”." },
      { row: 0, column: 3, message: "There are two Osmolality columns. Keep one." },
      { row: 0, column: 4, message: "“KCl” needs its unit in brackets, like “KCl (g/L)”." },
      {
        row: 0,
        column: 5,
        message: "“(mM)” needs a constituent's name before its unit, like “Drug A (mM)”.",
      },
      { row: 0, column: 6, message: unknownUnitMessage("g", "NaCl (g)") },
      { row: 0, column: 8, message: "“Drug A” has two columns. Give each constituent one column." },
    ]);
    assert.equal(stocks[0].osmolality, 300);
    assert.deepEqual(stocks[0].constituents, [constituentOf("Drug A", 1, "mM")]);
  });

  test("stock tables: the unknown-unit message lists the configured units in order", () => {
    const [problem] = stockProblems(emptyPlan().plan, [["Name", "NaCl (g)"]]);
    assert.ok(problem.message.endsWith(`Use one of ${CONFIGURED_UNITS.join(", ")}.`));
  });

  test("stock tables: fully blank columns and rows are ignored but keep their places", () => {
    const table = [
      ["Name", "Salt (mM)", "", "Drug (mM)"],
      ["Feed", "1", "", "two"],
      ["", "", "", ""],
      ["Water", "", "", "x"],
    ];
    const { stocks, problems } = readStockTable(emptyPlan().plan, table, COMPONENT_COLORS);
    assert.deepEqual(
      stocks.map((stock) => [stock.row, stock.name]),
      [
        [1, "Feed"],
        [3, "Water"],
      ],
    );
    assert.deepEqual(problems, [
      { row: 1, column: 3, message: "Feed's Drug must be a number, like 4, but is “two”." },
      { row: 3, column: 3, message: "Water's Drug must be a number, like 4, but is “x”." },
    ]);
  });

  test("stock tables: column 0 is the names even when it's fully blank", () => {
    const table = [
      ["", "Salt (mM)"],
      ["", "1"],
    ];
    assert.deepEqual(stockProblems(emptyPlan().plan, table), [
      { row: 1, column: 0, message: "Row 2 has no name. Give the stock a name, or take the row out." },
    ]);
  });

  test("stock tables: name problems are at the name cell, and those rows take no color", () => {
    const plan = planWithMedia();
    const free = freeColors(plan);
    const table = [
      ["Name", "Salt (mM)"],
      ["", "1"],
      ["Media", "1"],
      [" Media ", "1"],
      ["Feed", "1"],
      ["Feed", "2"],
      ["Water", ""],
    ];
    const { stocks, problems } = readStockTable(plan, table, COMPONENT_COLORS);
    assert.deepEqual(problems, [
      { row: 1, column: 0, message: "Row 2 has no name. Give the stock a name, or take the row out." },
      { row: 2, column: 0, message: "“Media” is already in the plan. Rename the row, or take it out." },
      { row: 3, column: 0, message: "“Media” is already in the plan. Rename the row, or take it out." },
      { row: 5, column: 0, message: "“Feed” is in the table twice. Each stock needs its own name." },
    ]);
    assert.deepEqual(
      stocks.map((stock) => stock.color),
      [null, null, null, free[0], null, free[1]],
    );
  });

  test("stock tables: amounts are read with commas, decimals and exponents", () => {
    const cases = [
      ["4", 4],
      ["0.5", 0.5],
      [".5", 0.5],
      ["4.", 4],
      ["1,500,000", 1500000],
      ["1.5e6", 1500000],
      ["1e-7", 1e-7],
    ];
    for (const [text, amount] of cases) {
      assert.deepEqual(readAmountCell(text), { amount }, text);
    }
  });

  test("stock tables: blank, 0 and 0.0 add nothing", () => {
    for (const text of ["", "0", "0.0"]) {
      assert.deepEqual(readAmountCell(text), { amount: undefined }, text);
    }
  });

  test("stock tables: anything else in an amount cell is a problem at its cell", () => {
    for (const text of ["-4", "+4", "4 g", "two", "1.2.3", "e5", "0x10", "1e400"]) {
      assert.deepEqual(
        readAmountCell(text),
        { message: `Feed's Salt must be a number, like 4, but is “${text}”.`, at: [1, 1] },
        text,
      );
    }
  });

  test("stock tables: osmolality is read like an amount, but 0 is the value 0", () => {
    assert.deepEqual(readOsmolalityCell(""), { osmolality: null });
    assert.deepEqual(readOsmolalityCell("0"), { osmolality: 0 });
    assert.deepEqual(readOsmolalityCell("1,450"), { osmolality: 1450 });
    assert.deepEqual(readOsmolalityCell("1e-7"), { osmolality: 1e-7 });
    for (const text of ["-5", "high", "1e400"]) {
      assert.deepEqual(
        readOsmolalityCell(text),
        { message: `Feed's osmolality must be a number, like 300, but is “${text}”.` },
        text,
      );
    }
  });

  test("stock tables: cells in a row whose name is a problem are still read", () => {
    const table = [
      ["Name", "Salt (mM)", "Osmolality"],
      ["Media", "two", "high"],
      ["", "x", ""],
    ];
    assert.deepEqual(stockProblems(planWithMedia(), table), [
      { row: 1, column: 0, message: "“Media” is already in the plan. Rename the row, or take it out." },
      { row: 1, column: 1, message: "Media's Salt must be a number, like 4, but is “two”." },
      { row: 1, column: 2, message: "Media's osmolality must be a number, like 300, but is “high”." },
      { row: 2, column: 0, message: "Row 3 has no name. Give the stock a name, or take the row out." },
      { row: 2, column: 1, message: "Row 3's Salt must be a number, like 4, but is “x”." },
    ]);
  });

  test("stock tables: a row whose try throws has a whole-row problem; others are added", () => {
    const plan = planWithFeedingMedia();
    const molar = unitsOf(familyOf(MOLAR_UNIT))[0];
    const table = [
      ["Name", `Hy-Soy (${molar})`, "Salt (mM)", "Osmolality"],
      ["Feed", "1", "", "high"],
      ["Feed 2", "1", "", ""],
      ["Water", "", "1", ""],
      ["Feed 3", "2", "", ""],
    ];
    const { stocks, problems } = readStockTable(plan, table, COMPONENT_COLORS);
    const family = familyMessage("Hy-Soy", MASS_UNIT, "Feeding media");
    assert.deepEqual(problems, [
      { row: 1, column: 3, message: "Feed's osmolality must be a number, like 300, but is “high”." },
      { row: 2, column: null, message: `Feed 2: ${family}` },
      { row: 4, column: null, message: `Feed 3: ${family}` },
    ]);
    assert.deepEqual(
      stocks.map((stock) => stock.color),
      [null, null, freeColors(plan)[0], null],
    );
  });

  test("stock tables: a bad header doesn't stop rows being tried and colored", () => {
    const plan = planWithMedia();
    const free = freeColors(plan);
    const table = [
      ["Name", "KCl", "Salt (mM)"],
      ["Feed", "x", "1"],
      ["Water", "", ""],
    ];
    const { stocks, problems } = readStockTable(plan, table, COMPONENT_COLORS);
    assert.equal(problems.length, 1);
    assert.deepEqual(
      stocks.map((stock) => stock.color),
      [free[0], free[1]],
    );
    assert.deepEqual(stocks[0].constituents, [constituentOf("Salt", 1, "mM")]);
  });

  test("stock tables: a row whose try fails takes no color, so the next row takes it", () => {
    const plan = planWithFeedingMedia();
    const free = freeColors(plan);
    const table = [
      ["Name", "Hy-Soy (mM)"],
      ["First", ""],
      ["Second", "1"],
      ["Third", ""],
    ];
    const { stocks } = readStockTable(plan, table, COMPONENT_COLORS);
    assert.deepEqual(
      stocks.map((stock) => stock.color),
      [free[0], null, free[1]],
    );
  });

  test("stock tables: with no free color left, the rest have a whole-row problem", () => {
    const plan = planWithMedia();
    const colors = [COMPONENT_COLORS[0], COMPONENT_COLORS[1]];
    const table = [["Name"], ["Feed"], ["Water"], ["Buffer"]];
    const { stocks, problems } = readStockTable(plan, table, colors);
    assert.deepEqual(
      stocks.map((stock) => stock.color),
      [COMPONENT_COLORS[1], null, null],
    );
    assert.deepEqual(
      problems,
      ["Water", "Buffer"].map((name, index) => ({
        row: index + 2,
        column: null,
        message: `There's no free color for ${name}. Two components can't share one, and all ${colors.length} are taken. Take some rows out, or remove a component.`,
      })),
    );
  });

  test("stock tables: addStocks throws the first problem's message, then the no-stocks message", () => {
    const plan = planWithMedia();
    assert.throws(() => addStocks(plan, [["Name"], ["Media"], [""]], COMPONENT_COLORS), {
      message: "“Media” is already in the plan. Rename the row, or take it out.",
    });
    const noStocks = {
      message: "The stock table has no stocks to add. Give it at least one row under the header.",
    };
    assert.throws(() => addStocks(plan, [["Name"]], COMPONENT_COLORS), noStocks);
    assert.throws(() => addStocks(plan, [["Name"], [""]], COMPONENT_COLORS), noStocks);
  });

  test("stock tables: addStocks doesn't change its plan, and one Undo takes its stocks out", () => {
    const plan = planWithMedia();
    const before = snapshot(plan);
    const added = addStocks(plan, exampleStockTable(), COMPONENT_COLORS);
    assert.equal(snapshot(plan), before);
    assert.equal(new PlanHistory(plan).record(added).undo().present, plan);
  });

  test("stock tables: stockTable of an empty plan is a header alone", () => {
    assert.deepEqual(stockTable(emptyPlan().plan), [["Name"]]);
  });

  test("stock tables: stockTable writes the plan's components in its order, columns first met", () => {
    let plan = emptyPlan().plan;
    plan = addComponent(plan, "Media", COMPONENT_COLORS[0]);
    plan = addComponent(plan, "Feed", COMPONENT_COLORS[1]);
    plan = addComponent(plan, "Water", COMPONENT_COLORS[2]);
    plan = setConstituents(plan, "Media", [constituentOf("Yeast", 2, "g/L")]);
    plan = setConstituents(plan, "Feed", [
      constituentOf("Hy-Soy", 4, "g/L"),
      constituentOf("Yeast", 0.5, "g/L"),
    ]);
    assert.deepEqual(stockTable(plan), [
      ["Name", "Yeast (g/L)", "Hy-Soy (g/L)"],
      ["Media", "2", ""],
      ["Feed", "0.5", "4"],
      ["Water", "", ""],
    ]);
    plan = setOsmolality(plan, "Water", 0);
    plan = setOsmolality(plan, "Feed", 1e-7);
    assert.deepEqual(
      stockTable(plan).map((row) => row[1]),
      ["Osmolality", "", "1e-7", "0"],
    );
  });

  test("stock tables: stockTable converts amounts into the unit a name is first met in", () => {
    let plan = emptyPlan().plan;
    plan = addComponent(plan, "Low", COMPONENT_COLORS[0]);
    plan = addComponent(plan, "High", COMPONENT_COLORS[1]);
    plan = addComponent(plan, "Tiny", COMPONENT_COLORS[2]);
    plan = setConstituents(plan, "Low", [constituentOf("Drug B", 1, "µM")]);
    plan = setConstituents(plan, "High", [constituentOf("Drug B", 0.5, "mM")]);
    plan = setConstituents(plan, "Tiny", [constituentOf("Drug B", 0.0003, "mM")]);
    const ratio = factorOf("mM") / factorOf("µM");
    assert.deepEqual(stockTable(plan), [
      ["Name", "Drug B (µM)"],
      ["Low", "1"],
      ["High", String(Number((0.5 * ratio).toPrecision(12)))],
      ["Tiny", String(Number((0.0003 * ratio).toPrecision(12)))],
    ]);
    if (ratio === 1000) {
      assert.equal(stockTable(plan)[2][1], "500");
      assert.equal(stockTable(plan)[3][1], "0.3");
    }
  });

  test("stock tables: a plan written out reads back as the same components", () => {
    let plan = emptyPlan().plan;
    plan = addComponent(plan, "Media", COMPONENT_COLORS[0]);
    plan = addComponent(plan, "Cell stock", COMPONENT_COLORS[1]);
    plan = addComponent(plan, "Drug A stock", COMPONENT_COLORS[2]);
    plan = addComponent(plan, "Empty", COMPONENT_COLORS[3]);
    plan = setOsmolality(plan, "Media", 300);
    plan = setOsmolality(plan, "Drug A stock", 1450);
    plan = setConstituents(plan, "Media", [constituentOf("Hy-Soy", 4, "g/L")]);
    plan = setConstituents(plan, "Cell stock", [
      constituentOf("Cells", 1500000, CELL_DENSITY_UNIT),
      constituentOf("Hy-Soy", 0.3, MASS_SUBUNIT),
    ]);
    plan = setConstituents(plan, "Drug A stock", [
      constituentOf("Drug A", 10, "mM"),
      constituentOf("DMSO", 100, "%"),
    ]);
    const table = stockTable(plan);
    assert.deepEqual(readStockTable(emptyPlan().plan, table, COMPONENT_COLORS).problems, []);
    const readBack = addStocks(emptyPlan().plan, table, COMPONENT_COLORS);
    assert.deepEqual(
      readBack.components.map(({ name, osmolality }) => ({ name, osmolality })),
      plan.components.map(({ name, osmolality }) => ({ name, osmolality })),
    );
    // Each constituent compared in its family's base unit, within 1e-9 relative. Sorted by name:
    // a stock table's columns put a component's constituents in first-met order, which may differ
    // from the order it lists them in (Cell stock's Hy-Soy comes after Cells, but its column first).
    const inBase = (component) =>
      component.constituents
        .map(({ name, amount, unit }) => ({ name, family: familyOf(unit), value: amount * factorOf(unit) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    plan.components.forEach((component, index) => {
      const expected = inBase(component);
      const actual = inBase(readBack.components[index]);
      assert.deepEqual(
        actual.map(({ name, family }) => ({ name, family })),
        expected.map(({ name, family }) => ({ name, family })),
      );
      actual.forEach((entry, place) => {
        const wanted = expected[place].value;
        assert.ok(Math.abs(entry.value - wanted) <= 1e-9 * wanted, `${entry.name}: ${entry.value}`);
      });
    });
  });

  test("stock tables: config UNIT_SPELLINGS values are configured units, and no key is one", () => {
    for (const [spelling, unit] of Object.entries(UNIT_SPELLINGS)) {
      assert.ok(CONFIGURED_UNITS.includes(unit), `${spelling} → ${unit}`);
      assert.ok(!CONFIGURED_UNITS.includes(spelling), spelling);
    }
  });

  // --- Copied decks (2026-11-06; transfer-designer.md, section 6, "Copied decks") ---
  // Labware is found in DECK by type (PLATE, DEEP, RESERVOIR, OTHER_PLATE), and every volume is
  // worked out from config/labware-types.js through capacityOf and deadVolumeOf.

  // What the test plan's stage draws: half a plate well of Media and a tenth of one of Drug A.
  const DECK_MEDIA_DRAW = capacityOf(PLATE) / 2;
  const DECK_DRUG_DRAW = capacityOf(PLATE) / 10;
  // The starting volumes: the labware's dead volume, plus what the stage draws, plus as much again
  // to spare.
  const DECK_TROUGH_START = deadVolumeOf(RESERVOIR) + DECK_MEDIA_DRAW * 2;
  const DECK_DEEP_START = deadVolumeOf(DEEP) + DECK_DRUG_DRAW * 2;
  // The test plan's wells: the trough holding Media, the deep well holding Drug A, and the plate
  // well the stage fills.
  const DECK_TROUGH = trough("1");
  const DECK_DEEP_WELL = { labware: DEEP, well: "A1" };
  const DECK_PLATE_WELL = plateWell("B2");
  const AT_END = "At the end, after all stages";

  // The copied-deck message for a damaged part, e.g. damagedDeckMessage("its point …").
  function damagedDeckMessage(problem) {
    return `This copied deck is damaged: ${problem}`;
  }
  const NOT_A_COPIED_DECK = "This isn't a deck copied from the transfer designer.";
  const CANT_COPY_DECK =
    "The deck can't be copied at this point: a transfer before it draws more than a well can give, into its dead volume or beyond what it holds. Fix those transfers first, or copy from an earlier point.";

  // Media's and Drug A's details as the test plan has them. New objects each time.
  function deckMedia() {
    return { name: "Media", color: COMPONENT_COLORS[0], constituents: [], osmolality: 300 };
  }
  function deckDrug() {
    return {
      name: "Drug A",
      color: COMPONENT_COLORS[1],
      constituents: [constituentOf("Drug A", 10, MOLAR_UNIT)],
      osmolality: null,
    };
  }

  // The plan with `component` ({ name, color, constituents, osmolality }) added with its details.
  function withDeckComponent(plan, component) {
    let added = addComponent(plan, component.name, component.color);
    added = setConstituents(added, component.name, component.constituents);
    return setOsmolality(added, component.name, component.osmolality);
  }

  // The test plan: Media and Drug A at Start in a trough and a deep well, one stage moving some of
  // each into one plate well, labeled "Cond 1", its plate labeled "Assay plate".
  function deckPlan() {
    const { plan: empty, stageId } = emptyPlan();
    let plan = withDeckComponent(withDeckComponent(empty, deckMedia()), deckDrug());
    plan = addToWells(plan, [DECK_TROUGH], "Media", DECK_TROUGH_START);
    plan = addToWells(plan, [DECK_DEEP_WELL], "Drug A", DECK_DEEP_START);
    plan = addTransfers(plan, [
      { type: "transfer", source: DECK_TROUGH, destination: DECK_PLATE_WELL, volume: DECK_MEDIA_DRAW, stage: stageId },
      { type: "transfer", source: DECK_DEEP_WELL, destination: DECK_PLATE_WELL, volume: DECK_DRUG_DRAW, stage: stageId },
    ]);
    plan = setWellLabel(plan, DECK_PLATE_WELL, "Cond 1");
    return setLabel(plan, PLATE, "Assay plate");
  }

  // The plan's snapshot at Start and at the end.
  function atStart(plan) {
    return replay(plan.startingContents, plan.operationList, 0);
  }
  function atEnd(plan) {
    return replay(plan.startingContents, plan.operationList);
  }

  // The test plan copied at the end.
  function deckCopy() {
    const plan = deckPlan();
    return copyDeck(plan, atEnd(plan), AT_END);
  }

  // The test plan with a second stage, last, with one transfer of `volume` µL from the trough into
  // `destination`.
  function deckPlanWithDraw(volume, destination) {
    let { plan, id } = addStage(deckPlan(), null);
    return addTransfer(plan, { type: "transfer", source: DECK_TROUGH, destination, volume, stage: id });
  }

  // The kinds of a snapshot's problems, e.g. ["overdraw"].
  function problemKinds(snapshot) {
    return snapshot.listProblems().map((problem) => problem.kind);
  }

  // The test plan with nothing at the start: its components, labels and stage stay.
  function deckPlanEmptied() {
    const plan = deckPlan();
    return emptyWells(plan, plan.startingContents);
  }

  test("copied decks: COPIED_DECK_FORMAT and COPIED_DECK_VERSION", () => {
    assert.equal(COPIED_DECK_FORMAT, "biomek-tools copied deck");
    assert.equal(COPIED_DECK_VERSION, 1);
  });

  test("copied decks: copying at the end gives every well, the components and the labels", () => {
    const copy = deckCopy();
    assert.deepEqual(copy, {
      format: COPIED_DECK_FORMAT,
      version: COPIED_DECK_VERSION,
      point: AT_END,
      components: [deckMedia(), deckDrug()],
      wells: [
        { ...DECK_TROUGH, components: { Media: DECK_TROUGH_START - DECK_MEDIA_DRAW } },
        { ...DECK_DEEP_WELL, components: { "Drug A": DECK_DEEP_START - DECK_DRUG_DRAW } },
        { ...DECK_PLATE_WELL, components: { Media: DECK_MEDIA_DRAW, "Drug A": DECK_DRUG_DRAW } },
      ],
      wellLabels: { [PLATE]: { B2: "Cond 1" } },
      labwareLabels: { [PLATE]: "Assay plate" },
    });
  });

  test("copied decks: copying at Start gives the starting contents", () => {
    const plan = deckPlan();
    const copy = copyDeck(plan, atStart(plan), "At Start");
    assert.equal(copy.point, "At Start");
    assert.deepEqual(copy.wells, [
      { ...DECK_TROUGH, components: { Media: DECK_TROUGH_START } },
      { ...DECK_DEEP_WELL, components: { "Drug A": DECK_DEEP_START } },
    ]);
  });

  test("copied decks: a component no well holds isn't copied", () => {
    const plan = addComponent(deckPlan(), "Water", COMPONENT_COLORS[2]);
    const copy = copyDeck(plan, atEnd(plan), AT_END);
    assert.deepEqual(
      copy.components.map((component) => component.name),
      ["Media", "Drug A"],
    );
  });

  test("copied decks: a well's small real amount is copied as the snapshot gives it", () => {
    let plan = deckPlan();
    const tail = { labware: OTHER_PLATE, well: "H12" };
    plan = addToWells(plan, [tail], "Media", DECK_DRUG_DRAW);
    plan = addToWells(plan, [tail], "Drug A", 1e-7);
    const snapshot = atStart(plan);
    const copy = copyDeck(plan, snapshot, "At Start");
    const copiedTail = copy.wells.find((entry) => entry.labware === OTHER_PLATE);
    assert.deepEqual(copiedTail.components, snapshot.componentsOf(OTHER_PLATE, "H12"));
    assert.equal(copiedTail.components["Drug A"], 1e-7);
  });

  test("copied decks: a point with nothing in any well gives no wells and no components", () => {
    const plan = addComponent(emptyPlan().plan, "Media", COMPONENT_COLORS[0]);
    const copy = copyDeck(plan, atEnd(plan), AT_END);
    assert.deepEqual(copy.wells, []);
    assert.deepEqual(copy.components, []);
  });

  test("copied decks: the copy shares nothing with the plan", () => {
    const plan = deckPlan();
    const copy = copyDeck(plan, atEnd(plan), AT_END);
    copy.wellLabels[PLATE].B2 = "Changed";
    copy.labwareLabels[PLATE] = "Changed";
    copy.components[1].constituents[0].amount = 99;
    assert.equal(wellLabelOf(plan, DECK_PLATE_WELL), "Cond 1");
    assert.equal(labelOf(plan, PLATE), "Assay plate");
    assert.equal(plan.components[1].constituents[0].amount, 10);
  });

  test("copied decks: copying after an overdraw or a draw into the dead volume is refused", () => {
    // More than the trough holds after the first stage.
    const overdrawn = deckPlanWithDraw(DECK_TROUGH_START, { labware: DEEP, well: "B1" });
    assert.ok(problemKinds(atEnd(overdrawn)).includes("overdraw"));
    assert.throws(() => copyDeck(overdrawn, atEnd(overdrawn), AT_END), { message: CANT_COPY_DECK });
    // More than the trough's usable volume, less than it holds: only possible with a dead volume
    // (config/labware-types.js), so skipped if the trough's is ever 0.
    if (deadVolumeOf(RESERVOIR) > 0) {
      const usable = DECK_TROUGH_START - DECK_MEDIA_DRAW - deadVolumeOf(RESERVOIR);
      const intoDead = deckPlanWithDraw(usable + deadVolumeOf(RESERVOIR) / 2, {
        labware: DEEP,
        well: "B1",
      });
      assert.deepEqual(problemKinds(atEnd(intoDead)), ["dead-volume"]);
      assert.throws(() => copyDeck(intoDead, atEnd(intoDead), AT_END), { message: CANT_COPY_DECK });
    }
    // Copying before the problem works.
    assert.equal(copyDeck(overdrawn, atStart(overdrawn), "At Start").wells.length, 2);
  });

  test("copied decks: an overfill alone is copied, with the overfilled volume", () => {
    const overfilled = deckPlanWithDraw(DECK_MEDIA_DRAW, DECK_PLATE_WELL);
    assert.deepEqual(problemKinds(atEnd(overfilled)), ["overfill"]);
    const copy = copyDeck(overfilled, atEnd(overfilled), AT_END);
    const plateEntry = copy.wells.find((entry) => entry.labware === PLATE);
    assert.deepEqual(plateEntry.components, { Media: DECK_MEDIA_DRAW * 2, "Drug A": DECK_DRUG_DRAW });
  });

  test("copied decks: a point that isn't non-blank text is refused before any other check", () => {
    const overdrawn = deckPlanWithDraw(DECK_TROUGH_START, { labware: DEEP, well: "B1" });
    for (const [point, shown] of [
      [5, "5"],
      ["  ", '"  "'],
    ]) {
      assert.throws(() => copyDeck(overdrawn, atEnd(overdrawn), point), {
        message: `The point a deck is copied at must be non-blank text, like "At the end, after all stages", but got ${shown}.`,
      });
    }
  });

  test("copied decks: pasting into an empty plan gives back the copy at Start", () => {
    const copy = deckCopy();
    const { plan } = emptyPlan();
    const before = snapshot(plan);
    const pasted = pasteDeck(plan, copy, COMPONENT_COLORS);
    assert.equal(snapshot(plan), before);
    assert.deepEqual(copyDeck(pasted, atStart(pasted), "At Start"), { ...copy, point: "At Start" });
    assert.equal(wellLabelOf(pasted, DECK_PLATE_WELL), "Cond 1");
    assert.equal(labelOf(pasted, PLATE), "Assay plate");
    assert.deepEqual(pasted.components, [deckMedia(), deckDrug()]);
  });

  test("copied decks: a deck is pasted only into an empty start", () => {
    const copy = deckCopy();
    const oneWell = addToWells(
      addComponent(emptyPlan().plan, "Water", COMPONENT_COLORS[5]),
      [plateWell("A1")],
      "Water",
      DECK_DRUG_DRAW,
    );
    assert.throws(() => pasteDeck(oneWell, copy, COMPONENT_COLORS), {
      message: "A deck can be pasted only into an empty start, but 1 well holds something at the start. Empty them first.",
    });
    const pastedOnce = pasteDeck(emptyPlan().plan, copy, COMPONENT_COLORS);
    assert.throws(() => pasteDeck(pastedOnce, copy, COMPONENT_COLORS), {
      message: "A deck can be pasted only into an empty start, but 3 wells hold something at the start. Empty them first.",
    });
  });

  test("copied decks: a plan with components and stages but nothing at the start pastes", () => {
    const plan = deckPlanEmptied();
    assert.deepEqual(plan.startingContents, []);
    const copy = deckCopy();
    const pasted = pasteDeck(plan, copy, COMPONENT_COLORS);
    assert.deepEqual(copyDeck(pasted, atStart(pasted), AT_END).wells, copy.wells);
    assert.deepEqual(pasted.stageOrder, plan.stageOrder);
    assert.equal(pasted.operationList.listOperations().length, 2);
  });

  test("copied decks: a component already in the plan with the same details keeps its color", () => {
    const plan = withDeckComponent(emptyPlan().plan, { ...deckMedia(), color: COMPONENT_COLORS[5] });
    const pasted = pasteDeck(plan, deckCopy(), COMPONENT_COLORS);
    assert.deepEqual(pasted.components, [{ ...deckMedia(), color: COMPONENT_COLORS[5] }, deckDrug()]);
  });

  test("copied decks: a component already in the plan with other details is refused", () => {
    const mismatch =
      "Media is already in this plan with different contents or osmolality. Rename one of them, or make them match, then paste again.";
    const otherOsmolality = withDeckComponent(emptyPlan().plan, { ...deckMedia(), osmolality: 290 });
    const withConstituent = withDeckComponent(emptyPlan().plan, {
      ...deckMedia(),
      constituents: [constituentOf("Hy-Soy", 4, MASS_UNIT)],
    });
    for (const plan of [otherOsmolality, withConstituent]) {
      const before = snapshot(plan);
      assert.throws(() => pasteDeck(plan, deckCopy(), COMPONENT_COLORS), { message: mismatch });
      assert.equal(snapshot(plan), before);
    }
  });

  test("copied decks: a new component whose color is taken gets a free one no copied component carries", () => {
    // Water takes Media's copied color; the first free color is Drug A's own, so Media skips it.
    const plan = addComponent(emptyPlan().plan, "Water", COMPONENT_COLORS[0]);
    const pasted = pasteDeck(plan, deckCopy(), COMPONENT_COLORS);
    assert.deepEqual(
      pasted.components.map((component) => [component.name, component.color]),
      [
        ["Water", COMPONENT_COLORS[0]],
        ["Media", COMPONENT_COLORS[2]],
        ["Drug A", COMPONENT_COLORS[1]],
      ],
    );
  });

  test("copied decks: with every color taken, the no-free-color message", () => {
    const plan = addComponent(emptyPlan().plan, "Water", COMPONENT_COLORS[0]);
    assert.throws(() => pasteDeck(plan, deckCopy(), [COMPONENT_COLORS[0], COMPONENT_COLORS[1]]), {
      message: "There's no free color for Media: every color is taken. Remove a component first.",
    });
  });

  test("copied decks: colors that aren't a list of text are refused", () => {
    assert.throws(() => pasteDeck(emptyPlan().plan, deckCopy(), 5), {
      message: 'The colors must be a list of color texts, like ["#4e79a7"], but got 5.',
    });
  });

  test("copied decks: well labels that agree paste, and a different one is refused", () => {
    const labeled = setLabel(setWellLabel(emptyPlan().plan, DECK_PLATE_WELL, "Cond 1"), PLATE, "Assay plate");
    const pasted = pasteDeck(labeled, deckCopy(), COMPONENT_COLORS);
    assert.equal(wellLabelOf(pasted, DECK_PLATE_WELL), "Cond 1");
    const other = setLabel(setWellLabel(emptyPlan().plan, DECK_PLATE_WELL, "Cond 2"), PLATE, "Assay plate");
    assert.throws(() => pasteDeck(other, deckCopy(), COMPONENT_COLORS), {
      message: 'Assay plate B2 is already named "Cond 2" here, but "Cond 1" in the copy. Rename one of them, then paste again.',
    });
  });

  test("copied decks: labware labels that agree paste, and a different one is refused", () => {
    const same = setLabel(emptyPlan().plan, PLATE, "Assay plate");
    assert.equal(labelOf(pasteDeck(same, deckCopy(), COMPONENT_COLORS), PLATE), "Assay plate");
    const other = setLabel(emptyPlan().plan, PLATE, "Plate A");
    assert.throws(() => pasteDeck(other, deckCopy(), COMPONENT_COLORS), {
      message: `${PLATE} is labeled "Plate A" here, but "Assay plate" in the copy. Rename one of them, then paste again.`,
    });
    const taken = setLabel(emptyPlan().plan, OTHER_PLATE, "Assay plate");
    assert.throws(() => pasteDeck(taken, deckCopy(), COMPONENT_COLORS), {
      message: `${OTHER_PLATE} already has the label "Assay plate". Choose a different one.`,
    });
  });

  test("copied decks: what isn't a copied deck is refused", () => {
    const copy = deckCopy();
    const cases = [
      5,
      null,
      {},
      [copy],
      { format: COPIED_ITEMS_FORMAT, version: COPIED_ITEMS_VERSION, items: [] },
      { ...copy, extra: 1 },
      { ...copy, version: 0 },
      { ...copy, version: 1.5 },
      { ...copy, version: "1" },
    ];
    for (const copied of cases) {
      assert.throws(() => pasteDeck(emptyPlan().plan, copied, COMPONENT_COLORS), {
        message: NOT_A_COPIED_DECK,
      });
    }
  });

  test("copied decks: a copy from a newer version is refused, before the properties are checked", () => {
    const newer = COPIED_DECK_VERSION + 1;
    const message = `This deck was copied by a newer version of the transfer designer (copied deck version ${newer}; this one reads up to ${COPIED_DECK_VERSION}). Use the newer version.`;
    for (const copied of [
      { ...deckCopy(), version: newer },
      { ...deckCopy(), version: newer, extra: 1 },
    ]) {
      assert.throws(() => pasteDeck(emptyPlan().plan, copied, COMPONENT_COLORS), { message });
    }
  });

  test("copied decks: each damaged part gives its message, in property order", () => {
    const copy = deckCopy();
    const componentsMessage = (got) =>
      damagedDeckMessage(
        `its components must be a list of { name, color, constituents, osmolality }, but got ${got}.`,
      );
    const wellsMessage = (got) =>
      damagedDeckMessage(`its wells must be a list of { labware, well, components }, but got ${got}.`);
    const cases = [
      [{ point: 5 }, damagedDeckMessage("its point must be non-blank text, but got 5.")],
      [{ point: " " }, damagedDeckMessage('its point must be non-blank text, but got " ".')],
      [{ point: 5, wells: 5 }, damagedDeckMessage("its point must be non-blank text, but got 5.")],
      [{ components: 5 }, componentsMessage("5")],
      [{ components: [5] }, componentsMessage("5")],
      [{ components: [{ name: "Media" }] }, componentsMessage("an object")],
      [{ components: [deckMedia(), deckDrug(), deckMedia()] }, damagedDeckMessage("its components list “Media” twice.")],
      [{ wells: 5 }, wellsMessage("5")],
      [{ wells: [{ ...DECK_TROUGH }] }, wellsMessage("an object")],
      [{ wells: [{ ...DECK_TROUGH, components: 5 }] }, wellsMessage("an object")],
      [
        { wells: [copy.wells[0], copy.wells[0]] },
        damagedDeckMessage(`it lists ${RESERVOIR} 1 twice.`),
      ],
      [
        { wells: [{ ...DECK_TROUGH, components: { "Drug B": 5 } }] },
        damagedDeckMessage(`${RESERVOIR} 1 holds “Drug B”, which isn't among its components.`),
      ],
      [
        { wellLabels: [] },
        damagedDeckMessage('its well labels must be an object like { Plate1: { A1: "Cond 1" } }, but got a list.'),
      ],
      [
        { wellLabels: { [PLATE]: "Cond 1" } },
        damagedDeckMessage('its well labels must be an object like { Plate1: { A1: "Cond 1" } }, but got an object.'),
      ],
      [
        { labwareLabels: [] },
        damagedDeckMessage('its labware labels must be an object like { Plate1: "Assay plate" }, but got a list.'),
      ],
      [
        { labwareLabels: { [PLATE]: 5 } },
        damagedDeckMessage('its labware labels must be an object like { Plate1: "Assay plate" }, but got an object.'),
      ],
    ];
    for (const [changes, message] of cases) {
      assert.throws(() => pasteDeck(emptyPlan().plan, { ...copy, ...changes }, COMPONENT_COLORS), {
        message,
      });
    }
  });

  test("copied decks: a value the plan's own edits refuse gives their message", () => {
    const copy = deckCopy();
    const offDeck = { ...copy, wells: [{ labware: PLATE, well: "Z99", components: { Media: 1 } }] };
    assert.throws(() => pasteDeck(emptyPlan().plan, offDeck, COMPONENT_COLORS), {
      message: /"Z99" isn't a well on/,
    });
    const noVolume = { ...copy, wells: [{ ...DECK_TROUGH, components: { Media: 0 } }] };
    assert.throws(() => pasteDeck(emptyPlan().plan, noVolume, COMPONENT_COLORS), {
      message: "The volume to add must be a number of microliters above 0, like 100, but got 0.",
    });
  });

  test("copied decks: a copy through text pastes the same as the object", () => {
    const copy = deckCopy();
    const throughText = JSON.parse(JSON.stringify(copy));
    assert.equal(
      snapshot(pasteDeck(emptyPlan().plan, throughText, COMPONENT_COLORS)),
      snapshot(pasteDeck(emptyPlan().plan, copy, COMPONENT_COLORS)),
    );
  });

  test("copied decks: a pasted start reaches the Biomek files as the same start made by hand", () => {
    const byHand = setExperimentName(deckPlan(), "Exp36");
    const copy = copyDeck(byHand, atStart(byHand), "At Start");
    const pasted = pasteDeck(emptyWells(byHand, byHand.startingContents), copy, COMPONENT_COLORS);
    const timestamp = new Date(2026, 10, 6, 9, 7, 2);
    assert.deepEqual(writeRunFiles(pasted, timestamp), writeRunFiles(byHand, timestamp));
  });
});
