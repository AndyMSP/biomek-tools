// Unit tests for labware-sheet.js. Each test comes from the "Test cases" section of
// labware-sheet.md, and each row of its error table has one. Plans are built with the transfer
// designer's own edits, and labware names, types and positions are worked out from config/
// (CLAUDE.md, "Tests follow config/").

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  RECORDS_FOLDER,
  LABWARE_SHEET_FILE_NAME,
  LABWARE_SHEET_PAGE,
} from "../../../config/records.js";
import { DECK } from "../../../config/deck.js";
import { labwareNames, gridOf } from "../../shared/deck/deck.js";
import { TIP_TYPES } from "../../../config/tip-types.js";
import { writePdf, textWidth } from "../../shared/pdf/pdf.js";
import {
  emptyPlan,
  setExperimentName,
  addComponent,
  addToWells,
  addTransfer,
  setLabel,
  setWellLabel,
  tipsUsed,
} from "./transfer-designer.js";
import { labwareSheetContent, labwareSheetPages, labwareSheet } from "./labware-sheet.js";

// The folder name and moment most tests use.
const FOLDER = "2026-11-08_134118_Exp36-feeding";
const MADE = new Date(2026, 10, 8, 13, 41, 18);

// The page's margin and the label column's widest text (labware-sheet.md, section 3).
const MARGIN = 54;
const MAX_LABEL_WIDTH = 122;

// The labware table's column starts, and the inset of each cell's text.
const LABWARE_COLUMNS = [54, 184, 294, 424];
const CELL_INSET = 4;

// --- Labware picked from config/deck.js, never named ---

// The first well of the labware called `name`, e.g. "A1" on a plate or "1" on a reservoir.
function firstWellOf(name) {
  return gridOf(name).wellNames()[0];
}

// The labware with a numbered grid (reservoirs) and with a lettered one (plates), in deck order.
const RESERVOIRS = labwareNames().filter((name) => firstWellOf(name) === "1");
const PLATES = labwareNames().filter((name) => firstWellOf(name) !== "1");

// The picks the tests use: the first reservoir and the first three plates.
const RESERVOIR = RESERVOIRS[0];
const [PLATE_A, PLATE_B, PLATE_C] = PLATES;

// `names` in the deck's order.
function inDeckOrder(names) {
  return labwareNames().filter((name) => names.includes(name));
}

// --- Helpers for the tests ---

// A transfer of `volume` µL from `source` to `destination` (each [labware, well]) in `stage`.
function transfer(source, destination, stage, volume = 100) {
  return {
    type: "transfer",
    source: { labware: source[0], well: source[1] },
    destination: { labware: destination[0], well: destination[1] },
    volume,
    stage,
  };
}

// The labware type of the labware called `name` in config/deck.js.
function typeOf(name) {
  return DECK.find((labware) => labware.name === name).labwareType;
}

// The plan of labware-sheet.md, section 6, named Exp36-feeding: Media in the reservoir's first
// well, a transfer from it into PLATE_A's first well, a well label on PLATE_B, and labels "Res A" on
// the reservoir and "Feeding DWP" on PLATE_A.
function examplePlan() {
  const { plan: empty, stageId } = emptyPlan();
  let plan = setExperimentName(empty, "Exp36-feeding");
  plan = addComponent(plan, "Media", "#4e79a7");
  plan = addToWells(plan, [{ labware: RESERVOIR, well: firstWellOf(RESERVOIR) }], "Media", 10000);
  plan = addTransfer(
    plan,
    transfer([RESERVOIR, firstWellOf(RESERVOIR)], [PLATE_A, firstWellOf(PLATE_A)], stageId),
  );
  plan = setWellLabel(plan, { labware: PLATE_B, well: firstWellOf(PLATE_B) }, "Cond 1");
  plan = setLabel(plan, RESERVOIR, "Res A");
  plan = setLabel(plan, PLATE_A, "Feeding DWP");
  return plan;
}

// The labware entry a labware gets with no starting contents and no label.
function emptyEntry(name, label = name) {
  return { label, name, labwareType: typeOf(name), beforeRun: "Starts empty" };
}

// Content for labwareSheetPages, with any parts replaced by `changes`.
function contentWith(changes = {}) {
  return {
    experimentName: "Exp36-feeding",
    zipName: `${FOLDER}.zip`,
    made: "2026-11-08 13:41",
    labware: [emptyEntry(PLATE_A, "Feeding DWP")],
    unused: [],
    tips: [{ tipType: TIP_TYPES[0], count: 8 }],
    ...changes,
  };
}

// The items of the one page labwareSheetPages gives for `content`.
function itemsOf(content) {
  return labwareSheetPages(content)[0].items;
}

// The text items whose text is `text`.
function textItems(items, text) {
  return items.filter((item) => item.kind === "text" && item.text === text);
}

// The one text item whose text is `text`.
function textItem(items, text) {
  const found = textItems(items, text);
  assert.equal(found.length, 1, `expected one text item "${text}", found ${found.length}`);
  return found[0];
}

// The lowest y any item reaches.
function lowestY(items) {
  return Math.min(
    ...items.map((item) => (item.kind === "line" ? Math.min(item.y1, item.y2) : item.y)),
  );
}

// Asserts that `call` throws exactly `message`.
function assertThrowsMessage(call, message) {
  assert.throws(call, (error) => {
    assert.equal(error.message, message);
    return true;
  });
}

describe("labware-sheet", () => {
  // --- The content ---

  test("lists the labware the plan uses in the deck's order, with labels, types and fill", () => {
    const content = labwareSheetContent(examplePlan(), FOLDER, MADE);
    const entries = {
      [PLATE_A]: emptyEntry(PLATE_A, "Feeding DWP"),
      [PLATE_B]: emptyEntry(PLATE_B),
      [RESERVOIR]: { label: "Res A", name: RESERVOIR, labwareType: typeOf(RESERVOIR), beforeRun: "Fill first" },
    };
    const used = inDeckOrder([PLATE_A, PLATE_B, RESERVOIR]);
    assert.deepEqual(content.labware, used.map((name) => entries[name]));
    assert.deepEqual(
      content.unused,
      DECK.map((labware) => labware.name).filter((name) => !used.includes(name)),
    );
  });

  test("a labware with only a labware label isn't listed", () => {
    const plan = setLabel(examplePlan(), PLATE_C, "Spare plate");
    const content = labwareSheetContent(plan, FOLDER, MADE);
    assert.ok(!content.labware.some((entry) => entry.name === PLATE_C));
    assert.ok(content.unused.includes(PLATE_C));
  });

  test("names the zip, the plan and when the sheet was made", () => {
    const plan = setExperimentName(emptyPlan().plan, "Exp36-feeding");
    const content = labwareSheetContent(plan, FOLDER, new Date(2026, 10, 8, 9, 5, 7));
    assert.equal(content.zipName, `${FOLDER}.zip`);
    assert.equal(content.made, "2026-11-08 09:05");
    assert.equal(content.experimentName, "Exp36-feeding");
  });

  test("tips are tipsUsed's, and a plan without transfers has none", () => {
    const plan = examplePlan();
    assert.deepEqual(labwareSheetContent(plan, FOLDER, MADE).tips, tipsUsed(plan));
    assert.deepEqual(labwareSheetContent(emptyPlan().plan, FOLDER, MADE).tips, []);
  });

  test("a label with a character the PDF can't show gets ? in its place", () => {
    const plan = setLabel(examplePlan(), PLATE_A, "Drug → plate");
    const content = labwareSheetContent(plan, FOLDER, MADE);
    assert.equal(content.labware.find((entry) => entry.name === PLATE_A).label, "Drug ? plate");
    assert.equal(labwareSheetContent(plan, "Run→1", MADE).zipName, "Run?1.zip");
  });

  test("the plan is unchanged afterwards, and each call gives a new object", () => {
    const plan = examplePlan();
    // JSON.stringify writes the operation list as {}, so its transfers are compared separately.
    const before = JSON.stringify(plan);
    const transfersBefore = JSON.stringify(plan.operationList.listOperations());
    const first = labwareSheetContent(plan, FOLDER, MADE);
    labwareSheet(plan, FOLDER, MADE);
    assert.equal(JSON.stringify(plan), before);
    assert.equal(JSON.stringify(plan.operationList.listOperations()), transfersBefore);
    assert.notEqual(labwareSheetContent(plan, FOLDER, MADE), first);
  });

  // --- The layout ---

  test("the page is LABWARE_SHEET_PAGE's size", () => {
    const pages = labwareSheetPages(contentWith());
    assert.equal(pages.length, 1);
    assert.equal(pages[0].width, LABWARE_SHEET_PAGE.width);
    assert.equal(pages[0].height, LABWARE_SHEET_PAGE.height);
  });

  test("the title, plan, files and made lines are where section 3 puts them", () => {
    const items = itemsOf(contentWith());
    const top = LABWARE_SHEET_PAGE.height - MARGIN;
    assert.deepEqual(textItem(items, "Labware sheet"), {
      kind: "text", x: MARGIN, y: top, text: "Labware sheet", size: 18, bold: true,
    });
    assert.deepEqual(textItem(items, "Plan: Exp36-feeding"), {
      kind: "text", x: MARGIN, y: top - 22, text: "Plan: Exp36-feeding", size: 10, bold: false,
    });
    assert.equal(textItem(items, "Files:").y, top - 36);
    assert.deepEqual(textItem(items, `${FOLDER}.zip`), {
      kind: "text",
      x: MARGIN + textWidth("Files: ", 10, false),
      y: top - 36,
      text: `${FOLDER}.zip`,
      size: 10,
      bold: true,
    });
    assert.equal(textItem(items, "Sheet made: 2026-11-08 13:41").y, top - 50);
    assert.deepEqual(textItem(items, "Labware"), {
      kind: "text", x: MARGIN, y: top - 78, text: "Labware", size: 13, bold: true,
    });
  });

  test("the labware table: its heading band, then rows 18 points apart, each with its line", () => {
    const labware = [emptyEntry(PLATE_A, "Feeding DWP"), emptyEntry(PLATE_B)];
    const items = itemsOf(contentWith({ labware }));
    const right = LABWARE_SHEET_PAGE.width - MARGIN;
    const tableTop = LABWARE_SHEET_PAGE.height - MARGIN - 78 - 8;
    const band = items.find((item) => item.kind === "box");
    assert.deepEqual(band, {
      kind: "box", x: MARGIN, y: tableTop - 18, width: right - MARGIN, height: 18, gray: 0.92,
    });
    const headings = ["Your label", "Biomek name", "Labware type", "Before the run"];
    headings.forEach((heading, index) => {
      const item = textItem(items, heading);
      assert.equal(item.x, LABWARE_COLUMNS[index] + CELL_INSET);
      assert.equal(item.y, tableTop - 13);
      assert.equal(item.bold, true);
    });
    labware.forEach((entry, row) => {
      const y = tableTop - 18 - 18 * (row + 1);
      const values = [entry.label, entry.name, entry.labwareType, entry.beforeRun];
      values.forEach((value, column) => {
        const cell = textItems(items, value).find(
          (item) => item.y === y && item.x === LABWARE_COLUMNS[column] + CELL_INSET,
        );
        assert.ok(cell, `no "${value}" in row ${row + 1}, column ${column + 1}`);
        assert.equal(cell.size, 10);
        assert.equal(cell.bold, column === 1, `"${value}" bold`);
      });
      const line = items.find((item) => item.kind === "line" && item.y1 === y - 6);
      assert.deepEqual(line, { kind: "line", x1: MARGIN, y1: y - 6, x2: right, y2: y - 6, width: 0.3 });
    });
  });

  test("a label too wide for its column is shortened with ...; one that fits isn't", () => {
    const wide = "W".repeat(40);
    const items = itemsOf(contentWith({ labware: [emptyEntry(PLATE_A, wide), emptyEntry(PLATE_B, "Feeding DWP")] }));
    const shown = items.find((item) => item.kind === "text" && item.text.startsWith("WWW"));
    assert.ok(shown.text.endsWith("..."));
    assert.ok(textWidth(shown.text, 10, false) <= MAX_LABEL_WIDTH);
    const oneMore = `W${shown.text}`;
    assert.ok(textWidth(oneMore, 10, false) > MAX_LABEL_WIDTH, "dropped more than needed");
    textItem(items, "Feeding DWP");
  });

  test("with no unused labware there's no Not used line", () => {
    const items = itemsOf(contentWith({ unused: [] }));
    assert.ok(!items.some((item) => item.kind === "text" && item.text.startsWith("Not used")));
  });

  test("unused labware on one line, 22 below the table", () => {
    const items = itemsOf(contentWith({ unused: ["Plate2", "Plate3"] }));
    const line = textItem(items, "Not used in this plan: Plate2, Plate3");
    // The labware table has one row: its baseline is 18 below the heading band's bottom.
    const lastRowY = items.find((item) => item.kind === "box").y - 18;
    assert.equal(line.x, MARGIN);
    assert.equal(line.size, 9.5);
    assert.equal(line.y, lastRowY - 22);
  });

  test("many unused names break into lines within the edges, each but the last ending in a comma", () => {
    const unused = Array.from({ length: 30 }, (_, index) => `Labware${String(index).padStart(13, "0")}`);
    assert.equal(unused[0].length, 20);
    const items = itemsOf(contentWith({ unused }));
    const lines = items.filter((item) => item.kind === "text" && item.size === 9.5);
    assert.ok(lines.length > 1);
    assert.ok(lines[0].text.startsWith("Not used in this plan: "));
    const available = LABWARE_SHEET_PAGE.width - 2 * MARGIN;
    lines.forEach((line, index) => {
      assert.equal(line.x, MARGIN);
      assert.ok(textWidth(line.text, 9.5, false) <= available, `line ${index + 1} is too wide`);
      assert.equal(line.text.endsWith(","), index < lines.length - 1);
      assert.ok(!line.text.startsWith(" "));
      if (index > 0) {
        assert.equal(line.y, lines[index - 1].y - 13);
      }
    });
    const named = lines.map((line) => line.text).join(" ").replace("Not used in this plan: ", "");
    assert.equal(named, unused.join(", "));
  });

  test("the tips table: Tips 34 below the unused line, the tip type bold and the count regular", () => {
    const tips = [{ tipType: TIP_TYPES[0], count: 20 }];
    const items = itemsOf(contentWith({ unused: ["Plate2"], tips }));
    const unusedY = textItem(items, "Not used in this plan: Plate2").y;
    const heading = textItem(items, "Tips");
    assert.equal(heading.y, unusedY - 34);
    assert.equal(heading.size, 13);
    assert.equal(textItem(items, "Tip type").x, 54 + CELL_INSET);
    assert.equal(textItem(items, "Tips used").x, 184 + CELL_INSET);
    const rowY = heading.y - 8 - 18 - 18;
    assert.deepEqual(textItem(items, TIP_TYPES[0]), {
      kind: "text", x: 54 + CELL_INSET, y: rowY, text: TIP_TYPES[0], size: 10, bold: true,
    });
    assert.deepEqual(textItem(items, "20"), {
      kind: "text", x: 184 + CELL_INSET, y: rowY, text: "20", size: 10, bold: false,
    });
  });

  test("with no tips, a line says so instead of the table", () => {
    const items = itemsOf(contentWith({ tips: [] }));
    const heading = textItem(items, "Tips");
    assert.equal(textItem(items, "No tips: the plan has no transfers.").y, heading.y - 8 - 13);
    assert.equal(textItems(items, "Tip type").length, 0);
    assert.equal(items.filter((item) => item.kind === "box").length, 1);
  });

  test("every labware on the deck and every tip type still fit above the bottom margin", () => {
    const labware = DECK.map((entry) => ({
      label: "W".repeat(40),
      name: entry.name,
      labwareType: entry.labwareType,
      beforeRun: "Starts empty",
    }));
    const tips = TIP_TYPES.map((tipType) => ({ tipType, count: 96 }));
    const items = itemsOf(contentWith({ labware, tips, unused: [] }));
    assert.ok(lowestY(items) > MARGIN);
    // And the most a plan can leave unused, with the most tips.
    const unused = DECK.map((entry) => entry.name);
    assert.ok(lowestY(itemsOf(contentWith({ labware, tips, unused }))) > MARGIN);
  });

  // --- The file ---

  test("labwareSheet gives the file's name and a PDF holding the sheet's text", () => {
    const file = labwareSheet(examplePlan(), FOLDER, MADE);
    assert.equal(file.name, LABWARE_SHEET_FILE_NAME);
    assert.ok(file.text.startsWith("%PDF-1.4"));
    const expected = [
      "(Feeding DWP)",
      `(${PLATE_A})`,
      `(${typeOf(PLATE_A)})`,
      "(Res A)",
      `(${RESERVOIR})`,
      `(${typeOf(RESERVOIR)})`,
      "(Fill first)",
      "(Starts empty)",
      `(${FOLDER}.zip)`,
    ];
    for (const text of expected) {
      assert.ok(file.text.includes(text), `the PDF doesn't hold ${text}`);
    }
  });

  // --- The configuration (config/records.js) ---

  test("RECORDS_FOLDER and LABWARE_SHEET_FILE_NAME are names zip accepts in a path", () => {
    for (const name of [RECORDS_FOLDER, LABWARE_SHEET_FILE_NAME]) {
      assert.equal(typeof name, "string");
      assert.match(name, /^[\x20-\x7E]+$/);
      assert.ok(!name.includes("/") && !name.includes("\\"), `${name} holds a slash`);
      assert.ok(name !== "." && name !== "..");
    }
  });

  test("LABWARE_SHEET_FILE_NAME ends .pdf", () => {
    assert.ok(LABWARE_SHEET_FILE_NAME.endsWith(".pdf"));
  });

  test("LABWARE_SHEET_PAGE is a page size writePdf accepts", () => {
    assert.deepEqual(Object.keys(LABWARE_SHEET_PAGE).sort(), ["height", "width"]);
    assert.doesNotThrow(() => writePdf([{ ...LABWARE_SHEET_PAGE, items: [] }]));
  });

  // --- Refusing ---

  test("refuses a folder name that isn't text or is blank", () => {
    const start = 'The folder name for the labware sheet must be text, like "2026-11-08_134118_Exp36", but got';
    const plan = examplePlan();
    for (const [folderName, shown] of [[null, "null"], ["", '""'], ["  ", '"  "'], [5, "5"]]) {
      assertThrowsMessage(() => labwareSheetContent(plan, folderName, MADE), `${start} ${shown}.`);
    }
  });

  test("refuses a moment that isn't a valid Date", () => {
    const plan = examplePlan();
    assertThrowsMessage(
      () => labwareSheetContent(plan, FOLDER, "2026-11-08"),
      'When the labware sheet was made must be a valid date, but got "2026-11-08".',
    );
    assertThrowsMessage(
      () => labwareSheet(plan, FOLDER, new Date("soon")),
      "When the labware sheet was made must be a valid date, but got an object.",
    );
  });

  test("checks the folder name before the date", () => {
    assertThrowsMessage(
      () => labwareSheetContent(examplePlan(), null, null),
      'The folder name for the labware sheet must be text, like "2026-11-08_134118_Exp36", but got null.',
    );
  });
});
