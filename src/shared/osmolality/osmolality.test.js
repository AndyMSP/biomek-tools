// Unit tests for osmolality.js. Each test comes from the "Test cases" section of osmolality.md.
// Nothing here depends on config/.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { describeValue } from "../error-messages/error-messages.js";
import { checkOsmolality, wellOsmolality } from "./osmolality.js";

// How far a computed value may be from the expected one, in mOsm/kg: an absolute difference, since
// a relative one would allow none when the expected value is 0 (osmolality.md, section 6).
const TOLERANCE = 1e-9;

// Asserts that `result` is { value: ≈expectedValue, missing: expectedMissing }, comparing the value
// within TOLERANCE, e.g. assertResult(wellOsmolality({ A: 1 }, [{ name: "A", osmolality: 3 }]), 3, []).
function assertResult(result, expectedValue, expectedMissing) {
  assert.deepEqual(Object.keys(result), ["value", "missing"]);
  assert.deepEqual(result.missing, expectedMissing);
  if (expectedValue === null) {
    assert.equal(result.value, null);
  } else {
    assert.ok(
      Math.abs(result.value - expectedValue) <= TOLERANCE,
      `${result.value} is within ${TOLERANCE} of ${expectedValue}`,
    );
  }
}

// The message checkOsmolality gives for `value` on component `name`, e.g. expectedMessage(-5, "Media").
function expectedMessage(value, name) {
  return `The osmolality of ${name} must be a number of mOsm/kg, 0 or more, like 300, or none if it isn't known, but got ${describeValue(value)}.`;
}

describe("osmolality", () => {
  describe("checking an osmolality", () => {
    test("accepts 0, 300, 290.5 and 2800 (no upper limit), and null", () => {
      for (const value of [0, 300, 290.5, 2800, null]) {
        assert.equal(checkOsmolality(value, "Media"), undefined);
      }
    });

    test("refuses negative numbers, text, NaN, infinities, undefined, objects and lists", () => {
      const refused = [-5, -0.1, "300", "ten", NaN, Infinity, -Infinity, undefined, {}, []];
      for (const value of refused) {
        assert.throws(() => checkOsmolality(value, "Media"), {
          message: expectedMessage(value, "Media"),
        });
      }
    });

    test("names the component as given", () => {
      assert.throws(() => checkOsmolality(-5, "Buffer B"), {
        message: expectedMessage(-5, "Buffer B"),
      });
      assert.throws(() => checkOsmolality("ten", "Media"), {
        message:
          'The osmolality of Media must be a number of mOsm/kg, 0 or more, like 300, or none if it isn\'t known, but got "ten".',
      });
    });
  });

  describe("a well's osmolality", () => {
    test("one component at share 1 gives its osmolality", () => {
      assertResult(wellOsmolality({ Media: 1 }, [{ name: "Media", osmolality: 300 }]), 300, []);
    });

    test("90% Media at 300 and 10% Water at 0 give 270; Water at 0 isn't missing", () => {
      const components = [
        { name: "Media", osmolality: 300 },
        { name: "Water", osmolality: 0 },
      ];
      assertResult(wellOsmolality({ Media: 0.9, Water: 0.1 }, components), 270, []);
    });

    test("a well of only Water at 0 gives a value of 0, not null", () => {
      const result = wellOsmolality({ Water: 1 }, [{ name: "Water", osmolality: 0 }]);
      assert.deepEqual(result, { value: 0, missing: [] });
    });

    test("three components with values add up", () => {
      const components = [
        { name: "A", osmolality: 300 },
        { name: "B", osmolality: 600 },
        { name: "C", osmolality: 0 },
      ];
      assertResult(wellOsmolality({ A: 0.5, B: 0.25, C: 0.25 }, components), 300, []);
    });

    test("a held component without a value gives null and is listed", () => {
      const components = [
        { name: "Media", osmolality: 300 },
        { name: "Buffer B", osmolality: null },
      ];
      assertResult(wellOsmolality({ Media: 0.9, "Buffer B": 0.1 }, components), null, [
        "Buffer B",
      ]);
    });

    test("two without values are listed in the order of components, not of the shares", () => {
      const components = [
        { name: "Media", osmolality: null },
        { name: "Buffer B", osmolality: 300 },
        { name: "Drug stock", osmolality: null },
      ];
      const shares = { "Drug stock": 0.2, "Buffer B": 0.3, Media: 0.5 };
      assertResult(wellOsmolality(shares, components), null, ["Media", "Drug stock"]);
    });

    test("a component with no osmolality property counts as having none", () => {
      const components = [{ name: "Media", osmolality: 300 }, { name: "Dye" }];
      assertResult(wellOsmolality({ Media: 0.5, Dye: 0.5 }, components), null, ["Dye"]);
    });

    test("a component without a value that the well doesn't hold isn't listed", () => {
      const components = [
        { name: "Media", osmolality: 300 },
        { name: "Buffer B", osmolality: null },
        { name: "Drug stock", osmolality: null },
      ];
      assertResult(wellOsmolality({ Media: 1, "Drug stock": 0 }, components), 300, []);
    });

    test("a held share that isn't a component is listed after the components", () => {
      const components = [
        { name: "Media", osmolality: 300 },
        { name: "Buffer B", osmolality: null },
      ];
      const shares = { Ghost: 0.1, Media: 0.5, "Buffer B": 0.2, Other: 0.2 };
      assertResult(wellOsmolality(shares, components), null, ["Buffer B", "Ghost", "Other"]);
      assertResult(wellOsmolality({ Ghost: 1 }, components), null, ["Ghost"]);
    });

    test("a well with no shares gives no value and nothing missing", () => {
      assert.deepEqual(wellOsmolality({}, [{ name: "Media", osmolality: 300 }]), {
        value: null,
        missing: [],
      });
    });

    test("a component named like an object's built-in property is treated like any other", () => {
      const components = [
        { name: "Media", osmolality: 300 },
        { name: "constructor", osmolality: 0 },
        { name: "toString", osmolality: null },
      ];
      assertResult(wellOsmolality({ Media: 1 }, components), 300, []);
      assertResult(wellOsmolality({ Media: 0.5, constructor: 0.5 }, components), 150, []);
    });

    test("the inputs aren't changed, and each call gives a new missing list", () => {
      const shares = { Media: 0.5, Water: 0.5 };
      const components = [
        { name: "Media", osmolality: 300 },
        { name: "Water", osmolality: null },
      ];
      const sharesCopy = structuredClone(shares);
      const componentsCopy = structuredClone(components);
      const first = wellOsmolality(shares, components);
      const second = wellOsmolality(shares, components);
      assert.deepEqual(shares, sharesCopy);
      assert.deepEqual(components, componentsCopy);
      assert.notEqual(first, second);
      assert.notEqual(first.missing, second.missing);
      assert.deepEqual(first, second);
    });
  });
});
