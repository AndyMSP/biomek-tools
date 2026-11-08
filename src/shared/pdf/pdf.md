# pdf — specification

> **Draft (2026-11-08).** Written for v0.2.0 in the hands-off workflow (CLAUDE.md, "Workflows"), from
> a preview Andy shaped on 2026-11-08 (ADR 0020). It becomes Final once Andy has opened a PDF it
> made in Edge on a lab PC and checked the text shows right, `µ` included.

## 1. Purpose
`pdf.js` turns a description of pages (text, lines and gray boxes placed on them) into a **PDF**
(Portable Document Format, the standard file format for a fixed printed page), as text. The
transfer designer uses it for the labware sheet (`labware-sheet.md`; ADR 0020).

It's shared because writing a PDF has nothing to do with one tool, as with `zip`. It's our own code,
not a library (ADR 0020): it writes only the simplest kind of PDF, so it's short enough to read and
check in full, and adds no dependency.

## 2. Scope
Version 1 writes PDFs that use only the **standard 14 fonts**, the fonts every PDF reader must have
built in, so none is stored in the file. Of those, it uses two: **Helvetica** and
**Helvetica-Bold**. It follows the PDF format's public specification, **ISO 32000-1** (PDF 1.7), and
writes version 1.4 files, which every reader opens.

The whole file is **plain ASCII** (character codes 9, 10, 13 and 32 to 126), so it can be handled as
ordinary text: in particular, it can go straight into `zip`'s entries, which take text (`zip.md`),
and its bytes are its characters.

Not in version 1:
- **Other fonts, images, colors other than gray, curves.** The labware sheet needs none.
- **Flowing text.** The caller places every piece of text; the module doesn't wrap lines or break
  pages. It measures text (`textWidth`) so a caller can fit it.
- **Compression.** The files are a few kilobytes.
- **Tags** (the hidden structure that marks headings and tables for screen readers; ADR 0020,
  "Consequences").
- **Reading PDFs.**

## 3. Data model

### Coordinates
Positions and sizes are in **points**, the PDF's unit: 72 points to the inch. As in every PDF, `x`
runs left to right from the page's left edge and `y` runs **bottom to top** from its bottom edge.
A US Letter page is 612 × 792 points.

### Inputs
**The pages:** a list of at least one page, each `{ width, height, items }`:
- `width` and `height`: the page's size in points, numbers greater than 0 and at most 14,400 (200
  inches, the largest page PDF readers must support).
- `items`: a list of what's drawn on the page, in order, later items drawn over earlier ones. Each
  is one of:
  - **Text** `{ kind: "text", x, y, text, size, bold }`: `text` written starting at (`x`, `y`), the
    left end of its **baseline** (the line letters sit on; descenders like `g` go below it), in
    Helvetica (`bold: false`) or Helvetica-Bold (`bold: true`), `size` points tall, in black.
    `text` is any text the PDF can show (below), on one line; `""` draws nothing but is allowed.
  - **A line** `{ kind: "line", x1, y1, x2, y2, width }`: a straight black line from (`x1`, `y1`)
    to (`x2`, `y2`), `width` points thick.
  - **A box** `{ kind: "box", x, y, width, height, gray }`: a filled rectangle with its bottom-left
    corner at (`x`, `y`), with no outline, in the gray `gray`, from 0 (black) to 1 (white).
- Every number is **finite** (not `NaN` or `Infinity`) and from −32,767 to 32,767, the practical
  limit PDF readers handle (ISO 32000-1, Annex C); `size`, the line's `width` and the box's `width`
  and `height` are greater than 0. Positions may be off the page (it's allowed; it's just not seen).
  So no number is ever written in exponent form (`1e+21`).

**Characters a PDF can show.** The text is written in the **WinAnsi** character set (Windows'
standard Western character set, code page 1252, which PDF names `WinAnsiEncoding`), which every
reader supports for the standard fonts. Version 1 allows:
- the printable ASCII characters, codes 32 (space) to 126 (`~`);
- the characters of codes 160 to 255, which are the same in WinAnsi and in Unicode (Latin-1), among
  them `µ` (181), `°` (176), `±` (177), `×` (215), `é` (233) and the no-break space (160);
- the 27 characters WinAnsi has at codes 128 to 159, common in text pasted from Word or Excel
  (2026-11-08), each written as its WinAnsi code: `€` 128, `‚` 130, `ƒ` 131, `„` 132, `…` 133, `†`
  134, `‡` 135, `ˆ` 136, `‰` 137, `Š` 138, `‹` 139, `Œ` 140, `Ž` 142, `‘` 145, `’` 146, `“` 147,
  `”` 148, `•` 149, `–` 150, `—` 151, `˜` 152, `™` 153, `š` 154, `›` 155, `œ` 156, `ž` 158, `Ÿ` 159
  (Unicode U+20AC, U+201A, U+0192, U+201E, U+2026, U+2020, U+2021, U+02C6, U+2030, U+0160, U+2039,
  U+0152, U+017D, U+2018, U+2019, U+201C, U+201D, U+2022, U+2013, U+2014, U+02DC, U+2122, U+0161,
  U+203A, U+0153, U+017E, U+0178).

Anything else (a tab, a line break, `→`, `α`, emoji) isn't allowed: WinAnsi lacks it. `toPdfText(text)` (section 4) gives a copy of any text with each such character
replaced by `?`, for callers showing what users typed.

### Output
The PDF, as text: plain ASCII only (section 2), ready to save as a `.pdf` file or to go into a zip.
The same inputs always give the same text: the module never reads the clock, and writes no date or
ID into the file.

### The format
The file has, in order (ISO 32000-1, section 7.5):
1. **The header:** `%PDF-1.4` and a line break.
2. **The objects**, numbered from 1, each written `<n> 0 obj`, a line break, the object, a line
   break, `endobj`, a line break:
   1. The **catalog**: `<< /Type /Catalog /Pages 2 0 R >>`.
   2. The **page tree**: `<< /Type /Pages /Kids [<each page object's reference>] /Count <pages> >>`.
   3. The regular font: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding
      /WinAnsiEncoding >>`.
   4. The bold font: the same with `/Helvetica-Bold`.
   5. Then, for each page in order, two objects: its **content stream** (the drawing instructions),
      `<< /Length <bytes> >>`, a line break, `stream`, a line break, the instructions, a line break,
      `endstream`; then the **page**, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 <width>
      <height>] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents <its content stream's
      reference> >>`. `/Length` counts the instructions' bytes only, not the line breaks around
      them.
3. **The cross-reference table** (`xref`), which tells a reader where each object starts: `xref`,
   `0 <objects + 1>`, then the entry for object 0, `0000000000 65535 f ` and a line break, then one
   entry per object, its **byte offset** from the start of the file in 10 digits with leading
   zeros, ` 00000 n ` and a line break. Each entry is exactly 20 bytes, so the line break is
   `\n` preceded by the trailing space (ISO 32000-1, 7.5.4).
4. **The trailer:** `trailer`, `<< /Size <objects + 1> /Root 1 0 R >>`, `startxref`, the byte offset
   of `xref`, and `%%EOF`, each on its own line, ending with a line break.

Line breaks are `\n` throughout.

**The drawing instructions** of a page, one per line, for each item in order:
- Text: `BT /F1 <size> Tf <x> <y> Td (<text>) Tj ET` (`/F2` when bold). Inside the parentheses, `\`,
  `(` and `)` are each preceded by `\`, and every character outside printable ASCII is written as
  `\` and its WinAnsi code in three **octal** (base-8) digits, e.g. `µ` (181) as `\265`, `–` (150)
  as `\226`, so the file stays ASCII. `""` gives no instruction.
- A line: `<width> w <x1> <y1> m <x2> <y2> l S`.
- A box: `<gray> g <x> <y> <width> <height> re f 0 g` (the final `0 g` sets black again for what
  follows).

The instructions are joined with `\n`, with none after the last, so an empty page's content stream
has `/Length 0`.

**Numbers** are written with at most 3 digits after the decimal point, without trailing zeros or a
trailing point, and without a minus sign on zero: `612`, `12.5`, `0.333` for 1/3, `0` for -0.0001.

### Measuring text
`textWidth(text, size, bold)` gives how wide `text` is in points when drawn: the sum of each
character's **advance width** (how far the pen moves after it) in the font, in thousandths of the
size, times `size` ÷ 1000. The widths are Helvetica's and Helvetica-Bold's published **font metrics**
(Adobe's AFM files for the standard 14 fonts), kept in the module as data for every character the
PDF can show. The AFM files have no entry for the no-break space (160) or the soft hyphen (173):
they take the space's width (278) and the hyphen's (333). Examples (thousandths): `A` 667 regular, 722 bold; `W` 944 both; `i` 222 regular, 278
bold; space 278; `0` 556; `µ` 556 regular, 611 bold; `°` 400; `×` 584. So `textWidth("Deep1", 10,
false)` is 29.46.

The builder may take the widths for codes 32 to 126 and 161 to 255 from PyMuPDF
(`pymupdf.get_text_length(c, fontname="helv", fontsize=1000)`, `"hebo"` for bold), which carries the
same metrics; the tests check the examples above. **PyMuPDF doesn't give the codes 128 to 159
right** (it returns 278 for all of them), so their widths, regular / bold, are these, from the AFM
files: `€` 556/556, `‚` 222/278, `ƒ` 556/556, `„` 333/500, `…` 1000/1000, `†` 556/556, `‡`
556/556, `ˆ` 333/333, `‰` 1000/1000, `Š` 667/667, `‹` 333/333, `Œ` 1000/1000, `Ž` 611/611, `‘`
222/278, `’` 222/278, `“` 333/500, `”` 333/500, `•` 350/350, `–` 556/556, `—` 1000/1000, `˜`
333/333, `™` 1000/1000, `š` 500/556, `›` 333/333, `œ` 944/944, `ž` 500/500, `Ÿ` 667/667.

## 4. Interface
The module exports three functions. None changes its inputs.

| Function | Takes | Returns | Throws |
|---|---|---|---|
| `writePdf(pages)` | the pages (section 3) | the PDF, as ASCII text | if the pages aren't valid (section 5); nothing is returned then |
| `textWidth(text, size, bold)` | text the PDF can show, a size greater than 0, `true` or `false` | its width in points, e.g. `textWidth("Deep1", 10, false)` → 29.46 | if the text has a character the PDF can't show, or the size or bold isn't valid (section 5) |
| `toPdfText(text)` | any text | a copy with each character the PDF can't show replaced by `?`, e.g. `"Drug → plate"` → `"Drug ? plate"` | if `text` isn't text |

Example:
```js
const text = writePdf([
  {
    width: 612,
    height: 792,
    items: [
      { kind: "box", x: 54, y: 700, width: 504, height: 18, gray: 0.92 },
      { kind: "text", x: 58, y: 705, text: "Your label", size: 10, bold: true },
      { kind: "line", x1: 54, y1: 690, x2: 558, y2: 690, width: 0.3 },
    ],
  },
]);
// text starts "%PDF-1.4\n" and ends "%%EOF\n".
```

### The REPL
`scripts/repl.js` gains a topic, `pdf` (CLAUDE.md, "Keep the REPL complete"), with `writePdf`,
`textWidth` and `toPdfText`, and the section 4 example ready to try, e.g. `textWidth("Deep1", 10,
false)`.

## 5. Errors
Each message says what's wrong and how to fix it. Values are shown with `describeValue`
(`error-messages` module). These are mistakes in the calling code, not in what a user typed: callers
pass users' text through `toPdfText` first.

| Problem | Message |
|---|---|
| `pages` isn't a list, or is empty | `The pages of a PDF must be a list of at least one { width, height, items }, but got null.` |
| A page isn't an object with exactly `width`, `height` and `items` | `Page 2 must be an object with exactly "width", "height" and "items".` |
| A page's width or height isn't a number greater than 0 and at most 14,400 | `Page 2's width must be a number of points greater than 0 and at most 14400, but got 0.` |
| `items` isn't a list | `Page 2's items must be a list, but got null.` |
| An item isn't an object whose `kind` is `"text"`, `"line"` or `"box"` | `Page 2, item 3, must be an object whose kind is "text", "line" or "box", but got "circle".` |
| An item hasn't exactly its kind's properties | `Page 2, item 3 (text), must have exactly "kind", "x", "y", "text", "size" and "bold".` |
| A position isn't a finite number | `Page 2, item 3's x must be a number, but got "54".` (also `NaN` and `Infinity`) |
| A position isn't from −32,767 to 32,767 | `Page 2, item 3's x must be from -32767 to 32767 points, but got 40000.` |
| A size, width, height or line width isn't a finite number greater than 0 (and at most 32,767) | `Page 2, item 3's size must be a number greater than 0 and at most 32767, but got 0.` |
| `gray` isn't a number from 0 to 1 | `Page 2, item 3's gray must be a number from 0 (black) to 1 (white), but got 1.5.` |
| `bold` isn't `true` or `false` | `Page 2, item 3's bold must be true or false, but got "yes".` |
| `text` isn't text | `Page 2, item 3's text must be text, but got 5.` |
| `text` has a character the PDF can't show | `Page 2, item 3's text, "Drug → plate", has "→", which a PDF's standard fonts can't show here: pass it through toPdfText first.` (a tab or line break is named as `a tab` or `a line break`) |
| `textWidth`: text, size or bold not valid | `The text to measure must be text, but got 5.` / `The text to measure, "→", has "→", which a PDF's standard fonts can't show here: pass it through toPdfText first.` / `The size to measure at must be a number greater than 0 and at most 32767, but got 0.` (also `Infinity`) / `Bold must be true or false, but got "yes".` |
| `toPdfText`: not text | `The text for a PDF must be text, but got 5.` |

Pages and items are numbered from 1, in the order given. The list is checked first, then each page
in order (its form, its width, its height, its items' list), then each of its items in order (its
kind, its properties, then each value in the order of its properties above). The first problem found
is reported.

## 6. Test cases
Each becomes at least one unit test in `pdf.test.js`, inside `describe("pdf", …)`. Each row of
section 5 has at least one test.

**The structure**
- A PDF of one empty page (`items: []`) starts `%PDF-1.4\n`, ends `%%EOF\n`, and has 6 objects in
  section 3's order; one of three pages has 10, its page tree listing the three page objects in
  order with `/Count 3`.
- Every entry of the cross-reference table is 20 bytes, and each offset points at the start of its
  object's `<n> 0 obj` line; `startxref` gives the offset of `xref`.
- Each content stream's `/Length` equals the bytes between its `stream\n` and `\nendstream`.
- The page's `/MediaBox` holds its width and height.
- The whole output is plain ASCII (only codes 9, 10, 13 and 32 to 126), including for text with `µ`.
- The same pages give identical text twice, and the pages are unchanged afterwards.

**The instructions**
- A text item gives `BT /F1 10 Tf 58 705 Td (Your label) Tj ET`; bold gives `/F2`; `""` gives
  nothing.
- `\`, `(` and `)` are escaped: `a(b)\c` → `(a\(b\)\\c)`; `µ` → `\265`, `°` → `\260`, `é` → `\351`.
- A line gives `0.3 w 54 690 m 558 690 l S`; a box gives `0.92 g 54 700 504 18 re f 0 g`.
- Numbers: `612` → `612`, `12.5` → `12.5`, `1/3` → `0.333`, `2/3` → `0.667`, `-0.0001` → `0`,
  `1e-7` → `0`, `-3.25` → `-3.25`, `32767` → `32767`.
- `–` gives `\226`, `“` `\223`, `€` `\200`; an empty page's content stream has `/Length 0`.
- Items are written in the order given.

**Measuring and cleaning text**
- `textWidth` gives the section 3 examples: each listed character at size 1000, regular and bold,
  and `"Deep1"` at 10 regular → 29.46 (to within 0.001), `"Feeding DWP"` at 10 bold → 64.45.
- `textWidth("", 10, false)` is 0.
- `toPdfText` keeps `"Res A"`, `"µL"`, `"Zürich ± 5 °C"` and `"“Drug” – 5 €"` as they are, and gives
  `"Drug ? plate"` for `"Drug → plate"`, `"a?b"` for a tab between `a` and `b`, `"??"` for `"α😀"`
  (an emoji counts as one character, not two halves).
- `textWidth("–", 1000, false)` is 556 and `textWidth("“", 1000, true)` is 500 (from the table, not
  PyMuPDF); the no-break space is 278.

**A check by a reader**
- `tests/fixtures/pdf-sample.pdf` is a **golden file** (CLAUDE.md, "Testing"): the PDF of the example
  in section 4 plus a text item `"Volume: 50 µL (A1)"` at (58, 680), size 12, regular. Before it's
  saved, it's checked with two independent readers (PyMuPDF and Poppler's `pdftotext`), each
  reading the text back exactly; its notes, `tests/fixtures/pdf-sample.md`, say who checked it and
  when, and that Andy's check in Edge (his test of the pull request) is still to come until he's
  done it. If either reader isn't installed, install it (`pip install pymupdf`; Poppler's
  `pdftotext`) or, failing that, say so in the notes and in the pull request.
  The test reads the fixture as bytes and compares them exactly with the output's ASCII bytes.
  **`.gitattributes` gains `*.pdf -text`**, as `*.csv` has, so Git never changes the golden file's
  line endings on a Windows checkout (they'd move every offset). `writePdf` with those pages must give
  exactly its text. It's never regenerated or edited to make a test pass.

**Refusing** (section 5)
- Each row gives its message, with at least: `null`, `[]` and `"pages"` for the list; a page missing
  `items`; widths `0`, `-1`, `14401`, `"612"`; a kind `"circle"`; a text item missing `bold`; an x of
  `"54"`, `NaN`, `Infinity`, `40000` and `1e21`; sizes `0`, `-1` and `Infinity`; gray `1.5` and `-0.1`; bold `"yes"`; text `5`,
  `"→"`, a tab and a line break.
- Order of checks: page 1's bad item is reported before page 2's bad width (pages in order, each
  in full); an item's kind before its properties; its properties before its values.
