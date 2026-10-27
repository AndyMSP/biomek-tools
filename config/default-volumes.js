// default-volumes.js — the volumes the transfer designer page starts with, in microliters (µL).
//
// DEFAULT_TRANSFER_VOLUME is the next transfer's volume when the page opens, and DEFAULT_FILL_VOLUME
// the brush's volume for filling wells from the Start card; the user changes either by typing
// (transfer-designer-page.md, sections 8, 9 and 14). Chosen by Andy while shaping the transfer
// designer preview (2026-10-24 to 2026-10-26): 50 µL is a typical transfer in the lab's plates, and
// 1000 µL a typical starting volume. Both must be numbers above 0; the page's tests check this file
// (ADR 0009). Data only (ADR 0009).

export const DEFAULT_TRANSFER_VOLUME = 50;

export const DEFAULT_FILL_VOLUME = 1000;
