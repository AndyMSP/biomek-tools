# biomek-tools
Tools for developing methods on the Biomek i5 with a Span-8 pod.

## Setup
Install [Node.js](https://nodejs.org/) (version 20 or later). There are no other dependencies.

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

## Where to find things
- **What each module does**: its specification, `name.md`, sits next to its code
  (e.g. `src/shared/well-grid/well-grid.md`).
- **Where the project is headed**: [`docs/roadmap.md`](docs/roadmap.md).
- **Why things are the way they are**: decision records in [`docs/adr/`](docs/adr/).
- **How we work**: [`CLAUDE.md`](CLAUDE.md).
