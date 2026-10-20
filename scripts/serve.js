// serve.js — a small web server for trying the tools' pages in a browser during development.
// Browsers won't load ES modules from a page opened as a file (file://; see ADR 0002), so the
// project's files are served over http from this computer instead.
// Run it with: npm run serve   (stop it with Ctrl+C)
//
// It answers only requests from this computer (127.0.0.1), and serves only files inside the project.
// It uses only Node's built-in modules, so there is nothing to install.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The port the server listens on. If another program already uses it, the server says so and stops.
const PORT = 8000;

// 127.0.0.1 means "this computer only": other computers on the network can't reach the server.
const HOST = "127.0.0.1";

// The project's folder (the one above scripts/), without a separator at the end.
const PROJECT_FOLDER = resolve(fileURLToPath(new URL("..", import.meta.url)));

// The randomizer page's address within the project, printed when the server starts.
const RANDOMIZER_PAGE = "/src/tools/randomizer/randomizer.html";

// The content type sent for each kind of file, so the browser knows how to read it. Browsers only
// run a module if it's sent as JavaScript.
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

const server = createServer(answerRequest);
server.on("error", reportStartError);
server.listen(PORT, HOST, () => {
  console.log(`Serving ${PROJECT_FOLDER}`);
  console.log(`Randomizer page: http://localhost:${PORT}${RANDOMIZER_PAGE}`);
  console.log("Press Ctrl+C to stop.");
});

// Answers one request from the browser with the file it asks for, or "Not found".
// Files are sent with "no-store", so the browser always fetches the latest version after an edit.
async function answerRequest(request, response) {
  const filePath = filePathFor(request.url);
  if (filePath === null) {
    sendNotFound(response);
    return;
  }
  try {
    const contents = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypeOf(filePath), "Cache-Control": "no-store" });
    response.end(contents);
  } catch {
    // The file doesn't exist, or it's a folder.
    sendNotFound(response);
  }
}

// The file in the project that a request's address points to, or null if it points outside the
// project or can't be read, e.g. "/src/tools/randomizer/randomizer.html" → "C:\…\randomizer.html".
// Checking the result is inside the project stops addresses such as "/../secret.txt" reaching other
// files on the computer.
function filePathFor(url) {
  let path;
  try {
    // decodeURIComponent turns "%20" back into a space; it throws on badly encoded addresses.
    path = decodeURIComponent(new URL(url, "http://localhost").pathname);
  } catch {
    return null;
  }
  const filePath = resolve(PROJECT_FOLDER, `.${path}`);
  return filePath.startsWith(PROJECT_FOLDER + sep) ? filePath : null;
}

// The content type for a file, from its extension, e.g. "page.html" → "text/html; charset=utf-8".
// Unknown kinds are sent as plain bytes.
function contentTypeOf(filePath) {
  return CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
}

// Answers a request with "Not found" (status 404).
function sendNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

// Explains why the server couldn't start, e.g. because another program already uses the port.
function reportStartError(error) {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use, perhaps by another copy of this server. ` +
        "Stop that one (Ctrl+C in its window) and try again.",
    );
  } else {
    console.error(`The server couldn't start: ${error.message}`);
  }
  process.exitCode = 1;
}
