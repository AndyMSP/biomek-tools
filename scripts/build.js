// build.js — builds the files handed out to the lab: one self-contained HTML file per tool in dist/,
// which opens in Edge or Chrome with nothing installed (see ADR 0004).
// Run it with: npm run build   (run npm install once first, to get esbuild)
//
// For each tool, esbuild bundles the page script and every module it imports into one ordinary script,
// and single-file-html.js puts that script and the page's CSS inside the page's HTML.

import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { singleFileHtml } from "./single-file-html.js";

// The project's folder (the one above scripts/).
const PROJECT_FOLDER = resolve(fileURLToPath(new URL("..", import.meta.url)));

// Where the built files go. dist/ is listed in .gitignore, so it is never committed.
const OUTPUT_FOLDER = resolve(PROJECT_FOLDER, "dist");

// The tools to build. Each tool's folder, src/tools/<name>/, holds <name>.html, <name>.css and
// <name>-page.js. A new tool is built by adding its name here.
const TOOLS = ["randomizer", "transfer-designer"];

await mkdir(OUTPUT_FOLDER, { recursive: true });
for (const tool of TOOLS) {
  const outputFile = await buildTool(tool);
  console.log(`Built ${outputFile}`);
}

// Builds one tool into dist/<tool>.html and returns that file's path,
// e.g. buildTool("randomizer") → ".../dist/randomizer.html".
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
  const outputFile = resolve(OUTPUT_FOLDER, `${tool}.html`);
  await writeFile(outputFile, page, "utf8");
  return outputFile;
}

// Bundles a page script and everything it imports into one script, returned as text.
// "iife" (immediately invoked function expression) wraps the code in a function that runs at once,
// so it works as an ordinary script and its names don't leak into the page.
async function bundleScript(entryFile) {
  const result = await build({
    entryPoints: [entryFile],
    bundle: true,
    format: "iife",
    write: false,
    logLevel: "warning",
  });
  return result.outputFiles[0].text;
}
