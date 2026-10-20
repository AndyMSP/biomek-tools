# randomizer page — specification

## 1. Purpose
The randomizer's page: the screen people use. This specification covers all three page files:

| File | Job |
|---|---|
| `randomizer.html` | The page's structure: the boxes, buttons and plate grids. |
| `randomizer.css` | The page's styling, including the colors in section 7. |
| `randomizer-page.js` | The page's behavior: reads the inputs, calls `randomizer.js`, draws the results and copies text to the clipboard. |

The build step joins the page files and the modules they use into one file.

The page has no randomizer logic of its own. It keeps the inputs object described in `randomizer.md`
(section 8), changes it through that module's functions, and shows what comes back. The rules for
the inputs, the assignment, the outputs and the error messages are in `randomizer.md`. Anything that
can be described without mentioning the screen belongs there, not here.

A design mockup was made while settling this specification. It is a picture of the intent only;
where they differ, this specification is right.

## 2. Scope
To keep the first build simple, each input has **one way to enter it**. On the plate, a click and a
drag are the same action: a click is a box of one well.

Not in version 1 (see `docs/roadmap.md`): pasting conditions from Excel, a "fix the outer ring"
shortcut, a button for a new random seed, and undo.

## 3. Layout
Two columns, with the results below them across the full width:

| Where | What |
|---|---|
| Left column | The randomized-contents table, the fixed-contents table, the seed box, the to-do list and the Randomize button, in that order. |
| Right column | The input plate (section 5). |
| Below both | The results (section 8). |

In a narrow window the columns stack: the left column first, then the plate, then the results. The
plates scroll sideways inside their own box rather than shrinking the wells.

## 4. Entering the inputs

### Randomized contents
A table headed **Randomized contents**, with columns **#**, **Name** and **Replicates**. Each row is one
condition (the logic's word; the screen says "randomized contents" because the table also holds the
filler).
- Rows are numbered from 1, matching the logic's messages (`Row 3: …`).
- The user can type in any row, add a row with **+ Add row**, and remove a row.
- The **last row is always the filler**: it has a name box but no replicates box, and in place of a
  replicate count it shows how many wells it will fill, e.g. `Fills 12 spare wells`, `Fills 1 spare
  well` or `No spare wells`, from `spareWellCount` (`randomizer.md`, section 4); while that is
  `null` (a replicate count isn't valid yet) the cell is empty. It looks different from the condition rows (its own background and a
  dashed line above it), has no number, and can't be removed. A note under the table says: `The last
  row is the filler: it is shuffled in with the replicates and fills every spare open well.`
- When the page opens there is one empty condition row and an empty filler.

### Fixed contents
A table headed **Fixed contents**, one line per fixed-contents entry (`randomizer.md`, section 4),
with: a choice button for **placing**, the entry's color, its number, its name box, how many wells it
holds (e.g. `34 wells`), and **Remove**.
- Exactly one entry is **being placed** at a time: the user chooses it with its choice button, or by
  clicking into its name box. Its line is highlighted.
- **+ Add fixed contents** adds an empty entry and makes it the one being placed.
- Renaming an entry is typing in its name box; its wells keep the new name.
- **Remove** takes the entry out of the list, so its wells become open.
- Entries are numbered from 1, matching the logic's messages (`Fixed contents 2 …`).
- When the page opens there is one empty entry, being placed, and no wells are fixed.

### Seed
When the page opens, the seed box holds a random suggestion, `randomSeed(Math.random())`
(`randomizer.md`, section 4); the user can keep it or type another.

### Passing the inputs on
Replicates and the seed typed as digits are passed as numbers, and anything else as the text typed,
so the logic can report it (e.g. `but got "four"`).

## 5. The input plate
A drawn 96-well plate with row letters and column numbers. Each well is a button.

**Placing and opening.** A press on one well and a release on another (possibly the same well) makes
a box, from `wellsInBox` (`well-grid` module):
- If the well where the press **started** holds the entry being placed, every well in the box is
  opened (`openWells`).
- Otherwise every well in the box gets the entry being placed (`placeName`), including wells that
  held another entry.

So a click on an open well places the entry, and a click on a well that already holds it opens it
again.

**While dragging**, the plate shows each well in the box as it will be after release (a preview);
nothing changes until release. Dragging back over wells already passed shows them as they were.
Dragging uses pointer events, so it works with a mouse, a pen or a finger.

**Keyboard.** Tab moves between wells, and Enter or Space acts as a click on the focused well.

**No entry to place.** If there are no fixed-contents entries, pressing a well shows the note
`Add fixed contents first, then click wells to place it.` and changes nothing.

**What each well shows.**
- An open well is white with its well name.
- A fixed well is filled with its entry's color (section 7), has a dark outline, and shows a short
  label: the name, cut to about six characters. Hovering shows the well and the full name.
- Above the plate: `N fixed · N open`.
- Each well's button is labeled for screen readers, e.g. `A1, fixed, Static` or `B2, open`.

## 6. Checking the inputs
The page runs the check (`findProblems`) after every change (typing, placing or opening wells,
adding or removing a row or entry, editing the seed) and shows the messages beside the Randomize
button, which stays disabled until the list is empty. The messages are guidance for what is still
needed, so they are shown as a calm, plain-language to-do list headed **Still needed** (e.g.
`12 open wells are left over. Name a filler for them.`), not as alarming errors. When the list is
empty, it says `Ready to randomize.`

## 7. Colors
Each name gets a color from `listingOrder` (`randomizer.md`, section 6): its **role** picks a set of
colors and its **position** picks the color within that set, wrapping around if there are more
names than colors. Because positions count within each role, adding a condition doesn't change any
filler or fixed-contents color. A fixed name that matches a condition takes the condition's color.
The same name has the same color on the input plate, in the fixed-contents table, on the result plate
and in its legend.

| Role | Colors (fill / text) |
|---|---|
| condition | `#4E79A7`/white, `#F28E2B`, `#59A14F`, `#E15759`, `#B07AA1`, `#EDC948`, `#76B7B2`, `#FF9DA7`, `#9C755F`/white, `#A0CBE8`, `#FFBE7D`, `#8CD17D`, `#D37295`, `#D4A6C8`, `#499894`, `#F1CE63` |
| filler | `#F2EDE3` |
| fixed | `#8A99A8`, `#B3A78F`, `#9C9AC2`, `#93AE97`, `#BE9A9A`, `#A9A9A6` |

Text is `#1C1C1A` unless marked white. An entry with no name yet is gray (`#D9D7CF`). The colors are
defined once, in `randomizer.css`, as named CSS variables.

## 8. Showing the results
After randomizing, the results section below the two columns shows:
- **The result plate**: a second drawn plate, so the input plate stays as set up. Each well is filled
  with its contents' color and shows a short label, the name cut to about six characters, as on the
  input plate; hovering shows the well and the full name. Randomized wells
  (replicate and filler) are plain circles, and fixed wells have the same dark outline as on the
  input plate.
- **A key** for the two well kinds (`Randomized well`, `Fixed well`) and **a legend** listing each
  contents with its color, its full name and its number of wells, in the order of the contents →
  wells list.
- **The seed** used (`result.inputs.seed`).
- **The two lists** (contents → wells and well → contents), each with its column headings on screen
  and a **Copy** button that copies the list's copy text (`randomizer.md`, section 6). After copying,
  the button says `Copied` until something changes.

Before the first Randomize, the section says `Press Randomize to see the randomized plate and the two
lists.`

### Out-of-date results
After every change, the page checks `matchesInputs(result, inputs)`. While it is `false`:
- A banner above the results says: **Out of date.** `The inputs have changed since this result was
  made, so it no longer matches them. Copying is turned off. Press Randomize to make a new result,
  or undo the change.`
- The result plate, legend and lists are faded and grayed, and their text can't be selected.
- Both Copy buttons are disabled.

When the inputs match again (e.g. a change is typed back), the result is shown normally. Pressing
Randomize replaces the result.

## 9. Testing
The page isn't unit-tested in Node; everything it decides is in `randomizer.js` and the shared
modules, which are. Before each release, check by hand in Edge and Chrome, opening the built file:
- each item in sections 4–8 behaves as described;
- clicking and dragging in all four directions, and starting a drag on a well that already holds the
  entry;
- the out-of-date banner appears after a change and goes away after changing it back;
- the copied text pastes into Excel as two columns.

## 10. Visual design
The page should look calm and be easy to scan. These values come from the design mockup; the page's
own colors and sizes are defined once, in `randomizer.css`, as named CSS variables.

**Panels.** The page background is a soft off-white (`#F6F5F1`). Each area is a white panel with a
thin border (`#E2E0D8`), rounded corners (10px) and generous padding (24px): one panel for the
inputs (left column), one for the input plate (right column) and one for the results. Panels are
24px apart.

**Type.** A font every lab PC already has, so the page works offline: `"Segoe UI", system-ui,
sans-serif` for text, and `Consolas, "Cascadia Mono", monospace` for well names and plate headings.
Sizes: the page title 28px bold, panel headings 17px semibold, list headings 15px semibold, body
text 14–15px, notes and small print 13px. Secondary text is gray (`#5E5E58`).

**Header.** The title `Plate randomizer` with `One 96-well plate` beside it in gray.

**Inputs panel**, top to bottom:
- Each table's heading, then its column headings in small gray text, then its rows. Text boxes are
  40px tall with a light border (`#CFCDC4`) and 6px corners.
- The filler row has a pale warm background (`#FBF4EA`), a dashed line above it (`#DDB58B`), and its
  `Fills N spare wells` in brown text (`#7A4E14`).
- The fixed-contents entry being placed has a pale blue background (`#EEF3FB`).
- `+ Add row` and `+ Add fixed contents` are light buttons with a dashed blue border (`#9DB7DB`) and
  blue text (`#2F5DA8`). Remove buttons are small and plain, so they don't compete with the inputs.
- The seed box, about 160px wide.
- At the bottom, a tinted box (`#F6F5F1`, 8px corners) holding the to-do list and, inside it, the
  Randomize button. `Ready to randomize.` is green (`#22603A`).

**Buttons.** Randomize is solid blue (`#2F5DA8`) with white bold text; when disabled it is gray
(`#D9D7CF`) with gray text. Every button is at least 36px tall (44px for Randomize and the add
buttons) so it is easy to click.

**Plates.** Wells are 40px circles, 4px apart, with row letters and column numbers in small gray
monospace text. An open well is white with a gray border (`#BDBDB5`) and its name in gray monospace.
Above the input plate: its heading on the left and `N fixed · N open` on the right.

**Results panel.** Its heading on the left and `Seed 48213` on the right. Below, two columns that
stack in a narrow window:
- Left: the result plate, then the key, then the legend.
- Right: the two lists, one above the other. Each has its heading with its Copy button at the right
  end of the same line, then the list in a box (border `#E2E0D8`, 6px corners) that scrolls when it is
  taller than 240px, with its column headings staying visible. List text is 13px, and well names are
  monospace.

**Out-of-date banner.** A pale red box (`#FCE9E7`, border `#E8A39B`, dark red text `#7A1F15`, 8px
corners) above the results, with **Out of date.** in bold.
