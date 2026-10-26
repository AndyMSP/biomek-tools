// tip-types.js — the Biomek tip types the transfer designer offers for each tip change.
//
// Each name must match a tip type in Biomek Software exactly; the general-purpose method's Load
// Tips step takes it from the worklist (docs/domain/biomek.md, "Worklist-driven steps"). BC230 and
// BC1070 are real Beckman tip types, used on the lab's Biomek (verified in simulation, 2026-10-21).
// A new plan's first tips are the first type listed. Data only (ADR 0009). The transfer-designer
// module's tests check this file (transfer-designer.md, "Configuration").

export const TIP_TYPES = ["BC230", "BC1070"];
