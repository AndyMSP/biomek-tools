// zip.js — turns a list of file names and their contents into the bytes of one zip file, so a tool
// can hand the user several files (such as a run's Biomek files) as a single download.
//
// It writes only the simplest kind of zip: every file is "stored" (kept exactly as it is, not
// compressed), with no Zip64 and only plain ASCII names, following PKWARE's APPNOTE.TXT. That keeps
// it short enough to read and check in full, with no dependency. It never reads the clock (the
// caller gives the date) and changes nothing it's given, so the same inputs always give the same
// bytes and a test can compare them with a golden file. It can refuse its inputs (section 5 of its
// specification); nothing is returned then.
// Specification: zip.md.

import { describeValue } from "../error-messages/error-messages.js";
import { isObject, findMissingProperties, findExtraProperties } from "../input-checks/input-checks.js";

// The properties an entry has, and no others.
const ENTRY_PROPERTIES = ["name", "text"];

// The character that separates folders in a name inside a zip.
const FOLDER_SEPARATOR = "/";

// The printable ASCII characters: space (code 32) to tilde (code 126). Anything else in a name is
// refused. (Inside [...], ^ means "not one of these"; \x20 and \x7E are the codes in hexadecimal.)
const OUTSIDE_PRINTABLE_ASCII = /[^\x20-\x7E]/;

// The years a zip's MS-DOS date can hold: 7 bits counted from 1980.
const FIRST_YEAR = 1980;
const LAST_YEAR = FIRST_YEAR + 127;

// The signatures (fixed first bytes) of the zip format's three kinds of record, as the 32-bit
// numbers they are when read little-endian: "PK" then 03 04, 01 02, and 05 06.
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_RECORD_SIGNATURE = 0x02014b50;
const END_RECORD_SIGNATURE = 0x06054b50;

// The fixed parts' sizes, in bytes, before the name (and, for a local header, the file's bytes).
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_RECORD_SIZE = 46;
const END_RECORD_SIZE = 22;

// Version 2.0 of the format, as the zip format writes it (tens of a version: 20), is all a stored
// zip needs. It's written both as "version needed to extract" and as "version made by".
const FORMAT_VERSION = 20;

// Compression method 0: stored (not compressed).
const METHOD_STORED = 0;

// The external file attributes: the MS-DOS "directory" flag for a folder, nothing for a file.
const FOLDER_ATTRIBUTES = 0x10;
const FILE_ATTRIBUTES = 0;

// Turns text into its UTF-8 bytes. One encoder serves every call.
const utf8 = new TextEncoder();

// --- The interface ---

// The bytes of a zip holding `entries` (a list of { name, text }, each a file's path inside the zip
// and its contents), every entry dated `date` (a Date, in local time), as a Uint8Array. The zip
// holds a folder entry for every folder the names use, once each, in the order they first appear,
// then one entry per file in the order given. Checks the list, then each entry in order (its form,
// then its name), then the names against each other, then the date, and throws at the first
// problem.
// e.g. zipFiles([{ name: "Run/Setup.csv", text: "a\r\n" }], new Date(2026, 9, 28, 1, 57, 32))
//      → the bytes of a zip with two entries, the folder "Run/" and the file.
export function zipFiles(entries, date) {
  checkEntries(entries);
  checkDate(date);
  const time = dosTimeOf(date);
  const day = dosDateOf(date);
  const items = [...folderItemsFor(entries), ...entries.map(fileItem)];

  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const item of items) {
    const local = localHeaderAndContents(item, time, day);
    centralParts.push(centralRecord(item, time, day, offset));
    localParts.push(local);
    offset += local.length;
  }
  const centralDirectory = concatenate(centralParts);
  const end = endRecord(items.length, centralDirectory.length, offset);
  return concatenate([...localParts, centralDirectory, end]);
}

// The CRC-32 of `bytes` (a Uint8Array): the checksum zip, PNG and Ethernet use, as a whole number
// from 0 to 4,294,967,295. It's the "reflected" CRC with polynomial 0xEDB88320, starting from all
// ones and inverted at the end,
// e.g. crc32(new TextEncoder().encode("123456789")) → 0xCBF43926.
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    // Each byte updates the running value through the table: look up the low byte of (crc XOR
    // byte), then shift the rest down 8 bits. >>> 0 keeps the number unsigned.
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --- Checks ---

// Throws if `entries` isn't a list of valid entries: each an object with exactly a name and a
// text, both text, the name following the rules of the specification's section 3, and no two
// alike. Entries are numbered from 1 in messages. Exported so folder-writer checks the entries it
// writes by the same rules, with the same messages (zip.md, section 4); zipFiles uses it too,
// e.g. checkEntries([{ name: "Run/Setup.csv", text: "" }]) → nothing (it passes).
export function checkEntries(entries) {
  if (!Array.isArray(entries)) {
    throw new Error(
      `The entries to zip must be a list of { name, text }, but got ${describeValue(entries)}.`,
    );
  }
  entries.forEach((entry, index) => checkEntry(entry, index + 1));
  checkNamesDiffer(entries);
}

// Throws if `entry`, the `number`th entry, isn't an object with exactly a name and a text, both
// text, or if its name breaks a rule.
function checkEntry(entry, number) {
  if (
    !isObject(entry) ||
    findMissingProperties(entry, ENTRY_PROPERTIES).length > 0 ||
    findExtraProperties(entry, ENTRY_PROPERTIES).length > 0
  ) {
    throw new Error(
      `Entry ${number} to zip must be an object with a name and a text, but got ${describeValue(entry)}.`,
    );
  }
  if (typeof entry.name !== "string") {
    throw new Error(`Entry ${number}'s name must be text, but got ${describeValue(entry.name)}.`);
  }
  if (typeof entry.text !== "string") {
    throw new Error(`Entry ${number}'s text must be text, but got ${describeValue(entry.text)}.`);
  }
  checkName(entry.name, number);
}

// Throws if `name`, the `number`th entry's name, breaks a rule of section 3: a character outside
// printable ASCII, a "/" at the start or end, an empty folder name, a part named "." or "..", or a
// backslash. Checked in that order; each rule has its own message.
function checkName(name, number) {
  const shown = `Entry ${number}'s name, ${describeValue(name)},`;
  const outside = name.match(OUTSIDE_PRINTABLE_ASCII);
  if (outside !== null) {
    throw new Error(
      `${shown} can't contain ${describeValue(outside[0])}: ` +
        "use only printable ASCII characters (letters, digits and common punctuation).",
    );
  }
  if (name.startsWith(FOLDER_SEPARATOR) || name.endsWith(FOLDER_SEPARATOR)) {
    throw new Error(
      `${shown} can't start or end with "/": give the file's path inside the zip, like "Run/Setup.csv".`,
    );
  }
  const parts = name.split(FOLDER_SEPARATOR);
  if (parts.includes("")) {
    throw new Error(
      `${shown} has an empty folder name: put one "/" between folders, and give every folder and file a name.`,
    );
  }
  const dots = parts.find((part) => part === "." || part === "..");
  if (dots !== undefined) {
    throw new Error(
      `${shown} can't have a folder or file named ${describeValue(dots)}: name every folder and file plainly.`,
    );
  }
  if (name.includes("\\")) {
    throw new Error(`${shown} can't contain a backslash: separate folders with "/".`);
  }
}

// Throws if two of `entries` share a name, naming both by their numbers (from 1): the first entry
// with the name and the first later one that repeats it.
function checkNamesDiffer(entries) {
  // Maps each name to the number of the first entry with it.
  const firstNumberOf = new Map();
  entries.forEach((entry, index) => {
    const number = index + 1;
    if (firstNumberOf.has(entry.name)) {
      throw new Error(
        `Entries ${firstNumberOf.get(entry.name)} and ${number} are both named ` +
          `${describeValue(entry.name)}: each file in a zip needs its own name.`,
      );
    }
    firstNumberOf.set(entry.name, number);
  });
}

// Throws if `date` isn't a Date holding a real moment, then if its year is outside the years a zip
// can hold. A Date made from text it can't read, such as new Date("x"), is a Date whose time is
// NaN ("not a number"), so both are checked.
function checkDate(date) {
  if (!isDate(date) || Number.isNaN(date.getTime())) {
    throw new Error(`The date to zip with must be a valid date, but got ${describeValue(date)}.`);
  }
  const year = date.getFullYear();
  if (year < FIRST_YEAR || year > LAST_YEAR) {
    throw new Error(
      `A zip can only hold dates from ${FIRST_YEAR} to ${LAST_YEAR}, but got ${year}.`,
    );
  }
}

// True if `value` is a Date, whichever JavaScript context made it. `value instanceof Date` would
// be false for a Date from another context, such as the REPL's (Node's REPL runs typed code in a
// context of its own, with its own Date). Object.prototype.toString names a value's built-in kind
// the same way everywhere, e.g. "[object Date]".
function isDate(value) {
  return Object.prototype.toString.call(value) === "[object Date]";
}

// --- The entries ---

// An item is one entry of the zip as it's written: { name, bytes, isFolder }, the name as the zip
// stores it (a folder's ends in "/") and the bytes to store (none for a folder).

// The folder items for every folder named in `entries`' names, each once, in the order the folders
// first appear, e.g. names "a/b/x.csv" and "a/y.csv" → folders "a/", "a/b/".
function folderItemsFor(entries) {
  const folders = [];
  for (const { name } of entries) {
    const parts = name.split(FOLDER_SEPARATOR);
    // Every prefix of the path but the last part (the file) is a folder.
    for (let depth = 1; depth < parts.length; depth++) {
      const folder = parts.slice(0, depth).join(FOLDER_SEPARATOR) + FOLDER_SEPARATOR;
      if (!folders.includes(folder)) {
        folders.push(folder);
      }
    }
  }
  return folders.map((name) => ({ name, bytes: new Uint8Array(0), isFolder: true }));
}

// The item for a file entry: its name and its text as UTF-8 bytes.
function fileItem(entry) {
  return { name: entry.name, bytes: utf8.encode(entry.text), isFolder: false };
}

// --- The format ---
// All numbers are little-endian (lowest byte first). A ByteWriter fills a Uint8Array in order.

// The local file header for `item`, followed by its name and its bytes.
function localHeaderAndContents(item, time, day) {
  const name = utf8.encode(item.name);
  const writer = new ByteWriter(LOCAL_HEADER_SIZE + name.length + item.bytes.length);
  writer.uint32(LOCAL_HEADER_SIGNATURE);
  writer.uint16(FORMAT_VERSION); // version needed to extract
  writer.uint16(0); // general purpose flags
  writer.uint16(METHOD_STORED);
  writer.uint16(time);
  writer.uint16(day);
  writer.uint32(crc32(item.bytes));
  writer.uint32(item.bytes.length); // compressed size
  writer.uint32(item.bytes.length); // uncompressed size: the same when stored
  writer.uint16(name.length);
  writer.uint16(0); // extra field length
  writer.bytes(name);
  writer.bytes(item.bytes);
  return writer.result();
}

// The central directory record for `item`, whose local header starts `offset` bytes into the zip,
// followed by its name.
function centralRecord(item, time, day, offset) {
  const name = utf8.encode(item.name);
  const writer = new ByteWriter(CENTRAL_RECORD_SIZE + name.length);
  writer.uint32(CENTRAL_RECORD_SIGNATURE);
  writer.uint16(FORMAT_VERSION); // version made by
  writer.uint16(FORMAT_VERSION); // version needed to extract
  writer.uint16(0); // general purpose flags
  writer.uint16(METHOD_STORED);
  writer.uint16(time);
  writer.uint16(day);
  writer.uint32(crc32(item.bytes));
  writer.uint32(item.bytes.length); // compressed size
  writer.uint32(item.bytes.length); // uncompressed size
  writer.uint16(name.length);
  writer.uint16(0); // extra field length
  writer.uint16(0); // file comment length
  writer.uint16(0); // disk number where the entry starts
  writer.uint16(0); // internal file attributes
  writer.uint32(item.isFolder ? FOLDER_ATTRIBUTES : FILE_ATTRIBUTES);
  writer.uint32(offset);
  writer.bytes(name);
  return writer.result();
}

// The end of central directory record: the zip's last 22 bytes, saying how many entries there are
// and where the central directory is.
function endRecord(entryCount, centralDirectorySize, centralDirectoryOffset) {
  const writer = new ByteWriter(END_RECORD_SIZE);
  writer.uint32(END_RECORD_SIGNATURE);
  writer.uint16(0); // this disk's number
  writer.uint16(0); // the disk the central directory starts on
  writer.uint16(entryCount); // entries on this disk
  writer.uint16(entryCount); // entries in all
  writer.uint32(centralDirectorySize);
  writer.uint32(centralDirectoryOffset);
  writer.uint16(0); // comment length
  return writer.result();
}

// The time of `date` in MS-DOS format: hours × 2048 + minutes × 32 + seconds ÷ 2, rounded down,
// since zip keeps times to 2 seconds, e.g. 01:57:32 → 0x0F30 (3888).
function dosTimeOf(date) {
  return date.getHours() * 2048 + date.getMinutes() * 32 + Math.floor(date.getSeconds() / 2);
}

// The date of `date` in MS-DOS format: (year − 1980) × 512 + month × 32 + day, months counted from
// 1, e.g. 2026-10-28 → 0x5D5C (23900). JavaScript counts months from 0, so 1 is added.
function dosDateOf(date) {
  return (date.getFullYear() - FIRST_YEAR) * 512 + (date.getMonth() + 1) * 32 + date.getDate();
}

// Fills a Uint8Array of a known size from the start, one little-endian number or run of bytes at a
// time. A DataView is JavaScript's way to write numbers of a given size into bytes; `true` on its
// set methods means little-endian.
class ByteWriter {
  // A writer for `size` bytes, all 0 until written.
  constructor(size) {
    this.array = new Uint8Array(size);
    this.view = new DataView(this.array.buffer);
    this.position = 0;
  }

  // Writes `value` as 2 bytes and moves on.
  uint16(value) {
    this.view.setUint16(this.position, value, true);
    this.position += 2;
  }

  // Writes `value` as 4 bytes and moves on.
  uint32(value) {
    this.view.setUint32(this.position, value, true);
    this.position += 4;
  }

  // Copies `bytes` (a Uint8Array) in and moves on.
  bytes(bytes) {
    this.array.set(bytes, this.position);
    this.position += bytes.length;
  }

  // The filled array.
  result() {
    return this.array;
  }
}

// One Uint8Array holding `arrays` (a list of Uint8Arrays) one after another.
function concatenate(arrays) {
  const total = arrays.reduce((sum, array) => sum + array.length, 0);
  const result = new Uint8Array(total);
  let position = 0;
  for (const array of arrays) {
    result.set(array, position);
    position += array.length;
  }
  return result;
}

// --- CRC-32 ---

// The CRC-32 lookup table: for each possible byte, the value it contributes, worked out once when
// the module loads. Each entry is the byte run through 8 steps of the reflected polynomial
// 0xEDB88320: shift right one bit, and XOR with the polynomial when the bit shifted out was 1.
const CRC_TABLE = buildCrcTable();

// Builds CRC_TABLE (above).
function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let byte = 0; byte < 256; byte++) {
    let value = byte;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[byte] = value >>> 0;
  }
  return table;
}
