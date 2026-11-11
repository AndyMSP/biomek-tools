// folder-writer.js — writes a list of files into a folder the user picked in the browser, as an
// alternative to a zip the user unzips themselves.
//
// It takes the same entries as zip (a list of { name, text }) and checks them with zip's own
// check, so a caller can offer a folder and a zip from one list and they can't drift apart: the
// folder holds byte for byte what unzipping the zip gives. It does no picking: the caller asks the
// browser for the folder and passes in the folder object it gets (a FileSystemDirectoryHandle, or
// anything with the same parts), so this module uses no page or browser window and its tests run
// in Node with a stand-in folder (tests/fixtures/memory-folder.js).
//
// It only ever writes into a new folder: if anything it would make at the top level is already
// there, it writes nothing, and it never overwrites or deletes. If writing stops part-way, what was
// written stays, and the caller is told how far it got.
// Specification: folder-writer.md.

import { describeValue } from "../error-messages/error-messages.js";
import { checkEntries } from "../zip/zip.js";

// The character that separates folders in an entry's name, as in zip.
const FOLDER_SEPARATOR = "/";

// The character that separates folders in a Windows path.
const WINDOWS_SEPARATOR = "\\";

// --- The interface ---

// The last folder name in a Windows folder path, ignoring a backslash at the end. Throws if the
// path holds no folder name after its drive,
// e.g. lastFolderName("C:\\Users\\Beckman Coulter\\Desktop\\Ento\\") → "Ento",
//      lastFolderName("C:\\Ento") → "Ento", lastFolderName("C:\\") throws.
export function lastFolderName(path) {
  if (typeof path === "string") {
    const trimmed = path.endsWith(WINDOWS_SEPARATOR) ? path.slice(0, -1) : path;
    const parts = trimmed.split(WINDOWS_SEPARATOR);
    // The first part is the drive (e.g. "C:"), so a folder name needs at least a second part.
    const last = parts.at(-1);
    if (parts.length >= 2 && last !== "") {
      return last;
    }
  }
  throw new Error(
    `lastFolderName needs a folder path ending in a folder name, and got ${describeValue(path)}.`,
  );
}

// Writes `entries` (a list of { name, text }, as zip takes them) into `folder` (a picked folder's
// object), if the folder is named exactly `expectedName` and holds nothing named as one of the
// entries' top-level names. Async. Throws, before looking at the folder, only if the entries are
// wrong. Otherwise returns what happened:
//   { how: "wrong-folder", name }  the folder's name isn't expectedName; nothing written;
//   { how: "exists", name }        the folder already holds `name`; nothing written;
//   { how: "written", count }      every file written; `count` files;
//   { how: "failed", error, count } a call to the folder failed; `count` files written before it.
// e.g. await writeIntoFolder(ento, [{ name: "Run1/Setup.csv", text: "a\r\n" }], "Ento")
//      → { how: "written", count: 1 }
export async function writeIntoFolder(folder, entries, expectedName) {
  checkEntriesToWrite(entries);
  if (folder.name !== expectedName) {
    return { how: "wrong-folder", name: folder.name };
  }
  let existing;
  try {
    existing = await firstExistingName(folder, topLevelNames(entries));
  } catch (error) {
    return { how: "failed", error, count: 0 };
  }
  if (existing !== null) {
    return { how: "exists", name: existing };
  }
  return writeEntries(folder, entries);
}

// --- Checks ---

// Throws if `entries` is an empty list (with this module's message), or if zip's check refuses
// them (with zip's messages, unchanged).
function checkEntriesToWrite(entries) {
  if (Array.isArray(entries) && entries.length === 0) {
    throw new Error("writeIntoFolder needs at least one entry to write, and got none.");
  }
  checkEntries(entries);
}

// The entries' top-level names: the first part of each name, each once, in the order they first
// appear, e.g. "Run1/Setup.csv" and "Run1/Records/Labware sheet.pdf" → ["Run1"].
function topLevelNames(entries) {
  const names = entries.map((entry) => entry.name.split(FOLDER_SEPARATOR)[0]);
  return [...new Set(names)];
}

// The first of `names` (in their order) that `folder` already holds, as a folder or a file, or
// null if it holds none of them. Async; rejects if the folder's keys() fails.
async function firstExistingName(folder, names) {
  const held = new Set();
  for await (const name of folder.keys()) {
    held.add(name);
  }
  return names.find((name) => held.has(name)) ?? null;
}

// --- Writing ---

// Writes each of `entries` into `folder`, in order, stopping at the first failure. Returns
// { how: "written", count } or { how: "failed", error, count } (see writeIntoFolder); never throws.
async function writeEntries(folder, entries) {
  let count = 0;
  try {
    for (const entry of entries) {
      await writeEntry(folder, entry);
      count += 1;
    }
  } catch (error) {
    return { how: "failed", error, count };
  }
  return { how: "written", count };
}

// Writes one entry into `folder`: each folder along its name's path, made inside the one before
// (or found, if an earlier entry made it), then the file, its text written and the file closed,
// e.g. "Run1/Records/Labware sheet.pdf" → the folders Run1 and Records, then the file.
async function writeEntry(folder, { name, text }) {
  const parts = name.split(FOLDER_SEPARATOR);
  const fileName = parts.pop();
  let current = folder;
  for (const folderName of parts) {
    current = await current.getDirectoryHandle(folderName, { create: true });
  }
  const file = await current.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  // A writable stream stores a string as UTF-8, as zip stores the text.
  await writable.write(text);
  await writable.close();
}
