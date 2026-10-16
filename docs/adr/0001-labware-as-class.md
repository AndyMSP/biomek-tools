# 1. Model labware as a class

Date: 2026-10-16

## Status
Accepted

## Context
Every tool needs to reason about plate positions: listing wells, validating well names, converting
between names and row/column positions, and finding edge wells. Labware types we expect (plates,
reservoirs, tube racks) are mostly rectangular grids that differ only in size and naming scheme.

Two designs were considered:
1. Plain data objects (`{ rows: 8, columns: 12 }`) with exported functions that take the object as
   their first argument.
2. A `Labware` class whose instances carry the data and expose the same operations as methods.

While specifying the functions, every one of them ended up taking the labware as its first input,
and the labware itself needed validating before any function could trust it.

## Decision
Model labware as a `Labware` class, created with `new Labware(rows, columns)`. The constructor
validates its inputs, instances never change after creation, and position operations are methods
(`plate.wellPosition("D3")`).

## Consequences
- Validation happens once, in the constructor; methods can assume a valid instance.
- Operations read naturally and are grouped with the data they act on.
- Loading labware from a configuration file (JSON) requires constructing an instance, e.g.
  `new Labware(data.rows, data.columns)`. This is routine.
- If labware with different behavior appears (e.g. non-grid racks or numbered reservoir positions),
  it can be handled with a constructor option or a subclass.
- The plain-object design remains a viable alternative; other modules depend only on the public
  methods, so the internals can change behind the unit tests.
