// Unit tests for mix-volumes.js. Each test comes from the "Test cases" section of mix-volumes.md.
//
// They build plans through the transfer designer's edits, so every plan is one the page could make,
// and find labware in DECK by grid and labware type rather than naming it, so they still pass when
// the deck changes. They also check MIX_VOLUME_LIMITS in config/tip-types.js, and SHORT_MIX_SHARE
// and MIN_MIX_VOLUME in config/mixing.js (ADR 0009).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DECK } from "../../../config/deck.js";
import { TIP_TYPES, MIX_VOLUME_LIMITS } from "../../../config/tip-types.js";
import { SHORT_MIX_SHARE, MIN_MIX_VOLUME } from "../../../config/mixing.js";
import {
  START,
  emptyPlan,
  addStage,
  setStageMix,
  addTransfer,
  addTipChange,
  setTipType,
  addComponent,
  addToWells,
} from "../../tools/transfer-designer/transfer-designer.js";
import { mixVolumes } from "./mix-volumes.js";

// A 96-well labware, a 96-well labware of another labware type (a deep-well plate), and the
// numbered (reservoir) labware, each found in DECK with its labware type.
const PLATE = DECK.find((entry) => entry.grid === "GRID_96");
const DEEP = DECK.find(
  (entry) => entry.grid === "GRID_96" && entry.labwareType !== PLATE.labwareType,
);
const RESERVOIR = DECK.find((entry) => entry.grid === "GRID_1X12_NUMBERED");

// The one component the tests put in wells.
const MEDIA = "Media";

// The mix the specification's examples use, at a given share, e.g. mixAt(90) →
// { share: 90, times: 3, speed: 400 }. A new object each time.
function mixAt(share) {
  return { share, times: 3, speed: 400 };
}

// A well on the deck, e.g. well(RESERVOIR, "1") → { labware: "Res1", well: "1" }.
function well(entry, name) {
  return { labware: entry.name, well: name };
}

// A plan with `count` stages, "1" to `count`, each added last, and Media in its components.
function planWithStages(count) {
  let { plan } = emptyPlan();
  for (let added = 1; added < count; added += 1) {
    plan = addStage(plan, null).plan;
  }
  return addComponent(plan, MEDIA, "#4e79a7");
}

// The plan with `volume` µL of Media in each of `wells` at the start.
function withMedia(plan, wells, volume) {
  return addToWells(plan, wells, MEDIA, volume);
}

// The plan with a transfer of `volume` µL in `stage` from `source` to `destination`,
// e.g. withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 20).
function withTransfer(plan, stage, source, destination, volume) {
  return addTransfer(plan, { type: "transfer", source, destination, volume, stage });
}

// A plan with 1000 µL of Media in troughs 1 and 2, and `count` stages.
function planWithTroughs(count = 1) {
  return withMedia(planWithStages(count), [well(RESERVOIR, "1"), well(RESERVOIR, "2")], 1000);
}

// The plan with its START tips of `tipType`.
function onTips(plan, tipType) {
  return setTipType(plan, START, tipType);
}

// A tip type whose mix volume limit is at least `volume`, so a test's mix isn't capped.
function tipTypeHolding(volume) {
  return TIP_TYPES.find((tipType) => MIX_VOLUME_LIMITS[tipType] >= volume);
}

// The rows of the stage with `id` in a mixVolumes result.
function rowsOf(result, id) {
  return result.stages.find((entry) => entry.stage === id).rows;
}

// Everything a plan holds, as text, so a test can check a plan is unchanged.
function snapshot(plan) {
  return JSON.stringify({
    ...plan,
    operationList: plan.operationList.listOperations(),
    stageList: plan.stageList.listStages(),
  });
}

describe("mix-volumes", () => {
  // --- Configuration ---

  test("MIX_VOLUME_LIMITS has exactly one entry for each tip type in TIP_TYPES, each a number above 0", () => {
    assert.deepEqual(Object.keys(MIX_VOLUME_LIMITS).sort(), [...TIP_TYPES].sort());
    for (const tipType of TIP_TYPES) {
      const limit = MIX_VOLUME_LIMITS[tipType];
      assert.ok(Number.isFinite(limit) && limit > 0, tipType);
    }
  });

  // --- Volumes ---

  test("a plan whose stages don't mix gives every row null at both ends, and no problems", () => {
    let plan = planWithTroughs(2);
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 20);
    plan = withTransfer(plan, "2", well(RESERVOIR, "2"), well(PLATE, "A2"), 20);
    const result = mixVolumes(plan);
    assert.equal(result.stages.length, 2);
    for (const { rows } of result.stages) {
      for (const row of rows) {
        assert.equal(row.sourceMixVolume, null);
        assert.equal(row.destinationMixVolume, null);
      }
    }
    assert.deepEqual(result.problems, []);
  });

  test("a stage without transfers isn't listed; a stage split into two substages has two rows, in substage order", () => {
    let plan = withMedia(planWithTroughs(3), [well(PLATE, "H12")], 100);
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 10);
    plan = withTransfer(plan, "1", well(PLATE, "H12"), well(DEEP, "A1"), 20);
    plan = withTransfer(plan, "1", well(RESERVOIR, "2"), well(PLATE, "A2"), 30);
    plan = withTransfer(plan, "3", well(RESERVOIR, "1"), well(PLATE, "B1"), 10);
    const result = mixVolumes(plan);
    assert.deepEqual(
      result.stages.map((entry) => entry.stage),
      ["1", "3"],
    );
    const rows = rowsOf(result, "1");
    assert.deepEqual(
      rows.map((row) => [row.sourceLabwareType, row.destinationLabwareType, row.transfers.length]),
      [
        [RESERVOIR.labwareType, PLATE.labwareType, 2],
        [PLATE.labwareType, DEEP.labwareType, 1],
      ],
    );
    assert.deepEqual(Object.keys(rows[0]).sort(), [
      "destinationLabwareType",
      "destinationMixVolume",
      "mixedWells",
      "sourceLabwareType",
      "sourceMixVolume",
      "transfers",
    ]);
  });

  test("destination: 20 µL into an empty well and 100 µL into one holding 50 µL, at 90% on BC230 tips, mixes 18", () => {
    let plan = withMedia(planWithTroughs(), [well(PLATE, "A2")], 50);
    plan = onTips(plan, "BC230");
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 20);
    plan = withTransfer(plan, "1", well(RESERVOIR, "2"), well(PLATE, "A2"), 100);
    plan = setStageMix(plan, "1", "destination", mixAt(90));
    const result = mixVolumes(plan);
    assert.equal(result.stages[0].rows[0].destinationMixVolume, 18);
    assert.equal(result.stages[0].rows[0].sourceMixVolume, null);
    assert.deepEqual(result.problems, []);
  });

  test("smallest dispense: 30 and 10 µL into a well holding 50 µL holds 60 at least, so at 50% the row mixes 30", () => {
    let plan = withMedia(planWithTroughs(), [well(PLATE, "A1")], 50);
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 30);
    plan = withTransfer(plan, "1", well(RESERVOIR, "2"), well(PLATE, "A1"), 10);
    plan = setStageMix(plan, "1", "destination", mixAt(50));
    assert.equal(mixVolumes(plan).stages[0].rows[0].destinationMixVolume, 30);
  });

  test("source: 1000 µL drawn 100, 50 and 200 µL holds 700 at least, so at 90% on BC1070 tips the row mixes 630", () => {
    let plan = onTips(planWithTroughs(), "BC1070");
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 100);
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A2"), 50);
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A3"), 200);
    plan = setStageMix(plan, "1", "source", mixAt(90));
    assert.equal(mixVolumes(plan).stages[0].rows[0].sourceMixVolume, 630);
  });

  test("its own stage, not the whole plan: a destination filled again later, and a source drawn from earlier", () => {
    let plan = onTips(planWithTroughs(2), tipTypeHolding(300));
    // Stage 1: 20 µL into the empty A1 (from trough 2), and 400 µL from trough 1.
    plan = withTransfer(plan, "1", well(RESERVOIR, "2"), well(PLATE, "A1"), 20);
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A2"), 400);
    // Stage 2: 100 µL more into A1, from trough 1, which holds 600 µL after stage 1.
    plan = withTransfer(plan, "2", well(RESERVOIR, "1"), well(PLATE, "A1"), 100);
    plan = setStageMix(plan, "1", "destination", mixAt(90));
    plan = setStageMix(plan, "2", "source", mixAt(50));
    plan = setStageMix(plan, "2", "destination", mixAt(90));
    const result = mixVolumes(plan);
    // Stage 1 mixes A1 with 20 µL in it, whatever stage 2 adds later.
    assert.equal(rowsOf(result, "1")[0].destinationMixVolume, 18);
    // Stage 2: trough 1 holds 600 µL (1000 − 400 drawn by stage 1), so 50% is 300; A1 held 20.
    assert.equal(rowsOf(result, "2")[0].sourceMixVolume, 300);
    assert.equal(rowsOf(result, "2")[0].destinationMixVolume, 108);
  });

  test("earlier rows count: a source holding 100 µL, drawn 60 by row A and 30 by row B, holds 40 when row B mixes it, so 36 at 90%", () => {
    let plan = withMedia(planWithStages(1), [well(RESERVOIR, "3")], 100);
    plan = withTransfer(plan, "1", well(RESERVOIR, "3"), well(PLATE, "A1"), 60);
    plan = withTransfer(plan, "1", well(RESERVOIR, "3"), well(DEEP, "A1"), 30);
    plan = setStageMix(plan, "1", "source", mixAt(90));
    const rows = rowsOf(mixVolumes(plan), "1");
    assert.deepEqual(
      rows.map((row) => row.sourceMixVolume),
      [90, 36],
    );
  });

  test("a well into itself: 10 µL from a well holding 50 µL into itself holds 50 at each end, so both mix 45 at 90%", () => {
    let plan = withMedia(planWithStages(1), [well(PLATE, "A1")], 50);
    plan = withTransfer(plan, "1", well(PLATE, "A1"), well(PLATE, "A1"), 10);
    plan = setStageMix(plan, "1", "source", mixAt(90));
    plan = setStageMix(plan, "1", "destination", mixAt(90));
    const [row] = rowsOf(mixVolumes(plan), "1");
    assert.equal(row.sourceMixVolume, 45);
    assert.equal(row.destinationMixVolume, 45);
  });

  test("never below 0: a source overdrawn by its stage holds 0, and gives a mix problem", () => {
    // 20 µL drawn twice, 30 µL each: 20 − 60 + 30 is below 0, so it holds 0.
    let plan = withMedia(planWithStages(1), [well(RESERVOIR, "3")], 20);
    plan = withTransfer(plan, "1", well(RESERVOIR, "3"), well(PLATE, "A1"), 30);
    plan = withTransfer(plan, "1", well(RESERVOIR, "3"), well(PLATE, "A2"), 30);
    plan = setStageMix(plan, "1", "source", mixAt(90));
    const result = mixVolumes(plan);
    assert.equal(rowsOf(result, "1")[0].sourceMixVolume, 0);
    assert.deepEqual(result.problems, [
      { stage: "1", end: "source", labware: RESERVOIR.name, well: "3", held: 0 },
    ]);
  });

  test("rounding: 75% of 120 µL gives 90; 90% of 99.99 µL gives 89.9; 33% of 10 µL gives 3.3", () => {
    const cases = [
      [75, 120, 90],
      [90, 99.99, 89.9],
      [33, 10, 3.3],
    ];
    for (const [share, volume, expected] of cases) {
      let plan = onTips(planWithTroughs(), tipTypeHolding(volume));
      plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), volume);
      plan = setStageMix(plan, "1", "destination", mixAt(share));
      assert.equal(mixVolumes(plan).stages[0].rows[0].destinationMixVolume, expected, `${share}% of ${volume}`);
    }
  });

  test("the tip limit: 90% of 1000 µL gives each tip type's limit if it's below 900, else 900; a tip change before the stage changes it", () => {
    for (const tipType of TIP_TYPES) {
      let plan = onTips(withMedia(planWithStages(1), [well(RESERVOIR, "3")], 1000), tipType);
      plan = withTransfer(plan, "1", well(RESERVOIR, "3"), well(PLATE, "A1"), 10);
      plan = setStageMix(plan, "1", "source", mixAt(90));
      assert.equal(
        mixVolumes(plan).stages[0].rows[0].sourceMixVolume,
        Math.min(900, MIX_VOLUME_LIMITS[tipType]),
        tipType,
      );
    }
    assert.equal(MIX_VOLUME_LIMITS.BC230, 200);
    assert.equal(Math.min(900, MIX_VOLUME_LIMITS.BC1070), 900);

    // Stage 1 on the smallest-limit tips; stage 2 after a tip change to the largest.
    const byLimit = [...TIP_TYPES].sort((a, b) => MIX_VOLUME_LIMITS[a] - MIX_VOLUME_LIMITS[b]);
    let plan = withMedia(planWithStages(2), [well(RESERVOIR, "3"), well(RESERVOIR, "4")], 1000);
    plan = onTips(plan, byLimit[0]);
    plan = setTipType(addTipChange(plan, "2"), "2", byLimit.at(-1));
    plan = withTransfer(plan, "1", well(RESERVOIR, "3"), well(PLATE, "A1"), 10);
    plan = withTransfer(plan, "2", well(RESERVOIR, "4"), well(PLATE, "A2"), 10);
    plan = setStageMix(plan, "1", "source", mixAt(90));
    plan = setStageMix(plan, "2", "source", mixAt(90));
    const result = mixVolumes(plan);
    assert.equal(rowsOf(result, "1")[0].sourceMixVolume, Math.min(900, MIX_VOLUME_LIMITS[byLimit[0]]));
    assert.equal(rowsOf(result, "2")[0].sourceMixVolume, Math.min(900, MIX_VOLUME_LIMITS[byLimit.at(-1)]));
  });

  test("each row on its own: in a stage with two substages, each row's volume comes from its own wells only", () => {
    let plan = withMedia(planWithTroughs(), [well(PLATE, "H12")], 300);
    plan = onTips(plan, tipTypeHolding(100));
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 10);
    plan = withTransfer(plan, "1", well(PLATE, "H12"), well(DEEP, "A1"), 200);
    plan = setStageMix(plan, "1", "destination", mixAt(50));
    const rows = rowsOf(mixVolumes(plan), "1");
    assert.deepEqual(
      rows.map((row) => row.destinationMixVolume),
      [5, 100],
    );
  });

  test("both ends: a stage mixing at both ends gives both volumes in each row", () => {
    let plan = withMedia(planWithTroughs(), [well(PLATE, "H12")], 300);
    plan = onTips(plan, tipTypeHolding(300));
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 10);
    plan = withTransfer(plan, "1", well(PLATE, "H12"), well(DEEP, "A1"), 200);
    plan = setStageMix(plan, "1", "source", mixAt(10));
    plan = setStageMix(plan, "1", "destination", mixAt(50));
    const rows = rowsOf(mixVolumes(plan), "1");
    assert.deepEqual(
      rows.map((row) => [row.sourceMixVolume, row.destinationMixVolume]),
      [
        [100, 5],
        [30, 100],
      ],
    );
  });

  // --- Mixed shares ---

  test("mixed shares: the section 4 example gives A1 holding 20 at 90%, not short, and A2 holding 150 at 12%, short", () => {
    let plan = withMedia(planWithTroughs(), [well(PLATE, "A2")], 50);
    plan = onTips(plan, "BC230");
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 20);
    plan = withTransfer(plan, "1", well(RESERVOIR, "2"), well(PLATE, "A2"), 100);
    plan = setStageMix(plan, "1", "destination", mixAt(90));
    assert.deepEqual(mixVolumes(plan).stages[0].rows[0].mixedWells, [
      { end: "destination", labware: PLATE.name, well: "A1", held: 20, share: 90, short: false },
      { end: "destination", labware: PLATE.name, well: "A2", held: 150, share: 12, short: true },
    ]);
  });

  test("a mix capped at the tips' limit is short when its share is under 40%: 200 µL of a source holding 1000 µL on BC230 tips", () => {
    let plan = onTips(planWithTroughs(), "BC230");
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 10);
    plan = setStageMix(plan, "1", "source", mixAt(90));
    const [row] = rowsOf(mixVolumes(plan), "1");
    assert.equal(row.sourceMixVolume, 200);
    assert.deepEqual(row.mixedWells, [
      { end: "source", labware: RESERVOIR.name, well: "1", held: 1000, share: 20, short: true },
    ]);
  });

  test("a well holding nothing when mixed gives share 0, short", () => {
    // 20 µL drawn twice, 30 µL each: it holds 0 when mixed (as in "never below 0").
    let plan = withMedia(planWithStages(1), [well(RESERVOIR, "3")], 20);
    plan = withTransfer(plan, "1", well(RESERVOIR, "3"), well(PLATE, "A1"), 30);
    plan = withTransfer(plan, "1", well(RESERVOIR, "3"), well(PLATE, "A2"), 30);
    plan = setStageMix(plan, "1", "source", mixAt(90));
    assert.deepEqual(rowsOf(mixVolumes(plan), "1")[0].mixedWells, [
      { end: "source", labware: RESERVOIR.name, well: "3", held: 0, share: 0, short: true },
    ]);
  });

  test(`a share of exactly SHORT_MIX_SHARE (${SHORT_MIX_SHARE}) isn't short; just under it (39.99) is`, () => {
    // A1 holds 100 µL when mixed, the emptiest, so at 40% the row mixes 40 µL: 40% of A1. A2 holds
    // 100.025 µL, so the same 40 µL is 39.99% of it.
    let plan = onTips(planWithTroughs(), tipTypeHolding(40));
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 100);
    plan = withTransfer(plan, "1", well(RESERVOIR, "2"), well(PLATE, "A2"), 100.025);
    plan = setStageMix(plan, "1", "destination", mixAt(40));
    const [atLimit, under] = rowsOf(mixVolumes(plan), "1")[0].mixedWells;
    assert.equal(SHORT_MIX_SHARE, 40);
    assert.equal(atLimit.share, 40);
    assert.equal(atLimit.short, false);
    assert.ok(under.share > 39.98 && under.share < 40, String(under.share));
    assert.equal(under.short, true);
  });

  test("a well a row draws from twice is listed once, with what it holds by the emptiest-well rule", () => {
    // Trough 1 holds 1000 µL, drawn 100 and 50 µL: it holds 900 at least when mixed (1000 − 150 + 50).
    let plan = onTips(planWithTroughs(), tipTypeHolding(450));
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 100);
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A2"), 50);
    plan = setStageMix(plan, "1", "source", mixAt(50));
    assert.deepEqual(rowsOf(mixVolumes(plan), "1")[0].mixedWells, [
      { end: "source", labware: RESERVOIR.name, well: "1", held: 900, share: 50, short: false },
    ]);
  });

  test("an end that doesn't mix lists no wells; a row that doesn't mix has mixedWells []; sources come before destinations", () => {
    let plan = onTips(planWithTroughs(), tipTypeHolding(900));
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 100);
    plan = withTransfer(plan, "1", well(RESERVOIR, "2"), well(PLATE, "A2"), 100);
    assert.deepEqual(rowsOf(mixVolumes(plan), "1")[0].mixedWells, []);

    const sourceOnly = setStageMix(plan, "1", "source", mixAt(90));
    assert.deepEqual(
      rowsOf(mixVolumes(sourceOnly), "1")[0].mixedWells.map((entry) => [entry.end, entry.well]),
      [
        ["source", "1"],
        ["source", "2"],
      ],
    );

    const both = setStageMix(sourceOnly, "1", "destination", mixAt(90));
    assert.deepEqual(
      rowsOf(mixVolumes(both), "1")[0].mixedWells.map((entry) => [entry.end, entry.labware, entry.well]),
      [
        ["source", RESERVOIR.name, "1"],
        ["source", RESERVOIR.name, "2"],
        ["destination", PLATE.name, "A1"],
        ["destination", PLATE.name, "A2"],
      ],
    );
  });

  test("config/mixing.js: SHORT_MIX_SHARE is a number above 0 and at most 100", () => {
    assert.equal(typeof SHORT_MIX_SHARE, "number");
    assert.ok(Number.isFinite(SHORT_MIX_SHARE));
    assert.ok(SHORT_MIX_SHARE > 0 && SHORT_MIX_SHARE <= 100);
  });

  // --- Problems ---

  test("a destination empty before the stage, given 0.05 µL and mixed at 90%, gives 0 and one problem", () => {
    let plan = planWithTroughs();
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 0.05);
    plan = setStageMix(plan, "1", "destination", mixAt(90));
    const result = mixVolumes(plan);
    assert.equal(result.stages[0].rows[0].destinationMixVolume, 0);
    assert.deepEqual(result.problems, [
      { stage: "1", end: "destination", labware: PLATE.name, well: "A1", held: 0.05 },
    ]);
  });

  test("a source drawn empty by the stage, with a smallest draw of 0.1 µL, mixed at 50%, gives 0 and a problem naming it", () => {
    let plan = withMedia(planWithStages(1), [well(RESERVOIR, "3")], 0.3);
    plan = withTransfer(plan, "1", well(RESERVOIR, "3"), well(PLATE, "A1"), 0.2);
    plan = withTransfer(plan, "1", well(RESERVOIR, "3"), well(PLATE, "A2"), 0.1);
    plan = setStageMix(plan, "1", "source", { share: 50, times: 2, speed: 100 });
    const result = mixVolumes(plan);
    assert.equal(result.stages[0].rows[0].sourceMixVolume, 0);
    assert.deepEqual(result.problems, [
      { stage: "1", end: "source", labware: RESERVOIR.name, well: "3", held: 0.1 },
    ]);
  });

  test("with two wells holding equally little, the problem names the first in the row's transfer order", () => {
    let plan = planWithTroughs();
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "B2"), 0.05);
    plan = withTransfer(plan, "1", well(RESERVOIR, "2"), well(PLATE, "A1"), 0.05);
    plan = setStageMix(plan, "1", "destination", mixAt(90));
    const { problems } = mixVolumes(plan);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].well, "B2");
  });

  test("problems are listed in stage order, then row order, source before destination", () => {
    // Stage "2" is added before stage "1", so it runs first.
    let plan = withMedia(planWithStages(1), [well(RESERVOIR, "3"), well(PLATE, "H1")], 0.05);
    plan = addStage(plan, "1").plan;
    assert.deepEqual(plan.stageOrder, ["2", "1"]);
    // Stage "2": row A from the reservoir to the plate, row B from the plate to the deep-well plate.
    plan = withTransfer(plan, "2", well(RESERVOIR, "3"), well(PLATE, "A1"), 0.05);
    plan = withTransfer(plan, "2", well(PLATE, "H1"), well(DEEP, "A1"), 0.05);
    // Stage "1": one row.
    plan = withMedia(plan, [well(RESERVOIR, "4")], 1000);
    plan = withTransfer(plan, "1", well(RESERVOIR, "4"), well(PLATE, "A2"), 0.05);
    for (const id of ["1", "2"]) {
      plan = setStageMix(plan, id, "source", mixAt(90));
      plan = setStageMix(plan, id, "destination", mixAt(90));
    }
    assert.deepEqual(
      mixVolumes(plan).problems.map((problem) => [problem.stage, problem.end, problem.labware, problem.well]),
      [
        ["2", "source", RESERVOIR.name, "3"],
        ["2", "destination", PLATE.name, "A1"],
        ["2", "source", PLATE.name, "H1"],
        ["2", "destination", DEEP.name, "A1"],
        ["1", "destination", PLATE.name, "A2"],
      ],
    );
  });

  test("a destination holding 0.9 µL when mixed at 90% gives 0.8 and a problem", () => {
    let plan = planWithTroughs();
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 0.9);
    plan = setStageMix(plan, "1", "destination", mixAt(90));
    const result = mixVolumes(plan);
    assert.equal(result.stages[0].rows[0].destinationMixVolume, 0.8);
    assert.deepEqual(result.problems, [
      { stage: "1", end: "destination", labware: PLATE.name, well: "A1", held: 0.9 },
    ]);
  });

  test("a destination holding 1.1 µL when mixed at 90% gives 0.9 (0.99 rounded down) and a problem", () => {
    let plan = planWithTroughs();
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 1.1);
    plan = setStageMix(plan, "1", "destination", mixAt(90));
    const result = mixVolumes(plan);
    assert.equal(result.stages[0].rows[0].destinationMixVolume, 0.9);
    assert.deepEqual(result.problems, [
      { stage: "1", end: "destination", labware: PLATE.name, well: "A1", held: 1.1 },
    ]);
  });

  test("a destination holding 1.2 µL when mixed at 90% gives 1 (1.08 rounded down) and no problem", () => {
    let plan = planWithTroughs();
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 1.2);
    plan = setStageMix(plan, "1", "destination", mixAt(90));
    const result = mixVolumes(plan);
    assert.equal(result.stages[0].rows[0].destinationMixVolume, 1);
    assert.deepEqual(result.problems, []);
  });

  test("config/mixing.js: MIN_MIX_VOLUME is a number above 0", () => {
    assert.equal(typeof MIN_MIX_VOLUME, "number");
    assert.ok(Number.isFinite(MIN_MIX_VOLUME));
    assert.ok(MIN_MIX_VOLUME > 0);
  });

  test("held is rounded to 3 decimal places: 0.1 + 0.2 µL is given as 0.3", () => {
    // Added in two steps, the well holds 0.30000000000000004 µL.
    let plan = withMedia(planWithStages(1), [well(RESERVOIR, "3")], 0.1);
    plan = withMedia(plan, [well(RESERVOIR, "3")], 0.2);
    plan = withTransfer(plan, "1", well(RESERVOIR, "3"), well(PLATE, "A1"), 0.3);
    plan = setStageMix(plan, "1", "source", mixAt(10));
    const { problems } = mixVolumes(plan);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].held, 0.3);
  });

  // --- Purity ---

  test("the plan is unchanged after mixVolumes, and two calls give equal results", () => {
    let plan = planWithTroughs();
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A1"), 0.05);
    plan = withTransfer(plan, "1", well(RESERVOIR, "1"), well(PLATE, "A2"), 50);
    plan = setStageMix(plan, "1", "source", mixAt(90));
    plan = setStageMix(plan, "1", "destination", mixAt(90));
    const before = snapshot(plan);
    const first = mixVolumes(plan);
    const second = mixVolumes(plan);
    assert.equal(snapshot(plan), before);
    assert.deepEqual(first, second);
  });
});
