// possible-contamination.js — works out a plan's possible traces (docs/glossary.md, "Possible
// trace") at a point in the run: for each well, the components a tip could have carried into it
// although the plan doesn't put them there.
//
// It follows tips, not liquid (ADR 0021): a tip carries whatever it touches to every well it enters
// afterwards, until the next tip change, in either direction, so a used tip can contaminate the
// source it draws from. Where the order isn't known (within a stage) it assumes the worst. It uses
// contents-tracking for what each well holds, and tip-groups for which stages share tips. It's
// shared, as tip-groups is, because it reads a plan as the transfer designer holds it and isn't
// about any one page. It changes nothing, and doesn't check the plan: plans are made only through
// the transfer designer's checks.
// Specification: possible-contamination.md.

import { PIPETTING_MODES } from "../../../config/pipetting-modes.js";
import { describeValue } from "../error-messages/error-messages.js";
import { checkName } from "../input-checks/input-checks.js";
import { replay } from "../contents-tracking/contents-tracking.js";
import { tipGroups } from "../tip-groups/tip-groups.js";

// The possible traces at the start (operationCount 0) or at the end of the stage with transfers
// whose last operation is the operationCount-th, as a PossibleTraces, e.g.
//   possibleTraces(plan, 6).tracesOf("Deep1", "A3")   // ["Yeast"]
// Throws if operationCount isn't a whole number (leaving it out included), is out of range, or
// falls part-way through a stage (possible-contamination.md, section 5).
export function possibleTraces(plan, operationCount) {
  checkWholeNumber(operationCount);
  // replay checks the range, with the wording this module's message shares, and gives what each
  // well holds at the point, which is never a trace.
  const heldAtPoint = snapshotAt(plan, operationCount);
  const stages = stagesWithCounts(plan);
  checkStageEnd(plan, stages, operationCount);
  const reached = reachedBy(plan, stages, operationCount);
  return new PossibleTraces(reached, heldAtPoint, componentOrder(plan));
}

// A plan's possible traces at one point. Made only by possibleTraces (the class isn't exported:
// the module exports one function, possible-contamination.md, section 4); nothing outside can
// change it, and tracesOf returns a new list each time.
class PossibleTraces {
  // What could have reached each well by the point: a Set of component names, keyed by wellKey.
  #reached;
  // The contents snapshot at the point, for what each well holds there.
  #heldAtPoint;
  // The plan's component names, in its order, for sorting a well's traces.
  #componentOrder;

  // Called only by possibleTraces, which hands over what it worked out and keeps no reference to
  // `reached`.
  constructor(reached, heldAtPoint, componentOrder) {
    this.#reached = reached;
    this.#heldAtPoint = heldAtPoint;
    this.#componentOrder = componentOrder;
  }

  // One well's possible traces: the components that could have reached it, less those it holds at
  // the point, in the plan's component order, e.g. tracesOf("Deep1", "A3") → ["Yeast"]. A well with
  // none, including one no transfer touched, gives []. A new list each time.
  tracesOf(labware, well) {
    checkName(labware, "labware given to tracesOf");
    checkName(well, "well given to tracesOf");
    const reached = this.#reached.get(wellKey({ labware, well }));
    if (reached === undefined) {
      return [];
    }
    const held = new Set(Object.keys(this.#heldAtPoint.componentsOf(labware, well)));
    return this.#componentOrder.filter((name) => reached.has(name) && !held.has(name));
  }
}

// --- Checks ---

// Throws unless `operationCount` is a whole number. Unlike replay's own check, undefined and null
// are errors here, not "every operation", so this runs before replay sees the count.
// e.g. checkWholeNumber(undefined) throws 'The operation count must be a whole number, like 3, but
// got undefined.'
function checkWholeNumber(operationCount) {
  // Number.isInteger is false for anything that isn't a number (undefined, null, "3"), for 2.5,
  // and for NaN and Infinity.
  if (!Number.isInteger(operationCount)) {
    throw new Error(
      `The operation count must be a whole number, like 3, but got ${describeValue(operationCount)}.`,
    );
  }
}

// Throws if `operationCount` falls part-way through one of `stages` (from stagesWithCounts), naming
// that stage and the counts at its start and end, e.g. 'Possible traces are worked out only at the
// start or at a stage's end, since the order within a stage isn't known, but 5 operations is
// part-way through stage 2, “Yeast”. Use 4 or 6.'
function checkStageEnd(plan, stages, operationCount) {
  const stage = stages.find((candidate) => candidate.start < operationCount && operationCount < candidate.end);
  if (stage === undefined) {
    return;
  }
  const operations = operationCount === 1 ? "1 operation is" : `${operationCount} operations is`;
  throw new Error(
    "Possible traces are worked out only at the start or at a stage's end, since the order within " +
      `a stage isn't known, but ${operations} part-way through ${stageNamedInText(plan, stage.id)}. ` +
      `Use ${stage.start} or ${stage.end}.`,
  );
}

// A stage named by its place in the stage order (from 1) and its name, for the middle of a
// sentence, as the transfer designer's messages name stages, e.g. 'stage 2, “Yeast”'. Built here
// from the plan, since a shared module doesn't import a tool's code.
function stageNamedInText(plan, id) {
  return `stage ${plan.stageOrder.indexOf(id) + 1}, “${plan.stageList.get(id).name}”`;
}

// --- Working out what reaches each well ---

// The stages with transfers, in run order, each with its transfers and the operation counts at its
// start and end, e.g. [{ id: "1", transfers: [ … ], start: 0, end: 4 }, { id: "2", …, start: 4,
// end: 6 }]. The operation list keeps each stage's transfers together, so the counts follow on.
function stagesWithCounts(plan) {
  let count = 0;
  return plan.operationList.groupByStage().map(({ stage, operations }) => {
    const start = count;
    count += operations.length;
    return { id: stage, transfers: operations, start, end: count };
  });
}

// What could have reached each well by `operationCount`, a stage's end or 0: a Map from wellKey to a
// Set of component names, following possible-contamination.md, section 3, stage by stage.
function reachedBy(plan, stages, operationCount) {
  const reached = new Map();
  const groupOf = tipGroupKeys(plan);
  let tipsCarry = new Set();
  let previousGroup = null;
  // The last stage's end snapshot, with its operation count, e.g. { count: 4, snapshot }.
  let atEnd = null;
  for (const stage of stages.filter((candidate) => candidate.end <= operationCount)) {
    // 1. New tips carry nothing.
    if (groupOf.get(stage.id) !== previousGroup) {
      tipsCarry = new Set();
      previousGroup = groupOf.get(stage.id);
    }
    // 2 to 4. The tips take on what every well passing traces on passes on, worked out before any
    // well's "reached" changes, so each uses what had reached it by the stage's start.
    // A stage starts where the one before it ends, so its start snapshot is that stage's end one.
    const atStart = atEnd?.count === stage.start ? atEnd.snapshot : snapshotAt(plan, stage.start);
    atEnd = { count: stage.end, snapshot: snapshotAt(plan, stage.end) };
    for (const well of wellsPassingOn(plan, stage)) {
      addAll(tipsCarry, passedOnBy(well, atStart, atEnd.snapshot, reached));
    }
    // 5. Every touched well receives what the tips now carry.
    for (const well of touchedWells(stage)) {
      const key = wellKey(well);
      if (!reached.has(key)) {
        reached.set(key, new Set());
      }
      addAll(reached.get(key), tipsCarry);
    }
  }
  return reached;
}

// What every well holds after the plan's first `count` operations, as a contents snapshot.
function snapshotAt(plan, count) {
  return replay(plan.startingContents, plan.operationList, count);
}

// The key of the tip group each stage belongs to, by stage ID, e.g. Map { "1" → "start",
// "2" → "start", "3" → "3" }.
function tipGroupKeys(plan) {
  const keys = new Map();
  for (const group of tipGroups(plan)) {
    for (const id of group.stages) {
      keys.set(id, group.key);
    }
  }
  return keys;
}

// Every well a stage's transfers touch, sources and destinations, each { labware, well }, possibly
// more than once.
function touchedWells(stage) {
  return stage.transfers.flatMap((transfer) => [transfer.source, transfer.destination]);
}

// The wells of a stage that pass traces on to its tips: every source (a tip draws from inside its
// liquid), and every destination unless the stage's dispense doesn't touch the liquid.
function wellsPassingOn(plan, stage) {
  const sources = stage.transfers.map((transfer) => transfer.source);
  if (!dispenseTouchesLiquid(plan.stageList.get(stage.id).settings)) {
    return sources;
  }
  return [...sources, ...stage.transfers.map((transfer) => transfer.destination)];
}

// False only if a stage's destination technique and liquid type are both those of a pipetting mode
// usable at the destination (its plain technique, not its mixing one) whose touchesLiquid is false.
// Anything else counts as touching, so the module errs towards showing a trace: a destination that
// mixes, a mix step (MIX_STEP_MODE's technique is no mode's), and settings no mode has. Matched here
// from PIPETTING_MODES, since a shared module doesn't import the transfer designer's modeOf.
// e.g. Non-Contact's settings at the destination → false; Medium's → true.
function dispenseTouchesLiquid(settings) {
  const nonContact = PIPETTING_MODES.find(
    (mode) =>
      mode.ends.includes("destination") &&
      !mode.touchesLiquid &&
      mode.technique === settings.destinationTechnique &&
      mode.liquidType === settings.destinationLiquidType,
  );
  return nonContact === undefined;
}

// What `well` passes on to a tip: every component it holds at the stage's start (`atStart`) or end
// (`atEnd`), since the order within a stage isn't known, plus what had reached it by the stage's
// start, e.g. ["Water", "Yeast"]. A well holding nothing and reached by nothing passes [] on.
function passedOnBy(well, atStart, atEnd, reached) {
  return [
    ...Object.keys(atStart.componentsOf(well.labware, well.well)),
    ...Object.keys(atEnd.componentsOf(well.labware, well.well)),
    ...(reached.get(wellKey(well)) ?? []),
  ];
}

// Adds each of `names` to the Set `target`.
function addAll(target, names) {
  for (const name of names) {
    target.add(name);
  }
}

// The plan's component names, in its order, e.g. ["Water", "Yeast", "Hy-Soy", "NaOH"].
function componentOrder(plan) {
  return plan.components.map((component) => component.name);
}

// A key naming one well, for Maps, e.g. wellKey({ labware: "Deep1", well: "A3" }) → '["Deep1","A3"]'.
// JSON keeps the two names apart whatever characters they hold.
function wellKey(well) {
  return JSON.stringify([well.labware, well.well]);
}
