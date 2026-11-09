// tutorial.js — the tutorials' logic: the five tutorials (docs/glossary.md, "Tutorial"), each a list
// of steps, and for each step its text, its checklist, what the page should ring, and when it's
// done. It holds no page code: every step is plain data and pure functions of a **view**, a plain
// description of what the transfer designer's page shows, which the guide panel gets from the
// page's hook (transfer-designer-page.md, section 17) and passes in. So every step can be tested in
// Node, and a page change that breaks a step stops that step moving on rather than breaking the
// page (stepState catches what a step throws).
// The guide panel (tutorial-page.md) draws the steps; the starting plans come from
// tutorial-plans.js. ADR 0022 says why the tutorials run over the real page.
// Specification: tutorial.md.

import { TIP_TYPES, MIX_VOLUME_LIMITS, DEFAULT_PROBE_COUNT } from "../../../config/tip-types.js";
import { DEFAULT_PIPETTING_MODE } from "../../../config/pipetting-modes.js";
import { BASE_FOLDER } from "../../../config/paths.js";
import { CELL_DENSITY_UNIT } from "../../../config/concentration-units.js";
import { deadVolumeOf, capacityOf } from "../../shared/deck/deck.js";
import { replay } from "../../shared/contents-tracking/contents-tracking.js";
import { possibleTraces } from "../../shared/possible-contamination/possible-contamination.js";
import {
  START,
  stageOrder,
  transfersIn,
  tipChangeAt,
  modeOf,
  wellLabelOf,
} from "../transfer-designer/transfer-designer.js";

// --- Values from config/ that steps mention (tutorial.md, section 7) ---

// The dead volume of Res1's labware type, in µL.
const DEAD = deadVolumeOf("Res1");

// The capacity of Plate1's labware type, in µL.
const CAPACITY = capacityOf("Plate1");

// The tips a new plan uses: the first tip type.
const TIP = TIP_TYPES[0];

// The most a TIP tip mixes, in µL.
const MIX_LIMIT = MIX_VOLUME_LIMITS[TIP];

// How many probes a new plan's tips, and a new tip change's, load.
const PROBES = DEFAULT_PROBE_COUNT;

// The mode a new stage's ends use, e.g. "Medium".
const MODE = DEFAULT_PIPETTING_MODE;

// --- Helpers (tutorial.md, section 3, "Helpers") ---

// A name in lower case without spaces at its ends, so names compare without regard to them,
// e.g. " Base Media " → "base media".
function normal(name) {
  return String(name ?? "").trim().toLowerCase();
}

// True if two names are the same, capitals and spaces at the ends aside.
function sameName(a, b) {
  return normal(a) === normal(b);
}

// True if two wells ({ labware, well }) are the same well.
function sameWell(a, b) {
  return a.labware === b.labware && a.well === b.well;
}

// The ID of stage `n`, counting from 1 in the stage order, or null if there's no such stage,
// e.g. stageAt(plan, 1) → "1".
export function stageAt(plan, n) {
  return stageOrder(plan)[n - 1] ?? null;
}

// Stage `n`'s transfers from `source` ({ labware, well }) into `destinationLabware` (and into
// `destinationWell`, if given); [] if there's no stage `n`,
// e.g. transfersFrom(plan, 1, { labware: "Res1", well: "1" }, "Plate1").length → 12.
export function transfersFrom(plan, n, source, destinationLabware, destinationWell) {
  const id = stageAt(plan, n);
  if (id === null) {
    return [];
  }
  return transfersIn(plan, id).filter(
    (transfer) =>
      sameWell(transfer.source, source) &&
      transfer.destination.labware === destinationLabware &&
      (destinationWell === undefined || transfer.destination.well === destinationWell),
  );
}

// µL of `component` the well holds at the start, e.g. startVolume(plan, "Res1", "1", "Base media")
// → 6000; 0 if it holds none.
export function startVolume(plan, labware, well, component) {
  const entry = plan.startingContents.find((candidate) => candidate.labware === labware && candidate.well === well);
  if (entry === undefined) {
    return 0;
  }
  return Object.entries(entry.components)
    .filter(([name]) => sameName(name, component))
    .reduce((total, [, volume]) => total + volume, 0);
}

// The plan's component of that name, or undefined.
function componentNamed(plan, name) {
  return plan.components.find((component) => sameName(component.name, name));
}

// True if the plan has a component of that name, e.g. hasComponent(plan, "cells ") → true.
export function hasComponent(plan, name) {
  return componentNamed(plan, name) !== undefined;
}

// True if `component` carries a constituent in `unit` with an amount above 0,
// e.g. carries(plan, "Cells", "cells/mL").
export function carries(plan, component, unit) {
  const found = componentNamed(plan, component);
  return (
    found !== undefined &&
    found.constituents.some((constituent) => sameName(constituent.unit, unit) && constituent.amount > 0)
  );
}

// True if stage `n`'s name contains `word`, capitals aside, e.g. stageNameHas(plan, 2, "cell").
export function stageNameHas(plan, n, word) {
  const id = stageAt(plan, n);
  return id !== null && normal(plan.stageList.get(id).name).includes(normal(word));
}

// True if stage `n` starts a tip group of its own: stage 1 always (the run starts by loading tips,
// under the START key); any other, if the plan has a tip change under its ID.
export function startsNewTips(plan, n) {
  const id = stageAt(plan, n);
  if (id === null) {
    return false;
  }
  return n === 1 || tipChangeAt(plan, id) !== null;
}

// How many probes the tip change starting stage `n`'s tip group loads, e.g. 4; null if there's no
// stage `n`.
export function tipProbes(plan, n) {
  for (let place = n; place >= 1; place--) {
    if (startsNewTips(plan, place)) {
      return tipChangeAt(plan, place === 1 ? START : stageAt(plan, place)).probes.length;
    }
  }
  return null;
}

// Stage `n`'s settings, or null if there's no such stage.
function settingsOf(plan, n) {
  const id = stageAt(plan, n);
  return id === null ? null : plan.stageList.get(id).settings;
}

// The mode stage `n` aspirates with, e.g. "Slow"; null if there's no such stage or it isn't a mode.
export function aspirateMode(plan, n) {
  const settings = settingsOf(plan, n);
  return settings === null ? null : modeOf("source", settings);
}

// The mode stage `n` dispenses with, e.g. "Non-Contact"; null as for aspirateMode.
export function dispenseMode(plan, n) {
  const settings = settingsOf(plan, n);
  return settings === null ? null : modeOf("destination", settings);
}

// True if stage `n` mixes its source before aspirating (its sourceMix isn't null).
export function mixesBeforeAspirating(plan, n) {
  const settings = settingsOf(plan, n);
  return settings !== null && settings.sourceMix !== null;
}

// True if stage `n` mixes its destination after dispensing (its destinationMix isn't null).
export function mixesAfterDispensing(plan, n) {
  const settings = settingsOf(plan, n);
  return settings !== null && settings.destinationMix !== null;
}

// The well's label, or "" for none, e.g. wellLabelText(plan, "Deep1", "A1") → "Control".
export function wellLabelText(plan, labware, well) {
  return wellLabelOf(plan, { labware, well }) ?? "";
}

// The number of operations in the plan.
function operationCount(plan) {
  return plan.operationList.listOperations().length;
}

// The well's possible traces after the whole run (possible-contamination.md), e.g. ["Base media"].
export function tracesAtEnd(plan, labware, well) {
  return possibleTraces(plan, operationCount(plan)).tracesOf(labware, well);
}

// µL the well holds after the whole run, e.g. totalAtEnd(plan, "Plate1", "B2") → 150.
export function totalAtEnd(plan, labware, well) {
  return replay(plan.startingContents, plan.operationList).totalVolumeOf(labware, well);
}

// µL the well holds after stage `n` (0 for the start), e.g. totalAfterStage(plan, 0, "Res1", "2")
// → 3000. The operation list keeps each stage's transfers together, in the stage order, so the
// stages up to `n` are its first operations.
export function totalAfterStage(plan, n, labware, well) {
  const count = stageOrder(plan)
    .slice(0, n)
    .reduce((total, id) => total + transfersIn(plan, id).length, 0);
  return replay(plan.startingContents, plan.operationList, count).totalVolumeOf(labware, well);
}

// True if the labware is out on the page, e.g. isOut(view, "Res1").
export function isOut(view, labware) {
  return view.labwareOut.includes(labware);
}

// True if `key` ("start", a stage's ID or "end") is what's open in the Stages column.
export function isOpen(view, key) {
  return view.open === key;
}

// --- Step markup (tutorial.md, section 3, "Step markup") ---

// The block marks, each with the kind of block its lines make. A numbered list's mark is checked
// separately, since its number varies.
const LINE_MARKS = [
  ["- ", "bulleted"],
  ["> ", "note"],
  ["! ", "warning"],
  ["| ", "table"],
];

// A numbered list item's mark: digits, a dot and a space, e.g. "2. ".
const NUMBERED_MARK = /^(\d+)\. /;

// The inline marks: **bold**, `code` and [Key].
const INLINE_MARK = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]\n]+)\]/g;

// The blocks of step markup, for the panel to draw, e.g.
//   parseMarkup("Press **Next**.\n\n> A note.") →
//   [{ kind: "paragraph", runs: [{ kind: "text", text: "Press " }, { kind: "bold", text: "Next" },
//     { kind: "text", text: "." }] }, { kind: "note", runs: [{ kind: "text", text: "A note." }] }]
// A numbered list is { kind: "numbered", start, items }, a bulleted one { kind: "bulleted", items },
// each item a list of runs; a table { kind: "table", rows }, each row a list of cells, each a list of
// runs, the first row the header. Text is never read as HTML.
export function parseMarkup(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").filter((line) => line.trim() !== ""))
    .filter((lines) => lines.length > 0)
    .map(parseBlock);
}

// One block of markup, from its lines (tutorial.md, section 3).
function parseBlock(lines) {
  const numbered = NUMBERED_MARK.exec(lines[0]);
  if (numbered !== null) {
    return {
      kind: "numbered",
      start: Number(numbered[1]),
      items: lines.map((line) => parseInline(line.replace(NUMBERED_MARK, ""))),
    };
  }
  const mark = LINE_MARKS.find(([prefix]) => lines[0].startsWith(prefix));
  if (mark === undefined) {
    return { kind: "paragraph", runs: parseInline(lines.join(" ")) };
  }
  const [prefix, kind] = mark;
  const content = lines.map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line));
  if (kind === "bulleted") {
    return { kind, items: content.map(parseInline) };
  }
  if (kind === "table") {
    return { kind, rows: lines.map(tableCells) };
  }
  return { kind, runs: parseInline(content.join(" ")) };
}

// A table row's cells, each a list of runs: the row's text between its first and last "|", split
// at each "|", each cell's spaces at the ends removed, so an empty cell is nothing between two
// separators, e.g. "| Control | 1000 |  |" → three cells, the last empty.
function tableCells(line) {
  let inner = line.trim().replace(/^\|/, "");
  if (inner.endsWith("|")) {
    inner = inner.slice(0, -1);
  }
  return inner.split("|").map((cell) => parseInline(cell.trim()));
}

// A piece of text as inline runs, { kind: "text" | "bold" | "code" | "key", text }, reading no
// block marks, for one line such as a checklist item's text, e.g.
// "Press [Enter]" → [{ kind: "text", text: "Press " }, { kind: "key", text: "Enter" }].
export function parseInline(text) {
  const line = String(text);
  const runs = [];
  let last = 0;
  for (const match of line.matchAll(INLINE_MARK)) {
    if (match.index > last) {
      runs.push({ kind: "text", text: line.slice(last, match.index) });
    }
    if (match[1] !== undefined) {
      runs.push({ kind: "bold", text: match[1] });
    } else if (match[2] !== undefined) {
      runs.push({ kind: "code", text: match[2] });
    } else {
      runs.push({ kind: "key", text: match[3] });
    }
    last = match.index + match[0].length;
  }
  if (last < line.length) {
    runs.push({ kind: "text", text: line.slice(last) });
  }
  return runs;
}

// --- Drawing a step ---

// What the panel draws for `step` with `view`: { done, target, checklist, body, keepClear }
// (tutorial.md, section 4). `wasDone` is whether a sticky step has been done since it was shown. A
// step function that throws gives done false, no target, an empty checklist and body and the
// default keep-clear, instead of breaking the page.
export function stepState(step, view, wasDone) {
  try {
    const done = (step.done === undefined ? true : step.done(view) === true) || (step.sticky === true && wasDone === true);
    const ringing = step.done === undefined || !done;
    return {
      done,
      target: ringing && step.target !== undefined ? (step.target(view) ?? null) : null,
      checklist: step.checklist === undefined ? null : step.checklist(view),
      body: parseMarkup(typeof step.body === "function" ? step.body(view) : step.body),
      keepClear: step.keepClear === undefined ? defaultKeepClear(view) : step.keepClear(view),
    };
  } catch {
    return {
      done: false,
      target: null,
      checklist: { inline: false, items: [] },
      body: [],
      keepClear: defaultKeepClear(view),
    };
  }
}

// The targets a step avoids covering when it names none: every labware block that's out.
function defaultKeepClear(view) {
  if (view === null || view === undefined || !Array.isArray(view.labwareOut)) {
    return [];
  }
  return view.labwareOut.map((labware) => ({ kind: "labware", labware }));
}

// --- Building steps ---

// Markup blocks joined with blank lines, e.g. blocks("One.", "> Two.").
function blocks(...parts) {
  return parts.filter((part) => part !== null && part !== "").join("\n\n");
}

// A number as the steps show it: at most one decimal place, no thousands separators, e.g. 4000.
function amount(value) {
  return String(Math.round(value * 10) / 10);
}

// A well target.
function wellTarget(labware, well) {
  return { kind: "well", labware, well };
}

// A tray chip target.
function chipTarget(labware) {
  return { kind: "trayChip", labware };
}

// An entry target: Start, a stage's ID or End.
function entryTarget(key) {
  return { kind: "entry", key };
}

// A trough of Res1, as a well.
function trough(number) {
  return { labware: "Res1", well: String(number) };
}

// The keep-clear list of the labware named.
function keepClearOf(...labware) {
  return () => labware.map((name) => ({ kind: "labware", labware: name }));
}

// "Ring a stage's ✎" (tutorial.md, section 6): its entry while it isn't open, the open editing box
// while one is open, else its ✎. Null if there's no stage `n`.
function stagePencilRing(view, n) {
  const id = stageAt(view.plan, n);
  if (id === null) {
    return null;
  }
  if (!isOpen(view, id)) {
    return entryTarget(id);
  }
  return view.editingBox === null ? { kind: "stagePencil", id } : { kind: "editingBox" };
}

// A checklist of `items`, each [done, text], drawn as a row (inline) or one per line.
function checklistOf(inline, items) {
  return { inline, items: items.map(([done, text]) => ({ done: done === true, text })) };
}

// True if every item of a checklist is done.
function allDone(checklist) {
  return checklist.items.every((item) => item.done);
}

// The text of the second paragraph of every tutorial's step 1 (NEW_STAGE_HOW).
const NEW_STAGE_HOW = "Point at the gap just above **End** and click the blue **+** on the dashed line.";

// The name step (tutorial 1): its warning shows while the plan has a name that doesn't start with
// "Practice".
function nameStep(name) {
  return {
    title: "Name the experiment",
    body: (view) =>
      blocks(
        "Every run needs a name: the Biomek files' folder is named after it.",
        `1. Click **Name this experiment** at the top left.\n2. Type \`${name}\` and press [Enter].`,
        "> Names use letters, digits, - and _ only, no spaces.",
        view.plan.experimentName !== "" && !startsWithPractice(view.plan.experimentName)
          ? "! In the tutorials, start the name with `Practice`, so practice files are easy to spot. Click the name to change it."
          : null,
      ),
    target: () => ({ kind: "button", name: "experimentName" }),
    done: (view) => startsWithPractice(view.plan.experimentName),
  };
}

// True if a name starts with "Practice", capitals aside.
function startsWithPractice(name) {
  return normal(name).startsWith("practice");
}

// The write step's ring: Write files while the Biomek files box is open, else Biomek files.
function writeTarget(view) {
  return { kind: "button", name: view.headerBox === "biomek" ? "writeFiles" : "biomekFiles" };
}

// The write step's done: the message says a zip was saved.
function zipSaved(view) {
  return view.message !== null && view.message.text.startsWith("Saved ") && view.message.text.includes(".zip");
}

// The write step (tutorials 1 and 3).
const WRITE_STEP = {
  title: "Write the Biomek files",
  body: blocks(
    "1. Press **Biomek files**. The box shows the zip's name: date, time and experiment name.\n2. Press **Write files** and save the zip.",
    "> If the box shows a red message instead, it says what to fix first.",
  ),
  target: writeTarget,
  done: zipSaved,
};

// The save step (tutorial 1).
const SAVE_STEP = {
  title: "Save the plan",
  body: blocks(
    "Your work is kept in this browser, but save a plan file too, so you can reopen it anywhere.",
    "Press **Save** and save the file.",
    "> **Open** loads a saved plan later.",
  ),
  target: () => ({ kind: "button", name: "save" }),
  done: (view) => view.message !== null && view.message.text.startsWith("Saved the plan"),
};

// The warning every tutorial that writes files ends with.
const PRACTICE_ZIP_WARNING = "! Practice zips are only for trying out simulation. Don't run them on the instrument.";

// --- Tutorial 1: Your first run ---

// The culture plate the tutorials fill: "the plate" in tutorial.md.
const PLATE = "Plate1";

const FIRST_RUN = {
  id: "first-run",
  title: "Your first run",
  summary: "Plan a simple run from scratch and write its Biomek files.",
  minutes: 10,
  startPlan: "empty",
  steps: [
    {
      title: "Your first run",
      body: blocks(
        "In this tutorial you plan a simple run from scratch and write its Biomek files.",
        "You'll fill a reservoir with **Base media** and **Cells**, put media into 12 wells of a culture plate, then add cells on top.",
        "> This is a practice copy. Nothing you do here touches plans in the real Transfer Designer. Follow the orange ring; the tutorial moves on once each step is done.",
      ),
    },
    nameStep("Practice1"),
    {
      title: "Bring out the labware",
      body: blocks(
        "The tray lists every labware on the Biomek's deck. Only the labware you bring out is shown.",
        "1. Click **Res1**, a 12-trough reservoir, for the stocks.\n2. Click **Plate1**, a 96-well culture plate.",
      ),
      checklist: (view) => checklistOf(true, [[isOut(view, "Res1"), "Res1"], [isOut(view, PLATE), "Plate1"]]),
      target: (view) => chipTarget(isOut(view, "Res1") ? PLATE : "Res1"),
      done: (view) => isOut(view, "Res1") && isOut(view, PLATE),
    },
    {
      title: "Give the plate your own name",
      body: blocks(
        "The Biomek calls it Plate1, but you can call it what you like.",
        "1. Click the bold **Plate1** above its wells.\n2. Type `Culture plate` and press [Enter].",
        "> The Biomek files still use Plate1. A labware sheet in the files matches up the two names.",
      ),
      target: () => ({ kind: "labwareHeading", labware: PLATE }),
      done: (view) => Object.hasOwn(view.plan.labwareLabels, PLATE),
    },
    {
      title: "Start",
      body: blocks(
        "The column on the right is the run, top to bottom: **Start**, then the stages, then **End**.",
        "**Start** is open now, marked **Shown on deck**. It's what's in the wells before the run: the stocks you pipette in by hand.",
        "Press **Next**.",
      ),
      target: () => entryTarget(START),
    },
    {
      title: "Add the components",
      body: blocks(
        "A **component** is a liquid you put on the deck. Each gets its own color.",
        "1. In the Start card, click **+ New**.\n2. Type `Base media`, press [Enter].\n3. A new box opens: type `Cells`, press [Enter].\n4. Press [Enter] on the empty box to finish.",
      ),
      checklist: (view) =>
        checklistOf(true, [
          [hasComponent(view.plan, "Base media"), "Base media"],
          [hasComponent(view.plan, "Cells"), "Cells"],
        ]),
      target: () => ({ kind: "newComponent" }),
      done: (view) => hasComponent(view.plan, "Base media") && hasComponent(view.plan, "Cells") && !view.addingComponent,
    },
    {
      title: "Fill the troughs",
      body: blocks(
        "For each trough: click the component's chip, **type the volume** on the keyboard (there's no box: it shows beside your cursor), then click the trough.",
        `> Enter what you'll really pipette in. A trough keeps ${amount(DEAD)} µL the tips can't reach (dead volume), and the page counts it for you. Too much? Press **Undo**.`,
      ),
      checklist: (view) => troughChecklist(view),
      target: (view) => wellTarget("Res1", troughChecklist(view).items[0].done ? "2" : "1"),
      done: (view) => allDone(troughChecklist(view)),
    },
    {
      title: "Open and rename the first stage",
      body: blocks(
        "A **stage** is a group of transfers that share pipetting settings. The Biomek may do a stage's transfers in any order, so anything that must happen first goes in an earlier stage.",
        "1. Click **New stage** (number 1) in the column on the right.\n2. Click the **✎** beside its name, change it to `Base media`, press **Save**.",
      ),
      target: (view) => stagePencilRing(view, 1),
      done: (view) => stageNameHas(view.plan, 1, "base"),
    },
    {
      title: "Put media into the plate",
      body: (view) =>
        blocks(
          "1. Type `100`: the volume for the next transfers.\n2. Click trough **1** (Base media) to choose it as the source. A dashed arrow follows your cursor.\n3. Press on plate well **B2** and drag to **D5**, then let go.",
          `One transfer goes into each well of the box: ${transfersFrom(view.plan, 1, trough(1), PLATE).length} so far.`,
          "> For a single transfer, click the source, then one destination. Only inner wells are used: outer wells dry out faster, so they usually get PBS.",
        ),
      target: () => wellTarget("Res1", "1"),
      keepClear: keepClearOf(PLATE),
      done: (view) => transfersFrom(view.plan, 1, trough(1), PLATE).length >= 12,
    },
    {
      title: "Add a Cells stage with new tips",
      body: blocks(
        "The colored box around stage 1 is a **tip group**: its stages share tips. Tips carry liquid over, so the cells get fresh tips.",
        `1. ${NEW_STAGE_HOW}\n2. Click the **✎** beside the new stage's name, call it \`Cells\`, press **Save**.`,
        "> A **+** inside a colored box adds a stage with the same tips; one on a dashed line, with new tips.",
      ),
      target: (view) => (startsNewTips(view.plan, 2) ? stagePencilRing(view, 2) : { kind: "endSeam" }),
      done: (view) => startsNewTips(view.plan, 2) && stageNameHas(view.plan, 2, "cell"),
    },
    {
      title: "Add cells to the wells",
      body: (view) =>
        blocks(
          "1. Type `50`.\n2. Click trough **2** (Cells).\n3. Drag across **B2** to **D5** again, the wells that got media.",
          `Cell transfers so far: ${transfersFrom(view.plan, 2, trough(2), PLATE).length}.`,
          "> Point at a plate well to see what it holds.",
        ),
      target: () => wellTarget("Res1", "2"),
      keepClear: keepClearOf(PLATE),
      done: (view) => transfersFrom(view.plan, 2, trough(2), PLATE).length >= 12,
    },
    {
      title: "Walk through the run",
      body: blocks(
        "The deck shows the wells as they are after the stage that's open: the card marked **Shown on deck** in the column on the right.",
        "1. Click **Start**: the plate is empty, since nothing has run yet.\n2. Click each stage in turn and watch the plate fill.\n3. Click **End**. Its count says how many tips the run loads.",
        "> ‹ and › at the top left of the deck step through the run the same way.",
      ),
      target: () => entryTarget("end"),
      done: (view) => isOpen(view, "end"),
    },
    SAVE_STEP,
    WRITE_STEP,
    {
      title: "You've planned a run",
      body: blocks(
        "On a real run, you'd take the zip to the Biomek PC:",
        `1. Unzip it into \`${BASE_FOLDER}\`.\n2. Point the general-purpose method's setup worklist at the folder's \`Setup.csv\`.\n3. Set up the deck using **Records/Labware sheet.pdf** from the zip.\n4. Run it in **simulation** first, then for real.`,
        PRACTICE_ZIP_WARNING,
        "Next: **Checking your plan**, which starts from a plan like this one.",
      ),
    },
  ],
};

// Tutorial 1, step 6's checklist: trough 1 starting with at least 5000 µL of Base media, trough 2
// with at least 2500 µL of Cells.
function troughChecklist(view) {
  return checklistOf(false, [
    [startVolume(view.plan, "Res1", "1", "Base media") >= 5000, "Trough 1: `6000` µL Base media"],
    [startVolume(view.plan, "Res1", "2", "Cells") >= 2500, "Trough 2: `3000` µL Cells"],
  ]);
}

// --- Tutorial 2: Checking your plan ---

// Stage 2's transfers from trough 2 into trough 5: the test transfer tutorial 2 adds and removes.
function testTransfers(plan) {
  return transfersFrom(plan, 2, trough(2), "Res1", "5");
}

// The total of stage 2's transfers from trough 2 into the plate, in µL.
function cellsDrawn(plan) {
  return transfersFrom(plan, 2, trough(2), PLATE).reduce((total, transfer) => total + transfer.volume, 0);
}

// Tutorial 2, step 4's N: what B2 holds at the end, plus the 300 µL transfer while stage 2 has none
// into B2, so it reads the same before and after the transfer is added.
function overfilledTotal(plan) {
  const added = transfersFrom(plan, 2, trough(2), PLATE, "B2").some((transfer) => transfer.volume === 300);
  return totalAtEnd(plan, PLATE, "B2") + (added ? 0 : 300);
}

// The ring for a step that works in an open stage's transfer list (tutorial 2, steps 3 and 8): the
// stage's entry while it isn't open; else `rowTarget` while its list is shown; else Show transfers.
function transferListRing(view, n, rowTarget) {
  const id = stageAt(view.plan, n);
  if (id === null) {
    return null;
  }
  if (!isOpen(view, id)) {
    return entryTarget(id);
  }
  return view.transferListsShown.includes(id) ? rowTarget(id) : { kind: "showTransfers", id };
}

// The ring for looking at a well at End: the well while End is open, else End's entry.
function atEndRing(view, labware, well) {
  return isOpen(view, "end") ? wellTarget(labware, well) : entryTarget("end");
}

// True if the pointed well is that well.
function pointingAt(view, labware, well) {
  return view.pointedWell !== null && view.pointedWell.labware === labware && view.pointedWell.well === well;
}

const CHECKING = {
  id: "checking",
  title: "Checking your plan",
  summary: "Read a well's contents, change volumes, catch and fix problems, and spot possible contamination.",
  minutes: 10,
  startPlan: "firstRunDone",
  steps: [
    {
      title: "Checking your plan",
      body: blocks(
        "This tutorial starts from the plan you made in **Your first run**: Base media then Cells into 12 wells.",
        "You'll see what a well holds, change a volume, meet the problems the page catches and how to fix them, and see where tips could carry one liquid into another.",
      ),
    },
    {
      title: "What a well holds",
      body: blocks(
        "Point at plate well **B2** (no click). A card shows:",
        "- each component, its volume and its share of the well;\n- its total, by adding them: here 100 µL Base media and 50 µL Cells.",
        "The card shows the well as it is after the stage marked **Shown on deck** on the right: here, Cells, the last stage. Click **Start** and point at B2 again: it's empty, because nothing has run yet.",
        "Press **Next** when you've seen it.",
      ),
      target: () => wellTarget(PLATE, "B2"),
      keepClear: keepClearOf(PLATE),
    },
    {
      title: "Enter the cell density",
      body: blocks(
        "1. Click **Start** in the column on the right.\n2. Click the small **✎** beside the **Cells** chip.\n3. Under **Contains**, click **+ Add**. The name is filled in for you.\n4. In **Amount**, type `1e6` (or `1000000`).\n5. In the unit menu, choose **cells/mL**.\n6. Press **Save**.",
        "> Then point at B2 again: under **Concentrations**, the card now gives its seeding density in cells/cm², from the well's growth area.",
      ),
      target: (view) => {
        if (!isOpen(view, START)) {
          return entryTarget(START);
        }
        return view.editingBox === null ? { kind: "componentPencil", name: "Cells" } : { kind: "editingBox" };
      },
      done: (view) => carries(view.plan, "Cells", CELL_DENSITY_UNIT),
    },
    {
      title: "Change a volume",
      body: blocks(
        "1. Click the **Base media** stage in the column on the right.\n2. Click **Show transfers ▸** in its card.\n3. Point at a row: its wells light up on the deck.\n4. Click the volume in the **Res1 1 → Culture plate B2** row, type `120`, press [Enter].",
        "> [Enter] saves and opens the next row's volume, so you can type a column of volumes. [Escape] stops. **×** removes a transfer.",
      ),
      target: (view) =>
        transferListRing(view, 1, (id) => ({
          kind: "transferVolume",
          id,
          source: trough(1),
          destination: { labware: PLATE, well: "B2" },
        })),
      done: (view) => transfersFrom(view.plan, 1, trough(1), PLATE, "B2").some((transfer) => transfer.volume === 120),
    },
    {
      title: "Overfill a well",
      body: (view) =>
        blocks(
          "The page catches volumes that won't work. Try one:",
          "1. Click the **Cells** stage in the column.\n2. Type `300`, click trough **2**, then click plate well **B2**.",
          `B2 now holds ${amount(overfilledTotal(view.plan))} µL, more than the ${amount(CAPACITY)} µL a plate well can hold. This is an **overfill**.`,
          "You'll see:",
          "- a **red ring and a red bar** on B2;\n- a **red message** at the bottom of the page;\n- **1 problem** in the count above the deck.",
        ),
      target: (view) => {
        if (view.problemCount > 0) {
          return { kind: "problemCount" };
        }
        const id = stageAt(view.plan, 2);
        return isOpen(view, id) ? wellTarget("Res1", "2") : entryTarget(id);
      },
      keepClear: keepClearOf(PLATE),
      done: (view) => view.problemCount > 0,
    },
    {
      title: "Undo it",
      body: blocks(
        "Press **Undo** (or [Ctrl]+[Z]). The count goes back to **No problems**.",
        "> Undo works for everything, including **Remove** buttons, which act without asking.",
      ),
      target: () => ({ kind: "button", name: "undo" }),
      done: (view) => view.problemCount === 0,
    },
    {
      title: "Draw into the dead volume",
      body: (view) => {
        const started = totalAfterStage(view.plan, 0, "Res1", "2");
        const used = cellsDrawn(view.plan);
        return blocks(
          `A trough keeps ${amount(DEAD)} µL the tips can't reach. Trough 2 started with ${amount(started)} µL and the cells use ${amount(used)} µL, so only ${amount(started - used - DEAD)} µL is left above the dead volume.`,
          "With the **Cells** stage open, type `500`, click trough **2**, then click the empty trough **5**.",
          "Trough 2 gets a **red ring and X**: a transfer asks for more than it can reach. Point at it to read how much is missing.",
        );
      },
      target: () => wellTarget("Res1", "2"),
      done: (view) => view.problemCount > 0 && testTransfers(view.plan).length > 0,
    },
    {
      title: "Fix it at the start",
      body: blocks(
        "This time, fix the cause instead of undoing: put more cells in the trough.",
        "1. Click **Start**.\n2. Click the **Cells** chip, type `1000`, and click trough **2**. It now starts with 4000 µL.",
        "The red marks go and the count says **No problems**.",
      ),
      target: (view) => (isOpen(view, START) ? wellTarget("Res1", "2") : entryTarget(START)),
      done: (view) => view.problemCount === 0 && startVolume(view.plan, "Res1", "2", "Cells") >= 3500,
    },
    {
      title: "Remove the test transfer",
      body: "1. Open the **Cells** stage.\n2. Click **Show transfers ▸**.\n3. Click **×** on the **Res1 2 → Res1 5** row.",
      target: (view) =>
        transferListRing(view, 2, (id) => ({
          kind: "transferRemove",
          id,
          source: trough(2),
          destination: trough(5),
        })),
      done: (view) => testTransfers(view.plan).length === 0,
    },
    {
      title: "See a possible trace",
      body: blocks(
        "Tips can carry a little of one liquid into another. The page tracks where that could happen.",
        "1. Click **End** in the column on the right.\n2. Point at trough **2** (the cells).",
        "Its card lists **Base media** under **Possible traces**. In the Cells stage, each tip dispenses into a plate well that already holds media, touching it, then goes back to trough 2 for the next draw. So the cell stock could have picked up some media.",
        "> \"Possible\" means it can't be ruled out from the plan, not that it's measured. It's not a problem, and doesn't stop the files being written.",
      ),
      target: (view) => atEndRing(view, "Res1", "2"),
      sticky: true,
      done: (view) =>
        isOpen(view, "end") &&
        pointingAt(view, "Res1", "2") &&
        tracesAtEnd(view.plan, "Res1", "2").some((name) => sameName(name, "Base media")),
    },
    {
      title: "Stop it with Non-Contact",
      body: blocks(
        "A dispense that doesn't touch the liquid carries nothing back to the tip.",
        "1. Open the **Cells** stage and click the **✎** beside its name.\n2. Under **Dispense**, set **Mode** to **Non-Contact**.\n3. Press **Save**.",
        "Then open **End** and point at trough 2 again: the Possible traces are gone.",
        "> Non-Contact dispenses from above the liquid. It can't mix, so use it where the destination doesn't need mixing.",
      ),
      target: (view) =>
        dispenseMode(view.plan, 2) === "Non-Contact" ? atEndRing(view, "Res1", "2") : stagePencilRing(view, 2),
      sticky: true,
      done: (view) =>
        dispenseMode(view.plan, 2) === "Non-Contact" &&
        isOpen(view, "end") &&
        pointingAt(view, "Res1", "2") &&
        tracesAtEnd(view.plan, "Res1", "2").length === 0,
    },
    {
      title: "Follow a well through the run",
      body: (view) =>
        blocks(
          `Click **Start**, then each stage in turn, pointing at trough **2** each time: ${amount(totalAfterStage(view.plan, 0, "Res1", "2"))} µL at Start, still ${amount(totalAfterStage(view.plan, 1, "Res1", "2"))} after Base media, ${amount(totalAfterStage(view.plan, 2, "Res1", "2"))} after Cells.`,
          "Only the end of each stage is shown, because within a stage the Biomek chooses its own order.",
          "Press **Next** when you're done.",
        ),
      target: () => entryTarget(START),
    },
    {
      title: "Your plan checks out",
      body: blocks(
        "Before writing files, check:",
        "- the count says **No problems**;\n- the stages are in the order things must happen;\n- your stocks have no possible traces you'd mind;\n- End's tip count fits the tip racks you'll load.",
        "Next: **Making conditions**, a fuller cell culture experiment.",
      ),
    },
  ],
};

// --- Tutorial 3: Making conditions ---

// The deep-well plate tutorials 3, 4 and 5 make conditions in.
const DEEP = "Deep1";

// The condition wells of tutorials 3 and 4, in order.
const CONDITION_WELLS = ["A1", "A2", "A3", "A4"];

// True if stage `n` has a transfer from `source` into Deep1 `well`.
function intoDeep(plan, n, source, well) {
  return transfersFrom(plan, n, source, DEEP, well).length > 0;
}

// The ring of a step that adds a stage with new tips at the end and sets it up in its ✎ box, then
// works on the deck (tutorial 3, steps 5 and 8): the seam above End until stage `n` starts new
// tips, its ✎ (the ring rule) until `stageReady`, then `then(view)`.
function newStageRing(view, n, stageReady, then) {
  if (!startsNewTips(view.plan, n)) {
    return { kind: "endSeam" };
  }
  return stageReady ? then(view) : stagePencilRing(view, n);
}

// Tutorial 3, step 2's checklist.
function baseMediaChecklist(view) {
  return checklistOf(true, [
    [stageNameHas(view.plan, 1, "base"), "Stage"],
    ...CONDITION_WELLS.map((well) => [intoDeep(view.plan, 1, trough(1), well), well]),
  ]);
}

// Tutorial 3, step 5's stage item: stage 3 starts new tips, is named for yeast and mixes after
// dispensing.
function yeastStageReady(plan) {
  return startsNewTips(plan, 3) && stageNameHas(plan, 3, "yeast") && mixesAfterDispensing(plan, 3);
}

// Tutorial 3, step 5's checklist.
function yeastChecklist(view) {
  return checklistOf(true, [
    [yeastStageReady(view.plan), "Stage"],
    [intoDeep(view.plan, 3, trough(3), "A3"), "A3"],
    [intoDeep(view.plan, 3, trough(3), "A4"), "A4"],
  ]);
}

// Tutorial 3's condition names, by well.
const CONDITION_NAMES_3 = { A1: "Control", A2: "Glucose", A3: "Yeast", A4: "Both" };

// A checklist of Deep1 A1 to A4 each having a well label, with its name in code.
function labelChecklist(view, names) {
  return checklistOf(
    true,
    CONDITION_WELLS.map((well) => [wellLabelText(view.plan, DEEP, well) !== "", `${well} \`${names[well]}\``]),
  );
}

// The first of Deep1 A1 to A4 without a label, or null.
function firstUnlabeled(plan) {
  return CONDITION_WELLS.find((well) => wellLabelText(plan, DEEP, well) === "") ?? null;
}

// Tutorial 3, step 7's checklist.
function swapChecklist(view) {
  return checklistOf(true, [
    [!isOut(view, "Res1"), "Res1 put away"],
    [isOut(view, PLATE), "Plate1 out"],
    [Object.hasOwn(view.plan.labwareLabels, PLATE), "Renamed"],
  ]);
}

// Tutorial 3, step 8's stage item: stage 4 starts new tips, is named for the plate and doesn't mix
// after dispensing.
function toPlateReady(plan) {
  return startsNewTips(plan, 4) && stageNameHas(plan, 4, "plate") && !mixesAfterDispensing(plan, 4);
}

// Tutorial 3, step 8's conditions: each condition well, its name and the plate column it goes to.
const TO_PLATE = [
  ["A1", "Control", 2],
  ["A2", "Glucose", 3],
  ["A3", "Yeast", 4],
  ["A4", "Both", 5],
];

// True if stage 4 has at least 3 transfers from Deep1 `well` into the plate.
function conditionPlated(plan, well) {
  return transfersFrom(plan, 4, { labware: DEEP, well }, PLATE).length >= 3;
}

// Tutorial 3, step 8's checklist.
function toPlateChecklist(view) {
  return checklistOf(false, [
    [toPlateReady(view.plan), "Stage"],
    ...TO_PLATE.map(([well, name, column]) => [
      conditionPlated(view.plan, well),
      `${name} (${well}) → B${column} to D${column}`,
    ]),
  ]);
}

// Tutorial 3, step 10's done: stage 5 starts new tips, is named for cells, aspirates Slow mixing,
// and doesn't mix after dispensing.
function gentleCellsReady(plan) {
  return (
    startsNewTips(plan, 5) &&
    stageNameHas(plan, 5, "cell") &&
    aspirateMode(plan, 5) === "Slow" &&
    mixesBeforeAspirating(plan, 5) &&
    !mixesAfterDispensing(plan, 5)
  );
}

const CONDITIONS = {
  id: "conditions",
  title: "Making conditions",
  summary: "Mix conditions from stocks, put them in a plate, add cells, and spot contamination.",
  minutes: 15,
  startPlan: "conditionStocks",
  steps: [
    {
      title: "Making conditions",
      body: blocks(
        "This tutorial plans a fuller experiment.",
        "Res1 already holds four stocks: **Base media**, **Glucose** and **Yeast extract** (each 50 g/L), and **Cells**. You'll mix four conditions in a deep-well plate, put each into three plate wells, then add cells:",
        "- **Control**: 1000 µL Base media\n- **Glucose**: 800 µL Base media + 200 µL Glucose\n- **Yeast**: 800 µL Base media + 200 µL Yeast extract\n- **Both**: 800 µL Base media + 100 µL of each",
      ),
    },
    {
      title: "Bring out a deep-well plate",
      body: blocks(
        "1. Click **Deep1** in the tray, a 96 deep-well plate.\n2. Click its bold name and rename it `Conditions`.",
        "> Point at a Res1 trough to see what it holds, such as Glucose at 50 g/L.",
      ),
      target: (view) => (isOut(view, DEEP) ? { kind: "labwareHeading", labware: DEEP } : chipTarget(DEEP)),
      done: (view) => isOut(view, DEEP) && Object.hasOwn(view.plan.labwareLabels, DEEP),
    },
    {
      title: "Put base media into the conditions",
      body: "1. Open stage 1 and rename it `Base media` with its **✎**.\n2. Type `1000`, click trough **1**, then click well **A1** of Conditions.\n3. Type `800`, click trough **1**, then drag across **A2** to **A4**.",
      checklist: baseMediaChecklist,
      target: (view) => (stageNameHas(view.plan, 1, "base") ? wellTarget("Res1", "1") : stagePencilRing(view, 1)),
      done: (view) => allDone(baseMediaChecklist(view)),
    },
    {
      title: "A stage that mixes",
      body: blocks(
        `1. ${NEW_STAGE_HOW} New tips, since this is a different stock.\n2. In its **✎** box, name it \`Glucose\`.\n3. Under **Dispense**, tick **Mix**, to blend the glucose into the media.\n4. Press **Save**.`,
        `> The mixed wells will get a **yellow ⟳**: a ${TIP} tip mixes at most ${amount(MIX_LIMIT)} µL, only part of a 1000 µL well. That's a warning, not a problem; a larger tip type, chosen with the ✎ on the tip heading, would mix more.`,
      ),
      target: (view) => (startsNewTips(view.plan, 2) ? stagePencilRing(view, 2) : { kind: "endSeam" }),
      done: (view) =>
        startsNewTips(view.plan, 2) && stageNameHas(view.plan, 2, "gluc") && mixesAfterDispensing(view.plan, 2),
    },
    {
      title: "Add the glucose",
      body: "1. Type `200`, click trough **2** (Glucose), then click **A2**.\n2. Type `100`, click trough **2**, then click **A4**.",
      checklist: (view) =>
        checklistOf(true, [
          [intoDeep(view.plan, 2, trough(2), "A2"), "A2"],
          [intoDeep(view.plan, 2, trough(2), "A4"), "A4"],
        ]),
      target: () => wellTarget("Res1", "2"),
      done: (view) => intoDeep(view.plan, 2, trough(2), "A2") && intoDeep(view.plan, 2, trough(2), "A4"),
    },
    {
      title: "Now yeast extract, on your own",
      body: "1. Add a stage with new tips above **End** and name it `Yeast extract`. **Mix** under **Dispense** is already ticked: a new stage copies the settings of the stage before it. Press **Save**.\n2. `200` µL from trough **3** into **A3**.\n3. `100` µL from trough **3** into **A4**.",
      checklist: yeastChecklist,
      target: (view) => newStageRing(view, 3, yeastStageReady(view.plan), () => wellTarget("Res1", "3")),
      done: (view) => allDone(yeastChecklist(view)),
    },
    {
      title: "Name the conditions",
      body: blocks(
        "Well names help you find things. **Right-click** a well, type a name and press [Enter], for each well below. Then point at **A4**: its card shows its name, what it holds, and glucose and yeast extract at 5 g/L each.",
        "> Names show in place of volumes; the **Names** button switches back. The Biomek never sees them.",
      ),
      checklist: (view) => labelChecklist(view, CONDITION_NAMES_3),
      target: (view) => wellTarget(DEEP, firstUnlabeled(view.plan) ?? "A4"),
      done: (view) => firstUnlabeled(view.plan) === null,
    },
    {
      title: "Swap the stocks for the culture plate",
      body: blocks(
        "The stocks aren't needed for the next stage, so put them away to make room.",
        "1. Click **Res1** in the tray to put it away.\n2. Click **Plate1** to bring out a 96-well culture plate.\n3. Click its bold name and rename it `Culture plate`.",
        "> Putting labware away only hides it here. It's still part of the plan and the run.",
      ),
      checklist: swapChecklist,
      target: (view) => {
        if (isOut(view, "Res1")) {
          return chipTarget("Res1");
        }
        return isOut(view, PLATE) ? { kind: "labwareHeading", labware: PLATE } : chipTarget(PLATE);
      },
      done: (view) => allDone(swapChecklist(view)),
    },
    {
      title: "Put each condition into the plate",
      body: "1. Add a stage with new tips above **End**. In its **✎** box, name it `To plate` and **untick Mix** under **Dispense**: a new stage copies the settings of the one before it. Press **Save**.\n2. Type `100`.\n3. For each condition, click it on Conditions, then drag down its column on the plate:",
      checklist: toPlateChecklist,
      target: (view) =>
        newStageRing(view, 4, toPlateReady(view.plan), () => {
          const next = TO_PLATE.find(([well]) => !conditionPlated(view.plan, well));
          return next === undefined ? null : wellTarget(DEEP, next[0]);
        }),
      keepClear: keepClearOf(PLATE, DEEP),
      done: (view) => allDone(toPlateChecklist(view)),
    },
    {
      title: "Bring the stocks back",
      body: blocks(
        "The cells are in Res1, and the conditions are done with.",
        "1. Click **Res1** in the tray to bring it back.\n2. Click **Conditions** in the tray to put it away.",
        "> While a stage is open, an arrow from labware that's put away ends at its chip in the tray.",
      ),
      target: (view) => chipTarget(isOut(view, "Res1") ? DEEP : "Res1"),
      done: (view) => isOut(view, "Res1") && !isOut(view, DEEP),
    },
    {
      title: "Gentle pipetting for cells",
      body: blocks(
        "Cells settle in the trough and don't like being pushed hard, so this stage draws slowly and mixes the trough before each draw.",
        "1. Add a stage with new tips above **End**, and name it `Cells`.\n2. Under **Aspirate**, set **Mode** to **Slow** and tick **Mix**.\n3. Press **Save**.",
        `The card then reads \`↑ Slow ⟳   ↓ ${MODE}\`: ↑ aspirate, ↓ dispense, ⟳ mixes.`,
        "> **Mode** sets how fast the tip draws and expels liquid. Non-Contact dispenses from above without touching the liquid, and can't mix.",
      ),
      target: (view) => (startsNewTips(view.plan, 5) ? stagePencilRing(view, 5) : { kind: "endSeam" }),
      done: (view) => gentleCellsReady(view.plan),
    },
    {
      title: "Add cells to the wells",
      body: (view) =>
        blocks(
          "1. Type `50`.\n2. Click trough **4** (Cells).\n3. Drag across plate wells **B2** to **D5**: all 12 at once.",
          `Cell transfers so far: ${transfersFrom(view.plan, 5, trough(4), PLATE).length}.`,
          "Then point at **B3**: glucose at about 6.7 g/L, and the seeding density in cells/cm².",
          "> For wells that aren't in one block, hold [Ctrl] and click each one: the source stays chosen until you press [Escape].",
        ),
      target: () => wellTarget("Res1", "4"),
      keepClear: keepClearOf(PLATE),
      done: (view) => transfersFrom(view.plan, 5, trough(4), PLATE).length >= 12,
    },
    {
      title: "Choose the tips",
      body: blocks(
        `Each tip group's heading says what tips it loads, like \`New tips · ${TIP} · ${PROBES} tips\`.`,
        "1. Click the **✎** on the Cells stage's tip heading.\n2. Under **Probes**, click **8**.\n3. Press **Save**.",
        "> More probes run faster but use more tips. **Tip type** sets the tips' size; a transfer bigger than a tip holds is split into trips for you.",
      ),
      target: (view) =>
        view.editingBox === null ? { kind: "tipPencil", key: stageAt(view.plan, 5) } : { kind: "editingBox" },
      done: (view) => tipProbes(view.plan, 5) === 8,
    },
    {
      title: "Walk through the run",
      body: "1. Bring out **Conditions** again, so you can see all three labware.\n2. Click **Start**, then each stage in turn, pointing at a few wells: the deck shows them after the stage marked **Shown on deck**.\n3. Finish on **End**, and check the count says **No problems**.",
      target: (view) => (isOut(view, DEEP) ? entryTarget("end") : chipTarget(DEEP)),
      done: (view) => isOpen(view, "end") && view.problemCount === 0,
    },
    {
      title: "Spot contamination in the Control",
      body: blocks(
        "With **End** open, point at **B2** on the culture plate: one of the Control wells. Under **Possible traces** it lists **Glucose** and **Yeast extract**, though the Control was made without them. Two things could have carried them there:",
        "1. **To plate** used the same tips for all four conditions. Within a stage the Biomek can go in any order, so a tip that just drew from the Glucose well could draw from the Control next.\n2. **Cells** dispenses into wells holding the conditions, touching them, then goes back to the cell trough. Point at trough 4: the cell stock could have picked up all three.",
        "> To avoid it in a real run, give each condition its own stage, each starting on new tips, and dispense the cells **Non-Contact**, as in **Checking your plan**.",
      ),
      target: (view) => atEndRing(view, PLATE, "B2"),
      keepClear: keepClearOf(PLATE),
      sticky: true,
      done: (view) =>
        isOpen(view, "end") && pointingAt(view, PLATE, "B2") && tracesAtEnd(view.plan, PLATE, "B2").length > 0,
    },
    WRITE_STEP,
    {
      title: "You've made the conditions",
      body: blocks(
        "You can now plan runs with several stages, mixing, tip choices and conditions.",
        "Next: **Transfer tables**, which build conditions like these from one pasted table.",
        PRACTICE_ZIP_WARNING,
      ),
    },
  ],
};

// --- Tutorial 4: Transfer tables ---

// Tutorial 4's rows: well label, well, then µL of Base media, Glucose and Yeast extract ("" adds
// nothing).
const TABLE_ROWS = [
  ["Control", "A1", "1000", "", ""],
  ["With glucose", "A2", "800", "200", ""],
  ["With yeast", "A3", "800", "", "200"],
  ["Both", "A4", "800", "100", "100"],
];

// The practice table's header.
const TABLE_HEADER = ["Well name", "Base media", "Glucose", "Yeast extract"];

// The practice table's rows of cells, the header first.
const PRACTICE_ROWS = [TABLE_HEADER, ...TABLE_ROWS.map(([label, , ...amounts]) => [label, ...amounts])];

// The practice table as Excel copies a table: a tab between cells and a line break between rows.
export const PRACTICE_TABLE_TEXT = PRACTICE_ROWS.map((row) => row.join("\t")).join("\n");

// The practice table as step markup: one table row per line, cells between "|"s.
const PRACTICE_TABLE_MARKUP = PRACTICE_ROWS.map((row) => `| ${row.join(" | ")} |`).join("\n");

// Tutorial 4's well names, by well.
const CONDITION_NAMES_4 = Object.fromEntries(TABLE_ROWS.map(([label, well]) => [well, label]));

// The plan's first transfer table, or null.
function firstTable(plan) {
  return plan.transferTables[0] ?? null;
}

// The number (from 1) of the first transfer table's stage for `component`, or null.
function tableStageNumber(plan, component) {
  const table = firstTable(plan);
  const owned = table?.stages.find((entry) => sameName(entry.component, component));
  if (owned === undefined) {
    return null;
  }
  return stageOrder(plan).indexOf(owned.stage) + 1;
}

// The volume of the first transfer table's stage for `component`'s transfer into Deep1 A4, or null.
function tableVolumeIntoA4(plan, component) {
  const n = tableStageNumber(plan, component);
  if (n === null) {
    return null;
  }
  const transfer = transfersIn(plan, stageAt(plan, n)).find(
    (candidate) => candidate.destination.labware === DEEP && candidate.destination.well === "A4",
  );
  return transfer === undefined ? null : transfer.volume;
}

// Tutorial 4, step 5's checklist.
function strongerChecklist(view) {
  return checklistOf(
    true,
    [
      ["Base media", 700],
      ["Glucose", 150],
      ["Yeast extract", 150],
    ].map(([component, volume]) => [tableVolumeIntoA4(view.plan, component) === volume, `${component} ${volume}`]),
  );
}

// The number of the stage whose name contains "gluc", or null.
function glucoseStageNumber(plan) {
  const place = stageOrder(plan).findIndex((id) => normal(plan.stageList.get(id).name).includes("gluc"));
  return place === -1 ? null : place + 1;
}

const TRANSFER_TABLES = {
  id: "transfer-tables",
  title: "Transfer tables",
  summary: "Build conditions from one table pasted from Excel, and change them by editing the table.",
  minutes: 10,
  startPlan: "tableStocks",
  steps: [
    {
      title: "Transfer tables",
      body: blocks(
        "In **Making conditions** you built the conditions transfer by transfer. A **transfer table** builds them all from one table you paste from Excel.",
        "Res1 already holds **Base media**, **Glucose** and **Yeast extract**. You'll make the same four conditions as before, in a deep-well plate.",
      ),
    },
    {
      title: "Name the wells to fill",
      body: blocks(
        "A transfer table finds its wells by their names, so name them first.",
        "1. Click **Deep1** in the tray to bring it out.\n2. **Right-click** each well, type its name and press [Enter], for each name below.",
        "> Give conditions names that differ from the stocks' names, so a table can't mistake one for the other, and start them with a letter: Excel reads a cell starting with + or = as a formula. Several wells can share a name, such as three replicates all called `With glucose`: each gets the amounts in that name's row.",
      ),
      checklist: (view) => labelChecklist(view, CONDITION_NAMES_4),
      target: (view) => (isOut(view, DEEP) ? wellTarget(DEEP, firstUnlabeled(view.plan) ?? "A1") : chipTarget(DEEP)),
      done: (view) => firstUnlabeled(view.plan) === null,
    },
    {
      title: "Paste the table",
      body: blocks(
        "In Excel, a transfer table has a row per well name and a column per stock. Each cell is the µL to add. Here's one to practice with:",
        PRACTICE_TABLE_MARKUP,
        "1. Press **Copy this table**, below, to put it on the clipboard.\n2. Point at the gap just above **End**. On the dashed line, click the **table** button, the one furthest right.\n3. Click the paste box and press [Ctrl]+[V].",
        "> A blank cell, or 0, adds nothing.",
      ),
      copy: { label: "Copy this table", text: PRACTICE_TABLE_TEXT },
      target: (view) => {
        return view.dialog !== null && view.dialog.kind === "wizard" ? { kind: "dialog" } : { kind: "endSeam" };
      },
      done: (view) =>
        (view.dialog !== null && view.dialog.kind === "wizard" && view.dialog.hasTable) ||
        firstTable(view.plan) !== null,
    },
    {
      title: "Check, choose sources, add",
      body: blocks(
        "The wizard has three steps, shown as pills at its top.",
        "1. **Table**: the grid can be edited. Any problem shows in red. Press **Next**.\n2. **Sources**: where each stock is drawn from. The page found each one in Res1. Add a second well if one can't hold enough. Press **Next**.\n3. **Review**: one stage per stock, each on new tips. Press **Add**.",
      ),
      target: () => ({ kind: "dialogMain" }),
      done: (view) => firstTable(view.plan) !== null,
    },
    {
      title: "What it made",
      body: blocks(
        "In the column on the right, the transfer table is a box of its own: one stage per stock, each starting on new tips, as the Review promised.",
        "1. Click its heading to open or close the box.\n2. Open the **Glucose** stage: its transfers go to the wells named **With glucose** and **Both**.\n3. Click **End** and point at well **A4** (Both): 800 µL Base media, and 5 g/L of each supplement.",
        "> Stage 1, **New stage**, is still empty. An empty stage loads no tips, so it can stay, or go with **Remove** in its ✎ box.",
        "> A table's transfers can't be changed on the deck: the table is the one place they come from. That's the next step.",
        "Press **Next** when you've looked.",
      ),
      target: (view) => atEndRing(view, DEEP, "A4"),
    },
    {
      title: "Change amounts in the table",
      body: blocks(
        "Make **Both** stronger: 700 µL Base media and 150 µL of each supplement.",
        "1. Click the **✎** on the transfer table's heading. The wizard opens at Review.\n2. Click the **1 Table** pill at its top.\n3. In the **Both** row, click a cell, type the new amount and press [Enter].\n4. Press **Next**, **Next**, then **Update**.",
        "> The wizard takes one paste. To use a changed Excel sheet instead, remove this table (**Remove** in its wizard) and paste the sheet into a new transfer table.",
      ),
      checklist: strongerChecklist,
      target: (view) => {
        if (view.dialog !== null && view.dialog.kind === "wizard") {
          return { kind: "dialogMain" };
        }
        const table = firstTable(view.plan);
        return table === null ? null : { kind: "tablePencil", id: table.id };
      },
      done: (view) => allDone(strongerChecklist(view)),
    },
    {
      title: "Pipetting on a table's stages",
      body: blocks(
        "A table's stages take pipetting settings like any other.",
        "1. Open the **Glucose** stage and click the **✎** beside its name.\n2. Under **Dispense**, tick **Mix**. (Its name stays the stock's; that's set by the table.)\n3. Press **Save**.",
        "> The tip heading's ✎ sets each stage's tip type and probes, as in **Making conditions**.",
      ),
      target: (view) => {
        const n = glucoseStageNumber(view.plan);
        return n === null ? null : stagePencilRing(view, n);
      },
      done: (view) => {
        const n = glucoseStageNumber(view.plan);
        return n !== null && mixesAfterDispensing(view.plan, n);
      },
    },
    {
      title: "That's a transfer table",
      body: blocks(
        "The same kind of table works for any number of conditions and stocks: one row per well name, one column per stock.",
        "Next: **Randomizing a plate**.",
        "> A column can also be named after a well name rather than a stock, to draw from the wells with that name. That's useful for a premix made earlier in the run.",
      ),
    },
  ],
};

// --- Tutorial 5: Randomizing a plate ---

// The condition names tutorial 5's randomization takes as sources.
const RANDOMIZED_CONDITIONS = ["Control", "With glucose", "With yeast", "Both"];

// The plan's first randomization, or null.
function firstRandomization(plan) {
  return plan.randomizations[0] ?? null;
}

// True if the plan's first randomization has run (it owns stages).
function hasRun(plan) {
  const randomization = firstRandomization(plan);
  return randomization !== null && randomization.stages.length > 0;
}

// The open card's sources that take replicates (not fillers); [] with no card open.
function replicateSources(view) {
  return view.randomizationCard === null ? [] : view.randomizationCard.sources.filter((source) => !source.filler);
}

// The open card's source whose name contains PBS, or undefined.
function pbsSource(view) {
  return view.randomizationCard?.sources.find((source) => normal(source.name).includes("pbs"));
}

// Tutorial 5, step 1's checklist.
function addRandomizationChecklist(view) {
  const randomization = firstRandomization(view.plan);
  return checklistOf(true, [
    [isOut(view, PLATE), "Plate1 out"],
    [randomization !== null, "Randomization"],
    [randomization !== null && sameName(randomization.name, "Layout"), "Named"],
  ]);
}

// Tutorial 5, step 2's checklist.
function sourcesChecklist(view) {
  const takers = replicateSources(view);
  const conditionsPicked = RANDOMIZED_CONDITIONS.every((name) => takers.some((source) => sameName(source.name, name)));
  return checklistOf(true, [
    [conditionsPicked, "4 conditions"],
    [pbsSource(view)?.filler === true, "PBS as filler"],
  ]);
}

// Tutorial 5, step 3's checklist.
function replicatesChecklist(view) {
  const takers = replicateSources(view);
  return checklistOf(true, [
    [takers.length >= 4 && takers.every((source) => source.replicatesText.trim() === "12"), "12 each"],
  ]);
}

// The keep-clear list of tutorial 5's card steps: the open card, so its sources stay in view.
function keepClearOfCard() {
  return [{ kind: "card", part: "whole" }];
}

// The ring while the randomization's card isn't open: its ✎, or null with no randomization.
function randomizationPencilRing(view) {
  const randomization = firstRandomization(view.plan);
  return randomization === null ? null : { kind: "randomizationPencil", id: randomization.id };
}

// True if the plan has at least 60 transfers of 100 µL into the plate.
function plateRandomized(plan) {
  return (
    plan.operationList
      .listOperations()
      .filter((operation) => operation.destination.labware === PLATE && operation.volume === 100).length >= 60
  );
}

// Tutorial 5, step 7's checklist item: the seed is 37 and it has run.
function reseeded(plan) {
  return firstRandomization(plan)?.seed === 37 && hasRun(plan);
}

const RANDOMIZING = {
  id: "randomizing",
  title: "Randomizing a plate",
  summary: "Place conditions in random wells with replicates and a filler, and keep the well map.",
  minutes: 10,
  startPlan: "conditionMedia",
  steps: [
    {
      title: "Randomizing a plate",
      body: blocks(
        "Plate position can bias results: edge wells dry faster, and a gradient across the deck can follow the layout. A **randomization** places each condition in random wells, and records where.",
        "Deep1, named Conditions, already holds four condition media, and Res1 trough 1 holds PBS. You'll put 12 replicates of each condition in random inner wells of a plate, with PBS in the 12 left over.",
      ),
    },
    {
      title: "Add a randomization",
      body: "1. Click **Plate1** in the tray to bring out a culture plate.\n2. Point at the gap just above **End**. On the dashed line, click the **dice** button.\n3. Its card opens in the column. In **Name**, type `Layout` and press [Enter]. The name labels its well map.",
      checklist: addRandomizationChecklist,
      target: (view) => {
        if (!isOut(view, PLATE)) {
          return chipTarget(PLATE);
        }
        return firstRandomization(view.plan) === null ? { kind: "endSeam" } : { kind: "card", part: "name" };
      },
      done: (view) => allDone(addRandomizationChecklist(view)),
    },
    {
      title: "Pick the sources",
      body: blocks(
        "The card's **Sources** tab is open, so clicks on the deck pick sources.",
        "1. Drag across Conditions **A1** to **A4**: the four conditions.\n2. Click Res1 trough **1** (PBS).\n3. In PBS's row, press **Filler**. A filler fills whatever wells the replicates leave over.",
        "> Click a source again to take it out.",
      ),
      checklist: sourcesChecklist,
      target: (view) => {
        if (view.randomizationCard === null) {
          return randomizationPencilRing(view);
        }
        if (replicateSources(view).filter((source) => !normal(source.name).includes("pbs")).length < 4) {
          return wellTarget(DEEP, "A1");
        }
        if (pbsSource(view) === undefined) {
          return wellTarget("Res1", "1");
        }
        return { kind: "cardFiller", name: pbsSource(view).name };
      },
      keepClear: keepClearOfCard,
      done: (view) => view.randomizationCard !== null && allDone(sourcesChecklist(view)),
    },
    {
      title: "Set the replicates",
      body: blocks(
        "Each condition gets 12 replicate wells.",
        "In the **All sources** box at the top of the list, type `12`. Every condition's box follows.",
        "> Each condition's own box can be set separately, for different replicate counts.",
      ),
      checklist: replicatesChecklist,
      target: () => ({ kind: "card", part: "allReplicates" }),
      keepClear: keepClearOfCard,
      done: (view) => view.randomizationCard !== null && allDone(replicatesChecklist(view)),
    },
    {
      title: "Pick the wells to fill",
      body: blocks(
        "1. Click the card's **Wells to fill** tab. Clicks on the deck now pick wells to fill.\n2. Drag across the plate from **B2** to **G11**: the 60 inner wells.",
        "> 4 conditions × 12 replicates is 48 wells, so PBS fills the other 12. Its row in Sources says so.",
      ),
      checklist: (view) => checklistOf(true, [[view.randomizationCard?.fillCount === 60, "60 wells"]]),
      target: (view) => {
        if (view.randomizationCard === null) {
          return randomizationPencilRing(view);
        }
        return view.randomizationCard.tab === "fill" ? wellTarget(PLATE, "B2") : { kind: "card", part: "tabFill" };
      },
      keepClear: () => [...keepClearOf(PLATE)(), ...keepClearOfCard()],
      done: (view) => view.randomizationCard !== null && view.randomizationCard.fillCount === 60,
    },
    {
      title: "Volume, seed, randomize",
      body: blocks(
        "1. In **Volume**, type `100`: the µL each well gets.\n2. Leave **Seed** as it is. It's a random number that fixes the layout: the same seed gives the same wells.\n3. Press **Randomize**.",
        "> **Each transfer** and **Tips** set the pipetting, as a stage's ✎ box does.",
      ),
      target: (view) =>
        view.randomizationCard !== null && view.randomizationCard.volumeText.trim() !== "100"
          ? { kind: "card", part: "volume" }
          : { kind: "card", part: "run" },
      done: (view) => hasRun(view.plan) && plateRandomized(view.plan),
    },
    {
      title: "Look at the layout",
      body: blocks(
        "The randomization made one stage per condition, plus one for the filler, each on new tips.",
        "1. Click **End**: the plate shows the four conditions' colors scattered across the inner wells.\n2. Point at a few wells to see which condition each got.\n3. Click the randomization's heading to show or hide its stages.",
        "> Its stages' transfers can't be changed by hand: the card is the one place they come from.",
        "Press **Next** when you've looked.",
      ),
      target: (view) => atEndRing(view, PLATE, "B2"),
      keepClear: keepClearOf(PLATE),
    },
    {
      title: "Reshuffle with a new seed",
      body: blocks(
        "1. Click the **✎** on the randomization's heading.\n2. Change **Seed** to `37`.\n3. Press **Update**. Watch the layout change.",
        "> If the plan changes in a way that affects the randomization, its heading says **needs update** in red. Open it and press **Update**.",
      ),
      checklist: (view) => checklistOf(true, [[reseeded(view.plan), "Seed 37"]]),
      target: (view) => {
        if (view.randomizationCard === null) {
          return randomizationPencilRing(view);
        }
        return view.randomizationCard.seedText.trim() === "37" ? { kind: "card", part: "run" } : { kind: "card", part: "seed" };
      },
      done: (view) => reseeded(view.plan) && view.randomizationCard === null,
    },
    {
      title: "Write the files and the well map",
      body: blocks(
        "1. Press **Biomek files**. The box says the zip includes **1 well map**.\n2. Press **Write files** and save the zip.",
        "In the zip's **Records** folder, `Layout well map.csv` lists which condition went into which well. Keep it with your data: it's the key to the plate.",
      ),
      target: writeTarget,
      done: zipSaved,
    },
    {
      title: "That's a randomized plate",
      body: blocks(
        "The same seed and the same list of sources always give the same layout, so a plate can be remade exactly.",
        "> More in the card: sources can **share tips** (drag a row, or the tip button between boxes), and a row's **⠿** grip changes the order. A new order reshuffles, even with the same seed.",
      ),
    },
  ],
};

// --- The tutorials ---

// Freezes a tutorial, its steps and its list of steps, so no caller can change them.
function frozenTutorial(tutorial) {
  return Object.freeze({ ...tutorial, steps: Object.freeze(tutorial.steps.map((step) => Object.freeze({ ...step }))) });
}

// The five tutorials, in menu order (tutorial.md, section 6).
export const TUTORIALS = Object.freeze(
  [FIRST_RUN, CHECKING, CONDITIONS, TRANSFER_TABLES, RANDOMIZING].map(frozenTutorial),
);

// The tutorial with that ID, or null, e.g. tutorialById("checking").title → "Checking your plan".
export function tutorialById(id) {
  return TUTORIALS.find((tutorial) => tutorial.id === id) ?? null;
}
