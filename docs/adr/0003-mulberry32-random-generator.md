# 3. Use mulberry32 for seeded random numbers, and Fisher–Yates to shuffle

Date: 2026-10-17

## Status
Accepted

## Context
The randomizer must give the same plate from the same inputs and seed, on any computer, now and in
the future. JavaScript's `Math.random()` can't be seeded, so the project needs its own generator.

Because seeds are recorded with experiments (and in golden test files), whichever algorithm is chosen
is effectively permanent: changing it later would silently turn every recorded seed into a different
plate.

Options considered:
- **A library** (e.g. seedrandom): adds a dependency for something small enough to write and
  understand.
- **sfc32**: higher statistical quality, but four numbers of state and a seeding rule to turn one seed
  into four.
- **splitmix32**: one number of state and stronger mixing than mulberry32, but no single standard
  version; constants differ between sources.
- **mulberry32**: one number of state, about six lines, one standard published version with known
  outputs. Its weaknesses (detectable patterns after billions of numbers; some 32-bit outputs never
  occur) are irrelevant at a few hundred numbers per plate.

For shuffling, the Exp37 spreadsheet ranked items by random numbers, because Excel formulas can't
loop or swap. In code, the standard Fisher–Yates shuffle is exactly fair by construction and has no
ties to break.

## Decision
- Generate random numbers with **mulberry32**, implemented exactly as the standard published version.
- Shuffle with **Fisher–Yates**, from the last position to the second, as specified in
  `src/shared/random/random.md`.

## Consequences
- No dependency; the generator is short enough to read and understand fully.
- The same seed gives the same numbers in every browser and in Node, because mulberry32 uses only
  exact 32-bit integer arithmetic.
- Tests pin the exact outputs for given seeds, checked against an independent implementation, so any
  accidental change is caught immediately.
- **The algorithm and shuffle must never change.** If a change is ever unavoidable, it needs a new ADR
  and a way to tell old seeds from new ones (e.g. a version recorded with each seed), so recorded
  plates stay reproducible.
- Not suitable for security uses; it isn't meant for them.
