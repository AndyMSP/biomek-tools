# error-messages — specification

## Purpose
`error-messages.js` holds helpers that build user-facing error messages, so every module words them
the same way. It knows nothing about plates, wells or experiments.

## Scope
Version 1 has one helper, `describeValue`. New helpers are added here when more than one module needs
the same piece of message wording.

## Interface
The module exports one function.

| Function | Takes | Returns | Examples |
|---|---|---|---|
| `describeValue(value)` | any value | the value as it should appear in an error message | `"37"` → `"\"37\""`, `37` → `"37"`, `null` → `"null"`, `[]` → `"a list"` |

Example:
```js
throw new Error(`Well name must be text, but got ${describeValue(name)}.`);
```

## Behavior
- Text is shown inside double quotes, so a reader can tell `"37"` (text) from `37` (a number).
  Quotes already inside the text are left as they are.
- A list (an array) is shown as `a list`, whatever it contains.
- Any other object is shown as `an object`, e.g. `{ rows: 8, columns: 12 }`.
- Anything else is shown the way `String(value)` shows it: `5`, `2.5`, `-1`, `null`, `undefined`,
  `true`.
- It never throws.

Lists and objects are described by their kind rather than shown in full: objects can be large, and
objects made from a class (e.g. a `SeededRandom`) would appear empty, because their private fields
can't be seen from outside. The kind is what a reader needs to fix the mistake. (`String()` alone
would show `[object Object]` for an object and nothing at all for an empty list.)

## Test cases
Each becomes at least one unit test in `error-messages.test.js`.
- Text: `"37"` → `"37"` in quotes; `"ABCD"` → `"ABCD"` in quotes; `""` → `""` (two quote marks).
- Numbers: `37` → `37`; `2.5` → `2.5`; `-1` → `-1`.
- Other values: `null` → `null`; `undefined` → `undefined`; `true` → `true`.
- Lists: `[]` → `a list`; `["A", "B"]` → `a list`.
- Objects: `{}` → `an object`; `{ rows: 8, columns: 12 }` → `an object`.
- An object with no prototype, `Object.create(null)` → `an object`. (`String()` throws for this one,
  so this checks that `describeValue` never throws.)
