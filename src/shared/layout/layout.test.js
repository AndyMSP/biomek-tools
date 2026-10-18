// Unit tests for layout.js. Each test comes from the "Test cases" section of layout.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Layout } from "./layout.js";
import { WellGrid, GRID_96 } from "../well-grid/well-grid.js";

describe("layout", () => {
  // --- Creating a layout ---

  test("new Layout(GRID_96) succeeds and layout.grid is GRID_96", () => {
    const layout = new Layout(GRID_96);
    assert.equal(layout.grid, GRID_96);
  });

  test("a new layout lists 96 wells, all empty", () => {
    const wells = new Layout(GRID_96).listWells();
    assert.equal(wells.length, 96);
    for (const { well, contents } of wells) {
      assert.equal(contents, null, well);
    }
  });

  test("a layout works for other grids", () => {
    const layout = new Layout(new WellGrid(2, 3));
    assert.deepEqual(layout.listWells(), [
      { well: "A1", contents: null },
      { well: "A2", contents: null },
      { well: "A3", contents: null },
      { well: "B1", contents: null },
      { well: "B2", contents: null },
      { well: "B3", contents: null },
    ]);
  });

  test("the grid can't be replaced", () => {
    const layout = new Layout(GRID_96);
    assert.throws(() => {
      layout.grid = new WellGrid(2, 3);
    }, TypeError);
    assert.equal(layout.grid, GRID_96);
  });

  test("anything other than a WellGrid throws the WellGrid error", () => {
    assert.throws(() => new Layout(96), {
      message: "A layout needs a WellGrid, like GRID_96, but got 96.",
    });
    assert.throws(() => new Layout(null), {
      message: "A layout needs a WellGrid, like GRID_96, but got null.",
    });
    assert.throws(() => new Layout({ rows: 8, columns: 12 }), {
      message: "A layout needs a WellGrid, like GRID_96, but got an object.",
    });
  });

  // --- setContents(well, contents) and contentsOf(well) ---

  test("contentsOf() returns what setContents() stored, and other wells stay empty", () => {
    const layout = new Layout(GRID_96);
    layout.setContents("D4", { name: "Condition 3" });
    assert.deepEqual(layout.contentsOf("D4"), { name: "Condition 3" });
    for (const { well, contents } of layout.listWells()) {
      if (well !== "D4") {
        assert.equal(contents, null, well);
      }
    }
  });

  test("setting a well again replaces its contents", () => {
    const layout = new Layout(GRID_96);
    layout.setContents("D4", { name: "Condition 3" });
    layout.setContents("D4", { name: "PBS" });
    assert.deepEqual(layout.contentsOf("D4"), { name: "PBS" });
  });

  test("names of any non-blank text are accepted", () => {
    const layout = new Layout(GRID_96);
    for (const name of ["+", "α", "Condition 3"]) {
      layout.setContents("A1", { name });
      assert.deepEqual(layout.contentsOf("A1"), { name }, name);
    }
  });

  test("changing the object passed to setContents() doesn't change the layout", () => {
    const layout = new Layout(GRID_96);
    const contents = { name: "Condition 3" };
    layout.setContents("D4", contents);
    contents.name = "Changed";
    assert.deepEqual(layout.contentsOf("D4"), { name: "Condition 3" });
  });

  test("changing the object returned by contentsOf() doesn't change the layout", () => {
    const layout = new Layout(GRID_96);
    layout.setContents("D4", { name: "Condition 3" });
    layout.contentsOf("D4").name = "Changed";
    assert.deepEqual(layout.contentsOf("D4"), { name: "Condition 3" });
  });

  // --- listWells() ---

  test("listWells() gives every well in standard order, with set wells showing their contents", () => {
    const layout = new Layout(new WellGrid(2, 2));
    layout.setContents("A2", { name: "PBS" });
    layout.setContents("B1", { name: "Condition 3" });
    assert.deepEqual(layout.listWells(), [
      { well: "A1", contents: null },
      { well: "A2", contents: { name: "PBS" } },
      { well: "B1", contents: { name: "Condition 3" } },
      { well: "B2", contents: null },
    ]);
  });

  test("changing the list from listWells(), or the contents in it, doesn't change the layout", () => {
    const layout = new Layout(new WellGrid(1, 2));
    layout.setContents("A1", { name: "PBS" });
    const wells = layout.listWells();
    wells[0].contents.name = "Changed";
    wells.pop();
    assert.deepEqual(layout.listWells(), [
      { well: "A1", contents: { name: "PBS" } },
      { well: "A2", contents: null },
    ]);
  });

  // --- Errors ---

  test("a well off the grid gives the grid's not-on-this-grid message", () => {
    const layout = new Layout(GRID_96);
    const message = '"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.';
    assert.throws(() => layout.setContents("I1", { name: "PBS" }), { message });
    assert.throws(() => layout.contentsOf("I1"), { message });
  });

  test("a lowercase well name gets the grid's suggestion", () => {
    const layout = new Layout(GRID_96);
    assert.throws(() => layout.setContents("b2", { name: "PBS" }), { message: /Did you mean "B2"\?/ });
    assert.throws(() => layout.contentsOf("b2"), { message: /Did you mean "B2"\?/ });
  });

  test("contents that aren't an object throw the object error", () => {
    const layout = new Layout(GRID_96);
    assert.throws(() => layout.setContents("A1", null), {
      message: 'Contents must be an object with a name, like { name: "PBS" }, but got null.',
    });
    assert.throws(() => layout.setContents("A1", "Static"), { message: /^Contents must be an object/ });
    assert.throws(() => layout.setContents("A1", 5), { message: /^Contents must be an object/ });
    assert.throws(() => layout.setContents("A1", []), {
      message: /^Contents must be an object.*but got a list\.$/,
    });
  });

  test("a missing or non-text name throws the text error", () => {
    const layout = new Layout(GRID_96);
    assert.throws(() => layout.setContents("A1", {}), {
      message: "The contents name must be text, but got undefined.",
    });
    assert.throws(() => layout.setContents("A1", { name: 5 }), {
      message: "The contents name must be text, but got 5.",
    });
  });

  test("a name that comes from a class, not the object itself, counts as missing", () => {
    // A test-only class whose name comes from a getter on the class, so the object itself holds
    // no `name` property.
    class Sample {
      // Returns the name from the class, not from the object.
      get name() {
        return "Static";
      }
    }
    const layout = new Layout(GRID_96);
    assert.throws(() => layout.setContents("A1", new Sample()), {
      message: "The contents name must be text, but got undefined.",
    });
  });

  test("a blank name throws the blank error", () => {
    const layout = new Layout(GRID_96);
    const message =
      "The contents name is blank. Give it at least one character that isn't a space.";
    assert.throws(() => layout.setContents("A1", { name: "" }), { message });
    assert.throws(() => layout.setContents("A1", { name: "   " }), { message });
  });

  test("a name with whitespace at the start or end throws the whitespace error", () => {
    const layout = new Layout(GRID_96);
    assert.throws(() => layout.setContents("A1", { name: " Static" }), {
      message: 'The contents name " Static" has spaces at the start or end. Remove them.',
    });
    assert.throws(() => layout.setContents("A1", { name: "Static " }), {
      message: 'The contents name "Static " has spaces at the start or end. Remove them.',
    });
  });

  test("extra properties are rejected and all named, in order", () => {
    const layout = new Layout(GRID_96);
    assert.throws(() => layout.setContents("A1", { name: "Static", volme: 50 }), {
      message: 'Contents can only have a name, but also got "volme".',
    });
    assert.throws(() => layout.setContents("A1", { name: "Static", volme: 50, color: "blue" }), {
      message: 'Contents can only have a name, but also got "volme", "color".',
    });
  });

  test("checks run in order: a blank name is reported before extra properties", () => {
    const layout = new Layout(GRID_96);
    assert.throws(() => layout.setContents("A1", { name: "", volme: 50 }), {
      message: /^The contents name is blank\./,
    });
  });

  test("a failed setContents() leaves the well's contents unchanged", () => {
    const layout = new Layout(GRID_96);
    layout.setContents("D4", { name: "Condition 3" });
    assert.throws(() => layout.setContents("D4", { name: "" }));
    assert.deepEqual(layout.contentsOf("D4"), { name: "Condition 3" });
  });
});
