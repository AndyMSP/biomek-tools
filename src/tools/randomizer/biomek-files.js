// biomek-files.js — makes the Exp37 method's Transfer From File and Worklist files from a randomized
// plate: media (step 8), PBS (step 9), cells and mix (steps 10–13) and the worklist that loops them.
// Method values come from config/exp37-method.js. Specification: biomek-files.md.

import { WELL_TYPES } from "./assign.js";

const TRANSFER_HEADER = "SourceLabware,SourceWell,DestLabware,DestWell,Volume";
const WORKLIST_HEADER = "CellFile,MixFile";
const CELLS_FOLDER = "Step10-13_Cells";
const EXPERIMENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

// Problems that stop the files being made, as messages; [] if there are none.
export function findBiomekProblems(inputs, result, method, experimentId) {
  const problems = [];
  if (!EXPERIMENT_ID_PATTERN.test(experimentId)) {
    problems.push("Give an experiment ID of letters, digits, - and _ only, like Exp37.");
  }
  const sourceCount = method.conditionSourceWells.length;
  if (inputs.conditions.length > sourceCount) {
    problems.push(
      `The Exp37 method has source wells for ${sourceCount} conditions, but ${inputs.conditions.length} are listed.`,
    );
  }
  const pbsTransfers = pbsWells(result, method).length * method.plates.length;
  const pbsSupply = method.pbs.wells.length * method.pbs.transfersPerWell;
  if (pbsTransfers > pbsSupply) {
    problems.push(
      `The plates need ${pbsTransfers} PBS transfers, but reservoir wells ${method.pbs.wells.join(", ")} ` +
        `supply ${pbsSupply}.`,
    );
  }
  return problems;
}

// Contents on the plate that no file fills, e.g. [{ contents: "Blank", wells: ["A1"] }]: anything
// that is neither a condition's replicate nor PBS. They must be added by hand.
export function uncoveredContents(inputs, result, method) {
  const wellsByName = new Map();
  for (const well of wellsInColumnOrder(result)) {
    if (isCovered(well, result, method)) {
      continue;
    }
    const name = result.layout.contentsOf(well).name;
    wellsByName.set(name, [...(wellsByName.get(name) ?? []), well]);
  }
  return [...wellsByName].map(([contents, wells]) => ({ contents, wells }));
}

// Every file for the run, as { path, text }, inside a folder named after the experiment ID.
export function buildBiomekFiles(inputs, result, method, experimentId) {
  const conditions = inputs.conditions.map((row) => row.name.trim());
  const files = [
    ...conditions.map((name, index) => mediaFile(name, index, result, method, experimentId)),
    pbsFile(result, method, experimentId),
  ];
  for (const plate of method.plates) {
    conditions.forEach((name, index) => {
      files.push(cellsFile(name, index, plate, result, method, experimentId));
      files.push(mixFile(name, index, plate, result, method, experimentId));
    });
  }
  files.push(worklistFile(conditions.length, method, experimentId));
  return files.map((file) => ({ path: `${experimentId}/${file.path}`, text: file.text }));
}

// --- Helpers used only inside this module ---

// Step 8: one condition's media from its deep well into its wells on every plate.
function mediaFile(name, index, result, method, id) {
  const source = method.conditionSourceWells[index];
  const rows = method.plates.flatMap((plate) =>
    replicateWells(name, result).map((well) =>
      [method.conditionSourceLabware, source, plate.labware, well, method.mediaVolume],
    ),
  );
  const path = `Step${method.mediaStep}_Media_seed${result.seed}/${id}_Step${method.mediaStep}${fileLetter(index)}.csv`;
  return { path, text: transferText(rows) };
}

// Step 9: PBS into every PBS well on every plate, taking transfersPerWell from each reservoir well.
function pbsFile(result, method, id) {
  const { pbs } = method;
  const destinations = method.plates.flatMap((plate) =>
    pbsWells(result, method).map((well) => [plate.labware, well]),
  );
  const rows = destinations.map(([labware, well], index) =>
    [pbs.labware, pbs.wells[Math.floor(index / pbs.transfersPerWell)], labware, well, pbs.volume],
  );
  return { path: `${id}_Step${pbs.step}_${pbs.name}.csv`, text: transferText(rows) };
}

// Steps 10/12: cells for one condition on one plate, alternating the plate's two cell wells.
function cellsFile(name, index, plate, result, method, id) {
  const source = plate.cellWells[index % plate.cellWells.length];
  const rows = replicateWells(name, result).map((well) =>
    [method.cellSourceLabware, source, plate.labware, well, method.cellVolume],
  );
  return { path: cellsPath(plate, index, id, "/"), text: transferText(rows) };
}

// Steps 11/13: mixes each of one condition's wells on one plate by aspirating and dispensing in place.
function mixFile(name, index, plate, result, method, id) {
  const rows = replicateWells(name, result).map((well) =>
    [plate.labware, well, plate.labware, well, method.mixVolume],
  );
  return { path: mixPath(plate, index, id, "/"), text: transferText(rows) };
}

// Step 10 worklist: each cell file with its mix file, as full Windows paths, plate by plate.
function worklistFile(conditionCount, method, id) {
  const folder = method.biomekFolder.replace("{id}", id);
  const rows = method.plates.flatMap((plate) =>
    Array.from({ length: conditionCount }, (_, index) => [
      `${folder}\\${cellsPath(plate, index, id, "\\")}`,
      `${folder}\\${mixPath(plate, index, id, "\\")}`,
    ]),
  );
  return { path: `${id}_Step${method.worklistStep}_Worklist.csv`, text: csvText(WORKLIST_HEADER, rows) };
}

// Path of a cell file within the run folder, e.g. "Step10-13_Cells/Step10_MsNAC_cells/Exp37_Step10a.csv".
function cellsPath(plate, index, id, separator) {
  return [CELLS_FOLDER, `Step${plate.cellsStep}_${plate.labware}_cells`, `${id}_Step${plate.cellsStep}${fileLetter(index)}.csv`].join(separator);
}

// Path of a mix file within the run folder, e.g. "Step10-13_Cells/Step11_MsNAC_mix/Exp37_Step11a.csv".
function mixPath(plate, index, id, separator) {
  return [CELLS_FOLDER, `Step${plate.mixStep}_${plate.labware}_mix`, `${id}_Step${plate.mixStep}${fileLetter(index)}.csv`].join(separator);
}

// A transfer file's text: the header, then one row per transfer.
function transferText(rows) {
  return csvText(TRANSFER_HEADER, rows);
}

// CSV text with CRLF between lines and no line break after the last, as the Biomek files use.
function csvText(header, rows) {
  return [header, ...rows.map((cells) => cells.join(","))].join("\r\n");
}

// The letter for a condition's files: 0 → "a", 25 → "z", 26 → "aa", 27 → "ab".
function fileLetter(index) {
  let letters = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(97 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

// Every well of the plate, down each column: A1, B1 … H1, A2 ….
function wellsInColumnOrder(result) {
  const grid = result.layout.grid;
  const wells = [];
  for (let column = 1; column <= grid.columns; column++) {
    for (let row = 1; row <= grid.rows; row++) {
      wells.push(grid.wellNameAt(row, column));
    }
  }
  return wells;
}

// The replicate wells of one condition, in column order.
function replicateWells(name, result) {
  return wellsInColumnOrder(result).filter(
    (well) =>
      result.wellTypes.get(well) === WELL_TYPES.REPLICATE && result.layout.contentsOf(well).name === name,
  );
}

// Every well holding PBS as fixed contents, filler or an override, in column order. A condition
// named PBS is excluded: its replicates come from its own deep well in a media file.
function pbsWells(result, method) {
  return wellsInColumnOrder(result).filter(
    (well) =>
      result.wellTypes.get(well) !== WELL_TYPES.REPLICATE && result.layout.contentsOf(well).name === method.pbs.name,
  );
}

// True if some file fills this well: a condition's replicate or a PBS well.
function isCovered(well, result, method) {
  return (
    result.wellTypes.get(well) === WELL_TYPES.REPLICATE || result.layout.contentsOf(well).name === method.pbs.name
  );
}
