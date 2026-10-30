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
    sourceMix: { share: 90, times: 3, speed: 400 },
    destinationMix: null,
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

// The six settings as the object, missing and extra settings errors list them.
const SETTING_NAMES_TEXT =
  "sourceTechnique, sourceLiquidType, destinationTechnique, destinationLiquidType, sourceMix and destinationMix";

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

  // --- Mixes ---

  test("sourceMix and destinationMix null are accepted", () => {
    const settings = { ...makeSettings(), sourceMix: null, destinationMix: null };
    const { stageList, id } = new StageList().add("Seeding", settings);
    assert.equal(stageList.get(id).settings.sourceMix, null);
    assert.equal(stageList.get(id).settings.destinationMix, null);
  });

  test("mixes { share: 90, times: 3, speed: 400 } and { share: 100, times: 1, speed: 0.5 } are accepted, at either end", () => {
    const mixes = [
      { share: 90, times: 3, speed: 400 },
      { share: 100, times: 1, speed: 0.5 },
    ];
    for (const mix of mixes) {
      for (const setting of ["sourceMix", "destinationMix"]) {
        const { stageList, id } = new StageList().add("Seeding", { ...makeSettings(), [setting]: mix });
        assert.deepEqual(stageList.get(id).settings[setting], mix);
      }
    }
  });

  test("a mix's properties may come in any order", () => {
    const settings = { ...makeSettings(), destinationMix: { speed: 400, times: 3, share: 90 } };
    const { stageList, id } = new StageList().add("Seeding", settings);
    assert.deepEqual(stageList.get(id).settings.destinationMix, { share: 90, times: 3, speed: 400 });
  });

  test("changeSettings can switch a mix on and off", () => {
    const list = makeList("Seeding");
    const off = list.changeSettings("1", { ...makeSettings(), sourceMix: null });
    assert.equal(off.get("1").settings.sourceMix, null);
    const on = off.changeSettings("1", makeSettings());
    assert.deepEqual(on.get("1").settings.sourceMix, { share: 90, times: 3, speed: 400 });
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
      sourceMix: null,
      destinationMix: { share: 50, times: 2, speed: 100 },
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
      .changeSettings("2", { ...makeSettings(), sourceLiquidType: "Water" });
    assert.deepEqual(idsOf(list), ["1", "2", "3"]);
  });

  // --- Immutability and copies ---

  test("changing the settings passed to add() afterwards doesn't change the list", () => {
    const settings = makeSettings();
    const { stageList, id } = new StageList().add("Seeding", settings);
    settings.sourceTechnique = "Aspirate_Fast";
    assert.deepEqual(stageList.get(id).settings, makeSettings());
  });

  test("changing a mix in the settings passed to add() afterwards doesn't change the list", () => {
    const settings = makeSettings();
    const { stageList, id } = new StageList().add("Seeding", settings);
    settings.sourceMix.share = 10;
    settings.sourceMix.volume = 50;
    assert.deepEqual(stageList.get(id).settings, makeSettings());
  });

  test("changing the settings passed to changeSettings() afterwards doesn't change the list", () => {
    const settings = makeSettings();
    const list = makeList("Seeding").changeSettings("1", settings);
    settings.sourceLiquidType = "Water";
    assert.deepEqual(list.get("1").settings, makeSettings());
  });

  test("changing what listStages() returns doesn't change the list", () => {
    const list = makeList("Seeding", "Treatment");
    const stages = list.listStages();
    stages.pop();
    stages.push("something else");
    assert.deepEqual(idsOf(list), ["1", "2"]);
  });

  test("changing a stage from get() or listStages(), or its settings, or a mix in them, throws and leaves the list unchanged", () => {
    const list = makeList("Seeding");
    for (const stage of [list.get("1"), list.listStages()[0]]) {
      assert.throws(() => {
        stage.name = "Other";
      }, TypeError);
      assert.throws(() => {
        stage.id = "9";
      }, TypeError);
      assert.throws(() => {
        stage.settings.sourceTechnique = "Aspirate_Fast";
      }, TypeError);
      assert.throws(() => {
        stage.settings.sourceMix.share = 10;
      }, TypeError);
      assert.throws(() => {
        stage.settings.sourceMix = null;
      }, TypeError);
    }
    assert.deepEqual(list.get("1"), { id: "1", name: "Seeding", settings: makeSettings() });
  });

  test("an earlier list is unchanged after later adds, renames, changes and removals", () => {
    const earlier = makeList("Seeding", "Treatment");
    earlier.add("Staining", makeSettings());
    earlier.rename("1", "Other");
    earlier.changeSettings("2", { ...makeSettings(), sourceLiquidType: "Water" });
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

  test("settings missing destinationLiquidType give the missing error; missing sourceTechnique and destinationLiquidType name both, in that order", () => {
    const list = new StageList();
    const noDestinationLiquidType = makeSettings();
    delete noDestinationLiquidType.destinationLiquidType;
    assert.throws(() => list.add("Seeding", noDestinationLiquidType), {
      message: `A stage's settings need ${SETTING_NAMES_TEXT}, but are missing "destinationLiquidType".`,
    });
    const missingTwo = makeSettings();
    delete missingTwo.destinationLiquidType;
    delete missingTwo.sourceTechnique;
    assert.throws(() => list.add("Seeding", missingTwo), {
      message: `A stage's settings need ${SETTING_NAMES_TEXT}, but are missing "sourceTechnique", "destinationLiquidType".`,
    });
  });

  test("settings in the earlier form, with technique and liquidType, give the missing error, naming the four technique and liquid type settings and both mixes", () => {
    const earlierForm = { technique: "Aspirate_Slow", liquidType: "Cells" };
    const missing =
      '"sourceTechnique", "sourceLiquidType", "destinationTechnique", "destinationLiquidType", "sourceMix", "destinationMix"';
    assert.throws(() => new StageList().add("Seeding", earlierForm), {
      message: `A stage's settings need ${SETTING_NAMES_TEXT}, but are missing ${missing}.`,
    });
  });

  test("settings without sourceMix and destinationMix (the form before 2026-10-30) give the missing error, naming both", () => {
    const beforeMixing = {
      sourceTechnique: "Aspirate_Slow",
      sourceLiquidType: "Cells",
      destinationTechnique: "Dispense_Clean",
      destinationLiquidType: "Cells",
    };
    const message = `A stage's settings need ${SETTING_NAMES_TEXT}, but are missing "sourceMix", "destinationMix".`;
    assert.throws(() => new StageList().add("Seeding", beforeMixing), { message });
    assert.throws(() => makeList("Seeding").changeSettings("1", beforeMixing), { message });
  });

  test("a setting that comes from a class, not the object itself, counts as missing", () => {
    // A test-only class whose destination liquid type comes from a getter on the class, so the
    // object itself doesn't hold it.
    class SettingsWithClassLiquidType {
      // Sets every setting except destinationLiquidType on the object itself.
      constructor() {
        const settings = makeSettings();
        this.sourceTechnique = settings.sourceTechnique;
        this.sourceLiquidType = settings.sourceLiquidType;
        this.destinationTechnique = settings.destinationTechnique;
        this.sourceMix = settings.sourceMix;
        this.destinationMix = settings.destinationMix;
      }

      // Returns the destination liquid type from the class, not from the object.
      get destinationLiquidType() {
        return "Cells";
      }
    }
    assert.throws(() => new StageList().add("Seeding", new SettingsWithClassLiquidType()), {
      message: `A stage's settings need ${SETTING_NAMES_TEXT}, but are missing "destinationLiquidType".`,
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

  test("settings in the earlier form, with tipType and changeTipsFirst, give the extra-setting error, naming both, in the order they appear", () => {
    const earlierForm = { ...makeSettings(), tipType: "BC230", changeTipsFirst: true };
    assert.throws(() => new StageList().add("Seeding", earlierForm), {
      message: `A stage's settings can only have ${SETTING_NAMES_TEXT}, but also got "tipType", "changeTipsFirst".`,
    });
  });

  test("settings in the form before 2026-10-30, with probes, give the extra-setting error, naming probes", () => {
    const beforeProbesMoved = { ...makeSettings(), probes: [1, 2, 3, 4] };
    assert.throws(() => new StageList().add("Seeding", beforeProbesMoved), {
      message: `A stage's settings can only have ${SETTING_NAMES_TEXT}, but also got "probes".`,
    });
    assert.throws(() => makeList("Seeding").changeSettings("1", beforeProbesMoved), {
      message: `A stage's settings can only have ${SETTING_NAMES_TEXT}, but also got "probes".`,
    });
  });

  test("missing settings are checked before extra ones", () => {
    const settings = { ...makeSettings(), tiptype: "BC230" };
    delete settings.destinationLiquidType;
    assert.throws(() => new StageList().add("Seeding", settings), {
      message: `A stage's settings need ${SETTING_NAMES_TEXT}, but are missing "destinationLiquidType".`,
    });
  });

  test('each name setting given 5, "" and " Aspirate_Slow" gives its error, naming the setting in words', () => {
    const list = new StageList();
    const settingsInWords = [
      ["sourceTechnique", "source technique"],
      ["sourceLiquidType", "source liquid type"],
      ["destinationTechnique", "destination technique"],
      ["destinationLiquidType", "destination liquid type"],
    ];
    for (const [setting, words] of settingsInWords) {
      const cases = [
        [5, `The ${words} must be text, but got 5.`],
        ["", `The ${words} is blank. Give it at least one character that isn't a space.`],
        [" Aspirate_Slow", `The ${words} " Aspirate_Slow" has spaces at the start or end. Remove them.`],
      ];
      for (const [value, message] of cases) {
        assert.throws(() => list.add("Seeding", { ...makeSettings(), [setting]: value }), { message });
      }
    }
  });

  test('sourceMix 5, "x" and [] give the mix-form error; destinationMix 5 names destination mix', () => {
    const list = makeList("Seeding");
    const start = "The source mix must be null (no mixing) or an object with share, times and speed, but got";
    for (const [mix, shown] of [[5, "5"], ["x", '"x"'], [[], "a list"]]) {
      const message = `${start} ${shown}.`;
      assert.throws(() => list.add("Treatment", { ...makeSettings(), sourceMix: mix }), { message });
      assert.throws(() => list.changeSettings("1", { ...makeSettings(), sourceMix: mix }), { message });
    }
    assert.throws(() => list.add("Treatment", { ...makeSettings(), destinationMix: 5 }), {
      message:
        "The destination mix must be null (no mixing) or an object with share, times and speed, but got 5.",
    });
  });

  test("a mix missing speed gives the missing error; missing several names them all, in order", () => {
    const list = new StageList();
    assert.throws(() => list.add("Seeding", { ...makeSettings(), sourceMix: { share: 90, times: 3 } }), {
      message: 'The source mix needs share, times and speed, but is missing "speed".',
    });
    assert.throws(() => list.add("Seeding", { ...makeSettings(), destinationMix: { times: 3 } }), {
      message: 'The destination mix needs share, times and speed, but is missing "share", "speed".',
    });
  });

  test("a mix with an extra volume gives the extra error; several extras are named in the order they appear", () => {
    const list = new StageList();
    const withVolume = { share: 90, times: 3, speed: 400, volume: 50 };
    assert.throws(() => list.add("Seeding", { ...makeSettings(), sourceMix: withVolume }), {
      message: 'The source mix can only have share, times and speed, but also got "volume".',
    });
    const twoExtras = { volume: 50, share: 90, times: 3, speed: 400, on: true };
    assert.throws(() => list.add("Seeding", { ...makeSettings(), destinationMix: twoExtras }), {
      message: 'The destination mix can only have share, times and speed, but also got "volume", "on".',
    });
  });

  test("a mix missing a property is reported before an extra one", () => {
    const mix = { share: 90, times: 3, volume: 50 };
    assert.throws(() => new StageList().add("Seeding", { ...makeSettings(), sourceMix: mix }), {
      message: 'The source mix needs share, times and speed, but is missing "speed".',
    });
  });

  test("a mix property that comes from a class, not the object itself, counts as missing", () => {
    // A test-only class whose speed comes from a getter on the class, so the object itself doesn't
    // hold it.
    class MixWithClassSpeed {
      // Sets share and times on the object itself.
      constructor() {
        this.share = 90;
        this.times = 3;
      }

      // Returns the speed from the class, not from the object.
      get speed() {
        return 400;
      }
    }
    assert.throws(() => new StageList().add("Seeding", { ...makeSettings(), sourceMix: new MixWithClassSpeed() }), {
      message: 'The source mix needs share, times and speed, but is missing "speed".',
    });
  });

  test('share 0, -5, 100.5, "90" and null give the share error; 100 and 0.1 are accepted', () => {
    const list = new StageList();
    for (const [share, shown] of [[0, "0"], [-5, "-5"], [100.5, "100.5"], ["90", '"90"'], [null, "null"]]) {
      assert.throws(
        () => list.add("Seeding", { ...makeSettings(), sourceMix: { share, times: 3, speed: 400 } }),
        {
          message: `The source mix's share must be a number above 0 and at most 100 (a percentage of the well), but got ${shown}.`,
        },
      );
    }
    for (const share of [100, 0.1]) {
      const { stageList, id } = list.add("Seeding", { ...makeSettings(), sourceMix: { share, times: 3, speed: 400 } });
      assert.equal(stageList.get(id).settings.sourceMix.share, share);
    }
  });

  test('times 0, 2.5, -1 and "3" give the times error', () => {
    const list = new StageList();
    for (const [times, shown] of [[0, "0"], [2.5, "2.5"], [-1, "-1"], ["3", '"3"']]) {
      assert.throws(
        () => list.add("Seeding", { ...makeSettings(), destinationMix: { share: 90, times, speed: 400 } }),
        { message: `The destination mix's times must be a whole number, at least 1, but got ${shown}.` },
      );
    }
  });

  test('speed 0, -1 and "400" give the speed error', () => {
    const list = new StageList();
    for (const [speed, shown] of [[0, "0"], [-1, "-1"], ["400", '"400"']]) {
      assert.throws(
        () => list.add("Seeding", { ...makeSettings(), sourceMix: { share: 90, times: 3, speed } }),
        { message: `The source mix's speed must be a number of µL/s above 0, but got ${shown}.` },
      );
    }
  });

  test("checks run in order: within a mix, share before times before speed; the source mix before the destination mix; names before mixes", () => {
    const list = new StageList();
    const allBad = { share: 0, times: 0, speed: 0 };
    assert.throws(() => list.add("Seeding", { ...makeSettings(), sourceMix: allBad }), {
      message: "The source mix's share must be a number above 0 and at most 100 (a percentage of the well), but got 0.",
    });
    assert.throws(() => list.add("Seeding", { ...makeSettings(), sourceMix: { share: 90, times: 0, speed: 0 } }), {
      message: "The source mix's times must be a whole number, at least 1, but got 0.",
    });
    assert.throws(() => list.add("Seeding", { ...makeSettings(), sourceMix: 5, destinationMix: 5 }), {
      message: "The source mix must be null (no mixing) or an object with share, times and speed, but got 5.",
    });
    assert.throws(() => list.add("Seeding", { ...makeSettings(), destinationLiquidType: "", sourceMix: 5 }), {
      message: "The destination liquid type is blank. Give it at least one character that isn't a space.",
    });
  });

  test('checks run in order: rename("9", "") reports the missing stage', () => {
    assert.throws(() => makeList("Seeding").rename("9", ""), {
      message: 'There\'s no stage "9" in the stage list.',
    });
  });

  test("checks run in order: settings with a bad source technique and a bad destination liquid type report the source technique", () => {
    const settings = { ...makeSettings(), sourceTechnique: "", destinationLiquidType: 5 };
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
    assert.throws(() => list.changeSettings("1", { ...makeSettings(), sourceTechnique: "" }));
    assert.throws(() => list.remove("9"));
    assert.deepEqual(list.listStages(), [{ id: "1", name: "Seeding", settings: makeSettings() }]);
  });
});
