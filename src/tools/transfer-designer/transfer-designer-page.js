// transfer-designer-page.js — the transfer designer page's behavior: it keeps the plan's history,
// passes on what the user does to the logic modules, and draws the result.
//
// The page has no rules of its own about plans (transfer-designer-page.md, section 1). Every edit
// goes through transfer-designer.js, undo and redo through plan-history.js, saving and opening
// through plan-file.js, the labware through deck.js, what each well holds through
// contents-tracking.js, how much each mixed well is mixed through mix-volumes.js, a randomization's
// seed and spare wells through random-pool.js, a pasted table's text through pasted-table.js, and
// the Biomek files through file-writer.js and zip.js. When one of them
// refuses an edit, the page shows its message and changes nothing. What this file decides is only
// how things look and how the user does them: how typing a volume works, how numbers are shown,
// where boxes float, and what each message says.
// Specification: transfer-designer-page.md.

import packageJson from "../../../package.json" with { type: "json" };
import { COMPONENT_COLORS } from "../../../config/component-colors.js";
import { DEFAULT_TRANSFER_VOLUME, DEFAULT_FILL_VOLUME } from "../../../config/default-volumes.js";
import { SOURCES_SHOWN } from "../../../config/randomizations.js";
import { TIP_TYPES, MIX_VOLUME_LIMITS } from "../../../config/tip-types.js";
import { MIN_MIX_VOLUME } from "../../../config/mixing.js";
import { BASE_FOLDER } from "../../../config/paths.js";
import { replay } from "../../shared/contents-tracking/contents-tracking.js";
import { mixVolumes } from "../../shared/mix-volumes/mix-volumes.js";
import { randomSeed, MAX_SEED } from "../../shared/random-pool/random-pool.js";
import {
  labwareNames,
  gridOf,
  labwareTypeOf,
  wellsInBox,
  growthAreaOf,
} from "../../shared/deck/deck.js";
import { writeRunFiles, checkExperimentName } from "../../shared/file-writer/file-writer.js";
import { zipFiles } from "../../shared/zip/zip.js";
import { parsePastedTable } from "../../shared/pasted-table/pasted-table.js";
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
  addStageWithNewTips,
  addMixStepWithNewTips,
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
  tipsUsed,
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
  wellLabelOf,
  setWellLabel,
  addRandomization,
  randomizationAt,
  randomizationOf,
  setRandomization,
  placeRandomization,
  randomizationProblems,
  fillerShares,
  sourceGroups,
  setSourceSharesTips,
  moveSource,
  removeSources,
  tipSetsToMake,
  isRandomizationOutOfDate,
  sourceName,
  runRandomization,
  removeRandomization,
  canRemoveRandomization,
  setConstituents,
  concentrationsOf,
  setOsmolality,
  osmolalityOf,
  seedingDensitiesOf,
  columnBoxes,
  moveItems,
  copyOf,
  copyItems,
  pasteItems,
  COPIED_ITEMS_FORMAT,
  moveWell,
  readTransferTable,
  stockWellsOf,
  transferTableProblems,
  sourceSplit,
  transferTableStages,
  addTransferTable,
  updateTransferTable,
  removeTransferTable,
  canRemoveTransferTable,
  transferTableAt,
  transferTableOf,
  isTransferTableOutOfDate,
} from "./transfer-designer.js";
import {
  CONCENTRATION_UNITS,
  DEFAULT_CONCENTRATION_UNIT,
} from "../../../config/concentration-units.js";
import { bestUnit, familyOf, isCellFamily } from "../../shared/concentrations/concentrations.js";
import { isObject } from "../../shared/input-checks/input-checks.js";

// --- Constants ---

// The build's version, shown in the version line and recorded in saved plan files (sections 3 and 5;
// build-version.md, "The page's version"). npm run build replaces BUILD_VERSION with the full
// version, e.g. "0.2.0-dev.488+3cc65a9". Served unbuilt (npm run serve) there's no BUILD_VERSION, so
// `typeof` is used to check for it without an error, and the page says package.json's version and
// "-unbuilt" instead, e.g. "0.2.0-unbuilt".
const PAGE_VERSION =
  typeof BUILD_VERSION === "string" ? BUILD_VERSION : `${packageJson.version}-unbuilt`;

// Who saved a plan file: the tool and the build's version (section 5).
const SAVED_BY = `transfer designer v${PAGE_VERSION}`;

// The key the browser copy of the plan is stored under, in the browser's local storage (section 5).
const STORAGE_KEY = "biomek-tools transfer designer: plan";

// The key the page's copy of copied items is stored under, in the browser's local storage, shared
// by every tab of the designer (section 7, "Moving and copying").
const COPIED_ITEMS_KEY = "biomek-tools transfer designer: copied items";

// While dragging in the Stages column: the drop line looks for seams while the pointer is within
// this far (in pixels) of the column's sides, and the column scrolls when it's within this far of
// its top or bottom, by COLUMN_SCROLL_STEP per pointer move (section 7).
const COLUMN_DROP_MARGIN = 40;
const COLUMN_SCROLL_STEP = 12;

// The drag's label sits this far from the pointer (section 7).
const DRAG_LABEL_OFFSET = { x: 14, y: 10 };

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

// A typed amount that's a number (section 13, "Typing an amount"): optionally "-", then digits with
// an optional decimal point and part, or a decimal part alone, then an optional exponent, e.g.
// "1.5e6", ".5", "5.", "2e+5".
const TYPED_AMOUNT_PATTERN = /^-?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

// The superscript digits a cell figure's power of ten is written in (section 13), by digit.
const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

// The unit of a well's seeding density on the contents card (section 6): cells per cm² of its
// growth area. A unit of the page's display, not a concentration unit of the configuration.
const SEEDING_DENSITY_UNIT = "cells/cm²";

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

// Whether labeled wells show their label in place of their volume (the Names toggle, section 6).
let wellLabelsShown = true;

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

// The text box editing something in place, if one is open: a labware's label or a well's name
// (section 6), or a transfer's volume (section 7): { box, finish }, where finish("away") saves it as a click away
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

// The name box while it's open (section 6, "Naming a well"): { box, end }, the text box and the
// well it names. It's also the open inline box (inlineBox), so clicking away saves it.
let nameBox = null;

// A press with a button other than the main one (a right click), as it started: { foundOpen }, true
// if a text box, an editing box or a header box was open then. The press closes or saves that box
// before its context menu event comes, so the event can't tell by itself; such a right click
// doesn't name the well (section 6). Null when the last press was a main-button one, or once its
// context menu event has come.
let secondaryPress = null;

// The "+ New" component box while it's open: { text }, or null.
let addingComponent = null;

// The open randomization's card (section 7, "Randomizations"), or null: { id, draft, returnTo,
// element }. `draft` holds its unsaved changes as the card shows them (draftOf); `returnTo` is the
// entry that was open before it, which opens again when it closes; `element` is the card as drawn.
let card = null;

// The tab each randomization's card was last left on ("sources" or "fill"), by its ID (section 7:
// one opened again opens on the tab it was last left on).
const cardTabs = new Map();

// The randomizations whose card shows every source, not only the first SOURCES_SHOWN, by ID.
const sourcesShownInFull = new Set();

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

// The stage and tip group keys drawn last time, and the first stage of each box ("box-first:"), for
// the glow (section 7); null before the first drawing, when nothing glows.
let lastDrawnKeys = null;

// When each glow started (performance.now()), by key, so it carries on through redrawing.
const glows = new Map();

// The keys ("stage:5", "randomization:r2") a move, copy or paste just placed, which glow at the
// next drawing even though they were drawn before (section 7, "What changed glows").
const glowsToStart = new Set();

// The picked set in the Stages column (section 7, "Moving and copying"): a list of items, each
// { kind, id }, or null, when what's selected is what's open.
let pickedSet = null;

// The last item clicked or Ctrl-clicked in the column, the anchor for Shift-click, or null.
let selectionAnchor = null;

// The page's copy of copied items, for a browser without local storage (section 4); the latest copy
// in any tab is read from local storage first (COPIED_ITEMS_KEY).
let copiedInMemory = null;

// A press on an item's handle in the Stages column that may become a drag: { item, x, y, pointerId },
// or null.
let columnPress = null;

// The drag in the Stages column, while one is on: { items, copying, refused, before, place, pointer },
// `before` being the selection when it started ({ pickedSet, selectionAnchor }), or null.
let columnDrag = null;

// The right-click menu, while it's open: { element, seam }, or null.
let columnMenu = null;

// True when a press in the Stages column became a drag, so the click that follows it is ignored.
let swallowNextClick = false;

// Whether moving wells is on (section 6, "Moving wells"); off when the page opens.
let movingWells = false;

// The well picked to move while moving wells, { labware, well }, or null.
let pickedWell = null;

// The wells in use and the wells to fill of one plan, worked out once for it, since moving wells
// asks about every well each time the deck is drawn: { plan, used, toFill }, two Sets of wellKeys,
// or null before the first time (movingWellSets).
let movingWellCache = null;

// The randomizations that are out of date (section 6), worked out once per plan and reused by the
// headings, the problem count, the card and the Biomek files box, since each check reruns a
// randomization on a copy: a Set of their IDs for each plan asked about. Plans are never changed,
// so a plan's answer never goes stale; a WeakMap lets a plan no longer held be forgotten.
const outOfDateByPlan = new WeakMap();

// The transfer tables found out of date (section 6), worked out once per plan as for
// randomizations, since each check reads its table again.
const tablesOutOfDateByPlan = new WeakMap();

// The transfer table wizard while it's open (section 7, "The wizard"), or null: see openNewWizard.
let wizard = null;

// The IDs of the transfer tables whose box is open, showing its stages (section 7, "Its box"):
// remembered while the page is open, not saved in plan files and not an undo step.
const openTables = new Set();

// The open entry when refresh last looked, so a transfer table's box opens once when one of its
// stages becomes the open entry, and can then be closed by its heading.
let openEntrySeen = null;

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
  moveWells: byId("move-wells"),
  movingBar: byId("moving-bar"),
  undo: byId("undo"),
  redo: byId("redo"),
  problemCount: byId("problem-count"),
  tray: byId("labware-tray"),
  key: byId("key"),
  componentsBar: byId("components-bar"),
  componentColors: byId("component-colors"),
  namesToggle: byId("names-toggle"),
  arrowsToggle: byId("arrows-toggle"),
  labwareArea: byId("labware-area"),
  noLabwareNote: byId("no-labware-note"),
  arrowLayer: byId("arrow-layer"),
  stagesColumn: byId("stages-column"),
  stagesList: byId("stages-list"),
  messageBar: byId("message-bar"),
  dragLabel: byId("drag-label"),
  dropLine: byId("drop-line"),
  columnMenu: byId("column-menu"),
  cursorLabel: byId("cursor-label"),
  contentsCard: byId("contents-card"),
  pageVersion: byId("page-version"),
  wizardBackdrop: byId("wizard-backdrop"),
  wizard: byId("wizard"),
};

setUpPage();

// --- Setting up ---

// Brings back the browser copy or starts with an empty plan (section 5), connects every control,
// and draws the page.
function setUpPage() {
  elements.pageVersion.textContent = PAGE_VERSION;
  startFromBrowserCopy();
  connectHeader();
  connectDeckBars();
  connectDeck();
  // Before the box guards, so it sees what was open before they close it.
  connectWellNaming();
  connectKeys();
  connectMovingAndCopying();
  connectEditingBoxGuard();
  connectInlineBoxGuard();
  connectHeaderBoxGuard();
  connectWizard();
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
    // An open randomization's card closes first, as Close would (section 7).
    if (!closeRandomizationCard()) {
      return;
    }
    // Clearing the value first means choosing the same file again still counts as a change.
    elements.openFile.value = "";
    elements.openFile.click();
  });
  elements.openFile.addEventListener("change", openChosenFile);
  elements.reset.addEventListener("click", toggleResetBox);
  elements.resetCancel.addEventListener("click", closeResetBox);
  elements.resetEverything.addEventListener("click", resetEverything);
}

// Connects the deck panel's two bars (sections 6 and 11): the timeline, Move wells, Undo, Redo,
// Names and Arrows.
function connectDeckBars() {
  elements.previousPoint.addEventListener("click", () => openNeighbour(-1));
  elements.nextPoint.addEventListener("click", () => openNeighbour(1));
  elements.moveWells.addEventListener("click", toggleMovingWells);
  elements.undo.addEventListener("click", undo);
  elements.redo.addEventListener("click", redo);
  elements.namesToggle.addEventListener("click", () => {
    wellLabelsShown = !wellLabelsShown;
    elements.namesToggle.setAttribute("aria-pressed", String(wellLabelsShown));
    refreshDeck();
  });
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
  // After any edit, Undo or Redo, what's open is selected again (section 7, "Selecting"); a move,
  // copy or paste selects what it placed afterwards.
  forgetPickedSet();
  brush.volume.startsNew = true;
  transferVolume.startsNew = true;
  closeBiomekBox();
  storeBrowserCopy();
  refresh();
}

// Opens Start, a stage, End or a randomization's card (section 7). It replaces the current state
// rather than recording one, so it isn't an undo of its own (section 4). An open randomization's
// card closes first, as Close would, and if it can't, nothing else happens. Closes any editing box
// and clears any source, since both belong to what was open, then scrolls the column to show the
// opened entry. A card remembers what was open before it, to open again when it closes.
function openEntry(key) {
  if (key === currentOpen()) {
    return;
  }
  const before = card === null ? currentOpen() : card.returnTo;
  if (!closeRandomizationCard()) {
    return;
  }
  closeEditingBox();
  source = null;
  // Opening anything forgets the picked set, so what's open is selected (section 7, "Selecting").
  forgetPickedSet();
  if (isRandomization(currentPlan(), key)) {
    card = newCard(currentPlan(), key, before);
  }
  history = history.replacePresent({ plan: currentPlan(), open: key });
  refresh();
  scrollIntoColumnView(elements.stagesList.querySelector(`[data-entry="${cssEscape(key)}"]`));
}

// Opens the entry before (`direction` -1) or after (1) the open one, in the order Start, the stages
// in stage order, End (section 11). A randomization isn't a stop: from its card, › opens the entry
// it sits before (its first stage once run) and ‹ the one before that.
function openNeighbour(direction) {
  const plan = currentPlan();
  const entries = allEntries(plan);
  const open = currentOpen();
  let next;
  if (isRandomization(plan, open)) {
    const place = entries.indexOf(randomizationPlace(plan, open) ?? END);
    next = entries[direction > 0 ? place : place - 1];
  } else {
    next = entries[entries.indexOf(open) + direction];
  }
  if (next !== undefined) {
    openEntry(next);
  }
}

// Every entry of the Stages column in order: START, the stage IDs in stage order, END.
function allEntries(plan) {
  return [START, ...stageOrder(plan), END];
}

// Undoes the last edit (section 6). Not while a randomization's card is open (section 12).
function undo() {
  if (!history.canUndo() || card !== null) {
    return;
  }
  history = history.undo();
  afterPlanChange();
  showMessage("Undone.", "note");
}

// Redoes the last undone edit (section 6). Not while a randomization's card is open (section 12).
function redo() {
  if (!history.canRedo() || card !== null) {
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
  // While moving wells no randomization's card opens (section 7, "While moving wells"): an undo or
  // redo back to one shows the point it sits at instead.
  if (movingWells && isRandomization(plan, currentOpen())) {
    const place = randomizationPlace(plan, currentOpen()) ?? END;
    history = history.replacePresent({ plan, open: place });
  }
  syncCard(plan, currentOpen());
  openTableOfNewlyOpenStage(plan);
  // Undo or redo can take the picked component away (e.g. undoing a rename): then, as when a picked
  // component is removed, the first component is picked, or the eraser if there's none.
  if (brush.pick.kind === "component" && !hasComponent(plan, brush.pick.name)) {
    const first = plan.components[0];
    brush.pick = first === undefined ? { kind: "eraser" } : { kind: "component", name: first.name };
  }
  // Undo or redo can leave the picked well unable to be picked: it's let go (section 6), and a drag
  // of it ends.
  if (pickedWell !== null && !canPickToMove(plan, pickedWell)) {
    pickedWell = null;
    if (drag !== null && drag.kind === "move") {
      drag = null;
      press = null;
      updateDragMarks();
    }
  }
  refreshHeading();
  refreshDeck();
  refreshStages();
  keepVolumeBoxTransferHighlighted();
  updateCursorLabel();
  requestAnimationFrame(fitStagesColumn);
}

// Opens the box of the transfer table whose stage has just become the open entry (section 7, "Its
// box"), once: after that, its heading can close it while the stage stays open.
function openTableOfNewlyOpenStage(plan) {
  const open = currentOpen();
  if (open === openEntrySeen) {
    return;
  }
  openEntrySeen = open;
  const owner = isStage(plan, open) ? transferTableOf(plan, open) : null;
  if (owner !== null) {
    openTables.add(owner);
  }
}

// Keeps the card in step with what's open: a randomization open (after redo, say) has its card,
// made from the plan if there's none for it yet; anything else open has none.
function syncCard(plan, open) {
  if (!isRandomization(plan, open)) {
    card = null;
  } else if (card === null || card.id !== open) {
    card = newCard(plan, open, START);
  }
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
  if (!closeRandomizationCard()) {
    return;
  }
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
// labware it uses, closes any editing box, clears any source, picks its first component, and ends
// moving wells.
function showReplacedPlan(plan, open) {
  // Opening a plan ends moving wells, as Done does, without its message (section 6).
  movingWells = false;
  pickedWell = null;
  closeEditingBox();
  card = null;
  source = null;
  addingComponent = null;
  bringOutUsedLabware(plan);
  pickFirstComponent(plan);
  // Another plan's transfer tables may reuse the IDs, so every box starts closed (section 7).
  openTables.clear();
  recordEdit(plan, open);
}

// Opens Reset's question under its button, focused on Cancel, or closes it if it's open. Opening
// it closes the Biomek files box.
function toggleResetBox() {
  if (!elements.resetBox.hidden) {
    closeResetBox();
    return;
  }
  if (!closeRandomizationCard()) {
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
// away. It ends moving wells, as Done does, without its message (section 6).
function resetEverything() {
  closeResetBox();
  movingWells = false;
  pickedWell = null;
  closeEditingBox();
  card = null;
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
// refuses the plan, its message is shown instead, unchanged, with Write files disabled. Before
// that, a randomization or transfer table that's out of date is named instead, as the writer never
// reads them.
function toggleBiomekBox() {
  if (!elements.biomekBox.hidden) {
    closeBiomekBox();
    return;
  }
  if (!closeRandomizationCard()) {
    return;
  }
  closeResetBox();
  const now = new Date();
  const summary = elements.biomekSummary;
  try {
    checkNoRandomizationOutOfDate(currentPlan());
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

// Throws if a randomization or transfer table of the plan is out of date (section 5), naming the
// first in the column's order by its first stage: 'A randomization (at stage 1, “Drug”) is out of
// date: open it and press Update.' or 'A transfer table (at stage 3, “Media”) is out of date: …'.
function checkNoRandomizationOutOfDate(plan) {
  const box = firstOutOfDateBox(plan);
  if (box !== null) {
    const what = box.kind === "randomization" ? "A randomization" : "A transfer table";
    throw new Error(
      `${what} (at ${stageLabel(plan, box.tipGroups[0].stages[0])}) is out of date: open it and press Update.`,
    );
  }
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
  // Undo and Redo are off while a randomization's card is open: its changes aren't in the plan yet.
  elements.undo.disabled = !history.canUndo() || card !== null;
  elements.redo.disabled = !history.canRedo() || card !== null;
  refreshMovingWellsControls(plan);
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
  // For a randomization's card, the stages before where it sits.
  const at = isRandomization(plan, open) ? randomizationPlace(plan, open) ?? END : open;
  const earlier = at === END ? order : order.slice(0, Math.max(order.indexOf(at), 0));
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
// End, for a stage, those up to the end of the last stage with transfers at or before it, and for a
// randomization's card, those before where it sits.
function operationCountShown(plan, open) {
  if (open === START) {
    return 0;
  }
  if (isRandomization(plan, open)) {
    const place = randomizationPlace(plan, open);
    return place === null ? plan.operationList.listOperations().length : operationCountBefore(plan, place);
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
  // From a randomization's card, both step somewhere: Start is before it and End after it at most.
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
  if (isRandomization(plan, open)) {
    const place = randomizationPlace(plan, open);
    return place === null ? "Randomizing, after all stages" : `Randomizing, before ${stageLabel(plan, place)}`;
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
// over its capacity) counts as one, and so does each randomization or transfer table that's out of
// date and each stage with a mix problem.
function refreshProblemCount(plan) {
  const count = problemCount(plan);
  elements.problemCount.textContent = count === 0 ? "No problems" : countOf(count, "problem");
  elements.problemCount.classList.toggle("ok", count === 0);
  elements.problemCount.classList.toggle("problems", count > 0);
}

// The number of problems in the whole plan, as the problem count shows it (section 6, "First bar"):
// each contents problem, each randomization or transfer table that's out of date, and each stage
// with a mix problem, e.g. 2.
function problemCount(plan) {
  return (
    replay(plan.startingContents, plan.operationList).listProblems().length +
    outOfDateRandomizations(plan).size +
    outOfDateTransferTables(plan).size +
    stagesWithMixProblem(plan).size
  );
}

// The IDs of the plan's transfer tables that are out of date (isTransferTableOutOfDate), as a Set,
// e.g. new Set(["t1"]), worked out once per plan (tablesOutOfDateByPlan; section 6).
function outOfDateTransferTables(plan) {
  if (!tablesOutOfDateByPlan.has(plan)) {
    const ids = new Set(
      plan.transferTables
        .filter((transferTable) => isTransferTableOutOfDate(plan, transferTable.id))
        .map((transferTable) => transferTable.id),
    );
    tablesOutOfDateByPlan.set(plan, ids);
  }
  return tablesOutOfDateByPlan.get(plan);
}

// The first box in the column's order that's a run randomization or a transfer table out of date
// (columnBoxes' box), or null (section 5).
function firstOutOfDateBox(plan) {
  const randomizations = outOfDateRandomizations(plan);
  const tables = outOfDateTransferTables(plan);
  const box = columnBoxes(plan).find(
    (candidate) =>
      (candidate.kind === "randomization" && randomizations.has(candidate.id)) ||
      (candidate.kind === "transferTable" && tables.has(candidate.id)),
  );
  return box ?? null;
}

// The IDs of the plan's randomizations that are out of date (isRandomizationOutOfDate), as a Set,
// e.g. new Set(["r1"]), worked out once per plan (outOfDateByPlan; section 6).
function outOfDateRandomizations(plan) {
  if (!outOfDateByPlan.has(plan)) {
    const ids = new Set(
      plan.randomizations
        .filter((randomization) => isRandomizationOutOfDate(plan, randomization.id))
        .map((randomization) => randomization.id),
    );
    outOfDateByPlan.set(plan, ids);
  }
  return outOfDateByPlan.get(plan);
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

// Brings a labware out, or puts it away. Putting labware away clears a source chosen on it, and lets
// go of a well picked to move on it (section 6).
function toggleLabwareOut(name) {
  if (labwareOut.has(name)) {
    labwareOut.delete(name);
    if (source !== null && source.labware === name) {
      source = null;
    }
    // As for a chosen source, putting away the labware a picked well is on lets go of it.
    if (pickedWell !== null && pickedWell.labware === name) {
      pickedWell = null;
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
// (section 6). A labeled well shows its label in place of its volume or name while Names is on, and
// its accessible name starts with the label either way.
function createWell(plan, end, isTrough) {
  const wellElement = createElement("button", "", "well");
  wellElement.type = "button";
  wellElement.classList.toggle("trough", isTrough);
  wellElement.dataset.labware = end.labware;
  wellElement.dataset.well = end.well;
  const components = shownSnapshot.componentsOf(end.labware, end.well);
  const total = shownSnapshot.totalVolumeOf(end.labware, end.well);
  const label = createElement("span", "", "well-label");
  let name;
  if (total === 0) {
    label.textContent = end.well;
    name = `${wellName(plan, end)}, empty`;
  } else {
    label.textContent = formatShortVolume(total);
    wellElement.classList.add("holding");
    wellElement.style.setProperty("--well-fill", fillGradient(plan, components, isTrough));
    name = `${wellName(plan, end)}, ${formatVolume(total)} µL`;
    // Holding only dead volume: a tip can reach none of it, so it's drawn under stripes.
    if (shownSnapshot.usableVolumeOf(end.labware, end.well) === 0) {
      wellElement.classList.add("dead-volume-only");
      name += ", all dead volume";
    }
  }
  const wellLabel = wellLabelOf(plan, end);
  if (wellLabel !== null) {
    name = `${wellLabel}, ${name}`;
    if (wellLabelsShown) {
      showWellLabel(label, wellLabel);
    }
  }
  wellElement.setAttribute("aria-label", name);
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

// Shows a well's label (its well label, `text`) in `label`, the tag that otherwise holds its volume
// or name (section 6): semibold in the page's text font, wrapping at spaces onto at most two lines,
// or, for a single word, on one line in slightly smaller type; cut with "…" if it still doesn't fit
// (transfer-designer.css does the wrapping and cutting). A trough turns it upright.
function showWellLabel(label, text) {
  label.textContent = text;
  label.classList.add("named");
  // \s matches any space, so "Cond 1" wraps and "Staurosporine" is a single word.
  label.classList.toggle("single-word", !/\s/.test(text));
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
  // While moving wells, the open stage's fading is off, so only one kind of dimming shows (section 6).
  if (transfers.length > 0 && !movingWells) {
    const touched = new Set(transfers.flatMap((transfer) => [wellKey(transfer.source), wellKey(transfer.destination)]));
    for (const [key, wellElement] of wellElements) {
      wellElement.classList.toggle("faded", !touched.has(key));
    }
  }
  if (source !== null) {
    wellElements.get(wellKey(source))?.classList.add("source");
  }
  markMovingWells(plan);
  // A randomization's sources and wells to fill, from its card's draft, while it's open (section 6).
  if (card !== null) {
    for (const entry of card.draft.sources) {
      wellElements.get(wellKey(entry))?.classList.add("source");
    }
    for (const end of card.draft.fill) {
      wellElements.get(wellKey(end))?.classList.add("to-fill");
    }
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

// Redraws the Stages column from the plan: Start, the tip group boxes with their stages, each
// randomization's and transfer table's box where it sits (columnBlocks), End, a seam between tip
// groups above each box and above End, and the open editing box.
function refreshStages() {
  const plan = currentPlan();
  const open = currentOpen();
  const problems = stageProblems(plan);
  const blocks = columnBlocks(plan);
  const drawnKeys = new Set();
  const items = [createEntry(plan, START, open, problems)];
  // Tip group boxes alternate light blue and light sand, counting those inside randomizations too.
  let groupIndex = 0;
  blocks.forEach((block, index) => {
    items.push(withDropPlace(createSeamBetweenGroups(plan, seamPlace(blocks, index)), betweenBoxes(index)));
    if (block.kind === "group") {
      items.push(createTipGroupBox(plan, block, groupIndex, open, problems, drawnKeys, false, index));
      groupIndex += 1;
    } else if (block.kind === "randomization") {
      items.push(createRandomizationBox(plan, block, groupIndex, open, problems, drawnKeys));
      groupIndex += block.groups.length;
    } else {
      items.push(createTransferTableBox(plan, block, groupIndex, open, problems, drawnKeys, index));
      groupIndex += block.groups.length;
    }
  });
  const lastSeam = createSeamBetweenGroups(plan, seamPlace(blocks, blocks.length));
  items.push(withDropPlace(lastSeam, betweenBoxes(blocks.length)));
  items.push(createEntry(plan, END, open, problems));
  elements.stagesList.replaceChildren(...items);
  // While moving wells, the ✎ buttons, the ×s and the seams are hidden, their space kept (section 7).
  elements.stagesList.classList.toggle("moving-wells", movingWells);
  lastDrawnKeys = drawnKeys;
  glowsToStart.clear();
  markSelection(selectedItems());
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
  if (isStage(plan, key)) {
    // A stage is an item (section 7, "Moving and copying"): its row selects and drags it.
    entry.dataset.item = itemKey({ kind: "stage", id: key });
    row.dataset.itemHandle = entry.dataset.item;
    // An open card's row isn't a button, so it's made focusable for the menu key and Shift+F10.
    row.tabIndex = 0;
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
  // (section 10); the count stays at the right. A randomization's stage has none (section 7); a
  // transfer table's has one, for its pipetting.
  if (isOpen && isStage(plan, key) && randomizationOf(plan, key) === null) {
    row.classList.add("with-pencil");
    row.append(createPencil("stage", key, `Edit stage ${stageOrder(plan).indexOf(key) + 1}`));
  }
  row.append(key === END ? createEndCount(plan) : createElement("span", count, "entry-count"));
  entry.append(row);
  if (isOpen) {
    entry.append(createEntryBody(plan, key));
  }
  return entry;
}

// The badge, name and count of an entry: Start ("0", "N wells filled"), a stage (its place, "N
// transfers"), a mix step (its place, "N wells mixed") or End ("✓" and no count: createEntry builds
// End's count with createEndCount).
function entryHeading(plan, key) {
  if (key === START) {
    return { badge: "0", name: "Start", count: `${countOf(plan.startingContents.length, "well")} filled` };
  }
  if (key === END) {
    return { badge: "✓", name: "End", count: null };
  }
  const count = transfersIn(plan, key).length;
  return {
    badge: String(stageOrder(plan).indexOf(key) + 1),
    name: plan.stageList.get(key).name,
    count: isMixStep(plan, key) ? `${countOf(count, "well")} mixed` : countOf(count, "transfer"),
  };
}

// The parts of End's count (section 7, "End's tips"): "N transfers done", then "N <tip type> tips"
// for each tip type the run loads (tipsUsed), e.g. ["24 transfers done", "32 BC230 tips",
// "8 BC1070 tips"], or ["0 transfers done"] alone for a plan without transfers.
function endCountParts(plan) {
  return [`${countOf(transfersDone(plan), "transfer")} done`, ...tipCountTexts(plan)];
}

// "N <tip type> tips" for each tip type the run loads, in tipsUsed's order, e.g.
// ["32 BC230 tips", "1 BC1070 tip"]; [] for a plan without transfers.
function tipCountTexts(plan) {
  return tipsUsed(plan).map(({ tipType, count }) => countOf(count, `${tipType} tip`));
}

// End's count, row and card alike (section 7, "End's tips"): its parts, joined by " · ", each kept
// whole so a narrow column wraps it only after a "·", with a tooltip saying what the tips count.
// The " ·" goes inside the part before it and the space after it outside, so the space is the only
// place the line can break.
function createEndCount(plan) {
  const parts = endCountParts(plan);
  const count = createElement("span", "", "entry-count end-count");
  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1;
    count.append(createElement("span", isLast ? part : `${part} ·`, "end-count-part"));
    if (!isLast) {
      count.append(" ");
    }
  });
  const tips = tipCountTexts(plan);
  if (tips.length > 0) {
    count.title =
      `The run loads ${listWithAnd(tips)}: one per probe at each tip change whose stages have ` +
      "transfers.";
  }
  return count;
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
  } else if (randomizationOf(plan, key) !== null) {
    // A randomization's stage is changed only through its card (section 7).
    body.append(
      createSettingsLine(plan, key),
      createElement("p", "Part of a randomization: change it in its card.", "note"),
      ...createTransferSection(plan, key),
    );
  } else if (transferTableOf(plan, key) !== null) {
    // A transfer table's stage: its pipetting through its ✎, its amounts only in the table.
    body.append(
      createSettingsLine(plan, key),
      createElement("p", "Part of a transfer table: its amounts change in the table.", "note"),
      ...createTransferSection(plan, key),
    );
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

// The open stage's transfer list: one row per transfer; read-only for a randomization's or a
// transfer table's stage.
function createTransferList(plan, id, transfers) {
  const problems = transferProblems(plan);
  const owned = isOwnedStage(plan, id);
  const list = createElement("ul", "", "transfer-list");
  list.append(
    ...transfers.map((transfer) => createTransferRow(plan, id, transfer, problems.get(transfer.position), owned)),
  );
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
// saying what's reachable or by how much it overfills (section 7). A randomization's stage
// (`owned`) shows its volume as text, not a button, and has no ×.
function createTransferRow(plan, id, transfer, problem, owned) {
  const row = createElement("li", "", "transfer-row");
  row.dataset.position = String(transfer.position);
  const route = `${wellName(plan, transfer.source)} → ${wellName(plan, transfer.destination)}`;
  const volumeText = `${formatVolume(transfer.volume)} µL`;
  const volumeButton = createElement(owned ? "span" : "button", volumeText, owned ? "volume-text" : "volume-button");
  if (!owned) {
    volumeButton.type = "button";
    volumeButton.setAttribute("aria-label", `Volume of ${route}, ${volumeText}. Click to change`);
    volumeButton.addEventListener("click", () => startEditingVolume(volumeButton, id, transfer));
  }
  if (problem !== undefined) {
    volumeButton.classList.add("problem");
    volumeButton.title = describeRowProblem(problem);
  }
  row.append(createElement("span", route, "transfer-text"), volumeButton);
  if (!owned) {
    const remove = createElement("button", "×", "remove-transfer");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${route}`);
    remove.addEventListener("click", () => {
      highlightTransfer(null);
      if (tryEdit(() => removeTransfer(plan, transfer.position)) !== false) {
        showMessage(`Removed ${route} from ${stageLabel(plan, id)}.`, "note");
      }
    });
    row.append(remove);
  }
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

// The column's blocks between Start and End, in the order the logic's columnBoxes gives (section
// 7: the page doesn't work the order out itself): each ordinary tip group, as { kind: "group",
// group, nextGroup }, each randomization, as { kind: "randomization", randomization, groups }, and
// each transfer table, as { kind: "transferTable", transferTable, groups }, `groups` being its
// stages' tip groups in that form (none until a randomization has run). `nextGroup` is the tip
// group just after, in stage order, if any.
function columnBlocks(plan) {
  const groups = tipGroups(plan);
  // A tip group's block, from its place in `groups`, found by its key.
  const groupBlock = (key) => {
    const index = groups.findIndex((group) => group.key === key);
    return { kind: "group", group: groups[index], nextGroup: groups[index + 1] };
  };
  return columnBoxes(plan).map((box) => {
    if (box.kind === "tipGroup") {
      return groupBlock(box.key);
    }
    const groups = box.tipGroups.map((group) => groupBlock(group.key));
    return box.kind === "randomization"
      ? { kind: "randomization", randomization: randomizationAt(plan, box.id), groups }
      : { kind: "transferTable", transferTable: transferTableAt(plan, box.id), groups };
  });
}

// Where the seam between tip groups above `blocks[index]` (above End, past the last) adds
// (section 7): { beforeId, toPlace }. `beforeId` is the stage a stage added there goes before: the
// first stage of the block below, or, for a randomization that hasn't run, the stage it sits
// before; null above End. `toPlace` holds the randomizations that haven't run just above the seam,
// sitting at the same place, which are moved onto the new stage (placeRandomization) so it lands
// below them.
function seamPlace(blocks, index) {
  const below = blocks[index];
  let beforeId = null;
  if (below !== undefined && below.kind === "group") {
    beforeId = below.group.stages[0];
  } else if (below !== undefined) {
    // A transfer table always has stages; a randomization that hasn't run sits before beforeId.
    beforeId = below.groups.length > 0 ? below.groups[0].group.stages[0] : below.randomization.beforeId;
  }
  const toPlace = [];
  for (let above = index - 1; above >= 0; above -= 1) {
    const block = blocks[above];
    const sitsHere =
      block.kind === "randomization" && block.groups.length === 0 && block.randomization.beforeId === beforeId;
    if (!sitsHere) {
      break;
    }
    toPlace.unshift(block.randomization.id);
  }
  return { beforeId, toPlace };
}

// A tip group's box: its heading (the tip change) and its stages, each between two seams. Boxes
// alternate light blue and light sand. `block` is { group, nextGroup }, `nextGroup` being the box
// after it, if any. A randomization's or transfer table's own tip group (`owned`: "randomization"
// or "transferTable", otherwise false) has no seams inside it; a randomization's has no ✎ on its
// heading either, since its stages change only through the randomization's card (section 7).
// `boxIndex` is its box's index in the column (columnBoxes), for an ordinary tip group: its seams
// are the places inside it where moved or pasted stages can go.
function createTipGroupBox(plan, { group, nextGroup }, index, open, problems, drawnKeys, owned, boxIndex) {
  const box = createElement("div", "", "tip-group");
  box.classList.toggle("sand", index % 2 === 1);
  box.classList.toggle("owned", owned !== false);
  box.dataset.group = group.key;
  const heading = createTipGroupHeading(plan, group, owned === "randomization");
  // An ordinary tip group is an item, selected and dragged by its heading; a randomization's own
  // tip group's heading counts as its first stage's row, since that tip group may hold several
  // stages when sources share tips (section 7, "Moving and copying").
  const item = owned ? { kind: "stage", id: group.stages[0] } : { kind: "tipGroup", id: group.stages[0] };
  heading.dataset.itemHandle = itemKey(item);
  heading.tabIndex = 0;
  if (!owned) {
    box.dataset.item = itemKey(item);
  }
  box.append(heading);
  if (owned) {
    const stages = createElement("div", "", "tip-group-stages");
    for (const id of group.stages) {
      const entry = createEntry(plan, id, open, problems);
      applyGlow(entry, `stage:${id}`, drawnKeys);
      stages.append(entry);
    }
    box.append(stages);
    applyBoxGlow(box, group, drawnKeys);
    return box;
  }

  const stages = createElement("div", "", "tip-group-stages");
  const firstStage = group.stages[0];
  // A seam inside this box (createSeamInBox with `seamOptions`), noted as the place just before
  // its stage at `position`, for dropping and pasting.
  const seamInBox = (position, seamOptions) =>
    withDropPlace(createSeamInBox(plan, seamOptions), { kind: "inTipGroup", index: boxIndex, position });
  stages.append(
    seamInBox(0, {
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
        seamInBox(place + 1, {
          addBefore: lower,
          takeTips: false,
          accessibleName: `Insert a stage before ${stageLabel(plan, lower)}`,
          tipsBefore: lower,
        }),
      );
    }
  });
  stages.append(
    seamInBox(group.stages.length, {
      addBefore: nextGroup === undefined ? null : nextGroup.stages[0],
      takeTips: false,
      accessibleName: "Add a stage at the end of these tips",
    }),
  );
  box.append(stages);
  applyBoxGlow(box, group, drawnKeys);
  return box;
}

// Makes a tip group's box glow if it's new (section 7), but not when only its tip change is new: a
// box whose first stage is new itself (its tips came with the new stage: addStage with takeTips,
// or a stage added with new tips), or whose first stage already started a box at the last drawing
// (its tip change only moved: the old first stage's, after a stage is added with new tips above
// the first box). Then only the new stage glows.
function applyBoxGlow(box, group, drawnKeys) {
  const boxKey = `box:${group.key}`;
  const firstStage = group.stages[0];
  const firstKey = `box-first:${firstStage}`;
  const tipsOnlyMoved =
    isNewKey(boxKey) && (isNewKey(`stage:${firstStage}`) || !isNewKey(firstKey));
  if (tipsOnlyMoved) {
    drawnKeys.add(boxKey);
  } else {
    applyGlow(box, boxKey, drawnKeys);
  }
  drawnKeys.add(firstKey);
}

// A tip group's heading: a tip icon, "New tips · BC230 · 2 tips" and the ✎ that opens the tip
// change's box (none on a randomization's own tip group, `owned`). The count is how many tips the
// tip change loads: one per probe it loads, chosen in its box, and every stage in the group uses
// all of them (section 7).
function createTipGroupHeading(plan, group, owned) {
  const tips = countOf(group.probes.length, "tip");
  const heading = createElement("div", "", "tip-group-heading");
  heading.title = `Loads ${tips}. Every stage until the next new tips uses all of them.`;
  heading.append(
    createElement("span", "", "tip-icon"),
    createElement("span", `New tips · ${group.tipType} · ${tips}`),
  );
  if (!owned) {
    heading.append(createPencil("tip", group.key, "Edit these new tips"));
  }
  return heading;
}

// A seam inside a tip group box (section 7): the space between two of its cards, or above its first
// or below its last, whose stages and mix steps use this group's tips. `addBefore` is the stage the
// new stage goes before (null for last); `takeTips` is passed to addStage and addMixStep;
// `accessibleName` is the +'s, which says "a stage"; `tipsBefore`, given only on a seam between two
// stages, is the stage the tip button puts new tips before. Other seams leave the right spot empty.
function createSeamInBox(plan, { addBefore, takeTips, accessibleName, tipsBefore }) {
  const rightButton =
    tipsBefore === undefined
      ? null
      : createSeamTipButton(
          "New tips from here on",
          `New tips before ${stageLabel(plan, tipsBefore)}`,
          () => addTipChangeBefore(tipsBefore),
        );
  return createSeam({
    className: "seam",
    tooltips: {
      stage: "Add a stage here, with these tips",
      mixStep: "Add a mix step here, with these tips",
    },
    accessibleName,
    addStageHere: () => addStageAt(addBefore, takeTips),
    addMixStepHere: () => addMixStepAt(addBefore, takeTips),
    rightButton,
  });
}

// A seam between tip groups (section 7): above the first box, between two boxes (a randomization's
// box among them), or above End, whose stage or mix step gets new tips, as a tip group of its own,
// and whose right spot holds the dice button, adding a randomization there. `place` is
// { beforeId, toPlace } (seamPlace): the first stage of the box below it, or null above End, and
// the randomizations that haven't run just above it, which stay above a stage added here.
// e.g. the seam above End, whose + is named "Add a stage with new tips at the end of the run".
function createSeamBetweenGroups(plan, { beforeId, toPlace }) {
  const where = beforeId === null ? "at the end of the run" : `before ${stageLabel(plan, beforeId)}`;
  // Adds with `add` ({ plan, id } from the plan), then keeps the randomizations above the seam
  // above the new stage, as one edit.
  const keepingAbove = (add) => () => {
    const added = add(currentPlan());
    const placed = toPlace.reduce((planSoFar, id) => placeRandomization(planSoFar, id, added.id), added.plan);
    return { plan: placed, id: added.id };
  };
  return createSeam({
    className: "seam group-seam",
    tooltips: {
      stage: "Add a stage here, with new tips",
      mixStep: "Add a mix step here, with new tips",
    },
    accessibleName: `Add a stage with new tips ${where}`,
    addStageHere: () =>
      addWithNewTipsAt(
        keepingAbove((plan) => addStageWithNewTips(plan, beforeId)),
        "Added a stage with new tips. New transfers go into it.",
      ),
    addMixStepHere: () =>
      addWithNewTipsAt(
        keepingAbove((plan) => addMixStepWithNewTips(plan, beforeId)),
        "Added a mix step with new tips. Click or drag across wells on the deck to mix them.",
      ),
    rightButton: createSeamDiceButton(`Add a randomization ${where}`, () => addRandomizationAt(beforeId)),
    fourthButton: createSeamTableButton(`Add a transfer table ${where}`, () =>
      openNewWizard(beforeId, toPlace),
    ),
  });
}

// A seam's line and its four fixed spots (section 7), shown while pointed at or focused: the mix
// step button, the + in the middle, the right spot, holding `rightButton` or left empty, and the
// fourth spot, holding `fourthButton` (seams between tip groups: the table button) or left empty, in
// that order, so keyboard focus moves through them left to right. `className` is the seam's
// classes; `tooltips` the +'s and the mix step button's ({ stage, mixStep }); `accessibleName` the
// +'s, which says "a stage" (the mix step button's says "a mix step" instead); `addStageHere` and
// `addMixStepHere` what the two buttons do.
function createSeam({ className, tooltips, accessibleName, addStageHere, addMixStepHere, rightButton, fourthButton = null }) {
  const seam = createElement("div", "", className);
  seam.append(createElement("span", "", "seam-line"));
  const mix = createElement("button", "⟳", "seam-button add-mix-step");
  mix.type = "button";
  mix.title = tooltips.mixStep;
  mix.setAttribute("aria-label", accessibleName.replace("a stage", "a mix step"));
  mix.addEventListener("click", () => afterClosingCard(addMixStepHere));
  seam.append(mix);
  // The + is drawn by the stylesheet, two bars crossing at the circle's center, so it's centered.
  const add = createElement("button", "", "seam-button add-stage");
  add.type = "button";
  add.title = tooltips.stage;
  add.setAttribute("aria-label", accessibleName);
  add.addEventListener("click", () => afterClosingCard(addStageHere));
  seam.append(add);
  if (rightButton !== null) {
    seam.append(rightButton);
  }
  if (fourthButton !== null) {
    seam.append(fourthButton);
  }
  return seam;
}

// A seam's tip button (section 7): a circle with the tip icon, in the right spot just right of the
// +, with `tooltip`, `accessibleName` and `onClick`.
function createSeamTipButton(tooltip, accessibleName, onClick) {
  const tips = createElement("button", "", "seam-button add-tips");
  tips.type = "button";
  tips.title = tooltip;
  tips.setAttribute("aria-label", accessibleName);
  tips.append(createElement("span", "", "tip-icon"));
  tips.addEventListener("click", () => afterClosingCard(onClick));
  return tips;
}

// A seam's dice button (section 7): a circle with the dice icon, in the right spot just right of
// the +, with the tooltip "Add a randomization here", `accessibleName` and `onClick`.
function createSeamDiceButton(accessibleName, onClick) {
  const dice = createElement("button", "", "seam-button add-randomization");
  dice.type = "button";
  dice.title = "Add a randomization here";
  dice.setAttribute("aria-label", accessibleName);
  dice.append(createDiceIcon());
  dice.addEventListener("click", () => afterClosingCard(onClick));
  return dice;
}

// A seam's table button (section 7): a circle with the table icon, in the fourth spot just right of
// the right spot, with the tooltip "Add a transfer table here", `accessibleName` and `onClick`.
function createSeamTableButton(accessibleName, onClick) {
  const button = createElement("button", "", "seam-button add-transfer-table");
  button.type = "button";
  button.title = "Add a transfer table here";
  button.setAttribute("aria-label", accessibleName);
  button.append(createTableIcon());
  button.addEventListener("click", () => afterClosingCard(onClick));
  return button;
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

// Adds a stage or mix step with new tips, from a seam between tip groups, and opens it, as one
// undoable edit, showing `message` (section 7). `add` returns { plan, id }, from
// addStageWithNewTips or addMixStepWithNewTips.
function addWithNewTipsAt(add, message) {
  const added = tryLogic(add);
  if (added !== false) {
    openAddedStage(added, message);
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

// --- Randomizations (sections 7 and 9) ---

// A randomization's box in the Stages column (section 7): its heading, then, while its card is
// open, the card, then, once it has run, its stages' tip group boxes, unless it's collapsed to its
// heading: it is, unless its card or one of its stages is open. `block` is from columnBlocks;
// `groupIndex` the place of its first tip group among all of them, for their colors.
function createRandomizationBox(plan, block, groupIndex, open, problems, drawnKeys) {
  const { randomization, groups } = block;
  const hasRun = groups.length > 0;
  const cardOpen = card !== null && card.id === randomization.id;
  const box = createElement("div", "", "randomization");
  box.classList.toggle("not-set-up", !hasRun);
  box.dataset.entry = randomization.id;
  // A randomization is an item, selected and dragged by its heading (section 7, "Moving and
  // copying"). Its box glows when a move, copy or paste placed it.
  box.dataset.item = itemKey({ kind: "randomization", id: randomization.id });
  applyGlow(box, `randomization:${randomization.id}`, drawnKeys, { whenNew: false });
  const outOfDate = outOfDateRandomizations(plan).has(randomization.id);
  const heading = createRandomizationHeading(randomization, cardOpen, outOfDate);
  heading.dataset.itemHandle = box.dataset.item;
  box.append(heading);
  if (cardOpen) {
    card.element = createRandomizationCard(plan, randomization);
    box.append(card.element);
  }
  const expanded = cardOpen || groups.some(({ group }) => group.stages.includes(open));
  groups.forEach((groupBlock, place) => {
    if (expanded) {
      box.append(createTipGroupBox(plan, groupBlock, groupIndex + place, open, problems, drawnKeys, "randomization"));
    } else {
      noteDrawnWithoutGlow(groupBlock.group, drawnKeys);
    }
  });
  return box;
}

// Notes a collapsed randomization's tip group and its stages as drawn, so they don't glow as new
// when the box opens later (section 7: nothing glows when something is only opened).
function noteDrawnWithoutGlow(group, drawnKeys) {
  drawnKeys.add(`box:${group.key}`);
  drawnKeys.add(`box-first:${group.stages[0]}`);
  for (const id of group.stages) {
    drawnKeys.add(`stage:${id}`);
  }
}

// A randomization's heading (section 7): a button the box's width, with the dice icon, "Randomize"
// (not set up yet) or "Randomized" (run), and, at the right, "not set up yet", "68 stages · seed
// 360310", or, when `outOfDate`, "needs update" in red. Clicking it opens its card, or closes it if
// open.
function createRandomizationHeading(randomization, cardOpen, outOfDate) {
  const hasRun = randomization.stages.length > 0;
  const heading = createElement("button", "", "randomization-heading");
  heading.type = "button";
  heading.setAttribute("aria-expanded", String(cardOpen));
  let title = hasRun ? "Open to change it" : "Not set up yet: open it to finish setting it up.";
  let status = hasRun
    ? `${countOf(randomization.stages.length, "stage")} · seed ${randomization.seed}`
    : "not set up yet";
  if (outOfDate) {
    title = "The plan changed since this last ran: open it and press Update.";
    status = "needs update";
  }
  heading.title = title;
  const statusElement = createElement("span", status, "randomization-status");
  statusElement.classList.toggle("needs-update", outOfDate);
  heading.append(
    createDiceIcon(),
    createElement("span", hasRun ? "Randomized" : "Randomize", "randomization-title"),
    statusElement,
  );
  heading.addEventListener("click", () => {
    if (cardOpen) {
      closeRandomizationCard();
    } else {
      openEntry(randomization.id);
    }
  });
  return heading;
}

// The dice icon (section 7): two dice, one tilted behind showing three, one in front showing five,
// drawn in the text's color so it's the same on every PC.
function createDiceIcon() {
  const svg = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(svg, "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("class", "dice-icon");
  icon.setAttribute("aria-hidden", "true");
  // One die: a rounded square `size` wide with its top left corner at (x, y), a pip at each of
  // `pips`' points, turned by the SVG `transform` if one is given.
  const die = (x, y, size, pips, transform) => {
    const group = document.createElementNS(svg, "g");
    if (transform !== undefined) {
      group.setAttribute("transform", transform);
    }
    const face = document.createElementNS(svg, "rect");
    for (const [name, value] of [["x", x], ["y", y], ["width", size], ["height", size], ["rx", 2.5]]) {
      face.setAttribute(name, String(value));
    }
    face.setAttribute("class", "die-face");
    group.append(face);
    for (const [pipX, pipY] of pips) {
      const pip = document.createElementNS(svg, "circle");
      pip.setAttribute("cx", String(pipX));
      pip.setAttribute("cy", String(pipY));
      pip.setAttribute("r", "1.2");
      pip.setAttribute("class", "die-pip");
      group.append(pip);
    }
    return group;
  };
  icon.append(
    die(1.5, 1.5, 12, [[4.5, 4.5], [7.5, 7.5], [10.5, 10.5]], "rotate(-14 7.5 7.5)"),
    die(9.5, 9.5, 13, [[12.6, 12.6], [19.4, 12.6], [16, 16], [12.6, 19.4], [19.4, 19.4]]),
  );
  return icon;
}

// Adds a randomization sitting before stage `beforeId` (or last, for null), with a random seed and
// the next transfer's volume (null if that isn't a volume), and opens its card on Sources, as one
// undoable edit (section 7).
function addRandomizationAt(beforeId) {
  const plan = currentPlan();
  const volume = cardVolumeValue(transferVolume.text);
  const added = tryLogic(() => addRandomization(plan, beforeId, { seed: randomSeed(Math.random()), volume }));
  if (added === false) {
    return;
  }
  closeEditingBox();
  source = null;
  cardTabs.set(added.id, "sources");
  card = newCard(added.plan, added.id, currentOpen());
  recordEdit(added.plan, added.id);
  showMessage("Added a randomization. Pick its sources and the wells to fill.", "ok");
  scrollIntoColumnView(elements.stagesList.querySelector(`[data-entry="${cssEscape(added.id)}"]`));
}

// The card's state for randomization `id`, opening: its draft (draftOf), the modes it had (for the
// settings grid), and `returnTo`, the entry to open again when it closes.
function newCard(plan, id, returnTo) {
  const randomization = randomizationAt(plan, id);
  const draft = draftOf(randomization, cardTabs.get(id) ?? "sources");
  const original = {
    aspirate: draft.aspirate,
    dispense: draft.dispense,
    aspirateMix: draft.aspirateMix,
    dispenseMix: draft.dispenseMix,
  };
  return { id, draft, original, returnTo, element: null };
}

// A randomization as its card shows it, for editing: its sources with their replicates as typed
// text and whether each shares the tips before it, its wells to fill, its seed and volume as text, each end's mode and Mix (as a stage's box
// holds them), its tip type and probes, and the open tab.
function draftOf(randomization, tab) {
  const { settings } = randomization;
  return {
    tab,
    sources: randomization.sources.map(({ labware, well, replicates, filler, sharesTips }) => ({
      labware,
      well,
      replicatesText: replicates === null ? "" : String(replicates),
      filler,
      sharesTips,
    })),
    fill: randomization.fill.map(({ labware, well }) => ({ labware, well })),
    seedText: randomization.seed === null ? "" : String(randomization.seed),
    volumeText: randomization.volume === null ? "" : String(randomization.volume),
    aspirate: modeOf("source", settings),
    dispense: modeOf("destination", settings),
    aspirateMix: settings.sourceMix !== null,
    dispenseMix: settings.destinationMix !== null,
    tipType: randomization.tipType,
    probes: [...randomization.probes],
  };
}

// The changes the open card's draft makes, as setRandomization takes them (section 7): values the
// logic would refuse as null, e.g. a replicate count of "four" or a seed of 0, and the settings
// built end by end from the draft's modes and Mix, as a stage's box builds them.
function draftChanges(plan) {
  const { draft } = card;
  const stored = randomizationAt(plan, card.id).settings;
  const settings = { ...stored };
  for (const boxEnd of BOX_ENDS) {
    Object.assign(settings, stageEndSettings(stored, boxEnd, draft[boxEnd.mode], draft[boxEnd.mix]));
  }
  return {
    sources: draft.sources.map(({ labware, well, replicatesText, filler, sharesTips }) => ({
      labware,
      well,
      replicates: filler ? null : replicatesValue(replicatesText),
      filler,
      sharesTips,
    })),
    fill: draft.fill.map(({ labware, well }) => ({ labware, well })),
    seed: seedValue(draft.seedText),
    volume: cardVolumeValue(draft.volumeText),
    settings,
    tipType: draft.tipType,
    probes: [...draft.probes],
  };
}

// A replicate count as typed, as a number if it's a whole number of at least 1, otherwise null,
// e.g. "4" → 4, "four" → null.
function replicatesValue(text) {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) >= 1 ? Number(trimmed) : null;
}

// A seed as typed, as a number if it's a whole number from 1 to random-pool's MAX_SEED, otherwise
// null, e.g. "37" → 37, "0" → null.
function seedValue(text) {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) >= 1 && Number(trimmed) <= MAX_SEED ? Number(trimmed) : null;
}

// A volume as typed, as a number if it's a number above 0, otherwise null, e.g. "50" → 50.
function cardVolumeValue(text) {
  const volume = volumeValue(text.trim());
  return typeof volume === "number" && Number.isFinite(volume) && volume > 0 ? volume : null;
}

// The plan with the open card's draft applied (setRandomization), for working out its problems;
// throws as setRandomization does.
function draftPlan(plan) {
  return setRandomization(plan, card.id, draftChanges(plan));
}

// True if the open card's draft changes the randomization.
function isCardDirty(plan) {
  try {
    return draftPlan(plan) !== plan;
  } catch {
    return true;
  }
}

// The card's first problem, in short words, or null (section 7): a box's own message while it holds
// what isn't valid (a source's replicates, the seed, the volume, in that order), otherwise the first
// of randomizationProblems on the draft.
function cardProblem(plan) {
  const { draft } = card;
  for (const entry of draft.sources) {
    if (!entry.filler && entry.replicatesText.trim() !== "" && replicatesValue(entry.replicatesText) === null) {
      return `${sourceName(plan, card.id, entry)}: replicates must be a whole number, 1 or more.`;
    }
  }
  if (draft.seedText.trim() !== "" && seedValue(draft.seedText) === null) {
    return `The seed must be a whole number from 1 to ${MAX_SEED.toLocaleString("en-US")}.`;
  }
  if (draft.volumeText.trim() !== "" && cardVolumeValue(draft.volumeText) === null) {
    return "The volume must be a number of µL above 0.";
  }
  try {
    return randomizationProblems(draftPlan(plan), card.id)[0] ?? null;
  } catch (error) {
    return error.message;
  }
}

// The draft's filler shares (fillerShares on the draft, worked out as the problems are; section 7),
// as a Map from each filler well's place in the draft's sources to how many wells it fills, e.g.
// Map { 1 → 7, 2 → 7, 3 → 4 }; null while they aren't known yet (a replicate count isn't a whole
// number, or the volume isn't set) or the draft is refused.
function draftFillerShares(plan) {
  try {
    const shares = fillerShares(draftPlan(plan), card.id);
    return shares === null ? null : new Map(shares.map(({ index, count }) => [index, count]));
  } catch {
    return null;
  }
}

// How many wells the filler well at `index` in the draft's sources fills (section 7): "7 wells",
// "1 well", "0 wells", or "?" while `shares` (draftFillerShares) isn't known.
function fillerShareText(shares, index) {
  return shares === null ? "?" : countOf(shares.get(index), "well");
}

// How many stages running the draft makes: one per source taking replicates, and one for the
// filler if it fills any well, however many filler wells it has (section 7).
function stagesToMake(plan) {
  const { draft } = card;
  const takers = draft.sources.filter((entry) => !entry.filler).length;
  const shares = draftFillerShares(plan);
  const fillerFills = shares !== null && [...shares.values()].some((count) => count > 0);
  return takers + (fillerFills ? 1 : 0);
}

// Randomize's tooltip (section 7), for a draft with no problem: "Makes 12 stages, with new tips
// before each." when no source shares tips; once any does, "Makes 12 stages, on 4 sets of new
// tips.", the count from tipSetsToMake on the draft.
function randomizeTooltip(plan) {
  const stages = countOf(stagesToMake(plan), "stage");
  if (!card.draft.sources.some((entry) => entry.sharesTips)) {
    return `Makes ${stages}, with new tips before each.`;
  }
  return `Makes ${stages}, on ${countOf(tipSetsToMake(draftPlan(plan), card.id), "set")} of new tips.`;
}

// The open randomization's card (section 7): the tabs and the open tab's contents, Each transfer,
// Seed, and the footer with its first problem and buttons. Escape in it closes it, as on the page.
function createRandomizationCard(plan, randomization) {
  const element = createElement("div", "", "randomization-card");
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", "Randomization");
  element.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeCardWithEscape();
    }
  });
  element.append(
    createCardTabs(),
    ...(card.draft.tab === "sources" ? createSourcesTab(plan) : createFillTab(plan)),
    createElement("div", "Each transfer", "field-name card-section"),
    createSettingsGrid({
      draft: card.draft,
      original: card.original,
      redraw: redrawCard,
      mixTooltip: (boxEnd) => mixTooltipText(boxEnd, randomization.settings[`${boxEnd.end}Mix`], ""),
    }),
    createCardTipsField(),
    createCardVolumeField(),
    createCardSeedField(),
    createCardFooter(plan, randomization),
  );
  return element;
}

// The card's two tabs, "Sources" and "Wells to fill", each with its count in a pill; the open one
// is what clicks on the deck pick (section 9).
function createCardTabs() {
  const { draft } = card;
  const tabs = createElement("div", "", "card-tabs");
  tabs.setAttribute("role", "tablist");
  for (const [tab, label, count] of [
    ["sources", "Sources", draft.sources.length],
    ["fill", "Wells to fill", draft.fill.length],
  ]) {
    const button = createElement("button", label, "card-tab");
    button.type = "button";
    button.dataset.focusKey = `tab:${tab}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(draft.tab === tab));
    button.append(createElement("span", String(count), "tab-count"));
    button.addEventListener("click", () => {
      draft.tab = tab;
      cardTabs.set(card.id, tab);
      redrawCard();
      updateCursorLabel();
    });
    tabs.append(button);
  }
  return tabs;
}

// The Sources tab (section 7): a note with none; otherwise All sources (with two or more sources
// taking replicates), the sources in boxes of sources that share tips (the first SOURCES_SHOWN rows
// unless shown in full), and Show all / Show fewer.
function createSourcesTab(plan) {
  const { draft } = card;
  if (draft.sources.length === 0) {
    return [createElement("p", "Click wells on the deck to add them.", "note")];
  }
  const parts = [];
  if (draft.sources.filter((entry) => !entry.filler).length >= 2) {
    parts.push(createAllSourcesRow());
  }
  const inFull = sourcesShownInFull.has(card.id);
  const shownCount = inFull ? draft.sources.length : Math.min(SOURCES_SHOWN, draft.sources.length);
  parts.push(createSourceGroups(plan, shownCount));
  if (draft.sources.length > SOURCES_SHOWN) {
    const toggle = createElement(
      "button",
      inFull ? "Show fewer ▾" : `Show all ${draft.sources.length} sources ▸`,
      "toggle-list",
    );
    toggle.type = "button";
    toggle.dataset.focusKey = "show-all";
    toggle.setAttribute("aria-expanded", String(inFull));
    toggle.addEventListener("click", () => {
      if (inFull) {
        sourcesShownInFull.delete(card.id);
      } else {
        sourcesShownInFull.add(card.id);
      }
      redrawCard();
    });
    parts.push(toggle);
  }
  return parts;
}

// --- A randomization's sources sharing tips (section 7, "Boxes of sources that share tips") ---

// The data type a dragged source row carries, so only the Sources list accepts it: no text box can
// take it, and the list refuses any drag that doesn't carry it.
const SOURCE_DRAG_TYPE = "application/x-biomek-tools-source";

// The source row being dragged, as { from }, its place in the draft's sources, or null.
let sourceDrag = null;

// The Sources list (section 7): a box per source group of the draft's sources (sourceGroups) that
// has a shown row, showing its rows among the first `shownCount`, with a seam between boxes above
// the first, between each two and below the last. Every seam stands for a place in the whole list's
// groups, as moveSource takes it, so a seam means the same place folded or not.
function createSourceGroups(plan, shownCount) {
  const { sources } = card.draft;
  const groups = sourceGroups(sources);
  const shownGroups = groups.filter((group) => group[0] < shownCount);
  const shares = draftFillerShares(plan);
  const container = createElement("div", "", "source-groups");
  container.addEventListener("dragover", refuseOtherDrops, true);
  container.addEventListener("drop", refuseOtherDrops, true);
  container.append(createSourceSeamBetween(plan, groups, 0, false));
  shownGroups.forEach((group, index) => {
    container.append(createSourceGroupBox(plan, group, index, shownCount, shares));
    const joins = index + 1 < shownGroups.length;
    container.append(createSourceSeamBetween(plan, groups, index + 1, joins));
  });
  return container;
}

// One box of sources sharing tips (section 7): light blue or, for odd `index`, light sand, headed
// "New tips" or "New tips · shared by 3 sources" (counting every source of the group, shown or
// not), then its shown rows, each between two seams inside the box. `group` is the group's indexes
// in the draft's sources. The seam below its last shown row stands for the group's end, hidden rows
// included.
function createSourceGroupBox(plan, group, index, shownCount, shares) {
  const { sources } = card.draft;
  const box = createElement("div", "", "source-group");
  box.classList.toggle("sand", index % 2 === 1);
  const heading = createElement("div", "", "source-group-heading");
  const text = group.length === 1 ? "New tips" : `New tips · shared by ${group.length} sources`;
  heading.append(createElement("span", "", "tip-icon"), createElement("span", text));
  const list = createElement("ul", "", "source-list");
  // A seam inside this box, just before its source at `position`, with `button` or none.
  const seamAt = (position, button) =>
    createSourceSeam("li", { kind: "inGroup", index, position }, button);
  const shown = group.filter((sourceIndex) => sourceIndex < shownCount);
  list.append(seamAt(0, null));
  shown.forEach((sourceIndex, position) => {
    list.append(createSourceRow(plan, sources[sourceIndex], shares));
    const lower = shown[position + 1];
    list.append(lower === undefined ? seamAt(group.length, null) : seamAt(position + 1, createSplitButton(plan, lower)));
  });
  box.append(heading, list);
  return box;
}

// The seam between source groups just above group `index` of `groups` (below the last for its
// length), whose tip button, when `joins`, joins the group above and the group below (section 7).
function createSourceSeamBetween(plan, groups, index, joins) {
  const button = joins ? createJoinButton(plan, groups[index][0], groups[index - 1].at(-1)) : null;
  return createSourceSeam("div", { kind: "between", index }, button);
}

// A seam of the Sources list (section 7): its line, shown while pointed at, and `button` (a tip
// button) or none, as an element of `tag` ("li" inside a box's list, "div" between boxes). `place`
// is where a source dropped on it goes (moveSource's place), kept on it for dropping.
function createSourceSeam(tag, place, button) {
  const seam = createElement(tag, "", place.kind === "between" ? "source-seam between" : "source-seam");
  if (tag === "li") {
    // A seam isn't one of the list's items; its button still is reachable.
    seam.setAttribute("role", "presentation");
  }
  seam.dataset.sourcePlace = JSON.stringify(place);
  seam.append(createElement("span", "", "source-seam-line"));
  if (button !== null) {
    seam.append(button);
  }
  seam.addEventListener("dragover", (event) => overSourceSeam(event, seam));
  seam.addEventListener("dragleave", () => seam.classList.remove("drop-target"));
  seam.addEventListener("drop", (event) => dropOnSourceSeam(event, seam));
  return seam;
}

// The tip button joining two boxes (section 7): the source at `lowerIndex`, the lower box's first,
// shares the tips of the upper box, whose last source is at `upperIndex`. Its tooltip and
// accessible name are e.g. "Drug B shares the tips of Drug A".
function createJoinButton(plan, lowerIndex, upperIndex) {
  const { sources } = card.draft;
  const label = `${sourceName(plan, card.id, sources[lowerIndex])} shares the tips of ${sourceName(plan, card.id, sources[upperIndex])}`;
  return createSourceTipButton(label, sources[lowerIndex], true);
}

// The tip button splitting a box (section 7): the source at `lowerIndex` and the sources after it
// in its box get new tips. Its tooltip and accessible name are e.g. "New tips for Drug C and the
// sources below it in this box".
function createSplitButton(plan, lowerIndex) {
  const entry = card.draft.sources[lowerIndex];
  const label = `New tips for ${sourceName(plan, card.id, entry)} and the sources below it in this box`;
  return createSourceTipButton(label, entry, false);
}

// A tip button on a Sources list seam (section 7): a white circle with the tip icon, with `label`
// as its tooltip and accessible name, setting `entry`'s sharesTips to `shares` in the draft. Its
// focus key names `entry`'s well, so a join and the split that replaces it keep the focus.
function createSourceTipButton(label, entry, shares) {
  const button = createElement("button", "", "source-tip-button");
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.dataset.focusKey = `tips:${wellKey(entry)}`;
  button.append(createElement("span", "", "tip-icon"));
  button.addEventListener("click", () => {
    const { sources } = card.draft;
    card.draft.sources = setSourceSharesTips(sources, sources.indexOf(entry), shares);
    redrawCard();
  });
  return button;
}

// The draft's sources without those `isRemoved` picks, each box they leave keeping its tips
// (removeSources), e.g. removeDraftSources(sources, (entry) => entry === removed).
function removeDraftSources(sources, isRemoved) {
  const indexes = sources.flatMap((entry, index) => (isRemoved(entry) ? [index] : []));
  return removeSources(sources, indexes);
}

// Makes a source row draggable (section 7, "Moving a source"): by its grip or any part outside its
// controls, never from its replicates box, Filler button or ×, so pressing there works as usual.
function makeSourceRowDraggable(row, entry) {
  row.draggable = true;
  // Decided at each press, before the browser decides whether a drag can start.
  row.addEventListener("pointerdown", (event) => {
    row.draggable = !(event.target instanceof Element) || event.target.closest("input, button") === null;
  });
  row.addEventListener("dragstart", (event) => beginSourceDrag(event, row, entry));
  row.addEventListener("dragend", endSourceDrag);
}

// Starts dragging `entry`'s row: notes where it came from, carries SOURCE_DRAG_TYPE only, and,
// once the browser has taken the drag's picture, fades the row and shows every seam's line faintly.
function beginSourceDrag(event, row, entry) {
  if (event.target !== row) {
    event.preventDefault();
    return;
  }
  sourceDrag = { from: card.draft.sources.indexOf(entry) };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(SOURCE_DRAG_TYPE, String(sourceDrag.from));
  const list = row.closest(".source-groups");
  requestAnimationFrame(() => {
    if (sourceDrag !== null) {
      row.classList.add("source-dragged");
      list?.classList.add("sources-dragging");
    }
  });
}

// Ends a source row's drag, dropped or not: forgets it and takes away its marks.
function endSourceDrag() {
  sourceDrag = null;
  if (card === null || card.element === null) {
    return;
  }
  for (const marked of card.element.querySelectorAll(".source-dragged, .sources-dragging, .drop-target")) {
    marked.classList.remove("source-dragged", "sources-dragging", "drop-target");
  }
}

// A drag over a Sources list seam: a source row's drag can drop here, and the seam shows its line
// strongly; any other drag can't.
function overSourceSeam(event, seam) {
  if (sourceDrag === null) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  seam.classList.add("drop-target");
}

// A source row dropped on a Sources list seam: moves the source there in the draft (moveSource, by
// the container rule) and redraws the card.
function dropOnSourceSeam(event, seam) {
  if (sourceDrag === null) {
    return;
  }
  event.preventDefault();
  const { from } = sourceDrag;
  endSourceDrag();
  card.draft.sources = moveSource(card.draft.sources, from, JSON.parse(seam.dataset.sourcePlace));
  redrawCard();
}

// Caught first on the Sources list: refuses any drag or drop on it except a source row's on a seam,
// so a drag from elsewhere can't drop here (not even text into a replicates box), and a source can't
// be dropped on a row.
function refuseOtherDrops(event) {
  const onSeam = event.target instanceof Element && event.target.closest(".source-seam") !== null;
  if (sourceDrag !== null && onSeam) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "none";
  if (event.type === "drop") {
    event.stopPropagation();
  }
}

// The All sources row (section 7): one box setting every source's replicates as it's typed (not the
// filler's), showing their number when they all match, else empty with "mixed" as its placeholder.
function createAllSourcesRow() {
  const takers = card.draft.sources.filter((entry) => !entry.filler);
  const texts = new Set(takers.map((entry) => entry.replicatesText.trim()));
  const row = createElement("div", "", "all-sources-row");
  const box = document.createElement("input");
  box.type = "text";
  box.inputMode = "numeric";
  box.className = "replicates-box";
  box.dataset.focusKey = "all-sources";
  box.setAttribute("aria-label", "Replicates for every source");
  box.value = texts.size === 1 ? [...texts][0] : "";
  box.placeholder = texts.size === 1 ? "" : "mixed";
  box.addEventListener("input", () => {
    for (const entry of takers) {
      entry.replicatesText = box.value;
    }
    redrawCard();
  });
  row.append(createElement("span", "All sources", "all-sources-name"), box, ...rowEndPlaceholders());
  return row;
}

// Invisible stand-ins for a source row's Filler button and ×, so the All sources box lines up with
// the sources' replicate boxes, in the same column (section 7). They're buttons, so they take
// exactly a real button's width; hidden (visibility), they take no pointer, focus or screen reader.
function rowEndPlaceholders() {
  return [createElement("button", "Filler", "filler-button"), createElement("button", "×", "remove-transfer")].map(
    (placeholder) => {
      placeholder.type = "button";
      placeholder.tabIndex = -1;
      placeholder.classList.add("row-end-placeholder");
      placeholder.setAttribute("aria-hidden", "true");
      return placeholder;
    },
  );
}

// One source's row (section 7): the grip it's dragged by, its main component's swatch just before
// the randomization (gray if it holds nothing then), its name (sourceName), its replicates box, or,
// for a filler well, how many wells it fills (its share, from `shares`, draftFillerShares); the
// Filler toggle, which turns only this row's on or off; and ×.
function createSourceRow(plan, entry, shares) {
  const where = wellName(plan, entry);
  const key = wellKey(entry);
  const row = createElement("li", "", "source-row");
  const name = createElement("span", sourceName(plan, card.id, entry), "source-name");
  name.title = where;
  const grip = createElement("span", "⠿", "source-grip");
  grip.title = "Drag to move this source";
  // The grip is for the mouse only: moving a source with the keyboard isn't offered yet.
  grip.setAttribute("aria-hidden", "true");
  row.append(grip, createSwatch(mainComponentColor(plan, shownSnapshot, entry)), name);
  makeSourceRowDraggable(row, entry);
  if (entry.filler) {
    row.append(createElement("span", fillerShareText(shares, card.draft.sources.indexOf(entry)), "filler-count"));
  } else {
    const box = document.createElement("input");
    box.type = "text";
    box.inputMode = "numeric";
    box.className = "replicates-box";
    box.dataset.focusKey = `replicates:${key}`;
    box.setAttribute("aria-label", `Replicates of ${where}`);
    box.value = entry.replicatesText;
    box.addEventListener("input", () => {
      entry.replicatesText = box.value;
      redrawCard();
    });
    row.append(box);
  }
  const filler = createElement("button", "Filler", "filler-button");
  filler.type = "button";
  filler.dataset.focusKey = `filler:${key}`;
  filler.title = "Filler wells fill the wells the replicates leave over, used in list order.";
  filler.setAttribute("aria-pressed", String(entry.filler));
  filler.addEventListener("click", () => {
    entry.filler = !entry.filler;
    redrawCard();
  });
  const remove = createElement("button", "×", "remove-transfer");
  remove.type = "button";
  remove.setAttribute("aria-label", `Remove source ${where}`);
  remove.addEventListener("click", () => {
    card.draft.sources = removeDraftSources(card.draft.sources, (other) => other === entry);
    draftChangedOnDeck();
  });
  row.append(filler, remove);
  return row;
}

// The Wells to fill tab (section 7): a note with none; otherwise how many on each labware, in deck
// order, e.g. "60 on Plate1 · 60 on Plate2", and Clear, which unpicks them all.
function createFillTab(plan) {
  const { draft } = card;
  if (draft.fill.length === 0) {
    return [createElement("p", "Click or drag across wells on the deck.", "note")];
  }
  const counts = labwareNames()
    .map((name) => [name, draft.fill.filter((end) => end.labware === name).length])
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${count} on ${labelOf(plan, name)}`);
  const row = createElement("div", "", "fill-summary");
  const clear = createElement("button", "Clear", "action");
  clear.type = "button";
  clear.dataset.focusKey = "clear";
  clear.addEventListener("click", () => {
    card.draft.fill = [];
    draftChangedOnDeck();
  });
  row.append(createElement("span", counts.join(" · ")), clear);
  return [row];
}

// The card's Tips (section 7): a menu of tip types and one of probe counts ("1 probe" … "8
// probes", choosing probesFor), for each set of new tips its stages load: one before each box of
// sources, so before each stage when no source shares tips.
function createCardTipsField() {
  const { draft } = card;
  const field = createElement("div", "", "card-field");
  field.append(createElement("span", "Tips", "field-name"));
  const menus = createElement("div", "", "card-tips");
  const tipMenu = document.createElement("select");
  tipMenu.dataset.focusKey = "tip-type";
  tipMenu.setAttribute("aria-label", "Tip type");
  for (const tipType of TIP_TYPES) {
    tipMenu.append(new Option(tipType, tipType));
  }
  tipMenu.value = draft.tipType;
  tipMenu.addEventListener("change", () => {
    draft.tipType = tipMenu.value;
    redrawCard();
  });
  const probeMenu = document.createElement("select");
  probeMenu.dataset.focusKey = "probes";
  probeMenu.setAttribute("aria-label", "Probes");
  for (let count = 1; count <= PROBE_COUNT; count++) {
    probeMenu.append(new Option(countOf(count, "probe"), String(count)));
  }
  probeMenu.value = String(draft.probes.length);
  probeMenu.addEventListener("change", () => {
    draft.probes = probesFor(Number(probeMenu.value));
    redrawCard();
  });
  menus.append(tipMenu, createElement("span", "on", "muted"), probeMenu);
  field.append(menus);
  return field;
}

// The card's Volume (section 7): a text box like Seed's, 80px wide, then "µL"; what's typed
// changes the draft at once, as Seed's box does. (It was a button that turned into a box when
// clicked, as a transfer's volume does, but alone in the card it didn't look editable; Andy,
// 2026-11-01.)
function createCardVolumeField() {
  const { draft } = card;
  const field = createElement("div", "", "card-field");
  const box = document.createElement("input");
  box.type = "text";
  box.inputMode = "decimal";
  box.id = "card-volume";
  box.className = "card-volume-box";
  box.dataset.focusKey = "volume";
  box.value = draft.volumeText;
  box.setAttribute("aria-label", "Volume per transfer in µL");
  box.addEventListener("input", () => {
    draft.volumeText = box.value;
    redrawCard();
  });
  const label = createElement("label", "Volume", "field-name");
  label.htmlFor = box.id;
  field.append(label, box, createElement("span", "µL", "muted"));
  return field;
}

// The card's Seed (section 7): a text box, 120px wide.
function createCardSeedField() {
  const { draft } = card;
  const field = createElement("div", "", "card-field");
  const box = document.createElement("input");
  box.type = "text";
  box.inputMode = "numeric";
  box.id = "card-seed";
  box.className = "seed-box";
  box.dataset.focusKey = "seed";
  box.value = draft.seedText;
  box.addEventListener("input", () => {
    draft.seedText = box.value;
    redrawCard();
  });
  const label = createElement("label", "Seed", "field-name");
  label.htmlFor = box.id;
  field.append(label, box);
  return field;
}

// The card's footer (section 7): its first problem, in red; then Remove at the left (disabled when
// its stages are all the plan's), Discard (once run, with changes), Close and the main button,
// Randomize or Update, disabled while there's a problem.
function createCardFooter(plan, randomization) {
  const hasRun = randomization.stages.length > 0;
  const footer = createElement("div", "", "card-footer");
  const problem = cardProblem(plan);
  if (problem !== null) {
    footer.append(createElement("p", problem, "card-problem-line"));
  } else if (hasRun && !isCardDirty(plan) && outOfDateRandomizations(plan).has(randomization.id)) {
    footer.append(
      createElement(
        "p",
        "The plan has changed since this last ran. Press Update to bring its stages up to date.",
        "card-problem-line",
      ),
    );
  }
  const buttons = createElement("div", "", "box-buttons");
  const remove = createElement("button", "Remove", "quiet-danger");
  remove.type = "button";
  remove.dataset.focusKey = "remove";
  const stages = countOf(randomization.stages.length, "stage");
  if (!canRemoveRandomization(plan, randomization.id)) {
    remove.disabled = true;
    remove.title = "Its stages are all the plan's stages. Add a stage outside it first.";
  } else if (hasRun) {
    remove.title = `Removes it and its ${stages}. Tips it added stay.`;
  }
  remove.addEventListener("click", removeOpenRandomization);
  buttons.append(remove, createElement("span", "", "spacer"));
  if (hasRun && isCardDirty(plan)) {
    const discard = createElement("button", "Discard", "action discard");
    discard.type = "button";
    discard.dataset.focusKey = "discard";
    discard.addEventListener("click", () => closeRandomizationCard({ discard: true }));
    buttons.append(discard);
  }
  const close = createElement("button", "Close", "action");
  close.type = "button";
  close.dataset.focusKey = "close";
  close.addEventListener("click", () => closeRandomizationCard());
  const run = createElement("button", hasRun ? "Update" : "Randomize", "primary run-randomization");
  run.type = "button";
  run.dataset.focusKey = "run";
  run.disabled = problem !== null;
  if (problem === null) {
    run.title = hasRun
      ? "Applies these settings to its stages. The same seed and source order keep the same wells; " +
        "a new seed or a new order shuffles again."
      : randomizeTooltip(plan);
  }
  run.addEventListener("click", runOpenRandomization);
  buttons.append(close, run);
  footer.append(buttons);
  return footer;
}

// Redraws the open card in place after a change to its draft, keeping the rest of the column as it
// is, and keeps the keyboard focus (and a text box's caret) on the same control.
function redrawCard() {
  if (card === null || card.element === null || !card.element.isConnected) {
    return;
  }
  const plan = currentPlan();
  const old = card.element;
  const active = document.activeElement;
  const focusKey = old.contains(active) ? active.dataset.focusKey : undefined;
  const caret =
    focusKey !== undefined && active instanceof HTMLInputElement
      ? [active.selectionStart, active.selectionEnd]
      : null;
  card.element = createRandomizationCard(plan, randomizationAt(plan, card.id));
  old.replaceWith(card.element);
  if (focusKey === undefined) {
    return;
  }
  const again = card.element.querySelector(`[data-focus-key="${cssEscape(focusKey)}"]`);
  again?.focus({ preventScroll: true });
  if (again instanceof HTMLInputElement && caret !== null) {
    again.setSelectionRange(caret[0], caret[1]);
  }
}

// After a change to the draft's sources or wells to fill: the deck's marks and the card follow it.
function draftChangedOnDeck() {
  refreshDeck();
  redrawCard();
}

// Closes the open card (section 7), if one is open, and opens again what was open before it.
// One that hasn't run saves its draft into the plan first (setRandomization), as one undoable edit
// (nothing if unchanged); one that has run closes only without changes, or with `discard`;
// otherwise it shakes and says why, and stays open. Returns true if no card is open afterwards.
function closeRandomizationCard({ discard = false } = {}) {
  if (card === null) {
    return true;
  }
  const plan = currentPlan();
  const randomization = randomizationAt(plan, card.id);
  const hasRun = randomization.stages.length > 0;
  const dirty = isCardDirty(plan);
  if (hasRun && dirty && !discard) {
    refuseCardClose();
    return false;
  }
  let saved = plan;
  if (!hasRun && dirty && !discard) {
    saved = tryLogic(() => draftPlan(plan));
    if (saved === false) {
      return false;
    }
  }
  const returnTo = validOpen(saved, card.returnTo);
  cardTabs.set(card.id, card.draft.tab);
  card = null;
  // Undo goes back to the plan as it was with the card closed, not to the card.
  history = history.replacePresent({ plan, open: returnTo });
  if (saved === plan) {
    refresh();
  } else {
    recordEdit(saved, returnTo);
  }
  return true;
}

// Escape on the open card (section 12): one that has run is closed without saving (as Discard);
// one that hasn't saves its draft, as Close does.
function closeCardWithEscape() {
  const hasRun = randomizationAt(currentPlan(), card.id).stages.length > 0;
  closeRandomizationCard({ discard: hasRun });
}

// Runs `action` once no card is open: the open card closes first, as Close would (section 7); if it
// can't, nothing happens.
function afterClosingCard(action) {
  if (closeRandomizationCard()) {
    action();
  }
}

// Shows that the open card, run and changed, can't close (section 7): it shakes, its main button
// and Discard pulse, and the message bar says what to do.
function refuseCardClose() {
  restartAnimation(card.element, "shake");
  for (const button of card.element.querySelectorAll(".run-randomization, .discard")) {
    restartAnimation(button, "pulse");
  }
  showMessage("Update or discard your changes first.", "note");
}

// Randomize or Update (section 7): saves the draft and runs it, as one undoable edit, closes the
// card and opens its first stage.
function runOpenRandomization() {
  const plan = currentPlan();
  const id = card.id;
  const hadRun = randomizationAt(plan, id).stages.length > 0;
  const run = tryLogic(() => runRandomization(draftPlan(plan), id));
  if (run === false) {
    return;
  }
  const randomization = randomizationAt(run, id);
  const first = randomization.stages[0].stage;
  const transfers = randomization.stages.reduce((total, owned) => total + transfersIn(run, owned.stage).length, 0);
  const returnTo = validOpen(plan, card.returnTo);
  cardTabs.set(id, card.draft.tab);
  card = null;
  history = history.replacePresent({ plan, open: returnTo });
  recordEdit(run, first);
  showMessage(
    `${hadRun ? "Updated" : "Randomized"}: ${countOf(randomization.stages.length, "stage")} with ` +
      `${countOf(transfers, "transfer")} (seed ${randomization.seed}). Undo takes the change out again.`,
    "ok",
  );
  scrollIntoColumnView(elements.stagesList.querySelector(`[data-entry="${cssEscape(first)}"]`));
}

// Remove (section 7): takes the randomization and, once it has run, its stages out at once, as one
// undoable edit, closing the card.
function removeOpenRandomization() {
  const plan = currentPlan();
  const id = card.id;
  const stages = randomizationAt(plan, id).stages.length;
  const removed = tryLogic(() => removeRandomization(plan, id));
  if (removed === false) {
    return;
  }
  const returnTo = validOpen(removed, card.returnTo);
  card = null;
  history = history.replacePresent({ plan, open: returnTo });
  recordEdit(removed, returnTo);
  showMessage(
    stages === 0
      ? "Removed the randomization."
      : `Removed the randomization and its ${countOf(stages, "stage")}. Undo brings them back.`,
    "note",
  );
}

// `key` if it can be open in `plan` (Start, End, a stage or a randomization), otherwise Start.
function validOpen(plan, key) {
  const exists = key === START || key === END || plan.stageList.has(key) || randomizationAt(plan, key) !== null;
  return exists ? key : START;
}

// True if `key` is one of the plan's randomizations.
function isRandomization(plan, key) {
  return randomizationAt(plan, key) !== null;
}

// The stage the deck shows a randomization before (section 11): its first stage once it has run,
// otherwise the stage it sits before; null when it sits after all stages.
function randomizationPlace(plan, id) {
  const randomization = randomizationAt(plan, id);
  return randomization.stages[0]?.stage ?? randomization.beforeId;
}

// Picks a well for the open card by its tab (section 9): on Sources, a click adds the well as a
// source, last (and it stops being a well to fill), or removes it if it's a source; on Wells to
// fill, a click picks the well or unpicks it, and does nothing on a source.
function pickWell(end) {
  const { draft } = card;
  const key = wellKey(end);
  const isSource = draft.sources.some((entry) => wellKey(entry) === key);
  if (draft.tab === "sources") {
    if (isSource) {
      draft.sources = removeDraftSources(draft.sources, (entry) => wellKey(entry) === key);
    } else {
      draft.sources.push({ labware: end.labware, well: end.well, replicatesText: "", filler: false, sharesTips: false });
      draft.fill = draft.fill.filter((other) => wellKey(other) !== key);
    }
  } else if (isSource) {
    return;
  } else if (draft.fill.some((other) => wellKey(other) === key)) {
    draft.fill = draft.fill.filter((other) => wellKey(other) !== key);
  } else {
    draft.fill.push({ labware: end.labware, well: end.well });
  }
  draftChangedOnDeck();
}

// Picks a box of wells for the open card by its tab (section 9): sources on Sources, wells to fill
// on Wells to fill. `wells` are the box's wells in wellsInBox's order; `firstWell` the one the drag
// started on.
function pickBox(wells, firstWell) {
  if (card.draft.tab === "sources") {
    pickSourceBox(wells, firstWell);
  } else {
    pickFillBox(wells, firstWell);
  }
}

// Picks a box of sources for the open card (section 9): adds each well that isn't a source yet,
// last, in the box's order (each then stops being a well to fill), or, if the box's first well was
// a source, removes every source in the box. Wells to fill in a box of sources removed stay wells
// to fill, since they never were sources.
function pickSourceBox(wells, firstWell) {
  const { draft } = card;
  const sources = new Set(draft.sources.map(wellKey));
  const inBox = new Set(wells.map(wellKey));
  if (sources.has(wellKey(firstWell))) {
    draft.sources = removeDraftSources(draft.sources, (entry) => inBox.has(wellKey(entry)));
  } else {
    const adding = wells.filter((end) => !sources.has(wellKey(end)));
    draft.sources.push(
      ...adding.map(({ labware, well }) => ({ labware, well, replicatesText: "", filler: false, sharesTips: false })),
    );
    draft.fill = draft.fill.filter((end) => !inBox.has(wellKey(end)));
  }
  draftChangedOnDeck();
}

// Picks a box of wells to fill for the open card (section 9): all of them, or, if the box's first
// well was picked, unpicks them all; sources in the box are left sources.
function pickFillBox(wells, firstWell) {
  const { draft } = card;
  const sources = new Set(draft.sources.map(wellKey));
  const picked = new Set(draft.fill.map(wellKey));
  const inBox = new Set(wells.map(wellKey));
  if (picked.has(wellKey(firstWell))) {
    draft.fill = draft.fill.filter((end) => !inBox.has(wellKey(end)));
  } else {
    const adding = wells.filter((end) => !sources.has(wellKey(end)) && !picked.has(wellKey(end)));
    draft.fill.push(...adding.map(({ labware, well }) => ({ labware, well })));
  }
  draftChangedOnDeck();
}

// The note for a click or drag on the deck while a randomization's or transfer table's stage `id`
// is open (section 7).
function showOwnedStageNote(plan, id) {
  if (transferTableOf(plan, id) !== null) {
    showMessage("This stage is part of a transfer table: change its amounts in the table.", "note");
    return;
  }
  showMessage("This stage is part of a randomization: change it in its card.", "note");
}

// True if stage `id` belongs to a randomization or a transfer table, so its transfers change only
// through them (section 7).
function isOwnedStage(plan, id) {
  return randomizationOf(plan, id) !== null || transferTableOf(plan, id) !== null;
}

// --- Transfer tables (section 7, "Transfer tables") ---

// The most problems the Table step lists before "…and N more." (section 7).
const TABLE_PROBLEMS_LISTED = 6;

// A transfer table's box in the Stages column (section 7): its heading and ✎, then, while the box
// is open (openTables), its stages' tip group boxes (one stage each). Between its tip group boxes (and above the first, below the last) are the places where its
// own stages can be dropped while one is dragged, never shown otherwise. `block` is from
// columnBlocks; `groupIndex` the place of its first tip group among all of them, for their colors;
// `boxIndex` its box's index in the column.
function createTransferTableBox(plan, block, groupIndex, open, problems, drawnKeys, boxIndex) {
  const { transferTable, groups } = block;
  const box = createElement("div", "", "transfer-table");
  box.dataset.item = itemKey({ kind: "transferTable", id: transferTable.id });
  applyGlow(box, box.dataset.item, drawnKeys, { whenNew: false });
  const expanded = openTables.has(transferTable.id);
  const heading = createTransferTableHeading(transferTable, outOfDateTransferTables(plan).has(transferTable.id), expanded);
  heading.dataset.itemHandle = box.dataset.item;
  const head = createElement("div", "", "transfer-table-head");
  head.append(heading, createTablePencil(transferTable.id));
  box.append(head);
  if (!expanded) {
    groups.forEach(({ group }) => noteDrawnWithoutGlow(group, drawnKeys));
    return box;
  }
  const stages = createElement("div", "", "transfer-table-stages");
  stages.append(createTableDropPlace(transferTable.id, boxIndex, 0));
  groups.forEach((groupBlock, place) => {
    stages.append(
      createTipGroupBox(plan, groupBlock, groupIndex + place, open, problems, drawnKeys, "transferTable"),
      createTableDropPlace(transferTable.id, boxIndex, place + 1),
    );
  });
  box.append(stages);
  return box;
}

// A place inside transfer table `id` (box `boxIndex`) just before its stage at `position`, where
// its own stages can be dropped (moveItems with an inTransferTable place). It has no buttons, and
// only a drag of that table's own stages finds it (seamNearestPointer).
function createTableDropPlace(id, boxIndex, position) {
  const place = createElement("div", "", "table-seam");
  place.dataset.table = id;
  return withDropPlace(place, { kind: "inTransferTable", index: boxIndex, position });
}

// A transfer table's heading (section 7): a button with ▸ (closed) or ▾ (open, `expanded`), the
// table icon, "Transfer table", and, at the right, "4 stages", or, when `outOfDate`, "needs update"
// in red. Clicking it opens or closes the box (clickItem, as for any item's handle).
function createTransferTableHeading(transferTable, outOfDate, expanded) {
  const heading = createElement("button", "", "randomization-heading transfer-table-heading");
  heading.type = "button";
  heading.setAttribute("aria-expanded", String(expanded));
  heading.title = outOfDate
    ? "The plan changed since this was made: press ✎, then Update."
    : expanded
      ? "Hide its stages"
      : "Show its stages";
  const status = createElement(
    "span",
    outOfDate ? "needs update" : countOf(transferTable.stages.length, "stage"),
    "randomization-status",
  );
  status.classList.toggle("needs-update", outOfDate);
  heading.append(
    createElement("span", expanded ? "▾" : "▸", "folder-mark"),
    createTableIcon(),
    createElement("span", "Transfer table", "randomization-title"),
    status,
  );
  return heading;
}

// The ✎ on a transfer table's heading (section 7): opens its wizard at Review and selects it.
function createTablePencil(id) {
  const pencil = createElement("button", "✎", "edit-button table-edit");
  pencil.type = "button";
  pencil.title = "Change the table, its sources or remove it";
  pencil.setAttribute("aria-label", "Edit transfer table");
  pencil.addEventListener("click", () => {
    if (closeRandomizationCard()) {
      pickedSet = [{ kind: "transferTable", id }];
      markSelection(selectedItems());
      openWizardFor(id);
    }
  });
  return pencil;
}

// Opens transfer table `id`'s box if it's closed, or closes it (section 7, "Its box"); it only
// shows or hides, so it's no edit.
function toggleTableBox(id) {
  if (openTables.has(id)) {
    openTables.delete(id);
  } else {
    openTables.add(id);
  }
  const key = itemKey({ kind: "transferTable", id });
  const hadFocus = document.activeElement?.dataset?.itemHandle === key;
  refreshStages();
  // The column is drawn afresh, so a heading toggled from the keyboard gets its focus back.
  if (hadFocus) {
    elements.stagesList.querySelector(`.transfer-table-heading[data-item-handle="${cssEscape(key)}"]`)?.focus();
  }
}

// The table icon (section 7): a rounded rectangle 15 by 13 with two lines across and two down,
// drawn in the text's color.
function createTableIcon() {
  const svg = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(svg, "svg");
  icon.setAttribute("viewBox", "0 0 18 16");
  icon.setAttribute("class", "table-icon");
  icon.setAttribute("aria-hidden", "true");
  // One SVG element called `name` with `attributes`, e.g. shape("line", { x1: 0, … }).
  const shape = (name, attributes) => {
    const element = document.createElementNS(svg, name);
    for (const [attribute, value] of Object.entries(attributes)) {
      element.setAttribute(attribute, String(value));
    }
    return element;
  };
  icon.append(
    shape("rect", { x: 1.5, y: 1.5, width: 15, height: 13, rx: 2 }),
    shape("line", { x1: 1.5, y1: 5.8, x2: 16.5, y2: 5.8 }),
    shape("line", { x1: 1.5, y1: 10.2, x2: 16.5, y2: 10.2 }),
    shape("line", { x1: 6.5, y1: 1.5, x2: 6.5, y2: 14.5 }),
    shape("line", { x1: 11.5, y1: 1.5, x2: 11.5, y2: 14.5 }),
  );
  return icon;
}

// --- The transfer table wizard (section 7, "The wizard") ---

// Connects the wizard's dialog: a press on the backdrop closes it, and Escape anywhere in it but a
// cell being edited closes it too, changing nothing.
function connectWizard() {
  elements.wizardBackdrop.addEventListener("pointerdown", (event) => {
    if (event.target === elements.wizardBackdrop) {
      closeWizard();
    }
  });
  elements.wizard.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      // Stopped here, so the page's own Escape (forgetting the selection) doesn't act on it too.
      event.stopPropagation();
      closeWizard();
    }
  });
}

// Opens a new wizard for a transfer table before stage `beforeId` (or at the end, for null), from a
// seam between tip groups; `toPlace` are the randomizations that haven't run just above the seam,
// which Add keeps above the transfer table (section 7, "The seam's table button"). Nothing is added
// until Add.
function openNewWizard(beforeId, toPlace) {
  closeEditingBox();
  source = null;
  wizard = {
    id: null,
    beforeId,
    toPlace,
    step: "table",
    draft: { table: null, sources: {} },
    origins: [],
    pasteRefused: false,
  };
  showWizard();
  focusWizardElement("paste-zone");
}

// Opens the wizard for transfer table `id`, with its stored table and sources, at Review, or at the
// first step with a problem (section 7, "The draft").
function openWizardFor(id) {
  closeEditingBox();
  source = null;
  const transferTable = transferTableAt(currentPlan(), id);
  wizard = {
    id,
    beforeId: null,
    toPlace: [],
    step: "review",
    draft: {
      table: transferTable.table.map((row) => [...row]),
      sources: Object.fromEntries(
        Object.entries(transferTable.sources).map(([component, wells]) => [component, wells.map((end) => ({ ...end }))]),
      ),
    },
    origins: transferTable.table[0].map(() => undefined),
    pasteRefused: false,
  };
  keepDraftSourcesUsable(currentPlan());
  if (!isTableStepDone(currentPlan())) {
    wizard.step = "table";
  } else if (!isSourcesStepDone(currentPlan())) {
    wizard.step = "sources";
  }
  showWizard();
  focusWizardElement("main");
}

// Shows the wizard's dialog over the page, drawn from `wizard`, and makes everything behind it
// unreachable (inert), except the message bar.
function showWizard() {
  for (const child of document.body.children) {
    if (child !== elements.wizardBackdrop && child !== elements.messageBar) {
      child.inert = true;
    }
  }
  elements.wizardBackdrop.hidden = false;
  drawWizard();
}

// Closes the wizard without changing anything, and makes the page reachable again.
function closeWizard() {
  if (wizard === null) {
    return;
  }
  wizard = null;
  elements.wizardBackdrop.hidden = true;
  elements.wizard.replaceChildren();
  for (const child of document.body.children) {
    child.inert = false;
  }
}

// Draws the wizard's dialog: its header, the current step's body and its footer. The focus, if it
// was on one of the dialog's controls, goes back to the same control.
function drawWizard() {
  const focused = document.activeElement?.closest?.("[data-wizard-focus]")?.dataset.wizardFocus;
  const plan = currentPlan();
  const body = createElement("div", "", "wizard-body");
  if (wizard.step === "table") {
    body.append(...createTableStep(plan));
  } else if (wizard.step === "sources") {
    body.append(...createSourcesStep(plan));
  } else {
    body.append(...createReviewStep(plan));
  }
  elements.wizard.replaceChildren(createWizardHeader(plan), body, createWizardFooter(plan));
  if (focused !== undefined) {
    focusWizardElement(focused);
  }
}

// Focuses the wizard's control whose focus key (data-wizard-focus) is `key`, e.g. "main" or
// "cell:2:1", selecting a text box's text; nothing if there's none.
function focusWizardElement(key) {
  const element = elements.wizard.querySelector(`[data-wizard-focus="${cssEscape(key)}"]`);
  if (element === null) {
    return;
  }
  element.focus();
  if (element instanceof HTMLInputElement) {
    element.select();
  }
}

// `element` with focus key `key`, so drawing the wizard again can give it back the focus.
function withFocusKey(element, key) {
  element.dataset.wizardFocus = key;
  return element;
}

// Where the draft's stages go, for the logic: a new transfer table's stage it's added before (null
// for the end), or a transfer table's first stage.
function wizardAt(plan) {
  return wizard.id === null ? wizard.beforeId : transferTableAt(plan, wizard.id).stages[0].stage;
}

// The draft's table read against the plan (readTransferTable), or null before a paste.
function wizardReading(plan) {
  return wizard.draft.table === null ? null : readTransferTable(plan, wizard.draft.table);
}

// The draft's columns that make a stage (a component and an amount), in column order.
function makingColumns(plan) {
  const reading = wizardReading(plan);
  return reading === null ? [] : reading.columns.filter((column) => column.amounts.length > 0);
}

// The Table step's problems, as messages: the table's (readTransferTable's), or, with none, that it
// adds nothing if no column makes a stage; [] before a paste.
function tableStepProblems(plan) {
  const reading = wizardReading(plan);
  if (reading === null) {
    return [];
  }
  if (reading.problems.length > 0) {
    return reading.problems.map((problem) => problem.message);
  }
  return makingColumns(plan).length === 0 ? ["The table adds nothing: every amount is blank or 0."] : [];
}

// True if the Table step is done: a table is in, with no problems, and makes a stage.
function isTableStepDone(plan) {
  return wizard.draft.table !== null && tableStepProblems(plan).length === 0;
}

// True if the Sources step is done: the Table step is, and every column making a stage has wells
// the logic accepts (transferTableProblems finds nothing).
function isSourcesStepDone(plan) {
  return isTableStepDone(plan) && transferTableProblems(plan, wizard.draft, wizardAt(plan)).length === 0;
}

// The renames the wizard remembers (section 7, "Header changes are renames"), as renamedFrom: each
// column whose header was changed from a component's name, now naming something else, e.g.
// { DMEM: "Media" }.
function wizardRenamedFrom() {
  const renamedFrom = {};
  if (wizard.draft.table === null) {
    return renamedFrom;
  }
  wizard.draft.table[0].forEach((cell, column) => {
    const origin = wizard.origins[column];
    const name = cell.trim();
    if (origin !== undefined && name !== "" && name !== origin) {
      renamedFrom[name] = origin;
    }
  });
  return renamedFrom;
}

// Keeps the draft's sources usable (section 7, "A new column's wells"): each column making a stage
// draws from its stock wells only, a well that no longer holds only its component being dropped,
// and gets the first stock well when it has none left (or none yet). Other columns' wells are kept,
// so a column deleted and brought back keeps them.
function keepDraftSourcesUsable(plan) {
  const { sources } = wizard.draft;
  for (const { component } of makingColumns(plan)) {
    const stock = stockWellsOf(plan, component);
    const stockKeys = new Set(stock.map(wellKey));
    const kept = (sources[component] ?? []).filter((end) => stockKeys.has(wellKey(end)));
    if (kept.length > 0) {
      sources[component] = kept;
    } else if (stock.length > 0) {
      sources[component] = [{ ...stock[0] }];
    } else {
      delete sources[component];
    }
  }
}

// The wizard's header: the table icon and its title, then the three steps as pills.
function createWizardHeader(plan) {
  const header = createElement("div", "", "wizard-header");
  const title = createElement("h2", wizard.id === null ? "New transfer table" : "Transfer table", "wizard-title");
  title.id = "wizard-title";
  title.prepend(createTableIcon());
  const steps = createElement("div", "", "wizard-steps");
  const order = ["table", "sources", "review"];
  const names = { table: "Table", sources: "Sources", review: "Review" };
  const reachable = { table: true, sources: isTableStepDone(plan), review: isSourcesStepDone(plan) };
  order.forEach((step, index) => {
    const pill = withFocusKey(createElement("button", "", "wizard-step"), `step:${step}`);
    pill.type = "button";
    pill.append(createElement("span", String(index + 1), "wizard-step-number"), names[step]);
    pill.classList.toggle("current", step === wizard.step);
    pill.classList.toggle("done", index < order.indexOf(wizard.step));
    if (step === wizard.step) {
      pill.setAttribute("aria-current", "step");
    }
    pill.disabled = !reachable[step];
    pill.addEventListener("click", () => goToWizardStep(step));
    steps.append(pill);
  });
  header.append(title, steps);
  return header;
}

// Goes to `step` of the wizard, if it can be reached.
function goToWizardStep(step) {
  wizard.step = step;
  drawWizard();
  focusWizardElement("main");
}

// The wizard's footer: Remove (a transfer table in the plan only), then Cancel, Back (not on Table)
// and the main button: Next on Table and Sources, disabled until the step is done; Add or Update on
// Review.
function createWizardFooter(plan) {
  const footer = createElement("div", "", "wizard-footer");
  if (wizard.id !== null) {
    const remove = withFocusKey(createElement("button", "Remove", "danger-outline"), "remove");
    remove.type = "button";
    if (!canRemoveTransferTable(plan, wizard.id)) {
      remove.disabled = true;
      remove.title = "Its stages are all the plan's stages. Add a stage outside it first.";
    }
    remove.addEventListener("click", removeFromWizard);
    footer.append(remove);
  }
  footer.append(createElement("span", "", "spacer"));
  const cancel = withFocusKey(createElement("button", "Cancel", "action"), "cancel");
  cancel.type = "button";
  cancel.addEventListener("click", closeWizard);
  footer.append(cancel);
  if (wizard.step !== "table") {
    const back = withFocusKey(createElement("button", "Back", "action"), "back");
    back.type = "button";
    back.addEventListener("click", () => goToWizardStep(wizard.step === "review" ? "sources" : "table"));
    footer.append(back);
  }
  const mainLabel = wizard.step !== "review" ? "Next" : wizard.id === null ? "Add" : "Update";
  const main = withFocusKey(createElement("button", mainLabel, "primary wizard-main"), "main");
  main.type = "button";
  if (wizard.step === "table") {
    main.disabled = !isTableStepDone(plan);
    main.addEventListener("click", () => goToWizardStep("sources"));
  } else if (wizard.step === "sources") {
    main.disabled = !isSourcesStepDone(plan);
    main.addEventListener("click", () => goToWizardStep("review"));
  } else {
    main.addEventListener("click", wizard.id === null ? addFromWizard : updateFromWizard);
  }
  footer.append(main);
  return footer;
}

// --- The wizard's Table step ---

// The Table step's contents: the paste zone before a paste, then the grid.
function createTableStep(plan) {
  if (wizard.draft.table === null) {
    return createPasteZone();
  }
  return [createTableGrid(plan), createGridButtons(), createTableSummary(plan)];
}

// The paste zone (section 7, "Table step, before a paste"): a dashed box taking a paste from Excel,
// help text under it, and, after a paste it couldn't use, why in red.
function createPasteZone() {
  const zone = withFocusKey(
    createElement("div", "Click here and press Ctrl+V to paste a table from Excel", "paste-zone"),
    "paste-zone",
  );
  zone.tabIndex = 0;
  zone.setAttribute("role", "textbox");
  zone.setAttribute("aria-label", "Paste a table from Excel here");
  zone.addEventListener("paste", (event) => {
    event.preventDefault();
    event.stopPropagation();
    takePastedTable(event.clipboardData?.getData("text/plain") ?? "");
  });
  const parts = [
    zone,
    createElement(
      "p",
      "The table's first row is a header: the first column is a well label, each other column a " +
        "component's name. Each row after it gives the µL of each component to add to every well " +
        "with that label. Blank or 0 adds nothing.",
      "wizard-help",
    ),
  ];
  if (wizard.pasteRefused) {
    parts.push(
      createElement(
        "p",
        "Paste a table with a header row, at least one row of well labels, and at least one component column.",
        "wizard-error",
      ),
    );
  }
  return parts;
}

// Takes pasted `text` as the draft's table (section 7): read with parsePastedTable, rows whose cells
// are all blank dropped, shorter rows filled with empty cells to the widest's length. With fewer
// than two rows or two columns left, the paste zone stays and says why.
function takePastedTable(text) {
  const rows = text === "" ? [] : parsePastedTable(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  const width = Math.max(0, ...rows.map((row) => row.length));
  if (rows.length < 2 || width < 2) {
    wizard.pasteRefused = true;
    drawWizard();
    focusWizardElement("paste-zone");
    return;
  }
  wizard.draft.table = rows.map((row) => [...row, ...Array(width - row.length).fill("")]);
  wizard.origins = Array(width).fill(undefined);
  wizard.pasteRefused = false;
  keepDraftSourcesUsable(currentPlan());
  drawWizard();
  focusWizardElement(isTableStepDone(currentPlan()) ? "main" : "cell:0:0");
}

// The grid (section 7, "Table step, with a table"): every cell a text box, in a scrolling frame,
// the header row and label column tinted, matched headers with their component's swatch, matched
// labels with their well count, problem cells red with their message as tooltip.
function createTableGrid(plan) {
  const frame = createElement("div", "", "wizard-grid-frame");
  const grid = createElement("table", "", "wizard-grid");
  const { table } = wizard.draft;
  table.forEach((row, rowIndex) => {
    const tr = createElement("tr");
    row.forEach((_, column) => tr.append(createGridCell(rowIndex, column)));
    grid.append(tr);
  });
  frame.append(grid);
  wizard.gridElement = grid;
  decorateGrid(plan);
  return frame;
}

// One cell of the grid at `row` and `column`: a text box, with a swatch before it (header cells),
// a well count after it (label cells), and a × deleting its row or column (label cells after the
// header, header cells after the first).
function createGridCell(row, column) {
  const cell = createElement(row === 0 ? "th" : "td", "", "wizard-cell");
  cell.classList.toggle("header-cell", row === 0);
  cell.classList.toggle("label-cell", column === 0);
  cell.classList.toggle("amount-cell", row > 0 && column > 0);
  cell.dataset.row = String(row);
  cell.dataset.column = String(column);
  const inner = createElement("div", "", "wizard-cell-inner");
  if (row === 0 && column > 0) {
    const swatch = createElement("span", "", "swatch cell-swatch");
    swatch.hidden = true;
    inner.append(swatch);
  }
  const box = withFocusKey(document.createElement("input"), `cell:${row}:${column}`);
  box.type = "text";
  box.className = "cell-box";
  box.value = wizard.draft.table[row][column];
  box.setAttribute("aria-label", cellName(row, column));
  connectGridCell(box, row, column);
  inner.append(box);
  if (row > 0 && column === 0) {
    const count = createElement("span", "", "cell-well-count");
    count.hidden = true;
    inner.append(count);
  }
  if ((row > 0 && column === 0) || (row === 0 && column > 0)) {
    inner.append(createDeleteButton(row, column));
  }
  cell.append(inner);
  return cell;
}

// A cell's accessible name, e.g. "Row 3, column 2", counting from 1.
function cellName(row, column) {
  return `Row ${row + 1}, column ${column + 1}`;
}

// A cell's ×, deleting its row (a label cell) or its column (a header cell): out of the Tab order.
function createDeleteButton(row, column) {
  const isRow = column === 0;
  const name = isRow ? `Delete row ${row + 1}` : `Delete column ${column + 1}`;
  const button = createElement("button", "×", "cell-delete");
  button.type = "button";
  button.tabIndex = -1;
  button.title = name;
  button.setAttribute("aria-label", name);
  button.addEventListener("click", () => (isRow ? deleteTableRow(row) : deleteTableColumn(column)));
  return button;
}

// Connects a cell's text box (section 7, "Editing a cell"): its text selected when focused; a
// change read when it's left or on Enter, which also moves down a row; Escape puts the text back;
// a paste is plain text, its tabs and line breaks made spaces.
function connectGridCell(box, row, column) {
  box.addEventListener("focus", () => box.select());
  box.addEventListener("blur", () => commitCell(row, column, box.value));
  box.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitCell(row, column, box.value);
      const below = Math.min(row + 1, wizard.draft.table.length - 1);
      focusWizardElement(`cell:${below}:${column}`);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      box.value = wizard.draft.table[row][column];
      box.select();
    }
  });
  box.addEventListener("paste", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const text = (event.clipboardData?.getData("text/plain") ?? "").replace(/\r\n|[\t\r\n]/g, " ");
    const start = box.selectionStart ?? box.value.length;
    const end = box.selectionEnd ?? box.value.length;
    box.value = box.value.slice(0, start) + text + box.value.slice(end);
    box.setSelectionRange(start + text.length, start + text.length);
  });
}

// Reads a cell's new text into the draft, if it changed, and re-reads the table (its problems,
// matches and summary) without drawing the grid again, so the focus stays where it went. A header
// that named a component, changed, is remembered as a rename (section 7).
function commitCell(row, column, text) {
  if (wizard === null || wizard.draft.table === null || wizard.draft.table[row]?.[column] === undefined) {
    return;
  }
  const old = wizard.draft.table[row][column];
  if (text === old) {
    return;
  }
  const plan = currentPlan();
  if (row === 0 && wizard.origins[column] === undefined && hasComponent(plan, old.trim()) && old.trim() !== text.trim()) {
    wizard.origins[column] = old.trim();
  }
  wizard.draft.table[row][column] = text;
  keepDraftSourcesUsable(plan);
  decorateGrid(plan);
  refreshWizardChrome(plan);
}

// Marks the grid's cells from the draft read against the plan: problem cells red with their
// message as tooltip, matched headers' swatches, and matched labels' well counts.
function decorateGrid(plan) {
  const reading = wizardReading(plan);
  const problems = new Map();
  for (const problem of reading.problems) {
    const key = `${problem.row}:${problem.column}`;
    problems.set(key, problems.has(key) ? `${problems.get(key)} ${problem.message}` : problem.message);
  }
  for (const cell of wizard.gridElement.querySelectorAll(".wizard-cell")) {
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    const message = problems.get(`${row}:${column}`);
    cell.classList.toggle("problem", message !== undefined);
    cell.querySelector(".cell-box").title = message ?? "";
    const text = wizard.draft.table[row][column].trim();
    const swatch = cell.querySelector(".cell-swatch");
    if (swatch !== null) {
      swatch.hidden = !hasComponent(plan, text);
      swatch.style.setProperty("--swatch-color", componentColor(plan, text));
    }
    const count = cell.querySelector(".cell-well-count");
    if (count !== null) {
      const wells = wellsLabeled(plan, text);
      count.hidden = text === "" || wells === 0;
      count.textContent = countOf(wells, "well");
    }
  }
}

// How many wells carry the well label `label`, e.g. 3.
function wellsLabeled(plan, label) {
  return Object.values(plan.wellLabels).reduce(
    (total, wells) => total + Object.values(wells).filter((candidate) => candidate === label).length,
    0,
  );
}

// Brings the wizard's steps, main button and the Table step's summary up to date after a cell
// changed, without drawing the grid again. The steps and the main button are changed in place, not
// drawn again, so a press on one that left a cell (and so changed it) still clicks it.
function refreshWizardChrome(plan) {
  const dialog = elements.wizard;
  const reachable = { sources: isTableStepDone(plan), review: isSourcesStepDone(plan) };
  for (const [step, canReach] of Object.entries(reachable)) {
    const pill = dialog.querySelector(`[data-wizard-focus="step:${step}"]`);
    if (pill !== null) {
      pill.disabled = !canReach;
    }
  }
  const main = dialog.querySelector('[data-wizard-focus="main"]');
  if (main !== null && wizard.step === "table") {
    main.disabled = !reachable.sources;
  }
  dialog.querySelector(".table-summary")?.replaceWith(createTableSummary(plan));
}

// `+ Row` and `+ Column`, under the grid.
function createGridButtons() {
  const holder = createElement("div", "", "wizard-grid-buttons");
  const addRow = withFocusKey(createElement("button", "+ Row", "action small-button"), "add-row");
  addRow.type = "button";
  addRow.addEventListener("click", addTableRow);
  const addColumn = withFocusKey(createElement("button", "+ Column", "action small-button"), "add-column");
  addColumn.type = "button";
  addColumn.addEventListener("click", addTableColumn);
  holder.append(addRow, addColumn);
  return holder;
}

// Adds an empty row at the bottom of the grid and focuses its label cell.
function addTableRow() {
  const { table } = wizard.draft;
  table.push(Array(table[0].length).fill(""));
  afterGridShapeChange(`cell:${table.length - 1}:0`);
}

// Adds an empty column at the right of the grid and focuses its header.
function addTableColumn() {
  const { table } = wizard.draft;
  for (const row of table) {
    row.push("");
  }
  wizard.origins.push(undefined);
  afterGridShapeChange(`cell:0:${table[0].length - 1}`);
}

// Deletes row `row` (not the header row).
function deleteTableRow(row) {
  wizard.draft.table.splice(row, 1);
  afterGridShapeChange(null);
}

// Deletes column `column` (not the label column), forgetting whether it was renamed.
function deleteTableColumn(column) {
  for (const row of wizard.draft.table) {
    row.splice(column, 1);
  }
  wizard.origins.splice(column, 1);
  afterGridShapeChange(null);
}

// Draws the wizard again after a row or column was added or deleted, focusing `focusKey`'s control
// if given.
function afterGridShapeChange(focusKey) {
  keepDraftSourcesUsable(currentPlan());
  drawWizard();
  if (focusKey !== null) {
    focusWizardElement(focusKey);
  }
}

// Under the grid: with no problems, "6 well labels (18 wells), 4 components." in gray; otherwise
// the problems in a red-tinted box, at most TABLE_PROBLEMS_LISTED, then "…and N more.", then how to
// fix them.
function createTableSummary(plan) {
  const problems = tableStepProblems(plan);
  if (problems.length === 0) {
    const labels = new Set(
      wizard.draft.table
        .slice(1)
        .map((row) => row[0].trim())
        .filter((label) => label !== ""),
    );
    const wells = [...labels].reduce((total, label) => total + wellsLabeled(plan, label), 0);
    const text =
      `${countOf(labels.size, "well label")} (${countOf(wells, "well")}), ` +
      `${countOf(makingColumns(plan).length, "component")}.`;
    return createElement("p", text, "wizard-help table-summary");
  }
  const box = createElement("div", "", "wizard-problems");
  for (const message of problems.slice(0, TABLE_PROBLEMS_LISTED)) {
    box.append(createElement("p", message));
  }
  if (problems.length > TABLE_PROBLEMS_LISTED) {
    box.append(createElement("p", `…and ${problems.length - TABLE_PROBLEMS_LISTED} more.`));
  }
  const holder = createElement("div", "", "table-summary");
  holder.append(box, createElement("p", "Fix the red cells above: click one and type.", "wizard-help"));
  return holder;
}

// --- The wizard's Sources step ---

// The Sources step's contents (section 7, "Sources step"): help text, then a row per column making
// a stage with the wells it draws from, then the step's problems.
function createSourcesStep(plan) {
  const help = createElement(
    "p",
    "Each stage draws from a well holding only its component at Start. Add more wells when one can't " +
      "hold enough: they're used in order, each until the next transfer would reach into its dead volume.",
    "wizard-help",
  );
  const table = createElement("table", "", "wizard-table");
  const head = createElement("tr");
  head.append(createElement("th", "Stage"), createElement("th", "Draws from"));
  table.append(head);
  makingColumns(plan).forEach((column, index) => {
    const row = createElement("tr");
    const drawsFrom = createElement("td");
    drawsFrom.append(...createDrawsFrom(plan, column.component));
    row.append(createStageCell(plan, column.component, index), drawsFrom);
    table.append(row);
  });
  return [help, table, ...createSourcesProblems(plan)];
}

// A Stage cell: "1. " then the component's swatch and name, semibold.
function createStageCell(plan, component, index) {
  const cell = createElement("td", "", "wizard-stage-cell");
  cell.append(`${index + 1}. `, createSwatch(componentColor(plan, component)), createElement("strong", component));
  return cell;
}

// A column's Draws from cell: its wells, one line each, numbered, each a menu of its stock wells
// (its own and those no other line has), with × when there's more than one; then "+ Another well"
// while a stock well isn't on a line; then, with more than one line, how the transfers split. With
// no stock well, says so in red.
function createDrawsFrom(plan, component) {
  const stock = stockWellsOf(plan, component);
  if (stock.length === 0) {
    return [createElement("span", "No well holds only this at Start", "wizard-error-text")];
  }
  const wells = wizard.draft.sources[component] ?? [];
  const parts = wells.map((end, line) => createSourceLine(plan, component, stock, wells, line));
  const unused = stock.filter((candidate) => !wells.some((end) => wellKey(end) === wellKey(candidate)));
  if (unused.length > 0) {
    const another = withFocusKey(createElement("button", "+ Another well", "action small-button"), `another:${component}`);
    another.type = "button";
    another.addEventListener("click", () => {
      wizard.draft.sources[component] = [...wells, { ...unused[0] }];
      drawWizard();
    });
    parts.push(another);
  }
  if (wells.length > 1) {
    const split = tryLogic(() => sourceSplit(plan, wizard.draft, component, wizardAt(plan)));
    if (split !== false) {
      const text = split.map(({ well, count }) => `${wellName(plan, well)}: ${countOf(count, "well")}`).join(" · ");
      parts.push(createElement("p", text, "wizard-note"));
    }
  }
  return parts;
}

// One line of a column's wells: its number, its menu, and × with more than one line.
function createSourceLine(plan, component, stock, wells, line) {
  const holder = createElement("div", "", "source-line");
  const offered = stock.filter(
    (candidate) => !wells.some((end, other) => other !== line && wellKey(end) === wellKey(candidate)),
  );
  const menu = withFocusKey(document.createElement("select"), `source:${component}:${line}`);
  menu.setAttribute("aria-label", `${component}'s well ${line + 1}`);
  for (const candidate of offered) {
    const label = wellLabelOf(plan, candidate);
    const option = createElement("option", `${wellName(plan, candidate)}${label === null ? "" : ` · ${label}`}`);
    option.value = wellKey(candidate);
    option.selected = wellKey(candidate) === wellKey(wells[line]);
    menu.append(option);
  }
  menu.addEventListener("change", () => {
    const chosen = offered.find((candidate) => wellKey(candidate) === menu.value);
    wizard.draft.sources[component] = wells.map((end, other) => (other === line ? { ...chosen } : end));
    drawWizard();
  });
  holder.append(createElement("span", String(line + 1), "source-number"), menu);
  if (wells.length > 1) {
    const remove = createElement("button", "×", "cell-delete source-remove");
    remove.type = "button";
    remove.title = "Don't draw from this well";
    remove.setAttribute("aria-label", "Don't draw from this well");
    remove.addEventListener("click", () => {
      wizard.draft.sources[component] = wells.filter((_, other) => other !== line);
      drawWizard();
    });
    holder.append(remove);
  }
  return holder;
}

// The Sources step's problems under its table, as the logic gives them, except that a column with
// no stock well gets the page's own words, saying Cancel discards the paste.
function createSourcesProblems(plan) {
  if (!isTableStepDone(plan)) {
    return [];
  }
  const noStock = new Map(
    makingColumns(plan)
      .filter(({ component }) => stockWellsOf(plan, component).length === 0)
      .map(({ component }) => [
        `No well holds only ${component} at Start. Fill one with ${component} at Start first.`,
        `No well holds only ${component} at Start. Cancel, fill one at Start, and start the transfer table again.`,
      ]),
  );
  const problems = transferTableProblems(plan, wizard.draft, wizardAt(plan));
  if (problems.length === 0) {
    return [];
  }
  const box = createElement("div", "", "wizard-problems");
  for (const { message } of problems) {
    box.append(createElement("p", noStock.get(message) ?? message));
  }
  return [box];
}

// --- The wizard's Review step ---

// The Review step's contents (section 7, "Review step"): what Add or Update will make, read-only.
function createReviewStep(plan) {
  const entries = tryLogic(() =>
    transferTableStages(plan, wizard.draft, wizardAt(plan), { id: wizard.id, renamedFrom: wizardRenamedFrom() }),
  );
  if (entries === false) {
    return [createElement("p", "Go back and fix the problems first.", "wizard-error")];
  }
  let where = "where its stages are now";
  if (wizard.id === null) {
    where = wizard.beforeId === null ? "at the end of the run" : `before ${stageLabel(plan, wizard.beforeId)}`;
  }
  const intro = createElement(
    "p",
    `${countOf(entries.length, "stage")}, each on new tips, ${where}. Change a stage's pipetting or tips ` +
      "afterwards with its ✎ in the Stages column.",
    "wizard-help",
  );
  const table = createElement("table", "", "wizard-table review-table");
  const head = createElement("tr");
  for (const title of ["Stage", "From", "Into", "Total", "Aspirate · Dispense", "Tips"]) {
    head.append(createElement("th", title));
  }
  table.append(head);
  entries.forEach((entry, index) => table.append(createReviewRow(plan, entry, index)));
  const unused = wizardReading(plan)
    .columns.filter((column) => column.amounts.length === 0)
    .map((column) => createElement("p", `No stage for ${column.component}: every amount is blank or 0.`, "wizard-help"));
  return [intro, table, ...unused];
}

// One stage's row on Review: its sources, wells, total, modes and tips, and, when its largest
// amount is more than one tip of its type holds (MIX_VOLUME_LIMITS, stand-ins; roadmap, "Technical
// debt"), a note saying so.
function createReviewRow(plan, entry, index) {
  const row = createElement("tr");
  const wells = wizard.draft.sources[entry.component].map((end) => wellName(plan, end)).join(", then ");
  const total = entry.transfers.reduce((sum, transfer) => sum + transfer.volume, 0);
  const tips = createElement("td", `${entry.tips.probes.length} × ${entry.tips.tipType}`);
  const largest = Math.max(...entry.transfers.map((transfer) => transfer.volume));
  if (largest > MIX_VOLUME_LIMITS[entry.tips.tipType]) {
    const note = createElement("span", `up to ${formatVolume(largest)} µL per well`, "wizard-note tip-note");
    note.title = `More than one ${entry.tips.tipType} tip holds in one trip.`;
    tips.append(note);
  }
  row.append(
    createStageCell(plan, entry.component, index),
    createElement("td", wells),
    createElement("td", countOf(entry.transfers.length, "well")),
    createElement("td", `${formatVolume(total)} µL`),
    createElement("td", `${reviewModeText(entry.settings, "source")} · ${reviewModeText(entry.settings, "destination")}`),
    tips,
  );
  return row;
}

// One end's mode as Review shows it: its name (modeOf), "(other)" if it isn't one of the modes,
// with " ⟳" after it if the end mixes, e.g. "Slow ⟳".
function reviewModeText(settings, end) {
  const mode = modeOf(end, settings) ?? "(other)";
  return settings[`${end}Mix`] !== null ? `${mode} ⟳` : mode;
}

// --- The wizard's Add, Update and Remove ---

// "4 stages (Media, Drug A, Drug B, DMSO)": transfer table `id`'s stages and their components.
function tableStagesText(plan, id) {
  const { stages } = transferTableAt(plan, id);
  return `${countOf(stages.length, "stage")} (${stages.map((owned) => owned.component).join(", ")})`;
}

// Add (section 7, "Add and Update"): adds the transfer table at the seam's place, keeping the
// randomizations above the seam above it, as one undoable edit; closes the wizard and opens its
// first stage. If the logic refuses, its message is shown and the wizard stays open.
function addFromWizard() {
  const plan = currentPlan();
  const result = tryLogic(() => {
    const added = addTransferTable(plan, wizard.draft, wizard.beforeId);
    const first = transferTableAt(added.plan, added.id).stages[0].stage;
    const placed = wizard.toPlace.reduce((planSoFar, id) => placeRandomization(planSoFar, id, first), added.plan);
    return { plan: placed, id: added.id, first };
  });
  if (result === false) {
    return;
  }
  closeWizard();
  recordEdit(result.plan, result.first);
  showMessage(`Added a transfer table: ${tableStagesText(result.plan, result.id)}.`, "ok");
  scrollIntoColumnView(elements.stagesList.querySelector(`[data-item="${cssEscape(itemKey({ kind: "transferTable", id: result.id }))}"]`));
}

// Update: remakes the transfer table from the draft, with the renames the wizard remembers, as one
// undoable edit; closes the wizard and opens its first stage. When nothing would change, nothing is
// recorded, and a note says so (section 7, "Add and Update").
function updateFromWizard() {
  const plan = currentPlan();
  const { id } = wizard;
  const updated = tryLogic(() => updateTransferTable(plan, id, wizard.draft, { renamedFrom: wizardRenamedFrom() }));
  if (updated === false) {
    return;
  }
  closeWizard();
  if (updated === plan) {
    showMessage("Nothing to update: the transfer table already matches.", "note");
    return;
  }
  recordEdit(updated, transferTableAt(updated, id).stages[0].stage);
  showMessage(`Updated the transfer table: ${tableStagesText(updated, id)}.`, "ok");
}

// Remove: takes out the transfer table and its stages at once, as every Remove does; if one of its
// stages was open, the first stage in the stage order opens.
function removeFromWizard() {
  const plan = currentPlan();
  const { id } = wizard;
  const owned = transferTableAt(plan, id).stages.map((entry) => entry.stage);
  const removed = tryLogic(() => removeTransferTable(plan, id));
  if (removed === false) {
    return;
  }
  closeWizard();
  const open = owned.includes(currentOpen()) ? stageOrder(removed)[0] : currentOpen();
  recordEdit(removed, open);
  showMessage(`Removed the transfer table and its ${countOf(owned.length, "stage")}. Undo brings them back.`, "ok");
}

// --- The glow (section 7) ---

// Makes `element` glow if `key` (a stage or box) wasn't drawn last time (unless `whenNew` is
// false, for a randomization's box, which glows only when placed), or was just placed by a move,
// copy or paste (glowsToStart), or is still glowing from an earlier drawing, and notes the key as
// drawn. Nothing glows at the first drawing.
function applyGlow(element, key, drawnKeys, { whenNew = true } = {}) {
  drawnKeys.add(key);
  const now = performance.now();
  // After a move, copy or paste, only what it placed glows: a box whose tip change only moved onto
  // a new first stage isn't new (section 7).
  const placing = glowsToStart.size > 0;
  if ((whenNew && !placing && isNewKey(key)) || glowsToStart.has(key)) {
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

// --- Moving and copying (section 7) ---

// Connects selecting, dragging, copying, pasting and the right-click menu in the Stages column.
// Moving and releasing are watched on the whole document, so a drag that leaves the column still
// ends; the click after a drag is caught first, so it doesn't also count as a click.
function connectMovingAndCopying() {
  elements.stagesList.addEventListener("pointerdown", pressInColumn);
  document.addEventListener("pointermove", moveInColumn);
  document.addEventListener("pointerup", releaseInColumn);
  document.addEventListener("pointercancel", cancelColumnDrag);
  document.addEventListener("click", clickInColumn, true);
  document.addEventListener("keyup", (event) => {
    if (columnDrag !== null && (event.key === "Control" || event.key === "Meta")) {
      setDragCopying(false);
    }
  });
  document.addEventListener("copy", copyFromClipboardEvent);
  document.addEventListener("paste", pasteFromClipboardEvent);
  elements.stagesList.addEventListener("contextmenu", openColumnMenuFrom);
  document.addEventListener("pointerdown", closeColumnMenuPressedOutside, true);
  elements.stagesColumn.addEventListener("scroll", closeColumnMenu);
  window.addEventListener("resize", closeColumnMenu);
}

// One text key for an item, as the column's elements carry it in data-item, e.g. "stage:5",
// "tipGroup:3", "randomization:r1" or "transferTable:t1". A stage's, a randomization's and a
// transfer table's are also their glow keys.
function itemKey(item) {
  return `${item.kind}:${item.id}`;
}

// The item an itemKey names, e.g. "stage:5" → { kind: "stage", id: "5" }.
function itemFromKey(key) {
  const colon = key.indexOf(":");
  return { kind: key.slice(0, colon), id: key.slice(colon + 1) };
}

// The seam `seam` with `place` (a place as moveItems takes it) noted on it, so a drag, the menu's
// Paste here, and the drop line can find where it puts things. Returns the seam.
function withDropPlace(seam, place) {
  seam.dataset.dropPlace = JSON.stringify(place);
  return seam;
}

// The place between boxes just before box `index`, e.g. betweenBoxes(0) → above the first box.
function betweenBoxes(index) {
  return { kind: "between", index };
}

// --- Moving and copying: where items are ---

// Where `item` is in the column (columnBoxes of `plan`): { boxIndex, position, owned }, `position`
// being a stage's place in its tip group (null for a box, or for a randomization's or transfer
// table's stage, `owned`), or null if the item isn't in the plan.
function locateItem(plan, item) {
  const boxes = columnBoxes(plan);
  for (const [boxIndex, box] of boxes.entries()) {
    if (box.kind === "tipGroup") {
      if (item.kind === "tipGroup" && box.stages[0] === item.id) {
        return { boxIndex, position: null, owned: false };
      }
      if (item.kind === "stage" && box.stages.includes(item.id)) {
        return { boxIndex, position: box.stages.indexOf(item.id), owned: false };
      }
    } else if (item.kind === box.kind && box.id === item.id) {
      return { boxIndex, position: null, owned: false };
    } else if (item.kind === "stage" && box.tipGroups.some((group) => group.stages.includes(item.id))) {
      return { boxIndex, position: null, owned: true };
    }
  }
  return null;
}

// `items` that are in the plan, in column order, each once, without stages inside a tip group or
// randomization also listed, as the logic takes them (transfer-designer.md, "Items"), e.g. for the
// drag's label and the Ctrl+C message.
function itemsInColumnOrder(plan, items) {
  const located = [];
  const seen = new Set();
  for (const item of items) {
    const where = locateItem(plan, item);
    if (where !== null && !seen.has(itemKey(item))) {
      seen.add(itemKey(item));
      located.push({ item, ...where });
    }
  }
  const boxesTaken = new Set(located.filter(({ item }) => item.kind !== "stage").map(({ boxIndex }) => boxIndex));
  return located
    .filter(({ item, boxIndex }) => item.kind !== "stage" || !boxesTaken.has(boxIndex))
    .sort((first, second) => first.boxIndex - second.boxIndex || (first.position ?? -1) - (second.position ?? -1))
    .map(({ item }) => item);
}

// What's open, as items: the open stage, or the randomization whose card is open; [] with Start or
// End open.
function openItems() {
  if (card !== null) {
    return [{ kind: "randomization", id: card.id }];
  }
  const open = currentOpen();
  return isStage(currentPlan(), open) ? [{ kind: "stage", id: open }] : [];
}

// What's selected: the picked set, or, with none, what's open (section 7, "Selecting"), leaving
// out anything no longer in the plan.
function selectedItems() {
  const plan = currentPlan();
  return (pickedSet ?? openItems()).filter((item) => locateItem(plan, item) !== null);
}

// Marks `items` as selected in the column, and nothing else.
function markSelection(items) {
  const keys = new Set(items.map(itemKey));
  for (const element of elements.stagesList.querySelectorAll("[data-item]")) {
    element.classList.toggle("selected", keys.has(element.dataset.item));
  }
}

// Forgets the picked set, so what's open is selected again (section 7, "Selecting"), and the
// anchor for Shift-click, which is then what's open.
function forgetPickedSet() {
  pickedSet = null;
  selectionAnchor = null;
}

// --- Moving and copying: selecting ---

// The item handle a press or click on `target` is on (a stage's heading row, a tip group's heading
// or a randomization's heading), or null if it's elsewhere, or on a button or box inside a handle
// (a ✎), which keeps its own behavior. Anything inside an open editing box keeps its own behavior
// too: the box floats inside the handle it was opened from (section 7, "What a press can select or
// drag").
function itemHandleOf(target) {
  if (!(target instanceof Element) || !elements.stagesList.contains(target)) {
    return null;
  }
  if (target.closest(".editing-box") !== null) {
    return null;
  }
  const handle = target.closest("[data-item-handle]");
  if (handle === null) {
    return null;
  }
  const control = target.closest("button, input, select, textarea, a");
  return control !== null && control !== handle && handle.contains(control) ? null : handle;
}

// What a click with these keys (`withCtrl`, `withShift`) on `item` would select: for Ctrl, the
// selection with the item added or taken out; for Shift, the run from the anchor to it; otherwise
// the item alone.
function selectionAfterClick(item, { withCtrl, withShift }) {
  if (withCtrl) {
    const base = selectedItems();
    const has = base.some((other) => itemKey(other) === itemKey(item));
    return has ? base.filter((other) => itemKey(other) !== itemKey(item)) : [...base, item];
  }
  if (withShift) {
    const plan = currentPlan();
    const anchorInPlan = selectionAnchor !== null && locateItem(plan, selectionAnchor) !== null;
    const anchor = anchorInPlan ? selectionAnchor : openItems()[0] ?? null;
    return anchor === null ? [item] : runBetween(plan, anchor, item);
  }
  return [item];
}

// The run Shift-click selects, from `anchor` to `item` (section 7, "Selecting"): the stages of
// ordinary tip groups between them in column order when both are such stages; otherwise every box
// from the anchor's box to the item's, each as a whole (a tip group or a randomization).
function runBetween(plan, anchor, item) {
  const from = locateItem(plan, anchor);
  const to = locateItem(plan, item);
  if (from === null || to === null) {
    return [item];
  }
  const boxes = columnBoxes(plan);
  const bothStages = anchor.kind === "stage" && item.kind === "stage" && !from.owned && !to.owned;
  if (bothStages) {
    const stages = boxes.filter((box) => box.kind === "tipGroup").flatMap((box) => box.stages);
    const [first, last] = [stages.indexOf(anchor.id), stages.indexOf(item.id)].sort((a, b) => a - b);
    return stages.slice(first, last + 1).map((id) => ({ kind: "stage", id }));
  }
  const [first, last] = [from.boxIndex, to.boxIndex].sort((a, b) => a - b);
  return boxes.slice(first, last + 1).map((box) =>
    box.kind === "tipGroup" ? { kind: "tipGroup", id: box.stages[0] } : { kind: box.kind, id: box.id },
  );
}

// Acts on a click on an item's handle (section 7, "Selecting"): Ctrl (Cmd) adds or takes it out of
// the selection, Shift selects a run, opening nothing; a plain click opens a stage (forgetting the
// picked set), selects a tip group alone, or opens or closes a randomization's card, selecting it.
function clickItem(item, keys) {
  if (keys.withCtrl || keys.withShift) {
    pickedSet = selectionAfterClick(item, keys);
    if (keys.withCtrl) {
      selectionAnchor = item;
    }
    markSelection(selectedItems());
    return;
  }
  if (item.kind === "stage") {
    openEntry(item.id);
    forgetPickedSet();
  } else if (item.kind === "tipGroup") {
    pickedSet = [item];
  } else if (item.kind === "transferTable") {
    // Its heading opens or closes its box, and selects it alone (section 7); its ✎ opens the wizard.
    if (closeRandomizationCard()) {
      pickedSet = [item];
      toggleTableBox(item.id);
    }
  } else if (card !== null && card.id === item.id) {
    if (closeRandomizationCard()) {
      pickedSet = [item];
    }
  } else {
    openEntry(item.id);
    if (card !== null && card.id === item.id) {
      pickedSet = [item];
    }
  }
  // Set after opening, which forgets the anchor of whatever opened before.
  selectionAnchor = item;
  markSelection(selectedItems());
}

// Every click on the page, caught first: the click a drag ends with is ignored; a click on an
// item's handle in the column is handled here (clickItem) instead of by the handle itself.
function clickInColumn(event) {
  if (swallowNextClick) {
    swallowNextClick = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (movingWells) {
    clickInColumnWhileMoving(event);
    return;
  }
  const handle = itemHandleOf(event.target);
  // A press an open text box passed on, or one an editing box with changes refuses, is left to
  // their guards (sections 7 and 10).
  const refusedByBox = editingBox !== null && editingBox.element !== undefined && isBoxDirty();
  if (handle === null || pressPassedOn || refusedByBox) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  clickItem(itemFromKey(handle.dataset.itemHandle), {
    withCtrl: event.ctrlKey || event.metaKey,
    withShift: event.shiftKey,
  });
}

// --- Moving and copying: dragging ---

// A press on an item's handle with the main button: marks what the click would select, or what a
// drag would take, at once (section 7, "How it looks"), and notes the press, which becomes a drag
// once it moves DRAG_START_DISTANCE.
function pressInColumn(event) {
  swallowNextClick = false;
  // Selecting and dragging are off while moving wells (section 7, "While moving wells").
  const handle = event.button === 0 && !movingWells ? itemHandleOf(event.target) : null;
  if (handle === null) {
    return;
  }
  const item = itemFromKey(handle.dataset.itemHandle);
  const keys = { withCtrl: event.ctrlKey || event.metaKey, withShift: event.shiftKey };
  const selection = selectedItems();
  const inSelection = selection.some((other) => itemKey(other) === itemKey(item));
  // A plain press on something selected keeps the selection marked, since a drag would take it.
  const marked = !keys.withCtrl && !keys.withShift && inSelection ? selection : selectionAfterClick(item, keys);
  markSelection(marked);
  columnPress = { item, inSelection, x: event.clientX, y: event.clientY };
}

// Follows the pointer: a press that has moved far enough becomes a drag; a drag moves its label,
// finds where it would land, and scrolls the column near its top or bottom.
function moveInColumn(event) {
  if (columnPress !== null && columnDrag === null) {
    const distance = Math.hypot(event.clientX - columnPress.x, event.clientY - columnPress.y);
    if (distance >= DRAG_START_DISTANCE) {
      beginColumnDrag(event);
    }
  }
  if (columnDrag === null) {
    return;
  }
  columnDrag.pointer = { x: event.clientX, y: event.clientY };
  columnDrag.copying = event.ctrlKey || event.metaKey;
  scrollColumnNearEdges(event.clientY);
  updateColumnDrag();
}

// Starts a drag from the press: it takes the selection, if the pressed thing is in it, or else the
// pressed thing alone, which becomes the selection (section 7, "Dragging").
function beginColumnDrag(event) {
  const { item, inSelection } = columnPress;
  const items = inSelection ? selectedItems() : [item];
  // Noted so that cancelling the drag gives the selection back as it was.
  const before = { pickedSet, selectionAnchor };
  pickedSet = items;
  selectionAnchor = item;
  markSelection(items);
  columnDrag = {
    items,
    copying: event.ctrlKey || event.metaKey,
    refused: false,
    before,
    place: null,
    pointer: { x: event.clientX, y: event.clientY },
  };
  hideContentsCard();
  document.body.classList.add("column-dragging");
  elements.stagesList.classList.add("dragging");
  for (const key of items.map(itemKey)) {
    for (const element of elements.stagesList.querySelectorAll(`[data-item="${cssEscape(key)}"]`)) {
      element.classList.add("dragged");
    }
  }
  updateColumnDrag();
}

// Switches the drag between moving and copying, as Ctrl (Cmd) is pressed or released.
function setDragCopying(copying) {
  if (columnDrag.copying !== copying) {
    columnDrag.copying = copying;
    updateColumnDrag();
  }
}

// True if the drag can't move what it holds: a randomization's stage without its randomization,
// while not copying (section 7, "Dragging").
function dragIsRefused() {
  if (columnDrag.copying) {
    return false;
  }
  const plan = currentPlan();
  const takenRandomizations = new Set(
    columnDrag.items.filter((item) => item.kind === "randomization").map((item) => item.id),
  );
  return columnDrag.items.some((item) => {
    const owner = item.kind === "stage" ? randomizationOf(plan, item.id) : null;
    return owner !== null && !takenRandomizations.has(owner);
  });
}

// Redraws the drag's label and drop line for where the pointer is now.
function updateColumnDrag() {
  const refused = dragIsRefused();
  columnDrag.refused = refused;
  const ownTable = columnDrag.copying ? null : draggedTable(currentPlan(), columnDrag.items);
  const seam = refused ? null : seamNearestPointer(columnDrag.pointer, holdsContainerItem(columnDrag.items), ownTable);
  columnDrag.place = seam === null ? null : JSON.parse(seam.dataset.dropPlace);
  showDropLine(seam);
  const label = elements.dragLabel;
  label.textContent = refused
    ? "A randomization's stages move with it · hold Ctrl to copy"
    : `${columnDrag.copying ? "+ Copy" : "Move"} ${describeItems(currentPlan(), columnDrag.items)}`;
  label.classList.toggle("refused", refused);
  label.style.left = `${columnDrag.pointer.x + DRAG_LABEL_OFFSET.x}px`;
  label.style.top = `${columnDrag.pointer.y + DRAG_LABEL_OFFSET.y}px`;
  label.hidden = false;
}

// True if `items` hold a tip group, a randomization or a transfer table, which go only between tip
// groups.
function holdsContainerItem(items) {
  return items.some((item) => item.kind !== "stage");
}

// The ID of the transfer table whose stages `items` all are, or null: only they can be dropped
// inside it (section 7, "Transfer tables").
function draggedTable(plan, items) {
  const tables = new Set(items.map((item) => (item.kind === "stage" ? transferTableOf(plan, item.id) : null)));
  const [only] = tables;
  return tables.size === 1 && only !== null ? only : null;
}

// The seam nearest the pointer, up and down, while the pointer is over the column or within
// COLUMN_DROP_MARGIN of its sides; only seams between tip groups when `betweenOnly`; the places
// inside a transfer table only for its own stages (`ownTable`, its ID, or null); null if the
// pointer is away from the column.
function seamNearestPointer(pointer, betweenOnly, ownTable = null) {
  const column = elements.stagesColumn.getBoundingClientRect();
  const nearColumn =
    pointer.x >= column.left - COLUMN_DROP_MARGIN &&
    pointer.x <= column.right + COLUMN_DROP_MARGIN &&
    pointer.y >= column.top &&
    pointer.y <= column.bottom;
  if (!nearColumn) {
    return null;
  }
  const selector = betweenOnly ? ".group-seam[data-drop-place]" : "[data-drop-place]:not(.table-seam)";
  const ownSeams = ownTable === null ? "" : `, .table-seam[data-table="${cssEscape(ownTable)}"]`;
  let nearest = null;
  let nearestDistance = Infinity;
  for (const seam of elements.stagesList.querySelectorAll(selector + ownSeams)) {
    const rect = seam.getBoundingClientRect();
    const distance = Math.abs(rect.top + rect.height / 2 - pointer.y);
    if (distance < nearestDistance) {
      nearest = seam;
      nearestDistance = distance;
    }
  }
  return nearest;
}

// Shows the drop line on `seam` (a 4px blue line with a dot at each end), or hides it for null. A
// seam between tip groups is marked across the column's width, one inside a box 8px in from its
// cards' sides, as its own line is.
function showDropLine(seam) {
  const line = elements.dropLine;
  if (seam === null) {
    line.hidden = true;
    return;
  }
  const rect = seam.getBoundingClientRect();
  const inset = seam.classList.contains("group-seam") ? 0 : 8;
  line.style.left = `${rect.left + inset}px`;
  line.style.width = `${rect.width - inset * 2}px`;
  line.style.top = `${rect.top + rect.height / 2}px`;
  line.hidden = false;
}

// Scrolls the column by COLUMN_SCROLL_STEP while the pointer is within COLUMN_DROP_MARGIN of its top
// or bottom (section 7, "Dragging").
function scrollColumnNearEdges(pointerY) {
  const column = elements.stagesColumn;
  const rect = column.getBoundingClientRect();
  if (pointerY < rect.top + COLUMN_DROP_MARGIN) {
    column.scrollBy({ top: -COLUMN_SCROLL_STEP, behavior: "instant" });
  } else if (pointerY > rect.bottom - COLUMN_DROP_MARGIN) {
    column.scrollBy({ top: COLUMN_SCROLL_STEP, behavior: "instant" });
  }
}

// Ends a press or a drag in the column: a drag drops (dropColumnDrag), and the click that follows
// is ignored; a press that never moved leaves its click to clickInColumn, and the marks go back to
// what's selected if the click didn't land on the handle.
function releaseInColumn() {
  if (columnDrag !== null) {
    const finished = columnDrag;
    endColumnDrag();
    // This is the release: the click that comes right after it, if any, is ignored.
    swallowNextClick = true;
    setTimeout(() => {
      swallowNextClick = false;
    }, 0);
    dropColumnDrag(finished);
    return;
  }
  if (columnPress !== null) {
    columnPress = null;
    setTimeout(() => markSelection(selectedItems()), 0);
  }
}

// Cancels a press or drag in the column (Escape, or the browser interrupting it): nothing changes.
// The click that follows the release of a cancelled press is ignored too, so it doesn't open or
// select the item (section 7: "Escape cancels the drag; nothing changes").
function cancelColumnDrag() {
  if (columnPress === null && columnDrag === null) {
    return;
  }
  if (columnDrag !== null) {
    ({ pickedSet, selectionAnchor } = columnDrag.before);
  }
  endColumnDrag();
  markSelection(selectedItems());
  swallowClickAfterRelease();
}

// Ignores the click that comes with the pointer's next release, if one comes: the flag is set now
// and cleared a moment after that release (a click comes right after it, if at all), so a release
// without a click doesn't eat a later click.
function swallowClickAfterRelease() {
  swallowNextClick = true;
  document.addEventListener(
    "pointerup",
    () => {
      setTimeout(() => {
        swallowNextClick = false;
      }, 0);
    },
    { once: true, capture: true },
  );
}

// Takes away the drag's label, drop line and fading, and forgets the press and drag.
function endColumnDrag() {
  columnPress = null;
  columnDrag = null;
  elements.dragLabel.hidden = true;
  elements.dropLine.hidden = true;
  document.body.classList.remove("column-dragging");
  elements.stagesList.classList.remove("dragging");
  for (const element of elements.stagesList.querySelectorAll(".dragged")) {
    element.classList.remove("dragged");
  }
}

// Drops a finished drag (section 7, "Dragging"): a refused one shows the logic's message; one with
// no place marked says where to drop it; otherwise it moves (moveItems) or, with Ctrl (Cmd) held,
// copies (copyItems) to its place, as one edit.
function dropColumnDrag({ items, copying, refused, place }) {
  if (refused) {
    // The logic gives the message: moving a randomization's stage alone is refused wherever it goes.
    tryLogic(() => moveItems(currentPlan(), items, betweenBoxes(0)));
    return;
  }
  if (place === null) {
    showMessage("Drop it on a gap between stages or tip groups.", "note");
    return;
  }
  if (copying) {
    placeItems((plan) => copyItems(plan, items, place), "Copied");
  } else {
    placeItems((plan) => moveItems(plan, items, place), "Moved");
  }
}

// --- Moving and copying: placing ---

// Moves, copies or pastes, as one edit (section 7, "After a move, copy or paste"): an editing box
// with changes refuses it, one without closes; an open randomization's card closes first as Close
// would, or nothing happens. `place` runs the logic on the plan and gives { plan, placed }. What was
// placed becomes the selection, glows, and is scrolled into view; the first stage among it opens.
// `verb` starts the message, e.g. "Moved".
function placeItems(place, verb) {
  if (editingBox !== null) {
    if (isBoxDirty()) {
      refuseOutsideClick();
      return;
    }
    closeEditingBox();
  }
  if (!closeRandomizationCard()) {
    return;
  }
  const before = currentPlan();
  const result = tryLogic(() => place(before));
  if (result === false) {
    return;
  }
  if (result.plan === before) {
    showMessage("Dropped where it already was, so nothing moved.", "note");
    return;
  }
  // A stage's or tip group's ID is a stage's; a randomization or transfer table opens nothing.
  const firstStage = result.placed.find((item) => item.kind === "stage" || item.kind === "tipGroup");
  const open = firstStage === undefined ? validOpen(result.plan, currentOpen()) : firstStage.id;
  for (const key of glowKeysOf(result.plan, result.placed)) {
    glowsToStart.add(key);
  }
  source = null;
  recordEdit(result.plan, open);
  pickedSet = result.placed;
  selectionAnchor = result.placed[0];
  markSelection(selectedItems());
  showMessage(`${verb} ${describeItems(result.plan, result.placed)}.`, "ok");
  scrollIntoColumnView(elements.stagesList.querySelector(`[data-item="${cssEscape(itemKey(result.placed[0]))}"]`));
}

// The glow keys of what was placed: each stage's, every stage of a tip group, and a randomization's
// or transfer table's box.
function glowKeysOf(plan, placed) {
  const boxes = columnBoxes(plan);
  return placed.flatMap((item) => {
    if (item.kind === "tipGroup") {
      const box = boxes.find((candidate) => candidate.kind === "tipGroup" && candidate.stages[0] === item.id);
      return box.stages.map((id) => `stage:${id}`);
    }
    return [itemKey(item)];
  });
}

// The items described for the drag's label and the messages (section 7), e.g. “Drugs”, "2 stages",
// "a tip group", "2 tip groups", "a randomization", "a transfer table", or "3 items" for a mix.
function describeItems(plan, items) {
  const taken = itemsInColumnOrder(plan, items);
  const kinds = new Set(taken.map((item) => item.kind));
  if (kinds.size !== 1) {
    return countOf(taken.length, "item");
  }
  const [kind] = kinds;
  if (kind === "stage") {
    return taken.length === 1 ? `“${plan.stageList.get(taken[0].id).name}”` : countOf(taken.length, "stage");
  }
  const noun = { tipGroup: "tip group", randomization: "randomization", transferTable: "transfer table" }[kind];
  return taken.length === 1 ? `a ${noun}` : countOf(taken.length, noun);
}

// --- Moving and copying: copying and pasting ---

// Ctrl+C (Cmd+C) on the page (section 7, "Copying and pasting"): copies what's selected, onto the
// system clipboard as text (the event's own clipboard data) and as the page's copy. A text box or
// menu, or text selected on the page, keeps the browser's copy.
function copyFromClipboardEvent(event) {
  // Ctrl+C is ignored while moving wells (section 12), and while the wizard is open.
  if (movingWells || wizard !== null || keepsOwnClipboard(event.target) || !window.getSelection().isCollapsed) {
    return;
  }
  const copied = copySelection();
  if (copied !== null) {
    event.clipboardData.setData("text/plain", JSON.stringify(copied));
    event.preventDefault();
  }
}

// True if `target` is a text box or menu, which keeps its own Ctrl+C and Ctrl+V.
function keepsOwnClipboard(target) {
  return target instanceof Element && target.matches("input, select, textarea, [contenteditable]");
}

// Copies what's selected (copyOf) as the page's copy, and says so; returns the copied items, or
// null with nothing selected (a note says how to select).
function copySelection() {
  const plan = currentPlan();
  const items = selectedItems();
  if (items.length === 0) {
    showMessage("Select a stage, a tip group (click its heading) or a randomization to copy it.", "note");
    return null;
  }
  const copied = tryLogic(() => copyOf(plan, items));
  if (copied === false) {
    return null;
  }
  keepPageCopy(copied);
  showMessage(
    `Copied ${describeItems(plan, items)}. Right-click where it should go and choose Paste, or press ` +
      "Ctrl+V to paste it below the selection.",
    "note",
  );
  return copied;
}

// Keeps `copied` as the page's copy: in local storage, shared by every tab of the designer, and in
// the page's memory, for a browser without local storage.
function keepPageCopy(copied) {
  copiedInMemory = copied;
  try {
    window.localStorage.setItem(COPIED_ITEMS_KEY, JSON.stringify(copied));
  } catch {
    // No local storage (e.g. a private window): the page's memory keeps it for this tab.
  }
}

// The page's copy: the latest copied items in any tab (local storage), or this tab's own, or null.
function pageCopy() {
  try {
    const stored = window.localStorage.getItem(COPIED_ITEMS_KEY);
    if (stored !== null) {
      return JSON.parse(stored);
    }
  } catch {
    // Unreadable or no storage: this tab's own copy is used.
  }
  return copiedInMemory;
}

// Copied items in `text` from the system clipboard, if it's JSON in their format (anything with
// that format, so a damaged one shows pasteItems' message), or null.
function copiedItemsIn(text) {
  try {
    const parsed = JSON.parse(text);
    return isObject(parsed) && parsed.format === COPIED_ITEMS_FORMAT ? parsed : null;
  } catch {
    return null;
  }
}

// True if copied items (perhaps damaged) hold a tip group, a randomization or a transfer table.
function copiedHoldsContainer(copied) {
  const containers = ["tipGroup", "randomization", "transferTable"];
  return Array.isArray(copied?.items) && copied.items.some((item) => containers.includes(item?.kind));
}

// Ctrl+V (Cmd+V) on the page (section 7, "Copying and pasting"): pastes the system clipboard's
// copied items, or else the page's copy, just below the selection. A text box or menu keeps the
// browser's paste.
function pasteFromClipboardEvent(event) {
  // Ctrl+V is ignored while moving wells (section 12); while the wizard is open, it pastes only
  // into its paste zone or a cell, which handle it themselves (Andy, 2026-11-05: Ctrl+V on the page
  // never starts a transfer table).
  if (movingWells || wizard !== null || keepsOwnClipboard(event.target)) {
    return;
  }
  event.preventDefault();
  const copied = copiedItemsIn(event.clipboardData?.getData("text/plain") ?? "") ?? pageCopy();
  if (copied === null) {
    showMessage("Nothing to paste yet: select a stage, tip group or randomization and press Ctrl+C.", "note");
    return;
  }
  const place = pastePlaceBelowSelection(currentPlan(), copiedHoldsContainer(copied));
  placeItems((plan) => pasteItems(plan, copied, place), "Pasted");
}

// Where Ctrl+V pastes (section 7): just below the last selected thing in column order, inside its
// tip group for a stage of an ordinary tip group when nothing pasted is a tip group or
// randomization (`holdsContainer`), otherwise between boxes, below its box; with nothing selected,
// below the last box, or above the first with Start open.
function pastePlaceBelowSelection(plan, holdsContainer) {
  const selected = itemsInColumnOrder(plan, selectedItems());
  if (selected.length === 0) {
    return betweenBoxes(currentOpen() === START ? 0 : columnBoxes(plan).length);
  }
  return pastePlaceBeside(plan, selected.at(-1), "below", holdsContainer);
}

// The place just `side` ("above" or "below") of `item`: inside its tip group for a stage of an
// ordinary tip group, unless what's pasted holds a tip group or randomization (`holdsContainer`);
// otherwise between boxes, above or below its box (a randomization's stage's box being its
// randomization's).
function pastePlaceBeside(plan, item, side, holdsContainer) {
  const where = locateItem(plan, item);
  const below = side === "below" ? 1 : 0;
  if (item.kind === "stage" && !where.owned && !holdsContainer) {
    return { kind: "inTipGroup", index: where.boxIndex, position: where.position + below };
  }
  return betweenBoxes(where.boxIndex + below);
}

// --- Moving and copying: the right-click menu ---

// A context menu asked for in the column (a right click, the menu key or Shift+F10): on an item's
// handle, the item menu (Copy, Paste above, Paste below), selecting the item first if it isn't; on
// a seam's band (not its buttons), Paste here. Anywhere else (Start, End, an open card's
// contents), the browser's menu.
function openColumnMenuFrom(event) {
  // The menu is off while moving wells (section 7, "While moving wells"): a right click on what it
  // would open for says why instead.
  if (movingWells) {
    refuseColumnMenuWhileMoving(event);
    return;
  }
  // Inside an editing box, the browser's own menu, as for any text box.
  if (event.target instanceof Element && event.target.closest(".editing-box") !== null) {
    return;
  }
  if (editingBox !== null && isBoxDirty()) {
    event.preventDefault();
    return;
  }
  const fromKeyboard = event.button !== 2 && event.detail === 0 && event.clientX === 0 && event.clientY === 0;
  const handle = itemHandleOf(event.target);
  // The places inside a transfer table are only for dragging its own stages, never for pasting.
  const seam = event.target instanceof Element ? event.target.closest("[data-drop-place]:not(.table-seam)") : null;
  const onSeamButton = event.target instanceof Element && event.target.closest(".seam-button") !== null;
  if (handle === null && (seam === null || onSeamButton)) {
    return;
  }
  event.preventDefault();
  const at = fromKeyboard ? besideElement(handle ?? seam) : { x: event.clientX, y: event.clientY };
  if (handle !== null) {
    openItemMenu(itemFromKey(handle.dataset.itemHandle), at);
  } else {
    openSeamMenu(seam, at);
  }
}

// Where a menu opened from the keyboard goes: just under `element`, a little in from its left.
function besideElement(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + 16, y: rect.bottom };
}

// The menu key or Shift+F10 on a focused row or heading in the column opens its menu (section 12),
// in case the browser doesn't send a context menu event for it. Returns true if it did.
function openColumnMenuFromKey(event) {
  const isMenuKey = event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
  const handle = isMenuKey ? itemHandleOf(event.target) : null;
  if (handle === null) {
    return false;
  }
  event.preventDefault();
  openItemMenu(itemFromKey(handle.dataset.itemHandle), besideElement(handle));
  return true;
}

// The item menu for `item`, at `at` ({ x, y }): Copy, Paste above, Paste below. Right-clicking
// something not selected selects it first, as in PowerPoint.
function openItemMenu(item, at) {
  if (!selectedItems().some((other) => itemKey(other) === itemKey(item))) {
    pickedSet = [item];
    selectionAnchor = item;
    markSelection(selectedItems());
  }
  const copied = pageCopy();
  const pasteBlocked = copied === null ? "Copy something first." : null;
  // What Paste above or Paste below does (`side`, "above" or "below"): pastes the page's copy
  // just beside the item, as one edit.
  const pasteBeside = (side) => () => {
    const plan = currentPlan();
    const place = pastePlaceBeside(plan, item, side, copiedHoldsContainer(copied));
    placeItems((current) => pasteItems(current, copied, place), "Pasted");
  };
  showColumnMenu(
    [
      { label: "Copy", action: copySelectionWithClipboard },
      { label: "Paste above", action: pasteBeside("above"), blocked: pasteBlocked },
      { label: "Paste below", action: pasteBeside("below"), blocked: pasteBlocked },
    ],
    at,
    null,
  );
}

// The menu's Copy: copies as Ctrl+C does, and puts the text on the system clipboard if the browser
// lets the page write it (the menu has no copy event of its own).
function copySelectionWithClipboard() {
  const copied = copySelection();
  if (copied !== null) {
    navigator.clipboard?.writeText(JSON.stringify(copied)).catch(() => {
      // Not allowed here: the page's copy still holds it, for the menu and Ctrl+V.
    });
  }
}

// The menu on a seam (a gap), at `at`: Paste here, at the seam's place; greyed out with nothing
// copied, or on a gap inside a tip group when what's copied holds a tip group or randomization.
function openSeamMenu(seam, at) {
  const copied = pageCopy();
  const place = JSON.parse(seam.dataset.dropPlace);
  let blocked = null;
  if (copied === null) {
    blocked = "Copy something first.";
  } else if (place.kind === "inTipGroup" && copiedHoldsContainer(copied)) {
    blocked = "A tip group or randomization goes between tip groups.";
  }
  showColumnMenu(
    [{ label: "Paste here", action: () => placeItems((plan) => pasteItems(plan, copied, place), "Pasted"), blocked }],
    at,
    seam,
  );
}

// Shows the column's menu at `at`, kept inside the window, with `entries` ({ label, action,
// blocked }: `blocked` the reason it can't be chosen, or null), each a menu item; the first that
// can be chosen takes the keyboard focus. `seam` is the seam it's for, whose line shows as the drop
// line does while the menu is open, or null.
function showColumnMenu(entries, at, seam) {
  closeColumnMenu();
  const menu = elements.columnMenu;
  menu.replaceChildren(...entries.map(createColumnMenuItem));
  menu.hidden = false;
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  menu.style.left = `${Math.max(4, Math.min(at.x, window.innerWidth - width - 4))}px`;
  menu.style.top = `${Math.max(4, Math.min(at.y, window.innerHeight - height - 4))}px`;
  columnMenu = { seam };
  if (seam !== null) {
    seam.classList.add("menu-target");
    showDropLine(seam);
  }
  menu.querySelector("button:not([disabled])")?.focus();
}

// One item of the column's menu: a button (role menuitem) that runs its action after closing the
// menu, or, greyed out, its reason under it.
function createColumnMenuItem({ label, action, blocked = null }) {
  const item = createElement("button", "", "column-menu-item");
  item.type = "button";
  item.setAttribute("role", "menuitem");
  item.append(createElement("span", label, "column-menu-label"));
  if (blocked !== null) {
    item.disabled = true;
    item.setAttribute("aria-disabled", "true");
    item.append(createElement("span", blocked, "column-menu-reason"));
  }
  item.addEventListener("click", (event) => {
    event.stopPropagation();
    closeColumnMenu();
    action();
  });
  item.addEventListener("keydown", moveFocusInColumnMenu);
  return item;
}

// Up and down move the keyboard focus among the menu's items that can be chosen; Escape closes it.
function moveFocusInColumnMenu(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeColumnMenu();
    return;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
    return;
  }
  event.preventDefault();
  const items = [...elements.columnMenu.querySelectorAll("button:not([disabled])")];
  const next = items.indexOf(event.target) + (event.key === "ArrowDown" ? 1 : -1);
  items[(next + items.length) % items.length]?.focus();
}

// Closes the column's menu, if it's open.
function closeColumnMenu() {
  if (columnMenu === null) {
    return;
  }
  columnMenu.seam?.classList.remove("menu-target");
  if (columnMenu.seam !== null && columnDrag === null) {
    elements.dropLine.hidden = true;
  }
  columnMenu = null;
  elements.columnMenu.hidden = true;
  elements.columnMenu.replaceChildren();
}

// Closes the column's menu on a press anywhere outside it.
function closeColumnMenuPressedOutside(event) {
  if (columnMenu !== null && !elements.columnMenu.contains(event.target)) {
    closeColumnMenu();
  }
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
    if (component.constituents.length > 0) {
      chip.append(createElement("span", chipCarriesText(component), "chip-carries"));
    }
    const tooltip = chipTooltip(component);
    if (tooltip !== "") {
      chip.title = tooltip;
    }
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

// What a chip says a component carries (section 8): its first constituent's amount and unit, with
// the constituent's name first unless it's the component's own name, then " +N" for the rest,
// e.g. "10 mM" for Dye stock carrying Dye at 10 mM; "Hy-Soy 4 g/L +2" for a medium carrying three.
function chipCarriesText(component) {
  const [first, ...rest] = component.constituents;
  const amount = formatConstituentAmount(first.amount, first.unit);
  const named = first.name === component.name ? amount : `${first.name} ${amount}`;
  return rest.length === 0 ? named : `${named} +${rest.length}`;
}

// A chip's tooltip (section 8): "Contains …" listing every constituent, then, on a line of its own,
// the component's osmolality as its box shows it, with no "≈" since it's the measured value, e.g.
// "Contains Dye 10 mM\nOsmolality 300 mOsm/kg"; "" for a component with neither.
function chipTooltip(component) {
  const lines = [];
  if (component.constituents.length > 0) {
    lines.push(`Contains ${component.constituents.map(constituentText).join(", ")}`);
  }
  if (component.osmolality !== null) {
    lines.push(`Osmolality ${osmolalityText(component.osmolality)} mOsm/kg`);
  }
  return lines.join("\n");
}

// A constituent as a tooltip lists it: its name, amount and unit, e.g. "Hy-Soy 4 g/L", or for
// cells, a cell figure, e.g. "Cells 1.5 × 10⁶ cells/mL".
function constituentText(constituent) {
  return `${constituent.name} ${formatConstituentAmount(constituent.amount, constituent.unit)}`;
}

// A constituent's amount and unit as a chip and its tooltip show them (sections 8 and 13): a cell
// figure for an amount in the cells' family, e.g. "1.5 × 10⁶ cells/mL"; otherwise an amount, then
// the unit, e.g. "4 g/L".
function formatConstituentAmount(amount, unit) {
  if (isCellFamily(familyOf(unit))) {
    return formatCellFigure(amount, unit);
  }
  return `${formatAmount(amount)} ${unit}`;
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

// Acts on a click on a well: while moving wells, it picks, moves or lets go (section 6); while Start
// is open it fills the well; while a stage is open it chooses the source, clears it, or adds the
// transfer; while a mix step is open it mixes the well, or stops mixing it; while End is open it
// says nothing can be added.
function clickWell(end) {
  const open = currentOpen();
  if (movingWells) {
    clickWellWhileMoving(end);
    return;
  }
  if (card !== null) {
    pickWell(end);
    return;
  }
  if (isStage(currentPlan(), open) && isOwnedStage(currentPlan(), open)) {
    showOwnedStageNote(currentPlan(), open);
    return;
  }
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
    // Dragging does nothing with End open (section 9), except while moving wells (section 6).
    if (movingWells) {
      beginMovingDrag();
    } else if (currentOpen() === END) {
      press = null;
    } else {
      beginDrag();
    }
  }
  if (drag !== null) {
    // A dragged picked well notes whether it's over a labware, since a drop between its wells keeps
    // the pick (section 6).
    if (drag.kind === "move") {
      drag.onLabware = overLabwareBlock(event);
    }
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
  const plan = currentPlan();
  let kind = source !== null ? "box" : "transfer";
  if (card !== null) {
    kind = "pick";
  } else if (open === START) {
    kind = "fill";
  } else if (isStage(plan, open) && isOwnedStage(plan, open)) {
    kind = "owned";
  } else if (isMixStep(plan, open)) {
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

// Finishes a drag (sections 6, 8 and 9): moves a picked well, fills the box, mixes the box, adds one
// transfer, or sends the source into the box.
function finishDrag({ kind, from, over, onLabware }) {
  updateDragMarks();
  if (kind === "move") {
    dropPickedWell(over, onLabware);
    return;
  }
  if (kind === "owned") {
    showOwnedStageNote(currentPlan(), currentOpen());
    return;
  }
  if (kind === "pick") {
    // As when filling, a drag that ends off the labware it started on picks nothing.
    if (over !== null && over.labware === from.labware) {
      pickBox(wellsInBox(from, over), from);
    }
    return;
  }
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

// Shows the drag on the wells: the box being dragged across outlined, the well under a transfer
// drag with a dashed outline, or, under a dragged picked well, a well it can move to made solid.
function updateDragMarks() {
  for (const wellElement of wellElements.values()) {
    wellElement.classList.remove("in-box", "drop-target", "move-drop");
  }
  if (drag === null || drag.over === null) {
    return;
  }
  // A well it can move to turns solid under a dragged picked well (section 6).
  if (drag.kind === "move") {
    const overElement = wellElements.get(wellKey(drag.over));
    if (overElement?.classList.contains("move-target")) {
      overElement.classList.add("move-drop");
    }
    return;
  }
  if (drag.kind === "transfer" || drag.kind === "owned") {
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

// True if the pointer event is over one labware's block (its heading or its grid, between wells
// too), e.g. for a drop of a picked well that just misses a well (section 6).
function overLabwareBlock(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  return element !== null && elements.labwareArea.contains(element) && element.closest(".labware") !== null;
}

// The well a well element (or an element inside it) stands for, { labware, well }, or null.
function endOf(element) {
  const wellElement = element.closest(".well");
  return wellElement === null ? null : { labware: wellElement.dataset.labware, well: wellElement.dataset.well };
}

// --- Moving wells (sections 6 and 7) ---

// Move wells starts moving wells; Done ends it (section 6, "Moving wells").
function toggleMovingWells() {
  if (movingWells) {
    endMovingWells();
    showMessage("Done moving wells.", "note");
  } else {
    startMovingWells();
  }
}

// Starts moving wells: an open randomization's card closes first, as Close would (if it can't, it
// shakes and moving wells doesn't start); an open editing box, a new component's box, the
// column's menu and selection, and a chosen source are cleared. What's open stays open.
function startMovingWells() {
  if (!closeRandomizationCard()) {
    return;
  }
  closeEditingBox();
  closeColumnMenu();
  forgetPickedSet();
  addingComponent = null;
  source = null;
  hideContentsCard();
  movingWells = true;
  pickedWell = null;
  refresh();
}

// Ends moving wells, letting go of a picked well, and redraws the page. What's open stays open.
function endMovingWells() {
  movingWells = false;
  pickedWell = null;
  refresh();
}

// True if well `end` can be picked to move: a well in use (judged over the whole plan, not the
// point the deck shows) that isn't a randomization's well to fill (section 6).
function canPickToMove(plan, end) {
  return isInUse(plan, end) && !isToFill(plan, end);
}

// True if `plan` uses well `end` anywhere (isWellUsed), looked up in movingWellSets.
function isInUse(plan, end) {
  return movingWellSets(plan).used.has(wellKey(end));
}

// True if well `end` is one of `plan`'s randomizations' wells to fill (isWellToFill), looked up in
// movingWellSets.
function isToFill(plan, end) {
  return movingWellSets(plan).toFill.has(wellKey(end));
}

// The wells `plan` uses and its wells to fill, as { used, toFill }, two Sets of wellKeys, worked out
// once per plan and kept until the plan changes. They're the wells isWellUsed and isWellToFill say
// yes to, gathered from the plan's parts in one pass rather than asked about well by well, which
// would read every transfer once per well: the starting contents, each transfer's two ends, the
// well labels, and each randomization's sources, wells to fill and stage entries.
function movingWellSets(plan) {
  if (movingWellCache !== null && movingWellCache.plan === plan) {
    return movingWellCache;
  }
  const toFill = new Set(plan.randomizations.flatMap((randomization) => randomization.fill.map(wellKey)));
  const used = new Set([
    ...toFill,
    ...plan.startingContents.map(wellKey),
    ...plan.operationList.listOperations().flatMap((operation) => [wellKey(operation.source), wellKey(operation.destination)]),
    ...Object.entries(plan.wellLabels).flatMap(([labware, wells]) =>
      Object.keys(wells).map((well) => wellKey({ labware, well })),
    ),
    ...plan.randomizations.flatMap((randomization) =>
      [...randomization.sources, ...randomization.stages].map(wellKey),
    ),
  ]);
  movingWellCache = { plan, used, toFill };
  return movingWellCache;
}

// Shows moving wells' state in the deck panel (section 6): Move wells reads Done, solid purple,
// while it's on (with aria-pressed); the panel's purple border; and the purple bar above the
// labware saying what to do.
function refreshMovingWellsControls(plan) {
  elements.moveWells.textContent = movingWells ? "Done" : "Move wells";
  elements.moveWells.setAttribute("aria-pressed", String(movingWells));
  elements.deckPanel.classList.toggle("moving-wells", movingWells);
  elements.movingBar.hidden = !movingWells;
  if (!movingWells) {
    elements.movingBar.replaceChildren();
    return;
  }
  const [heading, instruction, aside] =
    pickedWell === null
      ? [
          "Moving wells.",
          "Click a well to move it. Its contents, transfers, name and randomizations go with it.",
          "Press Done when finished.",
        ]
      : [
          `Moving ${movingWellName(plan, pickedWell)}.`,
          "Click a well with a dashed outline to move it there.",
          "Escape picks another well.",
        ];
  // Only redrawn when it changes, so screen readers announce it once per change.
  if (elements.movingBar.textContent === `${heading} ${instruction} ${aside}`) {
    return;
  }
  elements.movingBar.replaceChildren(
    createElement("strong", heading, "moving-heading"),
    " ",
    createElement("span", instruction),
    " ",
    createElement("span", aside, "moving-aside"),
  );
}

// A well as the moving bar names it: as messages name it, with its well label in quotes if it has
// one, e.g. 'Res1 3 “Media stock”' (section 6).
function movingWellName(plan, end) {
  const label = wellLabelOf(plan, end);
  return label === null ? wellName(plan, end) : `${wellName(plan, end)} “${label}”`;
}

// Marks the wells while moving wells (section 6): with none picked, every well that can't be picked
// is dimmed; with one picked, it has a purple ring, every well not in use a dashed purple outline
// (the wells it can move to), and every other well in use is dimmed.
function markMovingWells(plan) {
  if (!movingWells) {
    return;
  }
  const pickedKey = wellKeyOrNull(pickedWell);
  for (const [key, wellElement] of wellElements) {
    const end = endOf(wellElement);
    if (pickedKey === null) {
      wellElement.classList.toggle("move-dimmed", !canPickToMove(plan, end));
    } else if (key === pickedKey) {
      wellElement.classList.add("move-picked");
    } else if (isInUse(plan, end)) {
      wellElement.classList.add("move-dimmed");
    } else {
      wellElement.classList.add("move-target");
    }
  }
}

// The contents card's last line while moving wells (section 6): what a click on well `end` does.
// With none picked: "Click to move this well", "Filled by a randomization" or "Not used in the
// plan"; with one picked: "Click to let go of this well" on it, "Click to move Res1 3 here" on a
// well it can move to, or "Already used in the plan".
function movingCardHint(plan, end) {
  if (pickedWell === null) {
    if (canPickToMove(plan, end)) {
      return "Click to move this well";
    }
    return isToFill(plan, end) ? "Filled by a randomization" : "Not used in the plan";
  }
  if (wellKey(end) === wellKey(pickedWell)) {
    return "Click to let go of this well";
  }
  return isInUse(plan, end) ? "Already used in the plan" : `Click to move ${wellName(plan, pickedWell)} here`;
}

// A click on a well while moving wells (section 6): with none picked, picks it if it can be
// picked; with one picked, clicking it again lets go of it, a well in use keeps the pick with a
// message, and a well it can move to gets it. Keyboard focus stays on the clicked well.
function clickWellWhileMoving(end) {
  const hadFocus = document.activeElement === wellElements.get(wellKey(end));
  const plan = currentPlan();
  if (pickedWell === null) {
    pickToMove(plan, end);
  } else if (wellKey(end) === wellKey(pickedWell)) {
    letGoOfPickedWell();
  } else if (isInUse(plan, end)) {
    showWellInUseMessage(plan, end);
  } else {
    movePickedWellTo(end);
  }
  if (hadFocus) {
    focusWell(end);
  }
}

// Picks well `end` to move, if it can be picked; otherwise says why (a randomization's well to
// fill, or a well the plan doesn't use; section 6).
function pickToMove(plan, end) {
  if (isToFill(plan, end)) {
    showMessage("Wells a randomization fills can't be moved.", "note");
    return;
  }
  if (!isInUse(plan, end)) {
    showMessage(
      `The plan doesn't use ${wellName(plan, end)}, so there's nothing to move. Click a well the plan uses.`,
      "note",
    );
    return;
  }
  pickedWell = end;
  refreshDeck();
}

// Lets go of the picked well, if there is one, and redraws the deck.
function letGoOfPickedWell() {
  pickedWell = null;
  refreshDeck();
}

// Says that well `end` is in use, so the picked well can't move there; the pick is kept (section 6).
function showWellInUseMessage(plan, end) {
  showMessage(
    `${wellName(plan, end)} is already used in the plan. Choose a well with a dashed outline, or ` +
      "press Escape to pick another well.",
    "note",
  );
}

// Moves the picked well to well `to` with moveWell, as one edit, and lets go of it (section 6):
// "Moved Res1 3 to Res1 7." (ok), or, if the problem count rose, an error saying by how much, e.g.
// "Moved Res1 3 to Plate1 A1, which causes 1 problem.". If moveWell refuses, its message is shown
// as an error and the pick is kept.
function movePickedWellTo(to) {
  const plan = currentPlan();
  const from = pickedWell;
  const moved = tryLogic(() => moveWell(plan, from, to));
  if (moved === false) {
    return;
  }
  pickedWell = null;
  recordEdit(moved);
  const moveText = `Moved ${wellName(plan, from)} to ${wellName(moved, to)}`;
  const added = problemCount(moved) - problemCount(plan);
  if (added > 0) {
    showMessage(`${moveText}, which causes ${countOf(added, "problem")}.`, "error");
  } else {
    showMessage(`${moveText}.`, "ok");
  }
}

// Turns a press on a well into a drag while moving wells (section 6): from the picked well, it drags
// it; from another well that can be picked, it picks that one and drags it; from a randomization's
// well to fill, it says why it can't be moved; from any other well, nothing. A press that isn't
// dragged is dropped, so it doesn't become a click either.
function beginMovingDrag() {
  hideContentsCard();
  const plan = currentPlan();
  const from = press.end;
  const isPicked = pickedWell !== null && wellKey(from) === wellKey(pickedWell);
  if (!isPicked) {
    if (isToFill(plan, from)) {
      showMessage("Wells a randomization fills can't be moved.", "note");
    }
    if (!canPickToMove(plan, from)) {
      press = null;
      return;
    }
    pickedWell = from;
    refreshDeck();
  }
  drag = { kind: "move", from, over: from, onLabware: true };
  updateDragMarks();
}

// Ends a drag of the picked well over well `over` (or null, not on a well), `onLabware` saying
// whether it was dropped on a labware (section 6): off the labware lets go of it; on a labware
// between its wells, or on itself, keeps it picked; on a well in use keeps it with a message; on a
// well it can move to moves it there. Nothing happens if no well is picked any more (an undo or
// redo during the drag let go of it).
function dropPickedWell(over, onLabware) {
  if (pickedWell === null) {
    return;
  }
  const plan = currentPlan();
  if (over === null) {
    if (!onLabware) {
      letGoOfPickedWell();
    }
  } else if (wellKey(over) === wellKey(pickedWell)) {
    return;
  } else if (isInUse(plan, over)) {
    showWellInUseMessage(plan, over);
  } else {
    movePickedWellTo(over);
  }
}

// Escape while moving wells (section 12): closes an open header box, putting the focus back on its
// button; otherwise cancels a drag of the picked well, letting go of it; otherwise lets go of the
// picked well; with none picked, nothing. It never ends moving wells.
function pressEscapeWhileMoving() {
  if (!elements.biomekBox.hidden) {
    closeBiomekBox();
    elements.biomekFiles.focus();
  } else if (!elements.resetBox.hidden) {
    closeResetBox();
    elements.reset.focus();
  } else if (pickedWell !== null) {
    drag = null;
    press = null;
    updateDragMarks();
    letGoOfPickedWell();
  }
}

// A click in the Stages column while moving wells (section 7, "While moving wells"): a closed
// entry's row (it opens) and Show / Hide transfers keep their own behavior; any other click on a
// control or an item's heading does nothing but say that stages can't be changed. A click on plain
// text or empty space does nothing.
function clickInColumnWhileMoving(event) {
  const target = event.target;
  if (!(target instanceof Element) || !elements.stagesList.contains(target)) {
    return;
  }
  if (target.closest("button.entry-row, .toggle-list") !== null) {
    return;
  }
  // A transfer table's heading only shows or hides its stages, so it works while moving wells.
  const tableHeading = target.closest(".transfer-table-heading");
  if (tableHeading !== null) {
    event.preventDefault();
    event.stopPropagation();
    toggleTableBox(itemFromKey(tableHeading.dataset.itemHandle).id);
    return;
  }
  if (target.closest("button, input, select, textarea, label, [data-item-handle]") === null) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  showChangesRefusedWhileMoving();
}

// A right click in the Stages column while moving wells: the column's menu is off (section 7), so
// on an item's heading it says why instead; elsewhere the browser's own menu shows.
function refuseColumnMenuWhileMoving(event) {
  if (itemHandleOf(event.target) === null) {
    return;
  }
  event.preventDefault();
  showChangesRefusedWhileMoving();
}

// Says that the Stages column can't be changed while moving wells (section 7).
function showChangesRefusedWhileMoving() {
  showMessage("Stages can't be changed while moving wells. Press Done first.", "note");
}

// --- The cursor's label and the contents card (sections 6 and 12) ---

// Shows, beside the pointer, what a click does: the next transfer's volume with a stage open; the
// brush with Start open; nothing with a mix step or End open, while moving wells, or off the labware.
function updateCursorLabel() {
  const label = elements.cursorLabel;
  const open = currentOpen();
  // A mix step has no volume at the cursor (section 9).
  const isMixStepOpen = isStage(currentPlan(), open) && isMixStep(currentPlan(), open);
  if (pointerPosition === null || open === END || isMixStepOpen || movingWells) {
    label.hidden = true;
    return;
  }
  if (card !== null) {
    label.textContent = card.draft.tab === "sources" ? "Source" : "Fill";
  } else if (open === START) {
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
  // The card hides while a well's name box is open (section 6).
  if (nameBox !== null) {
    return;
  }
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

// The contents card's lines for a well (section 6): its label first if it has one, then its name,
// smaller under the label ("Empty" under it if it holds nothing), each component's swatch, name,
// volume and share, any Concentrations group and the Osmolality line, then only problems and warnings: each contents problem of the well by its kind,
// whether it's off plan, and how much of it the open stage mixes; last, a hint (cardHint).
// No total, usable-volume or capacity lines (Andy, 2026-10-31): the components add up to the total,
// the labware's limits are the same for every well of it, and the problem lines carry the numbers.
function contentsCardLines(plan, end) {
  const wellLabel = wellLabelOf(plan, end);
  const lines = [];
  if (wellLabel !== null) {
    lines.push(createElement("div", wellLabel, "card-well-label"));
  }
  lines.push(createElement("div", wellName(plan, end), wellLabel === null ? "card-title" : "card-title under-label"));
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
  const concentrations = concentrationsOf(plan, shownSnapshot, end);
  if (concentrations.length > 0) {
    lines.push(createConcentrationsGroup(plan, end, concentrations));
  }
  if (showsOsmolality(plan, end)) {
    lines.push(createOsmolalityLine(osmolalityOf(plan, shownSnapshot, end)));
  }
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
  lines.push(createElement("div", cardHint(plan, end, wellLabel), "card-hint"));
  return lines;
}

// The contents card's last line (section 6): what a click on the well does. While moving wells, it
// says what a click does there (movingCardHint); otherwise that a right click names it ("Right-click
// to name", or "to rename" for a labeled well, `wellLabel` being its label or null).
function cardHint(plan, end, wellLabel) {
  if (movingWells) {
    return movingCardHint(plan, end);
  }
  return wellLabel === null ? "Right-click to name" : "Right-click to rename";
}

// The contents card's Concentrations group (section 6) for the well `end`: under a thin rule, the
// heading, then one line per entry of `concentrations` (concentrationsOf, in its order): the
// constituent's name at the left and, at the right in the volume's style, its amount and unit in
// the unit that fits it best (bestUnit), e.g. "Dye" … "476 µM". Cells show as a cell figure, e.g.
// "1.5 × 10⁵ cells/mL", or, on labware with a growth area, as the well's seeding density in its
// place, e.g. "4.69 × 10⁴ cells/cm²", with a tooltip naming the area.
function createConcentrationsGroup(plan, end, concentrations) {
  const group = createElement("div", "", "card-concentrations");
  group.append(createElement("div", "Concentrations", "card-group-heading"));
  const growthArea = growthAreaOf(end.labware);
  const seedingDensities =
    growthArea === null ? [] : seedingDensitiesOf(plan, shownSnapshot, end);
  const list = document.createElement("ul");
  for (const entry of concentrations) {
    const item = document.createElement("li");
    item.append(
      createElement("span", entry.name),
      createElement("span", concentrationText(entry, seedingDensities), "card-volume"),
    );
    if (isCellFamily(entry.family) && growthArea !== null) {
      item.title = `Assumes every cell settles onto the well's ${formatAmount(growthArea)} cm² bottom.`;
    }
    list.append(item);
  }
  group.append(list);
  return group;
}

// One Concentrations line's figure (section 6): a cell figure for cells, as the seeding density
// from `seedingDensities` (seedingDensitiesOf) when it has the entry's name, else in cells/mL;
// otherwise the amount and unit that fit best (bestUnit), e.g. "476 µM".
function concentrationText(entry, seedingDensities) {
  if (isCellFamily(entry.family)) {
    // Within a plan a constituent's name has one family, so the name picks out one entry.
    const seeding = seedingDensities.find((density) => density.name === entry.name);
    if (seeding !== undefined) {
      return formatCellFigure(seeding.value, SEEDING_DENSITY_UNIT);
    }
  }
  const { amount, unit } = bestUnit(entry.family, entry.value);
  return isCellFamily(entry.family) ? formatCellFigure(amount, unit) : `${formatAmount(amount)} ${unit}`;
}

// True if the contents card shows an Osmolality line for the well `end` (section 6): it holds
// something in the shown snapshot, and some component of the plan has an osmolality (0 counts), so
// a plan that doesn't use osmolality sees no change.
function showsOsmolality(plan, end) {
  const holdsSomething = shownSnapshot.totalVolumeOf(end.labware, end.well) > 0;
  return holdsSomething && plan.components.some((component) => component.osmolality !== null);
}

// The contents card's Osmolality line (section 6) for a well's osmolality `{ value, missing }`
// (osmolalityOf): under a thin rule, "Osmolality" at the left and "≈ 305 mOsm/kg" at the right, the
// value rounded to a whole number (section 13); or, with components missing a value, the quieter
// "Osmolality unknown: no value for Buffer B and Drug stock". 0 is a value: "≈ 0 mOsm/kg".
function createOsmolalityLine({ value, missing }) {
  const line = createElement("div", "", "card-osmolality");
  if (value !== null) {
    line.append(
      createElement("span", "Osmolality"),
      createElement("span", `≈ ${formatOsmolalityEstimate(value)} mOsm/kg`, "card-volume"),
    );
  } else {
    line.classList.add("unknown");
    line.textContent = `Osmolality unknown: no value for ${listWithAnd(missing)}`;
  }
  return line;
}

// `names` joined for reading, without quotes: one as it is, two with " and ", three or more with
// ", " and " and " before the last, e.g. ["A"] → "A", ["A", "B"] → "A and B", ["A", "B", "C"] →
// "A, B and C". (listNames and listNamesWithAnd elsewhere put each name in quotes, as messages about
// property names do, so they don't fit here; section 6.) Used for End's tips tooltip (section 7)
// too.
function listWithAnd(names) {
  if (names.length <= 1) {
    return names.join("");
  }
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
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

// --- Naming a well (section 6) ---

// Connects naming wells: a right click on a well, or the context menu key (or Shift+F10) on a
// focused well, opens its name box instead of the browser's menu, unless a text box, an editing box
// or a header box was open. Every press is noted first, before the box guards close what's open.
// The name box follows its well when the page or a labware scrolls, or the window is resized.
function connectWellNaming() {
  document.addEventListener("pointerdown", notePress, true);
  elements.labwareArea.addEventListener("contextmenu", openNameBoxFromMenu);
  // A right click anywhere else ends its press here, so it isn't taken for a later one.
  document.addEventListener("contextmenu", () => {
    secondaryPress = null;
  });
  document.addEventListener("scroll", placeNameBox, true);
  window.addEventListener("resize", placeNameBox);
}

// Notes whether a press that isn't with the main button (a right click) found a box open as it
// started (secondaryPress).
function notePress(event) {
  secondaryPress = event.button === 0 ? null : { foundOpen: somethingOpen() };
}

// True if a text box (a transfer's volume, a labware's label, the experiment's name or a well's
// name), an editing box or a header box (Biomek files' or Reset's) is open.
function somethingOpen() {
  return (
    inlineBox !== null ||
    editingBox !== null ||
    !elements.biomekBox.hidden ||
    !elements.resetBox.hidden
  );
}

// A context menu asked for on the deck: on a well, the browser's menu is held back, and the well's
// name box opens, unless something was open (section 6: the right click then only closes or saves
// it, and a second right click names the well). From the keyboard (the menu key, Shift+F10) there's
// no press, so what's open now decides.
function openNameBoxFromMenu(event) {
  const end = endOf(event.target);
  if (end === null) {
    return;
  }
  event.preventDefault();
  // Wells can't be named while moving wells (section 6); the menu key is ignored (section 12).
  if (movingWells) {
    // A right click that found a box open only closed or saved it, as at other times.
    if (secondaryPress !== null && !secondaryPress.foundOpen) {
      showMessage("Wells can't be named while moving wells. Press Done first.", "note");
    }
    secondaryPress = null;
    return;
  }
  const foundOpen = secondaryPress !== null ? secondaryPress.foundOpen : somethingOpen();
  secondaryPress = null;
  if (!foundOpen) {
    openNameBox(end);
  }
}

// Opens the name box for well `end`: a text box under the well, holding its label, selected, or
// nothing, with the placeholder "e.g. Cond 1". Enter, or clicking away, saves it (saveWellName);
// Escape closes it, keeping the old label, and puts keyboard focus back on the well. The contents
// card hides while it's open.
function openNameBox(end) {
  hideContentsCard();
  const plan = currentPlan();
  const box = createInlineEditor({
    value: wellLabelOf(plan, end) ?? "",
    className: "name-box",
    accessibleName: `Name of ${wellName(plan, end)}`,
    onSave: (text, how) => saveWellName(end, text, how),
    onCancel: () => {
      closeNameBox();
      focusWell(end);
    },
  });
  box.placeholder = "e.g. Cond 1";
  nameBox = { box, end };
  // On the page itself, not in the labware area, so the deck's own pointer actions never see it.
  document.body.append(box);
  placeNameBox();
  box.focus();
  box.select();
}

// Saves the name box's `text` as well `end`'s label with setWellLabel, as one undoable edit, and
// closes the box: "Named Assay plate A4 “Media stock”." (ok), or, for a blank name on a labeled
// well, "Assay plate A4 has no name now." (note). An unchanged name gives the same plan back and
// records nothing. After Enter (`how` "enter"), keyboard focus goes back to the well. Returns what
// became of the box, for createInlineEditor.
function saveWellName(end, text, how) {
  const plan = currentPlan();
  closeNameBox();
  const named = tryLogic(() => setWellLabel(plan, end, text));
  if (named === false) {
    return "refused";
  }
  if (named !== plan) {
    recordEdit(named);
    const label = wellLabelOf(named, end);
    if (label === null) {
      showMessage(`${wellName(named, end)} has no name now.`, "note");
    } else {
      showMessage(`Named ${wellName(named, end)} “${label}”.`, "ok");
    }
  }
  if (how === "enter") {
    focusWell(end);
  }
  return "closed";
}

// Takes the name box off the page.
function closeNameBox() {
  if (nameBox === null) {
    return;
  }
  const { box } = nameBox;
  nameBox = null;
  box.remove();
}

// Places the name box 6px under its well, centered on it, kept inside the window (section 6).
function placeNameBox() {
  if (nameBox === null) {
    return;
  }
  const wellElement = wellElements.get(wellKey(nameBox.end));
  if (wellElement === undefined) {
    return;
  }
  const well = wellElement.getBoundingClientRect();
  const box = nameBox.box;
  const margin = 8;
  const gap = 6;
  const centeredLeft = well.left + well.width / 2 - box.offsetWidth / 2;
  const left = Math.min(Math.max(margin, centeredLeft), window.innerWidth - margin - box.offsetWidth);
  const top = Math.min(Math.max(margin, well.bottom + gap), window.innerHeight - margin - box.offsetHeight);
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
}

// Puts keyboard focus on well `end`, as drawn now.
function focusWell(end) {
  wellElements.get(wellKey(end))?.focus();
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
  // An open randomization's card closes first, as Close would (section 7).
  if (!closeRandomizationCard()) {
    return;
  }
  const plan = currentPlan();
  const original = originalFor(plan, kind, key);
  const draft = { ...original, showAllColors: false };
  if (kind === "component") {
    // The rows are edited in place, so the draft gets its own copies.
    draft.rows = original.rows.map((row) => ({ ...row }));
  }
  editingBox = { kind, key, original, draft };
  refreshStages();
  focusEditingBox();
}

// A constituent as a component's box holds it (section 8): its name, its amount as text, and its
// unit, e.g. { name: "Dye", amount: "10", unit: "mM" }. A new object each time.
function rowOf(constituent) {
  return { name: constituent.name, amount: String(constituent.amount), unit: constituent.unit };
}

// A row of a component's box as it's passed on to setConstituents: its amount as a number when the
// text is one, exponent form included, else as typed (section 13), so the logic's message says
// what's wrong.
function constituentOfRow(row) {
  return { name: row.name, amount: amountValue(row.amount), unit: row.unit };
}

// What a box edits, before any changes: a component's name, color, constituents (as rows of
// text, section 8) and osmolality (as the text its box shows, "" for none); a stage's name, modes and whether each end mixes; a mix step's name; a tip
// change's tip type and probes.
function originalFor(plan, kind, key) {
  if (kind === "component") {
    const component = plan.components.find((candidate) => candidate.name === key);
    return {
      name: component.name,
      color: component.color,
      rows: component.constituents.map(rowOf),
      osmolality: component.osmolality === null ? "" : osmolalityText(component.osmolality),
    };
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
    return (
      draft.name !== original.name ||
      draft.color !== original.color ||
      JSON.stringify(draft.rows) !== JSON.stringify(original.rows) ||
      isOsmolalityChanged(original.osmolality, draft.osmolality)
    );
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

// True if a component box's osmolality text `typed` changes the osmolality shown first as
// `shown` (section 8): not when the text is the same; otherwise when the value it would pass on
// differs from the shown one's, so "300.0" and "300" are the same, and so are an emptied box and a
// component with none.
function isOsmolalityChanged(shown, typed) {
  if (typed === shown) {
    return false;
  }
  return osmolalityValue(typed) !== osmolalityValue(shown);
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
  // A component's box is as wide, so its Contains rows' name boxes keep room (section 15).
  box.classList.toggle("component-box", editingBox.kind === "component");
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

// A component's box (section 8): Name, Color swatches and More colors / Fewer colors, Contains and
// Osmolality.
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
  return [nameField, colorField, createContainsField(draft), createOsmolalityField(draft)];
}

// A component's Osmolality field (section 8; ADR 0016): its label, then a 112px text box showing the
// draft's osmolality text (placeholder "Not measured"), updating the draft as typed in, and
// "mOsm/kg" in gray. Enter in it saves the box, as in any of the box's text boxes.
function createOsmolalityField(draft) {
  const field = createElement("div", "", "osmolality-field");
  const box = document.createElement("input");
  box.type = "text";
  box.id = "editing-box-osmolality";
  box.className = "osmolality-box";
  box.value = draft.osmolality;
  box.placeholder = "Not measured";
  box.title = "The stock's measured osmolality. Leave it empty if it isn't known.";
  box.addEventListener("input", () => {
    draft.osmolality = box.value;
  });
  const label = createElement("label", "Osmolality");
  label.htmlFor = box.id;
  const row = createElement("div", "", "osmolality-row");
  row.append(box, createElement("span", "mOsm/kg", "osmolality-unit"));
  field.append(label, row);
  return field;
}

// A component's Contains field (section 8; ADR 0013): the draft's constituent rows, each a Name
// box, an Amount box, a unit menu and ×, or "Contains nothing at a known concentration." while
// there are none; then + Add, which adds a row and focuses its name box.
function createContainsField(draft) {
  const field = createElement("div", "", "contains-field");
  field.append(createElement("span", "Contains", "field-name"));
  if (draft.rows.length === 0) {
    field.append(createElement("p", "Contains nothing at a known concentration.", "note contains-nothing"));
  } else {
    const rows = createElement("div", "", "contains-rows");
    draft.rows.forEach((row, index) => rows.append(createConstituentRow(draft, row, index)));
    field.append(rows);
  }
  const add = createElement("button", "+ Add", "more-colors add-constituent");
  add.type = "button";
  add.addEventListener("click", () => {
    // The first row starts with the component's own name, so "Dye is 10 mM" is an amount away.
    const name = draft.rows.length === 0 ? draft.name.trim() : "";
    draft.rows.push({ name, amount: "", unit: DEFAULT_CONCENTRATION_UNIT });
    redrawEditingBox();
    editingBox.element.querySelector(`.constituent-row:nth-child(${draft.rows.length}) .constituent-name`)?.focus({ preventScroll: true });
  });
  field.append(add);
  return field;
}

// One row of a component's Contains field (section 8): a Name box and an Amount box (ordinary text
// boxes, updating the draft as typed in), a unit menu of the offered units (plus the row's own unit
// when it's configured but not offered, so the row reads as saved), and × to take the row out.
function createConstituentRow(draft, row, index) {
  const element = createElement("div", "", "constituent-row");
  const number = index + 1;
  const name = document.createElement("input");
  name.type = "text";
  name.className = "constituent-name";
  name.value = row.name;
  name.placeholder = "Name";
  name.setAttribute("aria-label", `Constituent ${number} name`);
  name.addEventListener("input", () => {
    row.name = name.value;
  });
  const amount = document.createElement("input");
  amount.type = "text";
  amount.className = "constituent-amount";
  amount.value = row.amount;
  amount.placeholder = "Amount";
  amount.setAttribute("aria-label", `Constituent ${number} amount`);
  amount.addEventListener("input", () => {
    row.amount = amount.value;
  });
  const unit = document.createElement("select");
  unit.className = "constituent-unit";
  unit.setAttribute("aria-label", `Constituent ${number} unit`);
  for (const symbol of unitsOfferedFor(row.unit)) {
    const option = document.createElement("option");
    option.value = symbol;
    option.textContent = symbol;
    option.selected = symbol === row.unit;
    unit.append(option);
  }
  unit.addEventListener("change", () => {
    row.unit = unit.value;
  });
  const remove = createElement("button", "×", "remove-constituent");
  remove.type = "button";
  remove.title = "Take it out";
  remove.setAttribute("aria-label", `Take out constituent ${number}`);
  remove.addEventListener("click", () => {
    draft.rows.splice(index, 1);
    redrawEditingBox();
  });
  element.append(name, amount, unit, remove);
  return element;
}

// The units a row's menu offers: the offered units of config/concentration-units.js in its order,
// plus `ownUnit` when it's a configured unit that isn't offered (a display-only unit a file could
// hold), in its place in the configuration's order, e.g. a row in nM offers mM, µM, nM, g/L, %, ×.
function unitsOfferedFor(ownUnit) {
  return CONCENTRATION_UNITS.filter((entry) => entry.offered || entry.unit === ownUnit).map(
    (entry) => entry.unit,
  );
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
  const { draft, original, key } = editingBox;
  const nameField = createNameField(draft.name, "Name");
  // A transfer table's stage is named after its component (section 10).
  if (transferTableOf(plan, key) !== null) {
    const box = nameField.querySelector("input");
    box.disabled = true;
    box.title = "Named after its component in the transfer table.";
  }
  const grid = createSettingsGrid({
    draft,
    original,
    redraw: redrawEditingBox,
    mixTooltip: (boxEnd) => mixTooltip(plan, key, boxEnd),
  });
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

// The settings as a grid (section 10), for a stage's box and a randomization's Each transfer
// (section 7): the ends as columns, headed Aspirate and Dispense, and the settings as rows, each
// labeled once at the left: Mode, a menu per end, and Mix, a checkbox per end. The top left cell is
// empty: it's above the labels and left of the headings. `draft` holds each end's mode and Mix as
// they're chosen (the names in BOX_ENDS); `original` the same before any change; `redraw` redraws
// what holds the grid after a change; `mixTooltip(boxEnd)` gives a Mix checkbox's tooltip.
function createSettingsGrid({ draft, original, redraw, mixTooltip: tooltipFor }) {
  const grid = createElement("div", "", "settings-grid");
  grid.append(
    createElement("span"),
    ...BOX_ENDS.map((boxEnd) => createElement("span", boxEnd.heading, "field-name")),
    createElement("span", "Mode", "field-name"),
    ...BOX_ENDS.map((boxEnd) => {
      const offerNotAMode = original[boxEnd.mode] === null;
      const onChoose = (name) => chooseMode(draft, original, boxEnd, name, redraw);
      return createModeMenu(boxEnd.end, `${boxEnd.heading} mode`, draft[boxEnd.mode], offerNotAMode, onChoose);
    }),
    createElement("span", "Mix", "field-name"),
    ...BOX_ENDS.map((boxEnd) => createMixCell(draft, boxEnd, tooltipFor(boxEnd))),
  );
  return grid;
}

// Puts the mode called `name` (or null for "(not one of the modes)") in the draft for one end, and
// keeps that end's Mix as section 10 says: a mode that can't mix unchecks it; going back to "(not
// one of the modes)" restores whether it mixed there (`original`); a mode that can mix keeps it as
// it is (so after a mode that can't mix, the checkbox comes back unchecked). Then calls `redraw`.
function chooseMode(draft, original, boxEnd, name, redraw) {
  draft[boxEnd.mode] = name;
  if (name === null) {
    draft[boxEnd.mix] = original[boxEnd.mix];
  } else if (!canMix(boxEnd.end, name)) {
    draft[boxEnd.mix] = false;
  }
  redraw();
}

// True if the mode called `name` at `end` can mix (it has a mixing technique), e.g.
// canMix("destination", "Non-Contact") → false.
function canMix(end, name) {
  const mode = modesFor(end).find((candidate) => candidate.name === name);
  return mode !== undefined && mode.mixingTechnique !== null;
}

// One end's Mix cell (section 10): a checkbox, checked while that end mixes in the draft; for a mode
// that can't mix, "Can't mix" instead; for an end that isn't one of the modes, the checkbox showing
// whether it mixes there, disabled. The cell's tooltip, `tooltip`, says what the checkbox does.
function createMixCell(draft, boxEnd, tooltip) {
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
  cell.title = mode === null ? "Choose a mode to switch mixing." : tooltip;
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
  const volumeText = ownMix === null ? "" : mixVolumeText(plan, id, boxEnd.end);
  return mixTooltipText(boxEnd, ownMix, volumeText);
}

// A Mix checkbox's tooltip from an end's own mix (`ownMix`, or null, when DEFAULT_MIX is shown) and
// the volume it works out to (`volumeText`, or ""), e.g. "Mix after dispensing: 90% of the well,
// 3 times, at 400 µL/s."
function mixTooltipText(boxEnd, ownMix, volumeText) {
  const mix = ownMix ?? DEFAULT_MIX;
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
  if (kind === "stage" && transferTableOf(plan, key) !== null) {
    return {
      kind: "none",
      reason: "Part of a transfer table: to remove it, clear its column in the table, or remove the whole table.",
    };
  }
  if (kind === "stage" && !canRemoveStage(plan, key)) {
    return { kind: "button", disabled: true, reason: "Keep at least one stage." };
  }
  if (kind === "tip" && key === START) {
    return { kind: "none", reason: "The run always starts by loading tips, so these can't be removed." };
  }
  if (kind === "tip" && transferTableOf(plan, key) !== null) {
    return { kind: "none", reason: "Every stage of a transfer table starts on new tips, so these can't be removed." };
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

// A component's Save: renames it, recolors it, sets its constituents (when the rows, with each
// amount passed on as section 13 does, differ from what it carries, compared as JSON in order) and
// its osmolality (when the value the box passes on differs from its own), as one edit, returning
// { plan, message }. If it was picked, it stays picked. Throws as renameComponent,
// setComponentColor, setConstituents and setOsmolality do.
function saveComponentDraft(plan, name, draft) {
  let saved = renameComponent(plan, name, draft.name);
  const newName = draft.name.trim();
  const component = plan.components.find((candidate) => candidate.name === name);
  if (draft.color !== component.color) {
    saved = setComponentColor(saved, newName, draft.color);
  }
  const constituents = draft.rows.map(constituentOfRow);
  if (JSON.stringify(constituents) !== JSON.stringify(component.constituents)) {
    saved = setConstituents(saved, newName, constituents);
  }
  const osmolality = osmolalityValue(draft.osmolality);
  if (osmolality !== component.osmolality) {
    saved = setOsmolality(saved, newName, osmolality);
  }
  // Every edit passed, so the picked component can follow the new name.
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

// Acts on one key press (section 12). While the transfer table wizard is open, none act on the
// page: the wizard handles its own keys.
function handleKey(event) {
  if (wizard !== null) {
    return;
  }
  // While a drag is on in the Stages column, Escape cancels it and Ctrl (Cmd) switches it to
  // copying (section 12).
  if (columnDrag !== null || columnPress !== null) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelColumnDrag();
      return;
    }
    if (columnDrag !== null && (event.key === "Control" || event.key === "Meta")) {
      setDragCopying(true);
      return;
    }
  }
  if (event.target.matches("input, select, textarea, [contenteditable]")) {
    return;
  }
  if (columnMenu !== null && event.key === "Escape") {
    closeColumnMenu();
    return;
  }
  // The menu key is ignored while moving wells (section 12).
  if (!movingWells && openColumnMenuFromKey(event)) {
    return;
  }
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    // undo and redo do nothing while a randomization's card is open.
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
// Reset's), putting the focus back on its button, or the open randomization's card (saving or
// discarding, closeCardWithEscape); otherwise it clears a chosen source. While moving wells, it does
// what pressEscapeWhileMoving says instead.
function pressEscape() {
  if (movingWells) {
    pressEscapeWhileMoving();
    return;
  }
  if (editingBox !== null) {
    closeEditingBox();
  } else if (!elements.biomekBox.hidden) {
    closeBiomekBox();
    elements.biomekFiles.focus();
  } else if (!elements.resetBox.hidden) {
    closeResetBox();
    elements.reset.focus();
  } else if (card !== null) {
    closeCardWithEscape();
  } else if (source !== null) {
    clearSource();
  } else if (pickedSet !== null) {
    // Nothing above used Escape: it forgets the selection (section 12).
    forgetPickedSet();
    markSelection(selectedItems());
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
  // Typed volumes are ignored while a randomization's card is open (section 9), and while moving
  // wells (section 12).
  if (open === END || card !== null || movingWells) {
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

// A typed amount (a constituent's; section 13, "Typing an amount"): with spaces at the ends removed,
// a number when the whole text is one, exponent form included, e.g. "1.5e6" → 1500000, ".5" → 0.5,
// "1e400" → Infinity (refused by the logic); anything else as typed, e.g. "1,500,000" or "e6".
function amountValue(text) {
  const trimmed = text.trim();
  return TYPED_AMOUNT_PATTERN.test(trimmed) ? Number(trimmed) : text;
}

// A component's osmolality as its box reads it back (section 8): the text trimmed; empty (or only
// spaces) is none, null; a finite number is passed on as that number (so "300.0" gives 300 and
// "1e-7" round-trips with what the box shows); anything else is passed on as typed, trimmed, so
// setOsmolality's message says what's wrong, e.g. osmolalityValue(" 300 ") → 300,
// osmolalityValue("") → null, osmolalityValue("ten") → "ten".
function osmolalityValue(text) {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : trimmed;
}

// A component's osmolality as its box and chip tooltip show it (section 13): at full precision, as
// String writes it, e.g. 300 → "300", 290.5 → "290.5", 1e-7 → "1e-7".
function osmolalityText(osmolality) {
  return String(osmolality);
}

// A well's estimated osmolality as the contents card shows it (section 13): rounded to a whole
// number, with no thousands separator, e.g. 304.6 → "305", 1250.2 → "1250".
function formatOsmolalityEstimate(value) {
  return String(Math.round(value));
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

// An amount (a constituent's on a chip, a concentration's on the contents card; section 13): to 3
// significant figures with trailing zeros dropped, e.g. 2.5, 333, 0.0417; below 0.001 but not 0, in
// exponent form with one decimal, e.g. "4.0e-4". The unit is added by the caller.
function formatAmount(amount) {
  if (amount !== 0 && Math.abs(amount) < 0.001) {
    return amount.toExponential(1);
  }
  // toPrecision gives 3 significant figures, possibly in exponent form for large values; Number()
  // then String() drops trailing zeros and writes it plainly.
  return String(Number(amount.toPrecision(3)));
}

// A cell figure (section 13): `value` with its `unit` in powers of ten, as labs write cell counts,
// when its exponent (with 2 decimals) is 3 or more, e.g. (46875, "cells/cm²") → "4.69 × 10⁴
// cells/cm²", (999.6, "cells/mL") → "1 × 10³ cells/mL"; otherwise as an amount, e.g. (500,
// "cells/mL") → "500 cells/mL".
function formatCellFigure(value, unit) {
  const [mantissa, exponentText] = value.toExponential(2).split("e");
  const exponent = Number(exponentText);
  if (exponent < 3) {
    return `${formatAmount(value)} ${unit}`;
  }
  const superscript = [...String(exponent)].map((digit) => SUPERSCRIPT_DIGITS[digit]).join("");
  return `${Number(mantissa)} × 10${superscript} ${unit}`;
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
