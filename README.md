# biomek-tools
Tools for developing methods on the Biomek i5 with a Span-8 pod.

## Setup
Install [Node.js](https://nodejs.org/) (version 20 or later). Then, in the project folder, run
```
npm install
```
once. This installs esbuild, which is needed only for building (see below); the tests and the
development server need nothing else.

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

## Where to find things
- **What each module does**: its specification, `name.md`, sits next to its code
  (e.g. `src/shared/well-grid/well-grid.md`).
- **Where the project is headed**: [`docs/roadmap.md`](docs/roadmap.md).
- **Why things are the way they are**: decision records in [`docs/adr/`](docs/adr/).
- **How we work**: [`CLAUDE.md`](CLAUDE.md).
