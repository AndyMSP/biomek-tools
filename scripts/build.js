// build.js — builds the files handed out to the lab: one self-contained HTML file per tool in dist/,
// which opens in Edge or Chrome with nothing installed (see ADR 0004).
// Run it with: npm run build   (run npm install once first, to get esbuild)
//
// Each file is named by the build's version, worked out from git by build-version.js (ADR 0015),
// e.g. dist/transfer-designer-v0.2.0-dev.488.html, and earlier builds of the tools are cleared out
// of dist/ first, so only the newest is there to send.
// For each file (BUILD_ENTRIES, build-tools.js), esbuild bundles the page script and every module it
// imports into one ordinary script, and single-file-html.js puts that script and the page's CSS
// inside the page's HTML. Since 2026-11-08 the files include the tutorial, built from the transfer
// designer's page with the guide panel over it (tutorial-page.md, section 3).

import { build } from "esbuild";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { singleFileHtml } from "./single-file-html.js";
import { buildVersion, fileNameFor, readGitFacts } from "./build-version.js";
import { BUILD_ENTRIES, isBuildOf } from "./build-tools.js";

// The project's folder (the one above scripts/).
const PROJECT_FOLDER = resolve(fileURLToPath(new URL("..", import.meta.url)));

// Where the built files go. dist/ is listed in .gitignore, so it is never committed.
const OUTPUT_FOLDER = resolve(PROJECT_FOLDER, "dist");

// The folder BUILD_ENTRIES' paths are relative to.
const TOOLS_FOLDER = resolve(PROJECT_FOLDER, "src", "tools");

// The version is worked out before anything is built, so a check that fails stops the build before
// any file is written or removed.
const version = workOutVersion();

await mkdir(OUTPUT_FOLDER, { recursive: true });
await clearEarlierBuilds();
for (const entry of BUILD_ENTRIES) {
  const outputFile = await buildEntry(entry);
  console.log(`Built ${outputFile}`);
}

// The build's version, { short, full }, from the repository's facts. If it can't be worked out,
// prints why and stops the build (build-version.md, section 5).
function workOutVersion() {
  try {
    return buildVersion(readGitFacts(PROJECT_FOLDER));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

// Removes every earlier build from dist/: files named <name>.html or <name>-v*.html for each entry
// of BUILD_ENTRIES. Other files in dist/ are left alone.
async function clearEarlierBuilds() {
  for (const fileName of await readdir(OUTPUT_FOLDER)) {
    if (BUILD_ENTRIES.some((entry) => isBuildOf(entry.name, fileName))) {
      await rm(resolve(OUTPUT_FOLDER, fileName));
    }
  }
}

// Builds one entry of BUILD_ENTRIES into dist/ under its versioned name and returns that file's
// path, e.g. for the randomizer's entry → ".../dist/randomizer-v0.2.0-dev.488.html". Its CSS files
// are joined in order with a blank line, and its changeHtml, if any, is applied to the HTML first.
async function buildEntry(entry) {
  const rawHtml = await readFile(resolve(TOOLS_FOLDER, entry.html), "utf8");
  const html = entry.changeHtml === null ? rawHtml : entry.changeHtml(rawHtml);
  const cssParts = await Promise.all(entry.css.map((path) => readFile(resolve(TOOLS_FOLDER, path), "utf8")));
  const script = await bundleScript(resolve(TOOLS_FOLDER, entry.script));

  const page = singleFileHtml({
    html,
    css: cssParts.join("\n\n"),
    script,
    stylesheetName: entry.stylesheetName,
    scriptName: entry.scriptName,
  });
  const outputFile = resolve(OUTPUT_FOLDER, fileNameFor(entry.name, version));
  await writeFile(outputFile, page, "utf8");
  return outputFile;
}

// Bundles a page script and everything it imports into one script, returned as text.
// "iife" (immediately invoked function expression) wraps the code in a function that runs at once,
// so it works as an ordinary script and its names don't leak into the page.
// "define" replaces the name BUILD_VERSION in the page scripts with the build's full version, as a
// text constant, so the page can show it (build-version.md, section 3).
async function bundleScript(entryFile) {
  const result = await build({
    entryPoints: [entryFile],
    bundle: true,
    format: "iife",
    write: false,
    logLevel: "warning",
    define: { BUILD_VERSION: JSON.stringify(version.full) },
  });
  return result.outputFiles[0].text;
}
