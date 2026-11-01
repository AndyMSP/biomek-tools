// transfer-designer.js — the transfer designer's rules: what a plan is, and every edit that can be
// made to one, each checked so that a plan is always valid.
//
// A plan holds the components, the starting contents, the operation list, the stage list, the stage
// order (a list of stage IDs; ADR 0011), the tip changes, the labware labels, the well labels, the
// randomizations (each owning the stages it made; ADR 0012) and the experiment name. A stage is a
// transfer stage or a mix step, which only mixes its wells, each a transfer from the well into
// itself. A plan is never changed after it's made: every edit returns a new plan that shares every
// part the edit didn't change, so the plan history can keep many plans cheaply. The page shows a
// plan and passes on what the user does; every rule about what that means lives here, so it can be
// tested in Node.
// It builds on the shared modules (operation-list, stage-list, contents-tracking, mix-volumes, deck)
// and doesn't repeat what they do.
// Specification: transfer-designer.md.

import { PIPETTING_MODES, DEFAULT_PIPETTING_MODE } from "../../../config/pipetting-modes.js";
import { TIP_TYPES, DEFAULT_PROBE_COUNT } from "../../../config/tip-types.js";
import {
  DEFAULT_MIX as CONFIGURED_DEFAULT_MIX,
  MIX_STEP_MODE,
  MIX_STEP_VOLUME,
} from "../../../config/mixing.js";
import { describeValue } from "../../shared/error-messages/error-messages.js";
import {
  isObject,
  listNames,
  checkName,
  findMissingProperties,
  findExtraProperties,
} from "../../shared/input-checks/input-checks.js";
import { OperationList } from "../../shared/operation-list/operation-list.js";
import { StageList } from "../../shared/stage-list/stage-list.js";
import { replay } from "../../shared/contents-tracking/contents-tracking.js";
import { mixVolumes } from "../../shared/mix-volumes/mix-volumes.js";
import { labwareNames, gridOf, checkWell } from "../../shared/deck/deck.js";
import { START, tipGroups } from "../../shared/tip-groups/tip-groups.js";
import { checkExperimentName } from "../../shared/file-writer/file-writer.js";
import { assignPool, findPoolProblems, MAX_SEED } from "../../shared/random-pool/random-pool.js";

// START and tipGroups live in the tip-groups shared module, which the file writer uses too. They're
// re-exported (passed on under the same names) so the page and plan-file.js can keep importing them
// from here (transfer-designer.md, section 4; tip-groups.md).
export { START, tipGroups };

// The mix an end gets when a tool switches its mixing on, from config/mixing.js, e.g.
// { share: 90, times: 3, speed: 400 }. Re-exported, frozen, so a tool takes all the transfer
// designer's configuration from here and can't change the default by accident
// (transfer-designer.md, "Mixing"). A copy is frozen, leaving the config file's own object as it is.
export const DEFAULT_MIX = Object.freeze({ ...CONFIGURED_DEFAULT_MIX });

// What a new stage is called. Not numbered: a number stopped matching the stage's place once a
// stage was inserted before it (Andy, 2026-10-25).
export const NEW_STAGE_NAME = "New stage";

// What a new mix step is called (transfer-designer.md, "Mix steps").
export const NEW_MIX_STEP_NAME = "New mix step";

// The two kinds of stage addStageOfKind adds: each one's name, whether a stage's settings are of
// that kind, and the settings when there's none of that kind to copy. They're functions declared
// below, which JavaScript makes available before this line runs.
const TRANSFER_STAGE_KIND = {
  name: NEW_STAGE_NAME,
  isOfKind: (settings) => !isMixStepSettings(settings),
  defaults: defaultSettings,
};
const MIX_STEP_KIND = {
  name: NEW_MIX_STEP_NAME,
  isOfKind: isMixStepSettings,
  defaults: defaultMixStepSettings,
};

// The Span-8 has probes 1 to 8, numbered as in Biomek Software. It's a fact about the instrument,
// not a setting that might change, so it lives here rather than in config/.
const PROBE_COUNT = 8;

// The two ends of a stage, as setStageMix takes them.
const ENDS = ["source", "destination"];

// --- Plans ---

// A new plan, and the ID of its one stage: { plan, stageId }. The plan has no components, starting
// contents, transfers, labels, well labels or randomizations, and no experiment name (""); its stage is called NEW_STAGE_NAME
// and has the default settings; and its first tips are the first tip type in config/tip-types.js,
// on the first DEFAULT_PROBE_COUNT probes (Andy, 2026-10-30).
export function emptyPlan() {
  const { stageList, id } = new StageList().add(NEW_STAGE_NAME, defaultSettings());
  const plan = deepFreeze({
    components: [],
    startingContents: [],
    operationList: new OperationList(),
    stageList,
    stageOrder: [id],
    tipChanges: { [START]: { tipType: TIP_TYPES[0], probes: probesFor(DEFAULT_PROBE_COUNT) } },
    labwareLabels: {},
    wellLabels: {},
    randomizations: [],
    experimentName: "",
  });
  return { plan, stageId: id };
}

// Returns the plan with its experiment called `name`, with spaces at its ends removed; "" (or only
// spaces) gives the plan no name. Giving the name it already has returns the plan unchanged.
// Throws if `name` isn't text, or isn't a valid experiment name by the file writer's rule
// (checkExperimentName: letters, digits, hyphens and underscores, 1 to 40 characters), with its
// message, e.g. setExperimentName(plan, "Exp 36") throws 'The experiment name can't contain " "
// (a space). …'. The rule is the file writer's so that a name the page accepts can always be
// written (file-writer.md).
export function setExperimentName(plan, name) {
  if (typeof name !== "string") {
    // checkExperimentName gives the message for a name that isn't text.
    checkExperimentName(name);
  }
  const trimmed = name.trim();
  // Only a blank name skips the check: checkExperimentName refuses a blank name, but here a blank
  // name means "no name", which every new plan starts with.
  if (trimmed !== "") {
    checkExperimentName(trimmed);
  }
  if (trimmed === plan.experimentName) {
    return plan;
  }
  return withParts(plan, { experimentName: trimmed });
}

// A stage's default settings: DEFAULT_PIPETTING_MODE at both ends, and no mixing, e.g.
// { sourceTechnique: "Operation", sourceLiquidType: "Medium", destinationTechnique: …,
//   destinationLiquidType: …, sourceMix: null, destinationMix: null }. A new object each time.
// Probes aren't a stage's: each tip change chooses them (ADR 0007, "Tip changes").
export function defaultSettings() {
  return {
    ...modeSettings("source", DEFAULT_PIPETTING_MODE),
    ...modeSettings("destination", DEFAULT_PIPETTING_MODE),
    sourceMix: null,
    destinationMix: null,
  };
}

// The first `count` probes, e.g. probesFor(4) → [1, 2, 3, 4]. A tip change chooses how many probes
// get tips, not which (Andy, 2026-10-24). Throws unless `count` is a whole number from 1 to 8.
export function probesFor(count) {
  // Number.isInteger is false for anything that isn't a number (such as "4") and for 2.5.
  if (!Number.isInteger(count) || count < 1 || count > PROBE_COUNT) {
    throw new Error(
      `The number of probes must be a whole number from 1 to ${PROBE_COUNT}, but got ${describeValue(count)}.`,
    );
  }
  // Array.from with a length makes a list of that many places; each gets its position plus 1.
  return Array.from({ length: count }, (_, position) => position + 1);
}

// --- Pipetting modes ---

// The pipetting modes usable at `end` ("source" or "destination"), in config/ order,
// e.g. modesFor("source") → the Fast, Medium and Slow modes.
export function modesFor(end) {
  return PIPETTING_MODES.filter((mode) => mode.ends.includes(end));
}

// The settings the mode called `name` gives at `end`, e.g. ("source", "Slow") →
// { sourceTechnique: "Operation", sourceLiquidType: "Slow" }. With `mixes` true, for an end that
// mixes, the technique is the mode's mixing one: ("source", "Slow", true) →
// { sourceTechnique: "OperationMix", sourceLiquidType: "Slow" }. Throws if there's no such mode for
// that end, naming the modes there are, then if `mixes` is true and the mode can't mix.
export function modeSettings(end, name, mixes = false) {
  const modes = modesFor(end);
  const mode = modes.find((candidate) => candidate.name === name);
  if (mode === undefined) {
    throw new Error(
      `${describeValue(name)} isn't a pipetting mode for the ${end}. ` +
        `The modes for the ${end} are ${listNames(modes.map((candidate) => candidate.name))}.`,
    );
  }
  if (mixes && mode.mixingTechnique === null) {
    throw new Error(
      `${mode.name} can't mix, so it can't be used at the ${end} while the ${end} mixes. ` +
        `Turn the ${end}'s mixing off first.`,
    );
  }
  const technique = mixes ? mode.mixingTechnique : mode.technique;
  return { [`${end}Technique`]: technique, [`${end}LiquidType`]: mode.liquidType };
}

// The name of the mode a stage's `settings` use at `end`, matching either of its techniques (with
// or without mixing), or null if their technique and liquid type there aren't one of the modes (for
// example, after the modes in config/ change), e.g. modeOf("source", defaultSettings()) → "Medium".
export function modeOf(end, settings) {
  const mode = modeAt(end, settings);
  return mode === undefined ? null : mode.name;
}

// --- Stages ---

// The stage IDs in stage order (docs/glossary.md, "Stage order"), with or without transfers,
// e.g. ["1", "3", "5", "2"]. The plan keeps them as its own list, the one source of truth for the
// order of stages (ADR 0011), so this just returns it.
export function stageOrder(plan) {
  return plan.stageOrder;
}

// Returns { plan, id }: the plan with a new transfer stage, called NEW_STAGE_NAME, just before stage
// `beforeId` (or last, for null), and the new stage's ID. All its settings, mixes included, are
// copied from the nearest transfer stage: the nearest before it in the stage order, or, with none
// before it, the nearest after it; with none at all, it has the default settings (Andy, 2026-10-30:
// a new stage copies the nearest stage of its own kind). With takeTips, a tip change before
// `beforeId` moves onto the new stage, so the new stage is the first to use those tips; without it,
// the new stage uses the tips before that tip change.
// e.g. addStage(plan, "2", { takeTips: true }).
export function addStage(plan, beforeId, { takeTips = false } = {}) {
  const { plan: added, id } = addStageOfKind(plan, beforeId, takeTips, TRANSFER_STAGE_KIND);
  return { plan: withRandomizationsAfterAdd(added, beforeId, id), id };
}

// Returns { plan, id }: the plan with a new mix step (docs/glossary.md), called NEW_MIX_STEP_NAME,
// just before stage `beforeId` (or last, for null), and its ID, as addStage does for a transfer
// stage. Its settings are copied from the nearest mix step, before it, else after it, or are the
// default mix step settings if the plan has none (transfer-designer.md, "Mix steps").
// e.g. addMixStep(plan, "3") puts a mix step just before stage 3.
export function addMixStep(plan, beforeId, { takeTips = false } = {}) {
  const { plan: added, id } = addStageOfKind(plan, beforeId, takeTips, MIX_STEP_KIND);
  return { plan: withRandomizationsAfterAdd(added, beforeId, id), id };
}

// Returns { plan, id }: the plan with a new transfer stage just before stage `beforeId` (or last, for
// null), as addStage adds it without takeTips, in a tip group of its own, and its ID, as one edit
// (transfer-designer.md, "Tip changes and tip groups"). Throws as addStage does.
// e.g. addStageWithNewTips(plan, "3"): the new stage, just before stage 3, gets a tip change
// loading the tips in use there, and so does stage 3 if it had none, keeping the tips it had.
export function addStageWithNewTips(plan, beforeId) {
  const { plan: added, id } = addStageOfKind(plan, beforeId, false, TRANSFER_STAGE_KIND);
  const withTips = withOwnTipGroup(added, id, beforeId);
  return { plan: withRandomizationsAfterAdd(withTips, beforeId, id), id };
}

// Returns { plan, id }: the same as addStageWithNewTips, for a new mix step (as addMixStep makes it).
// e.g. addMixStepWithNewTips(plan, null) puts a mix step last, on tips of its own.
export function addMixStepWithNewTips(plan, beforeId) {
  const { plan: added, id } = addStageOfKind(plan, beforeId, false, MIX_STEP_KIND);
  const withTips = withOwnTipGroup(added, id, beforeId);
  return { plan: withRandomizationsAfterAdd(withTips, beforeId, id), id };
}

// True if stage `id` is a mix step: its technique and liquid type are MIX_STEP_MODE's at both ends
// (transfer-designer.md, "Mix steps"). False for a transfer stage, or an ID that isn't a stage.
// e.g. isMixStep(plan, "2") → true.
export function isMixStep(plan, id) {
  return plan.stageList.has(id) && isMixStepSettings(plan.stageList.get(id).settings);
}

// Returns the plan with mix step `id` mixing each of `wells` (each { labware, well }, on the deck)
// that it doesn't mix yet, as one edit: each becomes a transfer from the well into itself of
// MIX_STEP_VOLUME (transfer-designer.md, "Mix steps"). Wells it mixes already, or listed twice, are
// left out; if that leaves none, the same plan is returned. Throws, in this order, if `id` isn't a
// mix step, `wells` isn't a list, or a well isn't on the deck (the first such well).
// e.g. mixWells(plan, "2", [{ labware: "Plate1", well: "A1" }, { labware: "Plate1", well: "A2" }]).
export function mixWells(plan, id, wells) {
  checkMixStep(plan, id);
  if (!Array.isArray(wells)) {
    throw new Error(
      `The wells to mix must be a list of wells, like [{ labware: "Plate1", well: "A1" }], ` +
        `but got ${describeValue(wells)}.`,
    );
  }
  wells.forEach((well) => checkWell(well));
  const mixed = new Set(transfersIn(plan, id).map((transfer) => wellKey(transfer.source)));
  const toMix = [];
  for (const well of wells) {
    const key = wellKey(well);
    if (!mixed.has(key)) {
      mixed.add(key);
      toMix.push(mixedWellTransfer(id, well));
    }
  }
  if (toMix.length === 0) {
    return plan;
  }
  return addTransfers(plan, toMix);
}

// Returns the plan without mix step `id`'s mixed well `well` ({ labware, well }), so it no longer
// mixes that well. Throws, in this order, if `id` isn't a mix step, `well` isn't an object, or the
// mix step doesn't mix `well`, e.g. 'Stage 2, “Mix plate”, doesn't mix Plate1 A2.'
export function unmixWell(plan, id, well) {
  checkMixStep(plan, id);
  if (!isObject(well)) {
    throw new Error(
      `The well to stop mixing must be a well, like { labware: "Plate1", well: "A1" }, ` +
        `but got ${describeValue(well)}.`,
    );
  }
  const key = wellKey(well);
  const mixedWell = transfersIn(plan, id).find((transfer) => wellKey(transfer.source) === key);
  if (mixedWell === undefined) {
    throw new Error(`${stageNamed(plan, id)}, doesn't mix ${well.labware} ${well.well}.`);
  }
  return removeTransfer(plan, mixedWell.position);
}

// Returns the plan with stage `id` called `name`. The stage list checks both.
export function renameStage(plan, id, name) {
  return withParts(plan, { stageList: plan.stageList.rename(id, name) });
}

// Returns the plan with stage `id`'s settings replaced by `settings`. The stage list checks both;
// then each end's technique must match its mixing, the source's first (checkMixingMatches), so a
// plan file can't bring in a stage whose technique Biomek would mix with when the plan says not to,
// or the reverse (transfer-designer.md, section 3, "Mixing"); then the mix step rules
// (checkMixStepSettings), so a plan file can't bring in a broken mix step either
// (transfer-designer.md, "Mix steps").
export function changeStageSettings(plan, id, settings) {
  const stageList = plan.stageList.changeSettings(id, settings);
  for (const end of ENDS) {
    checkMixingMatches(settings, end);
  }
  checkMixStepSettings(plan, id, settings);
  return withParts(plan, { stageList });
}

// Returns the plan with stage `id` mixing at `end` ("source" or "destination") as `mix`, a mix such
// as { share: 90, times: 3, speed: 400 } or null for no mixing, and that end's technique switched to
// its mode's mixing technique or its technique without mixing, keeping the liquid type, in one edit,
// e.g. setStageMix(plan, "2", "source", { share: 90, times: 3, speed: 400 }). If the end already
// has that mix, the same plan is returned. Throws, in this order, if `id` isn't a stage, `end`
// isn't an end, the end isn't one of the modes, the stage list refuses the mix, or `mix` isn't null
// and the end's mode can't mix.
export function setStageMix(plan, id, end, mix) {
  if (!plan.stageList.has(id)) {
    throw new Error(`There's no stage ${describeValue(id)} in the plan.`);
  }
  if (!ENDS.includes(end)) {
    throw new Error(`The end must be "source" or "destination", but got ${describeValue(end)}.`);
  }
  const { settings } = plan.stageList.get(id);
  const mode = modeAt(end, settings);
  if (mode === undefined) {
    throw new Error(
      `The ${end}'s technique and liquid type aren't one of the pipetting modes, ` +
        "so its mixing can't be switched. Choose a mode for it first.",
    );
  }
  const mixSetting = `${end}Mix`;
  // The stage list checks the mix itself; its result is set aside, since the technique changes too.
  plan.stageList.changeSettings(id, { ...settings, [mixSetting]: mix });
  if (mix !== null && mode.mixingTechnique === null) {
    throw new Error(`${mode.name} can't mix. Choose another mode for the ${end} first.`);
  }
  if (sameMix(settings[mixSetting], mix)) {
    return plan;
  }
  const newSettings = {
    ...settings,
    ...modeSettings(end, mode.name, mix !== null),
    [mixSetting]: mix,
  };
  return withParts(plan, { stageList: plan.stageList.changeSettings(id, newSettings) });
}

// True if stage `id` can be removed: it's a stage, and not the plan's only one.
export function canRemoveStage(plan, id) {
  return plan.stageList.has(id) && plan.stageList.listStages().length > 1;
}

// Returns the plan without stage `id`, its transfers, or a tip change before it. It's taken out of
// the stage order, which keeps the other stages in their order. Throws if canRemoveStage is false.
export function removeStage(plan, id) {
  if (!plan.stageList.has(id)) {
    // get() throws the stage list's own message for a stage that isn't there.
    plan.stageList.get(id);
  }
  if (!canRemoveStage(plan, id)) {
    throw new Error("A plan needs at least one stage, so its only stage can't be removed.");
  }
  // Removing from the last transfer back keeps the positions of the ones still to remove.
  let operationList = plan.operationList;
  const positions = positionsInStage(plan, id);
  for (const position of positions.reverse()) {
    operationList = operationList.remove(position);
  }

  const order = plan.stageOrder;
  const nextId = order[order.indexOf(id) + 1] ?? null;
  // Noted before removing: if it's the stage just after a randomization, the stage after it gets
  // the tips it used, so the randomization's last stage never shares tips (section 3).
  const keptTips = isJustAfterRandomization(plan, id) ? tipsInUseAt(plan, id) : null;

  const removed = withParts(plan, {
    operationList,
    stageList: plan.stageList.remove(id),
    stageOrder: order.filter((stage) => stage !== id),
    tipChanges: withoutKey(plan.tipChanges, id),
  });
  return withRandomizationsAfterRemove(withStartTipsFirst(removed), id, nextId, keptTips);
}

// For each stage with transfers, in run order, how many transfers have run when it ends,
// e.g. [{ stage: "1", transfersDone: 4 }, { stage: "2", transfersDone: 8 }].
export function stageEnds(plan) {
  let transfersDone = 0;
  return plan.operationList.groupByStage().map((group) => {
    transfersDone += group.operations.length;
    return { stage: group.stage, transfersDone };
  });
}

// The IDs of the stages with a contents problem of any kind, as contents tracking finds them: a
// transfer that draws into its source's dead volume, one that asks a well for more than it holds,
// or one that fills a well over its capacity (contents-tracking.md), e.g. new Set(["2"]). A problem
// of the starting contents (a well that starts over its capacity, operationIndex null) names no
// stage.
export function stagesWithContentsProblem(plan) {
  const operations = plan.operationList.listOperations();
  const problems = replay(plan.startingContents, plan.operationList).listProblems();
  return new Set(
    problems
      .filter((problem) => problem.operationIndex !== null)
      .map((problem) => operations[problem.operationIndex].stage),
  );
}

// The IDs of the stages with a mix problem: a mix volume under the minimum (MIN_MIX_VOLUME in
// config/mixing.js, 1 µL) in any of their rows, because the well it's worked out from holds too
// little when it's mixed (mix-volumes.md), e.g. new Set(["3"]).
export function stagesWithMixProblem(plan) {
  return new Set(mixVolumes(plan).problems.map((problem) => problem.stage));
}

// --- Transfers ---

// Returns the plan with `transfer` added to its stage, without changing the stage order. If the
// stage already has transfers, it goes after them; if not, it goes just before the next stage in the
// stage order that has transfers, or last. Throws, in this order, if the operation list refuses it
// (its form, then the stage rule), its source or destination well isn't on the deck, its stage
// isn't in the plan, or its stage is a mix step and it isn't a mixed well (a transfer from a well
// into itself of MIX_STEP_VOLUME; transfer-designer.md, "Mix steps").
export function addTransfer(plan, transfer) {
  // add() runs the operation list's checks first, so a badly formed transfer never reaches the
  // later checks. Its result is the new list if the stage already has transfers.
  const addedAfterStage = plan.operationList.add(transfer);
  checkWell(transfer.source);
  checkWell(transfer.destination);
  if (!plan.stageList.has(transfer.stage)) {
    throw new Error(
      `There's no stage ${describeValue(transfer.stage)} in the plan to add this transfer to.`,
    );
  }
  if (isMixStep(plan, transfer.stage) && !isMixedWell(transfer)) {
    throw new Error(
      `${stageNamed(plan, transfer.stage)}, is a mix step: it only mixes wells. ` +
        "Add this transfer to a transfer stage.",
    );
  }
  if (positionsInStage(plan, transfer.stage).length > 0) {
    return withParts(plan, { operationList: addedAfterStage });
  }
  return withFirstTransfer(plan, transfer);
}

// Returns the plan with each of `transfers` added in turn by addTransfer, as one edit, e.g. one
// source into each of many wells. Throws, adding none, if any can't be added.
export function addTransfers(plan, transfers) {
  // Plans are never changed, so if one throws, the plan given is still as it was.
  return transfers.reduce((planSoFar, transfer) => addTransfer(planSoFar, transfer), plan);
}

// Returns the plan with the transfer at `position` (counting from 0) given `volume`, keeping its
// place and stage, e.g. changeVolume(plan, 3, 25). The operation list checks both. Throws for a
// mix step's mixed well, whose volume is a placeholder that can't be changed (transfer-designer.md,
// "Mix steps").
export function changeVolume(plan, position, volume) {
  const operation = plan.operationList.listOperations()[position];
  // A position that isn't one gives undefined here; replace() reports it below.
  if (operation !== undefined && isMixStep(plan, operation.stage)) {
    throw new Error(
      "A mix step's wells are mixed with its own settings, so their volume can't be changed.",
    );
  }
  // replace() checks the position before anything else, so a bad position is reported even though
  // `operation` is then undefined (spreading undefined gives nothing).
  return withParts(plan, {
    operationList: plan.operationList.replace(position, { ...operation, volume }),
  });
}

// Returns the plan without the transfer at `position` (counting from 0). The operation list checks
// the position. The stage order doesn't change, even if it was its stage's last transfer.
export function removeTransfer(plan, position) {
  return withParts(plan, { operationList: plan.operationList.remove(position) });
}

// Stage `id`'s transfers, in order, each with its position in the operation list added,
// e.g. [{ type: "transfer", source: …, destination: …, volume: 50, stage: "2", position: 4 }].
// A stage without transfers, or an ID that isn't a stage, gives [].
export function transfersIn(plan, id) {
  const operations = plan.operationList.listOperations();
  return positionsInStage(plan, id).map((position) => ({ ...operations[position], position }));
}

// --- Tip changes ---

// The tip change at `key` (START or a stage ID), e.g. { tipType: "BC230", probes: [1, 2, 3, 4] },
// or null if there's none.
export function tipChangeAt(plan, key) {
  return Object.hasOwn(plan.tipChanges, key) ? plan.tipChanges[key] : null;
}

// True if a tip change can be added before stage `beforeId`: it's a stage, not the first in the
// stage order, and there's no tip change before it yet.
export function canAddTipChange(plan, beforeId) {
  return (
    plan.stageList.has(beforeId) &&
    stageOrder(plan)[0] !== beforeId &&
    !Object.hasOwn(plan.tipChanges, beforeId)
  );
}

// Returns the plan with a tip change before stage `beforeId`, loading the tip type and probes
// already in use there. Throws if canAddTipChange is false, saying why.
export function addTipChange(plan, beforeId) {
  if (!plan.stageList.has(beforeId)) {
    throw new Error(`There's no stage ${describeValue(beforeId)} to add new tips before.`);
  }
  if (stageOrder(plan)[0] === beforeId) {
    throw new Error(
      "The first stage always starts with new tips, so there can't be another tip change before it.",
    );
  }
  if (Object.hasOwn(plan.tipChanges, beforeId)) {
    throw new Error(`There are already new tips before stage ${describeValue(beforeId)}.`);
  }
  const groupInUse = tipGroups(plan).find((group) => group.stages.includes(beforeId));
  const tipChange = { tipType: groupInUse.tipType, probes: groupInUse.probes };
  return withParts(plan, { tipChanges: withKey(plan.tipChanges, beforeId, tipChange) });
}

// Returns the plan with the tip change at `key` loading `tipType`, keeping its probes,
// e.g. setTipType(plan, START, "BC1070"). Throws if there's no tip change at `key`, then if
// `tipType` isn't in TIP_TYPES.
export function setTipType(plan, key, tipType) {
  checkTipChangeAt(plan, key);
  if (!TIP_TYPES.includes(tipType)) {
    throw new Error(
      `${describeValue(tipType)} isn't a tip type. Choose one of ${listNames(TIP_TYPES)}.`,
    );
  }
  const tipChange = { ...plan.tipChanges[key], tipType };
  return withParts(plan, { tipChanges: withKey(plan.tipChanges, key, tipChange) });
}

// Returns the plan with the tip change at `key` loading tips on `probes`, stored smallest first,
// keeping its tip type, e.g. setTipProbes(plan, START, [3, 1]) stores [1, 3]. Every stage using
// those tips uses all of them (ADR 0007, "Tip changes"). Throws if there's no tip change at `key`,
// then if `probes` isn't a list of at least one probe number, 1 to 8, each listed once
// (checkProbes).
export function setTipProbes(plan, key, probes) {
  checkTipChangeAt(plan, key);
  checkProbes(probes);
  // sort() changes the list it's called on, so it sorts a copy. Without (a, b) => a - b it would
  // sort numbers as text, putting 10 before 2.
  const tipChange = { ...plan.tipChanges[key], probes: [...probes].sort((a, b) => a - b) };
  return withParts(plan, { tipChanges: withKey(plan.tipChanges, key, tipChange) });
}

// Returns the plan without the tip change at `key`, so the stages after it use the tips before it.
// Throws for START, which the run always has, if there's no tip change at `key`, or if a
// randomization needs it: the stage just after a randomization's last stage keeps its own tips, so
// the randomization never shares tips (section 3, "Randomizations"), and so does a stage a
// randomization that hasn't run sits before, since it sits between tip groups.
export function removeTipChange(plan, key) {
  if (key === START) {
    throw new Error(
      "The run always starts by loading tips, so the first tips can't be removed.",
    );
  }
  checkTipChangeAt(plan, key);
  checkNoRandomizationNeedsTips(plan, key);
  return withParts(plan, { tipChanges: withoutKey(plan.tipChanges, key) });
}

// --- Components and starting contents ---

// Returns the plan with a new component, last, called `name` (spaces at its ends removed) and drawn
// in `color`, e.g. addComponent(plan, "Media", "#4e79a7"). Throws, in this order, if the name isn't
// a name or is used, or the color isn't text or is used.
export function addComponent(plan, name, color) {
  const trimmedName = checkNewComponentName(plan, name);
  checkComponentColor(plan, color, null);
  return withParts(plan, {
    components: [...plan.components, { name: trimmedName, color }],
  });
}

// Returns the plan with component `oldName` called `newName` (spaces at its ends removed), in the
// list and in every well, keeping each well's components in order. Renaming it to its own name
// returns the plan unchanged. Throws if there's no such component, then as addComponent does for
// the new name.
export function renameComponent(plan, oldName, newName) {
  checkComponentExists(plan, oldName);
  const trimmedName = typeof newName === "string" ? newName.trim() : newName;
  if (trimmedName === oldName) {
    return plan;
  }
  checkNewComponentName(plan, trimmedName);
  // Rebuilding the object from its entries in order keeps the renamed component in its place.
  const renamed = (components) =>
    Object.fromEntries(
      Object.entries(components).map(([name, volume]) => [
        name === oldName ? trimmedName : name,
        volume,
      ]),
    );
  return withParts(plan, {
    components: plan.components.map((component) =>
      component.name === oldName ? { ...component, name: trimmedName } : component,
    ),
    startingContents: changeEntriesHolding(plan, oldName, renamed),
  });
}

// Returns the plan with component `name` drawn in `color`. Throws if there's no such component,
// then if the color isn't text or another component has it.
export function setComponentColor(plan, name, color) {
  checkComponentExists(plan, name);
  checkComponentColor(plan, color, name);
  return withParts(plan, {
    components: plan.components.map((component) =>
      component.name === name ? { ...component, color } : component,
    ),
  });
}

// Returns the plan without component `name`, in the list or in any well. A well left with nothing
// is no longer listed in the starting contents. Throws if there's no such component.
export function removeComponent(plan, name) {
  checkComponentExists(plan, name);
  const withoutComponent = (components) => withoutKey(components, name);
  const startingContents = changeEntriesHolding(plan, name, withoutComponent).filter(
    (entry) => Object.keys(entry.components).length > 0,
  );
  return withParts(plan, {
    components: plan.components.filter((component) => component.name !== name),
    startingContents,
  });
}

// How many wells hold component `name` at the start, e.g. 12. A name no well holds gives 0.
export function countWellsWith(plan, name) {
  return plan.startingContents.filter((entry) => Object.hasOwn(entry.components, name)).length;
}

// Returns the plan with `volume` µL of component `name` added on top of what each of `wells` holds
// at the start, like pipetting it in: 500 µL of Media plus 1000 µL of Media is 1500 µL. Each well
// is { labware, well }; one listed more than once gets the volume once. Throws, in this order, if
// the component isn't in the plan, the volume isn't a number above 0, or a well isn't on the deck
// (the first such well).
export function addToWells(plan, wells, name, volume) {
  checkComponentExists(plan, name);
  // Number.isFinite is false for anything that isn't a number (such as "10"), and for NaN and
  // Infinity.
  if (!Number.isFinite(volume) || volume <= 0) {
    throw new Error(
      `The volume to add must be a number of microliters above 0, like 100, but got ${describeValue(volume)}.`,
    );
  }
  wells.forEach((well) => checkWell(well));

  // Each well once, keyed by wellKey, in the order given.
  const wellsToFill = new Map(wells.map((well) => [wellKey(well), well]));
  const addVolume = (components) => ({ ...components, [name]: (components[name] ?? 0) + volume });
  const startingContents = plan.startingContents.map((entry) => {
    const key = wellKey(entry);
    if (!wellsToFill.has(key)) {
      return entry;
    }
    wellsToFill.delete(key);
    return { ...entry, components: addVolume(entry.components) };
  });
  // The wells left are empty so far, so they get new entries, at the end.
  for (const well of wellsToFill.values()) {
    startingContents.push({ labware: well.labware, well: well.well, components: { [name]: volume } });
  }
  return withParts(plan, { startingContents });
}

// Returns the plan with `wells` (each { labware, well }) holding nothing at the start. The
// components stay in the plan's list. A well that's already empty is left as it is.
export function emptyWells(plan, wells) {
  const keys = new Set(wells.map(wellKey));
  return withParts(plan, {
    startingContents: plan.startingContents.filter((entry) => !keys.has(wellKey(entry))),
  });
}

// --- Labware ---

// The names of the labware the plan uses, in its starting contents, in any transfer, or with a
// well label, in the deck's order, e.g. ["Plate", "Res"]. A labware whose wells are only labeled
// counts too (Andy, 2026-11-01), so a tool can bring it out.
export function labwareUsed(plan) {
  const used = new Set(plan.startingContents.map((entry) => entry.labware));
  for (const operation of plan.operationList.listOperations()) {
    used.add(operation.source.labware);
    used.add(operation.destination.labware);
  }
  for (const labware of Object.keys(plan.wellLabels)) {
    used.add(labware);
  }
  return labwareNames().filter((name) => used.has(name));
}

// The label of the labware called `name`, or its name if it has none,
// e.g. labelOf(plan, "Plate") → "Assay plate".
export function labelOf(plan, name) {
  return Object.hasOwn(plan.labwareLabels, name) ? plan.labwareLabels[name] : name;
}

// Returns the plan with the labware called `name` labelled `label`, with spaces at its ends removed.
// A blank label, or the labware's own name, goes back to the name. Giving a labware the label it
// already has returns the plan unchanged. Throws, in this order, if the labware isn't on the deck,
// the label isn't text, or another labware already has that label (counting a labware without a
// label as labelled by its name).
export function setLabel(plan, name, label) {
  // gridOf throws the deck's own message for a labware that isn't on the deck.
  gridOf(name);
  if (typeof label !== "string") {
    throw new Error(`A label must be text, like "Assay plate", but got ${describeValue(label)}.`);
  }
  const trimmed = label.trim();
  // The label the labware will be shown by: its name if the label is blank.
  const newLabel = trimmed === "" ? name : trimmed;
  const other = labwareNames().find(
    (candidate) => candidate !== name && labelOf(plan, candidate) === newLabel,
  );
  if (other !== undefined) {
    throw new Error(
      `${other} already has the label ${describeValue(newLabel)}. Choose a different one.`,
    );
  }
  if (labelOf(plan, name) === newLabel) {
    return plan;
  }
  const labwareLabels =
    newLabel === name
      ? withoutKey(plan.labwareLabels, name)
      : withKey(plan.labwareLabels, name, newLabel);
  return withParts(plan, { labwareLabels });
}

// Returns the plan with its labels replaced by `labels`, an object of labware names and labels,
// e.g. setLabels(plan, { Plate: "Assay plate", Deep: "Drug plate" }); {} removes every label.
// The table is judged as a whole, so swapping two labels works in one step. It's strict, for a table
// already in the plan's own form (such as one read from a plan file): it refuses what setLabel would
// tidy. Throws, in this order, if `labels` isn't an object; then for each entry in turn, if its
// labware isn't on the deck or its label is wrong (checkLabelAsStored); then if two labware would
// show one label.
export function setLabels(plan, labels) {
  if (!isObject(labels)) {
    throw new Error(
      `The labels must be an object of labware names and labels, like { Plate: "Assay plate" }, ` +
        `but got ${describeValue(labels)}.`,
    );
  }
  for (const [name, label] of Object.entries(labels)) {
    // gridOf throws the deck's own message for a labware that isn't on the deck.
    gridOf(name);
    checkLabelAsStored(name, label);
  }
  checkNoSharedLabel(labels);
  // A copy, so freezing the plan doesn't freeze the caller's object.
  return withParts(plan, { labwareLabels: { ...labels } });
}

// --- Well labels ---

// The label of well `end` ({ labware, well }), e.g. "Cond 1", or null if it has none.
// Throws if `end` isn't a well on the deck (deck.checkWell's message).
export function wellLabelOf(plan, end) {
  checkWell(end);
  const labels = plan.wellLabels;
  if (!Object.hasOwn(labels, end.labware) || !Object.hasOwn(labels[end.labware], end.well)) {
    return null;
  }
  return labels[end.labware][end.well];
}

// Returns the plan with well `end` ({ labware, well }) labeled `label`, its spaces at the ends
// removed; a label that's blank after that removes the well's label, and a labware left with no
// labeled wells is left out of wellLabels. Any other text is a label, and labels may repeat.
// Giving the well the label it has, or removing a label it doesn't have, returns the same plan, so
// a caller can tell nothing changed. Throws, in this order, if `end` isn't a well on the deck or
// `label` isn't text.
// e.g. setWellLabel(plan, { labware: "Deep1", well: "A1" }, " Cond 1 ") labels Deep1 A1 "Cond 1".
export function setWellLabel(plan, end, label) {
  checkWell(end);
  if (typeof label !== "string") {
    throw new Error(`A well's label must be text, like "Cond 1", but got ${describeValue(label)}.`);
  }
  const trimmed = label.trim();
  const current = wellLabelOf(plan, end);
  // A blank label stands for "no label", which is null.
  if ((trimmed === "" ? null : trimmed) === current) {
    return plan;
  }
  const { labware, well } = end;
  const labwareWells = plan.wellLabels[labware] ?? {};
  const newWells =
    trimmed === "" ? withoutKey(labwareWells, well) : withKey(labwareWells, well, trimmed);
  const wellLabels =
    Object.keys(newWells).length === 0
      ? withoutKey(plan.wellLabels, labware)
      : withKey(plan.wellLabels, labware, newWells);
  return withParts(plan, { wellLabels });
}

// Returns the plan with its well labels replaced by `labels`, in the form of the plan's wellLabels:
// labware names, each holding well names and labels, e.g. { Deep1: { A1: "Cond 1" } }; {} removes
// every label. It's strict, for a table already in the plan's own form (such as one read from a
// plan file): it refuses what setWellLabel would tidy. Throws, in this order, if `labels` isn't an
// object; then for each labware in turn: it isn't on the deck, its wells aren't an object or are
// empty; then for each of its wells in turn: it isn't on the grid, or its label is wrong
// (checkWellLabelAsStored).
export function setWellLabels(plan, labels) {
  if (!isObject(labels)) {
    throw new Error(
      "The well labels must be an object of labware names, each holding an object of wells and " +
        `labels, like { Deep: { A1: "Cond 1" } }, but got ${describeValue(labels)}.`,
    );
  }
  const copied = {};
  for (const [labware, wells] of Object.entries(labels)) {
    checkLabwareWellLabels(labware, wells);
    // A copy, so freezing the plan doesn't freeze the caller's objects.
    copied[labware] = { ...wells };
  }
  return withParts(plan, { wellLabels: copied });
}

// --- Randomizations ---

// The properties setRandomization can change, in the order it checks them (section 5).
const RANDOMIZATION_CHANGES = ["sources", "fill", "seed", "volume", "settings", "tipType", "probes"];

// Every property of a randomization, as setRandomizations takes them (section 3).
const RANDOMIZATION_PROPERTIES = ["id", "beforeId", ...RANDOMIZATION_CHANGES, "stages"];

// The properties of a source, and of an entry of a randomization's stages, exactly.
const SOURCE_PROPERTIES = ["labware", "well", "replicates", "filler"];
const OWNED_STAGE_PROPERTIES = ["labware", "well", "stage"];

// The pool's problems (random-pool) that only follow from having no sources or no wells to fill,
// so they aren't listed then (section 3, "Problems").
const FOLLOW_ON_POOL_PROBLEMS = ["replicates-missing", "replicates-invalid", "too-many", "spare-without-filler"];

// Returns { plan, id }: the plan with a new randomization, last in its randomizations, sitting just
// before stage `beforeId` (or last, for null), with no sources, wells to fill or stages, the `seed`
// and `volume` given (each may be null), the default settings, the first tip type and the first
// DEFAULT_PROBE_COUNT probes; and its ID, "r" and one more than the largest number in use, e.g.
// addRandomization(plan, "4", { seed: 37, volume: 50 }) → { plan, id: "r1" }. Throws, in this order,
// if `beforeId` isn't a stage or null, isn't a place a randomization can sit (section 3), or `seed`
// or `volume` isn't valid.
export function addRandomization(plan, beforeId, { seed = null, volume = null } = {}) {
  checkRandomizationPlace(plan, beforeId, null);
  checkSeed(seed);
  checkRandomizationVolume(volume);
  const id = nextRandomizationId(plan);
  const randomization = {
    id,
    beforeId,
    sources: [],
    fill: [],
    seed,
    volume,
    settings: defaultSettings(),
    tipType: TIP_TYPES[0],
    probes: probesFor(DEFAULT_PROBE_COUNT),
    stages: [],
  };
  return { plan: withParts(plan, { randomizations: [...plan.randomizations, randomization] }), id };
}

// The randomization with ID `id`, e.g. { id: "r1", beforeId: "4", sources: […], … }, or null.
export function randomizationAt(plan, id) {
  return plan.randomizations.find((randomization) => randomization.id === id) ?? null;
}

// The ID of the randomization that owns stage `stageId`, e.g. "r1", or null if none does.
export function randomizationOf(plan, stageId) {
  const owner = plan.randomizations.find((randomization) =>
    randomization.stages.some((owned) => owned.stage === stageId),
  );
  return owner === undefined ? null : owner.id;
}

// Returns the plan with the randomization's sources, wells to fill, seed, volume, settings, tip
// type and probes replaced by those in `changes` (any of them; the others kept), checked as
// section 3 says, its wells to fill put in deck order and its probes smallest first, e.g.
// setRandomization(plan, "r1", { seed: 38 }). Its stages and where it sits don't change. Gives back
// the same plan if nothing changes. Throws, in section 5's order of checks, if there's no such
// randomization or anything is invalid.
export function setRandomization(plan, id, changes) {
  const randomization = checkRandomizationExists(plan, id);
  checkRandomizationChanges(changes);
  const updated = { ...randomization, ...checkedRandomizationValues(changes, randomization) };
  if (sameRandomization(updated, randomization)) {
    return plan;
  }
  return withRandomizationReplaced(plan, updated);
}

// Returns the plan with randomization `id`, which hasn't run, sitting just before stage `beforeId`
// (or last, for null) instead, e.g. for a caller adding a stage just below it, so it stays above the
// new stage. Throws, in this order, if there's no such randomization, it has stages, `beforeId`
// isn't a stage or null, or it isn't a place a randomization can sit.
export function placeRandomization(plan, id, beforeId) {
  const randomization = checkRandomizationExists(plan, id);
  if (randomization.stages.length > 0) {
    throw new Error("This randomization has run, so it sits where its stages are.");
  }
  checkRandomizationPlace(plan, beforeId, id);
  if (randomization.beforeId === beforeId) {
    return plan;
  }
  return withRandomizationReplaced(plan, { ...randomization, beforeId });
}

// The randomization's problems, as short messages in section 3's order, e.g.
// ["Drug A needs a number of replicates.", "Type a seed."]; [] if it can run. They're the pool's
// problems (random-pool) in the designer's words, plus its own. Throws if there's no such
// randomization.
export function randomizationProblems(plan, id) {
  const randomization = checkRandomizationExists(plan, id);
  const { sources, fill } = randomization;
  const problems = [];
  if (sources.length === 0) {
    problems.push("Pick at least one source.");
  }
  if (fill.length === 0) {
    problems.push("Pick the wells to fill.");
  }
  if (sources.length > 0 && sources.every((source) => source.filler)) {
    problems.push("Add a source that isn't the filler.");
  }
  // With no sources or no wells to fill, the pool's replicate and well-count problems would only
  // follow from that one, so only its seed problem is listed (section 3, "Problems").
  const poolProblems = findPoolProblems(poolOf(randomization)).filter(
    (problem) => (sources.length > 0 && fill.length > 0) || !FOLLOW_ON_POOL_PROBLEMS.includes(problem.kind),
  );
  for (const problem of poolProblems) {
    const message = poolProblemMessage(plan, randomization, problem);
    if (message !== null) {
      problems.push(message);
    }
  }
  if (randomization.volume === null) {
    problems.push("Set the volume.");
  }
  return problems;
}

// A source's name (section 3): its well label; otherwise the component it holds most of just before
// the randomization, with " +N" for N others it holds too; otherwise its labware's label and well,
// e.g. "Cond 1", "Drug A +2" or "Deep1 A1". `source` is { labware, well } (other properties are
// ignored). Throws if there's no such randomization, or `source` isn't a well on the deck.
export function sourceName(plan, id, source) {
  const randomization = checkRandomizationExists(plan, id);
  const label = wellLabelOf(plan, source);
  if (label !== null) {
    return label;
  }
  const components = Object.entries(
    contentsBefore(plan, randomization).componentsOf(source.labware, source.well),
  ).filter(([, volume]) => volume > 0);
  if (components.length === 0) {
    return `${labelOf(plan, source.labware)} ${source.well}`;
  }
  // The first with the most: a later component replaces it only when it holds strictly more.
  let [main] = components[0];
  let mainVolume = components[0][1];
  for (const [name, volume] of components) {
    if (volume > mainVolume) {
      [main, mainVolume] = [name, volume];
    }
  }
  return components.length === 1 ? main : `${main} +${components.length - 1}`;
}

// Returns the plan with randomization `id` run, as one edit (section 3, "Running"): one stage per
// source that gets wells, in source order, named as its source is, each on new tips, moving `volume`
// from its source to each of its wells; stages of sources that no longer get wells removed.
// Throws its first problem's message if it has any.
export function runRandomization(plan, id) {
  checkRandomizationExists(plan, id);
  const problems = randomizationProblems(plan, id);
  if (problems.length > 0) {
    throw new Error(problems[0]);
  }
  const randomization = randomizationAt(plan, id);
  const wellsBySource = wellsForEachSource(randomization);
  const place = runPlace(plan, randomization);
  const names = randomization.sources.map((source) => sourceName(plan, id, source));
  let running = withNewSourceStages(plan, randomization, wellsBySource, place, names);
  running = withoutUnusedSourceStages(running, id, wellsBySource);
  for (const owned of randomizationAt(running, id).stages) {
    const wells = wellsBySource[sourceIndexOf(randomization, owned)];
    running = withSourceStageSet(running, randomization, owned, wells);
  }
  return withRunPlaceNoted(running, id);
}

// Returns the plan without randomization `id` and every stage it owns, as one edit. Tip changes its
// runs added elsewhere stay: the tool never takes tips away by itself. Throws if there's no such
// randomization, or its stages are all the plan's stages (a plan needs at least one).
export function removeRandomization(plan, id) {
  const randomization = checkRandomizationExists(plan, id);
  if (!canRemoveRandomization(plan, id)) {
    throw new Error(
      "This randomization's stages are all the plan's stages, and a plan needs at least one. " +
        "Add a stage outside it first.",
    );
  }
  let removed = withParts(plan, {
    randomizations: plan.randomizations.filter((candidate) => candidate.id !== id),
  });
  for (const owned of ownedStagesIn(plan, randomization)) {
    removed = removeStage(removed, owned.stage);
  }
  return removed;
}

// True unless randomization `id`'s stages are all the plan's stages; false if there's no such
// randomization.
export function canRemoveRandomization(plan, id) {
  const randomization = randomizationAt(plan, id);
  if (randomization === null) {
    return false;
  }
  return ownedStagesIn(plan, randomization).length < plan.stageOrder.length;
}

// Returns the plan with its randomizations replaced by `randomizations`, each in the form of
// section 3, stages included, for a list already in the plan's own form, such as one read from a
// plan file. Strict: nothing is tidied. Throws, in section 5's order of checks, prefixed
// "Randomization N: " where the message is about one randomization.
export function setRandomizations(plan, randomizations) {
  if (!Array.isArray(randomizations)) {
    throw new Error(`The randomizations must be a list, but got ${describeValue(randomizations)}.`);
  }
  const copied = randomizations.map((randomization, index) =>
    checkedStoredRandomization(plan, randomization, index + 1),
  );
  checkRandomizationIdsUnique(copied);
  checkStagesOwnedOnce(copied);
  const updated = withParts(plan, { randomizations: copied });
  checkStoredPlaces(updated);
  return updated;
}

// --- Helpers used only inside this module ---

// --- Randomizations: helpers ---

// Returns randomization `id`, or throws 'There's no randomization "r9" in the plan.'
function checkRandomizationExists(plan, id) {
  const randomization = randomizationAt(plan, id);
  if (randomization === null) {
    throw new Error(`There's no randomization ${describeValue(id)} in the plan.`);
  }
  return randomization;
}

// The next randomization's ID: "r" and one more than the largest number in use, e.g. with "r1" and
// "r3" → "r4"; "r1" with none.
function nextRandomizationId(plan) {
  const numbers = plan.randomizations.map((randomization) => Number(randomization.id.slice(1)));
  return `r${Math.max(0, ...numbers) + 1}`;
}

// True if stage `id` starts a tip group: it's first in the stage order, or has a tip change.
function isFirstOfTipGroup(plan, id) {
  return plan.stageOrder[0] === id || Object.hasOwn(plan.tipChanges, id);
}

// Throws if a randomization (`ownId`, or null for a new one) can't sit just before stage `beforeId`
// (null: last): it must be a stage, the first of a tip group, and not a stage another randomization
// owns other than its first (section 3, "Where it sits").
function checkRandomizationPlace(plan, beforeId, ownId) {
  if (beforeId === null) {
    return;
  }
  if (!plan.stageList.has(beforeId)) {
    throw new Error(`There's no stage ${describeValue(beforeId)} to add a randomization before.`);
  }
  const owner = plan.randomizations.find(
    (randomization) =>
      randomization.id !== ownId &&
      randomization.stages.some((owned) => owned.stage === beforeId),
  );
  const ownersFirst = owner !== undefined && owner.stages[0].stage === beforeId;
  if (!isFirstOfTipGroup(plan, beforeId) || (owner !== undefined && !ownersFirst)) {
    throw new Error(
      `A randomization sits between tip groups, so it can't go before ${stageNamedInText(plan, beforeId)}.`,
    );
  }
}

// Throws unless `seed` is null or a whole number from 1 to random-pool's MAX_SEED (999,999), the
// randomizer's range (random-pool.md, "Seeds").
function checkSeed(seed) {
  if (seed !== null && !(Number.isInteger(seed) && seed >= 1 && seed <= MAX_SEED)) {
    throw new Error(
      "A randomization's seed must be a whole number from 1 to " +
        `${MAX_SEED.toLocaleString("en-US")}, or null, but got ${describeValue(seed)}.`,
    );
  }
}

// Throws unless `volume` is null or a number of µL above 0.
function checkRandomizationVolume(volume) {
  if (volume !== null && !(Number.isFinite(volume) && volume > 0)) {
    throw new Error(
      `A randomization's volume must be a number of µL above 0, or null, but got ${describeValue(volume)}.`,
    );
  }
}

// Throws unless `changes` is an object of only the properties setRandomization can change, naming
// the first wrong property, or the value if it isn't an object.
function checkRandomizationChanges(changes) {
  const extra = isObject(changes) ? findExtraProperties(changes, RANDOMIZATION_CHANGES) : [];
  if (!isObject(changes) || extra.length > 0) {
    throw new Error(
      `The changes to a randomization must be an object of ${listNamesWithAnd(RANDOMIZATION_CHANGES)}, ` +
        `but got ${describeValue(isObject(changes) ? extra[0] : changes)}.`,
    );
  }
}

// The values in `changes`, checked in section 5's order, as a randomization stores them: sources
// copied, wells to fill in deck order, probes smallest first. `current` gives the values not in
// `changes`, for the check that no well is both a source and a well to fill.
function checkedRandomizationValues(changes, current) {
  const values = {};
  if (Object.hasOwn(changes, "sources")) {
    values.sources = checkedSources(changes.sources);
  }
  if (Object.hasOwn(changes, "fill")) {
    values.fill = checkedFill(changes.fill);
  }
  checkNoWellInBoth(values.sources ?? current.sources, values.fill ?? current.fill);
  if (Object.hasOwn(changes, "seed")) {
    checkSeed(changes.seed);
    values.seed = changes.seed;
  }
  if (Object.hasOwn(changes, "volume")) {
    checkRandomizationVolume(changes.volume);
    values.volume = changes.volume;
  }
  if (Object.hasOwn(changes, "settings")) {
    values.settings = checkedRandomizationSettings(changes.settings);
  }
  if (Object.hasOwn(changes, "tipType")) {
    checkTipType(changes.tipType);
    values.tipType = changes.tipType;
  }
  if (Object.hasOwn(changes, "probes")) {
    checkProbes(changes.probes);
    values.probes = [...changes.probes].sort((a, b) => a - b);
  }
  return values;
}

// A copy of `sources`, checked: a list; each source's form, well, replicates and filler in turn;
// then no well twice, at most one filler, and the filler without replicates.
function checkedSources(sources) {
  if (!Array.isArray(sources)) {
    throw new Error(`A randomization's sources must be a list, but got ${describeValue(sources)}.`);
  }
  sources.forEach((source, index) => checkSource(source, index + 1));
  checkNoWellTwice(sources, (where) => `${where} is a source twice. List each source once.`);
  const fillers = sources.flatMap((source, index) => (source.filler ? [index + 1] : []));
  if (fillers.length > 1) {
    throw new Error(
      `Sources ${fillers[0]} and ${fillers[1]} are both the filler. Only one source can be.`,
    );
  }
  if (fillers.length === 1 && sources[fillers[0] - 1].replicates !== null) {
    throw new Error(
      `Source ${fillers[0]} is the filler, so its replicates must be null, ` +
        `but got ${describeValue(sources[fillers[0] - 1].replicates)}.`,
    );
  }
  return sources.map(({ labware, well, replicates, filler }) => ({ labware, well, replicates, filler }));
}

// Throws if source number `number` isn't an object with exactly its four properties, isn't a well on
// the deck, or has replicates or a filler that aren't valid.
function checkSource(source, number) {
  if (!hasExactly(source, SOURCE_PROPERTIES)) {
    throw new Error(
      `Source ${number} must be an object with exactly ${listNamesWithAnd(SOURCE_PROPERTIES)}.`,
    );
  }
  withPrefix(`Source ${number}: `, () => checkWell(source));
  const { replicates, filler } = source;
  if (replicates !== null && !(Number.isInteger(replicates) && replicates >= 1)) {
    throw new Error(
      `Source ${number}'s replicates must be a whole number of at least 1, or null, ` +
        `but got ${describeValue(replicates)}.`,
    );
  }
  if (typeof filler !== "boolean") {
    throw new Error(
      `Source ${number}'s "filler" must be true or false, but got ${describeValue(filler)}.`,
    );
  }
}

// The wells to fill, checked (a list, each a well on the deck, none twice), as { labware, well }
// copies in deck order: the deck's order of labware, then each labware's grid order.
function checkedFill(fill) {
  if (!Array.isArray(fill)) {
    throw new Error(`A randomization's wells to fill must be a list, but got ${describeValue(fill)}.`);
  }
  fill.forEach((end, index) => withPrefix(`Well to fill ${index + 1}: `, () => checkWell(end)));
  checkNoWellTwice(fill, (where) => `${where} is a well to fill twice. List each once.`);
  return [...fill]
    .sort((first, second) => deckOrderIndex(first) - deckOrderIndex(second))
    .map(({ labware, well }) => ({ labware, well }));
}

// A well's place in deck order, as one number: its labware's place in the deck, then its place in
// that labware's grid order (wellNames()), e.g. on the first labware, A2 → 1. Wells are checked
// already. No grid has 10,000 wells, so the labware's place always counts first.
function deckOrderIndex({ labware, well }) {
  return labwareNames().indexOf(labware) * 10000 + gridOf(labware).wellNames().indexOf(well);
}

// Throws `message(where)` for the first well listed twice in `ends`, `where` naming it, e.g.
// "Deep1 A1".
function checkNoWellTwice(ends, message) {
  const seen = new Set();
  for (const end of ends) {
    const key = wellKey(end);
    if (seen.has(key)) {
      throw new Error(message(`${end.labware} ${end.well}`));
    }
    seen.add(key);
  }
}

// Throws for the first source that's also a well to fill.
function checkNoWellInBoth(sources, fill) {
  const toFill = new Set(fill.map(wellKey));
  const both = sources.find((source) => toFill.has(wellKey(source)));
  if (both !== undefined) {
    throw new Error(
      `${both.labware} ${both.well} is both a source and a well to fill. A well can be only one.`,
    );
  }
}

// A copy of `settings`, checked as a stage's (the stage list, then the mixing rule at each end, then
// MIX_STEP_MODE's technique at both ends or neither), and not a mix step's.
function checkedRandomizationSettings(settings) {
  // A stage list of one stage checks the settings as the plan's stage list would.
  const { stageList, id } = new StageList().add(NEW_STAGE_NAME, settings);
  for (const end of ENDS) {
    checkMixingMatches(settings, end);
  }
  if (isMixStepSettings(settings)) {
    throw new Error(
      "A randomization's transfers move liquid, so its settings can't be a mix step's.",
    );
  }
  checkMixStepTechniqueAtBothEndsOrNeither(settings);
  return { ...stageList.get(id).settings };
}

// Throws if `tipType` isn't in TIP_TYPES, as setTipType does.
function checkTipType(tipType) {
  if (!TIP_TYPES.includes(tipType)) {
    throw new Error(
      `${describeValue(tipType)} isn't a tip type. Choose one of ${listNames(TIP_TYPES)}.`,
    );
  }
}

// True if two randomizations hold the same values (compared as JSON, since they're plain data).
function sameRandomization(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

// The plan with the randomization of the same ID replaced by `randomization`, in its place.
function withRandomizationReplaced(plan, randomization) {
  return withParts(plan, {
    randomizations: plan.randomizations.map((candidate) =>
      candidate.id === randomization.id ? randomization : candidate,
    ),
  });
}

// The pool for a randomization (random-pool.md): an item per source, keyed "source 1" … by its
// place, the filler's key or null, the wells to fill keyed "well 1" …, and the seed.
function poolOf(randomization) {
  const items = randomization.sources.map((source, index) => ({
    key: `source ${index + 1}`,
    replicates: source.replicates,
  }));
  const fillerIndex = randomization.sources.findIndex((source) => source.filler);
  return {
    items,
    filler: fillerIndex === -1 ? null : `source ${fillerIndex + 1}`,
    wells: randomization.fill.map((_, index) => `well ${index + 1}`),
    seed: randomization.seed,
  };
}

// A pool problem in the designer's words (section 3), or null for one it never has (an invalid
// replicate count or seed, which setRandomization refuses).
function poolProblemMessage(plan, randomization, problem) {
  switch (problem.kind) {
    case "replicates-missing":
      return `${sourceName(plan, randomization.id, randomization.sources[problem.index])} needs a number of replicates.`;
    case "too-many":
      return (
        `${problem.needed} replicates, but only ${problem.available} ` +
        `${problem.available === 1 ? "well" : "wells"} to fill.`
      );
    case "spare-without-filler":
      return (
        `${problem.spare} ${problem.spare === 1 ? "well" : "wells"} left over: ` +
        "make a source the filler, or unpick them."
      );
    case "seed-missing":
      return "Type a seed.";
    default:
      return null;
  }
}

// The stages a randomization owns that are in the plan, in its order, e.g. [{ labware, well, stage }].
function ownedStagesIn(plan, randomization) {
  return randomization.stages.filter((owned) => plan.stageList.has(owned.stage));
}

// The place in the stage order a randomization sits at: its first stage's, or, with none, its
// beforeId's (the stage order's length for null).
function randomizationPlaceIndex(plan, randomization) {
  const owned = ownedStagesIn(plan, randomization);
  const order = plan.stageOrder;
  if (owned.length > 0) {
    return order.indexOf(owned[0].stage);
  }
  return randomization.beforeId === null ? order.length : order.indexOf(randomization.beforeId);
}

// What every well holds just before a randomization: the starting contents with the transfers of
// the stages before its place replayed (contents-tracking), as a ContentsSnapshot.
function contentsBefore(plan, randomization) {
  const placeIndex = randomizationPlaceIndex(plan, randomization);
  const before = new Set(plan.stageOrder.slice(0, placeIndex));
  // The operation list's blocks follow the stage order, so the stages before the place are its
  // first blocks.
  let count = 0;
  for (const { stage, transfersDone } of stageEnds(plan)) {
    if (before.has(stage)) {
      count = transfersDone;
    }
  }
  return replay(plan.startingContents, plan.operationList, count);
}

// For each source, by its place in sources, the wells to fill it gets, in fill's order, e.g.
// [[{ labware: "Plate1", well: "B3" }, …], [], …], from assignPool.
function wellsForEachSource(randomization) {
  const wellsBySource = randomization.sources.map(() => []);
  for (const { well, key } of assignPool(poolOf(randomization))) {
    const sourceIndex = Number(key.slice("source ".length)) - 1;
    wellsBySource[sourceIndex].push(randomization.fill[Number(well.slice("well ".length)) - 1]);
  }
  return wellsBySource;
}

// The stage a run adds new stages before (section 3, "Running", step 2): the stage just after the
// randomization's last owned stage, or, with none, its beforeId; null for last.
function runPlace(plan, randomization) {
  const owned = ownedStagesIn(plan, randomization);
  if (owned.length === 0) {
    return randomization.beforeId;
  }
  const order = plan.stageOrder;
  return order[order.indexOf(owned.at(-1).stage) + 1] ?? null;
}

// The place of the source a randomization's owned stage is for, or -1 if it's no longer a source.
function sourceIndexOf(randomization, owned) {
  return randomization.sources.findIndex((source) => wellKey(source) === wellKey(owned));
}

// Returns the plan with a new stage, on new tips, before `place`, for each source that gets wells
// but has no stage yet, in source order, named `names[i]`; the randomization's stages list them after
// its own. Randomizations that haven't run, earlier in the list and sitting at the same place, move
// onto its first stage, so they stay above it.
function withNewSourceStages(plan, randomization, wellsBySource, place, names) {
  let adding = plan;
  const stages = [...ownedStagesIn(plan, randomization)];
  randomization.sources.forEach((source, index) => {
    const hasStage = stages.some((owned) => wellKey(owned) === wellKey(source));
    if (wellsBySource[index].length === 0 || hasStage) {
      return;
    }
    const { plan: added, id } = addStageWithNewTips(adding, place);
    adding = renameStage(added, id, names[index]);
    stages.push({ labware: source.labware, well: source.well, stage: id });
  });
  const firstRun = ownedStagesIn(plan, randomization).length === 0;
  const ownIndex = plan.randomizations.findIndex((candidate) => candidate.id === randomization.id);
  const randomizations = adding.randomizations.map((candidate, index) => {
    if (candidate.id === randomization.id) {
      return { ...candidate, stages };
    }
    const sitsAbove =
      firstRun &&
      index < ownIndex &&
      candidate.stages.length === 0 &&
      candidate.beforeId === place &&
      stages.length > 0;
    return sitsAbove ? { ...candidate, beforeId: stages[0].stage } : candidate;
  });
  return withParts(adding, { randomizations });
}

// Returns the plan without the stages of randomization `id` whose source is no longer one of its
// sources, or gets no wells (section 3, "Running", step 4), each removed with removeStage.
function withoutUnusedSourceStages(plan, id, wellsBySource) {
  const randomization = randomizationAt(plan, id);
  const unused = randomization.stages.filter((owned) => {
    const index = sourceIndexOf(randomization, owned);
    return index === -1 || wellsBySource[index].length === 0;
  });
  let removing = plan;
  for (const owned of unused) {
    removing = removeStage(removing, owned.stage);
  }
  const kept = randomization.stages.filter((owned) => !unused.includes(owned));
  return withRandomizationReplaced(removing, { ...randomizationAt(removing, id), stages: kept });
}

// Returns the plan with `owned`, one of a randomization's stages ({ labware, well, stage }), set as
// its source's stage (section 3, "Running", step 5): its settings, its tips (its own tip change, or
// START's if it's the first stage) and its transfers, one of the randomization's volume from the
// source to each of `wells`, in order.
function withSourceStageSet(plan, randomization, owned, wells) {
  const stageId = owned.stage;
  let setting = changeStageSettings(plan, stageId, randomization.settings);
  const tipKey = stageOrder(setting)[0] === stageId ? START : stageId;
  if (tipKey !== START && !Object.hasOwn(setting.tipChanges, stageId)) {
    setting = addTipChange(setting, stageId);
  }
  setting = setTipType(setting, tipKey, randomization.tipType);
  setting = setTipProbes(setting, tipKey, randomization.probes);
  let operationList = setting.operationList;
  for (const position of positionsInStage(setting, stageId).reverse()) {
    operationList = operationList.remove(position);
  }
  setting = withParts(setting, { operationList });
  return addTransfers(
    setting,
    wells.map((destination) => ({
      type: "transfer",
      source: { labware: owned.labware, well: owned.well },
      destination: { labware: destination.labware, well: destination.well },
      volume: randomization.volume,
      stage: stageId,
    })),
  );
}

// Returns the plan with randomization `id`'s stages listed in stage order, and its beforeId the
// stage just after its last stage (null for none), as each run leaves them (section 3, step 6).
function withRunPlaceNoted(plan, id) {
  const randomization = randomizationAt(plan, id);
  const order = plan.stageOrder;
  const stages = [...randomization.stages].sort(
    (first, second) => order.indexOf(first.stage) - order.indexOf(second.stage),
  );
  const last = stages.at(-1).stage;
  const beforeId = order[order.indexOf(last) + 1] ?? null;
  return withRandomizationReplaced(plan, { ...randomization, stages, beforeId });
}

// True if stage `id` is just after a randomization's last stage in the stage order.
function isJustAfterRandomization(plan, id) {
  const order = plan.stageOrder;
  return plan.randomizations.some((randomization) => {
    const owned = ownedStagesIn(plan, randomization);
    return owned.length > 0 && order[order.indexOf(owned.at(-1).stage) + 1] === id;
  });
}

// The tips stage `id` uses: its tip group's { tipType, probes }.
function tipsInUseAt(plan, id) {
  const group = tipGroups(plan).find((candidate) => candidate.stages.includes(id));
  return { tipType: group.tipType, probes: group.probes };
}

// Returns the plan after stage `removedId` was removed (section 3, "Where it sits", and the two
// rules of "It owns its stages"): `nextId` (the stage that followed it, or null) gets `keptTips` if
// it was just after a randomization and has no tips of its own; and randomizations sitting before
// the removed stage move to `nextId`, which gets a tip change loading the tips in use there if it
// doesn't start a tip group.
function withRandomizationsAfterRemove(plan, removedId, nextId, keptTips) {
  let after = plan;
  if (keptTips !== null && nextId !== null && !isFirstOfTipGroup(after, nextId)) {
    after = withParts(after, { tipChanges: withKey(after.tipChanges, nextId, keptTips) });
  }
  if (!after.randomizations.some((randomization) => randomization.beforeId === removedId)) {
    return after;
  }
  if (nextId !== null && !isFirstOfTipGroup(after, nextId)) {
    after = addTipChange(after, nextId);
  }
  return withParts(after, {
    randomizations: after.randomizations.map((randomization) =>
      randomization.beforeId === removedId ? { ...randomization, beforeId: nextId } : randomization,
    ),
  });
}

// Returns the plan after new stage `newId` was added just before `beforeId` (null: last), keeping
// each randomization's place: one that has run and noted `beforeId` as the stage just after it now
// has the new stage just after it; one that hasn't run, sitting before a stage that no longer starts
// a tip group (the new stage took its tips), moves onto the new stage.
function withRandomizationsAfterAdd(plan, beforeId, newId) {
  let changed = false;
  const randomizations = plan.randomizations.map((randomization) => {
    if (randomization.beforeId !== beforeId) {
      return randomization;
    }
    const hasRun = randomization.stages.length > 0;
    if (hasRun || (beforeId !== null && !isFirstOfTipGroup(plan, beforeId))) {
      changed = true;
      return { ...randomization, beforeId: newId };
    }
    return randomization;
  });
  return changed ? withParts(plan, { randomizations }) : plan;
}

// Throws if removing the tip change at `key` would make a randomization share tips: `key` is just
// after a randomization's last stage, or a randomization that hasn't run sits before it.
function checkNoRandomizationNeedsTips(plan, key) {
  if (isJustAfterRandomization(plan, key)) {
    throw new Error(
      `This tip change keeps ${stageNamedInText(plan, key)}, off the ` +
        "randomization's tips. A randomization never shares tips.",
    );
  }
  const sitting = plan.randomizations.some(
    (randomization) => randomization.stages.length === 0 && randomization.beforeId === key,
  );
  if (sitting) {
    throw new Error(
      `A randomization sits before ${stageNamedInText(plan, key)}, between ` +
        "tip groups, so these tips can't be removed.",
    );
  }
}

// A copy of `randomization` as a plan stores it, checked strictly (setRandomizations' order of
// checks), `number` being its place in the list from 1.
function checkedStoredRandomization(plan, randomization, number) {
  if (!hasExactly(randomization, RANDOMIZATION_PROPERTIES)) {
    throw new Error(
      `Randomization ${number} must be an object with exactly ${listNamesWithAnd(RANDOMIZATION_PROPERTIES)}.`,
    );
  }
  const { id } = randomization;
  if (typeof id !== "string" || !/^r[1-9][0-9]*$/.test(id)) {
    throw new Error(
      `Randomization ${number}'s ID must be "r" and a whole number, like "r1", but got ${describeValue(id)}.`,
    );
  }
  const prefix = `Randomization ${number}: `;
  return withPrefix(prefix, () => {
    const changes = Object.fromEntries(
      RANDOMIZATION_CHANGES.map((property) => [property, randomization[property]]),
    );
    const values = checkedRandomizationValues(changes, { sources: [], fill: [] });
    checkStoredOrder(randomization, values);
    const stored = { id, beforeId: randomization.beforeId, ...values };
    stored.stages = checkedOwnedStages(plan, randomization.stages);
    return stored;
  });
}

// Throws if a randomization of `plan` sits where it can't (section 3, "Where it sits"), prefixed
// "Randomization N: ". Checked against the plan's whole list of randomizations, so one sitting
// before another's later stage is refused whichever comes first in the list.
function checkStoredPlaces(plan) {
  plan.randomizations.forEach(({ id, beforeId }, index) => {
    withPrefix(`Randomization ${index + 1}: `, () => checkRandomizationPlace(plan, beforeId, id));
  });
}

// Throws if a stored randomization's wells to fill aren't in deck order, or its probes aren't
// smallest first: `values` holds them as they'd be stored.
function checkStoredOrder(randomization, values) {
  const position = randomization.fill.findIndex(
    (end, index) => wellKey(end) !== wellKey(values.fill[index]),
  );
  if (position !== -1) {
    const later = randomization.fill[position];
    const earlier = values.fill[position];
    throw new Error(
      `its wells to fill must be in deck order, but ${later.labware} ${later.well} comes before ` +
        `${earlier.labware} ${earlier.well}.`,
    );
  }
  if (randomization.probes.some((probe, index) => probe !== values.probes[index])) {
    throw new Error("its probes must be listed smallest first.");
  }
}

// A stored randomization's stages, checked (section 5's order): a list of { labware, well, stage };
// each stage in the plan, none twice, no well twice; consecutive and in stage order; each the only
// stage of its tip group; none a mix step. Returns copies. A stage's well needn't be one of the
// sources: setRandomization leaves a dropped source's stage until the next run.
function checkedOwnedStages(plan, stages) {
  const formMessage = `its stages must be a list of objects with exactly ${listNamesWithAnd(OWNED_STAGE_PROPERTIES)}.`;
  if (!Array.isArray(stages) || !stages.every((owned) => hasExactly(owned, OWNED_STAGE_PROPERTIES))) {
    throw new Error(formMessage);
  }
  const seenStages = new Set();
  const seenWells = new Set();
  for (const owned of stages) {
    if (!plan.stageList.has(owned.stage)) {
      throw new Error(`its stage ${describeValue(owned.stage)} isn't in the plan.`);
    }
    if (seenStages.has(owned.stage)) {
      throw new Error(`stage ${describeValue(owned.stage)} is listed twice.`);
    }
    seenStages.add(owned.stage);
    if (seenWells.has(wellKey(owned))) {
      throw new Error(`${owned.labware} ${owned.well} has two stages.`);
    }
    seenWells.add(wellKey(owned));
  }
  const order = plan.stageOrder;
  const places = stages.map((owned) => order.indexOf(owned.stage));
  if (places.some((place, index) => index > 0 && place !== places[index - 1] + 1)) {
    throw new Error("its stages must come one after another, in stage order.");
  }
  for (const owned of stages) {
    const next = order[order.indexOf(owned.stage) + 1];
    const alone = isFirstOfTipGroup(plan, owned.stage) && (next === undefined || isFirstOfTipGroup(plan, next));
    if (!alone) {
      throw new Error(`stage ${describeValue(owned.stage)} must be the only stage of its tip group.`);
    }
    if (isMixStep(plan, owned.stage)) {
      throw new Error(`stage ${describeValue(owned.stage)} is a mix step.`);
    }
  }
  return stages.map(({ labware, well, stage }) => ({ labware, well, stage }));
}

// Throws if two randomizations share an ID: 'Randomizations 1 and 3 both have the ID "r2".'
function checkRandomizationIdsUnique(randomizations) {
  const firstById = new Map();
  randomizations.forEach(({ id }, index) => {
    if (firstById.has(id)) {
      throw new Error(
        `Randomizations ${firstById.get(id) + 1} and ${index + 1} both have the ID ${describeValue(id)}.`,
      );
    }
    firstById.set(id, index);
  });
}

// Throws if a stage is owned by two randomizations: 'Stage "5" belongs to two randomizations, 1 and 2.'
function checkStagesOwnedOnce(randomizations) {
  const ownerByStage = new Map();
  randomizations.forEach((randomization, index) => {
    for (const { stage } of randomization.stages) {
      if (ownerByStage.has(stage)) {
        throw new Error(
          `Stage ${describeValue(stage)} belongs to two randomizations, ${ownerByStage.get(stage) + 1} ` +
            `and ${index + 1}.`,
        );
      }
      ownerByStage.set(stage, index);
    }
  });
}

// True if `value` is an object with exactly the properties `names`.
function hasExactly(value, names) {
  return (
    isObject(value) &&
    findMissingProperties(value, names).length === 0 &&
    findExtraProperties(value, names).length === 0
  );
}

// Names in quotes, joined with commas and a final "and", e.g. ["a", "b", "c"] → '"a", "b" and "c"'.
function listNamesWithAnd(names) {
  return `${listNames(names.slice(0, -1))} and ${describeValue(names.at(-1))}`;
}

// Runs `check`, returning what it returns; if it throws, throws its message with `prefix` before it,
// e.g. withPrefix("Source 2: ", () => checkWell(source)).
function withPrefix(prefix, check) {
  try {
    return check();
  } catch (error) {
    throw new Error(`${prefix}${error.message}`);
  }
}


// Throws if `wells`, the well labels for the labware called `labware`, aren't as a plan stores
// them: the labware on the deck; `wells` an object, not empty; each well on the labware's grid,
// with a label as a plan stores it, e.g. checkLabwareWellLabels("Deep1", {}) throws 'The well
// labels for Deep1 are empty. …'.
function checkLabwareWellLabels(labware, wells) {
  // gridOf throws the deck's own message for a labware that isn't on the deck.
  gridOf(labware);
  if (!isObject(wells)) {
    throw new Error(
      `The well labels for ${labware} must be an object of wells and labels, ` +
        `like { A1: "Cond 1" }, but got ${describeValue(wells)}.`,
    );
  }
  if (Object.keys(wells).length === 0) {
    throw new Error(
      `The well labels for ${labware} are empty. ` +
        "A labware without labeled wells is left out of the well labels.",
    );
  }
  for (const [well, label] of Object.entries(wells)) {
    checkWell({ labware, well });
    checkWellLabelAsStored(`${labware} ${well}`, label);
  }
}

// Throws if `label`, the label for the well named `where` (e.g. "Deep1 A1"), isn't as a plan stores
// it: text, not blank, without spaces at its ends, e.g. checkWellLabelAsStored("Deep1 A1", "")
// throws 'The label for Deep1 A1 is blank. …'.
function checkWellLabelAsStored(where, label) {
  if (typeof label !== "string") {
    throw new Error(
      `The label for ${where} must be text, like "Cond 1", but got ${describeValue(label)}.`,
    );
  }
  if (label.trim() === "") {
    throw new Error(
      `The label for ${where} is blank. A well without a label is left out of the well labels.`,
    );
  }
  if (label !== label.trim()) {
    throw new Error(
      `The label for ${where}, ${describeValue(label)}, has spaces at the start or end. Remove them.`,
    );
  }
}

// Returns { plan, id }: the plan with a new stage of one kind (a transfer stage or a mix step) just
// before stage `beforeId` (or last, for null), as addStage and addMixStep describe. `kind` says
// which: { name, isOfKind, defaults }: the new stage's name; a function telling whether a stage's
// settings are of this kind; and a function giving the settings when no stage of this kind is
// there to copy. Throws if `beforeId` isn't a stage or null.
function addStageOfKind(plan, beforeId, takeTips, kind) {
  if (beforeId !== null && !plan.stageList.has(beforeId)) {
    throw new Error(`There's no stage ${describeValue(beforeId)} to add a stage before.`);
  }
  const order = plan.stageOrder;
  const newPlace = beforeId === null ? order.length : order.indexOf(beforeId);
  const copiedFrom = nearestOfKind(plan, newPlace, kind.isOfKind);
  const settings =
    copiedFrom === undefined ? kind.defaults() : plan.stageList.get(copiedFrom).settings;
  const { stageList, id } = plan.stageList.add(kind.name, settings);

  let tipChanges = plan.tipChanges;
  if (takeTips && beforeId !== null && Object.hasOwn(tipChanges, beforeId)) {
    tipChanges = withKey(withoutKey(tipChanges, beforeId), id, tipChanges[beforeId]);
  }
  const added = withParts(plan, {
    stageList,
    stageOrder: [...order.slice(0, newPlace), id, ...order.slice(newPlace)],
    tipChanges,
  });
  return { plan: withStartTipsFirst(added), id };
}

// Returns the plan with new stage `id` in a tip group of its own: a tip change before it (unless
// it's the first stage, whose tips are the START ones), and one before `afterId`, the stage just
// after it (null for none), if that has none, each loading the tips in use there, as addTipChange
// does. So the new stage shares tips with nothing, and the stage after it keeps the tips it had.
// The stage after it gets its tip change first, while the tips in use there are still the ones it
// had (they're the same either way, since the new stage's tip change loads those tips too).
function withOwnTipGroup(plan, id, afterId) {
  let withTips = plan;
  if (afterId !== null && !Object.hasOwn(withTips.tipChanges, afterId)) {
    withTips = addTipChange(withTips, afterId);
  }
  if (stageOrder(withTips)[0] !== id) {
    withTips = addTipChange(withTips, id);
  }
  return withTips;
}

// The ID of the stage a new stage at `newPlace` in the stage order copies: the nearest stage before
// that place whose settings pass `isOfKind`, or, with none before it, the nearest after it; or
// undefined if there's none (transfer-designer.md, "Stages"), e.g. with stage order ["1", "2", "3"],
// where "2" is a mix step, a transfer stage at place 2 (between "2" and "3") copies "1".
function nearestOfKind(plan, newPlace, isOfKind) {
  const order = plan.stageOrder;
  const isKind = (id) => isOfKind(plan.stageList.get(id).settings);
  // findLast searches from the end back, so it finds the nearest before the new place.
  const before = order.slice(0, newPlace).findLast(isKind);
  return before ?? order.slice(newPlace).find(isKind);
}

// The default mix step settings, for a mix step with no other to copy: MIX_STEP_MODE's technique and
// liquid type at both ends, no source mix, and DEFAULT_MIX at the destination, since MixOnly2 mixes
// at the dispense end (transfer-designer.md, "Mix steps"). A new object each time.
function defaultMixStepSettings() {
  return {
    sourceTechnique: MIX_STEP_MODE.technique,
    sourceLiquidType: MIX_STEP_MODE.liquidType,
    destinationTechnique: MIX_STEP_MODE.technique,
    destinationLiquidType: MIX_STEP_MODE.liquidType,
    sourceMix: null,
    destinationMix: { ...DEFAULT_MIX },
  };
}

// True if a stage's `settings` are a mix step's: MIX_STEP_MODE's technique and liquid type at both
// ends, whatever its mixes.
function isMixStepSettings(settings) {
  return ENDS.every(
    (end) =>
      settings[`${end}Technique`] === MIX_STEP_MODE.technique &&
      settings[`${end}LiquidType`] === MIX_STEP_MODE.liquidType,
  );
}

// True if `transfer` is a mixed well: from a well into itself, of MIX_STEP_VOLUME.
function isMixedWell(transfer) {
  return (
    wellKey(transfer.source) === wellKey(transfer.destination) &&
    transfer.volume === MIX_STEP_VOLUME
  );
}

// The transfer that mixes `well` in mix step `id`: from the well into itself, of MIX_STEP_VOLUME,
// e.g. mixedWellTransfer("2", { labware: "Plate1", well: "A1" }) → { type: "transfer",
// source: { labware: "Plate1", well: "A1" }, destination: { … the same }, volume: 1, stage: "2" }.
function mixedWellTransfer(id, well) {
  const end = { labware: well.labware, well: well.well };
  return {
    type: "transfer",
    source: end,
    destination: { ...end },
    volume: MIX_STEP_VOLUME,
    stage: id,
  };
}

// Throws unless stage `id` is a mix step: 'There's no stage "9" in the plan.' for an ID that isn't a
// stage, or 'Stage 2, “Drugs”, isn't a mix step, so it can't mix wells.'
function checkMixStep(plan, id) {
  if (!plan.stageList.has(id)) {
    throw new Error(`There's no stage ${describeValue(id)} in the plan.`);
  }
  if (!isMixStep(plan, id)) {
    throw new Error(`${stageNamed(plan, id)}, isn't a mix step, so it can't mix wells.`);
  }
}

// A stage named by its place in the stage order (from 1) and its name, as messages start with it,
// e.g. 'Stage 2, “Mix plate”'.
function stageNamed(plan, id) {
  return `Stage ${plan.stageOrder.indexOf(id) + 1}, “${plan.stageList.get(id).name}”`;
}

// A stage named as stageNamed names it, for the middle of a sentence, e.g. 'stage 2, “Mix plate”'.
function stageNamedInText(plan, id) {
  return `stage ${plan.stageOrder.indexOf(id) + 1}, “${plan.stageList.get(id).name}”`;
}

// Throws if stage `id`'s new `settings` break a mix step rule (transfer-designer.md, "Mix steps"),
// checked in this order: MIX_STEP_MODE's technique at one end only; a mix step with a source mix;
// a mix step without a destination mix; a stage with transfers changing kind (a transfer stage
// becoming a mix step, or the reverse). A stage without transfers may change kind, since a plan
// file gives its stages their settings before their transfers.
// e.g. a mix step given a source mix throws 'A mix step mixes after dispensing only, so it can't
// have a source mix.'
function checkMixStepSettings(plan, id, settings) {
  checkMixStepTechniqueAtBothEndsOrNeither(settings);
  const becomesMixStep = isMixStepSettings(settings);
  if (becomesMixStep && settings.sourceMix !== null) {
    throw new Error("A mix step mixes after dispensing only, so it can't have a source mix.");
  }
  if (becomesMixStep && settings.destinationMix === null) {
    throw new Error("A mix step needs a destination mix: that's what it does.");
  }
  if (becomesMixStep !== isMixStep(plan, id) && transfersIn(plan, id).length > 0) {
    throw new Error(
      becomesMixStep
        ? `${stageNamed(plan, id)}, has transfers, so it can't become a mix step.`
        : `${stageNamed(plan, id)}, has mixed wells, so it can't become a transfer stage.`,
    );
  }
}

// Throws if MIX_STEP_MODE's technique, which only mixes, is used at one end of `settings` only.
function checkMixStepTechniqueAtBothEndsOrNeither(settings) {
  const atEnds = ENDS.filter((end) => settings[`${end}Technique`] === MIX_STEP_MODE.technique);
  if (atEnds.length === 1) {
    throw new Error(
      `${describeValue(MIX_STEP_MODE.technique)} only mixes, so it's used at both ends of a mix ` +
        `step or at neither.`,
    );
  }
}

// The pipetting mode that a stage's `settings` use at `end`: the mode for that end whose liquid type
// is the end's and whose technique, or mixing technique, is the end's; undefined if none is. The
// configuration's tests make sure at most one matches.
function modeAt(end, settings) {
  const technique = settings[`${end}Technique`];
  return modesFor(end).find(
    (mode) =>
      mode.liquidType === settings[`${end}LiquidType`] &&
      (mode.technique === technique || mode.mixingTechnique === technique),
  );
}

// Throws if, at `end` of a stage's `settings`, the technique doesn't match the mixing: an end that
// is one of the modes mixes exactly when its technique is that mode's mixing technique
// (transfer-designer.md, section 3, "Mixing"). An end that isn't one of the modes isn't checked,
// since the tool can't know whether its technique mixes.
// e.g. a source mixing with Medium's "Operation" throws 'The source mixes, so its technique must be
// "OperationMix" (Medium's technique for mixing), but it's "Operation".'
function checkMixingMatches(settings, end) {
  const mode = modeAt(end, settings);
  if (mode === undefined) {
    return;
  }
  const technique = settings[`${end}Technique`];
  const mixes = settings[`${end}Mix`] !== null;
  if (mixes && mode.mixingTechnique === null) {
    throw new Error(
      `The ${end} mixes, but ${mode.name} can't mix. ` +
        `Turn the ${end}'s mixing off, or choose another mode.`,
    );
  }
  if (mixes && technique !== mode.mixingTechnique) {
    throw new Error(
      `The ${end} mixes, so its technique must be ${describeValue(mode.mixingTechnique)} ` +
        `(${mode.name}'s technique for mixing), but it's ${describeValue(technique)}.`,
    );
  }
  if (!mixes && technique !== mode.technique) {
    throw new Error(
      `The ${end} doesn't mix, so its technique must be ${describeValue(mode.technique)} ` +
        `(${mode.name}'s technique without mixing), but it's ${describeValue(technique)}.`,
    );
  }
}

// True if mixes `a` and `b` are the same: both null, or equal share, times and speed.
function sameMix(a, b) {
  if (a === null || b === null) {
    return a === b;
  }
  return a.share === b.share && a.times === b.times && a.speed === b.speed;
}

// The positions in the operation list of stage `id`'s transfers, in order, e.g. [3, 4, 5].
function positionsInStage(plan, id) {
  const positions = [];
  plan.operationList.listOperations().forEach((operation, position) => {
    if (operation.stage === id) {
      positions.push(position);
    }
  });
  return positions;
}

// Returns the plan with `transfer`, the first in its stage (already checked), placed just before the
// next stage in the stage order that has transfers, or last, so the operation list's blocks stay in
// the stage order (transfer-designer.md, section 3, "Transfers").
function withFirstTransfer(plan, transfer) {
  const order = plan.stageOrder;
  const withTransfers = new Set(plan.operationList.groupByStage().map((group) => group.stage));
  const nextWithTransfers = order
    .slice(order.indexOf(transfer.stage) + 1)
    .find((id) => withTransfers.has(id));
  const operationList =
    nextWithTransfers === undefined
      ? plan.operationList.add(transfer)
      : plan.operationList.insertBeforeStage(transfer, nextWithTransfers);
  return withParts(plan, { operationList });
}

// Returns the plan with a tip change before the first stage in the stage order, if there is one,
// made the START one (its tip type and probes replace START's), so there's never a tip change
// before the first stage but START. Otherwise returns the plan as it is.
function withStartTipsFirst(plan) {
  const first = stageOrder(plan)[0];
  if (!Object.hasOwn(plan.tipChanges, first)) {
    return plan;
  }
  const tipChanges = withKey(withoutKey(plan.tipChanges, first), START, plan.tipChanges[first]);
  return withParts(plan, { tipChanges });
}

// Throws if there's no tip change at `key`, e.g. 'There are no new tips before stage "2".'
function checkTipChangeAt(plan, key) {
  if (!Object.hasOwn(plan.tipChanges, key)) {
    throw new Error(`There are no new tips before stage ${describeValue(key)}.`);
  }
}

// Throws if `probes` isn't a list of at least one probe number, 1 to 8, each listed once,
// e.g. [1, 3] is fine; [], [9] and [3, 1, 3] throw. (These checks and their messages moved here
// from the stage list, unchanged, with probes, on 2026-10-30.)
function checkProbes(probes) {
  if (!Array.isArray(probes) || probes.length === 0) {
    throw new Error(
      `The probes must be a list of probe numbers from 1 to ${PROBE_COUNT}, like [1, 2, 3, 4], but got ${describeValue(probes)}.`,
    );
  }
  // findIndex, not find: find returns undefined both for "none found" and for a hole in the list,
  // so a list such as [ , 1] would slip through.
  const badPosition = probes.findIndex((probe) => !isProbeNumber(probe));
  if (badPosition !== -1) {
    throw new Error(
      `Probe numbers must be whole numbers from 1 to ${PROBE_COUNT}, but got ${describeValue(probes[badPosition])}.`,
    );
  }
  // A probe is repeated if it was already seen earlier in the list. Every probe is a number by now,
  // so undefined can only mean none is repeated.
  const repeated = probes.find((probe, position) => probes.indexOf(probe) !== position);
  if (repeated !== undefined) {
    throw new Error(`Probe ${repeated} is listed more than once. List each probe once.`);
  }
}

// True if `probe` is a whole number from 1 to 8, e.g. 3 → true; 0, 9, 2.5 and "1" → false.
// Number.isInteger is false for anything that isn't a number, so text such as "1" is refused.
function isProbeNumber(probe) {
  return Number.isInteger(probe) && probe >= 1 && probe <= PROBE_COUNT;
}

// Throws if the plan has no component called `name`.
function checkComponentExists(plan, name) {
  if (!plan.components.some((component) => component.name === name)) {
    throw new Error(
      `There's no component called ${describeValue(name)} in this plan. Add it to the plan's components first.`,
    );
  }
}

// Returns `name` with spaces at its ends removed, if it's text, after checking it can be a new
// component's name: a name (checkName) that no component has yet. Throws if not.
function checkNewComponentName(plan, name) {
  const trimmed = typeof name === "string" ? name.trim() : name;
  checkName(trimmed, "component name");
  if (plan.components.some((component) => component.name === trimmed)) {
    throw new Error(
      `There's already a component called ${describeValue(trimmed)}. Choose a different name.`,
    );
  }
  return trimmed;
}

// Throws if `color` isn't text that isn't blank, or if a component other than `ownName` (null for a
// new component) already has it, so components can always be told apart where colors are drawn.
function checkComponentColor(plan, color, ownName) {
  if (typeof color !== "string" || color.trim() === "") {
    throw new Error(
      `A component's color must be text, like "#4e79a7", but got ${describeValue(color)}.`,
    );
  }
  const other = plan.components.find(
    (component) => component.name !== ownName && component.color === color,
  );
  if (other !== undefined) {
    throw new Error(`${other.name} already has that color. Choose a different one.`);
  }
}

// Throws if `label`, the label for the labware called `name`, isn't as a plan stores it: text, not
// blank, without spaces at its ends, and not the labware's own name (a labware without a label is
// left out of the labels), e.g. checkLabelAsStored("Plate", "Plate") throws.
function checkLabelAsStored(name, label) {
  if (typeof label !== "string") {
    throw new Error(
      `The label for ${name} must be text, like "Assay plate", but got ${describeValue(label)}.`,
    );
  }
  if (label.trim() === "") {
    throw new Error(
      `The label for ${name} is blank. A labware without a label is left out of the labels.`,
    );
  }
  if (label !== label.trim()) {
    throw new Error(
      `The label for ${name}, ${describeValue(label)}, has spaces at the start or end. Remove them.`,
    );
  }
  if (label === name) {
    throw new Error(
      `The label for ${name} is its own name. A labware without a label is left out of the labels.`,
    );
  }
}

// Throws if, with `labels` as the plan's labels, two labware would show one label, counting a
// labware without a label as shown by its name. Names the first such pair in the deck's order,
// e.g. { Plate: "Deep" } throws 'Plate and Deep would both show as "Deep". …'.
function checkNoSharedLabel(labels) {
  // For each label shown so far, the labware showing it.
  const shownBy = new Map();
  for (const name of labwareNames()) {
    const shown = Object.hasOwn(labels, name) ? labels[name] : name;
    if (shownBy.has(shown)) {
      throw new Error(
        `${shownBy.get(shown)} and ${name} would both show as ${describeValue(shown)}. ` +
          "Give each labware a different label.",
      );
    }
    shownBy.set(shown, name);
  }
}

// The plan's starting contents with `change` applied to the components of each entry that holds
// component `name`; the other entries are the very same objects as before.
function changeEntriesHolding(plan, name, change) {
  return plan.startingContents.map((entry) =>
    Object.hasOwn(entry.components, name)
      ? { ...entry, components: change(entry.components) }
      : entry,
  );
}

// One text key for a well, for looking it up in a Map or Set, e.g. { labware: "Res", well: "1" } →
// '["Res","1"]'. A JSON list keeps the two names apart, as in contents-tracking.
function wellKey(end) {
  return JSON.stringify([end.labware, end.well]);
}

// A copy of `object` with `key` set to `value`, e.g. withKey({ a: 1 }, "b", 2) → { a: 1, b: 2 }.
function withKey(object, key, value) {
  return { ...object, [key]: value };
}

// A copy of `object` without `key`, e.g. withoutKey({ a: 1, b: 2 }, "a") → { b: 2 }.
function withoutKey(object, key) {
  return Object.fromEntries(Object.entries(object).filter(([existing]) => existing !== key));
}

// A new plan: `plan` with `changes` (some of its parts, e.g. { components: […] }) replacing those
// parts. Every other part is the very same object as in `plan`, so plans share what didn't change.
function withParts(plan, changes) {
  return deepFreeze({ ...plan, ...changes });
}

// Freezes `value` and everything in it, if it's a list or a plain object not yet frozen, and
// returns it, e.g. deepFreeze({ a: [1] }) freezes the object and its list. Plans use it so that
// changing any part of one throws, as a plan must never change after it's made. Parts already frozen
// are skipped, which keeps it quick when most parts are shared with an earlier plan. Anything else
// (text, numbers, null, and class instances such as the operation list and stage list, which are
// immutable already) is returned as it is.
function deepFreeze(value) {
  const isPlainData =
    Array.isArray(value) || (isObject(value) && Object.getPrototypeOf(value) === Object.prototype);
  if (!isPlainData || Object.isFrozen(value)) {
    return value;
  }
  for (const part of Object.values(value)) {
    deepFreeze(part);
  }
  return Object.freeze(value);
}
