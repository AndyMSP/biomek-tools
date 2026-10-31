// contents-tracking.js — works out what each well contains after a series of operations.
//
// It starts from the contents of the wells before the first operation and replays the transfers of
// an operation list in order, assuming each well is well mixed. It records each well's components in
// microliters (µL), and reports three kinds of problem: a transfer that draws into its source's
// dead volume, one that asks for more than its source holds at all, and a well filled over its
// capacity; and which wells the draw problems reach. Capacities and dead volumes come from the deck
// module; labware the deck doesn't know has dead volume 0 and no capacity. It is a pure
// calculation: the same inputs always give the same result, and nothing passed in is changed.
// Specification: contents-tracking.md.

import { describeValue } from "../error-messages/error-messages.js";
import { hasLabware, capacityOf, deadVolumeOf } from "../deck/deck.js";
import {
  isObject,
  findMissingProperties,
  findExtraProperties,
  listNames,
  checkName,
  checkVolume,
} from "../input-checks/input-checks.js";
import { OperationList } from "../operation-list/operation-list.js";

// One picoliter, in µL. After a transfer, a well whose total volume is below this is treated as
// empty; a transfer may ask for up to this much more than its source's usable volume without being
// a problem; and a well may be over its capacity by up to this much without being overfilled. It is
// far smaller than anything a pipette can move, and far larger than the leftovers decimal
// arithmetic leaves (such as 0.1 + 0.2 - 0.3), so it separates the two (spec section 3).
const NEGLIGIBLE_MICROLITERS = 0.000001;

// Passed by replay to the ContentsSnapshot constructor. It isn't exported, so no other code can
// pass it, and so only replay can make a snapshot.
const MADE_BY_REPLAY = Symbol("made by replay");

// Checks the starting contents, then applies the first `operationCount` operations of
// `operationList` in order, and returns a ContentsSnapshot of the result. Leave out
// `operationCount` to apply every operation, e.g.
//   replay([{ labware: "Reagents", well: "A1", components: { Dye: 1000 } }], list)
//   replay(startingContents, list, 3)   // after the first 3 operations
export function replay(startingContents, operationList, operationCount) {
  checkStartingContents(startingContents);
  checkOperationList(operationList);
  const operations = operationList.listOperations();
  checkOperationCount(operationCount, operations.length);

  const count = operationCount === undefined ? operations.length : operationCount;
  const wells = createWells(startingContents);
  const problems = findStartingOverfills(wells);
  operations.slice(0, count).forEach((operation, operationIndex) => {
    // Version 1 has only transfers; other types, when added, are skipped unless they change what's
    // in a well (spec section 2).
    if (operation.type === "transfer") {
      applyTransfer(wells, problems, operation, operationIndex);
    }
  });
  return new ContentsSnapshot(MADE_BY_REPLAY, wells, problems);
}

// The contents, problems and affected wells at one moment. Made only by replay; it can't be changed
// afterwards, and every method returns new lists and objects, so changing what it returns doesn't
// change the snapshot.
export class ContentsSnapshot {
  // Private fields (# name): only code inside this class can read them.
  // Every well the snapshot knows about, keyed by wellKey: { labware, well, components, causes }.
  #wells;
  // The problems, in the order their operations occur.
  #problems;

  // Called only by replay, which hands over `wells` and `problems` and keeps no reference to them.
  // Calling new ContentsSnapshot() from anywhere else throws, because `madeBy` won't be
  // MADE_BY_REPLAY.
  constructor(madeBy, wells, problems) {
    if (madeBy !== MADE_BY_REPLAY) {
      throw new Error(
        "A ContentsSnapshot is made only by replay. Call replay(startingContents, operationList) instead.",
      );
    }
    this.#wells = wells;
    this.#problems = problems;
  }

  // The contents list, in the same shape as the starting contents, e.g.
  // [{ labware: "Plate 1", well: "A1", components: { Dye: 10, Media: 90 } }, …].
  listContents() {
    return [...this.#wells.values()].map((record) => ({
      labware: record.labware,
      well: record.well,
      components: { ...record.components },
    }));
  }

  // The problems list, in the order they occur, e.g.
  // [{ kind: "overdraw", operationIndex: 2, labware: "Plate 2", well: "D5", requested: 60,
  //    held: 50, deadVolume: 0, available: 50 }].
  listProblems() {
    return this.#problems.map((problem) => ({ ...problem }));
  }

  // The wells whose contents differ from the plan because of draw problems, e.g.
  // [{ labware: "Plate 2", well: "D7", causes: [2, 3] }].
  listAffected() {
    return [...this.#wells.values()]
      .filter((record) => record.causes.length > 0)
      .map((record) => ({ labware: record.labware, well: record.well, causes: [...record.causes] }));
  }

  // One well's components in µL, e.g. componentsOf("Plate 1", "A1") → { Dye: 10, Media: 90 }.
  // A well the snapshot has no record of gives {}.
  componentsOf(labware, well) {
    return { ...this.#findComponents(labware, well, "componentsOf") };
  }

  // One well's total volume in µL, e.g. totalVolumeOf("Plate 1", "A1") → 100.
  totalVolumeOf(labware, well) {
    return totalVolume(this.#findComponents(labware, well, "totalVolumeOf"));
  }

  // One well's usable volume in µL: its total minus its labware's dead volume, never below 0, and 0
  // when the difference is below NEGLIGIBLE_MICROLITERS, so a mixture drawn down to exactly the
  // dead volume reads as 0 despite arithmetic leftovers, e.g. a trough holding 2000.0000000000002
  // over a 2000 dead volume → 0. Callers take the usable volume from here rather than subtracting.
  usableVolumeOf(labware, well) {
    const held = totalVolume(this.#findComponents(labware, well, "usableVolumeOf"));
    const usable = usableVolume(held, deadVolumeOfLabware(labware));
    return usable < NEGLIGIBLE_MICROLITERS ? 0 : usable;
  }

  // Each component's share of one well, from 0 to 1, e.g. { Dye: 0.1, Media: 0.9 }.
  // An empty well gives {}.
  volumeFractionsOf(labware, well) {
    const components = this.#findComponents(labware, well, "volumeFractionsOf");
    const total = totalVolume(components);
    const fractions = {};
    // An empty well has no components, so the loop doesn't run and nothing is divided by 0.
    for (const [name, amount] of Object.entries(components)) {
      fractions[name] = amount / total;
    }
    return fractions;
  }

  // One well's causes, e.g. causesOf("Plate 2", "D7") → [2, 3], or [] if it isn't affected.
  causesOf(labware, well) {
    this.#checkWellNames(labware, well, "causesOf");
    const record = this.#wells.get(wellKey(labware, well));
    return record === undefined ? [] : [...record.causes];
  }

  // Checks `labware` and `well`, then returns that well's stored components, or {} if the snapshot
  // has no record of it. The result is the stored object, so callers copy it before returning it.
  // `methodName` names the public method for the error message.
  #findComponents(labware, well, methodName) {
    this.#checkWellNames(labware, well, methodName);
    const record = this.#wells.get(wellKey(labware, well));
    return record === undefined ? {} : record.components;
  }

  // Throws if `labware` or `well` isn't a valid name, labware first, with a message naming the
  // method, e.g. 'The well given to componentsOf must be text, but got undefined.'
  #checkWellNames(labware, well, methodName) {
    checkName(labware, `labware given to ${methodName}`);
    checkName(well, `well given to ${methodName}`);
  }
}

// --- Replaying (helpers used only inside this module) ---

// Builds the map of wells from valid starting contents. Each record is
// { labware, well, components, causes }, with its own copy of the components, leaving out any
// component whose volume is 0 (spec section 3).
function createWells(startingContents) {
  const wells = new Map();
  for (const entry of startingContents) {
    wells.set(wellKey(entry.labware, entry.well), {
      labware: entry.labware,
      well: entry.well,
      components: withoutZeros(entry.components),
      causes: [],
    });
  }
  return wells;
}

// The problems of the starting contents: an "overfill" with operationIndex null for each well that
// starts over its capacity, in the starting contents' order (spec section 3, "Problems").
function findStartingOverfills(wells) {
  const problems = [];
  for (const record of wells.values()) {
    const held = totalVolume(record.components);
    if (isOverCapacity(held, record.labware)) {
      problems.push(overfillProblem(null, record, held));
    }
  }
  return problems;
}

// Applies one transfer to `wells`, and adds to `problems` a draw problem if the transfer asks its
// source for more than its usable volume, then an overfill if it takes its destination over its
// capacity. `operationIndex` is the transfer's position in the operation list.
function applyTransfer(wells, problems, transfer, operationIndex) {
  // Every well a transfer names is listed afterwards, even a source that never held anything,
  // because a tip still went into it.
  const source = findOrAddWell(wells, transfer.source);
  const destination = findOrAddWell(wells, transfer.destination);
  const held = totalVolume(source.components);
  const deadVolume = deadVolumeOfLabware(source.labware);
  const available = usableVolume(held, deadVolume);

  if (transfer.volume > available + NEGLIGIBLE_MICROLITERS) {
    problems.push({
      // The tip would reach into the dead volume and draw air; if the well doesn't even hold what's
      // asked, it's an overdraw instead. Never both.
      kind: transfer.volume > held + NEGLIGIBLE_MICROLITERS ? "overdraw" : "dead-volume",
      operationIndex,
      labware: source.labware,
      well: source.well,
      requested: transfer.volume,
      held,
      deadVolume,
      available,
    });
    source.causes = combineCauses(source.causes, [operationIndex]);
  }
  // A transfer from an affected well passes on all of that well's causes, including one this
  // transfer just added.
  destination.causes = combineCauses(destination.causes, source.causes);

  const destinationHeldBefore = totalVolume(destination.components);
  // A transfer from a well to itself changes nothing, so it's skipped; this also avoids tiny
  // arithmetic leftovers from taking liquid out and putting it back.
  if (source !== destination) {
    // Never more than the usable volume. A draw problem moves what's reachable, and so does a
    // transfer within NEGLIGIBLE_MICROLITERS of it, so nothing goes below the dead volume (spec
    // section 3, "Tiny amounts").
    moveLiquid(source, destination, Math.min(transfer.volume, available));
  }
  // An overfill is reported once per crossing: only the transfer that takes the well over its
  // capacity, not a later one into a well that's already over (spec section 3, "Problems").
  const destinationHeldAfter = totalVolume(destination.components);
  if (
    isOverCapacity(destinationHeldAfter, destination.labware) &&
    !isOverCapacity(destinationHeldBefore, destination.labware)
  ) {
    problems.push(overfillProblem(operationIndex, destination, destinationHeldAfter));
  }
}

// An "overfill" problem entry for the well `record`, holding `held` µL after the operation at
// `operationIndex` (null for the start), e.g.
// { kind: "overfill", operationIndex: 4, labware: "Plate 2", well: "A1", held: 380, capacity: 360 }.
function overfillProblem(operationIndex, record, held) {
  return {
    kind: "overfill",
    operationIndex,
    labware: record.labware,
    well: record.well,
    held,
    capacity: capacityOf(record.labware),
  };
}

// True if a well on `labware` holding `held` µL is over its capacity by more than
// NEGLIGIBLE_MICROLITERS. Labware the deck doesn't know has no capacity, so it's never over.
function isOverCapacity(held, labware) {
  return hasLabware(labware) && held > capacityOf(labware) + NEGLIGIBLE_MICROLITERS;
}

// The dead volume of `labware` in µL: the deck's value, or 0 for labware the deck doesn't know
// (spec section 3, "Capacity, dead volume and usable volume").
function deadVolumeOfLabware(labware) {
  return hasLabware(labware) ? deadVolumeOf(labware) : 0;
}

// The usable volume of a well holding `held` µL above a dead volume of `deadVolume` µL: what a tip
// can reach, never below 0, e.g. (2300, 2000) → 300 and (1500, 2000) → 0.
function usableVolume(held, deadVolume) {
  return Math.max(0, held - deadVolume);
}

// Moves `volume` µL from `source` to `destination` (two well records). It leaves the source in
// proportion to everything in it, e.g. 50 µL from { Dye: 10, Media: 90 } moves { Dye: 5, Media: 45 }.
// `volume` is never more than the source's usable volume, so never more than it holds.
function moveLiquid(source, destination, volume) {
  // Nothing to move. Returning here also avoids dividing by 0 when the source is empty.
  if (volume === 0) {
    return;
  }
  const share = volume / totalVolume(source.components);
  for (const [name, amount] of Object.entries(source.components)) {
    const moved = amount * share;
    source.components[name] = amount - moved;
    destination.components[name] = (destination.components[name] ?? 0) + moved;
  }
  source.components = tidyComponents(source.components);
  destination.components = tidyComponents(destination.components);
}

// Returns the record for the well `end` names (a transfer's source or destination), adding an empty
// record first if there isn't one, e.g. { labware: "Plate 1", well: "A2" } → { …, components: {} }.
function findOrAddWell(wells, end) {
  const key = wellKey(end.labware, end.well);
  if (!wells.has(key)) {
    wells.set(key, { labware: end.labware, well: end.well, components: {}, causes: [] });
  }
  return wells.get(key);
}

// Returns `components` with arithmetic leftovers removed: {} if the total is below one picoliter
// (it was emptied, and only rounding is left), otherwise the same amounts without any that are
// exactly 0. Small but real amounts are kept, e.g. 0.0000001 µL of Dye after a serial dilution.
function tidyComponents(components) {
  if (totalVolume(components) < NEGLIGIBLE_MICROLITERS) {
    return {};
  }
  return withoutZeros(components);
}

// A copy of `components` without the components whose volume is 0, which count as absent,
// e.g. { Dye: 0, Water: 100 } → { Water: 100 }.
function withoutZeros(components) {
  return Object.fromEntries(Object.entries(components).filter(([, amount]) => amount !== 0));
}

// The total volume of `components` in µL, e.g. { Dye: 10, Media: 90 } → 100, and {} → 0.
function totalVolume(components) {
  return Object.values(components).reduce((total, amount) => total + amount, 0);
}

// The causes in `first` and `second` together, each once, from lowest to highest,
// e.g. combineCauses([3], [0, 3]) → [0, 3].
function combineCauses(first, second) {
  // A Set keeps each value once. sort() on its own compares as text ("10" before "2"), so it's
  // given a function that compares numbers.
  return [...new Set([...first, ...second])].sort((a, b) => a - b);
}

// One text key for a well, for looking it up in a Map, e.g. wellKey("Plate 1", "A1") → '["Plate 1","A1"]'.
// Writing both names as a JSON list keeps them apart, so ("Plate 1", "A1") can't be confused with
// ("Plate 1 A", "1"), as it could if the names were simply joined.
function wellKey(labware, well) {
  return JSON.stringify([labware, well]);
}

// --- Checking replay's inputs (helpers used only inside this module) ---

// Throws if `startingContents` isn't a list of valid entries, each well listed once. Entries are
// checked in turn, and the first problem found is reported.
function checkStartingContents(startingContents) {
  if (!Array.isArray(startingContents)) {
    throw new Error(
      `The starting contents must be a list of wells, like [{ labware: "Plate 1", well: "A1", components: { Water: 100 } }], but got ${describeValue(startingContents)}.`,
    );
  }
  // For each well seen so far, the position of the entry it was first seen in.
  const firstEntryOfWell = new Map();
  // entries() gives each position and entry, including gaps in the list, which come out as
  // undefined and so are reported as not being objects.
  for (const [index, entry] of startingContents.entries()) {
    checkEntry(entry, index);
    const key = wellKey(entry.labware, entry.well);
    if (firstEntryOfWell.has(key)) {
      throw new Error(
        `${entry.labware} ${entry.well} is in the starting contents twice, in entries ${firstEntryOfWell.get(key)} and ${index}. List each well once.`,
      );
    }
    firstEntryOfWell.set(key, index);
  }
}

// Throws if `entry` (the starting contents entry at position `index`) isn't an object with exactly
// a valid labware, well and components, e.g. { labware: "Plate 1", well: "A1", components: { Water: 100 } }.
function checkEntry(entry, index) {
  if (!isObject(entry)) {
    throw new Error(
      `Starting contents entry ${index} must be an object with a labware, a well and components, but got ${describeValue(entry)}.`,
    );
  }
  const missing = findMissingProperties(entry, ["labware", "well", "components"]);
  if (missing.length > 0) {
    throw new Error(
      `Starting contents entry ${index} needs labware, well and components, but is missing ${listNames(missing)}.`,
    );
  }
  const extras = findExtraProperties(entry, ["labware", "well", "components"]);
  if (extras.length > 0) {
    throw new Error(
      `Starting contents entry ${index} can only have labware, well and components, but also got ${listNames(extras)}.`,
    );
  }
  checkName(entry.labware, `labware in starting contents entry ${index}`);
  checkName(entry.well, `well in starting contents entry ${index}`);
  checkComponents(entry.components, index);
}

// Throws if `components` (from the starting contents entry at position `index`) isn't an object of
// valid names and volumes, e.g. { Media: 180, Water: 20 }.
function checkComponents(components, index) {
  if (!isObject(components)) {
    throw new Error(
      `The components in starting contents entry ${index} must be an object of names and volumes, like { Water: 100 }, but got ${describeValue(components)}.`,
    );
  }
  // One component at a time, its name and then its volume (spec section 5).
  for (const [name, volume] of Object.entries(components)) {
    checkName(name, `component name in starting contents entry ${index}`);
    checkVolume(volume, `volume of ${describeValue(name)} in starting contents entry ${index}`);
  }
}

// Throws if `operationList` isn't an OperationList. Its operations aren't checked again, because
// OperationList checked each one when it was added.
function checkOperationList(operationList) {
  if (!(operationList instanceof OperationList)) {
    throw new Error(
      `The operation list must be an OperationList, made with new OperationList() and add, but got ${describeValue(operationList)}.`,
    );
  }
}

// Throws unless `operationCount` is undefined (meaning every operation) or a whole number from 0 to
// `numberOfOperations`. null is an error, not the same as leaving it out.
function checkOperationCount(operationCount, numberOfOperations) {
  if (operationCount === undefined) {
    return;
  }
  // Number.isInteger is false for anything that isn't a number (such as "3"), for 2.5, and for NaN
  // and Infinity.
  if (!Number.isInteger(operationCount)) {
    throw new Error(
      `The operation count must be a whole number, like 3, but got ${describeValue(operationCount)}.`,
    );
  }
  if (operationCount < 0 || operationCount > numberOfOperations) {
    throw new Error(
      `The operation count must be from 0 to ${numberOfOperations}, the number of operations in the list, but got ${operationCount}.`,
    );
  }
}
