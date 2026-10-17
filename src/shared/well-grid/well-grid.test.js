// Unit tests for well-grid.js. Each test comes from the "Test cases" section of well-grid.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { WellGrid, GRID_96 } from "./well-grid.js";

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
