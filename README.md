# biomek-tools
Tools for developing methods on the Biomek i5 with a Span-8 pod.
- **Randomizer** (`randomizer.html`): places samples in random wells of one 96-well plate.
- **Transfer Designer** (`transfer-designer.html`): plans transfers by clicking and dragging between
  wells, in stages, and writes the Biomek files for the general-purpose method.
- **Transfer Designer Tutorial** (`transfer-designer-tutorial-v….html`): guided tutorials on the
  Transfer Designer's own page.

## Setup
Install [Node.js](https://nodejs.org/) (version 20 or later). Then, in the project folder, run
```
npm ci
```
once. This installs esbuild and Playwright, exactly the versions recorded in `package-lock.json`.
esbuild is needed only for building (see below), and Playwright only for the browser walk-throughs;
the tests and the development server need nothing else. (To add or
upgrade a dependency, use `npm install <name>` instead; see CLAUDE.md.)

## Running the tests
```
npm test
```
This runs every `*.test.js` file using Node's built-in test runner.

```
npm run test:browser
```
This runs the tutorials' browser walk-throughs (`tests/browser/tutorial.walk.js`;
`src/tools/tutorial/tutorial-page.md`, section 9): with Playwright, it opens the built tutorial file
in Chrome and does every step of every tutorial as a user would, at two window sizes, checking that
the ring is on the right thing, that each step is seen to be done, and that the page throws no
error. It builds first if `dist/` has no tutorial file. It uses Google Chrome if it's installed;
otherwise run `npx playwright install chromium` once, to get Playwright's own browser. Add a
tutorial's number to walk only that one (`npm run test:browser -- 3`), and `--shots` to save a
screenshot after each step in `dist/walk-shots/`.

## Trying out the modules
```
npm run repl
```
This opens an interactive Node session with every shared module and the tools' logic modules (the
randomizer's and the transfer designer's) loaded, e.g. `GRID_96.wellPosition("D3")` or
`new SeededRandom(37).next()`. When it starts, it lists
what's loaded, grouped by topic (one per module, such as `layout` or `operation-list`). Type
`.examples` and a topic, e.g. `.examples layout`, to see examples to try. Type `.exit` to quit.

## Trying the pages
```
npm run serve
```
This starts a small web server on this computer. Open a page at its address in Edge or Chrome:
- the randomizer: `http://localhost:8000/src/tools/randomizer/randomizer.html`
- the Transfer Designer: `http://localhost:8000/src/tools/transfer-designer/transfer-designer.html`

Browsers won't load the pages' modules from a file opened directly, so during development the pages
have to be served this way. Press Ctrl+C to stop the server.

The tutorial isn't served unbuilt: the build joins the Transfer Designer's page and the tutorial's
guide panel. To try it, run `npm run build` and open `dist/transfer-designer-tutorial-v….html`
(roadmap, "Technical debt").

## Building the tools
```
npm run build
```
This makes one self-contained HTML file per tool in `dist/` (the randomizer, the Transfer Designer
and the Transfer Designer Tutorial; `scripts/build-tools.md`), named by the build's version (ADR 0015;
`scripts/build-version.md`): `transfer-designer-v0.2.0-dev.488.html` between releases, from `main`,
and `transfer-designer-v0.2.0.html` for a release; the page shows the same version at the bottom
right. Each build first clears the earlier builds out of `dist/`, so the newest is the only one
there. Building needs a git clone with its tags (`git fetch --tags`). The file has the page's
styling and all its code inside. That file is what
goes to the lab: it opens in Edge or Chrome with a double-click, with nothing installed and no
internet needed. `dist/` is not committed. See ADR 0004.

## Making a release
Releases follow semantic versioning (MAJOR.MINOR.PATCH); versions starting with 0 may still change.
`package.json` already holds the version being released (it's set to the next planned version
straight after each release; step 5).
1. On a branch, add an entry to `CHANGELOG.md`. Open a pull request and merge it.
2. On `main`, pull, then tag the release and push the tag: `git tag v0.2.0`, then
   `git push origin v0.2.0`. (The build names a release only at its tag.)
3. Run `npm ci` and `npm run build`; it makes `dist/transfer-designer-v0.2.0.html`,
   `dist/transfer-designer-tutorial-v0.2.0.html` and `dist/randomizer-v0.2.0.html`.
4. On GitHub, under Releases, choose "Create a new release":
   - Tag: choose the tag you pushed (e.g. `v0.2.0`).
   - Title: the version. Notes: what changed, written for lab users.
   - Attach each tool's file from `dist/` (not the one in `src/`).
   - Release label: None, unless the release isn't meant for use yet (Pre-release).
   - Publish.
5. On a branch, set `package.json` to the next planned version with
   `npm version 0.3.0 --no-git-tag-version` (this updates `package.json` and `package-lock.json`).
   Open a pull request and merge it. Until then, the build stops, since its builds would otherwise
   be named as if before the release.

## Where to find things
- **What each module does**: its specification, `name.md`, sits next to its code
  (e.g. `src/shared/well-grid/well-grid.md`).
- **Where the project is headed**: [`docs/roadmap.md`](docs/roadmap.md).
- **Why things are the way they are**: decision records in [`docs/adr/`](docs/adr/).
- **Facts about the Biomek and the lab's methods**: [`docs/domain/`](docs/domain/).
- **What changed in each release**: [`CHANGELOG.md`](CHANGELOG.md).
- **How we work**: [`CLAUDE.md`](CLAUDE.md).
