// Unit tests for input-checks.js. Each test comes from the "Test cases" section of
// input-checks.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  isObject,
  findMissingProperties,
  findExtraProperties,
  listNames,
  checkName,
  checkVolume,
} from "./input-checks.js";

describe("input-checks", () => {
  // --- isObject ---

  test("isObject: {} and { well: \"A1\" } are objects", () => {
    assert.equal(isObject({}), true);
    assert.equal(isObject({ well: "A1" }), true);
  });

  test("isObject: null, lists, text, numbers and undefined aren't objects", () => {
    for (const value of [null, [], ["A1"], "A1", 5, undefined]) {
      assert.equal(isObject(value), false, String(value));
    }
  });

  // --- findMissingProperties ---

  test("findMissingProperties: nothing missing gives an empty list", () => {
    assert.deepEqual(
      findMissingProperties({ labware: "Plate 1", well: "A1" }, ["labware", "well"]),
      [],
    );
  });

  test("findMissingProperties: one missing gives that name", () => {
    assert.deepEqual(findMissingProperties({ well: "A1" }, ["labware", "well"]), ["labware"]);
  });

  test("findMissingProperties: several missing gives all of them, in the order of required", () => {
    assert.deepEqual(
      findMissingProperties({ type: "transfer" }, ["source", "destination", "volume"]),
      ["source", "destination", "volume"],
    );
  });

  test("findMissingProperties: a property from a class (a getter) counts as missing", () => {
    // Defines a class whose instances get `well` from a getter, not as their own property.
    class EndWithGetter {
      // Gives every instance the well "A1", through the class rather than the object itself.
      get well() {
        return "A1";
      }
    }
    const end = new EndWithGetter();
    assert.equal(end.well, "A1");
    assert.deepEqual(findMissingProperties(end, ["well"]), ["well"]);
  });

  // --- findExtraProperties ---

  test("findExtraProperties: no extras gives an empty list", () => {
    assert.deepEqual(
      findExtraProperties({ labware: "Plate 1", well: "D4" }, ["labware", "well"]),
      [],
    );
  });

  test("findExtraProperties: one extra gives that name", () => {
    assert.deepEqual(
      findExtraProperties({ labware: "Plate 1", wel: "D4" }, ["labware", "well"]),
      ["wel"],
    );
  });

  test("findExtraProperties: several extras gives all of them, in the order they appear in the object", () => {
    assert.deepEqual(
      findExtraProperties({ zeta: 1, labware: "Plate 1", alpha: 2, well: "D4" }, ["labware", "well"]),
      ["zeta", "alpha"],
    );
  });

  // --- listNames ---

  test("listNames: one name is shown in quotes", () => {
    assert.equal(listNames(["volume"]), '"volume"');
  });

  test("listNames: several names are shown in quotes, separated by commas", () => {
    assert.equal(listNames(["source", "volume"]), '"source", "volume"');
  });

  // --- checkName ---

  test("checkName: \"Plate 1\" and \"A1\" don't throw", () => {
    assert.doesNotThrow(() => checkName("Plate 1", "source labware"));
    assert.doesNotThrow(() => checkName("A1", "source well"));
  });

  test("checkName: 5, undefined and null give the not-text error", () => {
    for (const [name, shown] of [[5, "5"], [undefined, "undefined"], [null, "null"]]) {
      assert.throws(() => checkName(name, "source labware"), {
        message: `The source labware must be text, but got ${shown}.`,
      });
    }
  });

  test("checkName: \"\", only spaces and a tab alone give the blank error", () => {
    for (const name of ["", "   ", "\t"]) {
      assert.throws(() => checkName(name, "destination well"), {
        message: "The destination well is blank. Give it at least one character that isn't a space.",
      });
    }
  });

  test("checkName: whitespace at the start or end gives the whitespace error", () => {
    for (const name of [" Plate 1", "Plate 1 ", "A1\n"]) {
      assert.throws(() => checkName(name, "source labware"), {
        message: `The source labware "${name}" has spaces at the start or end. Remove them.`,
      });
    }
  });

  test("checkName: the message uses the subject given", () => {
    assert.throws(() => checkName(5, "labware in starting contents entry 2"), {
      message: "The labware in starting contents entry 2 must be text, but got 5.",
    });
  });

  // --- checkVolume ---

  test("checkVolume: 0, 50 and 2.5 don't throw", () => {
    for (const volume of [0, 50, 2.5]) {
      assert.doesNotThrow(() => checkVolume(volume, "volume"), String(volume));
    }
  });

  test("checkVolume: -5, \"50\", NaN, Infinity and undefined give the volume error", () => {
    for (const [volume, shown] of [
      [-5, "-5"],
      ["50", '"50"'],
      [NaN, "NaN"],
      [Infinity, "Infinity"],
      [undefined, "undefined"],
    ]) {
      assert.throws(() => checkVolume(volume, "volume"), {
        message: `The volume must be a number of microliters, 0 or more, like 50, but got ${shown}.`,
      });
    }
  });

  test("checkVolume: the message uses the subject given", () => {
    assert.throws(() => checkVolume(-5, 'volume of "Dye" in starting contents entry 2'), {
      message:
        'The volume of "Dye" in starting contents entry 2 must be a number of microliters, 0 or more, like 50, but got -5.',
    });
  });
});
