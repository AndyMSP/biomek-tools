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
// The lab's modes (Andy, 2026-10-27), with the technique and liquid type names used in the
// general-purpose method on 2026-10-27 (docs/domain/biomek.md, "Building the general-purpose
// method"). Techniques aren't checked against tip types yet: choose one that suits the stage's tips
// (roadmap, "Technical debt").

export const PIPETTING_MODES = [
  { name: "Slow", technique: "Operation", liquidType: "Slow", ends: ["source", "destination"] },
  { name: "Medium", technique: "Operation", liquidType: "Medium", ends: ["source", "destination"] },
  { name: "Fast", technique: "Operation", liquidType: "Fast", ends: ["source", "destination"] },
  // For dispensing only (docs/glossary.md, "Pipetting mode").
  { name: "Non-Contact", technique: "NonContact", liquidType: "Medium", ends: ["destination"] },
];

export const DEFAULT_PIPETTING_MODE = "Medium";
