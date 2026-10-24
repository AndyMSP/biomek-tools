# Glossary

The project's own terms, each defined once. Use a term here with this meaning only. Biomek's own terms
(step, method, technique, worklist) keep Biomek's meaning; see `docs/domain/biomek.md`.

**Plan**
Everything the tools hold about one experiment's liquid handling: its starting contents (what each
well holds before the run), its operation list and its stage list. The transfer designer builds a
plan, and the file writer turns it into the files the Biomek runs. A plan isn't a Biomek method: the
general-purpose method stays the same for every plan (ADR 0006, ADR 0007).

**Stage**
A group of operations that can run in any order and share one set of settings, such as the
technique, liquid type, tip type, probes, and whether tips are changed first. A stage's sources
must all be one labware type, and its destinations one labware type, because Transfer From File
requires it (B56358AF, 22-13); each labware's type comes from the deck description, not from the
stage. Stages run one after another; within a stage, the order isn't fixed. On the
Biomek, each stage becomes one row of the stage worklist, running one Transfer From File file
(ADR 0007). The term says what a stage *is*, not who makes it: for now the user builds stages, and a
later version may form them automatically.
