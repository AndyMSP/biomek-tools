// randomizer-golden-setups.js — the randomizer's test inputs that are recorded as golden files, and
// how a result becomes a golden file's entries.
//
// Used by randomizer.test.js, which checks that the randomizer still gives the same results as the
// golden files. The files were generated once from these inputs; there is deliberately no script to
// regenerate them (see randomizer.md, section 9). Keeping the inputs here, labelled as golden-file
// data, records exactly how the files were made.
// Specification: src/tools/randomizer/randomizer.md, section 9.

import { GRID_96 } from "../../src/shared/well-grid/well-grid.js";
import { WellSelection } from "../../src/shared/well-selection/well-selection.js";
import { wellToContents } from "../../src/tools/randomizer/randomizer.js";

// The golden files: each file's name in tests/fixtures/ and a function that creates its inputs.
// Inputs are created fresh each time because a WellSelection can be changed.
export const GOLDEN_FILES = [
  { fileName: "randomizer-main-seed-37.json", makeInputs: () => mainExampleInputs(37) },
  { fileName: "randomizer-overrides-seed-999000.json", makeInputs: overridesExampleInputs },
];

// The main example (section 9) with the given seed: the outer ring fixed with "Static",
// "Condition 1" … "Condition 12" with 4 replicates each, and filler "Spare" for the 12 spare wells.
export function mainExampleInputs(seed) {
  const outerRing = GRID_96.wellNames().filter((well) => GRID_96.isEdgeWell(well));
  return {
    fixedWells: selectionOf(outerRing),
    conditions: numberedConditions(12, 4),
    fixedContents: "Static",
    overrides: [],
    filler: "Spare",
    seed,
  };
}

// The golden-file setup with overrides on two wells each (section 9), with seed 999,000. It
// contains all four well types.
export function overridesExampleInputs() {
  return {
    fixedWells: selectionOf(["A1", "A12", "B5", "D6", "E7", "G11", "H1", "H12"]),
    conditions: numberedConditions(10, 7),
    fixedContents: "Static",
    overrides: [
      { well: "A1", name: "Override 1" },
      { well: "H12", name: "Override 1" },
      { well: "B5", name: "Override 2" },
      { well: "G11", name: "Override 2" },
      { well: "D6", name: "Override 3" },
      { well: "E7", name: "Override 3" },
    ],
    filler: "Spare",
    seed: 999000,
  };
}

// A condition list "Condition 1" … "Condition <count>", each with the same number of replicates,
// e.g. numberedConditions(2, 4) → [{ name: "Condition 1", replicates: 4 }, { name: "Condition 2", replicates: 4 }].
export function numberedConditions(count, replicates) {
  const conditions = [];
  for (let number = 1; number <= count; number++) {
    conditions.push({ name: `Condition ${number}`, replicates });
  }
  return conditions;
}

// A WellSelection on GRID_96 with the given wells selected, e.g. selectionOf(["A1", "H12"]).
export function selectionOf(wells) {
  const selection = new WellSelection(GRID_96);
  for (const well of wells) {
    selection.select(well);
  }
  return selection;
}

// A result as golden-file entries: one { well, contents, type } per well, in standard order,
// e.g. [{ well: "A1", contents: "Static", type: "fixed-contents" }, …].
export function goldenEntries(result) {
  return wellToContents(result).map(({ well, contents }) => ({
    well,
    contents,
    type: result.wellTypes[well],
  }));
}

// The location of a golden file in tests/fixtures/, the folder this file is in,
// e.g. goldenFileUrl("randomizer-main-seed-37.json"). Node's file functions accept this URL as a path.
export function goldenFileUrl(fileName) {
  return new URL(fileName, import.meta.url);
}
