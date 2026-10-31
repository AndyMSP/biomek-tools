// Unit tests for deck.js. Each test comes from the "Test cases" section of deck.md.
//
// They use the real config/deck.js and config/labware-types.js, and also check both files
// (ADR 0009). Where a test needs a labware of a given grid, it finds one in DECK by gridOf rather
// than naming it, so the tests still pass when the deck changes.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DECK } from "../../../config/deck.js";
import { LABWARE_TYPES } from "../../../config/labware-types.js";
import { checkName } from "../input-checks/input-checks.js";
import { GRID_96, GRID_1X12_NUMBERED } from "../well-grid/well-grid.js";
import {
  labwareNames,
  hasLabware,
  gridOf,
  labwareTypeOf,
  capacityOf,
  deadVolumeOf,
  checkWell,
  wellsInBox,
} from "./deck.js";

// The name of the first labware in DECK whose grid is `grid`, e.g. GRID_96 → "Plate".
function labwareWithGrid(grid) {
  return DECK.find((entry) => gridOf(entry.name) === grid).name;
}

// A 96-well labware and the numbered (reservoir) labware, found in DECK.
const PLATE = labwareWithGrid(GRID_96);
const RESERVOIR = labwareWithGrid(GRID_1X12_NUMBERED);

// The message for a labware that isn't on the deck, e.g. noLabwareMessage("Bench") →
// 'There\'s no labware "Bench" on the deck. The deck has "Plate", "Deep", "Res".'
function noLabwareMessage(name) {
  const deckNames = DECK.map((entry) => `"${entry.name}"`).join(", ");
  return `There's no labware "${name}" on the deck. The deck has ${deckNames}.`;
}

// The message for something that isn't an object with labware and well, e.g. for "A1".
function notAWellMessage(got) {
  return `A well on the deck must be an object like { labware: "Plate", well: "A1" }, but got ${got}.`;
}

describe("deck", () => {
  // --- The deck description (config/deck.js) ---

  test("every entry has exactly name and labwareType", () => {
    for (const entry of DECK) {
      assert.deepEqual(Object.keys(entry).sort(), ["labwareType", "name"]);
    }
  });

  test("every name and labwareType passes checkName", () => {
    for (const entry of DECK) {
      assert.doesNotThrow(() => checkName(entry.name, "labware name"));
      assert.doesNotThrow(() => checkName(entry.labwareType, "labware type"));
    }
  });

  test("no two entries share a name", () => {
    const names = DECK.map((entry) => entry.name);
    assert.equal(new Set(names).size, names.length);
  });

  test("every labwareType is a key in LABWARE_TYPES", () => {
    for (const entry of DECK) {
      assert.ok(Object.hasOwn(LABWARE_TYPES, entry.labwareType), `type of ${entry.name}`);
    }
  });

  // --- The labware types (config/labware-types.js) ---

  test("every labware type's key passes checkName", () => {
    for (const key of Object.keys(LABWARE_TYPES)) {
      assert.doesNotThrow(() => checkName(key, "labware type"));
    }
  });

  test("every labware type has exactly grid, capacity and deadVolume", () => {
    for (const [key, type] of Object.entries(LABWARE_TYPES)) {
      assert.deepEqual(Object.keys(type).sort(), ["capacity", "deadVolume", "grid"], key);
    }
  });

  test('every labware type\'s grid is "GRID_96" or "GRID_1X12_NUMBERED"', () => {
    for (const [key, type] of Object.entries(LABWARE_TYPES)) {
      assert.ok(["GRID_96", "GRID_1X12_NUMBERED"].includes(type.grid), `grid of ${key}`);
    }
  });

  test("every capacity is a number above 0, and every deadVolume a number from 0 to the capacity", () => {
    for (const [key, type] of Object.entries(LABWARE_TYPES)) {
      assert.equal(typeof type.capacity, "number", `capacity of ${key}`);
      assert.ok(type.capacity > 0, `capacity of ${key}`);
      assert.equal(typeof type.deadVolume, "number", `deadVolume of ${key}`);
      assert.ok(type.deadVolume >= 0 && type.deadVolume <= type.capacity, `deadVolume of ${key}`);
    }
  });

  // --- Looking up ---

  test("labwareNames() gives the names in DECK's order", () => {
    assert.deepEqual(
      labwareNames(),
      DECK.map((entry) => entry.name),
    );
  });

  test("changing the list labwareNames() returns doesn't change the next one", () => {
    const names = labwareNames();
    names.push("Bench");
    names[0] = "Changed";
    assert.deepEqual(
      labwareNames(),
      DECK.map((entry) => entry.name),
    );
  });

  test("hasLabware is true for each name in DECK", () => {
    for (const entry of DECK) {
      assert.equal(hasLabware(entry.name), true, entry.name);
    }
  });

  test('hasLabware is false for "Bench", "plate" (case matters), "", 5 and null', () => {
    for (const value of ["Bench", "plate", "", 5, null]) {
      assert.equal(hasLabware(value), false, String(value));
    }
  });

  test('gridOf gives GRID_96 for a labware whose type\'s grid is "GRID_96", and GRID_1X12_NUMBERED for "GRID_1X12_NUMBERED"', () => {
    const expectedGrids = { GRID_96, GRID_1X12_NUMBERED };
    for (const entry of DECK) {
      const gridName = LABWARE_TYPES[entry.labwareType].grid;
      assert.equal(gridOf(entry.name), expectedGrids[gridName], entry.name);
    }
    // Both grids are on the deck, so both cases are covered.
    assert.equal(gridOf(PLATE), GRID_96);
    assert.equal(gridOf(RESERVOIR), GRID_1X12_NUMBERED);
  });

  test("labwareTypeOf gives each entry's labwareType", () => {
    for (const entry of DECK) {
      assert.equal(labwareTypeOf(entry.name), entry.labwareType);
    }
  });

  test("capacityOf and deadVolumeOf give each entry's type's capacity and deadVolume", () => {
    for (const entry of DECK) {
      const type = LABWARE_TYPES[entry.labwareType];
      assert.equal(capacityOf(entry.name), type.capacity, entry.name);
      assert.equal(deadVolumeOf(entry.name), type.deadVolume, entry.name);
    }
  });

  test("gridOf, labwareTypeOf, capacityOf and deadVolumeOf refuse a labware that isn't on the deck", () => {
    for (const lookUp of [gridOf, labwareTypeOf, capacityOf, deadVolumeOf]) {
      assert.throws(() => lookUp("Bench"), { message: noLabwareMessage("Bench") }, lookUp.name);
    }
  });

  // --- Wells ---

  test('checkWell accepts H12 on a 96-well labware and "12" on the numbered labware', () => {
    assert.doesNotThrow(() => checkWell({ labware: PLATE, well: "H12" }));
    assert.doesNotThrow(() => checkWell({ labware: RESERVOIR, well: "12" }));
  });

  test('checkWell refuses "A1" and null, which aren\'t objects', () => {
    assert.throws(() => checkWell("A1"), { message: notAWellMessage('"A1"') });
    assert.throws(() => checkWell(null), { message: notAWellMessage("null") });
  });

  test("checkWell refuses a labware that isn't on the deck", () => {
    assert.throws(() => checkWell({ labware: "Bench", well: "A1" }), {
      message: noLabwareMessage("Bench"),
    });
  });

  test("checkWell refuses a well that isn't on the labware's grid", () => {
    assert.throws(() => checkWell({ labware: PLATE, well: "Z99" }), {
      message: `"Z99" isn't a well on ${PLATE}. Its wells are A1 to H12.`,
    });
    assert.throws(() => checkWell({ labware: RESERVOIR, well: "13" }), {
      message: `"13" isn't a well on ${RESERVOIR}. Its wells are 1 to 12.`,
    });
  });

  test("wellsInBox with B2 and C3 gives B2, B3, C2, C3, with corners in either order", () => {
    const expected = ["B2", "B3", "C2", "C3"].map((well) => ({ labware: PLATE, well }));
    const b2 = { labware: PLATE, well: "B2" };
    const c3 = { labware: PLATE, well: "C3" };
    assert.deepEqual(wellsInBox(b2, c3), expected);
    assert.deepEqual(wellsInBox(c3, b2), expected);
  });

  test("wellsInBox with one well twice gives just that well", () => {
    const d4 = { labware: PLATE, well: "D4" };
    assert.deepEqual(wellsInBox(d4, d4), [{ labware: PLATE, well: "D4" }]);
  });

  test('wellsInBox on the numbered labware with "7" and "5" gives 5, 6, 7', () => {
    assert.deepEqual(
      wellsInBox({ labware: RESERVOIR, well: "7" }, { labware: RESERVOIR, well: "5" }),
      ["5", "6", "7"].map((well) => ({ labware: RESERVOIR, well })),
    );
  });

  test("wellsInBox refuses corners on different labware", () => {
    assert.throws(
      () => wellsInBox({ labware: PLATE, well: "A1" }, { labware: RESERVOIR, well: "1" }),
      {
        message:
          `A box of wells must be on one labware, but one corner is on ${PLATE} ` +
          `and the other on ${RESERVOIR}.`,
      },
    );
  });

  test("wellsInBox with a corner not on the deck gives checkWell's message", () => {
    assert.throws(
      () => wellsInBox({ labware: PLATE, well: "A1" }, { labware: "Bench", well: "A1" }),
      { message: noLabwareMessage("Bench") },
    );
  });
});
