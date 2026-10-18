// Unit tests for random.js. Each test comes from the "Test cases" section of random.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { SeededRandom } from "./random.js";

// Returns the next `count` numbers from a generator, e.g. takeNumbers(generator, 3) → [0.51…, 0.99…, 0.02…].
function takeNumbers(generator, count) {
  const numbers = [];
  for (let i = 0; i < count; i++) {
    numbers.push(generator.next());
  }
  return numbers;
}

describe("random", () => {
  // --- next() ---

  test("next() gives the reference values for seeds 0, 1 and 37", () => {
    assert.deepEqual(takeNumbers(new SeededRandom(0), 3), [
      0.26642920868471265, 0.0003297457005828619, 0.2232720274478197,
    ]);
    assert.deepEqual(takeNumbers(new SeededRandom(1), 3), [
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
    assert.deepEqual(takeNumbers(new SeededRandom(37), 3), [
      0.5163109616842121, 0.9970917752943933, 0.026310910237953067,
    ]);
  });

  test("next() always gives a number from 0 up to (not including) 1", () => {
    for (const number of takeNumbers(new SeededRandom(37), 1000)) {
      assert.ok(number >= 0 && number < 1, `${number} is out of range`);
    }
  });

  test("two generators with the same seed give the same numbers", () => {
    assert.deepEqual(takeNumbers(new SeededRandom(37), 1000), takeNumbers(new SeededRandom(37), 1000));
  });

  test("the largest seed, 4294967295, works", () => {
    const number = new SeededRandom(4294967295).next();
    assert.ok(number >= 0 && number < 1, `${number} is out of range`);
  });

  test("numbers stay exact after 5,000,000 calls", () => {
    const generator = new SeededRandom(37);
    for (let i = 0; i < 5_000_000; i++) {
      generator.next();
    }
    assert.equal(generator.next(), 0.24837870616465807);
  });

  // --- shuffled(list) ---

  test("shuffled() gives the reference order for seed 37", () => {
    const order = new SeededRandom(37).shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(order, [4, 7, 5, 8, 3, 2, 10, 1, 9, 6]);
  });

  test("shuffled() keeps exactly the same items, none lost or duplicated", () => {
    const list = ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"];
    const order = new SeededRandom(37).shuffled(list);
    assert.deepEqual([...order].sort(), [...list].sort());
  });

  test("shuffled() leaves the original list unchanged", () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    new SeededRandom(37).shuffled(list);
    assert.deepEqual(list, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test("shuffled() handles empty and one-item lists", () => {
    assert.deepEqual(new SeededRandom(37).shuffled([]), []);
    assert.deepEqual(new SeededRandom(37).shuffled(["A"]), ["A"]);
  });

  test("shuffling 10 items uses exactly 9 numbers", () => {
    const generator = new SeededRandom(37);
    generator.shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const tenthNumber = takeNumbers(new SeededRandom(37), 10)[9];
    assert.equal(generator.next(), tenthNumber);
  });

  // --- Errors ---

  test("invalid seeds throw the seed error", () => {
    assert.throws(() => new SeededRandom(-1), {
      message: "The seed must be a whole number from 0 to 4,294,967,295, but got -1.",
    });
    assert.throws(() => new SeededRandom(2.5), {
      message: "The seed must be a whole number from 0 to 4,294,967,295, but got 2.5.",
    });
    assert.throws(() => new SeededRandom("37"), {
      message: 'The seed must be a whole number from 0 to 4,294,967,295, but got "37".',
    });
    assert.throws(() => new SeededRandom(4294967296), {
      message: "The seed must be a whole number from 0 to 4,294,967,295, but got 4294967296.",
    });
  });

  test("shuffled() throws the list error for anything that isn't a list", () => {
    assert.throws(() => new SeededRandom(37).shuffled("ABCD"), {
      message: 'shuffled needs a list (an array), but got "ABCD".',
    });
    assert.throws(() => new SeededRandom(37).shuffled(null), {
      message: "shuffled needs a list (an array), but got null.",
    });
  });
});
