// Unit tests for randomizer.js. Each test comes from the "Test cases" section of randomizer.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  findProblems,
  randomize,
  contentsToWells,
  wellToContents,
  contentsToWellsText,
  wellToContentsText,
} from "./randomizer.js";
import { GRID_96 } from "../../shared/well-grid/well-grid.js";
import {
  GOLDEN_FILES,
  mainExampleInputs,
  overridesExampleInputs,
  numberedConditions,
  selectionOf,
  goldenEntries,
  goldenFileUrl,
} from "../../../tests/fixtures/randomizer-golden-setups.js";

// The seed used by the setups below, unless a test says otherwise.
const SEED = 37;

// The setups from section 9, each with a function that creates its inputs. Every setup must pass
// the checks and have no problems.
const SETUPS = [
  { name: "the main example", makeInputs: () => mainExampleInputs(SEED) },
  { name: "empty list", makeInputs: emptyListInputs },
  { name: "no fixed wells", makeInputs: noFixedWellsInputs },
  { name: "exact fit", makeInputs: exactFitInputs },
  { name: "scattered fixed wells", makeInputs: scatteredFixedWellsInputs },
  { name: "overrides", makeInputs: mainExampleWithOverridesInputs },
  { name: "overrides on two wells each", makeInputs: overridesExampleInputs },
  { name: "every fixed well overridden", makeInputs: everyFixedWellOverriddenInputs },
  { name: "shared names", makeInputs: sharedNamesInputs },
];

describe("randomizer", () => {
  // --- Checks, run on every setup ---

  for (const { name, makeInputs } of SETUPS) {
    test(`${name}: findProblems returns []`, () => {
      assert.deepEqual(findProblems(makeInputs()), []);
    });

    test(`${name}: replicate, filler and fixed wells are correct, and the plate is complete`, () => {
      const inputs = makeInputs();
      const result = randomize(inputs);
      checkReplicateWells(inputs, result);
      checkFillerWells(inputs, result);
      checkFixedWells(inputs, result);
      checkComplete(inputs, result);
    });

    test(`${name}: running twice with the same seed gives identical plates`, () => {
      const first = randomize(makeInputs());
      const second = randomize(makeInputs());
      assert.deepEqual(wellToContents(second), wellToContents(first));
      assert.deepEqual(second.wellTypes, first.wellTypes);
    });

    test(`${name}: both output lists match the plate`, () => {
      const inputs = makeInputs();
      const result = randomize(inputs);
      checkWellToContents(result);
      checkContentsToWells(inputs, result);
    });
  }

  // --- Setups with their own expectations ---

  test("the result holds the seed used", () => {
    assert.equal(randomize(mainExampleInputs(SEED)).seed, SEED);
  });

  test("empty list: 36 Static fixed-contents wells and 60 Spare filler wells", () => {
    const result = randomize(emptyListInputs());
    assert.equal(countWells(result, "Static", "fixed-contents"), 36);
    assert.equal(countWells(result, "Spare", "filler"), 60);
  });

  test("no fixed wells: 48 Spare filler wells", () => {
    assert.equal(countWells(randomize(noFixedWellsInputs()), "Spare", "filler"), 48);
  });

  test("exact fit: no filler is needed and none appears", () => {
    const inputs = exactFitInputs();
    const result = randomize(inputs);
    assert.ok(!Object.values(result.wellTypes).includes("filler"));
    const listed = contentsToWells(inputs, result).map(({ contents }) => contents);
    assert.deepEqual(listed, inputs.conditions.map(({ name }) => name));
  });

  test("scattered fixed wells: the fixed wells hold Static and there are 6 Spare wells", () => {
    const result = randomize(scatteredFixedWellsInputs());
    for (const well of ["A1", "B5", "D6", "E7", "G11", "H12"]) {
      assert.equal(result.layout.contentsOf(well).name, "Static", well);
      assert.equal(result.wellTypes[well], "fixed-contents", well);
    }
    assert.equal(countWells(result, "Spare", "filler"), 6);
  });

  test("overrides: A1 and H12 hold their overrides and the rest of the ring holds Static", () => {
    const result = randomize(mainExampleWithOverridesInputs());
    assert.equal(result.layout.contentsOf("A1").name, "Override 1");
    assert.equal(result.wellTypes.A1, "override");
    assert.equal(result.layout.contentsOf("H12").name, "Override 2");
    assert.equal(result.wellTypes.H12, "override");
    assert.equal(countWells(result, "Static", "fixed-contents"), 34);
  });

  test("every fixed well overridden: no fixed-contents wells", () => {
    const result = randomize(everyFixedWellOverriddenInputs());
    assert.ok(!Object.values(result.wellTypes).includes("fixed-contents"));
  });

  test("shared names: Static is listed once, with all 48 of its wells", () => {
    const inputs = sharedNamesInputs();
    const result = randomize(inputs);
    const staticRows = contentsToWells(inputs, result).filter(({ contents }) => contents === "Static");
    assert.equal(staticRows.length, 1);
    assert.equal(staticRows[0].wells.length, 48);
    assert.equal(countWells(result, "Static", "fixed-contents"), 36);
    assert.equal(countWells(result, "Static", "replicate"), 4);
    assert.equal(countWells(result, "Static", "filler"), 8);
  });

  // --- Seeds ---

  test("different seeds give different plates on the main example", () => {
    const plate37 = wellToContents(randomize(mainExampleInputs(37)));
    const plate38 = wellToContents(randomize(mainExampleInputs(38)));
    assert.notDeepEqual(plate38, plate37);
  });

  // --- Golden files ---

  for (const { fileName, makeInputs } of GOLDEN_FILES) {
    test(`golden file ${fileName}: the result never changes`, () => {
      const expected = JSON.parse(readFileSync(goldenFileUrl(fileName), "utf8"));
      assert.deepEqual(goldenEntries(randomize(makeInputs())), expected);
    });
  }

  test("the overrides golden setup contains all four well types", () => {
    const types = new Set(Object.values(randomize(overridesExampleInputs()).wellTypes));
    assert.deepEqual([...types].sort(), ["filler", "fixed-contents", "override", "replicate"]);
  });

  // --- Output lists ---

  test("contents → wells lists conditions, then the filler, the fixed contents and the overrides", () => {
    const inputs = overridesExampleInputs();
    const listed = contentsToWells(inputs, randomize(inputs)).map(({ contents }) => contents);
    assert.deepEqual(listed, [
      ...numberedConditions(10, 7).map(({ name }) => name),
      "Spare",
      "Static",
      "Override 1",
      "Override 2",
      "Override 3",
    ]);
  });

  // --- Errors: condition list ---

  test("an empty condition name is reported with its row", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.conditions[2].name = "";
    assert.deepEqual(findProblems(inputs), ["Row 3: the condition name is empty."]);
  });

  test("a condition name of only spaces is reported as empty", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.conditions[2].name = "   ";
    assert.deepEqual(findProblems(inputs), ["Row 3: the condition name is empty."]);
  });

  test("replicates that aren't a whole number of at least 1 are reported with their row", () => {
    for (const [replicates, shown] of [
      [0, "0"],
      [1.5, "1.5"],
      ["four", '"four"'],
    ]) {
      const inputs = mainExampleInputs(SEED);
      inputs.conditions[2].replicates = replicates;
      assert.deepEqual(findProblems(inputs), [
        `Row 3: replicates must be a whole number of at least 1, but got ${shown}.`,
      ]);
    }
  });

  test("a duplicate condition name is reported with both rows", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.conditions[4].name = "Condition 2";
    assert.deepEqual(findProblems(inputs), ['Row 5: "Condition 2" is already listed in row 2.']);
  });

  // --- Errors: open wells, fixed contents and filler ---

  test("too many replicates for the open wells", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.conditions = numberedConditions(16, 4);
    assert.deepEqual(findProblems(inputs), [
      "The conditions need 64 wells, but only 60 are open. Remove 4 replicates or open 4 more wells.",
    ]);
  });

  test("one replicate too many uses the singular", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.conditions = [...numberedConditions(15, 4), { name: "Condition 16", replicates: 1 }];
    assert.deepEqual(findProblems(inputs), [
      "The conditions need 61 wells, but only 60 are open. Remove 1 replicate or open 1 more well.",
    ]);
  });

  test("spare open wells with no filler", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.filler = "";
    assert.deepEqual(findProblems(inputs), [
      "12 open wells are left over. Name a filler for them.",
    ]);
  });

  test("one spare open well with no filler uses the singular", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.conditions = [...numberedConditions(14, 4), { name: "Condition 15", replicates: 3 }];
    inputs.filler = "";
    assert.deepEqual(findProblems(inputs), ["1 open well is left over. Name a filler for it."]);
  });

  test("fixed wells with no contents", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.fixedContents = "";
    assert.deepEqual(findProblems(inputs), ["Name the contents of the fixed wells."]);
  });

  // --- Errors: seed ---

  test("a seed out of range or not a whole number", () => {
    for (const [seed, shown] of [
      [0, "0"],
      [1000000, "1000000"],
      [2.5, "2.5"],
    ]) {
      const inputs = mainExampleInputs(seed);
      assert.deepEqual(findProblems(inputs), [
        `The seed must be a whole number from 1 to 999,999, but got ${shown}.`,
      ]);
    }
  });

  test("the smallest and largest seeds are accepted", () => {
    assert.deepEqual(findProblems(mainExampleInputs(1)), []);
    assert.deepEqual(findProblems(mainExampleInputs(999999)), []);
  });

  // --- Errors: names with a space at the start or end ---

  test("a condition name with a space at the start", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.conditions[0].name = " Condition 1";
    assert.deepEqual(findProblems(inputs), [
      "Row 1: the condition name has a space at the start or end. Remove it.",
    ]);
  });

  test("fixed contents with a space at the end", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.fixedContents = "Static ";
    assert.deepEqual(findProblems(inputs), [
      "The fixed contents have a space at the start or end. Remove it.",
    ]);
  });

  test("a filler with a space at the start", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.filler = " Spare";
    assert.deepEqual(findProblems(inputs), [
      "The filler has a space at the start or end. Remove it.",
    ]);
  });

  // --- Errors: overrides (the safety net) ---

  test("an override well not on the grid gives the grid's message", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.overrides = [{ well: "I1", name: "Override 1" }];
    assert.deepEqual(findProblems(inputs), [
      '"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.',
    ]);
  });

  test("an override on a well that isn't fixed", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.overrides = [{ well: "D4", name: "Override 1" }];
    assert.deepEqual(findProblems(inputs), ["D4 has an override but isn't a fixed well."]);
  });

  test("a well overridden twice", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.overrides = [
      { well: "A1", name: "Override 1" },
      { well: "A1", name: "Override 2" },
    ];
    assert.deepEqual(findProblems(inputs), ["A1 is overridden more than once."]);
  });

  test("an override with an empty name", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.overrides = [{ well: "A1", name: "" }];
    assert.deepEqual(findProblems(inputs), ["The override for A1 has no name."]);
  });

  test("an override name with a space at the start", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.overrides = [{ well: "A1", name: " Override 1" }];
    assert.deepEqual(findProblems(inputs), [
      "The override for A1 has a space at the start or end. Remove it.",
    ]);
  });

  // --- Checking ---

  test("several problems are all returned, in the order of section 7's tables", () => {
    const inputs = mainExampleInputs(0);
    inputs.conditions[0].name = "";
    inputs.fixedContents = "";
    assert.deepEqual(findProblems(inputs), [
      "Row 1: the condition name is empty.",
      "Name the contents of the fixed wells.",
      "The seed must be a whole number from 1 to 999,999, but got 0.",
    ]);
  });

  test("randomize throws the first problem's message", () => {
    const inputs = mainExampleInputs(0);
    inputs.conditions[0].name = "";
    inputs.fixedContents = "";
    assert.throws(() => randomize(inputs), { message: "Row 1: the condition name is empty." });
  });

  // --- Inputs unchanged ---

  test("randomize doesn't change the inputs, and two runs give two separate layouts", () => {
    const inputs = mainExampleWithOverridesInputs();
    const conditionsBefore = structuredClone(inputs.conditions);
    const overridesBefore = structuredClone(inputs.overrides);
    const fixedWellsBefore = inputs.fixedWells.selectedWells();
    const first = randomize(inputs);
    const second = randomize(inputs);
    assert.deepEqual(inputs.conditions, conditionsBefore);
    assert.deepEqual(inputs.overrides, overridesBefore);
    assert.deepEqual(inputs.fixedWells.selectedWells(), fixedWellsBefore);
    assert.notEqual(second.layout, first.layout);
  });

  // --- Copy text ---

  test("well → contents copy text: one tab-separated line per well, no header row", () => {
    const result = randomize(mainExampleInputs(SEED));
    const lines = wellToContentsText(result).split("\n");
    const expected = wellToContents(result).map(({ well, contents }) => `${well}\t${contents}`);
    assert.deepEqual(lines, expected);
    assert.equal(lines[0], "A1\tStatic");
  });

  test("contents → wells copy text: one tab-separated line per contents, no header row", () => {
    const inputs = mainExampleInputs(SEED);
    const result = randomize(inputs);
    const lines = contentsToWellsText(inputs, result).split("\n");
    const expected = contentsToWells(inputs, result).map(
      ({ contents, wells }) => `${contents}\t${wells.join(", ")}`,
    );
    assert.deepEqual(lines, expected);
    assert.ok(lines[0].startsWith("Condition 1\t"));
    const outerRing = GRID_96.wellNames().filter((well) => GRID_96.isEdgeWell(well));
    assert.equal(lines.at(-1), `Static\t${outerRing.join(", ")}`);
  });
});

// --- Setups (section 9) ---

// Empty list: the main example with no conditions, so every open well gets the filler.
function emptyListInputs() {
  return { ...mainExampleInputs(SEED), conditions: [] };
}

// No fixed wells: all 96 wells open; 12 conditions × 4 replicates, so 48 Spare.
function noFixedWellsInputs() {
  return { ...mainExampleInputs(SEED), fixedWells: selectionOf([]) };
}

// Exact fit: no fixed wells; 12 conditions × 8 replicates exactly fill the plate, so no filler.
function exactFitInputs() {
  return {
    ...mainExampleInputs(SEED),
    fixedWells: selectionOf([]),
    conditions: numberedConditions(12, 8),
    filler: "",
  };
}

// Scattered fixed wells: six fixed wells on the edge and inside the plate, holding Static;
// 12 conditions × 7 replicates (84) in 90 open wells, so 6 Spare.
function scatteredFixedWellsInputs() {
  return {
    ...mainExampleInputs(SEED),
    fixedWells: selectionOf(["A1", "B5", "D6", "E7", "G11", "H12"]),
    conditions: numberedConditions(12, 7),
  };
}

// Overrides: the main example with A1 overridden to Override 1 and H12 to Override 2.
function mainExampleWithOverridesInputs() {
  return {
    ...mainExampleInputs(SEED),
    overrides: [
      { well: "A1", name: "Override 1" },
      { well: "H12", name: "Override 2" },
    ],
  };
}

// Every fixed well overridden: A1 and H12 fixed and overridden, so no fixed contents are needed.
function everyFixedWellOverriddenInputs() {
  return {
    ...mainExampleInputs(SEED),
    fixedWells: selectionOf(["A1", "H12"]),
    fixedContents: "",
    overrides: [
      { well: "A1", name: "Override 1" },
      { well: "H12", name: "Override 2" },
    ],
  };
}

// Shared names: the main example plus a condition "Static" with 4 replicates, and filler "Static"
// (52 replicates, 8 filler wells).
function sharedNamesInputs() {
  return {
    ...mainExampleInputs(SEED),
    conditions: [...numberedConditions(12, 4), { name: "Static", replicates: 4 }],
    filler: "Static",
  };
}

// --- Checks (section 9) ---

// The number of wells holding `name` with the given type, e.g. countWells(result, "Spare", "filler").
function countWells(result, name, type) {
  return wellToContents(result).filter(
    ({ well, contents }) => contents === name && result.wellTypes[well] === type,
  ).length;
}

// Check 1: each condition has exactly as many replicate wells as its replicate count, and there
// are no other replicate wells.
function checkReplicateWells(inputs, result) {
  let totalReplicates = 0;
  for (const { name, replicates } of inputs.conditions) {
    assert.equal(countWells(result, name, "replicate"), replicates, name);
    totalReplicates += replicates;
  }
  const replicateWells = Object.values(result.wellTypes).filter((type) => type === "replicate");
  assert.equal(replicateWells.length, totalReplicates);
}

// Check 2: the number of filler wells is the open wells minus the replicates, and every filler well
// holds the filler.
function checkFillerWells(inputs, result) {
  const openWellCount = inputs.fixedWells.unselectedWells().length;
  const totalReplicates = inputs.conditions.reduce((total, { replicates }) => total + replicates, 0);
  const fillerWells = Object.keys(result.wellTypes).filter(
    (well) => result.wellTypes[well] === "filler",
  );
  assert.equal(fillerWells.length, openWellCount - totalReplicates);
  for (const well of fillerWells) {
    assert.equal(result.layout.contentsOf(well).name, inputs.filler, well);
  }
}

// Check 3: every fixed well is an override well holding its override, or a fixed-contents well
// holding the fixed contents.
function checkFixedWells(inputs, result) {
  const overrideNameByWell = new Map(inputs.overrides.map(({ well, name }) => [well, name]));
  for (const well of inputs.fixedWells.selectedWells()) {
    const name = result.layout.contentsOf(well).name;
    if (overrideNameByWell.has(well)) {
      assert.equal(result.wellTypes[well], "override", well);
      assert.equal(name, overrideNameByWell.get(well), well);
    } else {
      assert.equal(result.wellTypes[well], "fixed-contents", well);
      assert.equal(name, inputs.fixedContents, well);
    }
  }
}

// Check 4: all 96 wells have contents and one of the four types, and the open wells are exactly
// the replicate and filler wells.
function checkComplete(inputs, result) {
  const wellTypes = ["replicate", "filler", "fixed-contents", "override"];
  assert.deepEqual(Object.keys(result.wellTypes), GRID_96.wellNames());
  for (const { well, contents } of result.layout.listWells()) {
    assert.notEqual(contents, null, well);
    assert.ok(wellTypes.includes(result.wellTypes[well]), well);
  }
  const randomWells = GRID_96.wellNames().filter((well) =>
    ["replicate", "filler"].includes(result.wellTypes[well]),
  );
  assert.deepEqual(randomWells, inputs.fixedWells.unselectedWells());
}

// Check 6, well → contents: all 96 wells in standard order, each with its contents on the plate.
function checkWellToContents(result) {
  const expected = GRID_96.wellNames().map((well) => ({
    well,
    contents: result.layout.contentsOf(well).name,
  }));
  assert.deepEqual(wellToContents(result), expected);
}

// Check 6, contents → wells: each contents is listed once, its wells are in standard order and all
// hold it, and together the rows list every well exactly once.
function checkContentsToWells(inputs, result) {
  const rows = contentsToWells(inputs, result);
  const listedContents = rows.map(({ contents }) => contents);
  assert.equal(new Set(listedContents).size, listedContents.length);
  for (const { contents, wells } of rows) {
    const inStandardOrder = GRID_96.wellNames().filter((well) => wells.includes(well));
    assert.deepEqual(wells, inStandardOrder, contents);
    for (const well of wells) {
      assert.equal(result.layout.contentsOf(well).name, contents, well);
    }
  }
  const allListedWells = rows.flatMap(({ wells }) => wells);
  assert.deepEqual([...allListedWells].sort(), [...GRID_96.wellNames()].sort());
}
