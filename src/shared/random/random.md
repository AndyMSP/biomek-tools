# random — specification

## 1. Purpose
`random.js` produces random numbers that are repeatable: the same seed always gives the same
sequence, in any browser and in Node. It also shuffles lists using those numbers. It knows nothing
about plates, conditions or experiments.

## 2. Scope
- One generator, using the mulberry32 algorithm (see ADR 0003). The algorithm must never change: a
  different algorithm would turn every recorded seed into a different result.
- For reproducible randomization only. It is **not** suitable for security uses such as passwords
  or keys.
- Seeds the user sees (e.g. the randomizer's 1–999,999) are each tool's own rule. The generator
  accepts its full range.

## 3. Interface
The module exports one class, `SeededRandom`.

| Member | Visibility | Description |
|---|---|---|
| `constructor(seed)` | public | Checks the seed and sets the state to it. |
| `next()` | public | Advances the state one step and returns a number from 0 up to (not including) 1. |
| `shuffled(list)` | public | Returns a new list with the same items in a random order. The list passed in is not changed. |
| `#state` | private | The number the generator is currently holding. It starts as the seed, and each `next()` changes it. |
| `#randomIndex(count)` | private | Returns a whole number from 0 to `count − 1`, using one `next()`. |

There is no public way to read or change the state, so a generator can't be moved to a different
point in its sequence.

Example:
```js
const generator = new SeededRandom(37);
const order = generator.shuffled(["A", "B", "C", "D"]);
```

## 4. Behavior

### Seed
A whole number from 0 to 4,294,967,295 (the largest 32-bit whole number).

### `next()` — mulberry32
Each call:
1. Adds `0x6D2B79F5` to the state and wraps the result to 32 bits (like a clock: past the largest
   value, it continues from the bottom).
2. Scrambles the new state and returns it divided by 4,294,967,296, giving a number from 0 up to
   (not including) 1.

The arithmetic is the standard published mulberry32, with one difference: the state is wrapped to
32 bits explicitly (`| 0`). The published version lets the stored number grow on every call; its
outputs are the same, but after about 4.9 million calls the number becomes too large for JavaScript
to store exactly, and the outputs go wrong. The implementation must produce exactly these outputs,
which the test cases pin down:
```js
state = (state + 0x6D2B79F5) | 0;
t = state;
t = Math.imul(t ^ t >>> 15, t | 1);
t ^= t + Math.imul(t ^ t >>> 7, t | 61);
return ((t ^ t >>> 14) >>> 0) / 4294967296;
```

### `#randomIndex(count)`
`Math.floor(next() * count)`. (This favors some values over others by at most `count` in
4,294,967,296 — for the lists we shuffle, far too little to matter.)

### `shuffled(list)` — Fisher–Yates
1. Copy the list.
2. For each position `i` from the last down to the second (`i` = length − 1 … 1): pick
   `j = #randomIndex(i + 1)` and swap the items at `i` and `j`.
3. Return the copy.

Each step is a fair choice, so given evenly spread random numbers, every item is equally likely to
land in every position. (For long lists, a 32-bit generator can produce only a fraction of all
possible orders, since there are more orders than starting states; this doesn't affect randomizing
plates. See ADR 0003.) A list of n items uses exactly n − 1 calls to `next()`. The
direction (last position first) is part of the specification, because it decides which random
number goes with which position.

## 5. Errors
| Problem | Message |
|---|---|
| Seed not a whole number from 0 to 4,294,967,295 | `The seed must be a whole number from 0 to 4,294,967,295, but got -1.` |
| `shuffled` given something that isn't a list | `shuffled needs a list (an array), but got "ABCD".` |

Text is shown in quotes in messages, so `"37"` (text) is distinguishable from `37` (a number).

## 6. Test cases
Reference values were computed independently in Python and with the standard published JavaScript
mulberry32; both agree exactly.

### `next()`
- **Reference values**: the first three numbers for each seed match exactly:

  | Seed | 1st | 2nd | 3rd |
  |---|---|---|---|
  | 0 | 0.26642920868471265 | 0.0003297457005828619 | 0.2232720274478197 |
  | 1 | 0.6270739405881613 | 0.002735721180215478 | 0.5274470399599522 |
  | 37 | 0.5163109616842121 | 0.9970917752943933 | 0.026310910237953067 |

- **Range**: 1,000 numbers from seed 37 all lie from 0 up to (not including) 1.
- **Reproducible**: two generators with the same seed give the same 1,000 numbers.
- **Largest seed**: `new SeededRandom(4294967295)` works.
- **Long runs stay exact**: from seed 37, after 5,000,000 calls, the next number is
  `0.24837870616465807` (computed with exact 32-bit arithmetic in Python). The published version
  without the explicit wrap gives `0.12518582912161946` here, so this test catches the stored number
  growing past what JavaScript can store exactly.

### `shuffled(list)`
- **Reference shuffle**: with seed 37, `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]` gives
  `[4, 7, 5, 8, 3, 2, 10, 1, 9, 6]`.
- **Same items**: the result contains exactly the same items as the original, nothing lost or
  duplicated.
- **Original untouched**: the list passed in is unchanged afterwards.
- **Edge cases**: `[]` gives `[]`; `["A"]` gives `["A"]`.
- **Calls**: shuffling a list of 10 items uses exactly 9 numbers (the next `next()` afterwards equals
  the 10th number of a fresh generator with the same seed).

### Errors
- Seeds `-1`, `2.5`, `"37"` and `4294967296` throw the seed error.
- `shuffled("ABCD")` and `shuffled(null)` throw the list error.
