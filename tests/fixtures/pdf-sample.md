# pdf-sample.pdf — golden file for the pdf module

The PDF of one US Letter page (612 × 792 points) holding, in order (`src/shared/pdf/pdf.md`,
section 6, "A check by a reader"):
- a box `{ kind: "box", x: 54, y: 700, width: 504, height: 18, gray: 0.92 }`;
- a text item `{ kind: "text", x: 58, y: 705, text: "Your label", size: 10, bold: true }`;
- a line `{ kind: "line", x1: 54, y1: 690, x2: 558, y2: 690, width: 0.3 }`;
- a text item `{ kind: "text", x: 58, y: 680, text: "Volume: 50 µL (A1)", size: 12, bold: false }`.

It is 857 bytes of plain ASCII, with `\n` line breaks; `µ` is written `\265` and the parentheses
`\(` and `\)`.

**How it was made:** on 2026-11-08, by a short Python script written from `pdf.md`, section 3 (not
from `pdf.js`), so that the module's own code doesn't make the file it's tested against. The
module's output for the same pages then matched it byte for byte.

**How it was checked**, before it was saved here (2026-11-08, by Claude Code):
- PyMuPDF (MuPDF): opened without repair or warnings; one page, 612 × 792; the text read back
  exactly as `Your label` (Helvetica-Bold, 10) and `Volume: 50 µL (A1)` (Helvetica, 12).
- Poppler's `pdftotext` and `pdfinfo`: no errors; one page, "612 x 792 pts (letter)"; the text read
  back exactly as `Your label` and `Volume: 50 µL (A1)`.
- `qpdf --check`: "No syntax or stream encoding errors found".

**Still to come:** Andy's check in Edge (his test of the pull request): the page opens, shows a
gray band behind a bold `Your label`, a thin line under it, and `Volume: 50 µL (A1)` with the `µ`
showing right. Update this note when it's done.

`.gitattributes` has `*.pdf -text`, so Git never changes its line endings (which would move every
byte offset in the file). It is never regenerated or edited to make a test pass (CLAUDE.md,
"Testing").
