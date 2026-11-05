// osmolality.js — works out a well's osmolality from the osmolalities of the components it holds.
//
// A component (docs/glossary.md) may have an osmolality: the measured osmolality of its stock, in
// mOsm/kg, as an osmometer gives it (ADR 0016). Contents tracking gives each component's share of
// a well (contents-tracking.md, volumeFractionsOf); this module turns those shares and the
// components' osmolalities into an estimate of the well's osmolality, the share-weighted sum, or
// says which components have no value, so none can be given. A missing value is never silently
// left out (ADR 0016).
//
// It's a module of its own rather than part of concentrations: osmolality isn't a constituent, and
// has no constituent names, units or families. It never changes its inputs.
// Specification: osmolality.md.

import { describeValue } from "../error-messages/error-messages.js";

// Checks a component's osmolality: returns if it's null (none) or a finite number 0 or more, and
// throws otherwise, naming the component, e.g. checkOsmolality(300, "Media") returns, and
// checkOsmolality(-5, "Media") throws. There's no upper limit (osmolality.md, section 2).
export function checkOsmolality(osmolality, componentName) {
  if (osmolality === null) {
    return;
  }
  if (!Number.isFinite(osmolality) || osmolality < 0) {
    throw new Error(
      `The osmolality of ${componentName} must be a number of mOsm/kg, 0 or more, like 300, or none if it isn't known, but got ${describeValue(osmolality)}.`,
    );
  }
}

// A well's osmolality from its `shares` (each component's volume fraction, by component name) and
// the plan's `components` (each { name, osmolality, … }): { value, missing }. `missing` names the
// held components with no osmolality (in the order of `components`), then any held share that
// isn't a component (in the shares' order); `value` is the share-weighted sum when nothing is
// missing and the well holds something, else null. A share of 0 counts as not held,
// e.g. wellOsmolality({ Media: 0.9, Water: 0.1 }, [{ name: "Media", osmolality: 300 },
// { name: "Water", osmolality: 0 }]) → { value: 270, missing: [] }.
export function wellOsmolality(shares, components) {
  const missing = [];
  let sum = 0;
  let holdsSomething = false;
  for (const component of components) {
    const share = shares[component.name] ?? 0;
    if (share <= 0) {
      continue;
    }
    holdsSomething = true;
    if (hasOsmolality(component)) {
      sum += share * component.osmolality;
    } else {
      missing.push(component.name);
    }
  }
  const componentNames = new Set(components.map((component) => component.name));
  for (const [name, share] of Object.entries(shares)) {
    if (share > 0 && !componentNames.has(name)) {
      holdsSomething = true;
      missing.push(name);
    }
  }
  const value = holdsSomething && missing.length === 0 ? sum : null;
  return { value, missing };
}

// --- Helpers used only inside this module ---

// Whether `component` has an osmolality: its `osmolality` is neither null nor absent (0 counts as
// a value), e.g. hasOsmolality({ name: "Water", osmolality: 0 }) → true.
function hasOsmolality(component) {
  return component.osmolality !== null && component.osmolality !== undefined;
}
