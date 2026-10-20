# biomek-tools
Tools for developing methods on the Biomek i5 with a Span-8 pod.

## Setup
Install [Node.js](https://nodejs.org/) (version 20 or later). Then, in the project folder, run
```
npm ci
```
once. This installs esbuild, exactly the version recorded in `package-lock.json`. esbuild is needed
only for building (see below); the tests and the development server need nothing else. (To add or
upgrade a dependency, use `npm install <name>` instead; see CLAUDE.md.)

## Running the tests
```
npm test
```
This runs every `*.test.js` file using Node's built-in test runner.

## Trying out the modules
```
npm run repl
```
This opens an interactive Node session with the shared modules and the randomizer's functions
loaded, e.g. `GRID_96.wellPosition("D3")` or `new SeededRandom(37).next()`. When it starts, it lists
everything loaded and some examples to try. Type `.exit` to quit.

## Trying the randomizer page
```
npm run serve
```
This starts a small web server on this computer and prints the randomizer page's address
(`http://localhost:8000/src/tools/randomizer/randomizer.html`); open it in Edge or Chrome. Browsers
won't load the page's modules from a file opened directly, so during development the page has to be
served this way. Press Ctrl+C to stop the server.

## Building the tools
```
npm run build
```
This makes one self-contained HTML file per tool in `dist/` (e.g. `dist/randomizer.html`), with the
page's styling and all its code inside. That file is what goes to the lab: it opens in Edge or Chrome
with a double-click, with nothing installed and no internet needed. `dist/` is not committed. See
ADR 0004.

## Making a release
Releases follow semantic versioning (MAJOR.MINOR.PATCH); versions starting with 0 may still change.
1. On a branch, add an entry to `CHANGELOG.md` and set the new version with
   `npm version <version> --no-git-tag-version` (this updates `package.json` and
   `package-lock.json`). Open a pull request and merge it.
2. On `main`, pull, then run `npm ci` and `npm run build`.
3. On GitHub, under Releases, choose "Create a new release":
   - Tag: type the new version (e.g. `v0.2.0`) and choose "Create new tag … on publish"; target
     `main`.
   - Title: the version. Notes: what changed, written for lab users.
   - Attach each tool's file from `dist/` (not the one in `src/`).
   - Release label: None, unless the release isn't meant for use yet (Pre-release).
   - Publish.

## Where to find things
- **What each module does**: its specification, `name.md`, sits next to its code
  (e.g. `src/shared/well-grid/well-grid.md`).
- **Where the project is headed**: [`docs/roadmap.md`](docs/roadmap.md).
- **Why things are the way they are**: decision records in [`docs/adr/`](docs/adr/).
- **Facts about the Biomek and the lab's methods**: [`docs/domain/`](docs/domain/).
- **What changed in each release**: [`CHANGELOG.md`](CHANGELOG.md).
- **How we work**: [`CLAUDE.md`](CLAUDE.md).
