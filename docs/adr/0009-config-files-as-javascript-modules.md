# 9. Configuration files are small JavaScript modules holding data only

Date: 2026-10-23

## Status
Accepted (Andy, 2026-10-23).

## Context
CLAUDE.md says values that might change, such as labware names, live in `config/`, not in the code.
v0.2.0 needs the first two configuration files: the technique list and the deck description
(roadmap, items 4 and 5). Before writing them, their format had to be chosen.

Whatever the format, configuration is built into each tool's single HTML file (ADR 0004), so a lab
user never edits it; a change means a new build.

Two formats were considered:
- **A JavaScript module** that exports the data, e.g. `export const TECHNIQUES = [ … ];`. Tests,
  `npm run serve` and the build import it like any other module. It can hold comments.
- **A JSON file.** Pure data, but JSON allows no comments, and importing it needs an import
  attribute (`import … with { type: "json" }`), which Node 22 may still mark as experimental and
  which the README's minimum, Node 20, supports only in later releases.

## Decision
**Each configuration file is a JavaScript module in `config/`** that exports its data as named
constants, e.g. `config/techniques.js` exporting `TECHNIQUES`.

- **Data only.** A configuration file holds plain values (text, numbers, true or false, lists and
  objects). It has no functions and no logic, and imports nothing except other configuration files.
- **Sources in comments.** Each fact about the instrument or the lab says where it came from
  (a manual part number and section, or where in Biomek Software it was read, with the date), as
  CLAUDE.md asks for `docs/domain/`.
- **Checked by the module that uses it.** The shared module that reads a configuration file has
  tests that check the file's contents (for example, that every entry has the right properties),
  so a typo in `config/` makes `npm test` fail rather than reaching the lab.

## Consequences
- Nothing new is needed to read configuration: no import attributes, no file loading, no
  dependency.
- Editing a configuration file means keeping JavaScript's syntax (quotes, commas, brackets). Only
  Andy and Claude Code edit them.
- Changing configuration means a new build and release; the lab can't change it from the page.
- If configuration ever needs to change without a rebuild (for example, labware that differs
  between lab PCs), that is a new decision, such as loading a file chosen on the page.
