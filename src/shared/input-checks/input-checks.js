// input-checks.js — checks that several modules need to run on their input: whether a value is an
// object, whether it has the right properties, and whether a name or a volume is valid.
//
// Keeping them in one place means every module checks the same things in the same way, and words
// its messages the same way. It knows nothing about plates, operations or experiments; each caller
// says in its own words what is being checked.
// Specification: input-checks.md.

import { describeValue } from "../error-messages/error-messages.js";

// True if `value` is an object that isn't null or a list, e.g. { labware: "Plate 1", well: "A1" }.
// In JavaScript, typeof null and typeof a list are both "object", so they're excluded explicitly.
export function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The names in `required` that `object` doesn't hold itself, in the order of `required`,
// e.g. findMissingProperties({ well: "A1" }, ["labware", "well"]) → ["labware"].
// A property the object gets from elsewhere (e.g. a getter on a class) counts as missing, because it
// wouldn't be copied.
export function findMissingProperties(object, required) {
  return required.filter((property) => !Object.hasOwn(object, property));
}

// The object's own property names that aren't in `allowed`, in the order they appear,
// e.g. findExtraProperties({ labware: "Plate 1", wel: "D4" }, ["labware", "well"]) → ["wel"].
// Rejecting them catches typos such as `volme` instead of storing them.
export function findExtraProperties(object, allowed) {
  return Object.keys(object).filter((property) => !allowed.includes(property));
}

// Property names as a message shows them, in quotes and separated by commas,
// e.g. ["source", "volume"] → '"source", "volume"'.
export function listNames(names) {
  return names.map((name) => describeValue(name)).join(", ");
}

// Throws if `name` isn't text that isn't blank and has no whitespace at the start or end.
// `subject` says what the name is for the message, e.g. checkName(" Plate 1", "source labware")
// throws 'The source labware " Plate 1" has spaces at the start or end. Remove them.'
// The Biomek finds labware only by its exact name, so stray spaces would make the name not match.
export function checkName(name, subject) {
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
// `subject` says what the volume is for the message, e.g. checkVolume(-5, "volume") throws
// "The volume must be a number of microliters, 0 or more, like 50, but got -5."
export function checkVolume(volume, subject) {
  // Number.isFinite is false for anything that isn't a number (such as the text "50"), and also for
  // NaN and Infinity, which JavaScript counts as numbers.
  if (!Number.isFinite(volume) || volume < 0) {
    throw new Error(
      `The ${subject} must be a number of microliters, 0 or more, like 50, but got ${describeValue(volume)}.`,
    );
  }
}
