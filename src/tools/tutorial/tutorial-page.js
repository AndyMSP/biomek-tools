// tutorial-page.js — the tutorial file's page script: the transfer designer's own page with the
// guide panel over it (docs/glossary.md, "Guide panel"). It imports the transfer designer's page
// script first, so the page runs exactly as in the Transfer Designer, then draws the panel and the
// ring, reading the page only through its tutorial hooks (transfer-designer-page.md, section 17).
// Every rule about what a step says, rings or needs is in tutorial.js; this file only draws it,
// remembers where the reader is, and keeps the panel out of the way.
// Specification: tutorial-page.md.

import {
  tutorialView,
  tutorialElement,
  tutorialSavedBy,
  tutorialStartWith,
} from "../transfer-designer/transfer-designer-page.js";
import { TUTORIALS, tutorialById, stepState, parseMarkup, parseInline } from "./tutorial.js";
import { startingPlanText } from "./tutorial-plans.js";

// --- Constants ---

// Where the panel keeps its place in the browser's local storage (section 4).
const STATE_KEY = "biomek-tools tutorial: state";
const FINISHED_KEY = "biomek-tools tutorial: finished";
const POSITION_KEY = "biomek-tools tutorial: position";

// How often the panel redraws from a fresh view, in milliseconds (section 5).
const REDRAW_MILLISECONDS = 250;

// The panel's distance from the window's edges (section 5).
const EDGE = 16;

// The ring's distance outside its target on every side, and its least height (section 6).
const RING_OUTSET = 4;
const RING_MIN_HEIGHT = 6;

// Keeping clear (section 6): the target counts as this many keep-clear elements.
const TARGET_WEIGHT = 10;

// While a dialog is open (section 6): the room kept below it, and the least room the panel needs to
// fit there whole.
const DIALOG_GAP = 24;
const DIALOG_MIN_ROOM = 160;

// --- The panel's state ---

// Where the reader is: { tutorial, step }, or { tutorial: null } for the menu (section 4).
let place = readPlace();

// The IDs of the tutorials whose last step has been shown.
const finished = new Set(readFinished());

// Whether the shown sticky step has been done since it was shown (section 4: kept in memory).
let stickyDone = false;

// Whether the shown step was done at the last redraw, so the main button pulses once it becomes so.
let wasDoneLastTime = false;

// The reader's fold (the – button), and the fold keeping clear makes while the panel covers the
// target (section 6), which unfolds by itself. `unfoldedByReader` is set when the reader presses +
// on keeping clear's fold: it keeps the panel unfolded until the step changes (section 5).
let foldedByReader = false;
let foldedToKeepClear = false;
let unfoldedByReader = false;

// Which bottom corner the panel sits in until dragged: "right" (at first) or "left".
let corner = "right";

// Where the reader dragged the panel, { left, top }, or null: once dragged, keeping clear is off.
let draggedTo = readPosition();

// While a dialog makes the panel compact: whether "Show steps" shows the full body over it.
let stepsShownOverDialog = false;

// The key of the content drawn last, so the body is replaced only when it changes (section 5),
// and the place it was drawn for, so a new step starts scrolled to its top.
let drawnContentKey = null;
let drawnPlaceKey = null;

// The panel's height when last drawn unfolded and not compact, for working out what it would cover
// if it unfolded.
let fullHeight = 0;

// The element marked with data-tutorial-target, or null.
let markedTarget = null;

// --- The panel's elements ---

const panel = createElement("div", "", "tutorial-panel");
panel.setAttribute("data-tutorial-panel", "");
panel.setAttribute("role", "complementary");
panel.setAttribute("aria-label", "Tutorial");

const header = createElement("div", "", "tp-header");
const headerTitle = createElement("span", "Tutorial", "tp-header-title");
const headerWhere = createElement("span", "", "tp-header-where");
const foldButton = createButton("–", "tp-fold", toggleFold);
header.append(headerTitle, headerWhere, foldButton);

const progress = createElement("div", "", "tp-progress");
const progressFill = createElement("div", "", "tp-progress-fill");
progress.append(progressFill);

const body = createElement("div", "", "tp-body");
const content = createElement("div", "", "tp-content");
const status = createElement("p", "", "tp-status");
const showStepsLink = createButton("Show steps", "tp-show-steps", () => {
  stepsShownOverDialog = true;
  redraw();
});
body.append(content, status);

const footer = createElement("div", "", "tp-footer");
const allTutorialsButton = createButton("All tutorials", "tp-button", showMenu);
const backButton = createButton("Back", "tp-button", () => goToStep(place.step - 1));
const mainButton = createButton("Next", "tp-button tp-main", pressMain);
footer.append(allTutorialsButton, createElement("span", "", "tp-spacer"), backButton, mainButton);

panel.append(header, progress, body, showStepsLink, footer);

const ring = createElement("div", "", "tutorial-ring");
ring.setAttribute("aria-hidden", "true");
ring.hidden = true;

setUpPanel();

// --- Setting up ---

// Adds the panel and the ring to the page, connects dragging, keeps the panel reachable while a
// page dialog is open, and starts redrawing.
function setUpPanel() {
  document.body.append(ring, panel);
  // Presses on the panel don't take the keyboard focus from the page, so a box the page has open
  // stays as it was (transfer-designer-page.md, section 17).
  panel.addEventListener("mousedown", (event) => event.preventDefault());
  connectDragging();
  keepReachable();
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (stepsShownOverDialog && !panel.contains(event.target)) {
        stepsShownOverDialog = false;
        redraw();
      }
    },
    true,
  );
  window.addEventListener("resize", redraw);
  document.addEventListener("scroll", redraw, true);
  setInterval(redraw, REDRAW_MILLISECONDS);
  redraw();
}

// The page's dialogs make every other child of the body inert while open; the panel clears that at
// once, so the reader can follow the steps with a dialog open (section 6).
function keepReachable() {
  const observer = new MutationObserver(() => {
    if (panel.inert) {
      panel.inert = false;
    }
  });
  observer.observe(panel, { attributes: true, attributeFilter: ["inert"] });
}

// --- Storage (section 4) ---

// The stored value under `key`, parsed, or `fallback` if there's none, it can't be read, or the
// browser has no storage.
function readStored(key, fallback) {
  try {
    const text = window.localStorage.getItem(key);
    return text === null ? fallback : JSON.parse(text);
  } catch {
    return fallback;
  }
}

// Stores `value` under `key`; without storage, the panel works on, forgetting its place on reload.
function store(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // No local storage, or it refuses: nothing is kept.
  }
}

// The stored finished list: the IDs of tutorials that exist, or none if what's stored isn't a list.
function readFinished() {
  const stored = readStored(FINISHED_KEY, []);
  return Array.isArray(stored) ? stored.filter((id) => tutorialById(id) !== null) : [];
}

// The stored position, { left, top }, or null if there's none or it doesn't hold two numbers.
function readPosition() {
  const stored = readStored(POSITION_KEY, null);
  const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
  return stored !== null && typeof stored === "object" && isNumber(stored.left) && isNumber(stored.top)
    ? { left: stored.left, top: stored.top }
    : null;
}

// The stored place, or the menu if there's none or it names a tutorial or step that doesn't exist.
function readPlace() {
  const stored = readStored(STATE_KEY, null);
  const tutorial = tutorialById(stored?.tutorial);
  if (tutorial === null || !Number.isInteger(stored?.step) || stored.step < 0 || stored.step >= tutorial.steps.length) {
    return { tutorial: null };
  }
  return { tutorial: tutorial.id, step: stored.step };
}

// Sets and stores the reader's place, forgetting the last step's sticky state, and redraws.
function setPlace(newPlace) {
  place = newPlace;
  stickyDone = false;
  unfoldedByReader = false;
  wasDoneLastTime = false;
  store(STATE_KEY, place);
  redraw();
}

// --- Moving through the tutorials ---

// Goes back to the menu, keeping the plan as it is.
function showMenu() {
  setPlace({ tutorial: null });
}

// Goes to step `index` of the current tutorial.
function goToStep(index) {
  const tutorial = tutorialById(place.tutorial);
  if (tutorial !== null && index >= 0 && index < tutorial.steps.length) {
    setPlace({ tutorial: tutorial.id, step: index });
  }
}

// Starts a tutorial (section 4): puts its starting plan in the page's browser copy (or removes the
// copy, for the empty plan, so the page opens with its own), sets the place to its step 0, and
// reloads the page, which brings the plan back as it always does.
function startTutorial(tutorial) {
  const text = tutorial.startPlan === "empty" ? null : startingPlanText(tutorial.startPlan, tutorialSavedBy);
  try {
    tutorialStartWith(text);
  } catch {
    // Without storage the page can't be given the plan; the tutorial starts on the plan shown.
  }
  place = { tutorial: tutorial.id, step: 0 };
  store(STATE_KEY, place);
  window.location.reload();
}

// The main button: Start or Next/Skip go to the next step; at the last step, Next tutorial starts
// the next one, or All tutorials goes back to the menu.
function pressMain() {
  const tutorial = tutorialById(place.tutorial);
  if (tutorial === null) {
    return;
  }
  if (place.step < tutorial.steps.length - 1) {
    goToStep(place.step + 1);
    return;
  }
  const next = nextTutorial(tutorial);
  if (next === null) {
    showMenu();
  } else {
    startTutorial(next);
  }
}

// The tutorial after `tutorial` in the menu, or null for the last.
function nextTutorial(tutorial) {
  return TUTORIALS[TUTORIALS.indexOf(tutorial) + 1] ?? null;
}

// Folds the panel to its header, or unfolds it: the reader's own fold.
function toggleFold() {
  if (foldedToKeepClear) {
    foldedToKeepClear = false;
    foldedByReader = false;
    unfoldedByReader = true;
  } else {
    foldedByReader = !foldedByReader;
  }
  redraw();
}

// --- Drawing ---

// Draws the panel from a fresh view: the menu or the current step, the ring, and the panel's place.
function redraw() {
  const tutorial = tutorialById(place.tutorial);
  if (tutorial === null) {
    drawMenu();
    hideRing();
    placePanel(null, []);
    return;
  }
  const step = tutorial.steps[place.step];
  let view = null;
  try {
    view = tutorialView();
  } catch {
    // The page hasn't drawn yet: the step shows as not done.
  }
  const state = stepState(step, view, stickyDone);
  if (step.sticky === true && state.done) {
    stickyDone = true;
  }
  drawStep(tutorial, step, state);
  const target = state.target === null ? null : tutorialElement(state.target);
  drawRing(target);
  const keepClear = state.keepClear.map((entry) => tutorialElement(entry)).filter((element) => element !== null);
  placePanel(target, keepClear);
}

// Draws the menu (section 5): its title, a row per tutorial and the note under them.
function drawMenu() {
  panel.classList.add("tp-on-menu");
  headerWhere.textContent = "";
  const key = JSON.stringify({ menu: [...finished] });
  if (key === drawnContentKey) {
    return;
  }
  drawnContentKey = key;
  const rows = createElement("ol", "", "tp-menu");
  TUTORIALS.forEach((tutorial, index) => rows.append(createMenuRow(tutorial, index)));
  content.replaceChildren(
    createElement("h2", "Transfer Designer tutorials", "tp-title"),
    createElement(
      "p",
      "Each tutorial builds on the one before, but brings its own starting plan, so you can start anywhere.",
    ),
    rows,
    ...renderBlocks(parseMarkup("> Starting a tutorial replaces the practice plan. Real plans in the Transfer Designer are never touched.")),
  );
  status.replaceChildren();
}

// One row of the menu: its number, title, ✓ done if finished, summary, minutes and Start or Again.
function createMenuRow(tutorial, index) {
  const row = createElement("li", "", "tp-menu-row");
  const text = createElement("div", "", "tp-menu-text");
  const name = createElement("div", "", "tp-menu-name");
  name.append(createElement("span", `${index + 1}. `), createElement("strong", tutorial.title));
  if (finished.has(tutorial.id)) {
    name.append(createElement("span", "✓ done", "tp-menu-done"));
  }
  text.append(
    name,
    createElement("div", tutorial.summary, "tp-menu-summary"),
    createElement("div", `About ${tutorial.minutes} minutes.`, "tp-menu-summary"),
  );
  const start = createButton(finished.has(tutorial.id) ? "Again" : "Start", "tp-menu-start", () => startTutorial(tutorial));
  row.append(text, start);
  return row;
}

// Draws a step (section 5): the header, the progress bar, the body (only when it changes), the
// status line and the footer's buttons.
function drawStep(tutorial, step, state) {
  panel.classList.remove("tp-on-menu");
  const last = tutorial.steps.length - 1;
  const number = TUTORIALS.indexOf(tutorial) + 1;
  headerWhere.textContent = `${number}. ${tutorial.title}${place.step > 0 ? ` · step ${place.step} of ${last}` : ""}`;
  progressFill.style.width = `${(place.step / last) * 100}%`;
  drawContent(step, state);
  drawStatus(step, state);
  drawFooter(tutorial, step, state);
  if (place.step === last && !finished.has(tutorial.id)) {
    finished.add(tutorial.id);
    store(FINISHED_KEY, [...finished]);
  }
}

// Replaces the step's title, body, copy button and checklist, only when they've changed, so a copy
// button's "Copied." and the reader's scroll aren't reset between redraws.
function drawContent(step, state) {
  const key = JSON.stringify({ place, title: step.title, body: state.body, checklist: state.checklist });
  if (key === drawnContentKey) {
    return;
  }
  const placeKey = JSON.stringify(place);
  const isNewStep = placeKey !== drawnPlaceKey;
  drawnContentKey = key;
  drawnPlaceKey = placeKey;
  const parts = [createElement("h2", step.title, "tp-title"), ...renderBlocks(state.body)];
  if (step.copy !== undefined) {
    parts.push(createCopyRow(step.copy));
  }
  if (state.checklist !== null && state.checklist.items.length > 0) {
    parts.push(createChecklist(state.checklist));
  }
  content.replaceChildren(...parts);
  if (isNewStep) {
    body.scrollTop = 0;
  }
}

// The status line: waiting, or done, for a step with done; nothing for one without.
function drawStatus(step, state) {
  status.className = "tp-status";
  if (step.done === undefined) {
    status.replaceChildren();
    return;
  }
  if (state.done) {
    status.classList.add("tp-status-done");
    status.replaceChildren(...renderRuns(parseMarkup("✓ Done. Press **Next**.")[0].runs));
  } else {
    status.textContent = "Waiting for you to do this step…";
  }
}

// The footer: Back (disabled at step 0) and the main button, whose label says what it does.
function drawFooter(tutorial, step, state) {
  backButton.disabled = place.step === 0;
  const last = tutorial.steps.length - 1;
  let label;
  if (place.step === 0) {
    label = "Start";
  } else if (place.step === last) {
    label = nextTutorial(tutorial) === null ? "All tutorials" : "Next tutorial";
  } else {
    label = state.done ? "Next" : "Skip";
  }
  mainButton.textContent = label;
  mainButton.classList.toggle("tp-skip", label === "Skip");
  const becameDone = step.done !== undefined && state.done && !wasDoneLastTime;
  if (becameDone) {
    restartAnimation(mainButton, "tp-pulse");
  }
  wasDoneLastTime = step.done !== undefined && state.done;
}

// --- Rendering step markup ---

// The parsed blocks of step markup as elements (tutorial.md, section 3, "Step markup").
function renderBlocks(blocks) {
  return blocks.map((block) => {
    switch (block.kind) {
      case "numbered":
        return renderList("ol", block.items, block.start);
      case "bulleted":
        return renderList("ul", block.items, null);
      case "note":
        return withRuns(createElement("p", "", "tp-note"), block.runs);
      case "warning":
        return withRuns(createElement("p", "", "tp-warning"), block.runs);
      case "table":
        return renderTable(block.rows);
      default:
        return withRuns(createElement("p"), block.runs);
    }
  });
}

// A list of items, each a list of runs; a numbered list starts at `start`.
function renderList(tagName, items, start) {
  const list = createElement(tagName);
  if (start !== null && start !== 1) {
    list.start = start;
  }
  list.append(...items.map((runs) => withRuns(createElement("li"), runs)));
  return list;
}

// A table of rows, each a list of cells, each a list of runs; the first row is the header.
function renderTable(rows) {
  const table = createElement("table", "", "tp-table");
  const [headerRow, ...bodyRows] = rows;
  const head = createElement("thead");
  head.append(renderRow(headerRow, "th"));
  const tableBody = createElement("tbody");
  tableBody.append(...bodyRows.map((row) => renderRow(row, "td")));
  table.append(head, tableBody);
  return table;
}

// One table row, its cells as `cellTag` elements.
function renderRow(cells, cellTag) {
  const row = createElement("tr");
  row.append(...cells.map((runs) => withRuns(createElement(cellTag), runs)));
  return row;
}

// `element` holding the runs, returned.
function withRuns(element, runs) {
  element.append(...renderRuns(runs));
  return element;
}

// Inline runs as nodes: text as text (never read as HTML), bold, code and keys as elements.
function renderRuns(runs) {
  const tags = { bold: "strong", code: "code", key: "kbd" };
  return runs.map((run) => (run.kind === "text" ? document.createTextNode(run.text) : createElement(tags[run.kind], run.text)));
}

// The checklist (section 5): each item ✓ (green) or ○ (gray) then its text, in a row or one per
// line.
function createChecklist(checklist) {
  const list = createElement("div", "", checklist.inline ? "tp-checklist tp-inline" : "tp-checklist");
  for (const item of checklist.items) {
    const entry = createElement("span", "", item.done ? "tp-check tp-check-done" : "tp-check");
    entry.append(createElement("span", item.done ? "✓" : "○", "tp-check-mark"), ...renderRuns(parseInline(item.text)));
    list.append(entry);
  }
  return list;
}

// The copy button and its outcome (section 5).
function createCopyRow(copy) {
  const row = createElement("div", "", "tp-copy-row");
  const outcome = createElement("span", "", "tp-copy-outcome");
  const button = createButton(copy.label, "tp-copy", async () => {
    const copied = await copyText(copy.text);
    outcome.textContent = copied ? "Copied." : "The browser didn't let the page copy. Try again.";
    outcome.classList.toggle("tp-copy-failed", !copied);
  });
  row.append(button, outcome);
  return row;
}

// Puts `text` on the clipboard: with the clipboard API, or, failing that, a hidden text area and
// the copy command. Returns whether either worked.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyWithTextArea(text);
  }
}

// The clipboard fallback: copies `text` from a hidden text area. True if the browser copied it.
function copyWithTextArea(text) {
  const area = createElement("textarea", "", "tp-hidden-copy");
  area.value = text;
  panel.append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

// --- The ring (section 6) ---

// Rings `target`, an element, or hides the ring for null or an element with no size; marks the
// element with data-tutorial-target, taking the mark from the one before.
function drawRing(target) {
  if (markedTarget !== null && markedTarget !== target) {
    markedTarget.removeAttribute("data-tutorial-target");
    markedTarget = null;
  }
  if (target === null) {
    hideRing();
    return;
  }
  const box = target.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) {
    hideRing();
    return;
  }
  target.setAttribute("data-tutorial-target", "");
  markedTarget = target;
  const height = Math.max(box.height + 2 * RING_OUTSET, RING_MIN_HEIGHT);
  const top = box.top + box.height / 2 - height / 2;
  ring.style.left = `${box.left - RING_OUTSET}px`;
  ring.style.top = `${top}px`;
  ring.style.width = `${box.width + 2 * RING_OUTSET}px`;
  ring.style.height = `${height}px`;
  ring.hidden = false;
}

// Hides the ring and takes its mark off its element.
function hideRing() {
  ring.hidden = true;
  if (markedTarget !== null) {
    markedTarget.removeAttribute("data-tutorial-target");
    markedTarget = null;
  }
}

// --- Placing the panel (section 6) ---

// Places the panel: over or below an open dialog; where the reader dragged it; otherwise in a bottom
// corner, keeping clear of the target and the keep-clear elements.
function placePanel(target, keepClear) {
  const dialog = openDialog();
  setFolded(foldedByReader || foldedToKeepClear);
  if (dialog !== null) {
    placeBelowDialog(dialog);
    return;
  }
  panel.classList.remove("tp-compact", "tp-steps-over-dialog");
  panel.style.maxHeight = "";
  stepsShownOverDialog = false;
  if (draggedTo !== null) {
    moveTo(draggedTo.left, draggedTo.top);
    return;
  }
  keepClearOf(target, keepClear);
}

// The open page dialog's element (the wizard or the stock dialog), or null, from the page's hook.
function openDialog() {
  return tutorialElement({ kind: "dialog" });
}

// With a dialog open: the panel at the bottom left, in the room below the dialog if there's enough,
// otherwise compact, with Show steps to see the whole body over the dialog.
function placeBelowDialog(dialog) {
  const room = window.innerHeight - dialog.getBoundingClientRect().bottom - DIALOG_GAP;
  const compact = room < DIALOG_MIN_ROOM && !foldedByReader;
  panel.classList.toggle("tp-compact", compact && !stepsShownOverDialog);
  panel.classList.toggle("tp-steps-over-dialog", compact && stepsShownOverDialog);
  panel.style.maxHeight = compact ? "" : `${Math.max(room, 0)}px`;
  const height = panel.offsetHeight;
  moveTo(EDGE, window.innerHeight - EDGE - height);
}

// Until dragged: if the panel covers the target or a keep-clear element, it moves to the other
// bottom corner if that covers less (the target counting TARGET_WEIGHT); if both cover as much, it
// stays, folding to its header while it covers the target, and unfolding once it wouldn't.
function keepClearOf(target, keepClear) {
  const panelFolded = foldedByReader || foldedToKeepClear;
  if (!panelFolded) {
    fullHeight = panel.offsetHeight;
  }
  const width = panel.offsetWidth;
  const fullWidth = panelFolded ? fullPanelWidth() : width;
  const score = (side) => coverScore(cornerBox(side, fullWidth, fullHeight), target, keepClear);
  const other = corner === "right" ? "left" : "right";
  const here = score(corner);
  if (here > 0 && score(other) < here) {
    corner = other;
  }
  const coversTarget = target !== null && overlaps(cornerBox(corner, fullWidth, fullHeight), target.getBoundingClientRect());
  const foldWanted = coversTarget && !unfoldedByReader;
  if (!foldedByReader && foldedToKeepClear !== foldWanted) {
    foldedToKeepClear = foldWanted;
    setFolded(foldedToKeepClear);
  }
  const box = cornerBox(corner, panel.offsetWidth, panel.offsetHeight);
  moveTo(box.left, box.top);
}

// Folds the panel to its header or unfolds it, with the fold button's text and tooltip to match.
function setFolded(folded) {
  panel.classList.toggle("tp-folded", folded);
  foldButton.textContent = folded ? "+" : "–";
  foldButton.title = folded ? "Show the steps" : "Hide the steps";
}

// The panel's width unfolded, from its stylesheet (it's narrower folded).
function fullPanelWidth() {
  return Number.parseFloat(getComputedStyle(panel).getPropertyValue("--tp-width")) || panel.offsetWidth;
}

// The box the panel takes, `width` × `height`, in the bottom `side` corner of the window.
function cornerBox(side, width, height) {
  const left = side === "right" ? window.innerWidth - EDGE - width : EDGE;
  const top = window.innerHeight - EDGE - height;
  return { left, top, right: left + width, bottom: top + height };
}

// How much a panel at `box` covers: TARGET_WEIGHT for the target, 1 for each keep-clear element.
function coverScore(box, target, keepClear) {
  let total = target !== null && overlaps(box, target.getBoundingClientRect()) ? TARGET_WEIGHT : 0;
  for (const element of keepClear) {
    if (overlaps(box, element.getBoundingClientRect())) {
      total += 1;
    }
  }
  return total;
}

// True if two boxes overlap.
function overlaps(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

// Moves the panel to `left`, `top` (px from the window's top left), kept inside the window.
function moveTo(left, top) {
  const maxLeft = Math.max(window.innerWidth - panel.offsetWidth, 0);
  const maxTop = Math.max(window.innerHeight - panel.offsetHeight, 0);
  panel.style.left = `${Math.min(Math.max(left, 0), maxLeft)}px`;
  panel.style.top = `${Math.min(Math.max(top, 0), maxTop)}px`;
}

// --- Dragging (section 6) ---

// Pressing on the header (not its button) and moving drags the panel; letting go stores its place,
// and from then on keeping clear is off.
function connectDragging() {
  let start = null;
  header.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button") !== null) {
      return;
    }
    const box = panel.getBoundingClientRect();
    start = { x: event.clientX - box.left, y: event.clientY - box.top, moved: false };
    header.setPointerCapture(event.pointerId);
  });
  header.addEventListener("pointermove", (event) => {
    if (start === null) {
      return;
    }
    start.moved = true;
    moveTo(event.clientX - start.x, event.clientY - start.y);
  });
  header.addEventListener("pointerup", () => {
    if (start !== null && start.moved) {
      draggedTo = { left: Number.parseFloat(panel.style.left), top: Number.parseFloat(panel.style.top) };
      store(POSITION_KEY, draggedTo);
    }
    start = null;
  });
}

// --- Small helpers ---

// A panel button showing `text`, with `className`, doing `action` when pressed, then giving up the
// keyboard focus, so a later Enter or Space typed for the page can't press it again (section 5).
function createButton(text, className, action) {
  const button = createElement("button", text, className);
  button.type = "button";
  button.addEventListener("click", () => {
    button.blur();
    action();
  });
  return button;
}

// Plays an animation class on an element again, even if it's still running.
function restartAnimation(element, className) {
  element.classList.remove(className);
  // Reading offsetWidth makes the browser apply the removal before the class is added again.
  void element.offsetWidth;
  element.classList.add(className);
  element.addEventListener("animationend", () => element.classList.remove(className), { once: true });
}

// A new element of the given kind holding text, with a class if given,
// e.g. createElement("p", "Ready", "tp-note").
function createElement(tagName, text = "", className = "") {
  const element = document.createElement(tagName);
  if (text !== "") {
    element.textContent = text;
  }
  if (className !== "") {
    element.className = className;
  }
  return element;
}
