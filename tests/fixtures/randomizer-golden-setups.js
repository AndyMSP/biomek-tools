// randomizer-golden-setups.js — the randomizer's test inputs that are recorded as golden files, and
// how a result becomes a golden file's entries.
//
// Used by randomizer.test.js, which checks that the randomizer still gives the same results as the
// golden files. The files were generated once from these inputs; there is deliberately no script to
// regenerate them (see randomizer.md, section 9). Keeping the inputs here, labelled as golden-file
// data, records exactly how the files were made.
// The files were made before fixed-contents entries replaced overrides. The inputs below build the
// same plates with entries; the golden-file tests confirm the plates are unchanged.
// Specification: src/tools/randomizer/randomizer.md, section 9.

import { GRID_96 } from "../../src/shared/well-grid/well-grid.js";
import { WellSelection } from "../../src/shared/well-selection/well-selection.js";
import { wellToContents } from "../../src/tools/randomizer/randomizer.js";

// The golden files: each file's name in tests/fixtures/ and a function that creates its inputs.
// Inputs are created fresh each time because a WellSelection can be changed.
export const GOLDEN_FILES = [
  { fileName: "randomizer-main-seed-37.json", makeInputs: () => mainExampleInputs(37) },
  { fileName: "randomizer-fixed-entries-seed-999000.json", makeInputs: fixedEntriesExampleInputs },
];

// The main example (section 9) with the given seed: one entry, "Static", in the outer ring,
// "Condition 1" … "Condition 12" with 4 replicates each, and filler "Spare" for the 12 spare wells.
export function mainExampleInputs(seed) {
  const outerRing = GRID_96.wellNames().filter((well) => GRID_96.isEdgeWell(well));
  return {
    conditions: numberedConditions(12, 4),
    fixedContents: [entry("Static", outerRing)],
    filler: "Spare",
    seed,
  };
}

// The golden-file setup with fixed contents on two wells each (section 9), with seed 999,000. It
// contains all three well types. The "Override" names are kept from before entries replaced
// overrides, so the file's contents don't change.
export function fixedEntriesExampleInputs() {
  return {
    conditions: numberedConditions(10, 7),
    fixedContents: [
      entry("Static", ["A12", "H1"]),
      entry("Override 1", ["A1", "H12"]),
      entry("Override 2", ["B5", "G11"]),
      entry("Override 3", ["D6", "E7"]),
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

// A fixed-contents entry with the given name and wells, e.g. entry("Blank", ["A1", "H12"]).
export function entry(name, wells) {
  return { name, wells: selectionOf(wells) };
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
// e.g. [{ well: "A1", contents: "Static", type: "fixed" }, …].
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
