// assign.js — the randomizer's core: check the inputs, shuffle the replicates and filler with the
// seed, and fill the open wells of a layout. Fixed wells get the fixed contents or an override.
// Specification: assign.md (and randomizer.md sections 5 and 7).

import { describeValue } from "../../shared/error-messages/error-messages.js";
import { Layout } from "../../shared/layout/layout.js";
import { SeededRandom } from "../../shared/random/random.js";
import { WellSelection } from "../../shared/well-selection/well-selection.js";

// The four well types every well in the result has (randomizer.md section 3).
export const WELL_TYPES = Object.freeze({
  REPLICATE: "replicate",
  FILLER: "filler",
  FIXED_CONTENTS: "fixed-contents",
  OVERRIDE: "override",
});

// The seeds the randomizer accepts (randomizer.md section 4). The generator itself accepts more.
const SMALLEST_SEED = 1;
const LARGEST_SEED = 999999;

// Returns every problem with the inputs as a list of messages, in the order of assign.md section 5,
// e.g. ["Row 3: the condition name is empty.", "Name the contents of the fixed wells."].
// Returns [] if the inputs can be randomized.
export function findProblems(inputs) {
  checkStructure(inputs);
  const cleaned = cleanInputs(inputs);
  const conditionProblems = findConditionProblems(cleaned.conditions);
  return [
    ...conditionProblems,
    ...findOverrideProblems(cleaned.overrides, inputs.fixedWells),
    ...(conditionProblems.length === 0 ? findCountProblems(cleaned, inputs.fixedWells) : []),
    ...findFixedContentsProblems(cleaned, inputs.fixedWells),
    ...findSeedProblems(inputs.seed),
  ];
}

// Randomizes the plate, e.g. randomize(inputs) → { layout, wellTypes, seed }.
// Throws an Error whose message is the first problem, if there are any.
export function randomize(inputs) {
  const problems = findProblems(inputs);
  if (problems.length > 0) {
    throw new Error(problems[0]);
  }
  const cleaned = cleanInputs(inputs);
  const grid = inputs.fixedWells.grid;
  const layout = new Layout(grid);
  const wellTypes = new Map();

  const openWells = inputs.fixedWells.unselectedWells();
  const items = new SeededRandom(inputs.seed).shuffled(buildItems(cleaned, openWells.length));
  openWells.forEach((well, index) => {
    layout.setContents(well, { name: items[index].name });
    wellTypes.set(well, items[index].type);
  });

  const overrideByWell = new Map(cleaned.overrides.map((row) => [row.well, row.name]));
  for (const well of inputs.fixedWells.selectedWells()) {
    if (overrideByWell.has(well)) {
      layout.setContents(well, { name: overrideByWell.get(well) });
      wellTypes.set(well, WELL_TYPES.OVERRIDE);
    } else {
      layout.setContents(well, { name: cleaned.fixedContents });
      wellTypes.set(well, WELL_TYPES.FIXED_CONTENTS);
    }
  }
  return { layout, wellTypes, seed: inputs.seed };
}

// --- Helpers used only inside this module ---

// Throws if the inputs aren't shaped as assign.md section 2 describes. These are programming
// mistakes in the code calling this module, not user mistakes, so they aren't listed as problems.
function checkStructure(inputs) {
  if (!(inputs?.fixedWells instanceof WellSelection)) {
    throw new Error(`fixedWells must be a WellSelection, but got ${describeValue(inputs?.fixedWells)}.`);
  }
  for (const property of ["conditions", "overrides"]) {
    if (!Array.isArray(inputs[property])) {
      throw new Error(`${property} must be a list, but got ${describeValue(inputs[property])}.`);
    }
  }
}

// Returns a copy of the inputs with every name trimmed, e.g. " Static " → "Static".
// Non-text names are kept as they are, so they can be reported.
function cleanInputs(inputs) {
  return {
    conditions: inputs.conditions.map((row) => ({
      name: trimIfText(row?.name),
      replicates: row?.replicates,
    })),
    overrides: inputs.overrides.map((row) => ({
      well: trimIfText(row?.well),
      name: trimIfText(row?.name),
    })),
    fixedContents: trimIfText(inputs.fixedContents ?? ""),
    filler: trimIfText(inputs.filler ?? ""),
  };
}

// Removes whitespace from both ends of text; leaves anything else unchanged, e.g. " A " → "A".
function trimIfText(value) {
  return typeof value === "string" ? value.trim() : value;
}

// True if `value` is text with at least one character, e.g. "Static" → true, "" → false.
function isFilledText(value) {
  return typeof value === "string" && value !== "";
}

// Problems with the condition rows: empty names, bad replicates and duplicate names.
function findConditionProblems(conditions) {
  const problems = [];
  const rowByName = new Map();
  conditions.forEach(({ name, replicates }, index) => {
    const row = index + 1;
    if (!isFilledText(name)) {
      problems.push(`Row ${row}: the condition name is empty.`);
    }
    if (!Number.isInteger(replicates) || replicates < 1) {
      problems.push(
        `Row ${row}: replicates must be a whole number of at least 1, but got ${describeValue(replicates)}.`,
      );
    }
    if (isFilledText(name)) {
      if (rowByName.has(name)) {
        problems.push(`Row ${row}: ${describeValue(name)} is already listed in row ${rowByName.get(name)}.`);
      } else {
        rowByName.set(name, row);
      }
    }
  });
  return problems;
}

// Problems with the override rows: wells not on the grid or not fixed, a well overridden twice,
// and empty contents.
function findOverrideProblems(overrides, fixedWells) {
  const problems = [];
  const rowByWell = new Map();
  overrides.forEach(({ well, name }, index) => {
    const label = `Override row ${index + 1}`;
    const wellProblem = findWellProblem(well, fixedWells);
    if (wellProblem !== null) {
      problems.push(`${label}: ${wellProblem}`);
    } else if (rowByWell.has(well)) {
      problems.push(`${label}: ${well} is already overridden in row ${rowByWell.get(well)}.`);
    } else {
      rowByWell.set(well, index + 1);
    }
    if (!isFilledText(name)) {
      problems.push(`${label}: the contents name is empty.`);
    }
  });
  return problems;
}

// The problem with an override's well, or null if it's a fixed well on the grid,
// e.g. "D4 isn't a fixed well. Fix it, or remove the override."
function findWellProblem(well, fixedWells) {
  try {
    if (!fixedWells.isSelected(well)) {
      return `${well} isn't a fixed well. Fix it, or remove the override.`;
    }
    return null;
  } catch (error) {
    // isSelected throws the grid's own message for a well name that isn't valid.
    return error.message;
  }
}

// Problems with how the replicates fit the open wells: too many replicates, or spare wells with
// no filler. Only called when every condition row is valid, so the replicates can be added up.
function findCountProblems(cleaned, fixedWells) {
  const openCount = fixedWells.unselectedWells().length;
  const replicateCount = totalReplicates(cleaned.conditions);
  if (replicateCount > openCount) {
    const extra = replicateCount - openCount;
    return [
      `The conditions need ${count(replicateCount, "well")}, but only ${openCount} ` +
        `${openCount === 1 ? "is" : "are"} open. Remove ${count(extra, "replicate")} or open ` +
        `${count(extra, "more well")}.`,
    ];
  }
  const spare = openCount - replicateCount;
  if (spare > 0 && !isFilledText(cleaned.filler)) {
    return spare === 1
      ? ["1 open well is left over. Name a filler for it."]
      : [`${spare} open wells are left over. Name a filler for them.`];
  }
  return [];
}

// The problem if some fixed well has no override and no fixed contents were named.
function findFixedContentsProblems(cleaned, fixedWells) {
  const overridden = new Set(cleaned.overrides.map((row) => row.well));
  const needsContents = fixedWells.selectedWells().some((well) => !overridden.has(well));
  return needsContents && !isFilledText(cleaned.fixedContents)
    ? ["Name the contents of the fixed wells."]
    : [];
}

// The problem with the seed, if it isn't a whole number from 1 to 999,999.
function findSeedProblems(seed) {
  if (Number.isInteger(seed) && seed >= SMALLEST_SEED && seed <= LARGEST_SEED) {
    return [];
  }
  return [`The seed must be a whole number from 1 to 999,999, but got ${describeValue(seed)}.`];
}

// The total number of replicates, e.g. two conditions with 4 each → 8.
function totalReplicates(conditions) {
  return conditions.reduce((sum, row) => sum + row.replicates, 0);
}

// A count with its noun, singular for 1, e.g. count(1, "well") → "1 well", count(4, "well") → "4 wells".
function count(number, noun) {
  return number === 1 ? `1 ${noun}` : `${number} ${noun}s`;
}

// The items to place in the open wells, before shuffling: each condition repeated by its
// replicates in listed order, then the filler for each spare well, e.g.
// [{ name: "Condition 1", type: "replicate" }, …, { name: "Spare", type: "filler" }].
function buildItems(cleaned, openCount) {
  const replicates = cleaned.conditions.flatMap((row) =>
    Array.from({ length: row.replicates }, () => ({ name: row.name, type: WELL_TYPES.REPLICATE })),
  );
  const filler = Array.from({ length: openCount - replicates.length }, () => ({
    name: cleaned.filler,
    type: WELL_TYPES.FILLER,
  }));
  return [...replicates, ...filler];
}
