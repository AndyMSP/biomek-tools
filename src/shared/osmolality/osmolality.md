# osmolality — specification

> **Draft (2026-11-05, osmolality; ADR 0016).** Written in the hands-off workflow (CLAUDE.md,
> "Workflows") from what Andy decided on 2026-11-05, so the choices made for him are listed in its
> pull request. It becomes Final once built and tested by Andy.

## 1. Purpose
`osmolality.js` works out a well's **osmolality** (`docs/glossary.md`) from the osmolalities of the
components it holds.

A **component** is a liquid the user names and pipettes (`docs/glossary.md`). A component may have
an **osmolality**: the measured osmolality of its stock, in mOsm/kg (milliosmoles per kilogram of
water), as an osmometer gives it (ADR 0016). Contents tracking follows the components through the
transfers and gives each component's share of a well (`contents-tracking.md`, `volumeFractionsOf`);
this module turns those shares and the components' osmolalities into an **estimate** of the well's
osmolality, or says which components have no value, so none can be given.

It's a shared module because the arithmetic belongs to no one tool: the transfer designer uses it,
and a later tool may use it for a report. It's a module of its own rather than part of
`concentrations` (CLAUDE.md, "Single responsibility": one topic per module): osmolality isn't a
constituent (ADR 0016), and has none of what `concentrations` deals in (constituent names, units,
families of units, choosing a unit to show).

## 2. Scope
Version 1: checking a component's osmolality; a well's osmolality from its shares and its
components.

Not in version 1:
- **Calculating a stock's osmolality from its constituents.** Calculated values are known to
  underestimate measured ones, because solutes interact (ADR 0016); a stock's value is always
  entered as measured.
- **Correcting the mixing step.** Mixing two stocks isn't exactly the share-weighted sum of their
  osmolalities; the module gives the sum, an estimate (ADR 0016), as `concentrations` assumes
  liquids add by volume.
- **Other units** (mOsm/L, osmolarity). Every value is in mOsm/kg.
- **An upper limit.** A stock may be far above 300 mOsm/kg (a 10× buffer, a 1 M salt stock), and
  any limit chosen would be a guess that refuses some real stock; a mistyped value shows up in the
  wells' estimates instead.
- **Rounding for display.** The module gives full-precision numbers; tools round them.

## 3. Data model

### A component's osmolality
A number of mOsm/kg, **0 or more** and finite, or **`null`** when the component has none (it hasn't
been measured, or isn't known). Water is entered as `0` like any other value; nothing is given a
value automatically (Andy, 2026-11-05).

### A well's osmolality
From the well's **shares** (`contents-tracking.md`, `volumeFractionsOf`: each component's volume
fraction of the well, 0 to 1, by component name) and the plan's **components** (each
`{ name, osmolality, … }`; other properties are ignored), the result is `{ value, missing }`:

- **`missing`**: the names of the components the well holds (a share above 0) that have no
  osmolality (`null`, or no `osmolality` property), in the order of `components`; then the name of
  any share above 0 that isn't one of `components`' names, in the shares' order (a checked plan
  never has one, but a component the module can't find is never silently left out: ADR 0016).
- **`value`**: when `missing` is empty and the well holds something, the **share-weighted sum**:
  for every component with a share above 0, share × osmolality, added up in the order of
  `components`. Otherwise `null`.

A component's share is the shares' **own** property of its name, else 0, so a component named like
a built-in property of JavaScript objects (`constructor`, `toString`) is treated like any other
(found in the build review, 2026-11-05).

For example, a well 90% Media (300 mOsm/kg) and 10% Water (0) gives `{ value: 270, missing: [] }`;
90% Media and 10% Buffer B (no value) gives `{ value: null, missing: ["Buffer B"] }`. A well holding
nothing (`{}`) gives `{ value: null, missing: [] }`.

A share of 0 counts as not held: such a component is neither summed nor listed as missing.

A component **has an osmolality** when its `osmolality` is not `null` (and not absent); 0 counts as
a value. Likewise a well's result has a value when `value` is not `null`, so a `value` of 0 is a
result, not a missing one (a well holding only Water at 0 gives `{ value: 0, missing: [] }`).

## 4. Interface
The module exports two functions. Neither changes its inputs; `wellOsmolality` gives a new object,
and a new `missing` list, each time.

| Function | Takes | Returns |
|---|---|---|
| `checkOsmolality(osmolality, componentName)` | a component's osmolality, and the component's name for the message | nothing. Throws (section 5) unless `osmolality` is `null` or a finite number, 0 or more. E.g. `checkOsmolality(300, "Media")` and `checkOsmolality(null, "Media")` return; `checkOsmolality(-5, "Media")` throws. |
| `wellOsmolality(shares, components)` | a well's shares and the plan's components | the well's osmolality `{ value, missing }` (section 3), e.g. `wellOsmolality({ Media: 0.9, Water: 0.1 }, [{ name: "Media", osmolality: 300 }, { name: "Water", osmolality: 0 }])` → `{ value: 270, missing: [] }`. |

`wellOsmolality` doesn't check its inputs beyond what it reads: a plan's components have been
checked by the transfer designer, and the shares come from contents tracking.

## 5. Errors
`checkOsmolality` throws an `Error` whose message says what's wrong and how to fix it, with the
value shown by `describeValue` (`error-messages`):

| Problem | Message |
|---|---|
| Not `null`, and not a finite number 0 or more (text, `NaN`, `Infinity`, a negative number, `undefined`, an object…) | `The osmolality of Media must be a number of mOsm/kg, 0 or more, like 300, or none if it isn't known, but got "ten".` |

The component's name is shown as given (`Media`), as the transfer designer's component messages
show it.

## 6. Test cases
Each becomes at least one unit test in `osmolality.test.js`, inside `describe("osmolality", …)`.
A `value` is compared allowing an absolute difference of up to 1e-9 mOsm/kg, as decimal arithmetic
leaves leftovers (a relative tolerance would allow no difference at all when the expected value is
0). Nothing here depends on `config/`.

**Checking an osmolality**
- `0`, `300`, `290.5` and `2800` are accepted (no upper limit), and so is `null`.
- `-5`, `-0.1`, `"300"`, `"ten"`, `NaN`, `Infinity`, `-Infinity`, `undefined`, `{}` and `[]` throw
  the message, with the component's name given and the value as `describeValue` shows it.

**A well's osmolality**
- One component at share 1 with 300 gives `{ value: 300, missing: [] }`.
- 0.9 Media at 300 and 0.1 Water at 0 give `value` 270; Water at 0 counts as a value, not as
  missing.
- A well holding only Water at 0 (share 1) gives `{ value: 0, missing: [] }`: a result of 0 is a
  value, not `null`.
- Three components with values add up: 0.5 at 300, 0.25 at 600, 0.25 at 0 give 300.
- A component without a value, held by the well, gives `value` `null` and lists it; two without
  values are both listed, in the order of `components`, not of the shares.
- A component with no `osmolality` property counts as having none.
- A component without a value that the well doesn't hold (no share, or a share of 0) isn't listed,
  and doesn't stop the value.
- A share above 0 whose name isn't one of `components` is listed in `missing`, after the
  components, and `value` is `null`.
- A well with no shares, `{}`, gives `{ value: null, missing: [] }`.
- A component named `constructor` (or `toString`) that the well doesn't hold isn't listed and
  doesn't change the value: `{ Media: 1 }` with Media at 300 and `constructor` at 0 gives
  `{ value: 300, missing: [] }`; one it holds counts like any other.
- The inputs aren't changed; two calls give different `missing` lists (a new one each time).

**The REPL**
- The module has a topic of its own in `scripts/repl.js` (CLAUDE.md, "Keep the REPL complete"),
  `osmolality`: checking a value (one accepted, one refused) and a well's osmolality (all known,
  and one missing).
