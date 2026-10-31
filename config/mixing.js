// mixing.js — how a stage mixes when mixing is switched on, when a mix counts as short, and the
// smallest mix that runs.
//
// A tool offers mixing only as on or off (Andy, 2026-10-29), so switching it on gives an end
// DEFAULT_MIX (transfer-designer.md, "Mixing"). A mix is short when it stirs less than
// SHORT_MIX_SHARE percent of what a well holds (mix-volumes.md, "How much of each well is mixed");
// a short mix is a warning, not a problem. A mix volume under MIN_MIX_VOLUME is a mix problem
// (mix-volumes.md, "How much of each well is mixed"). Data only (ADR 0009).
// Which tests check which value:
// - DEFAULT_MIX: the transfer-designer module's tests (transfer-designer.md, "Configuration");
// - SHORT_MIX_SHARE and MIN_MIX_VOLUME: the mix-volumes module's tests (mix-volumes.md,
//   "Configuration").

// The mix an end gets when mixing is switched on: 90% of the well, 3 times, at 400 µL/s
// (Andy, 2026-10-29). It must be a mix the stage list accepts (stage-list.md).
export const DEFAULT_MIX = { share: 90, times: 3, speed: 400 };

// The mixed share, in percent, below which a mix is short: 40 (Andy, 2026-10-29). A number above 0
// and at most 100.
export const SHORT_MIX_SHARE = 40;

// The smallest mix volume allowed, in µL: 1 (Andy, 2026-10-30, rather than 1.1, for a round limit;
// how the Biomek handles 1 µL is to be checked at the instrument). Mix volumes needn't be accurate,
// only possible. A number above 0.
export const MIN_MIX_VOLUME = 1;
