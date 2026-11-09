# 21. Possible contamination follows tips and assumes the worst

Date: 2026-11-08

## Status
Proposed (Andy, 2026-11-08: decided one question at a time, then from previews; it stands as a
proposal until he merges its pull request).

## Context
A tip carries whatever it touches into every well it enters afterwards, until it's changed. In a
design-of-experiments run such as Exp36, that's the real worry: could the no-yeast control have
picked up yeast because it shared tips with a yeast condition? Shared tips are a choice the tool
already leaves to the user (ADR 0018), so the tool should show what that choice risks.

The tool can't know exactly where liquid goes on a tip. Within a stage the Biomek chooses the order
and which probe does which transfer (B56358AF, 22-25), and whether a technique's dispense touches the
liquid in the well isn't verified on the instrument (`docs/domain/biomek.md`, "Not yet known").

Two ways of showing the result were tried in previews (2026-11-08): outlining the wells that could
have reached a well, and listing the components that could have reached it; and, for each such
component, a line saying how it came.

## Decision
- **It follows tips, not liquid**, in a module of its own (`possible-contamination`), using
  contents tracking for what each well holds.
- **It assumes the worst where the order isn't known** (Andy, 2026-11-08). The unit is the tip
  group: within a stage, any well can reach any other, in either direction; across stages of a tip
  group, earlier reaches later; a contaminated well passes its traces on later, in any tip group.
- **Passing traces on and receiving them are separate** (Andy, 2026-11-08). Sources pass on and
  receive. Destinations receive; they pass on only if their dispense touches the liquid. A
  non-contact destination still receives, because whatever the tip picked up earlier comes out with
  the liquid it dispenses. Which pipetting modes touch the liquid is a setting in `config/` until
  it's verified.
- **A tip carries what a well held when the tip touched it**, not what it holds at the end.
- **It's shown at the timeline's point**, and the end of a stage is the finest point.
- **It's shown as possible traces**: the components that could have reached a well though it
  doesn't hold them, on its contents card. Outlines were dropped: they can't tell a harmless contact
  (water into water) from one that matters, so on a real plate they outline most of the deck.
  Routes were dropped for now: in a big experiment they're too much text.
- **Every component counts**, water included, for now.

## Consequences
- The tool can show a trace that isn't there, but shouldn't miss one that is: a possible trace means
  "can't be ruled out", never "measured" or "likely". The page says so.
- Because every component counts and the rules are generous, a big plan with shared tips will show
  many traces. Marking components as "not a concern" (such as water) was considered and left for
  later; so were routes, in a quieter form. Changing tips between stages isn't enough to clear
  them: a stage that dispenses, touching the liquid, into wells already holding different things
  (such as a randomization's later sources) carries each well's contents to the others in that
  stage.
- If the instrument shows a technique doesn't behave as configured (for example Non-Contact
  touching the liquid), only `config/` changes.
- Nothing here changes the plan, plan files or the Biomek files.
