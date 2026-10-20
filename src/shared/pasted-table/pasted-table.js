// pasted-table.js — turns text copied from a spreadsheet, such as Excel, into rows of cells, so a
// tool can fill a table from a paste. It knows nothing about what the cells mean.
//
// A spreadsheet copies cells as plain text: cells in a row separated by tabs, each row ending in a
// line break (Excel uses \r\n, and adds one after the last row too).
// Specification: pasted-table.md.

import { describeValue } from "../error-messages/error-messages.js";

// The rows of cells in pasted text, each row a list of its cells' text, in order,
// e.g. "Drug A\t4\r\nVehicle\t3\r\n" → [["Drug A", "4"], ["Vehicle", "3"]].
// Any kind of line break (\r\n, \n or \r) ends a row, and one line break at the very end is ignored.
// Cells are kept exactly as copied, spaces included, so the tool's own checks can report them.
export function parsePastedTable(text) {
  checkText(text);
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  return lines.map((line) => line.split("\t"));
}

// True if pasted text holds more than one cell, so a tool should fill a table rather than one box,
// e.g. isMultiCell("A\tB") → true, isMultiCell("A\n") → false.
export function isMultiCell(text) {
  const rows = parsePastedTable(text);
  return rows.length > 1 || rows[0].length > 1;
}

// Throws if the pasted value isn't text, e.g. checkText(5) throws "…but got 5."
function checkText(text) {
  if (typeof text !== "string") {
    throw new Error(`Pasted text must be text, but got ${describeValue(text)}.`);
  }
}
