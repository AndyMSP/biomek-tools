# 13. Components carry constituents at known concentrations

Date: 2026-11-01

## Status
Accepted (Andy, 2026-11-01: decided while shaping a preview, and accepted by merging #125).
Amended 2026-11-05 (cells; "Amendment", below), proposed in the hands-off workflow until Andy
merges its pull request.

## Context
Two items on the roadmap's "Later" list asked for the same thing from different ends. **Final
concentrations:** a component's stock concentration ("Dye is 10 mM"), so the contents card can say
what a well holds in mM rather than only as a volume fraction. **Constituents of a component:** a
component made of several things, such as a medium with a drug in it, so a well's concentration of
the drug can be followed after the medium is diluted again.

A single "concentration" on a component serves the first and not the second: "medium with Drug A
in it" has no one concentration. Doing the first alone would mean changing what a component is
twice, with a plan-file version and a round of page changes each time.

## Decision
**A component never has a concentration of its own. It carries a list of constituents**, each a
name, an amount and a unit, such as Hy-Soy at 4 g/L, or Dye at 10 mM. "Dye is 10 mM" is a
component with one constituent, named Dye; a medium with a drug in it is a component with a
constituent Drug A at 10 µM; a medium with two drugs has two. One shape serves every case, so a
component's shape changes once (Andy, 2026-11-01).

- **Concentration is linear in dilution**, so the arithmetic needs no unit conversion: a well's
  concentration of a constituent is the sum, over its components, of the component's share of the
  well times what the component carries. Each constituent is handled on its own, whatever its
  unit; this lives in a new shared module, `concentrations`, so contents tracking stays about
  volumes (`src/shared/concentrations/concentrations.md`).
- **Units are the lab's own** (Andy, 2026-11-01, from the units its protocols use): g/L, mM, µM, %
  and ×, in `config/concentration-units.js`, with M, nM and mg/L kept for display, so a diluted
  value reads as 7.5 mg/L rather than 0.0075 g/L. *Amended 2026-11-05 (Andy):* M is offered too,
  so the units offered are M, mM, µM, g/L, % and ×; nM and mg/L stay for display only.
- **The same constituent name across components is the same thing**, so amounts add up in a well.
  Since one name in two families (g/L and mM) can't be added without a molecular weight, the
  transfer designer refuses the second family when it's entered.
- **Constituents are part of the plan**: edited in a component's box, undone like any edit, and
  saved in plan files (format version 7).
- **Shown on the contents card only** for now, as a Concentrations group after the components; the
  deck shows volumes as before.

## Consequences
- Entering "Dye is 10 mM" takes a row (name, amount, unit) rather than one number; the page
  pre-fills the row's name with the component's own name when it has no constituents yet.
- Renaming a component doesn't rename a constituent of the same name: they're separate things.
- A later tool (a report, say) gets a well's concentrations from the shared module with no
  knowledge of the page.

## Amendment (2026-11-05): cells
Decided with Andy on 2026-11-05.

**Cells are a constituent**, not a new kind of thing: a cell suspension really carries cells, and
they dilute like any constituent, so the shape above serves them unchanged. Their unit is
**cells/mL** (a cell density, from a cell count), offered in the menu, in a **family of its own**,
never rescaled (no cells/µL or cells/L: the lab counts in cells/mL).

**On labware cells grow on, a well's cells are shown per cm²** (its seeding density): cell density
× the well's volume ÷ the well's **growth area**, assuming every cell settles onto the bottom.
A labware type has a growth area (configuration, `config/labware-types.js`) only if cells are
grown on it, and cells/cm² is shown only there; on a type without one, cells show in cells/mL like
any concentration.

Consequences: adding a unit doesn't change the plan-file format (units are checked against the
configuration, not the format), so no new version; a file with cells is refused by an older build
with a message naming the unit. The arithmetic stays in `concentrations` (`seedingDensity`), with
the deck module giving the growth area, so contents tracking stays about volumes.
