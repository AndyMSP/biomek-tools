// Unit tests for error-messages.js. Each test comes from the "Test cases" section of error-messages.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { describeValue } from "./error-messages.js";

// --- describeValue(value) ---

test("describeValue() shows text in double quotes", () => {
  assert.equal(describeValue("37"), '"37"');
  assert.equal(describeValue("ABCD"), '"ABCD"');
  assert.equal(describeValue(""), '""');
});

test("describeValue() shows numbers as they are", () => {
  assert.equal(describeValue(37), "37");
  assert.equal(describeValue(2.5), "2.5");
  assert.equal(describeValue(-1), "-1");
});

test("describeValue() shows other values as they are", () => {
  assert.equal(describeValue(null), "null");
  assert.equal(describeValue(undefined), "undefined");
  assert.equal(describeValue(true), "true");
});
