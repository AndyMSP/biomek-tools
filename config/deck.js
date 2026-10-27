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
// STAND-IN: the names and labware types below haven't been checked against Biomek Software, and the
// general-purpose method isn't built yet. Replace them with the real ones before the first run
// (roadmap, "Technical debt"). BCFlat96 is a labware type in the lab's Biomek Software (biomek.md),
// but whether it is the plate Exp36 uses isn't known.

export const DECK = [
  { name: "Plate", grid: "GRID_96", labwareType: "BCFlat96" },
  { name: "Deep", grid: "GRID_96", labwareType: "StandIn_Deep96" },
  // A second deep-well plate (Andy, 2026-10-26). Its position in the general-purpose method isn't
  // decided yet.
  { name: "Deep2", grid: "GRID_96", labwareType: "StandIn_Deep96" },
  { name: "Res", grid: "GRID_1X12_NUMBERED", labwareType: "StandIn_Reservoir12" },
];
