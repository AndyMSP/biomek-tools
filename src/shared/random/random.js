// random.js — repeatable random numbers, and shuffling with them.
//
// A SeededRandom gives the same sequence of numbers for the same seed, in any browser and in Node,
// so a recorded seed always reproduces the same result. It knows nothing about plates or experiments.
// Not suitable for security uses such as passwords or keys.
// Specification: random.md. Design: docs/adr/0003-mulberry32-random-generator.md.

import { describeValue } from "../error-messages/error-messages.js";

// The constants below are part of the mulberry32 algorithm, not settings, so they live here rather
// than in config/. They must never change: ADR 0003 explains why.

// The largest seed: the largest 32-bit whole number.
const LARGEST_SEED = 4294967295;

// mulberry32's step: added to the state on every call to next().
const STATE_STEP = 0x6d2b79f5;

// The number of different 32-bit values (2 to the power 32). Dividing a 32-bit whole number by this
// gives a number from 0 up to (not including) 1.
const NUMBER_OF_32_BIT_VALUES = 4294967296;

export class SeededRandom {
  // The number the generator is currently holding. It starts as the seed, and each next() changes
  // it. It's private, so a generator can't be moved to a different point in its sequence.
  #state;

  // Creates a generator from a seed, e.g. new SeededRandom(37).
  // Throws if the seed is not a whole number from 0 to 4,294,967,295.
  constructor(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > LARGEST_SEED) {
      throw new Error(
        `The seed must be a whole number from 0 to 4,294,967,295, but got ${describeValue(seed)}.`,
      );
    }
    this.#state = seed;
  }

  // Advances the generator one step and returns a number from 0 up to (not including) 1,
  // e.g. the first number from seed 37 is 0.5163109616842121.
  // This is the standard published mulberry32, except that the state is wrapped to 32 bits with
  // `| 0`. Without it, the stored number grows on every call and, after about 4.9 million calls,
  // becomes too large for JavaScript to store exactly, so the outputs go wrong.
  // The lines below must produce exactly the outputs pinned down by the tests: don't "tidy" them.
  next() {
    this.#state = (this.#state + STATE_STEP) | 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / NUMBER_OF_32_BIT_VALUES;
  }

  // Returns a new list with the same items in a random order, e.g. with seed 37,
  // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] → [4, 7, 5, 8, 3, 2, 10, 1, 9, 6]. The list passed in is not changed.
  // Uses the Fisher–Yates shuffle, from the last position down to the second. The direction is part
  // of the specification, because it decides which random number goes with which position.
  // A list of n items uses exactly n − 1 calls to next().
  shuffled(list) {
    if (!Array.isArray(list)) {
      throw new Error(`shuffled needs a list (an array), but got ${describeValue(list)}.`);
    }
    const copy = [...list];
    for (let i = copy.length - 1; i >= 1; i--) {
      const j = this.#randomIndex(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Private methods (# names, like #state above): only code inside this class can call them.

  // Returns a whole number from 0 to count − 1, using one call to next(),
  // e.g. #randomIndex(10) → one of 0, 1 … 9.
  #randomIndex(count) {
    return Math.floor(this.next() * count);
  }
}
