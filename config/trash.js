// trash.js — how much the transfer designer's trash keeps.
//
// TRASH_LIMIT is the most entries the trash keeps, one per thing deleted; adding more drops the
// oldest (trash.md, section 3). Chosen by Andy, 2026-11-11, from the preview he shaped that night.
// It must be a whole number of at least 1; the trash module's tests check this. Data only (ADR 0009).

export const TRASH_LIMIT = 20;
