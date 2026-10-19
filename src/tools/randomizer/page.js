// page.js — the randomizer's screen: connects the inputs on the page to assign.js and shows the
// results. All checking and calculating happens in the logic modules; this file only reads what the
// user entered, draws it, and passes it on.

import { GRID_96 } from "../../shared/well-grid/well-grid.js";
import { WellSelection } from "../../shared/well-selection/well-selection.js";
import { findProblems, randomize } from "./assign.js";
import { contentsToWells, wellToContents, contentsToWellsText, wellToContentsText } from "./outputs.js";
import { parseConditionRows, replicatesFromText } from "./paste.js";
import { buildBiomekFiles, findBiomekProblems, uncoveredContents } from "./biomek-files.js";
import { createZip } from "../../shared/zip/zip.js";
import { EXP37_METHOD } from "../../../config/exp37-method.js";

const GRID = GRID_96;

// Everything the user has entered, plus the latest result.
const state = {
  conditions: [], // rows { name, replicatesText }
  fixedWells: new WellSelection(GRID),
  overrides: [], // rows { well, name }
  result: null, // { inputs, result } from the last Randomize
  stale: false,
};

// Shortcut for document.getElementById, e.g. byId("seed").
function byId(id) {
  return document.getElementById(id);
}

// --- Inputs ---

// A new random seed from 1 to 999,999, e.g. 482913.
function suggestSeed() {
  return String(Math.floor(Math.random() * 999999) + 1);
}

// The inputs in the form assign.js expects, built from what's on the page.
function currentInputs() {
  const seedText = byId("seed").value.trim();
  return {
    fixedWells: state.fixedWells,
    conditions: state.conditions.map((row) => ({
      name: row.name,
      replicates: replicatesFromText(row.replicatesText),
    })),
    fixedContents: byId("fixed-contents").value,
    overrides: state.overrides.map((row) => ({ well: row.well, name: row.name })),
    filler: byId("filler").value,
    seed: /^\d+$/.test(seedText) ? Number(seedText) : seedText,
  };
}

// Fills the page with an example like Exp37: outer ring fixed,
// Condition 1–12 with 4 replicates each, PBS as fixed contents and filler (as in Exp37).
function loadExample() {
  state.conditions = Array.from({ length: 12 }, (_, i) => ({ name: `Condition ${i + 1}`, replicatesText: "4" }));
  state.fixedWells = new WellSelection(GRID);
  fixOuterRing();
  state.overrides = [];
  byId("fixed-contents").value = "PBS";
  byId("filler").value = "PBS";
}

// Clears every input, keeping a new suggested seed.
function startEmpty() {
  state.conditions = [];
  state.fixedWells = new WellSelection(GRID);
  state.overrides = [];
  byId("fixed-contents").value = "";
  byId("filler").value = "";
  byId("example-note").hidden = true;
  state.result = null;
  renderAll();
}

// Fixes the 36 edge wells (randomizer.md section 4); others stay as they are.
function fixOuterRing() {
  for (const well of GRID.wellNames()) {
    if (GRID.isEdgeWell(well)) {
      state.fixedWells.select(well);
    }
  }
}

// Called after any input changes: marks an existing result as out of date and rechecks.
function inputsChanged() {
  if (state.result !== null) {
    state.stale = true;
  }
  renderStatus();
}

// --- Drawing ---

// Draws a row of editable cells for a list of rows (conditions or overrides).
// `fields` names each cell's property and width class, e.g. [["name", "text"], …].
function renderRows(containerId, rows, fields, onRemove) {
  const container = byId(containerId);
  container.replaceChildren();
  rows.forEach((row, index) => {
    const line = document.createElement("div");
    line.className = containerId === "override-rows" ? "table-row override" : "table-row";
    const number = document.createElement("span");
    number.className = "row-number";
    number.textContent = index + 1;
    line.append(number);
    for (const [property, placeholder] of fields) {
      const input = document.createElement("input");
      input.type = "text";
      input.id = `${containerId}-${index}-${property}`;
      input.value = row[property];
      input.placeholder = placeholder;
      input.setAttribute("aria-label", `${placeholder}, row ${index + 1}`);
      input.autocomplete = "off";
      input.addEventListener("input", () => {
        row[property] = input.value;
        inputsChanged();
      });
      line.append(input);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove row ${index + 1}`);
    remove.addEventListener("click", () => onRemove(index));
    line.append(remove);
    container.append(line);
  });
}

// Draws the condition rows.
function renderConditions() {
  renderRows("condition-rows", state.conditions, [["name", "Name"], ["replicatesText", "Replicates"]], (index) => {
    state.conditions.splice(index, 1);
    renderConditions();
    inputsChanged();
  });
}

// Draws the override rows.
function renderOverrides() {
  renderRows("override-rows", state.overrides, [["well", "Well"], ["name", "Contents"]], (index) => {
    state.overrides.splice(index, 1);
    renderOverrides();
    inputsChanged();
  });
}

// Adds the row and column labels and one cell per well to a plate grid; `drawWell` makes each
// well's element, e.g. a button on the picker or a labelled cell on the result.
function renderPlate(container, drawWell) {
  container.replaceChildren();
  container.style.setProperty("--columns", GRID.columns);
  container.append(document.createElement("span"));
  for (let column = 1; column <= GRID.columns; column++) {
    container.append(axisLabel(column));
  }
  for (let row = 1; row <= GRID.rows; row++) {
    container.append(axisLabel(GRID.wellNameAt(row, 1).replace(/\d+$/, "")));
    for (let column = 1; column <= GRID.columns; column++) {
      container.append(drawWell(GRID.wellNameAt(row, column)));
    }
  }
}

// A row or column label for a plate grid, e.g. "A" or "12".
function axisLabel(text) {
  const label = document.createElement("span");
  label.className = "axis";
  label.textContent = text;
  return label;
}

// Draws the clickable plate map of fixed wells.
function renderPicker() {
  renderPlate(byId("picker"), (well) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "well";
    button.textContent = well;
    button.setAttribute("aria-pressed", String(state.fixedWells.isSelected(well)));
    button.title = state.fixedWells.isSelected(well) ? `${well}: fixed` : `${well}: open`;
    button.addEventListener("click", () => {
      state.fixedWells.toggle(well);
      renderPicker();
      inputsChanged();
    });
    return button;
  });
}

// Shows the counts, the problems (or "ready"), and whether Randomize can be pressed.
function renderStatus() {
  const inputs = currentInputs();
  const problems = findProblems(inputs);
  const fixedCount = state.fixedWells.selectedWells().length;
  const replicates = inputs.conditions.reduce(
    (sum, row) => sum + (Number.isInteger(row.replicates) ? row.replicates : 0),
    0,
  );
  byId("counts").textContent =
    `${fixedCount} fixed · ${GRID.wellNames().length - fixedCount} open · ${replicates} replicates`;

  const list = byId("problems");
  list.replaceChildren(
    ...problems.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    }),
  );
  byId("ready").hidden = problems.length > 0;
  byId("randomize").disabled = problems.length > 0;
  byId("stale").hidden = !state.stale;
  byId("results").classList.toggle("is-stale", state.stale);
}

// Draws the randomized plate and both lists.
function renderResult() {
  const section = byId("results");
  if (state.result === null) {
    section.hidden = true;
    return;
  }
  const { inputs, result } = state.result;
  section.hidden = false;
  byId("seed-shown").textContent = result.seed;

  renderPlate(byId("result-plate"), (well) => {
    const contents = result.layout.contentsOf(well).name;
    const type = result.wellTypes.get(well);
    const cell = document.createElement("div");
    cell.className = `cell ${type}`;
    cell.title = `${well}: ${contents} (${type.replace("-", " ")})`;
    const name = document.createElement("span");
    name.className = "well-name";
    name.textContent = well;
    const text = document.createElement("span");
    text.className = "contents";
    text.textContent = contents;
    cell.append(name, text);
    return cell;
  });

  const contentsRows = contentsToWells(inputs, result);
  fillTable("contents-list", contentsRows.map((row) => [row.contents, row.wells.join(", ")]), 1);
  byId("copy-contents-text").value = contentsToWellsText(contentsRows);

  const wellRows = wellToContents(result);
  fillTable("wells-list", wellRows.map((row) => [row.well, row.contents]), 0);
  byId("copy-wells-text").value = wellToContentsText(wellRows);
  renderBiomek();
}

// Shows what the Biomek download will contain, or what stops it, for the current result.
function renderBiomek() {
  if (state.result === null) {
    return;
  }
  const { inputs, result } = state.result;
  const experimentId = byId("experiment-id").value.trim();
  const problems = findBiomekProblems(inputs, result, EXP37_METHOD, experimentId);
  byId("biomek-problems").replaceChildren(...problems.map((message) => listItem(message)));
  byId("download-biomek").disabled = problems.length > 0;
  byId("biomek-summary").textContent =
    problems.length > 0 ? "" : `${buildBiomekFiles(inputs, result, EXP37_METHOD, experimentId).length} files`;
  byId("biomek-uncovered").replaceChildren(
    ...uncoveredContents(inputs, result, EXP37_METHOD).map(({ contents, wells }) =>
      listItem(`No file fills ${contents} (${wells.join(", ")}). Add it by hand or in the method.`),
    ),
  );
}

// A list item holding text.
function listItem(text) {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}

// Downloads every Biomek file for the current result as one zip, e.g. Exp37_Biomek_seed37.zip.
async function downloadBiomekFiles() {
  const { inputs, result } = state.result;
  const experimentId = byId("experiment-id").value.trim();
  const zip = createZip(buildBiomekFiles(inputs, result, EXP37_METHOD, experimentId));
  const filename = `${experimentId}_Biomek_seed${result.seed}.zip`;
  // Inside the claude.ai viewer, downloads go through its own save prompt; opened from disk on a
  // lab PC, window.claude doesn't exist and the browser's ordinary download is used.
  const downloads = window.claude?.use ? await window.claude.use("downloads") : null;
  if (downloads !== null) {
    try {
      await downloads.save({ filename, data: zip });
    } catch (error) {
      byId("biomek-summary").textContent = error.code === "declined" ? "Download cancelled." : `Download failed: ${error.message}`;
    }
    return;
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Fills a table body with rows of cells; the column at `monoColumn` uses the data font.
function fillTable(bodyId, rows, monoColumn) {
  byId(bodyId).replaceChildren(
    ...rows.map((cells) => {
      const tr = document.createElement("tr");
      cells.forEach((text, index) => {
        const td = document.createElement("td");
        td.textContent = text;
        if (index === monoColumn) {
          td.className = "mono";
        }
        tr.append(td);
      });
      return tr;
    }),
  );
}

// Redraws everything from the state.
function renderAll() {
  renderConditions();
  renderOverrides();
  renderPicker();
  renderStatus();
  renderResult();
}

// Copies text to the clipboard; if the browser refuses, shows the text selected so it can be
// copied by hand. `noteId` is where "Copied" appears.
async function copyText(textareaId, noteId) {
  const box = byId(textareaId);
  try {
    await navigator.clipboard.writeText(box.value);
    byId(noteId).textContent = "Copied";
  } catch {
    box.hidden = false;
    box.select();
    byId(noteId).textContent = "Press Ctrl+C to copy";
  }
  setTimeout(() => {
    byId(noteId).textContent = "";
  }, 2500);
}

// --- Wiring the controls ---

// Connects every button and input to the state.
function connectControls() {
  byId("add-condition").addEventListener("click", () => {
    state.conditions.push({ name: "", replicatesText: "" });
    renderConditions();
    inputsChanged();
    byId(`condition-rows-${state.conditions.length - 1}-name`).focus();
  });
  byId("add-pasted").addEventListener("click", () => {
    const rows = parseConditionRows(byId("paste-box").value);
    state.conditions.push(...rows.map((row) => ({ name: row.name, replicatesText: String(row.replicates) })));
    byId("paste-box").value = "";
    renderConditions();
    inputsChanged();
  });
  byId("add-override").addEventListener("click", () => {
    state.overrides.push({ well: "", name: "" });
    renderOverrides();
    inputsChanged();
  });
  byId("fix-outer-ring").addEventListener("click", () => {
    fixOuterRing();
    renderPicker();
    inputsChanged();
  });
  byId("new-seed").addEventListener("click", () => {
    byId("seed").value = suggestSeed();
    inputsChanged();
  });
  for (const id of ["fixed-contents", "filler", "seed"]) {
    byId(id).addEventListener("input", inputsChanged);
  }
  byId("start-empty").addEventListener("click", startEmpty);
  byId("randomize").addEventListener("click", () => {
    const inputs = currentInputs();
    // A snapshot of the inputs, so the lists stay correct if the page's inputs change later.
    const snapshot = {
      ...inputs,
      fixedWells: copySelection(inputs.fixedWells),
      conditions: inputs.conditions.map((row) => ({ ...row })),
      overrides: inputs.overrides.map((row) => ({ ...row })),
    };
    state.result = { inputs: snapshot, result: randomize(snapshot) };
    state.stale = false;
    renderResult();
    renderStatus();
    byId("results").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  byId("copy-contents").addEventListener("click", () => copyText("copy-contents-text", "copied-contents"));
  byId("copy-wells").addEventListener("click", () => copyText("copy-wells-text", "copied-wells"));
  byId("experiment-id").addEventListener("input", renderBiomek);
  byId("download-biomek").addEventListener("click", downloadBiomekFiles);
}

// A separate WellSelection with the same wells selected.
function copySelection(selection) {
  const copy = new WellSelection(selection.grid);
  selection.selectedWells().forEach((well) => copy.select(well));
  return copy;
}

// --- Start ---

byId("seed").value = suggestSeed();
loadExample();
connectControls();
renderAll();
