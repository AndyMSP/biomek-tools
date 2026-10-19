// Unit tests for well-selection.js. Each test comes from the "Test cases" section of well-selection.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { WellSelection } from "./well-selection.js";
import { WellGrid, GRID_96 } from "../well-grid/well-grid.js";

describe("well-selection", () => {
  // --- Creating a selection ---

  test("new WellSelection(GRID_96) succeeds with no wells selected", () => {
    const selection = new WellSelection(GRID_96);
    assert.equal(selection.grid, GRID_96);
    assert.deepEqual(selection.selectedWells(), []);
    assert.deepEqual(selection.unselectedWells(), GRID_96.wellNames());
    assert.equal(selection.unselectedWells().length, 96);
  });

  test("a selection works for other grids", () => {
    const selection = new WellSelection(new WellGrid(2, 3));
    assert.deepEqual(selection.unselectedWells(), ["A1", "A2", "A3", "B1", "B2", "B3"]);
  });

  test("the grid can't be replaced", () => {
    const selection = new WellSelection(GRID_96);
    assert.throws(() => {
      selection.grid = new WellGrid(2, 3);
    }, TypeError);
    assert.equal(selection.grid, GRID_96);
  });

  test("anything other than a WellGrid throws the WellGrid error", () => {
    assert.throws(() => new WellSelection(96), {
      message: "A well selection needs a WellGrid, like GRID_96, but got 96.",
    });
    assert.throws(() => new WellSelection(null), {
      message: "A well selection needs a WellGrid, like GRID_96, but got null.",
    });
    assert.throws(() => new WellSelection({ rows: 8, columns: 12 }), {
      message: "A well selection needs a WellGrid, like GRID_96, but got an object.",
    });
  });

  // --- Selecting and deselecting ---

  test("after select(), only that well is selected", () => {
    const selection = new WellSelection(GRID_96);
    selection.select("D4");
    for (const well of GRID_96.wellNames()) {
      assert.equal(selection.isSelected(well), well === "D4", well);
    }
  });

  test("after deselect(), the well isn't selected", () => {
    const selection = new WellSelection(GRID_96);
    selection.select("D4");
    selection.deselect("D4");
    assert.equal(selection.isSelected("D4"), false);
  });

  test("toggle() selects an unselected well, and toggling again deselects it", () => {
    const selection = new WellSelection(GRID_96);
    selection.toggle("D4");
    assert.equal(selection.isSelected("D4"), true);
    selection.toggle("D4");
    assert.equal(selection.isSelected("D4"), false);
  });

  test("selecting a well twice is not an error, and it's listed once", () => {
    const selection = new WellSelection(GRID_96);
    selection.select("D4");
    selection.select("D4");
    assert.deepEqual(selection.selectedWells(), ["D4"]);
  });

  test("deselecting a well that isn't selected is not an error and changes nothing", () => {
    const selection = new WellSelection(GRID_96);
    selection.select("A1");
    selection.deselect("D4");
    assert.deepEqual(selection.selectedWells(), ["A1"]);
  });

  // --- Lists ---

  test("both lists are in standard order, not the order wells were selected", () => {
    const selection = new WellSelection(GRID_96);
    selection.select("H12");
    selection.select("A2");
    selection.select("D4");
    assert.deepEqual(selection.selectedWells(), ["A2", "D4", "H12"]);
    const expectedUnselected = GRID_96.wellNames().filter(
      (well) => !["A2", "D4", "H12"].includes(well),
    );
    assert.deepEqual(selection.unselectedWells(), expectedUnselected);
  });

  test("together the lists contain every well exactly once", () => {
    const selection = new WellSelection(GRID_96);
    selection.select("H12");
    selection.select("A2");
    selection.select("D4");
    const allListed = [...selection.selectedWells(), ...selection.unselectedWells()];
    assert.equal(allListed.length, 96);
    assert.deepEqual(allListed.sort(), GRID_96.wellNames().sort());
  });

  test("changing a returned list doesn't change the selection", () => {
    const selection = new WellSelection(new WellGrid(1, 2));
    selection.select("A1");
    selection.selectedWells().push("A2");
    selection.unselectedWells().pop();
    assert.deepEqual(selection.selectedWells(), ["A1"]);
    assert.deepEqual(selection.unselectedWells(), ["A2"]);
  });

  // --- Errors ---

  test("a well off the grid gives the grid's not-on-this-grid message", () => {
    const selection = new WellSelection(GRID_96);
    const message = '"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.';
    assert.throws(() => selection.select("I1"), { message });
    assert.throws(() => selection.deselect("I1"), { message });
    assert.throws(() => selection.toggle("I1"), { message });
    assert.throws(() => selection.isSelected("I1"), { message });
  });

  test("a lowercase well name gets the grid's suggestion", () => {
    const selection = new WellSelection(GRID_96);
    const message = /Did you mean "B2"\?/;
    assert.throws(() => selection.select("b2"), { message });
    assert.throws(() => selection.deselect("b2"), { message });
    assert.throws(() => selection.toggle("b2"), { message });
    assert.throws(() => selection.isSelected("b2"), { message });
  });

  test("a failed call leaves the selection unchanged", () => {
    const selection = new WellSelection(GRID_96);
    selection.select("D4");
    assert.throws(() => selection.select("I1"));
    assert.deepEqual(selection.selectedWells(), ["D4"]);
  });
});
