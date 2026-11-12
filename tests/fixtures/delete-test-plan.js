// delete-test-plan.js — the test plan with a bit of everything (trash.md, section 6), shared by the
// tests of deleting (transfer-designer.test.js), of the trash (trash.test.js) and the browser
// walk-through of deleting (tests/browser/delete.walk.js).
//
// The plan is built with the transfer designer's own edits, so it's valid by construction, and it
// can be written as Biomek files: every trough holds what the plan draws from it above its dead
// volume, and a margin. Labware, tip types and volumes come from config/, never by name (CLAUDE.md,
// "Tests follow config/"). Stages are named so each keeps its name when stages are renumbered:
//   1. [S01 Media row A, S02 Media row B]                         START: TIP_TYPES[0] on probesFor(4)
//   2. [S03 Drug A row A, S04 Drug B row B, S05 Dye row B, S06 Mix row A (a mix step)]
//                                                                 TIP_TYPES[1] (or [0]) on probesFor(2)
//   3. [S07 Media row C]                                          TIP_TYPES[0] on probesFor(8)
//   4. [S08 Dye row C, S09 Media row H]                           TIP_TYPES[0] on probesFor(1)
//   5. Randomization1, run: Drug A, Drug B (4 replicates each), Media filler, into D1–D6 and E1–E6
//   6. [S10 Media row G, S11 Dye row G]                           TIP_TYPES[0] on probesFor(4)
//   7. a transfer table: Media into F1–F4, Dye into F3 and F4     TIP_TYPES[0] on probesFor(3) each
// mixingBoxTestPlan() adds a fresh-tip mixing box before S08's tip group: the plate's A1 to A4 and
// C1, five mix steps (Mix 1 of 5 to Mix 5 of 5), each on new tips, TIP_TYPES[0] on probesFor(4).

import { DECK } from "../../config/deck.js";
import { TIP_TYPES } from "../../config/tip-types.js";
import { COMPONENT_COLORS } from "../../config/component-colors.js";
import { DEFAULT_TRANSFER_VOLUME } from "../../config/default-volumes.js";
import { gridOf, deadVolumeOf } from "../../src/shared/deck/deck.js";
import { GRID_96, GRID_1X12_NUMBERED } from "../../src/shared/well-grid/well-grid.js";
import { writeRunFiles } from "../../src/shared/file-writer/file-writer.js";
import {
  emptyPlan,
  setExperimentName,
  addStage,
  addMixStep,
  mixWells,
  renameStage,
  addTransfer,
  addTipChange,
  setTipType,
  setTipProbes,
  probesFor,
  addComponent,
  addToWells,
  addRandomization,
  setRandomization,
  runRandomization,
  setWellLabel,
  addTransferTable,
  addMixingBox,
  columnBoxes,
  randomizationAt,
  transferTableAt,
  mixingBoxAt,
  tipsUsed,
  transfersIn,
  isMixStep,
} from "../../src/tools/transfer-designer/transfer-designer.js";

// The deck's first reservoir and first 96-well labware ("the plate"), found by their grids.
export const RESERVOIR = DECK.find((entry) => gridOf(entry.name) === GRID_1X12_NUMBERED).name;
export const PLATE = DECK.find((entry) => gridOf(entry.name) === GRID_96).name;

// The experiment name the test plan has.
export const EXPERIMENT_NAME = "DeleteTest";

// The second tip type, or the first when the configuration has only one.
const SECOND_TIP_TYPE = TIP_TYPES[1] ?? TIP_TYPES[0];

// The components, each with the reservoir trough it's in.
export const TROUGHS = { Media: "1", "Drug A": "2", "Drug B": "3", Dye: "4" };

// How many transfers the plan draws from each component's trough (trash.md, section 6).
export const TRANSFERS_DRAWN = { Media: 28, "Drug A": 8, "Drug B": 8, Dye: 14 };

// The fixed timestamp biomekOutput writes the files with.
export const OUTPUT_TIMESTAMP = new Date(2026, 10, 11, 12, 0, 0);

// The ordinary stages, in column order: each one's name, component, plate row, and the tip group
// (1 to 6, as in the header) it's in. S06 is the mix step.
const STAGES = [
  { name: "S01 Media row A", component: "Media", row: "A", group: 1 },
  { name: "S02 Media row B", component: "Media", row: "B", group: 1 },
  { name: "S03 Drug A row A", component: "Drug A", row: "A", group: 2 },
  { name: "S04 Drug B row B", component: "Drug B", row: "B", group: 2 },
  { name: "S05 Dye row B", component: "Dye", row: "B", group: 2 },
  { name: "S06 Mix row A", component: null, row: "A", group: 2 },
  { name: "S07 Media row C", component: "Media", row: "C", group: 3 },
  { name: "S08 Dye row C", component: "Dye", row: "C", group: 4 },
  { name: "S09 Media row H", component: "Media", row: "H", group: 4 },
  { name: "S10 Media row G", component: "Media", row: "G", group: 6 },
  { name: "S11 Dye row G", component: "Dye", row: "G", group: 6 },
];

// Each ordinary tip group's tips, by its number in the header. The randomization's stages, run
// from the stage before them, are on group 4's.
export const GROUP_TIPS = {
  1: { tipType: TIP_TYPES[0], probes: probesFor(4) },
  2: { tipType: SECOND_TIP_TYPE, probes: probesFor(2) },
  3: { tipType: TIP_TYPES[0], probes: probesFor(8) },
  4: { tipType: TIP_TYPES[0], probes: probesFor(1) },
  6: { tipType: TIP_TYPES[0], probes: probesFor(4) },
};

// The transfer table's tips, on each of its stages.
export const TABLE_TIPS = { tipType: TIP_TYPES[0], probes: probesFor(3) };

// A well of the plate, e.g. plateWell("A1") → { labware: "Plate1", well: "A1" }.
export function plateWell(well) {
  return { labware: PLATE, well };
}

// A trough of the reservoir, e.g. trough("1") → { labware: "Res1", well: "1" }.
export function trough(well) {
  return { labware: RESERVOIR, well };
}

// The wells of a plate row the stages use: its first four, e.g. rowWells("A") → A1 to A4.
function rowWells(row) {
  return [1, 2, 3, 4].map((column) => plateWell(`${row}${column}`));
}

// The volume each trough is filled with: its labware type's dead volume, plus a transfer's worth
// for every transfer drawn from it, plus one more, e.g. 2000 + 28 × 50 + 50 for Media.
export function troughVolume(component) {
  return deadVolumeOf(RESERVOIR) + DEFAULT_TRANSFER_VOLUME * (TRANSFERS_DRAWN[component] + 1);
}

// The test plan with a bit of everything (header; trash.md, section 6). A new plan each time.
export function deleteTestPlan() {
  let plan = withComponents(emptyPlan().plan);
  plan = setExperimentName(plan, EXPERIMENT_NAME);
  plan = withOrdinaryStages(plan);
  plan = withRandomization(plan);
  return withTransferTable(plan);
}

// The test plan with a mixing box added before S08's tip group (trash.md, section 6): the way
// "freshTip", the plate's A1 to A4 and C1, on TIP_TYPES[0] and probesFor(4), so five mix steps, each
// on new tips. A new plan each time.
export function mixingBoxTestPlan() {
  const plan = deleteTestPlan();
  const draft = {
    way: "freshTip",
    wells: ["A1", "A2", "A3", "A4", "C1"].map(plateWell),
    tipType: TIP_TYPES[0],
    probes: probesFor(4),
  };
  return addMixingBox(plan, draft, stageIdOf(plan, "S08")).plan;
}

// The plan with the four components, each filling its trough (troughVolume).
function withComponents(plan) {
  let built = plan;
  Object.keys(TROUGHS).forEach((name, index) => {
    built = addComponent(built, name, COMPONENT_COLORS[index]);
    built = addToWells(built, [trough(TROUGHS[name])], name, troughVolume(name));
  });
  return built;
}

// The plan (one stage, from emptyPlan) with the ordinary stages S01 to S11 in their tip groups.
function withOrdinaryStages(plan) {
  let built = plan;
  let previousGroup = 1;
  STAGES.forEach((stage, index) => {
    let id = built.stageOrder[0];
    if (index > 0) {
      const added = stage.component === null ? addMixStep(built, null) : addStage(built, null);
      built = added.plan;
      id = added.id;
    }
    built = renameStage(built, id, stage.name);
    built = withStageTransfers(built, id, stage);
    if (stage.group !== previousGroup) {
      built = addTipChange(built, id);
      previousGroup = stage.group;
    }
    const key = index === 0 ? "start" : id;
    if (index === 0 || built.tipChanges[id] !== undefined) {
      built = setTipType(built, key, GROUP_TIPS[stage.group].tipType);
      built = setTipProbes(built, key, GROUP_TIPS[stage.group].probes);
    }
  });
  return built;
}

// The plan with stage `id`'s transfers: DEFAULT_TRANSFER_VOLUME from its component's trough into
// the first four wells of its row, or, for the mix step, those wells mixed.
function withStageTransfers(plan, id, stage) {
  if (stage.component === null) {
    return mixWells(plan, id, rowWells(stage.row));
  }
  return rowWells(stage.row).reduce(
    (built, destination) =>
      addTransfer(built, {
        type: "transfer",
        source: trough(TROUGHS[stage.component]),
        destination,
        volume: DEFAULT_TRANSFER_VOLUME,
        stage: id,
      }),
    plan,
  );
}

// The plan with the run randomization Randomization1 before S10: Drug A and Drug B, 4 replicates
// each, the Media trough the filler, into D1 to D6 and E1 to E6, seed 7.
function withRandomization(plan) {
  const added = addRandomization(plan, stageIdOf(plan, "S10"), { seed: 7, volume: DEFAULT_TRANSFER_VOLUME });
  const fill = ["D", "E"].flatMap((row) => [1, 2, 3, 4, 5, 6].map((column) => plateWell(`${row}${column}`)));
  const set = setRandomization(added.plan, added.id, {
    sources: [
      { ...trough(TROUGHS["Drug A"]), replicates: 4, filler: false, sharesTips: false },
      { ...trough(TROUGHS["Drug B"]), replicates: 4, filler: false, sharesTips: false },
      { ...trough(TROUGHS.Media), replicates: null, filler: true, sharesTips: false },
    ],
    fill,
  });
  return runRandomization(set, added.id);
}

// The plan with the transfer table, last: F1 and F2 labeled Control, F3 and F4 Dyed; Media into all
// four and Dye into the Dyed ones, from troughs 1 and 4; each of its stages on TABLE_TIPS.
function withTransferTable(plan) {
  let built = plan;
  for (const [well, label] of [["F1", "Control"], ["F2", "Control"], ["F3", "Dyed"], ["F4", "Dyed"]]) {
    built = setWellLabel(built, plateWell(well), label);
  }
  const volume = String(DEFAULT_TRANSFER_VOLUME);
  const draft = {
    table: [["Dest Well Label", "Media", "Dye"], ["Control", volume, ""], ["Dyed", volume, volume]],
    sources: { Media: [trough(TROUGHS.Media)], Dye: [trough(TROUGHS.Dye)] },
  };
  const added = addTransferTable(built, draft, null);
  built = added.plan;
  for (const { stage } of transferTableAt(built, added.id).stages) {
    built = setTipType(built, stage, TABLE_TIPS.tipType);
    built = setTipProbes(built, stage, TABLE_TIPS.probes);
  }
  return built;
}

// The ID of the stage called `name`, or whose name's first word is `name`, e.g. stageIdOf(plan,
// "S03") → "3". Throws if there's none, so a test can't go on with a stage that isn't there.
export function stageIdOf(plan, name) {
  const found = plan.stageList
    .listStages()
    .find((stage) => stage.name === name || stage.name.split(" ")[0] === name);
  if (found === undefined) {
    throw new Error(`The plan has no stage called ${name}.`);
  }
  return found.id;
}

// The plan up to its IDs (trash.md, section 6): the column's boxes in order, each tip group as its
// tips and stages, each stage as its name, kind, settings and transfers; each randomization,
// transfer table and mixing box with what it holds and its tip groups; then the plan's other parts. Two plans with
// equal outlines differ only in their IDs.
export function planOutline(plan) {
  return {
    boxes: columnBoxes(plan).map((box) => boxOutline(plan, box)),
    components: plan.components,
    startingContents: plan.startingContents,
    labwareLabels: plan.labwareLabels,
    wellLabels: plan.wellLabels,
    experimentName: plan.experimentName,
  };
}

// One box of columnBoxes, outlined without IDs.
function boxOutline(plan, box) {
  if (box.kind === "tipGroup") {
    return { kind: "tipGroup", ...tipGroupOutline(plan, box) };
  }
  const tipGroups = box.tipGroups.map((group) => tipGroupOutline(plan, group));
  if (box.kind === "randomization") {
    const { name, sources, fill, seed, volume, settings, tipType, probes } = randomizationAt(plan, box.id);
    return { kind: "randomization", name, sources, fill, seed, volume, settings, tipType, probes, tipGroups };
  }
  if (box.kind === "mixingBox") {
    return { kind: "mixingBox", way: mixingBoxAt(plan, box.id).way, tipGroups };
  }
  const { table, sources } = transferTableAt(plan, box.id);
  return { kind: "transferTable", table, sources, tipGroups };
}

// A tip group, { tipType, probes, stages }, its stages outlined.
function tipGroupOutline(plan, group) {
  return {
    tipType: group.tipType,
    probes: group.probes,
    stages: group.stages.map((id) => stageOutline(plan, id)),
  };
}

// A stage without its ID: { name, kind, settings, transfers }, its transfers in operation order as
// { source, destination, volume }.
function stageOutline(plan, id) {
  const { name, settings } = plan.stageList.get(id);
  return {
    name,
    kind: isMixStep(plan, id) ? "mixStep" : "stage",
    settings,
    transfers: transfersIn(plan, id).map(({ source, destination, volume }) => ({ source, destination, volume })),
  };
}

// The plan's Biomek files and tips: { folderName, files: [{ name, text }], tipsUsed }, the files
// written with OUTPUT_TIMESTAMP. Throws as writeRunFiles does, e.g. for a plan with an overdraw.
export function biomekOutput(plan) {
  const { folderName, files } = writeRunFiles(plan, OUTPUT_TIMESTAMP);
  return { folderName, files: files.map(({ name, text }) => ({ name, text })), tipsUsed: tipsUsed(plan) };
}
