// deck.js — the deck description: each labware on the general-purpose method's standard deck
// (ADR 0007), for the transfer designer.
//
// For each labware:
// - name: exactly as in the general-purpose method, or Biomek won't find it (B56358AF, 22-11, 22-12);
// - labwareType: its labware type, exactly as in Biomek Software, and a key in LABWARE_TYPES
//   (config/labware-types.js), which gives the type's well grid, capacity and dead volume. A stage's
//   sources must all be one labware type, and so must its destinations (B56358AF, 22-13).
// The page draws the labware from this list, and the file writer looks up labware types in it.
// Data only (ADR 0009).
//
// The real deck of the general-purpose method as built on 2026-10-27 (docs/domain/biomek.md,
// "Building the general-purpose method"; ADR 0007). Deck positions are set in the method, not here:
// the tool never knows them (ADR 0007).

export const DECK = [
  { name: "Plate1", labwareType: "BCFlat96" },
  { name: "Plate2", labwareType: "BCFlat96" },
  { name: "Plate3", labwareType: "BCFlat96" },
  { name: "Plate4", labwareType: "BCFlat96" },
  { name: "Plate5", labwareType: "BCFlat96" },
  { name: "Plate6", labwareType: "BCFlat96" },
  { name: "Deep1", labwareType: "BCDeep96Square" },
  { name: "Deep2", labwareType: "BCDeep96Square" },
  { name: "Res1", labwareType: "DeepReservoir12" },
  { name: "Res2", labwareType: "DeepReservoir12" },
];
