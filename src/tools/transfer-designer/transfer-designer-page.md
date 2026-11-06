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

> **Draft changes (2026-10-31, page tweaks, from Andy's use of the #118 build; branch
> `page-tweaks`):** a picked color swatch keeps its color; Remove in every box acts at once, with no
> question; the tip button on a tip group's last seam adds a stage with new tips (superseded on
> 2026-11-01 by the seams between tip groups, below); a transfer row
> with a contents problem shows its volume in red, with a short tooltip; the contents card shows
> only the well, its components and problem or warning lines (sections 6, 7, 10 and 16; the
> roadmap's "Six page tweaks"). They become Final once built and tested by Andy.

> **Draft changes (2026-11-01, seams, the first part of v0.2.0's item 9):** from the randomizer
> preview Andy shaped on 2026-10-31 (the buttons on a seam mixed what adds to a tip group with what
> starts a new one, all in one spot): seams inside a tip group add with that group's tips, and new
> seams between tip groups add with new tips (sections 7, 15 and 16). The tip button on a tip
> group's last seam, from the page tweaks of 2026-10-31, goes: a seam between tip groups does what
> it did. They become Final once built and tested by Andy.

> **Draft changes (2026-11-01, well labels, the second part of v0.2.0's item 9):** from the
> randomizer preview Andy shaped on 2026-11-01: right-click a well to name it (its **well label**,
> `docs/glossary.md`); a `Names` toggle beside `Arrows`; a labeled well shows its label in its
> volume's place; the contents card shows the label first (sections 4, 6, 15 and 16). The page
> says "name" (`Right-click to name`, `Names`); the specifications say "well label", since "well
> name" already means a well's place, such as `A1`. They become Final once built and tested by Andy.

> **Draft changes (2026-11-01, randomizations, the third part of v0.2.0's item 9; ADR 0012):** from
> the randomizer preview Andy shaped on 2026-10-31 and 2026-11-01: the dice button on seams between
> tip groups; a randomization's box, heading and card in the Stages column; picking sources and
> wells to fill on the deck; its stages shown but changed only through its card; a chosen source's
> ring standing off the well, everywhere (sections 4, 6, 7, 9, 15 and 16). Written in one sitting
> while Andy was away, so still to review with him: the choices listed in its pull request. They
> become Final once built and tested by Andy.

> **Draft changes (2026-11-01, constituents and concentrations; ADR 0013):** from the preview Andy
> shaped on 2026-11-01: a `Contains` field in a component's box, for its constituents; what a
> component carries after its name on its chip; a `Concentrations` group on the contents card
> (sections 2, 6, 8, 13, 14, 15 and 16). Written while Andy was driving, so still to review with
> him: the choices listed in its pull request. They become Final once built and tested by Andy.

> **Draft changes (2026-11-01, moving and copying; ADR 0014):** from the preview Andy shaped on
> 2026-11-01: selecting in the Stages column as in PowerPoint's slide panel, dragging to move,
> Ctrl+drag to copy, Ctrl+C and Ctrl+V, and right-click menus with Copy and Paste (sections 2, 4, 7,
> 12, 15 and 16). Written in the hands-off workflow (CLAUDE.md, "Workflows"), so the choices made for
> Andy are listed in its pull request. They become Final once built and tested by Andy.

> **Draft change (2026-11-02, build versions; ADR 0015):** the page shows its version at the bottom
> right, and saved plan files record it (sections 3, 5, 15 and 16), from a preview Andy saw on
> 2026-11-02. It becomes Final once built and tested by Andy.

> **Draft changes (2026-11-02, moving wells, item 12 of v0.2.0):** from the preview Andy shaped on
> 2026-11-02: a `Move wells` button left of `Undo`, and moving wells, in which a well's every use
> moves to a free well by clicking or dragging, while the Stages column can be looked through but
> not changed (sections 2, 6, 7, 12, 15 and 16; `transfer-designer.md`, "Moving wells"). Written
> in the hands-off workflow (CLAUDE.md, "Workflows"), so the choices made for Andy are listed in its
> pull request. They become Final once built and tested by Andy.

> **Draft changes (2026-11-02, a filler of several wells, item 13 of v0.2.0):** from the preview
> Andy shaped on 2026-11-02 and 2026-11-03: several sources can be filler wells, each row showing
> its share; one filler stage; a randomization that's out of date says so in its heading and card,
> counts as a problem, and holds back the Biomek files (sections 5, 6, 7 and 16;
> `transfer-designer.md`, "Randomizations"). Written in the hands-off workflow (CLAUDE.md,
> "Workflows"), so the choices made for Andy are listed in its pull request. They become Final once
> built and tested by Andy.

> **Draft change (2026-11-05, M offered):** M is an offered unit (`concentrations.md`, section 7),
> so a Contains row's unit menu reads M, mM, µM, g/L, %, × (section 8, from the configuration; no
> page rule changes), and section 16 checks it. Written in the hands-off workflow (CLAUDE.md,
> "Workflows"). It becomes Final once built and tested by Andy.

> **Draft changes (2026-11-05, osmolality; ADR 0016):** from what Andy decided on 2026-11-05: an
> `Osmolality` field in a component's box, for its stock's measured value; the value in the chip's
> tooltip; and an `Osmolality` line on the contents card, `≈ 305 mOsm/kg`, or which components have
> no value (sections 2, 6, 8, 13, 15 and 16). Not tried in a preview first: written in the
> hands-off workflow (CLAUDE.md, "Workflows"), so the choices made for Andy are listed in its pull
> request. They become Final once built and tested by Andy.
>
> **Draft changes (2026-11-05, shared tips, item 18 of v0.2.0; ADR 0018):** from a preview Andy
> approved on 2026-11-05: a randomization card's Sources list shows its sources in boxes of sources
> that share tips, with seams whose tip button joins two boxes or splits one, and rows dragged by a
> grip to move a source by the container rule; a change of sharing or order alone makes Update
> available (sections 7, 15 and 16; `transfer-designer.md`, "Sharing tips"). Written in the
> hands-off workflow (CLAUDE.md, "Workflows"), so the choices made for Andy are listed in its pull
> request. They become Final once built and tested by Andy.

> **Draft changes (2026-11-05, cell density, item 16 of v0.2.0):** decided with Andy on
> 2026-11-05: cells entered as a constituent in cells/mL (offered in the unit menu, the amount box
> taking `1.5e6` as well as `1500000`); on labware with a growth area (today the 96-well flat
> plates), the contents card gives a well's cells in cells/cm²; cell figures in powers of ten,
> e.g. `4.69 × 10⁴ cells/cm²` (sections 6, 8, 13, 15 and 16). Written in the hands-off workflow
> (CLAUDE.md, "Workflows"), so the choices made for Andy are listed in its pull request. It
> assumes PR #133 (M offered) is merged first, so the unit lists here include M. They become Final
> once built and tested by Andy.

> **Draft change (2026-11-05, tips used, item 17 of v0.2.0):** End's count says how many tips of
> each tip type the run loads, after its transfers, e.g. `24 transfers done · 32 BC230 tips · 8
> BC1070 tips` (Andy, 2026-11-05), with a tooltip (sections 7 and 16; `transfer-designer.md`,
> `tipsUsed`). Written in the hands-off workflow (CLAUDE.md, "Workflows"), so the choices made for
> Andy are listed in its pull request. It becomes Final once built and tested by Andy.

> **Draft changes (2026-11-05, transfer tables, item 19 of v0.2.0; ADR 0019):** the seams' table
> button, the transfer table wizard (Table, Sources, Review), a transfer table's box in the Stages
> column, its stages' ✎ boxes with what's locked, the problem count and the Biomek files box
> (sections 5, 6, 7, 10, 12, 15 and 16), from previews Andy shaped on 2026-11-05. Written in the
> hands-off workflow (CLAUDE.md, "Workflows"), so the choices made for Andy are listed in its pull
> request. They become Final once built and tested by Andy.
>
> **Draft changes (2026-11-05, a randomization's settings on its stages, item 20 of v0.2.0):** a
> randomization's stages and their tip groups get their ✎ (name locked, no Remove), and its card's
> Each transfer and Tips show its stages' own values, `Mixed` where they differ, and set them all at
> once on Update (sections 7 and 10, and 16), from a preview Andy shaped on 2026-11-05. Written in
> the hands-off workflow, so the choices made for Andy are listed in its pull request. They become
> Final once built and tested by Andy.

> **Draft change (2026-11-05, Ctrl-click keeps the source, item 21 of v0.2.0):** in a transfer
> stage, Ctrl-click (or Cmd-click) a destination, or Ctrl+drag across a box, adds as a click or
> drag does and keeps the source chosen, so the next destination is one more Ctrl-click (sections
> 9, 12 and 16), from a preview Andy approved on 2026-11-05. Written in the hands-off workflow, so
> the choices made for Andy are listed in its pull request. It becomes Final once built and tested
> by Andy.
> **Draft changes (2026-11-05, stock tables, item 22 of v0.2.0):** `Paste table` and `Copy table`
> in the Start card's palette: a dialog that adds many components at once from a table pasted from
> Excel, with what each contains and its osmolality, and a button copying every component as such a
> table (sections 8 and 16; `transfer-designer.md`, "Stock tables"), from a preview Andy shaped on
> 2026-11-05. Written in the hands-off workflow (CLAUDE.md, "Workflows"), so the choices made for
> Andy are listed in its pull request. They become Final once built and tested by Andy.

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
saving and opening plans, with a browser copy, writing the Biomek files as one zip, moving,
copying and pasting stages, tip groups and randomizations, and moving wells.

Not in version 1 (see `docs/roadmap.md`):
- **A guided start** for an empty plan (Andy considered it, 2026-10-26: not now).
- **Collapsing tip groups** in the Stages column.
- **Moving a transfer** to another stage, or within its stage (`transfer-designer.md`).
- **Cut and Delete** (Ctrl+X, the Delete key) of what's selected (ADR 0014).
- **Concentrations on the deck.** A well shows its volume (or its label); its concentrations are on
  the contents card only. A toggle showing one constituent's concentration on every well may come
  with use (`docs/roadmap.md`, "Later").
- **Osmolality on the deck.** Likewise, a well's osmolality is on the contents card only.
- **Messages in the page's own terms everywhere.** Some messages from the shared modules use
  internal terms, such as "starting contents entry 3" (roadmap, "Technical debt").

## 3. Layout
From the top:

| Where | What |
|---|---|
| Header | The experiment's name, as the page's heading; on the right, the buttons `Biomek files`, `Save`, `Open` and `Reset` (section 5). The tool's name isn't shown on the page (Andy, 2026-10-28): the browser tab says `Transfer Designer`. |
| Deck panel (left) | Three bars, then the labware that's out (section 6). |
| Stages column (right) | Start, the tip groups with their stages, and End (section 7). |
| Below both, at the right | The **version line**: `Transfer Designer` and the build's version, e.g. `Transfer Designer 0.2.0-dev.488+3cc65a9` (`scripts/build-version.md`, "The page's version"; `0.2.0-unbuilt` when served unbuilt). It's text, not a control: a click selects the whole version, so it can be copied in one go (a double-click would stop at its `.`, `-` and `+`; from the build, 2026-11-02). |
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
- whether arrows are shown (on at first), and whether well labels are shown (on at first);
- which stages show their transfer list (none at first);
- the open editing box, and its unsaved changes (section 10);
- the **brush**: the component picked, or the eraser, and its volume (section 8);
- the **next transfer's volume** (section 9);
- a chosen **source** well, while a transfer is being made (section 9);
- the **open randomization's card** and its unsaved changes (section 7, "Randomizations"), which
  tab it shows, and whether each randomization's source list is shown in full;
- the **Biomek files box**, while it's open, and the run it will write (section 5);
- whether **moving wells** is on, and the well picked to move (section 6); off when the page opens,
  so not kept by the browser copy;
- the **selection** in the Stages column, the last thing clicked there (for Shift-click), and the
  **copied items** (section 7, "Moving and copying"); the copied items are also kept in the
  browser's local storage, for other tabs.

The experiment's name and the well labels aren't the page's own: they're part of the plan
(`transfer-designer.md`), so they're undone, kept in the browser copy and saved like any edit.

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
- Before asking the file writer, if a randomization is out of date (`isRandomizationOutOfDate`; the
  file writer never reads randomizations, so the page checks), the first in the column's order is
  named instead, in red, with Write files disabled: `A randomization (at stage 1, “Drug”) is out of
  date: open it and press Update.` (its first stage, as messages name stages; Andy, 2026-11-02).
  Transfer tables likewise (2026-11-05; `isTransferTableOutOfDate`): the first randomization or
  transfer table out of date, in column order, is named: `A transfer table (at stage 3, “Media”) is
  out of date: open it and press Update.`

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
`transfer designer v` and the build's version as the version line shows it (e.g. `transfer designer
v0.2.0-dev.488+3cc65a9`, or `transfer designer v0.2.0-unbuilt` served unbuilt; ADR 0015). The suggested file name is
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
`This clears the starting contents, every transfer, every stage and every well's name. Undo can bring them back.` with
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
**First bar.** On the left, the timeline (section 11); on the right, `Move wells` (below, "Moving
wells"; beside `Undo`, since it changes the plan: Andy, 2026-11-02, beside `Names` and `Arrows` it
read as a view setting), `Undo`, `Redo` (each disabled
when there's nothing to undo or redo; messages `Undone.`, `Redone.`) and the problem count: `No
problems` in green, or `N problems` in red: each contents problem in the whole plan (a draw into
the dead volume, an overdraw or an overfill, including a well that starts over its capacity;
`contents-tracking.md`) counts as one, and so does each randomization that's out of date
(`isRandomizationOutOfDate`; section 7), each transfer table that's out of date
(`isTransferTableOutOfDate`; 2026-11-05), and each stage with a mix problem. Since that check
reruns each randomization on a copy (and reads each transfer table again), the page works it out
once per plan (after each edit, undo or
redo) and reuses it for the headings, the problem count, the card and the Biomek files box
(`stagesWithMixProblem`).

**Second bar.** On the left, the **labware tray**; on the right, the key, then the `Names` and
`Arrows` toggles, all about what the deck draws (Andy, 2026-11-01: display toggles belong
together). On a narrow window the right side wraps onto its own line.

**Third bar.** `Components:` in gray, then the component colors, from the left, wrapping onto more
lines under each other. Hidden while the plan has no components. (Andy, 2026-10-26: the colors
used to sit at the right of the second bar, unlabeled, and wrapped onto a line of their own pushed
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
- **`Names`** (pressed while on; on when the page opens) shows each labeled well's label where the
  well otherwise shows its volume (or, if it's empty, its well name; below); off, every well shows
  its volume or well name as before. Tooltip `Show well names instead of volumes on named wells`. An action button, like
  `Arrows`, just left of it.
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
- **Holding only dead volume:** a well that holds something but whose usable volume is 0
  (`usableVolumeOf`, `contents-tracking.md`; the page never subtracts the dead volume itself), so
  a tip can reach none of it, is filled as above but under
  diagonal stripes of the page's background color at 75% opacity (3px stripes, 7px apart, at
  45°), so it reads as liquid that's out of reach; its label is still the total. The same on
  plates and troughs (Andy, 2026-10-30: one rule for every labware). An empty well isn't striped.
- **Labeled** (`wellLabelOf`), while `Names` is on: its label in place of its volume (or, empty,
  its well name), on the same small white label, in the page's text font, semibold, centered
  (section 15): a label with a space wraps at spaces onto at most two lines; a single word stays on
  one line in slightly smaller type; either is cut with `…` if it still doesn't fit (about 7
  letters fit on a line, e.g. `Vehicle`; `Staurosporine` shows as `Stauro…`). A reservoir trough
  shows its label along its length, turned 90° counterclockwise, reading bottom to top. Its fill, stripes and marks are
  as for any well; its volume is in the contents card. A trough's label wraps at spaces into at
  most two columns, and is cut with `…` if it still doesn't fit. (Andy, 2026-11-01: in the volume's place,
  so the deck's look doesn't change, and a toggle to see the volumes again.)
- Its accessible name is the well and its contents, after its label if it has one (whether `Names`
  is on or not), e.g. `Cond 1, Assay plate A1, 120 µL`, or `Assay plate A1, 120 µL` or `Assay plate
  A2, empty` (holding only dead volume: `Assay plate A1, 20 µL, all dead volume`), then, if the open stage mixes it, how much: `Assay plate A1, 120 µL, mixed 17%`.

**Pointing at a well** shows its contents card at once, beside the well: to its left if it fits there
(the cursor's volume label is to the right), otherwise to its right, and kept inside the window. The
card (dark, light text) shows:
- for a labeled well, its label first, on a line of its own, larger and bold (section 15), then
  the well under it, smaller and quieter (Andy, 2026-11-01: the label is what's looked for);
- the well, e.g. `Assay plate A1`; `Empty` if it holds nothing;
- for each component: its swatch, name, volume in µL and percentage (section 13);
- if the well carries any constituent (`concentrationsOf`, `transfer-designer.md`): after the
  components, under a thin rule, a group headed `Concentrations` (small capitals, quiet), then one
  line per entry: the constituent's name at the left and, at the right in the volume's monospace
  style, its amount and unit in the unit that fits it best (`bestUnit`, `concentrations.md`; the
  amount as section 13 shows amounts), e.g. `Dye` … `476 µM`, `Hy-Soy` … `2.5 g/L`. In the order
  `concentrationsOf` gives. Nothing of this for a well carrying nothing, so a plan without
  constituents sees no change. **Cells** (2026-11-05; `concentrations.md`, "Cells"): the page
  goes through `concentrationsOf`'s entries as above; an entry whose family is the cells' family
  (`isCellFamily`) is shown as a cell figure (section 13), e.g. `Cells` … `1.5 × 10⁵ cells/mL`;
  but when the well's labware has a growth area (`growthAreaOf(labware) !== null`, `deck.md`;
  today the 96-well flat plates; the page needs the area for the tooltip anyway), its line shows
  the well's **seeding density** instead: the entry of `seedingDensitiesOf`
  (`transfer-designer.md`) with the same name (safe: within a plan a constituent's name has one
  family, so the name picks out one entry), e.g. `Cells` … `4.69 × 10⁴ cells/cm²`: one line
  per constituent, in its place in the list, not a second line (Andy, 2026-11-05: on a plate,
  cells/cm² is the number the lab seeds by; a deep well or trough holds a suspension, so it keeps
  cells/mL). The line's tooltip (its `title`) says `Assumes every cell settles onto the well's
  A cm² bottom.`, A being `growthAreaOf` the labware, shown as an amount (section 13). The group's
  heading stays `Concentrations`;
- if the well holds something and **any component in the plan has an osmolality** (its
  `osmolality` isn't `null`; 0, as entered for water, counts) (ADR 0016; `osmolalityOf`,
  `transfer-designer.md`): after the components and any Concentrations group, under
  a thin rule like the group's, one line:
  - with a value (`value` not `null`; 0 is a value, shown `≈ 0 mOsm/kg`): `Osmolality` at the left and, at the right in the volume's monospace style, `≈`,
    the value rounded to a whole number (section 13) and `mOsm/kg`, e.g. `≈ 305 mOsm/kg` (the `≈`
    because it's an estimate from the stocks' measured values; Andy, 2026-11-05);
  - with components missing a value: `Osmolality unknown: no value for Buffer B`, quieter (as the
    Concentrations heading), naming every component of the well without one, in the plan's
    component order: two joined by ` and ` (`no value for Buffer B and Drug stock`), three or more
    by `, ` with ` and ` before the last (`no value for Buffer B, Drug stock and Water`), with no
    quotes. The page joins the names with a small helper of its own, `listWithAnd(names)` (e.g.
    `["A"]` → `A`, `["A", "B"]` → `A and B`, `["A", "B", "C"]` → `A, B and C`): no existing helper
    joins names without quotes (`listNames` in `input-checks` and `listNamesWithAnd` in
    `plan-file.js` and `transfer-designer.js` put each name in quotes, as messages about property
    names do), so none of those is reused. It's not a problem (not in the problem color, not counted): the well's osmolality just isn't known.

  Nothing of this for an empty well, or in a plan where no component has an osmolality, so a plan
  that doesn't use osmolality sees no change, and cards don't all say `unknown`. In a plan whose
  only osmolality is Water at 0, the line still shows: `≈ 0 mOsm/kg` for a well holding only Water,
  and `Osmolality unknown: no value for …` for a well holding anything else;
- (Andy, 2026-10-31: no total, usable-volume or capacity lines. The components add up to the
  total, the labware's limits are the same for every well of it, and holding only dead volume is
  neither a problem nor a warning: the stripes say it. The card shows only problems and warnings
  after the components, and their lines carry the numbers.)
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

- last, quieter than the rest (section 15): `Right-click to name`, or `Right-click to rename` for
  a labeled well, so naming can be found.

Transfer numbers are positions in the operation list counting from 1. The card hides when the
pointer leaves the well, the page scrolls, or a drag starts.

**Naming a well** (its well label; Andy, 2026-11-01). **Right-clicking a well**, or opening the
context menu on a focused well from the keyboard (the menu key, or Shift+F10), opens a **name
box** for it instead of the browser's menu, whatever is open in the Stages column, so wells can be
named once they're seen to be filled. A normal click still does what it always does, and a chosen
source (section 9) stays chosen.
- **Only when nothing else is open.** A right click while a text box (a transfer's volume, a
  labware's label, the experiment's name), an editing box (section 10) or a header box (section 5)
  is open acts as any other press outside it would, and doesn't name the well: a text box saves and
  closes (section 7); an editing box closes if it has no changes, or shakes if it has; a header box
  closes. A second right click then names the well.
- The box is a text box 140px wide, floating 6px under the well, centered on it, kept inside the
  window, above everything else, with a shadow (section 15). It holds the well's label,
  selected, or nothing, with the placeholder `e.g. Cond 1`; its accessible name is `Name of Assay
  plate A1`. The contents card hides while it's open. If the page scrolls, it stays under the well.
- **Enter**, or **clicking away**, saves it with `setWellLabel`, as one undoable edit: `Named
  Assay plate A4 “Media stock”.` (green), or, for a blank name on a labeled well, `Assay plate A4
  has no name now.` (a note). A name that's unchanged after trimming saves nothing (`setWellLabel`
  gives the same plan back, so nothing is recorded). **Escape** closes it and keeps the old label.
  Clicking away still does what that click would, as for a labware's label (above). After Enter
  or Escape, keyboard focus goes back to the well.
- Well labels show only on the deck and in the contents card (and, later, a randomization's card). A
  transfer row keeps its locations (`Assay plate A1 → Drug plate B2`; Andy, 2026-11-01: rows are
  for checking exactly where liquid goes, labels can repeat, and a stage's name already says what
  its source is). The Biomek files never hold them.

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
- **A chosen source** (section 9), and a randomization's sources while its card is open: a 3px blue
  ring standing 2px outside the well, with a gap, as for a singled-out transfer's wells, so it
  shows on a filled well too (Andy, 2026-11-01: the ring hugging the well was hard to see on a
  fill). **A randomization's wells to fill**, while its card is open: a 2px dashed blue outline,
  standing 2px outside the well, and, when empty, a light blue fill (Andy, 2026-11-01: sources and
  wells to fill must look different). **The well under a drag:** a dashed blue outline. **A box being
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

**Moving wells** (Andy, 2026-11-02; `transfer-designer.md`, "Moving wells"). For when a trough (or any
well) can't be used on the day: everything the plan does with one well moves to a free one.
- **`Move wells`**, an action button, starts it. While it's on, the same button reads **`Done`** and
  is solid purple; pressing it ends moving wells, with the message `Done moving wells.` (note).
  Nothing else ends it: the page stays in moving wells after each move, since more than one trough
  may be warped, and Escape never leaves it. Starting it closes an open editing box and an open
  randomization's card (as Close does; if the card can't close, because it has run and has
  changes, it shakes, the message bar says `Update or discard your changes first.`, and moving
  wells doesn't start), and clears a chosen source.
- **What the deck shows** doesn't change: whatever is open stays open, and the deck shows its point
  (section 11; Andy, 2026-11-02: not switched to Start). The timeline's `‹` and `›` work, and so
  does opening an entry from the Stages column (below), so the user can follow a well's transfers.
  The deck panel gets a 2px purple border, and a purple bar above the labware (a light purple
  background, a purple border, 14px text) says what to do: with no well picked, **`Moving wells.`**
  (bold, purple) `Click a well to move it. Its contents, transfers, name and randomizations go with
  it.` `Press Done when finished.` (gray); with one picked, **`Moving Res1 3 “Media stock”.`** (the
  well as messages name it, with its well label in quotes if it has one) `Click a well with a dashed
  outline to move it there.` `Escape picks another well.` (gray). Purple is used only here, so
  moving can't be mistaken for the blue of a chosen source or a randomization's wells.
- **Which wells can be picked:** wells in use (`isWellUsed`), judged over the whole plan, not the
  point shown, so a well a later stage fills can be moved even where it shows empty; except a
  randomization's wells to fill (`isWellToFill`). With no well picked, every other well is dimmed
  (30% opacity). The open stage's own fading of the wells it doesn't touch (section 9) is off while
  moving, so only one kind of dimming shows.
- **Picking:** clicking a well that can be picked, or pressing on one and dragging (as a drag starts
  on the deck, section 9), picks it: a 3px purple ring standing 2px outside it. Then every well not
  in use, on any labware out (including labware brought out from the tray while moving), gets a 2px
  dashed purple outline standing 2px outside it, and, when empty, a light purple fill: the wells it
  can move to. Wells in use other than the picked well are dimmed. Dimmed wells stay at 30% opacity
  when pointed at (unlike the open stage's faded wells). Clicking a well the plan doesn't use: `The plan doesn't use
  Res1 7, so there's nothing to move. Click a well the plan uses.` (note). Clicking or dragging a
  randomization's well to fill: `Wells a randomization fills can't be moved.` (note; Andy,
  2026-11-02). Dragging from either does nothing else.
- **Moving:** clicking a well with a dashed outline, or dropping the dragged well on one (under the
  pointer its outline turns solid and 3px), moves the picked well there with `moveWell`, as one
  edit: `Moved Res1 3 to Res1 7.` (ok). Nothing is picked afterwards. If the problem count (section
  6, "First bar") is higher after the move than before, the message is an error instead: `Moved Res1
  3 to Plate1 A1, which causes 1 problem.` (`2 problems` …), and the marks show where. (Counting,
  rather than matching problems one by one as section 10 does after adding, because a move puts
  every problem of the moved well on another well.) Clicking, or dropping on, a
  well in use moves nothing and keeps the pick: `Plate1 A1 is already used in the plan. Choose a
  well with a dashed outline, or press Escape to pick another well.` (note). Clicking the picked
  well again, Escape, or dropping off the labware lets go of it; dropping on the picked well itself,
  or on a labware between its wells, keeps it picked (from the build's review, 2026-11-02: a drop
  that just misses a well shouldn't lose the pick). If `moveWell` refuses (it shouldn't, after these checks), its message is shown as
  an error.
- **A drag while a well is picked** starts from wherever it's pressed: from another well that can be
  picked, it picks that one instead and drags it; from a randomization's well to fill, the message
  above; from any other well, nothing (a press there that doesn't move is a click, as above).
- **The keyboard:** Enter or Space on a focused well does what a click would. `Move wells` / `Done`
  shows its state with `aria-pressed`, and the bar is announced to screen readers when it changes.
- **The page's own messages** (above) name wells by the labware's label and the well, as section 12
  says; they're the page's wording, not `moveWell`'s.
- **The contents card's last line** says what a click on that well does, in place of `Right-click
  to name`: with no well picked, `Click to move this well`, `Filled by a randomization`, or `Not
  used in the plan`; with one picked, `Click to move Res1 3 here` on a well it can move to,
  `Click to let go of this well` on the picked well, and `Already used in the plan` on a well in use.
- **Off while moving:** naming a well by right-click (`Wells can't be named while moving wells.
  Press Done first.`, note), filling, adding transfers, mixing wells and picking a randomization's
  wells by clicks or drags, typing volumes, and the cursor's label (section 12). `Undo` and `Redo`
  work; a picked well that an undo or redo leaves unable to be picked (not in use, or now a
  randomization's well to fill) is let go. Putting away the labware a picked well is on lets go of
  it, as it clears a chosen source.
- **The header while moving:** `Save`, `Biomek files`, renaming the experiment and renaming labware
  work as usual. `Open` and `Reset` end moving wells (as `Done`, without its message) once they've
  replaced the plan; if they're cancelled, moving wells stays on.
- **The Stages column** can be looked through but not changed (Andy, 2026-11-02): see section 7.

## 7. The Stages column
From the top: **Start**, then one **tip group box** per tip group (`tipGroups`), each holding its
stages in stage order, with each randomization's box where it sits (below), then **End**. Exactly
one of Start, the stages, End and the randomizations is **open**, as a card; the others are
one-line rows (or, for a randomization, its heading). Clicking a row opens it.

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
- **A transfer with a contents problem** (`contents-tracking.md`; the transfer's own problem, the
  first if it has two) shows its volume in red and semibold, with the tooltip `Only 450 µL is
  reachable.` (a draw into the dead volume or an overdraw: `available`) or `Overfills the well by
  20 µL.` (`held` minus `capacity`), so the list and the deck tell one story (Andy, 2026-10-31: the
  list kept saying 200 µL while the deck moved 180).
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
    such as a right click, saves and closes the box and does nothing else (it doesn't name a well,
    section 6).
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

**End's tips** (Andy, 2026-11-05): End's count, row and card alike, goes on to say how many tips
the run loads, by tip type, from `tipsUsed` (`transfer-designer.md`): after `N transfers done`, a
` · ` and `N <tip type> tip` for each entry, in its order (`TIP_TYPES` order), joined by ` · `, e.g.
`24 transfers done · 32 BC230 tips · 8 BC1070 tips`, or `24 transfers done · 32 BC230 tips` when
the run uses one tip type (the tip types and counts here are illustrations, with today's
`TIP_TYPES`). Counts follow section 13 (`1 BC230 tip`, `2 BC230 tips`). With no tips (a plan with
no transfers), the count is `0 transfers done` alone. (A new plan whose only transfers are a mix
step's mixed wells, on the `START` tips, shows `0 transfers done` and then `DEFAULT_PROBE_COUNT`
tips of the first tip type, today `0 transfers done · 4 BC230 tips`: mixed wells move no liquid
but do load tips.)
- **It counts what the Biomek files load:** one tip per probe at each tip change whose tip group
  has transfers (mixed wells included); a tip group with no transfers loads none. So the `START`
  tips count when their group has transfers, a randomization's tip changes count as any others,
  and adding the first transfer to an empty tip group raises the count.
- **Tooltip**, on End's whole count text (`N transfers done` and the tips after it, as one), both
  when End is a row and when it's the open card, whose count sits at the top right as on the row:
  `The run loads 32 BC230 tips and 8 BC1070 tips: one per probe at each tip change whose stages
  have transfers.` (the counts as in the count; with one tip type,
  `The run loads 32 BC230 tips: …`; with three or more, `32 BC230 tips, 8 BC1070 tips and …`).
  With no tips, no tooltip.
- **Wrapping:** the count stays at the right of the row. If it doesn't fit beside `End`, it wraps
  onto a second line, right-aligned, breaking only after a `·`, so each part (`32 BC230 tips`)
  stays whole.

**Tip group boxes.** Each is a rounded box around its stages, light blue, alternating with light
sand, so each tip change stands out. Its heading, at the top left, is the tip change: a small tip
icon, `New tips · BC230 · 2 tips`, and a ✎ that opens its editing box (section 10). The count is how
many tips the tip change loads: one per probe it loads (`tipGroups`' `probes`), chosen in its box
(Andy, 2026-10-30). Pointing at the heading shows the tooltip `Loads 2 tips. Every stage until the
next new tips uses all of them.` (The preview showed `2 probes` here until 2026-10-25, when it was
removed as confusing; it came back, counted as tips, on 2026-10-26, so a user could save tips.)

**Adding stages and tip changes: the seams.** A **seam** (`docs/glossary.md`) is a place in the
column where something can be added. There are two kinds, so what a button adds always matches
where it is (Andy, 2026-10-31: with every button in one spot, it wasn't clear which used the
group's tips and which started new ones):
- **Seams inside a tip group box**: the space between two of its cards (stages in a box sit 10px
  apart), above its first stage, and below its last stage. Their stages and mix steps use **this
  group's tips**; their tip button (between two stages only) splits the group there.
- **Seams between tip groups**: in the gap above the first box (below Start), between two boxes, and
  below the last box (above End). Their stages and mix steps get **new tips**, as a tip group of
  their own.

Pointing at a seam, or moving keyboard focus to its buttons, shows its line and buttons, floating
over the cards. A seam never takes a click meant for a card or a box. While a seam's buttons
show, they sit above every other seam, so a button reaching past its own seam (the 26px buttons of
a box's last seam reach below the box) can still be pointed at and clicked. Keyboard focus moves
through a seam's buttons left to right: the mix step button, the `+`, then the right spot's button.
Inside a box the line is solid blue (2px, 8px in from the cards' sides); between tip groups it's **dashed** blue (2px),
across the column's whole width, so it reads as "a new group here". Every seam has the same
**three fixed spots**, each a 26px circle centered on the line: the **mix step button** (white,
blue border, a blue ⟳) just left of the middle one, 6px from it; the **`+`** (solid blue; two white
bars, 2px thick and 12px long, crossing at the circle's center, so it's exactly centered: a "+"
character sits wherever the font puts it; Andy, 2026-10-26) in the exact middle; and a **right
spot** just right of the `+`, 6px from it. A seam with nothing in its right spot leaves it empty,
so nothing moves from one seam to the next (Andy, 2026-10-30: buttons spread along the line looked
scattered, and buttons that shift when one is missing jump around). Since 2026-11-05 every seam has
a **fourth spot**, just right of the right spot, 6px from it: seams between tip groups hold the
table button there (below, "Transfer tables"); seams inside a tip group box leave it empty.

**Inside a tip group box.** The `+` adds a stage to this box, and the mix step button a mix step
where the `+` would add a stage, with the same tips (`addMixStep`, with the same `beforeId` and
`takeTips` as the `+`). Between two stages only, the right spot holds the **tip button** (white,
blue border, the tip icon), which gives the stages from there on new tips, splitting the box. The
seams above a box's first stage and below its last leave the right spot empty. These seams take no
room of their own: they are the 10px spaces between the box's cards.

| Seam | `+` adds | `+`'s accessible name |
|---|---|---|
| above a box's first stage | at the top of the box: `addStage(plan, thatStage, { takeTips: true })`, so the new stage takes the box's tips | `Add a stage at the start of these tips` |
| between two stages | just before the lower one: `addStage(plan, lowerStage)` | `Insert a stage before stage 3, “Drugs”` |
| below a box's last stage | at the end of the box: `addStage(plan, nextBoxFirstStage)`, or `null` for the last box | `Add a stage at the end of these tips` |

- Tooltips: `+` `Add a stage here, with these tips`; mix step button `Add a mix step here, with
  these tips`; tip button `New tips from here on`.
- The mix step button's accessible names are the `+`'s with "a mix step" for "a stage", e.g.
  `Insert a mix step before stage 3, “Drugs”`; the tip button's is `New tips before stage 3,
  “Drugs”`.
- The `+` and the mix step button add and open the new stage, as one undoable edit (messages
  `Added a stage. New transfers go into it.` and `Added a mix step. Click or drag across wells on
  the deck to mix them.`). The tip button adds a tip change before the lower stage
  (`addTipChange`; message `New tips before stage 3, “Drugs”.`), which starts a new box there.
- (Until 2026-11-01 the seam below a box's last stage also had a tip button, adding a stage with
  new tips there, from the page tweaks of 2026-10-31. It goes: the seam between tip groups just
  below does the same, where it belongs.)

**Between tip groups.** The `+` adds a stage, and the mix step button a mix step, **with new tips**:
`addStageWithNewTips(plan, beforeId)` or `addMixStepWithNewTips(plan, beforeId)`, `beforeId` being
the first stage of the box below the seam, or `null` for the seam above End (`transfer-designer.md`,
"Tip changes and tip groups"). The new stage or mix step is a tip group of its own, loading the tip
type and probes in use there, and the stages below keep the tips they had: above the first box, the
new stage becomes the run's first stage, with the run's first tips, and the stage that was first
gets a tip change of its own loading the same tips. It's added and opened as one undoable edit
(messages `Added a stage with new tips. New transfers go into it.` and `Added a mix step with new
tips. Click or drag across wells on the deck to mix them.`). The right spot holds the **dice
button** (white, blue border, the dice icon; tooltip `Add a randomization here`; accessible name
`Add a randomization before stage 3, “Drugs”`, or `… at the end of the run`), which adds a
randomization sitting there (`addRandomization`, with a random seed, `randomSeed` from
`random-pool`, and the next
transfer's volume, section 9) and opens its card, as one undoable edit (message `Added a
randomization. Pick its sources and the wells to fill.`).
- Tooltips: `+` `Add a stage here, with new tips`; mix step button `Add a mix step here, with new
  tips`.
- Accessible names: `Add a stage with new tips before stage 3, “Drugs”` (above the first box too,
  naming stage 1), or `Add a stage with new tips at the end of the run` above End; the mix step
  button's say "a mix step" for "a stage".
- **Spacing**: Start, the boxes and End sit **18px** apart (12px until 2026-11-01), and each seam
  between tip groups is a 14px band in the middle of its gap (2px clear of each side), so pointing
  almost anywhere between two boxes finds it, and it never reaches into a box or a card.
- **What glows** after adding here: only the new stage or mix step. A box whose tip change only
  moved (the old first stage's, after adding above the first box) isn't new, so it doesn't glow.

A new stage or mix step, added at any seam, copies the nearest of its own kind
(`transfer-designer.md`). (Andy, 2026-10-29: choosing a mix step with the button you press, rather
than a kind in the stage's box, which made two workflows.)

**Randomizations** (`transfer-designer.md`, "Randomizations"; Andy, 2026-10-31 and 2026-11-01).
A randomization is an entry in the column between tip groups, where it sits: a box of its own,
like a tip group's, with seams between tip groups above and below it as for any box.
- **Its box** has 12px corners, a 1px blue border (`#9DB7DB`) and the page's background inside,
  so it reads as a group of tip groups. **Not set up yet** (no stages): a dashed border, and only
  its heading. **Run**: a solid border, its heading, then its stages' tip group boxes, as usual
  (as `columnBoxes` gives them; since 2026-11-05 one may hold several of its stages, when their
  sources share tips, each heading counting its tips as any tip group's does).
  A run randomization's box is **open** (showing its stages) or **closed** (its heading only, and
  its card if that's open), like a folder, exactly as a transfer table's box (below, "Transfer
  tables", "Its box"; Andy, 2026-11-05, item 20: "a randomization's box works the same way";
  until then it collapsed to its heading unless its card or one of its stages was open, so its
  stages couldn't be seen or dragged otherwise): clicking its heading opens or closes it. It also
  opens whenever its card opens or one of its stages becomes the open entry (the timeline's `‹`
  and `›`, section 11, step into and through its stages as any others), and stays open after that
  until its heading closes it. Closing it while its card is open closes the card as `Close` does
  (one with unsaved changes after a run refuses, as `Close` does, and the box stays open). Whether
  each randomization's box is open is remembered while the page is open, by its ID, with the
  transfer tables': not saved in plan files or the browser copy, not an undo step; a new page, or
  a plan opened from a file, starts with every box closed, except one whose card or stage is open.
- **Its heading**, a row the box's width, as a transfer table's: a button (most of the row) holding,
  once it has run, `▸` (closed) or `▾` (open); the **dice icon** (a small SVG of two dice, one
  tilted behind showing three, one in front showing five, in the text's color, so it's the same on
  every PC), then `Randomize` (not set up yet) or `Randomized` (run), semibold, then at the right,
  in gray, `not set up yet` or `68 stages · seed 360310` (the stages it owns; `1 stage`), or, when
  it's out of date (`isRandomizationOutOfDate`), `needs update` in red, semibold (Andy,
  2026-11-02); then, after the button, a **✎** (as a stage's, accessible name `Edit
  randomization`, tooltip `Change its sources, wells and settings, or remove it`), which opens its
  card, or closes it if open (as `Close`), and selects the randomization. **Run**: clicking the
  button (or Enter or Space on it) opens or closes the box and selects the randomization; its
  `aria-expanded` says whether the box is open; tooltip `Show its stages` / `Hide its stages`, or,
  out of date, `The plan changed since this last ran: press ✎, then Update.` **Not set up yet**
  (no stages, so nothing to show or hide; Claude's choice, 2026-11-05): no `▸`/`▾`, and clicking
  the button opens its card, as its ✎ does (or closes it if open); tooltip `Not set up yet: open it
  to finish setting it up.` The button is what the randomization is dragged, copied and given the
  right-click menu by (a press on the ✎ starts no drag). While moving wells (below), a run
  randomization's heading opens and closes its box as usual; a not-set-up one's, which would open
  its card, says why it can't; its ✎ is hidden with the others.
- **Seams around it**: a seam between tip groups above its box and one below, as for any box, and
  **none inside it** (not between its stages' boxes, nor inside them). For one that hasn't run,
  the seam below adds before the same stage as the seam above, then moves the randomization above
  the new stage (`placeRandomization`), in the same edit, so the new stage lands below it.
  Several that haven't run at one place are shown in the order of the plan's randomizations (the
  order they were added, unless moved since), with a seam
  between them adding before the same stage and placing those below it after the new stage.
- **Its stages** look like any stage. **What can be changed on them** (Andy, 2026-11-05, item 20:
  pipetting the normal way, one source of truth): a stage's ✎ opens its box (section 10), and each
  of its tip groups' headings has its ✎ (section 10). **What can't** (Andy, 2026-11-01: so its card
  always matches them): their transfers (no `×`, volumes not buttons), their names, removing them,
  seams inside their tip group boxes. Each one's card says, in gray, `Part of a randomization: its
  sources and wells change in its card.` A click or drag on the deck while one is open adds nothing:
  message `This stage is part of a randomization: change it in its card.` (a note).

**A randomization's card** opens under its heading, inside its box, and is the open entry: the deck
shows the plates where the randomization sits (section 11), and fades nothing. It closes when
anything else is opened, as an open stage does, and opening an editing box (a ✎) or a header box
first closes it as `Close` would. Its changes are a **draft**, until:
- **It hasn't run yet** (Andy, 2026-11-01: closing keeps what was set): `Close`, Escape, clicking
  its heading, or opening anything else saves the draft into the plan with `setRandomization`, as
  one undoable edit (nothing if unchanged), and closes it.
- **It has run** (decided while Andy was away, to confirm: so the card always matches its stages):
  with no changes, those close it. With changes, the footer shows `Discard` beside `Close`;
  `Discard` (or Escape) closes it without saving; anything else that would close it does nothing
  else: the card shakes, as an editing box with unsaved changes does (section 10), and the message
  bar says `Update or discard your changes first.`
- **Randomize** or **Update** (below).
- Any value the logic would refuse (a replicate count that isn't a whole number of at least 1, a
  seed outside 1 to 999,999, a volume of 0 or less, or text) is saved as not given (`null`), so
  the problem then reads `Drug A needs a number of replicates.`, `Type a seed.` or `Set the
  volume.`.
- While the card is open, Undo and Redo are disabled (buttons and keys), since its changes aren't
  in the plan yet; Save, Open, Reset and Biomek files first close it as `Close` would.
- The card's problems are worked out on the draft: the page applies it to a copy of the plan
  (`setRandomization`, with values it would refuse as `null`) and asks `randomizationProblems`,
  putting a box's own message first while it holds what isn't valid.
- The card **is changed** (its draft differs from the randomization) exactly when applying the
  draft gives a different plan (`setRandomization` gives back the same plan when nothing changes),
  so changing only a source's sharing, or only the sources' order, counts as a change (Andy,
  2026-11-05: Update must be offered for it). **Once it has run**, its Each transfer and Tips values
  aren't part of what `setRandomization` is given (its stages hold them; `transfer-designer.md`,
  "Randomizations"), so the card is also changed when any of them differs from what the card
  showed when it opened (2026-11-05, item 20). The page keeps no separate record of sharing: it's in
  the draft's sources and the plan's.

From the top:
- **Two tabs**, `Sources` and `Wells to fill`, each with a count in a small gray pill; the open tab
  is blue and underlined. **The open tab is what clicks on the deck pick** (below), and only its
  contents show. A new randomization opens on Sources; one opened again opens on the tab it was
  last left on (Andy, 2026-11-01).
- **Sources**: with none, `Click wells on the deck to add them.` in gray. Otherwise one row per
  source, in order: its main component's swatch (gray if it holds nothing then), its name
  (`sourceName`), a 40px **replicates box** (accessible name `Replicates of Deep A1`) and a
  **Filler** toggle button (pressed while it's a filler well; tooltip `Filler wells fill the wells
  the replicates leave over, used in list order.`), then a `×` (`Remove source Deep A1`). Any
  number of sources can be filler wells (Andy, 2026-11-02); each press turns only that row's on or
  off. A filler well's row shows, in place of its box, how many wells it fills, its share
  (`fillerShares`, worked out on the draft as the problems are, below): `7 wells`, `1 well`, `0
  wells` (on an exact fit the filler gets none, and no stage), or `?` while a replicate count isn't
  a whole number yet or the volume isn't set, updating as replicates, the volume and wells are
  changed (Andy, 2026-11-01 and 2026-11-02). The filler wells are used in the order of their rows
  (since 2026-11-05 a row can be dragged to change it, below).
  - **Boxes of sources that share tips** (Andy, 2026-11-05, from a preview he approved; ADR 0018;
    `transfer-designer.md`, "Sharing tips"). The rows are grouped in **boxes**, one per **source
    group** (`sourceGroups` of the draft's sources): a box holds the sources whose stages share one
    set of tips. Every source picked starts in a box of its own (new tips, as before this change),
    and the first source always starts new tips (a randomization never shares tips with stages
    outside it). Only the sharing is set here, not which tips (Andy: not per source): those are
    the card's **Tips** (all groups at once) or each tip group's ✎ (one group), section 7, "Each
    transfer" (2026-11-05, item 20).
    - **A box** is a rounded box (10px corners, 1px border, padding 4px 6px 0) in light blue
      (`#EEF3FA`, border `#9DB7DB`), alternating with light sand (`#F5F1E8`, border `#D9D2C3`), as the
      Stages column's tip groups (section 15). Its **heading**, at its top left, 11px semibold gray:
      the tip icon (5px by 11px), then `New tips` for a box of one source, or `New tips · shared by 3
      sources`.
    - **Seams**, as in the Stages column: **inside a box**, a 6px seam above its first row, between
      each two rows and below its last; **between boxes**, a 12px seam above the first box, between
      each two boxes and below the last. Pointing at a seam shows its line (2px blue at 35%
      opacity, 4px in from its sides). The **tip button** (a 22px white circle, 1px `#9DB7DB` border,
      the tip icon in blue) sits centered on the line, showing only while its seam is pointed at or
      it has keyboard focus (it's still in the tab order):
      - on a seam **between two boxes** it **joins** them: the lower box's sources share the upper
        box's tips (the lower box's first source's `sharesTips` becomes `true`, with
        `setSourceSharesTips`). Tooltip and accessible name `Drug B shares the tips of Drug A` (the
        lower box's first source, then the upper box's last, by `sourceName`).
      - on a seam **between two rows in a box** it **splits** the box there: the lower source and
        the sources after it in the box get new tips (its `sharesTips` becomes `false`). Tooltip and
        accessible name `New tips for Drug C and the sources below it in this box`.
      - Seams above the first box, below the last, and at a box's top and bottom have no button.
    - **Moving a source** (Andy, 2026-11-05): each row starts with a **grip**, `⠿` (12px gray, 10px
      wide; tooltip `Drag to move this source`), and the row can be dragged (the browser's drag and
      drop; the grab pointer over it) **from its grip or from any part of it outside its controls**
      (its swatch, its name and the gaps between them), **never from its replicates box, its Filler
      button or its `×`**: pressing in the replicates box places the cursor or selects its text, as
      in any text box, and pressing a button presses it, so no drag starts there (the grab pointer
      shows only where a drag can start). While a row is dragged it fades to 40%, every seam's
      line shows faintly (15%), the tip buttons are hidden, and the seam under the pointer shows
      its line 4px thick at full strength. Dropping on a seam moves the source there with
      `moveSource`, by the **container rule** (ADR 0014): a seam inside a box puts it in that box,
      sharing its tips (on the seam above the box's first row, it becomes the box's first, on the
      box's tips, and the old first shares them); a seam between boxes (or above the first, or below
      the last) gives it new tips of its own. Taking a box's first source out hands the box's tips
      to the next source in it. Dropping anywhere else moves nothing. A drag of a source can't be
      dropped anywhere outside the Sources list (nor a drag from elsewhere onto it).
    - **Reordering changes the random layout** (Andy accepted it, 2026-11-05): the pool numbers
      sources by their place in the list, so after a move, Update gives different wells even with
      the same seed. Nothing on the card warns of it beyond Update's own tooltip (below).
    - Joining, splitting and moving change only the card's **draft**, as any other change in the
      card does: no message, and no undo of its own. The draft's sources are saved with
      `setRandomization` (their `sharesTips` included), so a randomization that hasn't run keeps its
      sharing when its card closes, and a run one counts as changed (so `Discard` shows, and it must
      be updated or discarded before closing). Removing a source (its `×`, or unpicking its well on
      the deck) uses `removeSources`, so its box keeps its tips; a source picked on the deck is added
      last, in a box of its own (`sharesTips` `false`).
    - With more than `SOURCES_SHOWN` sources and the list folded, the boxes are those of the shown
      rows (a box cut by the fold shows only its shown rows, but its heading counts all its
      sources). Every seam stands for a place in the whole list's groups (`moveSource`'s places are
      always worked out on the whole draft): the seam below the last shown box is `between` it and
      the next group of the whole list, so a source dropped there lands after that box's hidden
      rows too, with new tips. Likewise **the seam inside a box cut by the fold, below its last
      shown row**, is `inGroup` at the **group's full length** (its end, hidden rows included), not
      at the number of its rows shown: a source dropped there joins the box's tips after all its
      sources, hidden ones too. (Decided in the hands-off workflow, 2026-11-05: the box's bottom
      seam stands for the box's end, as the seam below it stands for the place after the whole box,
      so both bottom seams mean the same place they mean when the list is unfolded, and the box's
      heading already counts its hidden sources.)
    - The **All sources** row stays above the boxes, outside them.
    - Moving a source with the keyboard isn't offered yet (roadmap, "Later"); the join and split
      buttons can be reached and pressed from the keyboard.
  - With two or more sources that take replicates, a first row, **All sources**, set apart by a
    line, with one box (accessible name `Replicates for every source`): typing in it sets every
    source's replicates as you type (not the filler's). It shows their number when they all match,
    and is empty with `mixed` as its placeholder (in smaller type) when they differ (Andy,
    2026-11-01). Its box lines up with the sources' replicate boxes, in the same column, and its
    label is gray and normal weight, so it reads as a control for the rows below, not as a source
    or a heading (Andy, 2026-11-01, from the first build: a box under the Filler buttons and a bold
    label were confusing).
  - With more than `SOURCES_SHOWN` sources (`config/`), only the first `SOURCES_SHOWN` show, then
    `Show all 68 sources ▸`, styled as `Show transfers ▸`; shown, it reads `Show fewer ▾`. The All
    sources row always shows. Each randomization remembers this while the page is open.
- **Wells to fill**: with none, `Click or drag across wells on the deck.` in gray; otherwise how
  many on each labware, in deck order, `60 on Plate1 · 60 on Plate2`, and a `Clear` button
  (action) that unpicks them all.
- **Each transfer**, a heading in the style of a box's field names (12px, semibold, gray,
  capitals), then the stage box's grid, exactly as in a stage's box (section 10): `Aspirate` and
  `Dispense` columns, a **Mode** row of menus and a **Mix** row of checkboxes (`Can't mix` for a
  mode that can't), mixing with `DEFAULT_MIX`. Then **Tips**: a menu of tip types and a menu of
  probe counts (`1 probe` … `8 probes`, choosing `probesFor`), `BC230 on 4 probes`, for each set of
  new tips its stages load: one before each box of sources (below), so before each stage when no
  source shares tips. **What they show** (Andy, 2026-11-05, item 20, "sort of like replicate count
  works"):
  - **Not run yet**: the randomization's own `settings`, `tipType` and `probes` (its first run's;
    a new randomization's are the stage's before it, `addRandomization`), as before.
  - **Run**: its **stages' own values**, read from the plan each time the card opens
    (`randomizationStageValues`): each end's mode and whether it mixes, the tip type and the probe
    count of its tip groups. A value every stage (or every tip group) shares shows as itself; where
    they differ (`null`) it shows
    **Mixed**: the mode menu gains a first entry `Mixed` (in place of `(not one of the modes)`,
    which a run randomization's menu never shows: a stage whose end isn't one of the modes counts
    as differing), chosen; the Mix checkbox is indeterminate (a dash); the tip type and probes menus
    gain a first entry `Mixed`, chosen. Choosing `Mixed` again in a menu puts it back as it was.
  - **Mix under a Mixed mode**: enabled when every stage's mode at that end can mix (`canMix`);
    otherwise disabled, with the tooltip naming the first stage in stage order that can't: `Stage
    5, “A1”, uses Non-Contact, which can't mix: choose a mode, or change that stage first.`, or,
    for an end that isn't one of the modes, `Stage 5, “A1”, doesn't use one of the modes: choose a
    mode, or change that stage first.` (so the card never offers what `runRandomization` refuses).
  - **A Mix checkbox opened as Mixed** (indeterminate): a click cycles checked → unchecked → Mixed
    (indeterminate again, leaving each stage's mixing as it is). One opened checked or unchecked
    toggles as any checkbox, never showing Mixed.
  - A note under Tips, 12px gray: not run yet, `Every stage starts with these. Change one stage with
    its ✎ once it has run.`; run, `A value chosen here goes to every stage on Update; a stage's ✎
    changes just that one.`, starting `Mixed: its stages differ, and stay as they are unless you
    choose a value. ` when any value shows Mixed.

  Then **Volume**: a text box
  like Seed's, 80px wide, then `µL` in gray; its accessible name `Volume per transfer in µL`.
  What's typed changes the card's draft at once, as Seed's box does (Andy, 2026-11-01: never typed
  at the deck). (Andy, 2026-11-01: it was a button that turned into a box when clicked, as a
  transfer's volume does, but alone in the card it didn't look editable; transfer rows keep
  theirs.) A refused volume is the card's problem (below).
- **Seed**, a text box 120px wide.
- **The footer**: the **first problem only**, in red, short (`randomizationProblems`, or, while a
  box holds what isn't a number, its own: `Drug A: replicates must be a whole number, 1 or more.`,
  `The seed must be a whole number from 1 to 999,999.`, `The volume must be a number of µL above
  0.`); then `Remove` (quiet red text at the left), `Close` (action) and the main button,
  **Randomize** (not run yet; tooltip `Makes 12 stages, with new tips before each.`: one per source
  taking replicates, and one for the filler if it fills any well, however many filler wells it has;
  **when any source of the draft shares tips** (any `sharesTips` `true`), `Makes 12 stages, on 4
  sets of new tips.` instead, the count being `tipSetsToMake` of the draft (`transfer-designer.md`,
  "Sets of new tips a run makes"); when no source shares, the first wording, as before; while the
  draft has a problem, the tooltip isn't shown, as Randomize is disabled)
  or **Update** (run; tooltip `Applies these changes to its stages. The same seed and source order
  keep the same wells; a new seed or a new order shuffles again.`), disabled while there's a problem. With no problem, a card
  that has run, has no unsaved changes and is out of date shows, in the problem's place and in red,
  `The plan has changed since this last ran. Press Update to bring its stages up to date.` (Update
  stays enabled; Andy, 2026-11-02). Randomize and Update save the draft and run it
  (`runRandomization`, which puts its stages in the sources' order and gives new tips only where a
  box of sources starts; the page does nothing more to the stages or tips), as one undoable edit.
  **Randomize** saves Each transfer and Tips with the draft (`setRandomization`), so the first run
  gives every stage them. **Update** doesn't (its stages hold them): it passes, as
  `runRandomization`'s `forAll`, only the values that differ from what the card showed when it
  opened (a mode, a Mix, the tip type, the probes), so Mixed values and untouched shared ones leave
  each stage as it is (2026-11-05, item 20). If the logic refuses (e.g. mixing chosen where a
  stage's own mode can't mix), the message shows as an error and nothing changes. Otherwise the card closes and its first stage opens (message
  `Randomized: 12 stages with 96 transfers (seed 37). Undo takes the change out again.`). After
  Update the message is `Updated: 12 stages with 96 transfers (seed 37). Undo takes the change out
  again.`. `Remove` acts at once (`removeRandomization`), as every Remove does: `Removed the
  randomization.` or, once run, `Removed the randomization and its 12 stages. Undo brings them
  back.`, with the tooltip `Removes it and its 12 stages. Tips it added stay.`; disabled when its
  stages are all the plan's (`canRemoveRandomization`), with the tooltip `Its stages are all the
  plan's stages. Add a stage outside it first.` (A `Turn into ordinary stages` button was tried and
  dropped for now; Andy, 2026-11-01.)

**Transfer tables** (`transfer-designer.md`, "Transfer tables"; Andy, 2026-11-05; ADR 0019). A
transfer table is an entry in the column between tip groups, like a randomization: a box of its
own, with seams between tip groups above and below it as for any box.
- **Its box**: as a run randomization's (12px corners, 1px `#9DB7DB` border, the page's
  background inside): its heading, then its stages' tip group boxes (`columnBoxes`' `transferTable`
  box; one stage each). It's **open** (showing its stages) or **closed** (its heading only), like
  a folder (Andy, 2026-11-05, from testing the build): clicking its heading opens or closes it.
  It also opens whenever one of its stages becomes the open entry (the timeline's `‹` and `›` step
  into and through its stages as any others, Add opens its first stage, a move or paste opens a
  stage of it), and stays open after that stage is left until its heading closes it. Whether each
  transfer table's box is open is remembered while the page is open, by its ID: it isn't saved in
  plan files or the browser copy, and opening or closing it isn't an undo step. A box closed while
  one of its stages is open hides that stage; the stage stays open (the deck still shows it). A new
  page, or a plan opened from a file, starts with every box closed, except one whose stage is open.
- **Its heading**, a row the box's width: a button (most of the row) holding `▸` (closed) or `▾`
  (open), the **table icon** (an SVG: a rounded rectangle 15 by 13 with two lines across and two
  down, in the text's color), then `Transfer table`, semibold, then at the right, in gray,
  `4 stages` (`1 stage`), or, when it's out of date (`isTransferTableOutOfDate`), `needs update` in
  red, semibold; then, after the button, a **✎** (as a stage's, accessible name `Edit transfer
  table`, tooltip `Change the table, its sources or remove it`). Clicking the button (or Enter or
  Space on it) opens or closes the box and selects the transfer table (section 7, "Moving and
  copying"); its `aria-expanded` says whether it's open; its tooltip: `Show its stages` / `Hide its
  stages`, or, out of date, `The plan changed since this was made: press ✎, then Update.`
  **The ✎** opens its **wizard** (below) at Review and selects the transfer table. The button is
  also what the transfer table is dragged, copied and given the right-click menu by (a press on the
  ✎ starts no drag), as a randomization's heading is.
- **No seams with buttons inside it**, as for a randomization: no `+`, mix step, tip, dice or table
  buttons. **While one of its own stages is dragged** (Andy, 2026-11-05), the places between its
  stages (and above its first, below its last) are drop places, shown as a seam's line inside a tip
  group box is during a drag; dropping there moves the stage within the table (`moveItems` with an
  `inTransferTable` place), which also moves its column in the table, as one undoable edit
  (message as any move's). They're never drop places for anything else.
- **Its stages** look like any stage. **What can be changed on them** (Andy, 2026-11-05: pipetting
  the normal way): a stage's ✎ opens its box (section 10), and each tip group's heading has its ✎
  (section 10). **What can't**: their transfers (no `×`, volumes not buttons), their names, removing
  them, seams inside. Each one's card says, in gray, `Part of a transfer table: its amounts change
  in the table.` A click or drag on the deck while one is open adds nothing: message `This stage is
  part of a transfer table: change its amounts in the table.` (a note).

**The seam's table button.** Seams **between tip groups** gain a fourth spot, just right of the
right spot (6px from it), holding the **table button**: a 26px circle, white with a blue border,
the table icon in blue (16px), like the dice button. Tooltip `Add a transfer table here`;
accessible name `Add a transfer table before stage 3, “Drugs”`, or `… at the end of the run`. It
opens a new **wizard** for a transfer table there (`beforeId` as the seam's `+`); nothing is added
until **Add**. On the seam **below a randomization that hasn't run**, Add works as that seam's `+`
does: `addTransferTable` before the same stage, then `placeRandomization` onto the transfer table's
first stage, in the same edit, so the transfer table lands below the randomization. Seams inside a tip group box have no table button, and their fourth spot is empty.
Keyboard focus reaches it after the dice button. (Ctrl+V on the page doesn't start a transfer table:
Andy, 2026-11-05, only the button.)

**The wizard** (Andy, 2026-11-05: a dialog, for room to work with the grid) opens over the page: a
white dialog (12px corners, the panels' border, a soft shadow), at most 920px wide (94% of the
window on narrower ones) and 86% of the window's height, 6% from the top, centered, over a
backdrop that dims the page (`rgba(28, 28, 26, 0.22)`). Its body scrolls; its header and footer
don't. While it's open, the page's keys (section 12) don't act, and nothing behind it can be
clicked. From the top:
- **The header**: the table icon and `New transfer table` (from a seam) or `Transfer table` (one in
  the plan), 17px semibold; under it, the **steps**: three pills in a row, `1 Table`, `2 Sources`,
  `3 Review`, each a button with its number in a small circle. The current one is blue (tint
  background, blue border, white number on blue); earlier ones show their number on pale green; a
  step that can't be reached yet (a step before it isn't done) is disabled. Clicking a step that can
  be reached goes to it. Table is done when the draft's table has no problems and makes a stage;
  Sources when every column making a stage has a well.
- **The body**, by step (below).
- **The footer**, from the left: `Remove` (red outline; only for a transfer table in the plan), then
  at the right `Cancel` (action), `Back` (action; not on Table), and the main button (solid blue):
  `Next` on Table and Sources, disabled until that step is done; on Review, `Add` (new) or
  `Update` (in the plan).

**The draft.** The wizard edits a draft (`{ table, sources }`), never the plan, until Add or Update:
- **Cancel**, **Escape** (anywhere in the wizard but a cell being edited, where it restores the
  cell, below), or a press on the backdrop closes the wizard without changing anything, edits or not
  (decided in the hands-off workflow: nothing in the wizard is lost that the Excel sheet doesn't
  hold, and asking would slow the common case).
- A transfer table in the plan opens with its stored table and sources; its wizard opens at
  **Review**, or, if its draft now has problems, at the first step with a problem (the Table step
  for a table problem, Sources for a source problem).

**Table step, before a paste.** A paste zone across the body: a dashed blue box (2px `#9DB7DB`,
8px corners, blue tint), one line high, saying `Click here and press Ctrl+V to paste a table from
Excel`, focused when the step opens; under it, in gray: `The table's first row is a header: the
first column is a well label, each other column a component's name. Each row after it gives the µL
of each component to add to every well with that label. Blank or 0 adds nothing.` A paste into the
zone takes the clipboard's plain text, read with `parsePastedTable` (`pasted-table.md`): rows whose
cells are all blank are dropped (Excel's empty lines), and shorter rows are filled with empty cells
to the widest row's length, so the grid is a rectangle. With fewer than two rows or two columns
left, the zone stays and says, in red under it, `Paste a table with a header row, at least one
row of well labels, and at least one component column.` Typing in the zone does nothing.

**One paste per wizard** (Andy, 2026-11-05): once a table is in, the zone is gone, and the wizard
never takes another paste as a table: a different table means Cancel (or Remove) and a new
wizard.

**Table step, with a table: the grid** (Andy, 2026-11-05: the table can be edited). A table in a
scrolling frame (8px corners, the panels' border, at most 46% of the window's height), every cell
a **text box** showing its text, which looks like plain text (no border, transparent) until
pointed at (input border, white) or focused (blue border, white). The header row and the label
column have the sand tint (`#F5F1E8`); the header row is semibold and stays in view while the
frame scrolls; amounts are right-aligned, 13px.
- **Matched cells**: a header naming a component shows that component's swatch (10px rounded
  square) before its text; a label some wells have shows, after its text, `3 wells` (11px gray).
- **Problem cells** (`readTransferTable`'s problems, by `row` and `column`) are red (red tint
  background, red text, semibold), with the problem's message as their tooltip.
- **Editing a cell**: a cell's box selects its text when focused. A change is read when the cell is
  left (Tab, a click elsewhere) or on **Enter**, which also moves to the same column's cell in the
  next row (staying put on the last row), as in Excel. **Tab** and **Shift+Tab** move along the
  row, then on to the next. **Escape** puts the cell's text back as it was and stays in it. Each
  change re-reads the table (problems, matches, the summary) and keeps focus where it went. A paste
  into a cell is plain text, its tabs and line breaks made spaces.
- **Header changes are renames** (Andy, 2026-11-05): when a header that named something is changed
  to something else, the wizard remembers that the column was the old name's (following a column
  renamed more than once back to its first name), and passes it as `renamedFrom` to
  `updateTransferTable` and `transferTableStages`, so the column keeps its stage's settings and
  tips. Deleting a column and adding a new one isn't a rename. Only the wizard keeps this, until
  Add or Update.
- **Rows and columns** (Andy, 2026-11-05): under the frame, `+ Row` and `+ Column` (small action
  buttons). `+ Row` adds an empty row at the bottom and focuses its label cell; `+ Column` adds an
  empty column at the right and focuses its header. Pointing at a label cell (rows after the
  header) or a header cell (columns after the first) shows a small `×` at its right (20px circle,
  gray; red tint and red on hover), which deletes that row or column; tooltip and accessible name
  `Delete row 4` / `Delete column 3` (counting from 1). The `×`s are out of the Tab order, so Tab
  goes from cell to cell. The header row and the label column can't be deleted. A table left with
  only the header row, or only the label column, is shown as it is, with Next disabled (its problem
  is that it adds nothing).
- **Under it**: with no problems, `6 well labels (18 wells), 4 components.` in gray (`components`
  counting columns that make a stage; `1 well label`, `1 well`, `1 component`); otherwise the
  problems in a red-tinted box (8px corners), one per line, at most 6, then `…and 3 more.`, then
  `Fix the red cells above: click one and type.` in gray.

**Sources step** (Andy, 2026-11-05: chosen from a menu, since the dialog hides the deck). In gray:
`Each stage draws from a well holding only its component at Start. Add more wells when one can't
hold enough: they're used in order, each until the next transfer would reach into its dead volume.`
Then a table, `Stage` and `Draws from`, one row per column that makes a stage, in column order:
- **Stage**: `1. ` then the component's swatch and name, semibold.
- **Draws from**: its wells, one line each, numbered in a small gray circle (`1`, `2` …), each a
  menu of the component's stock wells (`stockWellsOf`) named `Res1 1 · Media stock` (the well, then
  ` · ` and its label if it has one), offering the line's own well and the stock wells no other line
  of this column has. With more than one line, each has a `×` (`Don't draw from this well`) taking
  it out. Then `+ Another well` (small action button) while a stock well isn't on a line, adding the
  first such. With more than one line, under them in 11px gray, how the transfers split
  (`sourceSplit`): `Res1 1: 5 wells · Res1 2: 13 wells`.
- **A new column's wells**: the first stock well, chosen for it when the column first makes a stage
  (and kept in the draft's `sources`, so a column deleted and brought back keeps its wells); a well
  that no longer holds only its component is dropped from its list (falling back to the first stock
  well if none is left).
- **No stock well**: in red, `No well holds only this at Start`, and under the table the problem
  `No well holds only Media at Start. Cancel, fill one at Start, and start the transfer table
  again.` (Cancel discards the paste, so it says so.) The page knows this case from
  `stockWellsOf(plan, component)` being `[]`, and shows its own wording in place of the logic's;
  every other problem on this step is shown as the logic gives it.

**Review step** (Andy, 2026-11-05: kept, as the last check before the plan changes; read-only). In
gray: `4 stages, each on new tips, before stage 3, “Drugs”.` (`at the end of the run`, or `where its
stages are now` for one in the plan), then ` Change a stage's pipetting or tips afterwards with its ✎
in the Stages column.` Then a table from `transferTableStages` (with `renamedFrom`): `Stage` (as on
Sources), `From` (its wells, `Res1 1, then Res1 2`), `Into` (`9 wells`), `Total` (µL, its
transfers' volumes added, `1710 µL`, as numbers are shown, section 13), `Aspirate · Dispense`
(each end's mode name, `modeOf`, `(other)` if none, with ` ⟳` after an end that mixes: `Slow ⟳ ·
Medium`) and `Tips` (`4 × BC230`: probes × tip type). When a stage's largest amount is more than its tip
type's value in `MIX_VOLUME_LIMITS` (`config/tip-types.js`), its Tips cell adds, in 11px gray, `up
to ` and that largest amount, ` µL per well` (as numbers are shown, section 13), with the tooltip
`More than one BC230 tip holds in one trip.` (naming its tip type) (decided in
the hands-off workflow: there's no other configured tip capacity, so the mix limits, themselves
stand-ins, are used; roadmap, "Technical debt"). Under the table, columns making no stage, in gray:
`No stage for DMSO: every amount is blank or 0.`

**Add and Update.** **Add** adds it (`addTransferTable`, the seam's `beforeId`), closes the wizard
and opens its first stage, as one undoable edit; message `Added a transfer table: 4 stages (Media,
Drug A, Drug B, DMSO).` (ok). **Update** (`updateTransferTable`, with `renamedFrom`) likewise:
`Updated the transfer table: 4 stages (Media, Drug A, Drug B, DMSO).`; when the update would
change nothing (`updateTransferTable` gives back the same plan), nothing is recorded, the wizard
closes, and the note `Nothing to update: the transfer table already matches.` shows. The new stages glow (section 7,
"What changed glows"). If the logic refuses, its message is shown and the wizard stays open.

**Remove** acts at once (`removeTransferTable`), as every Remove does: closes the wizard; message
`Removed the transfer table and its 4 stages. Undo brings them back.` (ok); if one of its stages was
open, the first stage in the stage order opens. Disabled when `canRemoveTransferTable` is `false`,
with the tooltip `Its stages are all the plan's stages. Add a stage outside it first.`

**What changed glows.** When a stage or a tip group box appears that wasn't there at the last
drawing, it glows soft yellow (`#FFF1BF` background, a 4px `#F3D36B` ring) and fades over 1.2
seconds. So does whatever a move, copy or paste placed (the logic's `placed`: its stages, and a
randomization's box), even though a moved stage was drawn before. A glow carries on through
redrawing. Nothing glows when the page first draws, or when
something is only opened or edited.

**Moving and copying** (Andy, 2026-11-01; ADR 0014). The column works like PowerPoint's slide
panel, with tip groups as its sections. Every move, copy and paste goes through the transfer
designer (`transfer-designer.md`, "Moving and copying"), as one undoable edit; the container rule
is the logic's, and its messages are shown as they come. The column's boxes are drawn in the order
`columnBoxes` gives (the page doesn't work the order out itself).

*Selecting.* The things that can be selected are stages, ordinary tip groups, randomizations and
transfer tables (the logic's **items**, `docs/glossary.md`). **A transfer table** (2026-11-05) is
selected, dragged, copied and pasted by its heading exactly as a randomization is, everywhere in
this part ("Moving and copying"), its stages counting as its box; clicking its heading opens or
closes its box and makes the picked set that transfer table alone (its ✎ opens its wizard). **Its stages** (Andy, 2026-11-05) can be
dragged by their rows, and by their tip group's heading (each stage has its own tips, so it's the
same as dragging the stage), only to a place **inside their own transfer table** (above); dropped
anywhere else, the logic refuses with its message and nothing moves. Ctrl+C or Ctrl+drag (copying)
one of its stages without the table copies it as an ordinary stage, as for a randomization's. Nothing else can be dropped inside its box. Messages name it `a transfer table`
(`2 transfer tables`). The page keeps a **picked set**, or none:
- With **no picked set**, what's selected is what's open: a stage, or a randomization whose card is
  open; with Start or End open, nothing.
- **Click** a stage's row opens it, as before, and forgets the picked set (so it's selected alone).
- **Click an ordinary tip group's heading** (anywhere but its ✎) makes the picked set that group
  alone, and opens nothing.
- **Click a randomization's heading** opens or closes its box (one not set up yet: its card), and
  makes the picked set that randomization alone (2026-11-05, item 20; until then it opened or
  closed its card). Its ✎ opens or closes its card and selects it alone.
- **Ctrl-click** (Cmd on a Mac) a stage's row or a heading: with no picked set, one starts, holding
  what was selected (what's open), and then this thing is added or taken out; with one, this thing
  is added to it or taken out. Nothing opens. A picked set can be empty: then nothing is selected,
  the open card included.
- **Shift-click** selects a run, from the **anchor** (the last thing clicked or Ctrl-clicked in the
  column, or else what's open) to the thing clicked, as the picked set, and opens nothing. If both
  are stages, the run is the stages between them in column order, counting the stages of ordinary
  tip groups only (a randomization's stage at either end counts as its randomization's box, below).
  If either end is a heading or a randomization, the run is the boxes from the anchor's box to the
  clicked thing's box, each as a whole (a tip group or a randomization).
- A stage of a randomization's own tip group is selected by its row as any stage; that tip group's
  heading counts as its first stage's row (since 2026-11-05 such a tip group may hold several of
  the randomization's stages, when their sources share tips; it's never an ordinary tip group, so
  it's never selected as a group).
- The picked set is **forgotten** (so what's open is selected again) when anything else opens
  (`‹`, `›`, a seam's buttons, a plain click on a stage), after any other edit, after Undo and
  Redo, and on Escape when nothing else uses Escape (section 12).
- Start and End are never selected.

*What a press can select or drag.* A stage's **heading row** (its badge, name and count; for a
closed stage, the whole row), an ordinary tip group's heading, and a randomization's heading.
Presses on buttons and boxes in them (a ✎, `Show transfers ▸`, a volume, `×`, a text box or menu),
and anywhere in an open card's contents, keep their own behavior and never select or drag. An
editing box with unsaved changes still refuses a press outside it (section 10).

*How it looks.* Each selected thing is marked at once, as the button goes down, before a click
opens it or a drag takes it (Andy, 2026-11-01: in the preview's first try, nothing showed what a
drag would take). A selected stage: light blue background (`#EEF3FA`), a 2px blue (`#2F5DA8`) ring
and border, and its number's badge blue with white text, the open card too. A selected tip group or
randomization: a 3px blue ring and border, and its heading's text blue and semibold. A stage's row
and the headings show the grab pointer, and pressing or dragging on them never selects text (Andy,
2026-11-01: the preview highlighted text under the pointer).

*Dragging.* Pressing where a press can drag (above) and moving 5px (`DRAG_START_DISTANCE`) starts a
drag. It takes the selection, if the pressed thing is in it, or else the pressed thing alone (which
becomes the selection).
- What's dragged fades to half and gets a 2px dashed blue outline, 2px out.
- A **label** follows the pointer (14px right, 10px down): `Move “Drugs”`, `Move 2 stages`, `Move a
  tip group`, `Move 2 tip groups`, `Move a randomization`, or `Move 3 items` for a mix; with Ctrl
  (Cmd) held, `+ Copy` in place of `Move`. White semibold 13px text on blue, 6px corners, a soft
  shadow.
- **Where it would land**: the seam nearest the pointer, up and down, while the pointer is over the
  column (or within 40px of its sides), drawn as a 4px blue line with a 10px dot at each end. Only
  seams between tip groups qualify when the drag holds a tip group or randomization. Seams' buttons
  are hidden during a drag. With no such seam (the pointer away from the column), nothing is
  marked.
- **Pressing or releasing Ctrl** (Cmd) during the drag switches between moving and copying at once.
- **Near the column's top or bottom** (within 40px) the column scrolls, 12px per pointer move.
- **Escape** cancels the drag; nothing changes.
- **Dropping** on a marked seam moves (`moveItems`) or, with Ctrl (Cmd) held at the drop, copies
  (`copyItems`) to it, as one edit. Dropped with nothing marked: `Drop it on a gap between stages or
  tip groups.` (note). Dropped where it already was (the logic gives the same plan back):
  `Dropped where it already was, so nothing moved.` (note), and nothing is recorded.
- **A drag holding a randomization's stage without its randomization** (alone or with other
  things), without Ctrl: the label reads `A randomization's stages move with it · hold Ctrl to
  copy`, on gray (`#8A8A85`), no seam is marked, and the drop shows the logic's message (error).
  With Ctrl, it copies as any drag.
- The press that started a drag doesn't also count as a click.

*Copying and pasting.*
- **Ctrl+C** (Cmd+C) copies what's selected (`copyOf`). The copied items are put on the system
  clipboard as text (their JSON, through the browser's copy event), and kept as **the page's
  copy**: in the browser's local storage under `biomek-tools transfer designer: copied items`,
  shared by every tab of the designer, so the latest copy in any tab is the one the menu pastes
  (and in the page's memory too, for a browser without local storage). Message: `Copied “Drugs”. Right-click
  where it should go and choose Paste, or press Ctrl+V to paste it below the selection.` (note; the
  copied things described as in the drag's label, without `Move`). With nothing selected (Start or
  End open with no picked set, or an empty picked set):
  `Select a stage, a tip group (click its heading) or a randomization to copy it.` (note).
- **Ctrl+V** (Cmd+V) pastes (`pasteItems`) what the system clipboard holds (through the browser's
  paste event) if it **holds copied items**: text that is JSON with `format` `"biomek-tools copied
  items"` (anything with that format goes to `pasteItems`, so a damaged one shows its message);
  otherwise the page's copy. It pastes just below the last selected thing in column order: inside
  its tip group, after it, for a stage of an ordinary tip group when nothing pasted is a tip group
  or randomization; otherwise between boxes, below its box (for a randomization's stage, below the
  randomization's box).
  With nothing selected, below the last box (with Start open, above the first). With nothing copied:
  `Nothing to paste yet: select a stage, tip group or randomization and press Ctrl+C.` (note).
- Ctrl+C and Ctrl+V keep their usual meaning in text boxes and menus, and Ctrl+C copies text that's
  selected on the page.

*The right-click menu.* Right-clicking (or the menu key, or Shift+F10, on a focused row or heading)
opens a small menu at the pointer (kept inside the window), instead of the browser's:
- **On a stage's row, a tip group's heading or a randomization's heading**: `Copy`, `Paste above`,
  `Paste below`. Right-clicking something not selected selects it first, as in PowerPoint.
  - `Copy` does what Ctrl+C does.
  - `Paste above` and `Paste below` paste the page's copy (the latest in any tab; the browser's
    clipboard can't be read until the user pastes) just above or below what was right-clicked: for a stage of an ordinary tip group,
    inside its group, unless what's pasted holds a tip group or randomization; for a heading, or a
    randomization's stage, between boxes, above or below that box.
- **On a gap** (a seam, anywhere in its band but its buttons): `Paste here`, pasting at that seam.
  While the menu is open, the seam's line shows as the drop line does (4px, with dots), without its
  buttons.
- A Paste that can't be done is shown greyed out, with the reason under it in 12px gray: `Copy
  something first.` with nothing copied, or `A tip group or randomization goes between tip groups.`
  on a gap inside a tip group (or `Paste above`/`below` on such a stage, which then pastes between
  boxes, so it isn't greyed out).
- The menu closes on a choice, a press anywhere outside it, Escape, scrolling the column, or
  resizing the window. Its items are buttons (role `menuitem`); the first one that can be chosen
  takes the keyboard focus. Not on Start, End, or an open card's contents, which keep the browser's
  menu.
- 180px wide at least, 4px padding, white with a 1px `#E2E0D8` border, 8px corners and the shadow
  `0 6px 24px` at 18% of the text color; items 32px tall, 14px text, light blue with blue text when
  pointed at or focused.

*After a move, copy or paste.* What was moved or pasted becomes the selection, glows (as new things
do, below), and the column scrolls to show it. The first stage among them opens (for a lone
randomization, what was open stays open). Messages (ok): `Moved “Drugs”.`, `Copied “Drugs”.` (for
Ctrl+drag), `Pasted “Drugs”.`, with the same descriptions as the drag's label (`2 stages`, `a tip
group` …). Any open editing box without changes closes first (one with changes refuses the press
that would start a drag, above, or, for Ctrl+V and the menu, shakes as it does for a press outside,
with `Save or discard your changes first.`, and nothing happens). An open randomization's card
closes first as `Close` would; if it can't (it has run, with changes), it shakes, the message bar
says `Update or discard your changes first.`, and nothing moves or is pasted.

**Keeping things in view.** When a different entry opens, the column scrolls just enough to show
all of it; when an editing box opens, it scrolls just enough to show the box. When `Show
transfers` opens a stage's list, the column scrolls smoothly (the browser's own smooth scrolling)
just enough to show the whole card; a card taller than the column is shown from its top, so the
list starts at its first transfer (Andy, 2026-10-26). Hiding the list doesn't scroll.

**While moving wells** (section 6, "Moving wells"; Andy, 2026-11-02: looked through, not changed),
the column keeps its look, but only three things work there: clicking a closed entry's row opens it
(Start, a stage, End; a randomization's stages too), `Show transfers` / `Hide transfers`, and
pointing at a transfer row, which singles out its transfer as usual. The ✎
buttons, the `×` on transfer rows and the seams are hidden (their space kept, so nothing shifts).
Any other click on a control or heading in the column (a volume, a component chip, the heading of a
randomization not set up yet, which would open its card) does nothing but say `Stages can't be changed while moving
wells. Press Done first.` (note); a click on plain text or empty space does nothing and says
nothing. An undo or redo that would open a randomization's card while moving wells opens instead
the point it sits at (its first stage, or the stage it sits before, or End), so no card opens. A
transfer table's or run randomization's heading opens and closes its box as usual (it only shows or
hides); its ✎ is hidden with the others. Selecting, dragging, the right-click menu (and the menu key), and Ctrl+C and Ctrl+V
are off.

## 8. Starting contents (Start open)
While Start is open, clicking a well fills it, and dragging from one well to another across one
labware fills the box between them; each fill is one undoable edit.

**The palette**, in the Start card: a chip for each component (its swatch and name), in the plan's
order, each with a small ✎ beside it; then `+ New`; then `Paste table` and `Copy table` (below,
"Pasting stocks" and "Copying stocks"), looking like `+ New`; then `Eraser`. Picking a chip or the eraser
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

A chip's text is the component's name and, after it, **what it carries**, small and gray, when it
has constituents: the first constituent's amount and unit (section 13; a cell figure for cells,
e.g. `Cells 1.5 × 10⁶ cells/mL`), with the constituent's name
first unless it's the component's own name, then ` +N` for the rest, e.g. `Dye stock` `10 mM`,
`Feeding media` `Hy-Soy 4 g/L +2`; on one line, never wrapped. The chip's tooltip lists them all,
in the same number formats (a cell figure for cells): `Contains Hy-Soy 4 g/L, Yeast 0.5 g/L,
Glutamine 1 g/L`, `Contains Cells 1.5 × 10⁶ cells/mL`. A component carrying nothing has neither.
A component with an osmolality has it in the chip's tooltip, on a line of its own after any
`Contains` line: `Osmolality 300 mOsm/kg` (the value as the component's box shows it, section 13,
with no `≈`: it's the measured value). The chip's text doesn't show it, so chips stay short.

**Adding components.** `+ New` becomes a text box (`Component name`). Enter adds the typed name
(spaces at the ends removed) with `addComponent`, picks it, and opens a fresh box for the next name,
so several can be added in a row. Enter on an empty box, Escape, or clicking away ends; clicking away
with a name typed adds it first. The new component's color is the first in `COMPONENT_COLORS`
(section 14) that no component has. If all are taken: `All 30 colors are in use, and two components
can't share one. Remove a component to add another.` If `addComponent` refuses the name, its message
is shown and the box stays open with the name, to fix it. Message `Added Media.`

**Pasting stocks** (Andy, 2026-11-05; `transfer-designer.md`, "Stock tables"). `Paste table` (tooltip
`Add several components at once, from a table copied from Excel`) opens the **stock dialog**: a
dialog over the page, looking and behaving as the transfer table wizard's (section 7: the same
backdrop, frame, header, body and footer, everything behind it unreachable but the message bar; a
press on the backdrop or Escape closes it, changing nothing), with no steps. Its title: `Paste
stocks`. Nothing is added until Add.
- **Before a paste:** the wizard's paste zone, `Click here and press Ctrl+V to paste a table from
  Excel`, focused when the dialog opens; under it the help `One row per stock. The first column is
  its name; an Osmolality column (mOsm/kg) is optional; every other column is something it contains,
  its unit in brackets. A blank cell means the stock doesn't contain it, or its osmolality wasn't
  measured. For example:` and a small example table, read-only, in the wizard grid's look (header
  cells tinted): `Name`, `Osmolality`, `Hy-Soy (g/L)`, `Drug A (mM)`, `DMSO (%)`; `Media`, `300`,
  `4`; `Drug A stock`, `1450`, (blank), `10`, `100`.
- **A paste** (`parsePastedTable`) fills short rows with empty cells, then drops rows whose cells
  are all blank (as the wizard's Table step does) and columns after the first whose cells are all
  blank (column 0 is always kept, since it's the names, even when blank). With fewer than two rows left, the paste
  zone stays and says in red: `Paste a table with a header row and at least one row of stocks.`
  Otherwise the dialog shows **the table**: the wizard's editable grid (section 7, "Table step"), each
  cell a text box (header row tinted and sticky, the name column tinted, other cells right-aligned),
  a change saved when the box loses focus or on Enter. Each name cell starts with the swatch of the
  color its stock will take (`readStockTable`'s `color`), or no swatch (its space kept) when it has
  none; a row's name cell has the wizard's × (tooltip `Take this row out`), which takes the row out
  and puts the focus on the name cell now in its place, or the one above if it was the last row, so
  Escape still closes the dialog (taking out the last row goes back to the paste zone, focused). There's no adding rows or columns: the
  table comes from Excel.
- **Problems:** the grid is read with `readStockTable(plan, table, COMPONENT_COLORS)` after every
  change. A cell with a problem is marked as the wizard marks one (red tint, red bold text); a
  whole-row problem marks its name cell. Under the grid, every problem's message, in order, in the
  wizard's red problems box. Then one line: with problems, `Fix the problems above (red), or take
  those rows out, to add the 3 stocks.` (`the stock` for one; the count is always
  `readStockTable`'s `stocks.length`, here and on the Add button, rows with problems included);
  without, `Add puts 3 new components in the Start card, each with what it contains and its
  osmolality. One Undo takes them all out.`, for one `Add puts 1 new component in the Start card,
  with what it contains and its osmolality. Undo takes it out.`, and with no stocks (every row
  emptied) `Add at least one row of stocks under the header.`
- **The footer:** once a table is in, `Paste a different table` at the left (back to the paste zone,
  focused; the table is dropped); then Cancel, and the main button `Add 3 stocks` (`Add 1 stock`;
  `Add` before a paste), disabled before a paste, with problems or with no stocks.
- **Add** closes the dialog and records `addStocks(plan, table, COMPONENT_COLORS)` as one edit;
  message `Added 3 stocks: Feed, Drug A 10mM, Water.` (`Added 1 stock: Feed.`), naming them in row
  order. The brush's pick doesn't change. Undo takes them all out.

**Copying stocks** (Andy, 2026-11-05). `Copy table` (tooltip `Copy every component, with what it
contains and its osmolality, as a table`), disabled when the plan has no components, puts
`tableToText(stockTable(plan))` (`pasted-table.md`) on the clipboard with
`navigator.clipboard.writeText`, so it pastes into another plan's `Paste table` or into Excel.
Message `Copied 3 stocks as a table. Paste it into another plan's Paste table, or into Excel.`
(`1 stock`). If `tableToText` throws (a name holding a tab or line break), its message is shown as
an error. If the browser refuses the clipboard, the page tries the older way (a hidden text area,
selected, `document.execCommand("copy")`); if that fails too: `The browser didn't let the page copy.
Try again.` Not an edit.

**Editing a component**: its ✎ opens its editing box (section 10), floating just under its chip, over
the chips below, moved left if needed to stay inside the Start card:
- **Name**: a text box.
- **Color**: swatches. At first, 10: the first 10 colors in `COMPONENT_COLORS` that are free or the
  component's own, in list order; its own color is always among them (in place of the 10th if it's
  further down the list). `More colors` shows all 30, and becomes `Fewer colors`. A color another
  component has is faded and crossed out, can't be chosen, and its tooltip says `Used by Drug_A`. The
  component's own color is outlined, and keeps its color: the general pressed-button look (a blue
  tint) doesn't apply to swatches (Andy, 2026-10-31: the picked swatch turned pale blue, hiding
  the color chosen).
- **Contains** (ADR 0013): the component's constituents, one row each: a `Name` box, an `Amount`
  box (an ordinary text box, like the Name box, not the deck's volume keys; its text is passed on
  as section 13 passes a typed amount on: as a number when it's one, exponent form included, so a
  cell count can be typed `1.5e6` or `1500000`; else as typed), a unit menu
  offering the **offered** units of `config/concentration-units.js` in its order (plus the row's
  own unit when it's a configured unit that isn't offered, so the row reads as saved), and `×`
  (tooltip `Take it out`) which takes the row out of the draft; a component carrying nothing shows
  `Contains nothing at a known concentration.` instead of rows. Under them, `+ Add` (plain blue, as
  `More colors`): a new row whose unit is `DEFAULT_CONCENTRATION_UNIT` and whose name is the
  component's own name (as typed in the Name box, trimmed) when the draft has no rows yet, so "Dye
  is 10 mM" is an amount away, else blank; the keyboard focus goes to the new row's name box.
  Enter in any of the row's boxes saves the box, as in a name box. The rows are a draft until Save,
  like the rest of the box, so a row with a bad amount is reported then, by `setConstituents`'s
  message, and the box stays open.
- **Osmolality** (ADR 0016), under Contains: a field label `Osmolality` like the box's others, then
  one row: a text box (an ordinary text box like the Amount box, but 112px wide, so its
  placeholder shows whole), its placeholder `Not measured`, then `mOsm/kg` in gray. It shows the component's stored osmolality as
  `String(n)` (section 13), e.g. `300`, `290.5`, `1e-7`, or is empty when it has none. Its tooltip:
  `The stock's measured osmolality. Leave it empty if it isn't known.` Enter in it saves the box.
  **Reading it back**, one rule: the text is trimmed; empty (or only spaces) means none (`null`);
  otherwise, if `Number(trimmed)` is a finite number, that number is passed on (so `300.0` gives
  300, and exponent forms such as `1e-7` round-trip with what the box shows); otherwise the trimmed
  text is passed on as typed, so `ten` is refused by `setOsmolality`'s message, as `-5` is (a
  number below 0), and the box stays open. `0` is a value (water), not none. (This differs from
  section 13's rule for a typed volume, which accepts only digits, `-` and a decimal part: a
  volume is typed key by key and never shown in exponent form in a box, while this box shows
  `String(n)`, which can be in exponent form.)
- **Remove**: takes the component out at once with `removeComponent` (message `Removed Media from
  4 wells. Undo can bring it back.`, or `Removed Media. Undo can bring it back.`). No question
  first: Undo brings it back (Andy, 2026-10-31; every box's Remove works this way).
  and closes the box. If it was picked, the first component left is picked, or the eraser if none is.
- **Save** renames, recolors and sets the constituents and the osmolality as one edit
  (`renameComponent`, then `setComponentColor` if the color changed, then `setConstituents`, under
  the new name, if the rows, with each amount passed on as above, differ from what the component
  carries, compared as JSON in order, then `setOsmolality`, under the new name, if the value passed
  on differs from the component's; message `Saved Media.`). If it was picked, the renamed component
  stays picked. A box counts as changed (section 10) when its name, color, rows (as typed) or
  osmolality differ from the component's. The osmolality box isn't changed when its text equals
  what it first showed; otherwise it's compared as the value it would pass on (above), so `300.0`
  and `300` are the same, and so are an emptied box and a component with none.

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

**Keeping the source: Ctrl** (or Cmd; Andy, 2026-11-05). With a source chosen, a click on another
well, or a drag across a box, with **Ctrl or Cmd held** adds exactly as without it, then **keeps the
source chosen** instead of clearing it, so the next destination is one more Ctrl-click. What's read
is whether Ctrl or Cmd is held in the event that finishes the click or drag (the `click`, or the
mouse button's release), on every platform, as for Ctrl+drag in the Stages column. The dashed arrow,
its color and the volume at its tip stay, as for any chosen source. It's for sending one source into
wells that don't form a box: each click is its own edit (its own Undo step), as a plain click is.
- **The message** is the usual one (`Added to stage 2, “Drugs”: …`, `Added 4 transfers of 50 µL
  from …`), with ` Source kept: hold Ctrl (Cmd on a Mac) and click the next well, or press Escape
  to clear it.` appended when it's an **ok** or **note** message. An **error** (a new contents
  problem, or the logic refusing the transfer) is shown as it is, without it.
- **When the logic refuses** the transfer, its message is shown and the **source stays chosen**,
  since the user is partway through a run of destinations and the refusal concerns that one well,
  not the source.
- **A drag that adds nothing** keeps the source too, with its usual message and the hint: a box
  holding only the source (`The box held only the source well, so nothing was added.`), or a drag
  ending on other labware or off every labware (`Drag across wells of one labware to send the
  source into each of them.`).
- **A typed volume** (section 13) between Ctrl-clicks changes the next transfer's volume, as at any
  time, and keeps the source; the arrow's tip shows the new volume.
- **Ctrl changes nothing else.** A Ctrl-click on the source itself clears it, and one with no
  source chosen chooses the well as the source, as a click does. A Ctrl+drag from one well to
  another with no source chosen adds one transfer, as a drag does.
- **What clears a kept source**, as any chosen source: Escape; a plain click on the source; a plain
  click on another well (after adding its transfer); opening another stage, Start, End or a
  randomization's card, or a new stage, randomization or transfer table; pasting or moving in the
  Stages column; Open; Reset; putting away the source's labware; starting moving wells.
- **What keeps it:** Undo and Redo; typing a volume; opening a transfer's volume box or the open
  stage's ✎ (a click on a deck well while an editing box with changes is open shakes the box, as
  for any click, and adds nothing); selecting in the Stages column.
- **After an Undo or Redo** during a kept run (Andy, 2026-11-05), or with a source just chosen,
  if what's open is no longer a transfer stage (a mix step, Start, End, or a stage of a
  randomization or transfer table), the source is cleared, as opening it would.
- **Where it applies:** only in a transfer stage. In a mix step, at Start, at End, in a stage of a
  randomization or transfer table, with a randomization's card open, or while moving wells,
  Ctrl-click and Ctrl+drag do exactly what a click and a drag do there.
- **A press that opens the browser's context menu** (a `contextmenu` event follows it, as a Ctrl-click
  on a Mac does) is not a click: it neither chooses, adds nor clears a source, and only names the
  well, as a right-click does (section 6). So on a Mac, Cmd is the key in practice, for dragging
  too: a Mac's Ctrl+drag opens the context menu as the button goes down, so it only names the well
  and drags nothing; Cmd+drag is the Mac's way to keep the source across a box. Likewise, a context
  menu asked for during a left-button drag (pressing the right button, on systems that open the
  menu then) drops the drag: nothing is added, and the source stays as it was.
- **A click passed on by a closing text box** (a transfer's volume box or a well's name box, which
  saves and passes the click on to what's under the pointer) keeps its Ctrl or Cmd, so a Ctrl-click
  on a well while such a box is open saves the box and then acts as a Ctrl-click.
- **Ctrl+Enter or Cmd+Enter while an editing box with changes is open** is refused as a Ctrl-click
  on a deck well is: the box shakes and nothing is added.
**After adding** (`addTransfer`): `Added to stage 2, “Drugs”: Drug plate A1 → Assay plate A1, 20
µL.` If the edit caused a **new contents problem**, the message is an error instead, by the
problem's kind (`contents-tracking.md`): an overdraw, `Added, but transfer #5 asks for 60 µL from
Drug plate A1, which holds 50 µL.`; a draw into the dead volume, `Added, but transfer #5 asks for
400 µL from Reservoir 5, which has only 300 µL above its dead volume.`; an overfill, `Added, but
transfer #5 brings Assay plate A1 to 380 µL, over its 360 µL capacity.` (with several transfers,
`Added 4 transfers of 50 µL from Drug plate A1, but transfer #5 asks …`). If the logic refuses
the transfer, its message is shown and the source is cleared (unless Ctrl or Cmd keeps it, below).
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

**With a randomization's card open** (section 7), clicks and drags on the deck pick wells for it,
whatever the wells hold (Andy, 2026-11-01: never guessed from contents), by the open tab:
- **Sources**: clicking a well adds it as a source, last; clicking a source removes it. Dragging
  across a box of wells adds each that isn't a source yet, last, in the box's order (`wellsInBox`),
  or, if the first well was a source, removes every source in the box (Andy, 2026-11-01, as in the
  preview). A well to fill clicked or dragged over here stops being one.
- **Wells to fill**: clicking a well picks it, or unpicks it; clicking a source does nothing.
  Dragging across a box of wells picks them all, or, if the first well was picked, unpicks them;
  sources in the box are left sources.
- The cursor's label says `Source` or `Fill`. Typed volumes (section 13) are ignored while the card
  is open.

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
- `Remove` acts at once, not through Save, and asks no question (Andy, 2026-10-31: Undo brings
  back what it removed, so the question only slowed things down).

**A stage's box** is 320px wide (other boxes are 280px, except a component's, also 320px, so its
Contains rows fit; section 15), so its menus show their whole names, such as `Non-Contact`. From the top:
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
- **Remove**, which takes it out at once (`removeStage`; message `Removed stage 2, “Drugs” and
  its 4 transfers. Undo brings it back.`, or without "and its …"); if it was open, the first stage
  in the stage order opens. When it's the only stage, Remove is disabled, with the tooltip `Keep at
  least one stage.`

- **A transfer table's stage** (2026-11-05): its box is the same, except that **Name** is disabled
  (tooltip `Named after its component in the transfer table.`) and there's no **Remove**; in its
  place, on a line above the buttons, in gray: `Part of a transfer table: to remove it, clear its
  column in the table, or remove the whole table.` Save changes its settings only.
- **A randomization's stage** (2026-11-05, item 20): the same, with **Name**'s tooltip `Named after
  its source in the randomization.` and, in Remove's place, `Part of a randomization: to remove it,
  remove its source in the randomization's card.` Save changes its settings only; the randomization's
  card then shows that end as `Mixed` if the stage now differs from the others.

**Save** renames it (if the name changed) and changes its settings as one edit (message `Saved stage
2, “Drugs”.`). Settings the box doesn't offer, such as the stage's mixes, are kept as they are.

**A mix step's box** (280px): **Name**; then a note saying how it mixes, from its `destinationMix`:
`Mixes each well: 90% of the well (≈ 108 µL), 3 times, at 400 µL/s.`, with the volume as for a
transfer stage's Mix tooltip (section 10, above), or `(no wells yet)` while it has none; then
**Remove**, as for a stage (message `Removed stage 2, “Mix plate” and its 4 mixed wells. Undo
brings it back.`). No modes:
a mix step's settings are its own (`transfer-designer.md`, "Mix steps"). (Andy, 2026-10-29: mixing
has no options for now.)

**A tip change's box**: **Tip type**, a button per tip type (`TIP_TYPES`), one chosen; **Probes**,
buttons `1` to `8`, choosing how many probes get tips (`probesFor`), with every probe the tip change
loads highlighted (picking 4 lights up 1 to 4; Andy, 2026-10-30: moved here from the stage's box,
since every stage uses all its tips' probes); **Remove**, which removes it at once
(`removeTipChange`; message `Removed the new tips: the stages after them keep the tips
before.`). The first tip change has no Remove, and says `The run always starts by loading tips, so
these can't be removed.` A transfer table's tip change (2026-11-05) has no Remove either, and says
`Every stage of a transfer table starts on new tips, so these can't be removed.` A randomization's
tip change (one starting one of its boxes of sources; 2026-11-05, item 20) has no Remove either,
and says `Which of its sources share tips is set in the randomization's card.` (the first stage's,
when it's the plan's first, says the first tip change's line). **Save** sets the
tip type and probes as one edit (`setTipType`,
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
| a randomization's card | the plates where it sits: before its first stage (after the stages with transfers before it), or before the stage it sits before | `Randomizing, before stage 3, “Drugs”` or `Randomizing, after all stages` |

Only a stage's end is shown, never part-way through a stage, because within a stage the Biomek
chooses its own order (B56358AF, 22-25). Stage numbers in captions are places in the stage order,
and the total is the number of stages.

The caption sits at the top left of the deck panel, after two small buttons `‹` and `›` (side by
side, before the caption, so they stay put however long it is). `‹` opens the entry before (Start,
the stages in stage order, End), and `›` the one after; `‹` is disabled at Start and `›` at End.
They're the same as clicking that entry in the Stages column. A randomization isn't a stop: they
step from the stage before it to its first stage.

After any edit, what's open stays open (unless the edit opens something else: sections 5, 7 and 10),
and the deck shows its point again.

## 12. Keys and messages
**Keys** (none while typing in a text box or menu, which keep their own keys):
- **Digits, `.` and Backspace** type a volume (section 13), at any time: the brush's while Start is
  open (not with the eraser), and the next transfer's while a stage is open. Not while End is open.
- **While moving wells** (section 6), Escape closes an open header box (section 5); otherwise
  cancels a drag of a picked well, letting go of it; otherwise lets go of a picked well; with none
  picked, nothing. It never ends moving wells; typed volumes, Ctrl+C, Ctrl+V and the menu key are ignored; Ctrl+Z and
  Ctrl+Y work.
- **Escape** closes the open editing box without saving, or the open header box (section 5), or
  the open randomization's card (saving or discarding, section 7); otherwise clears a chosen source.
  Typed volumes (above) are ignored while a randomization's card is open.
- **Ctrl** or **Cmd** held while clicking a destination, or at the end of a drag across a box, with
  a transfer stage open and a source chosen, keeps the source chosen (section 9, "Keeping the
  source", which says where it applies). On a focused well, **Ctrl+Enter** or **Cmd+Enter** does
  what a Ctrl-click would (not Ctrl+Space or Cmd+Space, which systems take for themselves).
- **Ctrl+Z** undoes; **Ctrl+Y** or **Ctrl+Shift+Z** redoes (**Cmd** on a Mac). Not while an editing
  box or a randomization's card is open, since their changes aren't in the plan yet.
- **While the transfer table wizard is open** (section 7), none of these keys act on the page: the
  wizard's own keys apply (Enter, Tab and Escape in its cells; Escape elsewhere in it closes it, as
  Cancel), and Ctrl+V pastes only into its paste zone or a cell.
- **Ctrl+C** copies and **Ctrl+V** pastes stages, tip groups, randomizations and transfer tables
  (section 7, "Moving and copying"); the **menu key** or **Shift+F10** on a focused row or heading opens the column's
  right-click menu. While a drag is on, **Escape** cancels it, and **Ctrl** switches it between
  moving and copying. Escape, when nothing above uses it, forgets the selection.

**The cursor's label.** While the pointer is over the deck, a small label beside it (14px right,
26px up) shows what a click does: with a stage open, the next transfer's volume, `50 µL`; with Start
open, `+ 1000 µL Media`, `Eraser`, or `No component picked`; with a randomization's card open,
`Source` or `Fill`, by its tab; with End open, or while moving wells, nothing.

**The message bar** floats at the bottom center of the window, at most 720px wide, and shows the
latest message until the next replaces it; it's hidden when empty. It's announced to screen readers.
Each message has a kind: **ok** (green on pale green), **note** (gray on white, with a border) or
**error** (dark red on pale red, with a border). Messages are listed with what causes them in
sections 5 to 10. The kinds: errors from the logic, contents problems after adding or filling, a file that can't be
opened, a browser copy that can't be read, and `All 30 colors are in use…` are **error**; `Added…`, `Saved…`, `Renamed…`, `Named…`, `Opened…`, `Volume changed…`, `New
tips…`, `Moved…`, `Copied…` (after Ctrl+drag) and `Pasted…` are **ok**; the rest are **note**.

**Stages in messages** are named by place and name, e.g. `stage 3, “New stage”`, so two stages with
the same name can't be confused. **Wells** are named by the labware's label and the well, e.g. `Assay
plate A1`.

## 13. Typing volumes and showing numbers
**Typing a volume.** The first key after an edit starts a new number: a digit replaces the volume,
`.` gives `0.`, and Backspace empties it. Later keys add to it: digits and one `.` are added at the
end, and Backspace removes the last character. A volume typed as nothing shows as `?`. When used, a
volume that's a number (digits, optionally `-`, and a decimal part) is passed on as a number;
anything else is passed on as typed, so the logic's message says what's wrong.

**Typing an amount** (a constituent's, in a component's box; 2026-11-05). Its text, spaces at the
ends removed, is passed on as a number (`Number(text)`) when it matches, whole, the pattern
`^-?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$`: optionally `-`, then digits with an optional decimal
point and decimal part (`5`, `5.`, `0.5`) or a decimal part alone (`.5`), then optionally `e` or `E`,
an optional `+` or `-`, and digits. E.g. `10`, `0.5`, `.5`, `5.`, `1.5e6`, `1.5E6`, `2e+5`, `5e-3`,
`-1` (then refused by the logic as not above 0). Anything else, e.g. `ten`, `1,500,000`,
`1.5x10^6`, `e6` or blank, is passed on as typed, so `checkConstituents`' message says what's
wrong. A number too large for JavaScript, e.g. `1e400`, becomes `Infinity`, which the logic refuses
with its "above 0" message (`concentrations.md`, section 5). The rule applies to an amount in **every
unit**, not only cells/mL, so e.g. `5e-3` mM now works: a small change in behavior (before
2026-11-05 an amount followed a typed volume's rule, which has no exponent form, so `1.5e6` and
`5e-3` were refused). Typed volumes keep their own rule above: a volume is never a power of ten.
Like the page's other text rules, this one is page code (`transfer-designer-page.js`), checked by hand (section 16).
A row's amount box shows a saved amount as JavaScript writes the number, e.g. `1500000` (and
`1e+21` for a huge one, which reads back the same).

**Numbers shown:**
- **Volumes** (cards, lists, messages): rounded to 2 decimal places, e.g. `33.33`; a volume below
  0.01 µL that isn't 0 is shown in exponent form with one decimal, e.g. `4.0e-3`.
- **Volumes inside wells** (short form): below 1, `<1`; from 10,000, thousands rounded with `k`,
  e.g. `12k`; otherwise rounded to a whole number.
- **Percentages** (contents card): rounded to 2 decimal places, e.g. `16.67%`; below 0.01% but not
  0, in exponent form, e.g. `4.0e-3%`.
- **Amounts** (a constituent's amount on a chip, and a concentration on the contents card): to 3
  significant figures with trailing zeros dropped, e.g. `2.5`, `333`, `0.0417`, then a space and
  the unit; below 0.001 but not 0, in exponent form with one decimal, e.g. `4.0e-4`. (On the card
  the unit is chosen to fit the value, so an amount below 1 appears only in a family's smallest
  unit or a one-unit family.)
- **Osmolality**: a component's (in its box and chip tooltip) at full precision, as JavaScript's
  `String(n)` writes the stored number, e.g. `300`, `290.5`, `1e-7` (section 8 says how the box
  reads it back); a well's estimate (contents card) rounded to a whole number, e.g. `≈ 305`, with
  no thousands separator (`≈ 1250`), since osmometers read to 1 mOsm/kg and the value is an
  estimate.
- **Cell figures** (2026-11-05: an amount in the cells' family, on a chip and in its tooltip, and
  a cell density or a seeding density on the contents card), in powers of ten, as labs write cell
  counts. The rule: work out `value.toExponential(2)` (JavaScript's exponent form with 2 decimals,
  e.g. `"4.69e+4"`). If its exponent is 3 or more, write its mantissa (the part before `e`) as
  `Number()` gives it, so trailing zeros are dropped, then ` × 10`, then the exponent in superscript
  digits (`⁰¹²³⁴⁵⁶⁷⁸⁹`, the `+` dropped), then a space and the unit. Otherwise (exponent 2 or less),
  write the value as an amount (above), then a space and the unit. E.g. 46875 → `4.69 × 10⁴
  cells/cm²`, 1500000 → `1.5 × 10⁶ cells/mL`, 999.6 → `1 × 10³ cells/mL` (its exponent form is
  `1.00e+3`), 999.4 → `999 cells/mL`, 99960 → `1 × 10⁵ cells/mL`, 500 → `500 cells/mL`. The `×`
  is the multiplication sign, with a space each side. (Chosen over `47,000 cells/cm²`: a cell count
  is read as a power of ten, and a plain number of six or seven digits is easy to misread by a
  factor of ten.) Like the page's other number formats, this formatter is page code (`transfer-designer-page.js`),
  checked by hand (section 16).
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
- **`config/randomizations.js`** exports `SOURCES_SHOWN` (`8`): how many sources a randomization's
  card lists before `Show all N sources ▸` (Andy, 2026-11-01).
- **`config/concentration-units.js`** (`concentrations.md`, section 7) gives the unit menu its
  offered units (cells/mL among them, from 2026-11-05) and `DEFAULT_CONCENTRATION_UNIT` for a new
  row; the page doesn't check it (the
  concentrations module's tests do).
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
  (`#EEF3FA`). **Purple** (`#7A4FBF`, with a tint `#F3EEFB`) only for moving wells (section 6):
  the deck panel's border, its bar, the picked well's ring, the outlines of the wells it can move
  to, and `Done`, solid purple with white text. A well with one of these outlines still shows
  keyboard focus (a 3px light blue ring outside its purple one), so the keyboard can be followed. **Red** (`#C4362A`) for problems, with a pale background (`#FCE9E7`) and border
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
    button of Reset's question (`Reset everything`): solid red (Remove asks no question since
    2026-10-31);
  - **disabled** buttons: gray text and border on a light gray background, whatever their group;
  - buttons with a look of their own keep it: `Show transfers`, a transfer's volume and `×`, a
    labware's label, the seams, and the Stages column's rows.
- **Wells:** 36px, 4px apart; an empty well white with a gray border (`#BDBDB5`), its name 10px.
  Grid headings 12px gray.
- **Tip group boxes:** 12px corners; light blue (`#EEF3FA`, border `#9DB7DB`), alternating with light
  sand (`#F5F1E8`, border `#D9D2C3`). Start, the boxes and End 18px apart, leaving room for the
  seams between tip groups (section 7).
- **Editing boxes:** 280px wide; a stage's and a component's 320px (sections 8 and 10; a
  component's from 2026-11-05, so a Contains row's name box keeps room once the amount box and
  unit menu grew for cells, found in the build review). In a stage's box, the grid's column
  headings and row labels look like the box's other field names (12px, semibold, gray, capitals);
  the label column is as wide as its widest label, and the two end columns share the rest equally,
  8px apart; the menus there have 4px side padding instead of 10px, so whole mode names fit.
- **Contents card:** dark (`#1C1C1A`) with light text (`#F6F5F1`), problems in `#FFB4AA`, a short
  mix's line in `#FFD45C`. A labeled well's label 16px bold (line height 1.25), and the well under
  it 12px, normal weight, at 70% opacity; the last line, `Right-click to name`, 12px at 60%
  opacity, 6px below the line before it.
  The `Concentrations` group: 6px below the components, above a 1px rule in the light text at 20%
  opacity, 6px of space under the rule; its heading 11px semibold, uppercase with 0.3px letter
  spacing, at 60% opacity, 2px above its lines; each line as a component's (name left, amount and
  unit right in the monospace volume style), 12px between.
- **The Osmolality line** (section 6): spaced and ruled as the `Concentrations` group (6px below
  what's above it, a 1px rule in the light text at 20% opacity, 6px under the rule); `Osmolality`
  left, the value right in the monospace volume style, 12px between; the unknown line 12px at 60%
  opacity, wrapping within the card.
- **A component's Osmolality row** (section 8): the text box 112px (72px cut its placeholder to
  `Not mea`; found in the build review, 2026-11-05), then `mOsm/kg` 12px gray (`#5E5E58`), 6px
  apart.
- **What a chip carries** (section 8): 12px gray (`#5E5E58`), 2px after the name, never wrapped;
  the same gray when the chip is picked.
- **A component's Contains rows** (section 8): a grid per row, the name box taking what's left,
  then the amount box 72px with 6px side padding (from 2026-11-05, was 56px, so `1500000` shows
  whole; 64px with the usual 10px padding cut it to `15000…`, found in the build review), the unit menu
  92px (from 2026-11-05, was 76px, so `cells/mL` shows whole; its right padding 2px, so `g/L` and
  `mM` show whole), then `×` 26px; 6px apart; rows 6px apart and 6px above `+ Add`; `×` plain (no border,
  gray, 16px) like a transfer row's.
- **A well label on the deck** (with `Names` on; in the white tag that otherwise holds the volume): the page's text font, semibold (600), 9px with
  line height 1.05, centered, at most two lines and at most the well's width less 4px, 1px × 2px
  padding; a single word 8px, letter spacing −0.3px, on one line, at most the well's width less
  2px, 1px padding, cut with `…`; on a trough, 11px, turned 90° counterclockwise (reading bottom to
  top), at most the trough's height less 8px.
- **Randomizations:** the box 12px corners, 1px `#9DB7DB` border, 8px padding, the page's
  background; dashed while not set up. The heading 15px, its dice icon 20px; status 13px gray. The
  tabs' counts 11px in a gray pill (`#ECEAE3`), blue on the open tab's. A source row 30px tall, its
  swatch 12px. Its `Filler` button 26px tall, 12px text. The Sources list's boxes, seams, tip
  buttons and grip as section 7 gives them (2026-11-05).
- **Transfer tables** (2026-11-05): the box and heading as a run randomization's, the table icon in
  place of the dice; the table button as the dice button; the wizard as section 7 gives it, its
  body 14px, its grid 13px, help text 13px gray, notes 11px gray; its colors only the page's own
  (blue for the current step and focus, sand for the header row and label column, red for problems,
  pale green for done steps).
- **The name box:** 140px wide, at least 30px tall, the shadow `0 6px 20px` at 20% of the text
  color.
- **⟳ badges** (section 6): a 14px circle centered on the well's top-right edge (at 45° from its
  center; a reservoir trough's top-right corner), with a ⟳ in it, 10px, and a 1px white border so it
  stands out on any fill. Blue: fill `#2F5DA8`, ⟳ white. Short: fill `#FFD45C`, ⟳ `#8A6400`. Mix
  problem: fill red (`#C4362A`), ⟳ white. Drawn
  above the well and its label, below arrows; they don't fade with the open stage's other wells
  (they're on the stage's own wells).
- **The Mix row** in a stage's box: the checkboxes centered in their columns; `Can't mix` 13px gray.
- **Moving and copying** (section 7): the selection, drag, drop line, label and right-click menu as
  section 7 gives them.
- **Motion:** with the system's "reduce motion" setting, no fades, glows or smooth scrolling.
- **Headings** `Deck` and `Stages` are there for screen readers but not shown.
- **The version line:** 12px in the monospace font, gray (`--muted-text`), right-aligned across the
  page's width (at most `--page-width`), 12px below the panels, as in the preview of 2026-11-02.

## 16. Testing
The page itself isn't unit-tested in Node: every rule about plans is in the logic modules, which
are. `transfer-designer-page.test.js`, inside `describe("transfer-designer-page", …)`, checks only the
page's configuration (ADR 0009):
- `COMPONENT_COLORS`: 30 entries, each `#` and six hexadecimal digits, none repeated (ignoring case).
- `DEFAULT_TRANSFER_VOLUME` and `DEFAULT_FILL_VOLUME`: numbers above 0.
- `SOURCES_SHOWN`: a whole number of at least 1.

**By hand**, before each release, in Edge and Chrome, opening the built file:
- each item in sections 5 to 13 behaves as described;
- stocks (section 8): pasting a stock table from Excel adds its components with their colors,
  constituents and osmolality, and one Undo takes them out; a name already in the plan, a unit
  outside the configured ones and their spellings, and a bad number are each marked and stop Add;
  editing a cell or taking a row out fixes it; `Copy table`, then pasting into Excel gives the same
  table, and pasting it into another plan's `Paste table` gives the same components;
- saving, then opening the saved file in a new window, gives the same plan; reloading the page
  brings the plan back; a private window starts empty and works;
- clicking, dragging, and sending one source into a box of wells, in all four directions;
- keeping the source (section 9): with a source chosen, three Ctrl-clicks on scattered wells add
  three transfers, each its own Undo step, the arrow and volume staying, and the message ending
  `Source kept: hold Ctrl (Cmd on a Mac) …`; a volume typed between them goes into the next one and
  the source stays; a Ctrl+drag across a box adds the box and keeps the source; then a plain click
  adds one more and clears it; Escape clears a kept source; a Ctrl-click on the source clears it; a
  Ctrl-click with no source chooses one; a Ctrl+drag with no source adds one transfer; a Ctrl-click
  that makes an overdraw shows the error without the hint and keeps the source, and so does one the
  logic refuses; a box holding only the source, and a Ctrl+drag ending on other labware or off every
  labware, keep it, with the hint; Undo in the middle of a run keeps it, and an Undo or Redo that
  leaves a mix step or Start open clears it; opening another stage clears it; a Ctrl-click on a deck
  well while an editing box with changes is open shakes the box, adds nothing and keeps the source,
  and so does Ctrl+Enter on a focused well; a Ctrl-click on a well while a transfer's volume box or
  a well's name box is open saves the box, adds the transfer and keeps the source, with the hint; a
  Ctrl-click in the Stages column during a run selects as usual and keeps the source; Ctrl+Enter on
  a focused well keeps it; in a mix step, at Start, at End, in a randomization's or transfer table's
  stage, with a randomization's card open and while moving wells, Ctrl-click acts as a click; on a
  Mac, Cmd-click keeps the source, and Ctrl-click on a well with a source chosen opens its name box,
  adds nothing and keeps the source;
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
- the page tweaks of 2026-10-31: a picked swatch keeps its color; Remove in a component's, a
  stage's, a mix step's and a tip change's box removes at once and Undo brings it back; a problem
  transfer's volume is red with its tooltip, for a dead-volume draw, an overdraw and an overfill;
  the card has no total, usable or capacity lines, on a plate and a trough, and a striped well's
  card shows nothing extra;
- capacities and dead volume: a trough filled with little more than its dead volume, then drawn
  from past it: the X, the dead-volume message in the card and after adding, the stage red, the
  problem counted, the Biomek files refused; the trough then holding only dead volume: striped,
  `Only dead volume` in the key; a plate well filled past its capacity
  at Start, and another taken over it by a transfer: the bar, `Overfill` in the key, the messages,
  the count, the refusal; a well both overdrawn and overfilled shows both marks; the stripes and
  marks on a plate and on a trough alike;
- randomizations: added at each kind of seam between tip groups (above the first box, between,
  above End); closing with nothing set keeps it, not set up; sources and wells to fill picked by
  clicks and drags on two plates, each tab picking only its kind, a well never both; dragging on the
  Sources tab to add and to remove a box of sources; the All sources
  box, a source's own box, `mixed`; the filler's count; several filler wells (each row's share,
  in pick order; a well with less than one transfer above its dead volume giving `0 wells`; one
  filler stage drawing from each; `The filler wells hold different liquids.`); out of date (a filler
  trough topped up, then the heading, the card's line, the problem count, the Biomek files box, and
  Update clearing them; every filler trough's liquid changed, and Update renaming the stage); more
  than `SOURCES_SHOWN` sources; Each
  transfer, Tips and Volume; **a run randomization's settings on its stages** (2026-11-05, item
  20): each of its stages' ✎ (Name disabled with its tooltip, no Remove with its note; a mode
  changed and saved) and each of its tip groups' ✎ (no Remove, its note); the card then showing
  that value as `Mixed` (mode menu, Mix dash, tip menus) with its note; Mix under a Mixed mode
  enabled when every stage's mode can mix, and disabled with the tooltip naming a stage dispensing
  Non-Contact; a Mix opened as Mixed cycling checked, unchecked, Mixed; `Mixed` chosen again
  restoring a menu; a value chosen on the card (Dispense Fast)
  enabling Update and, after Update, on every stage, the stage changed by ✎ keeping its other end;
  Update with nothing chosen keeping every stage's settings and tips; a new source added after a run
  starting like its neighbor; a randomization not run yet showing its own values and its first-run note, and a new
  one starting from the stage before it; each problem message; Randomize: stages in source order, named, each on
  new tips, the stage after keeping its tips, every well filled once; Update with the same seed (same
  wells) and a new one; a source removed and added; Remove before and after running, and Undo; its
  box (2026-11-05, item 20): a closed run randomization's box opening on a click of its heading to
  show its stages and closing again (▸/▾, `aria-expanded`, Enter and Space), its ✎ (`Edit
  randomization`) opening the card (and the box) and closing it, a press on it starting no drag,
  the randomization still dragged and copied by its heading, the box opening when `‹` and `›` step
  into its stages and staying open after, closing it with the card open after a run with changes
  refused, its open state kept across edits and undo but not across a reload; a not-set-up one
  showing no ▸/▾, its heading and ✎ each opening its card; while moving wells, a run one's heading
  opening and closing its box, a not-set-up one's saying why it can't; the
  Sources list's boxes (2026-11-05): every new source in a box of its own, blue and sand
  alternating, the headings `New tips` and `New tips · shared by 3 sources`; the tip button on a
  seam between boxes joining them and on a seam inside a box splitting it, each showing only while
  pointed at, with its tooltip, and reached with Tab; no button above the first box or the first
  row; dragging a row by its grip onto a seam inside another box (it shares that box's tips), onto
  the seam above a box's first row (it becomes first, the old first shares), and onto a seam
  between boxes (new tips of its own); dragging a box's first source away (the next keeps the
  tips); the drop line while dragging; a drop elsewhere moving nothing; only sharing changed on a
  run randomization shows `Discard` and enables Update, and Update makes the shared stages one tip
  group in the column (one tip change), the stage after the randomization keeping its tips; a
  reordered run randomization's stages following the new order after Update, with new wells for the
  same seed; Randomize's tooltip: `with new tips before each` with no source sharing, `on N sets of
  new tips` (from `tipSetsToMake`) once any source shares, and back after splitting them all; a drag
  started from the grip and from the name, and none from the replicates box (selecting its text
  with the mouse moves nothing), the Filler button or `×`; with the list folded and a box cut by the
  fold, a source dropped on that box's seam below its last shown row landing at the box's end,
  after its hidden rows, sharing its tips; a not-run randomization's sharing kept after
  Close, reload, and saving and opening; Undo of Update bringing back the old tips; removing a
  shared box's first source with `×` and by unpicking it on the deck; the boxes with more than
  `SOURCES_SHOWN` sources, folded and shown; the
  box collapsing, and opening when its stage is reached with `›`; its stages' cards with no ✎, no
  seams, no `×`, and a deck click's message; saving and opening, and reloading, keep it;
- well labels: right-click a plate well and a trough, and the menu key on a focused well, with
  Start, a stage and End open; name one, rename it, Escape, a blank name removes it, unchanged
  saves nothing; each name undone and redone; `Names` off and on; a two-word name on two lines, a
  long single word cut with `…`, a trough's name upright; an empty labeled well; the contents
  card's label, well and hint lines; names kept after reloading, and after saving and opening;
  transfer rows unchanged; a right click with a volume box, an editing box and the Reset box open;
  focus back on the well after Enter and Escape from the keyboard; a plate holding only names is
  brought out on opening;
- seams: inside a box, the seams above its first stage, between two stages and below its last
  stage, each with the ⟳ and `+` adding into that box with its tips, and the tip button only
  between two stages, splitting the box; between tip groups, the seams above the first box, between
  two boxes and above End, each with a dashed line across the column, and its ⟳ and `+` adding a
  stage or mix step in a box of its own (above the first box: the old first stage gets its own new
  tips, same type and probes; above End: last, with the last box's tips), each as one undo; every
  seam's buttons in the same three spots, nothing in the right spot between tip groups; each seam
  between tip groups found by pointing in its gap, and a box's last seam's buttons still clickable
  where they reach below the box; keyboard focus left to right; only the new stage glowing; their
  tooltips and accessible names;
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
- constituents: a component's box with no rows (`Contains nothing at a known concentration.`),
  `+ Add` pre-filling the component's name, a second row blank; name, amount and unit typed and
  chosen, Enter in the amount box saving; the unit menu listing the offered units in the
  configuration's order (today M, mM, µM, g/L, %, ×, cells/mL), and a constituent saved at `1 M` showing
  `1 M` on the chip and, diluted 1 in 20 in a well, `50 mM` on the contents card; `×` taking a
  row out; Save, then Undo and Redo of the rows; a bad amount (`ten`, blank, `0`) refused with the message and the box kept open; a unit of
  another family for a name another component carries refused, naming that component; the chip's
  text (`10 mM`; `Hy-Soy 4 g/L +2`) and tooltip; the contents card: no group for a well carrying
  nothing; one constituent at 25% of the well (10 mM → `2.5 mM`); the same constituent from two
  components adding up; a 50 µL transfer of a 10 mM stock into 1000 µL (`476 µM`), and `10 mM` in
  the trough it came from; g/L diluted a hundredfold shown in mg/L; `%` and `×` shown as they are;
  the card at Start, at a stage and at End; a renamed component keeping its rows; a plan saved
  (version 7) and reopened, and reloaded, keeping them, and a version 6 file opening with none;
- osmolality: a component's box with the field empty (`Not measured`); `300` typed and saved, then
  Undo and Redo; `0` kept as a value; emptied to remove it; `-5` and `ten` refused with the message
  and the box kept open; Enter in the box saving; the chip's tooltip line; the contents card: no
  line while no component has a value; `≈ 300 mOsm/kg` in a well of Media at 300; a 100 µL transfer
  of Water at 0 into 900 µL of Media giving `≈ 270 mOsm/kg`; with Water given no value, `Osmolality
  unknown: no value for Water`, and with two and three components missing, the `and` and comma
  forms; a plan whose only osmolality is Water at 0 still showing the line: `≈ 0 mOsm/kg` in a well
  of only Water, and `Osmolality unknown: no value for Media` in a well of Media; `1e-7` typed,
  saved, and shown again as `1e-7`; a box reopened and closed without typing not counting as
  changed; the card at Start, at a stage and at End; a renamed component keeping its value; a plan
  saved (version 10) and reopened, and reloaded, keeping the values, and a version 8 file opening
  with none;
- cells (2026-11-05): the unit menu reading `M, mM, µM, g/L, %, ×, cells/mL`, `cells/mL` shown
  whole; typing an amount (section 13): `1.5e6`, `1.5E6` and `1500000` each saved as the same
  number, `.5` and `5.` saved as 0.5 and 5, `5e-3` in mM saved, and `e6`, `1,500,000` and
  `1.5x10^6` refused with the amount message, the box kept open, and `1e400` refused with the
  "above 0" message; cell figures (section 13): amounts of 999.6, 999.4 and 99960 cells/mL shown
  as `1 × 10³ cells/mL`, `999 cells/mL` and `1 × 10⁵ cells/mL`; the chip `Cells 1.5 × 10⁶ cells/mL` (or `1.5 × 10⁶ cells/mL`
  for a component named Cells); a suspension at 1.5 × 10⁶ cells/mL in a trough showing `1.5 × 10⁶
  cells/mL` there; 10 µL of it into a flat-plate well holding 90 µL of Media showing
  1.5 × 10⁵ cells/mL × 0.1 mL ÷ the flat plate's growth area in cells/cm² (`4.69 × 10⁴
  cells/cm²` with today's stand-in), with the tooltip naming the area; the same into a deep well showing `1.5 × 10⁵ cells/mL`; the
  plate well after a later stage adds 100 µL of Media keeping the same cells/cm²; Cells beside
  Dye in a well, each on its own line; a plan with cells saved and reopened keeping them;
- moving and copying: a click, Shift-click (stages, then headings) and Ctrl-click selecting, each
  marked as the button goes down, and no text selected while pressing or dragging; a stage dragged
  into another tip group (taking its tips), to the top of one, and between tip groups (keeping its
  tips); two stages from different tip groups dragged between tip groups (two groups); a tip group
  and a randomization dragged by their headings (only seams between tip groups marked); a stage
  dropped where it was (the note, nothing to undo); Ctrl held and released mid-drag; Escape
  cancelling; the column scrolling near its edges; a randomization's stage refused without Ctrl and
  copied with it; Ctrl+C and Ctrl+V of a stage, a tip group and a randomization, pasting below the
  selection; pasting into a second window of the designer with Ctrl+V and with the menu's Paste;
  the right-click menu on a stage, a heading and a gap, its greyed-out items and reasons, the
  menu key; closing it with a press outside, Escape and scrolling; each as one undo, with its
  message, the glow, and the pasted things selected; an overdraw after moving a stage before the
  one that fills its source; with an editing box with changes open, and with a run randomization's
  card with changes open (refused, shaking, its message); a picked set made empty by Ctrl-click
  (nothing selected, Ctrl+C's note);
- moving wells: `Move wells` and `Done`; the bar's two texts; a trough moved to a free trough by a
  click and by a drag, its label, contents and transfers following it, then another move without
  pressing Move wells again; a well a later stage fills, moved from Start, where it shows empty; a
  trough moved onto a plate well (an overfill), onto labware brought out from the tray while moving;
  a click and a drop on a well in use (the pick kept, the message); a click on an unused well; a
  randomization's well to fill (dimmed, the message, its card line) and its source (moved, the
  randomization following it); Escape letting go, and Escape with nothing picked; a drop off the
  labware; the contents card's last line in each case; Undo and Redo while moving; a stage opened
  from the column and with `‹` `›` while moving, its ✎, `×` and seams hidden, a volume clicked (the
  message), right-click on a well (the message), Ctrl+C, typed digits; starting it with a stage's
  editing box open and with a randomization's card open (with and without changes); Done keeping
  what was open;
- End's tips: a new plan (`0 transfers done`, no tooltip); a transfer added (`1 transfer done · `
  then `DEFAULT_PROBE_COUNT` tips of the first tip type, today `1 transfer done · 4 BC230 tips`);
  `1 BC230 tip` with one probe; a second tip group of the second tip type with transfers (both
  types, the first type first) and without (not counted); the first stage with no transfers and a
  later tip group with transfers (only the later group's tips counted, not the `START` ones); a mix
  step alone in a tip group (its tips counted); a randomization run (each of its tip changes
  counted); undo and redo changing the count; the tooltip, on the whole count, with End as a row
  and as the open card; the count wrapping in a Stages column at its minimum width, with a plan
  sure to overflow: two tip types, each with a three-digit count (e.g. 100 or more tips of each,
  by many tip groups with transfers), and three-digit transfers done, so End's count runs to
  `123 transfers done · 456 BC230 tips · 104 BC1070 tips`; the count wraps onto a second line,
  right-aligned, the first line ends with a `·`, and no part (`456 BC230 tips`) is split;
- transfer tables (2026-11-05): the table button on every seam between tip groups (not inside a
  box), after the dice in Tab order; on the seam below a randomization that hasn't run, Add puts
  the transfer table below it (the randomization stays above, one undo);
  dragging a table's stage (by its row, and by its tip heading) to another place in the table: the
  stage and its column move, its settings and tips kept, not out of date, one undo; drop places
  showing only for its own stages; dropped outside it, refused; Ctrl+C and Ctrl+V of it alone pasting an ordinary stage; the wizard from it: the paste zone, a paste from Excel (blank
  lines dropped, ragged rows filled), a paste of one cell refused; the grid: matched headers'
  swatches, labels' well counts, each problem cell red with its tooltip, Enter moving down, Tab
  along, Escape restoring a cell, `+ Row` and `+ Column` focusing the new cell, the `×`s deleting
  and out of the Tab order, the problem list's limit; Next disabled until clean; Sources: one well,
  a second well with its split line, `×`, `+ Another well` disappearing when every stock well is
  used, a component with no stock well; Review: from, into, totals, modes with ⟳, tips, the
  per-tip note; Add (stages in column order, each on new tips, the stage below keeping its tips,
  the message, the first stage opening, the glow); the box opening and closing on a click of its
  heading (▸/▾, `aria-expanded`, Enter and Space on it), a closed box opening to show its stages and
  one of them then dragged inside it, the box opening when `‹` and `›` step through its stages and
  staying open after, its open state kept across edits, undo and redo but not across a reload; its
  ✎ (`Edit transfer table`) opening the wizard, and a press on it starting no drag; a stage's ✎ (Name disabled, no Remove, its note; a mode changed and
  saved) and a tip group's ✎ (no Remove, its note); no `×` on its transfers and the deck refusing
  clicks with its note; reopening at Review from its ✎; a header renamed (the stage keeps its settings and
  tips after Update); a column added (copying the column before), cleared (its stage gone) and
  moved; out of date after relabeling a well (heading, problem count, the Biomek files box) and
  Update clearing it; renaming a component renames its header and stage; removing one makes it
  out of date; Cancel, Escape and the backdrop changing nothing; Remove and Undo; moving a
  transfer table by its heading, copying and pasting it, and moving a stage of it alone out of it refused (copying one alone pastes an ordinary stage); saving
  and opening a plan with one (version 11); moving a source well with Move wells;
- the Stages column with 20 stages stays inside the window, at the top of the page and scrolled down;
- a window narrower than 1000px stacks the panels;
- the version line: the built file's name and the line show the same version; a click selects the
  whole version, and it copies; a plan saved by the built file says the same version in `savedBy`;
  served unbuilt, the line ends `-unbuilt`.

