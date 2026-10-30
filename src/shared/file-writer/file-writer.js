// file-writer.js — turns a plan (docs/glossary.md) into the files the general-purpose method runs
// (ADR 0007): the setup worklist (Setup.csv), the stage worklist (Stages.csv) and one Transfer From
// File file per substage. It makes only the files' names and text; the caller saves them, all in
// one folder named by the timestamp and the plan's experiment name, inside BASE_FOLDER on the
// Biomek PC. The name comes from the plan, not as a separate input, so the files can never be named
// after something other than the plan they hold (Andy, 2026-10-28).
//
// It's shared because each tool builds its own plan: the transfer designer now, the randomizer's
// link to the Biomek later. It never reads the clock (the caller gives the timestamp), saves
// nothing and changes nothing it's given, so the same inputs always give the same files and tests
// can check them exactly. It decides nothing about the plan: stages, settings, mixes and tip changes
// are the plan's. Substages come from the substages shared module and each row's mix volumes from
// the mix-volumes shared module, which the transfer designer uses too, so the tool and the files
// always agree. It can refuse a plan (section 5 of its specification); a refused plan gets no files.
// Specification: file-writer.md.

import { BASE_FOLDER } from "../../../config/paths.js";
import { describeValue } from "../error-messages/error-messages.js";
import { isObject, findMissingProperties } from "../input-checks/input-checks.js";
import { replay } from "../contents-tracking/contents-tracking.js";
import { labwareNames, gridOf } from "../deck/deck.js";
import { tipGroups } from "../tip-groups/tip-groups.js";
import { mixVolumes } from "../mix-volumes/mix-volumes.js";

// The two files every run has; the Transfer From File files are named after their stages.
const SETUP_FILE_NAME = "Setup.csv";
const STAGES_FILE_NAME = "Stages.csv";

// The stage worklist's columns, in order (ADR 0007, "The files that drive each run"). They are an
// interface with the method as built: the method reads each by name.
const STAGE_WORKLIST_COLUMNS = [
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

// A Transfer From File file's columns, in order (ADR 0007). The method reads them by number,
// 1 to 5.
const TRANSFER_FILE_COLUMNS = ["SourceLabware", "SourceWell", "DestLabware", "DestWell", "Volume"];

// The parts of a plan the file writer reads. A plan has more (components, labware labels), which it
// doesn't use, so it doesn't ask for them.
const PLAN_PARTS = [
  "startingContents",
  "operationList",
  "stageList",
  "stageOrder",
  "tipChanges",
  "experimentName",
];

// The experiment name's limit (Andy, 2026-10-28): it keeps every path well under Windows' limit of
// 260 characters for a path.
const EXPERIMENT_NAME_MAX_LENGTH = 40;

// Matches the first character an experiment name may not hold: anything but a letter, a digit, a
// hyphen or an underscore. (Inside [...], ^ means "not one of these".)
const FORBIDDEN_NAME_CHARACTER = /[^A-Za-z0-9_-]/;

// Transfer From File files are named Stage<nn>_<letter>.csv with two digits for the stage's place
// in the stage order, so a stage with transfers can come at most 99th.
const HIGHEST_PLACE = 99;

// The letters that name a stage's substages, in order. A stage can't have more substages than
// there are pairs of labware types (nine today), so the alphabet is never used up.
const SUBSTAGE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Volumes are written to 3 decimal places (ADR 0007): rounding to a whole number of thousandths.
const THOUSANDTHS = 1000;

// Every line ends with CRLF, the two characters Windows ends a line with (file-writer.md, "How
// values are written").
const LINE_ENDING = "\r\n";

// --- The interface ---

// The files for one run of `plan`, as { folderName, files }: the folder's name (folderNameFor, from
// the timestamp and the plan's experiment name) and the files, each { name, text }, in this order:
// Setup.csv, Stages.csv, then the Transfer From File files in the order Stages.csv names them. The
// caller saves them in that folder inside BASE_FOLDER. Checks, in this order, the timestamp, then
// the plan (its form, its experiment name, whether it has transfers, then each stage with transfers
// in stage order: its place, its overdraws, its mix problems, its volumes), and throws at the first
// problem, returning nothing, so a refused plan gets no files.
// e.g. with plan.experimentName "Exp36",
//      writeRunFiles(plan, new Date(2026, 9, 28, 1, 57, 32)).folderName → "2026-10-28_015732_Exp36"
export function writeRunFiles(plan, timestamp) {
  checkTimestamp(timestamp);
  checkPlan(plan);
  const stages = stagesWithTransfers(plan);
  const mixing = mixVolumes(plan);
  checkStages(plan, stages, mixing.problems);

  const folderName = folderNameFor(timestamp, plan.experimentName);
  const folderPath = `${BASE_FOLDER}${folderName}\\`;
  const rowsByStage = new Map(mixing.stages.map((entry) => [entry.stage, entry.rows]));
  const stagesWithSubstages = stages.map((stage) => ({
    ...stage,
    substages: namedSubstages(stage, rowsByStage.get(stage.id)),
  }));
  // Tip groups follow the stage order and each holds consecutive stages, so the Transfer From File
  // files in stage order come in the same order as Stages.csv's rows name them.
  const transferFiles = stagesWithSubstages
    .flatMap((stage) => stage.substages)
    .map((substage) => transferFile(substage));
  return {
    folderName,
    files: [
      setupFile(plan, folderPath),
      stagesFile(plan, stagesWithSubstages, folderPath),
      ...transferFiles,
    ],
  };
}

// Throws if `name` isn't a valid experiment name: text, not blank, at most 40 characters, holding
// only letters, digits, hyphens and underscores (file-writer.md, "Inputs"). Checked in that order.
// Exported so a tool can check a name as the user types it, by the same rule,
// e.g. checkExperimentName("Exp 36") throws 'The experiment name can't contain " " (a space). …'.
export function checkExperimentName(name) {
  if (typeof name !== "string") {
    throw new Error(
      `The experiment name must be text, like "Exp36", but got ${describeValue(name)}.`,
    );
  }
  if (name.trim() === "") {
    throw new Error('Type an experiment name, such as "Exp36".');
  }
  if (name.length > EXPERIMENT_NAME_MAX_LENGTH) {
    throw new Error(
      `The experiment name is ${name.length} characters long; ` +
        `it can be at most ${EXPERIMENT_NAME_MAX_LENGTH}.`,
    );
  }
  const forbidden = name.match(FORBIDDEN_NAME_CHARACTER);
  if (forbidden !== null) {
    // A space is invisible in quotes, so it's named as well.
    const shown = forbidden[0] === " " ? '" " (a space)' : `"${forbidden[0]}"`;
    throw new Error(
      `The experiment name can't contain ${shown}. ` +
        `Use only letters, digits, hyphens (-) and underscores (_), e.g. "Exp36_repeat".`,
    );
  }
}

// The name of the folder for a run made at `timestamp` (a Date) for `experimentName`: the
// timestamp written largest unit first, an underscore, then the name,
// e.g. folderNameFor(new Date(2026, 9, 28, 1, 57, 32), "Exp36") → "2026-10-28_015732_Exp36".
// Throws if the name isn't valid (checkExperimentName), then if the timestamp isn't a valid Date.
export function folderNameFor(timestamp, experimentName) {
  checkExperimentName(experimentName);
  checkTimestamp(timestamp);
  return `${timestampText(timestamp)}_${experimentName}`;
}

// --- Checks ---

// Throws if `timestamp` isn't a Date holding a real moment. A Date made from text it can't read,
// such as new Date("not a date"), is a Date whose time is NaN ("not a number"), so both are
// checked.
function checkTimestamp(timestamp) {
  if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) {
    throw new Error(`The timestamp must be a valid date, but got ${describeValue(timestamp)}.`);
  }
}

// Throws at the first problem with `plan`, checking in this order its form, its experiment name,
// then whether it has transfers. Its other parts aren't checked again: a plan is made only through
// the transfer designer's checks.
function checkPlan(plan) {
  checkPlanForm(plan);
  checkPlanName(plan);
  checkPlanHasTransfers(plan);
}

// Throws if `plan` isn't an object holding the parts the file writer reads (PLAN_PARTS).
function checkPlanForm(plan) {
  if (!isObject(plan) || findMissingProperties(plan, PLAN_PARTS).length > 0) {
    throw new Error(
      `The plan must be an object like the transfer designer makes, but got ${describeValue(plan)}.`,
    );
  }
}

// Throws if `plan` has no experiment name ("", which every new plan starts with), then if its name
// isn't a valid one (checkExperimentName). The folder is named after it, so a plan can't be
// written without one.
function checkPlanName(plan) {
  if (plan.experimentName === "") {
    throw new Error("Name the experiment first: the files' folder is named after it.");
  }
  checkExperimentName(plan.experimentName);
}

// Throws if `plan` has no transfers: there would be nothing to write.
function checkPlanHasTransfers(plan) {
  if (plan.operationList.listOperations().length === 0) {
    throw new Error(
      "There's nothing to write: the plan has no transfers. Add transfers to a stage first.",
    );
  }
}

// Throws at the first problem among `stages` (the stages with transfers, in stage order), checking
// each stage in turn for its place (at most HIGHEST_PLACE), then an overdraw, then a mix problem
// (among `mixProblems`, from mix-volumes), then a transfer whose volume rounds to 0. Stages are
// named by place and name, as the page shows them.
function checkStages(plan, stages, mixProblems) {
  const overdrawn = stagesWithOverdraw(plan);
  for (const stage of stages) {
    const shown = `Stage ${stage.place}, ${describeValue(stage.name)},`;
    if (stage.place > HIGHEST_PLACE) {
      throw new Error(
        `${shown} is too far down the list: file names have room for ${HIGHEST_PLACE} stages. ` +
          "Remove some stages before it.",
      );
    }
    if (overdrawn.has(stage.id)) {
      throw new Error(
        `${shown} has an overdraw: a transfer asks a well for more than it holds. ` +
          "Fix it before writing the files.",
      );
    }
    const mixProblem = mixProblems.find((problem) => problem.stage === stage.id);
    if (mixProblem !== undefined) {
      throw new Error(mixProblemMessage(shown, stage, mixProblem));
    }
    const skipped = stage.transfers.find((transfer) => roundVolume(transfer.volume) === 0);
    if (skipped !== undefined) {
      throw new Error(
        `${shown} has a transfer of ${skipped.volume} µL, which is 0 µL to 3 decimal places, ` +
          "so the Biomek would skip it. Use at least 0.001 µL.",
      );
    }
  }
}

// The message for `problem`, a mix problem (mix-volumes) of `stage`, shown as `shown` (its place and
// name), e.g. 'Stage 3, "Seeding", mixes Plate1 A2 after dispensing when it holds only 0.05 µL, and
// 90% of that is 0 µL. Turn that mixing off, or put more in the well first.' The well is named by its
// labware's name, as the files name it.
function mixProblemMessage(shown, stage, problem) {
  const when = problem.end === "source" ? "before aspirating" : "after dispensing";
  const { share } = stage.settings[`${problem.end}Mix`];
  return (
    `${shown} mixes ${problem.labware} ${problem.well} ${when} when it holds only ` +
    `${formatVolume(problem.held)} µL, and ${share}% of that is 0 µL. ` +
    "Turn that mixing off, or put more in the well first."
  );
}

// The IDs of the stages with an overdraw: a transfer that asks a well for more than it holds, as
// contents tracking finds it, e.g. new Set(["2"]). (The transfer designer has the same function;
// a shared module can't import from a tool, so it's repeated here.)
function stagesWithOverdraw(plan) {
  const operations = plan.operationList.listOperations();
  const problems = replay(plan.startingContents, plan.operationList).listProblems();
  return new Set(problems.map((problem) => operations[problem.operationIndex].stage));
}

// --- Stages and substages ---

// The stages with transfers, in stage order, each as { id, place, name, settings, transfers }:
// `place` is the stage's place in the stage order, counting from 1 (the number the page shows);
// `transfers` are its transfers in operation-list order. A stage without transfers isn't run, so it
// isn't listed, but it still counts for the places after it.
function stagesWithTransfers(plan) {
  const transfersByStage = new Map(
    plan.operationList.groupByStage().map((group) => [group.stage, group.operations]),
  );
  const stages = [];
  plan.stageOrder.forEach((id, index) => {
    if (transfersByStage.has(id)) {
      const { name, settings } = plan.stageList.get(id);
      stages.push({ id, place: index + 1, name, settings, transfers: transfersByStage.get(id) });
    }
  });
  return stages;
}

// A stage's substages (docs/glossary.md), each one of `rows`: the stage's rows from mix-volumes,
// which are its substages (the substages shared module's split) with their mix volumes, each given
// the name of its Transfer From File file, e.g. the first →
// { fileName: "Stage03_A.csv", sourceLabwareType: "DeepReservoir12", …, sourceMixVolume: null, … }.
function namedSubstages(stage, rows) {
  return rows.map((row, index) => ({ ...row, fileName: transferFileName(stage.place, index) }));
}

// The name of the Transfer From File file for the substage at `index` (counting from 0) of the
// stage at `place`, e.g. transferFileName(3, 0) → "Stage03_A.csv".
function transferFileName(place, index) {
  return `Stage${String(place).padStart(2, "0")}_${SUBSTAGE_LETTERS[index]}.csv`;
}

// --- The files ---

// Setup.csv: a header row and one data row. StageWorklist, the absolute path of Stages.csv, then
// Vol_<labware>_<well> for every well on the deck, labware in the deck's order and wells in grid
// order, holding the well's starting volume, or 0 if it starts empty: every volume variable in the
// method needs a value (ADR 0007).
function setupFile(plan, folderPath) {
  const startingVolumes = startingVolumesByWell(plan);
  const header = ["StageWorklist"];
  const values = [`${folderPath}${STAGES_FILE_NAME}`];
  for (const labware of labwareNames()) {
    for (const well of gridOf(labware).wellNames()) {
      header.push(`Vol_${labware}_${well}`);
      values.push(formatVolume(startingVolumes.get(wellKey(labware, well)) ?? 0));
    }
  }
  return { name: SETUP_FILE_NAME, text: csvText([header, values]) };
}

// Each well's starting volume, the sum of its components, keyed by wellKey,
// e.g. { labware: "Res1", well: "1", components: { Media: 500, Drug: 250 } } → 750 at its key.
function startingVolumesByWell(plan) {
  const volumes = new Map();
  for (const entry of plan.startingContents) {
    const total = Object.values(entry.components).reduce((sum, volume) => sum + volume, 0);
    volumes.set(wellKey(entry.labware, entry.well), total);
  }
  return volumes;
}

// Stages.csv: the header row, then one row per tip change or substage, in run order. Each tip group
// whose stages have transfers gets a tip-change row, then a transfer row for each substage of each
// of those stages, in stage order. A tip group whose stages have no transfers gets no row, so no
// tips are loaded for nothing.
function stagesFile(plan, stages, folderPath) {
  const rows = [];
  for (const group of tipGroups(plan)) {
    const groupStages = stages.filter((stage) => group.stages.includes(stage.id));
    if (groupStages.length > 0) {
      rows.push(tipChangeRow(group));
      for (const stage of groupStages) {
        for (const substage of stage.substages) {
          rows.push(transferRow(stage, substage, group, folderPath));
        }
      }
    }
  }
  const lines = rows.map((row) => STAGE_WORKLIST_COLUMNS.map((column) => row[column] ?? ""));
  return { name: STAGES_FILE_NAME, text: csvText([STAGE_WORKLIST_COLUMNS, ...lines]) };
}

// A tip-change row for tip group `group`, as an object of the columns it fills: NewTip 1, its tip
// change's tip type and the probes to load, the tip change's probes (ADR 0007, "Tip changes"),
// e.g. { NewTip: 1, TipType: "BC230", LoadProbes: "1,2,3,4" }.
function tipChangeRow(group) {
  return { NewTip: 1, TipType: group.tipType, LoadProbes: probesText(group.probes) };
}

// A transfer row for `substage` of `stage`, which runs in tip group `group`, as an object of the
// columns it fills: NewTip 0, the group's tip type, the file's absolute path, the group's probes
// (the same as its tip-change row's LoadProbes, since every stage uses all the probes its tips are
// on), the stage's technique and liquid type at each end, the substage's labware types, and the
// mix columns of each end that mixes (mixColumns). LoadProbes stays empty.
function transferRow(stage, substage, group, folderPath) {
  const { settings } = stage;
  return {
    NewTip: 0,
    TipType: group.tipType,
    TransferFile: `${folderPath}${substage.fileName}`,
    Probes: probesText(group.probes),
    SrcTechnique: settings.sourceTechnique,
    SrcLiquidType: settings.sourceLiquidType,
    DestTechnique: settings.destinationTechnique,
    DestLiquidType: settings.destinationLiquidType,
    SrcLabwareType: substage.sourceLabwareType,
    DestLabwareType: substage.destinationLabwareType,
    ...mixColumns("Src", settings.sourceMix, substage.sourceMixVolume),
    ...mixColumns("Dest", settings.destinationMix, substage.destinationMixVolume),
  };
}

// The three mix columns of one end, whose columns start with `prefix` ("Src" or "Dest"), as an
// object of the columns it fills: the row's mix `volume` at that end, and `mix`'s times and speed;
// none, so they stay empty, for an end that doesn't mix (`mix` null). Whether the end's technique
// mixes isn't checked here: the transfer designer keeps a mode's technique matched to its mixing,
// and a technique that isn't a mode's is up to whoever chose it (file-writer.md, section 3),
// e.g. ("Src", { share: 90, times: 3, speed: 400 }, 108) →
// { SrcMixVolume: "108", SrcMixTimes: "3", SrcMixSpeed: "400" }.
function mixColumns(prefix, mix, volume) {
  if (mix === null) {
    return {};
  }
  return {
    [`${prefix}MixVolume`]: formatVolume(volume),
    [`${prefix}MixTimes`]: String(mix.times),
    [`${prefix}MixSpeed`]: formatVolume(mix.speed),
  };
}

// A Transfer From File file for `substage`: the header row, then one row per transfer, in
// operation-list order, with wells as their grid names them (A1 on a plate, 5 on a reservoir).
function transferFile(substage) {
  const rows = substage.transfers.map((transfer) => [
    transfer.source.labware,
    transfer.source.well,
    transfer.destination.labware,
    transfer.destination.well,
    formatVolume(transfer.volume),
  ]);
  return { name: substage.fileName, text: csvText([TRANSFER_FILE_COLUMNS, ...rows]) };
}

// --- How values are written ---

// Probes as a worklist field, in ascending order, e.g. [1, 2, 3, 4] → "1,2,3,4", [1] → "1".
// The transfer designer stores a tip change's probes smallest first, and tip-groups passes them on
// as they are, so the order is kept as given.
function probesText(probes) {
  return probes.join(",");
}

// `volume` rounded to 3 decimal places (ADR 0007), e.g. 1 / 3 → 0.333, 10.000000000000002 → 10.
function roundVolume(volume) {
  return Math.round(volume * THOUSANDTHS) / THOUSANDTHS;
}

// A volume as the files write it: rounded to 3 decimal places, without trailing zeros,
// e.g. 10 → "10", 10.5 → "10.5", 0.125 → "0.125". String() never writes trailing zeros.
function formatVolume(volume) {
  return String(roundVolume(volume));
}

// The timestamp part of a folder name: year-month-day, an underscore, then hours, minutes and
// seconds on a 24-hour clock, each with leading zeros, in the computer's local time,
// e.g. new Date(2026, 0, 5, 9, 7, 2) → "2026-01-05_090702". (getMonth counts from 0.)
function timestampText(timestamp) {
  const twoDigits = (number) => String(number).padStart(2, "0");
  const date = [
    String(timestamp.getFullYear()).padStart(4, "0"),
    twoDigits(timestamp.getMonth() + 1),
    twoDigits(timestamp.getDate()),
  ].join("-");
  const time = [timestamp.getHours(), timestamp.getMinutes(), timestamp.getSeconds()]
    .map(twoDigits)
    .join("");
  return `${date}_${time}`;
}

// The text of a CSV file from `rows`, each a list of fields: one line per row, every line ending
// with CRLF, the last included, and no byte order mark.
function csvText(rows) {
  return rows.map((fields) => fields.map(csvField).join(",")).join(LINE_ENDING) + LINE_ENDING;
}

// One field as the file writes it: its text, in double quotes if it holds a comma (RFC 4180), so
// the comma isn't read as the end of the field, e.g. "1,2" → '"1,2"', 10 → "10". No other field
// is quoted.
function csvField(value) {
  const text = String(value);
  return text.includes(",") ? `"${text}"` : text;
}

// One text key for a well, for looking it up in a Map, e.g. ("Res1", "1") → '["Res1","1"]'.
// A JSON list keeps the two names apart, as in contents-tracking.
function wellKey(labware, well) {
  return JSON.stringify([labware, well]);
}
