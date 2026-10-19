// well-selection.js — which wells of a grid are selected.
//
// A WellSelection is made for one WellGrid, which supplies the well names, so it works for any grid
// size. It only records whether each well is selected; what being selected means (e.g. fixed wells,
// or wells to transfer from) is up to the tool that uses it.
// Specification: well-selection.md.

import { describeValue } from "../error-messages/error-messages.js";
import { WellGrid } from "../well-grid/well-grid.js";

export class WellSelection {
  // Private fields (# names): only code inside this class can read or change them.
  // Outside code reads the grid through the `grid` getter below, which has no setter, so a
  // selection's grid can't be replaced.
  #grid;

  // The names of the selected wells, e.g. "A1", "D4". A Set holds each value at most once, so
  // selecting a well twice still stores it once. The order wells were added in isn't used: the
  // lists below always follow the grid's standard order.
  #selected = new Set();

  // Creates a selection for a grid with no wells selected, e.g. new WellSelection(GRID_96).
  // Throws if `grid` isn't a WellGrid.
  constructor(grid) {
    if (!(grid instanceof WellGrid)) {
      throw new Error(
        `A well selection needs a WellGrid, like GRID_96, but got ${describeValue(grid)}.`,
      );
    }
    this.#grid = grid;
  }

  // The WellGrid this selection is made for. Read with `selection.grid` (no brackets); it can't be
  // changed.
  get grid() {
    return this.#grid;
  }

  // Selects a well, e.g. select("D4"). Selecting a well that's already selected changes nothing.
  select(well) {
    this.#checkWell(well);
    this.#selected.add(well);
  }

  // Deselects a well, e.g. deselect("D4"). Deselecting a well that isn't selected changes nothing.
  deselect(well) {
    this.#checkWell(well);
    this.#selected.delete(well);
  }

  // Selects the well if it isn't selected, and deselects it if it is.
  // isSelected() checks the well name first, so an invalid name throws before anything changes.
  toggle(well) {
    if (this.isSelected(well)) {
      this.deselect(well);
    } else {
      this.select(well);
    }
  }

  // True if the well is selected, false if not, e.g. isSelected("D4") → true.
  // Throws for a well that isn't on the grid rather than answering false, because asking about a
  // well that doesn't exist is almost certainly a mistake.
  isSelected(well) {
    this.#checkWell(well);
    return this.#selected.has(well);
  }

  // The selected wells in standard order, e.g. ["A2", "D4", "H12"].
  // Builds a new list each time, so changing it doesn't change the selection.
  selectedWells() {
    return this.#grid.wellNames().filter((well) => this.#selected.has(well));
  }

  // The wells that aren't selected, in standard order, e.g. ["A1", "A3", …].
  // Builds a new list each time, so changing it doesn't change the selection.
  unselectedWells() {
    return this.#grid.wellNames().filter((well) => !this.#selected.has(well));
  }

  // Private methods (# names, like the private fields above): only code inside this class can call them.

  // Throws the grid's own error if `well` isn't a well on this grid (e.g. "I1", or "b2" with a
  // "Did you mean" suggestion). wellPosition() already does this check and builds the messages, so
  // it's reused here; the position it returns isn't needed.
  #checkWell(well) {
    this.#grid.wellPosition(well);
  }
}
