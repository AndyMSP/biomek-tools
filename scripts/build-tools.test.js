// Unit tests for build-tools.js. Each test comes from the "Test cases" section of build-tools.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILD_ENTRIES, isBuildOf, tutorialHtml } from "./build-tools.js";

// src/tools/, which BUILD_ENTRIES' paths are relative to.
const TOOLS_FOLDER = resolve(fileURLToPath(new URL("../src/tools/", import.meta.url)));

// The real transfer designer HTML, which the tutorial is built from.
const DESIGNER_HTML = readFileSync(resolve(TOOLS_FOLDER, "transfer-designer/transfer-designer.html"), "utf8");

describe("build-tools", () => {
  test("BUILD_ENTRIES names randomizer, transfer-designer and transfer-designer-tutorial, in order", () => {
    assert.deepEqual(
      BUILD_ENTRIES.map((entry) => entry.name),
      ["randomizer", "transfer-designer", "transfer-designer-tutorial"],
    );
  });

  test("every file BUILD_ENTRIES names exists", () => {
    for (const entry of BUILD_ENTRIES) {
      for (const path of [entry.html, ...entry.css, entry.script]) {
        assert.ok(existsSync(resolve(TOOLS_FOLDER, path)), `${entry.name}: ${path} doesn't exist`);
      }
    }
  });

  test("the tutorial's entry is built from the transfer designer's page with tutorialHtml", () => {
    const tutorial = BUILD_ENTRIES[2];
    assert.equal(tutorial.html, "transfer-designer/transfer-designer.html");
    assert.deepEqual([...tutorial.css], ["transfer-designer/transfer-designer.css", "tutorial/tutorial.css"]);
    assert.equal(tutorial.script, "tutorial/tutorial-page.js");
    assert.equal(tutorial.stylesheetName, "transfer-designer.css");
    assert.equal(tutorial.scriptName, "transfer-designer-page.js");
    assert.equal(tutorial.changeHtml, tutorialHtml);
    assert.equal(BUILD_ENTRIES[0].changeHtml, null);
    assert.equal(BUILD_ENTRIES[1].changeHtml, null);
  });

  test("isBuildOf: builds of randomizer", () => {
    for (const fileName of ["randomizer.html", "randomizer-v0.1.0.html", "randomizer-v0.2.0-dev.488.html"]) {
      assert.equal(isBuildOf("randomizer", fileName), true, fileName);
    }
  });

  test("isBuildOf: the transfer designer and its tutorial aren't each other's builds", () => {
    assert.equal(isBuildOf("transfer-designer", "transfer-designer-v0.2.0.html"), true);
    assert.equal(isBuildOf("transfer-designer-tutorial", "transfer-designer-v0.2.0.html"), false);
    assert.equal(isBuildOf("transfer-designer-tutorial", "transfer-designer-tutorial-v0.2.0.html"), true);
    assert.equal(isBuildOf("transfer-designer", "transfer-designer-tutorial-v0.2.0.html"), false);
  });

  test("isBuildOf: notes.txt and randomizer-v1.css are builds of neither", () => {
    for (const name of ["randomizer", "transfer-designer"]) {
      assert.equal(isBuildOf(name, "notes.txt"), false);
      assert.equal(isBuildOf(name, "randomizer-v1.css"), false);
    }
  });

  test("tutorialHtml on the real page gives one data-tutorial and the tutorial's title", () => {
    const html = tutorialHtml(DESIGNER_HTML);
    assert.equal(html.split("data-tutorial").length - 1, 1);
    assert.ok(html.includes('<html lang="en" data-tutorial>'));
    assert.ok(html.includes("<title>Transfer Designer Tutorial</title>"));
    assert.ok(!html.includes("<title>Transfer Designer</title>"));
  });

  test("tutorialHtml throws when the title is missing or twice", () => {
    const withoutTitle = DESIGNER_HTML.replace("<title>Transfer Designer</title>", "");
    assert.throws(() => tutorialHtml(withoutTitle), {
      message: "The tutorial's page needs <title>Transfer Designer</title> exactly once, but found it 0 times.",
    });
    const twice = DESIGNER_HTML.replace("</head>", "<title>Transfer Designer</title></head>");
    assert.throws(() => tutorialHtml(twice), {
      message: "The tutorial's page needs <title>Transfer Designer</title> exactly once, but found it 2 times.",
    });
  });

  test("tutorialHtml throws when the html tag is missing or twice", () => {
    const withoutTag = DESIGNER_HTML.replace('<html lang="en">', "<html>");
    assert.throws(() => tutorialHtml(withoutTag), {
      message: `The tutorial's page needs <html lang="en"> exactly once, but found it 0 times.`,
    });
    const twice = DESIGNER_HTML.replace("<body>", '<body><!-- <html lang="en"> -->');
    assert.throws(() => tutorialHtml(twice), {
      message: `The tutorial's page needs <html lang="en"> exactly once, but found it 2 times.`,
    });
  });
});
