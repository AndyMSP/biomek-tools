# 5. Write only Transfer From File files, matched to a saved method description

Date: 2026-10-20

## Status
Accepted. Amended by ADR 0006.

## Context
The next tool turns a randomized plate into Biomek files. A Transfer From File file works only with a
method built to read it: the labware names in the file must match labware on the deck, and the files
must be the ones its steps expect (`docs/domain/biomek.md`). So the tool must know the method.

There were two ways to get there:
- **Generate the method itself.** The method file's structure isn't documented (an exported `.json`
  holds steps, but the manual doesn't describe its format), and Script steps are "not currently
  supported for end-user applications" (B56358AF, 27-9). A tool built on either could break with any
  software update.
- **Write only the transfer files.** Their format is documented (B56358AF, chapter 22); the method is
  built in Biomek Software, the supported way.

Taking the second way, three options for which method the files are for:
- **A. Exp37's method only.** Proven, but helps only experiments set up like Exp37.
- **B. One general method with a standard deck,** with its names and positions built into the tool.
  Experiments must fit that deck, and the deck becomes hard-coded configuration.
- **C. Any method, described to the tool.** Most flexible, but each method must be described, with
  room for a typo.

## Decision
The tool writes only Transfer From File files (and the worklists that list them). Methods are built
in Biomek Software.

The tool learns about a method from a **method description** that the user writes once, saves as a
file, and loads again whenever the method is reused (option C). A description says:
- the labware the method uses: each name exactly as in the method, and its wells;
- which Transfer From File steps read files, and which transfers go in each;
- where the files go on the Biomek PC and how they are named.

It doesn't hold an experiment's contents; those come from the randomizer (or later tools).

## Consequences
- Any method can be used, not only Exp37's.
- B stays possible: a standard deck, if the lab adopts one, is one saved description that everyone
  loads.
- Describing a method takes some typing, and a description can disagree with its method. The tool
  should check what it can, such as well names, and new files are always run in simulation first.
- The method description needs its own specification. Its hardest part is describing how transfers
  are split into files, which differs between methods.
- Method descriptions are configuration kept outside the code, as CLAUDE.md requires.
