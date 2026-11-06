// pasted-table.js — turns text copied from a spreadsheet, such as Excel, into rows of cells, so a
// tool can fill a table from a paste, and turns rows of cells back into such text, so a tool can
// copy a table. It knows nothing about what the cells mean.
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

// The rows as a spreadsheet copies them: cells joined by tabs, each row ended by \r\n (the last
// too), e.g. tableToText([["Drug A", "4"], ["Vehicle", "3"]]) → "Drug A\t4\r\nVehicle\t3\r\n".
// Cells are written exactly, and nothing is quoted, so parsePastedTable gives the rows back; a cell
// holding a tab or a line break would be split by it, so it throws instead.
export function tableToText(rows) {
  checkTableForm(rows);
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, cellIndex) => checkCopyableCell(cell, rowIndex, cellIndex));
  });
  return rows.map((row) => row.join("\t") + "\r\n").join("");
}

// Throws if rows isn't a non-empty list of non-empty lists of text, e.g. checkTableForm([[]]) throws
// "…but row 1 is []." Rows and cells are counted from 1 in the message, as a person counts them.
function checkTableForm(rows) {
  const start = "A table to copy must be a list of rows, each a list of cells, each text, but";
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${start} got ${describeTableValue(rows)}.`);
  }
  rows.forEach((row, rowIndex) => {
    if (!Array.isArray(row) || row.length === 0) {
      throw new Error(`${start} row ${rowIndex + 1} is ${describeTableValue(row)}.`);
    }
    row.forEach((cell, cellIndex) => {
      if (typeof cell !== "string") {
        throw new Error(
          `${start} row ${rowIndex + 1}, cell ${cellIndex + 1} is ${describeValue(cell)}.`,
        );
      }
    });
  });
}

// Shows a table or row in the form message: an empty list as "[]" (so the reader sees it's empty,
// not just "a list"), anything else by describeValue, e.g. describeTableValue([]) → "[]".
function describeTableValue(value) {
  return Array.isArray(value) && value.length === 0 ? "[]" : describeValue(value);
}

// Throws if a cell holds a tab or a line break, which a copied table can't carry, since nothing is
// quoted; the cell is shown with JSON.stringify so a tab shows as \t, e.g. "Feed\tA" (0-based
// indexes, shown counted from 1).
function checkCopyableCell(cell, rowIndex, cellIndex) {
  if (/[\t\n\r]/.test(cell)) {
    throw new Error(
      `Row ${rowIndex + 1}, cell ${cellIndex + 1} holds a tab or a line break, which a copied ` +
        `table can't carry: ${JSON.stringify(cell)}.`,
    );
  }
}

// Throws if the pasted value isn't text, e.g. checkText(5) throws "…but got 5."
function checkText(text) {
  if (typeof text !== "string") {
    throw new Error(`Pasted text must be text, but got ${describeValue(text)}.`);
  }
}
