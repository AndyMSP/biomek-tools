// labware-types.js — the labware types the deck description uses (config/deck.js), each with its
// well grid, its capacity and its dead volume, and for some, its growth area.
//
// For each labware type, keyed by its name exactly as in Biomek Software:
// - grid: the name of its well grid in well-grid.js, "GRID_96" or "GRID_1X12_NUMBERED". It's text,
//   because configuration imports nothing but other configuration (ADR 0009). A grid is a fact
//   about the type (a BCFlat96 is always 96 wells), so it's stated once here, not on each labware;
// - capacity: the most one well holds, in µL: the type's "Maximum volume per well" in the Biomek's
//   Labware Type Editor (B56358AF 17-18), copied by hand. A well filled past it is an overfill;
// - deadVolume: the liquid a well holds that a tip can't reach, in µL: one value per labware type,
//   because Andy sets every technique's minimum pipetting height to reach it (roadmap, item 11 of
//   v0.2.0). A transfer can take only what's above it;
// - growthArea: the area of one well's bottom in cm², only on types cells are grown on (Andy,
//   2026-11-05). A type without it gets no cells per cm².
// The numbers are measured or copied, never worked out by the tool; each value's comment says
// where it came from. A stand-in says so (roadmap, "Technical debt": to be replaced once the
// capacities are copied from the Labware Type Editor and the flat plate's dead volume is measured).
// The deck module's tests check this file (deck.md, ADR 0009). Data only (ADR 0009).

export const LABWARE_TYPES = {
  // The 96-well flat-bottom plate.
  // capacity: Andy, 2026-11-12: a well holds up to about 380 µL with the liquid bulging above the
  // rim; 400 is set here and in the plate's labware type in Biomek Software, so the two agree.
  // deadVolume: stand-in (2026-10-30), to be measured.
  // growthArea: Andy's stand-in (2026-11-05), not checked; to be confirmed against the plate's datasheet.
  BCFlat96: { grid: "GRID_96", capacity: 400, deadVolume: 20, growthArea: 0.32 },

  // The 96 deep-well plate, about 2.2 mL per well (docs/domain/exp37.md).
  // capacity: stand-in (2026-10-30), to be copied from the Labware Type Editor.
  // deadVolume: measured by Andy on 2026-10-08 (docs/domain/exp37.md, "Dead volumes").
  BCDeep96Square: { grid: "GRID_96", capacity: 2200, deadVolume: 200 },

  // The 12-trough reservoir, troughs numbered 1 to 12.
  // capacity: stand-in (2026-10-30), to be copied from the Labware Type Editor.
  // deadVolume: measured by Andy on 2026-10-08 (docs/domain/exp37.md, "Dead volumes").
  DeepReservoir12: { grid: "GRID_1X12_NUMBERED", capacity: 15000, deadVolume: 2000 },
};
