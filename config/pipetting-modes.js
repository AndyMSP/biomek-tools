// pipetting-modes.js — the pipetting modes the transfer designer offers, each standing for one
// Biomek technique and one liquid type (docs/glossary.md, "Pipetting mode").
//
// For each mode:
// - name: what the page's menus show, e.g. "Slow";
// - technique: exactly as in Biomek Software, or Biomek refuses the method ("Unable to find
//   technique", docs/domain/biomek.md);
// - liquidType: exactly as in Biomek Software. Liquid type names may contain only letters, digits
//   and underscores, and must start with a letter (B56358AF, 9-4);
// - ends: where the mode can be used, "source" (aspirating), "destination" (dispensing) or both.
// DEFAULT_PIPETTING_MODE is the mode a new plan's stage uses at both ends; it must be usable at both.
// The menus list the modes in this order. Data only (ADR 0009). The transfer-designer module's tests
// check this file (transfer-designer.md, "Configuration").
//
// STAND-IN: the technique and liquid type names below haven't been checked against Biomek Software.
// Replace them with the real names from its Technique Browser and Liquid Type Editor before the
// first run (roadmap, "Technical debt"). Techniques aren't checked against tip types yet: choose
// one that suits the stage's tips.

export const PIPETTING_MODES = [
  { name: "Fast", technique: "StandIn_Fast", liquidType: "Water", ends: ["source", "destination"] },
  { name: "Medium", technique: "StandIn_Medium", liquidType: "Water", ends: ["source", "destination"] },
  { name: "Slow", technique: "StandIn_Slow", liquidType: "Cells", ends: ["source", "destination"] },
  // For dispensing only (docs/glossary.md, "Pipetting mode").
  { name: "Non-Contact", technique: "StandIn_NonContact", liquidType: "Water", ends: ["destination"] },
];

export const DEFAULT_PIPETTING_MODE = "Medium";
