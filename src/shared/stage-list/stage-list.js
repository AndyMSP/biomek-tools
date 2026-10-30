// stage-list.js — the stages of a plan: each stage's ID, name and settings.
//
// It makes the IDs that transfers in the operation list use to name their stage, and is where the
// file writer and the page look up a stage's name and settings (ADR 0008). It holds no transfers
// and knows nothing about the run order: that is the order of the stages' transfers in the
// operation list, and nowhere else. This list's own order means nothing; stages are looked up by ID.
// Settings are checked for form only, not against config/. Tips and probes aren't stage settings:
// tip changes are the plan's own entries, between stages, and each chooses its probes (ADR 0007,
// "Tip changes"). Each stage also holds how it mixes at each end, or null if it doesn't (ADR 0007,
// "Mixing"); this module checks a mix's form only, not whether the technique can mix.
// Specification: stage-list.md.

import { describeValue } from "../error-messages/error-messages.js";
import {
  isObject,
  findMissingProperties,
  findExtraProperties,
  listNames,
  checkName,
} from "../input-checks/input-checks.js";

// The six settings every stage has, in the order of the settings table (stage-list.md, section 3),
// which is also the order they're checked in.
const SETTING_NAMES = [
  "sourceTechnique",
  "sourceLiquidType",
  "destinationTechnique",
  "destinationLiquidType",
  "sourceMix",
  "destinationMix",
];

// The settings as the error messages list them. Kept in one place so the three messages that use it
// can't drift apart.
const SETTING_NAMES_TEXT =
  "sourceTechnique, sourceLiquidType, destinationTechnique, destinationLiquidType, sourceMix and destinationMix";

// The three properties every mix has, in the order they're checked in (stage-list.md, section 5).
const MIX_PROPERTY_NAMES = ["share", "times", "speed"];

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
  // and name are unchanged, e.g. stages = stages.changeSettings("1", { …, sourceLiquidType: "Medium" }).
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
  // its settings and their mixes, so changing them throws.
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

// Throws if `settings` isn't an object with exactly the six settings: four names and two mixes, e.g.
// { sourceTechnique: "Aspirate_Slow", sourceLiquidType: "Cells",
//   destinationTechnique: "Dispense_Clean", destinationLiquidType: "Cells",
//   sourceMix: { share: 90, times: 3, speed: 400 }, destinationMix: null }.
// The checks run in the order of the spec's error table, and the first problem found is reported.
// Settings still giving `probes`, as every stage did before 2026-10-30, are refused as an extra
// setting: probes belong to tip changes now (stage-list.md, section 3).
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
  checkName(settings.sourceTechnique, "source technique");
  checkName(settings.sourceLiquidType, "source liquid type");
  checkName(settings.destinationTechnique, "destination technique");
  checkName(settings.destinationLiquidType, "destination liquid type");
  checkMix(settings.sourceMix, "source mix");
  checkMix(settings.destinationMix, "destination mix");
}

// Throws if `mix` isn't null (no mixing) or an object with exactly share, times and speed, each in
// range, e.g. { share: 90, times: 3, speed: 400 }. `subject` names the mix for the message, e.g.
// checkMix({ share: 0, times: 3, speed: 400 }, "source mix") throws
// "The source mix's share must be a number above 0 and at most 100 (a percentage of the well), but got 0."
// The checks run in the order of the spec: form, missing, extra, then share, times and speed.
function checkMix(mix, subject) {
  if (mix === null) {
    return;
  }
  if (!isObject(mix)) {
    throw new Error(
      `The ${subject} must be null (no mixing) or an object with share, times and speed, but got ${describeValue(mix)}.`,
    );
  }
  const missing = findMissingProperties(mix, MIX_PROPERTY_NAMES);
  if (missing.length > 0) {
    throw new Error(
      `The ${subject} needs share, times and speed, but is missing ${listNames(missing)}.`,
    );
  }
  const extras = findExtraProperties(mix, MIX_PROPERTY_NAMES);
  if (extras.length > 0) {
    throw new Error(
      `The ${subject} can only have share, times and speed, but also got ${listNames(extras)}.`,
    );
  }
  // Number.isFinite is false for anything that isn't a number (such as the text "90"), and for NaN
  // and Infinity, which JavaScript counts as numbers.
  if (!Number.isFinite(mix.share) || mix.share <= 0 || mix.share > 100) {
    throw new Error(
      `The ${subject}'s share must be a number above 0 and at most 100 (a percentage of the well), but got ${describeValue(mix.share)}.`,
    );
  }
  // Number.isInteger is false for 2.5 and for anything that isn't a number.
  if (!Number.isInteger(mix.times) || mix.times < 1) {
    throw new Error(
      `The ${subject}'s times must be a whole number, at least 1, but got ${describeValue(mix.times)}.`,
    );
  }
  if (!Number.isFinite(mix.speed) || mix.speed <= 0) {
    throw new Error(
      `The ${subject}'s speed must be a number of µL/s above 0, but got ${describeValue(mix.speed)}.`,
    );
  }
}

// Returns a frozen copy of valid `settings`. Copying means changing the object given to add() later
// doesn't change the list; freezing (Object.freeze) means changing what get() returns throws a
// TypeError. Only the six settings are copied, by name, and each mix is copied too.
function copySettings(settings) {
  return Object.freeze({
    sourceTechnique: settings.sourceTechnique,
    sourceLiquidType: settings.sourceLiquidType,
    destinationTechnique: settings.destinationTechnique,
    destinationLiquidType: settings.destinationLiquidType,
    sourceMix: copyMix(settings.sourceMix),
    destinationMix: copyMix(settings.destinationMix),
  });
}

// Returns a frozen copy of a valid `mix`, or null for no mixing, e.g.
// copyMix({ speed: 400, share: 90, times: 3 }) → { share: 90, times: 3, speed: 400 }, frozen.
// Copying by name puts the properties in one order, whatever order they were given in.
function copyMix(mix) {
  if (mix === null) {
    return null;
  }
  return Object.freeze({ share: mix.share, times: mix.times, speed: mix.speed });
}
