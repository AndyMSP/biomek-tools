// Unit tests for pdf.js. Each test comes from the "Test cases" section of pdf.md, and each row of
// its error table and each order of checks has one.
//
// To check the structure, the tests read a PDF back the way a reader does: from startxref at the
// end to the cross-reference table, and from each entry's offset to its object. That reader lives
// here, in the tests only: pdf.md says the module doesn't read PDFs.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { writePdf, textWidth, toPdfText } from "./pdf.js";

// The example of pdf.md, section 4: a gray box, a bold heading on it and a thin line under it.
const EXAMPLE_ITEMS = [
  { kind: "box", x: 54, y: 700, width: 504, height: 18, gray: 0.92 },
  { kind: "text", x: 58, y: 705, text: "Your label", size: 10, bold: true },
  { kind: "line", x1: 54, y1: 690, x2: 558, y2: 690, width: 0.3 },
];

// The golden file's pages (tests/fixtures/pdf-sample.md): the example plus a line of text with µ.
const GOLDEN_PAGES = [
  {
    width: 612,
    height: 792,
    items: [
      ...EXAMPLE_ITEMS,
      { kind: "text", x: 58, y: 680, text: "Volume: 50 µL (A1)", size: 12, bold: false },
    ],
  },
];

// Where the golden file is, worked out from this test file's own location, so the test passes
// whichever folder the tests are started from.
const GOLDEN_FILE = new URL("../../../tests/fixtures/pdf-sample.pdf", import.meta.url);

// --- Helpers for the tests ---

// A US Letter page holding `items`.
function letterPage(items) {
  return { width: 612, height: 792, items };
}

// A text item at (58, 705), size 10, regular, with any properties replaced by `changes`.
function textItem(changes = {}) {
  return { kind: "text", x: 58, y: 705, text: "Your label", size: 10, bold: false, ...changes };
}

// The PDF of one Letter page holding `items`.
function pdfOf(items) {
  return writePdf([letterPage(items)]);
}

// The drawing instructions of the first page's content stream, between "stream\n" and
// "\nendstream".
function firstStream(pdf) {
  return pdf.slice(pdf.indexOf("stream\n") + "stream\n".length, pdf.indexOf("\nendstream"));
}

// Reads `pdf` back as a reader does: { xrefOffset, offsets, objects }, the offset startxref gives,
// each object's offset from the cross-reference table (object 1 first), and each object's text
// between "<n> 0 obj\n" and "\nendobj".
function readPdf(pdf) {
  const xrefOffset = Number(pdf.match(/startxref\n(\d+)\n%%EOF\n$/)[1]);
  const lines = pdf.slice(xrefOffset).split("\n");
  const objectCount = Number(lines[1].split(" ")[1]) - 1;
  const entries = pdf
    .slice(xrefOffset)
    .slice(lines[0].length + lines[1].length + 2)
    .slice(0, (objectCount + 1) * 20);
  const offsets = [];
  for (let number = 1; number <= objectCount; number += 1) {
    offsets.push(Number(entries.slice(number * 20, number * 20 + 10)));
  }
  const objects = offsets.map((offset, index) => {
    const start = offset + `${index + 1} 0 obj\n`.length;
    return pdf.slice(start, pdf.indexOf("\nendobj", start));
  });
  return { xrefOffset, offsets, objects, entries };
}

// Asserts that `call` throws exactly `message`.
function assertThrowsMessage(call, message) {
  assert.throws(call, (error) => {
    assert.equal(error.message, message);
    return true;
  });
}

describe("pdf", () => {
  // --- The structure ---

  test("one empty page gives a PDF with the header, the end marker and 6 objects in order", () => {
    const pdf = pdfOf([]);
    assert.ok(pdf.startsWith("%PDF-1.4\n"));
    assert.ok(pdf.endsWith("%%EOF\n"));
    const { objects } = readPdf(pdf);
    assert.equal(objects.length, 6);
    assert.equal(objects[0], "<< /Type /Catalog /Pages 2 0 R >>");
    assert.equal(objects[1], "<< /Type /Pages /Kids [6 0 R] /Count 1 >>");
    assert.equal(
      objects[2],
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    );
    assert.equal(
      objects[3],
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    );
    assert.equal(objects[4], "<< /Length 0 >>\nstream\n\nendstream");
    assert.equal(
      objects[5],
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
        "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 5 0 R >>",
    );
  });

  test("three pages give 10 objects, the page tree listing the page objects in order", () => {
    const pdf = writePdf([letterPage([]), letterPage([]), letterPage([])]);
    const { objects } = readPdf(pdf);
    assert.equal(objects.length, 10);
    assert.equal(objects[1], "<< /Type /Pages /Kids [6 0 R 8 0 R 10 0 R] /Count 3 >>");
    assert.match(objects[7], /\/Contents 7 0 R >>$/);
    assert.match(objects[9], /\/Contents 9 0 R >>$/);
  });

  test("every cross-reference entry is 20 bytes and points at its object; startxref points at xref", () => {
    const pdf = writePdf([letterPage(EXAMPLE_ITEMS), letterPage([textItem()])]);
    const { xrefOffset, offsets, entries } = readPdf(pdf);
    assert.ok(pdf.slice(xrefOffset).startsWith("xref\n0 9\n"));
    assert.equal(entries.slice(0, 20), "0000000000 65535 f \n");
    for (let index = 0; index < offsets.length; index += 1) {
      const entry = entries.slice((index + 1) * 20, (index + 2) * 20);
      assert.match(entry, /^\d{10} 00000 n \n$/);
      assert.ok(pdf.slice(offsets[index]).startsWith(`${index + 1} 0 obj\n`));
    }
    assert.ok(pdf.includes("trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n"));
  });

  test("each content stream's /Length equals its instructions' bytes", () => {
    const pdf = writePdf([letterPage(EXAMPLE_ITEMS), letterPage([textItem({ text: "µL" })])]);
    const streams = [...pdf.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)];
    assert.equal(streams.length, 2);
    for (const [, length, instructions] of streams) {
      assert.equal(Number(length), instructions.length);
    }
  });

  test("the page's /MediaBox holds its width and height", () => {
    const pdf = writePdf([{ width: 595.276, height: 841.89, items: [] }]);
    assert.ok(pdf.includes("/MediaBox [0 0 595.276 841.89]"));
  });

  test("the whole output is plain ASCII, including for text with µ", () => {
    const pdf = pdfOf([textItem({ text: "50 µL at 37 °C – “Drug” €" })]);
    assert.match(pdf, /^[\t\n\r\x20-\x7E]*$/);
  });

  test("the same pages give identical text twice, and the pages are unchanged", () => {
    const pages = [letterPage(EXAMPLE_ITEMS.map((item) => ({ ...item })))];
    const before = JSON.stringify(pages);
    assert.equal(writePdf(pages), writePdf(pages));
    assert.equal(JSON.stringify(pages), before);
  });

  // --- The instructions ---

  test("a text item gives its instruction; bold uses /F2; empty text gives nothing", () => {
    assert.equal(firstStream(pdfOf([textItem()])), "BT /F1 10 Tf 58 705 Td (Your label) Tj ET");
    assert.equal(
      firstStream(pdfOf([textItem({ bold: true })])),
      "BT /F2 10 Tf 58 705 Td (Your label) Tj ET",
    );
    assert.equal(firstStream(pdfOf([textItem({ text: "" })])), "");
    assert.ok(pdfOf([textItem({ text: "" })]).includes("<< /Length 0 >>"));
  });

  test("backslashes and parentheses are escaped, and µ, ° and é are written in octal", () => {
    assert.ok(firstStream(pdfOf([textItem({ text: "a(b)\\c" })])).includes("(a\\(b\\)\\\\c)"));
    assert.ok(firstStream(pdfOf([textItem({ text: "µ°é" })])).includes("(\\265\\260\\351)"));
  });

  test("a line and a box give their instructions", () => {
    assert.equal(firstStream(pdfOf([EXAMPLE_ITEMS[2]])), "0.3 w 54 690 m 558 690 l S");
    assert.equal(firstStream(pdfOf([EXAMPLE_ITEMS[0]])), "0.92 g 54 700 504 18 re f 0 g");
  });

  test("numbers are written with at most 3 decimals, no trailing zeros and no minus on zero", () => {
    const cases = [
      [612, "612"],
      [12.5, "12.5"],
      [1 / 3, "0.333"],
      [2 / 3, "0.667"],
      [-0.0001, "0"],
      [1e-7, "0"],
      [-3.25, "-3.25"],
      [32767, "32767"],
    ];
    for (const [x, written] of cases) {
      assert.equal(
        firstStream(pdfOf([textItem({ x })])),
        `BT /F1 10 Tf ${written} 705 Td (Your label) Tj ET`,
      );
    }
  });

  test("characters from WinAnsi's codes 128 to 159 are written as their codes", () => {
    assert.ok(firstStream(pdfOf([textItem({ text: "–“€" })])).includes("(\\226\\223\\200)"));
  });

  test("items are written in the order given", () => {
    assert.equal(
      firstStream(pdfOf(EXAMPLE_ITEMS)),
      [
        "0.92 g 54 700 504 18 re f 0 g",
        "BT /F2 10 Tf 58 705 Td (Your label) Tj ET",
        "0.3 w 54 690 m 558 690 l S",
      ].join("\n"),
    );
  });

  // --- Measuring and cleaning text ---

  test("textWidth gives the metrics' widths for the listed characters", () => {
    // [character, regular, bold], in thousandths (pdf.md, section 3, "Measuring text").
    const widths = [
      ["A", 667, 722],
      ["W", 944, 944],
      ["i", 222, 278],
      [" ", 278, 278],
      ["0", 556, 556],
      ["µ", 556, 611],
      ["°", 400, 400],
      ["×", 584, 584],
    ];
    for (const [character, regular, bold] of widths) {
      assert.equal(textWidth(character, 1000, false), regular, `${character} regular`);
      assert.equal(textWidth(character, 1000, true), bold, `${character} bold`);
    }
  });

  test('textWidth("Deep1", 10, false) is 29.46 and "Feeding DWP" at 10 bold is 64.45', () => {
    assert.ok(Math.abs(textWidth("Deep1", 10, false) - 29.46) < 0.001);
    assert.ok(Math.abs(textWidth("Feeding DWP", 10, true) - 64.45) < 0.001);
  });

  test("textWidth of empty text is 0", () => {
    assert.equal(textWidth("", 10, false), 0);
  });

  test("textWidth takes codes 128 to 159 from the table, and the no-break space is a space", () => {
    assert.equal(textWidth("–", 1000, false), 556);
    assert.equal(textWidth("“", 1000, true), 500);
    assert.equal(textWidth(" ", 1000, false), 278);
    assert.equal(textWidth("­", 1000, false), 333);
  });

  test("toPdfText keeps what the PDF can show and replaces the rest with ?", () => {
    for (const text of ["Res A", "µL", "Zürich ± 5 °C", "“Drug” – 5 €"]) {
      assert.equal(toPdfText(text), text);
    }
    assert.equal(toPdfText("Drug → plate"), "Drug ? plate");
    assert.equal(toPdfText("a\tb"), "a?b");
    assert.equal(toPdfText("α😀"), "??");
  });

  // --- A check by a reader ---

  test("the golden file's pages give exactly its bytes", () => {
    const golden = readFileSync(GOLDEN_FILE);
    const written = Buffer.from(writePdf(GOLDEN_PAGES), "ascii");
    assert.ok(written.equals(golden), "writePdf's output differs from tests/fixtures/pdf-sample.pdf");
  });

  // --- Refusing ---

  test("refuses pages that aren't a list of at least one page", () => {
    const start = "The pages of a PDF must be a list of at least one { width, height, items }, but got";
    assertThrowsMessage(() => writePdf(null), `${start} null.`);
    assertThrowsMessage(() => writePdf([]), `${start} a list.`);
    assertThrowsMessage(() => writePdf("pages"), `${start} "pages".`);
  });

  test("refuses a page without exactly width, height and items", () => {
    const message = 'Page 2 must be an object with exactly "width", "height" and "items".';
    assertThrowsMessage(() => writePdf([letterPage([]), { width: 612, height: 792 }]), message);
    assertThrowsMessage(
      () => writePdf([letterPage([]), { ...letterPage([]), depth: 1 }]),
      message,
    );
    assertThrowsMessage(() => writePdf([letterPage([]), null]), message);
  });

  test("refuses a page width or height that isn't a number from 0.001 to 14400", () => {
    for (const [width, shown] of [[0, "0"], [0.0001, "0.0001"], [-1, "-1"], [14401, "14401"], ["612", '"612"']]) {
      assertThrowsMessage(
        () => writePdf([letterPage([]), { width, height: 792, items: [] }]),
        `Page 2's width must be a number of points from 0.001 to 14400, but got ${shown}.`,
      );
    }
    assertThrowsMessage(
      () => writePdf([{ width: 612, height: NaN, items: [] }]),
      "Page 1's height must be a number of points from 0.001 to 14400, but got NaN.",
    );
  });

  test("refuses items that aren't a list", () => {
    assertThrowsMessage(
      () => writePdf([letterPage([]), { width: 612, height: 792, items: null }]),
      "Page 2's items must be a list, but got null.",
    );
  });

  test("refuses an item whose kind isn't text, line or box", () => {
    const start = 'Page 1, item 3, must be an object whose kind is "text", "line" or "box", but got';
    assertThrowsMessage(
      () => pdfOf([textItem(), textItem(), { kind: "circle", x: 0, y: 0 }]),
      `${start} "circle".`,
    );
    assertThrowsMessage(() => pdfOf([textItem(), textItem(), null]), `${start} null.`);
    // A list holding the kind's name isn't text, though Object.hasOwn would read it as "text".
    assertThrowsMessage(
      () => pdfOf([textItem(), textItem(), { ...textItem(), kind: ["text"] }]),
      `${start} a list.`,
    );
  });

  test("refuses an item without exactly its kind's properties", () => {
    const { bold, ...withoutBold } = textItem();
    assertThrowsMessage(
      () => pdfOf([withoutBold]),
      'Page 1, item 1 (text), must have exactly "kind", "x", "y", "text", "size" and "bold".',
    );
    assertThrowsMessage(
      () => pdfOf([{ ...EXAMPLE_ITEMS[2], color: "red" }]),
      'Page 1, item 1 (line), must have exactly "kind", "x1", "y1", "x2", "y2" and "width".',
    );
    assertThrowsMessage(
      () => pdfOf([{ kind: "box", x: 0, y: 0, width: 1, height: 1 }]),
      'Page 1, item 1 (box), must have exactly "kind", "x", "y", "width", "height" and "gray".',
    );
  });

  test("refuses a position that isn't a finite number", () => {
    for (const [x, shown] of [["54", '"54"'], [NaN, "NaN"], [Infinity, "Infinity"]]) {
      assertThrowsMessage(
        () => pdfOf([textItem({ x })]),
        `Page 1, item 1's x must be a number, but got ${shown}.`,
      );
    }
  });

  test("refuses a position outside -32767 to 32767", () => {
    assertThrowsMessage(
      () => pdfOf([textItem({ x: 40000 })]),
      "Page 1, item 1's x must be from -32767 to 32767 points, but got 40000.",
    );
    assertThrowsMessage(
      () => pdfOf([textItem({ x: 1e21 })]),
      "Page 1, item 1's x must be from -32767 to 32767 points, but got 1e+21.",
    );
    assertThrowsMessage(
      () => pdfOf([{ ...EXAMPLE_ITEMS[2], y2: -40000 }]),
      "Page 1, item 1's y2 must be from -32767 to 32767 points, but got -40000.",
    );
  });

  test("refuses a size, width or height that isn't a number from 0.001 to 32767", () => {
    for (const [size, shown] of [[0, "0"], [0.0001, "0.0001"], [-1, "-1"], [Infinity, "Infinity"]]) {
      assertThrowsMessage(
        () => pdfOf([textItem({ size })]),
        `Page 1, item 1's size must be a number from 0.001 to 32767, but got ${shown}.`,
      );
    }
    assertThrowsMessage(
      () => pdfOf([{ ...EXAMPLE_ITEMS[2], width: 0 }]),
      "Page 1, item 1's width must be a number from 0.001 to 32767, but got 0.",
    );
    assertThrowsMessage(
      () => pdfOf([{ ...EXAMPLE_ITEMS[0], height: 40000 }]),
      "Page 1, item 1's height must be a number from 0.001 to 32767, but got 40000.",
    );
  });

  test("refuses a gray outside 0 to 1", () => {
    for (const gray of [1.5, -0.1]) {
      assertThrowsMessage(
        () => pdfOf([{ ...EXAMPLE_ITEMS[0], gray }]),
        `Page 1, item 1's gray must be a number from 0 (black) to 1 (white), but got ${gray}.`,
      );
    }
  });

  test("refuses a bold that isn't true or false", () => {
    assertThrowsMessage(
      () => pdfOf([textItem({ bold: "yes" })]),
      'Page 1, item 1\'s bold must be true or false, but got "yes".',
    );
  });

  test("refuses text that isn't text", () => {
    assertThrowsMessage(
      () => pdfOf([textItem({ text: 5 })]),
      "Page 1, item 1's text must be text, but got 5.",
    );
  });

  test("refuses text with a character the PDF can't show, naming a tab and a line break in words", () => {
    const end = "which a PDF's standard fonts can't show here: pass it through toPdfText first.";
    assertThrowsMessage(
      () => pdfOf([textItem({ text: "Drug → plate" })]),
      `Page 1, item 1's text, "Drug → plate", has "→", ${end}`,
    );
    assertThrowsMessage(
      () => pdfOf([textItem({ text: "→" })]),
      `Page 1, item 1's text, "→", has "→", ${end}`,
    );
    assertThrowsMessage(
      () => pdfOf([textItem({ text: "a\tb" })]),
      `Page 1, item 1's text, "a\tb", has a tab, ${end}`,
    );
    assertThrowsMessage(
      () => pdfOf([textItem({ text: "a\nb" })]),
      `Page 1, item 1's text, "a\nb", has a line break, ${end}`,
    );
  });

  test("textWidth refuses text, size or bold that isn't valid", () => {
    assertThrowsMessage(() => textWidth(5, 10, false), "The text to measure must be text, but got 5.");
    assertThrowsMessage(
      () => textWidth("→", 10, false),
      'The text to measure, "→", has "→", which a PDF\'s standard fonts can\'t show here: ' +
        "pass it through toPdfText first.",
    );
    for (const [size, shown] of [[0, "0"], [Infinity, "Infinity"]]) {
      assertThrowsMessage(
        () => textWidth("a", size, false),
        `The size to measure at must be a number from 0.001 to 32767, but got ${shown}.`,
      );
    }
    assertThrowsMessage(() => textWidth("a", 10, "yes"), 'Bold must be true or false, but got "yes".');
  });

  test("toPdfText refuses what isn't text", () => {
    assertThrowsMessage(() => toPdfText(5), "The text for a PDF must be text, but got 5.");
  });

  test("checks pages in order, each in full: page 1's bad item before page 2's bad width", () => {
    assertThrowsMessage(
      () => writePdf([letterPage([textItem({ bold: "yes" })]), { width: 0, height: 792, items: [] }]),
      'Page 1, item 1\'s bold must be true or false, but got "yes".',
    );
  });

  test("checks an item's kind before its properties, and its properties before its values", () => {
    assertThrowsMessage(
      () => pdfOf([{ kind: "circle" }]),
      'Page 1, item 1, must be an object whose kind is "text", "line" or "box", but got "circle".',
    );
    assertThrowsMessage(
      () => pdfOf([{ kind: "text", x: "54", y: 0, text: "a", size: 10 }]),
      'Page 1, item 1 (text), must have exactly "kind", "x", "y", "text", "size" and "bold".',
    );
    assertThrowsMessage(
      () => pdfOf([textItem({ x: "54", size: 0 })]),
      "Page 1, item 1's x must be a number, but got \"54\".",
    );
  });
});
