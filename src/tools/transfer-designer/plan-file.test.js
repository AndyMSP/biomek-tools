// Unit tests for plan-file.js. Each test comes from the "Test cases" section of plan-file.md, and
// each row of its error table has at least one.
//
// They use the real config/deck.js and config/tip-types.js. Tests find what they need in the config
// files rather than naming it, so they still pass when the configuration changes.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { TIP_TYPES } from "../../../config/tip-types.js";
import { DECK } from "../../../config/deck.js";
import { gridOf } from "../../shared/deck/deck.js";
import { GRID_96, GRID_1X12_NUMBERED } from "../../shared/well-grid/well-grid.js";
import {
  START,
  emptyPlan,
  probesFor,
  stageOrder,
  addStage,
  addMixStep,
  isMixStep,
  mixWells,
  transfersIn,
  renameStage,
  setStageMix,
  removeStage,
  addTransfer,
  addComponent,
  addToWells,
  addTipChange,
  setTipType,
  setTipProbes,
  setLabel,
  setWellLabels,
  setExperimentName,
  addStageWithNewTips,
  addRandomization,
  setRandomization,
  runRandomization,
} from "./transfer-designer.js";
import { PLAN_FILE_FORMAT, PLAN_FILE_VERSION, planToText, planFromText } from "./plan-file.js";

// Two 96-well labware and the numbered (reservoir) labware, found in DECK, in the deck's order.
const [PLATE, OTHER_PLATE] = DECK.filter((entry) => gridOf(entry.name) === GRID_96).map(
  (entry) => entry.name,
);
const RESERVOIR = DECK.find((entry) => gridOf(entry.name) === GRID_1X12_NUMBERED).name;

// A 96-well labware of another labware type than PLATE's (a deep-well plate), found in DECK.
const DEEP = DECK.find(
  (entry) =>
    gridOf(entry.name) === GRID_96 &&
    entry.labwareType !== DECK.find((plate) => plate.name === PLATE).labwareType,
).name;

const SAVED_BY = "transfer designer v0.2.0";

// How every message from planFromText starts.
const CANT_OPEN = "This file can't be opened: ";

// A well on the reservoir, e.g. trough("1") → { labware: "Res", well: "1" }.
function trough(well) {
  return { labware: RESERVOIR, well };
}

// A transfer in `stage` from reservoir trough `from` into `well` on PLATE,
// e.g. transferTo("2", "B3") → { type: "transfer", source: { labware: "Res", well: "1" }, … }.
function transferTo(stage, well, volume = 50, from = "1") {
  return {
    type: "transfer",
    source: trough(from),
    destination: { labware: PLATE, well },
    volume,
    stage,
  };
}

// A plan with something in every part: the experiment name "Exp36"; components Media and Dye in
// troughs 1 and 2; stages "1" (Seeding), "2" (Wait, without transfers) and "3" (Treatment), in
// that order; transfers of 2.5 and 50 µL in stage 1 and 0.1 µL in stage 3; START tips on probes 1
// to 4; a tip change before stage 3 with the last tip type, on probe 1; and a label on PLATE. It
// has no well labels, so that files of every version open to it.
function fullPlan() {
  let { plan } = emptyPlan();
  plan = setExperimentName(plan, "Exp36");
  plan = addComponent(plan, "Media", "#4e79a7");
  plan = addComponent(plan, "Dye", "#e15759");
  plan = addToWells(plan, [trough("1")], "Media", 12000);
  plan = addToWells(plan, [trough("2")], "Dye", 500);
  plan = renameStage(plan, "1", "Seeding");
  plan = renameStage(addStage(plan, null).plan, "2", "Wait");
  plan = renameStage(addStage(plan, null).plan, "3", "Treatment");
  plan = addTransfer(plan, transferTo("1", "A1", 2.5));
  plan = addTransfer(plan, transferTo("1", "A2", 50));
  plan = addTransfer(plan, transferTo("3", "A1", 0.1, "2"));
  plan = setTipProbes(plan, START, probesFor(4));
  plan = setTipType(addTipChange(plan, "3"), "3", TIP_TYPES.at(-1));
  plan = setTipProbes(plan, "3", [1]);
  return setLabel(plan, PLATE, "Assay plate");
}

// The file fullPlan() saves as, as an object a test can change before opening it. A new object
// each time.
function fullFile() {
  return JSON.parse(planToText(fullPlan(), SAVED_BY));
}

// The mix the specification's examples use, e.g. { share: 90, times: 3, speed: 400 }. A new object
// each time.
function exampleMix() {
  return { share: 90, times: 3, speed: 400 };
}

// fullPlan() with stage "1" mixing its sources with exampleMix() and stage "3" mixing its
// destinations with { share: 50, times: 2, speed: 100 }, each switched on with setStageMix, so its
// technique is the mixing one; stage "2" doesn't mix.
function mixingPlan() {
  const plan = setStageMix(fullPlan(), "1", "source", exampleMix());
  return setStageMix(plan, "3", "destination", { share: 50, times: 2, speed: 100 });
}

// fullFile() as a version 5 file, as saved on 2026-11-01, before randomizations: no
// randomizations. Opened, it gives fullPlan(), which has none.
function version5File() {
  const file = { ...fullFile(), version: 5 };
  delete file.randomizations;
  return file;
}

// version5File() as a version 4 file, as saved from 2026-10-30 to 2026-11-01, before well labels: no
// wellLabels. Opened, it gives fullPlan(), which has no well labels.
function version4File() {
  const file = { ...version5File(), version: 4 };
  delete file.wellLabels;
  return file;
}

// version4File() as a version 3 file, as saved on 2026-10-30 before mixing: each stage's settings
// have no sourceMix or destinationMix. Opened, it gives fullPlan(), whose stages don't mix.
function version3File() {
  const file = { ...version4File(), version: 3 };
  file.stages = file.stages.map((stage) => {
    const { sourceMix, destinationMix, ...settings } = stage.settings;
    return { ...stage, settings };
  });
  return file;
}

// version3File() as a version 2 file, as saved from 2026-10-28 to 2026-10-30: each stage's settings
// hold its probes (stages 1 and 2, under START, use [1, 2] and [1, 2, 3, 4]; stage 3, under its own
// tip change, uses [1]), and each tip change is { tipType } only. Opened, it gives fullPlan():
// START on [1, 2, 3, 4] and the tip change on [1].
function version2File() {
  const file = { ...version3File(), version: 2 };
  const probesOfStages = [[1, 2], [1, 2, 3, 4], [1]];
  file.stages = file.stages.map((stage, index) => ({
    ...stage,
    settings: { ...stage.settings, probes: probesOfStages[index] },
  }));
  file.tipChanges = Object.fromEntries(
    Object.entries(file.tipChanges).map(([key, tipChange]) => [key, { tipType: tipChange.tipType }]),
  );
  return file;
}

// fullFile() as a version 1 file, as saved before 2026-10-28: like version 2, without
// experimentName.
function version1File() {
  const file = { ...version2File(), version: 1 };
  delete file.experimentName;
  return file;
}

// Opens `file`, an object, as a plan file's text.
function open(file) {
  return planFromText(JSON.stringify(file));
}

// What a plan holds, as plain data, for comparing two plans: its stages in stage order (each with
// its ID, name and settings), its operations, and its other parts.
function contentsOf(plan) {
  return {
    experimentName: plan.experimentName,
    components: plan.components,
    startingContents: plan.startingContents,
    stages: stageOrder(plan).map((id) => plan.stageList.get(id)),
    operations: plan.operationList.listOperations(),
    tipChanges: plan.tipChanges,
    labwareLabels: plan.labwareLabels,
    wellLabels: plan.wellLabels,
    randomizations: plan.randomizations,
  };
}

// Checks that opening `file` throws `problem` after CANT_OPEN. `problem` is text for the whole
// message, or a RegExp for its start (for messages from other modules, whose wording isn't
// plan-file's).
function assertRefused(file, problem) {
  const message =
    typeof problem === "string" ? CANT_OPEN + problem : new RegExp(`^${escapeRegExp(CANT_OPEN)}${problem.source}`);
  assert.throws(() => open(file), { message });
}

// `text` with every character that means something in a RegExp escaped, so it matches only itself,
// e.g. escapeRegExp("a.b") → "a\\.b".
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("plan-file", () => {
  // --- Saving ---

  test("planToText gives JSON with exactly the file's properties, in order, indented by 2 spaces", () => {
    const text = planToText(fullPlan(), SAVED_BY);
    const file = JSON.parse(text);
    assert.deepEqual(Object.keys(file), [
      "format",
      "version",
      "savedBy",
      "experimentName",
      "components",
      "startingContents",
      "stages",
      "operations",
      "tipChanges",
      "labwareLabels",
      "wellLabels",
      "randomizations",
    ]);
    assert.equal(file.format, PLAN_FILE_FORMAT);
    assert.equal(file.version, PLAN_FILE_VERSION);
    assert.equal(file.savedBy, SAVED_BY);
    assert.equal(file.experimentName, "Exp36");
    assert.equal(text, JSON.stringify(file, null, 2));
  });

  test("the format and version are the specification's", () => {
    assert.equal(PLAN_FILE_FORMAT, "biomek-tools transfer plan");
    assert.equal(PLAN_FILE_VERSION, 6);
  });

  test("planToText writes each tip change with its probes, and each stage's settings without any", () => {
    const file = fullFile();
    assert.deepEqual(file.tipChanges, {
      [START]: { tipType: TIP_TYPES[0], probes: [1, 2, 3, 4] },
      3: { tipType: TIP_TYPES.at(-1), probes: [1] },
    });
    for (const stage of file.stages) {
      assert.equal(Object.hasOwn(stage.settings, "probes"), false, stage.id);
    }
  });

  test("planToText writes each stage's settings as the stage list holds them, mixes included", () => {
    const file = JSON.parse(planToText(mixingPlan(), SAVED_BY));
    const plan = mixingPlan();
    for (const stage of file.stages) {
      assert.deepEqual(stage.settings, plan.stageList.get(stage.id).settings, stage.id);
    }
    assert.deepEqual(file.stages[0].settings.sourceMix, exampleMix());
    assert.equal(file.stages[0].settings.destinationMix, null);
    assert.equal(file.stages[1].settings.sourceMix, null);
  });

  test("planToText refuses a savedBy that isn't a name", () => {
    const plan = emptyPlan().plan;
    assert.throws(() => planToText(plan, 5), {
      message: "The name of the tool saving the plan must be text, but got 5.",
    });
    assert.throws(() => planToText(plan, ""), {
      message: "The name of the tool saving the plan is blank. Give it at least one character that isn't a space.",
    });
    assert.throws(() => planToText(plan, " v0.2.0"), {
      message: 'The name of the tool saving the plan " v0.2.0" has spaces at the start or end. Remove them.',
    });
  });

  // --- Round trip ---

  test("a plan saved and opened has the same name, stages, transfers, tip changes, components and labels", () => {
    const plan = fullPlan();
    const opened = planFromText(planToText(plan, SAVED_BY));
    assert.deepEqual(contentsOf(opened), contentsOf(plan));
    assert.equal(opened.experimentName, "Exp36");
    assert.deepEqual(stageOrder(opened), ["1", "2", "3"]);
    const volumes = opened.operationList.listOperations().map((operation) => operation.volume);
    assert.deepEqual(volumes, [2.5, 50, 0.1]);
  });

  test("tip changes keep their probes: START on [1, 2, 3, 4] and a tip change on [1]", () => {
    const opened = planFromText(planToText(fullPlan(), SAVED_BY));
    assert.deepEqual(opened.tipChanges[START].probes, [1, 2, 3, 4]);
    assert.deepEqual(opened.tipChanges["3"].probes, [1]);
  });

  test('a plan with no name saves "experimentName": "" and opens with none', () => {
    const plan = setExperimentName(fullPlan(), "");
    const text = planToText(plan, SAVED_BY);
    assert.equal(JSON.parse(text).experimentName, "");
    assert.equal(planFromText(text).experimentName, "");
  });

  test("planToText writes the stages in stage order, not the order they were added", () => {
    const { plan } = addStage(emptyPlan().plan, "1");
    const file = JSON.parse(planToText(plan, SAVED_BY));
    assert.deepEqual(
      file.stages.map((stage) => stage.id),
      ["2", "1"],
    );
  });

  test("stages are renumbered on opening, and transfers and tip changes follow them", () => {
    // Stages "1" to "7", then all but "2", "5" and "7" removed.
    let { plan } = emptyPlan();
    for (let added = 2; added <= 7; added += 1) {
      plan = addStage(plan, null).plan;
    }
    for (const id of ["1", "3", "4", "6"]) {
      plan = removeStage(plan, id);
    }
    plan = renameStage(plan, "5", "Middle");
    plan = addTransfer(plan, transferTo("2", "A1"));
    plan = addTransfer(plan, transferTo("7", "A2"));
    plan = addTipChange(plan, "7");
    assert.deepEqual(stageOrder(plan), ["2", "5", "7"]);

    const opened = planFromText(planToText(plan, SAVED_BY));
    assert.deepEqual(stageOrder(opened), ["1", "2", "3"]);
    assert.equal(opened.stageList.get("2").name, "Middle");
    assert.deepEqual(
      opened.operationList.listOperations().map((operation) => operation.stage),
      ["1", "3"],
    );
    assert.deepEqual(Object.keys(opened.tipChanges).sort(), ["3", START].sort());
  });

  test('an empty plan, saved and opened, has the same contents, and is written as version 6, with "wellLabels": {} and "randomizations": []', () => {
    const plan = emptyPlan().plan;
    const text = planToText(plan, SAVED_BY);
    assert.equal(JSON.parse(text).version, 6);
    assert.deepEqual(JSON.parse(text).wellLabels, {});
    assert.deepEqual(JSON.parse(text).randomizations, []);
    const opened = planFromText(text);
    assert.deepEqual(contentsOf(opened), contentsOf(plan));
  });

  test("well labels, saved and opened, give the same well labels", () => {
    const labels = { [PLATE]: { A1: "Cond 1", A2: "Cond 1" }, [RESERVOIR]: { 5: "Media" } };
    const plan = setWellLabels(fullPlan(), labels);
    const text = planToText(plan, SAVED_BY);
    assert.deepEqual(JSON.parse(text).wellLabels, labels);
    const opened = planFromText(text);
    assert.deepEqual(opened.wellLabels, labels);
    assert.deepEqual(contentsOf(opened), contentsOf(plan));
  });

  test("stages keep their mixes: sourceMix { share: 90, times: 3, speed: 400 } and destinationMix null, saved and opened, give the same mixes", () => {
    const plan = mixingPlan();
    const opened = planFromText(planToText(plan, SAVED_BY));
    assert.deepEqual(opened.stageList.get("1").settings.sourceMix, exampleMix());
    assert.equal(opened.stageList.get("1").settings.destinationMix, null);
    assert.deepEqual(contentsOf(opened), contentsOf(plan));
  });

  test("a mix step, saved and opened, is still a mix step, with its settings and mixed wells (transfer-designer.md, \"Mix steps\": the plan file needs nothing new)", () => {
    const { plan: withMixStep, id } = addMixStep(fullPlan(), "3");
    const plan = mixWells(withMixStep, id, [
      { labware: PLATE, well: "H1" },
      { labware: PLATE, well: "H2" },
    ]);
    const opened = planFromText(planToText(plan, SAVED_BY));
    // Stages are renumbered on opening: the mix step is third in the stage order.
    const openedId = stageOrder(opened)[2];
    assert.equal(isMixStep(opened, openedId), true);
    assert.deepEqual(opened.stageList.get(openedId), {
      ...plan.stageList.get(id),
      id: openedId,
    });
    assert.deepEqual(
      transfersIn(opened, openedId).map((transfer) => [transfer.source.well, transfer.volume]),
      transfersIn(plan, id).map((transfer) => [transfer.source.well, transfer.volume]),
    );
  });

  test("a plan file whose mix step has a source mix, or no destination mix, is refused with its stage and changeStageSettings's message", () => {
    const { plan: withMixStep, id } = addMixStep(fullPlan(), "3");
    const plan = mixWells(withMixStep, id, [{ labware: PLATE, well: "H1" }]);
    // The mix step is third in the stage order, so it's stage 3 in the file.
    const withSourceMix = JSON.parse(planToText(plan, SAVED_BY));
    withSourceMix.stages[2].settings.sourceMix = exampleMix();
    assertRefused(withSourceMix, "stage 3: A mix step mixes after dispensing only, so it can't have a source mix.");
    const withoutDestinationMix = JSON.parse(planToText(plan, SAVED_BY));
    withoutDestinationMix.stages[2].settings.destinationMix = null;
    assertRefused(withoutDestinationMix, "stage 3: A mix step needs a destination mix: that's what it does.");
  });

  // --- Version 5 files ---

  test("a version 5 stage without sourceMix gets the stage list's missing-setting message", () => {
    const file = fullFile();
    delete file.stages[1].settings.sourceMix;
    assertRefused(file, /stage 2: A stage's settings need .+, but are missing "sourceMix"\./);
  });

  test("a version 5 stage whose mix the stage list refuses gives its message", () => {
    const file = fullFile();
    file.stages[2].settings.destinationMix = { share: 0, times: 3, speed: 400 };
    assertRefused(file, /stage 3: The destination mix's share must be a number above 0 and at most 100/);
  });

  test('mixing must match the technique: a version 5 stage 2 with a sourceMix and sourceTechnique "Operation" is refused; with "OperationMix" it opens', () => {
    const file = fullFile();
    // Stage 2 uses the default mode, Medium, at its source.
    assert.equal(file.stages[1].settings.sourceTechnique, "Operation");
    assert.equal(file.stages[1].settings.sourceLiquidType, "Medium");
    file.stages[1].settings.sourceMix = exampleMix();
    assertRefused(
      file,
      'stage 2: The source mixes, so its technique must be "OperationMix" ' +
        `(Medium's technique for mixing), but it's "Operation".`,
    );
    file.stages[1].settings.sourceTechnique = "OperationMix";
    const opened = open(file);
    assert.deepEqual(opened.stageList.get("2").settings.sourceMix, exampleMix());
    assert.equal(opened.stageList.get("2").settings.sourceTechnique, "OperationMix");
  });

  // --- Randomizations, and version 5 files ---

  // A plan with stages "2", "5" and "7" (stages 1 to 7 made, the others removed), each with tips of
  // its own; DEEP A1 and A2 holding Drug A and Drug B; a randomization "r1" before stage 5, run; and
  // a second, "r2", sitting before stage 7, not run. Saved, its stages are "2", "5", "7" and the
  // run's two stages, "8" and "9", which open as "1" to "5".
  function randomizingPlan() {
    let { plan } = emptyPlan();
    for (let added = 2; added <= 7; added += 1) {
      plan = addStageWithNewTips(plan, null).plan;
    }
    for (const id of ["1", "3", "4", "6"]) {
      plan = removeStage(plan, id);
    }
    plan = addComponent(plan, "Drug A", "#4e79a7");
    plan = addComponent(plan, "Drug B", "#e15759");
    plan = addToWells(plan, [deepWell("A1")], "Drug A", 500);
    plan = addToWells(plan, [deepWell("A2")], "Drug B", 500);
    plan = addRandomization(plan, "5", { seed: 37, volume: 10 }).plan;
    plan = setRandomization(plan, "r1", {
      sources: [
        { ...deepWell("A1"), replicates: 2, filler: false },
        { ...deepWell("A2"), replicates: null, filler: true },
      ],
      fill: ["B2", "B3", "B4", "B5"].map((well) => ({ labware: PLATE, well })),
    });
    plan = runRandomization(plan, "r1");
    return addRandomization(plan, "7", { seed: null, volume: null }).plan;
  }

  // A well on the first deep-well labware (a 96-well labware of another type than PLATE's).
  function deepWell(well) {
    return { labware: DEEP, well };
  }

  test("randomizations, saved and opened, are the same, their stage IDs following the renumbered stages", () => {
    const plan = randomizingPlan();
    assert.deepEqual(stageOrder(plan), ["2", "8", "9", "5", "7"]);
    const text = planToText(plan, SAVED_BY);
    assert.deepEqual(JSON.parse(text).randomizations, plan.randomizations);
    const opened = planFromText(text);
    assert.deepEqual(stageOrder(opened), ["1", "2", "3", "4", "5"]);
    const renumber = { 2: "1", 8: "2", 9: "3", 5: "4", 7: "5" };
    assert.deepEqual(
      opened.randomizations,
      plan.randomizations.map((randomization) => ({
        ...randomization,
        beforeId: randomization.beforeId === null ? null : renumber[randomization.beforeId],
        stages: randomization.stages.map((owned) => ({ ...owned, stage: renumber[owned.stage] })),
      })),
    );
    assert.equal(opened.randomizations[0].beforeId, "4");
    assert.equal(opened.randomizations[1].beforeId, "5");
  });

  test("a version 5 file opens, with no randomizations", () => {
    const opened = open(version5File());
    assert.deepEqual(opened.randomizations, []);
    assert.deepEqual(contentsOf(opened), contentsOf(fullPlan()));
  });

  test("a version 5 file with randomizations is refused as having an extra property", () => {
    assertRefused(
      { ...version5File(), randomizations: [] },
      'it has "randomizations", which a plan file doesn\'t have.',
    );
  });

  test("a version 6 file without randomizations is refused as missing it", () => {
    const file = fullFile();
    delete file.randomizations;
    assertRefused(file, 'it\'s missing "randomizations".');
  });

  test("a version 6 file whose randomizations is an object gets the wrong-kind message", () => {
    assertRefused({ ...fullFile(), randomizations: {} }, '"randomizations" must be a list.');
  });

  test("a randomization naming a stage that isn't one of the file's is refused", () => {
    const file = JSON.parse(planToText(randomizingPlan(), SAVED_BY));
    assertRefused(
      { ...file, randomizations: [{ ...file.randomizations[0], beforeId: "1" }] },
      'randomization 1 names stage "1", which isn\'t one of the file\'s stages.',
    );
    const stages = [{ ...file.randomizations[0].stages[0], stage: "9" }, { ...file.randomizations[0].stages[1], stage: "4" }];
    assertRefused(
      { ...file, randomizations: [{ ...file.randomizations[0], stages }] },
      'randomization 1 names stage "4", which isn\'t one of the file\'s stages.',
    );
  });

  test("randomizations refused by setRandomizations give its message, after the renumbering", () => {
    const file = JSON.parse(planToText(randomizingPlan(), SAVED_BY));
    const [first, second] = file.randomizations;
    assertRefused(
      { ...file, randomizations: [{ ...first, stages: [first.stages[1], first.stages[0]] }, second] },
      "randomizations: Randomization 1: its stages must come one after another, in stage order.",
    );
    assertRefused(
      { ...file, randomizations: [first, { ...second, seed: 0 }] },
      "randomizations: Randomization 2: A randomization's seed must be a whole number from 1 to 999,999, or null, but got 0.",
    );
    // Stage "5" (opening as "5") with its tips, removed, so r2's place is inside a tip group.
    delete file.tipChanges["7"];
    assertRefused(file, /randomizations: Randomization 2: A randomization sits between tip groups/);
  });

  test("randomizations without the form to renumber get setRandomizations' message for it", () => {
    const file = JSON.parse(planToText(randomizingPlan(), SAVED_BY));
    const [first, second] = file.randomizations;
    assertRefused(
      { ...file, randomizations: [first, 5] },
      'randomizations: Randomization 2 must be an object with exactly "id", "beforeId", "sources", "fill", "seed", "volume", "settings", "tipType", "probes" and "stages".',
    );
    assertRefused(
      { ...file, randomizations: [{ ...first, stages: 5 }, second] },
      'randomizations: Randomization 1: its stages must be a list of objects with exactly "labware", "well" and "stage".',
    );
    assertRefused(
      { ...file, randomizations: [first, { ...second, beforeId: 5 }] },
      /randomizations: Randomization 2: There's no stage 5 to add a randomization before\./,
    );
  });

  test("the randomizations are checked last: bad well labels and bad randomizations report the well labels", () => {
    const file = { ...fullFile(), wellLabels: { [PLATE]: { A1: "" } }, randomizations: [5] };
    assertRefused(file, /well labels: /);
  });

  // --- Version 4 files and well labels ---

  test("a version 4 file opens, with no well labels", () => {
    const opened = open(version4File());
    assert.deepEqual(opened.wellLabels, {});
    assert.deepEqual(contentsOf(opened), contentsOf(fullPlan()));
  });

  test("a version 4 file with wellLabels is refused as having an extra property", () => {
    assertRefused(
      { ...version4File(), wellLabels: {} },
      'it has "wellLabels", which a plan file doesn\'t have.',
    );
  });

  test("a version 6 file without wellLabels is refused as missing it", () => {
    const file = fullFile();
    delete file.wellLabels;
    assertRefused(file, 'it\'s missing "wellLabels".');
  });

  test("a version 6 file whose wellLabels is a list gets the wrong-kind message", () => {
    assertRefused({ ...fullFile(), wellLabels: [] }, '"wellLabels" must be an object.');
  });

  test("well labels are strict: a label with spaces at its ends, a blank label, a labware with {}, or a well not on the grid is refused with setWellLabels's message, not tidied", () => {
    const cases = [
      [{ [PLATE]: { A1: " Cond 1" } }, `well labels: The label for ${PLATE} A1, " Cond 1", has spaces at the start or end. Remove them.`],
      [{ [PLATE]: { A1: "" } }, `well labels: The label for ${PLATE} A1 is blank. A well without a label is left out of the well labels.`],
      [{ [PLATE]: {} }, `well labels: The well labels for ${PLATE} are empty. A labware without labeled wells is left out of the well labels.`],
      [{ [PLATE]: { Z99: "Cond 1" } }, `well labels: "Z99" isn't a well on ${PLATE}. Its wells are A1 to H12.`],
    ];
    for (const [wellLabels, problem] of cases) {
      assertRefused({ ...fullFile(), wellLabels }, problem);
    }
  });

  test("the well labels are checked last: a bad experiment name and bad well labels report the name", () => {
    const file = { ...fullFile(), experimentName: "Exp 36", wellLabels: { [PLATE]: { A1: "" } } };
    assertRefused(file, /the experiment name: /);
  });

  test("saving an opened version 4 file writes version 6, with no well labels", () => {
    const file = JSON.parse(planToText(open(version4File()), SAVED_BY));
    assert.equal(file.version, 6);
    assert.deepEqual(file.wellLabels, {});
  });

  // --- Version 3 files ---

  test("a version 3 file opens, each stage with sourceMix and destinationMix null", () => {
    const opened = open(version3File());
    for (const stage of opened.stageList.listStages()) {
      assert.equal(stage.settings.sourceMix, null, stage.id);
      assert.equal(stage.settings.destinationMix, null, stage.id);
    }
    assert.deepEqual(contentsOf(opened), contentsOf(fullPlan()));
  });

  test("a version 3 file whose stage has a sourceMix gets the stage-mix message", () => {
    const file = version3File();
    file.stages[1].settings.sourceMix = exampleMix();
    assertRefused(file, 'stage 2\'s settings have "sourceMix", which a version 3 file\'s stages don\'t have.');
  });

  test("a version 3 stage holding both mixes, even null, is refused, naming sourceMix", () => {
    const file = version3File();
    file.stages[0].settings = { ...file.stages[0].settings, destinationMix: null, sourceMix: null };
    assertRefused(file, 'stage 1\'s settings have "sourceMix", which a version 3 file\'s stages don\'t have.');
  });

  test("a version 3 stage with only a destinationMix is refused, naming destinationMix", () => {
    const file = version3File();
    file.stages[2].settings.destinationMix = exampleMix();
    assertRefused(file, 'stage 3\'s settings have "destinationMix", which a version 3 file\'s stages don\'t have.');
  });

  test("a version 3 stage's name is checked before its mixes", () => {
    const file = version3File();
    file.stages[1].name = "";
    file.stages[1].settings.sourceMix = exampleMix();
    assertRefused(file, /stage 2: The stage name is blank\./);
  });

  test("saving an opened version 3 file writes version 6, with the stages' mixes null", () => {
    const file = JSON.parse(planToText(open(version3File()), SAVED_BY));
    assert.equal(file.version, PLAN_FILE_VERSION);
    for (const stage of file.stages) {
      assert.equal(stage.settings.sourceMix, null, stage.id);
      assert.equal(stage.settings.destinationMix, null, stage.id);
    }
  });

  // --- Version 2 files ---

  test("a version 2 file opens: each tip change gets every probe its stages used, and the stages' settings have no probes", () => {
    const opened = open(version2File());
    assert.deepEqual(opened.tipChanges, {
      [START]: { tipType: TIP_TYPES[0], probes: [1, 2, 3, 4] },
      3: { tipType: TIP_TYPES.at(-1), probes: [1] },
    });
    for (const stage of opened.stageList.listStages()) {
      assert.equal(Object.hasOwn(stage.settings, "probes"), false, stage.id);
    }
    assert.deepEqual(contentsOf(opened), contentsOf(fullPlan()));
  });

  test("a version 2 file's tip change gets the probes of its stages only, in stage order", () => {
    // Stage 1 uses [5], stage 2 uses [2, 3], stage 3 (with its own tip change) uses [8, 1].
    const file = version2File();
    file.stages[0].settings.probes = [5];
    file.stages[1].settings.probes = [2, 3];
    file.stages[2].settings.probes = [8, 1];
    const opened = open(file);
    assert.deepEqual(opened.tipChanges[START].probes, [2, 3, 5]);
    assert.deepEqual(opened.tipChanges["3"].probes, [1, 8]);
  });

  test("a version 2 stage without probes is refused as missing them", () => {
    const file = version2File();
    delete file.stages[1].settings.probes;
    assertRefused(file, 'stage 2\'s settings are missing "probes", which a version 2 file\'s stages have.');
  });

  test("a version 2 stage with bad probes is refused with setTipProbes's message", () => {
    const file = version2File();
    file.stages[1].settings.probes = [3, 1, 3];
    assertRefused(file, "stage 2: Probe 3 is listed more than once. List each probe once.");
    file.stages[1].settings.probes = [9];
    assertRefused(file, "stage 2: Probe numbers must be whole numbers from 1 to 8, but got 9.");
  });

  test("a version 2 tip change with probes is refused as not having exactly its properties", () => {
    const file = version2File();
    file.tipChanges.start = { tipType: TIP_TYPES[0], probes: [1] };
    assertRefused(file, 'the tip change at "start" must be an object with exactly "tipType".');
  });

  test("a version 2 file opens with no mixing", () => {
    for (const stage of open(version2File()).stageList.listStages()) {
      assert.equal(stage.settings.sourceMix, null, stage.id);
      assert.equal(stage.settings.destinationMix, null, stage.id);
    }
  });

  test("a version 2 stage's probes are checked before its mixes", () => {
    const file = version2File();
    delete file.stages[1].settings.probes;
    file.stages[1].settings.sourceMix = exampleMix();
    assertRefused(file, 'stage 2\'s settings are missing "probes", which a version 2 file\'s stages have.');
  });

  test("a version 2 stage with a mix gets the stage-mix message, naming version 2", () => {
    const file = version2File();
    file.stages[0].settings.destinationMix = exampleMix();
    assertRefused(file, 'stage 1\'s settings have "destinationMix", which a version 2 file\'s stages don\'t have.');
  });

  test("a version 3 to 6 tip change without probes is refused as not having exactly its properties", () => {
    for (const file of [version3File(), version4File(), version5File(), fullFile()]) {
      file.tipChanges.start = { tipType: TIP_TYPES[0] };
      assertRefused(file, 'the tip change at "start" must be an object with exactly "tipType" and "probes".');
    }
  });

  test("a version 3 to 6 stage with probes is refused by the stage list as an extra setting", () => {
    for (const file of [version3File(), version4File(), version5File(), fullFile()]) {
      file.stages[0].settings.probes = [1, 2];
      assertRefused(file, /stage 1: A stage's settings can only have .+, but also got "probes"\./);
    }
  });

  // --- Version 1 files ---

  test('a version 1 file opens, with an experiment name of "", probes as for version 2, and no mixing', () => {
    const opened = open(version1File());
    assert.equal(opened.experimentName, "");
    for (const stage of opened.stageList.listStages()) {
      assert.equal(stage.settings.sourceMix, null, stage.id);
      assert.equal(stage.settings.destinationMix, null, stage.id);
    }
    const { experimentName, ...rest } = contentsOf(opened);
    const { experimentName: ignored, ...expected } = contentsOf(fullPlan());
    assert.deepEqual(rest, expected);
    assert.deepEqual(opened.tipChanges[START].probes, [1, 2, 3, 4]);
  });

  test("a version 1 stage without probes is refused, naming version 1", () => {
    const file = version1File();
    delete file.stages[0].settings.probes;
    assertRefused(file, 'stage 1\'s settings are missing "probes", which a version 1 file\'s stages have.');
  });

  test("a version 1 stage holding a mix is refused, naming version 1", () => {
    const file = version1File();
    file.stages[0].settings.destinationMix = null;
    assertRefused(
      file,
      'stage 1\'s settings have "destinationMix", which a version 1 file\'s stages don\'t have.',
    );
  });

  test("a version 1 file with experimentName is refused as having an extra property", () => {
    assertRefused(
      { ...version1File(), experimentName: "Exp36" },
      'it has "experimentName", which a plan file doesn\'t have.',
    );
  });

  test("a version 2 file without experimentName is refused as missing it", () => {
    const file = version2File();
    delete file.experimentName;
    assertRefused(file, 'it\'s missing "experimentName".');
  });

  // --- The experiment name ---

  test('a file with "Exp 36", " Exp36" or 5 as its experiment name is refused, not tidied', () => {
    assertRefused(
      { ...fullFile(), experimentName: "Exp 36" },
      /the experiment name: The experiment name can't contain " " \(a space\)\./,
    );
    assertRefused(
      { ...fullFile(), experimentName: " Exp36" },
      /the experiment name: The experiment name can't contain " " \(a space\)\./,
    );
    assertRefused(
      { ...fullFile(), experimentName: 5 },
      'the experiment name: The experiment name must be text, like "Exp36", but got 5.',
    );
  });

  test("the experiment name is checked after the labels: bad labels and a bad name report the labels", () => {
    const file = { ...fullFile(), experimentName: "Exp 36", labwareLabels: { [PLATE]: "" } };
    assertRefused(file, /labels: The label for .+ is blank\./);
  });

  // --- Refusing: the file as a whole ---

  test("text that isn't JSON, or JSON that isn't an object, isn't a plan file", () => {
    for (const text of ["{ not JSON", "[]", "null", "5"]) {
      assert.throws(() => planFromText(text), {
        message: `${CANT_OPEN}it isn't a plan file: its contents aren't the JSON a plan file holds.`,
      });
    }
  });

  test("a file with another format isn't a transfer plan", () => {
    assertRefused({ ...fullFile(), format: "something else" }, "it isn't a transfer plan saved by this tool.");
  });

  test("a version above this one was saved by a newer version of the tools", () => {
    assertRefused(
      { ...fullFile(), version: 7 },
      "it was saved by a newer version of the tools (plan format 7). Open it with that version or a later one.",
    );
  });

  test("any other version isn't one this tool knows", () => {
    for (const [version, shown] of [[0, "0"], ["2", '"2"'], [1.5, "1.5"]]) {
      assertRefused(
        { ...fullFile(), version },
        `its plan format version, ${shown}, isn't one this tool knows.`,
      );
    }
  });

  test("savedBy isn't checked: a file without it, or with 5, opens", () => {
    const withoutSavedBy = fullFile();
    delete withoutSavedBy.savedBy;
    assert.deepEqual(contentsOf(open(withoutSavedBy)), contentsOf(fullPlan()));
    assert.deepEqual(contentsOf(open({ ...fullFile(), savedBy: 5 })), contentsOf(fullPlan()));
  });

  test("missing properties are all listed, in the file's order", () => {
    const file = fullFile();
    delete file.stages;
    assertRefused(file, 'it\'s missing "stages".');
    delete file.components;
    assertRefused(file, 'it\'s missing "components", "stages".');
  });

  test("extra properties are all listed, in the order they appear", () => {
    assertRefused({ ...fullFile(), notes: "x" }, 'it has "notes", which a plan file doesn\'t have.');
    assertRefused(
      { ...fullFile(), notes: "x", author: "y" },
      'it has "notes", "author", which a plan file doesn\'t have.',
    );
  });

  test("a property of the wrong kind is refused", () => {
    assertRefused({ ...fullFile(), stages: {} }, '"stages" must be a list.');
    assertRefused({ ...fullFile(), tipChanges: [] }, '"tipChanges" must be an object.');
  });

  test("checks run in order: a bad version and a missing property report the version", () => {
    const file = { ...fullFile(), version: 0 };
    delete file.stages;
    assertRefused(file, "its plan format version, 0, isn't one this tool knows.");
  });

  // --- Refusing: components ---

  test("a component that isn't an object with exactly a name and a color is refused", () => {
    for (const component of [null, { name: "Water" }, { name: "Water", color: "#76b7b2", notes: "" }]) {
      const file = fullFile();
      file.components[1] = component;
      assertRefused(file, 'component 2 must be an object with exactly "name" and "color".');
    }
  });

  test('a component named " Media" is refused, not trimmed', () => {
    const file = fullFile();
    file.components[0].name = " Media";
    assertRefused(
      file,
      'component 1: The component name " Media" has spaces at the start or end. Remove them.',
    );
  });

  test("a component addComponent refuses gives its message", () => {
    const file = fullFile();
    file.components[1].color = file.components[0].color;
    assertRefused(file, "component 2: Media already has that color. Choose a different one.");
  });

  // --- Refusing: stages ---

  test("a file with no stages is refused", () => {
    assertRefused({ ...fullFile(), stages: [] }, "it has no stages; a plan always has at least one.");
  });

  test("a stage that isn't an object with exactly an ID, a name and settings is refused", () => {
    const file = fullFile();
    delete file.stages[0].settings;
    assertRefused(file, 'stage 1 must be an object with exactly "id", "name" and "settings".');
  });

  test("a stage ID that isn't a name is refused", () => {
    const file = fullFile();
    file.stages[0].id = 1;
    assertRefused(file, "stage 1: The stage ID must be text, but got 1.");
  });

  test('a stage with the ID "start" is refused', () => {
    const file = fullFile();
    file.stages[1].id = "start";
    assertRefused(file, 'stage 2 has the ID "start", which is kept for the tips at the start of the run.');
  });

  test("two stages with one ID are refused", () => {
    const file = fullFile();
    file.stages[2].id = "2";
    assertRefused(file, 'stages 2 and 3 both have the ID "2".');
  });

  test("a stage name or settings the stage list refuses give its message", () => {
    const named = fullFile();
    named.stages[1].name = "";
    assertRefused(named, /stage 2: The stage name is blank\./);
    const set = fullFile();
    set.stages[2].settings.sourceTechnique = "";
    assertRefused(set, /stage 3: The source technique is blank\./);
    const notAnObject = fullFile();
    notAnObject.stages[2].settings = null;
    assertRefused(notAnObject, /stage 3: A stage's settings must be an object with /);
  });

  test("a version 2 stage's name is checked before its probes", () => {
    const file = version2File();
    file.stages[1].name = "";
    delete file.stages[1].settings.probes;
    assertRefused(file, /stage 2: The stage name is blank\./);
  });

  // --- Refusing: transfers ---

  test("a transfer the operation list refuses gives its message", () => {
    const file = fullFile();
    file.operations[0].volume = -5;
    assertRefused(
      file,
      "transfer 1: The volume must be a number of microliters, 0 or more, like 50, but got -5.",
    );
  });

  test("a transfer that breaks the stage rule gives the operation list's message", () => {
    const file = fullFile();
    // Plate A1 is a destination in stage "1", so it can't be a source there.
    file.operations.splice(2, 0, {
      ...transferTo("1", "B1"),
      source: { labware: PLATE, well: "A1" },
    });
    assertRefused(file, /transfer 3: This transfer's source, /);
  });

  test("a file whose third transfer names labware not on the deck names transfer 3", () => {
    const file = fullFile();
    file.operations[2].destination.labware = "Bench";
    assertRefused(file, /transfer 3: There's no labware "Bench" on the deck\./);
  });

  test("a transfer whose stage isn't in the file is refused", () => {
    const file = fullFile();
    file.operations[2].stage = "9";
    assertRefused(file, 'transfer 3 is in stage "9", which isn\'t one of the file\'s stages.');
  });

  test('a file with transfers in stages "1", "3", "1" is refused, not reordered', () => {
    const file = fullFile();
    file.operations = [transferTo("1", "A1"), transferTo("3", "A2"), transferTo("1", "A3")];
    assertRefused(
      file,
      'stage "1"\'s transfers aren\'t together: transfer 2 is in stage "3", between transfers of stage "1".',
    );
  });

  test("a file whose transfers come in a later stage, then an earlier one, is refused", () => {
    const file = fullFile();
    file.operations = [transferTo("3", "A1"), transferTo("1", "A2")];
    assertRefused(
      file,
      'transfer 2 is in stage "1", which comes before stage "3" in the stages, but after transfers of stage "3".',
    );
  });

  // --- Refusing: starting contents ---

  test("starting contents refused as a whole give contents-tracking's message, before any entry's checks", () => {
    const file = fullFile();
    // Entry 1 also holds a component not in the file, which the entry's own checks would refuse.
    file.startingContents[0].components.Ink = 5;
    file.startingContents.push({ ...file.startingContents[1] });
    assertRefused(file, new RegExp(`starting contents: ${RESERVOIR} 2 is in the starting contents twice`));
  });

  test("a starting-contents well not on the deck gives the deck's message", () => {
    const file = fullFile();
    file.startingContents[1].well = "13";
    assertRefused(file, /starting contents, entry 2: "13" isn't a well on /);
  });

  test("a component in the starting contents that isn't in components is refused", () => {
    const file = fullFile();
    file.startingContents[1].components = { Ink: 5 };
    assertRefused(
      file,
      'starting contents, entry 2, holds "Ink", which isn\'t one of the file\'s components.',
    );
  });

  test("a starting-contents volume of 0 is refused", () => {
    const file = fullFile();
    file.startingContents[1].components.Dye = 0;
    assertRefused(file, 'starting contents, entry 2, has 0 µL of "Dye"; a well lists only what it holds.');
  });

  test("a starting-contents entry holding nothing is refused", () => {
    const file = fullFile();
    file.startingContents[1].components = {};
    assertRefused(file, "starting contents, entry 2, holds nothing; a well that holds nothing is left out.");
  });

  // --- Refusing: tip changes ---

  test("a file without tips at the start is refused", () => {
    const file = fullFile();
    delete file.tipChanges.start;
    assertRefused(file, "it has no tips at the start of the run.");
  });

  test("a tip change before a stage that isn't in the file is refused", () => {
    const file = fullFile();
    file.tipChanges["9"] = { tipType: TIP_TYPES[0], probes: [1] };
    assertRefused(file, 'a tip change is before stage "9", which isn\'t one of the file\'s stages.');
  });

  test("a tip change keyed by the first stage is refused", () => {
    const file = fullFile();
    file.tipChanges["1"] = { tipType: TIP_TYPES[0], probes: [1] };
    assertRefused(
      file,
      'a tip change is before stage "1", the first stage, which always starts with the tips at "start".',
    );
  });

  test("a tip change that isn't an object with exactly a tip type and probes is refused", () => {
    for (const tipChange of [null, { tipType: TIP_TYPES[0], probes: [1], notes: "" }]) {
      const file = fullFile();
      file.tipChanges.start = tipChange;
      assertRefused(file, 'the tip change at "start" must be an object with exactly "tipType" and "probes".');
    }
  });

  test("a tip type not in TIP_TYPES is refused", () => {
    const file = fullFile();
    file.tipChanges["3"].tipType = "BC50";
    const known = TIP_TYPES.map((tipType) => `"${tipType}"`).join(", ");
    assertRefused(file, `the tip change at "3" loads "BC50", which isn't one of ${known}.`);
  });

  test("a tip change's probes setTipProbes refuses give its message, after the tip change's place", () => {
    const file = fullFile();
    file.tipChanges["3"].probes = [9];
    assertRefused(file, 'the tip change at "3": Probe numbers must be whole numbers from 1 to 8, but got 9.');
    file.tipChanges["3"].probes = [];
    assertRefused(
      file,
      'the tip change at "3": The probes must be a list of probe numbers from 1 to 8, like [1, 2, 3, 4], but got a list.',
    );
  });

  test("a tip change's probes are stored smallest first", () => {
    const file = fullFile();
    file.tipChanges["3"].probes = [4, 2];
    assert.deepEqual(open(file).tipChanges["3"].probes, [2, 4]);
  });

  // --- Labels ---

  test("two labware with one label are refused", () => {
    const file = fullFile();
    file.labwareLabels = { [PLATE]: "Drug plate", [OTHER_PLATE]: "Drug plate" };
    assertRefused(
      file,
      `labels: ${PLATE} and ${OTHER_PLATE} would both show as "Drug plate". Give each labware a different label.`,
    );
  });

  test("labels the tool can write open, judged as a whole", () => {
    for (const labels of [
      { [PLATE]: OTHER_PLATE, [OTHER_PLATE]: "D1" },
      { [PLATE]: OTHER_PLATE, [OTHER_PLATE]: PLATE },
    ]) {
      assert.deepEqual(open({ ...fullFile(), labwareLabels: labels }).labwareLabels, labels);
    }
  });

  test("a label with spaces at its ends, a blank one, or its own labware's name is refused, not tidied", () => {
    for (const [label, problem] of [
      [" Assay plate", /labels: The label for .+, " Assay plate", has spaces at the start or end\./],
      ["", /labels: The label for .+ is blank\./],
      [PLATE, /labels: The label for .+ is its own name\./],
    ]) {
      assertRefused({ ...fullFile(), labwareLabels: { [PLATE]: label } }, problem);
    }
  });
});
