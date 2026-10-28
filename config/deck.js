// deck.js — the deck description: each labware on the general-purpose method's standard deck
// (ADR 0007), for the transfer designer.
//
// For each labware:
// - name: exactly as in the general-purpose method, or Biomek won't find it (B56358AF, 22-11, 22-12);
// - grid: the name of its well grid in well-grid.js, "GRID_96" or "GRID_1X12_NUMBERED". It's text,
//   because configuration imports nothing but other configuration (ADR 0009);
// - labwareType: its labware type, exactly as in Biomek Software. A stage's sources must all be one
//   labware type, and so must its destinations (B56358AF, 22-13).
// The page draws the labware from this list, and the file writer looks up labware types in it.
// Data only (ADR 0009).
//
// The real deck of the general-purpose method as built on 2026-10-27 (docs/domain/biomek.md,
// "Building the general-purpose method"; ADR 0007). Deck positions are set in the method, not here:
// the tool never knows them (ADR 0007).

export const DECK = [
  { name: "Plate1", grid: "GRID_96", labwareType: "BCFlat96" },
  { name: "Plate2", grid: "GRID_96", labwareType: "BCFlat96" },
  { name: "Plate3", grid: "GRID_96", labwareType: "BCFlat96" },
  { name: "Plate4", grid: "GRID_96", labwareType: "BCFlat96" },
  { name: "Plate5", grid: "GRID_96", labwareType: "BCFlat96" },
  { name: "Plate6", grid: "GRID_96", labwareType: "BCFlat96" },
  { name: "Deep1", grid: "GRID_96", labwareType: "BCDeep96Square" },
  { name: "Deep2", grid: "GRID_96", labwareType: "BCDeep96Square" },
  { name: "Res1", grid: "GRID_1X12_NUMBERED", labwareType: "DeepReservoir12" },
  { name: "Res2", grid: "GRID_1X12_NUMBERED", labwareType: "DeepReservoir12" },
];
