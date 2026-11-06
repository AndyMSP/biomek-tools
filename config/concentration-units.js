// concentration-units.js — the units a constituent's concentration can be given in, and how each
// family of units scales, so a final concentration can be shown in the unit that fits it best
// (0.75 g/L diluted 100 times reads as 7.5 mg/L, not 0.0075 g/L).
//
// A constituent (docs/glossary.md) is something a component carries at a known concentration, such
// as Hy-Soy at 4 g/L in a medium. Each unit belongs to a family; units of one family are the same
// quantity at different scales, and `factor` says how many of the family's base unit one of the
// unit is (molar: base M; mass: base g/L). Units in a family of their own (percent, ×) have factor
// 1 and are never rescaled. `offered` units are the ones the menu shows when a stock is entered:
// the lab's own habits (Andy, 2026-11-01: g/L, mM, µM, % and × are what the protocols use; M added
// on 2026-11-05, so a stock given in molar can be entered as it's written); the others (nM, mg/L)
// are display only, chosen by the page when a dilution calls for them. Cells (Andy, 2026-11-05)
// are a family of their own, in cells/mL (a cell density, from a cell count), offered, and never
// rescaled: the lab counts in cells/mL, so there's no cells/µL or cells/L. Data only (ADR 0009).
// The concentrations module's tests check this file (concentrations.md, "Configuration").

// The units, each family from largest to smallest: its symbol as shown, its family, its factor,
// and whether the menu offers it.
export const CONCENTRATION_UNITS = [
  { unit: "M", family: "molar", factor: 1, offered: true },
  { unit: "mM", family: "molar", factor: 1e-3, offered: true },
  { unit: "µM", family: "molar", factor: 1e-6, offered: true },
  { unit: "nM", family: "molar", factor: 1e-9, offered: false },
  { unit: "g/L", family: "mass", factor: 1, offered: true },
  { unit: "mg/L", family: "mass", factor: 1e-3, offered: false },
  { unit: "%", family: "percent", factor: 1, offered: true },
  { unit: "×", family: "fold", factor: 1, offered: true },
  // Last, so no entry above moves (Andy, 2026-11-05).
  { unit: "cells/mL", family: "cells", factor: 1, offered: true },
];

// The unit a new constituent starts with: the one the lab's protocols use most.
export const DEFAULT_CONCENTRATION_UNIT = "g/L";

// The unit cells are counted in, so code knows which family is the cells' without naming it
// (concentrations.md, "Cells"; Andy, 2026-11-05).
export const CELL_DENSITY_UNIT = "cells/mL";

// Other ways of writing a unit that a stock table's header may use (transfer-designer.md, "Stock
// tables" and "Configuration"), each read as the configured unit it names, so a table typed in Excel
// without the micro or multiplication sign still reads. Kept to these, so units are read strictly:
// anything else is reported (Andy, 2026-11-05: "keep it tight"). Read by the transfer designer, not
// by the concentrations module; its tests check every value is a unit above and no key is one.
// "μM" is µM written with the Greek letter mu (U+03BC); the units above use the micro sign
// (U+00B5), which looks the same.
export const UNIT_SPELLINGS = {
  uM: "µM",
  "μM": "µM",
  x: "×",
  X: "×",
  "g/l": "g/L",
  "mg/l": "mg/L",
  "cells/ml": "cells/mL",
};
