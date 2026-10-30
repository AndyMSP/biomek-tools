# substages — specification

> **Draft (2026-10-30).** Written for v0.2.0, mixing layer (b), moving the file writer's
> `substagesOf` into a shared module, since working out mix volumes needs the same substages
> (`mix-volumes.md`). It becomes Final once built.

## 1. Purpose
`substages.js` splits a stage's transfers into its **substages** (`docs/glossary.md`, "Substage"):
the parts one Transfer From File file can hold, because Transfer From File requires one labware type
at the sources and one at the destinations (B56358AF, 22-13). Each substage becomes one row of the
stage worklist (ADR 0007).

It's shared because two modules need exactly the same split: the file writer, to write a row and a
file for each substage (`file-writer.md`), and the `mix-volumes` module, which works out one mix
volume per row (`mix-volumes.md`). One function means they can't disagree (CLAUDE.md, "Don't
repeat yourself").

It moves the split out of `file-writer.js` unchanged: which transfers go together, and in what
order, stay the same. Naming each substage's file stays in the file writer, which numbers the files.

## 2. Scope
Version 1 splits one stage's transfers. It doesn't check them: they come from an operation list,
which has checked their form, and the transfer designer, which has checked that their wells are on
the deck.

## 3. Data model
**Input:** a stage's transfers, in operation-list order, each a transfer as the operation list holds
it (`operation-list.md`), e.g.
`{ type: "transfer", source: { labware: "Res1", well: "1" }, destination: { labware: "Plate1", well: "A1" }, volume: 50, stage: "2" }`.

**A substage** is `{ sourceLabwareType, destinationLabwareType, transfers }`:
- `sourceLabwareType`, `destinationLabwareType`: the labware types of its sources and of its
  destinations, from the deck description (`deck` module, `labwareTypeOf`);
- `transfers`: its transfers, in operation-list order.

Transfers with the same pair of labware types are in the same substage. Substages are listed in the
order their first transfers come.

## 4. Interface
| Export | Takes | Returns |
|---|---|---|
| `substagesOf(transfers)` | one stage's transfers, in operation-list order | its substages, in order, as a new list each time, e.g. `[{ sourceLabwareType: "DeepReservoir12", destinationLabwareType: "Plate96", transfers: [ … ] }]`. An empty list gives `[]`. |

It changes nothing it's given; the transfers in the result are the same transfer objects (the
operation list's are frozen).

## 5. Errors
None of its own. A labware that isn't on the deck throws the `deck` module's message, but the
transfer designer never lets one into a plan.

## 6. Test cases
Each becomes at least one unit test in `substages.test.js`, inside `describe("substages", …)`. The
tests find labware by grid and labware type in `DECK` rather than naming it, so they still pass when
the deck changes (as `deck.test.js` does).

- No transfers give `[]`.
- Transfers that all go from one labware type to one labware type give one substage holding all of
  them, in order.
- Transfers from a reservoir to a plate, then a plate to a deep-well plate, then a reservoir to a
  plate again give two substages: the first holding the first and third transfers, in that order;
  the second holding the second.
- Two different labware of the same type (two plates) are in one substage.
- Each substage's `sourceLabwareType` and `destinationLabwareType` are `DECK`'s types for its
  labware.
- Changing the list returned doesn't change the next result.

The file writer's own tests of substages (`file-writer.md`, section 6) keep passing unchanged.
