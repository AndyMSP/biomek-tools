// operation-list.js — an ordered list of operations, such as transfers, in the order they were
// planned.
//
// It is the single source of truth for the Biomek output, volume tracking and the transfer designer.
// It only stores and returns operations; it knows nothing about how they were chosen, and doesn't
// check them against labware. Version 1 has one operation type, "transfer".
// Specification: operation-list.md.

import { describeValue } from "../error-messages/error-messages.js";

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
  checkVolume(transfer.volume);
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

// Throws if `name` isn't text that isn't blank and has no whitespace at the start or end.
// `subject` says what the name is for the message, e.g. checkName(" Plate 1", "source labware")
// throws 'The source labware " Plate 1" has spaces at the start or end. Remove them.'
// The Biomek finds labware only by its exact name, so stray spaces would make the name not match.
function checkName(name, subject) {
  if (typeof name !== "string") {
    throw new Error(`The ${subject} must be text, but got ${describeValue(name)}.`);
  }
  // trim() removes whitespace (spaces, tabs, line breaks) from both ends of the text.
  if (name.trim() === "") {
    throw new Error(
      `The ${subject} is blank. Give it at least one character that isn't a space.`,
    );
  }
  if (name !== name.trim()) {
    throw new Error(
      `The ${subject} ${describeValue(name)} has spaces at the start or end. Remove them.`,
    );
  }
}

// Throws if `volume` isn't a number of microliters, 0 or more, e.g. 50, 0 or 2.5.
function checkVolume(volume) {
  // Number.isFinite is false for anything that isn't a number (such as the text "50"), and also for
  // NaN and Infinity, which JavaScript counts as numbers.
  if (!Number.isFinite(volume) || volume < 0) {
    throw new Error(
      `The volume must be a number of microliters, 0 or more, like 50, but got ${describeValue(volume)}.`,
    );
  }
}

// True if `value` is an object that isn't null or a list, e.g. { labware: "Plate 1", well: "A1" }.
// In JavaScript, typeof null and typeof a list are both "object", so they're excluded explicitly.
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The names in `required` that `object` doesn't hold itself, in the order of `required`,
// e.g. findMissingProperties({ well: "A1" }, ["labware", "well"]) → ["labware"].
// A property the object gets from elsewhere (e.g. a getter on a class) counts as missing, because it
// wouldn't be copied.
function findMissingProperties(object, required) {
  return required.filter((property) => !Object.hasOwn(object, property));
}

// The object's own property names that aren't in `allowed`, in the order they appear,
// e.g. findExtraProperties({ labware: "Plate 1", wel: "D4" }, ["labware", "well"]) → ["wel"].
// Rejecting them catches typos such as `volme` instead of storing them.
function findExtraProperties(object, allowed) {
  return Object.keys(object).filter((property) => !allowed.includes(property));
}

// Property names as a message shows them, in quotes and separated by commas,
// e.g. ["source", "volume"] → '"source", "volume"'.
function listNames(names) {
  return names.map((name) => describeValue(name)).join(", ");
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
