// well-grid.js — the grid of well positions on a piece of labware.
//
// A WellGrid knows its dimensions and how its wells are named: letter-number names ("A1" to "H12"
// on a 96-well grid) or numbers ("1" to "12" on the 12-well reservoir's grid).
// It answers questions about positions only; contents and physical properties belong elsewhere.
// Rows and columns are numbered from 1, as printed on the plate.
// Specification: well-grid.md. Design: docs/adr/0001-well-grid-as-class.md.

import { describeValue } from "../error-messages/error-messages.js";
import { isObject } from "../input-checks/input-checks.js";

const ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// The two ways a grid can name its wells (the `naming` option).
const NAMING_STYLES = ["letter-number", "number"];

// One uppercase row letter, then a column number with no leading zeros.
// "0" is allowed by the pattern so that "A0" is reported as off the grid (like "A13"),
// not as a badly formatted name.
const WELL_NAME_PATTERN = /^([A-Z])(0|[1-9][0-9]*)$/;

// A well number with no leading zeros, for numbered grids.
// "0" is allowed for the same reason as above: it is reported as off the grid, like "13".
const WELL_NUMBER_PATTERN = /^(0|[1-9][0-9]*)$/;

export class WellGrid {
  // Fields whose names start with # are private: only code inside this class can read or change
  // them. Outside code reads them through the `rows`, `columns` and `naming` getters below, which
  // have no matching setters, so a valid grid can never become invalid. (Private fields are used
  // instead of Object.freeze so that a subclass can still add its own properties.)
  #rows;
  #columns;
  #naming;

  // Creates a grid with the given number of rows and columns, e.g. new WellGrid(8, 12), or a
  // numbered grid, e.g. new WellGrid(1, 12, { naming: "number" }).
  // Leaving out the third argument gives letter-number names.
  // Throws if any input is invalid, so an invalid grid can never exist. The naming is checked
  // first, because the largest allowed number of rows depends on it.
  constructor(rows, columns, options = { naming: "letter-number" }) {
    const naming = readNaming(options);
    checkGridSize(rows, columns, naming);
    this.#rows = rows;
    this.#columns = columns;
    this.#naming = naming;
  }

  // The number of rows, e.g. 8. Read with `grid.rows` (no brackets); it can't be changed.
  get rows() {
    return this.#rows;
  }

  // The number of columns, e.g. 12. Read with `grid.columns` (no brackets); it can't be changed.
  get columns() {
    return this.#columns;
  }

  // How wells are named: "letter-number" (A1, B2 …) or "number" (1, 2 …).
  // Read with `grid.naming` (no brackets); it can't be changed.
  get naming() {
    return this.#naming;
  }

  // All well names in standard (rows-first) order: A1, A2 … A12, B1 … H12, or 1, 2 … 12.
  wellNames() {
    const names = [];
    for (let row = 1; row <= this.rows; row++) {
      for (let column = 1; column <= this.columns; column++) {
        names.push(this.#formatWellName(row, column));
      }
    }
    return names;
  }

  // True if `name` is a well on this grid. Never throws, whatever it is given.
  isValidWell(name) {
    const position = this.#parseWellName(name);
    return position !== null && this.#isOnGrid(position);
  }

  // The row and column of a well, e.g. "D3" → { row: 4, column: 3 }, or "5" → { row: 1, column: 5 }
  // on GRID_1X12_NUMBERED.
  wellPosition(name) {
    if (typeof name !== "string") {
      throw new Error(`Well name must be text, but got ${describeValue(name)}.`);
    }
    const position = this.#parseWellName(name);
    if (position === null) {
      throw new Error(this.#wrongFormatMessage(name));
    }
    if (!this.#isOnGrid(position)) {
      throw new Error(`"${name}" is not on this grid. ${this.#validWellsDescription()}`);
    }
    return position;
  }

  // The name of the well at a row and column, e.g. (4, 3) → "D3", or (1, 5) → "5" on a
  // numbered grid.
  wellNameAt(row, column) {
    checkPositionNumber("Row", row, this.rows);
    checkPositionNumber("Column", column, this.columns);
    return this.#formatWellName(row, column);
  }

  // True if the well is in the first or last row or column.
  isEdgeWell(name) {
    const { row, column } = this.wellPosition(name);
    return row === 1 || row === this.rows || column === 1 || column === this.columns;
  }

  // Every well in the rectangle between two opposite corners, both included, in standard order,
  // e.g. wellsInBox("B2", "C4") → ["B2", "B3", "B4", "C2", "C3", "C4"].
  // The corners can be either pair of opposite corners, in either order: taking the smaller and
  // larger row and column of the two means ("C4", "B2") and ("B4", "C2") give the same box.
  wellsInBox(corner, oppositeCorner) {
    const first = this.wellPosition(corner);
    const second = this.wellPosition(oppositeCorner);
    const wells = [];
    for (let row = Math.min(first.row, second.row); row <= Math.max(first.row, second.row); row++) {
      for (
        let column = Math.min(first.column, second.column);
        column <= Math.max(first.column, second.column);
        column++
      ) {
        wells.push(this.#formatWellName(row, column));
      }
    }
    return wells;
  }

  // Private methods (# names, like the private fields above): only code inside this class can call them.

  // Builds a well name from a row and column, e.g. (4, 3) → "D3", or (2, 1) → "4" on a numbered
  // grid with 3 columns. A well's number is its place in the standard order, counting from 1.
  // Doesn't check its inputs; callers pass only numbers already known to be on the grid.
  #formatWellName(row, column) {
    if (this.naming === "number") {
      return String((row - 1) * this.columns + column);
    }
    return `${ROW_LETTERS[row - 1]}${column}`;
  }

  // Reads a well name into { row, column }, or returns null if it isn't text in this grid's
  // format. It does not check whether the well is on the grid: "13" on a 1 × 12 grid gives
  // { row: 2, column: 1 }, which #isOnGrid then rejects.
  #parseWellName(name) {
    if (typeof name !== "string") {
      return null;
    }
    if (this.naming === "number") {
      if (!WELL_NUMBER_PATTERN.test(name)) {
        return null;
      }
      // The reverse of #formatWellName: e.g. "4" with 3 columns → place 3 (counting from 0)
      // → row 2, column 1.
      const placeFromZero = Number(name) - 1;
      return {
        row: Math.floor(placeFromZero / this.columns) + 1,
        column: (placeFromZero % this.columns) + 1,
      };
    }
    const match = WELL_NAME_PATTERN.exec(name);
    if (match === null) {
      return null;
    }
    const [, rowLetter, columnText] = match;
    return { row: ROW_LETTERS.indexOf(rowLetter) + 1, column: Number(columnText) };
  }

  // True if a { row, column } position read from a well name lies within this grid.
  // Both ends are checked: "A0" gives column 0, and "0" on a numbered grid gives row 0, column 0.
  #isOnGrid({ row, column }) {
    return row >= 1 && row <= this.rows && column >= 1 && column <= this.columns;
  }

  // Describes this grid's wells for the "not on this grid" message,
  // e.g. "Valid wells are rows A–H, columns 1–12." or "Valid wells are 1–12."
  #validWellsDescription() {
    if (this.naming === "number") {
      return `Valid wells are 1–${this.rows * this.columns}.`;
    }
    const lastRowLetter = ROW_LETTERS[this.rows - 1];
    return `Valid wells are rows A–${lastRowLetter}, columns 1–${this.columns}.`;
  }

  // Builds the error message for a badly formatted well name, adding "Did you mean …?" when a
  // corrected version of the name is a valid well on this grid.
  #wrongFormatMessage(name) {
    const explanation =
      this.naming === "number"
        ? `Wells on this grid are numbered, with no leading zeros, like "5".`
        : `Well names are an uppercase row letter followed by a column number with no leading ` +
          `zeros, like "B2".`;
    const message = `"${name}" is not a valid well name. ${explanation}`;
    const suggestion = correctWellName(name);
    if (this.isValidWell(suggestion)) {
      return `${message} Did you mean "${suggestion}"?`;
    }
    return message;
  }
}

// The standard 96-well grid: 8 rows (A–H) × 12 columns (1–12).
export const GRID_96 = new WellGrid(8, 12);

// The 12-well reservoir's grid: 1 row of 12 wells, numbered 1–12 from the left.
export const GRID_1X12_NUMBERED = new WellGrid(1, 12, { naming: "number" });

// --- Helpers used only inside this module ---

// Returns the naming from the constructor's third argument, e.g. { naming: "number" } → "number".
// Throws if the argument isn't an object, or its naming isn't one of NAMING_STYLES.
// The two cases get different messages: for new WellGrid(1, 12, "number"), "naming must be
// "letter-number" or "number", but got "number"" would contradict itself.
function readNaming(options) {
  if (!isObject(options)) {
    throw new Error(
      `A well grid's options must be an object like { naming: "number" }, ` +
        `but got ${describeValue(options)}.`,
    );
  }
  if (!NAMING_STYLES.includes(options.naming)) {
    throw new Error(
      `A well grid's naming must be "letter-number" or "number", ` +
        `but got ${describeValue(options.naming)}.`,
    );
  }
  return options.naming;
}

// Throws if `rows` or `columns` isn't a whole number of at least 1. Letter-number grids also have
// at most 26 rows, because each row is named with one letter (A–Z); numbered grids have no limit.
function checkGridSize(rows, columns, naming) {
  const columnsAreValid = Number.isInteger(columns) && columns >= 1;
  const got = `but got rows ${describeValue(rows)}, columns ${describeValue(columns)}.`;
  if (naming === "number") {
    const rowsAreValid = Number.isInteger(rows) && rows >= 1;
    if (!rowsAreValid || !columnsAreValid) {
      throw new Error(
        `A numbered well grid must have whole-number rows and columns of at least 1, ${got}`,
      );
    }
    return;
  }
  const rowsAreValid = Number.isInteger(rows) && rows >= 1 && rows <= ROW_LETTERS.length;
  if (!rowsAreValid || !columnsAreValid) {
    throw new Error(
      `A well grid must have whole-number rows from 1 to ${ROW_LETTERS.length} and columns ` +
        `of at least 1, ${got}`,
    );
  }
}

// Applies the only corrections the spec allows for a "Did you mean" suggestion:
// remove spaces, make uppercase, and remove leading zeros from the number. The row letter is
// optional in the last step, so it works for both names: "B02" → "B2" and "05" → "5".
function correctWellName(name) {
  return name
    .replace(/\s/g, "")
    .toUpperCase()
    .replace(/^([A-Z]?)0+(?=[0-9])/, "$1");
}

// Throws if a row or column number is not a whole number from 1 to `max`.
// `label` is "Row" or "Column" and is used in the error message.
function checkPositionNumber(label, value, max) {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number, but got ${describeValue(value)}.`);
  }
  if (value < 1 || value > max) {
    throw new Error(
      `${label} ${value} is out of range. Valid ${label.toLowerCase()}s are 1–${max}.`,
    );
  }
}
