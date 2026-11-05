# 16. Osmolality is a measured property of components

Date: 2026-11-05

## Status
Proposed (Andy, 2026-11-05: decided in a chat; written in the hands-off workflow, so it stands as a
proposal until Andy merges its pull request).

## Context
Andy wants the transfer designer to say what a well's **osmolality** is: the concentration of
dissolved particles in a solution, in milliosmoles per kilogram of water (mOsm/kg). Cells respond
to it, so a medium is usually kept near 300 mOsm/kg, and adding drugs, buffers or DMSO stocks can
move a well away from that. (**Osmolarity** is the same idea per liter of solution, in mOsm/L; the
two differ little in dilute media, but osmometers measure osmolality, so that's the term used here.)

**Osmolality as a constituent was considered and rejected** (Andy, 2026-11-05). Components already
carry constituents (ADR 0013), each a name, an amount and a unit, and a well's concentration of a
constituent is worked out from its components' shares. Osmolality could have been one more
constituent, "Osmolality 305 mOsm/kg". Andy rejected it: "it's something that is actually a part of
the constituents rather than an additional thing". Osmolality isn't something a solution carries
beside its glucose and salts; it's a property of the whole solution that those things together
produce. Listing it among them would also invite adding it to a constituent list that already
names the solutes it comes from.

**Calculating it from the constituents was considered too, and isn't done.** Professionally,
osmolality is **measured**, not calculated: freezing-point-depression osmometers are the standard,
including high-throughput ones that read a 96-well plate (BioProcess International, "High-Throughput
96-Well Osmolality Determinations…", which describes a range of 50 to 850 mOsm/kg). Calculating it
from a formulation's solutes is known to be unreliable, because solutes interact and don't each
behave ideally: a study of 363 parenteral nutrition samples found that calculated values
significantly underestimated measured ones (IVTEAM, "Peripheral parenteral nutrition osmolality
algorithm"). The constituents the lab enters are also only the ones it tracks, not every solute.

## Decision
**Osmolality is a measured property of a component, not a constituent** (Andy, 2026-11-05).

- **Entered once per component**, as the starting stock's measured osmolality in mOsm/kg, in a field
  of its own, separate from its constituents. It's optional: a component may have none. Water is
  entered as 0 like anything else; nothing is given a value automatically.
- **Worked out for every well** that holds components, at every point in the plan, as the
  **volume-share-weighted sum** of its components' osmolalities: each component's share of the well
  (the same shares concentrations use, ADR 0013) times its osmolality, added up. Each stock's own
  non-ideality is already in its measured number; only the mixing step is approximate, and for
  media near 300 mOsm/kg it's small. So the value is shown as an estimate, with "≈".
- **Only when every component in the well has a value.** A well holding a component with none has
  no osmolality, and the tool says which components have no value, rather than guessing or
  leaving them out (Andy, 2026-11-05).
- **Part of the plan**: edited in a component's box, undone like any edit, and saved in plan files
  (format version 9; older files open with no osmolalities).
- It lives in a new shared module, `osmolality`, beside `concentrations` rather than in it: it's a
  different quantity, with no constituents, units or families (`src/shared/osmolality/osmolality.md`).
- It changes nothing in the Biomek files.

## Consequences
- A well's osmolality is only as good as the stocks' measurements, and mixing very different
  stocks (a concentrated salt stock into water, say) can make the estimate drift from what an
  osmometer would read. The "≈" says so; measuring the well itself remains the check.
- A plan that never enters an osmolality sees no change.
- Adding a component to a plan that uses osmolality makes the wells holding it say their osmolality
  is unknown until its value is entered, which is the point: a missing stock is never silently left
  out.
- A later tool (a report, say) gets a well's osmolality from the shared module, as it gets its
  concentrations.
