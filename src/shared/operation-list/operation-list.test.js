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
  };
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
      message: 'A transfer needs source, destination and volume, but is missing "volume".',
    });
    const noSourceOrVolume = makeTransfer();
    delete noSourceOrVolume.volume;
    delete noSourceOrVolume.source;
    assert.throws(() => list.add(noSourceOrVolume), {
      message: 'A transfer needs source, destination and volume, but is missing "source", "volume".',
    });
  });

  test("extra transfer properties are all named, in the order they appear", () => {
    const list = new OperationList();
    assert.throws(() => list.add({ ...makeTransfer(), volme: 50 }), {
      message:
        'A transfer can only have type, source, destination and volume, but also got "volme".',
    });
    assert.throws(() => list.add({ ...makeTransfer(), volme: 50, mix: true }), {
      message:
        'A transfer can only have type, source, destination and volume, but also got "volme", "mix".',
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
        const { type, source, destination } = makeTransfer();
        this.type = type;
        this.source = source;
        this.destination = destination;
      }

      // Returns the volume from the class, not from the object.
      get volume() {
        return 50;
      }
    }
    class TransferWithClassType {
      // Sets every transfer property except type on the object itself.
      constructor() {
        const { source, destination, volume } = makeTransfer();
        this.source = source;
        this.destination = destination;
        this.volume = volume;
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
      message: 'A transfer needs source, destination and volume, but is missing "volume".',
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
});
