// Unit tests for zip.js. Each test comes from the "Test cases" section of zip.md, and each row of
// its error table and each order of checks has one.
//
// To check the structure, the tests read a zip back the way a zip program does: from the end
// record at the very end, to the central directory it points at, to each entry's local header at
// the offset its record gives. That reader lives here, in the tests only: zip.md says the module
// doesn't read zips.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { zipFiles, crc32, checkEntries } from "./zip.js";

const utf8 = new TextEncoder();

// The date most tests zip with, and how the zip format stores it (zip.md, section 6).
const DATE = new Date(2026, 9, 28, 1, 57, 32);
const DOS_TIME = 0x0f30;
const DOS_DATE = 0x5d5c;

// The two files of the golden file (tests/fixtures/zip-two-files.md).
const TWO_FILES = [
  { name: "Run/Setup.csv", text: "a,b\r\n1,2\r\n" },
  { name: "Run/Stages.csv", text: "x\r\n" },
];

// Where the golden file is, worked out from this test file's own location (import.meta.url is this
// file's address), so the test passes whichever folder the tests are started from.
const GOLDEN_FILE = new URL("../../../tests/fixtures/zip-two-files.zip", import.meta.url);

// The signatures and fixed sizes of the format (zip.md, section 3).
const LOCAL_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const CENTRAL_SIGNATURE = [0x50, 0x4b, 0x01, 0x02];
const END_SIGNATURE = [0x50, 0x4b, 0x05, 0x06];
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_RECORD_SIZE = 46;
const END_RECORD_SIZE = 22;

// --- A reader for the tests ---

// The little-endian 16-bit number at `position` in `bytes`.
function uint16At(bytes, position) {
  return new DataView(bytes.buffer, bytes.byteOffset).getUint16(position, true);
}

// The little-endian 32-bit number at `position` in `bytes`.
function uint32At(bytes, position) {
  return new DataView(bytes.buffer, bytes.byteOffset).getUint32(position, true);
}

// The text of the `length` bytes at `position`.
function textAt(bytes, position, length) {
  return new TextDecoder().decode(bytes.subarray(position, position + length));
}

// The end record, read from the last 22 bytes of `bytes`.
function readEndRecord(bytes) {
  const start = bytes.length - END_RECORD_SIZE;
  return {
    signature: [...bytes.subarray(start, start + 4)],
    entryCountOnDisk: uint16At(bytes, start + 8),
    entryCount: uint16At(bytes, start + 10),
    centralDirectorySize: uint32At(bytes, start + 12),
    centralDirectoryOffset: uint32At(bytes, start + 16),
    commentLength: uint16At(bytes, start + 20),
  };
}

// The central directory's records, read from where the end record says it starts, each with its
// name and the fields the tests check.
function readCentralDirectory(bytes) {
  const end = readEndRecord(bytes);
  const records = [];
  let position = end.centralDirectoryOffset;
  for (let count = 0; count < end.entryCount; count++) {
    const nameLength = uint16At(bytes, position + 28);
    records.push({
      position,
      signature: [...bytes.subarray(position, position + 4)],
      versionMadeBy: uint16At(bytes, position + 4),
      versionNeeded: uint16At(bytes, position + 6),
      flags: uint16At(bytes, position + 8),
      method: uint16At(bytes, position + 10),
      time: uint16At(bytes, position + 12),
      date: uint16At(bytes, position + 14),
      crc: uint32At(bytes, position + 16),
      compressedSize: uint32At(bytes, position + 20),
      uncompressedSize: uint32At(bytes, position + 24),
      externalAttributes: uint32At(bytes, position + 38),
      localHeaderOffset: uint32At(bytes, position + 42),
      name: textAt(bytes, position + 46, nameLength),
    });
    position += CENTRAL_RECORD_SIZE + nameLength;
  }
  return records;
}

// The local header at `offset` in `bytes`, with its name and the file's bytes after it.
function readLocalEntry(bytes, offset) {
  const nameLength = uint16At(bytes, offset + 26);
  const extraLength = uint16At(bytes, offset + 28);
  const size = uint32At(bytes, offset + 18);
  const dataStart = offset + LOCAL_HEADER_SIZE + nameLength + extraLength;
  return {
    signature: [...bytes.subarray(offset, offset + 4)],
    versionNeeded: uint16At(bytes, offset + 4),
    flags: uint16At(bytes, offset + 6),
    method: uint16At(bytes, offset + 8),
    time: uint16At(bytes, offset + 10),
    date: uint16At(bytes, offset + 12),
    crc: uint32At(bytes, offset + 14),
    compressedSize: uint32At(bytes, offset + 18),
    uncompressedSize: uint32At(bytes, offset + 22),
    extraLength,
    name: textAt(bytes, offset + LOCAL_HEADER_SIZE, nameLength),
    data: bytes.subarray(dataStart, dataStart + size),
    end: dataStart + size,
  };
}

// Every entry of the zip, in central directory order, as { record, local }: its central record
// and the local entry the record points at.
function readEntries(bytes) {
  return readCentralDirectory(bytes).map((record) => ({
    record,
    local: readLocalEntry(bytes, record.localHeaderOffset),
  }));
}

describe("zip", () => {
  // --- CRC-32 ---

  test("crc32 of \"123456789\" is the well-known check value 0xCBF43926", () => {
    assert.equal(crc32(utf8.encode("123456789")), 0xcbf43926);
  });

  test("crc32 of no bytes is 0", () => {
    assert.equal(crc32(new Uint8Array(0)), 0);
  });

  test("crc32 of the single byte for \"a\" is 0xE8B7BE43", () => {
    assert.equal(crc32(utf8.encode("a")), 0xe8b7be43);
  });

  // --- The structure ---

  test("a zip of one file at the top level has one entry", () => {
    const bytes = zipFiles([{ name: "Setup.csv", text: "x" }], DATE);
    const entries = readEntries(bytes);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].record.name, "Setup.csv");
    assert.equal(entries[0].local.name, "Setup.csv");
  });

  test("a zip of two files in one folder has three entries, the folder first", () => {
    const entries = readEntries(zipFiles(TWO_FILES, DATE));
    assert.deepEqual(
      entries.map((entry) => entry.record.name),
      ["Run/", "Run/Setup.csv", "Run/Stages.csv"],
    );
  });

  test("every folder in a nested path gets one entry, in the order the folders first appear", () => {
    const entries = readEntries(
      zipFiles(
        [
          { name: "a/b/x.csv", text: "1" },
          { name: "c/y.csv", text: "2" },
          { name: "a/z.csv", text: "3" },
        ],
        DATE,
      ),
    );
    assert.deepEqual(
      entries.map((entry) => entry.record.name),
      ["a/", "a/b/", "c/", "a/b/x.csv", "c/y.csv", "a/z.csv"],
    );
  });

  test("each local header has the signature, version 20, flags 0, method 0, the sizes and CRC-32, then the name and bytes", () => {
    const bytes = zipFiles(TWO_FILES, DATE);
    for (const [index, { local }] of readEntries(bytes).entries()) {
      const expectedData = index === 0 ? new Uint8Array(0) : utf8.encode(TWO_FILES[index - 1].text);
      assert.deepEqual(local.signature, LOCAL_SIGNATURE);
      assert.equal(local.versionNeeded, 20);
      assert.equal(local.flags, 0);
      assert.equal(local.method, 0);
      assert.equal(local.compressedSize, expectedData.length);
      assert.equal(local.uncompressedSize, expectedData.length);
      assert.equal(local.crc, crc32(expectedData));
      assert.equal(local.extraLength, 0);
      assert.deepEqual(local.data, expectedData);
    }
  });

  test("the first local header starts at byte 0 and each entry's bytes are followed directly by the next entry", () => {
    const bytes = zipFiles(TWO_FILES, DATE);
    const entries = readEntries(bytes);
    assert.equal(entries[0].record.localHeaderOffset, 0);
    for (let index = 1; index < entries.length; index++) {
      assert.equal(entries[index].record.localHeaderOffset, entries[index - 1].local.end);
    }
  });

  test("the central directory starts where the end record says, with one record per entry in order, each pointing at its local header", () => {
    const bytes = zipFiles(TWO_FILES, DATE);
    const end = readEndRecord(bytes);
    const records = readCentralDirectory(bytes);
    assert.equal(records.length, 3);
    assert.equal(records[0].position, end.centralDirectoryOffset);
    // The central directory starts right after the last entry's bytes.
    const lastLocal = readLocalEntry(bytes, records[2].localHeaderOffset);
    assert.equal(end.centralDirectoryOffset, lastLocal.end);
    for (const record of records) {
      assert.deepEqual(record.signature, CENTRAL_SIGNATURE);
      assert.equal(record.versionMadeBy, 20);
      assert.equal(record.versionNeeded, 20);
      assert.equal(record.flags, 0);
      assert.equal(record.method, 0);
      const local = readLocalEntry(bytes, record.localHeaderOffset);
      assert.deepEqual(local.signature, LOCAL_SIGNATURE);
      assert.equal(local.name, record.name);
      assert.equal(local.crc, record.crc);
      assert.equal(local.compressedSize, record.compressedSize);
      assert.equal(local.uncompressedSize, record.uncompressedSize);
      assert.equal(local.time, record.time);
      assert.equal(local.date, record.date);
    }
  });

  test("the end record is the last 22 bytes, with the right counts and central directory size", () => {
    const bytes = zipFiles(TWO_FILES, DATE);
    const end = readEndRecord(bytes);
    assert.deepEqual(end.signature, END_SIGNATURE);
    assert.equal(end.entryCountOnDisk, 3);
    assert.equal(end.entryCount, 3);
    assert.equal(end.commentLength, 0);
    const records = readCentralDirectory(bytes);
    const lastRecord = records[records.length - 1];
    const directoryEnd = lastRecord.position + CENTRAL_RECORD_SIZE + lastRecord.name.length;
    assert.equal(end.centralDirectorySize, directoryEnd - end.centralDirectoryOffset);
    assert.equal(directoryEnd, bytes.length - END_RECORD_SIZE);
  });

  test("a folder entry has size 0 and external attributes 0x10; a file's are 0", () => {
    const [folder, file] = readEntries(zipFiles(TWO_FILES, DATE));
    assert.equal(folder.record.name, "Run/");
    assert.equal(folder.record.compressedSize, 0);
    assert.equal(folder.record.uncompressedSize, 0);
    assert.equal(folder.record.crc, 0);
    assert.equal(folder.record.externalAttributes, 0x10);
    assert.equal(folder.local.data.length, 0);
    assert.equal(file.record.externalAttributes, 0);
  });

  test("text holding µ is stored as its two UTF-8 bytes, and the size counts bytes, not characters", () => {
    const [{ local, record }] = readEntries(zipFiles([{ name: "u.txt", text: "µ" }], DATE));
    assert.deepEqual([...local.data], [0xc2, 0xb5]);
    assert.equal(local.uncompressedSize, 2);
    assert.equal(record.uncompressedSize, 2);
  });

  test("the date is stored in MS-DOS format in both the local header and the central record", () => {
    const [{ local, record }] = readEntries(zipFiles([{ name: "a.txt", text: "" }], DATE));
    assert.equal(local.time, DOS_TIME);
    assert.equal(local.date, DOS_DATE);
    assert.equal(record.time, DOS_TIME);
    assert.equal(record.date, DOS_DATE);
  });

  test("an odd second rounds down: 33 seconds stores the same time as 32", () => {
    const oddSecond = new Date(2026, 9, 28, 1, 57, 33);
    const [{ local }] = readEntries(zipFiles([{ name: "a.txt", text: "" }], oddSecond));
    assert.equal(local.time, DOS_TIME);
  });

  test("the same inputs give identical bytes twice", () => {
    assert.deepEqual(zipFiles(TWO_FILES, DATE), zipFiles(TWO_FILES, DATE));
  });

  test("the list of entries is unchanged afterwards", () => {
    const entries = TWO_FILES.map((entry) => ({ ...entry }));
    const copy = TWO_FILES.map((entry) => ({ ...entry }));
    zipFiles(entries, DATE);
    assert.deepEqual(entries, copy);
  });

  // --- The golden file ---

  test("zipFiles gives exactly the bytes of the golden file zip-two-files.zip", () => {
    const golden = new Uint8Array(readFileSync(GOLDEN_FILE));
    assert.deepEqual(zipFiles(TWO_FILES, DATE), golden);
  });

  // --- Refusing (section 5) ---

  test("refuses entries that aren't a list", () => {
    assert.throws(() => zipFiles(null, DATE), {
      message: "The entries to zip must be a list of { name, text }, but got null.",
    });
    assert.throws(() => zipFiles("entries", DATE), {
      message: 'The entries to zip must be a list of { name, text }, but got "entries".',
    });
  });

  test("refuses an entry that isn't an object with exactly a name and a text", () => {
    const first = { name: "a.csv", text: "" };
    assert.throws(() => zipFiles([first, "Setup.csv"], DATE), {
      message: 'Entry 2 to zip must be an object with a name and a text, but got "Setup.csv".',
    });
    assert.throws(() => zipFiles([first, { name: "b.csv" }], DATE), {
      message: "Entry 2 to zip must be an object with a name and a text, but got an object.",
    });
    assert.throws(() => zipFiles([first, { name: "b.csv", text: "", size: 0 }], DATE), {
      message: "Entry 2 to zip must be an object with a name and a text, but got an object.",
    });
  });

  test("refuses a name or a text that isn't text", () => {
    const first = { name: "a.csv", text: "" };
    assert.throws(() => zipFiles([first, { name: 5, text: "" }], DATE), {
      message: "Entry 2's name must be text, but got 5.",
    });
    assert.throws(() => zipFiles([first, { name: "b.csv", text: 5 }], DATE), {
      message: "Entry 2's text must be text, but got 5.",
    });
  });

  test("refuses a name with a character outside printable ASCII", () => {
    assert.throws(() => zipFiles([{ name: "Exp36_µ.csv", text: "" }], DATE), {
      message:
        'Entry 1\'s name, "Exp36_µ.csv", can\'t contain "µ": ' +
        "use only printable ASCII characters (letters, digits and common punctuation).",
    });
  });

  test("refuses a name that starts or ends with a slash", () => {
    const rule = 'give the file\'s path inside the zip, like "Run/Setup.csv".';
    assert.throws(() => zipFiles([{ name: "/a", text: "" }], DATE), {
      message: `Entry 1's name, "/a", can't start or end with "/": ${rule}`,
    });
    assert.throws(() => zipFiles([{ name: "a/", text: "" }], DATE), {
      message: `Entry 1's name, "a/", can't start or end with "/": ${rule}`,
    });
  });

  test("refuses a name with an empty folder name", () => {
    assert.throws(() => zipFiles([{ name: "a//b", text: "" }], DATE), {
      message:
        'Entry 1\'s name, "a//b", has an empty folder name: ' +
        'put one "/" between folders, and give every folder and file a name.',
    });
  });

  test("refuses a name with a folder or file named . or ..", () => {
    assert.throws(() => zipFiles([{ name: "a/../b", text: "" }], DATE), {
      message:
        'Entry 1\'s name, "a/../b", can\'t have a folder or file named "..": ' +
        "name every folder and file plainly.",
    });
    assert.throws(() => zipFiles([{ name: ".", text: "" }], DATE), {
      message:
        'Entry 1\'s name, ".", can\'t have a folder or file named ".": ' +
        "name every folder and file plainly.",
    });
  });

  test("refuses a name with a backslash", () => {
    assert.throws(() => zipFiles([{ name: "a\\b", text: "" }], DATE), {
      message: 'Entry 1\'s name, "a\\b", can\'t contain a backslash: separate folders with "/".',
    });
  });

  test("refuses two entries with the same name, naming both", () => {
    const entries = [
      { name: "Setup.csv", text: "1" },
      { name: "Stages.csv", text: "2" },
      { name: "Setup.csv", text: "3" },
    ];
    assert.throws(() => zipFiles(entries, DATE), {
      message: 'Entries 1 and 3 are both named "Setup.csv": each file in a zip needs its own name.',
    });
  });

  test("refuses a date that isn't a valid Date", () => {
    const entries = [{ name: "a.csv", text: "" }];
    assert.throws(() => zipFiles(entries, "2026-10-28"), {
      message: 'The date to zip with must be a valid date, but got "2026-10-28".',
    });
    assert.throws(() => zipFiles(entries, new Date("x")), {
      message: "The date to zip with must be a valid date, but got an object.",
    });
  });

  test("refuses a date before 1980 or after 2107", () => {
    const entries = [{ name: "a.csv", text: "" }];
    assert.throws(() => zipFiles(entries, new Date(1979, 0, 1)), {
      message: "A zip can only hold dates from 1980 to 2107, but got 1979.",
    });
    assert.throws(() => zipFiles(entries, new Date(2108, 0, 1)), {
      message: "A zip can only hold dates from 1980 to 2107, but got 2108.",
    });
  });

  test("a bad entry is reported before a duplicate name", () => {
    const entries = [
      { name: "Setup.csv", text: "1" },
      { name: "Setup.csv", text: "2" },
      "Stages.csv",
    ];
    assert.throws(() => zipFiles(entries, DATE), {
      message: 'Entry 3 to zip must be an object with a name and a text, but got "Stages.csv".',
    });
  });

  // --- checkEntries ---

  test("checkEntries passes a valid list", () => {
    assert.doesNotThrow(() => checkEntries(TWO_FILES));
  });

  test("checkEntries throws exactly zipFiles' messages for a name with .. and for two entries named alike", () => {
    const wrongLists = [
      [{ name: "a/../b", text: "" }],
      [
        { name: "Setup.csv", text: "1" },
        { name: "Setup.csv", text: "2" },
      ],
    ];
    for (const entries of wrongLists) {
      // The message zipFiles throws for the same entries, caught to compare.
      let zipMessage = null;
      try {
        zipFiles(entries, DATE);
      } catch (error) {
        zipMessage = error.message;
      }
      assert.notEqual(zipMessage, null);
      assert.throws(() => checkEntries(entries), { message: zipMessage });
    }
  });

  test("a bad name is reported before a bad date", () => {
    assert.throws(() => zipFiles([{ name: "a\\b", text: "" }], "2026-10-28"), {
      message: 'Entry 1\'s name, "a\\b", can\'t contain a backslash: separate folders with "/".',
    });
  });
});
