# build-tools — specification

> **Draft (2026-11-08).** Written for item 29 of v0.2.0 (the tutorials) in the hands-off workflow.
> It becomes Final once built and tested by Andy.

## 1. Purpose
The pure parts of `scripts/build.js`, moved out so they can be unit-tested in Node: the list of
files the build makes, which files in `dist/` are earlier builds, and the tutorial's HTML. `build.js`
keeps reading and writing files and bundling (ADR 0004).

## 2. Interface
| Export | Returns |
|---|---|
| `BUILD_ENTRIES` | one entry per file the build makes, in order: `{ name, html, css, script, stylesheetName, scriptName, changeHtml }`. `name` is the tool name in the file name (`fileNameFor(name, version)`, `build-version.md`); `html` the HTML file's path; `css` a list of CSS paths, joined in order with a blank line; `script` the script to bundle; `stylesheetName` and `scriptName` as `singleFileHtml` takes them; `changeHtml` a function applied to the HTML before `singleFileHtml`, or `null`. All paths are relative to `src/tools/`. The entries are `randomizer` and `transfer-designer` (each its own folder's `<name>.html`, `<name>.css`, `<name>-page.js`, no change), then `transfer-designer-tutorial` (`tutorial-page.md`, section 3: `transfer-designer/transfer-designer.html`, CSS `transfer-designer/transfer-designer.css` then `tutorial/tutorial.css`, script `tutorial/tutorial-page.js`, stylesheet and script names `transfer-designer.css` and `transfer-designer-page.js`, `changeHtml` `tutorialHtml`). |
| `isBuildOf(name, fileName)` | `true` if `fileName` is `<name>.html`, or starts with `<name>-v` and ends `.html`, e.g. `isBuildOf("transfer-designer", "transfer-designer-tutorial-v0.2.0.html")` → `false` |
| `tutorialHtml(html)` | the HTML with its `<title>Transfer Designer</title>` replaced by `<title>Transfer Designer Tutorial</title>` and its `<html lang="en">` by `<html lang="en" data-tutorial>`. Throws `The tutorial's page needs <title>Transfer Designer</title> exactly once, but found it 0 times.` (or `2 times`) for either text, naming it, if it isn't there exactly once. |

`build.js` builds every entry of `BUILD_ENTRIES` and clears every file in `dist/` that
`isBuildOf` one of their names.

## 3. Test cases
In `scripts/build-tools.test.js`, one `describe("build-tools", …)`:
- `BUILD_ENTRIES` names `randomizer`, `transfer-designer`, `transfer-designer-tutorial`, in order,
  and every file it names exists;
- `isBuildOf`: `randomizer.html`, `randomizer-v0.1.0.html` and `randomizer-v0.2.0-dev.488.html` are
  builds of `randomizer`; `transfer-designer-v0.2.0.html` is a build of `transfer-designer` and not
  of `transfer-designer-tutorial`; `transfer-designer-tutorial-v0.2.0.html` the other way round;
  `notes.txt` and `randomizer-v1.css` are builds of neither;
- `tutorialHtml` on the real `transfer-designer.html` gives one `data-tutorial` and the tutorial's
  title; on HTML missing either text, or holding it twice, it throws its message.
