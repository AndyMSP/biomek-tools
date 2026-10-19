# zip — specification

> Experiment branch: written without section-by-section review.

## 1. Purpose
`zip.js` packs text files into one `.zip` file, so a tool can hand over a whole folder of Biomek
files in one download. It writes the standard ZIP format without compression ("stored"), which
every unzip program, including Windows Explorer, can open. It has no screen code.

## 2. Interface
| Export | Description |
|---|---|
| `createZip(files)` | `files` is a list of `{ path, text }`; paths use `/` between folders (e.g. `Exp37/Step8_Media_seed37/Exp37_Step8a.csv`). Returns the zip as a `Uint8Array`. Text must be plain ASCII. |
| `crc32(bytes)` | The CRC-32 checksum the format requires, e.g. the bytes of `"123456789"` → `0xCBF43926`. |

Every file gets the date 1 January 1980, so the same files always give the same zip.

## 3. Errors
| Problem | Message |
|---|---|
| Text that isn't plain ASCII | `Exp37/a.csv contains a character that isn't plain text (ASCII): "µ".` |

## 4. Test cases
- `crc32` of `"123456789"` is `0xCBF43926`; of nothing, `0`.
- A zip of two files starts with the local file signature, ends with the end-of-directory record
  listing 2 files, and contains each path and text.
- The same files give byte-identical zips.
- Non-ASCII text throws the error above.
