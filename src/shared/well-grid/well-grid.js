// well-grid.js — the grid of well positions on a piece of labware.
//
// A WellGrid knows its dimensions and how its wells are named ("A1" to "H12" on a 96-well grid).
// It answers questions about positions only; contents and physical properties belong elsewhere.
// Rows and columns are numbered from 1, as printed on the plate.
// Specification: well-grid.md. Design: docs/adr/0001-well-grid-as-class.md.

const ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// One uppercase row letter, then a column number with no leading zeros.
// "0" is allowed by the pattern so that "A0" is reported as off the grid (like "A13"),
// not as a badly formatted name.
const WELL_NAME_PATTERN = /^([A-Z])(0|[1-9][0-9]*)$/;

export class WellGrid {
  // Fields whose names start with # are private: only code inside this class can read or change
  // them. Outside code reads them through the `rows` and `columns` getters below, which have no
  // matching setters, so a valid grid can never become invalid. (Private fields are used instead
  // of Object.freeze so that a subclass can still add its own properties.)
  #rows;
  #columns;

  // Creates a grid with the given number of rows and columns, e.g. new WellGrid(8, 12).
  // Throws if either is not a whole number in range, so an invalid grid can never exist.
  constructor(rows, columns) {
    const rowsAreValid = isWholeNumber(rows) && rows >= 1 && rows <= ROW_LETTERS.length;
    const columnsAreValid = isWholeNumber(columns) && columns >= 1;
    if (!rowsAreValid || !columnsAreValid) {
      throw new Error(
        `A well grid must have whole-number rows from 1 to ${ROW_LETTERS.length} and columns ` +
          `of at least 1, but got rows ${describeValue(rows)}, columns ${describeValue(columns)}.`,
      );
    }
    this.#rows = rows;
    this.#columns = columns;
  }

  // The number of rows, e.g. 8. Read with `grid.rows` (no brackets); it can't be changed.
  get rows() {
    return this.#rows;
  }

  // The number of columns, e.g. 12. Read with `grid.columns` (no brackets); it can't be changed.
  get columns() {
    return this.#columns;
  }

  // All well names in standard (rows-first) order: A1, A2 … A12, B1 … H12.
  wellNames() {
    const names = [];
    for (let row = 1; row <= this.rows; row++) {
      for (let column = 1; column <= this.columns; column++) {
        names.push(formatWellName(row, column));
      }
    }
    return names;
  }

  // True if `name` is a well on this grid. Never throws, whatever it is given.
  isValidWell(name) {
    const position = parseWellName(name);
    return position !== null && this.#isOnGrid(position);
  }

  // The row and column of a well, e.g. "D3" → { row: 4, column: 3 }.
  wellPosition(name) {
    if (typeof name !== "string") {
      throw new Error(`Well name must be text, but got ${describeValue(name)}.`);
    }
    const position = parseWellName(name);
    if (position === null) {
      throw new Error(this.#wrongFormatMessage(name));
    }
    if (!this.#isOnGrid(position)) {
      const lastRowLetter = ROW_LETTERS[this.rows - 1];
      throw new Error(
        `"${name}" is not on this grid. ` +
          `Valid wells are rows A–${lastRowLetter}, columns 1–${this.columns}.`,
      );
    }
    return position;
  }

  // The name of the well at a row and column, e.g. (4, 3) → "D3".
  wellNameAt(row, column) {
    checkPositionNumber("Row", row, this.rows);
    checkPositionNumber("Column", column, this.columns);
    return formatWellName(row, column);
  }

  // True if the well is in the first or last row or column.
  isEdgeWell(name) {
    const { row, column } = this.wellPosition(name);
    return row === 1 || row === this.rows || column === 1 || column === this.columns;
  }

  // Private methods (# names, like the private fields above): only code inside this class can call them.

  // True if a { row, column } position read from a well name lies within this grid.
  // There's no `row >= 1` check: a parsed name always starts with a letter, so its row is at least 1.
  // Column 0 is possible ("A0"), so the column is checked at both ends.
  #isOnGrid({ row, column }) {
    return row <= this.rows && column >= 1 && column <= this.columns;
  }

  // Builds the error message for a badly formatted well name, adding "Did you mean …?" when a
  // corrected version of the name is a valid well on this grid.
  #wrongFormatMessage(name) {
    const message =
      `"${name}" is not a valid well name. Well names are an uppercase row letter followed by ` +
      `a column number with no leading zeros, like "B2".`;
    const suggestion = correctWellName(name);
    if (this.isValidWell(suggestion)) {
      return `${message} Did you mean "${suggestion}"?`;
    }
    return message;
  }
}

// The standard 96-well grid: 8 rows (A–H) × 12 columns (1–12).
export const GRID_96 = new WellGrid(8, 12);

// --- Helpers used only inside this module ---

// True if `value` is a number with no fractional part, e.g. 8 (but not 1.5, "8" or null).
function isWholeNumber(value) {
  return Number.isInteger(value);
}

// Shows a value in an error message: text in quotes, anything else as it is (5, null, 2.5).
function describeValue(value) {
  return typeof value === "string" ? `"${value}"` : String(value);
}

// Builds a well name from a row and column, e.g. (4, 3) → "D3".
// Doesn't check its inputs; callers pass only numbers already known to be on the grid.
function formatWellName(row, column) {
  return `${ROW_LETTERS[row - 1]}${column}`;
}

// Reads a well name into { row, column }, or returns null if it isn't text in the right format.
// It does not check whether the well is on a particular grid.
function parseWellName(name) {
  if (typeof name !== "string") {
    return null;
  }
  const match = WELL_NAME_PATTERN.exec(name);
  if (match === null) {
    return null;
  }
  const [, rowLetter, columnText] = match;
  return { row: ROW_LETTERS.indexOf(rowLetter) + 1, column: Number(columnText) };
}

// Applies the only corrections the spec allows for a "Did you mean" suggestion:
// remove spaces, make uppercase, and remove leading zeros from the column number.
function correctWellName(name) {
  return name
    .replace(/\s/g, "")
    .toUpperCase()
    .replace(/^([A-Z])0+(?=[0-9])/, "$1");
}

// Throws if a row or column number is not a whole number from 1 to `max`.
// `label` is "Row" or "Column" and is used in the error message.
function checkPositionNumber(label, value, max) {
  if (!isWholeNumber(value)) {
    throw new Error(`${label} must be a whole number, but got ${describeValue(value)}.`);
  }
  if (value < 1 || value > max) {
    throw new Error(
      `${label} ${value} is out of range. Valid ${label.toLowerCase()}s are 1–${max}.`,
    );
  }
}
