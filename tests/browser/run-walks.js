// run-walks.js — runs every browser walk-through in tests/browser/ (each *.walk.js), one after
// another, for `npm run test:browser` (transfer-designer-page.md, section 16). The command line's
// arguments go to each walk-through unchanged, so `npm run test:browser -- 3 --shots` still limits
// the tutorial's walk to tutorial 3; a walk-through that takes no arguments ignores them. Fails if
// any walk-through fails.

import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// This folder, where the walk-throughs are.
const BROWSER_TESTS = fileURLToPath(new URL(".", import.meta.url));

// Runs each walk-through in name order and sets the exit code: 1 if any failed.
function runWalks() {
  const walks = readdirSync(BROWSER_TESTS).filter((name) => name.endsWith(".walk.js")).sort();
  let failed = 0;
  for (const walk of walks) {
    console.log(`\n=== ${walk} ===`);
    const result = spawnSync(process.execPath, [resolve(BROWSER_TESTS, walk), ...process.argv.slice(2)], {
      stdio: "inherit",
    });
    if (result.status !== 0) {
      failed += 1;
    }
  }
  console.log(`\n${walks.length - failed} of ${walks.length} walk-throughs passed.`);
  process.exitCode = failed === 0 ? 0 : 1;
}

runWalks();
