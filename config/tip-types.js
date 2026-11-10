// tip-types.js — the Biomek tip types the transfer designer offers for each tip change, and how
// many probes a new plan's first tips go on.
//
// Each name must match a tip type in Biomek Software exactly; the general-purpose method's Load
// Tips step takes it from the worklist (docs/domain/biomek.md, "Worklist-driven steps"). BC230 and
// BC1070 are real Beckman tip types, used on the lab's Biomek (verified in simulation, 2026-10-21).
// A new plan's first tips are the first type listed. Data only (ADR 0009). The mix-volumes
// module's tests check MIX_VOLUME_LIMITS (mix-volumes.md, "Configuration"), and the
// transfer-designer module's tests the rest (transfer-designer.md, "Configuration").

export const TIP_TYPES = ["BC230", "BC1070"];

// How many probes a new plan's first tips go on: the first that many (probesFor in
// transfer-designer.js). A whole number from 1 to 8. 4 (Andy, 2026-10-30). It's here because it
// may change (CLAUDE.md, "No hard-coded configuration").
export const DEFAULT_PROBE_COUNT = 4;

// The most each tip type can mix, in µL: a row's mix volume is never more than its tip type's limit
// (mix-volumes.md). One entry for each tip type in TIP_TYPES.
// - BC230: a STAND-IN (roadmap, "Technical debt"): about what a BC230 tip holds in one trip
//   (docs/domain/biomek.md, "Volumes and tips"), not checked as a mix volume on the instrument.
// - BC1070: 900, from a real run (Andy, 2026-11-10; docs/domain/biomek.md, "Volumes and tips"):
//   a 1000 µL mix with MixOnly2 needed a 1070 µL syringe move and failed, so the most a mix can
//   take is about 930 µL; 900 leaves a margin. It's the 1 mL syringe that limits it, not the tip.
export const MIX_VOLUME_LIMITS = { BC230: 200, BC1070: 900 };
