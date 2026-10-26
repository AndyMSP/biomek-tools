// deck.js — answers questions about the deck description in config/deck.js: the labware on the
// general-purpose method's standard deck (ADR 0007), each with its name, its well grid and its
// labware type.
//
// It's shared because the transfer designer (to draw labware and check wells) and the file writer
// (to look up labware types) both need the deck description. It reads the description and never
// changes it. It knows only the deck description's names, not the labels a user gives labware.
// Specification: deck.md.

import { DECK } from "../../../config/deck.js";
import { describeValue } from "../error-messages/error-messages.js";
import { isObject, findMissingProperties, listNames } from "../input-checks/input-checks.js";
import { GRID_96, GRID_1X12_NUMBERED } from "../well-grid/well-grid.js";

// Each grid name the deck description may give, with the grid it stands for. config/deck.js names
// grids as text because configuration imports nothing but other configuration (ADR 0009).
const GRIDS_BY_NAME = { GRID_96, GRID_1X12_NUMBERED };

// Every labware's name, in the deck's order, e.g. ["Plate", "Deep", "Res"]. Builds a new list each
// time, so changing it doesn't change the next one.
export function labwareNames() {
  return DECK.map((entry) => entry.name);
}

// True if a labware on the deck has that name, e.g. "Res" → true, "Bench" → false, 5 → false.
// Never throws, whatever it is given.
export function hasLabware(name) {
  return DECK.some((entry) => entry.name === name);
}

// The well grid of the labware called `name`, e.g. "Res" → GRID_1X12_NUMBERED.
// Throws if the labware isn't on the deck.
export function gridOf(name) {
  return GRIDS_BY_NAME[findEntry(name).grid];
}

// The labware type of the labware called `name`, e.g. "Plate" → "BCFlat96".
// Throws if the labware isn't on the deck.
export function labwareTypeOf(name) {
  return findEntry(name).labwareType;
}

// Throws if `end` isn't a well on the deck: an object { labware, well } whose labware is on the
// deck and whose well is on that labware's grid, e.g. { labware: "Plate", well: "H12" } passes.
// Checks in this order, reporting the first problem: the object, the labware, the well.
export function checkWell(end) {
  if (!isObject(end) || findMissingProperties(end, ["labware", "well"]).length > 0) {
    throw new Error(
      `A well on the deck must be an object like { labware: "Plate", well: "A1" }, ` +
        `but got ${describeValue(end)}.`,
    );
  }
  const grid = gridOf(end.labware);
  if (!grid.isValidWell(end.well)) {
    const wells = grid.wellNames();
    throw new Error(
      `${describeValue(end.well)} isn't a well on ${end.labware}. ` +
        `Its wells are ${wells[0]} to ${wells[wells.length - 1]}.`,
    );
  }
}

// Every well in the rectangle between two opposite corners on one labware, both included, as wells
// on the deck in the grid's standard order, e.g. ({ labware: "Plate", well: "B2" },
// { labware: "Plate", well: "C3" }) → B2, B3, C2, C3, each as { labware: "Plate", well }.
// Checks the first corner, then the second, then that they're on one labware. The grid's own
// wellsInBox does the rest, so either pair of opposite corners works, in either order.
export function wellsInBox(corner, opposite) {
  checkWell(corner);
  checkWell(opposite);
  if (corner.labware !== opposite.labware) {
    throw new Error(
      `A box of wells must be on one labware, but one corner is on ${corner.labware} ` +
        `and the other on ${opposite.labware}.`,
    );
  }
  const labware = corner.labware;
  return gridOf(labware)
    .wellsInBox(corner.well, opposite.well)
    .map((well) => ({ labware, well }));
}

// --- Helpers used only inside this module ---

// The deck description's entry for the labware called `name`, e.g. "Plate" →
// { name: "Plate", grid: "GRID_96", labwareType: "BCFlat96" }. Throws if there's none, naming the
// labware the deck does have, so the message says how to fix it.
function findEntry(name) {
  const entry = DECK.find((candidate) => candidate.name === name);
  if (entry === undefined) {
    throw new Error(
      `There's no labware ${describeValue(name)} on the deck. ` +
        `The deck has ${listNames(labwareNames())}.`,
    );
  }
  return entry;
}
