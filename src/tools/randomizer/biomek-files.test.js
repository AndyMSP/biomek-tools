// Unit tests for biomek-files.js. Each test comes from the "Test cases" section of biomek-files.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildBiomekFiles, findBiomekProblems, uncoveredContents } from "./biomek-files.js";
import { randomize, WELL_TYPES } from "./assign.js";
import { EXP37_METHOD } from "../../../config/exp37-method.js";
import { Layout } from "../../shared/layout/layout.js";
import { GRID_96, WellGrid } from "../../shared/well-grid/well-grid.js";
import { WellSelection } from "../../shared/well-selection/well-selection.js";

// A hand-made result on a 2 × 3 grid: column 1 PBS (fixed), Condition 1 in A2 and B3,
// Condition 2 in B2 and A3. Seed 37.
function smallResult() {
  const layout = new Layout(new WellGrid(2, 3));
  const wellTypes = new Map();
  const place = (well, name, type) => {
    layout.setContents(well, { name });
    wellTypes.set(well, type);
  };
  place("A1", "PBS", WELL_TYPES.FIXED_CONTENTS);
  place("B1", "PBS", WELL_TYPES.FIXED_CONTENTS);
  place("A2", "Condition 1", WELL_TYPES.REPLICATE);
  place("B3", "Condition 1", WELL_TYPES.REPLICATE);
  place("B2", "Condition 2", WELL_TYPES.REPLICATE);
  place("A3", "Condition 2", WELL_TYPES.REPLICATE);
  return { layout, wellTypes, seed: 37 };
}

// Inputs naming the two conditions of smallResult(), in that order.
const SMALL_INPUTS = { conditions: [{ name: "Condition 1" }, { name: "Condition 2" }] };

// The text of the file at a path, e.g. fileText(files, "Exp37/Exp37_Step9_PBS.csv").
function fileText(files, path) {
  const file = files.find((f) => f.path === path);
  assert.ok(file, `missing ${path}`);
  return file.text;
}

// The main example of randomizer.md with PBS as the fixed contents and filler.
function mainExamplePbs() {
  const fixedWells = new WellSelection(GRID_96);
  GRID_96.wellNames()
    .filter((well) => GRID_96.isEdgeWell(well))
    .forEach((well) => fixedWells.select(well));
  return {
    fixedWells,
    conditions: Array.from({ length: 12 }, (_, i) => ({ name: `Condition ${i + 1}`, replicates: 4 })),
    fixedContents: "PBS",
    overrides: [],
    filler: "PBS",
    seed: 37,
  };
}

describe("biomek-files", () => {
  const files = buildBiomekFiles(SMALL_INPUTS, smallResult(), EXP37_METHOD, "Exp37");

  test("media file: the condition's deep well into its wells, plate 1 then plate 2", () => {
    assert.equal(
      fileText(files, "Exp37/Step8_Media_seed37/Exp37_Step8a.csv"),
      "SourceLabware,SourceWell,DestLabware,DestWell,Volume\r\n" +
        "Deep,D1,MsNAC,A2,100\r\nDeep,D1,MsNAC,B3,100\r\nDeep,D1,SF9,A2,100\r\nDeep,D1,SF9,B3,100",
    );
    assert.match(fileText(files, "Exp37/Step8_Media_seed37/Exp37_Step8b.csv"), /^.*\r\nDeep,D2,MsNAC,B2,100\r\nDeep,D2,MsNAC,A3,100/);
  });

  test("PBS file: every PBS well on both plates, from reservoir well 5", () => {
    assert.equal(
      fileText(files, "Exp37/Exp37_Step9_PBS.csv"),
      "SourceLabware,SourceWell,DestLabware,DestWell,Volume\r\n" +
        "Res,5,MsNAC,A1,200\r\nRes,5,MsNAC,B1,200\r\nRes,5,SF9,A1,200\r\nRes,5,SF9,B1,200",
    );
  });

  test("cell files alternate the plate's two cell wells by condition", () => {
    assert.equal(
      fileText(files, "Exp37/Step10-13_Cells/Step10_MsNAC_cells/Exp37_Step10a.csv"),
      "SourceLabware,SourceWell,DestLabware,DestWell,Volume\r\nDeep,F1,MsNAC,A2,50\r\nDeep,F1,MsNAC,B3,50",
    );
    assert.match(fileText(files, "Exp37/Step10-13_Cells/Step10_MsNAC_cells/Exp37_Step10b.csv"), /\r\nDeep,F2,MsNAC,B2,50/);
    assert.match(fileText(files, "Exp37/Step10-13_Cells/Step12_SF9_cells/Exp37_Step12a.csv"), /\r\nDeep,H1,SF9,A2,50/);
  });

  test("mix files aspirate and dispense in the same well", () => {
    assert.equal(
      fileText(files, "Exp37/Step10-13_Cells/Step13_SF9_mix/Exp37_Step13b.csv"),
      "SourceLabware,SourceWell,DestLabware,DestWell,Volume\r\nSF9,B2,SF9,B2,100\r\nSF9,A3,SF9,A3,100",
    );
  });

  test("worklist: cell and mix files as full Windows paths, MsNAC first", () => {
    const root = "C:\\Users\\Beckman Coulter\\Desktop\\Exp37\\Step10-13_Cells";
    assert.equal(
      fileText(files, "Exp37/Exp37_Step10_Worklist.csv"),
      [
        "CellFile,MixFile",
        `${root}\\Step10_MsNAC_cells\\Exp37_Step10a.csv,${root}\\Step11_MsNAC_mix\\Exp37_Step11a.csv`,
        `${root}\\Step10_MsNAC_cells\\Exp37_Step10b.csv,${root}\\Step11_MsNAC_mix\\Exp37_Step11b.csv`,
        `${root}\\Step12_SF9_cells\\Exp37_Step12a.csv,${root}\\Step13_SF9_mix\\Exp37_Step13a.csv`,
        `${root}\\Step12_SF9_cells\\Exp37_Step12b.csv,${root}\\Step13_SF9_mix\\Exp37_Step13b.csv`,
      ].join("\r\n"),
    );
  });

  test("the main example gives 62 files that all follow the format rules", () => {
    const inputs = mainExamplePbs();
    const result = randomize(inputs);
    assert.deepEqual(findBiomekProblems(inputs, result, EXP37_METHOD, "Exp37"), []);
    const all = buildBiomekFiles(inputs, result, EXP37_METHOD, "Exp37");
    assert.equal(all.length, 62);
    for (const { path, text } of all) {
      assert.match(text, /^[\x20-\x7e\r\n]*$/, `${path}: not plain ASCII`);
      assert.ok(!/ /.test(text.replace(/C:\\Users\\Beckman Coulter/g, "")), `${path}: contains a space`);
      assert.ok(!text.endsWith("\r\n") && !text.includes("\r\n\r\n"), `${path}: blank line`);
      assert.ok(!/(^|[^\r])\n/.test(text), `${path}: line break without CR`);
    }
    // 36 fixed + 12 filler PBS wells per plate, 96 transfers: 32 from each of wells 5, 6 and 7.
    const pbs = fileText(all, "Exp37/Exp37_Step9_PBS.csv").split("\r\n").slice(1);
    assert.equal(pbs.length, 96);
    assert.deepEqual(["5", "6", "7"].map((w) => pbs.filter((row) => row.startsWith(`Res,${w},`)).length), [32, 32, 32]);
    assert.deepEqual(uncoveredContents(inputs, result, EXP37_METHOD), []);
  });

  test("problems: experiment ID, too many conditions, too much PBS", () => {
    const inputs = mainExamplePbs();
    const result = randomize(inputs);
    assert.deepEqual(findBiomekProblems(inputs, result, EXP37_METHOD, "Exp 37"), [
      "Give an experiment ID of letters, digits, - and _ only, like Exp37.",
    ]);
    const thirteen = { ...inputs, conditions: [...inputs.conditions, { name: "Condition 13", replicates: 1 }] };
    assert.deepEqual(findBiomekProblems(thirteen, randomize(thirteen), EXP37_METHOD, "Exp37"), [
      "The Exp37 method has source wells for 12 conditions, but 13 are listed.",
    ]);
    const fewer = { ...inputs, conditions: inputs.conditions.slice(0, 10) };
    assert.deepEqual(findBiomekProblems(fewer, randomize(fewer), EXP37_METHOD, "Exp37"), [
      "The plates need 112 PBS transfers, but reservoir wells 5, 6, 7 supply 96.",
    ]);
  });

  test("contents no file fills are listed", () => {
    const inputs = { ...mainExamplePbs(), overrides: [{ well: "A1", name: "Blank" }] };
    assert.deepEqual(uncoveredContents(inputs, randomize(inputs), EXP37_METHOD), [
      { contents: "Blank", wells: ["A1"] },
    ]);
  });
});
