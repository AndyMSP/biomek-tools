// Unit tests for transfer-designer.js. Each test comes from the "Test cases" section of
// transfer-designer.md, and each row of its error table and each order of checks has one.
//
// They use the real config/pipetting-modes.js, config/tip-types.js and config/deck.js, and also check
// the first two, and DEFAULT_MIX, MIX_STEP_MODE and MIX_STEP_VOLUME in config/mixing.js (ADR 0009). Tests find what they need in the config files rather than naming it, so
// they still pass when the configuration changes.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PIPETTING_MODES, DEFAULT_PIPETTING_MODE } from "../../../config/pipetting-modes.js";
import { TIP_TYPES, DEFAULT_PROBE_COUNT } from "../../../config/tip-types.js";
import { DECK } from "../../../config/deck.js";
import { gridOf, capacityOf, deadVolumeOf } from "../../shared/deck/deck.js";
import { GRID_96, GRID_1X12_NUMBERED } from "../../shared/well-grid/well-grid.js";
import {
  DEFAULT_MIX as CONFIGURED_DEFAULT_MIX,
  MIN_MIX_VOLUME,
  MIX_STEP_MODE,
  MIX_STEP_VOLUME,
} from "../../../config/mixing.js";
import { checkName } from "../../shared/input-checks/input-checks.js";
import { tipGroups as sharedTipGroups } from "../../shared/tip-groups/tip-groups.js";
import { replay } from "../../shared/contents-tracking/contents-tracking.js";
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
  runRandomization,
  removeRandomization,
  canRemoveRandomization,
  setRandomizations,
  setConstituents,
  concentrationsOf,
  columnBoxes,
  moveItems,
  copyOf,
  copyItems,
  pasteItems,
  COPIED_ITEMS_FORMAT,
  COPIED_ITEMS_VERSION,
  isWellUsed,
  isWellToFill,
  moveWell,
} from "./transfer-designer.js";
import { PlanHistory } from "./plan-history.js";
import { planToText, planFromText } from "./plan-file.js";
import { assignPool } from "../../shared/random-pool/random-pool.js";
import { CONCENTRATION_UNITS } from "../../../config/concentration-units.js";
import { familyOf, unitsOf } from "../../shared/concentrations/concentrations.js";

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

describe("transfer-designer", () => {
  // --- Configuration: config/pipetting-modes.js ---

  test("each pipetting mode has exactly name, technique, mixingTechnique, liquidType and ends", () => {
    for (const mode of PIPETTING_MODES) {
      assert.deepEqual(Object.keys(mode).sort(), [
        "ends",
        "liquidType",
        "mixingTechnique",
        "name",
        "technique",
      ]);
    }
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

  // --- Components and starting contents ---

  test("addComponent adds a component last, with its name trimmed", () => {
    let { plan } = emptyPlan();
    plan = addComponent(plan, "Media", "#4e79a7");
    plan = addComponent(plan, "  Drug_A ", "#f28e2b");
    assert.deepEqual(plan.components, [
      { name: "Media", color: "#4e79a7", constituents: [] },
      { name: "Drug_A", color: "#f28e2b", constituents: [] },
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
    assert.deepEqual(plan.components[0], { name: "Medium", color: "#4e79a7", constituents: [] });
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
    assert.deepEqual(recolored.components[1], { name: "Dye", color: "#59a14f", constituents: [] });
    assert.throws(() => setComponentColor(plan, "Dye", "#4e79a7"), {
      message: "Media already has that color. Choose a different one.",
    });
    assert.doesNotThrow(() => setComponentColor(plan, "Dye", "#e15759"));
  });

  test("removeComponent empties wells left with nothing", () => {
    const plan = removeComponent(planWithContents(), "Dye");
    assert.deepEqual(plan.components, [{ name: "Media", color: "#4e79a7", constituents: [] }]);
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
    assert.deepEqual(Object.keys(plan.components[0]), ["name", "color", "constituents"]);
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

  // A source, e.g. source("A1", 8) or source("A3", null, true) for the filler.
  function source(well, replicates, filler = false) {
    return { labware: DEEP, well, replicates, filler };
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
        'Source 2 must be an object with exactly "labware", "well", "replicates" and "filler".',
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
        { sources: [source("A1", 1), { ...plateWell("B2"), replicates: 1, filler: false }] },
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
    changes = { ...changes, sources: [source("A1", 1), { ...plateWell("C2"), replicates: 1, filler: false }] };
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

  test("running again: nothing changed keeps everything; a new seed shuffles; new settings, tips or volume keep the wells", () => {
    const { plan, id } = runRandomizationPlan();
    const again = runRandomization(plan, id);
    assert.deepEqual(randomizationAt(again, id), randomizationAt(plan, id));
    assert.deepEqual(again.operationList.listOperations(), plan.operationList.listOperations());
    assert.deepEqual(again.stageList.listStages(), plan.stageList.listStages());

    const reseeded = runRandomization(setRandomization(plan, id, { seed: 38 }), id);
    assert.deepEqual(randomizationAt(reseeded, id).stages, randomizationAt(plan, id).stages);
    assert.notDeepEqual(destinationsByStage(reseeded, id), destinationsByStage(plan, id));

    const changed = runRandomization(
      setRandomization(plan, id, {
        settings: otherSettings(),
        tipType: TIP_TYPES.at(-1),
        probes: [1],
        volume: 20,
      }),
      id,
    );
    assert.deepEqual(destinationsByStage(changed, id), destinationsByStage(plan, id));
    for (const { stage } of randomizationAt(changed, id).stages) {
      assert.deepEqual(changed.stageList.get(stage).settings, otherSettings());
      assert.deepEqual(tipChangeAt(changed, stage), { tipType: TIP_TYPES.at(-1), probes: [1] });
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
      message: "This tip change keeps stage 5, “New stage”, off the randomization's tips. A randomization never shares tips.".replace(
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
    assert.throws(() => removeTipChange(added, newId), /never shares tips/);
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
    assert.throws(
      () => addRandomization(plan, second.stage, { seed: 1, volume: 1 }),
      /sits between tip groups/,
    );
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
    const sitting = { ...owner, id: "r2", beforeId: owner.stages[1].stage, stages: [] };
    assert.throws(
      () => setRandomizations({ ...plan, randomizations: [] }, [sitting, owner]),
      { message: /^Randomization 1: A randomization sits between tip groups, so it can't go before stage / },
    );
  });

  test("setRandomizations refuses each wrong randomization, prefixed, in its order of checks", () => {
    const { plan, id } = runRandomizationPlan();
    const good = () => JSON.parse(JSON.stringify(randomizationAt(plan, id)));
    const stageIds = good().stages.map((owned) => owned.stage);
    const second = (changes) => [good(), { ...good(), id: "r2", stages: [], beforeId: null, ...changes }];
    const cases = [
      [5, "The randomizations must be a list, but got 5."],
      [
        [good(), { ...good(), extra: 1 }],
        'Randomization 2 must be an object with exactly "id", "beforeId", "sources", "fill", "seed", "volume", "settings", "tipType", "probes" and "stages".',
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
        [good(), { ...good(), id: "r2", beforeId: null, stages: [] }, { ...good(), id: "r2", beforeId: null, stages: [] }],
        'Randomizations 2 and 3 both have the ID "r2".',
      ],
      [[good(), { ...good(), id: "r2" }], `Stage "${stageIds[0]}" belongs to two randomizations, 1 and 2.`],
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
    // Alone in its tip group, and not a mix step.
    const shared = removeTipChange(addStage(randomizingPlan(), null).plan, "2");
    const sharedSetUp = setUpRandomization(shared, "1");
    const sharedRun = runRandomization(sharedSetUp.plan, "r1");
    const owned = randomizationAt(sharedRun, "r1").stages;
    const joined = withParts(sharedRun, { tipChanges: { ...sharedRun.tipChanges } });
    delete joined.tipChanges[owned[1].stage];
    assert.throws(() => setRandomizations(joined, sharedRun.randomizations), {
      message: `Randomization 1: stage "${owned[0].stage}" must be the only stage of its tip group.`,
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

  // The plan without stage `stage`'s transfers.
  function removeTransfersOf(plan, stage) {
    let without = plan;
    for (const { position } of transfersIn(plan, stage).reverse()) {
      without = removeTransfer(without, position);
    }
    return without;
  }

  // --- Several filler wells ---

  // A filler well on the reservoir: trough `well`, replicates null, filler true.
  function fillerTrough(well) {
    return { ...trough(well), replicates: null, filler: true };
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
      sources: [source("A1", 6), { ...trough("2"), replicates: 2, filler: false }, fillerTrough("3"), fillerTrough("4")],
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
    assert.equal(copied.version, 2);
    const end = { kind: "between", index: columnBoxes(plan).length };
    const { plan: pasted, placed } = copyItems(plan, [{ kind: "randomization", id }], end);
    const copy = randomizationAt(pasted, placed[0].id);
    assert.deepEqual(copy.sources, randomizationAt(plan, id).sources);
    assert.equal(copy.stages.length, 2);
    const fillerCopy = fillerEntry(pasted, copy.id);
    assert.deepEqual(sourceTroughs(pasted, fillerCopy.stage), sourceTroughs(plan, fillerEntry(plan, id).stage));
    // A version 1 copy pastes as before.
    const { plan: fromVersion1 } = pasteItems(plan, { ...copied, version: 1 }, end);
    assert.equal(fromVersion1.randomizations.length, 2);
  });

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
    plan = setRandomization(first.plan, first.id, { sources: [{ ...trough("1"), replicates: 1, filler: false }], fill: [trough("5")] });
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
    const removed = removeStage(plan, fillerEntry(plan, id).stage);
    assert.equal(isRandomizationOutOfDate(removed, id), true);
  });

  test("the filler stage after changes: two replicate sources made fillers keep one stage", () => {
    let { plan, id } = fillerPlan();
    const taking = (well) => ({ ...trough(well), replicates: 9, filler: false });
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
        { labware: DEEP, well: "A1", replicates: 2, filler: false },
        { labware: DEEP, well: "A2", replicates: 2, filler: false },
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
    assert.equal(copied.version, 2);
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
      [() => moveItems(plan, 5, between(0)), "The things to move must be a list of stages, tip groups or randomizations, but got 5."],
      [() => copyOf(plan, []), "The things to copy must be a list of stages, tip groups or randomizations, but got an empty list."],
      [() => copyItems(plan, 5, between(0)), "The things to copy must be a list of stages, tip groups or randomizations, but got 5."],
      [
        () => moveItems(plan, [stageItem("1"), { kind: "box", id: "1" }], between(0)),
        'Item 2 must be { kind, id }, with kind "stage", "tipGroup" or "randomization", but got "box".',
      ],
      [() => moveItems(plan, [stageItem("9")], between(0)), 'There\'s no stage "9" in the plan.'],
      [() => moveItems(plan, [groupItem("2")], between(0)), 'Stage "2" doesn\'t start a tip group, so it can\'t name one.'],
      [() => moveItems(plan, [groupItem("5")], between(0)), 'Stage "5" doesn\'t start a tip group, so it can\'t name one.'],
      [() => moveItems(plan, [randomizationItem("r9")], between(0)), 'There\'s no randomization "r9" in the plan.'],
      [
        () => moveItems(plan, [stageItem("1")], between(9)),
        'The place must be between boxes (index 0 to 3) or inside a tip group, but got {"kind":"between","index":9}.',
      ],
      [
        () => moveItems(plan, [stageItem("1")], { kind: "over", index: 0 }),
        'The place must be between boxes (index 0 to 3) or inside a tip group, but got {"kind":"over","index":0}.',
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
    const notCopied = "Can't paste: this isn't stages, tip groups or randomizations copied from the transfer designer.";
    for (const copied of [
      "text",
      null,
      { format: "something else", version: 1, items: [] },
      { ...copiedStageItems(copiedStage()), items: [] },
      { ...copiedStageItems(copiedStage()), extra: 1 },
    ]) {
      assert.throws(() => pasteItems(plan, copied, between(0)), { message: notCopied });
    }
    assert.throws(() => pasteItems(plan, { ...copiedStageItems(copiedStage()), version: 3 }, between(0)), {
      message: "Can't paste: these were copied by a newer version of the tools (version 3).",
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
      message: "Can't paste: this isn't stages, tip groups or randomizations copied from the transfer designer.",
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
      sources: [trough("1"), trough("2")].map((end) => ({ ...end, replicates: 2, filler: false })),
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
    [
      "runRandomization, a source added and one taken out",
      (plan) => {
        const sources = [trough("2"), trough("3")].map((end) => ({ ...end, replicates: 2, filler: false }));
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
});
