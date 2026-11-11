// Unit tests for folder-writer.js. Each test comes from the "Test cases" section of folder-writer.md.
// They write into a stand-in folder held in memory (tests/fixtures/memory-folder.js), which has
// exactly the parts of a browser's folder that the module uses, records what's made, and can be
// told to fail.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { lastFolderName, writeIntoFolder } from "./folder-writer.js";
import { zipFiles } from "../zip/zip.js";
import { MemoryFolder } from "../../../tests/fixtures/memory-folder.js";

// A run's entries, as a caller gives them: a folder, files in it, and a Records folder with files.
// One text holds µ and °, which take two bytes each in UTF-8.
const RUN_ENTRIES = [
  { name: "Run1/Setup.csv", text: "Labware,Well\r\nRes1,1\r\n" },
  { name: "Run1/Stages.csv", text: "Stage,Volume (µL)\r\n1,50\r\n" },
  { name: "Run1/Transfer1.csv", text: "a,b\r\n" },
  { name: "Run1/Records/Labware sheet.pdf", text: "%PDF-1.4 kept at 37 °C\n" },
  { name: "Run1/Records/Run1 plan.json", text: '{"format":"plan"}\n' },
];

// The date the zip comparisons zip with; any valid date gives the same messages.
const DATE = new Date(2026, 10, 10, 9, 30, 0);

// The message zipFiles throws for `entries`, to compare with writeIntoFolder's.
function zipMessageFor(entries) {
  try {
    zipFiles(entries, DATE);
  } catch (error) {
    return error.message;
  }
  return null;
}

describe("folder-writer", () => {
  // --- lastFolderName ---

  test("lastFolderName gives the last folder name, with or without a backslash at the end", () => {
    assert.equal(lastFolderName("C:\\Users\\Beckman Coulter\\Desktop\\Ento\\"), "Ento");
    assert.equal(lastFolderName("C:\\Users\\Beckman Coulter\\Desktop\\Ento"), "Ento");
  });

  test("lastFolderName gives a single folder's name", () => {
    assert.equal(lastFolderName("C:\\Ento"), "Ento");
  });

  test("lastFolderName throws for a path with no folder name", () => {
    assert.throws(() => lastFolderName(""), {
      message: 'lastFolderName needs a folder path ending in a folder name, and got "".',
    });
    assert.throws(() => lastFolderName("C:\\"), {
      message: 'lastFolderName needs a folder path ending in a folder name, and got "C:\\".',
    });
    assert.throws(() => lastFolderName("Ento"), {
      message: 'lastFolderName needs a folder path ending in a folder name, and got "Ento".',
    });
  });

  // --- Writing ---

  test("writes a run's entries: exactly those folders and files, with the same texts", async () => {
    const ento = new MemoryFolder("Ento");
    const result = await writeIntoFolder(ento, RUN_ENTRIES, "Ento");
    assert.deepEqual(result, { how: "written", count: RUN_ENTRIES.length });
    assert.deepEqual(
      ento.texts(),
      new Map(RUN_ENTRIES.map((entry) => [entry.name, entry.text])),
    );
    const folders = ento.made().filter((item) => item.kind === "folder").map((item) => item.path);
    assert.deepEqual(folders, ["Run1", "Run1/Records"]);
  });

  test("each file's bytes are the text as UTF-8, as zip stores them", async () => {
    const ento = new MemoryFolder("Ento");
    await writeIntoFolder(ento, RUN_ENTRIES, "Ento");
    const files = ento.files();
    for (const { name, text } of RUN_ENTRIES) {
      assert.deepEqual(files.get(name), new TextEncoder().encode(text), name);
    }
    // µ is 2 bytes in UTF-8, so the bytes outnumber the characters.
    assert.ok(files.get("Run1/Stages.csv").length > RUN_ENTRIES[1].text.length);
  });

  test("entries are written in order, and each folder is made once", async () => {
    const ento = new MemoryFolder("Ento");
    await writeIntoFolder(ento, RUN_ENTRIES, "Ento");
    assert.deepEqual(ento.made(), [
      { kind: "folder", path: "Run1" },
      { kind: "file", path: "Run1/Setup.csv" },
      { kind: "file", path: "Run1/Stages.csv" },
      { kind: "file", path: "Run1/Transfer1.csv" },
      { kind: "folder", path: "Run1/Records" },
      { kind: "file", path: "Run1/Records/Labware sheet.pdf" },
      { kind: "file", path: "Run1/Records/Run1 plan.json" },
    ]);
  });

  // --- The folder's name ---

  test("a folder with another name gives wrong-folder with its name, and nothing is made", async () => {
    const downloads = new MemoryFolder("Downloads");
    assert.deepEqual(await writeIntoFolder(downloads, RUN_ENTRIES, "Ento"), {
      how: "wrong-folder",
      name: "Downloads",
    });
    assert.deepEqual(downloads.made(), []);
  });

  test("capitals count: a folder named ento gives wrong-folder when Ento is expected", async () => {
    const lowerCase = new MemoryFolder("ento");
    assert.deepEqual(await writeIntoFolder(lowerCase, RUN_ENTRIES, "Ento"), {
      how: "wrong-folder",
      name: "ento",
    });
    assert.deepEqual(lowerCase.made(), []);
  });

  // --- What's already there ---

  test("a folder already named as the top-level name gives exists, and nothing more is made", async () => {
    const ento = new MemoryFolder("Ento");
    await ento.getDirectoryHandle("Run1", { create: true });
    const madeBefore = ento.made().length;
    assert.deepEqual(await writeIntoFolder(ento, RUN_ENTRIES, "Ento"), { how: "exists", name: "Run1" });
    assert.equal(ento.made().length, madeBefore);
  });

  test("a file already named as the top-level name gives exists, and nothing more is made", async () => {
    const ento = new MemoryFolder("Ento");
    await ento.getFileHandle("Run1", { create: true });
    const madeBefore = ento.made().length;
    assert.deepEqual(await writeIntoFolder(ento, RUN_ENTRIES, "Ento"), { how: "exists", name: "Run1" });
    assert.equal(ento.made().length, madeBefore);
  });

  // --- Failures ---

  test("a failure on the third file gives failed with the error and count 2; the first two files stay", async () => {
    const ento = new MemoryFolder("Ento", { failOnFile: 3 });
    const result = await writeIntoFolder(ento, RUN_ENTRIES, "Ento");
    assert.equal(result.how, "failed");
    assert.equal(result.count, 2);
    assert.equal(result.error.message, "The stand-in folder was told to fail on file 3.");
    assert.deepEqual([...ento.files().keys()], ["Run1/Setup.csv", "Run1/Stages.csv"]);
  });

  test("keys() failing gives failed with count 0", async () => {
    const ento = new MemoryFolder("Ento", { failKeys: true });
    const result = await writeIntoFolder(ento, RUN_ENTRIES, "Ento");
    assert.equal(result.how, "failed");
    assert.equal(result.count, 0);
    assert.equal(result.error.message, "The stand-in folder was told to fail listing its contents.");
    assert.deepEqual(ento.made(), []);
  });

  // --- Wrong entries ---

  test("an empty list throws this module's message, and nothing is made", async () => {
    const ento = new MemoryFolder("Ento");
    await assert.rejects(writeIntoFolder(ento, [], "Ento"), {
      message: "writeIntoFolder needs at least one entry to write, and got none.",
    });
    assert.deepEqual(ento.made(), []);
  });

  test("a name with .. and two entries named alike throw zipFiles' messages, and nothing is made", async () => {
    const wrongLists = [
      [{ name: "Run1/../Setup.csv", text: "" }],
      [
        { name: "Run1/Setup.csv", text: "1" },
        { name: "Run1/Setup.csv", text: "2" },
      ],
    ];
    for (const entries of wrongLists) {
      const ento = new MemoryFolder("Ento");
      const zipMessage = zipMessageFor(entries);
      assert.notEqual(zipMessage, null);
      await assert.rejects(writeIntoFolder(ento, entries, "Ento"), { message: zipMessage });
      assert.deepEqual(ento.made(), []);
    }
  });
});
