# tutorial page — specification

> **Draft (2026-11-08).** Written for item 29 of v0.2.0 in the hands-off workflow, from the preview
> Andy shaped on 2026-11-08 (ADR 0022). The choices made for Andy are listed in its pull request. It
> becomes Final once built and tested by Andy.

## 1. Purpose
The tutorial file's page: the transfer designer's own page with the **guide panel** over it
(`docs/glossary.md`). The panel shows the menu of tutorials and the current step, rings what to use
next, and moves on when the step is done. This specification covers the panel's files and the
build; the steps are in `tutorial.md`, the starting plans in `tutorial-plans.md`, and the hooks the
panel reads in `transfer-designer-page.md`, section 17.

| File | Job |
|---|---|
| `tutorial-page.js` | Imports the transfer designer's page script (so the page runs first, as in the Transfer Designer), then draws the panel and the ring, reading the page through its hooks. |
| `tutorial.css` | The panel's and ring's styling (section 8). |

## 2. Scope
Version 1 is section 3 to 9. Not in it: running unbuilt from `npm run serve` (roadmap, "Technical
debt"); remembering a sticky step's done state across a reload; jumping into the middle of a
tutorial (the preview's "Preview only: jump to" buttons were for Andy's testing, not part of the
tool).

## 3. The build
`scripts/build.js` builds a third file, `transfer-designer-tutorial-v<version>.html` (the tool name
`transfer-designer-tutorial` in the file name, ADR 0015's rule), from the transfer designer's HTML
with its title and `<html>` tag changed, both stylesheets, and `tutorial-page.js` as the script.
What the build makes, which files in `dist/` are earlier builds, and the tutorial's HTML are
specified in `scripts/build-tools.md`, a small module of the build's pure parts, with its tests.
`scripts/build-version.md`, section 3 ("What the build does"), says the build makes the files
`BUILD_ENTRIES` lists.

`README.md` lists the tutorial among the tools (`**Transfer Designer Tutorial**
(\`transfer-designer-tutorial-v….html\`): guided tutorials on the Transfer Designer's own page.`),
says the tutorial is tried by building it (it isn't served unbuilt), and describes `npm run
test:browser` under the tests: what it does, that it needs `npx playwright install chromium` once
unless Chrome is installed, and that it builds first if `dist/` has no tutorial file.

The page knows it's the tutorial from the `data-tutorial` attribute (`transfer-designer-page.md`,
section 17): its storage names and hooks follow from that.

## 4. State, storage and starting a tutorial
The panel keeps, in the browser's local storage (each read and write in `try`/`catch`: without
storage the panel still works, forgetting its place on reload):
- `biomek-tools tutorial: state`: `{ tutorial, step }`, the tutorial's ID (`tutorial.md`) and the
  step's index, or `{ tutorial: null }` for the menu. When the page opens, a state naming a tutorial
  or step that doesn't exist is taken as the menu.
- `biomek-tools tutorial: finished`: the IDs of the tutorials whose last step has been shown.
- `biomek-tools tutorial: position`: where the panel was dragged to, `{ left, top }` in px.

A stored value that isn't in its form (not JSON, a finished list that isn't a list, a position
whose `left` and `top` aren't numbers) is ignored, as if nothing were stored.

**Starting a tutorial** (its Start or Again button in the menu, or **Next tutorial** at the end of
the one before): the panel calls the page's `tutorialStartWith(startingPlanText(name,
tutorialSavedBy))` (`tutorial-plans.md`; `transfer-designer-page.md`, section 17), which puts the
plan in the page's browser copy, sets the state to that tutorial's step 0, and reloads the page. The page then brings
the plan back, as it always does on opening (message `Brought back the plan you were working on in
this browser.`), with the labware it uses out. For the `empty` plan, the panel calls `tutorialStartWith(null)`,
which removes the browser copy, so the page opens with its own empty plan.

**A sticky step's** done state (`tutorial.md`, section 3) is kept in memory: set when the step is
done while shown, cleared when the step is left.

## 5. The panel
The panel's outermost element has the attribute `data-tutorial-panel` (the page ignores presses
inside it, `transfer-designer-page.md`, section 17). A floating box (360px wide, at most 62% of the window's height or 540px, whichever is less), 16px
from the window's bottom and right edges at first, above everything on the page.
- **Header** (blue, `#1f5fae`, white text, 11px corners at the top): `Tutorial` (semibold), then, in
  a tutorial, `2. Checking your plan` and, past step 0, ` · step 3 of 12` (the step's index and the
  last step's index); then a `–` button at the right that folds the panel to its header (220px wide),
  becoming `+` to unfold it (tooltips `Hide the steps` / `Show the steps`). The header is the handle
  to **drag** the panel (section 6).
  Pressing `+` on a fold that keeping clear made unfolds it for the rest of the step (section 6).
- **A progress bar** under the header, 4px, filled to the step's index over the last step's.
- **Body**, scrolling inside the panel: the step's title (17px, semibold), its body rendered from
  step markup (`tutorial.md`, section 3), its copy button and checklist where it has them, then the
  **status line**: `Waiting for you to do this step…` (gray) while a step with `done` isn't done;
  `✓ Done. Press **Next**.` (green, semibold) once it is; nothing for a step without `done`.
- **Footer**: `All tutorials` at the left (back to the menu, keeping the plan as it is); `Back` and
  the main button at the right. `Back` is disabled at step 0. The main button reads `Start` at step
  0, `Next` once the step is done (pulsing briefly, three times), `Skip` while it isn't (quieter:
  white with a gray border), and at the last step `Next tutorial` if there's a next tutorial, else
  `All tutorials`. Next and Skip go to the next step; Back to the one before. After any press on a
  panel button, the button gives up keyboard focus (so a later Enter or Space typed for the page
  can't press it again).
- **The menu** (state `{ tutorial: null }`): title `Transfer Designer tutorials`; `Each tutorial
  builds on the one before, but brings its own starting plan, so you can start anywhere.`; then one
  row per tutorial, numbered, with its title (semibold), `✓ done` (green) if finished, its summary
  and `About N minutes.` (gray, smaller), and a button `Start`, or `Again` once finished; then `>
  Starting a tutorial replaces the practice plan. Real plans in the Transfer Designer are never
  touched.` The footer and progress bar are hidden on the menu. The page opens on the menu the first
  time.
- **The checklist**: each item `✓` (green) or `○` (gray) then its text, inline items separated by
  two spaces, others one per line.
- **The copy button** (`Copy this table`, an outlined blue button): on click, puts the step's `copy`
  text on the clipboard (`navigator.clipboard.writeText`, falling back to a hidden text area and
  `document.execCommand("copy")`), then shows `Copied.` (green) beside it, or `The browser didn't
  let the page copy. Try again.` if both fail.
- **Last step**: showing a tutorial's last step adds it to the finished list.

The panel redraws every 250 ms, and on scroll and resize, from a fresh view (`transfer-designer-
page.md`, section 17): it rereads `stepState` (`tutorial.md`) and, only when the step's rendered
body changes, replaces the body (so a copy button's `Copied.` and the reader's scroll aren't reset
between redraws while nothing changes).

## 6. The ring, and keeping clear
**The ring** marks its target element with the attribute `data-tutorial-target` (removed from the
element it marked before), so tests can find what's ringed. A 3px orange border (`#f59e0b`) with 8px corners and a soft orange halo that pulses
gently (1.4 s), 4px outside the target's box on every side (at least 6px tall), above the page and
below the panel, taking no clicks. It follows the target on each redraw (with a 150 ms glide); it's
hidden while the step is done, when the target is `null`, or when the hook finds no element or one
with no size.

**Keeping clear.** Until the reader drags the panel, after each redraw: if the panel covers the
target or any of the step's keep-clear elements (`tutorial.md`, section 3), it moves to the other
bottom corner (left or right) if that covers less, counting the target as 10 and each keep-clear
element as 1; if both corners cover as much, it stays, and folds to its header while it covers the
target, unfolding when it no longer would (a fold the reader made stays theirs). Pressing `+` on
such an automatic fold unfolds the panel and overrides keeping clear's fold until the step changes
(the reader chose to see the steps; they can still drag the panel aside).

**While a page dialog is open** (the transfer table wizard or the stock dialog, found through the
page's hook, `tutorialElement({ kind: "dialog" })`): if the room
between the dialog's bottom and the window's bottom, less 24px, is 160px or more, the panel fits
there (that room is its greatest height), at the bottom left; otherwise it shows **compact**: its
header, the step's title, its status line and its footer only, at the bottom left, with a `Show
steps` link that shows the full body over the dialog until the next press elsewhere. Either way the
dialog's main button (`dialogMain`) is never covered; the walk-throughs check it.

**Dragging**: pressing on the header (not its button) and moving drags the panel, kept inside the
window; letting go stores its place (section 4), and from then on keeping clear is off. A stored
place is used when the page opens.

**Staying reachable.** The page's dialogs make everything else on the page unreachable while open
(the `inert` attribute on the body's other children; `transfer-designer-page.md`, section 7). The
panel is one of those children: whenever its `inert` is set, the panel clears it at once (watching
for it), so the reader can follow the steps, and press Next, with a dialog open. The ring is never
inert-sensitive (it takes no clicks).

## 7. Messages
The panel shows none of its own in the page's message bar: everything it says is in the panel.

## 8. Visual design
In the page's fonts (the page's `--text-font`). Panel: white, a 1px `#9db7db` border, 12px corners,
the shadow `0 10px 30px rgba(20, 40, 70, 0.22)`. Body text 14px, line height 1.45; notes 13px
`#5a6878`; warnings 13px `#8a1c1c` on `#fdeeee` with a 1px `#f1c4c4` border, 6px corners; code
13px on `#eef3fa`, 4px corners; keys 12px, a 1px `#b9c6d6` border, 2px at the bottom, 4px corners,
on `#f7f9fc`; tables 13px, 1px `#d5dde8` cell borders, header cells semibold on `#eef3fa`. Footer
buttons 13px, 6px corners, 5px × 12px padding: plain ones white with a `#9db7db` border and
`#1f5fae` text; the main button solid `#1f5fae`. The menu's Start buttons solid `#1f5fae`.

## 9. Testing
**Unit tests** are in `tutorial.test.js` and `tutorial-plans.test.js`. The panel's own code is
tested in the browser:

**Browser walk-throughs** (`tests/browser/tutorial.walk.js`, run by `npm run test:browser`; not by
`npm test`, whose `node --test` runs only `*.test.js`): with Playwright (`playwright`, a development
dependency, Andy's OK of 2026-11-08), against the built tutorial file in `dist/` (built first by
the script if missing). Before the page loads, the walk-through removes
`window.showSaveFilePicker` (Playwright's `addInitScript`), so Save and Write files fall back to an
ordinary download, which it accepts; and it grants `clipboard-read` and `clipboard-write`. For each
tutorial, starting it from the menu in a fresh browser context, the walk-through does each step as a
user would (clicks, drags, typing, right-clicks, Ctrl-clicks, the clipboard, the wizard and the
randomization card). **Before** doing a step with a target, it checks the element marked
`data-tutorial-target` is the one the step names (by its kind: e.g. a well's `data-labware` and
`data-well`) and that the ring lies over it; **after**, that the status line says `✓ Done`; then it
presses Next. With a dialog open, it checks the dialog's main button isn't covered by the panel. Also: **Next tutorial** from each tutorial's last step starts the
next; tutorial 2 started from the menu holds `firstRunDone`; the real Transfer Designer storage name
is never written; no page error is thrown. At two window sizes: 1500 × 950 and 1366 × 768. It uses
Chrome if installed (`channel: "chrome"`), else Playwright's own Chromium.

**By hand**, before each release, in Edge and Chrome, opening the built file: go through each
tutorial once; check that the ring is on the right thing at each step and that the panel never
covers what the step needs; and check that these labels, which the steps name, still read the same
on the page: `Name this experiment`, `Biomek files`, `Write files`, `Save`, `Open`, `Undo`, `Start`,
`End`, `+ New`, `Contains`, `+ Add`, `Show transfers ▸`, `Mode`, `Mix`, `Aspirate`, `Dispense`,
`Non-Contact`, `Slow`, `Probes`, `Remove`, `Names`, `Shown on deck`, `Possible traces`,
`Concentrations`, `1 Table`, `Next`, `Add`, `Update`, `Name`, `Sources`, `Wells to fill`, `All
sources`, `Filler`, `Volume`, `Seed`, `Randomize`, `needs update`, `Records`.

**Unit tests of the build** are in `scripts/build-tools.test.js` (`build-tools.md`).
