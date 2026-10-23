// Unit tests for well-grid.js. Each test comes from the "Test cases" section of well-grid.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { WellGrid, GRID_96, GRID_1X12_NUMBERED } from "./well-grid.js";

describe("well-grid", () => {
  // --- Creating a grid ---

  test("new WellGrid(8, 12) succeeds and GRID_96 is 8 × 12", () => {
    const grid = new WellGrid(8, 12);
    assert.equal(grid.rows, 8);
    assert.equal(grid.columns, 12);
    assert.equal(GRID_96.rows, 8);
    assert.equal(GRID_96.columns, 12);
  });

  test("new WellGrid(26, 1) succeeds (26 rows is the maximum)", () => {
    const grid = new WellGrid(26, 1);
    assert.equal(grid.rows, 26);
  });

  test("invalid rows or columns throw the invalid-grid error", () => {
    assert.throws(() => new WellGrid(0, 12), {
      message:
        "A well grid must have whole-number rows from 1 to 26 and columns of at least 1, but got rows 0, columns 12.",
    });
    assert.throws(() => new WellGrid(8, 1.5), { message: /^A well grid must have/ });
    assert.throws(() => new WellGrid("8", 12), { message: /^A well grid must have/ });
    assert.throws(() => new WellGrid(27, 12), { message: /^A well grid must have/ });
  });

  test("rows and columns cannot be changed after creation", () => {
    const grid = new WellGrid(8, 12);
    assert.throws(() => {
      grid.rows = 4;
    }, TypeError);
    assert.equal(grid.rows, 8);
  });

  test("GRID_96 has naming letter-number", () => {
    assert.equal(GRID_96.naming, "letter-number");
  });

  test("GRID_1X12_NUMBERED has 1 row, 12 columns and naming number", () => {
    assert.equal(GRID_1X12_NUMBERED.rows, 1);
    assert.equal(GRID_1X12_NUMBERED.columns, 12);
    assert.equal(GRID_1X12_NUMBERED.naming, "number");
  });

  test('{ naming: "letter-number" } gives the same grid as leaving the option out', () => {
    const withOption = new WellGrid(8, 12, { naming: "letter-number" });
    const withoutOption = new WellGrid(8, 12);
    assert.equal(withOption.rows, withoutOption.rows);
    assert.equal(withOption.columns, withoutOption.columns);
    assert.equal(withOption.naming, withoutOption.naming);
    assert.deepEqual(withOption.wellNames(), withoutOption.wellNames());
  });

  test("numbered grids have no 26-row limit", () => {
    const grid = new WellGrid(27, 12, { naming: "number" });
    assert.equal(grid.rows, 27);
  });

  test("an invalid numbered grid throws the numbered invalid-grid error", () => {
    assert.throws(() => new WellGrid(0, 12, { naming: "number" }), {
      message:
        "A numbered well grid must have whole-number rows and columns of at least 1, but got rows 0, columns 12.",
    });
  });

  test("an object with a wrong or missing naming throws the invalid-naming error", () => {
    assert.throws(() => new WellGrid(8, 12, { naming: "numbers" }), {
      message: 'A well grid\'s naming must be "letter-number" or "number", but got "numbers".',
    });
    assert.throws(() => new WellGrid(8, 12, { naming: 5 }), {
      message: /^A well grid's naming must be/,
    });
    assert.throws(() => new WellGrid(8, 12, {}), { message: /^A well grid's naming must be/ });
  });

  test("a third argument that isn't an object throws the invalid-options error", () => {
    assert.throws(() => new WellGrid(8, 12, "number"), {
      message: 'A well grid\'s options must be an object like { naming: "number" }, but got "number".',
    });
    assert.throws(() => new WellGrid(8, 12, null), {
      message: /^A well grid's options must be an object/,
    });
    assert.throws(() => new WellGrid(8, 12, ["number"]), {
      message: /^A well grid's options must be an object/,
    });
  });

  test("naming cannot be changed after creation", () => {
    const grid = new WellGrid(1, 12, { naming: "number" });
    assert.throws(() => {
      grid.naming = "letter-number";
    }, TypeError);
    assert.equal(grid.naming, "number");
  });

  // --- wellNames() ---

  test("wellNames() lists all 96 wells in rows-first order", () => {
    const names = GRID_96.wellNames();
    assert.equal(names.length, 96);
    assert.deepEqual(names.slice(0, 13), [
      "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12", "B1",
    ]);
    assert.equal(names.at(-1), "H12");
  });

  test("wellNames() has no duplicates", () => {
    const names = GRID_96.wellNames();
    assert.equal(new Set(names).size, names.length);
  });

  // --- isValidWell(name) ---

  test("isValidWell() is true for wells on the grid", () => {
    for (const name of ["A1", "H12", "D3"]) {
      assert.equal(GRID_96.isValidWell(name), true, name);
    }
  });

  test("isValidWell() is false for anything else, and never throws", () => {
    for (const name of ["I1", "A13", "A0", "b2", "B02", " B2", "B 2", "", "hello", 5, null]) {
      assert.equal(GRID_96.isValidWell(name), false, String(name));
    }
  });

  // --- wellPosition(name) and wellNameAt(row, column) ---

  test("wellPosition() converts names to row and column", () => {
    assert.deepEqual(GRID_96.wellPosition("D3"), { row: 4, column: 3 });
    assert.deepEqual(GRID_96.wellPosition("A1"), { row: 1, column: 1 });
    assert.deepEqual(GRID_96.wellPosition("H12"), { row: 8, column: 12 });
  });

  test("wellNameAt() converts row and column to names", () => {
    assert.equal(GRID_96.wellNameAt(4, 3), "D3");
    assert.equal(GRID_96.wellNameAt(1, 1), "A1");
    assert.equal(GRID_96.wellNameAt(8, 12), "H12");
  });

  test("every well survives a round trip from name to position and back", () => {
    for (const name of GRID_96.wellNames()) {
      const { row, column } = GRID_96.wellPosition(name);
      assert.equal(GRID_96.wellNameAt(row, column), name);
    }
  });

  test("wellNameAt() rejects out-of-range and non-whole numbers", () => {
    assert.throws(() => GRID_96.wellNameAt(9, 1), {
      message: "Row 9 is out of range. Valid rows are 1–8.",
    });
    assert.throws(() => GRID_96.wellNameAt(1, 13), {
      message: "Column 13 is out of range. Valid columns are 1–12.",
    });
    assert.throws(() => GRID_96.wellNameAt(2.5, 1), {
      message: "Row must be a whole number, but got 2.5.",
    });
  });

  // --- isEdgeWell(name) ---

  test("isEdgeWell() is true for wells in the first or last row or column", () => {
    for (const name of ["A1", "A5", "H12", "D1", "D12"]) {
      assert.equal(GRID_96.isEdgeWell(name), true, name);
    }
  });

  test("isEdgeWell() is false for inner wells", () => {
    for (const name of ["B2", "G11", "D6"]) {
      assert.equal(GRID_96.isEdgeWell(name), false, name);
    }
  });

  test("GRID_96 has exactly 36 edge wells", () => {
    const edgeWells = GRID_96.wellNames().filter((name) => GRID_96.isEdgeWell(name));
    assert.equal(edgeWells.length, 36);
  });

  // --- wellsInBox(corner, oppositeCorner) ---

  test("wellsInBox() lists the wells between two corners in standard order", () => {
    assert.deepEqual(GRID_96.wellsInBox("B2", "C4"), ["B2", "B3", "B4", "C2", "C3", "C4"]);
  });

  test("wellsInBox() gives the same box from all four directions", () => {
    const expected = ["B2", "B3", "B4", "C2", "C3", "C4"];
    assert.deepEqual(GRID_96.wellsInBox("C4", "B2"), expected);
    assert.deepEqual(GRID_96.wellsInBox("B4", "C2"), expected);
    assert.deepEqual(GRID_96.wellsInBox("C2", "B4"), expected);
  });

  test("wellsInBox() with equal corners gives one well, and A1 to H12 gives every well", () => {
    assert.deepEqual(GRID_96.wellsInBox("D7", "D7"), ["D7"]);
    assert.deepEqual(GRID_96.wellsInBox("A1", "H12"), GRID_96.wellNames());
  });

  test("wellsInBox() works for a single row and a single column", () => {
    assert.deepEqual(GRID_96.wellsInBox("A3", "A5"), ["A3", "A4", "A5"]);
    assert.deepEqual(GRID_96.wellsInBox("B2", "D2"), ["B2", "C2", "D2"]);
  });

  test("wellsInBox() works on other grids", () => {
    const grid = new WellGrid(2, 3);
    assert.deepEqual(grid.wellsInBox("A1", "B3"), grid.wellNames());
    assert.equal(grid.wellsInBox("A1", "B3").length, 6);
  });

  test("wellsInBox() with a bad corner throws the same message as wellPosition()", () => {
    assert.throws(() => GRID_96.wellsInBox("I1", "A1"), {
      message: '"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.',
    });
    assert.throws(() => GRID_96.wellsInBox("A1", "b2"), { message: /Did you mean "B2"\?/ });
  });

  // --- Numbered grids (on GRID_1X12_NUMBERED unless stated) ---

  test("numbered: wellNames() returns 1 to 12 in order", () => {
    assert.deepEqual(GRID_1X12_NUMBERED.wellNames(), [
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
    ]);
  });

  test("numbered: a 2 × 3 grid counts rows first", () => {
    const grid = new WellGrid(2, 3, { naming: "number" });
    assert.deepEqual(grid.wellNames(), ["1", "2", "3", "4", "5", "6"]);
    assert.deepEqual(grid.wellPosition("4"), { row: 2, column: 1 });
  });

  test("numbered: isValidWell() is true for wells on the grid", () => {
    for (const name of ["1", "5", "12"]) {
      assert.equal(GRID_1X12_NUMBERED.isValidWell(name), true, name);
    }
  });

  test("numbered: isValidWell() is false for anything else, and never throws", () => {
    for (const name of ["0", "13", "05", " 5", "A5", "a5", 5, null]) {
      assert.equal(GRID_1X12_NUMBERED.isValidWell(name), false, String(name));
    }
  });

  test("numbered: wellPosition() and wellNameAt() convert both ways", () => {
    assert.deepEqual(GRID_1X12_NUMBERED.wellPosition("5"), { row: 1, column: 5 });
    assert.equal(GRID_1X12_NUMBERED.wellNameAt(1, 5), "5");
  });

  test("numbered: every well survives a round trip from name to position and back", () => {
    for (const name of GRID_1X12_NUMBERED.wellNames()) {
      const { row, column } = GRID_1X12_NUMBERED.wellPosition(name);
      assert.equal(GRID_1X12_NUMBERED.wellNameAt(row, column), name);
    }
  });

  test("numbered: every well is an edge well", () => {
    for (const name of GRID_1X12_NUMBERED.wellNames()) {
      assert.equal(GRID_1X12_NUMBERED.isEdgeWell(name), true, name);
    }
  });

  test("numbered: wellsInBox() works with corners in either order", () => {
    assert.deepEqual(GRID_1X12_NUMBERED.wellsInBox("7", "5"), ["5", "6", "7"]);
  });

  test("numbered: a letter-number name gets the numbered wrong-format message, with no suggestion", () => {
    assert.throws(() => GRID_1X12_NUMBERED.wellPosition("A5"), {
      message: '"A5" is not a valid well name. Wells on this grid are numbered, with no leading zeros, like "5".',
    });
  });

  test("numbered: a leading zero or a space gets a suggestion", () => {
    assert.throws(() => GRID_1X12_NUMBERED.wellPosition("05"), { message: /Did you mean "5"\?$/ });
    assert.throws(() => GRID_1X12_NUMBERED.wellPosition(" 5"), { message: /Did you mean "5"\?$/ });
  });

  test("numbered: well numbers off the grid get the numbered not-on-this-grid message", () => {
    assert.throws(() => GRID_1X12_NUMBERED.wellPosition("13"), {
      message: '"13" is not on this grid. Valid wells are 1–12.',
    });
    assert.throws(() => GRID_1X12_NUMBERED.wellPosition("0"), {
      message: '"0" is not on this grid. Valid wells are 1–12.',
    });
  });

  // --- Error messages ---

  test("a lowercase name gets a suggestion", () => {
    assert.throws(() => GRID_96.wellPosition("b2"), {
      message:
        '"b2" is not a valid well name. Well names are an uppercase row letter followed by a column number with no leading zeros, like "B2". Did you mean "B2"?',
    });
  });

  test("a name with a leading zero gets a suggestion", () => {
    assert.throws(() => GRID_96.wellPosition("B02"), { message: /Did you mean "B2"\?$/ });
  });

  test("a name that can't be corrected gets no suggestion", () => {
    assert.throws(() => GRID_96.wellPosition("hello"), (error) => {
      assert.match(error.message, /^"hello" is not a valid well name\./);
      assert.doesNotMatch(error.message, /Did you mean/);
      return true;
    });
  });

  test("well names off the grid get the not-on-this-grid message", () => {
    assert.throws(() => GRID_96.wellPosition("I1"), {
      message: '"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.',
    });
    assert.throws(() => GRID_96.wellPosition("A13"), { message: /^"A13" is not on this grid\./ });
    assert.throws(() => GRID_96.wellPosition("A0"), { message: /^"A0" is not on this grid\./ });
  });

  test("a well name that isn't text is rejected", () => {
    assert.throws(() => GRID_96.wellPosition(5), {
      message: "Well name must be text, but got 5.",
    });
  });
});
