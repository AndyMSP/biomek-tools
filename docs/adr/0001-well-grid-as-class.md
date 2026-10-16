# 1. Model well grids as a class, separate from labware types

Date: 2026-10-16

## Status
Accepted

## Context
Every tool needs to reason about plate positions: listing wells, validating well names, converting
between names and row/column positions, and finding edge wells. These questions depend only on the
grid of positions (rows and columns), not on the physical labware. A standard 96-well plate, a
deep-well block and a PCR plate share the same 8 × 12 grid but differ in volume, depth, and their
Biomek labware definitions.

Two designs were considered for the grid:
1. Plain data objects (`{ rows: 8, columns: 12 }`) with exported functions that take the object as
   their first argument.
2. A class whose instances carry the data and expose the same operations as methods.

While specifying the functions, every one of them ended up taking the grid as its first input, and
the grid itself needed validating before any function could trust it.

## Decision
- Model the grid as a `WellGrid` class, created with `new WellGrid(rows, columns)`. The constructor
  validates its inputs, instances never change after creation, and position operations are methods
  (`grid.wellPosition("D3")`).
- Keep the grid separate from labware types. A future labware type (e.g. "deep-well block") will
  have a grid rather than be one (composition, not inheritance), and its lab-specific properties will
  live in `config/`. The name `Labware` is reserved for that physical type.

## Consequences
- Validation happens once, in the constructor; methods can assume a valid instance.
- Operations read naturally and are grouped with the data they act on.
- One `WellGrid` instance (e.g. `GRID_96`) can be shared by every 96-well labware type.
- Loading a grid from a configuration file (JSON) requires constructing an instance, e.g.
  `new WellGrid(data.rows, data.columns)`. This is routine.
- Grids with different behavior (e.g. numbered reservoir positions or non-grid racks) can be handled
  with a constructor option or a subclass.
- The plain-object design remains a viable alternative; other modules depend only on the public
  methods, so the internals can change behind the unit tests.
