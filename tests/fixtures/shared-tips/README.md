# shared-tips: regression fixture for runs before shared tips

**A regression fixture, not a golden file.** It records what the code did on 2026-11-05, before
shared tips (ADR 0018) was built, so the build can show it changed nothing for a randomization whose
sources all start new tips. Nobody checked these files on the Biomek or by hand: Andy hasn't verified
them, so they say "the same as before", not "correct". A golden file is a verified-correct output
(CLAUDE.md, "Project layout"); this isn't one.

**How it was made:** on 2026-11-05, on the `shared-tips` branch after merging `osmolality` (#134),
when the branch held only specifications for shared tips, so the code was the old run logic. In
Node, the plan below was built with `transfer-designer.js`, saved with `planToText(plan,
"transfer designer v0.2.0")` to `randomized-plan-v9.json` (plan format version 9), and
`writeRunFiles(plan, new Date(2026, 10, 5, 9, 30, 0))` (local time; folder
`2026-11-05_093000_Exp36`) gave the files in `biomek-files-before/`, saved exactly as returned
(each line ending in CRLF; `.gitattributes` keeps CSV files byte for byte).

**The plan** (with the real `config/deck.js`):
- Experiment `Exp36`; components Media, Drug A, Drug B and Drug C.
- Starting contents: Res1 1 holds Media 30 µL above its dead volume (one 20 µL transfer), Res1 2
  and 3 hold 10,000 µL of Media; Deep1 A1, A2 and A3 hold 500 µL of Drug A, B and C.
- Stage 1, `Seeding`: 100 µL from Res1 3 into Plate1 B2 to B6.
- A randomization `r1`, run, after stage 1: sources Deep1 A1 (3 replicates), A2 (3), A3 (2), and a
  filler of two wells, Res1 1 then Res1 2; wells to fill Plate1 B2 to B6 and C2 to C6; seed 37;
  20 µL; every source on new tips (no source shared tips before this change). Its filler shares
  are 1 and 1, so both filler wells are used. Its stages are `3`, `4`, `5` (Drug A, B, C) and `6`
  (the filler), each on tips of its own.
- Stage `Top up`, last, on tips of its own: 100 µL from Res1 3 into Plate1 D2.

**Files:** `randomized-plan-v9.json`; `biomek-files-before/Setup.csv`, `Stages.csv`, and
`Stage01_A.csv` to `Stage06_A.csv`.

**Used by** the tests in `transfer-designer.md`, section 6, "Sharing tips", "Regression fixture".
Never edit these files to make a test pass (CLAUDE.md, "Testing").
