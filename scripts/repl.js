// repl.js — opens an interactive Node session (a REPL) with the shared modules loaded,
// for trying them out by hand. Run it with: npm run repl
// Type .examples to see examples to try, and .exit or press Ctrl+C twice to quit.
// To add a module: import it below and add a topic for it to TOPICS.

import repl from "node:repl";
import { WellGrid, GRID_96 } from "../src/shared/well-grid/well-grid.js";
import { SeededRandom } from "../src/shared/random/random.js";
import {
  findPoolProblems,
  assignPool,
  spareWellCount,
  randomSeed,
} from "../src/shared/random-pool/random-pool.js";
import { Layout } from "../src/shared/layout/layout.js";
import { WellSelection } from "../src/shared/well-selection/well-selection.js";
import { describeValue } from "../src/shared/error-messages/error-messages.js";
import {
  isObject,
  findMissingProperties,
  findExtraProperties,
  listNames,
  checkName,
  checkVolume,
} from "../src/shared/input-checks/input-checks.js";
import { parsePastedTable, isMultiCell } from "../src/shared/pasted-table/pasted-table.js";
import { OperationList } from "../src/shared/operation-list/operation-list.js";
import { replay, ContentsSnapshot } from "../src/shared/contents-tracking/contents-tracking.js";
import { StageList } from "../src/shared/stage-list/stage-list.js";
import {
  labwareNames,
  hasLabware,
  gridOf,
  labwareTypeOf,
  capacityOf,
  deadVolumeOf,
  checkWell,
  wellsInBox,
} from "../src/shared/deck/deck.js";
import { START, tipGroups } from "../src/shared/tip-groups/tip-groups.js";
import { substagesOf } from "../src/shared/substages/substages.js";
import { mixVolumes } from "../src/shared/mix-volumes/mix-volumes.js";
import {
  writeRunFiles,
  checkExperimentName,
  folderNameFor,
} from "../src/shared/file-writer/file-writer.js";
import { zipFiles, crc32 } from "../src/shared/zip/zip.js";
import {
  findProblems,
  placeName,
  openWells,
  randomize,
  matchesInputs,
  listingOrder,
  contentsToWells,
  wellToContents,
  contentsToWellsText,
  wellToContentsText,
} from "../src/tools/randomizer/randomizer.js";
import { PlanHistory } from "../src/tools/transfer-designer/plan-history.js";
import {
  NEW_STAGE_NAME,
  NEW_MIX_STEP_NAME,
  DEFAULT_MIX,
  emptyPlan,
  setExperimentName,
  defaultSettings,
  probesFor,
  modesFor,
  modeSettings,
  modeOf,
  stageOrder,
  addStage,
  addMixStep,
  addStageWithNewTips,
  addMixStepWithNewTips,
  isMixStep,
  mixWells,
  unmixWell,
  renameStage,
  changeStageSettings,
  setStageMix,
  canRemoveStage,
  removeStage,
  stageEnds,
  stagesWithContentsProblem,
  stagesWithMixProblem,
  addTransfer,
  addTransfers,
  changeVolume,
  removeTransfer,
  transfersIn,
  tipChangeAt,
  canAddTipChange,
  addTipChange,
  setTipType,
  setTipProbes,
  removeTipChange,
  addComponent,
  renameComponent,
  setComponentColor,
  removeComponent,
  countWellsWith,
  addToWells,
  emptyWells,
  labwareUsed,
  labelOf,
  setLabel,
  setLabels,
  wellLabelOf,
  setWellLabel,
  setWellLabels,
  addRandomization,
  randomizationAt,
  randomizationOf,
  setRandomization,
  placeRandomization,
  randomizationProblems,
  sourceName,
  runRandomization,
  removeRandomization,
  canRemoveRandomization,
  setRandomizations,
} from "../src/tools/transfer-designer/transfer-designer.js";
import {
  PLAN_FILE_FORMAT,
  PLAN_FILE_VERSION,
  planToText,
  planFromText,
} from "../src/tools/transfer-designer/plan-file.js";

// What the REPL loads, grouped by topic: one topic per module, named like its folder. Each topic
// holds the names it loads into the session and examples to try with them. The startup message, the
// .examples command and the session's names all come from this one list, so they can't drift apart.
// `loaded: { WellGrid, GRID_96 }` is shorthand for `loaded: { WellGrid: WellGrid, GRID_96: GRID_96 }`.
// Within a topic, later examples may use variables made by earlier ones, so type them in order.
const TOPICS = {
  "well-grid": {
    loaded: { WellGrid, GRID_96 },
    examples: [
      "GRID_96.wellNames()",
      'GRID_96.wellPosition("D3")',
      "GRID_96.wellNameAt(4, 3)",
      'GRID_96.isEdgeWell("A5")',
      'GRID_96.wellsInBox("B2", "C4")',
      'GRID_96.wellPosition("b2")',
      "new WellGrid(16, 24)",
    ],
  },
  random: {
    loaded: { SeededRandom },
    examples: [
      "const generator = new SeededRandom(37)",
      "generator.next()",
      'generator.shuffled(["A", "B", "C", "D"])',
      "new SeededRandom(37).shuffled(GRID_96.wellNames())",
    ],
  },
  "random-pool": {
    loaded: { findPoolProblems, assignPool, spareWellCount, randomSeed },
    examples: [
      'const pool = { items: [{ key: "Deep1 A1", replicates: 2 }, { key: "Deep1 A2", replicates: 1 }, { key: "Deep1 A3", replicates: null }], filler: "Deep1 A3", wells: ["Plate1 B2", "Plate1 B3", "Plate1 B4", "Plate2 B2", "Plate2 B3"], seed: 37 }',
      "findPoolProblems(pool)",
      "assignPool(pool)",
      "assignPool({ ...pool, seed: 38 })",
      "spareWellCount(pool)",
      "findPoolProblems({ ...pool, filler: null, seed: 0 })",
      'findPoolProblems({ ...pool, items: [{ key: "Deep1 A1", replicates: 9 }] , filler: null })',
      "randomSeed(Math.random())",
      'assignPool({ ...pool, filler: "Deep1 A9" })',
    ],
  },
  layout: {
    loaded: { Layout },
    examples: [
      "const layout = new Layout(GRID_96)",
      'layout.setContents("D4", { name: "Condition 3" })',
      'layout.contentsOf("D4")',
      "layout.listWells()",
      'layout.setContents("D4", { name: " PBS" })',
    ],
  },
  "well-selection": {
    loaded: { WellSelection },
    examples: [
      "const selection = new WellSelection(GRID_96)",
      'selection.select("H12")',
      'selection.toggle("A2")',
      "selection.selectedWells()",
      "selection.unselectedWells().length",
      'selection.select("I1")',
    ],
  },
  "error-messages": {
    loaded: { describeValue },
    examples: [
      'describeValue("37")',
      "describeValue(37)",
      "describeValue(null)",
      'describeValue(["A", "B"])',
      "describeValue({ rows: 8, columns: 12 })",
      "`Well name must be text, but got ${describeValue(5)}.`",
    ],
  },
  "input-checks": {
    loaded: {
      isObject,
      findMissingProperties,
      findExtraProperties,
      listNames,
      checkName,
      checkVolume,
    },
    examples: [
      'isObject({ well: "A1" })',
      "isObject([])",
      'findMissingProperties({ well: "A1" }, ["labware", "well"])',
      'findExtraProperties({ labware: "Plate 1", wel: "D4" }, ["labware", "well"])',
      'listNames(["source", "volume"])',
      'checkName("Plate 1", "source labware")',
      'checkVolume(50, "volume")',
      'checkName(" Plate 1", "source labware")',
      'checkVolume(-5, "volume")',
    ],
  },
  "pasted-table": {
    loaded: { parsePastedTable, isMultiCell },
    examples: [
      'parsePastedTable("Drug A\\t4\\r\\nVehicle\\t3\\r\\n")',
      'parsePastedTable("A\\t\\tC")',
      'parsePastedTable("A\\n\\n")',
      'isMultiCell("Drug A\\t4")',
      'isMultiCell("Drug A")',
      "parsePastedTable(5)",
    ],
  },
  "operation-list": {
    loaded: { OperationList },
    examples: [
      "const empty = new OperationList()",
      'const list = empty.add({ type: "transfer", source: { labware: "Reagents", well: "A1" }, destination: { labware: "Plate 1", well: "D4" }, volume: 50, stage: "1" })',
      "list.listOperations()",
      "empty.listOperations()",
      'list.add({ type: "transfer", source: { labware: "Reagents", well: "A1" }, destination: { labware: "Plate 1", well: "D4" }, volme: 50, stage: "1" })',
    ],
  },
  "contents-tracking": {
    loaded: { replay, ContentsSnapshot },
    examples: [
      'const starting = [{ labware: "Reagents", well: "A1", components: { Dye: 1000 } }, { labware: "Plate 1", well: "A1", components: { Media: 90 } }, { labware: "Plate 1", well: "B1", components: { Water: 50 } }]',
      'const transfers = new OperationList().add({ type: "transfer", source: { labware: "Reagents", well: "A1" }, destination: { labware: "Plate 1", well: "A1" }, volume: 10, stage: "1" }).add({ type: "transfer", source: { labware: "Plate 1", well: "B1" }, destination: { labware: "Plate 1", well: "B2" }, volume: 60, stage: "1" })',
      "const after = replay(starting, transfers)",
      'after.componentsOf("Plate 1", "A1")',
      'after.totalVolumeOf("Plate 1", "A1")',
      'after.volumeFractionsOf("Plate 1", "A1")',
      "after.listProblems()",
      'after.causesOf("Plate 1", "B2")',
      'replay([{ labware: "Res1", well: "5", components: { PBS: 2300 } }], new OperationList().add({ type: "transfer", source: { labware: "Res1", well: "5" }, destination: { labware: "Plate1", well: "A1" }, volume: 400, stage: "1" })).listProblems()',
      'replay([{ labware: "Plate1", well: "A1", components: { Media: 350 } }], new OperationList().add({ type: "transfer", source: { labware: "Plate1", well: "A1" }, destination: { labware: "Plate1", well: "A2" }, volume: 0, stage: "1" }).add({ type: "transfer", source: { labware: "Res1", well: "1" }, destination: { labware: "Plate1", well: "A1" }, volume: 20, stage: "2" })).listProblems()',
      "replay(starting, transfers, 1).listProblems()",
      "replay(starting, transfers, 3)",
      "new ContentsSnapshot()",
    ],
  },
  "stage-list": {
    loaded: { StageList },
    examples: [
      "const noStages = new StageList()",
      'const settings = { sourceTechnique: "Aspirate_Slow", sourceLiquidType: "Cells", destinationTechnique: "Dispense_Clean", destinationLiquidType: "Cells", sourceMix: { share: 90, times: 3, speed: 400 }, destinationMix: null }',
      'const added = noStages.add("Seeding", settings)',
      "added.id",
      "const stages = added.stageList",
      'stages.get("1")',
      'stages.rename("1", "Seeding, part 1").listStages()',
      "noStages.listStages()",
      'stages.add("Treatment", { ...settings, tiptype: "BC50" })',
      'stages.add("Treatment", { ...settings, probes: [1, 2] })',
      'stages.add("Treatment", { ...settings, destinationMix: { share: 0, times: 3, speed: 400 } })',
      'stages.add("Treatment", { ...settings, sourceMix: { share: 90, times: 2.5, speed: 400 } })',
      "const { sourceMix, destinationMix, ...beforeMixing } = settings",
      'stages.add("Treatment", beforeMixing)',
    ],
  },
  deck: {
    loaded: {
      labwareNames,
      hasLabware,
      gridOf,
      labwareTypeOf,
      capacityOf,
      deadVolumeOf,
      checkWell,
      wellsInBox,
    },
    examples: [
      "labwareNames()",
      'hasLabware("Res")',
      'hasLabware("Bench")',
      'gridOf("Res").wellNames()',
      'labwareTypeOf("Plate")',
      'capacityOf("Plate1")',
      'deadVolumeOf("Res1")',
      'wellsInBox({ labware: "Plate", well: "C3" }, { labware: "Plate", well: "B2" })',
      'checkWell({ labware: "Res", well: "13" })',
    ],
  },
  "tip-groups": {
    loaded: { START, tipGroups },
    examples: [
      "START",
      'const tipPlan = { stageOrder: ["1", "2", "3"], tipChanges: { [START]: { tipType: "BC230", probes: [1, 2, 3, 4] }, "3": { tipType: "BC1070", probes: [1] } } }',
      "tipGroups(tipPlan)",
      'tipGroups({ ...tipPlan, stageOrder: ["1", "3", "2"], tipChanges: { [START]: { tipType: "BC230", probes: [1, 2] }, "2": { tipType: "BC1070", probes: [1, 2, 3, 4, 5, 6, 7, 8] } } })',
    ],
  },
  substages: {
    loaded: { substagesOf },
    examples: [
      'const toPlate = { type: "transfer", source: { labware: "Res1", well: "1" }, destination: { labware: "Plate1", well: "A1" }, volume: 50, stage: "1" }',
      'const toDeep = { type: "transfer", source: { labware: "Plate1", well: "H12" }, destination: { labware: "Deep1", well: "A1" }, volume: 20, stage: "1" }',
      'const toPlate2 = { ...toPlate, destination: { labware: "Plate2", well: "A2" } }',
      "substagesOf([toPlate, toDeep, toPlate2])",
      "substagesOf([toPlate, toDeep, toPlate2]).map((substage) => substage.transfers.length)",
      "substagesOf([])",
    ],
  },
  "mix-volumes": {
    loaded: { mixVolumes },
    examples: [
      'let mixPlan = addComponent(emptyPlan().plan, "Media", "#4e79a7")',
      'mixPlan = addToWells(mixPlan, [{ labware: "Res1", well: "1" }], "Media", 1000)',
      'mixPlan = addToWells(mixPlan, [{ labware: "Plate1", well: "A2" }], "Media", 50)',
      'mixPlan = addTransfer(mixPlan, { type: "transfer", source: { labware: "Res1", well: "1" }, destination: { labware: "Plate1", well: "A1" }, volume: 20, stage: "1" })',
      'mixPlan = addTransfer(mixPlan, { type: "transfer", source: { labware: "Res1", well: "1" }, destination: { labware: "Plate1", well: "A2" }, volume: 100, stage: "1" })',
      'mixPlan = setStageMix(mixPlan, "1", "destination", { share: 90, times: 3, speed: 400 })',
      'mixPlan = setStageMix(mixPlan, "1", "source", { share: 90, times: 3, speed: 400 })',
      "mixVolumes(mixPlan).stages[0].rows[0]",
      "mixVolumes(mixPlan).stages[0].rows[0].mixedWells",
      "mixVolumes(mixPlan).problems",
      'mixPlan = addTransfer(mixPlan, { type: "transfer", source: { labware: "Res1", well: "1" }, destination: { labware: "Plate1", well: "B1" }, volume: 1.1, stage: "1" })',
      "mixVolumes(mixPlan).stages[0].rows[0].destinationMixVolume",
      "mixVolumes(mixPlan).problems",
    ],
  },
  "file-writer": {
    loaded: { writeRunFiles, checkExperimentName, folderNameFor },
    examples: [
      'checkExperimentName("Exp36_repeat")',
      'checkExperimentName("Exp 36")',
      'folderNameFor(new Date(2026, 0, 5, 9, 7, 2), "Exp36")',
      'let runPlan = setExperimentName(emptyPlan().plan, "Exp36")',
      'runPlan = addComponent(runPlan, "Media", "#4e79a7")',
      'runPlan = addToWells(runPlan, [{ labware: "Res1", well: "1" }, { labware: "Plate1", well: "H12" }], "Media", 1000)',
      'runPlan = addTransfer(runPlan, { type: "transfer", source: { labware: "Res1", well: "1" }, destination: { labware: "Plate1", well: "A1" }, volume: 100, stage: "1" })',
      'runPlan = addTransfer(runPlan, { type: "transfer", source: { labware: "Plate1", well: "H12" }, destination: { labware: "Deep1", well: "A1" }, volume: 1 / 3, stage: "1" })',
      "const run = writeRunFiles(runPlan, new Date(2026, 9, 28, 1, 57, 32))",
      "run.folderName",
      "run.files.map((file) => file.name)",
      "console.log(run.files[1].text)",
      "console.log(run.files[2].text)",
      "writeRunFiles(emptyPlan().plan, new Date())",
      'writeRunFiles(setExperimentName(emptyPlan().plan, "Exp36"), new Date())',
    ],
  },
  zip: {
    loaded: { zipFiles, crc32 },
    examples: [
      'crc32(new TextEncoder().encode("123456789")).toString(16)',
      "crc32(new Uint8Array(0))",
      'const zipBytes = zipFiles([{ name: "Run/Setup.csv", text: "a,b\\r\\n1,2\\r\\n" }, { name: "Run/Stages.csv", text: "x\\r\\n" }], new Date(2026, 9, 28, 1, 57, 32))',
      "zipBytes.length",
      "String.fromCharCode(...zipBytes.slice(0, 2))",
      "Buffer.from(zipBytes).toString(\"hex\").match(/../g).join(\" \")",
      'zipFiles([{ name: "Run\\\\Setup.csv", text: "" }], new Date())',
      'zipFiles([{ name: "a.csv", text: "" }, { name: "a.csv", text: "" }], new Date())',
    ],
  },
  randomizer: {
    loaded: {
      findProblems,
      placeName,
      openWells,
      randomize,
      matchesInputs,
      listingOrder,
      contentsToWells,
      wellToContents,
      contentsToWellsText,
      wellToContentsText,
    },
    examples: [
      'const inputs = { conditions: [{ name: "Condition 1", replicates: 4 }], fixedContents: [{ name: "Static", wells: new WellSelection(GRID_96) }], filler: "Spare", seed: 37 }',
      'placeName(inputs.fixedContents, GRID_96.wellsInBox("A1", "A12"), inputs.fixedContents[0])',
      "findProblems(inputs)",
      "const result = randomize(inputs)",
      "result.wellTypes",
      "listingOrder(inputs)",
      "contentsToWells(result)",
      "wellToContents(result)",
      "console.log(contentsToWellsText(result))",
      "console.log(wellToContentsText(result))",
      'openWells(inputs.fixedContents, ["A1"])',
      "matchesInputs(result, inputs)",
      'findProblems({ ...inputs, filler: "", seed: 0 })',
    ],
  },
  "plan-history": {
    loaded: { PlanHistory },
    examples: [
      'let history = new PlanHistory("a")',
      'history = history.record("b").record("c")',
      "history = history.undo()",
      "history.present",
      "history.canRedo()",
      'history = history.record("d")',
      "history.canRedo()",
      'history = history.replacePresent("d, viewed")',
      "history.undo().present",
    ],
  },
  "transfer-designer": {
    loaded: {
      NEW_STAGE_NAME,
      NEW_MIX_STEP_NAME,
      DEFAULT_MIX,
      emptyPlan,
      setExperimentName,
      defaultSettings,
      probesFor,
      modesFor,
      modeSettings,
      modeOf,
      stageOrder,
      addStage,
      addMixStep,
      addStageWithNewTips,
      addMixStepWithNewTips,
      isMixStep,
      mixWells,
      unmixWell,
      renameStage,
      changeStageSettings,
      setStageMix,
      canRemoveStage,
      removeStage,
      stageEnds,
      stagesWithContentsProblem,
      stagesWithMixProblem,
      addTransfer,
      addTransfers,
      changeVolume,
      removeTransfer,
      transfersIn,
      tipChangeAt,
      canAddTipChange,
      addTipChange,
      setTipType,
      setTipProbes,
      removeTipChange,
      addComponent,
      renameComponent,
      setComponentColor,
      removeComponent,
      countWellsWith,
      addToWells,
      emptyWells,
      labwareUsed,
      labelOf,
      setLabel,
      setLabels,
      wellLabelOf,
      setWellLabel,
      setWellLabels,
      addRandomization,
      randomizationAt,
      randomizationOf,
      setRandomization,
      placeRandomization,
      randomizationProblems,
      sourceName,
      runRandomization,
      removeRandomization,
      canRemoveRandomization,
      setRandomizations,
    },
    examples: [
      "let plan = emptyPlan().plan",
      'plan = setExperimentName(plan, " Exp36 ")',
      "plan.experimentName",
      'setExperimentName(plan, "Exp 36")',
      'plan = addComponent(plan, "Media", "#4e79a7")',
      'plan = addToWells(plan, [{ labware: "Res", well: "1" }], "Media", 1000)',
      'plan = addTransfer(plan, { type: "transfer", source: { labware: "Res", well: "1" }, destination: { labware: "Plate", well: "A1" }, volume: 100, stage: "1" })',
      "plan = addStage(plan, null).plan",
      'plan = addTipChange(plan, "2")',
      'tipChangeAt(plan, "2")',
      'plan = setTipProbes(plan, "2", [8, 1])',
      'tipChangeAt(plan, "2")',
      'setTipProbes(plan, "2", [3, 1, 3])',
      "stageOrder(plan)",
      "tipGroups(plan)",
      'transfersIn(plan, "1")',
      'modeOf("destination", defaultSettings())',
      "defaultSettings()",
      'modeSettings("source", "Slow", true)',
      'modeSettings("destination", "Non-Contact", true)',
      "DEFAULT_MIX",
      'plan = setStageMix(plan, "1", "source", DEFAULT_MIX)',
      'plan.stageList.get("1").settings',
      "Object.isFrozen(DEFAULT_MIX)",
      'changeStageSettings(plan, "1", { ...plan.stageList.get("1").settings, sourceTechnique: "Operation" })',
      "stagesWithMixProblem(plan)",
      'plan.stageList.get("2").settings',
      "NEW_MIX_STEP_NAME",
      'let mixed = addMixStep(plan, null)',
      "isMixStep(mixed.plan, mixed.id)",
      "mixed.plan.stageList.get(mixed.id).settings",
      'mixed = mixWells(mixed.plan, mixed.id, [{ labware: "Plate1", well: "A1" }, { labware: "Plate1", well: "A2" }])',
      'transfersIn(mixed, "3")',
      'unmixWell(mixed, "3", { labware: "Plate1", well: "B1" })',
      'transfersIn(unmixWell(mixed, "3", { labware: "Plate1", well: "A2" }), "3")',
      'mixWells(mixed, "1", [{ labware: "Plate1", well: "A1" }])',
      'addTransfer(mixed, { type: "transfer", source: { labware: "Plate1", well: "C1" }, destination: { labware: "Plate1", well: "C2" }, volume: 1, stage: "3" })',
      'stageOrder(addStage(mixed, null).plan)',
      "let twoStages = addStage(emptyPlan().plan, null).plan",
      'let ownTips = addStageWithNewTips(twoStages, "2")',
      "tipGroups(ownTips.plan)",
      'tipGroups(addStageWithNewTips(twoStages, "1").plan)',
      "addMixStepWithNewTips(twoStages, null).plan.tipChanges",
      'addStageWithNewTips(twoStages, "9")',
      'plan = setLabels(plan, { Plate: "Cells", Deep: "Drugs" })',
      'plan = setLabels(plan, { Plate: "Drugs", Deep: "Cells" })',
      'labelOf(plan, "Plate")',
      'addToWells(plan, [{ labware: "Plate", well: "Z99" }], "Media", 50)',
      'setLabels(plan, { Plate: " Cells" })',
      'plan = setWellLabel(plan, { labware: "Deep1", well: "A1" }, " Cond 1 ")',
      'plan = setWellLabel(plan, { labware: "Res1", well: "5" }, "Media")',
      'wellLabelOf(plan, { labware: "Deep1", well: "A1" })',
      'wellLabelOf(plan, { labware: "Deep1", well: "A2" })',
      "plan.wellLabels",
      "labwareUsed(plan)",
      'setWellLabel(plan, { labware: "Deep1", well: "A1" }, "Cond 1") === plan',
      'setWellLabel(plan, { labware: "Deep1", well: "A1" }, "").wellLabels',
      'setWellLabel(plan, { labware: "Deep1", well: "Z99" }, "Cond 1")',
      'plan = setWellLabels(plan, { Deep1: { A1: "Cond 1", A2: "Cond 1" } })',
      'setWellLabels(plan, { Deep1: { A1: " Cond 1" } })',
      "setWellLabels(plan, { Deep1: {} })",
      "let randomized = addStageWithNewTips(emptyPlan().plan, null).plan",
      'let added = addRandomization(randomized, "2", { seed: 37, volume: 20 })',
      "randomized = added.plan",
      'randomizationProblems(randomized, "r1")',
      'randomized = setRandomization(randomized, "r1", { sources: [{ labware: "Deep1", well: "A1", replicates: 2, filler: false }, { labware: "Deep1", well: "A2", replicates: null, filler: true }], fill: [{ labware: "Plate1", well: "B3" }, { labware: "Plate1", well: "B2" }, { labware: "Plate2", well: "B2" }] })',
      'randomizationAt(randomized, "r1").fill',
      'sourceName(randomized, "r1", { labware: "Deep1", well: "A1" })',
      'randomized = runRandomization(randomized, "r1")',
      "stageOrder(randomized)",
      'randomizationAt(randomized, "r1").stages',
      'randomizationOf(randomized, "3")',
      'transfersIn(randomized, "3")',
      "tipGroups(randomized)",
      'removeTipChange(randomized, "2")',
      'setRandomization(randomized, "r1", { seed: 0 })',
      'stageOrder(removeRandomization(randomized, "r1"))',
      'canRemoveRandomization(randomized, "r1")',
      'placeRandomization(randomized, "r1", "1")',
      "setRandomizations(randomized, JSON.parse(JSON.stringify(randomized.randomizations))).randomizations.length",
    ],
  },
  "plan-file": {
    loaded: { PLAN_FILE_FORMAT, PLAN_FILE_VERSION, planToText, planFromText },
    examples: [
      'let saved = setExperimentName(emptyPlan().plan, "Exp36")',
      'saved = addStage(addStage(saved, null).plan, "1").plan',
      'saved = setStageMix(saved, "1", "source", { share: 90, times: 3, speed: 400 })',
      'saved = setWellLabel(saved, { labware: "Deep1", well: "A1" }, "Cond 1")',
      "stageOrder(saved)",
      'const text = planToText(saved, "transfer designer v0.2.0")',
      "console.log(text)",
      "stageOrder(planFromText(text))",
      "planFromText(text).experimentName",
      "planFromText(text).tipChanges",
      "planFromText(text).wellLabels",
      'planFromText(text).stageList.get("2").settings',
      `const version4 = JSON.stringify({ ...JSON.parse(text), version: 4, wellLabels: undefined })`,
      "planFromText(version4).wellLabels",
      `planFromText(text.replace('"version": 5', '"version": 4'))`,
      `planFromText(version4.replace('"version":4', '"version":3'))`,
      `planFromText(text.replace('"version": 5', '"version": 6'))`,
      `planFromText(text.replace('"experimentName": "Exp36"', '"experimentName": "Exp 36"'))`,
      'planFromText("not a plan")',
    ],
  },
};

// Names for one line of the topic table: all of them if there are 3 or fewer, otherwise the first
// two and how many more, so the line stays short,
// e.g. ["WellGrid", "GRID_96"] → "WellGrid, GRID_96", ten names → "findProblems, placeName and 8 more".
function shortNameList(names) {
  if (names.length <= 3) {
    return names.join(", ");
  }
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

// The table of topics and what each loads, shown at startup and by .examples on its own, e.g.
//   Loaded, by topic. Type .examples and a topic to see examples, e.g. .examples layout
//     well-grid        WellGrid, GRID_96
//     random           SeededRandom …
function topicTable() {
  const topicNames = Object.keys(TOPICS);
  // Pads every topic name to the same width, so the loaded names line up in a column.
  const width = Math.max(...topicNames.map((name) => name.length)) + 3;
  const rows = topicNames.map((name) => {
    const loadedNames = Object.keys(TOPICS[name].loaded);
    return `  ${name.padEnd(width)}${shortNameList(loadedNames)}`;
  });
  const heading =
    "Loaded, by topic. Type .examples and a topic to see examples, e.g. .examples layout";
  return [heading, ...rows].join("\n");
}

// The text .examples shows for `topic`: that topic's names and examples, or the topic table if
// `topic` is empty or isn't a topic,
// e.g. examplesText("random") → "Examples for random (loads SeededRandom):\n  const generator …".
function examplesText(topic) {
  if (Object.hasOwn(TOPICS, topic)) {
    const { loaded, examples } = TOPICS[topic];
    const heading = `Examples for ${topic} (loads ${Object.keys(loaded).join(", ")}):`;
    return [heading, ...examples.map((line) => `  ${line}`)].join("\n");
  }
  if (topic === "") {
    return topicTable();
  }
  return `There are no examples for "${topic}".\n${topicTable()}`;
}

console.log(topicTable());

// Strict mode makes the REPL behave like our module code: for example, `GRID_96.rows = 4` throws
// an error instead of silently doing nothing.
// useGlobal runs typed code in the same context as the modules (a context is JavaScript's set of
// built-in objects, such as Date and Array). Without it, Node's REPL gives typed code a context of
// its own, so a date typed here isn't an `instanceof Date` to a module, and checks such as the file
// writer's refuse it: `folderNameFor(new Date(), "Exp36")` failed with "The timestamp must be a
// valid date, but got an object."
const session = repl.start({
  prompt: "biomek> ",
  replMode: repl.REPL_MODE_STRICT,
  useGlobal: true,
});

// Adds the `.examples` command. defineCommand is Node's way to add dot commands like .exit and .help;
// it passes the text typed after the command name, e.g. "layout" for `.examples layout`.
session.defineCommand("examples", {
  help: "Show examples to try, e.g. .examples layout (.examples alone lists the topics)",
  // Prints the examples for the topic typed after .examples, then shows the prompt again.
  action(topic) {
    console.log(examplesText(topic.trim()));
    this.displayPrompt();
  },
});

// Makes every topic's names available in the session, e.g. typing GRID_96 at the prompt.
// Object.assign copies each name and its value into session.context.
for (const { loaded } of Object.values(TOPICS)) {
  Object.assign(session.context, loaded);
}
