// Unit tests for operation-list.js. Each test comes from the "Test cases" section of
// operation-list.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { OperationList } from "./operation-list.js";

// Returns a valid transfer, a new object each time, so a test can change it freely.
// e.g. makeTransfer() → { type: "transfer", source: { labware: "Reagents", well: "A1" }, … }
function makeTransfer() {
  return {
    type: "transfer",
    source: { labware: "Reagents", well: "A1" },
    destination: { labware: "Plate 1", well: "D4" },
    volume: 50,
    stage: "1",
  };
}

// Returns a valid transfer in `stage`, with `volume` so tests can tell transfers apart,
// e.g. makeTransferInStage("2", 20) → { …, volume: 20, stage: "2" }.
function makeTransferInStage(stage, volume = 50) {
  return { ...makeTransfer(), volume, stage };
}

// Returns a transfer in `stage` between two wells, each given as "Labware/Well",
// e.g. makeTransferBetween("Reagents/A1", "Plate 1/A1", "1").
function makeTransferBetween(from, to, stage) {
  const [sourceLabware, sourceWell] = from.split("/");
  const [destinationLabware, destinationWell] = to.split("/");
  return {
    type: "transfer",
    source: { labware: sourceLabware, well: sourceWell },
    destination: { labware: destinationLabware, well: destinationWell },
    volume: 10,
    stage,
  };
}

// Returns an OperationList made by adding `transfers` in order, e.g. makeList(first, second).
function makeList(...transfers) {
  return transfers.reduce((list, transfer) => list.add(transfer), new OperationList());
}

// The stage of each operation in `list`, in order, e.g. ["1", "1", "2"].
function stagesOf(list) {
  return list.listOperations().map((operation) => operation.stage);
}

// The volume of each operation in `list`, in order, so a test can tell which transfer went where,
// e.g. [10, 30, 20].
function volumesOf(list) {
  return list.listOperations().map((operation) => operation.volume);
}

describe("operation-list", () => {
  // --- Creating and adding ---

  test("a new list is empty", () => {
    assert.deepEqual(new OperationList().listOperations(), []);
  });

  test("add() returns a new list containing the transfer, and the original list is still empty", () => {
    const original = new OperationList();
    const added = original.add(makeTransfer());
    assert.notEqual(added, original);
    assert.deepEqual(added.listOperations(), [makeTransfer()]);
    assert.deepEqual(original.listOperations(), []);
  });

  test("transfers are kept in the order they were added", () => {
    const first = { ...makeTransfer(), volume: 10 };
    const second = { ...makeTransfer(), volume: 20 };
    const third = { ...makeTransfer(), volume: 30 };
    const list = new OperationList().add(first).add(second).add(third);
    assert.deepEqual(list.listOperations(), [first, second, third]);
  });

  test("a transfer with the same source and destination is accepted", () => {
    const transfer = {
      ...makeTransfer(),
      source: { labware: "Plate 1", well: "D4" },
      destination: { labware: "Plate 1", well: "D4" },
    };
    assert.deepEqual(new OperationList().add(transfer).listOperations(), [transfer]);
  });

  test("a volume of 0 is accepted, and so is a decimal", () => {
    for (const volume of [0, 2.5]) {
      const transfer = { ...makeTransfer(), volume };
      assert.deepEqual(new OperationList().add(transfer).listOperations(), [transfer], String(volume));
    }
  });

  // --- Placing by stage ---

  test('adding stages "1", "2", "1" gives "1", "1", "2": the second stage "1" transfer goes before stage "2"', () => {
    const list = makeList(
      makeTransferInStage("1", 10),
      makeTransferInStage("2", 20),
      makeTransferInStage("1", 30),
    );
    assert.deepEqual(stagesOf(list), ["1", "1", "2"]);
    assert.deepEqual(volumesOf(list), [10, 30, 20]);
  });

  test("within a stage, transfers keep the order they were added", () => {
    const list = makeList(
      makeTransferInStage("1", 10),
      makeTransferInStage("2", 20),
      makeTransferInStage("1", 30),
      makeTransferInStage("1", 40),
    );
    assert.deepEqual(volumesOf(list), [10, 30, 40, 20]);
  });

  test("a transfer in a new stage goes at the end", () => {
    const list = makeList(makeTransferInStage("1"), makeTransferInStage("2"), makeTransferInStage("3"));
    assert.deepEqual(stagesOf(list), ["1", "2", "3"]);
  });

  test('insertBeforeStage(t, "2") with t in new stage "3" gives "1", "3", "2"; before the first stage puts it first', () => {
    const list = makeList(makeTransferInStage("1"), makeTransferInStage("2"));
    assert.deepEqual(stagesOf(list.insertBeforeStage(makeTransferInStage("3"), "2")), ["1", "3", "2"]);
    assert.deepEqual(stagesOf(list.insertBeforeStage(makeTransferInStage("3"), "1")), ["3", "1", "2"]);
  });

  test('after insertBeforeStage, add with stage "3" puts the transfer after stage "3", before stage "2"', () => {
    const list = makeList(makeTransferInStage("1", 10), makeTransferInStage("2", 20))
      .insertBeforeStage(makeTransferInStage("3", 30), "2")
      .add(makeTransferInStage("3", 40));
    assert.deepEqual(stagesOf(list), ["1", "3", "3", "2"]);
    assert.deepEqual(volumesOf(list), [10, 30, 40, 20]);
  });

  test("insertBeforeStage returns a new list, and the original is unchanged", () => {
    const original = makeList(makeTransferInStage("1"), makeTransferInStage("2"));
    const inserted = original.insertBeforeStage(makeTransferInStage("3"), "2");
    assert.notEqual(inserted, original);
    assert.deepEqual(stagesOf(original), ["1", "2"]);
  });

  // --- Removing ---

  test("remove(1) on a list of three takes out the middle transfer; the others keep their order", () => {
    const list = makeList(
      makeTransferInStage("1", 10),
      makeTransferInStage("1", 20),
      makeTransferInStage("1", 30),
    );
    assert.deepEqual(volumesOf(list.remove(1)), [10, 30]);
  });

  test("removing a stage's only transfer removes that stage from groupByStage()", () => {
    const list = makeList(makeTransferInStage("1"), makeTransferInStage("2"), makeTransferInStage("3"));
    const stages = list.remove(1).groupByStage().map((group) => group.stage);
    assert.deepEqual(stages, ["1", "3"]);
  });

  test("remove returns a new list, and the original is unchanged", () => {
    const original = makeList(makeTransferInStage("1", 10), makeTransferInStage("1", 20));
    const removed = original.remove(0);
    assert.notEqual(removed, original);
    assert.deepEqual(volumesOf(original), [10, 20]);
    assert.deepEqual(volumesOf(removed), [20]);
  });

  // --- Replacing ---

  test("replace(1, …) with the middle transfer's volume changed gives the new volume there; the others keep their order and values", () => {
    const transfers = [
      makeTransferInStage("1", 10),
      makeTransferInStage("1", 20),
      makeTransferInStage("1", 30),
    ];
    const replaced = makeList(...transfers).replace(1, { ...transfers[1], volume: 25 });
    assert.deepEqual(replaced.listOperations(), [
      transfers[0],
      { ...transfers[1], volume: 25 },
      transfers[2],
    ]);
  });

  test("replace returns a new list, and the original is unchanged, including the replaced operation's volume", () => {
    const original = makeList(makeTransferInStage("1", 10), makeTransferInStage("1", 20));
    const replaced = original.replace(0, makeTransferInStage("1", 15));
    assert.notEqual(replaced, original);
    assert.deepEqual(volumesOf(original), [10, 20]);
    assert.deepEqual(volumesOf(replaced), [15, 20]);
  });

  test('in stage "1", replacing a transfer from Plate 1 B1 with one from Plate 1 A1, a destination, is refused', () => {
    const list = makeList(
      makeTransferBetween("Reagents/A1", "Plate 1/A1", "1"),
      makeTransferBetween("Plate 1/B1", "Plate 1/C1", "1"),
    );
    assert.throws(() => list.replace(1, makeTransferBetween("Plate 1/A1", "Plate 1/C1", "1")), {
      message:
        'This transfer\'s source, Plate 1 A1, is a destination in stage "1" (operation 0). Within a stage, no well can be both a source and a destination. Put this transfer in another stage.',
    });
  });

  test("replacing a transfer with a changed copy of itself is accepted: it isn't checked against the one it replaces", () => {
    // A transfer from a well into itself would conflict with itself if it were checked against it.
    const self = makeTransferBetween("Plate 1/A1", "Plate 1/A1", "1");
    const list = makeList(makeTransferInStage("2"), self);
    const replaced = list.replace(1, { ...self, volume: 75 });
    assert.deepEqual(replaced.listOperations()[1], { ...self, volume: 75 });
  });

  test("replacing a transfer with one in another stage gives the different-stage message, even if that stage is in the list", () => {
    const list = makeList(makeTransferInStage("1"), makeTransferInStage("2"), makeTransferInStage("2"));
    assert.throws(() => list.replace(2, makeTransferInStage("1")), {
      message:
        'A replacement must stay in stage "2", the stage of operation 2, but is in stage "1". To move a transfer to another stage, remove it and add it again.',
    });
  });

  // --- Sharing ---

  test("after add, every operation that was in the original list is the very same object", () => {
    const original = makeList(makeTransferInStage("1", 10), makeTransferInStage("2", 20));
    const before = original.listOperations();
    const after = original.add(makeTransferInStage("1", 30)).listOperations();
    assert.equal(after[0], before[0]);
    assert.equal(after[2], before[1]);
  });

  test("after remove, every remaining operation is the very same object", () => {
    const original = makeList(
      makeTransferInStage("1", 10),
      makeTransferInStage("1", 20),
      makeTransferInStage("1", 30),
    );
    const before = original.listOperations();
    const after = original.remove(1).listOperations();
    assert.equal(after[0], before[0]);
    assert.equal(after[1], before[2]);
  });

  test("after replace, every operation except the replaced one is the very same object; the replaced one is new", () => {
    const original = makeList(
      makeTransferInStage("1", 10),
      makeTransferInStage("1", 20),
      makeTransferInStage("1", 30),
    );
    const before = original.listOperations();
    const after = original.replace(1, makeTransferInStage("1", 25)).listOperations();
    assert.equal(after[0], before[0]);
    assert.notEqual(after[1], before[1]);
    assert.equal(after[2], before[2]);
  });

  test("after insertBeforeStage, every operation that was in the original list is the very same object", () => {
    const original = makeList(makeTransferInStage("1", 10), makeTransferInStage("2", 20));
    const before = original.listOperations();
    const after = original.insertBeforeStage(makeTransferInStage("3", 30), "2").listOperations();
    assert.equal(after[0], before[0]);
    assert.equal(after[2], before[1]);
  });

  // --- Grouping ---

  test('stages "1", "1", "2", "2", "3" give three groups, in order, each with its operations in order', () => {
    const transfers = [
      makeTransferInStage("1", 10),
      makeTransferInStage("1", 20),
      makeTransferInStage("2", 30),
      makeTransferInStage("2", 40),
      makeTransferInStage("3", 50),
    ];
    assert.deepEqual(makeList(...transfers).groupByStage(), [
      { stage: "1", operations: [transfers[0], transfers[1]] },
      { stage: "2", operations: [transfers[2], transfers[3]] },
      { stage: "3", operations: [transfers[4]] },
    ]);
  });

  test("groupByStage() on an empty list gives []", () => {
    assert.deepEqual(new OperationList().groupByStage(), []);
  });

  test("changing what groupByStage() returns doesn't change the list", () => {
    const list = makeList(makeTransferInStage("1", 10), makeTransferInStage("2", 20));
    const groups = list.groupByStage();
    groups[0].stage = "9";
    groups[0].operations.pop();
    groups.pop();
    assert.deepEqual(list.groupByStage(), [
      { stage: "1", operations: [makeTransferInStage("1", 10)] },
      { stage: "2", operations: [makeTransferInStage("2", 20)] },
    ]);
    assert.deepEqual(volumesOf(list), [10, 20]);
  });

  test('stage IDs are compared exactly: "1" and "01" are different stages', () => {
    const list = makeList(
      makeTransferInStage("1", 10),
      makeTransferInStage("01", 20),
      makeTransferInStage("1", 30),
    );
    assert.deepEqual(stagesOf(list), ["1", "1", "01"]);
    assert.equal(list.groupByStage().length, 2);
  });

  // --- The stage rule ---

  test('in stage "1", into Plate 1 A1 then out of it is refused, and so is the other way round', () => {
    const into = makeTransferBetween("Reagents/A1", "Plate 1/A1", "1");
    const outOf = makeTransferBetween("Plate 1/A1", "Plate 1/B1", "1");
    const rest =
      "Within a stage, no well can be both a source and a destination. Put this transfer in another stage.";
    assert.throws(() => makeList(into).add(outOf), {
      message: `This transfer's source, Plate 1 A1, is a destination in stage "1" (operation 0). ${rest}`,
    });
    assert.throws(() => makeList(outOf).add(into), {
      message: `This transfer's destination, Plate 1 A1, is a source in stage "1" (operation 0). ${rest}`,
    });
  });

  test("the same two transfers in different stages are accepted", () => {
    const list = makeList(
      makeTransferBetween("Reagents/A1", "Plate 1/A1", "1"),
      makeTransferBetween("Plate 1/A1", "Plate 1/B1", "2"),
    );
    assert.equal(list.listOperations().length, 2);
  });

  test("a transfer from Plate 1 A1 into Plate 1 A1 is accepted on its own in a stage", () => {
    const self = makeTransferBetween("Plate 1/A1", "Plate 1/A1", "1");
    assert.deepEqual(makeList(self).listOperations(), [self]);
  });

  test("into Plate 1 A1 then from A1 into A1 is refused, and so is from A1 into A1 then into A1", () => {
    const into = makeTransferBetween("Reagents/A1", "Plate 1/A1", "1");
    const self = makeTransferBetween("Plate 1/A1", "Plate 1/A1", "1");
    const rest =
      "Within a stage, no well can be both a source and a destination. Put this transfer in another stage.";
    assert.throws(() => makeList(into).add(self), {
      message: `This transfer's source, Plate 1 A1, is a destination in stage "1" (operation 0). ${rest}`,
    });
    assert.throws(() => makeList(self).add(into), {
      message: `This transfer's destination, Plate 1 A1, is a source in stage "1" (operation 0). ${rest}`,
    });
  });

  test("two transfers from Plate 1 A1 into Plate 1 A1 in one stage are refused", () => {
    const self = makeTransferBetween("Plate 1/A1", "Plate 1/A1", "1");
    assert.throws(() => makeList(self).add(self), {
      message: /^This transfer's source, Plate 1 A1, is a destination in stage "1" \(operation 0\)\./,
    });
  });

  test("the same well name on different labware doesn't conflict", () => {
    const list = makeList(
      makeTransferBetween("Reagents/A1", "Plate 1/A1", "1"),
      makeTransferBetween("Plate 2/A1", "Plate 2/B1", "1"),
    );
    assert.equal(list.listOperations().length, 2);
  });

  test("when several transfers conflict, the source is checked first and the first conflict is named", () => {
    const list = makeList(
      makeTransferBetween("Reagents/A9", "Plate 9/A9", "0"),
      makeTransferBetween("Reagents/A1", "Plate 1/B1", "1"),
      makeTransferBetween("Reagents/A2", "Plate 1/A1", "1"),
      makeTransferBetween("Reagents/A3", "Plate 1/A1", "1"),
    );
    // Its source is a destination of operations 2 and 3; its destination is a source of operation 1.
    assert.throws(() => list.add(makeTransferBetween("Plate 1/A1", "Reagents/A1", "1")), {
      message: /^This transfer's source, Plate 1 A1, is a destination in stage "1" \(operation 2\)\./,
    });
  });

  test("insertBeforeStage's new stage has nothing to conflict with, so the rule never refuses it, including a self-transfer", () => {
    const list = makeList(makeTransferBetween("Reagents/A1", "Plate 1/A1", "1"));
    const self = makeTransferBetween("Plate 1/A1", "Plate 1/A1", "2");
    const outOfA1 = makeTransferBetween("Plate 1/A1", "Plate 1/B1", "2");
    assert.deepEqual(list.insertBeforeStage(self, "1").listOperations(), [
      self,
      ...list.listOperations(),
    ]);
    assert.deepEqual(stagesOf(list.insertBeforeStage(outOfA1, "1")), ["2", "1"]);
  });

  // --- Immutability and copies ---

  test("changing the object passed to add() afterwards, including its source, doesn't change the list", () => {
    const transfer = makeTransfer();
    const list = new OperationList().add(transfer);
    transfer.volume = 99;
    transfer.source.well = "H12";
    transfer.destination = { labware: "Other", well: "B2" };
    assert.deepEqual(list.listOperations(), [makeTransfer()]);
  });

  test("changing the list returned by listOperations() doesn't change the list", () => {
    const list = new OperationList().add(makeTransfer());
    const operations = list.listOperations();
    operations.pop();
    operations.push("something else");
    assert.deepEqual(list.listOperations(), [makeTransfer()]);
  });

  test("changing a returned operation, or its source or destination, throws and leaves the list unchanged", () => {
    const list = new OperationList().add(makeTransfer());
    const [operation] = list.listOperations();
    assert.throws(() => {
      operation.volume = 99;
    }, TypeError);
    assert.throws(() => {
      operation.source.well = "H12";
    }, TypeError);
    assert.throws(() => {
      operation.destination.labware = "Other";
    }, TypeError);
    assert.throws(() => {
      delete operation.type;
    }, TypeError);
    assert.deepEqual(list.listOperations(), [makeTransfer()]);
  });

  test("an earlier list is unchanged after later adds", () => {
    const empty = new OperationList();
    const one = empty.add(makeTransfer());
    const two = one.add({ ...makeTransfer(), volume: 20 });
    two.add({ ...makeTransfer(), volume: 30 });
    assert.deepEqual(empty.listOperations(), []);
    assert.deepEqual(one.listOperations(), [makeTransfer()]);
    assert.equal(two.listOperations().length, 2);
  });

  test("the list's stored operations can't be reached or replaced from outside", () => {
    const list = new OperationList().add(makeTransfer());
    assert.deepEqual(Object.keys(list), []);
    assert.equal(list.operations, undefined);
    list.operations = [];
    assert.deepEqual(list.listOperations(), [makeTransfer()]);
  });

  // --- Errors ---

  test("an operation that isn't an object throws the object error", () => {
    const list = new OperationList();
    assert.throws(() => list.add(null), {
      message:
        'An operation must be an object with a type, like { type: "transfer", … }, but got null.',
    });
    assert.throws(() => list.add("transfer"), {
      message: /^An operation must be an object.*but got "transfer"\.$/,
    });
    assert.throws(() => list.add(5), { message: /^An operation must be an object.*but got 5\.$/ });
    assert.throws(() => list.add([]), {
      message: /^An operation must be an object.*but got a list\.$/,
    });
  });

  test("a missing or non-text type throws the type error", () => {
    const list = new OperationList();
    const noType = makeTransfer();
    delete noType.type;
    assert.throws(() => list.add(noType), {
      message: 'An operation needs a type, like "transfer", but got undefined.',
    });
    assert.throws(() => list.add({ ...makeTransfer(), type: 5 }), {
      message: 'An operation needs a type, like "transfer", but got 5.',
    });
  });

  test("an unknown type throws the unknown-type error", () => {
    assert.throws(() => new OperationList().add({ ...makeTransfer(), type: "tranfer" }), {
      message: '"tranfer" isn\'t an operation type. The only type is "transfer".',
    });
  });

  test("missing transfer properties are all named, in order", () => {
    const list = new OperationList();
    const noVolume = makeTransfer();
    delete noVolume.volume;
    assert.throws(() => list.add(noVolume), {
      message: 'A transfer needs source, destination, volume and stage, but is missing "volume".',
    });
    const noSourceOrVolume = makeTransfer();
    delete noSourceOrVolume.volume;
    delete noSourceOrVolume.source;
    assert.throws(() => list.add(noSourceOrVolume), {
      message:
        'A transfer needs source, destination, volume and stage, but is missing "source", "volume".',
    });
  });

  test("a transfer without a stage gives the missing error", () => {
    const noStage = makeTransfer();
    delete noStage.stage;
    assert.throws(() => new OperationList().add(noStage), {
      message: 'A transfer needs source, destination, volume and stage, but is missing "stage".',
    });
  });

  test("extra transfer properties are all named, in the order they appear", () => {
    const list = new OperationList();
    assert.throws(() => list.add({ ...makeTransfer(), volme: 50 }), {
      message:
        'A transfer can only have type, source, destination, volume and stage, but also got "volme".',
    });
    assert.throws(() => list.add({ ...makeTransfer(), volme: 50, mix: true }), {
      message:
        'A transfer can only have type, source, destination, volume and stage, but also got "volme", "mix".',
    });
  });

  test("a source or destination that isn't an object throws the object error", () => {
    const list = new OperationList();
    assert.throws(() => list.add({ ...makeTransfer(), source: "A1" }), {
      message:
        'The source must be an object with a labware and a well, like { labware: "Plate 1", well: "A1" }, but got "A1".',
    });
    assert.throws(() => list.add({ ...makeTransfer(), destination: null }), {
      message:
        'The destination must be an object with a labware and a well, like { labware: "Plate 1", well: "A1" }, but got null.',
    });
    assert.throws(() => list.add({ ...makeTransfer(), destination: [] }), {
      message: /^The destination must be an object.*but got a list\.$/,
    });
  });

  test("a missing labware or well throws the missing error, naming both when both are missing", () => {
    const list = new OperationList();
    assert.throws(() => list.add({ ...makeTransfer(), source: {} }), {
      message: 'The source needs a labware and a well, but is missing "labware", "well".',
    });
    assert.throws(() => list.add({ ...makeTransfer(), source: { well: "A1" } }), {
      message: 'The source needs a labware and a well, but is missing "labware".',
    });
  });

  test("missing properties are checked before extra ones", () => {
    const transfer = { ...makeTransfer(), destination: { labware: "Plate 1", wel: "D4" } };
    assert.throws(() => new OperationList().add(transfer), {
      message: 'The destination needs a labware and a well, but is missing "well".',
    });
  });

  test("extra properties in a source or destination are all named, in the order they appear", () => {
    const list = new OperationList();
    const oneExtra = { ...makeTransfer(), destination: { labware: "Plate 1", well: "D4", volme: 50 } };
    assert.throws(() => list.add(oneExtra), {
      message: 'The destination can only have a labware and a well, but also got "volme".',
    });
    const twoExtras = {
      ...makeTransfer(),
      source: { labware: "Reagents", well: "A1", volme: 50, side: "left" },
    };
    assert.throws(() => list.add(twoExtras), {
      message: 'The source can only have a labware and a well, but also got "volme", "side".',
    });
  });

  test("bad labware and well values give their error, for both source and destination", () => {
    const list = new OperationList();
    for (const end of ["source", "destination"]) {
      for (const property of ["labware", "well"]) {
        // Returns a valid transfer with this end's property set to `value`.
        const withValue = (value) => {
          const transfer = makeTransfer();
          transfer[end][property] = value;
          return transfer;
        };
        const subject = `${end} ${property}`;
        const blankMessage = `The ${subject} is blank. Give it at least one character that isn't a space.`;
        assert.throws(() => list.add(withValue(5)), {
          message: `The ${subject} must be text, but got 5.`,
        });
        assert.throws(() => list.add(withValue("")), { message: blankMessage });
        assert.throws(() => list.add(withValue("   ")), { message: blankMessage });
        assert.throws(() => list.add(withValue(" Plate 1")), {
          message: `The ${subject} " Plate 1" has spaces at the start or end. Remove them.`,
        });
        assert.throws(() => list.add(withValue("Plate 1 ")), {
          message: `The ${subject} "Plate 1 " has spaces at the start or end. Remove them.`,
        });
      }
    }
  });

  test("a volume that isn't a number of 0 or more throws the volume error", () => {
    const list = new OperationList();
    const cases = [
      ["50", '"50"'],
      [NaN, "NaN"],
      [Infinity, "Infinity"],
      [-5, "-5"],
    ];
    for (const [volume, shown] of cases) {
      assert.throws(() => list.add({ ...makeTransfer(), volume }), {
        message: `The volume must be a number of microliters, 0 or more, like 50, but got ${shown}.`,
      });
    }
  });

  test("a property that comes from a class, not the object itself, counts as missing", () => {
    // Test-only classes, each with one property coming from a getter on the class, so the object
    // itself doesn't hold that property.
    class TransferWithClassVolume {
      // Sets every transfer property except volume on the object itself.
      constructor() {
        const { type, source, destination, stage } = makeTransfer();
        this.type = type;
        this.source = source;
        this.destination = destination;
        this.stage = stage;
      }

      // Returns the volume from the class, not from the object.
      get volume() {
        return 50;
      }
    }
    class TransferWithClassType {
      // Sets every transfer property except type on the object itself.
      constructor() {
        const { source, destination, volume, stage } = makeTransfer();
        this.source = source;
        this.destination = destination;
        this.volume = volume;
        this.stage = stage;
      }

      // Returns the type from the class, not from the object.
      get type() {
        return "transfer";
      }
    }
    class EndWithClassLabware {
      // Sets the well on the object itself.
      constructor() {
        this.well = "A1";
      }

      // Returns the labware from the class, not from the object.
      get labware() {
        return "Reagents";
      }
    }
    const list = new OperationList();
    assert.throws(() => list.add(new TransferWithClassVolume()), {
      message: 'A transfer needs source, destination, volume and stage, but is missing "volume".',
    });
    assert.throws(() => list.add(new TransferWithClassType()), {
      message: 'An operation needs a type, like "transfer", but got undefined.',
    });
    assert.throws(() => list.add({ ...makeTransfer(), source: new EndWithClassLabware() }), {
      message: 'The source needs a labware and a well, but is missing "labware".',
    });
  });

  test("checks run in order: a bad source is reported before a bad destination or volume", () => {
    const list = new OperationList();
    const transfer = { ...makeTransfer(), source: "A1", destination: null, volume: -5 };
    assert.throws(() => list.add(transfer), { message: /^The source must be an object/ });
    const badDestinationAndVolume = { ...makeTransfer(), destination: null, volume: -5 };
    assert.throws(() => list.add(badDestinationAndVolume), {
      message: /^The destination must be an object/,
    });
  });

  test("within an end, labware is checked fully before well", () => {
    const transfer = { ...makeTransfer(), source: { labware: " Plate 1", well: 5 } };
    assert.throws(() => new OperationList().add(transfer), {
      message: 'The source labware " Plate 1" has spaces at the start or end. Remove them.',
    });
  });

  test("a failed add() leaves the list unchanged", () => {
    const list = new OperationList().add(makeTransfer());
    assert.throws(() => list.add({ ...makeTransfer(), volume: -5 }));
    assert.deepEqual(list.listOperations(), [makeTransfer()]);
  });

  test("stage values 3, \"\" and \" 1\" give their errors", () => {
    const list = new OperationList();
    assert.throws(() => list.add(makeTransferInStage(3)), {
      message: "The stage must be text, but got 3.",
    });
    assert.throws(() => list.add(makeTransferInStage("")), {
      message: "The stage is blank. Give it at least one character that isn't a space.",
    });
    assert.throws(() => list.add(makeTransferInStage(" 1")), {
      message: 'The stage " 1" has spaces at the start or end. Remove them.',
    });
  });

  test("checks run in order: a bad volume is reported before a bad stage", () => {
    const transfer = { ...makeTransferInStage(3), volume: -5 };
    assert.throws(() => new OperationList().add(transfer), { message: /^The volume must be/ });
  });

  test("insertBeforeStage with stage 5, \"\" or \" 1\" gives the text errors", () => {
    const list = makeList(makeTransferInStage("1"));
    const transfer = makeTransferInStage("2");
    assert.throws(() => list.insertBeforeStage(transfer, 5), {
      message: "The stage to insert before must be text, but got 5.",
    });
    assert.throws(() => list.insertBeforeStage(transfer, ""), {
      message: "The stage to insert before is blank. Give it at least one character that isn't a space.",
    });
    assert.throws(() => list.insertBeforeStage(transfer, " 1"), {
      message: 'The stage to insert before " 1" has spaces at the start or end. Remove them.',
    });
  });

  test("insertBeforeStage with a stage that isn't in the list gives the not-in-list error", () => {
    const list = makeList(makeTransferInStage("1"));
    assert.throws(() => list.insertBeforeStage(makeTransferInStage("2"), "9"), {
      message: 'There\'s no stage "9" in the list to insert before.',
    });
  });

  test("insertBeforeStage with a transfer whose stage already has transfers gives the \"use add\" error", () => {
    const list = makeList(makeTransferInStage("1"), makeTransferInStage("2"));
    assert.throws(() => list.insertBeforeStage(makeTransferInStage("1"), "2"), {
      message:
        'Stage "1" already has transfers, so a transfer in it can\'t start a new stage. Use add to add it to stage "1".',
    });
  });

  test("insertBeforeStage checks the operation before its stage argument", () => {
    const list = makeList(makeTransferInStage("1"));
    assert.throws(() => list.insertBeforeStage(null, 5), {
      message: /^An operation must be an object/,
    });
  });

  test("remove with -1, 2.5, \"0\" or the number of operations gives the position error", () => {
    const list = makeList(makeTransfer(), makeTransfer(), makeTransfer());
    for (const [position, shown] of [[-1, "-1"], [2.5, "2.5"], ["0", '"0"'], [3, "3"]]) {
      assert.throws(() => list.remove(position), {
        message: `The position to remove must be a whole number from 0 to 2, but got ${shown}.`,
      });
    }
  });

  test("remove(0) on an empty list says there are no operations to remove", () => {
    assert.throws(() => new OperationList().remove(0), {
      message: "There are no operations to remove.",
    });
  });

  test("a failed insertBeforeStage() or remove() leaves the list unchanged", () => {
    const list = makeList(makeTransferInStage("1", 10), makeTransferInStage("2", 20));
    assert.throws(() => list.insertBeforeStage(makeTransferInStage("3"), "9"));
    assert.throws(() => list.remove(5));
    assert.deepEqual(volumesOf(list), [10, 20]);
  });

  test("replace with 7 on a list of five, -1, 1.5 or \"1\" gives the position error", () => {
    const list = makeList(...[10, 20, 30, 40, 50].map((volume) => makeTransferInStage("1", volume)));
    for (const [position, shown] of [[7, "7"], [-1, "-1"], [1.5, "1.5"], ["1", '"1"']]) {
      assert.throws(() => list.replace(position, makeTransfer()), {
        message: `The position to replace must be a whole number from 0 to 4, but got ${shown}.`,
      });
    }
  });

  test("replace on an empty list says there are no operations to replace, whatever the position", () => {
    for (const position of [0, 7, "1"]) {
      assert.throws(() => new OperationList().replace(position, makeTransfer()), {
        message: "There are no operations to replace.",
      });
    }
  });

  test("replace checks the position before the operation, and the operation before its stage", () => {
    const list = makeList(makeTransferInStage("1"));
    assert.throws(() => list.replace(5, null), { message: /^The position to replace must be/ });
    assert.throws(() => list.replace(0, makeTransferInStage(3)), {
      message: "The stage must be text, but got 3.",
    });
  });

  test("a failed replace() leaves the list unchanged", () => {
    const list = makeList(makeTransferInStage("1", 10), makeTransferInStage("2", 20));
    assert.throws(() => list.replace(0, makeTransferInStage("2", 99)), {
      message: /^A replacement must stay in stage "1"/,
    });
    assert.throws(() => list.replace(0, { ...makeTransferInStage("1"), volume: -5 }), {
      message: /^The volume must be/,
    });
    assert.deepEqual(volumesOf(list), [10, 20]);
  });
});
