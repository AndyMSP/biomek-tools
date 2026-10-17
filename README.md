# biomek-tools
Tools for developing methods on the Biomek i5 with a Span-8 pod.

## Setup
Install [Node.js](https://nodejs.org/) (version 18 or later). There are no other dependencies.

## Running the tests
```
npm test
```
This runs every `*.test.js` file using Node's built-in test runner.

## Trying out the well grid
```
npm run repl
```
This opens an interactive Node session with `WellGrid` and `GRID_96` loaded, e.g.
`GRID_96.wellPosition("D3")`. Type `.exit` to quit.
