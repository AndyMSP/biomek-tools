// repl.js — opens an interactive Node session (a REPL) with the shared modules loaded,
// for trying them out by hand. Run it with: npm run repl
// Type .examples to see examples to try, and .exit or press Ctrl+C twice to quit.
// To add a module: import it below and add a topic for it to TOPICS.

import repl from "node:repl";
import { WellGrid, GRID_96 } from "../src/shared/well-grid/well-grid.js";
import { SeededRandom } from "../src/shared/random/random.js";
import { Layout } from "../src/shared/layout/layout.js";
import { WellSelection } from "../src/shared/well-selection/well-selection.js";
import { OperationList } from "../src/shared/operation-list/operation-list.js";
import { StageList } from "../src/shared/stage-list/stage-list.js";
import {
  labwareNames,
  hasLabware,
  gridOf,
  labwareTypeOf,
  checkWell,
  wellsInBox,
} from "../src/shared/deck/deck.js";
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
  START,
  emptyPlan,
  defaultSettings,
  probesFor,
  modesFor,
  modeSettings,
  modeOf,
  stageOrder,
  addStage,
  renameStage,
  changeStageSettings,
  canRemoveStage,
  removeStage,
  stageEnds,
  stagesWithOverdraw,
  addTransfer,
  addTransfers,
  changeVolume,
  removeTransfer,
  transfersIn,
  tipChangeAt,
  canAddTipChange,
  addTipChange,
  setTipType,
  removeTipChange,
  tipGroups,
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
  "stage-list": {
    loaded: { StageList },
    examples: [
      "const noStages = new StageList()",
      'const settings = { sourceTechnique: "Aspirate_Slow", sourceLiquidType: "Cells", destinationTechnique: "Dispense_Clean", destinationLiquidType: "Cells", probes: [3, 1, 2] }',
      'const added = noStages.add("Seeding", settings)',
      "added.id",
      "const stages = added.stageList",
      'stages.get("1")',
      'stages.rename("1", "Seeding, part 1").listStages()',
      "noStages.listStages()",
      'stages.add("Treatment", { ...settings, tiptype: "BC50" })',
    ],
  },
  deck: {
    loaded: { labwareNames, hasLabware, gridOf, labwareTypeOf, checkWell, wellsInBox },
    examples: [
      "labwareNames()",
      'hasLabware("Res")',
      'hasLabware("Bench")',
      'gridOf("Res").wellNames()',
      'labwareTypeOf("Plate")',
      'wellsInBox({ labware: "Plate", well: "C3" }, { labware: "Plate", well: "B2" })',
      'checkWell({ labware: "Res", well: "13" })',
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
      START,
      emptyPlan,
      defaultSettings,
      probesFor,
      modesFor,
      modeSettings,
      modeOf,
      stageOrder,
      addStage,
      renameStage,
      changeStageSettings,
      canRemoveStage,
      removeStage,
      stageEnds,
      stagesWithOverdraw,
      addTransfer,
      addTransfers,
      changeVolume,
      removeTransfer,
      transfersIn,
      tipChangeAt,
      canAddTipChange,
      addTipChange,
      setTipType,
      removeTipChange,
      tipGroups,
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
    },
    examples: [
      "let plan = emptyPlan().plan",
      'plan = addComponent(plan, "Media", "#4e79a7")',
      'plan = addToWells(plan, [{ labware: "Res", well: "1" }], "Media", 1000)',
      'plan = addTransfer(plan, { type: "transfer", source: { labware: "Res", well: "1" }, destination: { labware: "Plate", well: "A1" }, volume: 100, stage: "1" })',
      "plan = addStage(plan, null).plan",
      'plan = addTipChange(plan, "2")',
      "stageOrder(plan)",
      "tipGroups(plan)",
      'transfersIn(plan, "1")',
      'modeOf("destination", defaultSettings())',
      'plan = setLabels(plan, { Plate: "Cells", Deep: "Drugs" })',
      'plan = setLabels(plan, { Plate: "Drugs", Deep: "Cells" })',
      'labelOf(plan, "Plate")',
      'addToWells(plan, [{ labware: "Plate", well: "Z99" }], "Media", 50)',
      'setLabels(plan, { Plate: " Cells" })',
    ],
  },
  "plan-file": {
    loaded: { PLAN_FILE_FORMAT, PLAN_FILE_VERSION, planToText, planFromText },
    examples: [
      "let saved = emptyPlan().plan",
      'saved = addStage(addStage(saved, null).plan, "1").plan',
      "stageOrder(saved)",
      'const text = planToText(saved, "transfer designer v0.2.0")',
      "console.log(text)",
      "stageOrder(planFromText(text))",
      `planFromText(text.replace('"version": 1', '"version": 2'))`,
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
const session = repl.start({ prompt: "biomek> ", replMode: repl.REPL_MODE_STRICT });

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
