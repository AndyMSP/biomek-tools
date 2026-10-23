# input-checks — specification

## Purpose
`input-checks.js` holds checks that several modules need to run on their input: whether a value is an
object, whether it has the right properties, and whether a name or a volume is valid. Keeping them in
one place means every module checks the same things in the same way, and words its messages the same
way. It knows nothing about plates, operations or experiments; each caller says in its own words what
is being checked.

## Scope
Version 1 has the helpers that `operation-list` already uses, moved here unchanged so that
`contents-tracking` can use them too. New helpers are added here when more than one module needs the
same check.

Not here: checks that only one module needs, such as `contents-tracking`'s check of the operation
count. Those stay in that module.

## Interface
The module exports six functions. The `check…` functions return nothing when the value is valid and
throw an `Error` when it isn't. The others return a value and never throw.

| Function | Takes | Returns or throws | Example |
|---|---|---|---|
| `isObject(value)` | any value | `true` if it's an object that isn't `null` or a list | `{ well: "A1" }` → `true`; `null`, `[]`, `"A1"` → `false` |
| `findMissingProperties(object, required)` | an object; a list of property names | the names in `required` that the object doesn't hold itself, in the order of `required` | `({ well: "A1" }, ["labware", "well"])` → `["labware"]` |
| `findExtraProperties(object, allowed)` | an object; a list of property names | the object's own property names that aren't in `allowed`, in the order they appear | `({ labware: "Plate 1", wel: "D4" }, ["labware", "well"])` → `["wel"]` |
| `listNames(names)` | a list of names | the names as a message shows them: in quotes, separated by commas | `["source", "volume"]` → `'"source", "volume"'` |
| `checkName(name, subject)` | any value; what the name is, for the message | throws unless `name` is text that isn't blank and has no whitespace at the start or end | `checkName(" Plate 1", "source labware")` throws |
| `checkVolume(volume, subject)` | any value; what the volume is, for the message | throws unless `volume` is a number, 0 or more | `checkVolume(-5, "volume")` throws |

Example:
```js
import { checkName, checkVolume } from "../input-checks/input-checks.js";

checkName(entry.labware, `labware in starting contents entry ${index}`);
checkVolume(transfer.volume, "volume");
```

## Behavior
**Own properties only.** `findMissingProperties` and `findExtraProperties` look only at properties
the object holds itself (its "own" properties). A property it gets from elsewhere, such as a getter on
a class, counts as missing. Callers copy objects property by property, and such a property wouldn't
be copied.

**Messages.** `subject` is placed into the message as given, after "The":

| Problem | Message |
|---|---|
| `checkName`: not text | `The source labware must be text, but got 5.` |
| `checkName`: blank, including only spaces | `The destination well is blank. Give it at least one character that isn't a space.` |
| `checkName`: whitespace at the start or end | `The source labware " Plate 1" has spaces at the start or end. Remove them.` |
| `checkVolume`: not a number, or less than 0 | `The volume must be a number of microliters, 0 or more, like 50, but got -5.` |

`checkName`'s checks run in the order of the table. Whitespace means spaces, tabs and line breaks.
Values are shown with `describeValue` (`error-messages` module). `NaN` and `Infinity` count as numbers
in JavaScript, so `checkVolume` rejects them by name.

A name has to match exactly, because the Biomek finds labware only by its exact name; stray spaces
would make it fail to match.

**What `operation-list` keeps.** Its own messages and the order of its checks stay in
`operation-list.js`; only the helpers move. Its behavior doesn't change, and its tests stay as they
are.

## Test cases
Each becomes at least one unit test in `input-checks.test.js`.

**isObject**
- `{}` and `{ well: "A1" }` → `true`.
- `null`, `[]`, `["A1"]`, `"A1"`, `5` and `undefined` → `false`.

**findMissingProperties**
- Nothing missing → `[]`.
- One missing → that name; several missing → all of them, in the order of `required`.
- A property from a class (a getter), not the object itself, counts as missing.

**findExtraProperties**
- No extras → `[]`.
- One extra → that name; several → all of them, in the order they appear in the object.

**listNames**
- `["volume"]` → `'"volume"'`; `["source", "volume"]` → `'"source", "volume"'`.

**checkName**
- `"Plate 1"` and `"A1"` don't throw.
- `5`, `undefined` and `null` give the not-text error.
- `""`, `"   "` and a tab alone give the blank error.
- `" Plate 1"`, `"Plate 1 "` and `"A1\n"` give the whitespace error.
- The message uses the subject given: `checkName(5, "labware in starting contents entry 2")` gives
  `The labware in starting contents entry 2 must be text, but got 5.`

**checkVolume**
- `0`, `50` and `2.5` don't throw.
- `-5`, `"50"`, `NaN`, `Infinity` and `undefined` give the volume error.
- The message uses the subject given: `checkVolume(-5, 'volume of "Dye" in starting contents entry 2')`
  gives `The volume of "Dye" in starting contents entry 2 must be a number of microliters, 0 or more,
  like 50, but got -5.`
