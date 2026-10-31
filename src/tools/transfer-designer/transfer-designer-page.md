# transfer-designer page — specification

> **Final (2026-10-27).** Written for v0.2.0, from the transfer designer preview (v126), which Andy
> shaped and used from 2026-10-24 to 2026-10-26; revised from his testing of the built page (PR #73),
> built in PR #74 with two fixes in PR #75, and tested by Andy.
>
> **Draft changes (2026-10-28):** the experiment name as the page's heading, and writing the Biomek
> files, from the preview Andy shaped on 2026-10-28 (sections 2, 3, 4, 5, 12, 15 and 16). They
> become Final once built and tested by Andy, including a zip unzipped and run on the Biomek PC.
>
> **Draft changes (2026-10-30):** an open stage's ✎ beside its name, no dot after a transfer's route,
> and the stage's editing box as a grid, from the mixing preview Andy shaped on 2026-10-29 and
> 2026-10-30 (sections 7, 10, 15 and 16). Layout only: the plan, plan files and Biomek files don't
> change. From reviewing their build (#105): the Stages column is at least 348px wide, so a stage's
> box fits in it, and open cards no longer say `Current` (sections 3 and 7). They become Final once
> built and tested by Andy.
>
> **Draft changes (2026-10-30, later):** probes are chosen in the tip change's box, not the stage's
> (ADR 0007, "Tip changes"; sections 7 and 10). They become Final once built and tested by Andy.
>
> **Draft changes (2026-10-30, mixing layer (b)):** a stage with a mix problem is shown as a
> problem, as an overdraw is (Andy, 2026-10-30), and choosing a mode for an end that mixes keeps it
> mixing (sections 3, 7 and 10). Nothing on the page switches mixing on yet (roadmap, mixing layer
> (c)), so only a plan file can bring in a stage that mixes. They become Final once built and tested
> by Andy.
>
> **Draft changes (2026-10-30, mixing layer (c1)):** mixing in transfer stages, from the mixing
> preview Andy shaped on 2026-10-29 and 2026-10-30 (its changes 8, 10, 12 to 14 and 24 to 28): a
> Mix checkbox for each end in a stage's box; ⟳ after an end's mode on the stage's card; a ⟳ badge
> on each well the open stage mixes, yellow when the mix is short; and `Mixed N% of well` in the
> contents card (sections 6, 7, 10, 15 and 16); the well causing a mix problem has a red badge, and
> a mix under 1 µL is a problem, and its red badge stays on the deck from its stage through End, with
> `Mix problem` in the key (Andy, 2026-10-30, from the preview). Also the seam's tip button just right of its `+`,
> each in a fixed spot (section 7; preview change 30). Mix steps come in layer (c2). They become
> Final once built and tested by Andy.
>
> **Draft changes (2026-10-30, mixing layer (c2)):** mix steps, from the mixing preview Andy shaped
> on 2026-10-29 and 2026-10-30 (its changes 1, 2, 12, 14, 18, 22 and 30, and Andy's decisions that
> evening): the ⟳ button on each seam, a mix step's look, card and box, mixing wells on the deck,
> and End counting only transfers (sections 7, 9, 10 and 16). They become Final once built and
> tested by Andy.

> **Draft changes (2026-10-30, well capacities and dead volume, item 11 of v0.2.0):** from the
> preview Andy shaped on 2026-10-30: three kinds of contents problem (a draw into the dead volume,
> marked as an overdraw; an overdraw; an overfill, with its own mark), all red, all counted, all
> refused by the file writer; a well holding only dead volume drawn striped; the usable volume and
> the labware's capacity and dead volume in the contents card (sections 6, 7, 9, 12 and 16). A
> starting volume is the volume put in the well, dead volume included. They become Final once built
> and tested by Andy.

## 1. Purpose
The transfer designer's page: the screen where people plan an experiment's liquid handling. This
specification covers the three page files:

| File | Job |
|---|---|
| `transfer-designer.html` | The page's structure: the header, the deck panel, the Stages column, the message bar. |
| `transfer-designer.css` | The page's styling (section 15). |
| `transfer-designer-page.js` | The page's behavior: it keeps the plan's history, passes on what the user does to the logic modules, and draws the result. |

The build step joins the page files and the modules they use into one file (ADR 0004):
`transfer-designer` is added to the build's list of tools.

The page has no rules of its own about plans. Every edit goes through the transfer designer's logic
(`transfer-designer.md`), undo and redo through `plan-history.md`, saving and opening through
`plan-file.md`, the labware through `deck.md`, and what each well holds through
`contents-tracking.md`. When one of them refuses an edit, the page shows its message and changes
nothing. What the page decides itself is only how things look and how the user does them, such as
how typing a volume works and how numbers are shown (section 13), as for the randomizer
(`randomizer-page.md`).

## 2. Scope
Version 1 does everything below: naming the experiment, filling wells with components before the
run, building stages, adding transfers by clicking and dragging, tip changes, labels, undo and redo,
saving and opening plans, with a browser copy, and writing the Biomek files as one zip.

Not in version 1 (see `docs/roadmap.md`):
- **A guided start** for an empty plan (Andy considered it, 2026-10-26: not now).
- **Collapsing tip groups** in the Stages column.
- **Moving** a stage or a transfer, **mixing**, **final concentrations** (`transfer-designer.md`).
- **Messages in the page's own terms everywhere.** Some messages from the shared modules use
  internal terms, such as "starting contents entry 3" (roadmap, "Technical debt").

## 3. Layout
From the top:

| Where | What |
|---|---|
| Header | The experiment's name, as the page's heading; on the right, the buttons `Biomek files`, `Save`, `Open` and `Reset` (section 5). The tool's name isn't shown on the page (Andy, 2026-10-28): the browser tab says `Transfer Designer`. |
| Deck panel (left) | Three bars, then the labware that's out (section 6). |
| Stages column (right) | Start, the tip groups with their stages, and End (section 7). |
| Message bar | Floating at the bottom of the window, centered (section 12). |

When the window is wider than 1000px, the deck panel and the Stages column sit side by side, the
Stages column 348px to 400px wide and the deck panel taking the rest. (The minimum was 320px until
2026-10-30, when it rose so a stage's 320px editing box, section 10, fits inside the column with
its padding. At the widths where the column is at its minimum, the deck's labware sit one per row
either way, so the deck panel loses nothing it was using; Andy, 2026-10-30, from reviewing #105.) The deck panel's width
doesn't depend on what's in it, so bringing out or putting away labware never changes the width of
either panel. The Stages column is then
pinned beside the deck while the page scrolls, scrolls on its own, and is fitted to end 12px above
the bottom of the window, wherever its top is (lower at first, under the header; at the top once the
page scrolls), and never past the bottom of the deck panel. The area holding both panels always
reaches at least the bottom of the window, so a short deck panel doesn't cut the Stages column
short. In a narrower window they stack: the deck panel, then the Stages column, which is then as
tall as its contents.

## 4. What the page keeps
**The history.** A `PlanHistory` (`plan-history.md`) whose states are each
`{ plan, open }`: the plan, and what's **open** in the Stages column: `"start"`, a stage's ID, or
`"end"`. So undo goes back to the plan and to where the edit was made.
- An edit of the plan is **recorded** (one undo each).
- Opening something else (Start, a stage, End) **replaces** the current state, so it isn't an undo
  of its own (`replacePresent`).

**When the page opens**, it brings back the browser copy (section 5) and opens the last stage in the
stage order. With no copy, or one that can't be read, it starts with `emptyPlan()`, with Start open and no
labware out (Andy, 2026-10-26: an empty plan, not the preview's example plan, which would be made-up
data everyone has to clear first).

**The page's own state**, which isn't part of the plan, undo, or the files:
- which labware is **out** (in the editor) and which is put away (section 6);
- whether arrows are shown (on at first);
- which stages show their transfer list (none at first);
- the open editing box, and its unsaved changes (section 10);
- the **brush**: the component picked, or the eraser, and its volume (section 8);
- the **next transfer's volume** (section 9);
- a chosen **source** well, while a transfer is being made (section 9);
- the **Biomek files box**, while it's open, and the run it will write (section 5).

The experiment's name isn't the page's own: it's part of the plan (`transfer-designer.md`), so it's
undone, kept in the browser copy and saved like any edit.

## 5. The header
**The experiment's name** is the page's heading, at the left (Andy, 2026-10-28). It works like a
labware's label (section 6):
- It's a button showing the plan's `experimentName`, or, with none, `Name this experiment` (blue, in
  a dashed outline). Its tooltip is `Click to name the experiment`.
- Clicking it turns it into a text box, as large as the name, holding the name, selected. Empty,
  the box shows the **placeholder** (gray example text) `e.g. Exp36`; spell check is off, since
  names like `Exp36` aren't words.
- **Checked as it's typed** with `checkExperimentName` (`file-writer.md`): while what's typed isn't a
  valid name (and isn't blank), the box has a red border and the message bar shows the check's
  message (error). Spaces at the ends don't count.
- **Enter** or **clicking away** saves it with `setExperimentName` as one undoable edit: message
  `Named the experiment Exp36.` (ok), or, for a blank name, `The experiment has no name now.`
  (note). An unchanged name saves nothing. A name that isn't valid isn't saved: Enter keeps the box
  open with what was typed, selected, to fix it; clicking away closes it, leaving the name as it was,
  with the check's message showing.
- **Escape** closes the box without saving.

**Biomek files** (solid blue, first) opens a small box under it, like Reset's: **Write the Biomek
files?** It works out the run's files at once, with `writeRunFiles(plan, now)` (`file-writer.md`),
`now` being the moment the box opens, and shows what Write files will save:
- If the files can be written: `This saves`, the zip's name on a line of its own in monospace
  (`<folder name>.zip`, e.g. `2026-10-28_172600_Exp36.zip`), then `holding the folder <folder name>,
  with Setup.csv, Stages.csv and 3 Transfer From File files.` (the count from the files), with
  `Cancel` and `Write files` (solid blue), focused on Write files.
- If the plan is refused, `writeRunFiles`'s message instead (for example `Name the experiment first:
  the files' folder is named after it.`, or an overdraw), in red, with Write files disabled and
  Cancel focused. The page shows the writer's messages unchanged, with no wording of its own, so
  they never name a part of the page that may later change (Andy, 2026-10-28).

The time is fixed when the box opens, so the name it shows is the name Write files saves (Andy,
2026-10-28: "tell you what file name it's actually generating").

**Write files** builds one zip with `zipFiles` (`zip.md`): each file under the folder, as
`<folder name>/<file name>`, dated with the same moment. Where the browser can ask where to save
(Edge and Chrome can), it asks, suggesting `<folder name>.zip`; message `Saved <file name>. Unzip it
into <BASE_FOLDER>, then point the method's setup worklist at <BASE_FOLDER><folder name>\Setup.csv.`
(ok; `BASE_FOLDER` from `config/paths.js`). If the user closes that dialog, nothing happens and the
box stays open. Otherwise, or if the browser refuses, the zip goes to the downloads; message `Saved
<file name>, in your downloads.` and the same instructions. The box then closes.

**The header's two boxes**, Biomek files' and Reset's, close with Cancel, with Escape, by clicking
their button again, by opening the other one, and with **a press anywhere outside them**: they hold
nothing the user has done, so closing loses nothing (Andy, 2026-10-28). The Biomek files box also
closes **whenever the plan changes** (including undo and redo by key), so it never saves files
worked out before a change.

**Save** saves the plan as a plan file, with `planToText(plan, savedBy)`, where `savedBy` is
`transfer designer v` and the tools' version from `package.json` (e.g. `transfer designer v0.2.0`;
the page imports it, and the build bundles it in). The suggested file name is
`transfer plan YYYY-MM-DD.json`, by the computer's own date (not UTC). Where the browser can ask
where to save (Edge and Chrome can), it asks; message `Saved the plan as <file name>.` If the user
closes that dialog, nothing happens. Otherwise, or if the browser refuses, the file goes to the
downloads; message `Saved the plan as <file name>, in your downloads.`

**Open** asks for a `.json` file and opens it with `planFromText`. It replaces the plan shown as one
undoable edit, opens the plan's last stage, brings out exactly the labware the plan uses, closes any
editing box, clears any source, and picks the plan's first component (or nothing). Message `Opened
<file name>. Undo brings back the plan you had before.` If the file can't be opened: `<file name>:
` and `planFromText`'s message (`This file can't be opened: …`); nothing changes.

**Reset** (red outline) opens a small box under it, focused on Cancel: **Reset the whole plan?**
`This clears the starting contents, every transfer and every stage. Undo can bring them back.` with
`Cancel` and `Reset everything` (solid red). Reset everything replaces the plan with `emptyPlan()` as
one undoable edit, opens Start, puts all labware away, closes any editing box, clears any source,
and picks no component. Message `Reset. Bring out the labware you need, then fill wells from the
Start card. Undo brings the plan back.`

**The browser copy** (ADR 0010). After every change to the plan, including undo and redo, the page
stores `planToText(plan, savedBy)` in the browser's local storage, under the key
`biomek-tools transfer designer: plan`. When the page opens, it reads that copy back with
`planFromText`, before storing anything (so it never overwrites the copy with the plan it starts
with), and if it opens:
- the history starts with it (nothing to undo), its labware out, its first component picked;
- message `Brought back the plan you were working on in this browser.`

If the copy can't be read, the page starts as with no copy, with the message `The plan kept in this
browser couldn't be brought back, so here's an empty plan instead. (<the reason>)`. If the browser
has no local storage or refuses it (e.g. a private window), the page works without the copy and says
nothing. Saving a file doesn't touch the copy; Reset leaves it holding the empty plan.

## 6. The deck panel
**First bar.** On the left, the timeline (section 11); on the right, `Undo`, `Redo` (each disabled
when there's nothing to undo or redo; messages `Undone.`, `Redone.`) and the problem count: `No
problems` in green, or `N problems` in red: each contents problem in the whole plan (a draw into
the dead volume, an overdraw or an overfill, including a well that starts over its capacity;
`contents-tracking.md`) counts as one, and so does each stage with a mix problem
(`stagesWithMixProblem`).

**Second bar.** On the left, the **labware tray**; on the right, the key and the `Arrows` toggle,
both about what the deck draws. On a narrow window the right side wraps onto its own line.

**Third bar.** `Components:` in gray, then the component colors, from the left, wrapping onto more
lines under each other. Hidden while the plan has no components. (Andy, 2026-10-26: the colors
used to sit at the right of the second bar, unlabelled, and wrapped onto a line of their own pushed
to the right, which looked scattered.)
- **The tray** has a chip for each labware in the deck description: a tiny outline of its shape
  (dots for a plate, stripes for a reservoir) and its label. They're in two groups, `Used labware:`
  and `Unused labware:` (used: by the plan, `labwareUsed`), each in the deck's order; an empty group
  is hidden. Clicking a chip brings that labware out, or puts it away; a chip is shown pressed (blue)
  while its labware is out. Its tooltip says `Bring out <label>` or `Put away <label>`. Putting
  labware away clears a source chosen on it. Undo doesn't change what's out.
- **The key** shows only marks on the deck now: `Overdraw` (a well with a red ring and a red X),
  `Overfill` (a well with a red ring and a red bar across it), `Only dead volume` (a well striped
  blue), `Off plan` (a well with a red ring), and `Mix problem` (a red ⟳ badge, drawn as on the
  deck but in the line, not on a well), in that order, each while that mark is on the deck. Its example wells are drawn as
  the marks on the deck are (below), the X's lines 2px thick. With none, the key is hidden.
- **The component colors** (third bar): each component's swatch and name, in the plan's order.
- **`Arrows`** (pressed while on) shows or hides the transfer arrows.

**The labware** that's out, one block each, in the deck's order, **two to a row**: side by side,
then the next two below, never three in a row (Andy, 2026-10-26). Blocks are 20px apart. Each takes
half the row, but never less than its own width, so when two don't fit side by side they stack.
When the window is 1000px wide or less, one per row. With none out: `No labware is out. Click a
labware above to bring it into the editor.`
- **Heading:** the label in bold, as a button (tooltip `Click to rename`); beside it, small and gray,
  the deck name and labware type, e.g. `Plate · BCFlat96`. Clicking the label turns it into a text
  box holding the label, selected. Enter or clicking away saves it with `setLabel` (message `Renamed
  <name> to <label>.`); Escape cancels. A label that's unchanged saves nothing. If `setLabel`
  refuses it (e.g. another labware has it), its message is shown and the label stays as it was.
  Clicking away still does what that click would, unless the label was refused, as for a
  transfer's volume (section 7).
- **A 96-well plate** is a grid of round wells, with column numbers above (in an 18px row) and row
  letters at the left (in a 22px column). **A reservoir** (numbered grid) is a row of 12 tall
  troughs, each as tall as 8 wells, with rounded corners; its trough numbers `1` to `12` are above,
  as a plate's column numbers are, and it has the same 22px space at the left, empty, so a reservoir
  is exactly the same size as a plate (Andy, 2026-10-26).
- A wide labware scrolls sideways inside its block rather than shrinking its wells.

**Each well** shows what it holds at the point the deck shows (section 11):
- **Empty:** white, with its well name (e.g. `A1`, or `5` on a reservoir) in small gray text.
- **Holding something:** filled with its components' colors, in proportion (for a plate well, a pie,
  in the order the components are listed in the well; for a trough, bands from the bottom up), with
  its total volume in short form (section 13) in the middle, on a small white label (white at 88%
  opacity, 4px corners, 2px × 3px padding), so it reads on any component color (Andy, 2026-10-26).
- **Holding only dead volume:** a well whose total is at most its labware's dead volume
  (`deadVolumeOf`, `deck.md`), so a tip can reach none of it, is filled as above but under
  diagonal stripes of the page's background color at 75% opacity (3px stripes, 7px apart, at
  45°), so it reads as liquid that's out of reach; its label is still the total. The same on
  plates and troughs (Andy, 2026-10-30: one rule for every labware). An empty well isn't striped.
- Its accessible name is the well and its contents, e.g. `Assay plate A1, 120 µL` or `Assay plate
  A2, empty` (holding only dead volume: `Assay plate A1, 20 µL, all dead volume`), then, if the open stage mixes it, how much: `Assay plate A1, 120 µL, mixed 17%`.

**Pointing at a well** shows its contents card at once, beside the well: to its left if it fits there
(the cursor's volume label is to the right), otherwise to its right, and kept inside the window. The
card (dark, light text) shows:
- the well, e.g. `Assay plate A1`; its total, `120 µL total`, or `Empty`;
- if it holds something: its usable volume, `100 µL usable`, or, when that's 0, `0 µL usable: all
  of it is dead volume`;
- for each component: its swatch, name, volume in µL and percentage (section 13);
- the labware's limits, in small gray text: `Capacity 360 µL · dead volume 20 µL` (`capacityOf`
  and `deadVolumeOf`, `deck.md`);
- for each contents problem of this well, by its kind (`contents-tracking.md`), in the problem
  color: a draw into the dead volume, `Transfer #5 asked for 400 µL but only 300 µL was above the
  dead volume (held 2300 µL, dead volume 2000 µL).`; an overdraw, `Transfer #5 asked for 60 µL but
  this well held 50 µL.`; an overfill, `Transfer #5 brought this well to 380 µL, over its 360 µL
  capacity.`, or, for the start, `Starts with 400 µL, over its 360 µL capacity.`;
- if the well is off plan: `Contents differ from the plan because of transfer #5, #7.`;
- if the open stage mixes the well: `Mixed 17% of well`: its mixed share (`mixVolumes`,
  `mixedWells`; `mix-volumes.md`), rounded **down** to a whole percent, so a short mix never reads
  as 40%; if the stage mixes it in more than one row, the smallest. In yellow (`#FFD45C`) when the
  mix is short. For the well causing a mix problem instead: `Holds too little to mix: the mix is
  0.8 µL, under 1 µL.` (the minimum, `MIN_MIX_VOLUME`; today 1 µL), in the card's problem color; for the other wells of that row: `Not mixed
  until the well in red is fixed.`;
- if the well causes a mix problem in an earlier stage than the one open (or the deck shows End):
  `Stage 1, “Tiny dispense”, can't mix this well: its mix is 0 µL, under 1 µL.`, in the card's
  problem color: the first such stage, its mix volume, and `MIN_MIX_VOLUME` (today 1 µL).

Transfer numbers are positions in the operation list counting from 1. The card hides when the
pointer leaves the well, the page scrolls, or a drag starts.

**Marks on the wells** (from `contents-tracking` at the point the deck shows):
- **Overdraw:** a source well a transfer asked for more than its usable volume (a `"dead-volume"`
  or `"overdraw"` problem; `contents-tracking.md`): a thick red ring and a big red X behind its
  label. The X is two red lines, 3px thick with rounded ends, each 120% of the well's
  width, crossing at the well's center at ±45°, so it's exactly centered (a "×" character sits
  wherever the font puts it) and reaches a little past the well's edge.
- **Overfill:** a well a transfer filled over its capacity, or that starts over it (an `"overfill"`
  problem): a thick red ring and a red bar behind its label: one red line, 3px thick with rounded
  ends, 120% of the well's width, horizontal through the well's center (the X's lines, but one and
  level). A well that's both overdrawn and overfilled shows both marks.
- **Off plan:** a well whose contents differ from the plan because of an overdraw: a thick red ring.
- **The open stage's wells:** while a stage with transfers is open, every well its transfers don't
  touch fades (to 30% opacity; 70% while pointed at).
- **Mixing:** while a stage with transfers is open, each well it mixes, at either end, has a **⟳
  badge** at its top right (section 15), in blue; in yellow when the mix is **short** (under
  `SHORT_MIX_SHARE` of what the well holds; `mix-volumes.md`); in **red** for the well that causes
  a **mix problem** (`mix-volumes`, `problems`): red for problems, yellow for warnings (Andy,
  2026-10-30). In a row with a mix problem, its other wells stay blue, not yellow: only the well to
  fix is marked, since the row's volume means nothing until it's fixed. A well mixed in more than
  one row is red if it causes a problem in any, otherwise yellow if any of its mixes is short. Blue
  and yellow badges are only the open stage's, as with its arrows. **A red badge stays**, as an
  overdraw's marks do: from the stage with the mix problem through every later stage and End,
  whichever stage is open (Andy, 2026-10-30: problems are seen wherever you look). Start shows none. A short mix is a warning, not a problem: it doesn't count in the problem count,
  and the files can still be written (Andy, 2026-10-30: the warning shows only on the deck; a
  warning in the Stages column was tried and left for later).
- **A chosen source:** a blue outline. **The well under a drag:** a dashed blue outline. **A box being
  dragged across** (when filling wells, or sending a source into several): each well in it gets a
  blue outline, and an empty one a light blue fill.

**Arrows.** While a stage with transfers is open and `Arrows` is on, each of its transfers is drawn
as a straight arrow from its source to its destination, on top of the wells, in the color of the
source's main component (the one it holds most of) as the stage starts, or gray if it's empty then.
Each end stops short of the well's center, by 11px or a third of the arrow's length if that's less,
so it's inside the well but clear of the volume label. Each arrow is a 2px line and a filled
triangular head, 12px from tip to base and 12px wide at the base. A head can sit on a well of its
own color and be hard to see; that's accepted (Andy, 2026-10-26: a white edge around the arrows was
tried and dropped, since it looked worse). A transfer from a well into itself has no arrow. An end
on labware that's put away ends at that labware's chip in the tray instead.

## 7. The Stages column
From the top: **Start**, then one **tip group box** per tip group (`tipGroups`), each holding its
stages in stage order, then **End**. Exactly one of them is **open**, as a card; the others are
one-line rows. Clicking a row opens it.

**Rows and cards share one look.** A row shows a number in a small round badge, a name, and a count
at the right. A card shows the same at the top, then its contents. (Until 2026-10-30 a card also
said `Current` in blue at the right. It went to leave room for a stage's name beside its ✎: an open
card already stands out, with a blue badge and border and its contents shown; Andy, 2026-10-30.) **An open stage's card has its ✎ just after its name**, which opens the stage's editing
box (section 10); the count stays at the right (Andy, 2026-10-30: it frees the settings line, and
keeps the ✎ in one place on every stage).

**Start** (number `0`, name `Start`, count `N wells filled`: the wells holding something at the
start). Its card holds `Pick what to fill wells with, then click or drag across wells on the deck.`
and the palette (section 8).

**A stage** (number: its place in the stage order, from 1; its name; count `N transfers`). Its card
holds:
- **its settings in one line**, gray, e.g. `↑ Slow ⟳   ↓ Non-Contact`: ↑ is the aspirate mode (at
  the sources), ↓ the dispense mode (at the destinations), from `modeOf`, or `custom` if the
  settings aren't one of the modes; a **⟳** after an end's mode means that end mixes. The two ends
  sit 18px apart, with no `·` between them, and wrap onto two lines if the card is narrow (Andy,
  2026-10-30: modes and ⟳ only; the volumes are in the editing box and the contents card). (No
  probe count: a stage uses all its tips' probes, and the tip group's heading counts them.) Its
  accessible name says "aspirate" and "dispense" in place of the arrows, and "mixing" in place of
  ⟳, e.g. `aspirate Slow, mixing, dispense Non-Contact`. (Its ✎ is beside the stage's name, above.)
- with no transfers: `No transfers yet. Add some on the deck.`
- otherwise, `Show transfers ▸`, which shows its **transfer list** (and becomes `Hide transfers ▾`,
  which folds it away again). Each stage remembers whether its list is shown, while the page is open.
  Each row is `Assay plate A1 → Drug plate B2`, then its volume, `20 µL`, and a `×` at the right
  that removes it (`removeTransfer`; message `Removed Assay plate A1 → Drug plate B2 from stage 2,
  “Drugs”.`). No `·` separates the route from the volume: the volume sits at the right, so a dot
  after the route was left hanging (Andy, 2026-10-30).
- **A transfer's volume** is a button: clicking it turns it into a text box holding the volume,
  selected. It's saved with `changeVolume` (message `Volume changed to 25 µL.`); an unchanged volume
  saves nothing; Escape cancels.
  - **Enter** saves it and opens the next transfer's volume box in the same stage, its volume
    selected, so a list of volumes can be typed one after another (Andy, 2026-10-26). On the
    stage's last transfer, Enter saves and closes.
  - **Clicking away** saves it and closes, and the click still does what it would, once: clicking
    another transfer's volume opens that one, and clicking `×` removes that transfer. (Saving
    redraws the list, so the page saves as the press starts, then passes the click on to whatever
    is now under the pointer; the rest of that press is stopped, so nothing acts on it twice.) Only
    a press with the main button (a left click, a touch or a pen) is passed on; any other press,
    such as a right click, saves and closes the box and does nothing else, as it would with no box
    open.
  - **A refused volume**: its message is shown. After Enter, the box stays open with what was typed,
    selected, to fix it. After clicking away, the box closes and the click does nothing else, so
    the message saying why stays in view instead of being replaced by the click's own (Andy,
    2026-10-26); the user clicks again.
- **Pointing at a row** singles out its transfer on the deck: its row is tinted, its arrow stays
  while the stage's other arrows fade (to 12%), and its source and destination wells get a 3px blue
  ring standing 2px outside the well, with a gap, so it stands out from the well's fill (Andy,
  2026-10-26). **While a volume box is open**, its transfer is singled out the same way whatever the
  pointer does: pointing at other rows does nothing until the box closes, so the deck never shows
  one transfer while another's volume is being typed (Andy, 2026-10-26: letting the pointer move it
  could cause a mistake). So Enter moves the highlight with the box.

A stage **with a contents problem** (`stagesWithContentsProblem`), row or card, has a light red
background and border, and the tooltip `This stage has a problem: a transfer asks a well for more
than it holds above its dead volume, or fills a well over its capacity.`
A stage **with a mix problem** (`stagesWithMixProblem`) looks the same, with the tooltip `This stage
mixes a well that holds too little: the mix is under 1 µL.` (the minimum, `MIN_MIX_VOLUME`, from `config/`; today 1 µL); one with both has the contents problem's
tooltip.

**A mix step** (`isMixStep`) looks like any other stage, row or card, with a **⟳ after its name**
in gray (`Mix plate ⟳`), so the names line up (Andy, 2026-10-29: only problems are color coded).
Its count is `N wells mixed`. Its card holds no settings line (the ⟳ after its name says what it
is; Andy, 2026-10-30), then:
- with no wells: `No wells mixed yet. Click or drag across wells on the deck.`
- otherwise `Show wells ▸` / `Hide wells ▾`, remembered as a stage's list is, showing a row per
  mixed well: `⟳ Plate1 A2`, then, where a transfer's volume goes, how much of the well is mixed:
  `33% of well` (its mixed share, rounded down; section 6), `too little` in red for the well causing
  a mix problem, or `–` for the other wells of that row; then a `×` that stops mixing it
  (`unmixWell`; message `Stopped mixing Plate1 A2.`). Pointing at a row singles out its well on the
  deck, as for a transfer.

**End** (number `✓`, name `End`, count `N transfers done`: every transfer in the plan's transfer
stages; mix steps' mixed wells aren't counted, since they move no liquid; Andy, 2026-10-30). Its card
holds `The deck shows the plates after every stage has run. Open a stage to add or change
transfers.`

**Tip group boxes.** Each is a rounded box around its stages, light blue, alternating with light
sand, so each tip change stands out. Its heading, at the top left, is the tip change: a small tip
icon, `New tips · BC230 · 2 tips`, and a ✎ that opens its editing box (section 10). The count is how
many tips the tip change loads: one per probe it loads (`tipGroups`' `probes`), chosen in its box
(Andy, 2026-10-30). Pointing at the heading shows the tooltip `Loads 2 tips. Every stage until the
next new tips uses all of them.` (The preview showed `2 probes` here until 2026-10-25, when it was
removed as confusing; it came back, counted as tips, on 2026-10-26, so a user could save tips.)

**Adding stages and tip changes: the seams.** Stages in a box sit 10px apart. The space between two
cards, above a box's first stage, and below a box's last stage, is a **seam**. Pointing at a seam,
or moving keyboard focus to its buttons, shows a blue line across it with a `+` in a 26px circle in
the middle (tooltip `Add a stage here`), floating over the cards; the `+` is two white bars, 2px
thick and 12px long, crossing at the circle's center, so it's exactly centered (a "+" character
sits wherever the font puts it; Andy, 2026-10-26). Between two stages of a box, also a
tip button (tooltip `New tips here`), the same size, **just right of the `+`**, 6px from it. Each
seam button has a **fixed spot**: the `+` always in the exact middle of the line, the tip button
always just right of it; a seam without a tip button leaves its spot empty, so nothing moves from
one seam to the next (Andy, 2026-10-30, from the mixing preview: buttons spread along the line
looked scattered, and buttons that shift when one is missing jump around). **Just left of the
`+`**, 6px from it, every seam has the **mix step button**: a 26px circle, white with a blue border
and a blue ⟳, like the tip button (tooltip `Add a mix step here`). A seam never takes room of its own, and never
takes a click meant for a card. Each `+` adds a stage into the box it's in, and opens it (message
`Added a stage. New transfers go into it.`):

| Seam | `+` adds | Accessible name |
|---|---|---|
| above a box's first stage | at the top of the box: `addStage(plan, thatStage, { takeTips: true })`, so the new stage takes the box's tips | `Add a stage at the start of these tips` |
| between two stages | just before the lower one: `addStage(plan, lowerStage)` | `Insert a stage before stage 3, “Drugs”` |
| below a box's last stage | at the end of the box: `addStage(plan, nextBoxFirstStage)`, or `null` for the last box | `Add a stage at the end of these tips` |

The **mix step button** adds a mix step where the `+` would add a stage, with the same tips
(`addMixStep`, with the same `beforeId` and `takeTips` as the `+` in the table), and opens it
(message `Added a mix step. Click or drag across wells on the deck to mix them.`), as one undoable
edit. Its accessible names are the `+`'s with "a mix step" for "a stage", e.g. `Insert a mix step
before stage 3, “Drugs”`. (Andy, 2026-10-29: choosing a mix step with the button you press, rather
than a kind in the stage's box, which made two workflows.) A new stage or mix step copies the
nearest of its own kind (`transfer-designer.md`).

The tip button adds a tip change before the lower stage (`addTipChange`; message `New tips before
stage 3, “Drugs”.`), which starts a new box there.

**What changed glows.** When a stage or a tip group box appears that wasn't there at the last
drawing, it glows soft yellow (`#FFF1BF` background, a 4px `#F3D36B` ring) and fades over 1.2
seconds. A glow carries on through redrawing. Nothing glows when the page first draws, or when
something is only opened or edited.

**Keeping things in view.** When a different entry opens, the column scrolls just enough to show
all of it; when an editing box opens, it scrolls just enough to show the box. When `Show
transfers` opens a stage's list, the column scrolls smoothly (the browser's own smooth scrolling)
just enough to show the whole card; a card taller than the column is shown from its top, so the
list starts at its first transfer (Andy, 2026-10-26). Hiding the list doesn't scroll.

## 8. Starting contents (Start open)
While Start is open, clicking a well fills it, and dragging from one well to another across one
labware fills the box between them; each fill is one undoable edit.

**The palette**, in the Start card: a chip for each component (its swatch and name), in the plan's
order, each with a small ✎ beside it; then `+ New`; then `Eraser`. Picking a chip or the eraser
gives it a blue outline (the eraser, red); nothing changes size or moves. Under them, one line saying
what a click does:
- a component picked: `Adds `**`1000 µL`**` of Media to each well you click, on top of what's there.
  Type a number to change it.`
- the eraser: `Eraser: click or drag to empty wells.`
- nothing picked, with components: `Pick a component to fill wells with it.`; with none: `Add a
  component with + New, then fill wells with it.`

**Filling.** With a component picked, a click or a box adds the brush's volume of it to each well
(`addToWells`; message `Added 1000 µL of Media to 3 wells.`). If a fill takes a well over its
capacity, the message is an error instead: `Added 1000 µL of Media to 3 wells, but Assay plate A1
starts with 1400 µL, over its 360 µL capacity.` (the first such well in the starting contents'
order); a well already over before the fill isn't reported again. A starting volume is the
volume put in the well, dead volume included (roadmap, item 11): the page subtracts nothing. With the eraser, it empties them
(`emptyWells`; message `Emptied 3 wells at the start.`). With nothing picked: `Pick a component in
the Start card first, or add one with + New.` A drag that ends off the labware it started on fills
nothing.

**The brush's volume** starts at `DEFAULT_FILL_VOLUME` (section 14) and is typed (section 13). It
stays while the page is open.

**Adding components.** `+ New` becomes a text box (`Component name`). Enter adds the typed name
(spaces at the ends removed) with `addComponent`, picks it, and opens a fresh box for the next name,
so several can be added in a row. Enter on an empty box, Escape, or clicking away ends; clicking away
with a name typed adds it first. The new component's color is the first in `COMPONENT_COLORS`
(section 14) that no component has. If all are taken: `All 30 colors are in use, and two components
can't share one. Remove a component to add another.` If `addComponent` refuses the name, its message
is shown and the box stays open with the name, to fix it. Message `Added Media.`

**Editing a component**: its ✎ opens its editing box (section 10), floating just under its chip, over
the chips below, moved left if needed to stay inside the Start card:
- **Name**: a text box.
- **Color**: swatches. At first, 10: the first 10 colors in `COMPONENT_COLORS` that are free or the
  component's own, in list order; its own color is always among them (in place of the 10th if it's
  further down the list). `More colors` shows all 30, and becomes `Fewer colors`. A color another
  component has is faded and crossed out, can't be chosen, and its tooltip says `Used by Drug_A`. The
  component's own color is outlined.
- **Remove**: asks first, in the box: `Remove Media from 4 wells?` (or `Remove Media?` if it's in no
  well), with `Cancel` and `Remove` (solid red). Remove takes it out with `removeComponent` (message
  `Removed Media from 4 wells. Undo can bring it back.`, or `Removed Media. Undo can bring it back.`)
  and closes the box. If it was picked, the first component left is picked, or the eraser if none is.
- **Save** renames and recolors as one edit (`renameComponent`, then `setComponentColor` if the color
  changed; message `Saved Media.`). If it was picked, the renamed component stays picked.

## 9. Transfers (a stage open)
While a stage is open, transfers made on the deck go into it, with the next transfer's volume.

**Clicking.** Clicking a well chooses it as the **source**: message `Source Assay plate A1 chosen.
Click the destination well, or drag across several.`, and a dashed arrow follows the cursor from it,
in the color of what the source holds now (gray if empty). Clicking another well adds the transfer
and clears the source. Clicking the source again, or Escape, clears it: `Source cleared.`

**Dragging** from one well to another (a move of at least 5px) adds one transfer between them, with
the same arrow while dragging. Dropping on the same well: `Dropped back on the same well, so nothing
was added.`; off any well: `Drop on a well to add a transfer.`

**One source into many wells.** With a source chosen by clicking, dragging across a box of wells on
one labware adds one transfer from that source into each well of the box, skipping the source
itself, as one edit (`addTransfers`): message `Added 4 transfers of 50 µL from Drug plate A1 to stage
2, “Drugs”.` The box is highlighted while dragging, and the source is cleared afterwards. A box
holding only the source: `The box held only the source well, so nothing was added.` A drag ending on
other labware: `Drag across wells of one labware to send the source into each of them.`

**After adding** (`addTransfer`): `Added to stage 2, “Drugs”: Drug plate A1 → Assay plate A1, 20
µL.` If the edit caused a **new contents problem**, the message is an error instead, by the
problem's kind (`contents-tracking.md`): an overdraw, `Added, but transfer #5 asks for 60 µL from
Drug plate A1, which holds 50 µL.`; a draw into the dead volume, `Added, but transfer #5 asks for
400 µL from Reservoir 5, which has only 300 µL above its dead volume.`; an overfill, `Added, but
transfer #5 brings Assay plate A1 to 380 µL, over its 360 µL capacity.` (with several transfers,
`Added 4 transfers of 50 µL from Drug plate A1, but transfer #5 asks …`). If the logic refuses
the transfer, its message is shown.
- A **new contents problem** is one that wasn't there before the edit: a transfer that has a problem
  now but didn't, or wasn't in the plan. Transfers are recognized across the edit because the
  operation list keeps every unchanged transfer as the same object (`operation-list.md`). A
  problem of the starting contents (`operationIndex` `null`) is recognized as the same problem
  across edits, so adding transfers never reports it; filling wells can (section 8).
- The message names a new transfer's own problem, if one of the added transfers has one;
  otherwise the first new problem in the run, such as a later transfer now left short.
- An edit that leaves only the problems that were already there gives the usual message.

(Found 2026-10-26: the message used to name the plan's last overdraw, which needn't be one the
edit caused. Adding a transfer that runs first and empties a well named a later transfer.)

**The next transfer's volume** starts at `DEFAULT_TRANSFER_VOLUME` (section 14), is typed (section
13), and carries over to the next transfer. It shows at the arrow's tip while a source is chosen or
a drag is under way.

**A mix step open.** Clicking a well **mixes** it (`mixWells`; message `Mixing Plate1 A2.`), or, if
the mix step mixes it already, **stops** mixing it (`unmixWell`; `Stopped mixing Plate1 A2.`).
**Dragging** across a box of wells on one labware mixes each well in it that isn't mixed yet, as one
edit (`Mixing 12 wells.`; a box of wells all mixed already: `Those wells are mixed already.`). There
is no source, arrow or volume at the cursor; the box is highlighted while dragging, as when filling
wells. If the edit leaves a well causing a mix problem or an overdraw that wasn't there before, the
message is an error instead: `Mixing Plate1 A2, but it holds too little to mix.` (Andy,
2026-10-29: a click mixes a well, again stops mixing it, a drag mixes a box.)

**End open.** Nothing can be added: clicking a well says `End shows the finished plates. Open a
stage to add transfers into it.`, and dragging does nothing.

## 10. Editing boxes
Components, stages and tip changes each have a ✎ that opens an **editing box**, floating just under
it, over what's below, so nothing moves. (A stage's ✎ is in its card's heading, so its box floats
just under the heading.) One box is open at a time; clicking the open box's ✎ again
closes it, as a click outside would (below). Its ✎ is shown pressed while it's open.

**Changes in a box are a draft** until saved:
- At the bottom: `Remove` (red outline) at the left, if the box has one; `Discard` and `Save` (solid
  blue) at the right.
- **Save** puts all the box's changes in as one undoable edit and closes the box. Enter in a name box
  saves too. If the logic refuses, its message is shown and the box stays open.
- **Discard**, or **Escape**, closes the box without saving.
- **A click outside** a box with no changes closes it, and the click still does what it would (e.g.
  clicking another chip picks it). With unsaved changes, the click does nothing else: the box gives a
  small sideways shake, its Save and Discard pulse twice with a thick blue ring, and the message bar
  says `Save or discard your changes first.`
- `Remove` acts at once after its own question (Cancel / Remove), not through Save.

**A stage's box** is 320px wide (other boxes are 280px), so its menus show their whole names, such
as `Non-Contact`. From the top:
- **Name** (a text box).
- **A grid** with the stage's ends as columns, headed `Aspirate` and `Dispense`, and its settings
  as rows, each labeled once at the left (Andy, 2026-10-29: simpler and less cluttered, with no
  information lost). It has two rows. **Mode**: in each column a menu of the pipetting modes
  for that end (`modesFor`), choosing one setting that end's technique and liquid type
  (`modeSettings`, with `mixes` `true` when that end's Mix is checked, so it keeps mixing; a mode
  that can't mix unchecks it, below); if the stage's settings at that end aren't one of the modes, its menu shows
  `(not one of the modes)` first. The menus' accessible names are `Aspirate mode` and `Dispense
  mode`, since their column headings aren't their labels. **Mix**: in each column a checkbox,
  checked while that end mixes (Andy, 2026-10-29: on or off, with no options). Checking it gives
  the end `DEFAULT_MIX` (`transfer-designer.md`), or its own mix if it already had one; unchecking
  it stops the end mixing. Its accessible names are `Mix before aspirating` and `Mix after
  dispensing`, and its tooltip says what it does, from that end's mix (or `DEFAULT_MIX` if it
  doesn't mix): `Mix before aspirating: 90% of the well, 3 times, at 400 µL/s.`. When the saved
  stage mixes at that end and has transfers, the volume it works out to comes after "of the well":
  `(≈ 108 µL)`, or `(≈ 18–200 µL)` when its rows differ (`mixVolumes`).
  - **A mode that can't mix** (Non-Contact): that end's Mix cell shows `Can't mix` in gray, with the
    tooltip `Non-Contact can't mix.`, instead of a checkbox. Choosing it in the menu unchecks that
    end's Mix in the draft; choosing a mode that can mix brings the checkbox back, unchecked.
  - **An end that isn't one of the modes** (`(not one of the modes)`): its checkbox shows whether it
    mixes, disabled, with the tooltip `Choose a mode to switch mixing.`, since the tool can't know
    which technique mixes.

  **Save** builds the stage's settings from the draft, end by end: the chosen mode's settings, with
  its mixing technique when that end's Mix is checked (`modeSettings`), and the end's mix
  (`DEFAULT_MIX`, its own mix, or `null`); then `changeStageSettings`, which checks them.

  ```
              ASPIRATE      DISPENSE
  MODE      [ Medium  ▾ ]  [ Medium  ▾ ]
  MIX         [✓]            [ ]
  ```
- **Remove**, which asks `Remove stage 2, “Drugs” and its 4 transfers?` (or `Remove stage 2,
  “Drugs”?` with none). Remove takes it out (`removeStage`; message `Removed stage 2, “Drugs” and
  its 4 transfers. Undo brings it back.`, or without "and its …"); if it was open, the first stage
  in the stage order opens. When it's the only stage, Remove is disabled, with the tooltip `Keep at
  least one stage.`

**Save** renames it (if the name changed) and changes its settings as one edit (message `Saved stage
2, “Drugs”.`). Settings the box doesn't offer, such as the stage's mixes, are kept as they are.

**A mix step's box** (280px): **Name**; then a note saying how it mixes, from its `destinationMix`:
`Mixes each well: 90% of the well (≈ 108 µL), 3 times, at 400 µL/s.`, with the volume as for a
transfer stage's Mix tooltip (section 10, above), or `(no wells yet)` while it has none; then
**Remove**, as for a stage, asking `Remove stage 2, “Mix plate” and its 4 mixed wells?`. No modes:
a mix step's settings are its own (`transfer-designer.md`, "Mix steps"). (Andy, 2026-10-29: mixing
has no options for now.)

**A tip change's box**: **Tip type**, a button per tip type (`TIP_TYPES`), one chosen; **Probes**,
buttons `1` to `8`, choosing how many probes get tips (`probesFor`), with every probe the tip change
loads highlighted (picking 4 lights up 1 to 4; Andy, 2026-10-30: moved here from the stage's box,
since every stage uses all its tips' probes); **Remove**, which asks `Remove these new tips?` and
removes it (`removeTipChange`; message `Removed the new tips: the stages after them keep the tips
before.`). The first tip change has no Remove, and says `The run always starts by loading tips, so
these can't be removed.` **Save** sets the tip type and probes as one edit (`setTipType`,
`setTipProbes`; message `New tips: BC230 on 4 probes.`).

**A component's box**: section 8.

## 11. The timeline: what the deck shows
The deck shows the plates at one point in the run, chosen by what's open:

| Open | The deck shows | Caption |
|---|---|---|
| Start | the starting contents | `At the start, before any stage` |
| a stage with transfers | the plates after that stage | `After stage 2 of 4, “Drugs”` |
| a stage without transfers | the plates as it will start: after the stages with transfers before it | `As stage 3, “New stage”, will start (no transfers yet)` |
| End | the plates after every stage | `At the end, after all stages` |

Only a stage's end is shown, never part-way through a stage, because within a stage the Biomek
chooses its own order (B56358AF, 22-25). Stage numbers in captions are places in the stage order,
and the total is the number of stages.

The caption sits at the top left of the deck panel, after two small buttons `‹` and `›` (side by
side, before the caption, so they stay put however long it is). `‹` opens the entry before (Start,
the stages in stage order, End), and `›` the one after; `‹` is disabled at Start and `›` at End.
They're the same as clicking that entry in the Stages column.

After any edit, what's open stays open (unless the edit opens something else: sections 5, 7 and 10),
and the deck shows its point again.

## 12. Keys and messages
**Keys** (none while typing in a text box or menu, which keep their own keys):
- **Digits, `.` and Backspace** type a volume (section 13), at any time: the brush's while Start is
  open (not with the eraser), and the next transfer's while a stage is open. Not while End is open.
- **Escape** closes the open editing box without saving, or the open header box (section 5);
  otherwise clears a chosen source.
- **Ctrl+Z** undoes; **Ctrl+Y** or **Ctrl+Shift+Z** redoes (**Cmd** on a Mac). Not while an editing
  box is open, since its changes aren't in the plan yet.

**The cursor's label.** While the pointer is over the deck, a small label beside it (14px right,
26px up) shows what a click does: with a stage open, the next transfer's volume, `50 µL`; with Start
open, `+ 1000 µL Media`, `Eraser`, or `No component picked`; with End open, nothing.

**The message bar** floats at the bottom center of the window, at most 720px wide, and shows the
latest message until the next replaces it; it's hidden when empty. It's announced to screen readers.
Each message has a kind: **ok** (green on pale green), **note** (gray on white, with a border) or
**error** (dark red on pale red, with a border). Messages are listed with what causes them in
sections 5 to 10. The kinds: errors from the logic, contents problems after adding or filling, a file that can't be
opened, a browser copy that can't be read, and `All 30 colors are in use…` are **error**; `Added…`, `Saved…`, `Renamed…`, `Named…`, `Opened…`, `Volume changed…` and `New
tips…` are **ok**; the rest are **note**.

**Stages in messages** are named by place and name, e.g. `stage 3, “New stage”`, so two stages with
the same name can't be confused. **Wells** are named by the labware's label and the well, e.g. `Assay
plate A1`.

## 13. Typing volumes and showing numbers
**Typing a volume.** The first key after an edit starts a new number: a digit replaces the volume,
`.` gives `0.`, and Backspace empties it. Later keys add to it: digits and one `.` are added at the
end, and Backspace removes the last character. A volume typed as nothing shows as `?`. When used, a
volume that's a number (digits, optionally `-`, and a decimal part) is passed on as a number;
anything else is passed on as typed, so the logic's message says what's wrong.

**Numbers shown:**
- **Volumes** (cards, lists, messages): rounded to 2 decimal places, e.g. `33.33`; a volume below
  0.01 µL that isn't 0 is shown in exponent form with one decimal, e.g. `4.0e-3`.
- **Volumes inside wells** (short form): below 1, `<1`; from 10,000, thousands rounded with `k`,
  e.g. `12k`; otherwise rounded to a whole number.
- **Percentages** (contents card): rounded to 2 decimal places, e.g. `16.67%`; below 0.01% but not
  0, in exponent form, e.g. `4.0e-3%`.
- **Counts** take a plural `s` except for 1: `1 well`, `3 wells`.

## 14. Configuration
Two files in `config/` (ADR 0009), each data only, with comments saying where the values come from:
- **`config/component-colors.js`** exports `COMPONENT_COLORS`: the 30 colors components can have
  (Andy, 2026-10-25), as `#RRGGBB` text, ordered so the most distinct come first (a new component
  takes the first free one, so similar colors only appear once there are many components):
  `#4e79a7`, `#f28e2b`, `#59a14f`, `#e15759`, `#b07aa1`, `#edc948`, `#76b7b2`, `#ff9da7`, `#9c755f`,
  `#17becf`, `#1f3d7a`, `#bcbd22`, `#7b2d8e`, `#a0cbe8`, `#ffbe7d`, `#8cd17d`, `#8b0000`, `#b6992d`,
  `#499894`, `#d4a6c8`, `#c85200`, `#006d2c`, `#ff6f91`, `#6b6ecf`, `#637939`, `#fabfd2`, `#5c3c1b`,
  `#9edae5`, `#ce6dbd`, `#2b2b2b`.
- **`config/default-volumes.js`** exports `DEFAULT_TRANSFER_VOLUME` (`50`) and `DEFAULT_FILL_VOLUME`
  (`1000`), in µL: the volumes the next transfer and the brush start with when the page opens.

The page also uses the transfer designer's configuration (`config/pipetting-modes.js`,
`config/tip-types.js`) through that module, and the deck description through `deck`.

## 15. Visual design
The page should look calm and be easy to scan, like the randomizer's. Its colors and sizes are
defined once, in `transfer-designer.css`, as named CSS variables.

The look below is the one the page was built with (PR #72), which Andy kept (2026-10-26: "I think
it's really good"), with the changes from his testing. Anything not listed here stays as built.
Small text is kept soft: gray where it's secondary, and no bigger than it needs to be (Andy,
2026-10-26: bigger, darker text in the header, the bars and the buttons "felt harsher").

- **Page and panels:** background `#F6F5F1`; the experiment's name, the page's heading, 28px
  semibold, and its text box 26px semibold, 340px wide; with no name, `Name this experiment` 22px
  in blue, medium weight (500), in a dashed light blue outline; white panels with a thin border (`#E2E0D8`), rounded corners (10px) and 20px padding, 20px apart;
  the page at most 1500px wide, centered.
- **Type:** `"Segoe UI", system-ui, sans-serif`, 15px with line height 1.4; well names, grid
  headings, stage numbers, transfer rows and volumes in `Consolas, "Cascadia Mono", monospace`. Text
  `#1C1C1A`; secondary text gray (`#5E5E58`). Notes, counts and the settings line 13px gray.
- **The bars above the deck:** the timeline's caption 13px gray; the tray's group names 13px gray;
  the key and the component colors (one shared style) 12px gray, 4px apart between lines and 12px
  between items, as is the `Components:` label; swatches (here, on component buttons, and in the
  contents card) 12px circles.
- **Blue** (`#2F5DA8`) for actions and what's chosen, with a light border (`#9DB7DB`) and tint
  (`#EEF3FA`). **Red** (`#C4362A`) for problems, with a pale background (`#FCE9E7`) and border
  (`#E8A39B`). **Green** text `#22603A` on `#EDF5EF`.
- **Buttons**, in a few groups, each styled once (Andy, 2026-10-26: "if things were grouped, keep
  them grouped. Prioritize simplicity"):
  - every button has 13px text (the timeline's `‹` and `›`, 16px arrows) and 6px corners, and is
    34px tall unless built smaller (chips, probe buttons, `‹` and `›`, as built);
  - **action buttons**, which do something (`Save`, `Open`, `Undo`, `Redo`, `‹`, `›`, `Arrows`,
    and every `Cancel` and `Discard`): blue text with a light blue border (`#9DB7DB`), white;
  - **choice buttons**, which pick something (labware chips, component chips, probe buttons, tip
    type buttons): dark text with a gray border (`#CFCDC4`), white; picked ones are marked in blue,
    as sections 6, 8 and 10 say;
  - **the main action** (`Biomek files`, a box's `Save`): solid blue, white text, semibold;
  - **danger** (`Reset`, `Remove`): red text with a light red border (`#E8A39B`); the confirming
    button of their questions (`Reset everything`, and `Remove` beside `Cancel`): solid red;
  - **disabled** buttons: gray text and border on a light gray background, whatever their group;
  - buttons with a look of their own keep it: `Show transfers`, a transfer's volume and `×`, a
    labware's label, the seams, and the Stages column's rows.
- **Wells:** 36px, 4px apart; an empty well white with a gray border (`#BDBDB5`), its name 10px.
  Grid headings 12px gray.
- **Tip group boxes:** 12px corners; light blue (`#EEF3FA`, border `#9DB7DB`), alternating with light
  sand (`#F5F1E8`, border `#D9D2C3`).
- **Editing boxes:** 280px wide; a stage's 320px (section 10). In a stage's box, the grid's column
  headings and row labels look like the box's other field names (12px, semibold, gray, capitals);
  the label column is as wide as its widest label, and the two end columns share the rest equally,
  8px apart; the menus there have 4px side padding instead of 10px, so whole mode names fit.
- **Contents card:** dark (`#1C1C1A`) with light text (`#F6F5F1`), problems in `#FFB4AA`, a short
  mix's line in `#FFD45C`.
- **⟳ badges** (section 6): a 14px circle centered on the well's top-right edge (at 45° from its
  center; a reservoir trough's top-right corner), with a ⟳ in it, 10px, and a 1px white border so it
  stands out on any fill. Blue: fill `#2F5DA8`, ⟳ white. Short: fill `#FFD45C`, ⟳ `#8A6400`. Mix
  problem: fill red (`#C4362A`), ⟳ white. Drawn
  above the well and its label, below arrows; they don't fade with the open stage's other wells
  (they're on the stage's own wells).
- **The Mix row** in a stage's box: the checkboxes centered in their columns; `Can't mix` 13px gray.
- **Motion:** with the system's "reduce motion" setting, no fades, glows or smooth scrolling.
- **Headings** `Deck` and `Stages` are there for screen readers but not shown.

## 16. Testing
The page itself isn't unit-tested in Node: every rule about plans is in the logic modules, which
are. `transfer-designer-page.test.js`, inside `describe("transfer-designer-page", …)`, checks only the
page's configuration (ADR 0009):
- `COMPONENT_COLORS`: 30 entries, each `#` and six hexadecimal digits, none repeated (ignoring case).
- `DEFAULT_TRANSFER_VOLUME` and `DEFAULT_FILL_VOLUME`: numbers above 0.

**By hand**, before each release, in Edge and Chrome, opening the built file:
- each item in sections 5 to 13 behaves as described;
- saving, then opening the saved file in a new window, gives the same plan; reloading the page
  brings the plan back; a private window starts empty and works;
- clicking, dragging, and sending one source into a box of wells, in all four directions;
- every editing box: Save, Discard, Escape, a click outside with and without changes, Remove;
- a stage's ✎ beside its name: it opens the stage's box under the card's heading, its menus show
  `Non-Contact` whole, and a stage whose settings aren't one of the modes shows `(not one of the
  modes)` in that end's menu; in a window about 1400px wide, where the Stages column is at its
  minimum, the box fits inside the column and the heading shows `New stage` whole;
- the experiment's name: naming, a name refused as typed, Enter and clicking away, Escape, undo and
  redo, and the name kept after saving and opening, reloading, and in a plan file of version 1
  (none);
- Biomek files: the box with no name, with an overdraw, and ready; the zip's name it shows is the one
  saved; the header boxes closing on a press outside, on Escape, and the Biomek files box on undo by
  key;
- a zip saved, unzipped into the base folder on the Biomek PC, and run there in simulation, with
  any security warnings noted;
- undo and redo with the buttons and the keys, after each kind of edit;
- a plan with an overdraw shows the marks, the key, the red stage and the problem count;
- capacities and dead volume: a trough filled with little more than its dead volume, then drawn
  from past it: the X, the dead-volume message in the card and after adding, the stage red, the
  problem counted, the Biomek files refused; the trough then holding only dead volume: striped,
  `Only dead volume` in the key, `0 µL usable` in the card; a plate well filled past its capacity
  at Start, and another taken over it by a transfer: the bar, `Overfill` in the key, the messages,
  the count, the refusal; a well both overdrawn and overfilled shows both marks; every card shows
  the usable volume and the limits line; the stripes and marks on a plate and on a trough alike;
- mix steps: the ⟳ on seams (always just left of the `+`) adds one and opens it; clicking a well
  mixes it, again stops mixing it, and dragging mixes a box; its card's `N wells mixed`, ⟳ after its
  name, its wells' list with `N% of well` and `×`; its box's note and Remove; a new mix step copies
  the nearest mix step and a new stage the nearest transfer stage; End's count leaves mixed wells
  out; the Biomek files write a mix step's row and file;
- mixing: checking and unchecking Mix at each end, then Save, Undo and Redo; the card's ⟳; choosing
  Non-Contact for Dispense on a stage whose destination mixes unchecks it and shows `Can't mix`; an
  end `(not one of the modes)` shows a disabled checkbox; the tooltips' volumes; ⟳ badges on the open
  stage's mixed wells only, red for the well causing a mix problem (a mix under 1 µL; that row's
  other wells blue; the red badge staying through later stages and End, with `Mix problem` in the
  key), yellow for a short mix (e.g. BC230 tips mixing a deep well holding
  1000 µL), and `Mixed N% of well` in the contents card; a short mix isn't counted as a problem;
  a saved plan reopens with the same mixing, and its Biomek files have the mix columns;
- the Stages column with 20 stages stays inside the window, at the top of the page and scrolled down;
- a window narrower than 1000px stacks the panels.
