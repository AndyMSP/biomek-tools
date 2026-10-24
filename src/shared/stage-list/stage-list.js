// stage-list.js — the stages of a plan: each stage's ID, name and settings.
//
// It makes the IDs that transfers in the operation list use to name their stage, and is where the
// file writer and the page look up a stage's name and settings (ADR 0008). It holds no transfers
// and knows nothing about the run order: that is the order of the stages' transfers in the
// operation list, and nowhere else. This list's own order means nothing; stages are looked up by ID.
// Settings are checked for form only, not against the technique list.
// Specification: stage-list.md.

import { describeValue } from "../error-messages/error-messages.js";
import {
  isObject,
  findMissingProperties,
  findExtraProperties,
  listNames,
  checkName,
} from "../input-checks/input-checks.js";

// The five settings every stage has, in the order of the settings table (stage-list.md, section 3),
// which is also the order they're checked in.
const SETTING_NAMES = ["technique", "liquidType", "tipType", "probes", "changeTipsFirst"];

// The settings as the error messages list them. Kept in one place so the three messages that use it
// can't drift apart.
const SETTING_NAMES_TEXT = "technique, liquidType, tipType, probes and changeTipsFirst";

// The Span-8 has probes 1 to 8, numbered as in Biomek Software. It's a fact about the instrument,
// not a setting that might change, so it lives here rather than in config/.
const HIGHEST_PROBE = 8;

export class StageList {
  // Private fields (# name): only code inside this class can read or change them.
  // The stored stages, in the order they were added. Each one is frozen (see copySettings), and the
  // list itself is never changed after the StageList is created.
  #stages = [];
  // The number the next stage's ID is made from. Removing a stage never moves it back, so an ID is
  // never given to a second stage in later versions of the list.
  #nextNumber = 1;

  // Creates an empty list, e.g. new StageList(). Takes no arguments.
  constructor() {}

  // Returns { stageList, id }: a new list holding a stage with `name` and a copy of `settings`, and
  // the ID it was given. Leaves this list unchanged, so keep the new one:
  // const added = stages.add("Seeding", settings); stages = added.stageList; added.id → "1".
  // Both are checked first, so a failed call throws and doesn't use up an ID.
  add(name, settings) {
    checkName(name, "stage name");
    checkSettings(settings);
    const id = String(this.#nextNumber);
    const stage = Object.freeze({ id, name, settings: copySettings(settings) });
    const stageList = this.#withStages([...this.#stages, stage], this.#nextNumber + 1);
    return { stageList, id };
  }

  // Returns a new list in which stage `id` is called `name`; its ID and settings are unchanged.
  // e.g. stages = stages.rename("1", "Seeding, part 1").
  rename(id, name) {
    const position = this.#positionOf(id);
    checkName(name, "stage name");
    const stage = this.#stages[position];
    return this.#withReplaced(position, Object.freeze({ id: stage.id, name, settings: stage.settings }));
  }

  // Returns a new list in which a copy of `settings` replaces all of stage `id`'s settings; its ID
  // and name are unchanged, e.g. stages = stages.changeSettings("1", { …, changeTipsFirst: false }).
  changeSettings(id, settings) {
    const position = this.#positionOf(id);
    checkSettings(settings);
    const stage = this.#stages[position];
    const changed = Object.freeze({ id: stage.id, name: stage.name, settings: copySettings(settings) });
    return this.#withReplaced(position, changed);
  }

  // Returns a new list without stage `id`, e.g. stages = stages.remove("1"). It doesn't check
  // whether transfers still name the stage: this module never sees the operation list
  // (stage-list.md, section 3, "Removing").
  remove(id) {
    const position = this.#positionOf(id);
    const stages = [...this.#stages.slice(0, position), ...this.#stages.slice(position + 1)];
    return this.#withStages(stages, this.#nextNumber);
  }

  // True if stage `id` is in the list, e.g. has("1") → true, has(1) → false. Never throws.
  has(id) {
    return this.#stages.some((stage) => stage.id === id);
  }

  // Stage `id`, as { id, name, settings }, e.g. get("1").name → "Seeding". It is frozen, and so are
  // its settings and probes, so changing them throws.
  get(id) {
    return this.#stages[this.#positionOf(id)];
  }

  // Every stage, in the order they were added, e.g. [{ id: "1", … }, { id: "2", … }]. That order
  // says nothing about the run order. Builds a new list each time, so changing it doesn't change
  // this list.
  listStages() {
    return [...this.#stages];
  }

  // The position of stage `id` in #stages, e.g. 0 for the first stage added. Throws if it isn't in
  // the list, whatever type of value `id` is.
  #positionOf(id) {
    const position = this.#stages.findIndex((stage) => stage.id === id);
    if (position === -1) {
      throw new Error(`There's no stage ${describeValue(id)} in the stage list.`);
    }
    return position;
  }

  // Returns a new list holding this list's stages with `stage` in place of the one at `position`,
  // and the same counter.
  #withReplaced(position, stage) {
    const stages = [...this.#stages];
    stages[position] = stage;
    return this.#withStages(stages, this.#nextNumber);
  }

  // Returns a new StageList holding `stages` and the counter `nextNumber`. Code inside the class can
  // set the private fields of another StageList, too; only this method does, and only on the new
  // list, before anyone else can see it.
  #withStages(stages, nextNumber) {
    const stageList = new StageList();
    stageList.#stages = stages;
    stageList.#nextNumber = nextNumber;
    return stageList;
  }
}

// --- Helpers used only inside this module ---

// Throws if `settings` isn't an object with exactly the five settings, each in the right form, e.g.
// { technique: "Span8 Water 230 Default", liquidType: "Water", tipType: "BC230",
//   probes: [1, 2, 3, 4, 5, 6, 7, 8], changeTipsFirst: true }.
// The checks run in the order of the spec's error table, and the first problem found is reported.
function checkSettings(settings) {
  if (!isObject(settings)) {
    throw new Error(
      `A stage's settings must be an object with ${SETTING_NAMES_TEXT}, but got ${describeValue(settings)}.`,
    );
  }
  const missing = findMissingProperties(settings, SETTING_NAMES);
  if (missing.length > 0) {
    throw new Error(
      `A stage's settings need ${SETTING_NAMES_TEXT}, but are missing ${listNames(missing)}.`,
    );
  }
  const extras = findExtraProperties(settings, SETTING_NAMES);
  if (extras.length > 0) {
    throw new Error(
      `A stage's settings can only have ${SETTING_NAMES_TEXT}, but also got ${listNames(extras)}.`,
    );
  }
  checkName(settings.technique, "technique");
  checkName(settings.liquidType, "liquid type");
  checkName(settings.tipType, "tip type");
  checkProbes(settings.probes);
  checkChangeTipsFirst(settings.changeTipsFirst);
}

// Throws if `probes` isn't a list of at least one probe number, 1 to 8, each listed once,
// e.g. [1, 3] is fine; [], [9] and [3, 1, 3] throw.
function checkProbes(probes) {
  if (!Array.isArray(probes) || probes.length === 0) {
    throw new Error(
      `The probes must be a list of probe numbers from 1 to ${HIGHEST_PROBE}, like [1, 2, 3, 4], but got ${describeValue(probes)}.`,
    );
  }
  // findIndex, not find: find returns undefined both for "none found" and for a hole in the list,
  // so a list such as [ , 1] would slip through.
  const badPosition = probes.findIndex((probe) => !isProbeNumber(probe));
  if (badPosition !== -1) {
    throw new Error(
      `Probe numbers must be whole numbers from 1 to ${HIGHEST_PROBE}, but got ${describeValue(probes[badPosition])}.`,
    );
  }
  // A probe is repeated if it was already seen earlier in the list. Every probe is a number by now,
  // so undefined can only mean none is repeated.
  const repeated = probes.find((probe, position) => probes.indexOf(probe) !== position);
  if (repeated !== undefined) {
    throw new Error(`Probe ${repeated} is listed more than once. List each probe once.`);
  }
}

// True if `probe` is a whole number from 1 to 8, e.g. 3 → true; 0, 9, 2.5 and "1" → false.
// Number.isInteger is false for anything that isn't a number, so text such as "1" is refused.
function isProbeNumber(probe) {
  return Number.isInteger(probe) && probe >= 1 && probe <= HIGHEST_PROBE;
}

// Throws if `changeTipsFirst` isn't true or false, e.g. "yes" and 1 throw.
function checkChangeTipsFirst(changeTipsFirst) {
  if (typeof changeTipsFirst !== "boolean") {
    throw new Error(
      `Whether to change tips first must be true or false, but got ${describeValue(changeTipsFirst)}.`,
    );
  }
}

// Returns a frozen copy of valid `settings`, with a frozen copy of its probes, sorted from smallest
// to largest, e.g. probes [3, 1] → [1, 3]. Copying means changing the object given to add() later
// doesn't change the list; freezing (Object.freeze) means changing what get() returns throws a
// TypeError. Only the five settings are copied, by name.
function copySettings(settings) {
  return Object.freeze({
    technique: settings.technique,
    liquidType: settings.liquidType,
    tipType: settings.tipType,
    // sort() changes the list it's called on, so it sorts a copy. Without (a, b) => a - b it would
    // sort numbers as text, putting 10 before 2.
    probes: Object.freeze([...settings.probes].sort((a, b) => a - b)),
    changeTipsFirst: settings.changeTipsFirst,
  });
}
