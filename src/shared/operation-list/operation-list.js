// operation-list.js — an ordered list of operations, such as transfers, in the order they were
// planned.
//
// It is the single source of truth for the Biomek output, volume tracking and the transfer designer.
// It only stores and returns operations; it knows nothing about how they were chosen, and doesn't
// check them against labware. Version 1 has one operation type, "transfer".
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
  // The stored operations, in the order they were added. Each one is a frozen copy (see
  // copyTransfer), and the list itself is never changed after the OperationList is created.
  #operations = [];

  // Creates an empty list, e.g. new OperationList(). Takes no arguments.
  constructor() {}

  // Returns a new list with a copy of `operation` added at the end, and leaves this list unchanged,
  // so keep the result: list = list.add(transfer).
  // The operation is checked first, so a failed call throws and nothing is created.
  add(operation) {
    checkOperation(operation);
    const longerList = new OperationList();
    // Code inside the class can set the private field of another OperationList, too. This is the
    // only place that does, and only on the new list, before anyone else can see it.
    longerList.#operations = [...this.#operations, copyTransfer(operation)];
    return longerList;
  }

  // The operations in the order they were added, e.g. [{ type: "transfer", source: …, … }].
  // Builds a new list each time, so changing it doesn't change this list. The operations in it are
  // frozen, so changing one of them throws.
  listOperations() {
    return [...this.#operations];
  }
}

// --- Helpers used only inside this module ---

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
// transfer needs, or if its source, destination or volume isn't valid, e.g.
// { type: "transfer", source: { labware: "Reagents", well: "A1" }, destination: { … }, volume: 50 }.
function checkTransfer(transfer) {
  const missing = findMissingProperties(transfer, ["source", "destination", "volume"]);
  if (missing.length > 0) {
    throw new Error(
      `A transfer needs source, destination and volume, but is missing ${listNames(missing)}.`,
    );
  }
  const extras = findExtraProperties(transfer, ["type", "source", "destination", "volume"]);
  if (extras.length > 0) {
    throw new Error(
      `A transfer can only have type, source, destination and volume, but also got ${listNames(extras)}.`,
    );
  }
  checkEnd(transfer.source, "source");
  checkEnd(transfer.destination, "destination");
  checkVolume(transfer.volume, "volume");
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

// Returns a frozen copy of a valid transfer, with a frozen copy of its source and destination.
// Copying means changing the object given to add() later doesn't change the list. Freezing
// (Object.freeze) means the stored operation can't be changed through what listOperations()
// returns: trying to throws a TypeError. Only the four transfer properties are copied, by name.
function copyTransfer(transfer) {
  return Object.freeze({
    type: transfer.type,
    source: copyEnd(transfer.source),
    destination: copyEnd(transfer.destination),
    volume: transfer.volume,
  });
}

// Returns a frozen copy of a transfer's source or destination,
// e.g. { labware: "Plate 1", well: "D4" } → another, frozen { labware: "Plate 1", well: "D4" }.
function copyEnd(end) {
  return Object.freeze({ labware: end.labware, well: end.well });
}
