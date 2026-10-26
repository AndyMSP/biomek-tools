// undo.js — how far back undo can go in the transfer designer.
//
// UNDO_STATES_KEPT is the most earlier states a plan history keeps; recording one more drops the
// oldest (plan-history.md, section 3). Chosen by Andy, 2026-10-26. Each kept state of a plan of about
// 1,000 transfers takes about 13 kB, so about 13 MB at this limit, when edits share unchanged
// transfers (measured with the preview's code, 2026-10-26). It must be a whole number of at least 1;
// plan-history's tests check this. Data only (ADR 0009).

export const UNDO_STATES_KEPT = 1000;
