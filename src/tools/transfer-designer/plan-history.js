// plan-history.js — undo and redo for the transfer designer.
//
// It keeps one state per version of what the tool is editing: the earlier states (for undo), the
// current one, and the later ones (for redo). It doesn't know what a state holds, and keeps each one
// as given, so states must not be changed afterwards (the plan's parts are immutable). Like the
// operation list, a history is immutable: every change returns a new history. It lasts only while
// the tool is open; plan files don't keep it (ADR 0010).
// Specification: plan-history.md.

import { UNDO_STATES_KEPT } from "../../../config/undo.js";

export class PlanHistory {
  // Private fields (# name): only code inside this class can read or change them.
  // None of the lists is ever changed after the history is created, so a new history can share
  // them with the one it was made from.
  // The earlier states, oldest first.
  #past = [];
  // The current state.
  #present;
  // The later states, the next one first.
  #future = [];

  // Creates a history whose current state is `state`, with nothing to undo or redo,
  // e.g. new PlanHistory(plan). `state` may be any value.
  constructor(state) {
    this.#present = state;
  }

  // The current state, exactly as it was given, e.g. new PlanHistory("a").present → "a".
  get present() {
    return this.#present;
  }

  // Returns a new history in which `state` is current, the old current state can be undone back to,
  // and there is nothing to redo, e.g. history = history.record(newPlan).
  // Redo is cleared because a later, undone state could hold a stage ID that the stage list gives
  // out again (plan-history.md, "Recording clears redo").
  // Keeps at most UNDO_STATES_KEPT earlier states, dropping the oldest.
  record(state) {
    const past = [...this.#past, this.#present];
    if (past.length > UNDO_STATES_KEPT) {
      past.shift();
    }
    return this.#withStates(past, state, []);
  }

  // Returns a new history in which `state` is current, with the same states to undo and redo,
  // e.g. history = history.replacePresent({ ...history.present, openStage: "2" }).
  // For changes that aren't edits, so undo skips straight to the last edit.
  replacePresent(state) {
    return this.#withStates(this.#past, state, this.#future);
  }

  // True if there's an earlier state to go back to, e.g. false for a new history.
  canUndo() {
    return this.#past.length > 0;
  }

  // True if there's a later state to go forward to, e.g. true just after an undo.
  canRedo() {
    return this.#future.length > 0;
  }

  // Returns a new history in which the latest earlier state is current and the old current state
  // can be redone, e.g. history = history.undo(). With nothing to undo, returns this history
  // unchanged rather than throwing, so a tool can call it straight from a key press.
  undo() {
    if (!this.canUndo()) {
      return this;
    }
    const past = this.#past.slice(0, -1);
    const previous = this.#past[this.#past.length - 1];
    return this.#withStates(past, previous, [this.#present, ...this.#future]);
  }

  // Returns a new history in which the next later state is current and the old current state can
  // be undone back to, e.g. history = history.redo(). With nothing to redo, returns this history
  // unchanged rather than throwing.
  // No limit is needed here: there are never more later states than there were earlier ones.
  redo() {
    if (!this.canRedo()) {
      return this;
    }
    const [next, ...future] = this.#future;
    return this.#withStates([...this.#past, this.#present], next, future);
  }

  // Returns a new PlanHistory holding `past`, `present` and `future`. Code inside the class can set
  // the private fields of another PlanHistory, too; only this method does, and only on the new
  // history, before anyone else can see it.
  #withStates(past, present, future) {
    const history = new PlanHistory(present);
    history.#past = past;
    history.#future = future;
    return history;
  }
}
