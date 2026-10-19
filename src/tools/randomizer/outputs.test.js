// Unit tests for outputs.js. Each test comes from the "Test cases" section of outputs.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  contentsToWells,
  wellToContents,
  contentsToWellsText,
  wellToContentsText,
} from "./outputs.js";
import { randomize } from "./assign.js";
import { GRID_96 } from "../../shared/well-grid/well-grid.js";
import { WellSelection } from "../../shared/well-selection/well-selection.js";

// The main example of randomizer.md section 8; any property can be replaced.
function mainExample(changes = {}) {
  const fixedWells = new WellSelection(GRID_96);
  GRID_96.wellNames()
    .filter((well) => GRID_96.isEdgeWell(well))
    .forEach((well) => fixedWells.select(well));
  return {
    fixedWells,
    conditions: Array.from({ length: 12 }, (_, i) => ({ name: `Condition ${i + 1}`, replicates: 4 })),
    fixedContents: "Static",
    overrides: [],
    filler: "Spare",
    seed: 37,
    ...changes,
  };
}

describe("outputs", () => {
  test("main example: conditions as listed, then filler, then fixed contents", () => {
    const inputs = mainExample();
    const rows = contentsToWells(inputs, randomize(inputs));
    assert.deepEqual(
      rows.map((row) => row.contents),
      [...inputs.conditions.map((row) => row.name), "Spare", "Static"],
    );
    for (const row of rows.slice(0, 12)) {
      assert.equal(row.wells.length, 4, row.contents);
    }
    assert.equal(rows[12].wells.length, 12);
    assert.equal(rows[13].wells.length, 36);
  });

  test("shared names: Static is listed once, with all 48 of its wells", () => {
    const inputs = mainExample({
      conditions: [...mainExample().conditions, { name: "Static", replicates: 4 }],
      filler: "Static",
    });
    const rows = contentsToWells(inputs, randomize(inputs));
    const staticRows = rows.filter((row) => row.contents === "Static");
    assert.equal(staticRows.length, 1);
    assert.equal(staticRows[0].wells.length, 48);
  });

  test("overrides come last in standard well order; an unneeded filler isn't listed", () => {
    const inputs = mainExample({
      conditions: Array.from({ length: 12 }, (_, i) => ({ name: `Condition ${i + 1}`, replicates: 5 })),
      overrides: [
        { well: "H12", name: "Override 2" },
        { well: "A1", name: "Override 1" },
      ],
    });
    const rows = contentsToWells(inputs, randomize(inputs));
    assert.deepEqual(rows.slice(-3).map((row) => row.contents), ["Static", "Override 1", "Override 2"]);
    assert.ok(!rows.some((row) => row.contents === "Spare"));
  });

  test("both lists agree with the plate exactly", () => {
    const inputs = mainExample();
    const result = randomize(inputs);
    const byWell = wellToContents(result);
    assert.equal(byWell.length, 96);
    for (const { well, contents } of byWell) {
      assert.equal(result.layout.contentsOf(well).name, contents, well);
    }
    const wellsListed = contentsToWells(inputs, result).flatMap((row) =>
      row.wells.map((well) => ({ well, contents: row.contents })),
    );
    assert.equal(wellsListed.length, 96);
    for (const { well, contents } of wellsListed) {
      assert.equal(result.layout.contentsOf(well).name, contents, well);
    }
  });

  test("copy text is tab-separated with a header row", () => {
    assert.equal(
      contentsToWellsText([{ contents: "Condition 1", wells: ["B4", "D9"] }]),
      "Contents\tWells\nCondition 1\tB4, D9",
    );
    assert.equal(
      wellToContentsText([
        { well: "A1", contents: "Static" },
        { well: "A2", contents: "Static" },
      ]),
      "Well\tContents\nA1\tStatic\nA2\tStatic",
    );
  });
});
