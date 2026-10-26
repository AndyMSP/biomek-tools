// Unit tests for plan-history.js. Each test comes from the "Test cases" section of plan-history.md.
//
// They use the real config/undo.js, and also check that file (ADR 0009). The limit test reads
// UNDO_STATES_KEPT from it rather than assuming a number, so it still holds if the number changes.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { UNDO_STATES_KEPT } from "../../../config/undo.js";
import { PlanHistory } from "./plan-history.js";

// Returns a history that starts with `first` and records each of `others` in order,
// e.g. makeHistory("a", "b", "c") has present "c" and can undo back to "b", then "a".
function makeHistory(first, ...others) {
  return others.reduce((history, state) => history.record(state), new PlanHistory(first));
}

// What a test can see of `history` from outside: its present and whether it can undo and redo,
// e.g. { present: "b", canUndo: true, canRedo: false }.
function describeHistory(history) {
  return { present: history.present, canUndo: history.canUndo(), canRedo: history.canRedo() };
}

describe("plan-history", () => {
  // --- A new history ---

  test("a new history's present is the state it was made with, with nothing to undo or redo", () => {
    const history = new PlanHistory("a");
    assert.deepEqual(describeHistory(history), { present: "a", canUndo: false, canRedo: false });
  });

  // --- Recording, undoing and redoing ---

  test("record() makes the new state current; canUndo() is true; undo() gives back the old state", () => {
    const history = new PlanHistory("a").record("b");
    assert.equal(history.present, "b");
    assert.equal(history.canUndo(), true);
    assert.equal(history.undo().present, "a");
  });

  test("several records, then several undos, go back newest first; redos go forward again in order", () => {
    let history = makeHistory("a", "b", "c", "d");
    const undone = [];
    while (history.canUndo()) {
      history = history.undo();
      undone.push(history.present);
    }
    assert.deepEqual(undone, ["c", "b", "a"]);
    const redone = [];
    while (history.canRedo()) {
      history = history.redo();
      redone.push(history.present);
    }
    assert.deepEqual(redone, ["b", "c", "d"]);
  });

  test("after an undo, record() clears redo: canRedo() is false, and redo() changes nothing", () => {
    const history = makeHistory("a", "b", "c").undo().record("d");
    assert.equal(history.canRedo(), false);
    assert.equal(history.redo().present, "d");
    assert.equal(history.undo().present, "b");
  });

  // --- Replacing the present ---

  test("replacePresent() adds no state to undo back to: undo() goes to the state before the replaced one", () => {
    const history = makeHistory("a", "b").replacePresent("b, viewed");
    assert.equal(history.present, "b, viewed");
    assert.equal(history.undo().present, "a");
  });

  test("replacePresent() keeps redo: canRedo() stays true and redo() still works", () => {
    const history = makeHistory("a", "b", "c").undo().replacePresent("b, viewed");
    assert.equal(history.canRedo(), true);
    assert.equal(history.redo().present, "c");
    assert.equal(history.redo().undo().present, "b, viewed");
  });

  // --- Nothing to undo or redo ---

  test("undo() with nothing to undo returns a history whose present is unchanged, and doesn't throw", () => {
    const history = new PlanHistory("a");
    assert.equal(history.undo().present, "a");
  });

  test("redo() with nothing to redo returns a history whose present is unchanged, and doesn't throw", () => {
    const history = makeHistory("a", "b");
    assert.equal(history.redo().present, "b");
  });

  // --- Immutability ---

  test("record() leaves the original history unchanged", () => {
    const original = makeHistory("a", "b", "c").undo();
    const before = describeHistory(original);
    original.record("d");
    assert.deepEqual(describeHistory(original), before);
  });

  test("replacePresent() leaves the original history unchanged", () => {
    const original = makeHistory("a", "b", "c").undo();
    const before = describeHistory(original);
    original.replacePresent("b, viewed");
    assert.deepEqual(describeHistory(original), before);
  });

  test("undo() leaves the original history unchanged", () => {
    const original = makeHistory("a", "b");
    const before = describeHistory(original);
    original.undo();
    assert.deepEqual(describeHistory(original), before);
  });

  test("redo() leaves the original history unchanged", () => {
    const original = makeHistory("a", "b").undo();
    const before = describeHistory(original);
    original.redo();
    assert.deepEqual(describeHistory(original), before);
  });

  // --- The limit ---

  test("with UNDO_STATES_KEPT + 1 records after the first state, UNDO_STATES_KEPT undos are possible, ending at the second state", () => {
    let history = new PlanHistory(0);
    for (let state = 1; state <= UNDO_STATES_KEPT + 1; state += 1) {
      history = history.record(state);
    }
    let undos = 0;
    while (history.canUndo()) {
      history = history.undo();
      undos += 1;
    }
    assert.equal(undos, UNDO_STATES_KEPT);
    // State 0 was dropped, so undo stops at state 1, the second state.
    assert.equal(history.present, 1);
  });

  test("redo still works after the limit has dropped old states", () => {
    let history = new PlanHistory(0);
    for (let state = 1; state <= UNDO_STATES_KEPT + 1; state += 1) {
      history = history.record(state);
    }
    history = history.undo().undo();
    assert.equal(history.redo().present, UNDO_STATES_KEPT);
    assert.equal(history.redo().redo().present, UNDO_STATES_KEPT + 1);
  });

  // --- The configuration file (config/undo.js) ---

  test("config/undo.js: UNDO_STATES_KEPT is a whole number of at least 1", () => {
    assert.ok(Number.isInteger(UNDO_STATES_KEPT), `UNDO_STATES_KEPT is ${UNDO_STATES_KEPT}`);
    assert.ok(UNDO_STATES_KEPT >= 1, `UNDO_STATES_KEPT is ${UNDO_STATES_KEPT}`);
  });

  // --- States are kept as given ---

  test("an object passed to record() is the same object present returns later", () => {
    const plan = { transfers: [] };
    const history = new PlanHistory({}).record(plan).record({}).undo();
    assert.equal(history.present, plan);
  });
});
