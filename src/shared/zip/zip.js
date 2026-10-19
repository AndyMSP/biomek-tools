// zip.js — packs text files into one .zip file without compression ("stored"), so a tool can hand
// over a whole folder in one download. Every unzip program, including Windows Explorer, opens it.
// Specification: zip.md. Format: PKWARE APPNOTE, sections 4.3.7 (local header), 4.3.12 (central
// directory) and 4.3.16 (end of central directory).

// The CRC-32 lookup table (polynomial 0xEDB88320), computed once.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

// The date and time stored with every file: 1 January 1980, 00:00, in DOS format, so the same
// files always give the same zip.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

// The CRC-32 checksum of some bytes, e.g. the bytes of "123456789" → 0xCBF43926.
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Packs files { path, text } into a zip, e.g. createZip([{ path: "a/b.csv", text: "x" }]) → bytes.
export function createZip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { path, text } of files) {
    const name = asciiBytes(path, path);
    const data = asciiBytes(text, path);
    const crc = crc32(data);
    const local = header(0x04034b50, [20, 0, 0, DOS_TIME, DOS_DATE], crc, data.length, name, []);
    parts.push(local, data);
    central.push(header(0x02014b50, [20, 20, 0, 0, DOS_TIME, DOS_DATE], crc, data.length, name, [offset]));
    offset += local.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return join([...parts, ...central, new Uint8Array(end.buffer)]);
}

// --- Helpers used only inside this module ---

// Builds a local file header or a central directory entry. `fields` are the 16-bit values after the
// signature, up to the date; `extra` holds the central entry's local-header offset.
function header(signature, fields, crc, size, name, extra) {
  const isCentral = extra.length > 0;
  const fixedLength = isCentral ? 46 : 30;
  const view = new DataView(new ArrayBuffer(fixedLength + name.length));
  view.setUint32(0, signature, true);
  fields.forEach((value, index) => view.setUint16(4 + index * 2, value, true));
  const at = 4 + fields.length * 2; // where the CRC goes
  view.setUint32(at, crc, true);
  view.setUint32(at + 4, size, true); // compressed size (stored, so the same)
  view.setUint32(at + 8, size, true); // uncompressed size
  view.setUint16(at + 12, name.length, true);
  if (isCentral) {
    view.setUint32(42, extra[0], true); // offset of the local header
  }
  const bytes = new Uint8Array(view.buffer);
  bytes.set(name, fixedLength);
  return bytes;
}

// The bytes of plain ASCII text; throws if it holds any other character, e.g. "µ".
function asciiBytes(text, path) {
  const bad = [...text].find((character) => character.charCodeAt(0) > 127);
  if (bad !== undefined) {
    throw new Error(`${path} contains a character that isn't plain text (ASCII): "${bad}".`);
  }
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

// Joins byte arrays into one, e.g. [[1, 2], [3]] → [1, 2, 3].
function join(parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    result.set(part, at);
    at += part.length;
  }
  return result;
}
