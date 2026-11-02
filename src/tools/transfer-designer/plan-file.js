// plan-file.js — turns a plan into the text of a plan file, and a plan file's text back into a plan
// (ADR 0010). It is the only module that knows what a plan file holds.
//
// The text is JSON, so a plan file can be read in any text editor. Opening a file is strict: it
// checks everything in it, using the transfer designer's own rules, and refuses anything the tool
// would never write rather than tidying it. The plan is built from an empty plan through the
// transfer designer's own edits, so a plan made from a file is as valid as one made by editing, and
// a file that fails any check isn't opened in part.
// It writes format version 7, which holds each component's constituents, the randomizations and
// the well labels, each stage's settings hold its mixes and each tip change its probes. It still
// reads version 6 files (components without constituents), version 5 files (also no
// randomizations), version 4 files (also no well labels), version 3 files (also no mixes), version
// 2 files (also probes in each stage's settings) and version 1 files (also without an experiment
// name). Their components carry nothing and their stages get no mixing, since plans couldn't do
// either then; in versions 1 and 2, their tip changes get every probe their stages used, which is
// where look-ahead loading put tips.
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
  setTipProbes,
  setLabels,
  setWellLabels,
  setRandomizations,
  setExperimentName,
  setConstituents,
} from "./transfer-designer.js";

// The format name every plan file holds, so a file can be recognized as one.
export const PLAN_FILE_FORMAT = "biomek-tools transfer plan";

// The format version written. It goes up only when what a plan file holds changes, not with every
// release of the tools (ADR 0010). Changing it means changing how files are read, so it isn't in
// config/. Version 2 (2026-10-28) added the experiment name; version 3 (2026-10-30) moved probes
// from the stages to the tip changes (ADR 0007, "Tip changes"); version 4 (2026-10-30) added each
// stage's mixes (ADR 0007, "Mixing"); version 5 (2026-11-01) added the well labels; version 6
// (2026-11-01) added the randomizations (ADR 0012); version 7 (2026-11-01) added each component's
// constituents (ADR 0013).
export const PLAN_FILE_VERSION = 7;

// The versions this module can read: the one it writes, version 6 (plans saved on 2026-11-01, before
// constituents), version 5 (plans saved on 2026-11-01, before randomizations), version 4 (plans saved
// from 2026-10-30 to 2026-11-01, before well labels), version 3 (plans saved on 2026-10-30, before
// mixing), version 2 (plans saved from 2026-10-28 to 2026-10-30) and version 1 (plans saved before
// 2026-10-28).
const VERSIONS_READ = [PLAN_FILE_VERSION, 6, 5, 4, 3, 2, 1];

// The first version whose components hold their constituents. An older file's components are
// { name, color } only, and open carrying nothing.
const FIRST_VERSION_WITH_CONSTITUENTS = 7;

// A component's properties in a file: name and color, plus constituents from version 7.
const COMPONENT_PROPERTIES = ["name", "color"];
const COMPONENT_PROPERTIES_WITH_CONSTITUENTS = [...COMPONENT_PROPERTIES, "constituents"];

// The versions in which each stage's settings hold its probes, and a tip change is { tipType } only.
const VERSIONS_WITH_STAGE_PROBES = [1, 2];

// The versions whose stages' settings hold no mixes, because plans couldn't mix before version 4.
const VERSIONS_WITHOUT_MIXES = [1, 2, 3];

// The settings that hold a stage's mixes (stage-list.md), in the order of the stage list's settings
// table: an older file's stages can't hold them, and get them as null.
const MIX_SETTINGS = ["sourceMix", "destinationMix"];

// A plan file's properties, in the order they are written (plan-file.md, section 3). Versions 6 and
// 7 have all of them: version 7's change is inside each component.
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
  "wellLabels",
  "randomizations",
];

// The properties version 2 added. A version 1 file has neither these nor version 5's.
const VERSION_2_PROPERTIES = ["experimentName"];

// The properties version 5 added. A version 1 to 4 file can't have these.
const VERSION_5_PROPERTIES = ["wellLabels"];

// The properties version 6 added. A version 1 to 5 file can't have these.
const VERSION_6_PROPERTIES = ["randomizations"];

// savedBy is for information only, so a file may leave it out.
const OPTIONAL_PROPERTIES = ["savedBy"];

// The properties that hold lists, and those that hold objects.
const LIST_PROPERTIES = ["components", "startingContents", "stages", "operations", "randomizations"];
const OBJECT_PROPERTIES = ["tipChanges", "labwareLabels", "wellLabels"];

// How every message from planFromText starts.
const CANT_OPEN = "This file can't be opened: ";

// Every property of a randomization, as setRandomizations takes them (transfer-designer.md,
// section 3), so a randomization missing one is refused with setRandomizations' form message.
const RANDOMIZATION_PROPERTIES = [
  "id",
  "beforeId",
  "sources",
  "fill",
  "seed",
  "volume",
  "settings",
  "tipType",
  "probes",
  "stages",
];

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
    wellLabels: plan.wellLabels,
    randomizations: plan.randomizations,
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

  let plan = addComponents(emptyPlan().plan, file.components, file.version);
  const added = addStages(plan, file.stages, file.version);
  plan = addOperations(added.plan, file.operations, file.stages, added.newIds);
  const componentNames = file.components.map((component) => component.name);
  plan = addStartingContents(plan, file.startingContents, componentNames);
  plan = addTipChanges(plan, file, added.newIds, added.stageProbes);
  plan = withPlace("labels", () => setLabels(plan, file.labwareLabels));
  plan = withExperimentName(plan, file);
  plan = withWellLabels(plan, file);
  return withRandomizations(plan, file, added.newIds);
}

// True if a file of `version` (one of VERSIONS_READ) keeps each stage's probes in its settings, and
// its tip changes without probes, as every file did before 2026-10-30.
function hasStageProbes(version) {
  return VERSIONS_WITH_STAGE_PROBES.includes(version);
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
// written: a version 1 to 5 file has all but the ones version 6 added, a version 1 to 4 file also
// lacks the ones version 5 added, and a version 1 file also lacks the ones version 2 added, e.g.
// propertiesOfVersion(1) has no "experimentName", "wellLabels" or "randomizations". Versions 3 and 4
// added no property: version 3 moved probes from the stages to the tip changes, and version 4 added
// mixes inside each stage's settings.
function propertiesOfVersion(version) {
  let properties = FILE_PROPERTIES;
  if (version < 6) {
    properties = properties.filter((property) => !VERSION_6_PROPERTIES.includes(property));
  }
  if (version < 5) {
    properties = properties.filter((property) => !VERSION_5_PROPERTIES.includes(property));
  }
  if (version === 1) {
    properties = properties.filter((property) => !VERSION_2_PROPERTIES.includes(property));
  }
  return properties;
}

// Check 4: throws if `file` is missing a property of its version (all of them are listed), has one
// a plan file of its version doesn't have (all of them are listed), or has a list or object property
// of its version of the wrong kind.
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
  // Only the list properties the file's version has: an older file has no "randomizations".
  for (const property of LIST_PROPERTIES.filter((name) => properties.includes(name))) {
    if (!Array.isArray(file[property])) {
      refuse(`${describeValue(property)} must be a list.`);
    }
  }
  // Only the object properties the file's version has: an older file has no "wellLabels".
  for (const property of OBJECT_PROPERTIES.filter((name) => properties.includes(name))) {
    if (!isObject(file[property])) {
      refuse(`${describeValue(property)} must be an object.`);
    }
  }
}

// Check 5: returns the plan with each of `components` added in turn, as addComponent adds it, and,
// in a file of `version` whose components hold constituents, its constituents set as setConstituents
// sets them. Throws if one isn't an object with exactly its version's properties, or its name isn't
// a name, or addComponent refuses it, or (from version 7) a constituent's name has spaces at its
// ends, or setConstituents refuses the constituents.
function addComponents(plan, components, version) {
  const withConstituents = version >= FIRST_VERSION_WITH_CONSTITUENTS;
  const properties = withConstituents ? COMPONENT_PROPERTIES_WITH_CONSTITUENTS : COMPONENT_PROPERTIES;
  let planSoFar = plan;
  for (const [index, component] of components.entries()) {
    const place = `component ${index + 1}`;
    if (!hasExactly(component, properties)) {
      refuse(`${place} must be an object with exactly ${listNamesWithAnd(properties)}.`);
    }
    planSoFar = withPlace(place, () => {
      // addComponent trims a name; checking it first refuses spaces at the ends instead, so the
      // name always matches the names in the starting contents.
      checkName(component.name, "component name");
      const added = addComponent(planSoFar, component.name, component.color);
      if (!withConstituents) {
        return added;
      }
      checkConstituentNamesUntrimmed(component.constituents);
      return setConstituents(added, component.name, component.constituents);
    });
  }
  return planSoFar;
}

// Throws, with checkName's message, if a constituent in `constituents` has a name with spaces at
// its ends: setConstituents would trim it, and a file is never tidied. Only entries that are
// objects with a text name are checked, over the whole list first; anything else (a list that isn't
// one, an entry that isn't an object, a name that isn't text) is left to setConstituents, whose
// messages say what's wrong.
function checkConstituentNamesUntrimmed(constituents) {
  if (!Array.isArray(constituents)) {
    return;
  }
  for (const constituent of constituents) {
    if (isObject(constituent) && typeof constituent.name === "string") {
      checkName(constituent.name, "constituent name");
    }
  }
}

// `names` in quotes, separated by commas, with "and" before the last, as a message lists an object's
// exact properties, e.g. ["name", "color", "constituents"] → '"name", "color" and "constituents"'.
function listNamesWithAnd(names) {
  if (names.length === 1) {
    return listNames(names);
  }
  return `${listNames(names.slice(0, -1))} and ${describeValue(names.at(-1))}`;
}

// Check 6: returns { plan, newIds, stageProbes }: the plan with `stages` in the file's order, each
// with its name and settings; a Map from each stage's ID in the file to its new ID, e.g. "5" → "2";
// and, for a file of `version` whose stages hold probes (hasStageProbes), a Map from each stage's ID
// in the file to its probes, for its tip change (addTipChanges). The empty plan's own stage becomes
// the first. In a file of a version without mixes, each stage gets sourceMix and destinationMix
// null. Throws if there are no stages, or a stage's form or ID is wrong, or the stage list refuses
// its name or settings, or (in an older file) its settings have no probes or bad ones, or hold a
// mix.
function addStages(plan, stages, version) {
  if (stages.length === 0) {
    refuse("it has no stages; a plan always has at least one.");
  }
  let planSoFar = plan;
  const newIds = new Map();
  const stageProbes = new Map();
  for (const [index, stage] of stages.entries()) {
    checkStageEntry(stages, index);
    const place = `stage ${index + 1}`;
    let id = stageOrder(planSoFar)[0];
    if (index > 0) {
      ({ plan: planSoFar, id } = addStage(planSoFar, null));
    }
    // The stage list checks the name first, then the settings.
    planSoFar = withPlace(place, () => renameStage(planSoFar, id, stage.name));
    let settings = stage.settings;
    if (hasStageProbes(version) && isObject(settings)) {
      stageProbes.set(stage.id, checkStageProbes(planSoFar, settings, index, version));
      // The stage list refuses probes as an extra setting, so they're taken out first.
      const { probes, ...rest } = settings;
      settings = rest;
    }
    if (VERSIONS_WITHOUT_MIXES.includes(version) && isObject(settings)) {
      settings = withoutMixing(settings, index, version);
    }
    planSoFar = withPlace(place, () => changeStageSettings(planSoFar, id, settings));
    newIds.set(stage.id, id);
  }
  return { plan: planSoFar, newIds, stageProbes };
}

// Returns the probes in `settings`, the settings of the stage at `index` in an older file (of
// `version`), smallest first. Throws if there are none, or they aren't probes as setTipProbes
// checks them: it's used only to check them, on the START tips of `plan` (which the file's own
// tip changes replace later), so a file's probes are checked by the same rule as the plan's.
function checkStageProbes(plan, settings, index, version) {
  const place = `stage ${index + 1}`;
  if (!Object.hasOwn(settings, "probes")) {
    refuse(
      `${place}'s settings are missing "probes", which a version ${version} file's stages have.`,
    );
  }
  const checked = withPlace(place, () => setTipProbes(plan, START, settings.probes));
  return checked.tipChanges[START].probes;
}

// Returns `settings`, the settings of the stage at `index` in a file of `version` from before
// mixing, with sourceMix and destinationMix null, so the stage doesn't mix, e.g.
// { sourceTechnique: …, … } → { sourceTechnique: …, …, sourceMix: null, destinationMix: null }.
// Throws if they already hold either, naming the first in the stage list's order: the tool never
// wrote a mix in such a file, so it's refused rather than dropped.
function withoutMixing(settings, index, version) {
  const mixSetting = MIX_SETTINGS.find((setting) => Object.hasOwn(settings, setting));
  if (mixSetting !== undefined) {
    refuse(
      `stage ${index + 1}'s settings have ${describeValue(mixSetting)}, ` +
        `which a version ${version} file's stages don't have.`,
    );
  }
  return { ...settings, sourceMix: null, destinationMix: null };
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

// Check 9: returns the plan with the file's tip changes, each keyed by START or a stage's ID in the
// file, which `newIds` turns into its new ID. In a version 3 to 7 file each holds its tip type and
// probes; in an older file each holds only its tip type, and gets every probe its stages used
// (`stageProbes`, from addStages), which is where look-ahead loading put tips. Throws if there's
// none at START; then, for each tip change in turn, if its key isn't one of the file's stages or is
// the first, it isn't an object with exactly its version's properties, its tip type isn't in
// TIP_TYPES, or its probes are refused by setTipProbes.
function addTipChanges(plan, file, newIds, stageProbes) {
  const { tipChanges, stages } = file;
  if (!Object.hasOwn(tipChanges, START)) {
    refuse("it has no tips at the start of the run.");
  }
  const olderFile = hasStageProbes(file.version);
  const properties = olderFile ? ["tipType"] : ["tipType", "probes"];
  const propertiesText = olderFile ? '"tipType"' : '"tipType" and "probes"';
  let planSoFar = plan;
  for (const [key, tipChange] of Object.entries(tipChanges)) {
    const place = `the tip change at ${describeValue(key)}`;
    if (key !== START) {
      checkTipChangeKey(key, stages, newIds);
    }
    if (!hasExactly(tipChange, properties)) {
      refuse(`${place} must be an object with exactly ${propertiesText}.`);
    }
    const tipType = tipChange.tipType;
    if (!TIP_TYPES.includes(tipType)) {
      refuse(`${place} loads ${describeValue(tipType)}, which isn't one of ${listNames(TIP_TYPES)}.`);
    }
    const probes = olderFile ? probesUsedAfter(key, stages, tipChanges, stageProbes) : tipChange.probes;
    planSoFar = withPlace(place, () => {
      const id = key === START ? START : newIds.get(key);
      const added = key === START ? planSoFar : addTipChange(planSoFar, id);
      return setTipProbes(setTipType(added, id, tipType), id, probes);
    });
  }
  return planSoFar;
}

// Every probe used by the stages of the tip change at `key` in an older file: from that tip
// change's stage (the first of `stages` for START) up to the stage with the next tip change, in the
// file's stage order, each once, smallest first, e.g. stages using [1, 2] and [1, 2, 3, 4] →
// [1, 2, 3, 4]. `stageProbes` holds each stage's probes by its ID in the file.
function probesUsedAfter(key, stages, tipChanges, stageProbes) {
  const ids = stages.map((stage) => stage.id);
  const from = key === START ? 0 : ids.indexOf(key);
  const nextChange = ids.findIndex((id, index) => index > from && Object.hasOwn(tipChanges, id));
  const groupIds = ids.slice(from, nextChange === -1 ? ids.length : nextChange);
  const probes = new Set(groupIds.flatMap((id) => stageProbes.get(id)));
  // sort() on its own compares as text; this compares numbers.
  return [...probes].sort((a, b) => a - b);
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
// plan keeps the empty plan's "". For a later file, the name must be "" (no name) or one
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

// Check 12: returns the plan with the file's well labels, set all at once with setWellLabels, which
// is strict: a label with spaces at its ends, a blank one, or a labware listed with no wells is
// refused, not tidied. A version 1 to 4 file has none, so the plan keeps the empty plan's {}.
function withWellLabels(plan, file) {
  if (file.version < 5) {
    return plan;
  }
  return withPlace("well labels", () => setWellLabels(plan, file.wellLabels));
}

// Check 13: returns the plan with the file's randomizations. First just enough of their form to
// renumber them (checkRenumberableForm); then every stage they name must be
// one of the file's stages. Their stage IDs are changed to the new ones in `newIds`, and they're
// checked and set all at once by setRandomizations. A version 1 to 5 file has none, so the plan keeps
// the empty plan's [].
function withRandomizations(plan, file, newIds) {
  if (file.version < 6) {
    return plan;
  }
  const randomizations = file.randomizations;
  randomizations.forEach(checkRenumberableForm);
  randomizations.forEach((randomization, index) => {
    for (const stage of stagesNamedBy(randomization)) {
      if (!newIds.has(stage)) {
        refuse(
          `randomization ${index + 1} names stage ${describeValue(stage)}, which isn't one of the ` +
            "file's stages.",
        );
      }
    }
  });
  const renumbered = randomizations.map((randomization) => ({
    ...randomization,
    beforeId: randomization.beforeId === null ? null : newIds.get(randomization.beforeId),
    stages: randomization.stages.map((owned) => ({ ...owned, stage: newIds.get(owned.stage) })),
  }));
  return withPlace("randomizations", () => setRandomizations(plan, renumbered));
}

// Throws if the randomization at `index` hasn't just enough form for its stage IDs to be renumbered
// (an object with exactly its properties; its beforeId text or null; its stages a list of objects,
// each with a stage that's text), with setRandomizations' message for that form, which it would
// give for the file as it is.
function checkRenumberableForm(randomization, index) {
  const number = index + 1;
  if (!hasExactly(randomization, RANDOMIZATION_PROPERTIES)) {
    refuse(
      `randomizations: Randomization ${number} must be an object with exactly ` +
        `${listNames(RANDOMIZATION_PROPERTIES.slice(0, -1))} and ` +
        `${describeValue(RANDOMIZATION_PROPERTIES.at(-1))}.`,
    );
  }
  const { beforeId, stages } = randomization;
  if (beforeId !== null && typeof beforeId !== "string") {
    refuse(
      `randomizations: Randomization ${number}: There's no stage ${describeValue(beforeId)} ` +
        "to add a randomization before.",
    );
  }
  if (!Array.isArray(stages) || !stages.every((owned) => isObject(owned) && typeof owned.stage === "string")) {
    refuse(
      `randomizations: Randomization ${number}: its stages must be a list of objects with ` +
        'exactly "labware", "well" and "stage".',
    );
  }
}

// The stage IDs a randomization in a file names, in order: its beforeId (unless null), then each of
// its stages', e.g. ["7", "2", "5"].
function stagesNamedBy(randomization) {
  const named = randomization.beforeId === null ? [] : [randomization.beforeId];
  return [...named, ...randomization.stages.map((owned) => owned.stage)];
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
