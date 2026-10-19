# randomizer page — specification

## 1. Purpose
The randomizer's page: the screen people use. This specification covers all three page files:
`randomizer.html` (structure), `randomizer.css` (styling) and `randomizer-page.js` (behavior).

The page has no randomizer logic of its own. It reads the inputs from the screen, passes them to
`randomizer.js` as the inputs object in `randomizer.md` (section 8), and shows what comes back. The
rules for the inputs, the assignment, the outputs and the error messages are in `randomizer.md`.

## 2. Scope
To keep the first build simple, each input has **one way to enter it**.

Not in version 1 (see `docs/roadmap.md`): pasting conditions from Excel, a "fix the outer ring"
shortcut, and a button for a new random seed.

## 3. Entering the inputs
- **Conditions**: the user types conditions in a table, one row at a time, and can edit, add or
  remove rows.
- **Fixed and open wells**: the user clicks wells on a drawn plate to mark them fixed or open, one
  well at a time. When the page opens, no wells are fixed.
- **Overrides**: an override is added only by clicking a fixed well, takes effect only once its name
  is typed and confirmed, and is removed if its name is cleared. Opening a fixed well removes its
  override.
- **Seed**: when the page opens, the seed box holds a random suggestion (using `Math.random()`); the
  user can keep it or type another.

## 4. Checking the inputs
The page runs the check (`findProblems`) after every change (typing, clicking a well, editing the
seed) and shows the messages beside the Randomize button, which stays disabled until the list is
empty. The messages are guidance for what is still needed, so they are shown as a calm,
plain-language to-do list (e.g. "Name the contents of the fixed wells."), not as alarming errors.

## 5. Showing the results
After randomizing, the page shows:
- **The randomized plate**: a drawn 96-well plate showing every well's contents, with each well's
  type shown (e.g. by shading).
- **The seed** used.
- **The two lists** (contents → wells and well → contents), each with its column headings on
  screen and a **Copy** button that copies the list's copy text (`randomizer.md`, section 6).

## 6. Not yet decided
To be settled here before the page is built:
1. The overall arrangement of the screen.
2. How clicking a well works: clicking marks a well fixed or open, but clicking a fixed well is also
   how an override is added.
3. Whether the result is shown on the same plate drawing as the inputs or on a second one.
4. What happens when an input changes after randomizing, so the result shown no longer matches the
   inputs.
