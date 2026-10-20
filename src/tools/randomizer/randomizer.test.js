// Unit tests for randomizer.js. Each test comes from the "Test cases" section of randomizer.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  findProblems,
  placeName,
  openWells,
  randomize,
  matchesInputs,
  listingOrder,
  spareWellCount,
  randomSeed,
  contentsToWells,
  wellToContents,
  contentsToWellsText,
  wellToContentsText,
} from "./randomizer.js";
import { GRID_96 } from "../../shared/well-grid/well-grid.js";
import {
  GOLDEN_FILES,
  mainExampleInputs,
  fixedEntriesExampleInputs,
  numberedConditions,
  entry,
  goldenEntries,
  goldenFileUrl,
} from "../../../tests/fixtures/randomizer-golden-setups.js";

// The seed used by the setups below, unless a test says otherwise.
const SEED = 37;

// The 36 wells of the outer ring, in standard order.
const OUTER_RING = GRID_96.wellNames().filter((well) => GRID_96.isEdgeWell(well));

// The setups from section 9, each with a function that creates its inputs. Every setup must pass
// the checks and have no problems.
const SETUPS = [
  { name: "the main example", makeInputs: () => mainExampleInputs(SEED) },
  { name: "empty list", makeInputs: emptyListInputs },
  { name: "no fixed wells", makeInputs: noFixedWellsInputs },
  { name: "exact fit", makeInputs: exactFitInputs },
  { name: "scattered fixed wells", makeInputs: scatteredFixedWellsInputs },
  { name: "several fixed contents", makeInputs: severalFixedContentsInputs },
  { name: "fixed contents on two wells each", makeInputs: fixedEntriesExampleInputs },
  { name: "unused entries", makeInputs: unusedEntriesInputs },
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
      const result = randomize(makeInputs());
      checkWellToContents(result);
      checkContentsToWells(result);
    });
  }

  // --- Setups with their own expectations ---

  test("empty rows: completely empty rows are skipped and the plate is the main example's", () => {
    const inputs = emptyRowsInputs();
    assert.deepEqual(findProblems(inputs), []);
    assert.equal(spareWellCount(inputs), 12);
    assert.deepEqual(
      wellToContents(randomize(inputs)),
      wellToContents(randomize(mainExampleInputs(SEED))),
    );
  });

  test("empty rows: a row with only a name or only replicates is checked, not skipped", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.conditions.push({ name: "", replicates: 4 }, { name: "Condition 14", replicates: "" });
    assert.deepEqual(findProblems(inputs), [
      "Row 13: the condition name is empty.",
      "Row 14: the number of replicates is missing.",
    ]);
  });

  test("empty rows: row numbers in messages still count the empty rows", () => {
    // Condition 3 is on row 5, below two empty rows.
    const inputs = emptyRowsInputs();
    inputs.conditions[4].name = "";
    assert.deepEqual(findProblems(inputs), ["Row 5: the condition name is empty."]);
  });

  test("the result's inputs hold the seed used", () => {
    assert.equal(randomize(mainExampleInputs(SEED)).inputs.seed, SEED);
  });

  test("empty list: 36 Static fixed wells and 60 Spare filler wells", () => {
    const result = randomize(emptyListInputs());
    assert.equal(countWells(result, "Static", "fixed"), 36);
    assert.equal(countWells(result, "Spare", "filler"), 60);
  });

  test("no fixed wells: 48 Spare filler wells", () => {
    assert.equal(countWells(randomize(noFixedWellsInputs()), "Spare", "filler"), 48);
  });

  test("exact fit: no filler is needed and none appears", () => {
    const inputs = exactFitInputs();
    const result = randomize(inputs);
    assert.ok(!Object.values(result.wellTypes).includes("filler"));
    const listed = contentsToWells(result).map(({ contents }) => contents);
    assert.deepEqual(listed, inputs.conditions.map(({ name }) => name));
  });

  test("scattered fixed wells: the fixed wells hold Static and there are 6 Spare wells", () => {
    const result = randomize(scatteredFixedWellsInputs());
    for (const well of ["A1", "B5", "D6", "E7", "G11", "H12"]) {
      assert.equal(result.layout.contentsOf(well).name, "Static", well);
      assert.equal(result.wellTypes[well], "fixed", well);
    }
    assert.equal(countWells(result, "Spare", "filler"), 6);
  });

  test("several fixed contents: A1 and H12 hold their entries and the rest of the ring holds Static", () => {
    const result = randomize(severalFixedContentsInputs());
    assert.equal(result.layout.contentsOf("A1").name, "Fixed 1");
    assert.equal(result.layout.contentsOf("H12").name, "Fixed 2");
    assert.equal(countWells(result, "Static", "fixed"), 34);
  });

  test("unused entries: neither appears in the outputs", () => {
    const result = randomize(unusedEntriesInputs());
    const listed = contentsToWells(result).map(({ contents }) => contents);
    assert.ok(!listed.includes("Unused"));
    assert.ok(!listed.includes(""));
    assert.ok(!wellToContents(result).some(({ contents }) => contents === "Unused"));
  });

  test("shared names: Static is listed once, with all 48 of its wells", () => {
    const result = randomize(sharedNamesInputs());
    const staticRows = contentsToWells(result).filter(({ contents }) => contents === "Static");
    assert.equal(staticRows.length, 1);
    assert.equal(staticRows[0].wells.length, 48);
    assert.equal(countWells(result, "Static", "fixed"), 36);
    assert.equal(countWells(result, "Static", "replicate"), 4);
    assert.equal(countWells(result, "Static", "filler"), 8);
  });

  // --- Placing and opening wells ---

  test("placeName puts open wells in the entry, and moves a well from another entry", () => {
    const fixedContents = [entry("Static", []), entry("Blank", [])];
    placeName(fixedContents, ["A1", "A2"], fixedContents[0]);
    assert.deepEqual(fixedContents[0].wells.selectedWells(), ["A1", "A2"]);
    placeName(fixedContents, ["A2"], fixedContents[1]);
    assert.deepEqual(fixedContents[0].wells.selectedWells(), ["A1"]);
    assert.deepEqual(fixedContents[1].wells.selectedWells(), ["A2"]);
  });

  test("placeName with a box from wellsInBox places all 6 wells", () => {
    const fixedContents = [entry("Static", [])];
    placeName(fixedContents, GRID_96.wellsInBox("B2", "C4"), fixedContents[0]);
    assert.deepEqual(fixedContents[0].wells.selectedWells(), ["B2", "B3", "B4", "C2", "C3", "C4"]);
  });

  test("placing a well already in the entry, or opening an open well, changes nothing", () => {
    const fixedContents = [entry("Static", ["A1"]), entry("Blank", ["H12"])];
    placeName(fixedContents, ["A1"], fixedContents[0]);
    openWells(fixedContents, ["D4"]);
    assert.deepEqual(fixedContents[0].wells.selectedWells(), ["A1"]);
    assert.deepEqual(fixedContents[1].wells.selectedWells(), ["H12"]);
  });

  test("openWells removes wells from whichever entry holds them", () => {
    const fixedContents = [entry("Static", ["A1", "A2"]), entry("Blank", ["H12"])];
    openWells(fixedContents, ["A2", "H12"]);
    assert.deepEqual(fixedContents[0].wells.selectedWells(), ["A1"]);
    assert.deepEqual(fixedContents[1].wells.selectedWells(), []);
  });

  test("renaming an entry keeps its wells", () => {
    const fixedContents = [entry("Static", ["A1", "A2"])];
    fixedContents[0].name = "Renamed";
    assert.deepEqual(fixedContents[0].wells.selectedWells(), ["A1", "A2"]);
  });

  test("an invalid well throws the grid's message and changes nothing", () => {
    const fixedContents = [entry("Static", ["A1"]), entry("Blank", ["H12"])];
    assert.throws(() => placeName(fixedContents, ["A3", "I1"], fixedContents[0]), {
      message: '"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.',
    });
    assert.throws(() => placeName(fixedContents, ["H12", "b2"], fixedContents[0]), {
      message: /Did you mean "B2"\?/,
    });
    assert.throws(() => openWells(fixedContents, ["A1", "I1"]), {
      message: '"I1" is not on this grid. Valid wells are rows A–H, columns 1–12.',
    });
    assert.deepEqual(fixedContents[0].wells.selectedWells(), ["A1"]);
    assert.deepEqual(fixedContents[1].wells.selectedWells(), ["H12"]);
  });

  test("an entry that isn't in fixedContents throws its message", () => {
    const fixedContents = [entry("Static", [])];
    const lookalike = entry("Static", []);
    assert.throws(() => placeName(fixedContents, ["A1"], lookalike), {
      message: "The entry to place must be one of the fixed contents.",
    });
  });

  // --- Matching inputs ---

  test("matchesInputs is true for the inputs the result was made from", () => {
    const inputs = fixedEntriesExampleInputs();
    assert.equal(matchesInputs(randomize(inputs), inputs), true);
  });

  test("matchesInputs is false after any change to the inputs, and true after changing it back", () => {
    const inputs = fixedEntriesExampleInputs();
    const result = randomize(inputs);
    const changes = [
      ["the seed", () => (inputs.seed = 1), () => (inputs.seed = 999000)],
      ["the filler", () => (inputs.filler = "PBS"), () => (inputs.filler = "Spare")],
      [
        "a condition's name",
        () => (inputs.conditions[0].name = "Renamed"),
        () => (inputs.conditions[0].name = "Condition 1"),
      ],
      [
        "a condition's replicates",
        () => (inputs.conditions[0].replicates = 6),
        () => (inputs.conditions[0].replicates = 7),
      ],
      ["the order of the conditions", () => inputs.conditions.reverse(), () => inputs.conditions.reverse()],
      [
        "an entry's name",
        () => (inputs.fixedContents[0].name = "Renamed"),
        () => (inputs.fixedContents[0].name = "Static"),
      ],
      ["the order of the entries", () => inputs.fixedContents.reverse(), () => inputs.fixedContents.reverse()],
      [
        "which wells an entry holds",
        () => openWells(inputs.fixedContents, ["A12"]),
        () => placeName(inputs.fixedContents, ["A12"], inputs.fixedContents[0]),
      ],
      [
        "the conditions by adding a completely empty row",
        () => inputs.conditions.push({ name: "", replicates: "" }),
        () => inputs.conditions.pop(),
      ],
    ];
    for (const [description, change, changeBack] of changes) {
      change();
      assert.equal(matchesInputs(result, inputs), false, `after changing ${description}`);
      changeBack();
      assert.equal(matchesInputs(result, inputs), true, `after changing back ${description}`);
    }
  });

  test("the result's inputs are a copy: placing a name or renaming an entry doesn't change them", () => {
    const inputs = mainExampleInputs(SEED);
    const result = randomize(inputs);
    placeName(inputs.fixedContents, ["D4"], inputs.fixedContents[0]);
    inputs.fixedContents[0].name = "Renamed";
    inputs.conditions[0].name = "Renamed";
    assert.equal(result.inputs.fixedContents[0].name, "Static");
    assert.deepEqual(result.inputs.fixedContents[0].wells.selectedWells(), OUTER_RING);
    assert.equal(result.inputs.conditions[0].name, "Condition 1");
  });

  // --- Listing order ---

  test("listingOrder gives the example in section 6 exactly", () => {
    const inputs = {
      conditions: [
        { name: "Condition 1", replicates: 4 },
        { name: "Static", replicates: 4 },
      ],
      fixedContents: [entry("Static", []), entry("Blank", [])],
      filler: "Spare",
      seed: SEED,
    };
    assert.deepEqual(listingOrder(inputs), [
      { name: "Condition 1", role: "condition", position: 0 },
      { name: "Static", role: "condition", position: 1 },
      { name: "Spare", role: "filler", position: 0 },
      { name: "Blank", role: "fixed", position: 1 },
    ]);
  });

  test("listingOrder leaves out empty names", () => {
    const inputs = {
      conditions: [],
      fixedContents: [entry("", []), entry("Blank", [])],
      filler: "",
      seed: SEED,
    };
    assert.deepEqual(listingOrder(inputs), [{ name: "Blank", role: "fixed", position: 1 }]);
  });

  test("listingOrder positions count within each role and include unused entries", () => {
    const inputs = {
      conditions: [],
      fixedContents: [entry("Unused", []), entry("Blank", ["A1"])],
      filler: "",
      seed: SEED,
    };
    assert.deepEqual(listingOrder(inputs), [
      { name: "Unused", role: "fixed", position: 0 },
      { name: "Blank", role: "fixed", position: 1 },
    ]);
  });

  test("adding a condition doesn't change any filler or fixed-contents position", () => {
    const inputs = severalFixedContentsInputs();
    const otherRoles = () => listingOrder(inputs).filter(({ role }) => role !== "condition");
    const before = otherRoles();
    inputs.conditions.push({ name: "Condition 13", replicates: 1 });
    assert.deepEqual(otherRoles(), before);
  });

  // --- Spare wells and random seeds ---

  test("spareWellCount: 12 for the main example, 0 for the exact fit or too many replicates", () => {
    assert.equal(spareWellCount(mainExampleInputs(SEED)), 12);
    assert.equal(spareWellCount(exactFitInputs()), 0);
    const tooMany = mainExampleInputs(SEED);
    tooMany.conditions = numberedConditions(16, 4);
    assert.equal(spareWellCount(tooMany), 0);
  });

  test("spareWellCount is null while a replicate count isn't valid", () => {
    for (const replicates of ["four", ""]) {
      const inputs = mainExampleInputs(SEED);
      inputs.conditions[2].replicates = replicates;
      assert.equal(spareWellCount(inputs), null, JSON.stringify(replicates));
    }
  });

  test("randomSeed turns 0, 0.5 and nearly 1 into 1, 500000 and 999999", () => {
    assert.equal(randomSeed(0), 1);
    assert.equal(randomSeed(0.5), 500000);
    assert.equal(randomSeed(0.9999999999), 999999);
  });

  test("randomSeed always gives a seed findProblems accepts", () => {
    for (let step = 0; step < 1000; step++) {
      const seed = randomSeed(step / 1000);
      assert.ok(Number.isInteger(seed) && seed >= 1 && seed <= 999999, String(seed));
      assert.deepEqual(findProblems(mainExampleInputs(seed)), [], String(seed));
    }
  });

  test("randomSeed throws for anything but a number from 0 up to 1", () => {
    for (const [value, shown] of [
      [1, "1"],
      [-0.1, "-0.1"],
      ["0.5", '"0.5"'],
    ]) {
      assert.throws(() => randomSeed(value), {
        message: `randomSeed needs a number from 0 up to 1, like Math.random() gives, but got ${shown}.`,
      });
    }
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

  test("the fixed-entries golden setup contains all three well types", () => {
    const types = new Set(Object.values(randomize(fixedEntriesExampleInputs()).wellTypes));
    assert.deepEqual([...types].sort(), ["filler", "fixed", "replicate"]);
  });

  // --- Output lists ---

  test("contents → wells lists conditions, then the filler, then the fixed contents", () => {
    const listed = contentsToWells(randomize(fixedEntriesExampleInputs())).map(
      ({ contents }) => contents,
    );
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

  test("missing replicates are reported as missing, with their row", () => {
    for (const replicates of ["", "  "]) {
      const inputs = mainExampleInputs(SEED);
      inputs.conditions[2].replicates = replicates;
      assert.deepEqual(findProblems(inputs), ["Row 3: the number of replicates is missing."]);
    }
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

  test("a condition name with a space at the start", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.conditions[0].name = " Condition 1";
    assert.deepEqual(findProblems(inputs), [
      "Row 1: the condition name has a space at the start or end. Remove it.",
    ]);
  });

  // --- Errors: open wells ---

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

  // --- Errors: fixed contents ---

  test("an entry with wells but no name is reported with its number", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.fixedContents.push(entry("", ["D4"]));
    assert.deepEqual(findProblems(inputs), [
      "Fixed contents 2 is placed on the plate but has no name.",
    ]);
  });

  test("an entry name with a space at the end is reported with its number", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.fixedContents.push(entry("Static ", ["D4"]));
    assert.deepEqual(findProblems(inputs), [
      "Fixed contents 2 has a space at the start or end. Remove it.",
    ]);
  });

  test("a duplicate entry name is reported with both numbers", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.fixedContents.push(entry("Blank", ["D4"]), entry("Static", ["D5"]));
    assert.deepEqual(findProblems(inputs), [
      'Fixed contents 3: "Static" is already listed in fixed contents 1.',
    ]);
  });

  // --- Errors: filler and seed ---

  test("a filler with a space at the start", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.filler = " Spare";
    assert.deepEqual(findProblems(inputs), [
      "The filler has a space at the start or end. Remove it.",
    ]);
  });

  test("a missing seed is reported as missing", () => {
    assert.deepEqual(findProblems(mainExampleInputs("")), ["The seed is missing."]);
  });

  test("a seed out of range or not a whole number", () => {
    for (const [seed, shown] of [
      [0, "0"],
      [1000000, "1000000"],
      [2.5, "2.5"],
    ]) {
      assert.deepEqual(findProblems(mainExampleInputs(seed)), [
        `The seed must be a whole number from 1 to 999,999, but got ${shown}.`,
      ]);
    }
  });

  test("the smallest and largest seeds are accepted", () => {
    assert.deepEqual(findProblems(mainExampleInputs(1)), []);
    assert.deepEqual(findProblems(mainExampleInputs(999999)), []);
  });

  // --- Errors: the safety net ---

  test("a well in two entries is reported once, naming both entries", () => {
    const inputs = mainExampleInputs(SEED);
    inputs.fixedContents.push(entry("Blank", ["A1"]));
    assert.deepEqual(findProblems(inputs), ['A1 is in two fixed contents: "Static" and "Blank".']);
  });

  // --- Checking ---

  test("several problems are all returned, in table order, then wells in two entries", () => {
    const inputs = mainExampleInputs(0);
    inputs.conditions[0].name = "";
    inputs.fixedContents.push(entry("", ["D4"]), entry("Blank", ["A1"]));
    assert.deepEqual(findProblems(inputs), [
      "Row 1: the condition name is empty.",
      "Fixed contents 2 is placed on the plate but has no name.",
      "The seed must be a whole number from 1 to 999,999, but got 0.",
      'A1 is in two fixed contents: "Static" and "Blank".',
    ]);
  });

  test("randomize throws the first problem's message", () => {
    const inputs = mainExampleInputs(0);
    inputs.conditions[0].name = "";
    assert.throws(() => randomize(inputs), { message: "Row 1: the condition name is empty." });
  });

  // --- Inputs unchanged ---

  test("randomize doesn't change the inputs, and two runs give two separate layouts", () => {
    const inputs = severalFixedContentsInputs();
    const conditionsBefore = structuredClone(inputs.conditions);
    const entriesBefore = describeEntries(inputs.fixedContents);
    const first = randomize(inputs);
    const second = randomize(inputs);
    assert.deepEqual(inputs.conditions, conditionsBefore);
    assert.deepEqual(describeEntries(inputs.fixedContents), entriesBefore);
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
    const result = randomize(mainExampleInputs(SEED));
    const lines = contentsToWellsText(result).split("\n");
    const expected = contentsToWells(result).map(
      ({ contents, wells }) => `${contents}\t${wells.join(", ")}`,
    );
    assert.deepEqual(lines, expected);
    assert.ok(lines[0].startsWith("Condition 1\t"));
    assert.equal(lines.at(-1), `Static\t${OUTER_RING.join(", ")}`);
  });
});

// --- Setups (section 9) ---

// Empty rows: the main example with completely empty rows before the first condition, between
// conditions 2 and 3, and after the last (section 9).
function emptyRowsInputs() {
  const inputs = mainExampleInputs(SEED);
  const empty = () => ({ name: "", replicates: "" });
  inputs.conditions = [
    empty(),
    ...inputs.conditions.slice(0, 2),
    empty(),
    ...inputs.conditions.slice(2),
    empty(),
  ];
  return inputs;
}

// Empty list: the main example with no conditions, so every open well gets the filler.
function emptyListInputs() {
  return { ...mainExampleInputs(SEED), conditions: [] };
}

// No fixed wells: no entries, so all 96 wells are open; 12 conditions × 4 replicates, so 48 Spare.
function noFixedWellsInputs() {
  return { ...mainExampleInputs(SEED), fixedContents: [] };
}

// Exact fit: no fixed wells; 12 conditions × 8 replicates exactly fill the plate, so no filler.
function exactFitInputs() {
  return {
    ...mainExampleInputs(SEED),
    fixedContents: [],
    conditions: numberedConditions(12, 8),
    filler: "",
  };
}

// Scattered fixed wells: one entry, Static, in six wells on the edge and inside the plate;
// 12 conditions × 7 replicates (84) in 90 open wells, so 6 Spare.
function scatteredFixedWellsInputs() {
  return {
    ...mainExampleInputs(SEED),
    fixedContents: [entry("Static", ["A1", "B5", "D6", "E7", "G11", "H12"])],
    conditions: numberedConditions(12, 7),
  };
}

// Several fixed contents: the main example with A1 in "Fixed 1", H12 in "Fixed 2", and the other
// 34 outer wells in "Static".
function severalFixedContentsInputs() {
  const otherOuterWells = OUTER_RING.filter((well) => well !== "A1" && well !== "H12");
  return {
    ...mainExampleInputs(SEED),
    fixedContents: [entry("Static", otherOuterWells), entry("Fixed 1", ["A1"]), entry("Fixed 2", ["H12"])],
  };
}

// Unused entries: the main example plus an entry "Unused" and an unnamed entry, both with no wells.
function unusedEntriesInputs() {
  const inputs = mainExampleInputs(SEED);
  inputs.fixedContents.push(entry("Unused", []), entry("", []));
  return inputs;
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

// The open wells: those in no entry, in standard order.
function openWellsOf(inputs) {
  return GRID_96.wellNames().filter(
    (well) => !inputs.fixedContents.some(({ wells }) => wells.isSelected(well)),
  );
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
  const totalReplicates = inputs.conditions.reduce((total, { replicates }) => total + replicates, 0);
  const fillerWells = Object.keys(result.wellTypes).filter(
    (well) => result.wellTypes[well] === "filler",
  );
  assert.equal(fillerWells.length, openWellsOf(inputs).length - totalReplicates);
  for (const well of fillerWells) {
    assert.equal(result.layout.contentsOf(well).name, inputs.filler, well);
  }
}

// Check 3: every well in an entry is a fixed well holding that entry's name, and there are no other
// fixed wells.
function checkFixedWells(inputs, result) {
  let fixedWellCount = 0;
  for (const { name, wells } of inputs.fixedContents) {
    for (const well of wells.selectedWells()) {
      assert.equal(result.wellTypes[well], "fixed", well);
      assert.equal(result.layout.contentsOf(well).name, name, well);
      fixedWellCount += 1;
    }
  }
  const allFixedWells = Object.values(result.wellTypes).filter((type) => type === "fixed");
  assert.equal(allFixedWells.length, fixedWellCount);
}

// Check 4: all 96 wells have contents and one of the three types, and the open wells are exactly
// the replicate and filler wells.
function checkComplete(inputs, result) {
  const wellTypes = ["replicate", "filler", "fixed"];
  assert.deepEqual(Object.keys(result.wellTypes), GRID_96.wellNames());
  for (const { well, contents } of result.layout.listWells()) {
    assert.notEqual(contents, null, well);
    assert.ok(wellTypes.includes(result.wellTypes[well]), well);
  }
  const randomWells = GRID_96.wellNames().filter((well) =>
    ["replicate", "filler"].includes(result.wellTypes[well]),
  );
  assert.deepEqual(randomWells, openWellsOf(inputs));
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
function checkContentsToWells(result) {
  const rows = contentsToWells(result);
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

// The entries as plain data that can be compared, e.g. [{ name: "Static", wells: ["A1", …] }].
// A WellSelection keeps its wells private, so deepEqual can't compare two selections directly.
function describeEntries(fixedContents) {
  return fixedContents.map(({ name, wells }) => ({ name, wells: wells.selectedWells() }));
}
