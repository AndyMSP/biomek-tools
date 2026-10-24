// techniques.js — the Biomek techniques the lab uses, by name, for the transfer designer's menus.
//
// Each name must match a technique in Biomek Software exactly, or Biomek refuses the method
// ("Unable to find technique", docs/domain/biomek.md). Data only (ADR 0009). The designer's logic
// module checks this list in its tests.
//
// STAND-IN: every name below is made up, so Biomek would refuse it. Replace them with the real
// names from Biomek Software's Technique Browser before the first run (roadmap, "Technical debt").
// Techniques aren't checked against tip types yet: choose one that suits the stage's tips.

export const TECHNIQUES = [
  "STAND-IN Water BC230",
  "STAND-IN Water BC1070",
  "STAND-IN Cells BC230",
];
