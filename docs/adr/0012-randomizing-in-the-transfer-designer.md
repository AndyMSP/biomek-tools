# 12. Randomizing happens inside the transfer designer

Date: 2026-11-01

## Status
Accepted (Andy, 2026-11-01: decided while shaping a preview on 2026-10-31 and 2026-11-01, and
accepted by merging #123). Amended by ADR 0018 (2026-11-05, Proposed): a randomization's stages
were each "on new tips"; its sources can now share tips, so its stages may share tips with each
other, never with stages outside it. Amended 2026-11-05 (settings on its stages; "Amendment",
below), proposed in the hands-off workflow until Andy merges it.

## Context
v0.2.0's item 9, the randomizer link, asks that a randomized plate reach the Biomek without anyone
editing Biomek files by hand. Three options were on the roadmap: (A) the randomizer saves its plate
as a plan file, finished in the transfer designer; (B) the randomizer writes Biomek files itself,
with its own settings for techniques, tips and mixing; (C) no link, and the transfers entered in the
designer by hand.

A preview of option A showed the problem with a separate step: the randomized transfers arrived as
a long list with no tip changes, so everything shared tips and could cross-contaminate, and fixing
it meant editing every stage by hand. Option B would duplicate the designer's settings, tips and
checks in a second tool. Option C is the error-prone hand work the project exists to remove.

## Decision
**A randomization is part of a plan**, made and kept in the transfer designer (Andy, 2026-10-31):
an entry in its Stages column, between tip groups, whose card holds its sources, replicates,
filler, wells to fill, transfer settings, tips, volume and seed. Running it makes one stage per
source, each on new tips, and it **owns** those stages: they change only through its card, so the
card always describes them (Andy, 2026-11-01).

- **The randomizer's logic does the randomizing** (Andy, 2026-11-01): there is one copy of it. It
  moves into a shared module, `random-pool`, since two tools now use it (CLAUDE.md, "Project
  layout"): a list of items with replicates, a filler, any set of wells (on any number of plates)
  and a seed, giving each well its item. The randomizer uses it for its one plate's open wells, with
  the same results (its golden files confirm it), and the transfer designer for a randomization's
  wells to fill.
- **Randomizations are saved in the plan**, so they're undone like any edit and kept in plan files.
- **The standalone randomizer page stays** for now (Andy, 2026-11-01), for its bench lists.

## Consequences
- The designer's checks (contents tracking, capacities, mixing) apply to randomized transfers, and
  the file writer needs nothing new: a randomization's stages are ordinary stages to it.
- Plan files gain randomizations (format version 6).
- A randomization's stages can't be customized one by one; if that turns out to be needed, the card
  could gain per-source settings, or a way to turn a randomization into ordinary stages could come
  back (it was tried in the preview and dropped for now).
- The randomizer's one-plate mode and its page are unchanged.

## Amendment (2026-11-05): a randomization's settings live on its stages
**Context.** A randomization's card held its own pipetting settings and tips, and every run copied
them onto its stages, so they were held in two places (they couldn't disagree only because its
stages were locked). Transfer tables (ADR 0019) keep settings only on their stages, edited with each
stage's ✎. Andy (2026-11-05) asked for the tools to work consistently, with one source of truth.

**Decision.** Once a randomization has run, its stages and their tip changes are its settings and
tips, and nothing else holds them: its stages and tip groups can be edited with their ✎ like any
others (names, transfers and places stay its own), and a run keeps each stage's settings and each
source group's tips, a new stage starting from its neighbor's. Its card still **shows** them and can
**set them all at once** (Andy, 2026-11-05: "otherwise you'd need to set dozens of settings
manually"): each value its stages share shows as itself, and where they differ it shows **Mixed**,
like the All sources replicates box; a value chosen there goes to every stage on Update, and Mixed
leaves each as it is. It's a view and a way to set them, not a copy. Before its first run there are
no stages, so the randomization keeps what its first run will give, and only then.

**Consequences.** The randomization's own `settings`, `tipType` and `probes` are `null` once it has
stages, so plan files go to format version 12 and copied items to version 5, older ones opening with
a run randomization's three dropped (its stages already hold what every run gave them). Changing a
stage's settings never makes a randomization out of date. A new randomization starts from the stage
before it, as a new stage does.
