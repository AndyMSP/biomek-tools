// error-messages.js — helpers that build user-facing error messages.
//
// Keeping these in one place means every module words its messages the same way.
// Specification: error-messages.md.

// Shows a value in an error message: text in quotes, a list as "a list", any other object as
// "an object", and anything else as it is (5, null, 2.5).
// The quotes let a reader tell "37" (text) from 37 (a number). Lists and objects are described by
// their kind, because showing them in full can be long or misleading, and String() would show
// "[object Object]", or nothing for an empty list.
// e.g. describeValue("37") → "\"37\"", describeValue([]) → "a list", describeValue(null) → "null"
export function describeValue(value) {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (Array.isArray(value)) {
    return "a list";
  }
  // typeof null is also "object" (a long-standing quirk of JavaScript), so null is excluded here
  // and shown as "null" below.
  if (typeof value === "object" && value !== null) {
    return "an object";
  }
  return String(value);
}
