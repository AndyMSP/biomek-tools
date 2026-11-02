// concentration-units.js — the units a constituent's concentration can be given in, and how each
// family of units scales, so a final concentration can be shown in the unit that fits it best
// (0.75 g/L diluted 100 times reads as 7.5 mg/L, not 0.0075 g/L).
//
// A constituent (docs/glossary.md) is something a component carries at a known concentration, such
// as Hy-Soy at 4 g/L in a medium. Each unit belongs to a family; units of one family are the same
// quantity at different scales, and `factor` says how many of the family's base unit one of the
// unit is (molar: base M; mass: base g/L). Units in a family of their own (percent, ×) have factor
// 1 and are never rescaled. `offered` units are the ones the menu shows when a stock is entered:
// the lab's own habits (Andy, 2026-11-01: g/L, mM, µM, % and × are what the protocols use); the
// others are display only, chosen by the page when a dilution calls for them. Data only (ADR 0009).
// The concentrations module's tests check this file (concentrations.md, "Configuration").

// The units, each family from largest to smallest: its symbol as shown, its family, its factor,
// and whether the menu offers it.
export const CONCENTRATION_UNITS = [
  { unit: "M", family: "molar", factor: 1, offered: false },
  { unit: "mM", family: "molar", factor: 1e-3, offered: true },
  { unit: "µM", family: "molar", factor: 1e-6, offered: true },
  { unit: "nM", family: "molar", factor: 1e-9, offered: false },
  { unit: "g/L", family: "mass", factor: 1, offered: true },
  { unit: "mg/L", family: "mass", factor: 1e-3, offered: false },
  { unit: "%", family: "percent", factor: 1, offered: true },
  { unit: "×", family: "fold", factor: 1, offered: true },
];

// The unit a new constituent starts with: the one the lab's protocols use most.
export const DEFAULT_CONCENTRATION_UNIT = "g/L";
