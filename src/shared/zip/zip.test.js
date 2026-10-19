// Unit tests for zip.js. Each test comes from the "Test cases" section of zip.md.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createZip, crc32 } from "./zip.js";

// The bytes of ASCII text, e.g. "AB" → [65, 66].
function bytes(text) {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

describe("zip", () => {
  test("crc32 matches the standard check value", () => {
    assert.equal(crc32(bytes("123456789")), 0xcbf43926);
    assert.equal(crc32(bytes("")), 0);
  });

  test("a zip of two files has the right structure and contents", () => {
    const zip = createZip([
      { path: "Exp37/a.csv", text: "A,B\r\n1,2" },
      { path: "Exp37/b/c.csv", text: "C" },
    ]);
    const view = new DataView(zip.buffer);
    assert.equal(view.getUint32(0, true), 0x04034b50);
    const end = zip.length - 22;
    assert.equal(view.getUint32(end, true), 0x06054b50);
    assert.equal(view.getUint16(end + 10, true), 2);
    const text = String.fromCharCode(...zip);
    for (const part of ["Exp37/a.csv", "A,B\r\n1,2", "Exp37/b/c.csv"]) {
      assert.ok(text.includes(part), part);
    }
  });

  test("the same files give byte-identical zips", () => {
    const files = [{ path: "x.csv", text: "1" }];
    assert.deepEqual(createZip(files), createZip(files));
  });

  test("text that isn't plain ASCII is rejected", () => {
    assert.throws(() => createZip([{ path: "Exp37/a.csv", text: "50 µL" }]), {
      message: 'Exp37/a.csv contains a character that isn\'t plain text (ASCII): "µ".',
    });
  });
});
