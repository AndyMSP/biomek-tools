// build.js — builds the files handed out to the lab: one self-contained HTML file per tool in dist/,
// which opens in Edge or Chrome with nothing installed (see ADR 0004).
// Run it with: npm run build   (run npm install once first, to get esbuild)
//
// Each file is named by the build's version, worked out from git by build-version.js (ADR 0015),
// e.g. dist/transfer-designer-v0.2.0-dev.488.html, and earlier builds of the tools are cleared out
// of dist/ first, so only the newest is there to send.
// For each tool, esbuild bundles the page script and every module it imports into one ordinary script,
// and single-file-html.js puts that script and the page's CSS inside the page's HTML.

import { build } from "esbuild";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { singleFileHtml } from "./single-file-html.js";
import { buildVersion, fileNameFor, readGitFacts } from "./build-version.js";

// The project's folder (the one above scripts/).
const PROJECT_FOLDER = resolve(fileURLToPath(new URL("..", import.meta.url)));

// Where the built files go. dist/ is listed in .gitignore, so it is never committed.
const OUTPUT_FOLDER = resolve(PROJECT_FOLDER, "dist");

// The tools to build. Each tool's folder, src/tools/<name>/, holds <name>.html, <name>.css and
// <name>-page.js. A new tool is built by adding its name here.
const TOOLS = ["randomizer", "transfer-designer"];

// The version is worked out before anything is built, so a check that fails stops the build before
// any file is written or removed.
const version = workOutVersion();

await mkdir(OUTPUT_FOLDER, { recursive: true });
await clearEarlierBuilds();
for (const tool of TOOLS) {
  const outputFile = await buildTool(tool);
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

// Removes every earlier build of the tools from dist/: files named <tool>.html or <tool>-v*.html.
// Other files in dist/ are left alone.
async function clearEarlierBuilds() {
  for (const fileName of await readdir(OUTPUT_FOLDER)) {
    if (TOOLS.some((tool) => isBuildOf(tool, fileName))) {
      await rm(resolve(OUTPUT_FOLDER, fileName));
    }
  }
}

// True if a file name is a build of the tool, e.g. isBuildOf("randomizer", "randomizer-v0.1.0.html").
function isBuildOf(tool, fileName) {
  return (
    fileName === `${tool}.html` ||
    (fileName.startsWith(`${tool}-v`) && fileName.endsWith(".html"))
  );
}

// Builds one tool into dist/ under its versioned name and returns that file's path,
// e.g. buildTool("randomizer") → ".../dist/randomizer-v0.2.0-dev.488.html".
async function buildTool(tool) {
  const toolFolder = resolve(PROJECT_FOLDER, "src", "tools", tool);
  const html = await readFile(resolve(toolFolder, `${tool}.html`), "utf8");
  const css = await readFile(resolve(toolFolder, `${tool}.css`), "utf8");
  const script = await bundleScript(resolve(toolFolder, `${tool}-page.js`));

  const page = singleFileHtml({
    html,
    css,
    script,
    stylesheetName: `${tool}.css`,
    scriptName: `${tool}-page.js`,
  });
  const outputFile = resolve(OUTPUT_FOLDER, fileNameFor(tool, version));
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
