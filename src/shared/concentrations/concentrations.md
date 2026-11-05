# concentrations — specification

> **Draft (2026-11-01).** Written for the roadmap's "Final concentrations" and "Constituents of a
> component", from the preview Andy shaped on 2026-11-01 (ADR 0013). It becomes Final once built
> and tested by Andy.
>
> **Draft change (2026-11-05, M offered):** M becomes an offered unit (Andy, 2026-11-05), so it can
> be chosen when a constituent is entered; nM and mg/L stay display only (sections 3, 5 and 7).
> Only `config/concentration-units.js` changes: the module and its tests read the offered units
> from the file, so neither changes. Written in the hands-off workflow (CLAUDE.md, "Workflows").
> It becomes Final once built and tested by Andy.

## 1. Purpose
`concentrations.js` works out what a well's mixture carries, from what its components carry.

A **component** is a liquid the user names and pipettes (`docs/glossary.md`). A component may carry
**constituents**: things at a known concentration, such as Hy-Soy at 4 g/L in a medium, or Dye at
10 mM in a dye stock. Contents tracking follows the components through the transfers and gives
each component's share of a well (`contents-tracking.md`, `volumeFractionsOf`); this module turns
those shares and the components' constituents into the well's **concentration** of each
constituent, and chooses the unit to show it in.

It's a shared module because the arithmetic belongs to no one tool: the transfer designer uses it
for its contents card, and a later tool may use it for a report. Contents tracking stays about
volumes.

## 2. Scope
Version 1: checking a component's constituents; a well's concentrations from its shares and its
components; the unit to show a concentration in.

Not in version 1:
- **Converting between families.** A constituent given in g/L in one component and in mM in
  another can't be added without its molecular weight, which the tool doesn't know. The transfer
  designer refuses that when the constituent is entered (`transfer-designer.md`, "Constituents"),
  so it never reaches a well; if it did, this module reports the two separately (section 3).
- **Volumes that don't add up** (mixing ethanol and water shrinks a little), reactions,
  precipitation. The tool assumes liquids add by volume, as contents tracking does.
- **Rounding for display.** The module gives full-precision numbers; pages round them.

## 3. Data model

### Units
`config/concentration-units.js` (section 7) lists the units, each with:
- `unit`: its symbol, as shown, e.g. `"g/L"`;
- `family`: the quantity it measures, e.g. `"mass"`; units of one family are the same quantity at
  different scales;
- `factor`: how many of the family's **base unit** one of it is, e.g. `1e-3` for mg/L (base g/L);
- `offered`: whether a tool's menu offers it when a constituent is entered; the others are for
  display only, when a dilution calls for them.

Within a family the list goes from the largest unit to the smallest.

### A constituent
`{ name, amount, unit }`:
- `name`: a name (`checkName`, `input-checks`: text, not blank, no whitespace at the ends), e.g.
  `"Hy-Soy"`;
- `amount`: a number above 0, in `unit`;
- `unit`: the symbol of a unit in the configuration.

A component's constituents are a list of these, in the order the user gave them, no two with the
same name. A component with none carries nothing at a known concentration (Media, say).

### A well's concentrations
From the well's **shares** (`contents-tracking.md`, `volumeFractionsOf`: each component's volume
fraction of the well, 0 to 1, by component name) and the plan's **components** (each
`{ name, constituents, … }`; other properties are ignored):

For every component with a share above 0, for each of its constituents, the constituent
contributes **share × amount × factor** in the family's base unit. Contributions with the same
constituent name **and the same family** add up; the result is one entry per such pair:

`{ name, family, value }`, `value` in the family's base unit, in the order the pairs are first met
going through the components in order, and each component's constituents in order.

A constituent carried in two families (Drug A in µM in one component, g/L in another) gives two
entries with the same name, one per family. Dilution keeps the arithmetic linear, so no unit is
ever converted: 20% of a well from a 10 mM stock holds 2 mM, whatever else is in the well.

A component with no constituents, or a share of 0, contributes nothing. A well holding nothing
gives `[]`.

### The unit to show
**The units of a family**, as a message or a menu lists them: its offered units in the
configuration's order, then its display-only ones in the configuration's order, e.g. mass gives
g/L then mg/L; molar gives M, mM, µM, then nM.

For a value in a family's base unit, the unit to show it in is **the largest unit of its family
in which the amount is at least 1**, else the family's smallest unit; for a family of one unit,
that unit. Amounts within 1e-12 of 1 count as 1, so arithmetic leftovers don't push `1 mM` down
to `999.99… µM`. `offered` doesn't matter here: display may use any unit. E.g. 0.000476 M shows as
476 µM; 0.0075 g/L as 7.5 mg/L; 2.5 M as 2.5 M; 0.5 (percent) as 0.5 %.

## 4. Interface
The module exports five functions. None changes its inputs; a function that gives a list gives a
new one each time.

| Function | Takes | Returns |
|---|---|---|
| `checkConstituents(constituents)` | a component's constituents | a new list of new objects, each constituent `{ name, amount, unit }` with its name trimmed, in the given order. Throws (section 5) if the list isn't a component's constituents. |
| `familyOf(unit)` | a unit's symbol | its family, e.g. `familyOf("mM")` → `"molar"`. Throws for a unit not in the configuration. |
| `unitsOf(family)` | a family | its units' symbols as section 3 lists them (offered first), e.g. `unitsOf("mass")` → `["g/L", "mg/L"]`. Throws for a family not in the configuration. |
| `wellConcentrations(shares, components)` | a well's shares and the plan's components | the well's concentrations (section 3), e.g. `wellConcentrations({ Stock: 0.2, Media: 0.8 }, [{ name: "Stock", constituents: [{ name: "Dye", amount: 10, unit: "mM" }] }, { name: "Media", constituents: [] }])` → `[{ name: "Dye", family: "molar", value: 0.002 }]`. |
| `bestUnit(family, value)` | a family and a value in its base unit | `{ amount, unit }` to show (section 3), e.g. `bestUnit("molar", 0.000476)` → `{ amount: 476, unit: "µM" }`. Throws for a family not in the configuration. |

`wellConcentrations` doesn't check its inputs beyond what it reads: a plan's components have been
checked by the transfer designer, and the shares come from contents tracking. It goes through
`components`, so a share whose name is no component's is ignored. A component without a
`constituents` property counts as carrying nothing.

## 5. Errors
`checkConstituents` checks in this order and throws an `Error` whose message says what's wrong and
how to fix it, with values shown by `describeValue` (`error-messages`). Constituents are numbered
from 1, in the list's order.

| Problem | Message |
|---|---|
| Not a list | `A component's constituents must be a list, like [{ name: "Dye", amount: 10, unit: "mM" }], but got "Dye".` |
| An entry isn't an object (`null`, a list, text…) | `Constituent 2 must be an object with a name, an amount and a unit, but got "Dye".` |
| Missing properties | `Constituent 2 needs name, amount and unit, but is missing "unit".` (all missing, with `listNames`, in that order) |
| Extra properties | `Constituent 2 can only have name, amount and unit, but also got "volume".` (all extra, with `listNames`, in their order) |
| The name isn't a name | `checkName`'s messages, naming `constituent name`; the name is trimmed first |
| The same name twice | `"Dye" is listed twice. List each constituent once.` The trimmed name; reported at the later entry, in table order: after its object, missing, extra and name checks, before its amount and unit checks. |
| The amount isn't a number above 0 (including `NaN`, `Infinity`, `0`, text) | `The amount of "Dye" must be a number above 0, like 10, but got "ten".` |
| The unit isn't in the configuration | `The unit of "Dye" must be one of M, mM, µM, g/L, %, ×, but got "mg/mL".` (the offered units, in the configuration's order) |

Each constituent's checks run in table order before the next constituent's.

`familyOf` throws `"mg/mL" isn't a concentration unit.` for an unknown unit; `unitsOf` and
`bestUnit` throw `"volume" isn't a family of concentration units.` for an unknown family.

## 6. Test cases
Each becomes at least one unit test in `concentrations.test.js`. Values are compared allowing a
difference of up to 1e-12 of the value, as decimal arithmetic leaves leftovers.

**Tests follow `config/`** (CLAUDE.md): a test may name a unit by its symbol, as the examples
below do, the way a test names a tip type, but takes everything else about it from the file, found
by that symbol: its `factor` and `family`, and for a family its base unit (factor 1), its smallest
unit (the last of the family in the list), its offered units and `unitsOf`'s list. So "0.2 at
10 mM gives value 0.002" is written as `0.2 × 10 × factor("mM")`, and a message listing units is
built from the file, never typed out. No test names a factor, and only section 7's tests check what
the file holds.

**Checking constituents**
- `[]` gives `[]`.
- A valid list comes back equal, with names trimmed: `" Dye "` → `"Dye"`.
- The list isn't changed by the check (immutability).
- The result is a new list of new objects: changing it doesn't change the input, and vice versa.
- Each row of section 5 has at least one test: `null`, `{}` and `"Dye"` as the list; `null`, `5`
  and `[]` as an entry; a missing `unit`, and missing `amount` and `unit` (listed as `listNames`
  lists them); an extra `volume`; a name `""`, `"   "` and `5`; the same name twice (and `"Dye"`
  and `" Dye"` count as twice, since names are trimmed, the message showing `"Dye"`); amounts
  `"10"`, `0`, `-1`, `NaN` and `Infinity`; a unit not in the configuration, and one differing only
  in case, the message listing the offered units from the file.
- Checks run in order: a bad constituent 1 and a bad constituent 2 report constituent 1; a bad name
  and a bad amount in one constituent report the name; a repeated name with a bad amount in the
  same entry reports the repeat.

**A well's concentrations**
- One component with one constituent, share 0.2 at 10 mM: `[{ name: "Dye", family: "molar", value:
  0.002 }]`.
- Share 1 gives the amount in the base unit: 4 g/L → `value: 4`, family `"mass"`.
- Two components carrying the same constituent in the same family add: 0.5 at 4 g/L and 0.25 at
  2 g/L → `value: 2.5`; one entry.
- The same name in two families gives two entries, one per family, in the order first met.
- Different units of one family add in the base unit: 0.5 at 1 mM and 0.5 at 500 µM → `value:
  0.00075`.
- A component with a share of 0, or no share, or no constituents, or no `constituents` property,
  contributes nothing; a well with no shares, `{}`, gives `[]`.
- Order: entries come in the order the (name, family) pairs are first met, through the components
  in order and each component's constituents in order.
- Inputs aren't changed.

**The unit to show**
- Molar: 0.000476 → 476 µM; 0.002 → 2 mM; 2.5 → 2.5 M; 0.0000000005 → 0.5 nM (the smallest unit,
  even below 1).
- Mass: 4 → 4 g/L; 0.0075 → 7.5 mg/L; 0.0000075 → 0.0075 mg/L.
- One-unit families: 0.5 → 0.5 %; 150 → 150 ×.
- A value within 1e-12 of a unit's boundary rounds up to that unit: 0.00099999999999999 → 1 mM, not
  999.99… µM.
- An unknown family throws.

**`familyOf` and `unitsOf`**
- Every configured unit gives its family; an unknown unit throws.
- Every family gives its units, offered ones first, each group in the file's order; an unknown
  family throws; the list is a new one each time.

**The REPL**
- The module has a topic of its own in `scripts/repl.js` (CLAUDE.md, "Keep the REPL complete"):
  checking a list, a well's concentrations and the best unit.

## 7. Configuration
`config/concentration-units.js` (ADR 0009) exports:
- `CONCENTRATION_UNITS`: the units, as section 3 describes them, each family's units from largest
  to smallest. Decided by Andy (2026-11-01) from the units the lab's protocols use, with M added
  on 2026-11-05: offered are **M, mM, µM, g/L, % and ×** (`offered: true`); display only are
  **nM and mg/L** (`offered: false`; Andy, 2026-11-05: "they are ok as is"). (U/mL, mg/mL and its
  submultiples were tried in the preview and dropped: the lab writes mass in g/L, and tracks no
  enzyme activities.) Molar's base unit is M, mass's is g/L; percent and × are families of one unit
  each. The symbol for fold is the multiplication sign `×`, not the letter x.
- `DEFAULT_CONCENTRATION_UNIT`: the unit a new constituent starts with, `"g/L"`, the one the lab's
  protocols use most (Andy, 2026-11-01).

The module's tests check the file: every entry has exactly `unit` (text, not blank, unique
ignoring case), `family` (text, not blank), `factor` (a number above 0) and `offered` (a boolean);
within each family, exactly one unit has factor 1 and the factors go down along the list; every
family has at least one offered unit; `DEFAULT_CONCENTRATION_UNIT` is an offered unit. The
behavior tests above take their units from the file, so changing it doesn't break them; only these
tests name a unit.
