import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GRID_96 } from "../well-grid/well-grid.js";
import { findPoolProblems, assignPool, spareWellCount, randomSeed } from "./random-pool.js";
import { goldenFileUrl } from "../../../tests/fixtures/randomizer-golden-setups.js";

// A pool of `wellCount` wells "W1", "W2" …, the given items and filler, and a seed,
// e.g. poolOf([{ key: "A", replicates: 2 }], null, 2).
function poolOf(items, filler, wellCount, ...seedGiven) {
  // A seed passed as undefined is kept as undefined (a missing seed), so no default parameter.
  const seed = seedGiven.length > 0 ? seedGiven[0] : 37;
  const wells = [];
  for (let number = 1; number <= wellCount; number++) {
    wells.push(`W${number}`);
  }
  return { items, filler, wells, seed };
}

// How many wells of an assignment each key gets, e.g. Map { "A" → 4, "F" → 2 }.
function countsByKey(assignment) {
  const counts = new Map();
  for (const { key } of assignment) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// A deep copy of a pool, to check later that the pool passed in wasn't changed.
function copyOf(pool) {
  return JSON.parse(JSON.stringify(pool));
}

describe("random-pool", () => {
  // --- The randomizer's main example ---

  test("the randomizer's main example matches its golden file well for well", () => {
    const golden = JSON.parse(readFileSync(goldenFileUrl("randomizer-main-seed-37.json"), "utf8"));
    const openWells = GRID_96.wellNames().filter((well) => !GRID_96.isEdgeWell(well));
    const items = [];
    for (let number = 1; number <= 12; number++) {
      items.push({ key: `Condition ${number}`, replicates: 4 });
    }
    items.push({ key: "Spare", replicates: null });
    const assignment = assignPool({ items, filler: "Spare", wells: openWells, seed: 37 });
    const expected = golden
      .filter(({ type }) => type !== "fixed")
      .map(({ well, contents, type }) => ({ well, key: contents, type }));
    assert.deepEqual(assignment, expected);
  });

  // --- Two plates ---

  test("two plates: each item gets its replicates, the filler the spare wells, every well one item", () => {
    const wells = [];
    for (const plate of ["P1", "P2"]) {
      for (const well of GRID_96.wellNames().slice(0, 30)) {
        wells.push(`${plate} ${well}`);
      }
    }
    const pool = {
      items: [
        { key: "A", replicates: 4 },
        { key: "B", replicates: 4 },
        { key: "C", replicates: 2 },
        { key: "F", replicates: null },
      ],
      filler: "F",
      wells,
      seed: 37,
    };
    const assignment = assignPool(pool);
    assert.deepEqual(
      assignment.map(({ well }) => well),
      wells,
    );
    const counts = countsByKey(assignment);
    assert.equal(counts.get("A"), 4);
    assert.equal(counts.get("B"), 4);
    assert.equal(counts.get("C"), 2);
    assert.equal(counts.get("F"), 50);
    for (const { key, type } of assignment) {
      assert.equal(type, key === "F" ? "filler" : "replicate");
    }
    assert.deepEqual(assignPool(pool), assignment);
    assert.notDeepEqual(assignPool({ ...pool, seed: 38 }), assignment);
  });

  // --- Exact fit, no replicates, no wells ---

  test("an exact fit with a filler gives the filler no wells", () => {
    const pool = poolOf(
      [
        { key: "A", replicates: 3 },
        { key: "F", replicates: null },
      ],
      "F",
      3,
    );
    assert.deepEqual(findPoolProblems(pool), []);
    const counts = countsByKey(assignPool(pool));
    assert.equal(counts.get("A"), 3);
    assert.equal(counts.has("F"), false);
  });

  test("an exact fit without a filler isn't a problem", () => {
    const pool = poolOf([{ key: "A", replicates: 3 }], null, 3);
    assert.deepEqual(findPoolProblems(pool), []);
    assert.equal(assignPool(pool).length, 3);
  });

  test("only the filler gives every well the filler", () => {
    const pool = poolOf([{ key: "F", replicates: null }], "F", 10);
    assert.deepEqual(findPoolProblems(pool), []);
    const assignment = assignPool(pool);
    assert.equal(assignment.length, 10);
    assert.ok(assignment.every(({ key, type }) => key === "F" && type === "filler"));
  });

  test("no wells gives an empty assignment, and isn't a problem", () => {
    const pool = poolOf([], null, 0);
    assert.deepEqual(findPoolProblems(pool), []);
    assert.deepEqual(assignPool(pool), []);
  });

  test("the filler's place in items doesn't matter", () => {
    const first = poolOf(
      [
        { key: "F", replicates: null },
        { key: "A", replicates: 2 },
        { key: "B", replicates: 3 },
      ],
      "F",
      10,
    );
    const last = { ...first, items: [first.items[1], first.items[2], first.items[0]] };
    assert.deepEqual(assignPool(first), assignPool(last));
  });

  // --- Problems ---

  test("each kind of problem, with its properties", () => {
    assert.deepEqual(findPoolProblems(poolOf([{ key: "A", replicates: null }], null, 4)), [
      { kind: "replicates-missing", key: "A", index: 0 },
    ]);
    assert.deepEqual(findPoolProblems(poolOf([{ key: "A", replicates: "four" }], null, 4)), [
      { kind: "replicates-invalid", key: "A", index: 0, value: "four" },
    ]);
    assert.deepEqual(findPoolProblems(poolOf([{ key: "A", replicates: 64 }], null, 60)), [
      { kind: "too-many", needed: 64, available: 60 },
    ]);
    assert.deepEqual(findPoolProblems(poolOf([{ key: "A", replicates: 48 }], null, 60)), [
      { kind: "spare-without-filler", spare: 12 },
    ]);
    assert.deepEqual(findPoolProblems(poolOf([{ key: "A", replicates: 4 }], null, 4, null)), [
      { kind: "seed-missing" },
    ]);
    assert.deepEqual(findPoolProblems(poolOf([{ key: "A", replicates: 4 }], null, 4, 0)), [
      { kind: "seed-invalid", value: 0 },
    ]);
  });

  test("missing replicates and seeds include empty text, spaces and undefined", () => {
    for (const value of ["", "   ", undefined, null]) {
      assert.deepEqual(findPoolProblems(poolOf([{ key: "A", replicates: value }], null, 1)), [
        { kind: "replicates-missing", key: "A", index: 0 },
      ]);
      assert.deepEqual(findPoolProblems(poolOf([{ key: "A", replicates: 1 }], null, 1, value)), [
        { kind: "seed-missing" },
      ]);
    }
  });

  test("invalid replicates and seeds", () => {
    for (const value of [0, -1, 1.5, "4"]) {
      assert.deepEqual(findPoolProblems(poolOf([{ key: "A", replicates: value }], null, 1)), [
        { kind: "replicates-invalid", key: "A", index: 0, value },
      ]);
    }
    for (const value of [1000000, 1.5, "37"]) {
      assert.deepEqual(findPoolProblems(poolOf([{ key: "A", replicates: 1 }], null, 1, value)), [
        { kind: "seed-invalid", value },
      ]);
    }
  });

  test("several problems come in order, item by item", () => {
    const pool = poolOf(
      [
        { key: "A", replicates: 2 },
        { key: "B", replicates: "x" },
        { key: "C", replicates: null },
      ],
      null,
      4,
      null,
    );
    assert.deepEqual(findPoolProblems(pool), [
      { kind: "replicates-invalid", key: "B", index: 1, value: "x" },
      { kind: "replicates-missing", key: "C", index: 2 },
      { kind: "seed-missing" },
    ]);
  });

  test('"too-many" isn\'t reported while an item\'s replicates are missing', () => {
    const pool = poolOf(
      [
        { key: "A", replicates: 100 },
        { key: "B", replicates: null },
      ],
      null,
      4,
    );
    assert.deepEqual(findPoolProblems(pool), [{ kind: "replicates-missing", key: "B", index: 1 }]);
  });

  test("the filler's replicates are never checked", () => {
    const pool = poolOf(
      [
        { key: "A", replicates: 2 },
        { key: "F", replicates: "nonsense" },
      ],
      "F",
      4,
    );
    assert.deepEqual(findPoolProblems(pool), []);
    assert.equal(countsByKey(assignPool(pool)).get("F"), 2);
  });

  test("assignPool throws when there's a problem, naming the first problem's kind", () => {
    assert.throws(() => assignPool(poolOf([{ key: "A", replicates: 64 }], null, 60)), {
      message:
        'The pool can\'t be assigned: it has problems, such as "too-many". Check findPoolProblems first.',
    });
  });

  // --- spareWellCount ---

  test("spareWellCount: 20 for 60 wells and 40 replicates, 0 when they don't fit, null when missing", () => {
    const items = [
      { key: "A", replicates: 20 },
      { key: "B", replicates: 20 },
      { key: "F", replicates: null },
    ];
    assert.equal(spareWellCount(poolOf(items, "F", 60)), 20);
    assert.equal(spareWellCount(poolOf(items, "F", 30)), 0);
    assert.equal(spareWellCount(poolOf([{ key: "A", replicates: null }], null, 60)), null);
  });

  // --- Badly formed pools ---

  test("badly formed pools throw, in section 5's order", () => {
    const good = () =>
      poolOf(
        [
          { key: "A", replicates: 2 },
          { key: "B", replicates: 2 },
        ],
        null,
        4,
      );
    const cases = [
      [null, 'The pool must be an object with "items", "filler", "wells" and "seed", but got null.'],
      [
        { items: [], filler: null, wells: [] },
        'The pool must be an object with "items", "filler", "wells" and "seed", but got an object.',
      ],
      [{ ...good(), extra: 1 }, null],
      [{ ...good(), items: 5 }, 'The pool\'s "items" must be a list, but got 5.'],
      [{ ...good(), wells: "W1" }, 'The pool\'s "wells" must be a list, but got "W1".'],
      [
        { ...good(), items: [{ key: "A", replicates: 1 }, { key: "B" }] },
        'Pool item 2 must be an object with exactly a "key" that\'s a name, and "replicates".',
      ],
      [
        { ...good(), items: [{ key: "A", replicates: 1 }, { key: " B", replicates: 1 }] },
        'Pool item 2 must be an object with exactly a "key" that\'s a name, and "replicates".',
      ],
      [
        { ...good(), items: [{ key: "A", replicates: 1, filler: true }] },
        'Pool item 1 must be an object with exactly a "key" that\'s a name, and "replicates".',
      ],
      [
        {
          ...good(),
          items: [
            { key: "A", replicates: 1 },
            { key: "B", replicates: 1 },
            { key: "A", replicates: 1 },
          ],
        },
        'Pool items 1 and 3 both have the key "A".',
      ],
      [{ ...good(), filler: "Z" }, 'The filler "Z" isn\'t one of the pool\'s items.'],
      [{ ...good(), wells: ["W1", "W2", "W3", 5] }, "Pool well 4 must be a name, but got 5."],
      [{ ...good(), wells: ["W1", "W2", "W3", "W2"] }, 'Pool wells 2 and 4 are both "W2".'],
    ];
    for (const [pool, message] of cases) {
      for (const run of [findPoolProblems, assignPool, spareWellCount]) {
        if (message === null) {
          assert.throws(() => run(pool), /The pool must be an object/);
        } else {
          assert.throws(() => run(pool), { message });
        }
      }
    }
  });

  // --- Unchanged ---

  test("the pool passed in is unchanged", () => {
    const pool = poolOf(
      [
        { key: "A", replicates: 3 },
        { key: "F", replicates: null },
      ],
      "F",
      8,
    );
    const before = copyOf(pool);
    findPoolProblems(pool);
    assignPool(pool);
    spareWellCount(pool);
    assert.deepEqual(pool, before);
  });

  // --- randomSeed ---

  test("randomSeed turns 0, 0.5 and nearly 1 into 1, 500000 and 999999", () => {
    assert.equal(randomSeed(0), 1);
    assert.equal(randomSeed(0.5), 500000);
    assert.equal(randomSeed(0.9999999999), 999999);
  });

  test("randomSeed always gives a seed the pool accepts", () => {
    for (let step = 0; step < 1000; step++) {
      const seed = randomSeed(step / 1000);
      assert.ok(Number.isInteger(seed) && seed >= 1 && seed <= 999999, String(seed));
      assert.deepEqual(findPoolProblems(poolOf([], null, 0, seed)), [], String(seed));
    }
  });

  test("randomSeed throws for anything but a number from 0 up to 1", () => {
    for (const [value, shown] of [
      [1, "1"],
      [-0.1, "-0.1"],
      ["0.5", '"0.5"'],
    ]) {
      assert.throws(() => randomSeed(value), {
        message: `randomSeed needs a number from 0 up to 1, like Math.random() gives, but got ${shown}.`,
      });
    }
  });
});
