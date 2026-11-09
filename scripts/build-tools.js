// build-tools.js — the pure parts of the build (build.js), kept apart so they can be unit-tested in
// Node: the list of files the build makes, which files in dist/ are earlier builds, and the
// tutorial's HTML. build.js keeps reading and writing files and bundling (ADR 0004).
// Specification: build-tools.md.

// One entry per file the build makes, in order (build-tools.md, section 2). Paths are relative to
// src/tools/. `css` is a list, joined in order with a blank line; `changeHtml` is applied to the
// HTML before singleFileHtml, or null for none.
// The tutorial is the transfer designer's own page, built with the guide panel over it
// (tutorial-page.md, section 3), so it takes the transfer designer's HTML and stylesheet, and its
// stylesheet and script names are the ones that HTML links.
export const BUILD_ENTRIES = Object.freeze([
  toolEntry("randomizer"),
  toolEntry("transfer-designer"),
  Object.freeze({
    name: "transfer-designer-tutorial",
    html: "transfer-designer/transfer-designer.html",
    css: Object.freeze(["transfer-designer/transfer-designer.css", "tutorial/tutorial.css"]),
    script: "tutorial/tutorial-page.js",
    stylesheetName: "transfer-designer.css",
    scriptName: "transfer-designer-page.js",
    changeHtml: tutorialHtml,
  }),
]);

// The entry for a tool built from its own folder's <name>.html, <name>.css and <name>-page.js, with
// no change to its HTML, e.g. toolEntry("randomizer").html → "randomizer/randomizer.html".
function toolEntry(name) {
  return Object.freeze({
    name,
    html: `${name}/${name}.html`,
    css: Object.freeze([`${name}/${name}.css`]),
    script: `${name}/${name}-page.js`,
    stylesheetName: `${name}.css`,
    scriptName: `${name}-page.js`,
    changeHtml: null,
  });
}

// True if a file name is a build of the tool called `name`: `<name>.html`, or starting `<name>-v`
// and ending `.html`, e.g. isBuildOf("randomizer", "randomizer-v0.1.0.html") → true, and
// isBuildOf("transfer-designer", "transfer-designer-tutorial-v0.2.0.html") → false.
export function isBuildOf(name, fileName) {
  return fileName === `${name}.html` || (fileName.startsWith(`${name}-v`) && fileName.endsWith(".html"));
}

// The texts tutorialHtml replaces, each with what replaces it.
const TUTORIAL_CHANGES = [
  ["<title>Transfer Designer</title>", "<title>Transfer Designer Tutorial</title>"],
  ['<html lang="en">', '<html lang="en" data-tutorial>'],
];

// The transfer designer's HTML made into the tutorial's: its title becomes "Transfer Designer
// Tutorial", and its <html> tag gets the data-tutorial attribute, by which the page knows it's the
// tutorial (transfer-designer-page.md, section 17). Throws, naming the text, if either text isn't
// there exactly once, e.g. 'The tutorial's page needs <title>Transfer Designer</title> exactly once,
// but found it 0 times.'
export function tutorialHtml(html) {
  let changed = html;
  for (const [text, replacement] of TUTORIAL_CHANGES) {
    const count = changed.split(text).length - 1;
    if (count !== 1) {
      throw new Error(
        `The tutorial's page needs ${text} exactly once, but found it ${count} ${count === 1 ? "time" : "times"}.`,
      );
    }
    // A function as the replacement, so "$" in the text is copied as it is.
    changed = changed.replace(text, () => replacement);
  }
  return changed;
}
