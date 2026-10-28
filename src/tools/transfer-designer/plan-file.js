// plan-file.js — turns a plan into the text of a plan file, and a plan file's text back into a plan
// (ADR 0010). It is the only module that knows what a plan file holds.
//
// The text is JSON, so a plan file can be read in any text editor. Opening a file is strict: it
// checks everything in it, using the transfer designer's own rules, and refuses anything the tool
// would never write rather than tidying it. The plan is built from an empty plan through the
// transfer designer's own edits, so a plan made from a file is as valid as one made by editing, and
// a file that fails any check isn't opened in part.
// It writes format version 2, which holds the experiment name, and still reads version 1 files
// (saved before plans had one), which open with no name.
// Specification: plan-file.md.

import { TIP_TYPES } from "../../../config/tip-types.js";
import { describeValue } from "../../shared/error-messages/error-messages.js";
import { checkExperimentName } from "../../shared/file-writer/file-writer.js";
import {
  isObject,
  findMissingProperties,
  findExtraProperties,
  listNames,
  checkName,
} from "../../shared/input-checks/input-checks.js";
import { OperationList } from "../../shared/operation-list/operation-list.js";
import { replay } from "../../shared/contents-tracking/contents-tracking.js";
import { checkWell } from "../../shared/deck/deck.js";
import {
  START,
  emptyPlan,
  stageOrder,
  addStage,
  renameStage,
  changeStageSettings,
  addTransfer,
  addComponent,
  addToWells,
  addTipChange,
  setTipType,
  setLabels,
  setExperimentName,
} from "./transfer-designer.js";

// The format name every plan file holds, so a file can be recognized as one.
export const PLAN_FILE_FORMAT = "biomek-tools transfer plan";

// The format version written. It goes up only when what a plan file holds changes, not with every
// release of the tools (ADR 0010). Changing it means changing how files are read, so it isn't in
// config/. Version 2 (2026-10-28) added the experiment name.
export const PLAN_FILE_VERSION = 2;

// The versions this module can read: the one it writes, and version 1, which every plan saved
// before 2026-10-28 is.
const VERSIONS_READ = [PLAN_FILE_VERSION, 1];

// A version 2 plan file's properties, in the order they are written (plan-file.md, section 3).
const FILE_PROPERTIES = [
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
];

// The properties version 2 added. A version 1 file has every other property, and can't have these.
const VERSION_2_PROPERTIES = ["experimentName"];

// savedBy is for information only, so a file may leave it out.
const OPTIONAL_PROPERTIES = ["savedBy"];

// The properties that hold lists, and those that hold objects.
const LIST_PROPERTIES = ["components", "startingContents", "stages", "operations"];
const OBJECT_PROPERTIES = ["tipChanges", "labwareLabels"];

// How every message from planFromText starts.
const CANT_OPEN = "This file can't be opened: ";

// --- Saving ---

// The plan file's text for `plan`: JSON, indented by 2 spaces, with the properties of plan-file.md
// section 3 in that order, e.g. planToText(plan, "transfer designer v0.2.0") → '{\n  "format": …'.
// `savedBy` names the tool and its version; throws if it isn't a name (checkName).
export function planToText(plan, savedBy) {
  checkName(savedBy, "name of the tool saving the plan");
  const file = {
    format: PLAN_FILE_FORMAT,
    version: PLAN_FILE_VERSION,
    savedBy,
    experimentName: plan.experimentName,
    components: plan.components,
    startingContents: plan.startingContents,
    // In stage order, so the file needs no separate list of the order (ADR 0011).
    stages: stageOrder(plan).map((id) => {
      const { name, settings } = plan.stageList.get(id);
      return { id, name, settings };
    }),
    operations: plan.operationList.listOperations(),
    tipChanges: plan.tipChanges,
    labwareLabels: plan.labwareLabels,
  };
  return JSON.stringify(file, null, 2);
}

// --- Opening ---

// The plan in `text`, a plan file's text, checked in the order of plan-file.md section 3. Its
// stages get new IDs, "1", "2", "3" … in the file's order. Throws on the first problem found,
// saying what's wrong and where, e.g. 'This file can't be opened: it has no stages; …'.
export function planFromText(text) {
  const file = readFile(text);
  checkFormatAndVersion(file);
  checkProperties(file);

  let plan = addComponents(emptyPlan().plan, file.components);
  const added = addStages(plan, file.stages);
  plan = addOperations(added.plan, file.operations, file.stages, added.newIds);
  const componentNames = file.components.map((component) => component.name);
  plan = addStartingContents(plan, file.startingContents, componentNames);
  plan = addTipChanges(plan, file.tipChanges, file.stages, added.newIds);
  plan = withPlace("labels", () => setLabels(plan, file.labwareLabels));
  return withExperimentName(plan, file);
}

// --- Helpers used only inside this module ---

// Check 1: the object in `text`. Throws if `text` isn't JSON, or holds something other than an
// object (such as a list).
function readFile(text) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    // JSON.parse throws for anything that isn't JSON; the message below covers it.
    file = undefined;
  }
  if (!isObject(file)) {
    refuse("it isn't a plan file: its contents aren't the JSON a plan file holds.");
  }
  return file;
}

// Checks 2 and 3: throws if `file`'s format isn't PLAN_FILE_FORMAT, then if its version isn't one
// of VERSIONS_READ, saying whether a newer version of the tools saved it.
function checkFormatAndVersion(file) {
  if (file.format !== PLAN_FILE_FORMAT) {
    refuse("it isn't a transfer plan saved by this tool.");
  }
  const version = file.version;
  // Number.isInteger is false for anything that isn't a number (such as "2"), and for 1.5.
  if (Number.isInteger(version) && version > PLAN_FILE_VERSION) {
    refuse(
      `it was saved by a newer version of the tools (plan format ${version}). ` +
        "Open it with that version or a later one.",
    );
  }
  if (!VERSIONS_READ.includes(version)) {
    refuse(`its plan format version, ${describeValue(version)}, isn't one this tool knows.`);
  }
}

// The properties a plan file of `version` (one of VERSIONS_READ) holds, in the order they are
// written: a version 1 file has all but the ones version 2 added, e.g. propertiesOfVersion(1) has
// no "experimentName".
function propertiesOfVersion(version) {
  if (version === 1) {
    return FILE_PROPERTIES.filter((property) => !VERSION_2_PROPERTIES.includes(property));
  }
  return FILE_PROPERTIES;
}

// Check 4: throws if `file` is missing a property of its version (all of them are listed), has one
// a plan file of its version doesn't have (all of them are listed), or has a list or object property
// of the wrong kind.
function checkProperties(file) {
  const properties = propertiesOfVersion(file.version);
  const required = properties.filter((property) => !OPTIONAL_PROPERTIES.includes(property));
  const missing = findMissingProperties(file, required);
  if (missing.length > 0) {
    refuse(`it's missing ${listNames(missing)}.`);
  }
  const extras = findExtraProperties(file, properties);
  if (extras.length > 0) {
    refuse(`it has ${listNames(extras)}, which a plan file doesn't have.`);
  }
  for (const property of LIST_PROPERTIES) {
    if (!Array.isArray(file[property])) {
      refuse(`${describeValue(property)} must be a list.`);
    }
  }
  for (const property of OBJECT_PROPERTIES) {
    if (!isObject(file[property])) {
      refuse(`${describeValue(property)} must be an object.`);
    }
  }
}

// Check 5: returns the plan with each of `components` added in turn, as addComponent adds it.
// Throws if one isn't an object with exactly a name and a color, or its name isn't a name, or
// addComponent refuses it.
function addComponents(plan, components) {
  let planSoFar = plan;
  for (const [index, component] of components.entries()) {
    const place = `component ${index + 1}`;
    if (!hasExactly(component, ["name", "color"])) {
      refuse(`${place} must be an object with exactly "name" and "color".`);
    }
    planSoFar = withPlace(place, () => {
      // addComponent trims a name; checking it first refuses spaces at the ends instead, so the
      // name always matches the names in the starting contents.
      checkName(component.name, "component name");
      return addComponent(planSoFar, component.name, component.color);
    });
  }
  return planSoFar;
}

// Check 6: returns { plan, newIds }: the plan with `stages` in the file's order, each with its name
// and settings, and a Map from each stage's ID in the file to its new ID, e.g. "5" → "2". The empty
// plan's own stage becomes the first. Throws if there are no stages, or a stage's form or ID is
// wrong, or the stage list refuses its name or settings.
function addStages(plan, stages) {
  if (stages.length === 0) {
    refuse("it has no stages; a plan always has at least one.");
  }
  let planSoFar = plan;
  const newIds = new Map();
  for (const [index, stage] of stages.entries()) {
    checkStageEntry(stages, index);
    let id = stageOrder(planSoFar)[0];
    if (index > 0) {
      ({ plan: planSoFar, id } = addStage(planSoFar, null));
    }
    // The stage list checks the name, then the settings.
    planSoFar = withPlace(`stage ${index + 1}`, () =>
      changeStageSettings(renameStage(planSoFar, id, stage.name), id, stage.settings),
    );
    newIds.set(stage.id, id);
  }
  return { plan: planSoFar, newIds };
}

// Throws if the stage at `index` in `stages` isn't an object with exactly an ID, a name and
// settings, or its ID isn't a name, is "start", or is an earlier stage's ID.
function checkStageEntry(stages, index) {
  const stage = stages[index];
  const place = index + 1;
  if (!hasExactly(stage, ["id", "name", "settings"])) {
    refuse(`stage ${place} must be an object with exactly "id", "name" and "settings".`);
  }
  withPlace(`stage ${place}`, () => checkName(stage.id, "stage ID"));
  if (stage.id === START) {
    refuse(`stage ${place} has the ID "start", which is kept for the tips at the start of the run.`);
  }
  // The earlier stages are already checked, so each is an object with an id.
  const firstWithId = stages.findIndex((other) => other.id === stage.id);
  if (firstWithId < index) {
    refuse(`stages ${firstWithId + 1} and ${place} both have the ID ${describeValue(stage.id)}.`);
  }
}

// Check 7: returns the plan with each of `operations` added in turn, its stage changed to the new
// ID in `newIds`. Throws, for each transfer in turn, if the operation list refuses it (its form,
// then the stage rule), a well isn't on the deck, its stage isn't one of `stages`, or it breaks
// the order of the stages' transfers.
function addOperations(plan, operations, stages, newIds) {
  const fileIds = stages.map((stage) => stage.id);
  // An operation list using the file's own stage IDs, only for checking: its checks run before
  // the deck's and the stage's, as section 3 says, and its messages name the file's IDs, which the
  // user can find in the file.
  let checkedList = new OperationList();
  const stagesSeen = new Set();
  let planSoFar = plan;
  for (const [index, operation] of operations.entries()) {
    const place = `transfer ${index + 1}`;
    withPlace(place, () => {
      checkedList = checkedList.add(operation);
      checkWell(operation.source);
      checkWell(operation.destination);
    });
    if (!newIds.has(operation.stage)) {
      refuse(
        `${place} is in stage ${describeValue(operation.stage)}, which isn't one of the file's stages.`,
      );
    }
    if (index > 0) {
      checkStageBlocks(operations, index, fileIds, stagesSeen);
    }
    stagesSeen.add(operation.stage);
    planSoFar = withPlace(place, () =>
      addTransfer(planSoFar, { ...operation, stage: newIds.get(operation.stage) }),
    );
  }
  return planSoFar;
}

// Throws if the transfer at `index` in `operations` (counting from 0, and not the first) starts a
// stage's transfers again after another stage's (`stagesSeen` holds the stages of the transfers
// before it), or starts a stage that comes before the previous transfer's stage in `fileIds`, the
// file's stage order. The previous transfer's stage is the latest of the earlier ones in the stage
// order, since every earlier stage change passed this check, so comparing with it is enough.
function checkStageBlocks(operations, index, fileIds, stagesSeen) {
  const stage = operations[index].stage;
  const previous = operations[index - 1].stage;
  if (stage === previous) {
    return;
  }
  if (stagesSeen.has(stage)) {
    refuse(
      `stage ${describeValue(stage)}'s transfers aren't together: transfer ${index} is in stage ` +
        `${describeValue(previous)}, between transfers of stage ${describeValue(stage)}.`,
    );
  }
  if (fileIds.indexOf(stage) < fileIds.indexOf(previous)) {
    refuse(
      `transfer ${index + 1} is in stage ${describeValue(stage)}, which comes before stage ` +
        `${describeValue(previous)} in the stages, but after transfers of stage ${describeValue(previous)}.`,
    );
  }
}

// Check 8: returns the plan with `startingContents` as its starting contents, in the file's order.
// Throws if contents-tracking refuses them as a whole (so a well listed twice is refused before
// anything is built); then, for each entry in turn, if its well isn't on the deck, it holds a
// component not in `componentNames`, it has a volume of 0, or it holds nothing.
function addStartingContents(plan, startingContents, componentNames) {
  // Replaying no operations runs only contents-tracking's checks of the starting contents.
  withPlace("starting contents", () => replay(startingContents, new OperationList()));
  let planSoFar = plan;
  for (const [index, entry] of startingContents.entries()) {
    const place = `starting contents, entry ${index + 1}`;
    withPlace(place, () => checkWell(entry));
    const components = Object.entries(entry.components);
    for (const [name] of components) {
      if (!componentNames.includes(name)) {
        refuse(`${place}, holds ${describeValue(name)}, which isn't one of the file's components.`);
      }
    }
    // The tool never writes a 0 or a well holding nothing (addToWells adds only volumes above 0,
    // and an emptied well is left out), so they're refused rather than tidied.
    for (const [name, volume] of components) {
      if (volume === 0) {
        refuse(`${place}, has 0 µL of ${describeValue(name)}; a well lists only what it holds.`);
      }
    }
    if (components.length === 0) {
      refuse(`${place}, holds nothing; a well that holds nothing is left out.`);
    }
    // Each well is listed once, so each new well goes last, with its components in order: the
    // plan's starting contents end up as the file's.
    const well = { labware: entry.labware, well: entry.well };
    for (const [name, volume] of components) {
      planSoFar = withPlace(place, () => addToWells(planSoFar, [well], name, volume));
    }
  }
  return planSoFar;
}

// Check 9: returns the plan with `tipChanges`, each keyed by START or a stage's ID in the file,
// which `newIds` turns into its new ID. Throws if there's none at START; then, for each tip change
// in turn, if its key isn't one of `stages` or is the first, it isn't an object with exactly a tip
// type, or its tip type isn't in TIP_TYPES.
function addTipChanges(plan, tipChanges, stages, newIds) {
  if (!Object.hasOwn(tipChanges, START)) {
    refuse("it has no tips at the start of the run.");
  }
  let planSoFar = plan;
  for (const [key, tipChange] of Object.entries(tipChanges)) {
    if (key !== START) {
      checkTipChangeKey(key, stages, newIds);
    }
    if (!hasExactly(tipChange, ["tipType"])) {
      refuse(`the tip change at ${describeValue(key)} must be an object with exactly "tipType".`);
    }
    const tipType = tipChange.tipType;
    if (!TIP_TYPES.includes(tipType)) {
      refuse(
        `the tip change at ${describeValue(key)} loads ${describeValue(tipType)}, ` +
          `which isn't one of ${listNames(TIP_TYPES)}.`,
      );
    }
    planSoFar = withPlace(`the tip change at ${describeValue(key)}`, () => {
      if (key === START) {
        return setTipType(planSoFar, START, tipType);
      }
      const id = newIds.get(key);
      return setTipType(addTipChange(planSoFar, id), id, tipType);
    });
  }
  return planSoFar;
}

// Throws if `key`, a tip change's key other than START, isn't one of `stages` (whose IDs are the
// keys of `newIds`), or is the first of them, which always starts with the START tips.
function checkTipChangeKey(key, stages, newIds) {
  if (!newIds.has(key)) {
    refuse(`a tip change is before stage ${describeValue(key)}, which isn't one of the file's stages.`);
  }
  if (key === stages[0].id) {
    refuse(
      `a tip change is before stage ${describeValue(key)}, the first stage, ` +
        `which always starts with the tips at "start".`,
    );
  }
}

// Check 11: returns the plan with the file's experiment name. A version 1 file has none, so the
// plan keeps the empty plan's "". For a version 2 file, the name must be "" (no name) or one
// checkExperimentName accepts, and is then set with setExperimentName. It's never tidied: a name
// with a space at an end is refused by checkExperimentName here, though setExperimentName on its
// own would trim it.
function withExperimentName(plan, file) {
  if (file.version === 1) {
    return plan;
  }
  const name = file.experimentName;
  return withPlace("the experiment name", () => {
    if (name !== "") {
      checkExperimentName(name);
    }
    return setExperimentName(plan, name);
  });
}

// True if `value` is an object with exactly the `properties` named, none missing and none extra,
// e.g. hasExactly({ tipType: "BC230" }, ["tipType"]) → true.
function hasExactly(value, properties) {
  return (
    isObject(value) &&
    findMissingProperties(value, properties).length === 0 &&
    findExtraProperties(value, properties).length === 0
  );
}

// Returns what `action` returns; if it throws, throws instead its message after CANT_OPEN and
// `place`, e.g. withPlace("transfer 3", …) → "This file can't be opened: transfer 3: There's no
// labware …". Used for the checks of other modules, whose messages pass through unchanged.
function withPlace(place, action) {
  try {
    return action();
  } catch (error) {
    throw new Error(`${CANT_OPEN}${place}: ${error.message}`);
  }
}

// Throws the message for a problem plan-file finds itself: `problem` after CANT_OPEN,
// e.g. refuse("it has no tips at the start of the run.").
function refuse(problem) {
  throw new Error(`${CANT_OPEN}${problem}`);
}
