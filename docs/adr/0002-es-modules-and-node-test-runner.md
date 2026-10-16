# 2. Write code as ES modules and test with Node's built-in test runner

Date: 2026-10-16

## Status
Accepted

## Context
Modules that compute results must be unit-tested in Node and must also run in Edge or Chrome on a
lab PC with nothing installed. We need a way to share code between files and a way to run tests.

JavaScript has two module systems: CommonJS (`require`, Node only) and ES modules (`import` /
`export`, understood by both Node and browsers).

For tests, the options were a third-party framework (e.g. Jest, Vitest) or the test runner built into
Node (`node:test` with `node:assert`), available since Node 18.

## Decision
- Write all source as ES modules. `package.json` sets `"type": "module"`.
- Test with Node's built-in runner. `npm test` runs `node --test`, which finds every `*.test.js`
  file automatically.

## Consequences
- No dependencies to install, update, or audit; cloning the repository and running `npm test` is
  enough.
- The same `import` / `export` syntax works in Node and in the browser.
- Browsers refuse to load ES modules from a page opened as a file (`file://`). The build script will
  therefore need to combine each tool and its modules into a single HTML file for distribution.
- The built-in runner has fewer features than Jest or Vitest (e.g. no snapshot UI). If we need them
  later, switching is a separate decision.
