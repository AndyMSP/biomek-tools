// transfer-designer-page.js — the transfer designer page's behavior: it keeps the plan's history,
// passes on what the user does to the logic modules, and draws the result.
//
// The page has no rules of its own about plans (transfer-designer-page.md, section 1). Every edit
// goes through transfer-designer.js, undo and redo through plan-history.js, saving and opening
// through plan-file.js, the labware through deck.js, what each well holds through
// contents-tracking.js, how much each mixed well is mixed through mix-volumes.js, and the Biomek
// files through file-writer.js and zip.js. When one of them
// refuses an edit, the page shows its message and changes nothing. What this file decides is only
// how things look and how the user does them: how typing a volume works, how numbers are shown,
// where boxes float, and what each message says.
// Specification: transfer-designer-page.md.

import packageJson from "../../../package.json" with { type: "json" };
import { COMPONENT_COLORS } from "../../../config/component-colors.js";
import { DEFAULT_TRANSFER_VOLUME, DEFAULT_FILL_VOLUME } from "../../../config/default-volumes.js";
import { TIP_TYPES } from "../../../config/tip-types.js";
import { MIN_MIX_VOLUME } from "../../../config/mixing.js";
import { BASE_FOLDER } from "../../../config/paths.js";
import { replay } from "../../shared/contents-tracking/contents-tracking.js";
import { mixVolumes } from "../../shared/mix-volumes/mix-volumes.js";
import {
  labwareNames,
  gridOf,
  labwareTypeOf,
  wellsInBox,
} from "../../shared/deck/deck.js";
import { writeRunFiles, checkExperimentName } from "../../shared/file-writer/file-writer.js";
import { zipFiles } from "../../shared/zip/zip.js";
import { PlanHistory } from "./plan-history.js";
import { planToText, planFromText } from "./plan-file.js";
import {
  START,
  DEFAULT_MIX,
  emptyPlan,
  setExperimentName,
  probesFor,
  modesFor,
  modeSettings,
  modeOf,
  stageOrder,
  addStage,
  addMixStep,
  isMixStep,
  mixWells,
  unmixWell,
  renameStage,
  changeStageSettings,
  canRemoveStage,
  removeStage,
  stageEnds,
  stagesWithContentsProblem,
  stagesWithMixProblem,
  addTransfers,
  changeVolume,
  removeTransfer,
  transfersIn,
  tipChangeAt,
  addTipChange,
  setTipType,
  setTipProbes,
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
} from "./transfer-designer.js";

// --- Constants ---

// Who saved a plan file: the tool and the tools' version from package.json (section 5).
const SAVED_BY = `transfer designer v${packageJson.version}`;

// The key the browser copy of the plan is stored under, in the browser's local storage (section 5).
const STORAGE_KEY = "biomek-tools transfer designer: plan";

// What's open in the Stages column is START, a stage's ID, or END (section 4).
const END = "end";

// A press that moves this far (in pixels) becomes a drag rather than a click (section 9).
const DRAG_START_DISTANCE = 5;

// How long a new stage or tip group box glows (section 7).
const GLOW_MILLISECONDS = 1200;

// Each end of an arrow stops this far short of the well's center, or a third of the arrow's length
// if that's less (section 6).
const ARROW_END_INSET = 11;

// An arrowhead: a filled triangle this long from tip to base, and this wide at the base (section 6).
const ARROWHEAD_LENGTH = 12;
const ARROWHEAD_WIDTH = 12;

// The Stages column ends this far above the bottom of the window (section 3).
const STAGES_BOTTOM_MARGIN = 12;

// The Span-8 has probes 1 to 8 (a tip change's box offers each; section 10).
const PROBE_COUNT = 8;

// How many color swatches a component's box shows at first (section 8).
const FIRST_COLORS_SHOWN = 10;

// Where the cursor's label sits, from the pointer (section 12).
const CURSOR_LABEL_OFFSET = { x: 14, y: -26 };

// The color of an arrow from an empty well, and of a well's component with no color.
const GRAY = "#9a9a94";

// The layouts of section 3: side by side above 1000px, stacked below.
const wideLayout = window.matchMedia("(min-width: 1001px)");

// With the system's "reduce motion" setting, the column jumps rather than scrolls smoothly.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// --- The page's state (section 4) ---

// The history: a PlanHistory whose states are { plan, open }.
let history;

// The labware that's out (in the editor), by deck name.
const labwareOut = new Set();

// Whether the transfer arrows are shown.
let arrowsShown = true;

// The stages showing their transfer list, by ID.
const expandedStages = new Set();

// The open editing box (section 10), or null: { kind, key, original, draft, element, pencil }.
let editingBox = null;

// The brush (section 8): what's picked ({ kind: "none" }, { kind: "eraser" } or
// { kind: "component", name }) and its typed volume.
const brush = { pick: { kind: "none" }, volume: newTypedVolume(DEFAULT_FILL_VOLUME) };

// The next transfer's typed volume (section 9).
const transferVolume = newTypedVolume(DEFAULT_TRANSFER_VOLUME);

// The source well chosen by clicking, { labware, well }, or null.
let source = null;

// The text box editing something in place, if one is open: a labware's label (section 6) or a
// transfer's volume (section 7): { box, finish }, where finish("away") saves it as a click away
// would. Null when none is open.
let inlineBox = null;

// The transfer whose volume box is open, { stage, position }, or null (section 7). While it's open,
// its transfer stays singled out on the deck whatever the pointer does.
let volumeBoxOpen = null;

// A press on a well that hasn't moved far enough to be a drag: { end, x, y }, or null.
let press = null;

// The drag in progress: { kind: "fill" | "transfer" | "box", from, over }, or null. `over` is the
// well under the pointer now, or null.
let drag = null;

// Where the pointer is while over the labware, { x, y } in window coordinates, or null.
let pointerPosition = null;

// The "+ New" component box while it's open: { text }, or null.
let addingComponent = null;

// What the deck shows now (section 11), and the plates as the open stage starts (for arrow colors).
let shownSnapshot = null;
let stageStartSnapshot = null;

// The wells the open stage mixes (section 6), keyed by wellKey, each as { share, short,
// problemVolume, waiting } (mixedWellsOf). Empty unless a stage with transfers that mixes is open.
// Worked out by refreshDeck, for the badges and the contents card.
let openStageMixedWells = new Map();

// The wells causing a mix problem in a stage before the open one (all stages at End), keyed by
// wellKey, each as { stage, volume }: the first such stage's ID and its mix volume there
// (lastingMixProblemsOf). Their red badges stay on the deck through later stages (section 6).
let lastingMixProblems = new Map();

// Each drawn well's element, by wellKey, so marks and arrows can find them.
const wellElements = new Map();

// The stage and tip group keys drawn last time, for the glow (section 7); null before the first
// drawing, when nothing glows.
let lastDrawnKeys = null;

// When each glow started (performance.now()), by key, so it carries on through redrawing.
const glows = new Map();

// The page's elements that transfer-designer.html gives an id, looked up once.
const elements = {
  experimentHeading: byId("experiment-heading"),
  biomekFiles: byId("biomek-files"),
  biomekBox: byId("biomek-box"),
  biomekSummary: byId("biomek-summary"),
  biomekCancel: byId("biomek-cancel"),
  writeFiles: byId("write-files"),
  save: byId("save"),
  open: byId("open"),
  openFile: byId("open-file"),
  reset: byId("reset"),
  resetBox: byId("reset-box"),
  resetCancel: byId("reset-cancel"),
  resetEverything: byId("reset-everything"),
  workspace: byId("workspace"),
  deckPanel: byId("deck-panel"),
  previousPoint: byId("previous-point"),
  nextPoint: byId("next-point"),
  timelineCaption: byId("timeline-caption"),
  undo: byId("undo"),
  redo: byId("redo"),
  problemCount: byId("problem-count"),
  tray: byId("labware-tray"),
  key: byId("key"),
  componentsBar: byId("components-bar"),
  componentColors: byId("component-colors"),
  arrowsToggle: byId("arrows-toggle"),
  labwareArea: byId("labware-area"),
  noLabwareNote: byId("no-labware-note"),
  arrowLayer: byId("arrow-layer"),
  stagesColumn: byId("stages-column"),
  stagesList: byId("stages-list"),
  messageBar: byId("message-bar"),
  cursorLabel: byId("cursor-label"),
  contentsCard: byId("contents-card"),
};

setUpPage();

// --- Setting up ---

// Brings back the browser copy or starts with an empty plan (section 5), connects every control,
// and draws the page.
function setUpPage() {
  startFromBrowserCopy();
  connectHeader();
  connectDeckBars();
  connectDeck();
  connectKeys();
  connectEditingBoxGuard();
  connectInlineBoxGuard();
  connectHeaderBoxGuard();
  window.addEventListener("scroll", fitStagesColumn);
  window.addEventListener("resize", () => {
    fitStagesColumn();
    drawStageArrows();
  });
  document.addEventListener("scroll", hideContentsCard, true);
  refresh();
}

// Starts the history from the browser copy if there is one that can be read (its labware out, its
// first component picked, its last stage open), otherwise from an empty plan with Start open.
function startFromBrowserCopy() {
  const copy = readBrowserCopy();
  if (copy.status === "ok") {
    history = new PlanHistory({ plan: copy.plan, open: stageOrder(copy.plan).at(-1) });
    bringOutUsedLabware(copy.plan);
    pickFirstComponent(copy.plan);
    showMessage("Brought back the plan you were working on in this browser.", "note");
    return;
  }
  history = new PlanHistory({ plan: emptyPlan().plan, open: START });
  if (copy.status === "failed") {
    showMessage(
      "The plan kept in this browser couldn't be brought back, so here's an empty plan instead. " +
        `(${copy.reason})`,
      "error",
    );
  }
}

// Connects the header's buttons (section 5). The experiment's name is connected when it's drawn.
function connectHeader() {
  elements.biomekFiles.addEventListener("click", toggleBiomekBox);
  elements.biomekCancel.addEventListener("click", closeBiomekBox);
  elements.writeFiles.addEventListener("click", writeBiomekFiles);
  elements.save.addEventListener("click", savePlanFile);
  elements.open.addEventListener("click", () => {
    // Clearing the value first means choosing the same file again still counts as a change.
    elements.openFile.value = "";
    elements.openFile.click();
  });
  elements.openFile.addEventListener("change", openChosenFile);
  elements.reset.addEventListener("click", toggleResetBox);
  elements.resetCancel.addEventListener("click", closeResetBox);
  elements.resetEverything.addEventListener("click", resetEverything);
}

// Connects the deck panel's two bars (sections 6 and 11): the timeline, Undo, Redo and Arrows.
function connectDeckBars() {
  elements.previousPoint.addEventListener("click", () => openNeighbour(-1));
  elements.nextPoint.addEventListener("click", () => openNeighbour(1));
  elements.undo.addEventListener("click", undo);
  elements.redo.addEventListener("click", redo);
  elements.arrowsToggle.addEventListener("click", () => {
    arrowsShown = !arrowsShown;
    elements.arrowsToggle.setAttribute("aria-pressed", String(arrowsShown));
    drawStageArrows();
  });
}

// Connects the labware area's pointer and keyboard actions (sections 8 and 9), the contents card
// and the cursor's label. Moving and releasing are watched on the whole document, so a drag that
// leaves the labware still ends.
function connectDeck() {
  elements.labwareArea.addEventListener("pointerdown", startPress);
  document.addEventListener("pointermove", movePointer);
  document.addEventListener("pointerup", releasePointer);
  document.addEventListener("pointercancel", cancelPress);
  elements.labwareArea.addEventListener("click", clickWellWithKeyboard);
  elements.labwareArea.addEventListener("pointerover", (event) => {
    const wellElement = event.target.closest(".well");
    if (wellElement !== null && drag === null) {
      showContentsCard(wellElement);
    }
  });
  elements.labwareArea.addEventListener("pointerout", (event) => {
    if (event.target.closest(".well") !== null) {
      hideContentsCard();
    }
  });
  elements.labwareArea.addEventListener("pointerleave", () => {
    pointerPosition = null;
    updateCursorLabel();
    drawCursorArrow();
  });
}

// --- History and refreshing ---

// The plan shown now.
function currentPlan() {
  return history.present.plan;
}

// What's open in the Stages column now: START, a stage's ID, or END.
function currentOpen() {
  return history.present.open;
}

// Records an edit of the plan as one undo (section 4), with `open` as what's open afterwards, then
// updates everything.
function recordEdit(plan, open = currentOpen()) {
  history = history.record({ plan, open });
  afterPlanChange();
}

// Called after every change to the plan, including undo and redo: the next volume key starts a new
// number (section 13), the Biomek files box closes, so it never saves files worked out before the
// change (section 5), the browser copy is stored (section 5), and the page is redrawn.
function afterPlanChange() {
  brush.volume.startsNew = true;
  transferVolume.startsNew = true;
  closeBiomekBox();
  storeBrowserCopy();
  refresh();
}

// Opens Start, a stage or End (section 7). It replaces the current state rather than recording one,
// so it isn't an undo of its own (section 4). Closes any editing box and clears any source, since
// both belong to what was open, then scrolls the column to show the opened entry.
function openEntry(key) {
  if (key === currentOpen()) {
    return;
  }
  closeEditingBox();
  source = null;
  history = history.replacePresent({ plan: currentPlan(), open: key });
  refresh();
  scrollIntoColumnView(elements.stagesList.querySelector(`[data-entry="${cssEscape(key)}"]`));
}

// Opens the entry before (`direction` -1) or after (1) the open one, in the order Start, the stages
// in stage order, End (section 11).
function openNeighbour(direction) {
  const entries = allEntries(currentPlan());
  const next = entries[entries.indexOf(currentOpen()) + direction];
  if (next !== undefined) {
    openEntry(next);
  }
}

// Every entry of the Stages column in order: START, the stage IDs in stage order, END.
function allEntries(plan) {
  return [START, ...stageOrder(plan), END];
}

// Undoes the last edit (section 6).
function undo() {
  if (!history.canUndo()) {
    return;
  }
  history = history.undo();
  afterPlanChange();
  showMessage("Undone.", "note");
}

// Redoes the last undone edit (section 6).
function redo() {
  if (!history.canRedo()) {
    return;
  }
  history = history.redo();
  afterPlanChange();
  showMessage("Redone.", "note");
}

// Redraws everything from the current plan and the page's state: the heading, the deck panel, the
// Stages column and the column's fit.
function refresh() {
  const plan = currentPlan();
  // Undo or redo can take the picked component away (e.g. undoing a rename): then, as when a picked
  // component is removed, the first component is picked, or the eraser if there's none.
  if (brush.pick.kind === "component" && !hasComponent(plan, brush.pick.name)) {
    const first = plan.components[0];
    brush.pick = first === undefined ? { kind: "eraser" } : { kind: "component", name: first.name };
  }
  refreshHeading();
  refreshDeck();
  refreshStages();
  keepVolumeBoxTransferHighlighted();
  updateCursorLabel();
  requestAnimationFrame(fitStagesColumn);
}

// Runs `edit`, which returns a new plan, and records it. If the logic refuses, shows its message as
// an error and returns false; otherwise returns the new plan.
function tryEdit(edit) {
  const plan = tryLogic(edit);
  if (plan !== false) {
    recordEdit(plan);
  }
  return plan;
}

// Runs `action` and returns its result. If the logic refuses, shows its message as an error and
// returns false, so the caller changes nothing.
function tryLogic(action) {
  try {
    return action();
  } catch (error) {
    showMessage(error.message, "error");
    return false;
  }
}

// --- The header (section 5) ---

// Saves the plan as a plan file, suggesting the name "transfer plan YYYY-MM-DD.json".
async function savePlanFile() {
  const saved = await saveFile({
    contents: planToText(currentPlan(), SAVED_BY),
    fileName: `transfer plan ${localDate()}.json`,
    type: "application/json",
    description: "Transfer plan",
  });
  if (saved.how === "dialog") {
    showMessage(`Saved the plan as ${saved.name}.`, "ok");
  } else if (saved.how === "downloads") {
    showMessage(`Saved the plan as ${saved.name}, in your downloads.`, "ok");
  }
}

// Today's date by the computer's own clock (not UTC), as YYYY-MM-DD, e.g. "2026-10-26".
function localDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Saves `contents` (text, or bytes as a Uint8Array) as a file called `fileName`: through the
// browser's save dialog where it has one (Edge and Chrome do), otherwise to the downloads. The
// dialog suggests `fileName` and offers files of `type` (a media type, such as "application/zip")
// with `fileName`'s extension, described as `description`. Returns how the file was saved:
// { how: "dialog", name } (the name the user chose), { how: "downloads", name }, or
// { how: "cancelled" } if the user closed the dialog, when nothing was saved.
async function saveFile({ contents, fileName, type, description }) {
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const extension = fileName.slice(fileName.lastIndexOf("."));
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description, accept: { [type]: [extension] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(contents);
      await writable.close();
      return { how: "dialog", name: handle.name };
    } catch (error) {
      // Closing the dialog gives an AbortError: nothing happens. Anything else means the browser
      // refused, and the file goes to the downloads instead.
      if (error.name === "AbortError") {
        return { how: "cancelled" };
      }
    }
  }
  downloadFile(contents, fileName, type);
  return { how: "downloads", name: fileName };
}

// Hands `contents` (text or bytes) to the browser as a file of `type` to download, named
// `fileName`.
function downloadFile(contents, fileName, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// Opens the plan file the user chose: it replaces the plan shown as one undoable edit, or, if it
// can't be opened, shows why and changes nothing.
async function openChosenFile() {
  const file = elements.openFile.files[0];
  if (file === undefined) {
    return;
  }
  const text = await file.text();
  let plan;
  try {
    plan = planFromText(text);
  } catch (error) {
    showMessage(`${file.name}: ${error.message}`, "error");
    return;
  }
  showReplacedPlan(plan, stageOrder(plan).at(-1));
  showMessage(`Opened ${file.name}. Undo brings back the plan you had before.`, "ok");
}

// Replaces the plan shown with `plan` as one undoable edit, with `open` open: brings out exactly the
// labware it uses, closes any editing box, clears any source, and picks its first component.
function showReplacedPlan(plan, open) {
  closeEditingBox();
  source = null;
  addingComponent = null;
  bringOutUsedLabware(plan);
  pickFirstComponent(plan);
  recordEdit(plan, open);
}

// Opens Reset's question under its button, focused on Cancel, or closes it if it's open. Opening
// it closes the Biomek files box.
function toggleResetBox() {
  if (!elements.resetBox.hidden) {
    closeResetBox();
    return;
  }
  closeBiomekBox();
  elements.resetBox.hidden = false;
  elements.reset.setAttribute("aria-expanded", "true");
  elements.resetCancel.focus();
}

// Closes Reset's question.
function closeResetBox() {
  elements.resetBox.hidden = true;
  elements.reset.setAttribute("aria-expanded", "false");
}

// Watches every press on the page: a press outside an open header box (Biomek files' or Reset's)
// closes it, and still does what it would, since the boxes hold nothing the user has done. A press
// on the box's own button is left to the button, which closes the box itself.
function connectHeaderBoxGuard() {
  document.addEventListener("pointerdown", closeHeaderBoxesPressedOutside, true);
}

// One press's share of the guard above.
function closeHeaderBoxesPressedOutside(event) {
  const pressed = (element) => element.contains(event.target);
  if (!elements.biomekBox.hidden && !pressed(elements.biomekBox) && !pressed(elements.biomekFiles)) {
    closeBiomekBox();
  }
  if (!elements.resetBox.hidden && !pressed(elements.resetBox) && !pressed(elements.reset)) {
    closeResetBox();
  }
}

// Replaces the plan with an empty one as one undoable edit, with Start open and all labware put
// away.
function resetEverything() {
  closeResetBox();
  closeEditingBox();
  source = null;
  addingComponent = null;
  labwareOut.clear();
  brush.pick = { kind: "none" };
  recordEdit(emptyPlan().plan, START);
  showMessage(
    "Reset. Bring out the labware you need, then fill wells from the Start card. Undo brings the plan back.",
    "note",
  );
}

// Makes exactly the labware `plan` uses the labware that's out.
function bringOutUsedLabware(plan) {
  labwareOut.clear();
  for (const name of labwareUsed(plan)) {
    labwareOut.add(name);
  }
}

// Picks the plan's first component, or nothing if it has none.
function pickFirstComponent(plan) {
  const first = plan.components[0];
  brush.pick = first === undefined ? { kind: "none" } : { kind: "component", name: first.name };
}

// --- The experiment's name (section 5) ---

// Draws the page's heading: a button showing the experiment's name, or "Name this experiment" with
// none. Left as it is while the name's text box is open, so redrawing doesn't close the box.
function refreshHeading() {
  const heading = elements.experimentHeading;
  if (inlineBox !== null && heading.contains(inlineBox.box)) {
    return;
  }
  heading.replaceChildren(createExperimentNameButton(currentPlan()));
}

// The heading's button: the experiment's name, or, with none, "Name this experiment" (blue, in a
// dashed outline). Clicking it turns it into a text box.
function createExperimentNameButton(plan) {
  const named = plan.experimentName !== "";
  const button = createElement(
    "button",
    named ? plan.experimentName : "Name this experiment",
    named ? "experiment-name" : "experiment-name unnamed",
  );
  button.type = "button";
  button.title = "Click to name the experiment";
  button.addEventListener("click", () => startNamingExperiment(button));
  return button;
}

// Turns the heading into a text box holding the name, selected, checked as it's typed. Enter or
// clicking away saves it with setExperimentName as one undoable edit; an unchanged name saves
// nothing; Escape closes the box without saving. A name that isn't valid isn't saved: after Enter
// the box stays open with what was typed, selected, to fix it; after clicking away it closes,
// leaving the name as it was, with the check's message showing (the inline box guard doesn't pass
// a refused click on, so the message stays in view).
function startNamingExperiment(button) {
  const plan = currentPlan();
  nameCheckMessage = null;
  const box = createInlineEditor({
    value: plan.experimentName,
    className: "experiment-name-box",
    accessibleName: "Experiment name",
    onSave: (text, how) => {
      const named = tryLogic(() => setExperimentName(plan, text));
      if (named === false) {
        if (how === "enter") {
          return "kept-open";
        }
        refreshHeading();
        return "refused";
      }
      if (named === plan) {
        refreshHeading();
        return "closed";
      }
      recordEdit(named);
      if (named.experimentName === "") {
        showMessage("The experiment has no name now.", "note");
      } else {
        showMessage(`Named the experiment ${named.experimentName}.`, "ok");
      }
      return "closed";
    },
    onCancel: refreshHeading,
  });
  box.placeholder = "e.g. Exp36";
  // Names like "Exp36" aren't words, so the browser's spell check would only underline them.
  box.spellcheck = false;
  box.addEventListener("input", () => checkNameAsTyped(box));
  button.replaceWith(box);
  box.focus();
  box.select();
}

// The message the typed check put in the message bar, or null, so it can be taken away once what's
// typed is a valid name again.
let nameCheckMessage = null;

// Checks the name box's text as it's typed (section 5): while it isn't a valid name (and isn't
// blank), the box has a red border and the message bar shows checkExperimentName's message as an
// error. Spaces at the ends don't count. Once it's valid again, that message is taken away.
function checkNameAsTyped(box) {
  const typed = box.value.trim();
  let problem = null;
  if (typed !== "") {
    try {
      checkExperimentName(typed);
    } catch (error) {
      problem = error.message;
    }
  }
  box.classList.toggle("invalid", problem !== null);
  if (problem !== null) {
    showMessage(problem, "error");
    nameCheckMessage = problem;
  } else if (nameCheckMessage !== null) {
    if (elements.messageBar.textContent === nameCheckMessage) {
      hideMessage();
    }
    nameCheckMessage = null;
  }
}

// --- The Biomek files box (section 5) ---

// The run the Biomek files box will write, { folderName, files, now }: the file writer's folder
// name and files, and the moment the box opened, which they're named and dated by. Null while the
// box is closed, or open with a plan the writer refused.
let biomekRun = null;

// Opens the Biomek files box under its button, or closes it if it's open. Opening it closes
// Reset's question, and works out the run's files at once with writeRunFiles, the moment the box
// opens as their timestamp, so the zip's name it shows is the one Write files saves. If the writer
// refuses the plan, its message is shown instead, unchanged, with Write files disabled.
function toggleBiomekBox() {
  if (!elements.biomekBox.hidden) {
    closeBiomekBox();
    return;
  }
  closeResetBox();
  const now = new Date();
  const summary = elements.biomekSummary;
  try {
    const { folderName, files } = writeRunFiles(currentPlan(), now);
    biomekRun = { folderName, files, now };
    summary.classList.remove("refused");
    summary.replaceChildren(
      "This saves",
      createElement("code", `${folderName}.zip`, "zip-name"),
      `holding the folder ${folderName}, with ${describeRunFiles(files)}.`,
    );
    elements.writeFiles.disabled = false;
  } catch (error) {
    biomekRun = null;
    summary.classList.add("refused");
    summary.textContent = error.message;
    elements.writeFiles.disabled = true;
  }
  elements.biomekBox.hidden = false;
  elements.biomekFiles.setAttribute("aria-expanded", "true");
  (biomekRun === null ? elements.biomekCancel : elements.writeFiles).focus();
}

// The run's files, for the box, e.g. "Setup.csv, Stages.csv and 3 Transfer From File files". The
// file writer lists Setup.csv and Stages.csv first, then the Transfer From File files
// (file-writer.md, section 4).
function describeRunFiles(files) {
  const transferFileCount = files.length - 2;
  return `Setup.csv, Stages.csv and ${countOf(transferFileCount, "Transfer From File file")}`;
}

// Closes the Biomek files box, forgetting the run it worked out.
function closeBiomekBox() {
  biomekRun = null;
  elements.biomekBox.hidden = true;
  elements.biomekFiles.setAttribute("aria-expanded", "false");
}

// Write files: builds one zip of the run's files with zipFiles, each under the run's folder, dated
// with the moment the box opened, and saves it through the save dialog where the browser has one,
// otherwise to the downloads; then the box closes. If the user closes the dialog, nothing happens
// and the box stays open.
async function writeBiomekFiles() {
  if (biomekRun === null) {
    return;
  }
  const { folderName, files, now } = biomekRun;
  const entries = files.map((file) => ({ name: `${folderName}/${file.name}`, text: file.text }));
  const bytes = tryLogic(() => zipFiles(entries, now));
  if (bytes === false) {
    return;
  }
  const saved = await saveFile({
    contents: bytes,
    fileName: `${folderName}.zip`,
    type: "application/zip",
    description: "Zip file",
  });
  if (saved.how === "cancelled") {
    return;
  }
  const where = saved.how === "downloads" ? ", in your downloads" : "";
  showMessage(
    `Saved ${saved.name}${where}. Unzip it into ${BASE_FOLDER}, then point the method's setup ` +
      `worklist at ${BASE_FOLDER}${folderName}\\Setup.csv.`,
    "ok",
  );
  closeBiomekBox();
}

// --- The browser copy (section 5) ---

// Stores the plan in the browser's local storage. If the browser has no storage or refuses it, the
// page works without the copy and says nothing.
function storeBrowserCopy() {
  try {
    window.localStorage.setItem(STORAGE_KEY, planToText(currentPlan(), SAVED_BY));
  } catch {
    // No local storage (e.g. a private window), or it's full: the page works without the copy.
  }
}

// Reads the browser copy back: { status: "none" } with no copy or no storage, { status: "ok", plan }
// if it opens, or { status: "failed", reason } with planFromText's message if it doesn't.
function readBrowserCopy() {
  let text;
  try {
    text = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { status: "none" };
  }
  if (text === null) {
    return { status: "none" };
  }
  try {
    return { status: "ok", plan: planFromText(text) };
  } catch (error) {
    return { status: "failed", reason: error.message };
  }
}

// --- The deck panel (sections 6 and 11) ---

// Redraws the deck panel: the timeline, Undo and Redo, the problem count, the tray, the key, the
// component colors, the labware and the arrows, for the point the deck shows.
function refreshDeck() {
  const plan = currentPlan();
  const open = currentOpen();
  shownSnapshot = replay(plan.startingContents, plan.operationList, operationCountShown(plan, open));
  stageStartSnapshot = isStage(plan, open)
    ? replay(plan.startingContents, plan.operationList, operationCountBefore(plan, open))
    : null;
  openStageMixedWells = mixedWellsOf(plan, open);
  lastingMixProblems = lastingMixProblemsOf(plan, open);
  refreshTimeline(plan, open);
  elements.undo.disabled = !history.canUndo();
  elements.redo.disabled = !history.canRedo();
  refreshProblemCount(plan);
  drawTray(plan);
  drawComponentColors(plan);
  drawLabware(plan, open);
  drawKey();
  drawStageArrows();
  drawCursorArrow();
}

// The wells stage `key` mixes, at either end, keyed by wellKey, each as { share, short,
// problemVolume, waiting } (section 6; mix-volumes.md, mixedWells and problems):
// - problemVolume: the mix volume if the well causes a mix problem (the emptiest well of a row whose
//   mix is under MIN_MIX_VOLUME), otherwise null; in more than one row, the first;
// - share and short: its smallest mixed share in the rows without a mix problem at its end, and
//   whether any of those is short; share is null if every row mixing it has one;
// - waiting: true if it's another well of a row with a mix problem at its end, so not mixed until
//   the well in red is fixed.
// Empty for START, END, or a stage without transfers or mixing, e.g. a stage mixing Plate1 A1 at
// 90% → Map { '["Plate1","A1"]' → { share: 90, short: false, problemVolume: null, waiting: false } }.
function mixedWellsOf(plan, key) {
  const mixed = new Map();
  if (!isStage(plan, key) || !stageMixes(plan, key)) {
    return mixed;
  }
  const { stages, problems } = mixVolumes(plan);
  const rows = stages.find((entry) => entry.stage === key)?.rows ?? [];
  // mix-volumes lists the stage's problems in row order, source before destination, so they're
  // taken in turn as the rows' ends under the minimum come up.
  const stageProblems = problems.filter((problem) => problem.stage === key);
  for (const row of rows) {
    for (const end of ["source", "destination"]) {
      const volume = row[`${end}MixVolume`];
      const problem = volume !== null && volume < MIN_MIX_VOLUME ? stageProblems.shift() : null;
      for (const entry of row.mixedWells.filter((mixedWell) => mixedWell.end === end)) {
        addMixedWell(mixed, entry, problem, volume);
      }
    }
  }
  return mixed;
}

// The wells causing a mix problem in a stage before `open` in the stage order, or in any stage when
// End is open, keyed by wellKey, each as { stage, volume }: the first such stage's ID and its mix
// volume there (section 6: a red badge stays from its stage through End). Empty at Start. E.g. with
// stage 1 dispensing 0.05 µL into Plate1 A1 and stage 2 open →
// Map { '["Plate1","A1"]' → { stage: "1", volume: 0 } }.
function lastingMixProblemsOf(plan, open) {
  const lasting = new Map();
  const order = stageOrder(plan);
  const earlier = open === END ? order : order.slice(0, Math.max(order.indexOf(open), 0));
  const withProblem = stagesWithMixProblem(plan);
  for (const stage of earlier.filter((id) => withProblem.has(id))) {
    for (const [key, mixed] of mixedWellsOf(plan, stage)) {
      if (mixed.problemVolume !== null && !lasting.has(key)) {
        lasting.set(key, { stage, volume: mixed.problemVolume });
      }
    }
  }
  return lasting;
}

// Adds one of a row's mixed wells, `entry` (mix-volumes, mixedWells), to `mixed` (as mixedWellsOf
// gives it), where `problem` is the row's mix problem at the well's end, or null, and `volume` the
// row's mix volume there. A well already in `mixed` keeps the first problem volume and the smallest
// share, and is short if any of its mixes is.
function addMixedWell(mixed, entry, problem, volume) {
  const wellKeyText = wellKey(entry);
  const well = mixed.get(wellKeyText) ?? { share: null, short: false, problemVolume: null, waiting: false };
  if (problem === null) {
    well.share = well.share === null ? entry.share : Math.min(well.share, entry.share);
    well.short = well.short || entry.short;
  } else if (problem.labware === entry.labware && problem.well === entry.well) {
    well.problemVolume = well.problemVolume ?? volume;
  } else {
    well.waiting = true;
  }
  mixed.set(wellKeyText, well);
}

// True if stage `id` mixes at either end.
function stageMixes(plan, id) {
  const { settings } = plan.stageList.get(id);
  return settings.sourceMix !== null || settings.destinationMix !== null;
}

// Stage `id`'s stage-worklist rows with their mix volumes and mixed wells (mixVolumes), or none if
// it has no transfers.
function mixRowsOf(plan, id) {
  return mixVolumes(plan).stages.find((entry) => entry.stage === id)?.rows ?? [];
}

// True if `key` is one of the plan's stages (not START or END).
function isStage(plan, key) {
  return plan.stageList.has(key);
}

// How many operations have run at the point the deck shows (section 11): none for Start, all for
// End, and for a stage, those up to the end of the last stage with transfers at or before it.
function operationCountShown(plan, open) {
  if (open === START) {
    return 0;
  }
  if (open === END) {
    return plan.operationList.listOperations().length;
  }
  return transfersDoneUpTo(plan, open, true);
}

// How many operations have run as stage `id` starts: those of the stages with transfers before it.
function operationCountBefore(plan, id) {
  return transfersDoneUpTo(plan, id, false);
}

// How many transfers have run when the stages before `id` in the stage order (and `id` itself,
// if `including`) have run, from stageEnds.
function transfersDoneUpTo(plan, id, including) {
  const order = stageOrder(plan);
  const place = order.indexOf(id);
  let count = 0;
  for (const end of stageEnds(plan)) {
    const endPlace = order.indexOf(end.stage);
    if (endPlace < place || (including && endPlace === place)) {
      count = end.transfersDone;
    }
  }
  return count;
}

// Shows the timeline's caption and whether ‹ and › can go anywhere (section 11).
function refreshTimeline(plan, open) {
  elements.timelineCaption.textContent = timelineCaption(plan, open);
  elements.previousPoint.disabled = open === START;
  elements.nextPoint.disabled = open === END;
}

// The caption for what the deck shows (section 11), e.g. "After stage 2 of 4, “Drugs”".
function timelineCaption(plan, open) {
  if (open === START) {
    return "At the start, before any stage";
  }
  if (open === END) {
    return "At the end, after all stages";
  }
  const order = stageOrder(plan);
  const place = order.indexOf(open) + 1;
  const name = plan.stageList.get(open).name;
  if (transfersIn(plan, open).length > 0) {
    return `After stage ${place} of ${order.length}, “${name}”`;
  }
  return `As stage ${place}, “${name}”, will start (no transfers yet)`;
}

// Shows "No problems" in green or "N problems" in red (section 6): each contents problem in the
// whole plan (a draw into the dead volume, an overdraw or an overfill, including a well that starts
// over its capacity) counts as one, and so does each stage with a mix problem.
function refreshProblemCount(plan) {
  const count =
    replay(plan.startingContents, plan.operationList).listProblems().length +
    stagesWithMixProblem(plan).size;
  elements.problemCount.textContent = count === 0 ? "No problems" : countOf(count, "problem");
  elements.problemCount.classList.toggle("ok", count === 0);
  elements.problemCount.classList.toggle("problems", count > 0);
}

// Draws the labware tray (section 6): a chip per labware, in the groups Used labware and Unused
// labware, each in the deck's order; an empty group is hidden.
function drawTray(plan) {
  const used = new Set(labwareUsed(plan));
  const groups = [
    ["Used labware:", labwareNames().filter((name) => used.has(name))],
    ["Unused labware:", labwareNames().filter((name) => !used.has(name))],
  ];
  elements.tray.replaceChildren(
    ...groups
      .filter(([, names]) => names.length > 0)
      .map(([groupName, names]) => createTrayGroup(plan, groupName, names)),
  );
}

// One group of the tray: its name and a chip per labware.
function createTrayGroup(plan, groupName, names) {
  const group = createElement("div", "", "tray-group");
  group.append(createElement("span", groupName, "tray-group-name"));
  group.append(...names.map((name) => createLabwareChip(plan, name)));
  return group;
}

// A labware's chip: a tiny outline of its shape and its label; pressed while it's out. Clicking
// brings it out or puts it away.
function createLabwareChip(plan, name) {
  const label = labelOf(plan, name);
  const isOut = labwareOut.has(name);
  const chip = createElement("button", "", "labware-chip");
  chip.type = "button";
  chip.dataset.labware = name;
  chip.setAttribute("aria-pressed", String(isOut));
  chip.title = isOut ? `Put away ${label}` : `Bring out ${label}`;
  const shape = createElement("span", "", `chip-shape ${isReservoir(name) ? "reservoir" : "plate"}`);
  chip.append(shape, createElement("span", label));
  chip.addEventListener("click", () => toggleLabwareOut(name));
  return chip;
}

// Brings a labware out, or puts it away. Putting labware away clears a source chosen on it.
function toggleLabwareOut(name) {
  if (labwareOut.has(name)) {
    labwareOut.delete(name);
    if (source !== null && source.labware === name) {
      source = null;
    }
  } else {
    labwareOut.add(name);
  }
  refreshDeck();
  updateCursorLabel();
  requestAnimationFrame(fitStagesColumn);
}

// True if the labware's grid names its wells by number: a reservoir, drawn as troughs.
function isReservoir(name) {
  return gridOf(name).naming === "number";
}

// Draws the component colors in the third bar: each component's swatch and name, in the plan's
// order (section 6). The bar is hidden while the plan has no components.
function drawComponentColors(plan) {
  elements.componentsBar.hidden = plan.components.length === 0;
  elements.componentColors.replaceChildren(
    ...plan.components.map((component) => {
      const item = document.createElement("li");
      item.append(createSwatch(component.color), createElement("span", component.name));
      return item;
    }),
  );
}

// Draws the key (section 6): only the marks on the deck now, Overdraw, Overfill, Only dead volume,
// Off plan and Mix problem, in that order; hidden with none. Called after the wells are drawn and
// marked.
function drawKey() {
  const items = [];
  if (elements.labwareArea.querySelector(".well.overdraw") !== null) {
    items.push(createKeyItem("overdraw", "Overdraw"));
  }
  if (elements.labwareArea.querySelector(".well.overfill") !== null) {
    items.push(createKeyItem("overfill", "Overfill"));
  }
  if (elements.labwareArea.querySelector(".well.dead-volume-only") !== null) {
    items.push(createKeyItem("dead-volume-only", "Only dead volume"));
  }
  if (elements.labwareArea.querySelector(".well.off-plan:not(.overdraw):not(.overfill)") !== null) {
    items.push(createKeyItem("off-plan", "Off plan"));
  }
  if (elements.labwareArea.querySelector(".mix-badge.problem") !== null) {
    items.push(createMixProblemKeyItem());
  }
  elements.key.replaceChildren(...items);
}

// One item of the key: an example well, drawn as the wells with `mark` ("overdraw", "overfill",
// "dead-volume-only" or "off-plan") are on the deck, and the mark's name.
function createKeyItem(mark, name) {
  const item = document.createElement("li");
  // The overfill example gets its class from markOverfill, with its bar; markOverfill skips a well
  // that already has the class.
  const example = createElement("span", "", mark === "overfill" ? "key-well" : `key-well ${mark}`);
  if (mark === "overfill") {
    markOverfill(example);
  }
  item.append(example, createElement("span", name));
  return item;
}

// The key's Mix problem item: a red ⟳ badge, drawn as on the deck but in the line, and its name.
function createMixProblemKeyItem() {
  const item = document.createElement("li");
  const badge = createElement("span", "⟳", "mix-badge problem key-badge");
  badge.setAttribute("aria-hidden", "true");
  item.append(badge, createElement("span", "Mix problem"));
  return item;
}

// Draws the labware that's out, one block each in the deck's order, with each well showing what it
// holds at the point the deck shows, and the marks on the wells.
function drawLabware(plan, open) {
  wellElements.clear();
  const blocks = labwareNames()
    .filter((name) => labwareOut.has(name))
    .map((name) => createLabwareBlock(plan, name));
  elements.labwareArea.replaceChildren(elements.noLabwareNote, ...blocks);
  markWells(plan, open);
}

// One labware's block: its heading (the label, the deck name and the labware type) and its grid.
// The grid's rows and columns are set on the block, which sizes itself from them (section 6: a
// block is never narrower than its grid).
function createLabwareBlock(plan, name) {
  const block = createElement("div", "", "labware");
  block.dataset.labware = name;
  const grid = gridOf(name);
  block.style.setProperty("--rows", String(grid.rows));
  block.style.setProperty("--columns", String(grid.columns));
  const heading = createElement("div", "", "labware-heading");
  const labelButton = createElement("button", labelOf(plan, name), "label-button");
  labelButton.type = "button";
  labelButton.title = "Click to rename";
  labelButton.addEventListener("click", () => startRenamingLabware(labelButton, name));
  heading.append(labelButton, createElement("span", `${name} · ${labwareTypeOf(name)}`, "labware-type"));
  const scroll = createElement("div", "", "labware-scroll");
  scroll.append(createGrid(plan, name));
  // Arrows follow the wells when a wide labware is scrolled sideways.
  scroll.addEventListener("scroll", drawStageArrows);
  block.append(heading, scroll);
  return block;
}

// Turns a labware's label into a text box holding the label, selected. Enter or clicking away saves
// it with setLabel; Escape cancels; an unchanged label saves nothing. A click away still does what
// it would (the inline box guard passes it on), unless setLabel refused the label.
function startRenamingLabware(labelButton, name) {
  const plan = currentPlan();
  const box = createInlineEditor({
    value: labelOf(plan, name),
    className: "label-box",
    accessibleName: `Label for ${name}`,
    onSave: (text) => {
      const renamed = tryLogic(() => setLabel(plan, name, text));
      // A refused label's message is shown and the label stays as it was.
      if (renamed === false) {
        refreshDeck();
        return "refused";
      }
      // An unchanged label gives the same plan back, and saves nothing.
      if (renamed === plan) {
        refreshDeck();
        return "closed";
      }
      recordEdit(renamed);
      showMessage(`Renamed ${name} to ${labelOf(renamed, name)}.`, "ok");
      return "closed";
    },
    onCancel: refreshDeck,
  });
  labelButton.replaceWith(box);
  box.focus();
  box.select();
}

// A labware's grid of wells, with its headings: for a plate, column numbers above and row letters
// at the left; for a reservoir, its trough numbers above and the left column empty, so it's the same
// size as a plate. The headings take the grid's first row and first column, so each well sits one
// row and one column further than its position.
function createGrid(plan, name) {
  const grid = gridOf(name);
  const reservoir = isReservoir(name);
  const gridElement = createElement("div", "", `well-grid ${reservoir ? "reservoir" : "plate"}`);
  addGridHeadings(gridElement, grid, reservoir);
  for (const well of grid.wellNames()) {
    const { row, column } = grid.wellPosition(well);
    const wellElement = createWell(plan, { labware: name, well }, reservoir);
    wellElement.style.gridRow = String(row + 1);
    wellElement.style.gridColumn = String(column + 1);
    gridElement.append(wellElement);
  }
  return gridElement;
}

// Adds the column numbers across the top and, for a plate (not a reservoir, whose troughs are
// numbered by column), the row letters down the side.
function addGridHeadings(gridElement, grid, isReservoir) {
  for (let column = 1; column <= grid.columns; column++) {
    gridElement.append(createGridHeading(String(column), 1, column + 1));
  }
  if (isReservoir) {
    return;
  }
  for (let row = 1; row <= grid.rows; row++) {
    // Well names are one row letter then the column number, so the first character of the row's
    // first well is its letter.
    gridElement.append(createGridHeading(grid.wellNameAt(row, 1).charAt(0), row + 1, 1));
  }
}

// A row letter or column number at the edge of a plate, placed in the grid.
function createGridHeading(text, gridRow, gridColumn) {
  const heading = createElement("div", text, "grid-heading");
  heading.setAttribute("aria-hidden", "true");
  heading.style.gridRow = String(gridRow);
  heading.style.gridColumn = String(gridColumn);
  return heading;
}

// One well: a button (so it can be reached with Tab and pressed with Enter or Space) showing what
// the well holds at the point the deck shows: its name if empty, otherwise its components' colors
// in proportion and its total volume in short form, under stripes when all of it is dead volume
// (section 6).
function createWell(plan, end, isTrough) {
  const wellElement = createElement("button", "", "well");
  wellElement.type = "button";
  wellElement.classList.toggle("trough", isTrough);
  wellElement.dataset.labware = end.labware;
  wellElement.dataset.well = end.well;
  const components = shownSnapshot.componentsOf(end.labware, end.well);
  const total = shownSnapshot.totalVolumeOf(end.labware, end.well);
  const label = createElement("span", "", "well-label");
  if (total === 0) {
    label.textContent = end.well;
    wellElement.setAttribute("aria-label", `${wellName(plan, end)}, empty`);
  } else {
    label.textContent = formatShortVolume(total);
    wellElement.classList.add("holding");
    wellElement.style.setProperty("--well-fill", fillGradient(plan, components, isTrough));
    let name = `${wellName(plan, end)}, ${formatVolume(total)} µL`;
    // Holding only dead volume: a tip can reach none of it, so it's drawn under stripes.
    if (shownSnapshot.usableVolumeOf(end.labware, end.well) === 0) {
      wellElement.classList.add("dead-volume-only");
      name += ", all dead volume";
    }
    wellElement.setAttribute("aria-label", name);
  }
  wellElement.append(label);
  const mixed = openStageMixedWells.get(wellKey(end));
  const lastingProblem = lastingMixProblems.get(wellKey(end));
  if (mixed !== undefined) {
    addMixBadge(wellElement, mixed, lastingProblem !== undefined);
  } else if (lastingProblem !== undefined) {
    addLastingMixBadge(wellElement, plan, lastingProblem);
  }
  wellElements.set(wellKey(end), wellElement);
  return wellElement;
}

// Gives a well the open stage mixes its ⟳ badge at its top right, and adds how it's mixed to its
// accessible name (section 6): red if it causes a mix problem ("…, holds too little to mix");
// otherwise yellow when a mix is short and blue if not ("Assay plate A1, 120 µL, mixed 17%"); blue
// for another well of a row with a mix problem ("…, not mixed until the well in red is fixed").
// `mixed` is the well's entry from mixedWellsOf; `earlierProblem` is true if the well caused a mix
// problem in an earlier stage, so its badge stays red whatever the open stage does.
function addMixBadge(wellElement, mixed, earlierProblem) {
  wellElement.classList.add("mixed");
  const badge = createElement("span", "⟳", "mix-badge");
  const causesProblem = mixed.problemVolume !== null || earlierProblem;
  badge.classList.toggle("problem", causesProblem);
  badge.classList.toggle("short", !causesProblem && mixed.short);
  // The accessible name says it in words, so the symbol itself is hidden from screen readers.
  badge.setAttribute("aria-hidden", "true");
  wellElement.append(badge);
  const name = wellElement.getAttribute("aria-label");
  wellElement.setAttribute("aria-label", `${name}, ${mixedWords(mixed)}`);
}

// Gives a well that caused a mix problem in an earlier stage (and isn't mixed in the open one) its
// red ⟳ badge, which stays from that stage through End (section 6), and says so in its accessible
// name, e.g. "Assay plate A1, empty, can't be mixed in stage 1, “Tiny dispense”". `lastingProblem`
// is the well's entry from lastingMixProblemsOf.
function addLastingMixBadge(wellElement, plan, lastingProblem) {
  wellElement.classList.add("mixed");
  const badge = createElement("span", "⟳", "mix-badge problem");
  badge.setAttribute("aria-hidden", "true");
  wellElement.append(badge);
  const name = wellElement.getAttribute("aria-label");
  wellElement.setAttribute("aria-label", `${name}, can't be mixed in ${stageLabel(plan, lastingProblem.stage)}`);
}

// How a well the open stage mixes is mixed, in words for its accessible name, from its entry in
// mixedWellsOf, e.g. "mixed 17%", "holds too little to mix" or "not mixed until the well in red is
// fixed".
function mixedWords(mixed) {
  if (mixed.problemVolume !== null) {
    return "holds too little to mix";
  }
  if (mixed.share !== null) {
    return `mixed ${mixedPercent(mixed.share)}%`;
  }
  return "not mixed until the well in red is fixed";
}

// A mixed share as a whole percent, rounded down, so a short mix never reads as the limit
// (section 6), e.g. mixedPercent(39.99) → 39.
function mixedPercent(share) {
  return Math.floor(share);
}

// The CSS gradient filling a well with its components' colors in proportion, in the order the
// components are listed in the well: a pie for a plate well, bands from the bottom up for a trough.
function fillGradient(plan, components, isTrough) {
  const total = Object.values(components).reduce((sum, volume) => sum + volume, 0);
  const stops = [];
  let soFar = 0;
  for (const [name, volume] of Object.entries(components)) {
    const from = (soFar / total) * 100;
    soFar += volume;
    const to = (soFar / total) * 100;
    stops.push(`${componentColor(plan, name)} ${from}% ${to}%`);
  }
  return isTrough ? `linear-gradient(to top, ${stops.join(", ")})` : `conic-gradient(${stops.join(", ")})`;
}

// Gives a well (or the key's example well) the overfill mark (section 6): the class, and the red bar
// behind its label as an element of its own, since the overdraw X uses the well's pseudo-elements
// and a well can show both. A well overfilled more than once gets one bar.
function markOverfill(wellElement) {
  if (!wellElement.classList.contains("overfill")) {
    wellElement.classList.add("overfill");
    const bar = createElement("span", "", "overfill-bar");
    bar.setAttribute("aria-hidden", "true");
    wellElement.prepend(bar);
  }
}

// Puts the marks on the wells (section 6): overdraw (a "dead-volume" or "overdraw" problem),
// overfill and off plan from the shown contents, the open stage's untouched wells faded, and the
// chosen source outlined.
function markWells(plan, open) {
  for (const problem of shownSnapshot.listProblems()) {
    const wellElement = wellElements.get(wellKey(problem));
    if (wellElement !== undefined) {
      if (problem.kind === "overfill") {
        markOverfill(wellElement);
      } else {
        wellElement.classList.add("overdraw");
      }
    }
  }
  for (const affected of shownSnapshot.listAffected()) {
    wellElements.get(wellKey(affected))?.classList.add("off-plan");
  }
  const transfers = isStage(plan, open) ? transfersIn(plan, open) : [];
  if (transfers.length > 0) {
    const touched = new Set(transfers.flatMap((transfer) => [wellKey(transfer.source), wellKey(transfer.destination)]));
    for (const [key, wellElement] of wellElements) {
      wellElement.classList.toggle("faded", !touched.has(key));
    }
  }
  if (source !== null) {
    wellElements.get(wellKey(source))?.classList.add("source");
  }
}

// --- Arrows (section 6) ---

// Draws the open stage's transfers as arrows from source to destination, in the color of the
// source's main component as the stage starts (gray if empty then), while Arrows is on.
function drawStageArrows() {
  const plan = currentPlan();
  const open = currentOpen();
  const layer = arrowGroup("stage-arrows");
  layer.replaceChildren();
  if (!arrowsShown || !isStage(plan, open)) {
    return;
  }
  for (const transfer of transfersIn(plan, open)) {
    if (wellKey(transfer.source) === wellKey(transfer.destination)) {
      continue;
    }
    const from = arrowEndpoint(transfer.source);
    const to = arrowEndpoint(transfer.destination);
    if (from === null || to === null) {
      continue;
    }
    const color = mainComponentColor(plan, stageStartSnapshot, transfer.source);
    const arrow = createArrow(from, to, color, { insetEnd: true, dashed: false });
    arrow.dataset.position = String(transfer.position);
    layer.append(arrow);
  }
  keepVolumeBoxTransferHighlighted();
}

// Draws the dashed arrow that follows the cursor from the chosen source, or from the well a transfer
// drag started on, in the color of what that well holds now (section 9); nothing otherwise.
function drawCursorArrow() {
  const layer = arrowGroup("cursor-arrow");
  layer.replaceChildren();
  const from = source ?? (drag !== null && drag.kind === "transfer" ? drag.from : null);
  if (from === null || pointerPosition === null || currentOpen() === END) {
    return;
  }
  const start = arrowEndpoint(from);
  if (start === null) {
    return;
  }
  const panel = elements.deckPanel.getBoundingClientRect();
  const end = { x: pointerPosition.x - panel.left, y: pointerPosition.y - panel.top };
  const color = mainComponentColor(currentPlan(), shownSnapshot, from);
  layer.append(createArrow(start, end, color, { insetEnd: false, dashed: true }));
}

// The SVG group with this id inside the arrow layer, created the first time it's needed.
function arrowGroup(id) {
  let group = elements.arrowLayer.querySelector(`#${id}`);
  if (group === null) {
    group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.id = id;
    elements.arrowLayer.append(group);
  }
  return group;
}

// Where an arrow's end goes for a well, in the deck panel's coordinates: the well's center if its
// labware is out, otherwise its labware's chip in the tray; null if neither is drawn.
function arrowEndpoint(end) {
  const element =
    wellElements.get(wellKey(end)) ??
    elements.tray.querySelector(`[data-labware="${cssEscape(end.labware)}"]`);
  if (element === null || element === undefined) {
    return null;
  }
  const panel = elements.deckPanel.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2 - panel.left, y: rect.top + rect.height / 2 - panel.top };
}

// The color of the component a well holds most of in `snapshot`, or gray if it's empty.
function mainComponentColor(plan, snapshot, end) {
  const components = Object.entries(snapshot.componentsOf(end.labware, end.well));
  if (components.length === 0) {
    return GRAY;
  }
  const [name] = components.reduce((most, entry) => (entry[1] > most[1] ? entry : most));
  return componentColor(plan, name);
}

// One arrow from `from` to `to` (points in the deck panel's coordinates): a 2px line and a filled
// triangular head, ARROWHEAD_LENGTH from tip to base and ARROWHEAD_WIDTH wide. Each end is pulled
// in by ARROW_END_INSET, or a third of the length if that's less; with insetEnd false, only the
// start is, so a cursor arrow ends at the pointer.
function createArrow(from, to, color, { insetEnd, dashed }) {
  const svg = "http://www.w3.org/2000/svg";
  const group = document.createElementNS(svg, "g");
  group.classList.add("arrow");
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return group;
  }
  const unit = { x: dx / length, y: dy / length };
  const inset = Math.min(ARROW_END_INSET, length / 3);
  const start = { x: from.x + unit.x * inset, y: from.y + unit.y * inset };
  const end = insetEnd ? { x: to.x - unit.x * inset, y: to.y - unit.y * inset } : to;

  // The line runs to the head's base (a little inside it, so no gap shows between them).
  const base = { x: end.x - unit.x * ARROWHEAD_LENGTH, y: end.y - unit.y * ARROWHEAD_LENGTH };
  const line = document.createElementNS(svg, "line");
  line.setAttribute("x1", start.x);
  line.setAttribute("y1", start.y);
  line.setAttribute("x2", base.x + unit.x * 2);
  line.setAttribute("y2", base.y + unit.y * 2);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", "2");
  if (dashed) {
    line.setAttribute("stroke-dasharray", "5 4");
  }
  const head = document.createElementNS(svg, "polygon");
  const side = { x: (-unit.y * ARROWHEAD_WIDTH) / 2, y: (unit.x * ARROWHEAD_WIDTH) / 2 };
  head.setAttribute(
    "points",
    `${end.x},${end.y} ${base.x + side.x},${base.y + side.y} ${base.x - side.x},${base.y - side.y}`,
  );
  head.setAttribute("fill", color);
  group.append(line, head);
  return group;
}

// --- The Stages column (section 7) ---

// Redraws the Stages column from the plan: Start, the tip group boxes with their stages, End, and
// the open editing box.
function refreshStages() {
  const plan = currentPlan();
  const open = currentOpen();
  const problems = stageProblems(plan);
  const groups = tipGroups(plan);
  const drawnKeys = new Set();
  const items = [createEntry(plan, START, open, problems)];
  groups.forEach((group, index) => {
    items.push(createTipGroupBox(plan, group, index, groups[index + 1], open, problems, drawnKeys));
  });
  items.push(createEntry(plan, END, open, problems));
  elements.stagesList.replaceChildren(...items);
  lastDrawnKeys = drawnKeys;
  placeEditingBox();
  // The box for a new component's name keeps the keyboard focus while it's open (section 8).
  elements.stagesList.querySelector(".new-component-box")?.focus();
}

// The stages with a problem (section 7), as { overdrawn, mixProblem }: two Sets of stage IDs, from
// stagesWithContentsProblem (a contents problem of any kind) and stagesWithMixProblem.
function stageProblems(plan) {
  return { overdrawn: stagesWithContentsProblem(plan), mixProblem: stagesWithMixProblem(plan) };
}

// Start, a stage or End as a row (closed) or a card (open), sharing one look: a number in a badge, a
// name and a count; a card adds its contents, and a stage's card its ✎ after the name. A mix step has
// a ⟳ after its name. A stage with
// a problem (`problems`, from stageProblems) is marked, with a tooltip saying which; one with both a
// contents problem and a mix problem has the contents problem's tooltip.
function createEntry(plan, key, open, problems) {
  const isOpen = key === open;
  const entry = createElement("div", "", "entry");
  entry.dataset.entry = key;
  entry.classList.toggle("is-open", isOpen);
  const { badge, name, count } = entryHeading(plan, key);
  if (isStage(plan, key) && problems.overdrawn.has(key)) {
    entry.classList.add("has-overdraw");
    entry.title =
      "This stage has a problem: a transfer asks a well for more than it holds above its dead " +
      "volume, or fills a well over its capacity.";
  } else if (isStage(plan, key) && problems.mixProblem.has(key)) {
    // A mix problem looks the same as a contents problem (Andy, 2026-10-30), with its own tooltip.
    entry.classList.add("has-overdraw");
    entry.title =
      `This stage mixes a well that holds too little: the mix is under ${formatVolume(MIN_MIX_VOLUME)} µL.`;
  }
  const row = createElement(isOpen ? "div" : "button", "", "entry-row");
  if (!isOpen) {
    row.type = "button";
    row.addEventListener("click", () => openEntry(key));
  }
  row.append(createElement("span", badge, "entry-badge"), createElement("span", name, "entry-name"));
  // A mix step has a gray ⟳ after its name (section 7), so the names line up.
  if (isStage(plan, key) && isMixStep(plan, key)) {
    row.classList.add("with-mix-mark");
    const mark = createElement("span", "⟳", "mix-step-mark");
    mark.title = "Mix step";
    row.append(mark);
  }
  // An open stage's ✎ sits just after its name, so its editing box floats under the heading
  // (section 10); the count stays at the right.
  if (isOpen && isStage(plan, key)) {
    row.classList.add("with-pencil");
    row.append(createPencil("stage", key, `Edit stage ${stageOrder(plan).indexOf(key) + 1}`));
  }
  row.append(createElement("span", count, "entry-count"));
  entry.append(row);
  if (isOpen) {
    entry.append(createEntryBody(plan, key));
  }
  return entry;
}

// The badge, name and count of an entry: Start ("0", "N wells filled"), a stage (its place, "N
// transfers"), a mix step (its place, "N wells mixed") or End ("✓", "N transfers done").
function entryHeading(plan, key) {
  if (key === START) {
    return { badge: "0", name: "Start", count: `${countOf(plan.startingContents.length, "well")} filled` };
  }
  if (key === END) {
    return { badge: "✓", name: "End", count: `${countOf(transfersDone(plan), "transfer")} done` };
  }
  const count = transfersIn(plan, key).length;
  return {
    badge: String(stageOrder(plan).indexOf(key) + 1),
    name: plan.stageList.get(key).name,
    count: isMixStep(plan, key) ? `${countOf(count, "well")} mixed` : countOf(count, "transfer"),
  };
}

// How many transfers the plan's transfer stages hold, for End's count (section 7): a mix step's
// mixed wells aren't counted, since they move no liquid (Andy, 2026-10-30).
function transfersDone(plan) {
  return stageOrder(plan)
    .filter((id) => !isMixStep(plan, id))
    .reduce((total, id) => total + transfersIn(plan, id).length, 0);
}

// An open card's contents: the palette for Start, the settings and transfers for a stage, the mixed
// wells for a mix step, a note for End.
function createEntryBody(plan, key) {
  const body = createElement("div", "", "entry-body");
  if (key === START) {
    body.append(
      createElement("p", "Pick what to fill wells with, then click or drag across wells on the deck.", "note"),
      createPalette(plan),
      createBrushLine(plan),
    );
  } else if (key === END) {
    body.append(
      createElement(
        "p",
        "The deck shows the plates after every stage has run. Open a stage to add or change transfers.",
        "note",
      ),
    );
  } else if (isMixStep(plan, key)) {
    // A mix step's card has no settings line: the ⟳ after its name says what it is (section 7).
    body.append(...createMixedWellSection(plan, key));
  } else {
    body.append(createSettingsLine(plan, key), ...createTransferSection(plan, key));
  }
  return body;
}

// A stage card's settings in one line, e.g. "↑ Slow ⟳   ↓ Non-Contact": each end's mode, with ⟳
// after it if that end mixes; the two ends 18px apart, wrapping onto two lines if the card is narrow.
// No probe count: a stage uses all its tips' probes, and the tip group's heading counts them
// (section 7). (The ✎ that opens the stage's editing box is in the card's heading, beside its name.)
function createSettingsLine(plan, id) {
  const settings = plan.stageList.get(id).settings;
  const ends = [
    { arrow: "↑", word: "aspirate", end: "source" },
    { arrow: "↓", word: "dispense", end: "destination" },
  ].map(({ arrow, word, end }) => {
    const mode = modeOf(end, settings) ?? "custom";
    const mixes = settings[`${end}Mix`] !== null;
    return {
      text: `${arrow} ${mode}${mixes ? " ⟳" : ""}`,
      spoken: `${word} ${mode}${mixes ? ", mixing" : ""}`,
    };
  });
  const line = createElement("div", "", "settings-line");
  const text = createElement("span", "", "settings-ends");
  text.append(...ends.map((end) => createElement("span", end.text, "settings-end")));
  // Read as words, e.g. "aspirate Slow, mixing, dispense Non-Contact", in place of the arrows and ⟳.
  text.setAttribute("aria-label", ends.map((end) => end.spoken).join(", "));
  line.append(text);
  return line;
}

// A stage card's transfers: a note with none; otherwise Show transfers / Hide transfers and, when
// shown, the transfer list.
function createTransferSection(plan, id) {
  const transfers = transfersIn(plan, id);
  if (transfers.length === 0) {
    return [createElement("p", "No transfers yet. Add some on the deck.", "note")];
  }
  const toggle = createListToggle(id, "transfers");
  const shown = expandedStages.has(id);
  return shown ? [toggle, createTransferList(plan, id, transfers)] : [toggle];
}

// The button that shows or hides an open stage's list, "Show transfers ▸" / "Hide transfers ▾" (or
// "wells" for a mix step, given as `what`). Each stage remembers whether its list is shown, while
// the page is open; showing it scrolls the column to show the whole card (section 7).
function createListToggle(id, what) {
  const shown = expandedStages.has(id);
  const toggle = createElement("button", shown ? `Hide ${what} ▾` : `Show ${what} ▸`, "toggle-list");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", String(shown));
  toggle.addEventListener("click", () => {
    if (shown) {
      expandedStages.delete(id);
      refreshStages();
      return;
    }
    expandedStages.add(id);
    refreshStages();
    // Showing the list scrolls the column to show the whole card; hiding it doesn't scroll.
    scrollCardIntoView(elements.stagesList.querySelector(`[data-entry="${cssEscape(id)}"]`));
  });
  return toggle;
}

// A mix step card's wells (section 7): a note with none; otherwise Show wells / Hide wells and,
// when shown, a row per mixed well.
function createMixedWellSection(plan, id) {
  const mixedWells = transfersIn(plan, id);
  if (mixedWells.length === 0) {
    return [createElement("p", "No wells mixed yet. Click or drag across wells on the deck.", "note")];
  }
  const toggle = createListToggle(id, "wells");
  if (!expandedStages.has(id)) {
    return [toggle];
  }
  const howMixed = mixedWellsOf(plan, id);
  const list = createElement("ul", "", "transfer-list");
  list.append(...mixedWells.map((transfer) => createMixedWellRow(plan, id, transfer, howMixed)));
  return [toggle, list];
}

// One mixed well's row (section 7), e.g. "⟳ Plate1 A2", then how much of the well is mixed,
// "33% of well" ("too little" in red for the well causing a mix problem, "–" for the other wells of
// that row), and × at the right, which stops mixing it. Pointing at the row singles its well out on
// the deck, as for a transfer. `howMixed` is the mix step's wells from mixedWellsOf.
function createMixedWellRow(plan, id, transfer, howMixed) {
  const row = createElement("li", "", "transfer-row mixed-well-row");
  row.dataset.position = String(transfer.position);
  const name = wellName(plan, transfer.source);
  const mixed = howMixed.get(wellKey(transfer.source));
  const share = createElement("span", mixedShareText(mixed), "mixed-share");
  share.classList.toggle("problem", mixed !== undefined && mixed.problemVolume !== null);
  const remove = createElement("button", "×", "remove-transfer");
  remove.type = "button";
  remove.setAttribute("aria-label", `Stop mixing ${name}`);
  remove.addEventListener("click", () => {
    highlightTransfer(null);
    if (tryEdit(() => unmixWell(plan, id, transfer.source)) !== false) {
      showMessage(`Stopped mixing ${name}.`, "note");
    }
  });
  row.append(createElement("span", `⟳ ${name}`, "transfer-text"), share, remove);
  row.addEventListener("pointerenter", () => highlightTransfer(transfer.position));
  row.addEventListener("pointerleave", () => highlightTransfer(null));
  return row;
}

// How much of a mixed well is mixed, for its row in a mix step's card (section 7), from its entry in
// mixedWellsOf: "33% of well" (its mixed share, rounded down), "too little" for the well causing a
// mix problem, or "–" for the other wells of that row.
function mixedShareText(mixed) {
  if (mixed === undefined) {
    return "–";
  }
  if (mixed.problemVolume !== null) {
    return "too little";
  }
  return mixed.share === null ? "–" : `${mixedPercent(mixed.share)}% of well`;
}

// The open stage's transfer list: one row per transfer.
function createTransferList(plan, id, transfers) {
  const problems = transferProblems(plan);
  const list = createElement("ul", "", "transfer-list");
  list.append(...transfers.map((transfer) => createTransferRow(plan, id, transfer, problems.get(transfer.position))));
  return list;
}

// Each transfer's own contents problem over the whole run (`contents-tracking.md`), keyed by its
// position in the operation list: the first problem if it has two (section 7). Problems of the
// starting contents name no transfer, so they're left out.
function transferProblems(plan) {
  const problems = new Map();
  for (const problem of replay(plan.startingContents, plan.operationList).listProblems()) {
    if (problem.operationIndex !== null && !problems.has(problem.operationIndex)) {
      problems.set(problem.operationIndex, problem);
    }
  }
  return problems;
}

// One transfer's row, e.g. "Assay plate A1 → Drug plate B2", then "20 µL" and × at the right. Its
// volume is a button that becomes a text box; pointing at the row singles its transfer out on the deck,
// unless a volume box is open, whose transfer stays singled out until it closes. `problem` is the
// transfer's contents problem, if it has one: its volume is then red and semibold, with a tooltip
// saying what's reachable or by how much it overfills (section 7).
function createTransferRow(plan, id, transfer, problem) {
  const row = createElement("li", "", "transfer-row");
  row.dataset.position = String(transfer.position);
  const route = `${wellName(plan, transfer.source)} → ${wellName(plan, transfer.destination)}`;
  const volumeButton = createElement("button", `${formatVolume(transfer.volume)} µL`, "volume-button");
  volumeButton.type = "button";
  volumeButton.setAttribute("aria-label", `Volume of ${route}, ${formatVolume(transfer.volume)} µL. Click to change`);
  volumeButton.addEventListener("click", () => startEditingVolume(volumeButton, id, transfer));
  if (problem !== undefined) {
    volumeButton.classList.add("problem");
    volumeButton.title = describeRowProblem(problem);
  }
  const remove = createElement("button", "×", "remove-transfer");
  remove.type = "button";
  remove.setAttribute("aria-label", `Remove ${route}`);
  remove.addEventListener("click", () => {
    highlightTransfer(null);
    if (tryEdit(() => removeTransfer(plan, transfer.position)) !== false) {
      showMessage(`Removed ${route} from ${stageLabel(plan, id)}.`, "note");
    }
  });
  row.append(createElement("span", route, "transfer-text"), volumeButton, remove);
  row.addEventListener("pointerenter", () => {
    if (volumeBoxOpen === null) {
      highlightTransfer(transfer.position);
    }
  });
  row.addEventListener("pointerleave", () => {
    if (volumeBoxOpen === null) {
      highlightTransfer(null);
    }
  });
  return row;
}

// The tooltip of a problem transfer's volume (section 7): "Only 450 µL is reachable." for a draw
// into the dead volume or an overdraw (the problem's `available`), or "Overfills the well by 20 µL."
// for an overfill (`held` minus `capacity`).
function describeRowProblem(problem) {
  if (isDrawProblem(problem)) {
    return `Only ${formatVolume(problem.available)} µL is reachable.`;
  }
  return `Overfills the well by ${formatVolume(problem.held - problem.capacity)} µL.`;
}

// Turns a transfer's volume into a text box holding the volume, selected, and singles the transfer
// out on the deck while the box is open (section 7). Enter saves and opens the next transfer's
// volume box in the stage; clicking away saves and closes; Escape cancels.
function startEditingVolume(volumeButton, stage, transfer) {
  const plan = currentPlan();
  const shown = formatVolume(transfer.volume);
  volumeBoxOpen = { stage, position: transfer.position };
  const box = createInlineEditor({
    value: shown,
    className: "volume-box",
    accessibleName: "Volume in µL",
    onSave: (text, how) => saveVolume(plan, stage, transfer, shown, text.trim(), how),
    onCancel: closeVolumeBox,
  });
  volumeButton.replaceWith(box);
  box.focus();
  box.select();
  highlightTransfer(transfer.position);
}

// Saves a volume box's text for `transfer` (section 7): an unchanged volume (`shown` is the volume
// as the box showed it) saves nothing; otherwise changeVolume. Then Enter (`how` "enter") opens the
// next transfer's volume box in the stage, and a click away ("away") just closes. Returns what
// became of the box, as createInlineEditor's onSave does: "closed"; "kept-open", for a volume the
// logic refused after Enter, which stays to be fixed; or "refused", for one refused after a click
// away, which closes, and whose click then does nothing else, so the message stays in view.
function saveVolume(plan, stage, transfer, shown, text, how) {
  let saved = plan;
  if (text !== shown) {
    saved = tryEdit(() => changeVolume(plan, transfer.position, volumeValue(text)));
    if (saved === false) {
      if (how === "enter") {
        return "kept-open";
      }
      closeVolumeBox();
      return "refused";
    }
    const volume = saved.operationList.listOperations()[transfer.position].volume;
    showMessage(`Volume changed to ${formatVolume(volume)} µL.`, "ok");
  }
  closeVolumeBox();
  if (how === "enter") {
    openNextVolumeBox(saved, stage, transfer.position);
  }
  return "closed";
}

// Opens the volume box of the transfer after the one at `position` in `stage`, its volume selected,
// so a list of volumes can be typed one after another. On the stage's last transfer, nothing opens.
function openNextVolumeBox(plan, stage, position) {
  const transfers = transfersIn(plan, stage);
  const next = transfers[transfers.findIndex((transfer) => transfer.position === position) + 1];
  if (next === undefined) {
    return;
  }
  const button = elements.stagesList.querySelector(
    `.transfer-row[data-position="${next.position}"] .volume-button`,
  );
  if (button !== null) {
    startEditingVolume(button, stage, next);
  }
}

// Closes the volume box: the list is redrawn with the volume as a button again, and its transfer
// is no longer singled out.
function closeVolumeBox() {
  volumeBoxOpen = null;
  refreshStages();
  highlightTransfer(null);
}

// Keeps the open volume box's transfer singled out after a redrawing, which draws the rows, wells
// and arrows afresh (section 7).
function keepVolumeBoxTransferHighlighted() {
  if (volumeBoxOpen !== null) {
    highlightTransfer(volumeBoxOpen.position);
  }
}

// Singles out one transfer on the deck (section 7): its row is tinted, its arrow stays while the
// others fade, and its wells get a blue ring. null clears it.
function highlightTransfer(position) {
  for (const row of elements.stagesList.querySelectorAll(".transfer-row")) {
    row.classList.toggle("highlighted", position !== null && Number(row.dataset.position) === position);
  }
  for (const arrow of elements.arrowLayer.querySelectorAll(".arrow[data-position]")) {
    arrow.classList.toggle("dimmed", position !== null && Number(arrow.dataset.position) !== position);
  }
  const transfer = position === null ? null : currentPlan().operationList.listOperations()[position];
  const highlighted = transfer === null ? new Set() : new Set([wellKey(transfer.source), wellKey(transfer.destination)]);
  for (const [key, wellElement] of wellElements) {
    wellElement.classList.toggle("highlighted", highlighted.has(key));
  }
}

// A tip group's box: its heading (the tip change) and its stages, each between two seams. Boxes
// alternate light blue and light sand. `nextGroup` is the box after it, if any.
function createTipGroupBox(plan, group, index, nextGroup, open, problems, drawnKeys) {
  const box = createElement("div", "", "tip-group");
  box.classList.toggle("sand", index % 2 === 1);
  box.dataset.group = group.key;
  box.append(createTipGroupHeading(plan, group));

  const stages = createElement("div", "", "tip-group-stages");
  const firstStage = group.stages[0];
  stages.append(
    createSeam(plan, {
      addBefore: firstStage,
      takeTips: true,
      accessibleName: "Add a stage at the start of these tips",
    }),
  );
  group.stages.forEach((id, place) => {
    const entry = createEntry(plan, id, open, problems);
    applyGlow(entry, `stage:${id}`, drawnKeys);
    stages.append(entry);
    const lower = group.stages[place + 1];
    if (lower !== undefined) {
      stages.append(
        createSeam(plan, {
          addBefore: lower,
          takeTips: false,
          accessibleName: `Insert a stage before ${stageLabel(plan, lower)}`,
          tipsBefore: lower,
        }),
      );
    }
  });
  stages.append(
    createSeam(plan, {
      addBefore: nextGroup === undefined ? null : nextGroup.stages[0],
      takeTips: false,
      accessibleName: "Add a stage at the end of these tips",
      tipsWithStage: true,
    }),
  );
  box.append(stages);
  // A box whose key is a stage that's new itself isn't a new box: its tip change moved onto the new
  // stage (addStage with takeTips), so only the stage glows.
  const tipsMovedOntoNewStage = group.key !== START && isNewKey(`stage:${group.key}`);
  if (!tipsMovedOntoNewStage) {
    applyGlow(box, `box:${group.key}`, drawnKeys);
  } else {
    drawnKeys.add(`box:${group.key}`);
  }
  return box;
}

// A tip group's heading: a tip icon, "New tips · BC230 · 2 tips" and the ✎ that opens the tip
// change's box. The count is how many tips the tip change loads: one per probe it loads, chosen in
// its box, and every stage in the group uses all of them (section 7).
function createTipGroupHeading(plan, group) {
  const tips = countOf(group.probes.length, "tip");
  const heading = createElement("div", "", "tip-group-heading");
  heading.title = `Loads ${tips}. Every stage until the next new tips uses all of them.`;
  heading.append(
    createElement("span", "", "tip-icon"),
    createElement("span", `New tips · ${group.tipType} · ${tips}`),
    createPencil("tip", group.key, "Edit these new tips"),
  );
  return heading;
}

// A seam (section 7): the space between two cards, which shows a line, a + for adding a stage, the
// mix step button just left of it and, on all but a box's first seam, a tip button just right of it,
// while pointed at or focused. `addBefore` is the stage the new stage goes before (null for last);
// `accessibleName` the +'s, which says "a stage"; `tipsBefore` the stage a tip change goes before
// (a seam between two stages); `tipsWithStage` true on a box's last seam, whose tip button adds a
// stage with new tips instead. A seam above a box's first stage has neither.
function createSeam(plan, { addBefore, takeTips, accessibleName, tipsBefore, tipsWithStage = false }) {
  const seam = createElement("div", "", "seam");
  seam.append(createElement("span", "", "seam-line"));
  // The mix step button adds a mix step where the + would add a stage, with the same tips.
  const mix = createElement("button", "⟳", "seam-button add-mix-step");
  mix.type = "button";
  mix.title = "Add a mix step here";
  mix.setAttribute("aria-label", accessibleName.replace("a stage", "a mix step"));
  mix.addEventListener("click", () => addMixStepAt(addBefore, takeTips));
  seam.append(mix);
  // The + is drawn by the stylesheet, two bars crossing at the circle's center, so it's centered.
  const add = createElement("button", "", "seam-button add-stage");
  add.type = "button";
  add.title = "Add a stage here";
  add.setAttribute("aria-label", accessibleName);
  add.addEventListener("click", () => addStageAt(addBefore, takeTips));
  seam.append(add);
  if (tipsBefore !== undefined) {
    seam.append(
      createSeamTipButton("New tips here", `New tips before ${stageLabel(plan, tipsBefore)}`, () =>
        addTipChangeBefore(tipsBefore),
      ),
    );
  } else if (tipsWithStage) {
    seam.append(
      createSeamTipButton(
        "New tips, with a new stage",
        "Add a stage with new tips at the end of these tips",
        () => addStageWithNewTipsAt(addBefore),
      ),
    );
  }
  return seam;
}

// A seam's tip button (section 7): a circle with the tip icon, in the tip button's fixed spot just
// right of the +, with `tooltip`, `accessibleName` and `onClick`.
function createSeamTipButton(tooltip, accessibleName, onClick) {
  const tips = createElement("button", "", "seam-button add-tips");
  tips.type = "button";
  tips.title = tooltip;
  tips.setAttribute("aria-label", accessibleName);
  tips.append(createElement("span", "", "tip-icon"));
  tips.addEventListener("click", onClick);
  return tips;
}

// Adds a stage before `beforeId` (or last, for null) and opens it (section 7).
function addStageAt(beforeId, takeTips) {
  const added = tryLogic(() => addStage(currentPlan(), beforeId, { takeTips }));
  if (added !== false) {
    openAddedStage(added, "Added a stage. New transfers go into it.");
  }
}

// Adds a mix step before `beforeId` (or last, for null) and opens it, as one undoable edit
// (section 7).
function addMixStepAt(beforeId, takeTips) {
  const added = tryLogic(() => addMixStep(currentPlan(), beforeId, { takeTips }));
  if (added !== false) {
    openAddedStage(added, "Added a mix step. Click or drag across wells on the deck to mix them.");
  }
}

// Adds a stage where a box's last seam would (before `beforeId`, or last, for null), then a tip
// change on it, as one undoable edit, and opens it (section 7): a new tip group started at the end
// of a box in one press (Andy, 2026-10-31).
function addStageWithNewTipsAt(beforeId) {
  const added = tryLogic(() => {
    const { plan, id } = addStage(currentPlan(), beforeId);
    return { plan: addTipChange(plan, id), id };
  });
  if (added !== false) {
    openAddedStage(added, "Added a stage with new tips. New transfers go into it.");
  }
}

// Records `added` ({ plan, id }, from addStage or addMixStep) with the new stage open, as openEntry
// would open it but as part of the same undoable edit, shows `message` (ok) and scrolls the column
// to show the new card.
function openAddedStage(added, message) {
  closeEditingBox();
  source = null;
  recordEdit(added.plan, added.id);
  showMessage(message, "ok");
  scrollIntoColumnView(elements.stagesList.querySelector(`[data-entry="${cssEscape(added.id)}"]`));
}

// Adds a tip change before stage `beforeId`, which starts a new tip group box there (section 7).
function addTipChangeBefore(beforeId) {
  const plan = currentPlan();
  if (tryEdit(() => addTipChange(plan, beforeId)) !== false) {
    showMessage(`New tips before ${stageLabel(plan, beforeId)}.`, "ok");
  }
}

// --- The glow (section 7) ---

// Makes `element` glow if `key` (a stage or box) wasn't drawn last time, or is still glowing from
// an earlier drawing, and notes the key as drawn. Nothing glows at the first drawing.
function applyGlow(element, key, drawnKeys) {
  drawnKeys.add(key);
  const now = performance.now();
  if (isNewKey(key)) {
    glows.set(key, now);
  }
  const started = glows.get(key);
  if (started === undefined) {
    return;
  }
  const elapsed = now - started;
  if (elapsed >= GLOW_MILLISECONDS) {
    glows.delete(key);
    return;
  }
  element.classList.add("glowing");
  // A negative delay starts the animation part-way through, so a glow carries on through redrawing.
  element.style.animationDelay = `-${Math.round(elapsed)}ms`;
}

// True if `key` wasn't among the keys drawn at the last drawing (and this isn't the first).
function isNewKey(key) {
  return lastDrawnKeys !== null && !lastDrawnKeys.has(key);
}

// --- Starting contents: the palette (section 8) ---

// The Start card's palette: a chip and ✎ per component, then + New (or the box for a new name),
// then Eraser.
function createPalette(plan) {
  const palette = createElement("div", "", "palette");
  for (const component of plan.components) {
    const holder = createElement("span", "", "chip-holder");
    const chip = createElement("button", "", "component-chip");
    chip.type = "button";
    chip.classList.toggle("picked", brush.pick.kind === "component" && brush.pick.name === component.name);
    chip.setAttribute("aria-pressed", String(chip.classList.contains("picked")));
    chip.append(createSwatch(component.color), createElement("span", component.name));
    chip.addEventListener("click", () => pickBrush({ kind: "component", name: component.name }));
    holder.append(chip, createPencil("component", component.name, `Edit ${component.name}`));
    palette.append(holder);
  }
  palette.append(addingComponent === null ? createNewComponentButton() : createNewComponentBox(plan));
  const eraser = createElement("button", "Eraser", "component-chip eraser");
  eraser.type = "button";
  eraser.classList.toggle("picked", brush.pick.kind === "eraser");
  eraser.setAttribute("aria-pressed", String(brush.pick.kind === "eraser"));
  eraser.addEventListener("click", () => pickBrush({ kind: "eraser" }));
  palette.append(eraser);
  return palette;
}

// Picks a component or the eraser for the brush. Not an edit: only the palette and the cursor's
// label change.
function pickBrush(pick) {
  brush.pick = pick;
  refreshStages();
  updateCursorLabel();
}

// The "+ New" button, which becomes a text box for a new component's name.
function createNewComponentButton() {
  const button = createElement("button", "+ New", "component-chip");
  button.type = "button";
  button.addEventListener("click", () => {
    addingComponent = { text: "" };
    refreshStages();
  });
  return button;
}

// The text box for a new component's name. Enter adds the name and opens a fresh box; Enter on an
// empty box, Escape, or clicking away ends; clicking away with a name typed adds it first.
function createNewComponentBox(plan) {
  const box = document.createElement("input");
  box.type = "text";
  box.className = "new-component-box";
  box.placeholder = "Component name";
  box.setAttribute("aria-label", "Component name");
  box.value = addingComponent.text;
  let done = false;
  box.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      done = true;
      addNewComponent(plan, box.value, { keepAdding: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
      done = true;
      endAddingComponent();
    }
  });
  box.addEventListener("blur", () => {
    // Replacing the palette while the box has focus can fire blur too; a box that's done, or no
    // longer on the page, does nothing more.
    if (done || !box.isConnected) {
      return;
    }
    done = true;
    if (box.value.trim() === "") {
      endAddingComponent();
    } else {
      addNewComponent(plan, box.value, { keepAdding: false });
    }
  });
  return box;
}

// Closes the "+ New" box.
function endAddingComponent() {
  addingComponent = null;
  refreshStages();
}

// Adds a component called `text` (spaces at the ends removed) with the first free color, and picks
// it. An empty name just closes the box. If there's no free color or addComponent refuses the
// name, the message is shown and the box stays open with the name, to fix it. With keepAdding, a
// fresh box opens for the next name.
function addNewComponent(plan, text, { keepAdding }) {
  const name = text.trim();
  if (name === "") {
    endAddingComponent();
    return;
  }
  const color = firstFreeColor(plan);
  addingComponent = { text };
  if (color === null) {
    showMessage(
      `All ${COMPONENT_COLORS.length} colors are in use, and two components can't share one. ` +
        "Remove a component to add another.",
      "error",
    );
    refreshStages();
    return;
  }
  let added;
  try {
    added = addComponent(plan, name, color);
  } catch (error) {
    showMessage(error.message, "error");
    refreshStages();
    return;
  }
  brush.pick = { kind: "component", name };
  addingComponent = keepAdding ? { text: "" } : null;
  recordEdit(added);
  showMessage(`Added ${name}.`, "ok");
}

// The first color in COMPONENT_COLORS that no component has, or null if all are taken.
function firstFreeColor(plan) {
  const taken = new Set(plan.components.map((component) => component.color));
  return COMPONENT_COLORS.find((color) => !taken.has(color)) ?? null;
}

// The line under the palette saying what a click does, e.g. "Adds 1000 µL of Media to each well you
// click, on top of what's there. Type a number to change it."
function createBrushLine(plan) {
  const line = createElement("p", "", "brush-line");
  if (brush.pick.kind === "component") {
    line.append(
      "Adds ",
      createElement("strong", `${volumeShown(brush.volume)} µL`),
      ` of ${brush.pick.name} to each well you click, on top of what's there. Type a number to change it.`,
    );
  } else if (brush.pick.kind === "eraser") {
    line.textContent = "Eraser: click or drag to empty wells.";
  } else if (plan.components.length > 0) {
    line.textContent = "Pick a component to fill wells with it.";
  } else {
    line.textContent = "Add a component with + New, then fill wells with it.";
  }
  return line;
}

// Fills `wells` with the brush (section 8): adds the brush's volume of the picked component to
// each, or empties them with the eraser. With nothing picked, says what to do.
function fillWells(wells) {
  const plan = currentPlan();
  if (brush.pick.kind === "none") {
    showMessage("Pick a component in the Start card first, or add one with + New.", "note");
    return;
  }
  if (brush.pick.kind === "eraser") {
    if (tryEdit(() => emptyWells(plan, wells)) !== false) {
      showMessage(`Emptied ${countOf(wells.length, "well")} at the start.`, "note");
    }
    return;
  }
  const name = brush.pick.name;
  const volume = volumeValue(brush.volume.text);
  const filled = tryEdit(() => addToWells(plan, wells, name, volume));
  if (filled === false) {
    return;
  }
  const added = `Added ${formatVolume(volume)} µL of ${name} to ${countOf(wells.length, "well")}`;
  const overfilled = newStartingOverfill(plan, filled);
  if (overfilled === null) {
    showMessage(`${added}.`, "ok");
  } else {
    showMessage(
      `${added}, but ${wellName(filled, overfilled)} starts with ${formatVolume(overfilled.held)} µL, ` +
        `over its ${formatVolume(overfilled.capacity)} µL capacity.`,
      "error",
    );
  }
}

// The first well, in the starting contents' order, that a fill from `before` to `after` took over
// its capacity (an "overfill" problem of the start that wasn't there before; section 8), or null.
// A well already over before the fill isn't reported again.
function newStartingOverfill(before, after) {
  const overBefore = new Set(startingOverfills(before).map(wellKey));
  return startingOverfills(after).find((problem) => !overBefore.has(wellKey(problem))) ?? null;
}

// The "overfill" problems of `plan`'s starting contents (operationIndex null), in the starting
// contents' order.
function startingOverfills(plan) {
  return replay(plan.startingContents, plan.operationList)
    .listProblems()
    .filter((problem) => problem.operationIndex === null);
}

// --- Transfers (section 9) ---

// Acts on a click on a well: while Start is open it fills the well; while a stage is open it chooses
// the source, clears it, or adds the transfer; while a mix step is open it mixes the well, or stops
// mixing it; while End is open it says nothing can be added.
function clickWell(end) {
  const open = currentOpen();
  if (open === START) {
    fillWells([end]);
    return;
  }
  if (open === END) {
    showMessage("End shows the finished plates. Open a stage to add transfers into it.", "note");
    return;
  }
  if (isMixStep(currentPlan(), open)) {
    toggleMixedWell(end);
    return;
  }
  if (source === null) {
    chooseSource(end);
  } else if (wellKey(source) === wellKey(end)) {
    clearSource();
  } else {
    const from = source;
    source = null;
    addOneTransfer(from, end);
  }
}

// --- Mixing wells (section 9, "A mix step open") ---

// A click on a well with a mix step open: mixes the well (mixWells), or, if the mix step mixes it
// already, stops mixing it (unmixWell).
function toggleMixedWell(end) {
  const plan = currentPlan();
  const stage = currentOpen();
  const isMixed = transfersIn(plan, stage).some((transfer) => wellKey(transfer.source) === wellKey(end));
  if (isMixed) {
    if (tryEdit(() => unmixWell(plan, stage, end)) !== false) {
      showMessage(`Stopped mixing ${wellName(plan, end)}.`, "note");
    }
    return;
  }
  mixWellsWithReport([end]);
}

// Mixes each of `wells` the open mix step doesn't mix yet, as one edit (mixWells), and says so:
// "Mixing Plate1 A2." for one well, "Mixing 12 wells." for several, or "Those wells are mixed
// already." If the edit leaves a well causing a mix problem or an overdraw that wasn't there before,
// the message is an error naming it, e.g. "Mixing Plate1 A2, but it holds too little to mix."
function mixWellsWithReport(wells) {
  const plan = currentPlan();
  const stage = currentOpen();
  const mixedAlready = new Set(transfersIn(plan, stage).map((transfer) => wellKey(transfer.source)));
  const toMix = wells.filter((well) => !mixedAlready.has(wellKey(well)));
  if (toMix.length === 0) {
    showMessage("Those wells are mixed already.", "note");
    return;
  }
  const mixed = tryEdit(() => mixWells(plan, stage, toMix));
  if (mixed === false) {
    return;
  }
  const what = toMix.length === 1 ? wellName(plan, toMix[0]) : countOf(toMix.length, "well");
  const tooLittle = newWellHoldingTooLittle(plan, mixed);
  if (tooLittle === null) {
    showMessage(`Mixing ${what}.`, "ok");
  } else if (toMix.length === 1) {
    showMessage(`Mixing ${what}, but it holds too little to mix.`, "error");
  } else {
    showMessage(`Mixing ${what}, but ${wellName(plan, tooLittle)} holds too little to mix.`, "error");
  }
}

// The well an edit from `before` to `after` left causing a mix problem or an overdraw (a draw into
// the dead volume or past what the well holds) that wasn't there before, { labware, well }, or
// null: a new mix problem's well first, otherwise a new overdraw's well. Overdraws are recognized
// across the edit as transfers are (section 9).
function newWellHoldingTooLittle(before, after) {
  const problemKey = (problem) => JSON.stringify([problem.stage, problem.end, wellKey(problem)]);
  const problemsBefore = new Set(mixVolumes(before).problems.map(problemKey));
  const newMixProblem = mixVolumes(after).problems.find((problem) => !problemsBefore.has(problemKey(problem)));
  if (newMixProblem !== undefined) {
    return newMixProblem;
  }
  const overdrawnBefore = problemOperations(before);
  const operations = after.operationList.listOperations();
  const newOverdraw = replay(after.startingContents, after.operationList)
    .listProblems()
    .find((problem) => isDrawProblem(problem) && !overdrawnBefore.has(operations[problem.operationIndex]));
  return newOverdraw ?? null;
}

// Chooses a well as the source of the next transfer.
function chooseSource(end) {
  source = end;
  refreshDeck();
  showMessage(
    `Source ${wellName(currentPlan(), end)} chosen. Click the destination well, or drag across several.`,
    "note",
  );
}

// Clears the chosen source.
function clearSource() {
  source = null;
  refreshDeck();
  showMessage("Source cleared.", "note");
}

// Adds one transfer from `from` to `to` into the open stage, with the next transfer's volume
// (section 9). Says what was added, or, if the edit caused a new contents problem, which transfer
// has it and what kind it is.
function addOneTransfer(from, to) {
  const plan = currentPlan();
  const stage = currentOpen();
  const transfer = { type: "transfer", source: from, destination: to, volume: volumeValue(transferVolume.text), stage };
  const added = addTransfersWithReport(plan, [transfer]);
  if (added === null) {
    return;
  }
  if (added.newProblem === null) {
    showMessage(
      `Added to ${stageLabel(added.plan, stage)}: ${wellName(plan, from)} → ${wellName(plan, to)}, ` +
        `${formatVolume(transfer.volume)} µL.`,
      "ok",
    );
  } else {
    showMessage(`Added, but ${added.newProblem}`, "error");
  }
}

// Adds a transfer from `from` into each of `wells` (the source itself left out), as one edit.
function addManyTransfers(from, wells) {
  const plan = currentPlan();
  const stage = currentOpen();
  const volume = volumeValue(transferVolume.text);
  const transfers = wells.map((well) => ({ type: "transfer", source: from, destination: well, volume, stage }));
  const added = addTransfersWithReport(plan, transfers);
  if (added === null) {
    return;
  }
  const what = `${countOf(transfers.length, "transfer")} of ${formatVolume(volume)} µL from ${wellName(plan, from)}`;
  if (added.newProblem === null) {
    showMessage(`Added ${what} to ${stageLabel(added.plan, stage)}.`, "ok");
  } else {
    showMessage(`Added ${what}, but ${added.newProblem}`, "error");
  }
}

// Adds `transfers` to the plan as one edit and records it. Returns null if the logic refuses (its
// message is shown), otherwise { plan, newProblem }: the new plan, and, if the edit caused a new
// contents problem (section 9), one described by its kind, e.g. "transfer #5 asks for 60 µL from
// Drug plate A1, which holds 50 µL.", or null. A new problem is one that wasn't there before the
// edit: a transfer that has a problem now but didn't, or wasn't in the plan; a problem of the
// starting contents is never new here. An added transfer's own problem is named first; otherwise
// the first new problem in the run, such as a later transfer left short.
function addTransfersWithReport(plan, transfers) {
  const withProblemBefore = problemOperations(plan);
  const operationsBefore = new Set(plan.operationList.listOperations());
  const added = tryEdit(() => addTransfers(plan, transfers));
  if (added === false) {
    return null;
  }
  // Transfers are recognized across the edit because the operation list keeps every unchanged
  // transfer as the same object.
  const operations = added.operationList.listOperations();
  const newProblems = replay(added.startingContents, added.operationList)
    .listProblems()
    .filter(
      (problem) =>
        problem.operationIndex !== null && !withProblemBefore.has(operations[problem.operationIndex]),
    );
  const reported =
    newProblems.find((problem) => !operationsBefore.has(operations[problem.operationIndex])) ??
    newProblems[0];
  return {
    plan: added,
    newProblem: reported === undefined ? null : describeNewProblem(added, reported),
  };
}

// The operations of `plan` with a contents problem of any kind, as a Set of the operation objects
// themselves. A problem of the starting contents names no operation, so it's left out.
function problemOperations(plan) {
  const operations = plan.operationList.listOperations();
  const problems = replay(plan.startingContents, plan.operationList).listProblems();
  return new Set(
    problems
      .filter((problem) => problem.operationIndex !== null)
      .map((problem) => operations[problem.operationIndex]),
  );
}

// True if `problem` (from contents tracking) is a draw problem: a "dead-volume" or "overdraw"
// problem, which the page marks as an overdraw; false for an "overfill".
function isDrawProblem(problem) {
  return problem.kind === "dead-volume" || problem.kind === "overdraw";
}

// A transfer's contents problem, described by its kind for the message after adding (section 9),
// e.g. an overdraw: "transfer #5 asks for 60 µL from Drug plate A1, which holds 50 µL."; a draw into
// the dead volume: "transfer #5 asks for 400 µL from Reservoir 5, which has only 300 µL above its
// dead volume."; an overfill: "transfer #5 brings Assay plate A1 to 380 µL, over its 360 µL capacity."
function describeNewProblem(plan, problem) {
  const transfer = `transfer #${problem.operationIndex + 1}`;
  if (problem.kind === "dead-volume") {
    return (
      `${transfer} asks for ${formatVolume(problem.requested)} µL from ${wellName(plan, problem)}, ` +
      `which has only ${formatVolume(problem.available)} µL above its dead volume.`
    );
  }
  if (problem.kind === "overdraw") {
    return (
      `${transfer} asks for ${formatVolume(problem.requested)} µL from ${wellName(plan, problem)}, ` +
      `which holds ${formatVolume(problem.held)} µL.`
    );
  }
  return (
    `${transfer} brings ${wellName(plan, problem)} to ${formatVolume(problem.held)} µL, ` +
    `over its ${formatVolume(problem.capacity)} µL capacity.`
  );
}

// --- Pointer actions on the deck (sections 8 and 9) ---

// Starts a press when the main button (or a finger or pen) presses a well. It becomes a click on
// release, or a drag once it moves DRAG_START_DISTANCE.
function startPress(event) {
  const end = endOf(event.target);
  if (end === null || event.button !== 0) {
    return;
  }
  hideContentsCard();
  press = { end, x: event.clientX, y: event.clientY };
}

// Follows the pointer: starts a drag once a press has moved far enough (while End is open, dragging
// does nothing, so the press is dropped instead), moves the drag's far corner or drop target, and
// moves the cursor's label and arrow.
function movePointer(event) {
  pointerPosition = overLabware(event) ? { x: event.clientX, y: event.clientY } : null;
  const moved = press !== null && Math.hypot(event.clientX - press.x, event.clientY - press.y) >= DRAG_START_DISTANCE;
  if (moved && drag === null) {
    if (currentOpen() === END) {
      press = null;
    } else {
      beginDrag();
    }
  }
  if (drag !== null) {
    const over = wellUnderPointer(event);
    if (over !== drag.over && wellKeyOrNull(over) !== wellKeyOrNull(drag.over)) {
      drag.over = over;
      updateDragMarks();
    }
  }
  updateCursorLabel();
  drawCursorArrow();
}

// Turns the press into a drag: filling a box while Start is open; mixing a box while a mix step is
// open; sending the chosen source into a box, or making one transfer, while a stage is open.
function beginDrag() {
  hideContentsCard();
  const open = currentOpen();
  let kind = source !== null ? "box" : "transfer";
  if (open === START) {
    kind = "fill";
  } else if (isMixStep(currentPlan(), open)) {
    kind = "mix";
  }
  drag = { kind, from: press.end, over: press.end };
  updateDragMarks();
}

// Ends a press or a drag: a press that never moved is a click on its well.
function releasePointer() {
  if (drag !== null) {
    const finished = drag;
    drag = null;
    press = null;
    finishDrag(finished);
    return;
  }
  if (press !== null) {
    const end = press.end;
    press = null;
    clickWell(end);
  }
}

// Abandons a press or drag the browser interrupts (e.g. a touch turned into a scroll).
function cancelPress() {
  press = null;
  drag = null;
  updateDragMarks();
  drawCursorArrow();
}

// Acts on a well chosen with Enter or Space as a click. A mouse or touch click is already handled
// by the press; a click event from the keyboard has event.detail 0.
function clickWellWithKeyboard(event) {
  const end = endOf(event.target);
  if (end !== null && event.detail === 0) {
    clickWell(end);
  }
}

// Finishes a drag (sections 8 and 9): fills the box, mixes the box, adds one transfer, or sends the
// source into the box.
function finishDrag({ kind, from, over }) {
  updateDragMarks();
  if (kind === "fill") {
    if (over !== null && over.labware === from.labware) {
      fillWells(wellsInBox(from, over));
    }
    return;
  }
  if (kind === "mix") {
    // As when filling, a drag that ends off the labware it started on mixes nothing.
    if (over !== null && over.labware === from.labware) {
      mixWellsWithReport(wellsInBox(from, over));
    }
    return;
  }
  if (kind === "transfer") {
    if (over === null) {
      showMessage("Drop on a well to add a transfer.", "note");
    } else if (wellKey(over) === wellKey(from)) {
      showMessage("Dropped back on the same well, so nothing was added.", "note");
    } else {
      addOneTransfer(from, over);
    }
    return;
  }
  finishBoxDrag(from, over);
}

// Finishes a drag across a box of wells with a source chosen: one transfer from the source into
// each well of the box but the source itself, as one edit; the source is cleared afterwards.
function finishBoxDrag(from, over) {
  if (over === null || over.labware !== from.labware) {
    showMessage("Drag across wells of one labware to send the source into each of them.", "note");
    return;
  }
  const sourceKey = wellKey(source);
  const wells = wellsInBox(from, over).filter((well) => wellKey(well) !== sourceKey);
  if (wells.length === 0) {
    showMessage("The box held only the source well, so nothing was added.", "note");
    return;
  }
  const chosen = source;
  source = null;
  addManyTransfers(chosen, wells);
}

// Shows the drag on the wells: the box being dragged across outlined, or the well under a transfer
// drag with a dashed outline.
function updateDragMarks() {
  for (const wellElement of wellElements.values()) {
    wellElement.classList.remove("in-box", "drop-target");
  }
  if (drag === null || drag.over === null) {
    return;
  }
  if (drag.kind === "transfer") {
    wellElements.get(wellKey(drag.over))?.classList.add("drop-target");
    return;
  }
  if (drag.over.labware === drag.from.labware) {
    for (const well of wellsInBox(drag.from, drag.over)) {
      wellElements.get(wellKey(well))?.classList.add("in-box");
    }
  }
}

// The well under the pointer, { labware, well }, or null. Uses the pointer's position rather than
// the event's target, because a finger's events keep going to the well where the touch started.
function wellUnderPointer(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  return element === null || !elements.labwareArea.contains(element) ? null : endOf(element);
}

// True if the pointer event is over the labware area.
function overLabware(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  return element !== null && elements.labwareArea.contains(element);
}

// The well a well element (or an element inside it) stands for, { labware, well }, or null.
function endOf(element) {
  const wellElement = element.closest(".well");
  return wellElement === null ? null : { labware: wellElement.dataset.labware, well: wellElement.dataset.well };
}

// --- The cursor's label and the contents card (sections 6 and 12) ---

// Shows, beside the pointer, what a click does: the next transfer's volume with a stage open; the
// brush with Start open; nothing with a mix step or End open, or off the labware.
function updateCursorLabel() {
  const label = elements.cursorLabel;
  const open = currentOpen();
  // A mix step has no volume at the cursor (section 9).
  if (pointerPosition === null || open === END || (open !== START && isMixStep(currentPlan(), open))) {
    label.hidden = true;
    return;
  }
  if (open === START) {
    if (brush.pick.kind === "component") {
      label.textContent = `+ ${volumeShown(brush.volume)} µL ${brush.pick.name}`;
    } else if (brush.pick.kind === "eraser") {
      label.textContent = "Eraser";
    } else {
      label.textContent = "No component picked";
    }
  } else {
    label.textContent = `${volumeShown(transferVolume)} µL`;
  }
  label.style.left = `${pointerPosition.x + CURSOR_LABEL_OFFSET.x}px`;
  label.style.top = `${pointerPosition.y + CURSOR_LABEL_OFFSET.y}px`;
  label.hidden = false;
}

// Shows a well's contents card beside it: to its left if it fits there, otherwise to its right, and
// kept inside the window.
function showContentsCard(wellElement) {
  const end = endOf(wellElement);
  const card = elements.contentsCard;
  card.replaceChildren(...contentsCardLines(currentPlan(), end));
  card.hidden = false;
  const well = wellElement.getBoundingClientRect();
  const width = card.offsetWidth;
  const height = card.offsetHeight;
  const gap = 10;
  const left = well.left - gap - width >= 8 ? well.left - gap - width : well.right + gap;
  const top = Math.min(Math.max(8, well.top + well.height / 2 - height / 2), window.innerHeight - 8 - height);
  card.style.left = `${Math.min(left, window.innerWidth - 8 - width)}px`;
  card.style.top = `${top}px`;
}

// Hides the contents card.
function hideContentsCard() {
  elements.contentsCard.hidden = true;
}

// The contents card's lines for a well (section 6): its name ("Empty" under it if it holds nothing),
// each component's swatch, name, volume and share, then only problems and warnings: each contents
// problem of the well by its kind, whether it's off plan, and how much of it the open stage mixes.
// No total, usable-volume or capacity lines (Andy, 2026-10-31): the components add up to the total,
// the labware's limits are the same for every well of it, and the problem lines carry the numbers.
function contentsCardLines(plan, end) {
  const lines = [createElement("div", wellName(plan, end), "card-title")];
  if (shownSnapshot.totalVolumeOf(end.labware, end.well) === 0) {
    lines.push(createElement("div", "Empty", "card-empty"));
  }
  const fractions = shownSnapshot.volumeFractionsOf(end.labware, end.well);
  const list = document.createElement("ul");
  for (const [name, volume] of Object.entries(shownSnapshot.componentsOf(end.labware, end.well))) {
    const item = document.createElement("li");
    item.append(
      createSwatch(componentColor(plan, name)),
      createElement("span", name),
      createElement("span", `${formatVolume(volume)} µL · ${formatPercent(fractions[name] * 100)}`, "card-volume"),
    );
    list.append(item);
  }
  lines.push(list);
  for (const problem of shownSnapshot.listProblems()) {
    if (problem.labware === end.labware && problem.well === end.well) {
      lines.push(createElement("div", describeCardProblem(problem), "card-problem"));
    }
  }
  const causes = shownSnapshot.causesOf(end.labware, end.well);
  if (causes.length > 0) {
    const numbers = causes.map((index) => `#${index + 1}`).join(", ");
    lines.push(createElement("div", `Contents differ from the plan because of transfer ${numbers}.`, "card-problem"));
  }
  const lastingProblem = lastingMixProblems.get(wellKey(end));
  if (lastingProblem !== undefined) {
    lines.push(lastingMixCardLine(plan, lastingProblem));
  }
  const mixed = openStageMixedWells.get(wellKey(end));
  if (mixed !== undefined) {
    lines.push(mixCardLine(mixed));
  }
  return lines;
}

// A contents problem of the well, in words for the contents card (section 6), by its kind: a draw
// into the dead volume, "Transfer #5 asked for 400 µL but only 300 µL was above the dead volume (held
// 2300 µL, dead volume 2000 µL)."; an overdraw, "Transfer #5 asked for 60 µL but this well held 50
// µL."; an overfill, "Transfer #5 brought this well to 380 µL, over its 360 µL capacity.", or, for
// the start, "Starts with 400 µL, over its 360 µL capacity."
function describeCardProblem(problem) {
  const transfer = `Transfer #${problem.operationIndex + 1}`;
  if (problem.kind === "dead-volume") {
    return (
      `${transfer} asked for ${formatVolume(problem.requested)} µL but only ` +
      `${formatVolume(problem.available)} µL was above the dead volume ` +
      `(held ${formatVolume(problem.held)} µL, dead volume ${formatVolume(problem.deadVolume)} µL).`
    );
  }
  if (problem.kind === "overdraw") {
    return (
      `${transfer} asked for ${formatVolume(problem.requested)} µL but this well held ` +
      `${formatVolume(problem.held)} µL.`
    );
  }
  const over = `over its ${formatVolume(problem.capacity)} µL capacity.`;
  if (problem.operationIndex === null) {
    return `Starts with ${formatVolume(problem.held)} µL, ${over}`;
  }
  return `${transfer} brought this well to ${formatVolume(problem.held)} µL, ${over}`;
}

// The contents card's line for a well that caused a mix problem in an earlier stage than the open
// one, or at End (section 6), from its entry in lastingMixProblemsOf, in the problem color, e.g.
// "Stage 1, “Tiny dispense”, can't mix this well: its mix is 0 µL, under 1 µL."
function lastingMixCardLine(plan, lastingProblem) {
  const order = stageOrder(plan);
  const stage = lastingProblem.stage;
  return createElement(
    "div",
    `Stage ${order.indexOf(stage) + 1}, “${plan.stageList.get(stage).name}”, can't mix this well: ` +
      `its mix is ${formatVolume(lastingProblem.volume)} µL, under ${formatVolume(MIN_MIX_VOLUME)} µL.`,
    "card-problem",
  );
}

// The contents card's line for a well the open stage mixes (section 6), from its entry in
// mixedWellsOf: for the well causing a mix problem, "Holds too little to mix: the mix is 0.8 µL,
// under 1 µL." in the problem color; otherwise "Mixed 17% of well", yellow when short; for
// another well of a row with a mix problem, "Not mixed until the well in red is fixed."
function mixCardLine(mixed) {
  if (mixed.problemVolume !== null) {
    return createElement(
      "div",
      `Holds too little to mix: the mix is ${formatVolume(mixed.problemVolume)} µL, ` +
        `under ${formatVolume(MIN_MIX_VOLUME)} µL.`,
      "card-problem",
    );
  }
  if (mixed.share !== null) {
    const line = createElement("div", `Mixed ${mixedPercent(mixed.share)}% of well`, "card-mix");
    line.classList.toggle("short", mixed.short);
    return line;
  }
  return createElement("div", "Not mixed until the well in red is fixed.", "card-mix");
}

// --- Editing boxes (section 10) ---

// The ✎ that opens an editing box for `kind` ("component", "stage" or "tip") and `key` (a
// component's name, a stage's ID, or a tip change's key). Clicking the open box's ✎ again closes it,
// as a click outside would; the guard handles that, since the ✎ is outside the box.
function createPencil(kind, key, accessibleName) {
  const pencil = createElement("button", "✎", "edit-button");
  pencil.type = "button";
  pencil.dataset.boxKind = kind;
  pencil.dataset.boxKey = key;
  pencil.setAttribute("aria-label", accessibleName);
  const isOpen = editingBox !== null && editingBox.kind === kind && editingBox.key === key;
  pencil.setAttribute("aria-pressed", String(isOpen));
  pencil.addEventListener("click", () => {
    if (editingBox === null) {
      openEditingBox(kind, key);
    }
  });
  return pencil;
}

// Opens the editing box for `kind` and `key`, with a draft of what it edits.
function openEditingBox(kind, key) {
  const plan = currentPlan();
  const original = originalFor(plan, kind, key);
  editingBox = { kind, key, original, draft: { ...original, showAllColors: false } };
  refreshStages();
  focusEditingBox();
}

// What a box edits, before any changes: a component's name and color; a stage's name, modes and
// whether each end mixes; a mix step's name; a tip change's tip type and probes.
function originalFor(plan, kind, key) {
  if (kind === "component") {
    const component = plan.components.find((candidate) => candidate.name === key);
    return { name: component.name, color: component.color };
  }
  if (kind === "stage" && isMixStep(plan, key)) {
    // A mix step's box edits only its name (section 10).
    return { name: plan.stageList.get(key).name, mixStep: true };
  }
  if (kind === "stage") {
    const { name, settings } = plan.stageList.get(key);
    return {
      name,
      aspirate: modeOf("source", settings),
      dispense: modeOf("destination", settings),
      aspirateMix: settings.sourceMix !== null,
      dispenseMix: settings.destinationMix !== null,
    };
  }
  const tipChange = tipChangeAt(plan, key);
  return { tipType: tipChange.tipType, probes: [...tipChange.probes] };
}

// Closes the editing box without saving, taking it off the page without redrawing anything else,
// so a click that closed it still reaches what it was aimed at.
function closeEditingBox() {
  if (editingBox === null) {
    return;
  }
  editingBox.element?.remove();
  editingBox.pencil?.setAttribute("aria-pressed", "false");
  editingBox = null;
}

// True if the open box has changes that aren't saved yet.
function isBoxDirty() {
  const { kind, original, draft } = editingBox;
  if (kind === "component") {
    return draft.name !== original.name || draft.color !== original.color;
  }
  if (kind === "stage") {
    return (
      draft.name !== original.name ||
      draft.aspirate !== original.aspirate ||
      draft.dispense !== original.dispense ||
      draft.aspirateMix !== original.aspirateMix ||
      draft.dispenseMix !== original.dispenseMix
    );
  }
  return (
    draft.tipType !== original.tipType ||
    JSON.stringify(draft.probes) !== JSON.stringify(original.probes)
  );
}

// Draws the open editing box under its ✎ (floating over what's below), presses the ✎, keeps the box
// inside its column, and scrolls to show it. Called after the Stages column is redrawn.
function placeEditingBox() {
  if (editingBox === null) {
    return;
  }
  const pencil = elements.stagesList.querySelector(
    `[data-box-kind="${editingBox.kind}"][data-box-key="${cssEscape(editingBox.key)}"]`,
  );
  if (pencil === null) {
    editingBox = null;
    return;
  }
  const box = createEditingBox(currentPlan());
  pencil.parentElement.append(box);
  pencil.setAttribute("aria-pressed", "true");
  editingBox.element = box;
  editingBox.pencil = pencil;
  keepInsideColumn(box);
  scrollIntoColumnView(box);
}

// Moves a floating box left if it would stick out of the Stages column's content.
function keepInsideColumn(box) {
  const limit = elements.stagesColumn.getBoundingClientRect().right - 16;
  const overflow = box.getBoundingClientRect().right - limit;
  if (overflow > 0) {
    box.style.left = `${-overflow}px`;
  }
}

// Puts the keyboard focus in the open box: its name box if it has one, otherwise its first button.
// Without scrolling: the column is already scrolling to show the whole box, and focusing would
// cut that short.
function focusEditingBox() {
  const box = editingBox?.element;
  if (!box) {
    return;
  }
  const first = box.querySelector("input[type=text], select, button");
  first?.focus({ preventScroll: true });
}

// Redraws the open box in place after a draft change, keeping the rest of the column as it is, and
// keeps the keyboard focus on the same control (the button or field in the same place).
function redrawEditingBox() {
  const old = editingBox.element;
  const focusables = (box) => [...box.querySelectorAll("input, select, button")];
  const focusedAt = focusables(old).indexOf(document.activeElement);
  const box = createEditingBox(currentPlan());
  old.replaceWith(box);
  editingBox.element = box;
  keepInsideColumn(box);
  if (focusedAt !== -1) {
    focusables(box)[focusedAt]?.focus({ preventScroll: true });
  }
  // A box that grew (e.g. More colors was pressed) is shown in full, as when it opened.
  scrollIntoColumnView(box);
}

// The open editing box's element: its fields for its kind, then Remove, Discard and Save.
function createEditingBox(plan) {
  const box = createElement("div", "", "editing-box");
  const isMixStepBox = editingBox.original.mixStep === true;
  // A stage's box is wider than the others, so its menus show whole mode names (section 15); a mix
  // step's has no menus, so it's as wide as the others (section 10).
  box.classList.toggle("stage-box", editingBox.kind === "stage" && !isMixStepBox);
  box.setAttribute("role", "dialog");
  const what = isMixStepBox ? "mix step" : editingBox.kind === "tip" ? "new tips" : editingBox.kind;
  box.setAttribute("aria-label", `Edit ${what}`);
  box.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("input[type=text]")) {
      event.preventDefault();
      saveEditingBox();
    } else if (event.key === "Escape") {
      // Escape closes the box from any of its fields too, where the page's keys don't apply.
      event.preventDefault();
      event.stopPropagation();
      closeEditingBox();
    }
  });
  if (editingBox.kind === "component") {
    box.append(...componentBoxFields(plan));
  } else if (isMixStepBox) {
    box.append(...mixStepBoxFields(plan));
  } else if (editingBox.kind === "stage") {
    box.append(...stageBoxFields(plan));
  } else {
    box.append(...tipBoxFields());
  }
  box.append(createBoxButtons(plan));
  return box;
}

// A component's box (section 8): Name, Color swatches and More colors / Fewer colors.
function componentBoxFields(plan) {
  const { draft, original } = editingBox;
  const nameField = createNameField(draft.name, "Name");
  const colorField = createElement("div");
  colorField.append(createElement("span", "Color", "field-name"));
  const swatches = createElement("div", "", "color-swatches");
  const ownedBy = new Map(plan.components.map((component) => [component.color, component.name]));
  for (const color of colorsOffered(plan, original.name, draft.color, draft.showAllColors)) {
    const swatch = createElement("button", "", "color-swatch");
    swatch.type = "button";
    swatch.style.setProperty("--swatch-color", color);
    const owner = ownedBy.get(color);
    const used = owner !== undefined && owner !== original.name;
    swatch.classList.toggle("own", color === draft.color);
    swatch.classList.toggle("used", used);
    swatch.disabled = used;
    swatch.title = used ? `Used by ${owner}` : color;
    swatch.setAttribute("aria-label", used ? `${color}, used by ${owner}` : color);
    swatch.setAttribute("aria-pressed", String(color === draft.color));
    swatch.addEventListener("click", () => {
      draft.color = color;
      redrawEditingBox();
    });
    swatches.append(swatch);
  }
  const more = createElement("button", draft.showAllColors ? "Fewer colors" : "More colors", "more-colors");
  more.type = "button";
  more.addEventListener("click", () => {
    draft.showAllColors = !draft.showAllColors;
    redrawEditingBox();
  });
  colorField.append(swatches, more);
  return [nameField, colorField];
}

// The colors a component's box offers: all of COMPONENT_COLORS (plus its own color, if that's not
// one of them) with showAll; otherwise the first ten that are free or its own, its own color
// always among them, in place of the tenth if it's further down the list.
function colorsOffered(plan, ownName, ownColor, showAll) {
  if (showAll) {
    return COMPONENT_COLORS.includes(ownColor) ? COMPONENT_COLORS : [...COMPONENT_COLORS, ownColor];
  }
  const takenByOthers = new Set(
    plan.components.filter((component) => component.name !== ownName).map((component) => component.color),
  );
  const free = COMPONENT_COLORS.filter((color) => !takenByOthers.has(color));
  const first = free.slice(0, FIRST_COLORS_SHOWN);
  if (first.includes(ownColor)) {
    return first;
  }
  return [...first.slice(0, FIRST_COLORS_SHOWN - 1), ownColor];
}

// A stage's box (section 10): Name and the settings grid. (Probes are chosen in the tip change's
// box, since every stage uses all its tips' probes.)
function stageBoxFields(plan) {
  const { draft } = editingBox;
  const nameField = createNameField(draft.name, "Name");
  const grid = createSettingsGrid(plan, editingBox.key, draft);
  return [nameField, grid];
}

// A mix step's box (section 10): Name, then a note saying how it mixes, from its destinationMix,
// e.g. "Mixes each well: 90% of the well (≈ 108 µL), 3 times, at 400 µL/s.", or "(no wells yet)"
// in place of the volume while it mixes none. No modes: a mix step's settings are its own.
function mixStepBoxFields(plan) {
  const id = editingBox.key;
  const nameField = createNameField(editingBox.draft.name, "Name");
  const mix = plan.stageList.get(id).settings.destinationMix;
  if (mix === null) {
    // Not one the page makes, but a plan file could hold it.
    return [nameField, createElement("p", "Doesn't mix: it has no mix after dispensing.", "note")];
  }
  const volume = transfersIn(plan, id).length === 0 ? " (no wells yet)" : mixVolumeText(plan, id, "destination");
  const note = `Mixes each well: ${mix.share}% of the well${volume}, ${countOf(mix.times, "time")}, at ${mix.speed} µL/s.`;
  return [nameField, createElement("p", note, "note mix-step-note")];
}

// The two ends of a stage as the box shows them: the logic's end, the draft's names for that end's
// mode and Mix, the column's heading, and the words naming its mix (section 10).
const BOX_ENDS = [
  { end: "source", mode: "aspirate", mix: "aspirateMix", heading: "Aspirate", mixName: "Mix before aspirating" },
  { end: "destination", mode: "dispense", mix: "dispenseMix", heading: "Dispense", mixName: "Mix after dispensing" },
];

// The stage's settings as a grid (section 10): the stage's ends as columns, headed Aspirate and
// Dispense, and its settings as rows, each labeled once at the left: Mode, a menu per end, and Mix,
// a checkbox per end. The top left cell is empty: it's above the labels and left of the headings.
function createSettingsGrid(plan, id, draft) {
  const original = editingBox.original;
  const grid = createElement("div", "", "settings-grid");
  grid.append(
    createElement("span"),
    ...BOX_ENDS.map((boxEnd) => createElement("span", boxEnd.heading, "field-name")),
    createElement("span", "Mode", "field-name"),
    ...BOX_ENDS.map((boxEnd) => {
      const offerNotAMode = original[boxEnd.mode] === null;
      const onChoose = (name) => chooseMode(draft, boxEnd, name);
      return createModeMenu(boxEnd.end, `${boxEnd.heading} mode`, draft[boxEnd.mode], offerNotAMode, onChoose);
    }),
    createElement("span", "Mix", "field-name"),
    ...BOX_ENDS.map((boxEnd) => createMixCell(plan, id, draft, boxEnd)),
  );
  return grid;
}

// Puts the mode called `name` (or null for "(not one of the modes)") in the draft for one end, and
// keeps that end's Mix as section 10 says: a mode that can't mix unchecks it; going back to "(not
// one of the modes)" restores whether the stage mixes there; a mode that can mix keeps it as it is
// (so after a mode that can't mix, the checkbox comes back unchecked). Redraws the box.
function chooseMode(draft, boxEnd, name) {
  draft[boxEnd.mode] = name;
  if (name === null) {
    draft[boxEnd.mix] = editingBox.original[boxEnd.mix];
  } else if (!canMix(boxEnd.end, name)) {
    draft[boxEnd.mix] = false;
  }
  redrawEditingBox();
}

// True if the mode called `name` at `end` can mix (it has a mixing technique), e.g.
// canMix("destination", "Non-Contact") → false.
function canMix(end, name) {
  const mode = modesFor(end).find((candidate) => candidate.name === name);
  return mode !== undefined && mode.mixingTechnique !== null;
}

// One end's Mix cell (section 10): a checkbox, checked while that end mixes in the draft; for a mode
// that can't mix, "Can't mix" instead; for an end that isn't one of the modes, the checkbox showing
// whether the stage mixes there, disabled. The cell's tooltip says what the checkbox does.
function createMixCell(plan, id, draft, boxEnd) {
  const cell = createElement("span", "", "mix-cell");
  const mode = draft[boxEnd.mode];
  if (mode !== null && !canMix(boxEnd.end, mode)) {
    cell.classList.add("cannot-mix");
    cell.textContent = "Can't mix";
    cell.title = `${mode} can't mix.`;
    return cell;
  }
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = draft[boxEnd.mix];
  checkbox.setAttribute("aria-label", boxEnd.mixName);
  // The tooltip is on the cell and the checkbox both, so it shows over a disabled checkbox too.
  cell.title = mode === null ? "Choose a mode to switch mixing." : mixTooltip(plan, id, boxEnd);
  checkbox.title = cell.title;
  checkbox.disabled = mode === null;
  checkbox.addEventListener("change", () => {
    draft[boxEnd.mix] = checkbox.checked;
  });
  cell.append(checkbox);
  return cell;
}

// What a Mix checkbox does, from that end's mix, or DEFAULT_MIX if the stage doesn't mix there,
// e.g. "Mix before aspirating: 90% of the well, 3 times, at 400 µL/s." When the saved stage mixes
// there and has transfers, the volume it works out to follows "of the well": "(≈ 108 µL)", or a range
// such as "(≈ 18–200 µL)" when its rows differ (mixVolumes).
function mixTooltip(plan, id, boxEnd) {
  const ownMix = plan.stageList.get(id).settings[`${boxEnd.end}Mix`];
  const mix = ownMix ?? DEFAULT_MIX;
  const volumeText = ownMix === null ? "" : mixVolumeText(plan, id, boxEnd.end);
  return `${boxEnd.mixName}: ${mix.share}% of the well${volumeText}, ${countOf(mix.times, "time")}, at ${mix.speed} µL/s.`;
}

// The volume stage `id`'s mix at `end` works out to, for a tooltip or note (section 10): " (≈ 108
// µL)", or a range such as " (≈ 18–200 µL)" when its rows differ (mixVolumes); "" if it has no rows.
function mixVolumeText(plan, id, end) {
  const volumes = mixRowsOf(plan, id).map((row) => row[`${end}MixVolume`]);
  if (volumes.length === 0) {
    return "";
  }
  const least = Math.min(...volumes);
  const most = Math.max(...volumes);
  const range = least === most ? formatVolume(least) : `${formatVolume(least)}–${formatVolume(most)}`;
  return ` (≈ ${range} µL)`;
}

// One end's menu of pipetting modes (modesFor), with "(not one of the modes)" first if the stage's
// settings there aren't one of them (`offerNotAMode`), so it can be chosen again after another mode.
// Its column heading isn't its label, so `accessibleName` (e.g. "Aspirate mode") names it for screen
// readers. `chosen` is the mode shown (null for that line); `onChoose` gets the mode's name, or null.
function createModeMenu(end, accessibleName, chosen, offerNotAMode, onChoose) {
  const menu = document.createElement("select");
  menu.setAttribute("aria-label", accessibleName);
  if (offerNotAMode) {
    menu.append(new Option("(not one of the modes)", ""));
  }
  for (const mode of modesFor(end)) {
    menu.append(new Option(mode.name, mode.name));
  }
  menu.value = chosen ?? "";
  menu.addEventListener("change", () => onChoose(menu.value === "" ? null : menu.value));
  return menu;
}

// A tip change's box (section 10): Tip type, a button per tip type, one chosen; then Probes, the
// buttons 1 to 8 that choose how many probes get tips.
function tipBoxFields() {
  const { draft } = editingBox;
  const field = createElement("div");
  field.append(createElement("span", "Tip type", "field-name"));
  const buttons = createElement("div", "", "tip-type-buttons");
  for (const tipType of TIP_TYPES) {
    const button = createElement("button", tipType);
    button.type = "button";
    button.setAttribute("aria-pressed", String(tipType === draft.tipType));
    button.addEventListener("click", () => {
      draft.tipType = tipType;
      redrawEditingBox();
    });
    buttons.append(button);
  }
  field.append(buttons);
  return [field, createProbesField(draft)];
}

// The Probes field of a tip change's box (section 10): buttons 1 to 8, choosing how many probes get
// tips (probesFor), with every probe the tip change loads lit, so picking 4 lights up 1 to 4. The
// chosen count's button is the pressed one.
function createProbesField(draft) {
  const field = createElement("div");
  field.append(createElement("span", "Probes", "field-name"));
  const buttons = createElement("div", "", "probe-buttons");
  for (let probe = 1; probe <= PROBE_COUNT; probe++) {
    const button = createElement("button", String(probe), "probe-button");
    button.type = "button";
    button.classList.toggle("lit", draft.probes.includes(probe));
    button.setAttribute("aria-label", `${countOf(probe, "probe")}`);
    button.setAttribute("aria-pressed", String(draft.probes.length === probe && draft.probes.includes(probe)));
    button.addEventListener("click", () => {
      draft.probes = probesFor(probe);
      redrawEditingBox();
    });
    buttons.append(button);
  }
  field.append(buttons);
  return field;
}

// A box's Name text box, which updates the draft as it's typed in.
function createNameField(value, title) {
  const field = createElement("div");
  const box = document.createElement("input");
  box.type = "text";
  box.id = "editing-box-name";
  box.value = value;
  box.addEventListener("input", () => {
    editingBox.draft.name = box.value;
  });
  const label = createElement("label", title);
  label.htmlFor = box.id;
  field.append(label, box);
  return field;
}

// The box's bottom: Remove at the left (or why there's none), Discard and Save at the right. Remove
// acts at once, with no question: Undo brings back what it removed (section 10; Andy, 2026-10-31).
function createBoxButtons(plan) {
  const holder = createElement("div");
  const buttons = createElement("div", "", "box-buttons");
  const removal = removalFor(plan);
  if (removal.kind === "button") {
    const remove = createElement("button", "Remove", "danger-outline");
    remove.type = "button";
    remove.disabled = removal.disabled;
    if (removal.disabled) {
      remove.title = removal.reason;
    }
    remove.addEventListener("click", removeFromEditingBox);
    buttons.append(remove);
  } else {
    // Why there's no Remove, on a line of its own above the buttons.
    holder.append(createElement("p", removal.reason, "note"));
  }
  const discard = createElement("button", "Discard", "action discard");
  discard.type = "button";
  discard.addEventListener("click", closeEditingBox);
  const save = createElement("button", "Save", "primary save");
  save.type = "button";
  save.addEventListener("click", saveEditingBox);
  buttons.append(createElement("span", "", "spacer"), discard, save);
  holder.append(buttons);
  return holder;
}

// Whether the open box has a Remove button, and if not or if disabled, why: { kind: "button",
// disabled, reason } or { kind: "none", reason }.
function removalFor(plan) {
  const { kind, key } = editingBox;
  if (kind === "stage" && !canRemoveStage(plan, key)) {
    return { kind: "button", disabled: true, reason: "Keep at least one stage." };
  }
  if (kind === "tip" && key === START) {
    return { kind: "none", reason: "The run always starts by loading tips, so these can't be removed." };
  }
  return { kind: "button", disabled: false };
}

// Removes what the open box edits, at once, and closes the box (section 10).
function removeFromEditingBox() {
  const plan = currentPlan();
  const { kind, key } = editingBox;
  if (kind === "component") {
    removeComponentFromBox(plan, key);
  } else if (kind === "stage") {
    removeStageFromBox(plan, key);
  } else {
    closeEditingBox();
    if (tryEdit(() => removeTipChange(plan, key)) !== false) {
      showMessage("Removed the new tips: the stages after them keep the tips before.", "note");
    }
  }
}

// Removes a component (section 8). If it was picked, the first component left is picked, or the
// eraser if none is.
function removeComponentFromBox(plan, name) {
  const wells = countWellsWith(plan, name);
  const removed = tryLogic(() => removeComponent(plan, name));
  if (removed === false) {
    return;
  }
  closeEditingBox();
  if (brush.pick.kind === "component" && brush.pick.name === name) {
    const first = removed.components[0];
    brush.pick = first === undefined ? { kind: "eraser" } : { kind: "component", name: first.name };
  }
  recordEdit(removed);
  const from = wells === 0 ? "" : ` from ${countOf(wells, "well")}`;
  showMessage(`Removed ${name}${from}. Undo can bring it back.`, "note");
}

// A stage's transfers counted for Remove's message (section 10): "4 transfers", or for a mix step
// "4 mixed wells".
function transfersWord(plan, id, count) {
  return isMixStep(plan, id) ? countOf(count, "mixed well") : countOf(count, "transfer");
}

// Removes a stage (section 10). If it was open, the first stage in the stage order opens.
function removeStageFromBox(plan, id) {
  const transfers = transfersIn(plan, id).length;
  const label = stageLabel(plan, id);
  const removed = tryLogic(() => removeStage(plan, id));
  if (removed === false) {
    return;
  }
  closeEditingBox();
  const open = currentOpen() === id ? stageOrder(removed)[0] : currentOpen();
  recordEdit(removed, open);
  const andTransfers = transfers === 0 ? "" : ` and its ${transfersWord(plan, id, transfers)}`;
  showMessage(`Removed ${label}${andTransfers}. Undo brings it back.`, "note");
}

// Saves the open box's changes as one undoable edit and closes it. If the logic refuses, its message
// is shown and the box stays open. A box without changes just closes.
function saveEditingBox() {
  if (!isBoxDirty()) {
    closeEditingBox();
    return;
  }
  const plan = currentPlan();
  const { kind, key, draft } = editingBox;
  const saved = tryLogic(() => {
    if (kind === "component") {
      return saveComponentDraft(plan, key, draft);
    }
    if (kind === "stage") {
      // The message names the stage as it is after saving, so a renamed stage is named by its new name.
      const savedPlan = saveStageDraft(plan, key, draft);
      return { plan: savedPlan, message: `Saved ${stageLabel(savedPlan, key)}.` };
    }
    return saveTipDraft(plan, key, draft);
  });
  if (saved === false) {
    return;
  }
  closeEditingBox();
  recordEdit(saved.plan);
  showMessage(saved.message, "ok");
}

// A component's Save: renames it and recolors it, as one edit, returning { plan, message }. If it
// was picked, it stays picked. Throws as renameComponent and setComponentColor do.
function saveComponentDraft(plan, name, draft) {
  let saved = renameComponent(plan, name, draft.name);
  const newName = draft.name.trim();
  if (draft.color !== plan.components.find((component) => component.name === name).color) {
    saved = setComponentColor(saved, newName, draft.color);
  }
  // Both edits passed, so the picked component can follow the new name.
  if (brush.pick.kind === "component" && brush.pick.name === name) {
    brush.pick = { kind: "component", name: newName };
  }
  return { plan: saved, message: `Saved ${newName}.` };
}

// A stage's Save: renames it (if the name changed) and changes its settings, as one edit
// (changeStageSettings, which checks them); a mix step's Save only renames it. The settings are built end by end (stageEndSettings),
// from the draft's mode and Mix (section 10).
function saveStageDraft(plan, id, draft) {
  const stage = plan.stageList.get(id);
  const saved = draft.name === stage.name ? plan : renameStage(plan, id, draft.name);
  if (draft.mixStep === true) {
    // A mix step's box changes only its name (section 10).
    return saved;
  }
  const settings = { ...stage.settings };
  for (const boxEnd of BOX_ENDS) {
    Object.assign(settings, stageEndSettings(stage.settings, boxEnd, draft[boxEnd.mode], draft[boxEnd.mix]));
  }
  return changeStageSettings(saved, id, settings);
}

// One end's settings as Save builds them (section 10), from the stage's `settings`, the draft's mode
// `name` for the end and whether its Mix is `checked`. An end still showing "(not one of the modes)"
// (`name` null) keeps its technique, liquid type and mix. Otherwise the mode's settings, with its
// mixing technique when Mix is checked (modeSettings, which throws for a mode that can't mix), and
// the end's mix: its own if it already mixes, else DEFAULT_MIX, or null when Mix is unchecked, e.g.
// ({…no mixing…}, the source, "Slow", true) → { sourceTechnique: "OperationMix",
// sourceLiquidType: "Slow", sourceMix: { share: 90, times: 3, speed: 400 } }.
function stageEndSettings(settings, boxEnd, name, checked) {
  const mixSetting = `${boxEnd.end}Mix`;
  if (name === null) {
    return {};
  }
  return {
    ...modeSettings(boxEnd.end, name, checked),
    [mixSetting]: checked ? (settings[mixSetting] ?? DEFAULT_MIX) : null,
  };
}

// A tip change's Save: sets its tip type and probes as one edit, returning { plan, message },
// e.g. the message "New tips: BC230 on 4 probes." Throws as setTipType and setTipProbes do.
function saveTipDraft(plan, key, draft) {
  const saved = setTipProbes(setTipType(plan, key, draft.tipType), key, draft.probes);
  return {
    plan: saved,
    message: `New tips: ${draft.tipType} on ${countOf(draft.probes.length, "probe")}.`,
  };
}

// Watches every press on the page: while an editing box is open, a press outside it closes the box
// if it has no changes (and the press still does what it would), or, with unsaved changes, does
// nothing else: the box shakes, Save and Discard pulse, and the message bar says what to do.
function connectEditingBoxGuard() {
  document.addEventListener("pointerdown", guardEditingBox, true);
  document.addEventListener("mousedown", guardEditingBox, true);
  document.addEventListener("click", guardEditingBox, true);
}

// The ✎ whose box a press just closed, until that press's click has passed, so the click doesn't
// open the box again.
let pencilJustClosed = null;

// One press event's share of the guard above: pointerdown decides and shows the refusal, mousedown
// and click are stopped too so nothing else acts on a refused press.
function guardEditingBox(event) {
  if (pencilJustClosed !== null && event.type === "click") {
    const pencil = pencilJustClosed;
    pencilJustClosed = null;
    if (pencil.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }
  if (editingBox === null || editingBox.element === undefined) {
    return;
  }
  if (editingBox.element.contains(event.target)) {
    return;
  }
  if (!isBoxDirty()) {
    if (event.type === "pointerdown") {
      // The ✎ closes its box as a click outside would, and nothing more.
      pencilJustClosed = editingBox.pencil.contains(event.target) ? editingBox.pencil : null;
      closeEditingBox();
    }
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (event.type === "pointerdown") {
    refuseOutsideClick();
  }
}

// Watches every press on the page while a label or volume box is open (sections 6 and 7). A press
// outside the box saves it as the press starts, then passes the click on to whatever is now under
// the pointer (saving redraws the page), and the rest of that press is stopped, so nothing acts on
// it twice. The click isn't passed on if it wasn't the main button (a right click does nothing on
// the page), or if the logic refused what the box held, so its message stays in view.
function connectInlineBoxGuard() {
  document.addEventListener("pointerdown", guardInlineBox, true);
  for (const type of ["mousedown", "pointerup", "mouseup", "click"]) {
    document.addEventListener(type, stopPassedOnPress, true);
  }
  // The press is over once the pointer is released; its click, if the browser sends one, comes
  // right after the release, so the flag is cleared a moment later. (No click comes when what was
  // pressed has been redrawn, so the release, not the click, is what ends the press.)
  for (const type of ["pointerup", "pointercancel"]) {
    document.addEventListener(type, () => setTimeout(endPassedOnPress, 0), true);
  }
}

// True from a press that an inline box's saving passed on, until that press is over.
let pressPassedOn = false;

// Ends a passed-on press, so the next press is acted on.
function endPassedOnPress() {
  pressPassedOn = false;
}

// The press's pointerdown: saves an open inline box pressed outside, and passes the click on.
function guardInlineBox(event) {
  pressPassedOn = false;
  if (inlineBox === null || inlineBox.box.contains(event.target)) {
    return;
  }
  const outcome = inlineBox.finish("away");
  event.preventDefault();
  event.stopPropagation();
  const target = document.elementFromPoint(event.clientX, event.clientY);
  if (event.button === 0 && outcome !== "refused" && target instanceof HTMLElement) {
    // A made click: it bubbles to the button it's inside, and a well treats it as a keyboard click.
    target.click();
  }
  // Set only after the made click, which this flag would otherwise stop too.
  pressPassedOn = true;
}

// The rest of a passed-on press: stopped, so nothing acts on it twice.
function stopPassedOnPress(event) {
  if (!pressPassedOn) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (event.type === "click") {
    endPassedOnPress();
  }
}

// Shows that a click outside a box with unsaved changes was refused (section 10).
function refuseOutsideClick() {
  const box = editingBox.element;
  restartAnimation(box, "shake");
  for (const button of box.querySelectorAll(".save, .discard")) {
    restartAnimation(button, "pulse");
  }
  showMessage("Save or discard your changes first.", "note");
}

// Plays an animation class on an element again, even if it's still running.
function restartAnimation(element, className) {
  element.classList.remove(className);
  // Reading offsetWidth makes the browser apply the removal before the class is added again.
  void element.offsetWidth;
  element.classList.add(className);
  element.addEventListener("animationend", () => element.classList.remove(className), { once: true });
}

// --- Keys (section 12) ---

// Connects the page's keys: volumes, Escape, undo and redo. None while typing in a text box or
// menu.
function connectKeys() {
  document.addEventListener("keydown", handleKey);
}

// Acts on one key press (section 12).
function handleKey(event) {
  if (event.target.matches("input, select, textarea, [contenteditable]")) {
    return;
  }
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      if (editingBox === null) {
        undo();
      }
    } else if (key === "y" || (key === "z" && event.shiftKey)) {
      event.preventDefault();
      if (editingBox === null) {
        redo();
      }
    }
    return;
  }
  if (event.key === "Escape") {
    pressEscape();
    return;
  }
  if (isVolumeKey(event.key)) {
    event.preventDefault();
    typeVolume(event.key);
  }
}

// Escape closes the open editing box without saving, or the open header box (Biomek files' or
// Reset's), putting the focus back on its button; otherwise it clears a chosen source.
function pressEscape() {
  if (editingBox !== null) {
    closeEditingBox();
  } else if (!elements.biomekBox.hidden) {
    closeBiomekBox();
    elements.biomekFiles.focus();
  } else if (!elements.resetBox.hidden) {
    closeResetBox();
    elements.reset.focus();
  } else if (source !== null) {
    clearSource();
  }
}

// True for the keys that type a volume: digits, "." and Backspace.
function isVolumeKey(key) {
  return /^[0-9]$/.test(key) || key === "." || key === "Backspace";
}

// Types one key into the volume that's being used: the brush's while Start is open (not with the
// eraser), the next transfer's while a stage is open; nothing while End is open.
function typeVolume(key) {
  const open = currentOpen();
  if (open === END) {
    return;
  }
  if (open === START) {
    if (brush.pick.kind === "eraser") {
      return;
    }
    typeVolumeKey(brush.volume, key);
    refreshStages();
  } else {
    typeVolumeKey(transferVolume, key);
  }
  updateCursorLabel();
}

// --- Typing volumes and showing numbers (section 13) ---

// A typed volume starting at `number`: { text, startsNew }. startsNew means the next key starts a
// new number rather than adding to this one.
function newTypedVolume(number) {
  return { text: String(number), startsNew: true };
}

// Types `key` (a digit, "." or "Backspace") into a typed volume. The first key after an edit starts
// a new number: a digit replaces the volume, "." gives "0.", Backspace empties it. Later keys add to
// it: digits and one "." at the end, Backspace removing the last character.
function typeVolumeKey(volume, key) {
  if (volume.startsNew) {
    volume.startsNew = false;
    volume.text = key === "Backspace" ? "" : key === "." ? "0." : key;
    return;
  }
  if (key === "Backspace") {
    volume.text = volume.text.slice(0, -1);
  } else if (key === ".") {
    if (!volume.text.includes(".")) {
      volume.text += ".";
    }
  } else {
    volume.text += key;
  }
}

// How a typed volume is shown: its text, or "?" when it's empty.
function volumeShown(volume) {
  return volume.text === "" ? "?" : volume.text;
}

// What a typed volume is passed on as: a number if the text is one (digits, optionally "-", and a
// decimal part), otherwise the text as typed, so the logic's message says what's wrong.
function volumeValue(text) {
  return /^-?(\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : text;
}

// A volume for cards, lists and messages: rounded to 2 decimal places, e.g. 33.33; below 0.01 µL
// but not 0, in exponent form with one decimal, e.g. "4.0e-3".
function formatVolume(volume) {
  if (volume !== 0 && Math.abs(volume) < 0.01) {
    return volume.toExponential(1);
  }
  return String(Number(volume.toFixed(2)));
}

// A volume inside a well (short form): "<1" below 1; thousands with "k" from 10,000, e.g. "12k";
// otherwise a whole number.
function formatShortVolume(volume) {
  if (volume < 1) {
    return "<1";
  }
  if (volume >= 10000) {
    return `${Math.round(volume / 1000)}k`;
  }
  return String(Math.round(volume));
}

// A percentage for the contents card: rounded to 2 decimal places, e.g. "16.67%"; below 0.01% but
// not 0, in exponent form, e.g. "4.0e-3%".
function formatPercent(percent) {
  return `${formatVolume(percent)}%`;
}

// A count with its noun, plural except for 1, e.g. countOf(1, "well") → "1 well", (3) → "3 wells".
function countOf(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// --- Names in messages (section 12) ---

// A stage named by place and name, e.g. 'stage 3, “New stage”'.
function stageLabel(plan, id) {
  return `stage ${stageOrder(plan).indexOf(id) + 1}, “${plan.stageList.get(id).name}”`;
}

// A well named by its labware's label and the well, e.g. "Assay plate A1".
function wellName(plan, end) {
  return `${labelOf(plan, end.labware)} ${end.well}`;
}

// --- The message bar (section 12) ---

// Shows a message of a kind ("ok", "note" or "error") in the message bar, replacing the last.
function showMessage(text, kind) {
  const bar = elements.messageBar;
  bar.textContent = text;
  bar.className = `message-bar ${kind}`;
  bar.hidden = false;
}

// Takes the message away: the bar is hidden when empty (section 12).
function hideMessage() {
  const bar = elements.messageBar;
  bar.textContent = "";
  bar.hidden = true;
}

// --- The Stages column's fit and scrolling (sections 3 and 7) ---

// Fits the Stages column so it ends STAGES_BOTTOM_MARGIN above the bottom of the window, wherever
// its top is, and never past the bottom of the area holding both panels, in the side-by-side
// layout. In the stacked layout it's as tall as its contents.
function fitStagesColumn() {
  const column = elements.stagesColumn;
  if (!wideLayout.matches) {
    column.style.removeProperty("--stages-max-height");
    return;
  }
  // The column is pinned at STAGES_BOTTOM_MARGIN from the top of the window once the page has
  // scrolled that far; before that its top is the area's top. Measuring the area rather than the
  // column itself keeps the fit from depending on the column's own height.
  const area = elements.workspace.getBoundingClientRect();
  const top = Math.max(area.top, STAGES_BOTTOM_MARGIN);
  const bottom = Math.min(window.innerHeight - STAGES_BOTTOM_MARGIN, area.bottom);
  column.style.setProperty("--stages-max-height", `${Math.max(bottom - top, 0)}px`);
}

// Scrolls the Stages column just enough to show `element`, if there is one.
function scrollIntoColumnView(element) {
  if (element === null || element === undefined) {
    return;
  }
  element.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
}

// Scrolls the Stages column smoothly, just enough to show the whole of `card` (section 7); a card
// taller than the column is shown from its top, so a transfer list starts at its first transfer.
function scrollCardIntoView(card) {
  if (card === null) {
    return;
  }
  const tallerThanColumn = card.offsetHeight > elements.stagesColumn.clientHeight;
  card.scrollIntoView({ block: tallerThanColumn ? "start" : "nearest", behavior: scrollBehavior() });
}

// How the column scrolls: smoothly, or at once with the system's "reduce motion" setting.
function scrollBehavior() {
  return reduceMotion.matches ? "auto" : "smooth";
}

// --- Small helpers ---

// A text box that edits a value in place (a label or a volume), the one inline box that's open.
// Enter calls onSave(text, "enter") and clicking away (or leaving it any other way) onSave(text,
// "away"); Escape calls onCancel. onSave returns what became of the box: "closed"; "refused" (the
// logic refused the text, and the box closed); or "kept-open", to keep it open with what was typed,
// selected, to fix it. Each ending is acted on at most once, and saving returns onSave's answer
// (or undefined if the box had already ended).
function createInlineEditor({ value, className, accessibleName, onSave, onCancel }) {
  const box = document.createElement("input");
  box.type = "text";
  box.className = className;
  box.value = value;
  box.setAttribute("aria-label", accessibleName);
  let done = false;
  // Ends the box with `action` (saving or cancelling), at most once, and returns its answer; a
  // saving that answers "kept-open" keeps the box open instead.
  const finish = (action) => {
    if (done) {
      return undefined;
    }
    done = true;
    if (inlineBox !== null && inlineBox.box === box) {
      inlineBox = null;
    }
    const outcome = action();
    if (outcome === "kept-open") {
      // Kept open: it's the open inline box again, and the next ending is acted on.
      done = false;
      inlineBox = { box, finish: save };
      box.select();
    }
    return outcome;
  };
  // Saves the box's text, `how` being "enter" or "away".
  const save = (how) => finish(() => onSave(box.value, how));
  box.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save("enter");
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finish(onCancel);
    }
  });
  box.addEventListener("blur", () => save("away"));
  inlineBox = { box, finish: save };
  return box;
}

// A small circle of a color.
function createSwatch(color) {
  const swatch = createElement("span", "", "swatch");
  swatch.style.setProperty("--swatch-color", color);
  return swatch;
}

// The color of the component called `name`, or gray if the plan has no such component.
function componentColor(plan, name) {
  return plan.components.find((component) => component.name === name)?.color ?? GRAY;
}

// True if the plan has a component called `name`.
function hasComponent(plan, name) {
  return plan.components.some((component) => component.name === name);
}

// One text key for a well, e.g. { labware: "Res", well: "1" } → '["Res","1"]'. A JSON list keeps the
// two names apart, as in contents-tracking.
function wellKey(end) {
  return JSON.stringify([end.labware, end.well]);
}

// wellKey for a well that may be null.
function wellKeyOrNull(end) {
  return end === null ? null : wellKey(end);
}

// Escapes text for use inside a CSS attribute selector.
function cssEscape(text) {
  return CSS.escape(text);
}

// A new element of the given kind holding text, with a class if given,
// e.g. createElement("li", "Ready", "note").
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

// The element of transfer-designer.html with this id.
function byId(id) {
  return document.getElementById(id);
}
