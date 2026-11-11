// animations.js — how long the transfer designer page's animations take.
//
// DELETE_ANIMATION_MS is how long, in milliseconds, the rows of what's deleted in the Stages column
// take to flash red and shrink away before the delete is recorded (transfer-designer-page.md,
// sections 7 and 15), from the preview Andy shaped on 2026-11-11. It must be a whole number of at
// least 1; the page's tests check this, and the browser walk-through of deleting reads it to know
// how long to wait. Data only (ADR 0009).

export const DELETE_ANIMATION_MS = 450;
