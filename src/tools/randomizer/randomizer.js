// randomizer.js — the randomizer's logic: checking the inputs, placing and opening fixed wells,
// assigning the conditions' replicates to random open wells, matching a result to its inputs, and
// building the two output lists and their copy text.
//
// It contains no screen code, so it can be tested in Node. The page (randomizer-page.js) reads the
// inputs from the screen, calls these functions and draws the results.
// Specification: randomizer.md.

import { describeValue } from "../../shared/error-messages/error-messages.js";
import { GRID_96 } from "../../shared/well-grid/well-grid.js";
import { Layout } from "../../shared/layout/layout.js";
import {
  assignPool,
  randomSeed,
  MAX_SEED,
  isMissing,
  isValidReplicateCount,
} from "../../shared/random-pool/random-pool.js";
import { WellSelection } from "../../shared/well-selection/well-selection.js";

// randomSeed moved to the shared random-pool module, so both tools share it; it's re-exported here
// so the randomizer's interface doesn't change (section 4).
export { randomSeed };

// The smallest seed allowed, set by the specification (section 4); the largest is random-pool's
// MAX_SEED.
const SMALLEST_SEED = 1;

// The fixed well type (section 3), as recorded in a result's wellTypes. The other two types,
// "replicate" and "filler", come from assignPool.
const FIXED = "fixed";

// --- Checking the inputs ---

// Every problem with the inputs, as a list of messages in the order of section 7's table, followed
// by any wells in two entries, or [] if there are none,
// e.g. ["Row 3: the condition name is empty.", "Fixed contents 2 is placed on the plate but has no name."].
export function findProblems(inputs) {
  return [
    ...conditionProblems(inputs.conditions),
    ...openWellProblems(inputs),
    ...fixedContentsProblems(inputs.fixedContents),
    ...fillerProblems(inputs.filler),
    ...seedProblems(inputs.seed),
    ...wellsInTwoEntriesProblems(inputs.fixedContents),
  ];
}

// The problems with the condition list, row by row; within a row, in the order of section 7's table.
// A duplicate is reported on the later row, naming the row where the name first appears.
function conditionProblems(conditions) {
  const problems = [];
  const earlierIndexes = earlierIndexesOfSameName(conditions.map(({ name }) => name));
  conditions.forEach(({ name, replicates }, index) => {
    // A completely empty row is skipped (section 4), but still counts for the row numbers.
    if (isEmptyRow({ name, replicates })) {
      return;
    }
    // Rows are numbered from 1, as the user sees them in the table.
    const row = index + 1;
    if (isBlank(name)) {
      problems.push(`Row ${row}: the condition name is empty.`);
    } else if (hasSpaceAtEnds(name)) {
      problems.push(
        `Row ${row}: the condition name has a space at the start or end. Remove it.`,
      );
    }
    if (isMissing(replicates)) {
      problems.push(`Row ${row}: the number of replicates is missing.`);
    } else if (!isValidReplicateCount(replicates)) {
      problems.push(
        `Row ${row}: replicates must be a whole number of at least 1, ` +
          `but got ${describeValue(replicates)}.`,
      );
    }
    if (earlierIndexes[index] !== null) {
      problems.push(
        `Row ${row}: ${describeValue(name)} is already listed in row ${earlierIndexes[index] + 1}.`,
      );
    }
  });
  return problems;
}

// The problem with the number of open wells, if any: too few for the replicates, or spare wells
// with no filler named. Nothing is reported while any replicate count is invalid, because the
// number of replicates needed isn't known yet (the invalid count is reported on its own row).
function openWellProblems({ conditions: allConditions, fixedContents, filler }) {
  const conditions = filledConditions(allConditions);
  if (!conditions.every(({ replicates }) => isValidReplicateCount(replicates))) {
    return [];
  }
  const needed = totalReplicates(conditions);
  const open = openWellNames(fixedContents).length;
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

// The problems with the fixed-contents entries, entry by entry; within an entry, in the order of
// section 7's table. Entries are numbered from 1 in the order listed. An entry with no wells and
// no name is allowed (section 4).
function fixedContentsProblems(fixedContents) {
  const problems = [];
  const earlierIndexes = earlierIndexesOfSameName(fixedContents.map(({ name }) => name));
  fixedContents.forEach(({ name, wells }, index) => {
    const number = index + 1;
    if (isBlank(name)) {
      if (wells.selectedWells().length > 0) {
        problems.push(`Fixed contents ${number} is placed on the plate but has no name.`);
      }
    } else if (hasSpaceAtEnds(name)) {
      problems.push(`Fixed contents ${number} has a space at the start or end. Remove it.`);
    }
    if (earlierIndexes[index] !== null) {
      problems.push(
        `Fixed contents ${number}: ${describeValue(name)} is already listed in ` +
          `fixed contents ${earlierIndexes[index] + 1}.`,
      );
    }
  });
  return problems;
}

// The problem with the filler, if any: a name with a space at the start or end. (A missing filler
// is reported by openWellProblems, because whether one is needed depends on the open wells.)
function fillerProblems(filler) {
  if (!isBlank(filler) && hasSpaceAtEnds(filler)) {
    return ["The filler has a space at the start or end. Remove it."];
  }
  return [];
}

// The problem with the seed, if any: it must be there, and be a whole number from 1 to 999,999.
function seedProblems(seed) {
  if (isMissing(seed)) {
    return ["The seed is missing."];
  }
  if (Number.isInteger(seed) && seed >= SMALLEST_SEED && seed <= MAX_SEED) {
    return [];
  }
  return [
    `The seed must be a whole number from 1 to ${MAX_SEED.toLocaleString("en-US")}, ` +
      `but got ${describeValue(seed)}.`,
  ];
}

// The safety net (section 7): one message per well that is in more than one entry, in standard
// well order, e.g. 'A1 is in two fixed contents: "Static" and "Blank".' placeName and openWells
// never let this happen, so it can only come from entries built some other way.
// If a well is in three or more entries, the message names the first two.
function wellsInTwoEntriesProblems(fixedContents) {
  const problems = [];
  for (const [well, entries] of entriesByWell(fixedContents)) {
    if (entries.length > 1) {
      const [first, second] = entries;
      problems.push(
        `${well} is in two fixed contents: ${describeValue(first.name)} and ` +
          `${describeValue(second.name)}.`,
      );
    }
  }
  return problems;
}

// For each name in a list, the index of an earlier copy of the same name, or null if there is none
// or the name is blank (a blank name is reported as empty, not as a duplicate),
// e.g. ["A", "B", "A", ""] → [null, null, 0, null].
function earlierIndexesOfSameName(names) {
  const firstIndexByName = new Map();
  return names.map((name, index) => {
    if (isBlank(name)) {
      return null;
    }
    if (firstIndexByName.has(name)) {
      return firstIndexByName.get(name);
    }
    firstIndexByName.set(name, index);
    return null;
  });
}

// --- Placing and opening wells ---

// Puts an entry's name in the given wells (section 4): each well is removed from every other entry,
// then added to `entry`, e.g. placeName(fixedContents, ["A2"], fixedContents[0]).
// Changes the entries' selections in place. Throws, changing nothing, if `entry` isn't one of the
// fixed contents or any well name is invalid.
export function placeName(fixedContents, wells, entry) {
  // includes() compares objects by identity, so this checks it's the very same entry object.
  if (!fixedContents.includes(entry)) {
    throw new Error("The entry to place must be one of the fixed contents.");
  }
  checkWells(wells);
  openWells(fixedContents, wells);
  for (const well of wells) {
    entry.wells.select(well);
  }
}

// Makes the given wells open by removing each from every entry, e.g. openWells(fixedContents, ["A2"]).
// Changes the entries' selections in place. Throws, changing nothing, if any well name is invalid.
export function openWells(fixedContents, wells) {
  checkWells(wells);
  for (const entry of fixedContents) {
    for (const well of wells) {
      entry.wells.deselect(well);
    }
  }
}

// Throws the grid's own message for the first invalid well name, e.g. "I1". All wells are checked
// before anything changes, so a call with one bad well among good ones changes nothing.
function checkWells(wells) {
  for (const well of wells) {
    GRID_96.wellPosition(well);
  }
}

// --- Randomizing ---

// Assigns the conditions' replicates (and the filler) to random open wells, and each fixed well
// its entry's name. Returns the result: { layout, wellTypes, inputs }, e.g.
// wellTypes { A1: "fixed", A2: "replicate", … }, where inputs is a copy of the inputs used.
// Throws the first problem, if there are any. The inputs are never changed, and each call creates a
// new layout.
export function randomize(inputs) {
  const problems = findProblems(inputs);
  if (problems.length > 0) {
    throw new Error(problems[0]);
  }
  // Each assignment is [well, { name, type }]; a Map built from them looks up any well's assignment.
  const assignments = new Map([
    ...openWellAssignments(inputs),
    ...fixedWellAssignments(inputs.fixedContents),
  ]);
  const layout = new Layout(GRID_96);
  const wellTypes = {};
  // Filled in standard order, so wellTypes lists its wells in that order too.
  for (const well of GRID_96.wellNames()) {
    const { name, type } = assignments.get(well);
    layout.setContents(well, { name });
    wellTypes[well] = type;
  }
  return { layout, wellTypes, inputs: copyInputs(inputs) };
}

// The pool's key for the filler item (section 5). Condition items are keyed by row ("row 1" …), so
// this can't clash with one, even when a condition shares its name with the filler.
const FILLER_KEY = "filler";

// The open wells' assignments (section 5, steps 1–3), done by the shared random-pool module with
// the open wells as the pool, e.g.
// [["A2", { name: "Condition 7", type: "replicate" }], ["A3", { name: "Spare", type: "filler" }], …].
function openWellAssignments(inputs) {
  const { pool, nameByKey } = poolFor(inputs);
  return assignPool(pool).map(({ well, key, type }) => [well, { name: nameByKey.get(key), type }]);
}

// The pool for the open wells (section 5) and the name each of its keys stands for: an item per
// condition row that isn't completely empty, keyed by row number ("row 1" …), in row order; then,
// if a filler is named, the filler's item; the open wells in standard order; and the seed.
function poolFor({ conditions, fixedContents, filler, seed }) {
  const items = [];
  const nameByKey = new Map();
  conditions.forEach((condition, index) => {
    if (isEmptyRow(condition)) {
      return;
    }
    const key = `row ${index + 1}`;
    items.push({ key, replicates: condition.replicates });
    nameByKey.set(key, condition.name);
  });
  const hasFiller = !isBlank(filler);
  if (hasFiller) {
    items.push({ key: FILLER_KEY, replicates: null });
    nameByKey.set(FILLER_KEY, filler);
  }
  const pool = {
    items,
    filler: hasFiller ? FILLER_KEY : null,
    wells: openWellNames(fixedContents),
    seed,
  };
  return { pool, nameByKey };
}

// The fixed wells' assignments (section 5, step 4): each gets the name of its entry,
// e.g. [["A1", { name: "Static", type: "fixed" }], …]. findProblems has already checked that each
// fixed well is in exactly one entry.
function fixedWellAssignments(fixedContents) {
  return fixedContents.flatMap(({ name, wells }) =>
    wells.selectedWells().map((well) => [well, { name, type: FIXED }]),
  );
}

// A copy of the inputs, so later changes to them (e.g. placeName, or renaming an entry) don't change
// a result: the conditions are new objects, and each entry has a new WellSelection holding the same
// wells. The filler and seed are copied as they are.
function copyInputs({ conditions, fixedContents, filler, seed }) {
  return {
    conditions: conditions.map(({ name, replicates }) => ({ name, replicates })),
    fixedContents: fixedContents.map(({ name, wells }) => ({ name, wells: copySelection(wells) })),
    filler,
    seed,
  };
}

// A new WellSelection on the same grid with the same wells selected.
function copySelection(selection) {
  const copy = new WellSelection(selection.grid);
  for (const well of selection.selectedWells()) {
    copy.select(well);
  }
  return copy;
}

// --- Matching inputs ---

// True if `inputs` are exactly the inputs the result was made from (section 5): the same conditions
// (names, replicates and order), the same entries (names, wells and order), filler and seed.
export function matchesInputs(result, inputs) {
  const made = result.inputs;
  return (
    sameLists(made.conditions, inputs.conditions, sameCondition) &&
    sameLists(made.fixedContents, inputs.fixedContents, sameEntry) &&
    made.filler === inputs.filler &&
    made.seed === inputs.seed
  );
}

// True if two lists are the same length and each pair of items, in order, passes `sameItem`,
// e.g. sameLists([1, 2], [1, 2], (a, b) => a === b) → true.
function sameLists(first, second, sameItem) {
  return first.length === second.length && first.every((item, index) => sameItem(item, second[index]));
}

// True if two conditions have the same name and replicates.
function sameCondition(first, second) {
  return first.name === second.name && first.replicates === second.replicates;
}

// True if two fixed-contents entries have the same name and the same wells.
function sameEntry(first, second) {
  return (
    first.name === second.name &&
    sameLists(first.wells.selectedWells(), second.wells.selectedWells(), (a, b) => a === b)
  );
}

// --- Spare wells and random seeds ---

// The number of spare open wells (section 4): the open wells minus the total replicates, or 0 if
// the replicates don't fit; null while any replicate count isn't valid, because the total isn't
// known yet. e.g. the main example (60 open wells, 48 replicates) → 12.
export function spareWellCount({ conditions: allConditions, fixedContents }) {
  const conditions = filledConditions(allConditions);
  if (!conditions.every(({ replicates }) => isValidReplicateCount(replicates))) {
    return null;
  }
  const spare = openWellNames(fixedContents).length - totalReplicates(conditions);
  return Math.max(spare, 0);
}

// --- Output lists ---

// Every name in the inputs once, in listing order (section 6): conditions as listed, then the
// filler, then the fixed-contents entries as listed. Empty names are left out, and a shared name
// keeps the first role it appears in. Each comes with its role and its position in that role's list,
// e.g. [{ name: "Condition 1", role: "condition", position: 0 }, { name: "Spare", role: "filler", position: 0 }, …].
export function listingOrder({ conditions, filler, fixedContents }) {
  const candidates = [
    ...conditions.map(({ name }, position) => ({ name, role: "condition", position })),
    { name: filler, role: "filler", position: 0 },
    ...fixedContents.map(({ name }, position) => ({ name, role: "fixed", position })),
  ];
  const listedNames = new Set();
  return candidates.filter(({ name }) => {
    if (isBlank(name) || listedNames.has(name)) {
      return false;
    }
    listedNames.add(name);
    return true;
  });
}

// The contents → wells list: each distinct contents with its wells in standard order,
// e.g. [{ contents: "Condition 1", wells: ["B4", "D9", "F2", "G7"] }, …], in listing order, taken
// from the result's copy of the inputs. A name that no well holds (e.g. an entry with no wells) isn't
// listed.
export function contentsToWells(result) {
  const wellsByContents = new Map();
  for (const { well, contents } of wellToContents(result)) {
    if (!wellsByContents.has(contents)) {
      wellsByContents.set(contents, []);
    }
    wellsByContents.get(contents).push(well);
  }
  return listingOrder(result.inputs)
    .filter(({ name }) => wellsByContents.has(name))
    .map(({ name }) => ({ contents: name, wells: wellsByContents.get(name) }));
}

// The well → contents list: every well in standard order with the name of its contents,
// e.g. [{ well: "A1", contents: "Static" }, { well: "A2", contents: "Condition 7" }, …].
export function wellToContents(result) {
  return result.layout.listWells().map(({ well, contents }) => ({ well, contents: contents.name }));
}

// --- Copy text ---

// The contents → wells list as tab-separated text with no header row, one line per contents, its
// wells in one cell, e.g. "Condition 1\tB4, D9, F2, G7\nCondition 2\t…".
export function contentsToWellsText(result) {
  const rows = contentsToWells(result).map(({ contents, wells }) => [contents, wells.join(", ")]);
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

// For each fixed well, the entries that hold it, in standard well order,
// e.g. Map { "A1" → [the Static entry], … }. Normally one entry per well; more is a problem.
function entriesByWell(fixedContents) {
  const entriesByWellName = new Map();
  for (const well of GRID_96.wellNames()) {
    const entries = fixedContents.filter(({ wells }) => wells.isSelected(well));
    if (entries.length > 0) {
      entriesByWellName.set(well, entries);
    }
  }
  return entriesByWellName;
}

// The open wells, those in no entry, in standard order, e.g. ["B2", "B3", …].
function openWellNames(fixedContents) {
  const fixedWells = entriesByWell(fixedContents);
  return GRID_96.wellNames().filter((well) => !fixedWells.has(well));
}

// True if a name is missing: not text, empty, or only whitespace (as in the layout module, a name
// needs at least one character that isn't a space). e.g. isBlank("   ") → true.
// Non-text is treated as missing rather than crashing, as a safety net.
function isBlank(name) {
  return typeof name !== "string" || name.trim() === "";
}

// True if text has whitespace (a space, tab or line break) at the start or end,
// e.g. hasSpaceAtEnds(" Spare") → true. trim() removes it from both ends, so the text changes.
function hasSpaceAtEnds(text) {
  return text !== text.trim();
}

// True if a condition row is completely empty: no name and missing replicates (section 4),
// e.g. { name: "", replicates: "" } → true, { name: "", replicates: 4 } → false.
function isEmptyRow({ name, replicates }) {
  return isBlank(name) && isMissing(replicates);
}

// The conditions without completely empty rows, in order. The empty rows are skipped when counting
// and placing replicates, so they never change the plate.
function filledConditions(conditions) {
  return conditions.filter((condition) => !isEmptyRow(condition));
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
