// random-pool.js — spreads replicates of several items over a pool of wells at random, with a seed,
// so the same pool and seed always give the same assignment, on any computer.
//
// It's the randomizing logic shared by the randomizer (whose one plate's open wells are a pool) and
// the transfer designer's randomizations (whose wells to fill, on any number of plates, are a pool),
// so there is one copy of it (ADR 0012). It knows nothing about plates, grids or what an item is:
// an item and a well are each any text naming it uniquely, such as "Plate1 A1".
// Specification: random-pool.md.

import { describeValue } from "../error-messages/error-messages.js";
import {
  isObject,
  findMissingProperties,
  findExtraProperties,
  checkName,
} from "../input-checks/input-checks.js";
import { SeededRandom } from "../random/random.js";

// The range of seeds allowed (section 3, "Seeds"), the same as the randomizer's.
const SMALLEST_SEED = 1;
const LARGEST_SEED = 999999;

// The two types an assigned well can have (section 3, "Assignment").
const REPLICATE = "replicate";
const FILLER = "filler";

// The properties a pool and each of its items have, exactly.
const POOL_PROPERTIES = ["items", "filler", "wells", "seed"];
const ITEM_PROPERTIES = ["key", "replicates"];

// --- Problems ---

// Every problem with the pool, as objects with a `kind`, in the order of section 3's table, or []
// if there are none, e.g. [{ kind: "too-many", needed: 64, available: 60 }].
// Throws if the pool is badly formed (section 5).
export function findPoolProblems(pool) {
  checkPool(pool);
  return [...itemProblems(pool), ...wellCountProblems(pool), ...seedProblems(pool.seed)];
}

// The problems with each item's replicates, item by item, in `items`' order. The filler's
// replicates are ignored, e.g. [{ kind: "replicates-missing", key: "A", index: 0 }].
function itemProblems({ items, filler }) {
  const problems = [];
  items.forEach(({ key, replicates }, index) => {
    if (key === filler) {
      return;
    }
    if (isMissing(replicates)) {
      problems.push({ kind: "replicates-missing", key, index });
    } else if (!isValidReplicateCount(replicates)) {
      problems.push({ kind: "replicates-invalid", key, index, value: replicates });
    }
  });
  return problems;
}

// The problem with the number of wells, if any: too few for the replicates, or spare wells with no
// filler. Checked only when every item's replicates are valid, since until then the number of
// replicates needed isn't known.
function wellCountProblems(pool) {
  if (!allReplicatesValid(pool)) {
    return [];
  }
  const needed = totalReplicates(pool);
  const available = pool.wells.length;
  if (needed > available) {
    return [{ kind: "too-many", needed, available }];
  }
  const spare = available - needed;
  if (spare > 0 && pool.filler === null) {
    return [{ kind: "spare-without-filler", spare }];
  }
  return [];
}

// The problem with the seed, if any: it must be there, and be a whole number from 1 to 999,999.
function seedProblems(seed) {
  if (isMissing(seed)) {
    return [{ kind: "seed-missing" }];
  }
  if (Number.isInteger(seed) && seed >= SMALLEST_SEED && seed <= LARGEST_SEED) {
    return [];
  }
  return [{ kind: "seed-invalid", value: seed }];
}

// --- Assignment ---

// The assignment (section 3): each well, in `wells`' order, with the key of the item it gets and
// whether it's a replicate or the filler, e.g. [{ well: "Plate1 B2", key: "Deep A1", type: "replicate" }, …].
// Throws if the pool is badly formed or has any problem. The pool is never changed.
export function assignPool(pool) {
  const problems = findPoolProblems(pool);
  if (problems.length > 0) {
    throw new Error(
      `The pool can't be assigned: it has problems, such as ${describeValue(problems[0].kind)}. ` +
        "Check findPoolProblems first.",
    );
  }
  const shuffledItems = new SeededRandom(pool.seed).shuffled(itemsToPlace(pool));
  return pool.wells.map((well, index) => ({ well, ...shuffledItems[index] }));
}

// The items to place, before shuffling: each item other than the filler repeated by its
// replicates, in `items`' order, then the filler once for each spare well,
// e.g. 2 replicates of "A" in 3 wells, filler "F" → A, A, F.
function itemsToPlace(pool) {
  const placed = [];
  for (const { key, replicates } of replicateItems(pool)) {
    for (let copy = 1; copy <= replicates; copy++) {
      placed.push({ key, type: REPLICATE });
    }
  }
  const spare = pool.wells.length - placed.length;
  for (let copy = 1; copy <= spare; copy++) {
    placed.push({ key: pool.filler, type: FILLER });
  }
  return placed;
}

// --- Spare wells and seeds ---

// The number of spare wells: the wells minus the replicates, 0 if the replicates don't fit, or
// null while any item's replicates aren't valid, e.g. 60 wells and 40 replicates → 20.
// Throws if the pool is badly formed.
export function spareWellCount(pool) {
  checkPool(pool);
  if (!allReplicatesValid(pool)) {
    return null;
  }
  return Math.max(pool.wells.length - totalReplicates(pool), 0);
}

// A seed from 1 to 999,999 made from a random number from 0 up to (not including) 1, such as
// Math.random() gives, e.g. randomSeed(0) → 1, randomSeed(0.5) → 500000.
// It's given the random number rather than calling Math.random() itself, so it can be tested.
export function randomSeed(randomNumber) {
  if (typeof randomNumber !== "number" || !(randomNumber >= 0 && randomNumber < 1)) {
    throw new Error(
      "randomSeed needs a number from 0 up to 1, like Math.random() gives, " +
        `but got ${describeValue(randomNumber)}.`,
    );
  }
  const seedCount = LARGEST_SEED - SMALLEST_SEED + 1;
  return Math.floor(randomNumber * seedCount) + SMALLEST_SEED;
}

// --- Checking the pool's form ---

// Throws the first way the pool is badly formed (section 5, in the table's order).
function checkPool(pool) {
  checkPoolShape(pool);
  pool.items.forEach(checkItem);
  checkItemKeysUnique(pool.items);
  checkFiller(pool);
  checkWells(pool.wells);
}

// Throws if the pool isn't an object with exactly its four properties, or `items` or `wells`
// isn't a list.
function checkPoolShape(pool) {
  if (
    !isObject(pool) ||
    findMissingProperties(pool, POOL_PROPERTIES).length > 0 ||
    findExtraProperties(pool, POOL_PROPERTIES).length > 0
  ) {
    throw new Error(
      'The pool must be an object with "items", "filler", "wells" and "seed", ' +
        `but got ${describeValue(pool)}.`,
    );
  }
  for (const property of ["items", "wells"]) {
    if (!Array.isArray(pool[property])) {
      throw new Error(
        `The pool's ${describeValue(property)} must be a list, but got ${describeValue(pool[property])}.`,
      );
    }
  }
}

// Throws if an item isn't an object with exactly a `key` that's a name and a `replicates`
// property (whose value may be anything). `index` counts from 0; the message counts from 1.
function checkItem(item, index) {
  const message =
    `Pool item ${index + 1} must be an object with exactly a "key" that's a name, and "replicates".`;
  if (
    !isObject(item) ||
    findMissingProperties(item, ITEM_PROPERTIES).length > 0 ||
    findExtraProperties(item, ITEM_PROPERTIES).length > 0 ||
    !isName(item.key)
  ) {
    throw new Error(message);
  }
}

// Throws if two items share a key, naming the first such pair.
function checkItemKeysUnique(items) {
  const firstIndexByKey = new Map();
  items.forEach(({ key }, index) => {
    if (firstIndexByKey.has(key)) {
      throw new Error(
        `Pool items ${firstIndexByKey.get(key) + 1} and ${index + 1} both have the key ` +
          `${describeValue(key)}.`,
      );
    }
    firstIndexByKey.set(key, index);
  });
}

// Throws if the filler isn't null or one of the items' keys.
function checkFiller({ items, filler }) {
  if (filler !== null && !items.some(({ key }) => key === filler)) {
    throw new Error(`The filler ${describeValue(filler)} isn't one of the pool's items.`);
  }
}

// Throws if a well isn't a name, or is listed twice.
function checkWells(wells) {
  const firstIndexByWell = new Map();
  wells.forEach((well, index) => {
    if (!isName(well)) {
      throw new Error(`Pool well ${index + 1} must be a name, but got ${describeValue(well)}.`);
    }
    if (firstIndexByWell.has(well)) {
      throw new Error(
        `Pool wells ${firstIndexByWell.get(well) + 1} and ${index + 1} are both ${describeValue(well)}.`,
      );
    }
    firstIndexByWell.set(well, index);
  });
}

// --- Small helpers ---

// True if `value` passes input-checks' checkName (text, not blank, no spaces at its ends).
function isName(value) {
  try {
    checkName(value, "name");
    return true;
  } catch {
    return false;
  }
}

// The items whose replicates are placed: every item but the filler, in `items`' order.
function replicateItems({ items, filler }) {
  return items.filter(({ key }) => key !== filler);
}

// True if every item other than the filler has a valid replicate count.
function allReplicatesValid(pool) {
  return replicateItems(pool).every(({ replicates }) => isValidReplicateCount(replicates));
}

// The total replicates of every item other than the filler, e.g. 12 items × 4 → 48.
function totalReplicates(pool) {
  return replicateItems(pool).reduce((total, { replicates }) => total + replicates, 0);
}

// True if a replicate count or seed is missing: "", text of only spaces, undefined or null,
// e.g. isMissing("  ") → true, isMissing(0) → false.
function isMissing(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

// True if a replicate count is a whole number of at least 1, e.g. 4 → true; 0, 1.5, "four" → false.
function isValidReplicateCount(replicates) {
  return Number.isInteger(replicates) && replicates >= 1;
}
