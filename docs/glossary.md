# Glossary

The project's own terms, each defined once. Use a term here with this meaning only. Biomek's own terms
(step, method, technique, worklist) keep Biomek's meaning; see `docs/domain/biomek.md`.

**Capacity**
The most one well of a labware type holds, in µL: the type's "Maximum volume per well" in Biomek
Software, copied into `config/labware-types.js`. One value per labware type. A well filled past it
is an overfill.

**Component**
A liquid the user names in a plan, such as "Media" or "Drug_A", each with its own color for drawing
it. A plan's starting contents say how much of each component every well holds; contents tracking
then follows the components through the transfers. Two components never share a name or a color.

**Dead volume**
The liquid a well holds that a tip can't reach, in µL: one value per labware type, in
`config/labware-types.js`, because every technique's minimum pipetting height is set to reach it
(roadmap, item 11 of v0.2.0). A well's **usable volume** is what it holds minus its dead volume,
never below 0; a transfer can take only that. A starting volume is the volume put in the well,
dead volume included: the tool does the subtraction.

**Experiment name**
The name the user gives a plan's experiment, such as "Exp36": the transfer designer page's heading,
and the end of the name of each run's folder of Biomek files (`file-writer.md`). It's part of the
plan, saved with it. Letters, digits, hyphens and underscores only, 1 to 40 characters; a new plan
has none until the user gives one.

**Labware label**
The name the user gives one labware on the deck, such as "Drug plate", shown wherever the page
names that labware. Until the user gives one, the label is the labware's name in the deck
description. A label is only for people: transfers and the Biomek files always use the deck
description's name.

**Mix**
How a stage mixes at one end: before aspirating, at its sources, or after dispensing, into its
destinations. A mix is a share of the well's volume (a percentage), a number of times and a speed.
The tool turns the share into one volume for each stage-worklist row, from what the wells hold
(ADR 0007, "Mixing"). An end of a stage either has a mix or doesn't mix.

**Mix problem**
A mix whose volume is under the minimum mix volume (1 µL): the well a row's mix volume is worked
out from holds too little when it's mixed (ADR 0007, "Mixing"). Like an overdraw, it's shown as a problem, and the Biomek files
can't be written until it's fixed.

**Mix step**
A stage that only mixes: it moves no liquid, and each of its wells is mixed in place (a transfer
from the well to itself, run with a technique that only mixes; ADR 0007, "Mixing"). On the page it's
added with its own button, and shown with a ⟳ after its name. It's still a stage: it has a place in
the stage order, uses the tips of its tip group, and becomes stage-worklist rows.

**Overdraw**
A transfer that asks a well for more than it can give: more than its usable volume (the tip
would reach into the dead volume and draw air) or more than it holds at all. Contents tracking
tells the two apart (`"dead-volume"` and `"overdraw"`; `contents-tracking.md`); the page marks
both as an overdraw. It's shown as a problem, and the Biomek files can't be written until it's
fixed.

**Overfill**
A well over its capacity, because a transfer filled it past that or it starts over. Shown as a
problem, with its own mark; the Biomek files can't be written until it's fixed. The tool can't
know what spills, so it tracks the well's contents as if the liquid had fit.

**Pipetting mode**
What the user chooses for how one end of a stage pipettes, such as "Slow" at the sources and
"Non-Contact" at the destinations. Each pipetting mode stands for one Biomek technique and one
liquid type (`docs/domain/biomek.md`), which are what the stage's settings hold. The liquid type
needn't match the liquid moved: it sets things such as syringe speeds, so it's part of how to
pipette. Some pipetting modes suit only one end; Non-Contact, for example, is for dispensing only.

**Plan**
Everything the tools hold about one experiment's liquid handling: its experiment name, its
components, its starting contents (what each well holds before the run), its operation list, its
stage list, its tip changes and its labware labels. The transfer designer builds a plan, and the file writer turns it into the
files the Biomek runs. A plan isn't a Biomek method: the general-purpose method stays the same for
every plan (ADR 0006, ADR 0007).

**Plan file**
A plan saved as a file, so it can be kept with the experiment's records, shared, and opened again
later or on another computer. The file says which format it is and its version, so a later version
of the tools can still open it, or say why it can't.

**Seam**
A place in the transfer designer's Stages column where a stage, a mix step or a tip change can be
added. A seam inside a tip group (between two of its stages, or at its top or bottom) adds stages
and mix steps with that group's tips, and between two stages can split the group with new tips; a
seam between tip groups (above the first, between two, or above End) adds them with new tips, as a
tip group of their own.

**Stage**
A group of operations that can run in any order and share one set of settings: the technique and
liquid type at the sources and at the destinations (chosen as pipetting modes). Stages run one after
another; within a stage, the order isn't fixed. Tips aren't part of a stage: tip changes come
between stages, and choose the tips and the probes the stages after them use. A stage may use
several labware types; the file writer splits it into substages. The term says what a stage *is*, not who makes it: for now the user builds
stages, and a later version may form them automatically.

**Stage order**
The order of all a plan's stages: the order the page shows them in and the order they will run in.
It includes stages without transfers yet. The plan keeps it as its own list, which changes only when
a stage is added or removed (ADR 0011). The run order (ADR 0008) is only the stages with transfers,
in the operation list's order, which always follows the stage order.

**Substage**
The part of a stage that one Transfer From File file can hold: the stage's transfers whose sources
are all one labware type and whose destinations are all one labware type, because Transfer From File
requires it (B56358AF, 22-13). Each labware's type comes from the deck description. A stage whose
transfers use one labware type at each end is a single substage. The user never sees substages: the
file writer forms them.

**Tip change**
Unloading all tips and loading new ones, all of one tip type, between two stages. A tip change is
its own entry in a plan, not a stage setting, and the stages after it use its tips until the next
tip change. The run always starts with one, before the first stage. A tip change chooses its tip
type and how many probes get tips, and every stage using its tips uses all those probes.

**Tip group**
A group of stages that run on the same tips: the stages after one tip change, up to the next. For
example, with tip changes at the start and before stage 4, stages 1 to 3 are one tip group and
stages 4 and 5 another. Every stage in the group uses all the probes its tip change loads.

**Well label**
A name the user gives a well, such as "Cond 1", so it's easy to recognize. It belongs to the well's
place on the deck for the whole run, not to what the well holds; two wells may share a label. Like a
labware label, it's for people only and never reaches the Biomek. The transfer designer's page calls
it the well's name ("Right-click to name"); in the specifications, a **well name** is the well's
place on its labware's grid, such as `A1`, or `5` on a reservoir.
