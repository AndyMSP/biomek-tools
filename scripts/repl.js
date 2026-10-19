// repl.js — opens an interactive Node session (a REPL) with the shared modules loaded,
// for trying them out by hand. Run it with: npm run repl
// Type .exit or press Ctrl+C twice to quit.
// To add a module: import it below, add a line to the examples, and add it to session.context.

import repl from "node:repl";
import { WellGrid, GRID_96 } from "../src/shared/well-grid/well-grid.js";
import { SeededRandom } from "../src/shared/random/random.js";
import { Layout } from "../src/shared/layout/layout.js";
import { WellSelection } from "../src/shared/well-selection/well-selection.js";

console.log(`WellGrid, GRID_96, SeededRandom, Layout and WellSelection are loaded. Try:
  GRID_96.wellNames()
  GRID_96.wellPosition("D3")
  GRID_96.wellNameAt(4, 3)
  GRID_96.isEdgeWell("A5")
  GRID_96.wellPosition("b2")
  new WellGrid(16, 24)
  const generator = new SeededRandom(37)
  generator.next()
  generator.shuffled(["A", "B", "C", "D"])
  new SeededRandom(37).shuffled(GRID_96.wellNames())
  const layout = new Layout(GRID_96)
  layout.setContents("D4", { name: "Condition 3" })
  layout.contentsOf("D4")
  layout.listWells()
  layout.setContents("D4", { name: " PBS" })
  const selection = new WellSelection(GRID_96)
  selection.select("H12")
  selection.toggle("A2")
  selection.selectedWells()
  selection.unselectedWells().length
  selection.select("I1")
`);

// Strict mode makes the REPL behave like our module code: for example, `GRID_96.rows = 4` throws
// an error instead of silently doing nothing.
const session = repl.start({ prompt: "biomek> ", replMode: repl.REPL_MODE_STRICT });
session.context.WellGrid = WellGrid;
session.context.GRID_96 = GRID_96;
session.context.SeededRandom = SeededRandom;
session.context.Layout = Layout;
session.context.WellSelection = WellSelection;
