# technique-list — specification

> **Draft (2026-10-23).** Written for v0.2.0 (roadmap, item 4). The techniques in `config/` are
> **stand-ins**, not the lab's: replace them with the real ones from Biomek Software's Technique
> Browser before the first run (roadmap, "Technical debt"). Still to review: everything.

## 1. Purpose
`technique-list.js` knows which Biomek techniques the lab uses, and checks a stage's settings
against them. Biomek Software doesn't check that a technique suits the tip type it runs with
(`docs/domain/biomek.md`, "Worklist-driven steps"), so the tool must, before any file is written
(ADR 0007).

It has two users:
- **The page** builds its settings menus from it, offering only the techniques that suit the chosen
  tip type, so a wrong combination can't be chosen.
- **The file writer** checks every stage again before writing files, in case a stage was made some
  other way.

The techniques themselves are configuration, in `config/techniques.js` (ADR 0009). This module
holds the rules; the configuration file holds the data. Its functions take the technique table as
an argument rather than importing it, so tests can use a small table of their own, and the real
table is checked by its own test (section 6).

## 2. Scope
Version 1 checks a stage's technique, tip type and liquid type, and each of its transfers' volumes
against the technique's minimum.

Not in version 1:
- **A maximum volume.** "Split large volumes" is always checked (ADR 0007), so a transfer larger
  than the tip holds is made in several trips (test 24, `biomek.md`). Whether a technique's own
  maximum limits a trip isn't known, so it isn't modelled.
- **The full technique table** from the Technique Browser (roadmap, "Technical debt").
- **Probes, labware types and other settings.** Only what a technique constrains is checked here.
- **Checking a stage's settings for form** (text, probe numbers): `stage-list` does that.

## 3. Data model
**The technique table** (`config/techniques.js`) exports `TECHNIQUES`, a list of techniques:
```js
export const TECHNIQUES = [
  {
    name: "STAND-IN Water BC230",
    tipTypes: ["BC230"],
    liquidType: "STAND-IN Water",
    minimumVolume: 5,
  },
  // …
];
```
Each technique is an object with exactly four properties:

| Property | What it is | Form |
|---|---|---|
| `name` | the technique's name, exactly as in Biomek Software | a name (`checkName`, `input-checks`) |
| `tipTypes` | the tip types it may run with, e.g. `["BC230"]` | a list of at least one name, none repeated |
| `liquidType` | the liquid type it is for, exactly as in Biomek Software | a name |
| `minimumVolume` | the smallest volume it should transfer, in µL | a number, 0 or more (`checkVolume`) |

- No two techniques have the same name.
- Each technique says where its values came from in a comment (ADR 0009).

**The stand-ins.** Until the real techniques are read from the Technique Browser, the table holds
these three, each with the comment `// STAND-IN: replace with the real technique (roadmap,
"Technical debt").` Their names start with `STAND-IN` so they can't be mistaken for real ones, and
Biomek would refuse them as unknown techniques.

| `name` | `tipTypes` | `liquidType` | `minimumVolume` |
|---|---|---|---|
| `STAND-IN Water BC230` | `["BC230"]` | `STAND-IN Water` | `5` |
| `STAND-IN Water BC1070` | `["BC1070"]` | `STAND-IN Water` | `50` |
| `STAND-IN Cells BC230` | `["BC230"]` | `STAND-IN Cells` | `20` |

`BC230` and `BC1070` are real tip types (`biomek.md`, "Worklist-driven steps"); the rest is made up.

## 4. Interface
The module exports four functions. None of them change their arguments.

| Function | Takes | Returns | Example |
|---|---|---|---|
| `listTipTypes(techniques)` | the technique table | every tip type any technique allows, each once, in the order they first appear | `["BC230", "BC1070"]` |
| `listTechniquesForTip(techniques, tipType)` | the table; a tip type | the techniques that allow `tipType`, in table order; `[]` if none | `"BC1070"` → `[{ name: "STAND-IN Water BC1070", … }]` |
| `findStageProblems(techniques, settings, volumes)` | the table; a stage's settings (`stage-list`); the volumes of the stage's transfers, in µL | a list of problems, as messages, in the order of section 5; `[]` if none | see section 5 |
| `findTableProblems(techniques)` | a technique table | a list of problems with the table itself, as messages; `[]` if none | used by the test of `config/techniques.js` |

The lists and techniques returned can't be changed (they are frozen), so the page can't change the
table by accident.

`findStageProblems` and `findTableProblems` return problems instead of throwing, because the page
shows them to the user, and a stage can have more than one problem at once. They assume their
arguments have the right form: `settings` comes from `stage-list`, which has checked it, and
`volumes` from the operation list, which has checked them. `findStageProblems` assumes a table with
no problems.

Example:
```js
import { TECHNIQUES } from "../../../config/techniques.js";
import { listTechniquesForTip, findStageProblems } from "../technique-list/technique-list.js";

listTechniquesForTip(TECHNIQUES, "BC230").map((technique) => technique.name);
// ["STAND-IN Water BC230", "STAND-IN Cells BC230"]

findStageProblems(TECHNIQUES, stage.settings, [50, 2]);
// one problem: the 2 µL transfer is below the technique's 5 µL minimum (section 5)
```

## 5. Problems
**`findStageProblems`** checks, in this order. If the technique isn't in the table, the other checks
are skipped, because they need it.

| Problem | Message |
|---|---|
| The technique isn't in the table | `There's no technique "Water 50" in the technique list. Choose one of the listed techniques.` |
| The tip type isn't one the technique allows | `Technique "STAND-IN Water BC230" can't run with BC1070 tips. It runs with BC230 tips.` With several allowed: `It runs with BC230 or BC50 tips.` |
| The liquid type isn't the technique's | `Technique "STAND-IN Water BC230" is for liquid type "STAND-IN Water", but the stage's liquid type is "Water".` |
| A volume is below the technique's minimum | `Technique "STAND-IN Water BC230" shouldn't transfer less than 5 µL, but one of the stage's transfers is 2 µL.` Only the smallest such volume is named, once. |

A volume of 0 is not a problem: a 0 µL transfer moves no liquid (`biomek.md`), and the file writer
decides what to do with one.

**`findTableProblems`** checks the table and returns every problem it finds, in table order:

| Problem | Message |
|---|---|
| The table isn't a list | `The technique table must be a list, but got an object.` (Nothing else is checked.) |
| A technique isn't an object | `Technique 2 must be an object with name, tipTypes, liquidType and minimumVolume, but got "Water".` |
| A property is missing or extra | `Technique 2 needs name, tipTypes, liquidType and minimumVolume, but is missing "liquidType".` / `Technique 2 can only have name, tipTypes, liquidType and minimumVolume, but also got "minVolume".` |
| A name, tip type or liquid type isn't a valid name | `checkName`'s message, naming the technique: `The name of technique 2 is blank. Give it at least one character that isn't a space.` |
| `tipTypes` isn't a list of at least one name, or repeats one | `Technique 2's tipTypes must be a list of at least one tip type, like ["BC230"], but got "BC230".` / `Technique 2 lists tip type "BC230" more than once.` |
| `minimumVolume` isn't a number, 0 or more | `checkVolume`'s message: `The minimum volume of technique 2 must be a number of microliters, 0 or more, like 50, but got -5.` |
| Two techniques have the same name | `Techniques 1 and 3 are both called "Water 50". Each technique needs its own name.` |

Techniques are numbered from 1, as a person counts them in the file. For each technique, the checks
run in the order of the table above; a technique that isn't an object, or has a missing or extra
property, gets only that one problem.

## 6. Test cases
Each becomes at least one unit test in `technique-list.test.js`, inside
`describe("technique-list", …)`. Tests use a small table of their own, not `config/techniques.js`,
except the last group.

**Listing**
- `listTipTypes` on a table whose techniques allow `["BC230"]`, `["BC1070"]` and
  `["BC230", "BC50"]` gives `["BC230", "BC1070", "BC50"]`; on `[]` it gives `[]`.
- `listTechniquesForTip` gives the techniques that allow the tip type, in table order, including one
  that allows several; for a tip type no technique allows, `[]`.
- Changing what either returns throws, and the table is unchanged.

**findStageProblems**
- Settings that suit the technique, with volumes at or above its minimum, give `[]`.
- An unknown technique gives only the not-in-table problem, even if other settings are also wrong.
- A wrong tip type, a wrong liquid type, and a volume below the minimum each give their problem.
- All three at once give three problems, in the order of section 5.
- Volumes `[50, 2, 3]` with minimum 5 name 2 µL only.
- A volume of 0 is not a problem; an empty list of volumes is not a problem.
- The "or" form of the tip-type message, for a technique allowing two tip types.

**findTableProblems**
- A valid table gives `[]`; so does `[]`.
- Each row of its table in section 5 has a test, including a table that isn't a list (`{}`), and a
  table with two problems in different techniques, which gives both, in table order.

**The real table**
- `findTableProblems(TECHNIQUES)` on `config/techniques.js` gives `[]`, so a typo in `config/` fails
  `npm test`.
