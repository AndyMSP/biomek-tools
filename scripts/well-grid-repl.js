// well-grid-repl.js — opens an interactive Node session (a REPL) with the well-grid module loaded,
// for trying out WellGrid by hand. Run it with: npm run repl
// Type .exit or press Ctrl+C twice to quit.

import repl from "node:repl";
import { WellGrid, GRID_96 } from "../src/shared/well-grid/well-grid.js";

console.log(`WellGrid and GRID_96 are loaded. Try:
  GRID_96.wellNames()
  GRID_96.wellPosition("D3")
  GRID_96.wellNameAt(4, 3)
  GRID_96.isEdgeWell("A5")
  GRID_96.wellPosition("b2")
  new WellGrid(16, 24)
`);

// Strict mode makes the REPL behave like our module code: for example, `GRID_96.rows = 4` throws
// an error instead of silently doing nothing.
const session = repl.start({ prompt: "well-grid> ", replMode: repl.REPL_MODE_STRICT });
session.context.WellGrid = WellGrid;
session.context.GRID_96 = GRID_96;
