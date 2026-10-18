// layout.js — what is in each well of a grid (e.g. "D4 holds Condition 3").
//
// A Layout is made for one WellGrid, which supplies the well names, so it works for any grid size.
// It only stores and returns contents by well; it knows nothing about how they were chosen, and
// comparing, searching or grouping contents is left to the modules that use it.
// Specification: layout.md.

import { describeValue } from "../error-messages/error-messages.js";
import { WellGrid } from "../well-grid/well-grid.js";

export class Layout {
  // Private fields (# names): only code inside this class can read or change them.
  // Outside code reads the grid through the `grid` getter below, which has no setter, so a
  // layout's grid can't be replaced.
  #grid;

  // Map from well name to contents, e.g. "D4" → { name: "Condition 3" }. Empty wells have no entry.
  #contentsByWell = new Map();

  // Creates a layout for a grid with every well empty, e.g. new Layout(GRID_96).
  // Throws if `grid` isn't a WellGrid.
  constructor(grid) {
    if (!(grid instanceof WellGrid)) {
      throw new Error(`A layout needs a WellGrid, like GRID_96, but got ${describeValue(grid)}.`);
    }
    this.#grid = grid;
  }

  // The WellGrid this layout is made for. Read with `layout.grid` (no brackets); it can't be changed.
  get grid() {
    return this.#grid;
  }

  // Sets the contents of a well, replacing any contents already there,
  // e.g. layout.setContents("D4", { name: "Condition 3" }).
  // Both inputs are checked before anything is stored, so a failed call leaves the layout unchanged.
  setContents(well, contents) {
    this.#checkWell(well);
    checkContents(contents);
    this.#contentsByWell.set(well, copyContents(contents));
  }

  // The contents of a well, or null if it's empty, e.g. contentsOf("D4") → { name: "Condition 3" }.
  // Returns a copy, so changing the result doesn't change the layout.
  contentsOf(well) {
    this.#checkWell(well);
    const contents = this.#contentsByWell.get(well);
    if (contents === undefined) {
      return null;
    }
    return copyContents(contents);
  }

  // Every well in standard order with its contents (null if empty),
  // e.g. [{ well: "A1", contents: null }, … { well: "D4", contents: { name: "Condition 3" } }, …].
  // Builds a new list each time, so changing it doesn't change the layout.
  listWells() {
    return this.#grid.wellNames().map((well) => ({ well, contents: this.contentsOf(well) }));
  }

  // Private methods (# names, like the private fields above): only code inside this class can call them.

  // Throws the grid's own error if `well` isn't a well on this grid (e.g. "I1", or "b2" with a
  // "Did you mean" suggestion). wellPosition() already does this check and builds the messages, so
  // it's reused here; the position it returns isn't needed.
  #checkWell(well) {
    this.#grid.wellPosition(well);
  }
}

// --- Helpers used only inside this module ---

// Throws if `contents` isn't valid contents: an object with exactly one property, `name`, which is
// text that isn't blank and has no whitespace at the start or end, e.g. { name: "PBS" }.
// The checks run in the order of the spec's error table, and the first problem found is reported.
function checkContents(contents) {
  // In JavaScript, typeof null and typeof a list are both "object", so they're excluded explicitly.
  const isObject = typeof contents === "object" && contents !== null && !Array.isArray(contents);
  if (!isObject) {
    throw new Error(
      `Contents must be an object with a name, like { name: "PBS" }, but got ${describeValue(contents)}.`,
    );
  }
  // Only a name the object holds itself counts. One it gets from elsewhere (e.g. a getter on a
  // class) would pass these checks but not be copied, leaving the layout with no name stored.
  const name = Object.hasOwn(contents, "name") ? contents.name : undefined;
  if (typeof name !== "string") {
    throw new Error(`The contents name must be text, but got ${describeValue(name)}.`);
  }
  // trim() removes whitespace (spaces, tabs, line breaks) from both ends of the text.
  if (name.trim() === "") {
    throw new Error(
      "The contents name is blank. Give it at least one character that isn't a space.",
    );
  }
  if (name !== name.trim()) {
    throw new Error(
      `The contents name ${describeValue(name)} has spaces at the start or end. Remove them.`,
    );
  }
  // Object.keys lists property names in the order they were added, so extras are reported in the
  // order they appear. Rejecting them catches typos such as `volme` instead of storing them.
  const extraProperties = Object.keys(contents).filter((property) => property !== "name");
  if (extraProperties.length > 0) {
    const extrasText = extraProperties.map((property) => describeValue(property)).join(", ");
    throw new Error(`Contents can only have a name, but also got ${extrasText}.`);
  }
}

// Returns a new object with the same properties, e.g. { name: "PBS" } → another { name: "PBS" }.
// The layout stores and returns copies so outside code can't change a well's contents without going
// through setContents and its checks. A shallow copy (one level deep) is enough, because the only
// property is text, which can't be changed in place.
function copyContents(contents) {
  return { ...contents };
}
