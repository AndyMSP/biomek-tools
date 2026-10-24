// liquid-types.js — the Biomek liquid types the lab uses, by name, for the transfer designer's menus.
//
// Each name must match a liquid type in Biomek Software exactly. Liquid type names may contain only
// letters, digits and underscores, and must start with a letter (B56358AF, 9-4). Data only
// (ADR 0009). The designer's logic module checks this list in its tests.
//
// STAND-IN: every name below is made up. Replace them with the real names from Biomek Software's
// Liquid Type Editor before the first run (roadmap, "Technical debt"). What Biomek does with an
// unknown liquid type name isn't known yet (docs/domain/biomek.md, "Not yet known").

export const LIQUID_TYPES = [
  "StandIn_Liquid_1",
  "StandIn_Liquid_2",
];
