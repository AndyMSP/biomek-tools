# Changelog
What changed in each release of biomek-tools, newest first. Versions follow semantic versioning
(MAJOR.MINOR.PATCH). Versions starting with 0 are initial development: the tools are ready to use,
but anything may still change between releases.

## v0.1.0 — 2026-10-20
First release.

### Randomizer (`randomizer.html`)
Places samples in random wells of one 96-well plate. Open the file in Edge or Chrome; nothing needs
to be installed.
- **Randomized contents**: list each condition and how many replicates it needs. A filler (e.g.
  "Spare") fills every spare well and is shuffled in with the replicates.
- **Fixed contents**: name contents that stay in chosen wells (e.g. standards or blanks), and place
  each by clicking wells on the plate or dragging a box across them.
- **Typing and pasting**: Enter moves to the next box and adds a row at the end. Cells copied from
  Excel can be pasted into the tables.
- **Seed**: the same inputs and seed always give the same plate, so a plate can be remade from the
  seed recorded with the experiment. A new random seed is chosen each time the page opens.
- **Checking**: a "Still needed" list says what must be fixed before randomizing.
- **Results**: a color-coded plate with a legend (hover or click an entry to highlight its wells),
  and two lists that can be copied: contents → wells, and well → contents. If the inputs change
  afterwards, the results are marked out of date and copying is turned off until Randomize is
  pressed again.
