// Unit tests for pasted-table.js. Each test comes from the "Test cases" section of pasted-table.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parsePastedTable, isMultiCell, tableToText } from "./pasted-table.js";

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

  test("tableToText writes rows as a spreadsheet copies them", () => {
    assert.equal(
      tableToText([
        ["Drug A", "4"],
        ["Vehicle", "3"],
      ]),
      "Drug A\t4\r\nVehicle\t3\r\n",
    );
  });

  test("tableToText writes one cell with its line break", () => {
    assert.equal(tableToText([["A"]]), "A\r\n");
  });

  test("tableToText keeps empty cells and spaces", () => {
    assert.equal(tableToText([[" A ", "", "C"]]), " A \t\tC\r\n");
  });

  test("tableToText keeps rows of different lengths", () => {
    assert.equal(tableToText([["A", "1"], ["B"]]), "A\t1\r\nB\r\n");
  });

  test("tableToText round-trips through parsePastedTable", () => {
    const tables = [
      [
        ["Drug A", "4"],
        ["Vehicle", "3"],
      ],
      [["A"]],
      [[" A ", "", "C"]],
      [["A", "1"], ["B"]],
    ];
    for (const rows of tables) {
      assert.deepEqual(parsePastedTable(tableToText(rows)), rows, JSON.stringify(rows));
    }
  });

  test("tableToText throws its form message for anything but rows of text cells", () => {
    const start = "A table to copy must be a list of rows, each a list of cells, each text, but";
    assert.throws(() => tableToText(5), { message: `${start} got 5.` });
    assert.throws(() => tableToText([]), { message: `${start} got [].` });
    assert.throws(() => tableToText([[]]), { message: `${start} row 1 is [].` });
    assert.throws(() => tableToText([["A"], []]), { message: `${start} row 2 is [].` });
    assert.throws(() => tableToText([["A"], 5]), { message: `${start} row 2 is 5.` });
    assert.throws(() => tableToText([["A", null]]), { message: `${start} row 1, cell 2 is null.` });
  });

  test("tableToText throws for a cell holding a tab or a line break", () => {
    assert.throws(() => tableToText([["A"], ["Feed\tA"]]), {
      message:
        'Row 2, cell 1 holds a tab or a line break, which a copied table can\'t carry: "Feed\\tA".',
    });
    for (const cell of ["A\nB", "A\rB"]) {
      assert.throws(() => tableToText([[cell]]), {
        message: `Row 1, cell 1 holds a tab or a line break, which a copied table can't carry: ${JSON.stringify(cell)}.`,
      });
    }
  });
});
