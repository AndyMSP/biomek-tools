// randomizer.js — the randomizer's logic: checking the inputs, assigning the conditions' replicates
// to random open wells, and building the two output lists and their copy text.
//
// It contains no screen code, so it can be tested in Node. The page (randomizer-page.js) reads the
// inputs from the screen, calls these functions and draws the results.
// Specification: randomizer.md.

import { describeValue } from "../../shared/error-messages/error-messages.js";
import { GRID_96 } from "../../shared/well-grid/well-grid.js";
import { Layout } from "../../shared/layout/layout.js";
import { SeededRandom } from "../../shared/random/random.js";

// The range of seeds the user may enter, set by the specification (section 4).
const SMALLEST_SEED = 1;
const LARGEST_SEED = 999999;

// The four well types (section 3), as recorded in a result's wellTypes.
const REPLICATE = "replicate";
const FILLER = "filler";
const FIXED_CONTENTS = "fixed-contents";
const OVERRIDE = "override";

// --- Checking the inputs ---

// Every problem with the inputs, as a list of messages in the order of section 7's tables, or []
// if there are none, e.g. ["Row 3: the condition name is empty.", "Name the contents of the fixed wells."].
export function findProblems(inputs) {
  return [
    ...conditionProblems(inputs.conditions),
    ...openWellProblems(inputs),
    ...fixedContentsProblems(inputs),
    ...fillerProblems(inputs.filler),
    ...seedProblems(inputs.seed),
    ...overrideProblems(inputs),
  ];
}

// The problems with the condition list, row by row; within a row, in the order of section 7's table.
// A duplicate is reported on the later row, naming the row where the name first appears.
function conditionProblems(conditions) {
  const problems = [];
  const firstRowByName = new Map();
  conditions.forEach(({ name, replicates }, index) => {
    // Rows are numbered from 1, as the user sees them in the table.
    const row = index + 1;
    if (isBlank(name)) {
      problems.push(`Row ${row}: the condition name is empty.`);
    } else if (hasSpaceAtEnds(name)) {
      problems.push(
        `Row ${row}: the condition name has a space at the start or end. Remove it.`,
      );
    }
    if (!isValidReplicateCount(replicates)) {
      problems.push(
        `Row ${row}: replicates must be a whole number of at least 1, ` +
          `but got ${describeValue(replicates)}.`,
      );
    }
    // An empty name is already reported above, so it isn't also reported as a duplicate.
    if (!isBlank(name)) {
      if (firstRowByName.has(name)) {
        problems.push(
          `Row ${row}: ${describeValue(name)} is already listed in row ${firstRowByName.get(name)}.`,
        );
      } else {
        firstRowByName.set(name, row);
      }
    }
  });
  return problems;
}

// The problem with the number of open wells, if any: too few for the replicates, or spare wells
// with no filler named. Nothing is reported while any replicate count is invalid, because the
// number of replicates needed isn't known yet (the invalid count is reported on its own row).
function openWellProblems({ conditions, fixedWells, filler }) {
  if (!conditions.every(({ replicates }) => isValidReplicateCount(replicates))) {
    return [];
  }
  const needed = totalReplicates(conditions);
  const open = fixedWells.unselectedWells().length;
  if (needed > open) {
    const excess = needed - open;
    return [
      `The conditions need ${countOf(needed, "well")}, but only ${open} ${open === 1 ? "is" : "are"} ` +
        `open. Remove ${countOf(excess, "replicate")} or open ${countOf(excess, "more well")}.`,
    ];
  }
  const spare = open - needed;
  if (spare > 0 && isBlank(filler)) {
    return [
      spare === 1
        ? "1 open well is left over. Name a filler for it."
        : `${spare} open wells are left over. Name a filler for them.`,
    ];
  }
  return [];
}

// The problem with the fixed contents, if any: missing although a fixed well needs it, or a name
// with a space at the start or end.
function fixedContentsProblems({ fixedWells, overrides, fixedContents }) {
  if (isBlank(fixedContents)) {
    return hasFixedWellWithoutOverride(fixedWells, overrides)
      ? ["Name the contents of the fixed wells."]
      : [];
  }
  if (hasSpaceAtEnds(fixedContents)) {
    return ["The fixed contents have a space at the start or end. Remove it."];
  }
  return [];
}

// The problem with the filler, if any: a name with a space at the start or end. (A missing filler
// is reported by openWellProblems, because whether one is needed depends on the open wells.)
function fillerProblems(filler) {
  if (!isBlank(filler) && hasSpaceAtEnds(filler)) {
    return ["The filler has a space at the start or end. Remove it."];
  }
  return [];
}

// The problem with the seed, if any: it must be a whole number from 1 to 999,999.
function seedProblems(seed) {
  if (Number.isInteger(seed) && seed >= SMALLEST_SEED && seed <= LARGEST_SEED) {
    return [];
  }
  return [`The seed must be a whole number from 1 to 999,999, but got ${describeValue(seed)}.`];
}

// The problems with the overrides, override by override; within an override, in the order of
// section 7's second table. The page prevents all of these, so this is a safety net.
// A well overridden several times is reported once, at its second override.
function overrideProblems({ overrides, fixedWells }) {
  const problems = [];
  const timesSeenByWell = new Map();
  for (const { well, name } of overrides) {
    const wellProblem = overrideWellProblem(well, fixedWells);
    if (wellProblem !== null) {
      problems.push(wellProblem);
    } else {
      const timesSeen = (timesSeenByWell.get(well) ?? 0) + 1;
      timesSeenByWell.set(well, timesSeen);
      if (timesSeen === 2) {
        problems.push(`${well} is overridden more than once.`);
      }
    }
    if (isBlank(name)) {
      problems.push(`The override for ${well} has no name.`);
    } else if (hasSpaceAtEnds(name)) {
      problems.push(`The override for ${well} has a space at the start or end. Remove it.`);
    }
  }
  return problems;
}

// The problem with an override's well, or null if there is none: the well must be on the grid and
// fixed, e.g. "D4 has an override but isn't a fixed well."
function overrideWellProblem(well, fixedWells) {
  // wellPosition() throws the grid's own message for a well that isn't on the grid, and the spec
  // asks for that message, so it's caught and returned rather than written again here.
  try {
    fixedWells.grid.wellPosition(well);
  } catch (error) {
    return error.message;
  }
  if (!fixedWells.isSelected(well)) {
    return `${well} has an override but isn't a fixed well.`;
  }
  return null;
}

// True if some fixed well has no override, so it needs the fixed contents.
function hasFixedWellWithoutOverride(fixedWells, overrides) {
  const overriddenWells = new Set(overrides.map(({ well }) => well));
  return fixedWells.selectedWells().some((well) => !overriddenWells.has(well));
}

// --- Randomizing ---

// Assigns the conditions' replicates (and the filler) to random open wells, and the fixed contents
// and overrides to the fixed wells. Returns the result: { layout, wellTypes, seed }, e.g.
// wellTypes { A1: "fixed-contents", A2: "replicate", … }. Throws the first problem, if there are any.
// The inputs are never changed, and each call creates a new layout.
export function randomize(inputs) {
  const problems = findProblems(inputs);
  if (problems.length > 0) {
    throw new Error(problems[0]);
  }
  // Each assignment is [well, { name, type }]; a Map built from them looks up any well's assignment.
  const assignments = new Map([...openWellAssignments(inputs), ...fixedWellAssignments(inputs)]);
  const layout = new Layout(GRID_96);
  const wellTypes = {};
  // Filled in standard order, so wellTypes lists its wells in that order too.
  for (const well of GRID_96.wellNames()) {
    const { name, type } = assignments.get(well);
    layout.setContents(well, { name });
    wellTypes[well] = type;
  }
  return { layout, wellTypes, seed: inputs.seed };
}

// The open wells' assignments (section 5, steps 1–3): the items to place are shuffled with the
// seed, then dealt to the open wells in standard order,
// e.g. [["A2", { name: "Condition 7", type: "replicate" }], ["A3", { name: "Spare", type: "filler" }], …].
function openWellAssignments({ conditions, filler, fixedWells, seed }) {
  const openWells = fixedWells.unselectedWells();
  const items = itemsToPlace(conditions, filler, openWells.length);
  const shuffledItems = new SeededRandom(seed).shuffled(items);
  return openWells.map((well, index) => [well, shuffledItems[index]]);
}

// The list of items to place, before shuffling: each condition repeated by its number of
// replicates, in list order, then the filler once for each spare open well,
// e.g. 2 replicates of "Condition 1" in 3 open wells → Condition 1, Condition 1, Spare.
function itemsToPlace(conditions, filler, openWellCount) {
  const items = [];
  for (const { name, replicates } of conditions) {
    for (let copy = 1; copy <= replicates; copy++) {
      items.push({ name, type: REPLICATE });
    }
  }
  const spareWellCount = openWellCount - items.length;
  for (let copy = 1; copy <= spareWellCount; copy++) {
    items.push({ name: filler, type: FILLER });
  }
  return items;
}

// The fixed wells' assignments (section 5, step 4): each gets its override if it has one, and the
// fixed contents otherwise, e.g. [["A1", { name: "Override 1", type: "override" }], …].
function fixedWellAssignments({ fixedWells, overrides, fixedContents }) {
  const overrideNameByWell = new Map(overrides.map(({ well, name }) => [well, name]));
  return fixedWells.selectedWells().map((well) => {
    if (overrideNameByWell.has(well)) {
      return [well, { name: overrideNameByWell.get(well), type: OVERRIDE }];
    }
    return [well, { name: fixedContents, type: FIXED_CONTENTS }];
  });
}

// --- Output lists ---

// The contents → wells list: each distinct contents with its wells in standard order,
// e.g. [{ contents: "Condition 1", wells: ["B4", "D9", "F2", "G7"] }, …]. Listed as section 6 says:
// conditions as listed, then the filler, then the fixed contents, then the overrides, with each name
// once. A name that no well holds (e.g. a filler when there are no spare wells) isn't listed.
export function contentsToWells(inputs, result) {
  const wellsByContents = new Map();
  for (const { well, contents } of wellToContents(result)) {
    if (!wellsByContents.has(contents)) {
      wellsByContents.set(contents, []);
    }
    wellsByContents.get(contents).push(well);
  }
  return contentsInListingOrder(inputs)
    .filter((contents) => wellsByContents.has(contents))
    .map((contents) => ({ contents, wells: wellsByContents.get(contents) }));
}

// Every name in the inputs in the order section 6 lists them, each once,
// e.g. ["Condition 1", "Condition 2", "Spare", "Static", "Override 1"].
// A Set keeps only the first copy of each name and remembers the order they were added in.
function contentsInListingOrder({ conditions, filler, fixedContents, overrides }) {
  const names = [
    ...conditions.map(({ name }) => name),
    filler,
    fixedContents,
    ...overrides.map(({ name }) => name),
  ];
  return [...new Set(names)];
}

// The well → contents list: every well in standard order with the name of its contents,
// e.g. [{ well: "A1", contents: "Static" }, { well: "A2", contents: "Condition 7" }, …].
export function wellToContents(result) {
  return result.layout.listWells().map(({ well, contents }) => ({ well, contents: contents.name }));
}

// --- Copy text ---

// The contents → wells list as tab-separated text with no header row, one line per contents, its
// wells in one cell, e.g. "Condition 1\tB4, D9, F2, G7\nCondition 2\t…".
export function contentsToWellsText(inputs, result) {
  const rows = contentsToWells(inputs, result).map(({ contents, wells }) => [
    contents,
    wells.join(", "),
  ]);
  return toTabSeparatedText(rows);
}

// The well → contents list as tab-separated text with no header row, one line per well,
// e.g. "A1\tStatic\nA2\tCondition 7\n…".
export function wellToContentsText(result) {
  const rows = wellToContents(result).map(({ well, contents }) => [well, contents]);
  return toTabSeparatedText(rows);
}

// Joins rows of cells into text that pastes into Excel as columns: cells separated by tabs, rows by
// line breaks, e.g. [["A1", "Static"], ["A2", "PBS"]] → "A1\tStatic\nA2\tPBS".
function toTabSeparatedText(rows) {
  return rows.map((cells) => cells.join("\t")).join("\n");
}

// --- Small helpers ---

// True if a name is missing: not text, empty, or only whitespace (as in the layout module, a name
// needs at least one character that isn't a space). e.g. isBlank("   ") → true.
// Non-text is treated as missing rather than crashing, as a safety net; the page always passes text.
function isBlank(name) {
  return typeof name !== "string" || name.trim() === "";
}

// True if text has whitespace (a space, tab or line break) at the start or end,
// e.g. hasSpaceAtEnds(" Spare") → true. trim() removes it from both ends, so the text changes.
function hasSpaceAtEnds(text) {
  return text !== text.trim();
}

// True if a replicate count is a whole number of at least 1, e.g. 4 → true; 0, 1.5, "four" → false.
function isValidReplicateCount(replicates) {
  return Number.isInteger(replicates) && replicates >= 1;
}

// The total number of replicates in the condition list, e.g. 12 conditions × 4 → 48.
function totalReplicates(conditions) {
  return conditions.reduce((total, { replicates }) => total + replicates, 0);
}

// A count with its noun, made plural when the count isn't 1,
// e.g. countOf(1, "replicate") → "1 replicate", countOf(4, "more well") → "4 more wells".
function countOf(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
