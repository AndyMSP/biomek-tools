# 4. Hand out each tool as one HTML file, built with esbuild

Date: 2026-10-19

## Status
Accepted

## Context
Each tool must open in Edge or Chrome on a lab PC with nothing installed (CLAUDE.md). The randomizer
page is several files: `randomizer.html`, `randomizer.css`, `randomizer-page.js`, and the modules it
imports (`randomizer.js`, `well-grid.js`, `pasted-table.js`, and others).

Those files can't simply be copied to a lab PC. The code uses ES modules (ADR 0002), and browsers
refuse to load ES modules from a page opened as a file (`file://`). That's why trying the page during
development needs `npm run serve`. Lab users can't be asked to run a server.

The usual answer is a **build step**: a script that turns the source files into the files that are
handed out. Here the output is one HTML file per tool, with the CSS and all the JavaScript copied
inside it. One file is easy to download, email or put on a shared drive, and it opens with a
double-click.

Joining modules into one script is called **bundling**. Options considered:
- **Write our own bundler**: no dependency, but a bundler has to follow every `import`, put the
  modules in the right order and keep their names from clashing. That is a lot of new code to test,
  for a problem already solved well.
- **esbuild**: a widely used bundler, run with one function call. It is a **development dependency**:
  needed to build the tools, never shipped to the lab or needed to run them.
- **Larger tools** (webpack, Rollup, Vite): do much more than this project needs, with more setup.

## Decision
`npm run build` runs `scripts/build.js`, which builds `dist/randomizer.html`: the page's HTML with its
CSS inlined in a `<style>` element and its script, bundled by esbuild into one ordinary (non-module)
script, inlined in a `<script>` element at the end of the body.

esbuild is a development dependency, pinned to an exact version in `package.json`, so every computer
builds the same output.

The source files stay as they are; `dist/` is build output and is not committed.

## Consequences
- A tool can be handed out as one file that opens from `file://` with nothing installed.
- Developers need `npm install` once before building. Running the tests still needs nothing extra.
- Bundling changes how the code is packaged, not what it does. The built page should still be checked
  in a browser before a release.
- A new tool is added to the build by adding it to the list in `scripts/build.js`.
- If esbuild ever had to be replaced, only `scripts/build.js` would change.
