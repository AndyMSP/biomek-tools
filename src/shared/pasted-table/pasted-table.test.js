// Unit tests for pasted-table.js. Each test comes from the "Test cases" section of pasted-table.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parsePastedTable, isMultiCell } from "./pasted-table.js";

describe("pasted-table", () => {
  test("Excel's copied text becomes rows of cells", () => {
    assert.deepEqual(parsePastedTable("Drug A\t4\r\nVehicle\t3\r\n"), [
      ["Drug A", "4"],
      ["Vehicle", "3"],
    ]);
  });

  test("\\n and \\r line breaks give the same rows as \\r\\n", () => {
    const expected = [
      ["Drug A", "4"],
      ["Vehicle", "3"],
    ];
    assert.deepEqual(parsePastedTable("Drug A\t4\nVehicle\t3\n"), expected);
    assert.deepEqual(parsePastedTable("Drug A\t4\rVehicle\t3\r"), expected);
  });

  test("only one final line break is ignored", () => {
    assert.deepEqual(parsePastedTable("A\n\n"), [["A"], [""]]);
  });

  test("one column gives one cell per row", () => {
    assert.deepEqual(parsePastedTable("Static\r\nBlank\r\n"), [["Static"], ["Blank"]]);
  });

  test("empty cells are kept", () => {
    assert.deepEqual(parsePastedTable("A\t\tC"), [["A", "", "C"]]);
  });

  test("spaces at the start or end of a cell are kept", () => {
    assert.deepEqual(parsePastedTable(" A \t4"), [[" A ", "4"]]);
  });

  test("rows may have different numbers of cells", () => {
    assert.deepEqual(parsePastedTable("A\t1\nB"), [["A", "1"], ["B"]]);
  });

  test("empty text gives one row with one empty cell", () => {
    assert.deepEqual(parsePastedTable(""), [[""]]);
  });

  test("isMultiCell is true for more than one cell, false for one", () => {
    for (const text of ["A\tB", "A\nB", "Drug A\t4\r\nVehicle\t3\r\n"]) {
      assert.equal(isMultiCell(text), true, JSON.stringify(text));
    }
    for (const text of ["A", "A\n", ""]) {
      assert.equal(isMultiCell(text), false, JSON.stringify(text));
    }
  });

  test("anything but text throws the text error", () => {
    assert.throws(() => parsePastedTable(5), { message: "Pasted text must be text, but got 5." });
    assert.throws(() => isMultiCell(null), { message: "Pasted text must be text, but got null." });
  });
});
