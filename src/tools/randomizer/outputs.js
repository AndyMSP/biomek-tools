// outputs.js — the randomizer's two lists (contents → wells and well → contents), and the
// tab-separated text their Copy buttons copy, so they paste into Excel as columns.
// Specification: outputs.md (and randomizer.md section 6).

// One row per distinct contents on the plate, with its wells in standard order, e.g.
// [{ contents: "Condition 1", wells: ["B4", "D9", "F2", "G7"] }, …]. Ordered as randomizer.md
// section 6 says: conditions as listed, then the filler, the fixed contents and the overrides.
export function contentsToWells(inputs, result) {
  const wellsByName = new Map();
  for (const { well, contents } of result.layout.listWells()) {
    if (!wellsByName.has(contents.name)) {
      wellsByName.set(contents.name, []);
    }
    wellsByName.get(contents.name).push(well);
  }
  const listed = new Set();
  const rows = [];
  for (const name of namesInListOrder(inputs)) {
    if (wellsByName.has(name) && !listed.has(name)) {
      listed.add(name);
      rows.push({ contents: name, wells: wellsByName.get(name) });
    }
  }
  return rows;
}

// One row per well in standard order, e.g. [{ well: "A1", contents: "Static" }, …].
export function wellToContents(result) {
  return result.layout.listWells().map(({ well, contents }) => ({ well, contents: contents.name }));
}

// The contents → wells list as tab-separated text with a header row, e.g.
// "Contents\tWells\nCondition 1\tB4, D9, F2, G7\n…".
export function contentsToWellsText(rows) {
  return toTabText(
    ["Contents", "Wells"],
    rows.map((row) => [row.contents, row.wells.join(", ")]),
  );
}

// The well → contents list as tab-separated text with a header row, e.g. "Well\tContents\nA1\tStatic\n…".
export function wellToContentsText(rows) {
  return toTabText(
    ["Well", "Contents"],
    rows.map((row) => [row.well, row.contents]),
  );
}

// --- Helpers used only inside this module ---

// Every name the inputs could put on the plate, in list order: conditions, filler, fixed contents,
// then overrides in standard well order. Trimmed the same way assign.js trims them.
function namesInListOrder(inputs) {
  const grid = inputs.fixedWells.grid;
  const wellOrder = new Map(grid.wellNames().map((well, index) => [well, index]));
  const overrides = [...inputs.overrides]
    .map((row) => ({ well: row.well.trim(), name: row.name.trim() }))
    .sort((a, b) => wellOrder.get(a.well) - wellOrder.get(b.well));
  return [
    ...inputs.conditions.map((row) => row.name.trim()),
    (inputs.filler ?? "").trim(),
    (inputs.fixedContents ?? "").trim(),
    ...overrides.map((row) => row.name),
  ];
}

// Joins a header and rows into tab-separated text, one line per row, e.g.
// toTabText(["Well", "Contents"], [["A1", "Static"]]) → "Well\tContents\nA1\tStatic".
function toTabText(header, rows) {
  return [header, ...rows].map((cells) => cells.join("\t")).join("\n");
}
