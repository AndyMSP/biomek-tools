// Unit tests for plan-file.js. Each test comes from the "Test cases" section of plan-file.md, and
// each row of its error table has at least one.
//
// They use the real config/deck.js and config/tip-types.js. Tests find what they need in the config
// files rather than naming it, so they still pass when the configuration changes.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { TIP_TYPES } from "../../../config/tip-types.js";
import { DECK } from "../../../config/deck.js";
import {
  START,
  emptyPlan,
  defaultSettings,
  probesFor,
  stageOrder,
  addStage,
  renameStage,
  changeStageSettings,
  removeStage,
  addTransfer,
  addComponent,
  addToWells,
  addTipChange,
  setTipType,
  setLabel,
  setExperimentName,
} from "./transfer-designer.js";
import { PLAN_FILE_FORMAT, PLAN_FILE_VERSION, planToText, planFromText } from "./plan-file.js";

// Two 96-well labware and the numbered (reservoir) labware, found in DECK, in the deck's order.
const [PLATE, OTHER_PLATE] = DECK.filter((entry) => entry.grid === "GRID_96").map(
  (entry) => entry.name,
);
const RESERVOIR = DECK.find((entry) => entry.grid === "GRID_1X12_NUMBERED").name;

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
// troughs 1 and 2; stages "1" (Seeding), "2" (Wait, without transfers) and "3" (Treatment, 4
// probes), in that order; transfers of 2.5 and 50 µL in stage 1 and 0.1 µL in stage 3; a tip change
// before stage 3 with the last tip type; and a label on PLATE.
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
  plan = changeStageSettings(plan, "3", { ...defaultSettings(), probes: probesFor(4) });
  plan = addTransfer(plan, transferTo("1", "A1", 2.5));
  plan = addTransfer(plan, transferTo("1", "A2", 50));
  plan = addTransfer(plan, transferTo("3", "A1", 0.1, "2"));
  plan = setTipType(addTipChange(plan, "3"), "3", TIP_TYPES.at(-1));
  return setLabel(plan, PLATE, "Assay plate");
}

// The file fullPlan() saves as, as an object a test can change before opening it. A new object
// each time.
function fullFile() {
  return JSON.parse(planToText(fullPlan(), SAVED_BY));
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
    ]);
    assert.equal(file.format, PLAN_FILE_FORMAT);
    assert.equal(file.version, PLAN_FILE_VERSION);
    assert.equal(file.savedBy, SAVED_BY);
    assert.equal(file.experimentName, "Exp36");
    assert.equal(text, JSON.stringify(file, null, 2));
  });

  test("the format and version are the specification's", () => {
    assert.equal(PLAN_FILE_FORMAT, "biomek-tools transfer plan");
    assert.equal(PLAN_FILE_VERSION, 2);
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

  test("an empty plan, saved and opened, has the same contents, and is written as version 2", () => {
    const plan = emptyPlan().plan;
    const text = planToText(plan, SAVED_BY);
    assert.equal(JSON.parse(text).version, 2);
    const opened = planFromText(text);
    assert.deepEqual(contentsOf(opened), contentsOf(plan));
  });

  // --- Version 1 files ---

  // fullFile() as a version 1 file: saved before 2026-10-28, without experimentName.
  function version1File() {
    const file = { ...fullFile(), version: 1 };
    delete file.experimentName;
    return file;
  }

  test("a version 1 file opens, with an experiment name of \"\"", () => {
    const opened = open(version1File());
    assert.equal(opened.experimentName, "");
    const { experimentName, ...rest } = contentsOf(opened);
    const { experimentName: ignored, ...expected } = contentsOf(fullPlan());
    assert.deepEqual(rest, expected);
  });

  test("a version 1 file with experimentName is refused as having an extra property", () => {
    assertRefused(
      { ...version1File(), experimentName: "Exp36" },
      'it has "experimentName", which a plan file doesn\'t have.',
    );
  });

  test("a version 2 file without experimentName is refused as missing it", () => {
    const file = fullFile();
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

  test("the experiment name is checked last: bad labels and a bad name report the labels", () => {
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
      { ...fullFile(), version: 3 },
      "it was saved by a newer version of the tools (plan format 3). Open it with that version or a later one.",
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
    set.stages[2].settings.probes = [];
    assertRefused(set, /stage 3: /);
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
    file.tipChanges["9"] = { tipType: TIP_TYPES[0] };
    assertRefused(file, 'a tip change is before stage "9", which isn\'t one of the file\'s stages.');
  });

  test("a tip change keyed by the first stage is refused", () => {
    const file = fullFile();
    file.tipChanges["1"] = { tipType: TIP_TYPES[0] };
    assertRefused(
      file,
      'a tip change is before stage "1", the first stage, which always starts with the tips at "start".',
    );
  });

  test("a tip change that isn't an object with exactly a tip type is refused", () => {
    const file = fullFile();
    file.tipChanges.start = { tipType: TIP_TYPES[0], probes: [1] };
    assertRefused(file, 'the tip change at "start" must be an object with exactly "tipType".');
  });

  test("a tip type not in TIP_TYPES is refused", () => {
    const file = fullFile();
    file.tipChanges["3"].tipType = "BC50";
    const known = TIP_TYPES.map((tipType) => `"${tipType}"`).join(", ");
    assertRefused(file, `the tip change at "3" loads "BC50", which isn't one of ${known}.`);
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
