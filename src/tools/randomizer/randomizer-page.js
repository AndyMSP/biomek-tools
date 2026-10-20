// randomizer-page.js — the randomizer page's behavior: keeps the inputs, updates them as the user
// types, pastes and clicks, shows what is still needed, randomizes, and draws the results.
//
// The page has no randomizer logic of its own (randomizer-page.md, section 1). It keeps the inputs
// object from randomizer.md (section 8), changes which wells are fixed only through placeName and
// openWells, and asks randomizer.js for everything it shows about the inputs and the result.
// Typing or pasting a name, a replicate count, the filler or the seed, and adding or removing a row
// or entry, change the inputs object directly: randomizer.md defines no functions for these (renaming an entry
// "needs no function", section 4).
// Specification: randomizer-page.md.

import { GRID_96 } from "../../shared/well-grid/well-grid.js";
import { WellSelection } from "../../shared/well-selection/well-selection.js";
import { parsePastedTable, isMultiCell } from "../../shared/pasted-table/pasted-table.js";
import {
  findProblems,
  placeName,
  openWells,
  randomize,
  matchesInputs,
  listingOrder,
  spareWellCount,
  randomSeed,
  contentsToWells,
  wellToContents,
  contentsToWellsText,
  wellToContentsText,
} from "./randomizer.js";

// The colors of an entry with no name yet (section 7).
const UNNAMED_COLOR = { fill: "var(--unnamed-fill)", text: "var(--text-dark)" };

// --- The page's state ---

// The inputs object (randomizer.md, section 8). When the page opens there is one empty condition
// row, an empty filler, one empty entry with no wells, and a random suggested seed (section 4).
const inputs = {
  conditions: [newCondition()],
  fixedContents: [newEntry()],
  filler: "",
  seed: randomSeed(Math.random()),
};

// The entry that clicks on the input plate place (section 4). It is always one of
// inputs.fixedContents, or null when there are none.
let entryBeingPlaced = inputs.fixedContents[0];

// The latest result from randomize, or null before the first Randomize.
let result = null;

// The drag in progress on the input plate, or null: the well where the press started, the well the
// pointer is over now, and whether releasing will open the box's wells (true) or place them (false).
let drag = null;

// The page's elements that randomizer.html gives an id, looked up once.
const elements = {
  conditionsBody: byId("conditions-body"),
  fillerName: byId("filler-name"),
  fillerFills: byId("filler-fills"),
  addCondition: byId("add-condition"),
  fixedContentsBody: byId("fixed-contents-body"),
  addEntry: byId("add-entry"),
  seed: byId("seed"),
  problems: byId("problems"),
  ready: byId("ready"),
  randomize: byId("randomize"),
  plateCounts: byId("plate-counts"),
  placingNote: byId("placing-note"),
  inputPlate: byId("input-plate"),
  resultsPlaceholder: byId("results-placeholder"),
  resultsContent: byId("results-content"),
  outOfDateBanner: byId("out-of-date-banner"),
  resultsBody: byId("results-body"),
  resultSeed: byId("result-seed"),
  resultPlate: byId("result-plate"),
  legend: byId("legend"),
  contentsToWellsBody: byId("contents-to-wells-body"),
  wellToContentsBody: byId("well-to-contents-body"),
  copyContentsToWells: byId("copy-contents-to-wells"),
  copyWellToContents: byId("copy-well-to-contents"),
};

setUpPage();

// --- Setting up ---

// Draws the empty plates and tables, connects the buttons and the plate to their actions, and shows
// what is still needed.
function setUpPage() {
  drawPlate(elements.inputPlate, createInputWell);
  drawPlate(elements.resultPlate, createResultWell);
  drawConditionRows();
  drawEntryRows();
  elements.fillerName.value = inputs.filler;
  elements.seed.value = String(inputs.seed);
  connectInputs();
  connectInputPlate();
  connectResults();
  connectHoverBox();
  refresh();
}

// Connects the filler and seed boxes and the add and Randomize buttons to their actions.
function connectInputs() {
  elements.fillerName.addEventListener("input", () => {
    inputs.filler = elements.fillerName.value;
    inputsChanged();
  });
  elements.seed.addEventListener("input", () => {
    inputs.seed = typedValue(elements.seed.value);
    inputsChanged();
  });
  elements.addCondition.addEventListener("click", addCondition);
  elements.addEntry.addEventListener("click", addEntry);
  elements.randomize.addEventListener("click", randomizeInputs);
}

// Connects the input plate's pointer and keyboard actions (section 5). Moving and releasing are
// watched on the whole document, so a drag that leaves the plate still ends.
function connectInputPlate() {
  elements.inputPlate.addEventListener("pointerdown", startDrag);
  document.addEventListener("pointermove", continueDrag);
  document.addEventListener("pointerup", finishDrag);
  document.addEventListener("pointercancel", cancelDrag);
  elements.inputPlate.addEventListener("click", clickWellWithKeyboard);
}

// Connects the two Copy buttons to the copy text of their lists (section 8).
function connectResults() {
  elements.copyContentsToWells.addEventListener("click", () =>
    copyText(elements.copyContentsToWells, contentsToWellsText(result)),
  );
  elements.copyWellToContents.addEventListener("click", () =>
    copyText(elements.copyWellToContents, wellToContentsText(result)),
  );
}

// --- After every change ---

// Called after every change to the inputs: hides the "add fixed contents first" note, turns the
// Copy buttons back from "Copied", and updates everything shown.
function inputsChanged() {
  elements.placingNote.hidden = true;
  resetCopyButtons();
  refresh();
}

// Updates everything that depends on the inputs and the result: the filler's spare-well count, the
// fixed-contents lines, the input plate, the to-do list and Randomize button, and whether the result
// is out of date.
function refresh() {
  const colors = colorsByName(inputs);
  refreshFillerFills();
  refreshEntryRows(colors);
  drawInputPlateState(colors);
  refreshProblems();
  refreshResultState();
}

// --- Randomized contents table (section 4) ---

// A new, empty condition row's condition.
function newCondition() {
  return { name: "", replicates: "" };
}

// Redraws the condition rows from inputs.conditions. Called only when a row is added or removed, so
// the boxes being typed in aren't replaced while typing.
function drawConditionRows() {
  elements.conditionsBody.replaceChildren(...inputs.conditions.map(createConditionRow));
}

// One condition's row: its number, name box, replicates box and Remove button.
// Rows are numbered from 1, matching the logic's messages ("Row 3: …").
function createConditionRow(condition, index) {
  const number = index + 1;
  const nameBox = createTextBox(condition.name, `Name, row ${number}`, (text) => {
    condition.name = text;
  });
  const replicatesBox = createTextBox(
    String(condition.replicates),
    `Replicates, row ${number}`,
    (text) => {
      condition.replicates = typedValue(text);
    },
  );
  replicatesBox.inputMode = "numeric";
  // Enter moves to the next useful box (section 4): name → replicates → the next row's name.
  onEnter(nameBox, () => replicatesBox.focus());
  onEnter(replicatesBox, () => goToNextCondition(condition));
  // Pasting several cells fills the table from this box (section 4).
  onMultiCellPaste(nameBox, (rows) => pasteConditions(condition, "name", rows));
  onMultiCellPaste(replicatesBox, (rows) => pasteConditions(condition, "replicates", rows));
  const removeButton = createButton("Remove", `Remove row ${number}`, () =>
    removeCondition(condition),
  );
  return createRow([String(number), nameBox, replicatesBox, removeButton]);
}

// Puts the cursor in the next row's name box, or adds a row after the last one, unless the last
// row is still completely empty, so pressing Enter repeatedly can't pile up empty rows (section 4).
function goToNextCondition(condition) {
  const index = inputs.conditions.indexOf(condition);
  const nextRow = elements.conditionsBody.children[index + 1];
  if (nextRow !== undefined) {
    nextRow.querySelector("input").focus();
  } else if (condition.name.trim() !== "" || String(condition.replicates).trim() !== "") {
    addCondition();
  }
}

// Fills the condition rows from `condition` down with pasted rows, overwriting the rows below and
// adding rows as needed (section 4). Pasted into the name column, each row's cells are the name and
// then, if there is one, the replicates; into the replicates column, just the replicates.
function pasteConditions(condition, column, rows) {
  const start = inputs.conditions.indexOf(condition);
  rows.forEach((cells, offset) => {
    if (inputs.conditions[start + offset] === undefined) {
      inputs.conditions.push(newCondition());
    }
    const target = inputs.conditions[start + offset];
    if (column === "name") {
      target.name = cells[0];
      if (cells[1] !== undefined) {
        target.replicates = typedValue(cells[1]);
      }
    } else {
      target.replicates = typedValue(cells[0]);
    }
  });
  drawConditionRows();
  inputsChanged();
}

// Adds an empty condition row and puts the cursor in its name box.
function addCondition() {
  inputs.conditions.push(newCondition());
  drawConditionRows();
  elements.conditionsBody.lastElementChild.querySelector("input").focus();
  inputsChanged();
}

// Removes a condition's row.
function removeCondition(condition) {
  inputs.conditions.splice(inputs.conditions.indexOf(condition), 1);
  drawConditionRows();
  inputsChanged();
}

// Shows how many wells the filler will fill, e.g. "Fills 12 spare wells", from spareWellCount;
// empty while a replicate count isn't valid (section 4).
function refreshFillerFills() {
  const spare = spareWellCount(inputs);
  if (spare === null) {
    elements.fillerFills.textContent = "";
  } else if (spare === 0) {
    elements.fillerFills.textContent = "No spare wells";
  } else {
    elements.fillerFills.textContent = `Fills ${countOf(spare, "spare well")}`;
  }
}

// --- Fixed contents table (section 4) ---

// A new, empty fixed-contents entry with no wells.
function newEntry() {
  return { name: "", wells: new WellSelection(GRID_96) };
}

// Redraws the fixed-contents lines from inputs.fixedContents. Called only when an entry is added or
// removed; refreshEntryRows updates the parts that change while typing and placing.
function drawEntryRows() {
  elements.fixedContentsBody.replaceChildren(...inputs.fixedContents.map(createEntryRow));
}

// One entry's line: a choice button for placing, its color, its number, its name box, how many
// wells it holds, and Remove. Choosing it, or clicking into its name box, makes it the entry being
// placed. Entries are numbered from 1, matching the logic's messages ("Fixed contents 2 …").
function createEntryRow(entry, index) {
  const number = index + 1;
  const choice = document.createElement("input");
  choice.type = "radio";
  choice.name = "entry-being-placed";
  choice.setAttribute("aria-label", `Place fixed contents ${number}`);
  choice.addEventListener("change", () => chooseEntryToPlace(entry));
  const swatch = document.createElement("span");
  swatch.className = "swatch";
  const nameBox = createTextBox(entry.name, `Name, fixed contents ${number}`, (text) => {
    entry.name = text;
  });
  nameBox.addEventListener("focus", () => chooseEntryToPlace(entry));
  onEnter(nameBox, () => goToNextEntry(entry));
  onMultiCellPaste(nameBox, (rows) => pasteEntries(entry, rows));
  const wellCount = document.createElement("span");
  wellCount.className = "well-count";
  const removeButton = createButton("Remove", `Remove fixed contents ${number}`, () =>
    removeEntry(entry),
  );
  return createRow([choice, swatch, String(number), nameBox, wellCount, removeButton]);
}

// Updates each entry's line: highlighted and chosen if it's being placed, its color, and its number
// of wells, e.g. "34 wells".
function refreshEntryRows(colors) {
  inputs.fixedContents.forEach((entry, index) => {
    const row = elements.fixedContentsBody.children[index];
    const isBeingPlaced = entry === entryBeingPlaced;
    row.classList.toggle("being-placed", isBeingPlaced);
    row.querySelector("input[type=radio]").checked = isBeingPlaced;
    row.querySelector(".swatch").style.setProperty("--swatch-fill", colorOf(entry.name, colors).fill);
    row.querySelector(".well-count").textContent = countOf(entry.wells.selectedWells().length, "well");
  });
}

// Makes an entry the one being placed. Not a change to the inputs, so a result stays as it is.
function chooseEntryToPlace(entry) {
  entryBeingPlaced = entry;
  refresh();
}

// Puts the cursor in the next entry's name box (making it the one being placed), or adds an entry
// after the last one, unless the last entry still has no name (section 4).
function goToNextEntry(entry) {
  const index = inputs.fixedContents.indexOf(entry);
  const nextRow = elements.fixedContentsBody.children[index + 1];
  if (nextRow !== undefined) {
    nextRow.querySelector("input[type=text]").focus();
  } else if (entry.name.trim() !== "") {
    addEntry();
  }
}

// Fills the fixed-contents names from `entry` down with the first cell of each pasted row,
// overwriting the entries below and adding entries as needed (section 4).
function pasteEntries(entry, rows) {
  const start = inputs.fixedContents.indexOf(entry);
  rows.forEach((cells, offset) => {
    if (inputs.fixedContents[start + offset] === undefined) {
      inputs.fixedContents.push(newEntry());
    }
    inputs.fixedContents[start + offset].name = cells[0];
  });
  drawEntryRows();
  inputsChanged();
}

// Adds an empty entry and makes it the one being placed, with the cursor in its name box.
function addEntry() {
  inputs.fixedContents.push(newEntry());
  entryBeingPlaced = inputs.fixedContents.at(-1);
  drawEntryRows();
  elements.fixedContentsBody.lastElementChild.querySelector("input[type=text]").focus();
  inputsChanged();
}

// Takes an entry out of the list, so its wells become open. If it was being placed, the entry that
// moves into its place (or the new last entry) is placed next; with no entries left, none is.
function removeEntry(entry) {
  const index = inputs.fixedContents.indexOf(entry);
  inputs.fixedContents.splice(index, 1);
  if (entryBeingPlaced === entry) {
    const lastIndex = inputs.fixedContents.length - 1;
    entryBeingPlaced = inputs.fixedContents[Math.min(index, lastIndex)] ?? null;
  }
  drawEntryRows();
  inputsChanged();
}

// --- Input plate (section 5) ---

// Creates one well of the input plate: a button, so it can be reached with Tab and pressed with
// Enter or Space.
function createInputWell() {
  const button = document.createElement("button");
  button.type = "button";
  return button;
}

// Shows every well of the input plate as it is now, or, during a drag, as the wells in the box will
// be after release. Also updates the "N fixed · N open" count above the plate.
function drawInputPlateState(colors) {
  const preview = dragPreview();
  let fixedCount = 0;
  for (const wellElement of elements.inputPlate.querySelectorAll("[data-well]")) {
    const well = wellElement.dataset.well;
    const entry = preview.has(well) ? preview.get(well) : entryHolding(well);
    showInputWell(wellElement, well, entry, colors);
    if (entryHolding(well) !== null) {
      fixedCount += 1;
    }
  }
  const openCount = GRID_96.wellNames().length - fixedCount;
  elements.plateCounts.textContent = `${fixedCount} fixed · ${openCount} open`;
}

// Shows one input-plate well: open (white, with its well name) or fixed (its entry's color, a dark
// outline and its code), with its hover-box text and a label for screen readers.
function showInputWell(wellElement, well, entry, colors) {
  if (entry === null) {
    showWell(wellElement, { label: well, color: null, isFixed: false });
    wellElement.dataset.hover = `${well}: open`;
    wellElement.setAttribute("aria-label", `${well}, open`);
    return;
  }
  const nameText = entry.name === "" ? "no name yet" : entry.name;
  showWell(wellElement, {
    label: entryCode(entry),
    color: colorOf(entry.name, colors),
    isFixed: true,
  });
  wellElement.dataset.hover = `${well}: ${nameText}`;
  wellElement.setAttribute("aria-label", `${well}, fixed, ${nameText}`);
}

// The entry that holds a well, or null if the well is open, e.g. entryHolding("A1") → the Static entry.
function entryHolding(well) {
  return inputs.fixedContents.find(({ wells }) => wells.isSelected(well)) ?? null;
}

// During a drag, what each well in the box will hold after release: the entry being placed, or null
// for open. Empty when there's no drag. Wells outside the box aren't changed by a drag.
function dragPreview() {
  if (drag === null) {
    return new Map();
  }
  const box = GRID_96.wellsInBox(drag.startWell, drag.currentWell);
  const willHold = drag.opensWells ? null : entryBeingPlaced;
  return new Map(box.map((well) => [well, willHold]));
}

// Starts a drag when the main button (or a finger or pen) presses a well. Whether releasing will
// open or place is decided here, by the well where the press started.
function startDrag(event) {
  hideHoverBox();
  const well = wellOf(event.target);
  if (well === null || event.button !== 0) {
    return;
  }
  if (entryBeingPlaced === null) {
    elements.placingNote.hidden = false;
    return;
  }
  drag = { startWell: well, currentWell: well, opensWells: entryBeingPlaced.wells.isSelected(well) };
  refresh();
}

// Moves the far corner of the box to the well under the pointer, and redraws the preview. Uses the
// pointer's position rather than the event's target, because a finger's events keep going to the
// well where the touch started.
function continueDrag(event) {
  if (drag === null) {
    return;
  }
  const elementUnderPointer = document.elementFromPoint(event.clientX, event.clientY);
  const isOnInputPlate =
    elementUnderPointer !== null && elements.inputPlate.contains(elementUnderPointer);
  const well = isOnInputPlate ? wellOf(elementUnderPointer) : null;
  if (well !== null && well !== drag.currentWell) {
    drag.currentWell = well;
    refresh();
  }
}

// Ends a drag: opens or places every well in the box between the starting well and the last well
// the pointer was over.
function finishDrag() {
  if (drag === null) {
    return;
  }
  const box = GRID_96.wellsInBox(drag.startWell, drag.currentWell);
  const opensWells = drag.opensWells;
  drag = null;
  changeWells(box, opensWells);
}

// Abandons a drag the browser interrupts (e.g. a touch turned into a scroll); nothing changes.
function cancelDrag() {
  drag = null;
  refresh();
}

// Acts on a well chosen with Enter or Space as a click: a box of one well. A mouse or touch click is
// already handled by the drag functions; a click event from the keyboard has event.detail 0.
function clickWellWithKeyboard(event) {
  const well = wellOf(event.target);
  if (well === null || event.detail !== 0) {
    return;
  }
  if (entryBeingPlaced === null) {
    elements.placingNote.hidden = false;
    return;
  }
  changeWells(GRID_96.wellsInBox(well, well), entryBeingPlaced.wells.isSelected(well));
}

// Opens the wells (openWells), or gives them all the entry being placed (placeName).
function changeWells(wells, opensWells) {
  if (opensWells) {
    openWells(inputs.fixedContents, wells);
  } else {
    placeName(inputs.fixedContents, wells, entryBeingPlaced);
  }
  inputsChanged();
}

// --- Checking the inputs (section 6) ---

// Shows what is still needed, from findProblems, and turns Randomize on only when nothing is.
function refreshProblems() {
  const problems = findProblems(inputs);
  elements.problems.replaceChildren(...problems.map((problem) => createElement("li", problem)));
  elements.ready.hidden = problems.length > 0;
  elements.randomize.disabled = problems.length > 0;
}

// --- Results (section 8) ---

// Randomizes the current inputs and shows the new result in place of any earlier one.
function randomizeInputs() {
  result = randomize(inputs);
  drawResult();
  resetCopyButtons();
  refresh();
}

// Draws the result: its seed, plate, legend and two lists. Colors come from the result's own copy of
// the inputs, so a result keeps its colors even after the inputs change.
function drawResult() {
  const colors = colorsByName(result.inputs);
  elements.resultsPlaceholder.hidden = true;
  elements.resultsContent.hidden = false;
  elements.resultSeed.textContent = String(result.inputs.seed);
  drawResultPlate(colors);
  drawLegend(colors);
  drawLists();
}

// Creates one well of the result plate. It isn't a button: the result plate can't be changed.
function createResultWell() {
  return document.createElement("div");
}

// Fills each result-plate well with its contents' color and code. Fixed wells get the dark outline;
// randomized wells (replicate and filler) are plain circles.
function drawResultPlate(colors) {
  const codes = codesByName(result.inputs);
  for (const { well, contents } of wellToContents(result)) {
    const wellElement = elements.resultPlate.querySelector(`[data-well="${well}"]`);
    const isFixed = result.wellTypes[well] === "fixed";
    showWell(wellElement, { label: codes.get(contents), color: colorOf(contents, colors), isFixed });
    wellElement.dataset.hover = `${well}: ${contents}`;
    wellElement.setAttribute("role", "img");
    wellElement.setAttribute("aria-label", `${well}, ${isFixed ? "fixed" : "randomized"}, ${contents}`);
  }
}

// Lists each contents with its color, code, full name and number of wells, in the order of the
// contents → wells list, e.g. "● 1 Condition 1  4 wells".
function drawLegend(colors) {
  const codes = codesByName(result.inputs);
  const items = contentsToWells(result).map(({ contents, wells }) => {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.setProperty("--swatch-fill", colorOf(contents, colors).fill);
    const count = createElement("span", countOf(wells.length, "well"));
    count.className = "legend-count";
    const item = document.createElement("li");
    const code = createElement("span", codes.get(contents));
    code.className = "legend-code";
    const name = createElement("span", contents);
    name.className = "legend-name";
    item.append(swatch, code, name, count);
    return item;
  });
  elements.legend.replaceChildren(...items);
}

// Fills the two lists' tables: contents → wells, and well → contents.
function drawLists() {
  elements.contentsToWellsBody.replaceChildren(
    ...contentsToWells(result).map(({ contents, wells }) => createRow([contents, wells.join(", ")])),
  );
  elements.wellToContentsBody.replaceChildren(
    ...wellToContents(result).map(({ well, contents }) => createRow([well, contents])),
  );
}

// Shows the result as out of date while it no longer matches the inputs: the banner appears, the
// result is faded, and copying is turned off. Shows it normally again once they match.
function refreshResultState() {
  if (result === null) {
    return;
  }
  const isOutOfDate = !matchesInputs(result, inputs);
  elements.outOfDateBanner.hidden = !isOutOfDate;
  elements.resultsBody.classList.toggle("out-of-date", isOutOfDate);
  elements.copyContentsToWells.disabled = isOutOfDate;
  elements.copyWellToContents.disabled = isOutOfDate;
}

// Copies text to the clipboard, and says "Copied" on the button until something changes. If the
// browser refuses (e.g. it doesn't allow clipboard access), the button says "Copy failed" instead.
async function copyText(button, text) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy failed";
  }
}

// Turns both Copy buttons back to "Copy".
function resetCopyButtons() {
  elements.copyContentsToWells.textContent = "Copy";
  elements.copyWellToContents.textContent = "Copy";
}

// --- Plates (shared by the input and result plates) ---

// Draws a plate's grid: column numbers across the top, row letters down the side, and one well
// element per well, made by createWell and marked with its name in data-well.
function drawPlate(plate, createWell) {
  plate.style.setProperty("--rows", String(GRID_96.rows));
  plate.style.setProperty("--columns", String(GRID_96.columns));
  for (let column = 1; column <= GRID_96.columns; column++) {
    plate.append(createPlateHeading(String(column), 1, column + 1));
  }
  for (let row = 1; row <= GRID_96.rows; row++) {
    // Well names are one row letter followed by the column number (well-grid.md), so the first
    // character of the row's first well is its row letter.
    const rowLetter = GRID_96.wellNameAt(row, 1).charAt(0);
    plate.append(createPlateHeading(rowLetter, row + 1, 1));
  }
  for (const well of GRID_96.wellNames()) {
    const { row, column } = GRID_96.wellPosition(well);
    const wellElement = createWell(well);
    wellElement.classList.add("well");
    wellElement.dataset.well = well;
    wellElement.style.gridRow = String(row + 1);
    wellElement.style.gridColumn = String(column + 1);
    wellElement.append(createElement("span", ""));
    plate.append(wellElement);
  }
}

// A row letter or column number at the edge of a plate, placed in the plate's grid.
function createPlateHeading(text, gridRow, gridColumn) {
  const heading = createElement("div", text);
  heading.className = "plate-heading";
  heading.setAttribute("aria-hidden", "true");
  heading.style.gridRow = String(gridRow);
  heading.style.gridColumn = String(gridColumn);
  return heading;
}

// Shows a well's label, its colors (null for an open well's plain white) and whether it has the
// fixed wells' dark outline.
function showWell(wellElement, { label, color, isFixed }) {
  wellElement.firstElementChild.textContent = label;
  wellElement.classList.toggle("fixed", isFixed);
  if (color === null) {
    wellElement.style.removeProperty("--well-fill");
    wellElement.style.removeProperty("--well-text");
  } else {
    wellElement.style.setProperty("--well-fill", color.fill);
    wellElement.style.setProperty("--well-text", color.text);
  }
}

// The well name of a plate's well element, or of the element inside it that was pressed,
// e.g. the label inside A1 → "A1". null if the element isn't part of a well.
function wellOf(element) {
  return element.closest("[data-well]")?.dataset.well ?? null;
}

// --- Colors (section 7) ---

// Each name's colors for a set of inputs, from listingOrder: the role picks the set and the position
// picks the color within it, e.g. Map { "Condition 1" → { fill: "var(--condition-fill-1)", … } }.
function colorsByName(someInputs) {
  const colors = new Map();
  for (const { name, role, position } of listingOrder(someInputs)) {
    colors.set(name, colorFor(role, position));
  }
  return colors;
}

// The colors for a role and position, wrapping around after the role's last color, as CSS variables
// defined in randomizer.css, e.g. ("condition", 16) → the first condition color again.
function colorFor(role, position) {
  const number = (position % colorCount(role)) + 1;
  return {
    fill: `var(--${role}-fill-${number})`,
    text: `var(--${role}-text-${number}, var(--text-dark))`,
  };
}

// How many colors a role has, read from randomizer.css so the colors are defined in one place,
// e.g. "fixed" → 6.
function colorCount(role) {
  const rootStyle = getComputedStyle(document.documentElement);
  return Number(rootStyle.getPropertyValue(`--${role}-color-count`));
}

// A name's colors, or the gray of an entry with no name yet.
function colorOf(name, colors) {
  return colors.get(name) ?? UNNAMED_COLOR;
}

// --- Codes (section 7) ---

// Each name's code for a set of inputs, from listingOrder: a condition's row number ("1", "2" …),
// the filler "S", and a fixed-contents entry's "F" and number ("F1", "F2" …),
// e.g. Map { "Condition 1" → "1", "Spare" → "S", "Static" → "F1" }.
function codesByName(someInputs) {
  const codes = new Map();
  for (const { name, role, position } of listingOrder(someInputs)) {
    codes.set(name, codeFor(role, position));
  }
  return codes;
}

// The code for a role and a position counted from 0, e.g. ("fixed", 0) → "F1".
function codeFor(role, position) {
  if (role === "condition") {
    return String(position + 1);
  }
  if (role === "filler") {
    return "S";
  }
  return `F${position + 1}`;
}

// The code an entry shows on the input plate: its name's code, or, while it has no name yet, "F"
// and its number, e.g. the second entry with no name → "F2".
function entryCode(entry) {
  return codesByName(inputs).get(entry.name) ?? codeFor("fixed", inputs.fixedContents.indexOf(entry));
}

// --- Hover box (section 5) ---

// Creates the one hover box shared by both plates, and shows it beside a well as soon as the pointer
// is over it, with the well's hover text, e.g. "E4: Vehicle". It hides when the pointer leaves the
// well, the page scrolls, or a drag starts. Being one box, moved from well to well, two can never
// show at once.
function connectHoverBox() {
  const hoverBox = document.createElement("div");
  hoverBox.className = "hover-box";
  hoverBox.hidden = true;
  document.body.append(hoverBox);
  document.addEventListener("pointerover", (event) => {
    const wellElement = event.target.closest(".plate [data-well]");
    if (wellElement === null || drag !== null) {
      return;
    }
    const box = wellElement.getBoundingClientRect();
    hoverBox.textContent = wellElement.dataset.hover ?? "";
    hoverBox.style.left = `${box.left + box.width / 2}px`;
    hoverBox.style.top = `${box.top - 6}px`;
    hoverBox.hidden = false;
  });
  document.addEventListener("pointerout", (event) => {
    if (event.target.closest(".plate [data-well]") !== null) {
      hideHoverBox();
    }
  });
  document.addEventListener("scroll", hideHoverBox, true);
}

// Hides the hover box, if it has been created.
function hideHoverBox() {
  const hoverBox = document.querySelector(".hover-box");
  if (hoverBox !== null) {
    hoverBox.hidden = true;
  }
}

// --- Small helpers ---

// What a typed replicate count or seed is passed on as: digits as a number, anything else as the
// text typed, so the logic can report it (section 4), e.g. "4" → 4, "four" → "four", "" → "".
function typedValue(text) {
  return /^[0-9]+$/.test(text) ? Number(text) : text;
}

// A count with its noun, made plural when the count isn't 1, e.g. countOf(1, "well") → "1 well".
function countOf(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// Calls `action` when Enter is pressed in a box, instead of anything Enter would otherwise do.
function onEnter(box, action) {
  box.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      action();
    }
  });
}

// When text with several cells is pasted into a box, calls `action` with its rows (from
// parsePastedTable) instead of pasting it into the box. A single value pastes normally.
function onMultiCellPaste(box, action) {
  box.addEventListener("paste", (event) => {
    const text = event.clipboardData.getData("text/plain");
    if (isMultiCell(text)) {
      event.preventDefault();
      action(parsePastedTable(text));
    }
  });
}

// A text box holding `value`, labeled for screen readers, that calls onType with the new text after
// every keystroke and then updates the page.
function createTextBox(value, label, onType) {
  const box = document.createElement("input");
  box.type = "text";
  box.value = value;
  box.setAttribute("aria-label", label);
  box.addEventListener("input", () => {
    onType(box.value);
    inputsChanged();
  });
  return box;
}

// A button with visible text, a fuller label for screen readers, and an action when clicked.
function createButton(text, label, onClick) {
  const button = createElement("button", text);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

// A table row with one cell per item: text becomes the cell's text, an element goes inside it.
function createRow(items) {
  const row = document.createElement("tr");
  for (const item of items) {
    const cell = document.createElement("td");
    cell.append(item);
    row.append(cell);
  }
  return row;
}

// A new element of the given kind holding text, e.g. createElement("li", "Ready").
function createElement(tagName, text) {
  const element = document.createElement(tagName);
  element.textContent = text;
  return element;
}

// The element of randomizer.html with this id.
function byId(id) {
  return document.getElementById(id);
}
