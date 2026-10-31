// Unit tests for contents-tracking.js. Each test comes from the "Test cases" section of
// contents-tracking.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DECK } from "../../../config/deck.js";
import { LABWARE_TYPES } from "../../../config/labware-types.js";
import { replay, ContentsSnapshot } from "./contents-tracking.js";
import { OperationList } from "../operation-list/operation-list.js";

// The labware on the real deck with the largest dead volume, with its numbers taken from
// config/labware-types.js (spec section 6, "Dead volume and capacity"), so changing the numbers
// never breaks the tests. The largest, so that the specification's examples hold: a transfer of
// 150 µL from a well holding D + 100 is a dead-volume problem only while D is at least 50.
const WITH_DEAD_VOLUME = DECK.reduce((largest, entry) =>
  LABWARE_TYPES[entry.labwareType].deadVolume > LABWARE_TYPES[largest.labwareType].deadVolume
    ? entry
    : largest,
);
const ON_DECK = WITH_DEAD_VOLUME.name;
// D and C, as the specification calls them.
const D = LABWARE_TYPES[WITH_DEAD_VOLUME.labwareType].deadVolume;
const C = LABWARE_TYPES[WITH_DEAD_VOLUME.labwareType].capacity;

// How far apart two amounts may be and still count as equal, in µL. Decimal arithmetic leaves tiny
// leftovers (spec section 6).
const TOLERANCE_MICROLITERS = 0.000000001;

// Returns the starting contents most tests use (spec section 6), a new list each time, so a test can
// change it freely.
function makeStartingContents() {
  return [
    { labware: "Reagents", well: "A1", components: { Dye: 1000 } },
    { labware: "Plate 1", well: "A1", components: { Media: 90 } },
    { labware: "Plate 1", well: "B1", components: { Water: 50 } },
  ];
}

// Returns a transfer of `volume` µL between two wells, each given as "Labware/Well",
// e.g. makeTransfer("Reagents/A1", "Plate 1/A1", 10). It has no stage yet: makeList gives it one.
function makeTransfer(from, to, volume) {
  const [sourceLabware, sourceWell] = from.split("/");
  const [destinationLabware, destinationWell] = to.split("/");
  return {
    type: "transfer",
    source: { labware: sourceLabware, well: sourceWell },
    destination: { labware: destinationLabware, well: destinationWell },
    volume,
  };
}

// Returns an OperationList holding `transfers`, in order, e.g. makeList(makeTransfer(…), …).
// Each transfer gets its own stage, numbered in order ("1", "2" …). A transfer in a new stage goes
// at the end of the list, so the list keeps the order given, and the stage rule (within a stage, no
// well is both a source and a destination) never refuses one: these tests are about contents.
function makeList(...transfers) {
  return transfers.reduce(
    (list, transfer, index) => list.add({ ...transfer, stage: String(index + 1) }),
    new OperationList(),
  );
}

// Asserts that two numbers differ by no more than TOLERANCE_MICROLITERS.
function assertClose(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) <= TOLERANCE_MICROLITERS,
    `expected ${expected}, got ${actual}`,
  );
}

// Asserts that two components objects have the same names, and amounts within
// TOLERANCE_MICROLITERS, e.g. { Dye: 10.0000000000001 } matches { Dye: 10 }.
function assertComponentsClose(actual, expected) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
  for (const name of Object.keys(expected)) {
    assertClose(actual[name], expected[name]);
  }
}

// Returns a copy of a list of wells sorted by labware, then well, so lists whose order isn't
// specified can be compared, e.g. sortWells(snapshot.listAffected()).
function sortWells(wells) {
  return [...wells].sort(
    (a, b) => a.labware.localeCompare(b.labware) || a.well.localeCompare(b.well),
  );
}

// Returns the labware and well of each entry in `wells` as "Labware/Well", sorted,
// e.g. ["Plate 1/A1", "Reagents/A1"].
function wellNames(wells) {
  return wells.map((entry) => `${entry.labware}/${entry.well}`).sort();
}

describe("contents-tracking", () => {
  // --- Starting contents ---

  test("with no operations, listContents() gives the starting contents", () => {
    const snapshot = replay(makeStartingContents(), new OperationList());
    assert.deepEqual(sortWells(snapshot.listContents()), sortWells(makeStartingContents()));
  });

  test("an empty starting contents with no operations gives []", () => {
    assert.deepEqual(replay([], new OperationList()).listContents(), []);
  });

  test("a component with volume 0 is left out, and an entry with only 0s is listed with {}", () => {
    const snapshot = replay(
      [
        { labware: "Plate 1", well: "A1", components: { Dye: 0, Water: 100 } },
        { labware: "Plate 1", well: "A2", components: { Dye: 0, Water: 0 } },
      ],
      new OperationList(),
    );
    assert.deepEqual(sortWells(snapshot.listContents()), [
      { labware: "Plate 1", well: "A1", components: { Water: 100 } },
      { labware: "Plate 1", well: "A2", components: {} },
    ]);
  });

  test("a well that isn't listed gives {}, 0, {} and [] from the four ...Of methods", () => {
    const snapshot = replay(makeStartingContents(), new OperationList());
    assert.deepEqual(snapshot.componentsOf("Plate 9", "H12"), {});
    assert.equal(snapshot.totalVolumeOf("Plate 9", "H12"), 0);
    assert.deepEqual(snapshot.volumeFractionsOf("Plate 9", "H12"), {});
    assert.deepEqual(snapshot.causesOf("Plate 9", "H12"), []);
  });

  test("names are compared exactly: \"a1\" and \"A1\" are two different wells", () => {
    const snapshot = replay(
      [
        { labware: "Plate 1", well: "A1", components: { Water: 100 } },
        { labware: "Plate 1", well: "a1", components: { Dye: 5 } },
      ],
      new OperationList(),
    );
    assert.deepEqual(snapshot.componentsOf("Plate 1", "A1"), { Water: 100 });
    assert.deepEqual(snapshot.componentsOf("Plate 1", "a1"), { Dye: 5 });
  });

  test("componentsOf(\"Plate 1\", \"a1\") doesn't find \"A1\"", () => {
    const snapshot = replay(makeStartingContents(), new OperationList());
    assert.deepEqual(snapshot.componentsOf("Plate 1", "a1"), {});
  });

  // --- Applying transfers ---

  test("10 µL from Reagents A1 to Plate 1 A1 moves 10 µL of Dye", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(makeTransfer("Reagents/A1", "Plate 1/A1", 10)),
    );
    assertComponentsClose(snapshot.componentsOf("Plate 1", "A1"), { Dye: 10, Media: 90 });
    assertComponentsClose(snapshot.componentsOf("Reagents", "A1"), { Dye: 990 });
  });

  test("then 50 µL from Plate 1 A1 to an empty A2: the mixture leaves in proportion", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(
        makeTransfer("Reagents/A1", "Plate 1/A1", 10),
        makeTransfer("Plate 1/A1", "Plate 1/A2", 50),
      ),
    );
    assertComponentsClose(snapshot.componentsOf("Plate 1", "A1"), { Dye: 5, Media: 45 });
    assertComponentsClose(snapshot.componentsOf("Plate 1", "A2"), { Dye: 5, Media: 45 });
  });

  test("totalVolumeOf and volumeFractionsOf after the first transfer", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(makeTransfer("Reagents/A1", "Plate 1/A1", 10)),
    );
    assertClose(snapshot.totalVolumeOf("Plate 1", "A1"), 100);
    assertComponentsClose(snapshot.volumeFractionsOf("Plate 1", "A1"), { Dye: 0.1, Media: 0.9 });
  });

  test("a transfer of 0 µL changes no amounts", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(makeTransfer("Reagents/A1", "Plate 1/A1", 0)),
    );
    assert.deepEqual(snapshot.componentsOf("Reagents", "A1"), { Dye: 1000 });
    assert.deepEqual(snapshot.componentsOf("Plate 1", "A1"), { Media: 90 });
  });

  test("a transfer whose source and destination are the same well leaves it unchanged", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(makeTransfer("Plate 1/A1", "Plate 1/A1", 30)),
    );
    assert.deepEqual(snapshot.componentsOf("Plate 1", "A1"), { Media: 90 });
  });

  test("taking a well's whole volume leaves it listed with {}", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(makeTransfer("Plate 1/B1", "Plate 1/B2", 50)),
    );
    const b1 = snapshot.listContents().find((entry) => entry.well === "B1");
    assert.deepEqual(b1, { labware: "Plate 1", well: "B1", components: {} });
  });

  test("every well named by an applied transfer is listed, and a well named only by a later operation isn't", () => {
    const list = makeList(
      makeTransfer("Plate 2/C3", "Plate 2/C4", 0),
      makeTransfer("Plate 3/A1", "Plate 3/A2", 0),
    );
    const snapshot = replay(makeStartingContents(), list, 1);
    assert.deepEqual(wellNames(snapshot.listContents()), [
      "Plate 1/A1",
      "Plate 1/B1",
      "Plate 2/C3",
      "Plate 2/C4",
      "Reagents/A1",
    ]);
  });

  test("serial dilution: Plate 1 A9 still holds 0.0000001 µL of Dye", () => {
    const startingContents = [{ labware: "Reagents", well: "A1", components: { Dye: 100 } }];
    const transfers = [makeTransfer("Reagents/A1", "Plate 1/A1", 10)];
    for (let column = 1; column <= 9; column++) {
      startingContents.push({ labware: "Plate 1", well: `A${column}`, components: { Media: 90 } });
      if (column < 9) {
        transfers.push(makeTransfer(`Plate 1/A${column}`, `Plate 1/A${column + 1}`, 10));
      }
    }
    const snapshot = replay(startingContents, makeList(...transfers));
    // 10 µL of Dye reaches A1, and each later transfer carries a tenth on: 10 × 0.1⁸ in A9.
    // A9 also keeps the 10 µL it receives from A8, which is nearly all Media: 90 + 9.9999999.
    assertComponentsClose(snapshot.componentsOf("Plate 1", "A9"), {
      Dye: 0.0000001,
      Media: 99.9999999,
    });
  });

  // --- Operation count ---

  test("operationCount 0 gives the starting contents", () => {
    const list = makeList(makeTransfer("Reagents/A1", "Plate 1/A1", 10));
    const snapshot = replay(makeStartingContents(), list, 0);
    assert.deepEqual(sortWells(snapshot.listContents()), sortWells(makeStartingContents()));
  });

  test("with three transfers, operationCount 2 gives the contents after the first two", () => {
    const list = makeList(
      makeTransfer("Reagents/A1", "Plate 1/A1", 10),
      makeTransfer("Reagents/A1", "Plate 1/A1", 20),
      makeTransfer("Reagents/A1", "Plate 1/A1", 40),
    );
    const snapshot = replay(makeStartingContents(), list, 2);
    assertComponentsClose(snapshot.componentsOf("Plate 1", "A1"), { Dye: 30, Media: 90 });
  });

  test("leaving out operationCount, or passing undefined, applies every operation", () => {
    const list = makeList(
      makeTransfer("Reagents/A1", "Plate 1/A1", 10),
      makeTransfer("Reagents/A1", "Plate 1/A1", 20),
    );
    for (const snapshot of [
      replay(makeStartingContents(), list),
      replay(makeStartingContents(), list, undefined),
    ]) {
      assertComponentsClose(snapshot.componentsOf("Plate 1", "A1"), { Dye: 30, Media: 90 });
    }
  });

  test("operationCount equal to the number of operations is accepted", () => {
    const list = makeList(
      makeTransfer("Reagents/A1", "Plate 1/A1", 10),
      makeTransfer("Reagents/A1", "Plate 1/A1", 20),
    );
    const snapshot = replay(makeStartingContents(), list, 2);
    assertComponentsClose(snapshot.componentsOf("Plate 1", "A1"), { Dye: 30, Media: 90 });
  });

  // --- Problems and affected wells ---

  test("60 µL from Plate 1 B1 (holding 50) is a problem; B1 is emptied, B2 gets 50, both affected", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(makeTransfer("Plate 1/B1", "Plate 1/B2", 60)),
    );
    assert.deepEqual(snapshot.listProblems(), [
      {
        kind: "overdraw",
        operationIndex: 0,
        labware: "Plate 1",
        well: "B1",
        requested: 60,
        held: 50,
        deadVolume: 0,
        available: 50,
      },
    ]);
    assert.deepEqual(snapshot.componentsOf("Plate 1", "B1"), {});
    assertComponentsClose(snapshot.componentsOf("Plate 1", "B2"), { Water: 50 });
    assert.deepEqual(snapshot.causesOf("Plate 1", "B1"), [0]);
    assert.deepEqual(snapshot.causesOf("Plate 1", "B2"), [0]);
  });

  test("the replay carries on: a later transfer from B2 to B3 gives B3 causes [0]", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(
        makeTransfer("Plate 1/B1", "Plate 1/B2", 60),
        makeTransfer("Plate 1/B2", "Plate 1/B3", 10),
      ),
    );
    assertComponentsClose(snapshot.componentsOf("Plate 1", "B3"), { Water: 10 });
    assert.deepEqual(snapshot.causesOf("Plate 1", "B3"), [0]);
  });

  test("a transfer from a well that has never held anything is a problem with available: 0", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(makeTransfer("Plate 2/A1", "Plate 1/A1", 5)),
    );
    assert.deepEqual(snapshot.listProblems(), [
      {
        kind: "overdraw",
        operationIndex: 0,
        labware: "Plate 2",
        well: "A1",
        requested: 5,
        held: 0,
        deadVolume: 0,
        available: 0,
      },
    ]);
    assert.deepEqual(snapshot.componentsOf("Plate 1", "A1"), { Media: 90 });
  });

  test("causes combine: B3 then receiving a transfer from a second problem, operation 2, has causes [0, 2]", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(
        makeTransfer("Plate 1/B1", "Plate 1/B2", 60),
        makeTransfer("Plate 1/B2", "Plate 1/B3", 10),
        makeTransfer("Plate 1/A1", "Plate 1/B3", 100),
      ),
    );
    assert.deepEqual(snapshot.causesOf("Plate 1", "B3"), [0, 2]);
  });

  test("causes are listed from lowest to highest, each once, whatever order they arrive in", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(
        makeTransfer("Plate 1/B1", "Plate 1/B2", 60), // problem 0 reaches B2
        makeTransfer("Plate 1/A1", "Plate 1/C1", 100), // problem 1 reaches C1
        makeTransfer("Plate 1/C1", "Plate 1/B2", 10), // C1's [1] arrives after B2's [0]…
        makeTransfer("Plate 1/B2", "Plate 1/C1", 10), // …and B2's [0, 1] reaches C1, holding [1]
        makeTransfer("Plate 1/B2", "Plate 1/C1", 10), // the same causes again
      ),
    );
    assert.deepEqual(snapshot.causesOf("Plate 1", "B2"), [0, 1]);
    assert.deepEqual(snapshot.causesOf("Plate 1", "C1"), [0, 1]);
  });

  test("a well reached only by transfers with no problem upstream isn't affected", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(
        makeTransfer("Plate 1/B1", "Plate 1/B2", 60),
        makeTransfer("Reagents/A1", "Plate 1/A1", 10),
      ),
    );
    assert.deepEqual(sortWells(snapshot.listAffected()), [
      { labware: "Plate 1", well: "B1", causes: [0] },
      { labware: "Plate 1", well: "B2", causes: [0] },
    ]);
    assert.deepEqual(snapshot.causesOf("Plate 1", "A1"), []);
    assert.deepEqual(snapshot.causesOf("Reagents", "A1"), []);
  });

  test("problems are listed in the order the operations occur", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(
        makeTransfer("Plate 1/B1", "Plate 1/B2", 60),
        makeTransfer("Reagents/A1", "Plate 1/A1", 10),
        makeTransfer("Plate 1/A1", "Plate 1/C1", 500),
      ),
    );
    assert.deepEqual(
      snapshot.listProblems().map((problem) => problem.operationIndex),
      [0, 2],
    );
  });

  test("an overdraw from a well to itself is a problem, the well is affected, and its contents are unchanged", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(makeTransfer("Plate 1/B1", "Plate 1/B1", 60)),
    );
    assert.deepEqual(snapshot.listProblems(), [
      {
        kind: "overdraw",
        operationIndex: 0,
        labware: "Plate 1",
        well: "B1",
        requested: 60,
        held: 50,
        deadVolume: 0,
        available: 50,
      },
    ]);
    assert.deepEqual(snapshot.causesOf("Plate 1", "B1"), [0]);
    assert.deepEqual(snapshot.componentsOf("Plate 1", "B1"), { Water: 50 });
  });

  test("labware the deck doesn't know gets no overfill: a well holding 1,000,000 µL has no problem", () => {
    const snapshot = replay(
      [
        { labware: "Reagents", well: "A1", components: { Dye: 1000 } },
        { labware: "Plate 1", well: "A1", components: { Water: 1000000 } },
      ],
      makeList(makeTransfer("Reagents/A1", "Plate 1/A1", 10)),
    );
    assert.deepEqual(snapshot.listProblems(), []);
  });

  // --- Dead volume and capacity (on the real deck) ---

  // Starting contents with `held` µL of Water in well A1 of the labware on the deck, and
  // `destinationHeld` µL of Media in its A2 (left out when 0).
  function onDeck(held, destinationHeld = 0) {
    const contents = [{ labware: ON_DECK, well: "A1", components: { Water: held } }];
    if (destinationHeld > 0) {
      contents.push({ labware: ON_DECK, well: "A2", components: { Media: destinationHeld } });
    }
    return contents;
  }

  // A transfer of `volume` µL from A1 to A2 of the labware on the deck.
  function fromA1(volume) {
    return makeTransfer(`${ON_DECK}/A1`, `${ON_DECK}/A2`, volume);
  }

  test("usableVolumeOf: D + 100 gives 100; D or less gives 0; 0 after a mixture is drawn to D; the total off the deck", () => {
    assertClose(replay(onDeck(D + 100), new OperationList()).usableVolumeOf(ON_DECK, "A1"), 100);
    assert.equal(replay(onDeck(D), new OperationList()).usableVolumeOf(ON_DECK, "A1"), 0);
    if (D > 0) {
      assert.equal(replay(onDeck(D / 2), new OperationList()).usableVolumeOf(ON_DECK, "A1"), 0);
    }
    // Two components drawn down to exactly D can leave an arithmetic leftover above D (e.g. 2150 +
    // 150 drawn 300 leaves 2000.0000000000002); the usable volume is still exactly 0.
    const mixture = [{ labware: ON_DECK, well: "A1", components: { Water: D + 100, Dye: 50 } }];
    const drawn = replay(mixture, makeList(fromA1(150)));
    assert.equal(drawn.usableVolumeOf(ON_DECK, "A1"), 0);
    assert.equal(drawn.listProblems().length, 0);
    const offDeck = replay(makeStartingContents(), new OperationList());
    assert.equal(offDeck.usableVolumeOf("Reagents", "A1"), offDeck.totalVolumeOf("Reagents", "A1"));
  });

  test("a well holding D + 100 with a transfer of 100 µL from it: no problem; it holds D afterwards", () => {
    const snapshot = replay(onDeck(D + 100), makeList(fromA1(100)));
    assert.deepEqual(snapshot.listProblems(), []);
    assertClose(snapshot.totalVolumeOf(ON_DECK, "A1"), D);
  });

  test("a well holding D + 100 with a transfer of 150 µL from it: a dead-volume problem, 100 moved, both wells affected", () => {
    const snapshot = replay(onDeck(D + 100), makeList(fromA1(150)));
    assert.deepEqual(snapshot.listProblems(), [
      {
        kind: "dead-volume",
        operationIndex: 0,
        labware: ON_DECK,
        well: "A1",
        requested: 150,
        held: D + 100,
        deadVolume: D,
        available: 100,
      },
    ]);
    assertClose(snapshot.totalVolumeOf(ON_DECK, "A1"), D);
    assertClose(snapshot.totalVolumeOf(ON_DECK, "A2"), 100);
    assert.deepEqual(snapshot.causesOf(ON_DECK, "A1"), [0]);
    assert.deepEqual(snapshot.causesOf(ON_DECK, "A2"), [0]);
  });

  test("a well holding D + 100 with a transfer of D + 150 µL from it: an overdraw, 100 moved", () => {
    const snapshot = replay(onDeck(D + 100), makeList(fromA1(D + 150)));
    const [problem] = snapshot.listProblems();
    assert.equal(snapshot.listProblems().length, 1);
    assert.equal(problem.kind, "overdraw");
    assert.equal(problem.held, D + 100);
    assert.equal(problem.available, 100);
    assertClose(snapshot.totalVolumeOf(ON_DECK, "A2"), 100);
  });

  test("a well holding D exactly, or less, has 0 usable: 1 µL from it is a dead-volume problem and nothing moves", () => {
    for (const held of [D, D / 2]) {
      const snapshot = replay(onDeck(held), makeList(fromA1(1)));
      const [problem] = snapshot.listProblems();
      assert.equal(snapshot.listProblems().length, 1);
      // Only a labware with a dead volume above 0 can have a dead-volume problem; D is above 0
      // here, by the choice of WITH_DEAD_VOLUME.
      assert.equal(problem.kind, "dead-volume");
      assert.equal(problem.available, 0);
      assertClose(snapshot.totalVolumeOf(ON_DECK, "A1"), held);
      assert.equal(snapshot.totalVolumeOf(ON_DECK, "A2"), 0);
    }
  });

  test("requesting 0.0000005 µL more than the usable volume isn't a problem; 0.000002 µL more is", () => {
    const small = replay(onDeck(D + 100), makeList(fromA1(100.0000005)));
    assert.deepEqual(small.listProblems(), []);
    const larger = replay(onDeck(D + 100), makeList(fromA1(100.000002)));
    assert.equal(larger.listProblems().length, 1);
  });

  test("a well holding C - 10 receiving 20 µL: an overfill, the well holds C + 10, and no well is affected", () => {
    // The source holds plenty above its dead volume (and within its capacity), so the only problem
    // is the overfill.
    const snapshot = replay(onDeck(D + 200, C - 10), makeList(fromA1(20)));
    assert.deepEqual(snapshot.listProblems(), [
      { kind: "overfill", operationIndex: 0, labware: ON_DECK, well: "A2", held: C + 10, capacity: C },
    ]);
    assertClose(snapshot.totalVolumeOf(ON_DECK, "A2"), C + 10);
    assert.deepEqual(snapshot.listAffected(), []);
    assert.deepEqual(snapshot.causesOf(ON_DECK, "A2"), []);
    assert.deepEqual(snapshot.causesOf(ON_DECK, "A1"), []);
  });

  test("a well holding C - 10 receiving 10 µL exactly, or 10.0000005, is no problem; 10.000002 is", () => {
    for (const [volume, count] of [[10, 0], [10.0000005, 0], [10.000002, 1]]) {
      const snapshot = replay(onDeck(D + 200, C - 10), makeList(fromA1(volume)));
      assert.equal(snapshot.listProblems().length, count, String(volume));
    }
  });

  test("the transfer that takes a well over capacity is the problem; a second into the well, now over, isn't", () => {
    const snapshot = replay(onDeck(D + 200, C - 10), makeList(fromA1(20), fromA1(20)));
    assert.equal(snapshot.listProblems().length, 1);
    assert.equal(snapshot.listProblems()[0].operationIndex, 0);
  });

  test("a well that starts holding C + 1 is an overfill with operationIndex null, before any transfer's problem, and a transfer into it adds no overfill", () => {
    const startingContents = [
      // A dead-volume problem in the first transfer, so there's a transfer's problem to come after.
      { labware: ON_DECK, well: "A1", components: { Water: D + 10 } },
      { labware: ON_DECK, well: "A2", components: { Media: C + 1 } },
    ];
    const snapshot = replay(startingContents, makeList(fromA1(20)));
    assert.deepEqual(
      snapshot.listProblems().map((problem) => [problem.kind, problem.operationIndex]),
      [["overfill", null], ["dead-volume", 0]],
    );
    assert.deepEqual(snapshot.listProblems()[0], {
      kind: "overfill",
      operationIndex: null,
      labware: ON_DECK,
      well: "A2",
      held: C + 1,
      capacity: C,
    });
  });

  test("one transfer with both: a dead-volume problem then an overfill, in that order", () => {
    const snapshot = replay(onDeck(D + 50, C - 10), makeList(fromA1(60)));
    const problems = snapshot.listProblems();
    assert.deepEqual(problems.map((problem) => problem.kind), ["dead-volume", "overfill"]);
    assert.equal(problems[1].held, C + 40);
    assertClose(snapshot.totalVolumeOf(ON_DECK, "A2"), C + 40);
  });

  test("problems of several kinds are listed in the order they occur", () => {
    const snapshot = replay(
      [
        { labware: ON_DECK, well: "A1", components: { Water: D + 200 } },
        { labware: ON_DECK, well: "A2", components: { Media: C - 10 } },
        { labware: ON_DECK, well: "A3", components: { Media: D + 10 } },
        { labware: "Plate 1", well: "B1", components: { Water: 50 } },
      ],
      makeList(
        fromA1(20), // overfills A2
        makeTransfer(`${ON_DECK}/A3`, `${ON_DECK}/A4`, 20), // dead volume in A3
        makeTransfer("Plate 1/B1", "Plate 1/B2", 60), // overdraws B1
      ),
    );
    assert.deepEqual(
      snapshot.listProblems().map((problem) => [problem.kind, problem.operationIndex]),
      [["overfill", 0], ["dead-volume", 1], ["overdraw", 2]],
    );
  });

  // --- Tiny amounts ---

  test("a well holding 0.1 + 0.2 µL is empty after a transfer of 0.3 µL, with no problem", () => {
    const startingContents = [
      { labware: "Plate 1", well: "A1", components: { Water: 0.1 + 0.2 } },
    ];
    assert.equal(startingContents[0].components.Water, 0.30000000000000004);
    const snapshot = replay(startingContents, makeList(makeTransfer("Plate 1/A1", "Plate 1/A2", 0.3)));
    assert.deepEqual(snapshot.componentsOf("Plate 1", "A1"), {});
    assert.deepEqual(snapshot.listProblems(), []);
  });

  test("requesting 0.0000005 µL more than the source holds isn't a problem; 0.000002 µL more is (dead volume 0)", () => {
    const smallExcess = replay(
      makeStartingContents(),
      makeList(makeTransfer("Plate 1/B1", "Plate 1/B2", 50.0000005)),
    );
    assert.deepEqual(smallExcess.listProblems(), []);
    const largerExcess = replay(
      makeStartingContents(),
      makeList(makeTransfer("Plate 1/B1", "Plate 1/B2", 50.000002)),
    );
    assert.equal(largerExcess.listProblems().length, 1);
  });

  // --- Immutability and copies ---

  test("replay doesn't change the starting contents or the operation list passed to it", () => {
    const startingContents = makeStartingContents();
    const list = makeList(
      makeTransfer("Reagents/A1", "Plate 1/A1", 10),
      makeTransfer("Plate 1/B1", "Plate 1/B2", 60),
    );
    const operationsBefore = list.listOperations();
    replay(startingContents, list);
    assert.deepEqual(startingContents, makeStartingContents());
    assert.deepEqual(list.listOperations(), operationsBefore);
  });

  test("changing the starting contents after replay doesn't change the snapshot", () => {
    const startingContents = makeStartingContents();
    const snapshot = replay(startingContents, new OperationList());
    startingContents[0].components.Dye = 1;
    startingContents[1].well = "H12";
    startingContents.push({ labware: "Plate 9", well: "A1", components: { Water: 5 } });
    assert.deepEqual(sortWells(snapshot.listContents()), sortWells(makeStartingContents()));
  });

  test("changing what listContents, listProblems, listAffected and the ...Of methods return doesn't change the snapshot", () => {
    const snapshot = replay(
      makeStartingContents(),
      makeList(makeTransfer("Plate 1/B1", "Plate 1/B2", 60)),
    );
    const contentsBefore = snapshot.listContents();
    const problemsBefore = snapshot.listProblems();
    const affectedBefore = snapshot.listAffected();

    const contents = snapshot.listContents();
    contents[0].components.Dye = 0;
    contents.push("something else");
    const problems = snapshot.listProblems();
    problems[0].requested = 1;
    problems[0].kind = "overfill";
    problems.pop();
    const affected = snapshot.listAffected();
    affected[0].causes.push(9);
    affected.pop();
    snapshot.componentsOf("Plate 1", "B2").Water = 1;
    snapshot.volumeFractionsOf("Plate 1", "B2").Water = 0.5;
    snapshot.causesOf("Plate 1", "B2").push(9);

    assert.deepEqual(snapshot.listContents(), contentsBefore);
    assert.deepEqual(snapshot.listProblems(), problemsBefore);
    assert.deepEqual(snapshot.listAffected(), affectedBefore);
    assertComponentsClose(snapshot.componentsOf("Plate 1", "B2"), { Water: 50 });
    assertComponentsClose(snapshot.volumeFractionsOf("Plate 1", "B2"), { Water: 1 });
    assert.deepEqual(snapshot.causesOf("Plate 1", "B2"), [0]);
  });

  test("two replay calls with the same inputs give equal results", () => {
    const list = makeList(
      makeTransfer("Reagents/A1", "Plate 1/A1", 10),
      makeTransfer("Plate 1/B1", "Plate 1/B2", 60),
    );
    const first = replay(makeStartingContents(), list);
    const second = replay(makeStartingContents(), list);
    assert.deepEqual(first.listContents(), second.listContents());
    assert.deepEqual(first.listProblems(), second.listProblems());
    assert.deepEqual(first.listAffected(), second.listAffected());
  });

  test("new ContentsSnapshot() throws: only replay can make one", () => {
    assert.throws(() => new ContentsSnapshot(), {
      message:
        "A ContentsSnapshot is made only by replay. Call replay(startingContents, operationList) instead.",
    });
  });

  // --- Errors: starting contents ---

  test("starting contents null, {} and \"A1\" give the list error", () => {
    for (const [startingContents, shown] of [[null, "null"], [{}, "an object"], ["A1", '"A1"']]) {
      assert.throws(() => replay(startingContents, new OperationList()), {
        message: `The starting contents must be a list of wells, like [{ labware: "Plate 1", well: "A1", components: { Water: 100 } }], but got ${shown}.`,
      });
    }
  });

  test("entries null, 5 and [] give the entry error, naming the entry's position", () => {
    for (const [entry, shown] of [[null, "null"], [5, "5"], [[], "a list"]]) {
      const startingContents = [makeStartingContents()[0], entry];
      assert.throws(() => replay(startingContents, new OperationList()), {
        message: `Starting contents entry 1 must be an object with a labware, a well and components, but got ${shown}.`,
      });
    }
  });

  test("an entry missing components, or labware and well, gives the missing error", () => {
    assert.throws(() => replay([{ labware: "Plate 1", well: "A1" }], new OperationList()), {
      message: 'Starting contents entry 0 needs labware, well and components, but is missing "components".',
    });
    assert.throws(() => replay([{ components: { Water: 100 } }], new OperationList()), {
      message:
        'Starting contents entry 0 needs labware, well and components, but is missing "labware", "well".',
    });
  });

  test("an entry whose labware comes from a class (a getter) counts it as missing", () => {
    // Defines an entry class whose `labware` comes from a getter, not the object itself.
    class EntryWithGetter {
      // Gives the entry its own well and components, but not its labware.
      constructor() {
        this.well = "A1";
        this.components = { Water: 100 };
      }

      // Gives every entry the labware "Plate 1", through the class rather than the object itself.
      get labware() {
        return "Plate 1";
      }
    }
    assert.throws(() => replay([new EntryWithGetter()], new OperationList()), {
      message: 'Starting contents entry 0 needs labware, well and components, but is missing "labware".',
    });
  });

  test("an entry with volume: 50 alongside valid properties gives the extra-property error", () => {
    const entry = { labware: "Plate 1", well: "A1", components: { Water: 100 }, volume: 50 };
    assert.throws(() => replay([entry], new OperationList()), {
      message: 'Starting contents entry 0 can only have labware, well and components, but also got "volume".',
    });
  });

  test("labware and well values 5, \"\", \"   \", \" Plate 1\" and \"Plate 1 \" each give their error", () => {
    const cases = [
      [5, "must be text, but got 5."],
      ["", "is blank. Give it at least one character that isn't a space."],
      ["   ", "is blank. Give it at least one character that isn't a space."],
      [" Plate 1", '" Plate 1" has spaces at the start or end. Remove them.'],
      ["Plate 1 ", '"Plate 1 " has spaces at the start or end. Remove them.'],
    ];
    for (const property of ["labware", "well"]) {
      for (const [value, ending] of cases) {
        const entry = { labware: "Plate 1", well: "A1", components: { Water: 100 }, [property]: value };
        assert.throws(() => replay([entry], new OperationList()), {
          message: `The ${property} in starting contents entry 0 ${ending}`,
        });
      }
    }
  });

  test("components values 100, null and [] give the components error", () => {
    for (const [components, shown] of [[100, "100"], [null, "null"], [[], "a list"]]) {
      const entry = { labware: "Plate 1", well: "A1", components };
      assert.throws(() => replay([entry], new OperationList()), {
        message: `The components in starting contents entry 0 must be an object of names and volumes, like { Water: 100 }, but got ${shown}.`,
      });
    }
  });

  test("component names \"\" and \" Dye\" give their errors", () => {
    assert.throws(
      () => replay([{ labware: "Plate 1", well: "A1", components: { "": 10 } }], new OperationList()),
      {
        message:
          "The component name in starting contents entry 0 is blank. Give it at least one character that isn't a space.",
      },
    );
    assert.throws(
      () => replay([{ labware: "Plate 1", well: "A1", components: { " Dye": 10 } }], new OperationList()),
      {
        message:
          'The component name in starting contents entry 0 " Dye" has spaces at the start or end. Remove them.',
      },
    );
  });

  test("component volumes \"50\", NaN, Infinity and -5 give the volume error", () => {
    for (const [volume, shown] of [["50", '"50"'], [NaN, "NaN"], [Infinity, "Infinity"], [-5, "-5"]]) {
      const entry = { labware: "Plate 1", well: "A1", components: { Dye: volume } };
      assert.throws(() => replay([entry], new OperationList()), {
        message: `The volume of "Dye" in starting contents entry 0 must be a number of microliters, 0 or more, like 50, but got ${shown}.`,
      });
    }
  });

  test("the same labware and well in entries 0 and 4 gives the duplicate error naming both entries", () => {
    const startingContents = [
      { labware: "Plate 1", well: "A1", components: { Water: 100 } },
      { labware: "Plate 1", well: "A2", components: { Water: 100 } },
      { labware: "Plate 1", well: "A3", components: { Water: 100 } },
      { labware: "Plate 1", well: "A4", components: { Water: 100 } },
      { labware: "Plate 1", well: "A1", components: { Dye: 5 } },
    ];
    assert.throws(() => replay(startingContents, new OperationList()), {
      message: "Plate 1 A1 is in the starting contents twice, in entries 0 and 4. List each well once.",
    });
  });

  // --- Errors: operation list and operation count ---

  test("an operation list given as a plain list of transfers gives the operation-list error", () => {
    const transfers = [makeTransfer("Reagents/A1", "Plate 1/A1", 10)];
    assert.throws(() => replay(makeStartingContents(), transfers), {
      message:
        "The operation list must be an OperationList, made with new OperationList() and add, but got a list.",
    });
  });

  test("operationCount 2.5, \"3\", null and NaN give the whole-number error", () => {
    const list = makeList(makeTransfer("Reagents/A1", "Plate 1/A1", 10));
    for (const [operationCount, shown] of [[2.5, "2.5"], ["3", '"3"'], [null, "null"], [NaN, "NaN"]]) {
      assert.throws(() => replay(makeStartingContents(), list, operationCount), {
        message: `The operation count must be a whole number, like 3, but got ${shown}.`,
      });
    }
  });

  test("operationCount -1, and one more than the number of operations, give the range error", () => {
    const list = makeList(
      makeTransfer("Reagents/A1", "Plate 1/A1", 10),
      makeTransfer("Reagents/A1", "Plate 1/A1", 10),
      makeTransfer("Reagents/A1", "Plate 1/A1", 10),
    );
    for (const operationCount of [-1, 4]) {
      assert.throws(() => replay(makeStartingContents(), list, operationCount), {
        message: `The operation count must be from 0 to 3, the number of operations in the list, but got ${operationCount}.`,
      });
    }
  });

  test("checks run in order: a bad entry 1 and a bad operation count report entry 1", () => {
    const startingContents = [makeStartingContents()[0], null];
    assert.throws(() => replay(startingContents, new OperationList(), -1), {
      message:
        "Starting contents entry 1 must be an object with a labware, a well and components, but got null.",
    });
  });

  // --- Errors: methods that take a labware and a well ---

  test("each ...Of method rejects a labware or well of 5, \"\" or \" A1\", naming the method", () => {
    const snapshot = replay(makeStartingContents(), new OperationList());
    const cases = [
      [5, "must be text, but got 5."],
      ["", "is blank. Give it at least one character that isn't a space."],
      [" A1", '" A1" has spaces at the start or end. Remove them.'],
    ];
    for (const method of ["componentsOf", "totalVolumeOf", "usableVolumeOf", "volumeFractionsOf", "causesOf"]) {
      for (const [value, ending] of cases) {
        assert.throws(() => snapshot[method](value, "A1"), {
          message: `The labware given to ${method} ${ending}`,
        });
        assert.throws(() => snapshot[method]("Plate 1", value), {
          message: `The well given to ${method} ${ending}`,
        });
      }
    }
  });

  test("a well left out gives the not-text error, naming the method", () => {
    const snapshot = replay(makeStartingContents(), new OperationList());
    assert.throws(() => snapshot.componentsOf("Plate 1"), {
      message: "The well given to componentsOf must be text, but got undefined.",
    });
  });
});
