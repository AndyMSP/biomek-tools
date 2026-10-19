// build.js — builds each tool into one self-contained HTML file in dist/, so it opens in Edge or
// Chrome on a lab PC with nothing installed. Run it with: npm run build
//
// Browsers won't load separate module files from a page opened straight from disk (file://), so
// the tool's modules are joined into a single inline script. No bundler is needed for our code:
// each module is wrapped in a function, its exports are returned, and its imports become reads
// from the modules already built. This relies on the project's import/export style:
//   import { A, B } from "./path.js";   and   export class|const|function Name

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The tools to build: the page's HTML, its entry script, and the output file.
const TOOLS = [
  {
    html: "src/tools/randomizer/randomizer.html",
    entry: "src/tools/randomizer/page.js",
    output: "dist/randomizer.html",
  },
];

const IMPORT_PATTERN = /^import\s*\{([^}]*)\}\s*from\s*"([^"]+)";\s*$/gm;
const EXPORT_PATTERN = /^export\s+(?:class|const|function)\s+([A-Za-z_$][\w$]*)/gm;

// Returns every module the entry needs, dependencies first, as absolute paths,
// e.g. [".../error-messages.js", ".../well-grid.js", …, ".../page.js"].
function modulesInOrder(entry) {
  const ordered = [];
  const visit = (file) => {
    if (ordered.includes(file)) {
      return;
    }
    for (const [, , path] of readFileSync(file, "utf8").matchAll(IMPORT_PATTERN)) {
      visit(resolve(dirname(file), path));
    }
    ordered.push(file);
  };
  visit(entry);
  return ordered;
}

// Turns one module into a function that runs it and returns its exports, stored by its path.
function wrapModule(file) {
  const source = readFileSync(file, "utf8");
  const exportNames = [...source.matchAll(EXPORT_PATTERN)].map((match) => match[1]);
  const body = source
    .replace(IMPORT_PATTERN, (_, names, path) => {
      const key = relative(ROOT, resolve(dirname(file), path));
      return `const {${names}} = modules[${JSON.stringify(key)}];`;
    })
    .replace(/^export\s+(class|const|function)/gm, "$1");
  const key = relative(ROOT, file);
  return `modules[${JSON.stringify(key)}] = (() => {\n${body}\nreturn { ${exportNames.join(", ")} };\n})();`;
}

// Builds one tool into its output file.
function buildTool({ html, entry, output }) {
  const script = modulesInOrder(resolve(ROOT, entry)).map(wrapModule).join("\n\n");
  const bundle = `<script>\n"use strict";\nconst modules = {};\n${script}\n</script>`;
  const page = readFileSync(resolve(ROOT, html), "utf8");
  const tag = '<script type="module" src="page.js"></script>';
  if (!page.includes(tag)) {
    throw new Error(`${html} must load its script with ${tag}`);
  }
  mkdirSync(resolve(ROOT, dirname(output)), { recursive: true });
  writeFileSync(resolve(ROOT, output), page.replace(tag, () => bundle));
  console.log(`Built ${output}`);
}

TOOLS.forEach(buildTool);
