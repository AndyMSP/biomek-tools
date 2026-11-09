# 22. Tutorials run over the transfer designer's own page

Date: 2026-11-08

## Status
Proposed (Andy, 2026-11-08: shaped in a preview that evening; written in the hands-off workflow).

## Context
Nobody in the lab has used the transfer designer yet. A written guide exists (a doc in Andy's
artifacts), but the page is learned by clicking and dragging, and much of what matters (a stage's
order, tips carrying liquid, the dead volume) is easier to see than to read. Andy asked for an
interactive tutorial, and shaped one in a preview on 2026-11-08: a panel beside the real page that
says what to do next, rings the control to use, and moves on once the plan shows the step was done.
He then asked for several short tutorials that build on each other instead of one long one.

Three questions had to be settled:
- **Where it runs.** On a copy of the page made for teaching, or on the real page.
- **How it knows a step is done** without reaching into the page's code, which changes often.
- **How practice stays apart from real work**, since the page keeps its plan in the browser.

## Decision
**The tutorials are a tool of their own** (`src/tools/tutorial/`), built into a file of their own,
`transfer-designer-tutorial-v….html`. The file holds the **transfer designer's own page**, built
from the same source, and a **guide panel** over it. So a tutorial always teaches the page as it is,
and the lab's Transfer Designer file has no tutorial code in it at all.

**The page offers the tutorial two read-only hooks** (`transfer-designer-page.md`, "The tutorial's
hooks"): one describes what the page shows (its plan, what's open, the labware out, the open dialog
or card), and one finds the element for a named part of the page (a well, a tray chip, a stage's ✎).
The guide reads through these only. A step is plain data and pure functions of that description,
so steps are unit-tested in Node, and restyling the page can't silently break them: a hook that no
longer finds its element fails a test.

**Practice is kept apart by storage.** Built as the tutorial, the page keeps its plan (and its
copied items and copied deck) under storage names of its own. A tutorial can't touch the plan a
user is working on in the Transfer Designer, and the Transfer Designer can't open a practice plan
by accident.

**Each tutorial brings its own starting plan**, made with the transfer designer's own logic, so any
tutorial can be started first, and every starting plan is one the page could have made.

**Practice names start with `Practice`**, so practice zips are easy to spot, and each tutorial that
writes files says a practice zip is only for trying out simulation.

## Consequences
- The transfer designer's page gains a small, tested surface (its hooks and a second set of storage
  names) that only the tutorial uses.
- Every change to the page that the tutorials teach (a control's place or name, a message's
  wording) may need the tutorials changed with it. The browser walk-throughs (`npm run
  test:browser`, with Playwright, a development dependency Andy approved on 2026-11-08) catch it:
  they do every tutorial's every step in Chrome.
- The tutorials can't run unbuilt from `npm run serve`, since the page and the guide are joined by
  the build (roadmap, "Technical debt").
- A second file goes to the lab. The Transfer Designer file doesn't change size or behavior.
