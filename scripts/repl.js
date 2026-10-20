// repl.js — opens an interactive Node session (a REPL) with the shared modules loaded,
// for trying them out by hand. Run it with: npm run repl
// Type .examples to see examples to try, and .exit or press Ctrl+C twice to quit.
// To add a module: import it below, add its examples to EXAMPLES, and add it to session.context.

import repl from "node:repl";
import { WellGrid, GRID_96 } from "../src/shared/well-grid/well-grid.js";
import { SeededRandom } from "../src/shared/random/random.js";
import { Layout } from "../src/shared/layout/layout.js";
import { WellSelection } from "../src/shared/well-selection/well-selection.js";
import { OperationList } from "../src/shared/operation-list/operation-list.js";
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

// Examples to try, grouped by topic (one topic per module). `.examples <topic>` prints one group, so
// the startup message stays short however many modules there are. Within a topic, later lines may
// use variables made by earlier ones, so they're meant to be typed in order.
const EXAMPLES = {
  "well-grid": [
    "GRID_96.wellNames()",
    'GRID_96.wellPosition("D3")',
    "GRID_96.wellNameAt(4, 3)",
    'GRID_96.isEdgeWell("A5")',
    'GRID_96.wellsInBox("B2", "C4")',
    'GRID_96.wellPosition("b2")',
    "new WellGrid(16, 24)",
  ],
  random: [
    "const generator = new SeededRandom(37)",
    "generator.next()",
    'generator.shuffled(["A", "B", "C", "D"])',
    "new SeededRandom(37).shuffled(GRID_96.wellNames())",
  ],
  layout: [
    "const layout = new Layout(GRID_96)",
    'layout.setContents("D4", { name: "Condition 3" })',
    'layout.contentsOf("D4")',
    "layout.listWells()",
    'layout.setContents("D4", { name: " PBS" })',
  ],
  "well-selection": [
    "const selection = new WellSelection(GRID_96)",
    'selection.select("H12")',
    'selection.toggle("A2")',
    "selection.selectedWells()",
    "selection.unselectedWells().length",
    'selection.select("I1")',
  ],
  "operation-list": [
    "const empty = new OperationList()",
    'const list = empty.add({ type: "transfer", source: { labware: "Reagents", well: "A1" }, destination: { labware: "Plate 1", well: "D4" }, volume: 50 })',
    "list.listOperations()",
    "empty.listOperations()",
    'list.add({ type: "transfer", source: { labware: "Reagents", well: "A1" }, destination: { labware: "Plate 1", well: "D4" }, volme: 50 })',
  ],
  randomizer: [
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
};

// The text `.examples` shows for `topic`: that topic's examples, or the list of topics if `topic`
// is empty or unknown, e.g. examplesText("random") → "Examples for random:\n  const generator …".
function examplesText(topic) {
  if (Object.hasOwn(EXAMPLES, topic)) {
    const lines = EXAMPLES[topic].map((line) => `  ${line}`);
    return [`Examples for ${topic}:`, ...lines].join("\n");
  }
  const topics = Object.keys(EXAMPLES).join(", ");
  const usage = `Type .examples and a topic, e.g. .examples layout. Topics: ${topics}.`;
  if (topic === "") {
    return usage;
  }
  return `There are no examples for "${topic}". ${usage}`;
}

console.log(`WellGrid, GRID_96, SeededRandom, Layout, WellSelection, OperationList and the randomizer's functions are loaded.
Type .examples to see examples to try.`);

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

session.context.WellGrid = WellGrid;
session.context.GRID_96 = GRID_96;
session.context.SeededRandom = SeededRandom;
session.context.Layout = Layout;
session.context.WellSelection = WellSelection;
session.context.OperationList = OperationList;
session.context.findProblems = findProblems;
session.context.placeName = placeName;
session.context.openWells = openWells;
session.context.randomize = randomize;
session.context.matchesInputs = matchesInputs;
session.context.listingOrder = listingOrder;
session.context.contentsToWells = contentsToWells;
session.context.wellToContents = wellToContents;
session.context.contentsToWellsText = contentsToWellsText;
session.context.wellToContentsText = wellToContentsText;
