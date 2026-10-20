// single-file-html.js — puts a page's stylesheet and script inside its HTML, so the page is one
// self-contained file (see ADR 0004). It only joins text; reading files and bundling happen in
// build.js, so this part can be unit-tested in Node.

// Puts the CSS and script inside the page's HTML and returns the new HTML. The page must link its
// stylesheet and load its script with exactly these tags (as each tool's .html file does):
//   <link rel="stylesheet" href="<stylesheetName>" />
//   <script type="module" src="<scriptName>"></script>
// The link becomes a <style> element in the same place. The script tag is removed and the script goes
// at the end of the body, as an ordinary script, because a bundled script isn't a module and needs the
// page's elements to exist before it runs.
// e.g. singleFileHtml({ html, css: "h1 { color: red }", script: "…", stylesheetName: "page.css",
//      scriptName: "page.js" })
export function singleFileHtml({ html, css, script, stylesheetName, scriptName }) {
  const linkTag = `<link rel="stylesheet" href="${stylesheetName}" />`;
  const scriptTag = `<script type="module" src="${scriptName}"></script>`;
  checkContainsOnce(html, linkTag);
  checkContainsOnce(html, scriptTag);
  checkContainsOnce(html, "</body>");

  // Functions are used as replacements so that "$" in the CSS or script is copied as it is
  // (in a replacement string, "$&" and similar have special meanings).
  return html
    .replace(linkTag, () => `<style>\n${css}\n</style>`)
    .replace(scriptTag, () => "")
    .replace("</body>", () => `<script>\n${escapeScriptEnd(script)}\n</script>\n</body>`);
}

// Stops text inside a <script> element from ending it early. The browser ends a script at the first
// "</script" it sees, even inside a JavaScript string, so "<\/script" is written instead; JavaScript
// reads "\/" as "/", so the string's value doesn't change.
// e.g. escapeScriptEnd('x = "</script>"') → 'x = "<\/script>"'
function escapeScriptEnd(script) {
  return script.replace(/<\/script/gi, "<\\/script");
}

// Throws unless the HTML contains the text exactly once, so a page that doesn't match the expected
// form is reported instead of being built into a broken file.
// e.g. checkContainsOnce("<body></body>", "</body>") passes.
function checkContainsOnce(html, text) {
  const count = html.split(text).length - 1;
  if (count !== 1) {
    throw new Error(
      `The page's HTML must contain ${text} exactly once, but it contains it ${count} times. ` +
        "Check the tag in the tool's .html file matches this exactly.",
    );
  }
}
