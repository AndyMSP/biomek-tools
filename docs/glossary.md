# Glossary

The project's own terms, each defined once. Use a term here with this meaning only. Biomek's own terms
(step, method, technique, worklist) keep Biomek's meaning; see `docs/domain/biomek.md`.

**Component**
A liquid the user names in a plan, such as "Media" or "Drug_A", each with its own color for drawing
it. A plan's starting contents say how much of each component every well holds; contents tracking
then follows the components through the transfers. Two components never share a name or a color.

**Labware label**
The name the user gives one labware on the deck, such as "Drug plate", shown wherever the page
names that labware. Until the user gives one, the label is the labware's name in the deck
description. A label is only for people: transfers and the Biomek files always use the deck
description's name.

**Pipetting mode**
What the user chooses for how one end of a stage pipettes, such as "Slow" at the sources and
"Non-Contact" at the destinations. Each pipetting mode stands for one Biomek technique and one
liquid type (`docs/domain/biomek.md`), which are what the stage's settings hold. The liquid type
needn't match the liquid moved: it sets things such as syringe speeds, so it's part of how to
pipette. Some pipetting modes suit only one end; Non-Contact, for example, is for dispensing only.

**Plan**
Everything the tools hold about one experiment's liquid handling: its components, its starting
contents (what each well holds before the run), its operation list, its stage list, its tip changes
and its labware labels. The transfer designer builds a plan, and the file writer turns it into the
files the Biomek runs. A plan isn't a Biomek method: the general-purpose method stays the same for
every plan (ADR 0006, ADR 0007).

**Plan file**
A plan saved as a file, so it can be kept with the experiment's records, shared, and opened again
later or on another computer. The file says which format it is and its version, so a later version
of the tools can still open it, or say why it can't.

**Stage**
A group of operations that can run in any order and share one set of settings: the technique and
liquid type at the sources and at the destinations (chosen as pipetting modes), and how many probes
are used. Stages run one after another; within a stage, the order isn't fixed. Tips aren't part of a
stage: tip changes come between stages. A stage may use several labware types; the file writer
splits it into substages. The term says what a stage *is*, not who makes it: for now the user builds
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
tip change. The run always starts with one, before the first stage. Tips go on as many probes as
the stages using them need.

**Tip group**
A group of stages that run on the same tips: the stages after one tip change, up to the next. For
example, with tip changes at the start and before stage 4, stages 1 to 3 are one tip group and
stages 4 and 5 another. Tips go on every probe any stage in the group uses.
