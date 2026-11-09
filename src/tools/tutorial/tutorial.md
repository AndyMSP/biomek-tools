# tutorial — specification

> **Draft (2026-11-08).** Written for item 29 of v0.2.0 in the hands-off workflow (CLAUDE.md,
> "Workflows"), from the preview Andy shaped on 2026-11-08 ("Preview: Transfer Designer Tutorial";
> ADR 0022). The choices made for Andy are listed in its pull request. It becomes Final once built
> and tested by Andy.

## 1. Purpose
`tutorial.js`, the tutorials' logic: the five **tutorials** (`docs/glossary.md`), each a list of **steps**, and for
each step its text, its checklist, what the page should ring, and when it's done. It holds no page
code: every step is plain data and pure functions of a **view**, a plain description of what the
transfer designer's page shows, which the guide panel gets from the page's hook
(`transfer-designer-page.md`, section 17) and passes in. So every step can be tested in Node.

The guide panel (`tutorial-page.md`) draws the steps; the starting plans come from
`tutorial-plans.md`. ADR 0022 says why the tutorials run over the real page.

## 2. Scope
Version 1 is five tutorials: Your first run, Checking your plan, Making conditions, Transfer
tables, Randomizing a plate (section 6). Not in version 1: tutorials on mix steps, copying a deck,
moving wells, moving and copying stages, osmolality or sharing tips between a randomization's
sources (Andy, 2026-11-08: not now; a tutorial each may follow); translations.

## 3. Data model

### A tutorial
`{ id, title, summary, minutes, startPlan, steps }`:
- `id`: a short ASCII name, e.g. `"first-run"`, unique, never shown.
- `title`, `summary`: text for the menu (section 6).
- `minutes`: a whole number, about how long it takes, shown as `About 10 minutes.`
- `startPlan`: the name of its starting plan in `tutorial-plans.md` (e.g. `"empty"`).
- `steps`: its steps, in order. The **first** is its introduction and the **last** its closing
  screen; neither has a `done`.

### A step
`{ title, body, checklist?, target?, done?, sticky?, keepClear?, copy? }`:
- `title`: text.
- `body(view)`: the step's text in **step markup** (below), a function of the view so it can show
  counts such as `Cell transfers so far: 7.`. A step whose text never changes may be a plain string.
- `checklist(view)` (optional): a list of `{ done, text }`, `text` in step markup's inline forms,
  drawn as a row (`inline: true`) or one per line (`inline` false or left out): `{ inline, items }`.
- `target(view)` (optional): the **target** (below) to ring, or `null` for none. The panel rings it
  while the step isn't done; a step without `done` keeps its ring until it's left (it points at
  what to look at).
- `done(view)` (optional): `true` once the step is done. A step without one is done as soon as it's
  shown (the reader reads it and presses Next).
- `sticky` (optional, `true`): once `done` has been `true` while the step is shown, it stays done
  until the step is left, even if `done` turns `false` again. For steps done by **looking**: the
  contents card shows only while the pointer is on a well.
- `keepClear(view)` (optional): targets the panel should avoid covering besides its target (the
  panel's own rule, `tutorial-page.md`, section 6). Left out: every labware block that's out
  (`{ kind: "labware" }` for each name in `labwareOut`).
- `copy` (optional): `{ label, text }`, a button in the step that puts `text` on the clipboard, for
  practice tables (section 6).

### Step markup
Text with a few marks, so steps say nothing about HTML:
- Blocks separated by a blank line. A block whose lines start `1. `, `2. `… is a **numbered list**;
  `- ` a **bulleted list**; `> ` a **note** (smaller, quieter); `! ` a **warning** (red text on a
  pale red ground); `| ` a **table** (cells split by ` | `, the first row a header); anything else a
  **paragraph**.
- Inline: `**bold**`, `` `code` `` (code-styled, e.g. a name to type), `[Key]` (a key, drawn as a
  keyboard key, e.g. `[Ctrl]+[V]`, `[Enter]`), `✎`, `‹`, `›`, `⟳` as written.
- In a table, an empty cell is nothing between two separators (`| Control | 1000 |  |  |`).
- Everything else is plain text; the panel never reads markup as HTML.

`parseMarkup(text)` (section 4) turns markup into a list of blocks, `{ kind: "paragraph" | "numbered"
| "bulleted" | "note" | "warning" | "table", … }`, each list or table holding its items or rows, and
each piece of text a list of inline runs, `{ kind: "text" | "bold" | "code" | "key", text }`. The
panel draws blocks; it never parses.

In section 6 below, each body is given as markup between backticks, its blocks separated by ` / `
(a new block, or a new list item); inside it, \` stands for one backtick of the code mark, so
\`Practice1\` is the markup `` `Practice1` ``.

### The view
What the page shows, from its hook (`transfer-designer-page.md`, section 17), or `null` before the
page has drawn. Fields:
- `plan`: the plan, as the transfer designer's logic holds it (`transfer-designer.md`).
- `open`: what's open in the Stages column: `"start"`, a stage's ID, `"end"`, or a randomization's
  ID while its card is open.
- `labwareOut`: the names of the labware out, e.g. `["Res1", "Plate1"]`.
- `message`: `{ text, kind }` of the message bar, or `null` when it's empty.
- `problemCount`: the problem count's number (section 6 of the page's specification).
- `pointedWell`: `{ labware, well }` whose contents card is showing, or `null`.
- `editingBox`: `{ kind, key }` of the open editing box (`"stage"`, `"tip"`, `"component"`), or
  `null`.
- `addingComponent`: `true` while the Start card's `+ New` box is open.
- `transferListsShown`: the IDs of the stages whose transfer list is shown.
- `headerBox`: `"biomek"`, `"reset"` or `null`.
- `dialog`: `null`, or `{ kind: "wizard", step: "table" | "sources" | "review", hasTable }` for
  the transfer table wizard, or `{ kind: "stocks", hasTable }` for the stock dialog; `hasTable` is
  whether a table has been pasted into it.
- `randomizationCard`: `null`, or for the open card `{ id, tab: "sources" | "fill", sources,
  fillCount, volumeText, seedText }`: `sources` the card's draft's sources in order, each `{ name,
  replicatesText, filler }` (`name` as the card shows it, `replicatesText` what its box holds, `""`
  for a filler); `fillCount` how many wells to fill it holds; `volumeText` and `seedText` what its
  boxes hold.

### Targets
A target names a part of the page for the page's hook to find (`transfer-designer-page.md`,
section 17):

| Target | The element |
|---|---|
| `{ kind: "labware", labware }` | the labware's whole block on the deck |
| `{ kind: "well", labware, well }` | the well on the deck |
| `{ kind: "trayChip", labware }` | the labware's chip in the tray |
| `{ kind: "labwareHeading", labware }` | the labware's label button above its wells |
| `{ kind: "entry", key }` | Start, a stage or End in the Stages column (`"start"`, an ID, `"end"`); for a stage inside a closed transfer table's or randomization's box, that box's heading |
| `{ kind: "stagePencil", id }` | an open stage's ✎ |
| `{ kind: "tipPencil", key }` | the ✎ on a tip group's heading, by its tip change's key |
| `{ kind: "endSeam" }` | the seam between tip groups just above End |
| `{ kind: "componentPencil", name }` | a component's ✎ in the Start card |
| `{ kind: "newComponent" }` | the Start card's `+ New` (or its box while open) |
| `{ kind: "showTransfers", id }` | an open stage's `Show transfers ▸` / `Hide transfers ▾` |
| `{ kind: "transferVolume", id, source, destination }` | the volume button of the open stage's first transfer with that route |
| `{ kind: "transferRemove", id, source, destination }` | that row's `×` |
| `{ kind: "editingBox" }` | the open editing box |
| `{ kind: "button", name }` | `"experimentName"` (the heading's name button), `"save"`, `"biomekFiles"`, `"writeFiles"`, `"undo"` |
| `{ kind: "problemCount" }` | the problem count |
| `{ kind: "dialog" }`, `{ kind: "dialogMain" }` | the open dialog; its main button (`Next`, `Add`, `Update`) |
| `{ kind: "tablePencil", id }` | the ✎ on a transfer table's heading |
| `{ kind: "randomizationPencil", id }` | the ✎ on a randomization's heading |
| `{ kind: "card", part }` | in the open randomization's card: `"name"`, `"tabFill"`, `"allReplicates"`, `"volume"`, `"seed"`, `"run"` (Randomize or Update) |
| `{ kind: "cardFiller", name }` | the Filler button of the card's source of that name |

### Helpers
The module exports the helpers steps use, each a pure function, so tests can check them alone.
**Stages are numbered from 1**, as the page and the steps number them (stage 1 is the first in the
stage order). Names compare without regard to capitals or spaces at the ends, here and in every
check below.
- `stageAt(plan, n)`: the ID of stage `n`, or `null` if there's no such stage.
- `transfersFrom(plan, n, source, destinationLabware, destinationWell?)`: stage `n`'s transfers
  from `source` (`{ labware, well }`) into that labware (and well, if given); `[]` if no stage `n`.
- `startVolume(plan, labware, well, component)`: µL of the component the well holds at the start.
- `hasComponent(plan, name)`, `carries(plan, component, unit)`: whether a component exists, and
  whether it carries a constituent in that unit with an amount above 0.
- `stageNameHas(plan, n, word)`: whether stage `n`'s name contains `word`.
- `startsNewTips(plan, n)`: whether stage `n` starts a tip group of its own: for stage 1, always
  (the run starts by loading tips, under the `START` key); for any other, whether the plan has a
  tip change under its ID (`transfer-designer.md`, "Tip changes and tip groups").
- `tipProbes(plan, n)`: how many probes the tip change starting stage `n`'s tip group loads.
- `aspirateMode(plan, n)`, `dispenseMode(plan, n)`: `modeOf("source", settings)` and
  `modeOf("destination", settings)` of stage `n` (`transfer-designer.md`).
- `mixesBeforeAspirating(plan, n)`, `mixesAfterDispensing(plan, n)`: whether stage `n`'s
  `sourceMix`, or `destinationMix`, isn't `null`.
- `wellLabelText(plan, labware, well)`: the well's label (`wellLabelOf`), or `""` for none.
- `tracesAtEnd(plan, labware, well)`: the well's possible traces after the whole run:
  `possibleTraces(plan, n).tracesOf(labware, well)` (`possible-contamination.md`), `n` the number of
  operations in the plan.
- `totalAtEnd(plan, labware, well)` and `totalAfterStage(plan, n, labware, well)` (with `n` 0 for the
  start): µL the well holds then, from contents tracking (`contents-tracking.md`).
- `isOut(view, labware)`, `isOpen(view, key)`.

(The logic's own `stageNamed` and `wellLabelOf` mean something else; these names don't clash.)

## 4. Interface
| Export | Returns |
|---|---|
| `TUTORIALS` | the five tutorials, in menu order (section 6), frozen |
| `tutorialById(id)` | the tutorial, or `null` |
| `stepState(step, view, wasDone)` | `{ done, target, checklist, body, keepClear }` for drawing: `done` is `step.done(view)` (or `true` for a step without one), or `true` if `step.sticky` and `wasDone`; `target` is `step.target(view)` while not done, and always for a step without `done`, else `null`; `body` is the parsed markup (`parseMarkup`); `keepClear` as section 3 says; any function that throws gives `done: false`, `target: null`, an empty checklist, an empty body and the default keep-clear instead of breaking the page |
| `parseMarkup(text)` | the blocks of section 3, "Step markup" |
| the helpers | section 3 |

`stepState` takes `wasDone` from the panel, which remembers whether a sticky step has been done
since it was shown.

## 5. Errors
None reach the user. A step function that throws is caught by `stepState` (section 4), so a page
change that breaks a step stops that step moving on rather than breaking the page; the browser
walk-throughs (`tutorial-page.md`, section 9) catch it.

## 6. The tutorials
Shared wording, used by more than one step, defined once:
- **NEW_STAGE_HOW**: `Point at the gap just above **End** and click the blue **+** on the dashed line.`
- **The name step** (tutorial 1): body `Every run needs a name: the Biomek files' folder is named
  after it.` / `1. Click **Name this experiment** at the top left.` / `2. Type \`Practice1\` and
  press [Enter].` / `> Names use letters, digits, - and _ only, no spaces.`, and, while the plan
  has a name that doesn't start with `Practice` (capitals aside), the warning `! In the tutorials,
  start the name with \`Practice\`, so practice files are easy to spot. Click the name to change
  it.` Ring: `{ kind: "button", name: "experimentName" }`. Done: the plan's experiment name starts with `Practice`, capitals aside.
- **The write step**: title `Write the Biomek files`; body `1. Press **Biomek files**. The box shows
  the zip's name: date, time and experiment name.` / `2. Press **Write files** and save the zip.` /
  `> If the box shows a red message instead, it says what to fix first.`; target `writeFiles` while
  `headerBox` is `"biomek"`, else `biomekFiles`; done: the message starts `Saved ` and contains
  `.zip`.
- **The save step**: title `Save the plan`; body `Your work is kept in this browser, but save a
  plan file too, so you can reopen it anywhere.` / `Press **Save** and save the file.` / `>
  **Open** loads a saved plan later.`; target `save`; done: the message starts `Saved the plan`.
- **Ring a stage's ✎**: where a step below says "ring stage n's ✎", the target is `{ kind:
  "entry" }` for that stage while it isn't open, the open editing box while one is open, else its
  `stagePencil`.

Each tutorial below gives its menu entry, then each step: its title, its body, then **Checklist**,
**Ring**, **Done** and **Keep clear** where it has them. `N` or a `{name}` in a body is a value the
body works out from the view each time it's drawn, given after the step. Values that come from
`config/` are named, never written as numbers (CLAUDE.md, "Tests follow `config/`"):
- **{dead}**: the dead volume of Res1's labware type, `DeepReservoir12` (`config/labware-types.js`);
- **{capacity}**: the capacity of Plate1's labware type, `BCFlat96`;
- **{tip}**: the first tip type, `TIP_TYPES[0]` (`config/tip-types.js`), the tips a new plan uses;
- **{mixLimit}**: `MIX_VOLUME_LIMITS[{tip}]`, the most a {tip} tip mixes;
- **{folder}**: `BASE_FOLDER` (`config/paths.js`).
"The plate" is Plate1, wherever its label.

### Tutorial 1, `first-run`
Title `Your first run`; summary `Plan a simple run from scratch and write its Biomek files.`; 10
minutes; starting plan `empty`.

0. **Your first run.** `In this tutorial you plan a simple run from scratch and write its Biomek
   files.` / `You'll fill a reservoir with **Base media** and **Cells**, put media
   into 12 wells of a culture plate, then add cells on top.` / `> This is a practice copy. Nothing
   you do here touches plans in the real Transfer Designer. Follow the orange ring; the tutorial
   moves on once each step is done.`
1. **Name the experiment.** The name step, with `Practice1`.
2. **Bring out the labware.** `The tray lists every labware on the Biomek's deck. Only the labware
   you bring out is shown.` / `1. Click **Res1**, a 12-trough reservoir, for the stocks.` / `2.
   Click **Plate1**, a 96-well culture plate.` Checklist (inline): `Res1`, `Plate1` (each out).
   Ring: Res1's tray chip until it's out, then Plate1's. Done: both out.
3. **Give the plate your own name.** `The Biomek calls it Plate1, but you can call it what you
   like.` / `1. Click the bold **Plate1** above its wells.` / `2. Type \`Culture plate\` and press
   [Enter].` / `> The Biomek files still use Plate1. A labware sheet in the files matches up the
   two names.` Ring: Plate1's labware heading. Done: Plate1 has a labware label.
4. **Start.** `The column on the right is the run, top to bottom: **Start**, then the stages, then
   **End**.` / `**Start** is open now, marked **Shown on deck**. It's what's in the wells before the
   run: the stocks you pipette in by hand.` / `Press **Next**.` Ring: Start's entry. (No done: a new
   plan opens with Start open, so there's nothing to do.)
5. **Add the components.** `A **component** is a liquid you put on the deck. Each gets its own
   color.` / `1. In the Start card, click **+ New**.` / `2. Type \`Base media\`, press [Enter].` /
   `3. A new box opens: type \`Cells\`, press [Enter].` / `4. Press [Enter] on the empty box to
   finish.` Checklist (inline): `Base media`, `Cells`. Ring: `newComponent`. Done: both components
   exist and the `+ New` box isn't open.
6. **Fill the troughs.** `For each trough: click the component's chip, **type the volume** on the
   keyboard (there's no box: it shows beside your cursor), then click the trough.` Checklist:
   `Trough 1: \`6000\` µL Base media` (Res1 1 starts with at least 5000 µL of it), `Trough 2:
   \`3000\` µL Cells` (Res1 2, at least 2500 µL). `> Enter what you'll really pipette in. A trough
   keeps {dead} µL the tips can't reach (dead volume), and the page counts it for you. Too much?
   Press **Undo**.` Ring: Res1 1 until it's done, then Res1 2. Done: both checklist items.
7. **Open and rename the first stage.** `A **stage** is a group of transfers that share pipetting
   settings. The Biomek may do a stage's transfers in any order, so anything that must happen first
   goes in an earlier stage.` / `1. Click **New stage** (number 1) in the column on the right.` /
   `2. Click the **✎** beside its name, change it to \`Base media\`, press **Save**.` Ring: stage
   1's ✎ (as defined above). Done: stage 1's name contains `base`.
8. **Put media into the plate.** `1. Type \`100\`: the volume for the next transfers.` / `2. Click
   trough **1** (Base media) to choose it as the source. A dashed arrow follows your cursor.` / `3.
   Press on plate well **B2** and drag to **D5**, then let go.` / `One transfer goes into each well
   of the box: N so far.` (N: stage 1's transfers from Res1 1 into the plate) / `> For a single
   transfer, click the source, then one destination. Only inner wells are used: outer wells dry out
   faster, so they usually get PBS.` Ring: Res1 1. Keep clear: the plate. Done: N is 12 or more.
9. **Add a Cells stage with new tips.** `The colored box around stage 1 is a **tip group**: its
   stages share tips. Tips carry liquid over, so the cells get fresh tips.` / `1. ` NEW_STAGE_HOW /
   `2. Click the **✎** beside the new stage's name, call it \`Cells\`, press **Save**.` / `> A **+**
   inside a colored box adds a stage with the same tips; one on a dashed line, with new tips.` Ring:
   `endSeam` until stage 2 exists and starts new tips, then stage 2's ✎. Done: stage 2 starts new
   tips and its name contains `cell`.
10. **Add cells to the wells.** `1. Type \`50\`.` / `2. Click trough **2** (Cells).` / `3. Drag
    across **B2** to **D5** again, the wells that got media.` / `Cell transfers so far: N.` (stage
    2, from Res1 2 into the plate) / `> Point at a plate well to see what it holds.` Ring: Res1 2.
    Keep clear: the plate. Done: N is 12 or more.
11. **Walk through the run.** `The deck shows the wells as they are after the stage that's open:
    the card marked **Shown on deck** in the column on the right.` / `1. Click **Start**: the plate
    is empty, since nothing has run yet.` / `2. Click each stage in turn and watch the plate fill.` /
    `3. Click **End**. Its count says how many tips the run loads.` / `> ‹ and › at the top left of
    the deck step through the run the same way.` Ring: End's entry. Done: End is open.
12. The save step.
13. The write step.
14. **You've planned a run.** `On a real run, you'd take the zip to the Biomek PC:` / `1. Unzip it
    into \`{folder}\`.` / `2. Point the general-purpose method's setup worklist at the folder's
    \`Setup.csv\`.` / `3. Set up the deck using **Records/Labware sheet.pdf** from the zip.` / `4.
    Run it in **simulation** first, then for real.` / `! Practice zips are only for trying out
    simulation. Don't run them on the instrument.` / `Next: **Checking your plan**, which starts
    from a plan like this one.`

### Tutorial 2, `checking`
Title `Checking your plan`; summary `Read a well's contents, change volumes, catch and fix
problems, and spot possible contamination.`; 10 minutes; starting plan `firstRunDone`.

0. **Checking your plan.** `This tutorial starts from the plan you made in **Your first run**: Base
   media then Cells into 12 wells.` / `You'll see what a well holds, change a
   volume, meet the problems the page catches and how to fix them, and see where tips could carry
   one liquid into another.`
1. **What a well holds.** `Point at plate well **B2** (no click). A card shows:` / `- each
   component, its volume and its share of the well;` / `- its total, by adding them: here 100 µL
   Base media and 50 µL Cells.` / `The card shows the well as it is after the stage marked **Shown
   on deck** on the right: here, Cells, the last stage. Click **Start** and point at B2 again: it's
   empty, because nothing has run yet.` / `Press **Next** when you've seen it.` Ring: plate B2.
   Keep clear: the plate.
2. **Enter the cell density.** `1. Click **Start** in the column on the right.` / `2. Click the small
   **✎** beside the **Cells** chip.` / `3. Under **Contains**, click **+ Add**. The name is filled in
   for you.` / `4. In **Amount**, type \`1e6\` (or \`1000000\`).` / `5. In the unit menu, choose
   **cells/mL**.` / `6. Press **Save**.` / `> Then point at B2 again: under **Concentrations**, the
   card now gives its seeding density in cells/cm², from the well's growth area.` Ring: Start's
   entry while Start isn't open, then the editing box while open, else Cells' ✎. Done: Cells
   carries a constituent in cells/mL.
3. **Change a volume.** `1. Click the **Base media** stage in the column on the right.` / `2. Click
   **Show transfers ▸** in its card.` / `3. Point at a row: its wells light up on the deck.` / `4.
   Click the volume in the **Res1 1 → Culture plate B2** row, type \`120\`, press [Enter].` / `>
   [Enter] saves and opens the next row's volume, so you can type a column of volumes. [Escape]
   stops. **×** removes a transfer.` Ring: stage 1's entry while it isn't open; else that row's
   volume while the list is shown; else `showTransfers`. Done: stage 1's transfer from Res1 1 into
   plate B2 is 120 µL.
4. **Overfill a well.** `The page catches volumes that won't work. Try one:` / `1. Click the
   **Cells** stage in the column.` / `2. Type \`300\`, click trough **2**, then click plate well
   **B2**.` / `B2 now holds N µL, more than the {capacity} µL a plate well can hold. This is an
   **overfill**.` / (N: `totalAtEnd` of plate B2, plus 300 while stage 2 has no 300 µL transfer into
   B2, so it reads the same before and after the transfer is added) / `You'll see:` / `- a **red ring and a red bar** on B2;` / `- a **red message**
   at the bottom of the page;` / `- **1 problem** in the count above the deck.` Ring: the problem
   count once it's above 0; else Res1 2 while stage 2 is open; else stage 2's entry. Keep clear: the
   plate. Done: the problem count is above 0.
5. **Undo it.** `Press **Undo** (or [Ctrl]+[Z]). The count goes back to **No problems**.` / `> Undo
   works for everything, including **Remove** buttons, which act without asking.` Ring: `undo`.
   Done: the problem count is 0.
6. **Draw into the dead volume.** `A trough keeps {dead} µL the tips can't reach. Trough 2 started
   with S µL and the cells use U µL, so only R µL is left above the dead volume.` / (S:
   `totalAfterStage` of Res1 2 at 0; U: the total of stage 2's transfers from Res1 2 into the plate;
   R: S − U − {dead}) / `With the
   **Cells** stage open, type \`500\`, click trough **2**, then click the empty trough **5**.` /
   `Trough 2 gets a **red ring and X**: a transfer asks for more than it can reach. Point at it to
   read how much is missing.` Ring: Res1 2. Done: the problem count is above 0 and stage 2 has a
   transfer from Res1 2 into Res1 5.
7. **Fix it at the start.** `This time, fix the cause instead of undoing: put more cells in the
   trough.` / `1. Click **Start**.` / `2. Click the **Cells** chip, type \`1000\`, and click trough
   **2**. It now starts with 4000 µL.` / `The red marks go and the count says **No problems**.`
   Ring: Res1 2 while Start is open, else Start's entry. Done: the problem count is 0 and Res1 2
   starts with at least 3500 µL of Cells.
8. **Remove the test transfer.** `1. Open the **Cells** stage.` / `2. Click **Show transfers ▸**.`
   / `3. Click **×** on the **Res1 2 → Res1 5** row.` Ring: stage 2's entry while it isn't open;
   else that row's `transferRemove` while shown; else `showTransfers`. Done: stage 2 has no
   transfer from Res1 2 into Res1 5.
9. **See a possible trace.** `Tips can carry a little of one liquid into another. The page tracks
   where that could happen.` / `1. Click **End** in the column on the right.` / `2. Point at trough
   **2** (the cells).` / `Its card lists **Base media** under **Possible traces**. In the Cells
   stage, each tip dispenses into a plate well that already holds media, touching it, then goes
   back to trough 2 for the next draw. So the cell stock could have picked up some media.` / `>
   "Possible" means it can't be ruled out from the plan, not that it's measured. It's not a problem,
   and doesn't stop the files being written.` Ring: Res1 2 while End is open, else End's entry.
   Sticky. Done: End is open, the pointed well is Res1 2, and its possible traces at the end
   (`possibleTraces`, `possible-contamination.md`) include Base media.
10. **Stop it with Non-Contact.** `A dispense that doesn't touch the liquid carries nothing back to
    the tip.` / `1. Open the **Cells** stage and click the **✎** beside its name.` / `2. Under
    **Dispense**, set **Mode** to **Non-Contact**.` / `3. Press **Save**.` / `Then open **End** and
    point at trough 2 again: the Possible traces are gone.` / `> Non-Contact dispenses from above the
    liquid. It can't mix, so use it where the destination doesn't need mixing.` Ring: stage 2's ✎
    until its dispense is Non-Contact, then Res1 2 while End is open, else End's entry. Done: stage
    2's dispense mode is Non-Contact (`modeOf`).
11. **Follow a well through the run.** `Click **Start**, then each stage in turn, pointing at trough
    **2** each time: A µL at Start, still B after Base media, C after Cells.` / (A, B, C:
    `totalAfterStage` of Res1 2 at 0, 1 and 2) / `Only the
    end of each stage is shown, because within a stage the Biomek chooses its own order.` / `Press
    **Next** when you're done.` Ring: Start's entry.
12. **Your plan checks out.** `Before writing files, check:` / `- the count says **No problems**;` /
    `- the stages are in the order things must happen;` / `- your stocks have no possible traces
    you'd mind;` / `- End's tip count fits the tip racks you'll load.` / `Next: **Making
    conditions**, a fuller cell culture experiment.`

### Tutorial 3, `conditions`
Title `Making conditions`; summary `Mix conditions from stocks, put them in a plate, add cells, and
spot contamination.`; 15 minutes; starting plan `conditionStocks`.

Its conditions, used below: A1 `Control`, A2 `Glucose`, A3 `Yeast`, A4 `Both`, on Deep1.

0. **Making conditions.** `This tutorial plans a fuller experiment.` / `Res1
   already holds four stocks: **Base media**, **Glucose** and **Yeast extract** (each 50 g/L), and
   **Cells**. You'll mix four conditions in a deep-well plate, put each into three plate wells,
   then add cells:` / `- **Control**: 1000 µL Base media` / `- **Glucose**: 800 µL Base media + 200
   µL Glucose` / `- **Yeast**: 800 µL Base media + 200 µL Yeast extract` / `- **Both**: 800 µL Base
   media + 100 µL of each`
1. **Bring out a deep-well plate.** `1. Click **Deep1** in the tray, a 96 deep-well plate.` / `2.
   Click its bold name and rename it \`Conditions\`.` / `> Point at a Res1 trough to see what it
   holds, such as Glucose at 50 g/L.` Ring: Deep1's tray chip until it's out, then its heading.
   Done: Deep1 is out and has a labware label.
2. **Put base media into the conditions.** `1. Open stage 1 and rename it \`Base media\` with its
   **✎**.` / `2. Type \`1000\`, click trough **1**, then click well **A1** of Conditions.` / `3.
   Type \`800\`, click trough **1**, then drag across **A2** to **A4**.` Checklist (inline):
   `Stage` (stage 1's name contains `base`), `A1` … `A4` (stage 1 has a transfer from Res1 1 into
   that Deep1 well). Ring: stage 1's ✎ until it's named, then Res1 1. Done: all checklist items.
3. **A stage that mixes.** `1. ` NEW_STAGE_HOW ` New tips, since this is a different stock.` / `2.
   In its **✎** box, name it \`Glucose\`.` / `3. Under **Dispense**, tick **Mix**, to blend the
   glucose into the media.` / `4. Press **Save**.` / `> The mixed wells will get a **yellow ⟳**: a
   {tip} tip mixes at most {mixLimit} µL, only part of a 1000 µL well. That's a warning, not a
   problem; a larger tip type, chosen with the ✎ on the tip heading, would mix more.` Ring: `endSeam` until stage 2 starts new tips, then stage 2's ✎.
   Done: stage 2 starts new tips, its name contains `gluc`, and it mixes after dispensing.
4. **Add the glucose.** `1. Type \`200\`, click trough **2** (Glucose), then click **A2**.` / `2.
   Type \`100\`, click trough **2**, then click **A4**.` Checklist (inline): `A2`, `A4` (stage 2
   has a transfer from Res1 2 into each). Ring: Res1 2. Done: both.
5. **Now yeast extract, on your own.** `1. Add a stage with new tips above **End** and name it
   \`Yeast extract\`. **Mix** under **Dispense** is already ticked: a new stage copies the settings
   of the stage before it. Press **Save**.` / `2. \`200\` µL from trough **3** into
   **A3**.` / `3. \`100\` µL from trough **3** into **A4**.` Checklist (inline): `Stage` (stage 3
   starts new tips, its name contains `yeast`, it mixes after dispensing), `A3`, `A4` (transfers
   from Res1 3). Ring: `endSeam` until stage 3 starts new tips; stage 3's ✎ until its stage item is
   done; then Res1 3. Done: all checklist items.
6. **Name the conditions.** `Well names help you find things. **Right-click** a well, type a name,
   press [Enter]:` Checklist (inline): `A1 \`Control\``, `A2 \`Glucose\``, `A3 \`Yeast\``, `A4
   \`Both\`` (each well has a well label). `Then point at **A4**: its card shows its name, what it
   holds, and glucose and yeast extract at 5 g/L each.` / `> Names show in place of volumes; the
   **Names** button switches back. The Biomek never sees them.` Ring: the first of A1–A4 without a
   label, then A4. Done: all four labeled.
7. **Swap the stocks for the culture plate.** `The stocks aren't needed for the next stage, so put
   them away to make room.` / `1. Click **Res1** in the tray to put it away.` / `2. Click **Plate1**
   to bring out a 96-well culture plate.` / `3. Click its bold name and rename it \`Culture
   plate\`.` Checklist (inline): `Res1 put away`, `Plate1 out`, `Renamed` (Plate1 has a labware
   label). `> Putting labware away only hides it here. It's still part of the plan and the run.`
   Ring: Res1's chip while it's out; Plate1's chip while it isn't; then Plate1's heading. Done: all.
8. **Put each condition into the plate.** `1. Add a stage with new tips above **End**. In its **✎**
   box, name it \`To plate\` and **untick Mix** under **Dispense**: a new stage copies the settings
   of the one before it. Press **Save**.` / `2. Type \`100\`.` / `3. For each condition, click it on
   Conditions, then drag down its column on the plate:` Checklist: `Stage` (stage 4 starts new
   tips, its name contains `plate`, it doesn't mix after dispensing), `Control (A1) → B2 to D2`,
   `Glucose (A2) → B3 to D3`, `Yeast (A3) → B4 to D4`, `Both (A4) → B5 to D5` (stage 4 has at
   least 3 transfers from that Deep1 well into the plate). Ring: `endSeam` until stage 4 starts new
   tips; stage 4's ✎ until its stage item is done; then the first condition well not yet done.
   Keep clear: the plate and Deep1. Done: all checklist items.
9. **Bring the stocks back.** `The cells are in Res1, and the conditions are done with.` / `1.
   Click **Res1** in the tray to bring it back.` / `2. Click **Conditions** in the tray to put it
   away.` / `> While a stage is open, an arrow from labware that's put away ends at its chip in the
   tray.` Ring: Res1's chip until it's out, then Deep1's. Done: Res1 out and Deep1 not.
10. **Gentle pipetting for cells.** `Cells settle in the trough and don't like being pushed hard, so
    this stage draws slowly and mixes the trough before each draw.` / `1. Add a stage with new tips
    above **End**, and name it \`Cells\`.` / `2. Under **Aspirate**, set **Mode** to **Slow** and
    tick **Mix**.` / `3. Press **Save**.` / `The card then reads \`↑ Slow ⟳   ↓ Medium\`: ↑ aspirate,
    ↓ dispense, ⟳ mixes.` / `> **Mode** sets how fast the tip draws and expels liquid. Non-Contact
    dispenses from above without touching the liquid, and can't mix.` Ring: `endSeam` until stage 5
    starts new tips, then stage 5's ✎. Done: stage 5 starts new tips, its name contains `cell`, its
    aspirate mode is Slow and mixes, and it doesn't mix after dispensing.
11. **Add cells to the wells.** `1. Type \`50\`.` / `2. Click trough **4** (Cells).` / `3. Drag across
    plate wells **B2** to **D5**: all 12 at once.` / `Cell transfers so far: N.` (stage 5, from Res1
    4 into the plate) / `Then point at **B3**: glucose at about 6.7 g/L, and the seeding density in
    cells/cm².` / `> For wells that aren't in one block, hold [Ctrl] and click each one: the source
    stays chosen until you press [Escape].` Ring: Res1 4. Keep clear: the plate. Done: N is 12 or
    more.
12. **Choose the tips.** `Each tip group's heading says what tips it loads, like \`New tips · {tip} ·
    4 tips\`.` / `1. Click the **✎** on the Cells stage's tip heading.` / `2. Under **Probes**, click
    **8**.` / `3. Press **Save**.` / `> More probes run faster but use more tips. **Tip type** sets the
    tips' size; a transfer bigger than a tip holds is split into trips for you.` Ring: the
    editing box while open, else stage 5's `tipPencil`. Done: stage 5's tip change loads 8 probes.
13. **Walk through the run.** `1. Bring out **Conditions** again, so you can see all three labware.`
    / `2. Click **Start**, then each stage in turn, pointing at a few wells: the deck shows them
    after the stage marked **Shown on deck**.` / `3. Finish on **End**, and check the count says
    **No problems**.` Ring: Deep1's chip until it's out, then End's entry. Done: End is open and the
    problem count is 0.
14. **Spot contamination in the Control.** `With **End** open, point at **B2** on the culture plate:
    one of the Control wells. Under **Possible traces** it lists **Glucose** and **Yeast extract**,
    though the Control was made without them. Two things could have carried them there:` / `1. **To
    plate** used the same tips for all four conditions. Within a stage the Biomek can go in any
    order, so a tip that just drew from the Glucose well could draw from the Control next.` / `2.
    **Cells** dispenses into wells holding the conditions, touching them, then goes back to the cell
    trough. Point at trough 4: the cell stock could have picked up all three.` / `> To avoid it in a
    real run, give each condition its own stage, each starting on new tips, and dispense the cells
    **Non-Contact**, as in **Checking your plan**.` Ring: plate B2 while End is open, else End's
    entry. Keep clear: the plate. Sticky. Done: End is open, the pointed well is plate B2, and its
    possible traces at the end are not empty.
15. The write step.
16. **You've made the conditions.** `You can now plan runs with several stages, mixing, tip choices
    and conditions.` / `Next: **Transfer tables**, which build conditions like these from one pasted
    table.` / `! Practice zips are only for trying out simulation. Don't run them on the
    instrument.`

### Tutorial 4, `transfer-tables`
Title `Transfer tables`; summary `Build conditions from one table pasted from Excel, and change them
by editing the table.`; 10 minutes; starting plan `tableStocks`.

Its rows, used below (well label, well, then µL of Base media, Glucose, Yeast extract; blank adds
nothing): `Control`, A1, 1000, –, –; `With glucose`, A2, 800, 200, –; `With yeast`, A3, 800, –, 200;
`Both`, A4, 800, 100, 100. Its **practice table** is these rows under the header `Well name | Base
media | Glucose | Yeast extract`, as text with a tab between cells and a line break between rows
(blank cells empty), as Excel copies a table.

0. **Transfer tables.** `In **Making conditions** you built the conditions transfer by transfer. A
   **transfer table** builds them all from one table you paste from Excel.` /
   `Res1 already holds **Base media**, **Glucose** and **Yeast extract**. You'll make the same four
   conditions as before, in a deep-well plate.`
1. **Name the wells to fill.** `A transfer table finds its wells by their names, so name them
   first.` / `1. Click **Deep1** in the tray to bring it out.` / `2. **Right-click** each well, type
   its name and press [Enter]:` Checklist (inline): `A1 \`Control\``, `A2 \`With glucose\``, `A3
   \`With yeast\``, `A4 \`Both\`` (each well labeled). `> Give conditions names that differ from the
   stocks' names, so a table can't mistake one for the other, and start them with a letter: Excel
   reads a cell starting with + or = as a formula. Several wells can share a name, such as three
   replicates all called \`With glucose\`: each gets the amounts in that name's row.` Ring: Deep1's
   chip until it's out, then the first unlabeled well of A1–A4. Done: all four labeled.
2. **Paste the table.** `In Excel, a transfer table has a row per well name and a column per stock.
   Each cell is the µL to add. Here's one to practice with:` / the practice table as a markup table
   / Copy button `Copy this table`, copying the practice table (section 3, `copy`) / `1. Point at
   the gap just above **End**. On the dashed line, click the **table** button, the one furthest
   right.` / `2. Click the paste box and press [Ctrl]+[V].` / `> A blank cell, or 0, adds nothing.`
   Ring: while the wizard is open, its main button once it has a table, else the dialog; otherwise
   `endSeam`. Done: the wizard is open with a table, or the plan has a transfer table.
3. **Check, choose sources, add.** `The wizard has three steps, shown as pills at its top.` / `1.
   **Table**: the grid can be edited. Any problem shows in red. Press **Next**.` / `2. **Sources**:
   where each stock is drawn from. The page found each one in Res1. Add a second well if one can't
   hold enough. Press **Next**.` / `3. **Review**: one stage per stock, each on new tips. Press
   **Add**.` Ring: `dialogMain`. Done: the plan has a transfer table.
4. **What it made.** `In the column on the right, the transfer table is a box of its own: one stage
   per stock, each starting on new tips, as the Review promised.` / `1. Click its heading to open or
   close the box.` / `2. Open the **Glucose** stage: its transfers go to the wells named **With
   glucose** and **Both**.` / `3. Click **End** and point at well **A4** (Both): 800 µL Base media,
   and 5 g/L of each supplement.` / `> Stage 1, **New stage**, is still empty. An empty stage loads
   no tips, so it can stay, or go with **Remove** in its ✎ box.` / `> A table's transfers can't be
   changed on the deck: the table is the one place they come from. That's the next step.` / `Press
   **Next** when you've looked.` Ring: Deep1 A4 while End is open, else End's entry.
5. **Change amounts in the table.** `Make **Both** stronger: 700 µL Base media and 150 µL of each
   supplement.` / `1. Click the **✎** on the transfer table's heading. The wizard opens at Review.` /
   `2. Click the **1 Table** pill at its top.` / `3. In the **Both** row, click a cell, type the new
   amount and press [Enter].` / `4. Press **Next**, **Next**, then **Update**.` Checklist (inline):
   `Base media 700`, `Glucose 150`, `Yeast extract 150` (the volume, in the table's stage for that
   stock, of its transfer into Deep1 A4). `> The wizard takes one paste. To use a changed Excel
   sheet instead, remove this table (**Remove** in its wizard) and paste the sheet into a new
   transfer table.` Ring: `dialogMain` while the wizard is open,
   else the table's `tablePencil`. Done: all three.
6. **Pipetting on a table's stages.** `A table's stages take pipetting settings like any other.` /
   `1. Open the **Glucose** stage and click the **✎** beside its name.` / `2. Under **Dispense**,
   tick **Mix**. (Its name stays the stock's; that's set by the table.)` / `3. Press **Save**.` / `>
   The tip heading's ✎ sets each stage's tip type and probes, as in **Making conditions**.` Ring:
   the Glucose stage's ✎ (the ring rule above, for the stage whose name contains `gluc`). Done: that
   stage mixes after dispensing.
7. **That's a transfer table.** `The same kind of table works for any number of conditions and
   stocks: one row per well name, one column per stock.` / `Next: **Randomizing a plate**.` / `> A column can
   also be named after a well name rather than a stock, to draw from the wells with that name.
   That's useful for a premix made earlier in the run.`

### Tutorial 5, `randomizing`
Title `Randomizing a plate`; summary `Place conditions in random wells with replicates and a filler,
and keep the well map.`; 10 minutes; starting plan `conditionMedia`.

0. **Randomizing a plate.** `Plate position can bias results: edge wells dry faster, and a gradient
   across the deck can follow the layout. A **randomization** places each condition in random
   wells, and records where.` / `Deep1, named Conditions, already holds four
   condition media, and Res1 trough 1 holds PBS. You'll put 12 replicates of each condition in
   random inner wells of a plate, with PBS in the 12 left over.`
1. **Add a randomization.** `1. Click **Plate1** in the tray to bring out a culture plate.` / `2.
   Point at the gap just above **End**. On the dashed line, click the **dice** button.` / `3. Its
   card opens in the column. In **Name**, type \`Layout\` and press [Enter]. The name labels its
   well map.` Checklist (inline): `Plate1 out`, `Randomization` (the plan has one), `Named` (its
   name is `Layout`, capitals aside). Ring: Plate1's chip until it's out; `endSeam` until the plan
   has a randomization; then the card's `name`. Done: Plate1 out and the randomization named.
2. **Pick the sources.** `The card's **Sources** tab is open, so clicks on the deck pick sources.` /
   `1. Drag across Conditions **A1** to **A4**: the four conditions.` / `2. Click Res1 trough **1**
   (PBS).` / `3. In PBS's row, press **Filler**. A filler fills whatever wells the replicates leave
   over.` Checklist (inline): `4 conditions` (the card has sources named `Control`, `With glucose`, `With
   yeast` and `Both`, none of them filler), `PBS as filler` (a filler source whose name contains
   `PBS`). `> Click a source again to take it
   out.` Ring: the randomization's ✎ while its card isn't open; Deep1 A1 while it has fewer than 4
   non-filler sources; the PBS source's `cardFiller` while PBS isn't a filler (or Res1 1 while PBS
   isn't a source). Done: both, with the card open.
3. **Set the replicates.** `Each condition gets 12 replicate wells.` / `In the **All sources** box
   at the top of the list, type \`12\`. Every condition's box follows.` Checklist (inline): `12
   each` (every non-filler source's `replicatesText` is `12`, and there are at least 4). `> Each
   condition's own box can be set separately, for different replicate counts.` Ring: the card's
   `allReplicates`. Done: the checklist item, with the card open.
4. **Pick the wells to fill.** `1. Click the card's **Wells to fill** tab. Clicks on the deck now
   pick wells to fill.` / `2. Drag across the plate from **B2** to **G11**: the 60 inner wells.`
   Checklist (inline): `60 wells` (`fillCount` is 60). `> 4 conditions × 12 replicates is 48 wells,
   so PBS fills the other 12. Its row in Sources says so.` Ring: the randomization's ✎ while its
   card isn't open; the card's `tabFill` while the card's tab isn't `fill`; else plate B2. Keep
   clear: the plate. Done: the card is open and `fillCount` is 60.
5. **Volume, seed, randomize.** `1. In **Volume**, type \`100\`: the µL each well gets.` / `2. Leave
   **Seed** as it is. It's a random number that fixes the layout: the same seed gives the same
   wells.` / `3. Press **Randomize**.` / `> **Each transfer** and **Tips** set the pipetting, as a
   stage's ✎ box does.` Ring: the card's `volume` while it doesn't hold `100`, else its `run`.
   Done: the randomization has run (it owns stages) and the plan has at least 60 transfers of
   100 µL into Plate1.
6. **Look at the layout.** `The randomization made one stage per condition, plus one for the
   filler, each on new tips.` / `1. Click **End**: the plate shows the four conditions' colors
   scattered across the inner wells.` / `2. Point at a few wells to see which condition each got.`
   / `3. Click the randomization's heading to show or hide its stages.` / `> Its stages' transfers
   can't be changed by hand: the card is the one place they come from.` / `Press **Next** when
   you've looked.` Ring: plate B2 while End is open, else End's entry. Keep clear: the plate.
7. **Reshuffle with a new seed.** `1. Click the **✎** on the randomization's heading.` / `2. Change
   **Seed** to \`37\`.` / `3. Press **Update**. Watch the layout change.` Checklist (inline): `Seed
   37` (its seed is 37 and it has run). `> If the plan changes in a way that affects the
   randomization, its heading says **needs update** in red. Open it and press **Update**.` Ring:
   the randomization's ✎ while its card isn't open; the card's `seed` while it doesn't hold `37`;
   else its `run`. Done: its seed is 37, it has run, and its card is closed.
8. **Write the files and the well map.** `1. Press **Biomek files**. The box says the zip includes
   **1 well map**.` / `2. Press **Write files** and save the zip.` / `In the zip's **Records**
   folder, \`Layout well map.csv\` lists which condition went into which well. Keep it with your
   data: it's the key to the plate.` Ring and done as the write step.
9. **That's a randomized plate.** `The same seed and the same list of sources always give the same
   layout, so a plate can be remade exactly.` / `> More in the card: sources can **share tips**
   (drag a row, or the tip button between boxes), and a row's **⠿** grip changes the order. A new
   order reshuffles, even with the same seed.`

## 7. Configuration
The tutorials' own text, plans and numbers (volumes to type, wells, names) are the tutorials
themselves, not settings. The values from `config/` that steps mention are read from there, never
copied (section 6's `{dead}`, `{capacity}`, `{tip}`, `{mixLimit}`, `{folder}`): `LABWARE_TYPES`
(`config/labware-types.js`, through `deck`), `TIP_TYPES` and `MIX_VOLUME_LIMITS`
(`config/tip-types.js`), `BASE_FOLDER` (`config/paths.js`).

## 8. The REPL
A `tutorial` topic in `scripts/repl.js` loads `TUTORIALS`, `stepState` and the helpers; its
examples list each tutorial's titles and show `stepState` for tutorial 1's step 2 with a view whose
`labwareOut` is `["Res1"]`.

## 9. Test cases
In `tutorial.test.js`, one `describe("tutorial", …)`:
- **The tutorials:** five, in the order of section 6, with unique IDs; each starts and ends with a
  step without `done`; each names a starting plan that `tutorial-plans` makes; every step has a
  title, and its body parses (called with a view made from its starting plan, it doesn't throw).
- **`parseMarkup`:** each block kind and each inline mark, alone and together; a table with empty
  cells; text holding `<` or `&` stays text; a line starting with none of the block marks is a
  paragraph.
- **No HTML in the steps:** no body, at any step, with its tutorial's starting plan's view, contains
  `<`.
- **Each step's `done` and `target`**, for each tutorial: on a view of its starting plan, every step
  with `done` gives `false`, except where section 6 says it's done at once, and except tutorial 2's
  steps 5 and 8, whose `done` is the absence of what the step before them adds (no problems; no
  transfer into Res1 5), so it holds on the starting plan; and for each such step,
  a view built by doing that step's edits with the transfer designer's logic (e.g. for tutorial 1,
  step 6, `addToWells` of 6000 µL of Base media into Res1 1 and 3000 µL of Cells into Res1 2) gives
  `true`. Steps whose `done` reads page facts (`labwareOut`, `open`, `pointedWell`,
  `addingComponent`, `dialog`, `randomizationCard`, `message`, `problemCount`) are tested with views
  setting those. A step without `done` gives its target whatever the view.
- **Tutorial 3, step 5:** on the plan as step 4 leaves it, adding a stage with new tips at the end
  gives a stage that already mixes after dispensing (the copying the step's text relies on).
- **Sticky:** `stepState` with `wasDone` `true` gives `done: true` for a sticky step whose `done` is
  now `false`, and `false` for a step that isn't sticky.
- **A throwing step:** a step whose `body`, `target` or `done` throws gives `done: false`, `target:
  null`, an empty body.
- **Helpers:** each, on small plans, including stages counted from 1, names compared without regard
  to capitals and spaces, `startsNewTips` for stage 1 and for a later stage with and without a tip
  change, and `tracesAtEnd` on a plan with a known trace.
- **Configuration:** the bodies that name `{dead}`, `{capacity}`, `{tip}`, `{mixLimit}` and
  `{folder}` show the values from `config/` (worked out from the config files in the test, never
  written as numbers).
- The labels the steps name on the page are checked by the browser walk-throughs and by hand
  (`tutorial-page.md`, section 9, which lists them).
