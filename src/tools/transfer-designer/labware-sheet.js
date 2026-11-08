// labware-sheet.js — makes the labware sheet: a one-page PDF saying, for a transfer designer plan,
// which Biomek name each labware has, so the labels people know (e.g. "Feeding DWP") can be matched
// to the names the Biomek knows (e.g. "Deep1") at the instrument.
//
// It lists each labware the plan uses by its label, beside its Biomek name, its labware type and
// whether it's filled before the run; then the deck's labware the plan doesn't use, and the tips
// the run uses. It goes in the Records folder of the run's zip (ADR 0020), so it also names the zip.
// The work is in three steps, each its own function so each can be tested: the content as plain
// data, its layout as the pages the pdf module takes, and the PDF file. Like the file writer, it
// never reads the clock: the caller gives the moment.
// Specification: labware-sheet.md.

import { LABWARE_SHEET_FILE_NAME, LABWARE_SHEET_PAGE } from "../../../config/records.js";
import { describeValue } from "../../shared/error-messages/error-messages.js";
import { labwareNames, labwareTypeOf } from "../../shared/deck/deck.js";
import { writePdf, textWidth, toPdfText } from "../../shared/pdf/pdf.js";
import { labwareUsed, labelOf, tipsUsed } from "./transfer-designer.js";

// What the "Before the run" column says for a labware with starting contents in any of its wells,
// and for one without.
const FILL_FIRST = "Fill first";
const STARTS_EMPTY = "Starts empty";

// --- The layout (labware-sheet.md, section 3, "The page's layout") ---
// Positions and sizes in points, from the preview Andy approved on 2026-11-08.

// The margin on every side of the page.
const MARGIN = 54;

// The font sizes: the title, the section headings ("Labware", "Tips"), the body and the unused
// labware's line.
const TITLE_SIZE = 18;
const HEADING_SIZE = 13;
const BODY_SIZE = 10;
const UNUSED_SIZE = 9.5;

// The tables: where each column starts, how far its text is set in from that start, how tall each
// row is, the heading row's gray, the line under each row (its thickness, and how far below the
// row's baseline it is), and how far below the heading row's top its text sits.
const LABWARE_COLUMNS = [54, 184, 294, 424];
const TIPS_COLUMNS = [54, 184];
const CELL_INSET = 4;
const ROW_HEIGHT = 18;
const HEADING_GRAY = 0.92;
const ROW_LINE_WIDTH = 0.3;
const ROW_LINE_DROP = 6;
const HEADING_TEXT_DROP = 13;

// The widest a label may be: its column (184 − 54 = 130) less the inset on each side.
const MAX_LABEL_WIDTH = LABWARE_COLUMNS[1] - LABWARE_COLUMNS[0] - 2 * CELL_INSET;

// What a shortened label ends with.
const ELLIPSIS = "...";

// How far apart the lines of the unused labware are, when they need more than one.
const UNUSED_LINE_SPACING = 13;

// The text before the unused labware's names.
const UNUSED_PREFIX = "Not used in this plan: ";

// --- The interface ---

// The sheet's content for `plan`, as plain data, a new object each time (section 3, "What the sheet
// holds"): { experimentName, zipName, made, labware, unused, tips }. `folderName` is the run's
// folder name and `made` the moment the files were worked out, shown in local time. Throws if the
// folder name isn't text or is blank, then if `made` isn't a valid Date.
// e.g. labwareSheetContent(plan, "2026-11-08_134118_Exp36", new Date(2026, 10, 8, 13, 41, 18))
//      → { experimentName: "Exp36", zipName: "2026-11-08_134118_Exp36.zip",
//          made: "2026-11-08 13:41", labware: [{ label: "Feeding DWP", name: "Deep1",
//          labwareType: "BCDeep96Square", beforeRun: "Starts empty" }, …], unused: [...], tips: [...] }
export function labwareSheetContent(plan, folderName, made) {
  checkFolderName(folderName);
  checkMade(made);
  const used = labwareUsed(plan);
  return {
    experimentName: plan.experimentName,
    zipName: `${folderName}.zip`,
    made: formatMoment(made),
    labware: used.map((name) => labwareEntry(plan, name)),
    unused: labwareNames().filter((name) => !used.includes(name)),
    tips: tipsUsed(plan),
  };
}

// The pages for writePdf (pdf.md) that lay out `content`, as labwareSheetContent gives it: a list
// of one page of LABWARE_SHEET_PAGE's size, its items from the top of the page down (section 3,
// "The page's layout").
export function labwareSheetPages(content) {
  const layout = new PageLayout();
  layout.text(MARGIN, "Labware sheet", TITLE_SIZE, true);
  layout.moveDown(22);
  layout.text(MARGIN, `Plan: ${content.experimentName}`, BODY_SIZE, false);
  layout.moveDown(14);
  addFilesLine(layout, content.zipName);
  layout.moveDown(14);
  layout.text(MARGIN, `Sheet made: ${content.made}`, BODY_SIZE, false);
  layout.moveDown(28);
  addLabwareTable(layout, content.labware);
  layout.moveDown(22);
  addUnusedLines(layout, content.unused);
  layout.moveDown(34);
  addTipsTable(layout, content.tips);
  return [{ width: LABWARE_SHEET_PAGE.width, height: LABWARE_SHEET_PAGE.height, items: layout.items }];
}

// The labware sheet for `plan` as a file: { name, text }, its name in the Records folder
// (LABWARE_SHEET_FILE_NAME) and the PDF's text. Throws as labwareSheetContent does.
// e.g. labwareSheet(plan, "2026-11-08_134118_Exp36", now)
//      → { name: "Labware sheet.pdf", text: "%PDF-1.4\n…" }
export function labwareSheet(plan, folderName, made) {
  const content = labwareSheetContent(plan, folderName, made);
  return { name: LABWARE_SHEET_FILE_NAME, text: writePdf(labwareSheetPages(content)) };
}

// --- The content ---

// Throws if `folderName` isn't text, or is blank.
function checkFolderName(folderName) {
  if (typeof folderName !== "string" || folderName.trim() === "") {
    throw new Error(
      'The folder name for the labware sheet must be text, like "2026-11-08_134118_Exp36", ' +
        `but got ${describeValue(folderName)}.`,
    );
  }
}

// Throws if `made` isn't a valid Date (an invalid one, such as new Date("soon"), has no time).
function checkMade(made) {
  if (!(made instanceof Date) || Number.isNaN(made.getTime())) {
    throw new Error(
      `When the labware sheet was made must be a valid date, but got ${describeValue(made)}.`,
    );
  }
}

// A moment in local time, written YYYY-MM-DD HH:MM on the 24-hour clock with leading zeros,
// e.g. new Date(2026, 10, 8, 9, 5, 7) → "2026-11-08 09:05".
function formatMoment(moment) {
  const twoDigits = (number) => String(number).padStart(2, "0");
  const date = `${moment.getFullYear()}-${twoDigits(moment.getMonth() + 1)}-${twoDigits(moment.getDate())}`;
  return `${date} ${twoDigits(moment.getHours())}:${twoDigits(moment.getMinutes())}`;
}

// The labware table's entry for the labware called `name`: { label, name, labwareType,
// beforeRun }, its label passed through toPdfText so the PDF can show it,
// e.g. { label: "Feeding DWP", name: "Deep1", labwareType: "BCDeep96Square", beforeRun: "Starts empty" }.
function labwareEntry(plan, name) {
  const isFilled = plan.startingContents.some((entry) => entry.labware === name);
  return {
    label: toPdfText(labelOf(plan, name)),
    name,
    labwareType: labwareTypeOf(name),
    beforeRun: isFilled ? FILL_FIRST : STARTS_EMPTY,
  };
}

// --- The layout ---

// The items of one page as they're laid out from the top down: `y` is the running position of the
// next item, starting at the page's height less the margin, and each method adds items at it.
class PageLayout {
  // A layout with no items yet, at the top margin.
  constructor() {
    this.items = [];
    this.y = LABWARE_SHEET_PAGE.height - MARGIN;
  }

  // Moves the running position down by `points`.
  moveDown(points) {
    this.y -= points;
  }

  // Adds text at (x, the running position), e.g. layout.text(54, "Tips", 13, true).
  text(x, text, size, bold) {
    this.items.push({ kind: "text", x, y: this.y, text, size, bold });
  }

  // Adds a gray box across the page between the margins, from `height` below the running position
  // up to it.
  band(height, gray) {
    const width = rightEdge() - MARGIN;
    this.items.push({ kind: "box", x: MARGIN, y: this.y - height, width, height, gray });
  }

  // Adds a thin line across the page between the margins, `drop` below the running position.
  rule(drop) {
    const y = this.y - drop;
    this.items.push({ kind: "line", x1: MARGIN, y1: y, x2: rightEdge(), y2: y, width: ROW_LINE_WIDTH });
  }
}

// The page's right edge for content: its width less the margin (558 on Letter).
function rightEdge() {
  return LABWARE_SHEET_PAGE.width - MARGIN;
}

// Adds "Files: " and the zip's name, in bold, right after it.
function addFilesLine(layout, zipName) {
  const label = "Files: ";
  layout.text(MARGIN, "Files:", BODY_SIZE, false);
  layout.text(MARGIN + textWidth(label, BODY_SIZE, false), zipName, BODY_SIZE, true);
}

// Adds the "Labware" heading and its table: a row per entry, the Biomek name in bold, each label
// shortened to fit its column.
function addLabwareTable(layout, labware) {
  addSectionHeading(layout, "Labware");
  const rows = labware.map((entry) => [
    { text: fitLabel(entry.label), bold: false },
    { text: entry.name, bold: true },
    { text: entry.labwareType, bold: false },
    { text: entry.beforeRun, bold: false },
  ]);
  addTable(layout, LABWARE_COLUMNS, ["Your label", "Biomek name", "Labware type", "Before the run"], rows);
}

// Adds the "Tips" heading and its table, the tip type in bold, or, with no tips, a line saying so.
function addTipsTable(layout, tips) {
  addSectionHeading(layout, "Tips");
  if (tips.length === 0) {
    layout.moveDown(13);
    layout.text(MARGIN, "No tips: the plan has no transfers.", BODY_SIZE, false);
    return;
  }
  const rows = tips.map((entry) => [
    { text: entry.tipType, bold: true },
    { text: String(entry.count), bold: false },
  ]);
  addTable(layout, TIPS_COLUMNS, ["Tip type", "Tips used"], rows);
}

// Adds a section's heading, e.g. "Labware", and moves down to where its table starts.
function addSectionHeading(layout, heading) {
  layout.text(MARGIN, heading, HEADING_SIZE, true);
  layout.moveDown(8);
}

// Adds a table: a gray heading row holding `headings` in bold, then a row per entry of `rows`
// (each a list of { text, bold }, one per column), each with a line under it. `columns` are where
// the columns start; each cell's text is set in from its column's start.
function addTable(layout, columns, headings, rows) {
  layout.band(ROW_HEIGHT, HEADING_GRAY);
  layout.moveDown(HEADING_TEXT_DROP);
  headings.forEach((heading, index) => {
    layout.text(columns[index] + CELL_INSET, heading, BODY_SIZE, true);
  });
  layout.moveDown(ROW_HEIGHT - HEADING_TEXT_DROP);
  for (const row of rows) {
    layout.moveDown(ROW_HEIGHT);
    row.forEach((cell, index) => {
      layout.text(columns[index] + CELL_INSET, cell.text, BODY_SIZE, cell.bold);
    });
    layout.rule(ROW_LINE_DROP);
  }
}

// `label` as it fits in its column: unchanged if it fits, otherwise with characters dropped from
// its end and "..." added until it does, e.g. a long label ending "…Plate for the drug screen"
// → "…Plate for the dru...".
function fitLabel(label) {
  if (textWidth(label, BODY_SIZE, false) <= MAX_LABEL_WIDTH) {
    return label;
  }
  // Array.from splits by character, so a character is never cut in half.
  const characters = Array.from(label);
  let shortened = "";
  do {
    characters.pop();
    shortened = characters.join("") + ELLIPSIS;
  } while (characters.length > 0 && textWidth(shortened, BODY_SIZE, false) > MAX_LABEL_WIDTH);
  return shortened;
}

// Adds the line naming the deck's labware the plan doesn't use, broken into as many lines as it
// needs, or nothing if it uses them all.
function addUnusedLines(layout, unused) {
  if (unused.length === 0) {
    return;
  }
  unusedLines(unused).forEach((line, index) => {
    if (index > 0) {
      layout.moveDown(UNUSED_LINE_SPACING);
    }
    layout.text(MARGIN, line, UNUSED_SIZE, false);
  });
}

// "Not used in this plan: " and the names, separated by ", ", broken greedily into lines that fit
// between the margins: each line takes as many names as fit, breaking just after a comma (the space
// after it is dropped), e.g. ["Plate2", "Plate3"] → ["Not used in this plan: Plate2, Plate3"].
// A name too wide for any line still gets one of its own.
function unusedLines(unused) {
  const available = rightEdge() - MARGIN;
  const pieces = unused.map((name, index) => (index < unused.length - 1 ? `${name},` : name));
  const lines = [];
  let line = UNUSED_PREFIX + pieces[0];
  for (const piece of pieces.slice(1)) {
    const longer = `${line} ${piece}`;
    if (textWidth(longer, UNUSED_SIZE, false) <= available) {
      line = longer;
    } else {
      lines.push(line);
      line = piece;
    }
  }
  lines.push(line);
  return lines;
}
