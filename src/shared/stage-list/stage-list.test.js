// Unit tests for stage-list.js. Each test comes from the "Test cases" section of stage-list.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { StageList } from "./stage-list.js";

// Returns valid settings, a new object each time, so a test can change it freely. They are the
// example in stage-list.md, section 3. The names are only examples: stage-list checks a name's form,
// not whether it's in config/, so these tests don't change when config/ does.
// e.g. makeSettings() → { sourceTechnique: "Aspirate_Slow", sourceLiquidType: "Cells", … }
function makeSettings() {
  return {
    sourceTechnique: "Aspirate_Slow",
    sourceLiquidType: "Cells",
    destinationTechnique: "Dispense_Clean",
    destinationLiquidType: "Cells",
    tipType: "BC230",
    probes: [1, 2, 3, 4, 5, 6, 7, 8],
    changeTipsFirst: true,
  };
}

// Returns a StageList made by adding a stage for each name in `names`, in order, with valid
// settings, e.g. makeList("Seeding", "Treatment") holds stages "1" and "2".
function makeList(...names) {
  return names.reduce((list, name) => list.add(name, makeSettings()).stageList, new StageList());
}

// The ID of each stage in `list`, in order, e.g. ["1", "3"].
function idsOf(list) {
  return list.listStages().map((stage) => stage.id);
}

// The seven settings as the object, missing and extra settings errors list them.
const SETTING_NAMES_TEXT =
  "sourceTechnique, sourceLiquidType, destinationTechnique, destinationLiquidType, tipType, probes and changeTipsFirst";

describe("stage-list", () => {
  // --- Adding and IDs ---

  test("a new list is empty", () => {
    assert.deepEqual(new StageList().listStages(), []);
  });

  test("add() returns { stageList, id }; the new list holds the stage, and the original is still empty", () => {
    const original = new StageList();
    const added = original.add("Seeding", makeSettings());
    assert.deepEqual(Object.keys(added), ["stageList", "id"]);
    assert.notEqual(added.stageList, original);
    assert.deepEqual(added.stageList.listStages(), [
      { id: added.id, name: "Seeding", settings: makeSettings() },
    ]);
    assert.deepEqual(original.listStages(), []);
  });

  test('three adds give IDs "1", "2", "3"', () => {
    let list = new StageList();
    const ids = [];
    for (const name of ["Seeding", "Treatment", "Staining"]) {
      const added = list.add(name, makeSettings());
      ids.push(added.id);
      list = added.stageList;
    }
    assert.deepEqual(ids, ["1", "2", "3"]);
  });

  test("two stages may have the same name; they get different IDs", () => {
    const list = makeList("Seeding", "Seeding");
    assert.deepEqual(
      list.listStages().map((stage) => [stage.id, stage.name]),
      [
        ["1", "Seeding"],
        ["2", "Seeding"],
      ],
    );
  });

  test('after adding "1" and "2" and removing "2", the next add gets "3"', () => {
    const list = makeList("Seeding", "Treatment").remove("2");
    assert.equal(list.add("Staining", makeSettings()).id, "3");
  });

  test("a failed add doesn't use up an ID", () => {
    const list = makeList("Seeding");
    assert.throws(() => list.add("", makeSettings()));
    assert.throws(() => list.add("Treatment", null));
    assert.equal(list.add("Treatment", makeSettings()).id, "2");
  });

  test("an earlier version keeps its own counter: adding to it again gives the ID it would have given", () => {
    const earlier = makeList("Seeding");
    const later = earlier.add("Treatment", makeSettings()).stageList;
    later.add("Staining", makeSettings());
    assert.equal(earlier.add("Treatment again", makeSettings()).id, "2");
  });

  // --- Settings ---

  test("probes [3, 1, 2] are stored as [1, 2, 3]", () => {
    const { stageList, id } = new StageList().add("Seeding", { ...makeSettings(), probes: [3, 1, 2] });
    assert.deepEqual(stageList.get(id).settings.probes, [1, 2, 3]);
  });

  test("probes [1] and [1, 2, 3, 4, 5, 6, 7, 8] are accepted", () => {
    for (const probes of [[1], [1, 2, 3, 4, 5, 6, 7, 8]]) {
      const { stageList, id } = new StageList().add("Seeding", { ...makeSettings(), probes });
      assert.deepEqual(stageList.get(id).settings.probes, probes, String(probes));
    }
  });

  test("changeTipsFirst false is accepted", () => {
    const settings = { ...makeSettings(), changeTipsFirst: false };
    const { stageList, id } = new StageList().add("Seeding", settings);
    assert.equal(stageList.get(id).settings.changeTipsFirst, false);
  });

  // --- Renaming, changing, removing, looking up ---

  test("rename changes only the name; ID and settings are unchanged; the original list is unchanged", () => {
    const original = makeList("Seeding");
    const renamed = original.rename("1", "Seeding, part 1");
    assert.deepEqual(renamed.get("1"), { id: "1", name: "Seeding, part 1", settings: makeSettings() });
    assert.equal(original.get("1").name, "Seeding");
  });

  test("changeSettings replaces all the settings; ID and name are unchanged; the original list is unchanged", () => {
    const original = makeList("Seeding");
    const newSettings = {
      sourceTechnique: "Aspirate_Fast",
      sourceLiquidType: "Water",
      destinationTechnique: "Dispense_Dirty",
      destinationLiquidType: "Water",
      tipType: "BC50",
      probes: [2, 4],
      changeTipsFirst: false,
    };
    const changed = original.changeSettings("1", newSettings);
    assert.deepEqual(changed.get("1"), { id: "1", name: "Seeding", settings: newSettings });
    assert.deepEqual(original.get("1").settings, makeSettings());
  });

  test("remove takes out only that stage; has then gives false for it and true for the others", () => {
    const list = makeList("Seeding", "Treatment", "Staining").remove("2");
    assert.equal(list.has("2"), false);
    assert.equal(list.has("1"), true);
    assert.equal(list.has("3"), true);
    assert.deepEqual(idsOf(list), ["1", "3"]);
  });

  test("has gives false for an ID never used, and for values that aren't text, without throwing", () => {
    const list = makeList("Seeding");
    for (const id of ["9", 1, null, undefined, {}]) {
      assert.equal(list.has(id), false, String(id));
    }
  });

  test("get returns the stage's ID, name and settings", () => {
    const list = makeList("Seeding", "Treatment");
    assert.deepEqual(list.get("2"), { id: "2", name: "Treatment", settings: makeSettings() });
  });

  test("listStages() gives stages in the order they were added, including after a rename or a change of settings", () => {
    const list = makeList("Seeding", "Treatment", "Staining")
      .rename("1", "Seeding, part 1")
      .changeSettings("2", { ...makeSettings(), changeTipsFirst: false });
    assert.deepEqual(idsOf(list), ["1", "2", "3"]);
  });

  // --- Immutability and copies ---

  test("changing the settings passed to add() afterwards, including its probes, doesn't change the list", () => {
    const settings = makeSettings();
    const { stageList, id } = new StageList().add("Seeding", settings);
    settings.tipType = "BC50";
    settings.probes.pop();
    settings.probes[0] = 9;
    assert.deepEqual(stageList.get(id).settings, makeSettings());
  });

  test("changing the settings passed to changeSettings() afterwards doesn't change the list", () => {
    const settings = makeSettings();
    const list = makeList("Seeding").changeSettings("1", settings);
    settings.sourceLiquidType = "Water";
    settings.probes.push(9);
    assert.deepEqual(list.get("1").settings, makeSettings());
  });

  test("changing what listStages() returns doesn't change the list", () => {
    const list = makeList("Seeding", "Treatment");
    const stages = list.listStages();
    stages.pop();
    stages.push("something else");
    assert.deepEqual(idsOf(list), ["1", "2"]);
  });

  test("changing a stage from get() or listStages(), its settings or its probes, throws and leaves the list unchanged", () => {
    const list = makeList("Seeding");
    for (const stage of [list.get("1"), list.listStages()[0]]) {
      assert.throws(() => {
        stage.name = "Other";
      }, TypeError);
      assert.throws(() => {
        stage.id = "9";
      }, TypeError);
      assert.throws(() => {
        stage.settings.tipType = "BC50";
      }, TypeError);
      assert.throws(() => {
        stage.settings.probes.push(9);
      }, TypeError);
      assert.throws(() => {
        stage.settings.probes[0] = 9;
      }, TypeError);
    }
    assert.deepEqual(list.get("1"), { id: "1", name: "Seeding", settings: makeSettings() });
  });

  test("an earlier list is unchanged after later adds, renames, changes and removals", () => {
    const earlier = makeList("Seeding", "Treatment");
    earlier.add("Staining", makeSettings());
    earlier.rename("1", "Other");
    earlier.changeSettings("2", { ...makeSettings(), probes: [1] });
    earlier.remove("1");
    assert.deepEqual(earlier.listStages(), [
      { id: "1", name: "Seeding", settings: makeSettings() },
      { id: "2", name: "Treatment", settings: makeSettings() },
    ]);
  });

  test("the list's stored stages can't be reached or replaced from outside", () => {
    const list = makeList("Seeding");
    assert.deepEqual(Object.keys(list), []);
    assert.equal(list.stages, undefined);
    list.stages = [];
    assert.deepEqual(idsOf(list), ["1"]);
  });

  // --- Errors ---

  test('rename, changeSettings, remove and get with "9", and with 9, give the not-in-list error', () => {
    const list = makeList("Seeding");
    for (const [id, shown] of [["9", '"9"'], [9, "9"]]) {
      const message = `There's no stage ${shown} in the stage list.`;
      assert.throws(() => list.rename(id, "Other"), { message });
      assert.throws(() => list.changeSettings(id, makeSettings()), { message });
      assert.throws(() => list.remove(id), { message });
      assert.throws(() => list.get(id), { message });
    }
  });

  test('names 5, "", "   " and " Seeding" give their errors, in add and in rename', () => {
    const list = makeList("Seeding");
    const blank = "The stage name is blank. Give it at least one character that isn't a space.";
    const cases = [
      [5, "The stage name must be text, but got 5."],
      ["", blank],
      ["   ", blank],
      [" Seeding", 'The stage name " Seeding" has spaces at the start or end. Remove them.'],
    ];
    for (const [name, message] of cases) {
      assert.throws(() => list.add(name, makeSettings()), { message });
      assert.throws(() => list.rename("1", name), { message });
    }
  });

  test('settings null, "x" and [] give the object error; [] ends "but got a list."', () => {
    const list = makeList("Seeding");
    const start = `A stage's settings must be an object with ${SETTING_NAMES_TEXT}, but got`;
    for (const [settings, shown] of [[null, "null"], ["x", '"x"'], [[], "a list"]]) {
      const message = `${start} ${shown}.`;
      assert.throws(() => list.add("Treatment", settings), { message });
      assert.throws(() => list.changeSettings("1", settings), { message });
    }
  });

  test("settings missing tipType give the missing error; missing sourceTechnique and probes name both, in that order", () => {
    const list = new StageList();
    const noTipType = makeSettings();
    delete noTipType.tipType;
    assert.throws(() => list.add("Seeding", noTipType), {
      message: `A stage's settings need ${SETTING_NAMES_TEXT}, but are missing "tipType".`,
    });
    const noSourceTechniqueOrProbes = makeSettings();
    delete noSourceTechniqueOrProbes.probes;
    delete noSourceTechniqueOrProbes.sourceTechnique;
    assert.throws(() => list.add("Seeding", noSourceTechniqueOrProbes), {
      message: `A stage's settings need ${SETTING_NAMES_TEXT}, but are missing "sourceTechnique", "probes".`,
    });
  });

  test("settings in the earlier form, with technique and liquidType, give the missing error, naming all four", () => {
    const { tipType, probes, changeTipsFirst } = makeSettings();
    const earlierForm = { technique: "Aspirate_Slow", liquidType: "Cells", tipType, probes, changeTipsFirst };
    const missing = '"sourceTechnique", "sourceLiquidType", "destinationTechnique", "destinationLiquidType"';
    assert.throws(() => new StageList().add("Seeding", earlierForm), {
      message: `A stage's settings need ${SETTING_NAMES_TEXT}, but are missing ${missing}.`,
    });
  });

  test("a setting that comes from a class, not the object itself, counts as missing", () => {
    // A test-only class whose tipType comes from a getter on the class, so the object itself
    // doesn't hold it.
    class SettingsWithClassTipType {
      // Sets every setting except tipType on the object itself.
      constructor() {
        const settings = makeSettings();
        this.sourceTechnique = settings.sourceTechnique;
        this.sourceLiquidType = settings.sourceLiquidType;
        this.destinationTechnique = settings.destinationTechnique;
        this.destinationLiquidType = settings.destinationLiquidType;
        this.probes = settings.probes;
        this.changeTipsFirst = settings.changeTipsFirst;
      }

      // Returns the tip type from the class, not from the object.
      get tipType() {
        return "BC230";
      }
    }
    assert.throws(() => new StageList().add("Seeding", new SettingsWithClassTipType()), {
      message: `A stage's settings need ${SETTING_NAMES_TEXT}, but are missing "tipType".`,
    });
  });

  test("settings with an extra tiptype, or a sourceLabwareType, give the extra-setting error", () => {
    const list = new StageList();
    const start = `A stage's settings can only have ${SETTING_NAMES_TEXT}, but also got`;
    assert.throws(() => list.add("Seeding", { ...makeSettings(), tiptype: "BC230" }), {
      message: `${start} "tiptype".`,
    });
    assert.throws(() => list.add("Seeding", { ...makeSettings(), sourceLabwareType: "Plate" }), {
      message: `${start} "sourceLabwareType".`,
    });
    const twoExtras = { ...makeSettings(), tiptype: "BC230", mix: true };
    assert.throws(() => list.add("Seeding", twoExtras), { message: `${start} "tiptype", "mix".` });
  });

  test("missing settings are checked before extra ones", () => {
    const settings = { ...makeSettings(), tiptype: "BC230" };
    delete settings.tipType;
    assert.throws(() => new StageList().add("Seeding", settings), {
      message: `A stage's settings need ${SETTING_NAMES_TEXT}, but are missing "tipType".`,
    });
  });

  test('each name setting given 5, "" and " BC230" gives its error, naming the setting in words', () => {
    const list = new StageList();
    const settingsInWords = [
      ["sourceTechnique", "source technique"],
      ["sourceLiquidType", "source liquid type"],
      ["destinationTechnique", "destination technique"],
      ["destinationLiquidType", "destination liquid type"],
      ["tipType", "tip type"],
    ];
    for (const [setting, words] of settingsInWords) {
      const cases = [
        [5, `The ${words} must be text, but got 5.`],
        ["", `The ${words} is blank. Give it at least one character that isn't a space.`],
        [" BC230", `The ${words} " BC230" has spaces at the start or end. Remove them.`],
      ];
      for (const [value, message] of cases) {
        assert.throws(() => list.add("Seeding", { ...makeSettings(), [setting]: value }), { message });
      }
    }
  });

  test('probes "1,2", [] and null give the probes-list error', () => {
    const list = new StageList();
    const start = "The probes must be a list of probe numbers from 1 to 8, like [1, 2, 3, 4], but got";
    for (const [probes, shown] of [["1,2", '"1,2"'], [[], "a list"], [null, "null"]]) {
      assert.throws(() => list.add("Seeding", { ...makeSettings(), probes }), {
        message: `${start} ${shown}.`,
      });
    }
  });

  test('probes [0], [9], [2.5] and ["1"] give the probe-number error; [1, 9, 10] names 9', () => {
    const list = new StageList();
    const cases = [
      [[0], "0"],
      [[9], "9"],
      [[2.5], "2.5"],
      [["1"], '"1"'],
      [[1, 9, 10], "9"],
    ];
    for (const [probes, shown] of cases) {
      assert.throws(() => list.add("Seeding", { ...makeSettings(), probes }), {
        message: `Probe numbers must be whole numbers from 1 to 8, but got ${shown}.`,
      });
    }
  });

  test("probes [3, 1, 3] give the repeated-probe error, naming 3", () => {
    assert.throws(() => new StageList().add("Seeding", { ...makeSettings(), probes: [3, 1, 3] }), {
      message: "Probe 3 is listed more than once. List each probe once.",
    });
  });

  test('changeTipsFirst "yes" and 1 give its error', () => {
    const list = new StageList();
    for (const [changeTipsFirst, shown] of [["yes", '"yes"'], [1, "1"]]) {
      assert.throws(() => list.add("Seeding", { ...makeSettings(), changeTipsFirst }), {
        message: `Whether to change tips first must be true or false, but got ${shown}.`,
      });
    }
  });

  test('checks run in order: rename("9", "") reports the missing stage', () => {
    assert.throws(() => makeList("Seeding").rename("9", ""), {
      message: 'There\'s no stage "9" in the stage list.',
    });
  });

  test("checks run in order: settings with a bad source technique and a bad tip type report the source technique", () => {
    const settings = { ...makeSettings(), sourceTechnique: "", tipType: 5 };
    assert.throws(() => new StageList().add("Seeding", settings), {
      message: "The source technique is blank. Give it at least one character that isn't a space.",
    });
  });

  test("checks run in order: a bad name is reported before bad settings", () => {
    assert.throws(() => new StageList().add(5, null), {
      message: "The stage name must be text, but got 5.",
    });
  });

  test("a failed rename, changeSettings or remove leaves the list unchanged", () => {
    const list = makeList("Seeding");
    assert.throws(() => list.rename("1", ""));
    assert.throws(() => list.changeSettings("1", { ...makeSettings(), probes: [9] }));
    assert.throws(() => list.remove("9"));
    assert.deepEqual(list.listStages(), [{ id: "1", name: "Seeding", settings: makeSettings() }]);
  });
});
