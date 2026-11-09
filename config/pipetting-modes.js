// pipetting-modes.js — the pipetting modes the transfer designer offers, each standing for one
// Biomek technique and one liquid type (docs/glossary.md, "Pipetting mode").
//
// For each mode:
// - name: what the page's menus show, e.g. "Slow";
// - technique: exactly as in Biomek Software, or Biomek refuses the method ("Unable to find
//   technique", docs/domain/biomek.md); used when that end doesn't mix;
// - mixingTechnique: the technique used when that end mixes, exactly as in Biomek Software, or null
//   if the mode can't mix (transfer-designer.md, "Mixing"). Its liquid type is the same either way;
// - liquidType: exactly as in Biomek Software. Liquid type names may contain only letters, digits
//   and underscores, and must start with a letter (B56358AF, 9-4);
// - ends: where the mode can be used, "source" (aspirating), "destination" (dispensing) or both;
// - touchesLiquid: true if pipetting in this mode touches the liquid in the well, false if not
//   (ADR 0021). The possible-contamination module reads it: a destination whose dispense doesn't
//   touch the liquid passes nothing on to the tips. A mode usable at the source must be true (a tip
//   draws from inside the liquid), and a mode that's false can't mix (mixingTechnique null), since
//   mixing touches the liquid. Non-Contact's false was verified on the instrument (Andy,
//   2026-11-08; docs/domain/biomek.md); the other modes' true is assumed ("Not yet known").
// DEFAULT_PIPETTING_MODE is the mode a new plan's stage uses at both ends; it must be usable at both.
// The menus list the modes in this order. Data only (ADR 0009). The transfer-designer module's tests
// check this file (transfer-designer.md, "Configuration").
//
// The lab's modes (Andy, 2026-10-27), with the technique and liquid type names used in the
// general-purpose method on 2026-10-27 (docs/domain/biomek.md, "Building the general-purpose
// method"). Techniques aren't checked against tip types yet: choose one that suits the stage's tips
// (roadmap, "Technical debt").
// Slow, Medium and Fast mix with OperationMix, Andy's technique, which works with any liquid type;
// NonContact can't mix: it dispenses without touching the liquid (docs/domain/biomek.md, "Mixing").

export const PIPETTING_MODES = [
  {
    name: "Slow",
    technique: "Operation",
    mixingTechnique: "OperationMix",
    liquidType: "Slow",
    ends: ["source", "destination"],
    touchesLiquid: true,
  },
  {
    name: "Medium",
    technique: "Operation",
    mixingTechnique: "OperationMix",
    liquidType: "Medium",
    ends: ["source", "destination"],
    touchesLiquid: true,
  },
  {
    name: "Fast",
    technique: "Operation",
    mixingTechnique: "OperationMix",
    liquidType: "Fast",
    ends: ["source", "destination"],
    touchesLiquid: true,
  },
  // For dispensing only (docs/glossary.md, "Pipetting mode"); it can't mix.
  {
    name: "Non-Contact",
    technique: "NonContact",
    mixingTechnique: null,
    liquidType: "Medium",
    ends: ["destination"],
    touchesLiquid: false,
  },
];

export const DEFAULT_PIPETTING_MODE = "Medium";
