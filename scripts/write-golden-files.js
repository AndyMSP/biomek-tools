// write-golden-files.js — runs the randomizer's golden-file setups once and writes their results to
// tests/fixtures/, as JSON with one { well, contents, type } entry per well.
// Run it by hand with: node scripts/write-golden-files.js
//
// Tests only read these files. If a golden-file test fails, find the cause: never run this script
// to make the test pass (randomizer.md, section 9).

import { writeFileSync } from "node:fs";
import { randomize } from "../src/tools/randomizer/randomizer.js";
import {
  GOLDEN_FILES,
  goldenEntries,
  goldenFileUrl,
} from "../tests/fixtures/randomizer-golden-setups.js";

for (const { fileName, makeInputs } of GOLDEN_FILES) {
  const entries = goldenEntries(randomize(makeInputs()));
  writeFileSync(goldenFileUrl(fileName), formatEntries(entries));
  console.log(`Wrote tests/fixtures/${fileName}`);
}

// Formats entries as a JSON list with one entry per line, so the file is easy to read and a change
// shows up as changed lines in Git, e.g.
// [
//   {"well":"A1","contents":"Static","type":"fixed-contents"},
//   …
// ]
function formatEntries(entries) {
  const lines = entries.map((entry) => `  ${JSON.stringify(entry)}`);
  return `[\n${lines.join(",\n")}\n]\n`;
}
