// repl.js — opens an interactive Node session (a REPL) with the shared modules loaded,
// for trying them out by hand. Run it with: npm run repl
// Type .exit or press Ctrl+C twice to quit.
// To add a module: import it below, add a line to the examples, and add it to session.context.

import repl from "node:repl";
import { WellGrid, GRID_96 } from "../src/shared/well-grid/well-grid.js";
import { SeededRandom } from "../src/shared/random/random.js";

console.log(`WellGrid, GRID_96 and SeededRandom are loaded. Try:
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
`);

// Strict mode makes the REPL behave like our module code: for example, `GRID_96.rows = 4` throws
// an error instead of silently doing nothing.
const session = repl.start({ prompt: "biomek> ", replMode: repl.REPL_MODE_STRICT });
session.context.WellGrid = WellGrid;
session.context.GRID_96 = GRID_96;
session.context.SeededRandom = SeededRandom;
