// error-messages.js — helpers that build user-facing error messages.
//
// Keeping these in one place means every module words its messages the same way.
// Specification: error-messages.md.

// Shows a value in an error message: text in quotes, anything else as it is (5, null, 2.5).
// The quotes let a reader tell "37" (text) from 37 (a number).
export function describeValue(value) {
  return typeof value === "string" ? `"${value}"` : String(value);
}
