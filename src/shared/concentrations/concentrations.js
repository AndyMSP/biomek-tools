// concentrations.js — works out what a well's mixture carries, from what its components carry.
//
// A component (docs/glossary.md) may carry constituents: things at a known concentration, such as
// Hy-Soy at 4 g/L in a medium. Contents tracking gives each component's share of a well
// (contents-tracking.md, volumeFractionsOf); this module turns those shares and the components'
// constituents into the well's concentration of each constituent, and chooses the unit to show it
// in. Dilution is linear, so a share × an amount is the contribution, and nothing is ever converted
// between units: everything is added in the family's base unit (factor 1 in
// config/concentration-units.js) and scaled only for display.
//
// Cells are a constituent like any other, in cells/mL (CELL_DENSITY_UNIT), a family of their own
// that is never rescaled; for wells on labware cells grow on, the module also works out a well's
// seeding density, its cells per cm² of growth area (concentrations.md, "Cells").
//
// It's shared because the arithmetic belongs to no one tool: the transfer designer uses it for its
// contents card, and a later tool may use it for a report. It never changes its inputs.
// Specification: concentrations.md.

import { CONCENTRATION_UNITS, CELL_DENSITY_UNIT } from "../../../config/concentration-units.js";
import { describeValue } from "../error-messages/error-messages.js";
import {
  isObject,
  findMissingProperties,
  findExtraProperties,
  listNames,
  checkName,
} from "../input-checks/input-checks.js";

// The properties a constituent has, in the order messages list them.
const CONSTITUENT_PROPERTIES = ["name", "amount", "unit"];

// How close to 1 an amount may be and still count as 1 when choosing the unit to show, so
// arithmetic leftovers don't push 1 mM down to 999.99… µM (concentrations.md, section 3).
const BOUNDARY_TOLERANCE = 1e-12;

// A component's constituents, checked (concentrations.md, section 5) and copied: a new list of new
// { name, amount, unit } objects with the names trimmed, in the given order. Throws if `constituents`
// isn't a list of constituents, e.g. checkConstituents([{ name: " Dye ", amount: 10, unit: "mM" }])
// → [{ name: "Dye", amount: 10, unit: "mM" }].
export function checkConstituents(constituents) {
  if (!Array.isArray(constituents)) {
    throw new Error(
      `A component's constituents must be a list, like [{ name: "Dye", amount: 10, unit: "mM" }], but got ${describeValue(constituents)}.`,
    );
  }
  const checked = [];
  constituents.forEach((constituent, index) => {
    checked.push(checkConstituent(constituent, index + 1, checked));
  });
  return checked;
}

// The family of the unit with symbol `unit`, e.g. familyOf("mM") → "molar". Throws for a unit not
// in the configuration.
export function familyOf(unit) {
  return findUnit(unit).family;
}

// The symbols of `family`'s units as a message or a menu lists them: the offered ones in the
// configuration's order, then the display-only ones in the configuration's order, as a new list,
// e.g. unitsOf("mass") → ["g/L", "mg/L"]. Throws for a family not in the configuration.
export function unitsOf(family) {
  const units = unitsInFamily(family);
  const offered = units.filter((entry) => entry.offered);
  const displayOnly = units.filter((entry) => !entry.offered);
  return [...offered, ...displayOnly].map((entry) => entry.unit);
}

// A well's concentrations from its `shares` (each component's volume fraction, by component name)
// and the plan's `components` (each { name, constituents, … }): one { name, family, value } per
// constituent name and family, `value` in the family's base unit, in the order the pairs are first
// met going through the components in order and each component's constituents in order,
// e.g. wellConcentrations({ Stock: 0.2, Media: 0.8 }, [{ name: "Stock", constituents: [{ name:
// "Dye", amount: 10, unit: "mM" }] }, { name: "Media", constituents: [] }]) → [{ name: "Dye",
// family: "molar", value: 0.002 }]. A component with no share, a share of 0 or no constituents
// contributes nothing; a share whose name is no component's is ignored.
export function wellConcentrations(shares, components) {
  const concentrations = [];
  for (const component of components) {
    const share = shares[component.name] ?? 0;
    if (share <= 0) {
      continue;
    }
    for (const constituent of component.constituents ?? []) {
      const { family, factor } = findUnit(constituent.unit);
      const contribution = share * constituent.amount * factor;
      const existing = concentrations.find(
        (entry) => entry.name === constituent.name && entry.family === family,
      );
      if (existing) {
        existing.value += contribution;
      } else {
        concentrations.push({ name: constituent.name, family, value: contribution });
      }
    }
  }
  return concentrations;
}

// The { amount, unit } to show `value` (in `family`'s base unit) in: the largest unit of the family
// in which the amount is at least 1 (within BOUNDARY_TOLERANCE), else the family's smallest unit,
// e.g. bestUnit("molar", 0.000476) → { amount: 476, unit: "µM" }. Throws for a family not in the
// configuration.
export function bestUnit(family, value) {
  // The configuration lists each family's units from largest to smallest, so the first unit whose
  // amount reaches 1 is the largest such unit.
  const units = unitsInFamily(family);
  const smallest = units[units.length - 1];
  const chosen =
    units.find((entry) => value / entry.factor >= 1 - BOUNDARY_TOLERANCE) ?? smallest;
  return { amount: value / chosen.factor, unit: chosen.unit };
}

// Whether `family` is the cells' family, the family of CELL_DENSITY_UNIT in the configuration,
// e.g. isCellFamily("cells") → true, isCellFamily("molar") → false. Never throws: anything that
// isn't the cells' family, such as "volume" or 5, gives false.
export function isCellFamily(family) {
  return family === familyOf(CELL_DENSITY_UNIT);
}

// A well's seeding density in cells/cm²: its `cellDensity` (cells/mL) times its `volume` (µL,
// turned into mL) divided by its `growthArea` (cm²), assuming every cell settles onto the bottom,
// e.g. seedingDensity(150000, 100, 0.32) → 46875. Inputs aren't checked (concentrations.md,
// section 4); the volume is converted first, then multiplied and divided, in that order, so tests
// can compare exactly.
export function seedingDensity(cellDensity, volume, growthArea) {
  const volumeInMilliliters = volume / 1000;
  return (cellDensity * volumeInMilliliters) / growthArea;
}

// --- Helpers used only inside this module ---

// One constituent, checked (concentrations.md, section 5, in table order) and copied with its name
// trimmed. `number` is its place in the list, from 1, for messages; `earlier` the constituents
// already checked, so a repeated name is caught after the name check and before the amount's.
function checkConstituent(constituent, number, earlier) {
  if (!isObject(constituent)) {
    throw new Error(
      `Constituent ${number} must be an object with a name, an amount and a unit, but got ${describeValue(constituent)}.`,
    );
  }
  const missing = findMissingProperties(constituent, CONSTITUENT_PROPERTIES);
  if (missing.length > 0) {
    throw new Error(
      `Constituent ${number} needs name, amount and unit, but is missing ${listNames(missing)}.`,
    );
  }
  const extra = findExtraProperties(constituent, CONSTITUENT_PROPERTIES);
  if (extra.length > 0) {
    throw new Error(
      `Constituent ${number} can only have name, amount and unit, but also got ${listNames(extra)}.`,
    );
  }
  // The name is trimmed before checkName, so a name with spaces at the ends is accepted and
  // trimmed rather than refused; checkName then catches text that isn't text or is blank.
  const name = typeof constituent.name === "string" ? constituent.name.trim() : constituent.name;
  checkName(name, "constituent name");
  if (earlier.some((entry) => entry.name === name)) {
    throw new Error(`${describeValue(name)} is listed twice. List each constituent once.`);
  }
  const { amount, unit } = constituent;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      `The amount of ${describeValue(name)} must be a number above 0, like 10, but got ${describeValue(amount)}.`,
    );
  }
  if (!CONCENTRATION_UNITS.some((entry) => entry.unit === unit)) {
    const offered = CONCENTRATION_UNITS.filter((entry) => entry.offered).map((entry) => entry.unit);
    throw new Error(
      `The unit of ${describeValue(name)} must be one of ${offered.join(", ")}, but got ${describeValue(unit)}.`,
    );
  }
  return { name, amount, unit };
}

// The configuration's entry for the unit with symbol `unit`. Throws for an unknown unit.
function findUnit(unit) {
  const entry = CONCENTRATION_UNITS.find((candidate) => candidate.unit === unit);
  if (!entry) {
    throw new Error(`${describeValue(unit)} isn't a concentration unit.`);
  }
  return entry;
}

// The configuration's entries for `family`, in the configuration's order (largest to smallest).
// Throws for an unknown family.
function unitsInFamily(family) {
  const units = CONCENTRATION_UNITS.filter((entry) => entry.family === family);
  if (units.length === 0) {
    throw new Error(`${describeValue(family)} isn't a family of concentration units.`);
  }
  return units;
}
