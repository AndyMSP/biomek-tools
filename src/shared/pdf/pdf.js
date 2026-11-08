// pdf.js — turns a description of pages (text, lines and gray boxes placed on them) into a PDF, as
// text, so a tool can hand the user a fixed printed page, such as the labware sheet.
//
// It writes only the simplest kind of PDF (ISO 32000-1, version 1.4 files): the two standard fonts
// Helvetica and Helvetica-Bold, which every PDF reader has built in, so no font is stored in the
// file; no compression; no images. The whole file is plain ASCII, so it can go straight into a zip
// entry, and its bytes are its characters. That keeps it short enough to read and check in full,
// with no dependency (ADR 0020). It never reads the clock and writes no date or ID, so the same
// pages always give the same text and a test can compare it with a golden file.
// Specification: pdf.md.

import { describeValue } from "../error-messages/error-messages.js";
import { isObject, findMissingProperties, findExtraProperties } from "../input-checks/input-checks.js";

// --- The characters a PDF can show (pdf.md, section 3) ---

// The 27 characters that WinAnsi (Windows code page 1252) has at codes 128 to 159, by their
// Unicode character, each with its WinAnsi code. Codes 129, 141, 143, 144 and 157 have no
// character. Every other character the PDF can show (codes 32 to 126 and 160 to 255) has the same
// code in WinAnsi as in Unicode.
const WIN_ANSI_EXTRAS = new Map([
  ["€", 128], // €
  ["‚", 130], // ‚
  ["ƒ", 131], // ƒ
  ["„", 132], // „
  ["…", 133], // …
  ["†", 134], // †
  ["‡", 135], // ‡
  ["ˆ", 136], // ˆ
  ["‰", 137], // ‰
  ["Š", 138], // Š
  ["‹", 139], // ‹
  ["Œ", 140], // Œ
  ["Ž", 142], // Ž
  ["‘", 145], // ‘
  ["’", 146], // ’
  ["“", 147], // “
  ["”", 148], // ”
  ["•", 149], // •
  ["–", 150], // –
  ["—", 151], // —
  ["˜", 152], // ˜
  ["™", 153], // ™
  ["š", 154], // š
  ["›", 155], // ›
  ["œ", 156], // œ
  ["ž", 158], // ž
  ["Ÿ", 159], // Ÿ
]);

// The first code the width tables below start at: the space.
const FIRST_WIDTH_CODE = 32;

// Each character's advance width (how far the pen moves after it), in thousandths of the font's
// size, by WinAnsi code from 32 (space) to 255, 16 to a row; null where the PDF shows no character
// (127, and the five gaps among 128 to 159). From Adobe's published font metrics (AFM files) for the
// standard 14 fonts: codes 32 to 126 and 161 to 255 as PyMuPDF carries them, codes 128 to 159 from
// pdf.md's table (PyMuPDF gives 278 for all of them, which is wrong), and the no-break space (160)
// and soft hyphen (173), which the AFM files lack, as the space (278) and the hyphen (333).
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // 32 to 47
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 48 to 63
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // 64 to 79
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // 80 to 95
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // 96 to 111
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, null, // 112 to 127
  556, null, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, null, 611, null, // 128 to 143
  null, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, null, 500, 667, // 144 to 159
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, // 160 to 175
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, // 176 to 191
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, // 192 to 207
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, // 208 to 223
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, // 224 to 239
  556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500, // 240 to 255
];

// As HELVETICA_WIDTHS, for Helvetica-Bold.
const HELVETICA_BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, // 32 to 47
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, // 48 to 63
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, // 64 to 79
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, // 80 to 95
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, // 96 to 111
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, null, // 112 to 127
  556, null, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, null, 611, null, // 128 to 143
  null, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, null, 500, 667, // 144 to 159
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, // 160 to 175
  400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, // 176 to 191
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, // 192 to 207
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, // 208 to 223
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, // 224 to 239
  611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556, // 240 to 255
];

// What toPdfText puts in place of a character the PDF can't show.
const REPLACEMENT = "?";

// --- The limits on numbers (pdf.md, section 3) ---

// The largest page side PDF readers must support: 200 inches, in points.
const MAX_PAGE_SIDE = 14400;

// The largest number PDF readers handle in practice (ISO 32000-1, Annex C), either sign.
const MAX_NUMBER = 32767;

// How many digits a number is written with after the decimal point, at most.
const DECIMALS = 3;

// --- The items ---

// Each kind of item and its properties, in the order they're checked and listed in messages.
const ITEM_PROPERTIES = {
  text: ["kind", "x", "y", "text", "size", "bold"],
  line: ["kind", "x1", "y1", "x2", "y2", "width"],
  box: ["kind", "x", "y", "width", "height", "gray"],
};

// How each value of an item is checked (checkItemValue), by property name.
const VALUE_KINDS = {
  x: "position",
  y: "position",
  x1: "position",
  y1: "position",
  x2: "position",
  y2: "position",
  size: "length",
  width: "length",
  height: "length",
  gray: "gray",
  bold: "bold",
  text: "text",
};

// The properties a page has, and no others.
const PAGE_PROPERTIES = ["width", "height", "items"];

// The resource names of the two fonts in every page: /F1 Helvetica and /F2 Helvetica-Bold.
const REGULAR_FONT = "/F1";
const BOLD_FONT = "/F2";

// The objects before the pages' own: the catalog, the page tree and the two fonts (pdf.md,
// "The format"). Each page then has two objects, its content stream and the page.
const FIXED_OBJECT_COUNT = 4;
const PAGE_TREE_NUMBER = 2;

// --- The interface ---

// The PDF of `pages` (a list of { width, height, items }; pdf.md, section 3), as plain ASCII text.
// Checks the list, then each page in order (its form, width, height, items' list, then each item),
// and throws at the first problem; nothing is returned then.
// e.g. writePdf([{ width: 612, height: 792, items: [] }]) → text starting "%PDF-1.4\n" and ending
// "%%EOF\n", holding one empty US Letter page.
export function writePdf(pages) {
  checkPages(pages);
  const objects = [
    `<< /Type /Catalog /Pages ${PAGE_TREE_NUMBER} 0 R >>`,
    pageTree(pages.length),
    fontObject("Helvetica"),
    fontObject("Helvetica-Bold"),
  ];
  pages.forEach((page, index) => {
    const contentsNumber = FIXED_OBJECT_COUNT + 2 * index + 1;
    objects.push(contentStream(pageInstructions(page)), pageObject(page, contentsNumber));
  });
  return assemble(objects);
}

// How wide `text` is in points when drawn `size` points tall, in Helvetica-Bold if `bold` is true
// and Helvetica otherwise: the sum of each character's advance width in the font's metrics.
// Throws if the text isn't text the PDF can show, or the size or bold isn't valid.
// e.g. textWidth("Deep1", 10, false) → 29.46
export function textWidth(text, size, bold) {
  if (typeof text !== "string") {
    throw new Error(`The text to measure must be text, but got ${describeValue(text)}.`);
  }
  checkShowable(text, "The text to measure");
  if (!isLength(size)) {
    throw new Error(
      `The size to measure at must be a number greater than 0 and at most ${MAX_NUMBER}, ` +
        `but got ${describeValue(size)}.`,
    );
  }
  if (typeof bold !== "boolean") {
    throw new Error(`Bold must be true or false, but got ${describeValue(bold)}.`);
  }
  const widths = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  let thousandths = 0;
  for (const character of text) {
    thousandths += widths[winAnsiCodeOf(character) - FIRST_WIDTH_CODE];
  }
  return (thousandths * size) / 1000;
}

// A copy of `text` with each character the PDF can't show replaced by "?", for showing what users
// typed. Throws if `text` isn't text.
// e.g. toPdfText("Drug → plate") → "Drug ? plate"; toPdfText("5 µL") → "5 µL"
export function toPdfText(text) {
  if (typeof text !== "string") {
    throw new Error(`The text for a PDF must be text, but got ${describeValue(text)}.`);
  }
  // for...of goes through the text by character, so an emoji (two UTF-16 halves) is one "?".
  let cleaned = "";
  for (const character of text) {
    cleaned += winAnsiCodeOf(character) === null ? REPLACEMENT : character;
  }
  return cleaned;
}

// --- Characters ---

// The WinAnsi code of `character` (one Unicode character), or null if the PDF can't show it,
// e.g. "A" → 65, "µ" → 181, "–" → 150, "→" → null, "\t" → null.
function winAnsiCodeOf(character) {
  if (WIN_ANSI_EXTRAS.has(character)) {
    return WIN_ANSI_EXTRAS.get(character);
  }
  const code = character.codePointAt(0);
  const isPrintableAscii = code >= 32 && code <= 126;
  const isLatin1 = code >= 160 && code <= 255;
  return isPrintableAscii || isLatin1 ? code : null;
}

// The first character of `text` the PDF can't show, or null if it can show them all,
// e.g. "Drug → plate" → "→".
function firstUnshowable(text) {
  for (const character of text) {
    if (winAnsiCodeOf(character) === null) {
      return character;
    }
  }
  return null;
}

// A character as a message names it: a tab or a line break in words, as they can't be seen,
// anything else in quotes, e.g. "\t" → "a tab", "→" → '"→"'.
function describeCharacter(character) {
  if (character === "\t") {
    return "a tab";
  }
  if (character === "\n" || character === "\r") {
    return "a line break";
  }
  return describeValue(character);
}

// Throws if `text` has a character the PDF can't show, naming the text as `subject` says,
// e.g. checkShowable("Drug → plate", "The text to measure") throws 'The text to measure, "Drug →
// plate", has "→", which a PDF's standard fonts can't show here: pass it through toPdfText first.'
function checkShowable(text, subject) {
  const character = firstUnshowable(text);
  if (character !== null) {
    throw new Error(
      `${subject}, ${describeValue(text)}, has ${describeCharacter(character)}, which a PDF's ` +
        "standard fonts can't show here: pass it through toPdfText first.",
    );
  }
}

// --- Checking the pages ---

// True if `value` is a finite number greater than 0 and at most MAX_NUMBER: a size, a line's
// width, or a box's width or height.
function isLength(value) {
  return Number.isFinite(value) && value > 0 && value <= MAX_NUMBER;
}

// Throws if `pages` isn't a list of at least one valid page, at the first problem found.
function checkPages(pages) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error(
      "The pages of a PDF must be a list of at least one { width, height, items }, " +
        `but got ${describeValue(pages)}.`,
    );
  }
  pages.forEach((page, index) => checkPage(page, index + 1));
}

// Throws if page number `pageNumber` (counted from 1) isn't valid: its form, its width, its
// height, its items' list, then each of its items.
function checkPage(page, pageNumber) {
  const isExact =
    isObject(page) &&
    findMissingProperties(page, PAGE_PROPERTIES).length === 0 &&
    findExtraProperties(page, PAGE_PROPERTIES).length === 0;
  if (!isExact) {
    throw new Error(
      `Page ${pageNumber} must be an object with exactly "width", "height" and "items".`,
    );
  }
  checkPageSide(page.width, `Page ${pageNumber}'s width`);
  checkPageSide(page.height, `Page ${pageNumber}'s height`);
  if (!Array.isArray(page.items)) {
    throw new Error(`Page ${pageNumber}'s items must be a list, but got ${describeValue(page.items)}.`);
  }
  page.items.forEach((item, index) => checkItem(item, `Page ${pageNumber}, item ${index + 1}`));
}

// Throws if `value`, a page's width or height (`subject` names it), isn't a number greater than 0
// and at most MAX_PAGE_SIDE.
function checkPageSide(value, subject) {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_PAGE_SIDE) {
    throw new Error(
      `${subject} must be a number of points greater than 0 and at most ${MAX_PAGE_SIDE}, ` +
        `but got ${describeValue(value)}.`,
    );
  }
}

// Throws if `item` isn't valid: its kind, then its properties, then each value in its properties'
// order. `place` names it, e.g. "Page 2, item 3".
function checkItem(item, place) {
  if (!isObject(item) || !Object.hasOwn(ITEM_PROPERTIES, item.kind)) {
    const got = isObject(item) ? item.kind : item;
    throw new Error(
      `${place}, must be an object whose kind is "text", "line" or "box", but got ${describeValue(got)}.`,
    );
  }
  const properties = ITEM_PROPERTIES[item.kind];
  const isExact =
    findMissingProperties(item, properties).length === 0 &&
    findExtraProperties(item, properties).length === 0;
  if (!isExact) {
    throw new Error(`${place} (${item.kind}), must have exactly ${listInWords(properties)}.`);
  }
  for (const property of properties.slice(1)) {
    checkItemValue(item[property], VALUE_KINDS[property], `${place}'s ${property}`);
  }
}

// Property names in quotes, the last two joined by "and",
// e.g. ["kind", "x", "y"] → '"kind", "x" and "y"'.
function listInWords(names) {
  const quoted = names.map((name) => `"${name}"`);
  return `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}`;
}

// Throws if `value` isn't a valid value of its kind ("position", "length", "gray", "bold" or
// "text"). `subject` names it, e.g. "Page 2, item 3's x".
function checkItemValue(value, kind, subject) {
  const got = describeValue(value);
  if (kind === "position") {
    if (!Number.isFinite(value)) {
      throw new Error(`${subject} must be a number, but got ${got}.`);
    }
    if (Math.abs(value) > MAX_NUMBER) {
      throw new Error(`${subject} must be from -${MAX_NUMBER} to ${MAX_NUMBER} points, but got ${got}.`);
    }
  } else if (kind === "length") {
    if (!isLength(value)) {
      throw new Error(
        `${subject} must be a number greater than 0 and at most ${MAX_NUMBER}, but got ${got}.`,
      );
    }
  } else if (kind === "gray") {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`${subject} must be a number from 0 (black) to 1 (white), but got ${got}.`);
    }
  } else if (kind === "bold") {
    if (typeof value !== "boolean") {
      throw new Error(`${subject} must be true or false, but got ${got}.`);
    }
  } else {
    if (typeof value !== "string") {
      throw new Error(`${subject} must be text, but got ${got}.`);
    }
    checkShowable(value, subject);
  }
}

// --- Writing the objects ---

// A number as the PDF writes it: at most DECIMALS digits after the point, no trailing zeros or
// point, no minus sign on zero, never in exponent form (the checks keep numbers below 32,768),
// e.g. 612 → "612", 12.5 → "12.5", 1/3 → "0.333", -0.0001 → "0".
function formatNumber(value) {
  // toFixed rounds to DECIMALS places; Number() then drops trailing zeros, and String(-0) is "0".
  return String(Number(value.toFixed(DECIMALS)));
}

// The page tree object for `pageCount` pages, listing each page object in order. Page i (from 0)
// is object FIXED_OBJECT_COUNT + 2i + 2, after its content stream.
function pageTree(pageCount) {
  const kids = [];
  for (let index = 0; index < pageCount; index += 1) {
    kids.push(`${FIXED_OBJECT_COUNT + 2 * index + 2} 0 R`);
  }
  return `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageCount} >>`;
}

// A standard font object, in the WinAnsi character set, e.g. fontObject("Helvetica").
function fontObject(baseFont) {
  return `<< /Type /Font /Subtype /Type1 /BaseFont /${baseFont} /Encoding /WinAnsiEncoding >>`;
}

// A page object for `page`, whose content stream is object number `contentsNumber`.
function pageObject(page, contentsNumber) {
  return (
    `<< /Type /Page /Parent ${PAGE_TREE_NUMBER} 0 R ` +
    `/MediaBox [0 0 ${formatNumber(page.width)} ${formatNumber(page.height)}] ` +
    `/Resources << /Font << ${REGULAR_FONT} 3 0 R ${BOLD_FONT} 4 0 R >> >> ` +
    `/Contents ${contentsNumber} 0 R >>`
  );
}

// A content stream object holding `instructions`. Its /Length counts the instructions' bytes only
// (the text is ASCII, so its length is its byte count), not the line breaks around them.
function contentStream(instructions) {
  return `<< /Length ${instructions.length} >>\nstream\n${instructions}\nendstream`;
}

// A page's drawing instructions, one line per item in order, joined with "\n" with none after the
// last; "" for a page with nothing drawn. Text that's "" gives no instruction.
function pageInstructions(page) {
  return page.items
    .map(itemInstruction)
    .filter((instruction) => instruction !== null)
    .join("\n");
}

// The drawing instruction for one item, or null for text that's "",
// e.g. { kind: "line", x1: 54, y1: 690, x2: 558, y2: 690, width: 0.3 } → "0.3 w 54 690 m 558 690 l S".
function itemInstruction(item) {
  const n = formatNumber;
  if (item.kind === "text") {
    if (item.text === "") {
      return null;
    }
    const font = item.bold ? BOLD_FONT : REGULAR_FONT;
    return `BT ${font} ${n(item.size)} Tf ${n(item.x)} ${n(item.y)} Td (${pdfString(item.text)}) Tj ET`;
  }
  if (item.kind === "line") {
    return `${n(item.width)} w ${n(item.x1)} ${n(item.y1)} m ${n(item.x2)} ${n(item.y2)} l S`;
  }
  // A box; the final "0 g" sets black again for what follows.
  return `${n(item.gray)} g ${n(item.x)} ${n(item.y)} ${n(item.width)} ${n(item.height)} re f 0 g`;
}

// Text as it goes inside a PDF string's parentheses: "\", "(" and ")" each preceded by "\", and
// every character outside printable ASCII written as "\" and its WinAnsi code in three octal
// digits, so the file stays ASCII, e.g. "a(b)\\c" → "a\\(b\\)\\\\c", "5 µL" → "5 \\265L".
function pdfString(text) {
  let written = "";
  for (const character of text) {
    const code = winAnsiCodeOf(character);
    if (character === "\\" || character === "(" || character === ")") {
      written += `\\${character}`;
    } else if (code <= 126) {
      written += character;
    } else {
      written += `\\${code.toString(8).padStart(3, "0")}`;
    }
  }
  return written;
}

// The whole file from its objects (numbered from 1 in order): the header, the objects, the
// cross-reference table giving each object's byte offset, and the trailer. The text is ASCII, so
// a position in it is its byte offset.
function assemble(objects) {
  let text = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(text.length);
    text += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = text.length;
  // Each entry is exactly 20 bytes: 10 digits, a space, 5 digits, a space, "n" or "f", a space and
  // "\n" (ISO 32000-1, 7.5.4).
  const entries = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`);
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries.join("")}`;
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return text;
}
