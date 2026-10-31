// Unit tests for substages.js. Each test comes from the "Test cases" section of substages.md.
//
// They find labware in DECK by grid and labware type rather than naming it, so they still pass when
// the deck changes (as deck.test.js does).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DECK } from "../../../config/deck.js";
import { gridOf } from "../deck/deck.js";
import { GRID_96, GRID_1X12_NUMBERED } from "../well-grid/well-grid.js";
import { substagesOf } from "./substages.js";

// Two labware of one 96-well labware type (plates), a 96-well labware of another type (a
// deep-well plate), and the numbered (reservoir) labware, each found in DECK with its labware type.
const PLATE = DECK.find((entry) => gridOf(entry.name) === GRID_96);
const OTHER_PLATE = DECK.find(
  (entry) => entry.labwareType === PLATE.labwareType && entry.name !== PLATE.name,
);
const DEEP = DECK.find(
  (entry) => gridOf(entry.name) === GRID_96 && entry.labwareType !== PLATE.labwareType,
);
const RESERVOIR = DECK.find((entry) => gridOf(entry.name) === GRID_1X12_NUMBERED);

// A transfer in stage "1" from `sourceWell` of `source` to `destinationWell` of `destination`
// (each a DECK entry), e.g. transfer(RESERVOIR, "1", PLATE, "A1").
function transfer(source, sourceWell, destination, destinationWell, volume = 50) {
  return {
    type: "transfer",
    source: { labware: source.name, well: sourceWell },
    destination: { labware: destination.name, well: destinationWell },
    volume,
    stage: "1",
  };
}

describe("substages", () => {
  test("no transfers give []", () => {
    assert.deepEqual(substagesOf([]), []);
  });

  test("transfers all from one labware type to one labware type give one substage holding all of them, in order", () => {
    const transfers = [
      transfer(RESERVOIR, "1", PLATE, "A1"),
      transfer(RESERVOIR, "2", PLATE, "A2"),
      transfer(RESERVOIR, "1", PLATE, "A3"),
    ];
    const substages = substagesOf(transfers);
    assert.equal(substages.length, 1);
    assert.equal(substages[0].transfers.length, 3);
    transfers.forEach((given, index) => assert.equal(substages[0].transfers[index], given));
  });

  test("reservoir to plate, plate to deep-well plate, reservoir to plate give two substages: the first and third transfers, then the second", () => {
    const first = transfer(RESERVOIR, "1", PLATE, "A1");
    const second = transfer(PLATE, "H12", DEEP, "A1");
    const third = transfer(RESERVOIR, "2", PLATE, "A2");
    const substages = substagesOf([first, second, third]);
    assert.equal(substages.length, 2);
    assert.deepEqual(substages[0].transfers, [first, third]);
    assert.equal(substages[0].transfers[0], first);
    assert.equal(substages[0].transfers[1], third);
    assert.deepEqual(substages[1].transfers, [second]);
    assert.equal(substages[1].transfers[0], second);
  });

  test("two different labware of the same type are in one substage", () => {
    const substages = substagesOf([
      transfer(RESERVOIR, "1", PLATE, "A1"),
      transfer(RESERVOIR, "1", OTHER_PLATE, "A1"),
    ]);
    assert.equal(substages.length, 1);
    assert.equal(substages[0].transfers.length, 2);
  });

  test("each substage's labware types are DECK's types for its labware", () => {
    const substages = substagesOf([
      transfer(RESERVOIR, "1", PLATE, "A1"),
      transfer(PLATE, "H12", DEEP, "A1"),
    ]);
    assert.deepEqual(
      substages.map((substage) => [substage.sourceLabwareType, substage.destinationLabwareType]),
      [
        [RESERVOIR.labwareType, PLATE.labwareType],
        [PLATE.labwareType, DEEP.labwareType],
      ],
    );
    assert.deepEqual(Object.keys(substages[0]).sort(), [
      "destinationLabwareType",
      "sourceLabwareType",
      "transfers",
    ]);
  });

  test("changing the list returned doesn't change the next result", () => {
    const transfers = [transfer(RESERVOIR, "1", PLATE, "A1"), transfer(PLATE, "H12", DEEP, "A1")];
    const first = substagesOf(transfers);
    first.pop();
    first[0].transfers.push(transfer(RESERVOIR, "3", PLATE, "B1"));
    first[0].sourceLabwareType = "Changed";
    const second = substagesOf(transfers);
    assert.equal(second.length, 2);
    assert.equal(second[0].transfers.length, 1);
    assert.equal(second[0].sourceLabwareType, RESERVOIR.labwareType);
    assert.equal(transfers.length, 2);
  });
});
