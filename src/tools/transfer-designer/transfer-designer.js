// transfer-designer.js — the transfer designer's rules: what a plan is, and every edit that can be
// made to one, each checked so that a plan is always valid.
//
// A plan holds the components, the starting contents, the operation list, the stage list, the
// stage order (a list of stage IDs; ADR 0011), the tip changes, the labware labels and the
// experiment name. It is never changed after it's made: every edit returns a new plan that shares
// every part the edit didn't change, so the plan history can keep many plans cheaply. The page
// shows a plan and passes on what the user does; every rule about what that means lives here, so it
// can be tested in Node.
// It builds on the shared modules (operation-list, stage-list, contents-tracking, mix-volumes, deck)
// and doesn't repeat what they do.
// Specification: transfer-designer.md.

import { PIPETTING_MODES, DEFAULT_PIPETTING_MODE } from "../../../config/pipetting-modes.js";
import { TIP_TYPES, DEFAULT_PROBE_COUNT } from "../../../config/tip-types.js";
import { DEFAULT_MIX as CONFIGURED_DEFAULT_MIX } from "../../../config/mixing.js";
import { describeValue } from "../../shared/error-messages/error-messages.js";
import { isObject, listNames, checkName } from "../../shared/input-checks/input-checks.js";
import { OperationList } from "../../shared/operation-list/operation-list.js";
import { StageList } from "../../shared/stage-list/stage-list.js";
import { replay } from "../../shared/contents-tracking/contents-tracking.js";
import { mixVolumes } from "../../shared/mix-volumes/mix-volumes.js";
import { labwareNames, gridOf, checkWell } from "../../shared/deck/deck.js";
import { START, tipGroups } from "../../shared/tip-groups/tip-groups.js";
import { checkExperimentName } from "../../shared/file-writer/file-writer.js";

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

// The Span-8 has probes 1 to 8, numbered as in Biomek Software. It's a fact about the instrument,
// not a setting that might change, so it lives here rather than in config/.
const PROBE_COUNT = 8;

// The two ends of a stage, as setStageMix takes them.
const ENDS = ["source", "destination"];

// --- Plans ---

// A new plan, and the ID of its one stage: { plan, stageId }. The plan has no components, starting
// contents, transfers or labels, and no experiment name (""); its stage is called NEW_STAGE_NAME
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

// Returns { plan, id }: the plan with a new stage, called NEW_STAGE_NAME, just before stage
// `beforeId` (or last, for null), and the new stage's ID. All its settings, mixes included, are
// copied from the stage before it in the stage order, or from the first stage if there's none, so
// it pipettes and mixes as that stage does (Andy, 2026-10-30). With takeTips, a tip change
// before `beforeId` moves onto the new stage, so the new stage is the first to use those tips;
// without it, the new stage uses the tips before that tip change.
// e.g. addStage(plan, "2", { takeTips: true }).
export function addStage(plan, beforeId, { takeTips = false } = {}) {
  if (beforeId !== null && !plan.stageList.has(beforeId)) {
    throw new Error(`There's no stage ${describeValue(beforeId)} to add a stage before.`);
  }
  const order = plan.stageOrder;
  const newPlace = beforeId === null ? order.length : order.indexOf(beforeId);
  // order[-1] is undefined, so a stage added before the first copies the first stage.
  const copiedFrom = order[newPlace - 1] ?? order[0];
  const settings = plan.stageList.get(copiedFrom).settings;
  const { stageList, id } = plan.stageList.add(NEW_STAGE_NAME, settings);

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

// Returns the plan with stage `id` called `name`. The stage list checks both.
export function renameStage(plan, id, name) {
  return withParts(plan, { stageList: plan.stageList.rename(id, name) });
}

// Returns the plan with stage `id`'s settings replaced by `settings`. The stage list checks both;
// then each end's technique must match its mixing, the source's first (checkMixingMatches), so a
// plan file can't bring in a stage whose technique Biomek would mix with when the plan says not to,
// or the reverse (transfer-designer.md, section 3, "Mixing").
export function changeStageSettings(plan, id, settings) {
  const stageList = plan.stageList.changeSettings(id, settings);
  for (const end of ENDS) {
    checkMixingMatches(settings, end);
  }
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

  const removed = withParts(plan, {
    operationList,
    stageList: plan.stageList.remove(id),
    stageOrder: plan.stageOrder.filter((stage) => stage !== id),
    tipChanges: withoutKey(plan.tipChanges, id),
  });
  return withStartTipsFirst(removed);
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

// The IDs of the stages with an overdraw: a transfer that asks a well for more than it holds, as
// contents tracking finds it, e.g. new Set(["2"]).
export function stagesWithOverdraw(plan) {
  const operations = plan.operationList.listOperations();
  const problems = replay(plan.startingContents, plan.operationList).listProblems();
  return new Set(problems.map((problem) => operations[problem.operationIndex].stage));
}

// The IDs of the stages with a mix problem: a mix volume under the minimum (MIN_MIX_VOLUME in
// config/mixing.js, 1.1 µL) in any of their rows, because the well it's worked out from holds too
// little when it's mixed (mix-volumes.md), e.g. new Set(["3"]).
export function stagesWithMixProblem(plan) {
  return new Set(mixVolumes(plan).problems.map((problem) => problem.stage));
}

// --- Transfers ---

// Returns the plan with `transfer` added to its stage, without changing the stage order. If the
// stage already has transfers, it goes after them; if not, it goes just before the next stage in the
// stage order that has transfers, or last. Throws, in this order, if the operation list refuses it
// (its form, then the stage rule), its source or destination well isn't on the deck, or its stage
// isn't in the plan.
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
// place and stage, e.g. changeVolume(plan, 3, 25). The operation list checks both.
export function changeVolume(plan, position, volume) {
  const operation = plan.operationList.listOperations()[position];
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
// Throws for START, which the run always has, or if there's no tip change at `key`.
export function removeTipChange(plan, key) {
  if (key === START) {
    throw new Error(
      "The run always starts by loading tips, so the first tips can't be removed.",
    );
  }
  checkTipChangeAt(plan, key);
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

// The names of the labware the plan uses, in its starting contents or in any transfer, in the
// deck's order, e.g. ["Plate", "Res"].
export function labwareUsed(plan) {
  const used = new Set(plan.startingContents.map((entry) => entry.labware));
  for (const operation of plan.operationList.listOperations()) {
    used.add(operation.source.labware);
    used.add(operation.destination.labware);
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

// --- Helpers used only inside this module ---

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
