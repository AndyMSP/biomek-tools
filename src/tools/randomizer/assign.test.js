// Unit tests for assign.js. The setups and checks come from randomizer.md section 8; the rest from
// assign.md section 6.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findProblems, randomize, WELL_TYPES } from "./assign.js";
import { GRID_96 } from "../../shared/well-grid/well-grid.js";
import { WellSelection } from "../../shared/well-selection/well-selection.js";

// --- Test setups ---

// A selection of the given wells on GRID_96, e.g. fixed(["A1", "H12"]).
function fixed(wells) {
  const selection = new WellSelection(GRID_96);
  wells.forEach((well) => selection.select(well));
  return selection;
}

// The 36 edge wells of GRID_96.
const EDGE_WELLS = GRID_96.wellNames().filter((well) => GRID_96.isEdgeWell(well));

// Conditions "Condition 1" … "Condition 12", each with the given replicates.
function twelveConditions(replicates) {
  return Array.from({ length: 12 }, (_, index) => ({ name: `Condition ${index + 1}`, replicates }));
}

// The main example: outer ring fixed with Static, 12 conditions × 4, filler Spare, seed 37.
// Any property can be replaced, e.g. mainExample({ seed: 1 }).
function mainExample(changes = {}) {
  return {
    fixedWells: fixed(EDGE_WELLS),
    conditions: twelveConditions(4),
    fixedContents: "Static",
    overrides: [],
    filler: "Spare",
    seed: 37,
    ...changes,
  };
}

// The setups of randomizer.md section 8, by name.
const SETUPS = {
  "main example": mainExample(),
  "empty list": mainExample({ conditions: [] }),
  "no fixed wells": mainExample({ fixedWells: fixed([]), fixedContents: "" }),
  "exact fit": mainExample({ fixedWells: fixed([]), conditions: twelveConditions(8), filler: "" }),
  "scattered fixed wells": mainExample({
    fixedWells: fixed(["A1", "B5", "D6", "E7", "G11", "H12"]),
    conditions: twelveConditions(7),
  }),
  overrides: mainExample({
    overrides: [
      { well: "A1", name: "Override 1" },
      { well: "H12", name: "Override 2" },
    ],
  }),
  "shared names": mainExample({
    conditions: [...twelveConditions(4), { name: "Static", replicates: 4 }],
    filler: "Static",
  }),
};

// Wells of the given type in the result, in standard order.
function wellsOfType(result, type) {
  return GRID_96.wellNames().filter((well) => result.wellTypes.get(well) === type);
}

// Runs checks 1–5 of randomizer.md section 8 on a setup.
function checkSetup(inputs) {
  const result = randomize(inputs);
  const openWells = inputs.fixedWells.unselectedWells();
  const replicateWells = wellsOfType(result, WELL_TYPES.REPLICATE);
  const fillerWells = wellsOfType(result, WELL_TYPES.FILLER);

  // 1. Replicate wells: each condition has exactly as many as its replicate count.
  for (const { name, replicates } of inputs.conditions) {
    const count = replicateWells.filter((well) => result.layout.contentsOf(well).name === name).length;
    assert.equal(count, replicates, name);
  }
  // 2. Filler wells: open wells minus replicates, each holding the filler.
  const replicateTotal = inputs.conditions.reduce((sum, row) => sum + row.replicates, 0);
  assert.equal(fillerWells.length, openWells.length - replicateTotal);
  for (const well of fillerWells) {
    assert.equal(result.layout.contentsOf(well).name, inputs.filler, well);
  }
  // 3. Fixed wells: fixed-contents holding the fixed contents, or override holding its override.
  const overrideByWell = new Map(inputs.overrides.map((row) => [row.well, row.name]));
  for (const well of inputs.fixedWells.selectedWells()) {
    if (overrideByWell.has(well)) {
      assert.equal(result.wellTypes.get(well), WELL_TYPES.OVERRIDE, well);
      assert.equal(result.layout.contentsOf(well).name, overrideByWell.get(well), well);
    } else {
      assert.equal(result.wellTypes.get(well), WELL_TYPES.FIXED_CONTENTS, well);
      assert.equal(result.layout.contentsOf(well).name, inputs.fixedContents, well);
    }
  }
  // 4. Complete: all 96 wells have contents and a type; open wells are the replicate and filler wells.
  for (const { well, contents } of result.layout.listWells()) {
    assert.notEqual(contents, null, well);
    assert.ok(Object.values(WELL_TYPES).includes(result.wellTypes.get(well)), well);
  }
  assert.deepEqual([...replicateWells, ...fillerWells].sort(), [...openWells].sort());
  // 5. Reproducible: the same inputs and seed give identical plates.
  assert.deepEqual(plateOf(randomize(inputs)), plateOf(result));
  return result;
}

// Every well with its contents name and type, e.g. [{ well: "A1", contents: "Static", type: … }, …].
function plateOf(result) {
  return result.layout.listWells().map(({ well, contents }) => ({
    well,
    contents: contents.name,
    type: result.wellTypes.get(well),
  }));
}

describe("assign", () => {
  // --- Setups and checks (randomizer.md section 8) ---

  for (const [name, inputs] of Object.entries(SETUPS)) {
    test(`${name}: passes every check, and findProblems() finds none`, () => {
      assert.deepEqual(findProblems(inputs), []);
      checkSetup(inputs);
    });
  }

  test("empty list: 36 Static fixed-contents wells and 60 Spare filler wells", () => {
    const result = randomize(SETUPS["empty list"]);
    assert.equal(wellsOfType(result, WELL_TYPES.FIXED_CONTENTS).length, 36);
    assert.equal(wellsOfType(result, WELL_TYPES.FILLER).length, 60);
  });

  test("exact fit: no filler wells", () => {
    assert.equal(wellsOfType(randomize(SETUPS["exact fit"]), WELL_TYPES.FILLER).length, 0);
  });

  test("shared names: Static fills 48 wells of three types", () => {
    const result = randomize(SETUPS["shared names"]);
    const staticWells = plateOf(result).filter((well) => well.contents === "Static");
    assert.equal(staticWells.length, 48);
    assert.equal(staticWells.filter((well) => well.type === WELL_TYPES.FIXED_CONTENTS).length, 36);
    assert.equal(staticWells.filter((well) => well.type === WELL_TYPES.REPLICATE).length, 4);
    assert.equal(staticWells.filter((well) => well.type === WELL_TYPES.FILLER).length, 8);
  });

  test("names are trimmed", () => {
    const result = randomize(
      mainExample({ conditions: [{ name: " Condition 1 ", replicates: 4 }], fixedContents: " Static " }),
    );
    assert.equal(result.layout.contentsOf("A1").name, "Static");
    assert.equal(plateOf(result).filter((well) => well.contents === "Condition 1").length, 4);
  });

  test("overrides cover every fixed well: no fixed contents needed", () => {
    const inputs = mainExample({
      fixedWells: fixed(["A1"]),
      fixedContents: "",
      overrides: [{ well: "A1", name: "Override 1" }],
    });
    assert.deepEqual(findProblems(inputs), []);
    assert.equal(randomize(inputs).layout.contentsOf("A1").name, "Override 1");
  });

  // --- Seeds ---

  test("different seeds give different plates", () => {
    assert.notDeepEqual(plateOf(randomize(mainExample({ seed: 37 }))), plateOf(randomize(mainExample({ seed: 38 }))));
  });

  test("golden file: the main example with seed 37 never changes", () => {
    const golden = JSON.parse(
      readFileSync(new URL("../../../tests/fixtures/randomizer-main-seed-37.json", import.meta.url)),
    );
    assert.deepEqual(plateOf(randomize(mainExample())), golden);
  });

  // --- Problems (randomizer.md section 7, assign.md section 5) ---

  // Asserts that findProblems gives exactly these messages and randomize throws the first.
  function assertProblems(inputs, messages) {
    assert.deepEqual(findProblems(inputs), messages);
    assert.throws(() => randomize(inputs), { message: messages[0] });
  }

  test("an empty condition name is reported with its row", () => {
    const conditions = [...twelveConditions(4).slice(0, 2), { name: "  ", replicates: 4 }];
    assertProblems(mainExample({ conditions }), ["Row 3: the condition name is empty."]);
  });

  test("replicates that aren't a whole number of at least 1 are reported with their row", () => {
    for (const [replicates, shown] of [[0, "0"], [1.5, "1.5"], ["four", '"four"']]) {
      const conditions = [{ name: "Condition 1", replicates }];
      assertProblems(mainExample({ conditions }), [
        `Row 1: replicates must be a whole number of at least 1, but got ${shown}.`,
      ]);
    }
  });

  test("a duplicate name is reported with both rows", () => {
    const conditions = [...twelveConditions(4).slice(0, 4), { name: "Condition 2", replicates: 4 }];
    assertProblems(mainExample({ conditions }), ['Row 5: "Condition 2" is already listed in row 2.']);
  });

  test("too many replicates for the open wells", () => {
    const conditions = [...twelveConditions(4), { name: "Condition 13", replicates: 16 }];
    assertProblems(mainExample({ conditions }), [
      "The conditions need 64 wells, but only 60 are open. Remove 4 replicates or open 4 more wells.",
    ]);
  });

  test("too many replicates by one uses the singular", () => {
    const conditions = [...twelveConditions(4), { name: "Condition 13", replicates: 13 }];
    assertProblems(mainExample({ conditions }), [
      "The conditions need 61 wells, but only 60 are open. Remove 1 replicate or open 1 more well.",
    ]);
  });

  test("spare open wells with no filler", () => {
    assertProblems(mainExample({ filler: "" }), ["12 open wells are left over. Name a filler for them."]);
    const conditions = [...twelveConditions(4), { name: "Condition 13", replicates: 11 }];
    assertProblems(mainExample({ conditions, filler: " " }), [
      "1 open well is left over. Name a filler for it.",
    ]);
  });

  test("fixed wells with no contents", () => {
    assertProblems(mainExample({ fixedContents: "" }), ["Name the contents of the fixed wells."]);
  });

  test("seeds out of range or not whole numbers", () => {
    for (const [seed, shown] of [[0, "0"], [1000000, "1000000"], [2.5, "2.5"], ["37", '"37"']]) {
      assertProblems(mainExample({ seed }), [
        `The seed must be a whole number from 1 to 999,999, but got ${shown}.`,
      ]);
    }
  });

  test("override problems are reported with their row", () => {
    const overrides = [
      { well: "D4", name: "Override 1" },
      { well: "I1", name: "Override 2" },
      { well: "A1", name: "Override 3" },
      { well: "A1", name: "" },
    ];
    assertProblems(mainExample({ overrides }), [
      "Override row 1: D4 isn't a fixed well. Fix it, or remove the override.",
      'Override row 2: "I1" is not on this grid. Valid wells are rows A–H, columns 1–12.',
      "Override row 4: A1 is already overridden in row 3.",
      "Override row 4: the contents name is empty.",
    ]);
  });

  test("several problems are all found, in order", () => {
    const inputs = mainExample({
      conditions: [{ name: "", replicates: 0 }],
      fixedContents: "",
      seed: 0,
    });
    assert.deepEqual(findProblems(inputs), [
      "Row 1: the condition name is empty.",
      "Row 1: replicates must be a whole number of at least 1, but got 0.",
      "Name the contents of the fixed wells.",
      "The seed must be a whole number from 1 to 999,999, but got 0.",
    ]);
  });

  test("inputs shaped wrongly by the calling code throw", () => {
    assert.throws(() => findProblems({ ...mainExample(), fixedWells: GRID_96 }), {
      message: "fixedWells must be a WellSelection, but got an object.",
    });
    assert.throws(() => findProblems({ ...mainExample(), conditions: null }), {
      message: "conditions must be a list, but got null.",
    });
  });
});
