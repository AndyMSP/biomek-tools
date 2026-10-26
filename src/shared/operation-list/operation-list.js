// operation-list.js — an ordered list of operations, such as transfers, in the order they run.
//
// It is the single source of truth for the Biomek output, volume tracking and the transfer designer.
// It only stores and returns operations; it knows nothing about how they were chosen, and doesn't
// check them against labware. Version 1 has one operation type, "transfer".
// Each transfer names its stage by ID. The list keeps each stage's transfers next to each other, so
// the order of the stages is the order of their transfers, and refuses a transfer that breaks the
// stage rule (ADR 0008).
// Every edit returns a new list that shares the unchanged operations with the old one, so keeping
// many versions for undo stays small.
// Specification: operation-list.md.

import { describeValue } from "../error-messages/error-messages.js";
import {
  isObject,
  findMissingProperties,
  findExtraProperties,
  listNames,
  checkName,
  checkVolume,
} from "../input-checks/input-checks.js";

export class OperationList {
  // Private field (# name): only code inside this class can read or change it.
  // The stored operations, in run order. Each one is a frozen copy (see copyTransfer), and the list
  // itself is never changed after the OperationList is created.
  // A new list made by an edit holds the very same stored operations as this one, except the one
  // added or replaced (structural sharing). That's safe because stored operations are frozen.
  #operations = [];

  // Creates an empty list, e.g. new OperationList(). Takes no arguments.
  constructor() {}

  // Returns a new list with a copy of `operation` right after the last transfer of its stage, or at
  // the end if its stage has no transfers yet, and leaves this list unchanged, so keep the result:
  // list = list.add(transfer).
  // e.g. on a list with stages "1", "2", adding a stage "1" transfer gives "1", "1", "2".
  // The operation is checked first, so a failed call throws and nothing is created.
  add(operation) {
    checkOperation(operation);
    checkStageRule(operation, this.#operations);
    const position = positionAfterStage(this.#operations, operation.stage);
    return this.#withInserted(position, operation);
  }

  // Returns a new list with a copy of `operation`, whose stage must be new, just before the first
  // transfer of `stage`, so the new stage runs right before that one. Leaves this list unchanged.
  // e.g. on a list with stages "1", "2", insertBeforeStage(a stage "3" transfer, "2") gives
  // "1", "3", "2".
  insertBeforeStage(operation, stage) {
    checkOperation(operation);
    checkName(stage, "stage to insert before");
    const position = this.#operations.findIndex((existing) => existing.stage === stage);
    if (position === -1) {
      throw new Error(`There's no stage ${describeValue(stage)} in the list to insert before.`);
    }
    // A stage that already has transfers can't start again somewhere else: that would split it.
    if (this.#operations.some((existing) => existing.stage === operation.stage)) {
      const ownStage = describeValue(operation.stage);
      throw new Error(
        `Stage ${ownStage} already has transfers, so a transfer in it can't start a new stage. Use add to add it to stage ${ownStage}.`,
      );
    }
    checkStageRule(operation, this.#operations);
    return this.#withInserted(position, operation);
  }

  // Returns a new list without the operation at `position` (counting from 0, as in
  // listOperations()), and leaves this list unchanged, e.g. list = list.remove(0).
  // The rest keep their order, so no stage can be split.
  remove(position) {
    checkPosition(position, this.#operations.length, "remove");
    const shorterList = new OperationList();
    // Everything before `position`, then everything after it.
    shorterList.#operations = [
      ...this.#operations.slice(0, position),
      ...this.#operations.slice(position + 1),
    ];
    return shorterList;
  }

  // Returns a new list with a copy of `operation` in place of the operation at `position` (counting
  // from 0, as in listOperations()), and leaves this list unchanged,
  // e.g. list = list.replace(0, { ...firstTransfer, volume: 75 }).
  // `operation` must be in the same stage as the one it replaces, so the order of the stages can't
  // change; every other operation keeps its place.
  replace(position, operation) {
    checkPosition(position, this.#operations.length, "replace");
    checkOperation(operation);
    const replacedStage = this.#operations[position].stage;
    if (operation.stage !== replacedStage) {
      throw new Error(
        `A replacement must stay in stage ${describeValue(replacedStage)}, the stage of operation ${position}, but is in stage ${describeValue(operation.stage)}. To move a transfer to another stage, remove it and add it again.`,
      );
    }
    // The operation being replaced is skipped: a changed copy of a transfer, such as one from a
    // well into itself, mustn't conflict with the transfer it replaces.
    checkStageRule(operation, this.#operations, position);
    const replacedList = new OperationList();
    // Everything before `position`, the new copy, then everything after it.
    replacedList.#operations = [
      ...this.#operations.slice(0, position),
      copyTransfer(operation),
      ...this.#operations.slice(position + 1),
    ];
    return replacedList;
  }

  // The operations in run order, e.g. [{ type: "transfer", source: …, … }].
  // Builds a new list each time, so changing it doesn't change this list. The operations in it are
  // frozen, so changing one of them throws.
  listOperations() {
    return [...this.#operations];
  }

  // The stages in run order, each with its operations in order,
  // e.g. [{ stage: "1", operations: [ … ] }, { stage: "2", operations: [ … ] }]. An empty list
  // gives []. Builds new groups each time, so changing them doesn't change this list.
  // Because a stage's operations are always next to each other, a new group starts exactly where
  // the stage changes.
  groupByStage() {
    const groups = [];
    for (const operation of this.#operations) {
      const lastGroup = groups.at(-1);
      if (lastGroup !== undefined && lastGroup.stage === operation.stage) {
        lastGroup.operations.push(operation);
      } else {
        groups.push({ stage: operation.stage, operations: [operation] });
      }
    }
    return groups;
  }

  // Returns a new list holding this list's operations with a copy of `operation` at `position`,
  // e.g. position 0 puts it first. `operation` must already have been checked.
  #withInserted(position, operation) {
    const longerList = new OperationList();
    // Code inside the class can set the private field of another OperationList, too. Only this
    // method, remove() and replace() do, and only on the new list, before anyone else can see it.
    longerList.#operations = [
      ...this.#operations.slice(0, position),
      copyTransfer(operation),
      ...this.#operations.slice(position),
    ];
    return longerList;
  }
}

// --- Helpers used only inside this module ---

// Throws if `position` isn't a whole number from 0 to `count` - 1, the positions of a list of
// `count` operations. `action` ("remove" or "replace") names what the position is for,
// e.g. checkPosition(7, 5, "remove") → "The position to remove must be a whole number from 0 to 4,
// but got 7."
function checkPosition(position, count, action) {
  if (count === 0) {
    throw new Error(`There are no operations to ${action}.`);
  }
  // Number.isInteger is false for text such as "0", for decimals such as 2.5, and for NaN.
  if (!Number.isInteger(position) || position < 0 || position >= count) {
    throw new Error(
      `The position to ${action} must be a whole number from 0 to ${count - 1}, but got ${describeValue(position)}.`,
    );
  }
}

// Throws if `operation` isn't a valid operation. Version 1 has only one type, so a valid operation
// is a valid transfer. The checks run in the order of the spec's error table, and the first problem
// found is reported.
function checkOperation(operation) {
  if (!isObject(operation)) {
    throw new Error(
      `An operation must be an object with a type, like { type: "transfer", … }, but got ${describeValue(operation)}.`,
    );
  }
  // Only a type the object holds itself counts. One it gets from elsewhere (e.g. a getter on a
  // class) wouldn't be copied, so the stored operation would have no type.
  const type = Object.hasOwn(operation, "type") ? operation.type : undefined;
  if (typeof type !== "string") {
    throw new Error(`An operation needs a type, like "transfer", but got ${describeValue(type)}.`);
  }
  if (type !== "transfer") {
    throw new Error(
      `${describeValue(type)} isn't an operation type. The only type is "transfer".`,
    );
  }
  checkTransfer(operation);
}

// Throws if `transfer` (an object whose type is "transfer") doesn't have exactly the properties a
// transfer needs, or if its source, destination, volume or stage isn't valid, e.g.
// { type: "transfer", source: { labware: "Reagents", well: "A1" }, destination: { … }, volume: 50,
//   stage: "1" }.
function checkTransfer(transfer) {
  const missing = findMissingProperties(transfer, ["source", "destination", "volume", "stage"]);
  if (missing.length > 0) {
    throw new Error(
      `A transfer needs source, destination, volume and stage, but is missing ${listNames(missing)}.`,
    );
  }
  const extras = findExtraProperties(transfer, ["type", "source", "destination", "volume", "stage"]);
  if (extras.length > 0) {
    throw new Error(
      `A transfer can only have type, source, destination, volume and stage, but also got ${listNames(extras)}.`,
    );
  }
  checkEnd(transfer.source, "source");
  checkEnd(transfer.destination, "destination");
  checkVolume(transfer.volume, "volume");
  // A stage ID follows the same rules as a name: text, not blank, no spaces at either end.
  checkName(transfer.stage, "stage");
}

// Throws if `end` (a transfer's source or destination) isn't an object with exactly a labware and a
// well, both valid names, e.g. { labware: "Plate 1", well: "D4" }.
// `endName` is "source" or "destination", so the message says which half of the transfer to fix.
function checkEnd(end, endName) {
  if (!isObject(end)) {
    throw new Error(
      `The ${endName} must be an object with a labware and a well, like { labware: "Plate 1", well: "A1" }, but got ${describeValue(end)}.`,
    );
  }
  const missing = findMissingProperties(end, ["labware", "well"]);
  if (missing.length > 0) {
    throw new Error(
      `The ${endName} needs a labware and a well, but is missing ${listNames(missing)}.`,
    );
  }
  const extras = findExtraProperties(end, ["labware", "well"]);
  if (extras.length > 0) {
    throw new Error(
      `The ${endName} can only have a labware and a well, but also got ${listNames(extras)}.`,
    );
  }
  // Every check on labware runs before any check on well (operation-list.md, section 5).
  checkName(end.labware, `${endName} labware`);
  checkName(end.well, `${endName} well`);
}

// Throws if a valid `transfer` breaks the stage rule against `operations`, the list it's joining:
// within one stage, no well may be both a source and a destination, because the Biomek chooses the
// order within a stage. The source is checked first, then the destination; the first conflicting
// operation is named.
// A transfer from a well into the same well (e.g. to mix) gets no exemption: whether its draw is
// possible depends on whether it runs before or after the stage's other transfers into or out of
// that well. It's checked only against the others, never itself, so on its own it's accepted.
// `skippedPosition` is the position of an operation to leave out, the one replace() is replacing;
// add and insertBeforeStage leave it out (-1), so every operation is checked. Conflicts are named
// by their position in `operations`.
function checkStageRule(transfer, operations, skippedPosition = -1) {
  // Positions in `operations` of the other transfers this one is checked against.
  const sameStage = [];
  operations.forEach((other, position) => {
    if (other.stage === transfer.stage && position !== skippedPosition) {
      sameStage.push(position);
    }
  });
  const sourceConflict = sameStage.find((position) =>
    isSameWell(transfer.source, operations[position].destination),
  );
  if (sourceConflict !== undefined) {
    throw stageRuleError("source", transfer.source, "destination", transfer.stage, sourceConflict);
  }
  const destinationConflict = sameStage.find((position) =>
    isSameWell(transfer.destination, operations[position].source),
  );
  if (destinationConflict !== undefined) {
    throw stageRuleError(
      "destination",
      transfer.destination,
      "source",
      transfer.stage,
      destinationConflict,
    );
  }
}

// The error for a stage-rule conflict: this transfer's `endName` well, `end`, is an `otherEndName`
// of the operation at `position` in `stage`, e.g. stageRuleError("source", { labware: "Plate 1",
// well: "A1" }, "destination", "1", 3) → 'This transfer's source, Plate 1 A1, is a destination in
// stage "1" (operation 3). …'.
function stageRuleError(endName, end, otherEndName, stage, position) {
  return new Error(
    `This transfer's ${endName}, ${end.labware} ${end.well}, is a ${otherEndName} in stage ${describeValue(stage)} (operation ${position}). Within a stage, no well can be both a source and a destination. Put this transfer in another stage.`,
  );
}

// True if two transfer ends name the same well: both labware and well match exactly,
// e.g. { labware: "Plate 1", well: "A1" } and { labware: "Plate 2", well: "A1" } → false.
function isSameWell(firstEnd, secondEnd) {
  return firstEnd.labware === secondEnd.labware && firstEnd.well === secondEnd.well;
}

// Where add puts a transfer in `stage`: right after the stage's last operation, or at the end of
// `operations` if the stage has none, e.g. stages ["1", "1", "2"] and stage "1" → 2.
function positionAfterStage(operations, stage) {
  const lastPosition = operations.findLastIndex((operation) => operation.stage === stage);
  return lastPosition === -1 ? operations.length : lastPosition + 1;
}

// Returns a frozen copy of a valid transfer, with a frozen copy of its source and destination.
// Copying means changing the object given to add() later doesn't change the list. Freezing
// (Object.freeze) means the stored operation can't be changed through what listOperations()
// returns: trying to throws a TypeError. Only the five transfer properties are copied, by name.
function copyTransfer(transfer) {
  return Object.freeze({
    type: transfer.type,
    source: copyEnd(transfer.source),
    destination: copyEnd(transfer.destination),
    volume: transfer.volume,
    stage: transfer.stage,
  });
}

// Returns a frozen copy of a transfer's source or destination,
// e.g. { labware: "Plate 1", well: "D4" } → another, frozen { labware: "Plate 1", well: "D4" }.
function copyEnd(end) {
  return Object.freeze({ labware: end.labware, well: end.well });
}
