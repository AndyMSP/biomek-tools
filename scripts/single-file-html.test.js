// Unit tests for single-file-html.js.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { singleFileHtml } from "./single-file-html.js";

// A small page in the same form as each tool's .html file.
const PAGE = [
  "<head>",
  '<link rel="stylesheet" href="page.css" />',
  '<script type="module" src="page.js"></script>',
  "</head>",
  "<body><h1>Test page</h1></body>",
].join("\n");

// Builds the test page with the given CSS and script.
function build(css, script) {
  return singleFileHtml({ html: PAGE, css, script, stylesheetName: "page.css", scriptName: "page.js" });
}

describe("single-file-html", () => {
  test("the CSS replaces the stylesheet link and the script goes at the end of the body", () => {
    assert.equal(
      build("h1 { color: red }", "run();"),
      [
        "<head>",
        "<style>\nh1 { color: red }\n</style>",
        "",
        "</head>",
        "<body><h1>Test page</h1><script>\nrun();\n</script>\n</body>",
      ].join("\n"),
    );
  });

  test("</script inside the script is escaped so it doesn't end the element", () => {
    const result = build("", 'const tag = "</script>";');
    assert.ok(result.includes('const tag = "<\\/script>";'));
  });

  test("$ in the CSS or script is copied as it is", () => {
    const result = build("a::after { content: '$&' }", "const price = '$1';");
    assert.ok(result.includes("a::after { content: '$&' }"));
    assert.ok(result.includes("const price = '$1';"));
  });

  test("a page without the expected stylesheet link throws", () => {
    assert.throws(
      () => singleFileHtml({ html: PAGE, css: "", script: "", stylesheetName: "other.css", scriptName: "page.js" }),
      {
        message:
          'The page\'s HTML must contain <link rel="stylesheet" href="other.css" /> exactly once, ' +
          "but it contains it 0 times. Check the tag in the tool's .html file matches this exactly.",
      },
    );
  });

  test("a page without the expected script tag throws", () => {
    assert.throws(
      () => singleFileHtml({ html: PAGE, css: "", script: "", stylesheetName: "page.css", scriptName: "other.js" }),
      /<script type="module" src="other.js"><\/script> exactly once, but it contains it 0 times/,
    );
  });
});
