# tutorial-plans — specification

> **Draft (2026-11-08).** Written for item 29 of v0.2.0 in the hands-off workflow, from the preview
> Andy shaped on 2026-11-08 (ADR 0022). It becomes Final once built and tested by Andy.

## 1. Purpose
Makes each tutorial's **starting plan** (`docs/glossary.md`), with the transfer designer's own logic
(`transfer-designer.md`), so every starting plan is one the page could have made, and a change to
the logic that would make one invalid fails a test here. The guide panel puts a starting plan in
the page's browser copy when a tutorial starts (`tutorial-page.md`, section 4).

## 2. Scope
The five starting plans of section 3. They hold only what the plan holds (components, starting
contents, labels, stages, transfers); which labware is out when the page opens is the page's own
rule (it brings out the labware a plan uses).

## 3. The starting plans
Every plan starts from `emptyPlan().plan` (`emptyPlan()` gives `{ plan, stageId }`). Components take colors from `COMPONENT_COLORS`
(`config/component-colors.js`) in order: the first component the first color, and so on. Volumes are
in µL; a component's constituents are set with `setConstituents`.

| Name | For | What it holds |
|---|---|---|
| `empty` | Your first run | `emptyPlan().plan` as it is: no name, one empty stage. |
| `firstRunDone` | Checking your plan | Tutorial 1's end: experiment name `Practice1`; Plate1 labeled `Culture plate`; components `Base media` and `Cells`, carrying nothing; Res1 1 starts with 6000 µL Base media, Res1 2 with 3000 µL Cells; stage 1, the empty plan's stage, renamed `Base media`, with a 100 µL transfer from Res1 1 into each of Plate1 B2–B5, C2–C5, D2–D5 (row by row: B2, B3, B4, B5, C2 …); then a stage added with new tips at the end of the run (`addStageWithNewTips(plan, null)`), named `Cells`, with a 50 µL transfer from Res1 2 into each of the same 12 wells, in the same order. Default settings and tips throughout. |
| `conditionStocks` | Making conditions | Experiment name `Practice3`; components `Base media` (nothing), `Glucose` (Glucose 50 g/L), `Yeast extract` (Yeast extract 50 g/L), `Cells` (Cells 1 × 10⁶ cells/mL); Res1 1, 2, 3 and 4 start with 6000, 3000, 3000 and 3000 µL of them, in that order. The empty plan's one stage, unchanged. |
| `tableStocks` | Transfer tables | Experiment name `Practice4`; components `Base media` (nothing), `Glucose` (Glucose 50 g/L), `Yeast extract` (Yeast extract 50 g/L); Res1 1, 2 and 3 start with 6000, 3000 and 3000 µL of them. The empty plan's one stage. |
| `conditionMedia` | Randomizing a plate | Experiment name `Practice5`; Deep1 labeled `Conditions`; components `Control media`, `Glucose media`, `Yeast media`, `Both media`, then `PBS`, carrying nothing; Deep1 A1, A2, A3, A4 each start with 1500 µL of the first four, in order, and are well-labeled `Control`, `With glucose`, `With yeast`, `Both`; Res1 1 starts with 4000 µL PBS. The empty plan's one stage. |

(Why these volumes: each trough holds its labware type's dead volume (`config/labware-types.js`)
plus what the tutorial draws, with some to spare, and each deep well its dead volume plus 12 draws
of 100 µL, so no tutorial meets a problem it doesn't mean to teach. Tutorial 2 draws into the dead
volume on purpose. A test checks there are no problems with the dead volumes as configured, so a
change to them that a tutorial can't absorb is caught.)

## 4. Interface
| Export | Returns |
|---|---|
| `startingPlan(name)` | the plan named `name` in section 3, made fresh each call. Throws `There's no starting plan named "x".` for any other name. |
| `startingPlanText(name, savedBy)` | `planToText(startingPlan(name), savedBy)` (`plan-file.md`); the caller gives `savedBy`, since only the page knows the build's version (the guide panel passes the page's own, `transfer-designer-page.md`, section 17) |
| `STARTING_PLAN_NAMES` | the five names, in the order of section 3 |

## 5. Errors
Only the unknown name of section 4. The plans are made through the logic's checks, so a plan the
logic would refuse throws its message when made, and the tests below catch it.

## 6. The REPL
A `tutorial-plans` topic in `scripts/repl.js`, with `startingPlan` and `STARTING_PLAN_NAMES`; its
example shows `startingPlan("firstRunDone")`'s stage names.

## 7. Test cases
In `tutorial-plans.test.js`, one `describe("tutorial-plans", …)`:
- each name gives a plan that survives a round trip: `planToText` of `planFromText` of its text is
  the same text (stages get new IDs when read, so plans aren't compared directly);
- each plan's contents as section 3 says: experiment name, labware labels, well labels, components
  with their constituents, starting volumes, stage names and order, which stages start new tips,
  transfers (count, sources, destinations, volumes);
- each plan has no contents problem (`contents-tracking.md`) and no mix problem;
- `firstRunDone` matches what tutorial 1's steps make: the steps' `done` all `true` on a view of it
  (`tutorial.md`), for the steps that read only the plan;
- colors follow `COMPONENT_COLORS` (worked out from it, per CLAUDE.md, "Tests follow `config/`");
- an unknown name throws section 4's message.
