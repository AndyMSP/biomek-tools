// randomizations.js — how the transfer designer page shows a randomization's sources.
//
// SOURCES_SHOWN is how many sources a randomization's card lists before "Show all N sources ▸"
// (transfer-designer-page.md, sections 7 and 14), so a randomization of 68 sources doesn't fill the
// column. Chosen by Andy while shaping the randomizer preview (2026-11-01). It must be a whole
// number of at least 1; the page's tests check this file (ADR 0009). Data only (ADR 0009).

export const SOURCES_SHOWN = 8;
