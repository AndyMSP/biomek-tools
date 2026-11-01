# random-pool — specification

> **Draft (2026-11-01).** Written for v0.2.0's item 9 (ADR 0012), while Andy was away; still to
> review with him: the choices listed in its pull request. It becomes Final once built and tested by
> Andy.

## 1. Purpose
`random-pool.js` spreads replicates of several items over a **pool** of wells at random, with a
seed, so the same pool and seed always give the same assignment, on any computer. It's the
randomizing logic shared by the randomizer (whose one plate's open wells are a pool) and the
transfer designer's randomizations (whose wells to fill, on any number of plates, are a pool), so
there is one copy of it (Andy, 2026-11-01).

It knows nothing about plates, grids or what an item is: an item and a well are each any text
naming it uniquely, such as `"Plate1 A1"`.

## 2. Scope
Fully random only: every well is equally likely to get any item. Constrained shuffles (e.g. each
item once per plate) aren't in it (`docs/roadmap.md`, "The randomizer").

## 3. Data model

### The pool
One object:

| Property | Description |
|---|---|
| `items` | A list of `{ key, replicates }`, in the caller's order: each item's text `key`, unique, and its number of replicates, any value (checked below). |
| `filler` | The key of the item that fills the spare wells, or `null`. It's one of `items`' keys, and its `replicates` are ignored. |
| `wells` | A list of well keys, unique, in the order they're filled (the caller decides it). |
| `seed` | The seed, any value (checked below). |

### Assignment
1. The items to place: each item **other than the filler**, repeated by its replicates, in the
   order of `items`; then the filler once for each **spare** well (the wells minus the replicates).
2. Shuffled with `SeededRandom`'s `shuffled` (`random` module), the generator started from the
   seed: a Fisher–Yates shuffle (ADR 0003).
3. The wells, in `wells`' order, each take the next item.

`assignPool` returns the **assignment**: a list `{ well, key, type }`, one per well, in `wells`'
order, `type` being `"replicate"` or `"filler"`. The pool is never changed.

These are exactly the randomizer's assignment rules (`randomizer.md`, section 5) with its open
wells as the pool, so its plates don't change (below).

### Seeds
A seed is a whole number from 1 to 999,999, as the randomizer's (`randomizer.md`, section 4). A
replicate count or seed is **missing** if it's `""`, text of only spaces, `undefined` or `null`.

### Problems
`findPoolProblems` returns every problem as an object with a `kind`, for the caller to word in its
own terms. In this order:

| Kind | When | Other properties |
|---|---|---|
| `"replicates-missing"` | an item other than the filler has missing replicates | `key`, `index` (from 0) |
| `"replicates-invalid"` | an item other than the filler has replicates that aren't a whole number of at least 1 | `key`, `index`, `value` (as given) |
| `"too-many"` | the replicates need more wells than `wells` holds | `needed`, `available` |
| `"spare-without-filler"` | wells are left over and `filler` is `null` | `spare` |
| `"seed-missing"` | the seed is missing | |
| `"seed-invalid"` | the seed isn't a whole number from 1 to 999,999 | `value` |

The item problems come item by item, in `items`' order. `"too-many"` and `"spare-without-filler"`
are checked only when every item's replicates are valid. No items, only the filler, or no wells
aren't problems here: with no replicates, every well gets the filler (as the randomizer's empty
condition list does), and with no wells the assignment is empty. A caller that needs items or
wells checks that itself.

### A badly formed pool
A pool that isn't well formed is the caller's mistake, not a problem to show, so both functions
throw (section 5).

## 4. Interface
| Function | Returns |
|---|---|
| `findPoolProblems(pool)` | every problem with `pool`, as a list of problem objects (section 3); `[]` if there are none. Throws if the pool is badly formed. |
| `assignPool(pool)` | the assignment (section 3). Throws if the pool is badly formed, or `findPoolProblems` finds any problem (`The pool can't be assigned: it has problems, such as "too-many". Check findPoolProblems first.`, naming the first problem's kind). |
| `spareWellCount(pool)` | the number of spare wells, or `null` while any item's replicates aren't valid; 0 if the replicates don't fit. |
| `randomSeed(randomNumber)` | a seed from 1 to 999,999 made from a random number from 0 up to 1, exactly as the randomizer's `randomSeed` (`randomizer.md`, section 4), which moves here so both tools share it; `randomizer.js` re-exports it, so its own interface doesn't change. |

Example:
```js
assignPool({
  items: [{ key: "Deep A1", replicates: 2 }, { key: "Deep A2", replicates: null }],
  filler: "Deep A2",
  wells: ["Plate1 B2", "Plate1 B3", "Plate2 B2"],
  seed: 37,
});
// → [{ well: "Plate1 B2", key: "Deep A1", type: "replicate" }, … ], one per well
```

## 5. Errors
| Problem | Message |
|---|---|
| `pool` isn't an object with exactly `items`, `filler`, `wells` and `seed`, or `items` or `wells` isn't a list | `The pool must be an object with "items", "filler", "wells" and "seed", but got null.` (the pool itself) / `The pool's "items" must be a list, but got 5.` (or `"wells"`) |
| An item isn't an object with exactly a `key` that's a name (`checkName`) and a `replicates` property (whose value may be anything, even `null`) | `Pool item 2 must be an object with exactly a "key" that's a name, and "replicates".` |
| Two items with one key | `Pool items 1 and 3 both have the key "Deep A1".` |
| `filler` isn't `null` or an item's key | `The filler "Deep A9" isn't one of the pool's items.` |
| A well isn't a name, or is listed twice | `Pool well 4 must be a name, but got 5.` / `Pool wells 2 and 7 are both "Plate1 B1".` |

Places count from 1. Checks run in the table's order.

## 6. Test cases
In `random-pool.test.js`, inside `describe("random-pool", …)`.
- **The randomizer's main example:** its 60 open wells, in standard order, as `wells`; items
  `Condition 1` … `Condition 12` with 4 replicates each and `Spare` as the filler; seed 37. The
  assignment matches the golden file `tests/fixtures/randomizer-main-seed-37.json` well for well
  (each open well's contents and type).
- **Two plates:** 30 wells `"P1 …"` and 30 `"P2 …"`; items with 4, 4 and 2 replicates and a filler:
  each item gets exactly its replicates, the filler the 50 spare wells, every well one item; the same
  pool twice gives the same assignment; two chosen seeds give different ones.
- **Exact fit:** replicates equal to the wells: with a filler, it gets no wells; without one, there's
  no problem.
- **No replicates:** only the filler, 10 wells: every well gets the filler. No wells: an empty
  assignment. Neither is a problem.
- **The filler's place in `items` doesn't matter:** moving it gives the same assignment.
- **Problems:** each kind with its properties, e.g. `{ kind: "too-many", needed: 64, available: 60 }`
  and `{ kind: "replicates-invalid", key: "A", index: 0, value: "four" }`; several at once in order;
  `"too-many"` not reported while an item's replicates are missing; the filler's `replicates` never
  checked; `assignPool` throws when there's a problem.
- **`spareWellCount`:** 20 for 60 wells and 40 replicates, 0 when they don't fit, `null` with a
  missing count.
- **Badly formed pools:** each row of section 5, with its message.
- **Unchanged:** the pool passed in is unchanged.
- `randomSeed`: the randomizer's test cases for it (`randomizer.md`, section 9) move here; the
  randomizer's tests check that its re-export is the same function.

**The REPL** (`scripts/repl.js`): a topic of its own, `random-pool`, with an example pool on two
plates.
