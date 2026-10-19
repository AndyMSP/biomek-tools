// Unit tests for paste.js. Each test comes from the "Test cases" section of paste.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseConditionRows, replicatesFromText } from "./paste.js";

describe("paste", () => {
  test("rows copied from Excel become condition rows", () => {
    assert.deepEqual(parseConditionRows("Condition 1\t4\r\nCondition 2\t4\r\n"), [
      { name: "Condition 1", replicates: 4 },
      { name: "Condition 2", replicates: 4 },
    ]);
  });

  test("blank lines are skipped, and a line with only a name gets empty replicates", () => {
    assert.deepEqual(parseConditionRows("\nCondition 1\n\n"), [{ name: "Condition 1", replicates: "" }]);
  });

  test("only digits become a number", () => {
    assert.equal(replicatesFromText(" 12 "), 12);
    assert.equal(replicatesFromText("four"), "four");
    assert.equal(replicatesFromText("1.5"), "1.5");
  });

  test("a pasted header row is kept as an ordinary row", () => {
    assert.deepEqual(parseConditionRows("Name\tReplicates\nCondition 1\t4"), [
      { name: "Name", replicates: "Replicates" },
      { name: "Condition 1", replicates: 4 },
    ]);
  });
});
