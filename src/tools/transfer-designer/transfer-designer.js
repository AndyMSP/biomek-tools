// transfer-designer.js — the transfer designer's rules: what a plan is, and every edit that can be
// made to one, each checked so that a plan is always valid.
//
// A plan holds the components (each with its constituents; ADR 0013), the starting contents, the operation list, the stage list, the stage
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
// NEGLIGIBLE_MICROLITERS, contents tracking's allowance for arithmetic leftovers ("Tiny amounts"),
// is used the same way here: added to a filler well's usable volume before counting its whole
// transfers, so exactly n transfers' worth gives n, and as the most two filler wells' shares of a
// component may differ by and still be one liquid (section 3, "The filler's shares", "Problems").
import {
  replay,
  NEGLIGIBLE_MICROLITERS,
} from "../../shared/contents-tracking/contents-tracking.js";
import { mixVolumes } from "../../shared/mix-volumes/mix-volumes.js";
import { labwareNames, gridOf, checkWell, growthAreaOf } from "../../shared/deck/deck.js";
import { START, tipGroups } from "../../shared/tip-groups/tip-groups.js";
import { checkExperimentName } from "../../shared/file-writer/file-writer.js";
import {
  assignPool,
  findPoolProblems,
  spareWellCount,
  MAX_SEED,
} from "../../shared/random-pool/random-pool.js";
import {
  checkConstituents,
  familyOf,
  unitsOf,
  wellConcentrations,
  isCellFamily,
  seedingDensity,
} from "../../shared/concentrations/concentrations.js";

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
// in `color`, carrying no constituents yet, e.g. addComponent(plan, "Media", "#4e79a7"). Throws,
// in this order, if the name isn't a name or is used, or the color isn't text or is used.
export function addComponent(plan, name, color) {
  const trimmedName = checkNewComponentName(plan, name);
  checkComponentColor(plan, color, null);
  return withParts(plan, {
    components: [...plan.components, { name: trimmedName, color, constituents: [] }],
  });
}

// Returns the plan with component `name` carrying `constituents` (a list of { name, amount, unit };
// concentrations.md), replacing what it carried, names trimmed. Throws, in this order, if there's no
// such component, then as checkConstituents does, then if a constituent's unit is of a different
// family from the one its name already has in another component (transfer-designer.md, section 3,
// "Constituents"): the same name is the same thing across the plan, and families can't be added.
// e.g. setConstituents(plan, "Dye stock", [{ name: "Dye", amount: 10, unit: "mM" }]).
export function setConstituents(plan, name, constituents) {
  checkComponentExists(plan, name);
  const checked = checkConstituents(constituents);
  const others = plan.components.filter((component) => component.name !== name);
  for (const constituent of checked) {
    checkFamilyAgrees(constituent, others);
  }
  return withParts(plan, {
    components: plan.components.map((component) =>
      component.name === name ? { ...component, constituents: checked } : component,
    ),
  });
}

// The concentrations the well `end` ({ labware, well }) carries in `snapshot`, a ContentsSnapshot
// of this plan: a list of { name, family, value } (concentrations.md, wellConcentrations), [] for a
// well carrying nothing. The well is checked by the snapshot's volumeFractionsOf alone: a well it
// has no record of is simply empty.
export function concentrationsOf(plan, snapshot, end) {
  return wellConcentrations(snapshot.volumeFractionsOf(end?.labware, end?.well), plan.components);
}

// The seeding densities of the well `end` ({ labware, well }) in `snapshot`, a ContentsSnapshot of
// this plan: one { name, value } per entry of concentrationsOf in the cells' family, `value` in
// cells/cm² of the well's growth area, in concentrationsOf's order (transfer-designer.md, section
// 3, "Seeding densities"), e.g. [{ name: "Cells", value: 46875 }]. [] when the well's labware has no
// growth area or the well carries no cells. The well's volume is everything it holds, dead volume
// included, since those cells settle too. Throws as concentrationsOf does, then as growthAreaOf does.
export function seedingDensitiesOf(plan, snapshot, end) {
  const concentrations = concentrationsOf(plan, snapshot, end);
  // Looked up even for a well carrying no cells, so whether it throws never depends on the
  // well's contents.
  const growthArea = growthAreaOf(end.labware);
  if (growthArea === null) {
    return [];
  }
  const volume = snapshot.totalVolumeOf(end.labware, end.well);
  return concentrations
    .filter((entry) => isCellFamily(entry.family))
    .map((entry) => ({ name: entry.name, value: seedingDensity(entry.value, volume, growthArea) }));
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
  if (!fillerWellsHoldOneLiquid(randomization, () => contentsBefore(plan, randomization))) {
    problems.push("The filler wells hold different liquids.");
  }
  return problems;
}

// How many of the filler's wells each filler well fills (section 3, "The filler's shares"), as
// [{ index, count }] in sources' order, `index` its place in sources from 0, e.g. three filler
// wells each 750 µL above their dead volume, 100 µL transfers and 18 wells for the filler →
// [{ index: 2, count: 7 }, { index: 3, count: 7 }, { index: 4, count: 4 }]. [] with no filler
// wells; null while the volume or a source's replicates aren't known. Throws if there's no such
// randomization.
export function fillerShares(plan, id) {
  const randomization = checkRandomizationExists(plan, id);
  return sharesOf(randomization, () => contentsBefore(plan, randomization));
}

// True if randomization `id` has run and either has problems now or a run now would give different
// stages (section 3, "Out of date"): a different number of stages, or, for any of them in order, a
// different source well, name or list of transfers (source, destination and volume). Stage IDs
// aren't compared, since a run may make them fresh. The run is a trial on the plan given, which
// never changes. Throws if there's no such randomization.
export function isRandomizationOutOfDate(plan, id) {
  const randomization = checkRandomizationExists(plan, id);
  if (ownedStagesIn(plan, randomization).length === 0) {
    return false;
  }
  if (randomizationProblems(plan, id).length > 0) {
    return true;
  }
  const trial = runRandomization(plan, id);
  return stagesOutline(trial, randomizationAt(trial, id)) !== stagesOutline(plan, randomization);
}

// A source's name (section 3): its well label; otherwise the component it holds most of just before
// the randomization, with " +N" for N others it holds too; otherwise its labware's label and well,
// e.g. "Cond 1", "Drug A +2" or "Deep1 A1". `source` is { labware, well } (other properties are
// ignored). Throws if there's no such randomization, or `source` isn't a well on the deck.
export function sourceName(plan, id, source) {
  const randomization = checkRandomizationExists(plan, id);
  return nameOfSource(plan, () => contentsBefore(plan, randomization), source);
}

// A source's name (sourceName), with what every well holds just before the randomization given by
// `contentsOf`, a function called only when the source has no well label (so a run replays the
// contents once, not once per source), e.g. "Cond 1" or "Drug A +2".
function nameOfSource(plan, contentsOf, source) {
  const label = wellLabelOf(plan, source);
  if (label !== null) {
    return label;
  }
  const components = heldComponents(contentsOf(), source);
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
  // Contents just before the randomization, replayed once per run (section 3, step 5).
  const contents = contentsBefore(plan, randomization);
  const runStages = runStagesOf(plan, randomization, contents);
  const kept = keptEntries(plan, randomization, runStages);
  const place = runPlace(plan, randomization);
  let running = withNewSourceStages(plan, randomization, runStages, kept, place);
  running = withoutUnusedSourceStages(running, id, kept);
  for (const owned of randomizationAt(running, id).stages) {
    const runStage = runStages.find((candidate) => wellKey(candidate.well) === wellKey(owned));
    running = withSourceStageSet(running, randomization, owned, runStage);
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

// --- Moving and copying ---

// What copied items say they are, and the version of their form this module writes and reads
// (transfer-designer.md, "Moving and copying"). Exported, so a tool can recognize copied items on
// the system clipboard by the same text.
export const COPIED_ITEMS_FORMAT = "biomek-tools copied items";
export const COPIED_ITEMS_VERSION = 2;

// The versions of copied items this module reads: version 1 (before several filler wells) and the
// one it writes, with the same checks (section 3, "Copied items version 2").
const COPIED_ITEMS_VERSIONS_READ = [1, COPIED_ITEMS_VERSION];

// The kinds of item (docs/glossary.md, "Item"), as items name them.
const ITEM_KINDS = ["stage", "tipGroup", "randomization"];

// The properties of each part of copied items, exactly (section 3, "Moving and copying").
const COPIED_ITEMS_PROPERTIES = ["format", "version", "items"];
const COPIED_STAGE_ITEM_PROPERTIES = ["kind", "stage", "tips", "group"];
const COPIED_TIP_GROUP_PROPERTIES = ["kind", "tips", "stages"];
const COPIED_RANDOMIZATION_PROPERTIES = ["kind", "randomization", "stages"];
const COPIED_STAGE_PROPERTIES = ["name", "settings", "transfers"];
const COPIED_TRANSFER_PROPERTIES = ["source", "destination", "volume"];
const COPIED_TIPS_PROPERTIES = ["tipType", "probes"];
const COPIED_OWNED_STAGE_PROPERTIES = ["labware", "well", "stage", "tips"];

// The column's boxes, in order, between Start and End (section 3, "Moving and copying"): each an
// ordinary tip group, { kind: "tipGroup", key, tipType, probes, stages }, or a randomization,
// { kind: "randomization", id, tipGroups }, with its stages' tip groups (one stage each, in stage
// order; [] while it has none). A randomization without stages sits just before the box whose first
// stage is its beforeId (last for null), several at one place in the order of `randomizations`.
// e.g. [{ kind: "tipGroup", key: "start", tipType: "BC230", probes: [1, 2, 3, 4], stages: ["1", "2"] },
// { kind: "randomization", id: "r1", tipGroups: [{ key: "5", … }] }].
export function columnBoxes(plan) {
  const groups = tipGroups(plan);
  // The boxes of the randomizations without stages sitting just before stage `beforeId`.
  const notRunAt = (beforeId) =>
    plan.randomizations
      .filter((randomization) => randomization.stages.length === 0 && randomization.beforeId === beforeId)
      .map((randomization) => ({ kind: "randomization", id: randomization.id, tipGroups: [] }));
  const boxes = [];
  let index = 0;
  while (index < groups.length) {
    const first = groups[index].stages[0];
    boxes.push(...notRunAt(first));
    const owner = randomizationOf(plan, first);
    if (owner === null) {
      const { key, tipType, probes, stages } = groups[index];
      boxes.push({ kind: "tipGroup", key, tipType, probes, stages });
      index += 1;
      continue;
    }
    const owned = new Set(randomizationAt(plan, owner).stages.map((entry) => entry.stage));
    const its = [];
    while (index < groups.length && owned.has(groups[index].stages[0])) {
      its.push(groups[index]);
      index += 1;
    }
    boxes.push({ kind: "randomization", id: owner, tipGroups: its });
  }
  boxes.push(...notRunAt(null));
  return boxes;
}

// Returns { plan, placed }: the plan with `items` (each { kind, id }) moved to `place`, as one edit,
// following the container rule (section 3, "Moving and copying"). Every stage keeps its ID, name,
// settings and transfers; only stageOrder, tipChanges, the operation list's order and the
// randomizations change. `placed` is the moved items, in column order. If nothing would change, the
// same plan is given back, with `placed` the items. Throws, in section 5's order of checks, e.g.
// moveItems(plan, [{ kind: "stage", id: "3" }], { kind: "inTipGroup", index: 0, position: 1 }).
export function moveItems(plan, items, place) {
  const boxes = columnBoxes(plan);
  const entries = checkedItems(plan, items, "move", boxes);
  checkPlace(boxes, place, entries.some(isContainerEntry));
  checkNoOwnedStageAlone(plan, entries);
  const layout = layoutOf(plan, boxes);
  const movedStages = new Set(entries.filter((entry) => entry.kind === "stage").map((entry) => entry.id));
  const movedBoxes = new Set(entries.filter(isContainerEntry).map((entry) => entry.boxIndex));
  const pieces = entries.map((entry) =>
    entry.kind === "stage"
      ? { kind: "stage", id: entry.id, tips: layout[entry.boxIndex].tips, runKey: `box ${entry.boxIndex}` }
      : { kind: "box", box: layout[entry.boxIndex] },
  );
  const anchor = anchorOf(layout, place, movedStages, movedBoxes);
  const remaining = layoutWithout(layout, movedStages, movedBoxes, place);
  const moved = planFromLayout(plan, withPiecesPlaced(remaining, pieces, place, anchor), plan.randomizations);
  const placed = entries.map(({ kind, id }) => ({ kind, id }));
  if (sameArrangement(plan, moved)) {
    return { plan, placed };
  }
  return { plan: withOperationsInStageOrder(moved), placed };
}

// The copied items for `items` (each { kind, id }, of this plan), in column order, as plain data
// that survives JSON (section 3, "Moving and copying"), e.g. copyOf(plan, [{ kind: "stage", id:
// "2" }]) → { format: "biomek-tools copied items", version: 2, items: [{ kind: "stage", stage: {
// name, settings, transfers }, tips: { tipType, probes }, group: 1 }] }. A stage entry's `group`
// numbers the tip group it came from, from 1 in column order, so a paste keeps stages from
// different tip groups apart. Doesn't change the plan. Throws, as moveItems does, if `items` isn't
// a list of items of this plan.
export function copyOf(plan, items) {
  const boxes = columnBoxes(plan);
  const entries = checkedItems(plan, items, "copy", boxes);
  const groupNumbers = new Map();
  const copied = entries.map((entry) => {
    const item = copiedItem(plan, boxes, entry);
    if (entry.kind === "stage") {
      const groupKey = tipGroupKeyOf(plan, entry.id);
      if (!groupNumbers.has(groupKey)) {
        groupNumbers.set(groupKey, groupNumbers.size + 1);
      }
      item.group = groupNumbers.get(groupKey);
    }
    return item;
  });
  // Through JSON, so nothing in the result is shared with the (frozen) plan.
  return JSON.parse(
    JSON.stringify({ format: COPIED_ITEMS_FORMAT, version: COPIED_ITEMS_VERSION, items: copied }),
  );
}

// Returns { plan, placed }: the plan with copies of `items` at `place`, as one edit; the same as
// pasteItems(plan, copyOf(plan, items), place). Throws as copyOf, then pasteItems, do.
export function copyItems(plan, items, place) {
  return pasteItems(plan, copyOf(plan, items), place);
}

// Returns { plan, placed }: the plan with `copied` (copied items, from copyOf, perhaps of another
// plan, perhaps through the system clipboard) at `place`, as one edit, following the container rule:
// each stage a new stage, each randomization a new randomization (section 3, "Moving and copying").
// `placed` is the pasted things, as items of the new plan, in column order. Everything is checked,
// as opening a plan file is, and refused with "Can't paste: " and the reason.
export function pasteItems(plan, copied, place) {
  const copiedItems = checkCopiedForm(copied);
  let working = plan;
  const pieces = [];
  const created = [];
  copiedItems.forEach((item, index) => {
    checkCopiedItemForm(item, index + 1);
    const result = withPrefix(`Can't paste: item ${index + 1}: `, () =>
      pastedPiece(working, item, [...plan.randomizations, ...created]),
    );
    working = result.plan;
    pieces.push(result.piece);
    if (result.randomization !== undefined) {
      created.push(result.randomization);
    }
  });
  const boxes = columnBoxes(plan);
  checkPlace(boxes, place, pieces.some((piece) => piece.kind === "box"));
  const layout = layoutOf(plan, boxes);
  const anchor = anchorOf(layout, place, new Set(), new Set());
  const everyBox = layout.map((box, boxIndex) => ({ boxIndex, box }));
  const arranged = withPiecesPlaced(everyBox, pieces, place, anchor);
  const pasted = planFromLayout(working, arranged, [...plan.randomizations, ...created]);
  return { plan: withOperationsInStageOrder(pasted), placed: pieces.map(placedItemOf) };
}

// --- Moving and copying: helpers ---

// The items in `items`, checked and in column order, each as { kind, id, boxIndex, order }: its
// box's index in `boxes` and its place for sorting. A stage inside a listed tip group or randomization
// is left out, and an item listed twice counts once. Throws, in section 5's order: the list, then each
// item in turn (its form, that it's in the plan, a tip group's ID starting one). `verb` is "move" or
// "copy", for the message about the list.
function checkedItems(plan, items, verb, boxes) {
  if (!Array.isArray(items) || items.length === 0) {
    const got = Array.isArray(items) ? "an empty list" : describeValue(items);
    throw new Error(
      `The things to ${verb} must be a list of stages, tip groups or randomizations, but got ${got}.`,
    );
  }
  const where = columnPlaces(boxes);
  const found = items.map((item, index) => locatedItem(plan, item, index + 1, where));
  const containers = new Set(found.filter(isContainerEntry).map((entry) => entry.boxIndex));
  const seen = new Set();
  const kept = found.filter((entry) => {
    const key = `${entry.kind} ${entry.id}`;
    if (seen.has(key) || (entry.kind === "stage" && containers.has(entry.boxIndex))) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return kept.sort((first, second) => first.boxIndex - second.boxIndex || first.order - second.order);
}

// Where everything is in the column's `boxes`: { stages, groupStarts, randomizations }, Maps from a
// stage's ID to { boxIndex, order } (its place in its box), from an ordinary tip group's first
// stage to its box's index, and from a randomization's ID to its box's index.
function columnPlaces(boxes) {
  const stages = new Map();
  const groupStarts = new Map();
  const randomizations = new Map();
  boxes.forEach((box, boxIndex) => {
    if (box.kind === "tipGroup") {
      groupStarts.set(box.stages[0], boxIndex);
      box.stages.forEach((id, place) => stages.set(id, { boxIndex, order: place + 1 }));
    } else {
      randomizations.set(box.id, boxIndex);
      box.tipGroups.forEach((group, place) => stages.set(group.stages[0], { boxIndex, order: place + 1 }));
    }
  });
  return { stages, groupStarts, randomizations };
}

// Item number `number` of a list, checked and located in the column (`where`, from columnPlaces):
// { kind, id, boxIndex, order }, `order` being 0 for a tip group or randomization (it comes before
// its own stages). Throws if it isn't { kind, id } with a known kind, isn't in the plan, or, for a
// tip group, its ID doesn't start an ordinary tip group.
function locatedItem(plan, item, number, where) {
  if (!isObject(item) || !ITEM_KINDS.includes(item.kind)) {
    throw new Error(
      `Item ${number} must be { kind, id }, with kind "stage", "tipGroup" or "randomization", ` +
        `but got ${describeValue(isObject(item) ? item.kind : item)}.`,
    );
  }
  const { kind, id } = item;
  if (kind === "randomization") {
    checkRandomizationExists(plan, id);
    return { kind, id, boxIndex: where.randomizations.get(id), order: 0 };
  }
  if (!plan.stageList.has(id)) {
    throw new Error(`There's no stage ${describeValue(id)} in the plan.`);
  }
  if (kind === "stage") {
    return { kind, id, ...where.stages.get(id) };
  }
  if (!where.groupStarts.has(id)) {
    throw new Error(`Stage ${describeValue(id)} doesn't start a tip group, so it can't name one.`);
  }
  return { kind, id, boxIndex: where.groupStarts.get(id), order: 0 };
}

// True if a located item (or an entry of one) is a container: a tip group or a randomization.
function isContainerEntry(entry) {
  return entry.kind !== "stage";
}

// Throws unless `place` is a place in the column of `boxes`, checked in section 5's order: its form
// and range, then that a place inside names a tip group's box, then its position, then the container
// rule (`holdsContainer`: what goes there holds a tip group or randomization, which goes only
// between boxes). The place is { kind: "between", index } or { kind: "inTipGroup", index, position }.
function checkPlace(boxes, place, holdsContainer) {
  const formError = new Error(
    `The place must be between boxes (index 0 to ${boxes.length}) or inside a tip group, ` +
      `but got ${JSON.stringify(place) ?? String(place)}.`,
  );
  if (!isObject(place) || !Number.isInteger(place.index) || place.index < 0) {
    throw formError;
  }
  if (place.kind === "between") {
    if (place.index > boxes.length) {
      throw formError;
    }
    return;
  }
  if (place.kind !== "inTipGroup" || place.index >= boxes.length) {
    throw formError;
  }
  const box = boxes[place.index];
  if (box.kind === "randomization") {
    throw new Error(`Box ${place.index} is a randomization: nothing can be put inside it.`);
  }
  const { position } = place;
  if (!Number.isInteger(position) || position < 0 || position > box.stages.length) {
    throw new Error(
      `Box ${place.index} has positions 0 to ${box.stages.length}, but got ${describeValue(position)}.`,
    );
  }
  if (holdsContainer) {
    throw new Error(
      "A tip group or randomization can't go inside another tip group: put it between tip groups.",
    );
  }
}

// Throws if `entries` (checked items) hold a stage a randomization owns without that randomization:
// a randomization's stages move only with it (ADR 0014). The randomization's own stages are left
// out of `entries` already when it's listed.
function checkNoOwnedStageAlone(plan, entries) {
  const owned = entries.find((entry) => entry.kind === "stage" && randomizationOf(plan, entry.id) !== null);
  if (owned !== undefined) {
    throw new Error(
      `${stageNamed(plan, owned.id)}, belongs to a randomization, which moves its stages with it: ` +
        "move the whole randomization, or copy the stage.",
    );
  }
}

// The column as boxes that can be rearranged, one per box of `boxes`, in order: an ordinary tip
// group as { kind: "tipGroup", tips, stages }, a randomization as { kind: "randomization",
// randomization, groups }, each of `groups` { tips, stages } with one stage. `tips` is
// { tipType, probes }.
function layoutOf(plan, boxes) {
  return boxes.map((box) =>
    box.kind === "tipGroup"
      ? { kind: "tipGroup", tips: tipsOf(box), stages: box.stages }
      : {
          kind: "randomization",
          randomization: randomizationAt(plan, box.id),
          groups: box.tipGroups.map((group) => ({ tips: tipsOf(group), stages: group.stages })),
        },
  );
}

// A tip group's tips, { tipType, probes }, e.g. { tipType: "BC230", probes: [1, 2, 3, 4] }.
function tipsOf(group) {
  return { tipType: group.tipType, probes: group.probes };
}

// Where moved or pasted things go, in `layout` (the column before the edit), for `place`, when the
// stages in `movedStages` and the boxes at the indexes in `movedBoxes` are taken out (section 3,
// "Places"): for a place inside a tip group, the first stage of that group at `position` or after it
// that isn't moved ({ stage }, or { stage: null } for its end); between boxes, the index of the first
// box at `index` or after it that isn't moved and keeps a stage ({ boxIndex }, or { boxIndex: null }
// for below the last). A randomization without stages stays, and counts.
function anchorOf(layout, place, movedStages, movedBoxes) {
  if (place.kind === "inTipGroup") {
    const stage = layout[place.index].stages
      .slice(place.position)
      .find((id) => !movedStages.has(id));
    return { stage: stage ?? null };
  }
  for (let boxIndex = place.index; boxIndex < layout.length; boxIndex += 1) {
    const box = layout[boxIndex];
    const keepsStage = box.kind === "randomization" || box.stages.some((id) => !movedStages.has(id));
    if (!movedBoxes.has(boxIndex) && keepsStage) {
      return { boxIndex };
    }
  }
  return { boxIndex: null };
}

// `layout` without the moved things (section 3, the container rule): the boxes at the indexes in
// `movedBoxes` and the stages in `movedStages` taken out; a tip group left with no stages is gone,
// except the one `place` puts stages into, which is kept so it keeps its tips. Each box kept is
// given as { boxIndex, box }, its index in `layout` beside it.
function layoutWithout(layout, movedStages, movedBoxes, place) {
  const kept = [];
  layout.forEach((box, boxIndex) => {
    if (movedBoxes.has(boxIndex)) {
      return;
    }
    if (box.kind === "randomization") {
      kept.push({ boxIndex, box });
      return;
    }
    const stages = box.stages.filter((id) => !movedStages.has(id));
    const isTarget = place.kind === "inTipGroup" && place.index === boxIndex;
    if (stages.length > 0 || isTarget) {
      kept.push({ boxIndex, box: { ...box, stages } });
    }
  });
  return kept;
}

// The column's boxes with `pieces` put at `place`, at `anchor` (anchorOf), as a list of layout
// boxes (section 3, the container rule). `remaining` is the column without them, each box beside its
// index before the edit (layoutWithout; for a paste, every box). Pieces are { kind: "stage", id,
// tips, runKey } or { kind: "box", box }: stages put inside a tip group join it; put between boxes,
// each run of consecutive stages with one `runKey` becomes a tip group of its own, loading `tips`.
function withPiecesPlaced(remaining, pieces, place, anchor) {
  if (place.kind === "inTipGroup") {
    const ids = pieces.map((piece) => piece.id);
    return remaining.map(({ boxIndex, box }) => {
      if (boxIndex !== place.index) {
        return box;
      }
      const at = anchor.stage === null ? box.stages.length : box.stages.indexOf(anchor.stage);
      return { ...box, stages: [...box.stages.slice(0, at), ...ids, ...box.stages.slice(at)] };
    });
  }
  const boxes = remaining.map(({ box }) => box);
  const at =
    anchor.boxIndex === null
      ? boxes.length
      : remaining.findIndex(({ boxIndex }) => boxIndex === anchor.boxIndex);
  return [...boxes.slice(0, at), ...boxesFromPieces(pieces), ...boxes.slice(at)];
}

// The layout boxes `pieces` make between boxes: a box piece as its own box; consecutive stage pieces
// with one `runKey` as one new tip group, loading the first one's tips, e.g. two stages from one
// tip group → one tip group holding both.
function boxesFromPieces(pieces) {
  const boxes = [];
  let runKey = null;
  for (const piece of pieces) {
    if (piece.kind === "box") {
      boxes.push(piece.box);
      runKey = null;
    } else if (runKey !== null && piece.runKey === runKey) {
      boxes.at(-1).stages.push(piece.id);
    } else {
      boxes.push({ kind: "tipGroup", tips: piece.tips, stages: [piece.id] });
      runKey = piece.runKey;
    }
  }
  return boxes;
}

// The plan arranged as `layout` says, from `plan`'s stages: its stage order, its tip changes (one per
// tip group, the first the START one), and its randomizations (from `randomizations`, those in the
// layout), in column order, each sitting before the first stage of the next box below it that has
// one, or null (section 3, "Where randomizations sit afterwards"). The operation list isn't put in
// the new order here (withOperationsInStageOrder).
function planFromLayout(plan, layout, randomizations) {
  const stageOrder = [];
  const tipChanges = {};
  const groups = layout.flatMap((box) => (box.kind === "tipGroup" ? [box] : box.groups));
  for (const group of groups) {
    const key = stageOrder.length === 0 ? START : group.stages[0];
    tipChanges[key] = { tipType: group.tips.tipType, probes: [...group.tips.probes] };
    stageOrder.push(...group.stages);
  }
  const placed = [];
  layout.forEach((box, index) => {
    if (box.kind !== "randomization") {
      return;
    }
    const beforeId = firstStageBelow(layout, index);
    const randomization = randomizations.find((candidate) => candidate.id === box.randomization.id);
    placed.push(randomization.beforeId === beforeId ? randomization : { ...randomization, beforeId });
  });
  return withParts(plan, {
    stageOrder: sameOrNew(plan.stageOrder, stageOrder),
    tipChanges: sameOrNew(plan.tipChanges, tipChanges),
    randomizations: sameOrNew(plan.randomizations, placed),
  });
}

// `old` if `made` holds the same plain data (compared as JSON), otherwise `made`, so a part an edit
// didn't change stays the very same object (section 6, "Immutability and sharing").
function sameOrNew(old, made) {
  return JSON.stringify(old) === JSON.stringify(made) ? old : made;
}

// The first stage of the first box below box `index` of `layout` that has one, or null.
function firstStageBelow(layout, index) {
  for (const box of layout.slice(index + 1)) {
    const stages = box.kind === "tipGroup" ? box.stages : box.groups.flatMap((group) => group.stages);
    if (stages.length > 0) {
      return stages[0];
    }
  }
  return null;
}

// True if `arranged` has the same stage order, tip changes (tip types and probes by key) and
// randomizations as `plan`: a move that changes nothing. `plan`'s randomizations are compared in
// column order, since a move puts the list in column order: a list that was in another order isn't
// a different column.
function sameArrangement(plan, arranged) {
  // The tip changes as text, by key in sorted order, so two tables with the same entries in a
  // different order compare equal.
  const tipsByKey = (tipChanges) =>
    JSON.stringify(Object.keys(tipChanges).sort().map((key) => [key, tipChanges[key]]));
  const inColumnOrder = columnBoxes(plan)
    .filter((box) => box.kind === "randomization")
    .map((box) => randomizationAt(plan, box.id));
  return (
    JSON.stringify(plan.stageOrder) === JSON.stringify(arranged.stageOrder) &&
    tipsByKey(plan.tipChanges) === tipsByKey(arranged.tipChanges) &&
    JSON.stringify(inColumnOrder) === JSON.stringify(arranged.randomizations)
  );
}

// The plan with its operation list rebuilt in its stage order (section 3, "The operation list after
// a move"): every stage's transfers, stage by stage, each stage's in the order it had, added with the
// operation list's own add. The same plan if the order already matches.
function withOperationsInStageOrder(plan) {
  const groups = plan.operationList.groupByStage();
  const inOrder = plan.stageOrder.filter((id) => groups.some((group) => group.stage === id));
  if (JSON.stringify(inOrder) === JSON.stringify(groups.map((group) => group.stage))) {
    return plan;
  }
  const byStage = new Map(groups.map((group) => [group.stage, group.operations]));
  let operationList = new OperationList();
  for (const id of inOrder) {
    for (const operation of byStage.get(id)) {
      operationList = operationList.add(operation);
    }
  }
  return withParts(plan, { operationList });
}

// The key of the tip group stage `id` is in (tipGroups' key), e.g. "start" or "3"; a randomization's
// stages are each in a tip group of their own, so each has its own key.
function tipGroupKeyOf(plan, id) {
  return tipGroups(plan).find((group) => group.stages.includes(id)).key;
}

// One copied item for a checked item `entry` (section 3, "Copied items"): a stage with the tips of
// its tip group, a tip group with its tips and stages, or a randomization with its values and its
// stages, each with its source's well and its own tips.
function copiedItem(plan, boxes, entry) {
  if (entry.kind === "stage") {
    return { kind: "stage", stage: copiedStage(plan, entry.id), tips: tipsInUseAt(plan, entry.id) };
  }
  if (entry.kind === "tipGroup") {
    const box = boxes[entry.boxIndex];
    return { kind: "tipGroup", tips: tipsOf(box), stages: box.stages.map((id) => copiedStage(plan, id)) };
  }
  const randomization = randomizationAt(plan, entry.id);
  const values = Object.fromEntries(RANDOMIZATION_CHANGES.map((property) => [property, randomization[property]]));
  const stages = ownedStagesIn(plan, randomization).map(({ labware, well, stage }) => ({
    labware,
    well,
    stage: copiedStage(plan, stage),
    tips: tipsInUseAt(plan, stage),
  }));
  return { kind: "randomization", randomization: values, stages };
}

// A stage as copied items hold it: { name, settings, transfers }, its transfers in order, each
// { source, destination, volume }.
function copiedStage(plan, id) {
  const { name, settings } = plan.stageList.get(id);
  const transfers = transfersIn(plan, id).map(({ source, destination, volume }) => ({
    source: { labware: source.labware, well: source.well },
    destination: { labware: destination.labware, well: destination.well },
    volume,
  }));
  return { name, settings, transfers };
}

// The items of `copied`, after checking it's copied items in their form: an object with exactly
// format (COPIED_ITEMS_FORMAT), version and a non-empty list of items; a version it reads
// (COPIED_ITEMS_VERSIONS_READ), or a message saying a newer version copied them.
function checkCopiedForm(copied) {
  const notCopiedItems = new Error(
    "Can't paste: this isn't stages, tip groups or randomizations copied from the transfer designer.",
  );
  if (!hasExactly(copied, COPIED_ITEMS_PROPERTIES) || copied.format !== COPIED_ITEMS_FORMAT) {
    throw notCopiedItems;
  }
  if (Number.isInteger(copied.version) && copied.version > COPIED_ITEMS_VERSION) {
    throw new Error(
      `Can't paste: these were copied by a newer version of the tools (version ${copied.version}).`,
    );
  }
  if (
    !COPIED_ITEMS_VERSIONS_READ.includes(copied.version) ||
    !Array.isArray(copied.items) ||
    copied.items.length === 0
  ) {
    throw notCopiedItems;
  }
  return copied.items;
}

// Throws unless copied item number `number` is in its form (section 3, "Copied items"): a stage, a
// tip group (at least one stage) or a randomization, each part with exactly its properties. Values
// are checked later, by the edits that would make them.
function checkCopiedItemForm(item, number) {
  // True if `stage` is a copied stage in its form: { name, settings, transfers }, each transfer
  // { source, destination, volume }.
  const isStage = (stage) =>
    hasExactly(stage, COPIED_STAGE_PROPERTIES) &&
    Array.isArray(stage.transfers) &&
    stage.transfers.every((transfer) => hasExactly(transfer, COPIED_TRANSFER_PROPERTIES));
  // True if `tips` is { tipType, probes }.
  const isTips = (tips) => hasExactly(tips, COPIED_TIPS_PROPERTIES);
  let inForm = false;
  if (isObject(item) && item.kind === "stage") {
    inForm =
      hasExactly(item, COPIED_STAGE_ITEM_PROPERTIES) &&
      isStage(item.stage) &&
      isTips(item.tips) &&
      Number.isInteger(item.group) &&
      item.group >= 1;
  } else if (isObject(item) && item.kind === "tipGroup") {
    inForm =
      hasExactly(item, COPIED_TIP_GROUP_PROPERTIES) &&
      isTips(item.tips) &&
      Array.isArray(item.stages) &&
      item.stages.length > 0 &&
      item.stages.every(isStage);
  } else if (isObject(item) && item.kind === "randomization") {
    inForm =
      hasExactly(item, COPIED_RANDOMIZATION_PROPERTIES) &&
      hasExactly(item.randomization, RANDOMIZATION_CHANGES) &&
      Array.isArray(item.stages) &&
      item.stages.every(
        (owned) => hasExactly(owned, COPIED_OWNED_STAGE_PROPERTIES) && isStage(owned.stage) && isTips(owned.tips),
      );
  }
  if (!inForm) {
    throw new Error(
      `Can't paste: item ${number} isn't a stage, tip group or randomization as the transfer designer copies them.`,
    );
  }
}

// Pastes one copied `item` (in its form) into `plan`, its stages added as new stages, last in the
// stage order for now: { plan, piece, randomization }, `piece` being what goes at the place (as
// withPiecesPlaced takes it) and `randomization` a new randomization, if it is one. Its values are
// checked in the order its edits check them; `existing` is the randomizations so far, for a new ID.
function pastedPiece(plan, item, existing) {
  if (item.kind === "stage") {
    const added = withCopiedStage(plan, item.stage);
    const tips = checkedTips(item.tips);
    // Stages with one `group` came from one tip group, so a run of them forms one tip group.
    return { plan: added.plan, piece: { kind: "stage", id: added.id, tips, runKey: `group ${item.group}` } };
  }
  if (item.kind === "tipGroup") {
    let pasting = plan;
    const stages = [];
    for (const stage of item.stages) {
      const added = withCopiedStage(pasting, stage);
      pasting = added.plan;
      stages.push(added.id);
    }
    const tips = checkedTips(item.tips);
    return { plan: pasting, piece: { kind: "box", box: { kind: "tipGroup", tips, stages } } };
  }
  return pastedRandomization(plan, item, existing);
}

// Pastes a copied randomization (pastedPiece): its stages as new stages, each with its own tips;
// then its values, checked as setRandomization checks them; then its stages' wells (on the deck, no
// well twice, none a mix step), and not two of them its filler's. It gets the next free ID
// among `existing`.
function pastedRandomization(plan, item, existing) {
  let pasting = plan;
  const groups = [];
  const owned = [];
  for (const entry of item.stages) {
    const added = withCopiedStage(pasting, entry.stage);
    pasting = added.plan;
    groups.push({ tips: checkedTips(entry.tips), stages: [added.id] });
    owned.push({ labware: entry.labware, well: entry.well, stage: added.id });
  }
  const values = checkedRandomizationValues(item.randomization, { sources: [], fill: [] });
  checkPastedOwnedStages(pasting, owned);
  const id = nextRandomizationId({ randomizations: existing });
  const randomization = {
    id,
    beforeId: null,
    ...Object.fromEntries(RANDOMIZATION_CHANGES.map((property) => [property, values[property]])),
    stages: owned,
  };
  // As setRandomizations checks a plan file's, so a pasted plan can always be saved and opened.
  checkOneFillerStage(randomization);
  return { plan: pasting, piece: { kind: "box", box: { kind: "randomization", randomization, groups } }, randomization };
}

// Throws if a pasted randomization's stages (`owned`, each { labware, well, stage }) aren't as a
// randomization's stages must be: each well on the deck, no well twice, none a mix step, e.g.
// 'Deep1 A1 has two stages.'
function checkPastedOwnedStages(plan, owned) {
  const seen = new Set();
  for (const entry of owned) {
    checkWell(entry);
    if (seen.has(wellKey(entry))) {
      throw new Error(`${entry.labware} ${entry.well} has two stages.`);
    }
    seen.add(wellKey(entry));
    if (isMixStep(plan, entry.stage)) {
      throw new Error(`its stage for ${entry.labware} ${entry.well} is a mix step.`);
    }
  }
}

// Returns { plan, id }: the plan with a new stage from copied `stage` ({ name, settings, transfers }),
// last in the stage order, checked as renameStage, changeStageSettings and addTransfer check them,
// in that order.
function withCopiedStage(plan, stage) {
  const { stageList, id } = plan.stageList.add(stage.name, defaultSettings());
  let pasting = withParts(plan, { stageList, stageOrder: [...plan.stageOrder, id] });
  pasting = changeStageSettings(pasting, id, stage.settings);
  pasting = addTransfers(
    pasting,
    stage.transfers.map(({ source, destination, volume }) => ({
      type: "transfer",
      source,
      destination,
      volume,
      stage: id,
    })),
  );
  return { plan: pasting, id };
}

// Copied `tips`, checked as setTipType and setTipProbes check them, as { tipType, probes }, probes
// smallest first.
function checkedTips(tips) {
  checkTipType(tips.tipType);
  checkProbes(tips.probes);
  return { tipType: tips.tipType, probes: [...tips.probes].sort((a, b) => a - b) };
}

// What a pasted piece is, as an item of the new plan: a stage by its ID, a tip group by its first
// stage's ID, a randomization by its ID.
function placedItemOf(piece) {
  if (piece.kind === "stage") {
    return { kind: "stage", id: piece.id };
  }
  const { box } = piece;
  return box.kind === "tipGroup"
    ? { kind: "tipGroup", id: box.stages[0] }
    : { kind: "randomization", id: box.randomization.id };
}

// --- Moving wells ---

// True if the plan uses `well` ({ labware, well }) anywhere: in its starting contents, as a
// transfer's source or destination (a mix step's mixed wells included), in its well labels, or in
// a randomization (a source, a well to fill, or the well of one of its stages), e.g.
// isWellUsed(emptyPlan().plan, { labware: "Res1", well: "3" }) → false (section 3, "Moving wells").
// Throws if `well` isn't a well on the deck (deck.checkWell's message).
export function isWellUsed(plan, well) {
  checkWell(well);
  // Compared directly rather than by wellKey, since a tool asks this for every well it draws.
  const isIt = (end) => end.labware === well.labware && end.well === well.well;
  return (
    plan.startingContents.some(isIt) ||
    plan.operationList
      .listOperations()
      .some((operation) => isIt(operation.source) || isIt(operation.destination)) ||
    wellLabelOf(plan, well) !== null ||
    plan.randomizations.some(
      (randomization) =>
        randomization.sources.some(isIt) ||
        randomization.fill.some(isIt) ||
        randomization.stages.some(isIt),
    )
  );
}

// True if `well` ({ labware, well }) is one of a randomization's wells to fill, e.g. true for
// Plate1 B2 when a randomization fills it. Throws if `well` isn't a well on the deck.
export function isWellToFill(plan, well) {
  checkWell(well);
  const key = wellKey(well);
  return plan.randomizations.some((randomization) =>
    randomization.fill.some((end) => wellKey(end) === key),
  );
}

// Returns the plan with well `from` replaced by well `to` (each { labware, well }) wherever the
// plan names it, as one edit (section 3, "Moving wells"): its starting contents entry, every
// transfer from or into it, its well label, and a randomization's sources and stage entries. Parts
// the move doesn't touch are shared with `plan`.
// e.g. moveWell(plan, { labware: "Res1", well: "3" }, { labware: "Res1", well: "7" }).
// Throws, in this order (section 5): `from` or `to` isn't on the deck, `to` is `from`, `from` isn't
// in use, `from` is a randomization's well to fill, `to` is in use.
export function moveWell(plan, from, to) {
  checkWell(from);
  checkWell(to);
  if (wellKey(from) === wellKey(to)) {
    throw new Error(
      `${wellText(from)} is where it is already. Choose another well to move it to.`,
    );
  }
  if (!isWellUsed(plan, from)) {
    throw new Error(`The plan doesn't use ${wellText(from)}, so there's nothing to move.`);
  }
  if (isWellToFill(plan, from)) {
    throw new Error("Wells a randomization fills can't be moved.");
  }
  if (isWellUsed(plan, to)) {
    throw new Error(
      `${wellText(to)} is already used in the plan. Move to a well the plan doesn't use.`,
    );
  }
  const changes = {
    startingContents: startingContentsMoved(plan, from, to),
    operationList: operationListMoved(plan, from, to),
    wellLabels: wellLabelsMoved(plan, from, to),
    randomizations: randomizationsMoved(plan, from, to),
  };
  // Only the parts the move changed are passed on, so the others stay the very same objects.
  const changed = Object.fromEntries(
    Object.entries(changes).filter(([part, value]) => value !== plan[part]),
  );
  return withParts(plan, changed);
}

// --- Moving wells: helpers ---

// A well as this module's messages name it: its labware's name in the deck description and the
// well, e.g. { labware: "Res1", well: "3" } → "Res1 3".
function wellText(end) {
  return `${end.labware} ${end.well}`;
}

// `end` with its labware and well taken from `to` if it's the well `from`, keeping its other
// properties (a source's replicates, a stage entry's stage); otherwise `end` itself, e.g.
// movedEnd({ labware: "Res1", well: "3", replicates: 4 }, Res1 3, Res1 7) → { labware: "Res1",
// well: "7", replicates: 4 }.
function movedEnd(end, from, to) {
  return wellKey(end) === wellKey(from) ? { ...end, labware: to.labware, well: to.well } : end;
}

// The plan's starting contents with `from`'s entry turned into `to`'s, in the same place, with the
// same components; the same list if `from` has no entry.
function startingContentsMoved(plan, from, to) {
  if (!plan.startingContents.some((entry) => wellKey(entry) === wellKey(from))) {
    return plan.startingContents;
  }
  return plan.startingContents.map((entry) => movedEnd(entry, from, to));
}

// The plan's operation list with every transfer from or into `from` given `to` in its place, by
// the operation list's replace, so each transfer keeps its place, stage and volume and the others
// are shared; the same list if no transfer touches `from`. Since `to` isn't in use, no replacement
// can break the stage rule.
function operationListMoved(plan, from, to) {
  let operationList = plan.operationList;
  plan.operationList.listOperations().forEach((operation, position) => {
    const source = movedEnd(operation.source, from, to);
    const destination = movedEnd(operation.destination, from, to);
    if (source !== operation.source || destination !== operation.destination) {
      operationList = operationList.replace(position, { ...operation, source, destination });
    }
  });
  return operationList;
}

// The plan's well labels with `from`'s label given to `to` instead, placed as removing `from`'s
// label and then labeling `to` with setWellLabel would place it (section 3, "Moving wells"); the
// same table if `from` has no label.
function wellLabelsMoved(plan, from, to) {
  const label = wellLabelOf(plan, from);
  if (label === null) {
    return plan.wellLabels;
  }
  const withoutFrom = setWellLabel(plan, from, "");
  return setWellLabel(withoutFrom, to, label).wellLabels;
}

// The plan's randomizations with each source and stage entry at `from` moved to `to`, keeping its
// place and other properties; a randomization that doesn't use `from` is the very same object, and
// the list is the same list if none does. Wells to fill never change: moveWell refuses to move one.
function randomizationsMoved(plan, from, to) {
  let changed = false;
  const randomizations = plan.randomizations.map((randomization) => {
    const sources = randomization.sources.map((source) => movedEnd(source, from, to));
    const stages = randomization.stages.map((owned) => movedEnd(owned, from, to));
    const sourcesChanged = sources.some((source, index) => source !== randomization.sources[index]);
    const stagesChanged = stages.some((owned, index) => owned !== randomization.stages[index]);
    if (!sourcesChanged && !stagesChanged) {
      return randomization;
    }
    changed = true;
    return {
      ...randomization,
      sources: sourcesChanged ? sources : randomization.sources,
      stages: stagesChanged ? stages : randomization.stages,
    };
  });
  return changed ? randomizations : plan.randomizations;
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
// then no well twice, then each filler well without replicates, in order. Any number of sources may
// be filler wells (section 3).
function checkedSources(sources) {
  if (!Array.isArray(sources)) {
    throw new Error(`A randomization's sources must be a list, but got ${describeValue(sources)}.`);
  }
  sources.forEach((source, index) => checkSource(source, index + 1));
  checkNoWellTwice(sources, (where) => `${where} is a source twice. List each source once.`);
  sources.forEach((source, index) => {
    if (source.filler && source.replicates !== null) {
      throw new Error(
        `Source ${index + 1} is a filler well, so its replicates must be null, ` +
          `but got ${describeValue(source.replicates)}.`,
      );
    }
  });
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

// The pool for a randomization (random-pool.md; section 3, "Running", step 1): an item per source,
// keyed "source 1" … by its place, except that the filler wells are one item, keyed by the first
// filler well's place; the filler's key (the first filler well's) or null; the wells to fill keyed
// "well 1" …; and the seed. So the pool is the same however many filler wells there are.
function poolOf(randomization) {
  const firstFiller = randomization.sources.findIndex((source) => source.filler);
  const items = randomization.sources.flatMap((source, index) =>
    source.filler && index !== firstFiller
      ? []
      : [{ key: sourceKey(index), replicates: source.replicates }],
  );
  return {
    items,
    filler: firstFiller === -1 ? null : sourceKey(firstFiller),
    wells: randomization.fill.map((_, index) => `well ${index + 1}`),
    seed: randomization.seed,
  };
}

// The pool's key for the source at place `index` (from 0) in sources, e.g. 0 → "source 1".
function sourceKey(index) {
  return `source ${index + 1}`;
}

// The place in sources (from 0) of the source a pool key names, e.g. "source 3" → 2.
function sourceIndexOfKey(key) {
  return Number(key.slice("source ".length)) - 1;
}

// The places in sources (from 0) of a randomization's filler wells, in order, e.g. [2, 3, 4].
function fillerIndexes(randomization) {
  return randomization.sources.flatMap((source, index) => (source.filler ? [index] : []));
}

// The filler's shares (fillerShares), with what every well holds just before the randomization
// given by `contentsOf`, a function called only when there are two or more filler wells.
function sharesOf(randomization, contentsOf) {
  const indexes = fillerIndexes(randomization);
  if (indexes.length === 0) {
    return [];
  }
  const { volume } = randomization;
  const spare = spareWellCount(poolOf(randomization));
  if (volume === null || spare === null) {
    return null;
  }
  let left = spare;
  return indexes.map((index, place) => {
    if (place === indexes.length - 1) {
      return { index, count: left };
    }
    const { labware, well } = randomization.sources[index];
    // NEGLIGIBLE_MICROLITERS allows for arithmetic leftovers: exactly n transfers' worth gives n.
    const usable = contentsOf().usableVolumeOf(labware, well);
    const fit = Math.floor((usable + NEGLIGIBLE_MICROLITERS) / volume);
    const count = Math.min(fit, left);
    left -= count;
    return { index, count };
  });
}

// True unless two filler wells that hold something just before the randomization hold different
// liquids: different components, or a component's share of the well differing by more than
// NEGLIGIBLE_MICROLITERS (section 3, "Problems"). Filler wells holding nothing are left out.
// `contentsOf` gives what every well holds then, and is called only with two or more filler wells.
function fillerWellsHoldOneLiquid(randomization, contentsOf) {
  const indexes = fillerIndexes(randomization);
  if (indexes.length < 2) {
    return true;
  }
  const contents = contentsOf();
  const liquids = indexes
    .map((index) => {
      const { labware, well } = randomization.sources[index];
      return contents.volumeFractionsOf(labware, well);
    })
    .filter((shares) => Object.keys(shares).length > 0);
  return liquids.every((shares) => sameLiquid(shares, liquids[0]));
}

// The components a well holds in `contents` (a ContentsSnapshot), as [name, µL] pairs in the well's
// component order, leaving out any it holds none of, e.g. [["Media", 990], ["DMSO", 10]].
function heldComponents(contents, { labware, well }) {
  return Object.entries(contents.componentsOf(labware, well)).filter(([, volume]) => volume > 0);
}

// True if two wells' shares of each component (volumeFractionsOf) are one liquid: the same
// components, each share within NEGLIGIBLE_MICROLITERS of the other, e.g. { Media: 1 } and
// { Media: 1 } → true.
function sameLiquid(first, second) {
  const names = Object.keys(first);
  return (
    names.length === Object.keys(second).length &&
    names.every(
      (name) =>
        Object.hasOwn(second, name) &&
        Math.abs(first[name] - second[name]) <= NEGLIGIBLE_MICROLITERS,
    )
  );
}

// A pool problem in the designer's words (section 3), or null for one it never has (an invalid
// replicate count or seed, which setRandomization refuses).
function poolProblemMessage(plan, randomization, problem) {
  switch (problem.kind) {
    case "replicates-missing":
      return `${sourceName(plan, randomization.id, randomization.sources[sourceIndexOfKey(problem.key)])} needs a number of replicates.`;
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

// What a run gives (section 3, "Running", steps 1, 1a and 5), as one entry per stage it makes, in
// sources' order, the filler's at its first filler well's place: { well, name, transfers }, `well`
// being the source well its entry in `stages` names (the first filler well's, for the filler),
// `name` the stage's name, and `transfers` each { source, destination } in fill's order, e.g.
// [{ well: { labware: "Deep1", well: "A1" }, name: "Drug A", transfers: [{ source, … }] }].
// A source, or the filler, that gets no wells has no entry. `contents` is what every well holds
// just before the randomization.
function runStagesOf(plan, randomization, contents) {
  const { sources, fill } = randomization;
  const wellsByKey = new Map();
  for (const { well, key } of assignPool(poolOf(randomization))) {
    const wells = wellsByKey.get(key) ?? [];
    wells.push(fill[Number(well.slice("well ".length)) - 1]);
    wellsByKey.set(key, wells);
  }
  const firstFiller = sources.findIndex((source) => source.filler);
  return sources.flatMap((source, index) => {
    const wells = wellsByKey.get(sourceKey(index)) ?? [];
    if (wells.length === 0) {
      return [];
    }
    if (index === firstFiller) {
      return [fillerRunStage(plan, randomization, contents, wells)];
    }
    const name = nameOfSource(plan, () => contents, source);
    return [{ well: endOf(source), name, transfers: wells.map((destination) => ({ source: endOf(source), destination })) }];
  });
}

// The filler's entry of runStagesOf: its wells, in fill's order, shared out to the filler wells in
// their order (section 3, step 1a), each drawing from the filler well it fell to; named as the
// first filler well holding something is (or the first filler well, if none does).
function fillerRunStage(plan, randomization, contents, wells) {
  const shares = sharesOf(randomization, () => contents);
  const transfers = [];
  let next = 0;
  for (const { index, count } of shares) {
    const fillerWell = endOf(randomization.sources[index]);
    for (const destination of wells.slice(next, next + count)) {
      transfers.push({ source: fillerWell, destination });
    }
    next += count;
  }
  const fillerWells = fillerIndexes(randomization).map((index) => randomization.sources[index]);
  const named =
    fillerWells.find((fillerWell) => heldComponents(contents, fillerWell).length > 0) ?? fillerWells[0];
  return { well: endOf(fillerWells[0]), name: nameOfSource(plan, () => contents, named), transfers };
}

// A well as { labware, well } only, leaving out any other properties, e.g. a source's replicates.
function endOf({ labware, well }) {
  return { labware, well };
}

// For each of the randomization's stages in the plan, in order, the source well its entry is keyed
// to after this run, or null if the run removes it (section 3, "Running", steps 3 and 4), as a Map
// from stage ID. A source's entry stays its stage while it gets wells. The filler's stage is the
// first entry naming any of its filler wells, re-keyed to the first filler well; every other entry
// naming a filler well goes; so does one whose well is no longer a source.
function keptEntries(plan, randomization, runStages) {
  const fillerKeys = new Set(fillerIndexes(randomization).map((index) => wellKey(randomization.sources[index])));
  const fillerRun = runStages.find((runStage) => fillerKeys.has(wellKey(runStage.well)));
  let fillerStageFound = false;
  const kept = new Map();
  for (const owned of ownedStagesIn(plan, randomization)) {
    let keyedTo = null;
    if (fillerKeys.has(wellKey(owned))) {
      if (!fillerStageFound && fillerRun !== undefined) {
        keyedTo = fillerRun.well;
      }
      fillerStageFound = true;
    } else {
      const runStage = runStages.find((candidate) => wellKey(candidate.well) === wellKey(owned));
      keyedTo = runStage === undefined ? null : runStage.well;
    }
    kept.set(owned.stage, keyedTo);
  }
  return kept;
}

// What a randomization's stages are, as text to compare two plans by (section 3, "Out of date"):
// for each of its stages, in order, its source well, its name and its transfers' source,
// destination and volume, in order. Stage IDs are left out, since a run may make them fresh. Only
// its stages still in the plan count (ownedStagesIn): one removed by removeStage stays in its list
// until a run.
function stagesOutline(plan, randomization) {
  return JSON.stringify(
    ownedStagesIn(plan, randomization).map((owned) => ({
      well: endOf(owned),
      name: plan.stageList.get(owned.stage).name,
      transfers: transfersIn(plan, owned.stage).map(({ source, destination, volume }) => [
        endOf(source),
        endOf(destination),
        volume,
      ]),
    })),
  );
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

// Returns the plan with a new stage, on new tips, before `place`, for each of `runStages`
// (runStagesOf) that no kept entry is keyed to (`kept`, from keptEntries), in order, named as it
// says; the randomization's stages list its own first, each kept one re-keyed, then the new ones.
// Randomizations that haven't run, earlier in the list and sitting at the same place, move onto its
// first stage, so they stay above it.
function withNewSourceStages(plan, randomization, runStages, kept, place) {
  let adding = plan;
  const stages = ownedStagesIn(plan, randomization).map((owned) => {
    const keyedTo = kept.get(owned.stage);
    return keyedTo === null ? owned : { ...keyedTo, stage: owned.stage };
  });
  const keyedWells = new Set([...kept.values()].filter((well) => well !== null).map(wellKey));
  for (const runStage of runStages) {
    if (keyedWells.has(wellKey(runStage.well))) {
      continue;
    }
    const { plan: added, id } = addStageWithNewTips(adding, place);
    adding = renameStage(added, id, runStage.name);
    stages.push({ ...runStage.well, stage: id });
  }
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

// Returns the plan without the stages of randomization `id` the run removes (section 3, "Running",
// step 4): those `keptByStage` (keptEntries) keys to null, each removed with removeStage. New
// stages aren't in it, so they stay.
function withoutUnusedSourceStages(plan, id, keptByStage) {
  const randomization = randomizationAt(plan, id);
  const unused = randomization.stages.filter((owned) => keptByStage.get(owned.stage) === null);
  let removing = plan;
  for (const owned of unused) {
    removing = removeStage(removing, owned.stage);
  }
  const kept = randomization.stages.filter((owned) => !unused.includes(owned));
  return withRandomizationReplaced(removing, { ...randomizationAt(removing, id), stages: kept });
}

// Returns the plan with `owned`, one of a randomization's stages ({ labware, well, stage }), set as
// `runStage` says (runStagesOf; section 3, "Running", step 5): its name, its settings, its tips
// (its own tip change, or START's if it's the first stage) and its transfers, each of the
// randomization's volume, in order.
function withSourceStageSet(plan, randomization, owned, runStage) {
  const stageId = owned.stage;
  let setting = plan;
  if (plan.stageList.get(stageId).name !== runStage.name) {
    setting = renameStage(setting, stageId, runStage.name);
  }
  setting = changeStageSettings(setting, stageId, randomization.settings);
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
    runStage.transfers.map(({ source, destination }) => ({
      type: "transfer",
      source: endOf(source),
      destination: endOf(destination),
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
    checkOneFillerStage(stored);
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

// Throws if two of a stored randomization's stages name its filler wells: 'its filler has two
// stages.' One naming a filler well other than the first is accepted, as a plan between
// setRandomization and a run holds it (section 5).
function checkOneFillerStage(randomization) {
  const fillerKeys = new Set(fillerIndexes(randomization).map((index) => wellKey(randomization.sources[index])));
  const fillerStages = randomization.stages.filter((owned) => fillerKeys.has(wellKey(owned)));
  if (fillerStages.length > 1) {
    throw new Error("its filler has two stages.");
  }
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

// Throws if `constituent`'s unit is of a different family from the one its name has in `others`
// (the plan's other components, in the plan's order), naming the first such component and the unit
// it carries the name in, e.g. 'Hy-Soy is in g/L in Feeding media. Give it a unit of that kind
// (g/L, mg/L), or a different name.' A name no other component carries agrees with anything.
function checkFamilyAgrees(constituent, others) {
  for (const other of others) {
    const carried = (other.constituents ?? []).find((entry) => entry.name === constituent.name);
    if (carried !== undefined) {
      const family = familyOf(carried.unit);
      if (familyOf(constituent.unit) !== family) {
        throw new Error(
          `${constituent.name} is in ${carried.unit} in ${other.name}. Give it a unit of that kind (${unitsOf(family).join(", ")}), or a different name.`,
        );
      }
      return;
    }
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
