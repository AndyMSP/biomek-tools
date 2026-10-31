// Unit tests for file-writer.js. Each test comes from the "Test cases" section of file-writer.md,
// and each row of its error table and each order of checks has one.
//
// They build plans through the transfer designer's own edits, so every plan is one the page could
// make. They use the real config/ files, and also check config/paths.js (ADR 0009). Where a test
// needs a labware, it finds one in DECK by grid and labware type rather than naming it, so the
// tests still pass when the deck changes. The mix problem tests work out their volumes and messages
// from MIN_MIX_VOLUME in config/mixing.js, so they still pass when it changes (file-writer.md,
// section 5).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BASE_FOLDER } from "../../../config/paths.js";
import { DECK } from "../../../config/deck.js";
import { TIP_TYPES } from "../../../config/tip-types.js";
import {
  MIN_MIX_VOLUME,
  DEFAULT_MIX,
  MIX_STEP_MODE,
  MIX_STEP_VOLUME,
} from "../../../config/mixing.js";
import { labwareNames, gridOf } from "../deck/deck.js";
import {
  START,
  emptyPlan,
  setExperimentName,
  addStage,
  addMixStep,
  mixWells,
  renameStage,
  setStageMix,
  addTransfer,
  addTipChange,
  setTipType,
  setTipProbes,
  addComponent,
  addToWells,
} from "../../tools/transfer-designer/transfer-designer.js";
import { mixVolumes } from "../mix-volumes/mix-volumes.js";
import { writeRunFiles, checkExperimentName, folderNameFor } from "./file-writer.js";

// A 96-well labware, a 96-well labware of another labware type (a deep-well plate), and the
// numbered (reservoir) labware, each found in DECK with its labware type.
const PLATE = DECK.find((entry) => entry.grid === "GRID_96");
const DEEP = DECK.find(
  (entry) => entry.grid === "GRID_96" && entry.labwareType !== PLATE.labwareType,
);
const RESERVOIR = DECK.find((entry) => entry.grid === "GRID_1X12_NUMBERED");

// The timestamp most tests write with, the experiment name their plans have, and the folder they
// give.
const TIMESTAMP = new Date(2026, 9, 28, 1, 57, 32);
const NAME = "Exp36";
const FOLDER = "2026-10-28_015732_Exp36";
const FOLDER_PATH = `${BASE_FOLDER}${FOLDER}\\`;

// The stage worklist's columns (ADR 0007), in order.
const STAGE_COLUMNS = [
  "NewTip",
  "TipType",
  "LoadProbes",
  "TransferFile",
  "Probes",
  "SrcTechnique",
  "SrcLiquidType",
  "DestTechnique",
  "DestLiquidType",
  "SrcLabwareType",
  "DestLabwareType",
  "SrcMixVolume",
  "SrcMixTimes",
  "SrcMixSpeed",
  "DestMixVolume",
  "DestMixTimes",
  "DestMixSpeed",
];

// The one component the tests put in wells.
const MEDIA = "Media";

// A well on the deck, e.g. well(RESERVOIR, "1") → { labware: "Res1", well: "1" }.
function well(entry, name) {
  return { labware: entry.name, well: name };
}

// A plan named NAME with `count` stages, "1" to `count`, each added last, Media in the plan's
// components, and 1000 µL of Media in troughs 1 and 2 of the reservoir, so transfers from them
// don't overdraw.
function planWithStages(count) {
  let { plan } = emptyPlan();
  plan = setExperimentName(plan, NAME);
  for (let added = 1; added < count; added += 1) {
    plan = addStage(plan, null).plan;
  }
  plan = addComponent(plan, MEDIA, "#4e79a7");
  return addToWells(plan, [well(RESERVOIR, "1"), well(RESERVOIR, "2")], MEDIA, 1000);
}

// A transfer in `stage` from `source` to `destination`,
// e.g. transfer("1", well(RESERVOIR, "1"), well(PLATE, "A1"), 50).
function transfer(stage, source, destination, volume = 50) {
  return { type: "transfer", source, destination, volume, stage };
}

// A transfer in `stage` from the reservoir's trough 1 into `wellName` on PLATE. The reservoir is
// never a destination in these tests, so such transfers never break the stage rule.
function transferTo(stage, wellName, volume = 50) {
  return transfer(stage, well(RESERVOIR, "1"), well(PLATE, wellName), volume);
}

// The plan with one transfer added to each of `stages`, in turn, each into its own well of PLATE
// (A1, A2, …), e.g. withTransfersIn(plan, ["1", "2"]).
function withTransfersIn(plan, stages) {
  return stages.reduce(
    (planSoFar, stage, index) => addTransfer(planSoFar, transferTo(stage, `A${index + 1}`)),
    plan,
  );
}

// The plan with a tip change before stage `beforeId` loading `tipType` tips on `probes`,
// e.g. withTipChange(plan, "3", TIP_TYPES[1], [1, 3, 5]).
function withTipChange(plan, beforeId, tipType, probes) {
  return setTipProbes(setTipType(addTipChange(plan, beforeId), beforeId, tipType), beforeId, probes);
}

// The mix the specification's examples use. A new object each time.
function exampleMix() {
  return { share: 90, times: 3, speed: 400 };
}

// `value` rounded to `places` decimal places, to undo floating-point error,
// e.g. roundTo(0.30000000000000004, 3) → 0.3.
function roundTo(value, places) {
  return Number(value.toFixed(places));
}

// A volume as the files and messages write it: rounded to 3 decimal places, without trailing
// zeros (section 3), e.g. volumeText(0.9) → "0.9"; volumeText(1) → "1".
function volumeText(volume) {
  return String(roundTo(volume, 3));
}

// The largest mix volume that is a mix problem: one tenth of a µL under MIN_MIX_VOLUME, taken as a
// whole number of tenths of a µL, since mix volumes are rounded down to tenths (mix-volumes.md),
// e.g. 0.9 when MIN_MIX_VOLUME is 1.
const HIGHEST_PROBLEM_MIX = roundTo(Math.ceil(roundTo(MIN_MIX_VOLUME * 10, 6)) / 10 - 0.1, 1);

// The least volume, in thousandths of a µL, a well must hold for a mix at `share` percent to work
// out to `mixVolume` (a whole number of tenths of a µL), e.g. heldForMix(0.9, 90) → 1.
function heldForMix(mixVolume, share) {
  return Math.ceil(roundTo((mixVolume * 100 * 1000) / share, 6)) / 1000;
}

// The three mix columns of one end ("Src" or "Dest") of a Stages.csv row, as a list,
// e.g. ["108", "3", "400"].
function mixFieldsOf(row, prefix) {
  return ["Volume", "Times", "Speed"].map((part) => row[`${prefix}Mix${part}`]);
}

// writeRunFiles with the usual timestamp.
function write(plan) {
  return writeRunFiles(plan, TIMESTAMP);
}

// The file called `name` in a writeRunFiles result.
function fileNamed(result, name) {
  return result.files.find((file) => file.name === name);
}

// The lines of a file's text, without the line endings or the empty text after the last one,
// e.g. "a\r\nb\r\n" → ["a", "b"].
function linesOf(file) {
  const lines = file.text.split("\r\n");
  assert.equal(lines.at(-1), "", `${file.name} ends with CRLF`);
  return lines.slice(0, -1);
}

// The fields of one CSV line, reading a quoted field as one field without its quotes,
// e.g. '1,BC230,"1,2",' → ["1", "BC230", "1,2", ""].
function fieldsOf(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;
  for (const character of line) {
    if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

// A file's data rows as objects keyed by its header, e.g. [{ NewTip: "1", TipType: "BC230", … }].
function rowsOf(file) {
  const [header, ...lines] = linesOf(file).map(fieldsOf);
  return lines.map((fields) => Object.fromEntries(header.map((column, i) => [column, fields[i]])));
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

describe("file-writer", () => {
  // --- Configuration (config/paths.js) ---

  test("BASE_FOLDER is a drive letter, a colon and a backslash, ends with a backslash, and holds no forbidden character or comma", () => {
    assert.equal(typeof BASE_FOLDER, "string");
    assert.match(BASE_FOLDER, /^[A-Za-z]:\\/);
    assert.ok(BASE_FOLDER.endsWith("\\"));
    const afterDrive = BASE_FOLDER.slice(2);
    assert.doesNotMatch(afterDrive, /[/*?"<>|:,]/);
  });

  // --- The experiment name and the folder name ---

  test("checkExperimentName accepts letters, digits, hyphens and underscores, 1 to 40 characters", () => {
    for (const name of ["Exp36", "Exp36_repeat", "A-1", "x", "E".repeat(40)]) {
      assert.doesNotThrow(() => checkExperimentName(name), name);
    }
  });

  test("checkExperimentName refuses a name that isn't text", () => {
    assert.throws(() => checkExperimentName(5), {
      message: 'The experiment name must be text, like "Exp36", but got 5.',
    });
    assert.throws(() => checkExperimentName(null), {
      message: 'The experiment name must be text, like "Exp36", but got null.',
    });
  });

  test("checkExperimentName refuses a blank name", () => {
    assert.throws(() => checkExperimentName(""), {
      message: 'Type an experiment name, such as "Exp36".',
    });
  });

  test("checkExperimentName refuses a name of 41 characters", () => {
    assert.throws(() => checkExperimentName("E".repeat(41)), {
      message: "The experiment name is 41 characters long; it can be at most 40.",
    });
  });

  test("checkExperimentName names the first forbidden character, calling a space a space", () => {
    const rule = 'Use only letters, digits, hyphens (-) and underscores (_), e.g. "Exp36_repeat".';
    assert.throws(() => checkExperimentName("Exp 36"), {
      message: `The experiment name can't contain " " (a space). ${rule}`,
    });
    assert.throws(() => checkExperimentName("Exp36,b"), {
      message: `The experiment name can't contain ",". ${rule}`,
    });
    assert.throws(() => checkExperimentName("Exp/36"), {
      message: `The experiment name can't contain "/". ${rule}`,
    });
    assert.throws(() => checkExperimentName("Expé36"), {
      message: `The experiment name can't contain "é". ${rule}`,
    });
  });

  test("folderNameFor gives the timestamp, an underscore and the name", () => {
    assert.equal(folderNameFor(TIMESTAMP, NAME), FOLDER);
  });

  test("folderNameFor writes every part with leading zeros, on a 24-hour clock", () => {
    assert.equal(folderNameFor(new Date(2026, 0, 5, 9, 7, 2), NAME), "2026-01-05_090702_Exp36");
    assert.equal(
      folderNameFor(new Date(2026, 11, 31, 23, 59, 59), NAME),
      "2026-12-31_235959_Exp36",
    );
  });

  test("folderNameFor refuses a timestamp that isn't a valid date", () => {
    assert.throws(() => folderNameFor(new Date("not a date"), NAME), {
      message: "The timestamp must be a valid date, but got an object.",
    });
    assert.throws(() => folderNameFor("2026-10-28", NAME), {
      message: 'The timestamp must be a valid date, but got "2026-10-28".',
    });
  });

  test("folderNameFor refuses a bad name with checkExperimentName's message", () => {
    assert.throws(() => folderNameFor(TIMESTAMP, "Exp 36"), {
      message: /^The experiment name can't contain " " \(a space\)\./,
    });
  });

  // --- Setup.csv ---

  test("Setup.csv's header is StageWorklist, then Vol_<labware>_<well> for every well, in deck and grid order", () => {
    const setup = fileNamed(write(withTransfersIn(planWithStages(1), ["1"])), "Setup.csv");
    const expected = ["StageWorklist"];
    for (const labware of labwareNames()) {
      for (const wellName of gridOf(labware).wellNames()) {
        expected.push(`Vol_${labware}_${wellName}`);
      }
    }
    const [header, dataRow, ...more] = linesOf(setup).map(fieldsOf);
    assert.deepEqual(header, expected);
    assert.equal(header.length, expected.length);
    assert.equal(dataRow.length, expected.length);
    assert.deepEqual(more, []);
  });

  test("Setup.csv's StageWorklist is the absolute path of Stages.csv", () => {
    const setup = fileNamed(write(withTransfersIn(planWithStages(1), ["1"])), "Setup.csv");
    assert.equal(rowsOf(setup)[0].StageWorklist, `${FOLDER_PATH}Stages.csv`);
  });

  test("the folder is named after the plan's experiment name", () => {
    const plan = withTransfersIn(planWithStages(1), ["1"]);
    assert.equal(write(plan).folderName, FOLDER);
    const renamed = setExperimentName(plan, "Exp36_repeat");
    assert.equal(write(renamed).folderName, "2026-10-28_015732_Exp36_repeat");
  });

  test("Setup.csv gives each well the sum of its components, 0 if empty, and names reservoir wells by number", () => {
    let plan = addComponent(planWithStages(1), "Drug", "#e15759");
    plan = addToWells(plan, [well(PLATE, "B2")], MEDIA, 500);
    plan = addToWells(plan, [well(PLATE, "B2")], "Drug", 250);
    plan = addToWells(plan, [well(RESERVOIR, "5")], "Drug", 300);
    plan = withTransfersIn(plan, ["1"]);
    const [row] = rowsOf(fileNamed(write(plan), "Setup.csv"));
    assert.equal(row[`Vol_${PLATE.name}_B2`], "750");
    assert.equal(row[`Vol_${PLATE.name}_B3`], "0");
    assert.equal(row[`Vol_${RESERVOIR.name}_5`], "300");
  });

  // --- Stages.csv ---

  test("Stages.csv's header is ADR 0007's 17 columns, in order", () => {
    const stages = fileNamed(write(withTransfersIn(planWithStages(1), ["1"])), "Stages.csv");
    assert.deepEqual(fieldsOf(linesOf(stages)[0]), STAGE_COLUMNS);
    assert.equal(STAGE_COLUMNS.length, 17);
  });

  test("one stage with one substage gives a tip-change row and a transfer row", () => {
    const plan = setTipProbes(withTransfersIn(planWithStages(1), ["1"]), START, [1, 2, 3, 4]);
    const { settings } = plan.stageList.get("1");
    const stages = fileNamed(write(plan), "Stages.csv");
    const lines = linesOf(stages);
    assert.equal(lines.length, 3);
    // As the specification's example shows it: three fields, then 14 empty ones.
    assert.equal(lines[1], `1,${TIP_TYPES[0]},"1,2,3,4"${",".repeat(14)}`);
    assert.deepEqual(fieldsOf(lines[2]), [
      "0",
      TIP_TYPES[0],
      "",
      `${FOLDER_PATH}Stage01_A.csv`,
      "1,2,3,4",
      settings.sourceTechnique,
      settings.sourceLiquidType,
      settings.destinationTechnique,
      settings.destinationLiquidType,
      RESERVOIR.labwareType,
      PLATE.labwareType,
      ...Array(6).fill(""),
    ]);
  });

  test("mixing at the source only fills the SrcMix columns with the row's mix volume, times and speed, and its SrcTechnique is the stored mixing technique", () => {
    const plan = setStageMix(withTransfersIn(planWithStages(1), ["1"]), "1", "source", exampleMix());
    const [, row] = rowsOf(fileNamed(write(plan), "Stages.csv"));
    const volume = mixVolumes(plan).stages[0].rows[0].sourceMixVolume;
    assert.deepEqual(mixFieldsOf(row, "Src"), [String(volume), "3", "400"]);
    assert.deepEqual(mixFieldsOf(row, "Dest"), ["", "", ""]);
    assert.equal(row.SrcTechnique, plan.stageList.get("1").settings.sourceTechnique);
    assert.equal(row.SrcTechnique, "OperationMix");
    assert.equal(row.DestTechnique, "Operation");
  });

  test("mixing at the destination only fills the DestMix columns, and leaves the SrcMix columns empty", () => {
    // Trough 1 into A1, empty before: 90% of 50 µL is 45.
    const plan = setStageMix(withTransfersIn(planWithStages(1), ["1"]), "1", "destination", exampleMix());
    const [, row] = rowsOf(fileNamed(write(plan), "Stages.csv"));
    assert.deepEqual(mixFieldsOf(row, "Src"), ["", "", ""]);
    assert.deepEqual(mixFieldsOf(row, "Dest"), ["45", "3", "400"]);
    assert.equal(row.DestTechnique, "OperationMix");
    assert.equal(row.SrcTechnique, "Operation");
  });

  test("mixing at both ends fills all six mix columns", () => {
    let plan = withTransfersIn(planWithStages(1), ["1"]);
    plan = setStageMix(plan, "1", "source", { share: 10, times: 2, speed: 100 });
    plan = setStageMix(plan, "1", "destination", exampleMix());
    const [, row] = rowsOf(fileNamed(write(plan), "Stages.csv"));
    // Trough 1 holds 1000 µL when it's mixed (1000 − 50 + 50): 10% is 100.
    assert.deepEqual(mixFieldsOf(row, "Src"), ["100", "2", "100"]);
    assert.deepEqual(mixFieldsOf(row, "Dest"), ["45", "3", "400"]);
  });

  test("one mix volume per row: a mixing stage split into two substages writes each row's own mix volume", () => {
    let plan = addToWells(planWithStages(1), [well(PLATE, "H12")], MEDIA, 100);
    plan = addTransfer(plan, transfer("1", well(RESERVOIR, "1"), well(PLATE, "A1"), 10));
    plan = addTransfer(plan, transfer("1", well(PLATE, "H12"), well(DEEP, "A1"), 20));
    plan = setStageMix(plan, "1", "destination", { share: 50, times: 2, speed: 100 });
    const rows = rowsOf(fileNamed(write(plan), "Stages.csv")).slice(1);
    assert.deepEqual(
      rows.map((row) => [row.DestLabwareType, row.DestMixVolume]),
      [
        [PLATE.labwareType, "5"],
        [DEEP.labwareType, "10"],
      ],
    );
  });

  test("a mix step is written like any stage: MIX_STEP_MODE at both ends, empty SrcMix columns, the row's mix volume with DEFAULT_MIX's times and speed, and a file of each well into itself of MIX_STEP_VOLUME", () => {
    let plan = withTransfersIn(planWithStages(1), ["1", "1"]);
    const { plan: withMixStep, id } = addMixStep(plan, null);
    plan = mixWells(withMixStep, id, [well(PLATE, "A1"), well(PLATE, "A2")]);
    const result = write(plan);
    const [, , row] = rowsOf(fileNamed(result, "Stages.csv"));
    const volume = mixVolumes(plan).stages[1].rows[0].destinationMixVolume;
    assert.deepEqual(
      [row.TransferFile, row.SrcTechnique, row.SrcLiquidType, row.DestTechnique, row.DestLiquidType],
      [
        `${FOLDER_PATH}Stage02_A.csv`,
        MIX_STEP_MODE.technique,
        MIX_STEP_MODE.liquidType,
        MIX_STEP_MODE.technique,
        MIX_STEP_MODE.liquidType,
      ],
    );
    assert.deepEqual([row.SrcLabwareType, row.DestLabwareType], [PLATE.labwareType, PLATE.labwareType]);
    assert.deepEqual(mixFieldsOf(row, "Src"), ["", "", ""]);
    assert.deepEqual(mixFieldsOf(row, "Dest"), [
      volumeText(volume),
      String(DEFAULT_MIX.times),
      String(DEFAULT_MIX.speed),
    ]);
    assert.deepEqual(linesOf(fileNamed(result, "Stage02_A.csv")), [
      "SourceLabware,SourceWell,DestLabware,DestWell,Volume",
      `${PLATE.name},A1,${PLATE.name},A1,${volumeText(MIX_STEP_VOLUME)}`,
      `${PLATE.name},A2,${PLATE.name},A2,${volumeText(MIX_STEP_VOLUME)}`,
    ]);
  });

  test("a mix speed of 150.5 is written 150.5, and a mix volume of 89.9 is written 89.9", () => {
    let plan = addTransfer(planWithStages(1), transferTo("1", "A1", 99.99));
    plan = setStageMix(plan, "1", "destination", { share: 90, times: 3, speed: 150.5 });
    const [, row] = rowsOf(fileNamed(write(plan), "Stages.csv"));
    assert.deepEqual(mixFieldsOf(row, "Dest"), ["89.9", "3", "150.5"]);
  });

  test("probes with a comma are quoted; a single probe isn't", () => {
    const base = withTransfersIn(planWithStages(1), ["1"]);
    const twoProbes = linesOf(fileNamed(write(setTipProbes(base, START, [1, 2])), "Stages.csv"));
    assert.equal(twoProbes[1], `1,${TIP_TYPES[0]},"1,2"${",".repeat(14)}`);
    assert.ok(twoProbes[2].includes('.csv,"1,2",'), twoProbes[2]);
    const oneProbe = linesOf(fileNamed(write(setTipProbes(base, START, [1])), "Stages.csv"));
    assert.equal(oneProbe[1], `1,${TIP_TYPES[0]},1${",".repeat(14)}`);
    assert.ok(oneProbe[2].includes(".csv,1,"), oneProbe[2]);
  });

  test("probes from the tip change: LoadProbes and every transfer row's Probes in its group are the tip change's", () => {
    let plan = withTransfersIn(planWithStages(4), ["1", "2", "3", "4"]);
    plan = setTipProbes(plan, START, [1, 2, 3, 4]);
    plan = withTipChange(plan, "3", TIP_TYPES[1], [1, 3, 5]);
    const rows = rowsOf(fileNamed(write(plan), "Stages.csv"));
    assert.deepEqual(
      rows.map((row) => [row.NewTip, row.LoadProbes, row.Probes]),
      [
        ["1", "1,2,3,4", ""],
        ["0", "", "1,2,3,4"],
        ["0", "", "1,2,3,4"],
        ["1", "1,3,5", ""],
        ["0", "", "1,3,5"],
        ["0", "", "1,3,5"],
      ],
    );
  });

  test("a tip change before the third stage gives a second tip-change row before its rows, carrying its tip type", () => {
    let plan = withTransfersIn(planWithStages(3), ["1", "2", "3"]);
    plan = setTipType(addTipChange(plan, "3"), "3", TIP_TYPES[1]);
    const rows = rowsOf(fileNamed(write(plan), "Stages.csv"));
    assert.deepEqual(
      rows.map((row) => [row.NewTip, row.TipType, row.TransferFile]),
      [
        ["1", TIP_TYPES[0], ""],
        ["0", TIP_TYPES[0], `${FOLDER_PATH}Stage01_A.csv`],
        ["0", TIP_TYPES[0], `${FOLDER_PATH}Stage02_A.csv`],
        ["1", TIP_TYPES[1], ""],
        ["0", TIP_TYPES[1], `${FOLDER_PATH}Stage03_A.csv`],
      ],
    );
  });

  test("a stage without transfers gets no row and no file, and a tip group of such stages gets no tip-change row", () => {
    let plan = withTransfersIn(planWithStages(3), ["1", "3"]);
    plan = addTipChange(addTipChange(plan, "2"), "3");
    const result = write(plan);
    const rows = rowsOf(fileNamed(result, "Stages.csv"));
    assert.deepEqual(
      rows.map((row) => [row.NewTip, row.TransferFile]),
      [
        ["1", ""],
        ["0", `${FOLDER_PATH}Stage01_A.csv`],
        ["1", ""],
        ["0", `${FOLDER_PATH}Stage03_A.csv`],
      ],
    );
    assert.deepEqual(
      result.files.map((file) => file.name),
      ["Setup.csv", "Stages.csv", "Stage01_A.csv", "Stage03_A.csv"],
    );
  });

  // --- Places and stage IDs ---

  test("files are named by the stage's place in the stage order, not its ID", () => {
    // Adding a stage before "2" gives ID "3" at the second place: the order is ["1", "3", "2"].
    let plan = addStage(planWithStages(2), "2").plan;
    assert.deepEqual(plan.stageOrder, ["1", "3", "2"]);
    plan = withTransfersIn(plan, ["1", "3", "2"]);
    const result = write(plan);
    const rows = rowsOf(fileNamed(result, "Stages.csv"));
    assert.equal(rows[2].TransferFile, `${FOLDER_PATH}Stage02_A.csv`);
    assert.equal(rows[3].TransferFile, `${FOLDER_PATH}Stage03_A.csv`);
    // Stage "3" is second, so its transfer (into A2) is in Stage02_A.csv; stage "2" is third, and
    // its transfer (into A3) is in Stage03_A.csv.
    assert.equal(rowsOf(fileNamed(result, "Stage02_A.csv"))[0].DestWell, "A2");
    assert.equal(rowsOf(fileNamed(result, "Stage03_A.csv"))[0].DestWell, "A3");
  });

  test("a stage without transfers still counts for the places after it", () => {
    const plan = withTransfersIn(planWithStages(3), ["1", "3"]);
    assert.deepEqual(
      write(plan)
        .files.map((file) => file.name)
        .slice(2),
      ["Stage01_A.csv", "Stage03_A.csv"],
    );
  });

  test("a stage at place 99 is written as Stage99_A.csv", () => {
    const plan = withTransfersIn(planWithStages(99), ["99"]);
    assert.ok(fileNamed(write(plan), "Stage99_A.csv") !== undefined);
  });

  // --- Substages and Transfer From File files ---

  test("a stage mixing labware types is split into substages, each with its own row and file", () => {
    let plan = addToWells(planWithStages(1), [well(PLATE, "H12")], MEDIA, 100);
    plan = addTransfer(plan, transfer("1", well(RESERVOIR, "1"), well(PLATE, "A1"), 10));
    plan = addTransfer(plan, transfer("1", well(PLATE, "H12"), well(DEEP, "A1"), 20));
    plan = addTransfer(plan, transfer("1", well(RESERVOIR, "2"), well(PLATE, "A2"), 30));
    const result = write(plan);
    const rows = rowsOf(fileNamed(result, "Stages.csv"));
    assert.deepEqual(
      rows.slice(1).map((row) => [row.TransferFile, row.SrcLabwareType, row.DestLabwareType]),
      [
        [`${FOLDER_PATH}Stage01_A.csv`, RESERVOIR.labwareType, PLATE.labwareType],
        [`${FOLDER_PATH}Stage01_B.csv`, PLATE.labwareType, DEEP.labwareType],
      ],
    );
    assert.deepEqual(linesOf(fileNamed(result, "Stage01_A.csv")), [
      "SourceLabware,SourceWell,DestLabware,DestWell,Volume",
      `${RESERVOIR.name},1,${PLATE.name},A1,10`,
      `${RESERVOIR.name},2,${PLATE.name},A2,30`,
    ]);
    assert.deepEqual(linesOf(fileNamed(result, "Stage01_B.csv")), [
      "SourceLabware,SourceWell,DestLabware,DestWell,Volume",
      `${PLATE.name},H12,${DEEP.name},A1,20`,
    ]);
  });

  test("files come as Setup.csv, Stages.csv, then the Transfer From File files in Stages.csv's order", () => {
    let plan = addToWells(planWithStages(2), [well(PLATE, "H12")], MEDIA, 100);
    plan = withTransfersIn(plan, ["1", "2"]);
    plan = addTransfer(plan, transfer("1", well(PLATE, "H12"), well(DEEP, "A1")));
    const result = write(plan);
    const names = result.files.map((file) => file.name);
    assert.deepEqual(names, [
      "Setup.csv",
      "Stages.csv",
      "Stage01_A.csv",
      "Stage01_B.csv",
      "Stage02_A.csv",
    ]);
    const namedInStages = rowsOf(result.files[1])
      .filter((row) => row.NewTip === "0")
      .map((row) => row.TransferFile.slice(FOLDER_PATH.length));
    assert.deepEqual(names.slice(2), namedInStages);
  });

  // --- How values are written ---

  test("volumes are rounded to 3 decimal places and written without trailing zeros", () => {
    const volumes = [10, 10.5, 0.125, 1 / 3, 10.000000000000002];
    let plan = planWithStages(1);
    volumes.forEach((volume, index) => {
      plan = addTransfer(plan, transferTo("1", `A${index + 1}`, volume));
    });
    const written = rowsOf(fileNamed(write(plan), "Stage01_A.csv")).map((row) => row.Volume);
    assert.deepEqual(written, ["10", "10.5", "0.125", "0.333", "10"]);
  });

  test("every line ends with CRLF, no file starts with a byte order mark, and only fields with a comma are quoted", () => {
    // START's probes (1 to 4) are quoted; the tip change before stage 2 loads one probe, unquoted.
    let plan = withTransfersIn(planWithStages(2), ["1", "2"]);
    plan = withTipChange(plan, "2", TIP_TYPES[0], [1]);
    for (const file of write(plan).files) {
      assert.ok(file.text.endsWith("\r\n"), `${file.name} ends with CRLF`);
      // A line feed not preceded by a carriage return would be a bare LF.
      assert.doesNotMatch(file.text, /(^|[^\r])\n/, `${file.name} uses CRLF only`);
      assert.notEqual(file.text.charCodeAt(0), 0xfeff, `${file.name} has no byte order mark`);
      for (const line of linesOf(file)) {
        // Every quoted field holds a comma, and every field holding a comma is quoted.
        const quoted = (line.match(/"[^"]*"/g) ?? []).map((field) => field.slice(1, -1));
        assert.ok(quoted.every((field) => field.includes(",")), `${file.name}: ${line}`);
        const withComma = fieldsOf(line).filter((field) => field.includes(","));
        assert.deepEqual(quoted, withComma, `${file.name}: ${line}`);
      }
    }
  });

  // --- Refusing (section 5) ---

  test("a plan that isn't an object with the parts the file writer reads is refused", () => {
    const message = (got) =>
      `The plan must be an object like the transfer designer makes, but got ${got}.`;
    assert.throws(() => write(null), { message: message("null") });
    assert.throws(() => write([]), { message: message("a list") });
    const plan = withTransfersIn(planWithStages(1), ["1"]);
    const { operationList, ...withoutTransfers } = plan;
    assert.throws(() => write(withoutTransfers), { message: message("an object") });
    const { experimentName, ...withoutName } = plan;
    assert.throws(() => write(withoutName), { message: message("an object") });
  });

  test("a plan with no experiment name is refused, with no files", () => {
    const plan = setExperimentName(withTransfersIn(planWithStages(1), ["1"]), "");
    assert.throws(() => write(plan), {
      message: "Name the experiment first: the files' folder is named after it.",
    });
  });

  test("a plan whose experiment name isn't valid is refused with checkExperimentName's message", () => {
    const plan = withTransfersIn(planWithStages(1), ["1"]);
    // The transfer designer never stores such a name; a copy of the plan with one stands in.
    assert.throws(() => write({ ...plan, experimentName: 5 }), {
      message: 'The experiment name must be text, like "Exp36", but got 5.',
    });
    assert.throws(() => write({ ...plan, experimentName: "Exp 36" }), {
      message: /^The experiment name can't contain " " \(a space\)\./,
    });
  });

  test("a plan with no transfers is refused", () => {
    assert.throws(() => write(planWithStages(2)), {
      message: "There's nothing to write: the plan has no transfers. Add transfers to a stage first.",
    });
  });

  test("a stage with transfers at place 100 is refused; one without transfers there is accepted", () => {
    const plan = renameStage(planWithStages(100), "100", "Wash");
    assert.throws(() => write(withTransfersIn(plan, ["100"])), {
      message:
        'Stage 100, "Wash", is too far down the list: file names have room for 99 stages. ' +
        "Remove some stages before it.",
    });
    const result = write(withTransfersIn(plan, ["99"]));
    assert.ok(fileNamed(result, "Stage99_A.csv") !== undefined);
  });

  test("a stage with an overdraw is refused, named by place and name", () => {
    let plan = renameStage(planWithStages(3), "3", "Seeding");
    plan = withTransfersIn(plan, ["1", "2"]);
    plan = addTransfer(plan, transferTo("3", "A3", 5000));
    assert.throws(() => write(plan), {
      message:
        'Stage 3, "Seeding", has an overdraw: a transfer asks a well for more than it holds. ' +
        "Fix it before writing the files.",
    });
  });

  test("a stage with a mix problem at the destination is refused, naming the well and its volumes", () => {
    let plan = renameStage(planWithStages(3), "3", "Seeding");
    plan = withTransfersIn(plan, ["1", "2"]);
    // A3 holds just enough that 90% of it is a tenth of a µL under MIN_MIX_VOLUME (with today's
    // 1 µL: it holds 1 µL, and mixes 0.9).
    const held = heldForMix(HIGHEST_PROBLEM_MIX, 90);
    plan = addTransfer(plan, transferTo("3", "A3", held));
    plan = setStageMix(plan, "3", "destination", exampleMix());
    assert.throws(() => write(plan), {
      message:
        `Stage 3, "Seeding", mixes ${PLATE.name} A3 after dispensing when it holds only ${volumeText(held)} µL: ` +
        `90% of that is ${volumeText(HIGHEST_PROBLEM_MIX)} µL, ` +
        `and a mix needs at least ${volumeText(MIN_MIX_VOLUME)} µL. ` +
        "Turn that mixing off, or put more in the well first.",
    });
  });

  test("a stage with a mix problem at the source is refused, saying before aspirating", () => {
    let plan = renameStage(planWithStages(1), "1", "Wash");
    plan = addToWells(plan, [well(PLATE, "H1")], MEDIA, 0.1);
    plan = addTransfer(plan, transfer("1", well(PLATE, "H1"), well(DEEP, "A1"), 0.1));
    plan = setStageMix(plan, "1", "source", { share: 50, times: 2, speed: 100 });
    assert.throws(() => write(plan), {
      message:
        `Stage 1, "Wash", mixes ${PLATE.name} H1 before aspirating when it holds only 0.1 µL: ` +
        `50% of that is 0 µL, and a mix needs at least ${volumeText(MIN_MIX_VOLUME)} µL. ` +
        "Turn that mixing off, or put more in the well first.",
    });
  });

  test("a transfer whose volume is 0 to 3 decimal places is refused", () => {
    let plan = renameStage(planWithStages(2), "2", "Media");
    plan = withTransfersIn(plan, ["1"]);
    plan = addTransfer(plan, transferTo("2", "A2", 0.0004));
    assert.throws(() => write(plan), {
      message:
        'Stage 2, "Media", has a transfer of 0.0004 µL, which is 0 µL to 3 decimal places, ' +
        "so the Biomek would skip it. Use at least 0.001 µL.",
    });
  });

  test("order of checks: the timestamp, then the plan's form, name and transfers, then each stage in stage order", () => {
    // A plan with no name and no transfers.
    const unnamed = setExperimentName(planWithStages(1), "");
    assert.throws(() => writeRunFiles(unnamed, "2026-10-28"), {
      message: /^The timestamp must be a valid date/,
    });
    assert.throws(() => writeRunFiles(unnamed, TIMESTAMP), {
      message: /^Name the experiment first/,
    });
    assert.throws(() => writeRunFiles(planWithStages(1), "2026-10-28"), {
      message: /^The timestamp must be a valid date/,
    });
    // An overdraw in stage 4 and a zero-rounding volume in stage 2: stage 2 comes first.
    let plan = withTransfersIn(planWithStages(4), ["1", "3"]);
    plan = addTransfer(plan, transferTo("2", "B1", 0.0004));
    plan = addTransfer(plan, transferTo("4", "B2", 5000));
    assert.throws(() => write(plan), { message: /^Stage 2, .* has a transfer of 0.0004 µL/ });
  });

  test("order of checks: a stage with an overdraw and a mix problem reports the overdraw", () => {
    let plan = addTransfer(planWithStages(1), transferTo("1", "A3", 5000));
    plan = addTransfer(plan, transferTo("1", "A4", 0.05));
    plan = setStageMix(plan, "1", "destination", exampleMix());
    assert.throws(() => write(plan), { message: /^Stage 1, .* has an overdraw/ });
  });

  test("order of checks: a stage with a mix problem and a zero-rounding volume reports the mix problem", () => {
    let plan = addTransfer(planWithStages(1), transferTo("1", "A5", 0.0004));
    plan = setStageMix(plan, "1", "destination", exampleMix());
    assert.throws(() => write(plan), { message: /^Stage 1, .* mixes .* after dispensing/ });
  });

  // --- Purity ---

  test("the plan is unchanged, and the same inputs give identical results", () => {
    let plan = withTransfersIn(planWithStages(2), ["1", "2"]);
    plan = setTipType(addTipChange(plan, "2"), "2", TIP_TYPES[1]);
    const before = snapshot(plan);
    const first = write(plan);
    const second = write(plan);
    assert.equal(snapshot(plan), before);
    assert.deepEqual(first, second);
  });
});
