# zip — specification

> **Draft (2026-10-28).** Written for v0.2.0, from the transfer designer preview, where a zip of
> the Biomek files was made, downloaded and unzipped on Andy's own computer (2026-10-28). Still to
> check: unzipping one on the Biomek PC and running its files (security warnings, paths). It
> becomes Final once its code is built and a zip it makes has been unzipped and run there.

## 1. Purpose
`zip.js` turns a list of file names and their contents into the bytes of one **zip file** (an
archive holding several files and folders, which Windows opens and extracts without anything
installed). The transfer
designer uses it so the Biomek files for one run download as a single file, holding the run's
folder (Andy, 2026-10-28; `file-writer.md`, "Outputs").

It's shared because building a zip has nothing to do with one tool: any tool that hands the user
several files can use it.

It is our own code, not a library (Andy, 2026-10-28): it writes only the simplest kind of zip, so
it is short enough to read and check in full, and adds no dependency.

## 2. Scope
Version 1 writes **stored** zips: each file is kept exactly as it is, not compressed. The files
are small text, so compressing them would gain almost nothing. It follows the zip format's public
specification, PKWARE's **APPNOTE.TXT** (the "Application Note" that has defined zip files since
1989), using only the parts every program that opens zips understands.

Not in version 1:
- **Compression.** Not needed for small text files.
- **Reading zips.** Nothing in the project opens a zip; reading is also where zip's hard problems
  and risks are (damaged or deliberately misleading files).
- **Zip64**, the extension for archives over 4 GB or with more than 65,535 entries. A run's files
  are a few hundred kilobytes.
- **File names beyond plain ASCII** (letters, digits and common punctuation). The file writer's
  names never need more, and names in other alphabets need an extra flag that some older programs
  read wrongly.

## 3. Data model

### Inputs
- **The entries:** a list of `{ name, text }`, each a file's name (its path inside the zip) and
  its contents, as text. It's a list held in memory, the same shape as the file writer's output
  (each file's name and contents), not something read from disk.
  - `name` is the file's path inside the zip, with folders separated by `/`, e.g.
    `"2026-10-28_015732_Exp36/Setup.csv"`. It holds only printable ASCII characters (codes 32 to
    126), doesn't start or end with `/`, has no empty folder name (`a//b`), no folder or file named
    `.` or `..`, and no backslash (`\`), which zip programs read differently. No two entries share
    a name.
  - `text` is the file's contents, as text. It's stored as **UTF-8**, the standard way of writing
    text as bytes, so `µ` and other characters beyond ASCII come out right.
- **The date:** a JavaScript `Date`, given to every entry as its date and time last modified, in
  the computer's local time. It must be between 1980 and 2107, the years a zip can hold. Like the
  file writer, the module never reads the clock itself, so the same inputs always give the same
  bytes.

### Output
The zip's bytes, as a `Uint8Array` (JavaScript's list of bytes, each 0 to 255), ready to save as a
`.zip` file.

### What the zip holds
- **A folder entry for every folder** named in the file names, each once, ending in `/`, before
  the files, in the order the folders first appear. Most programs would make the folders anyway;
  listing them makes sure an empty-looking folder can't be left out.
- **Then one entry per file,** for each of the entries given, in their order.

### The format
All numbers are **little-endian** (the lowest byte first), as the zip format requires. For each
entry, in order:
1. **A local file header,** 30 bytes: the signature `50 4B 03 04` (`PK` and two bytes); version
   needed to extract, 20 (2.0); flags 0; compression method 0 (stored); the time and date (below);
   the **CRC-32** (below); the size, twice (compressed and uncompressed, equal when stored); the
   name's length; and 0 for the "extra field" length.
2. **The name**, in ASCII.
3. **The file's bytes** (none for a folder).

Then, after every entry:
4. **The central directory:** for each entry, in the same order, a 46-byte record with the
   signature `50 4B 01 02`, the same version, flags, method, time, date, CRC-32, sizes and name
   length as its header; version made by 20; 0 for the extra field, comment, disk number and
   internal attributes; external attributes `0x10` for a folder (the MS-DOS "directory" flag), 0
   for a file; and where the entry's local header starts in the zip. Each record is followed by
   the entry's name.
5. **The end of central directory record,** 22 bytes: the signature `50 4B 05 06`; 0 for the disk
   numbers; the number of entries, twice; the central directory's size and where it starts; and 0
   for the comment's length.

**The time and date** are in the **MS-DOS format** zip uses: the time as hours × 2048 + minutes ×
32 + seconds ÷ 2 (rounded down: zip times are kept to 2 seconds), and the date as (year − 1980) ×
512 + month × 32 + day, with months counted from 1.

**CRC-32** is a **checksum**, a number worked out from a file's bytes, which the program opening
the zip recalculates to check that the file arrived intact. It's the standard CRC-32 that zip, PNG
and Ethernet all use (the "reflected" polynomial `0xEDB88320`, starting from `0xFFFFFFFF` and
inverted at the end). A well-known check: the CRC-32 of the text `123456789` is `0xCBF43926`.

## 4. Interface
The module exports three functions. None changes its inputs.

| Function | Takes | Returns | Throws |
|---|---|---|---|
| `zipFiles(entries, date)` | the entries and the date (section 3) | the zip's bytes, a `Uint8Array` | if the entries or the date aren't valid (section 5); nothing is returned then |
| `crc32(bytes)` | a `Uint8Array` | its CRC-32, a whole number from 0 to 4,294,967,295, e.g. of the bytes of `"123456789"` → `0xCBF43926` | never, for a `Uint8Array` |
| `checkEntries(entries)` | the entries (section 3) | nothing | as `zipFiles` does for the entries (section 5) |

`crc32` is exported so its tests can check it against the known values directly. `checkEntries`
(2026-11-10) is exported so `folder-writer` (`folder-writer.md`), which writes the same entries into
a folder, checks them by the same rules with the same messages, rather than repeating them; it's
exactly the check `zipFiles` makes of the entries, and `zipFiles` keeps using it.

Example:
```js
const bytes = zipFiles(
  [{ name: "2026-10-28_015732_Exp36/Setup.csv", text: "StageWorklist\r\n" }],
  new Date(2026, 9, 28, 1, 57, 32),
);
// bytes holds two entries: the folder "2026-10-28_015732_Exp36/", then the file.
```

## 5. Errors
Each message says what's wrong and how to fix it. Values are shown with `describeValue`
(`error-messages` module). These are mistakes in the calling code, not in what a user typed: the
file writer's names always pass.

| Problem | Message |
|---|---|
| `entries` isn't a list | `The entries to zip must be a list of { name, text }, but got null.` |
| An entry isn't an object with exactly `name` and `text` | `Entry 2 to zip must be an object with a name and a text, but got "Setup.csv".` |
| A name isn't text, or `text` isn't text | `Entry 2's name must be text, but got 5.` / `Entry 2's text must be text, but got 5.` |
| A name breaks a rule of section 3 | `Entry 2's name, "a\b.csv", can't contain a backslash: separate folders with "/".` (one message per rule: a character outside printable ASCII, a `/` at the start or end, an empty folder name, `.` or `..`) |
| Two entries share a name | `Entries 1 and 3 are both named "Setup.csv": each file in a zip needs its own name.` |
| `date` isn't a valid `Date` | `The date to zip with must be a valid date, but got "2026-10-28".` |
| The date is before 1980 or after 2107 | `A zip can only hold dates from 1980 to 2107, but got 1979.` |

Entries are numbered from 1, in the order given. The list is checked first, then each entry in order
(its form, then its name), then the names against each other, then the date. The first problem
found is reported.

## 6. Test cases
Each becomes at least one unit test in `zip.test.js`, inside `describe("zip", …)`. Each row of
section 5 has at least one test.

**`checkEntries`** (2026-11-10): a valid list passes; a name with `..` and two entries named alike
throw exactly the messages `zipFiles` throws for the same entries.

**CRC-32**
- The CRC-32 of the bytes of `"123456789"` is `0xCBF43926`; of no bytes, `0`; of the single byte
  for `"a"`, `0xE8B7BE43`.

**The structure**
- A zip of one file at the top level has one entry; one of `"Run/Setup.csv"` and `"Run/Stages.csv"`
  has three entries, the folder `"Run/"` first.
- Each entry's local header starts with `50 4B 03 04`, holds method 0, the right sizes and CRC-32,
  and is followed by its name and bytes.
- The central directory starts where the end record says, has one record per entry in order, and
  each record's offset points at its entry's local header.
- The end record's entry counts and central directory size are right, and it's the last 22 bytes.
- A folder entry has size 0 and external attributes `0x10`; a file's are 0.
- Text holding `µ` is stored as its two UTF-8 bytes, `C2 B5`, and the size counts bytes, not
  characters.
- The date `new Date(2026, 9, 28, 1, 57, 32)` is stored as time `0x0F30` (1 × 2048 + 57 × 32 +
  32 ÷ 2 = 3888) and date `0x5D5C` (46 × 512 + 10 × 32 + 28 = 23900); with 33 seconds instead, the
  time is the same (an odd second rounds down).
- The same inputs give identical bytes twice, and the list of entries is unchanged afterwards.

**The golden file**
- `tests/fixtures/zip-two-files.zip` is a **golden file** (CLAUDE.md, "Testing"): a zip of
  `"Run/Setup.csv"` (text `"a,b\r\n1,2\r\n"`) and `"Run/Stages.csv"` (text `"x\r\n"`), dated
  `new Date(2026, 9, 28, 1, 57, 32)`. Before it's saved, it's checked with two independent zip
  readers (Python's `zipfile` and Info-ZIP's `unzip -t`) and by Andy opening it in Windows
  Explorer, each reading both files back exactly; its notes, `tests/fixtures/zip-two-files.md`,
  say who checked it and when (all three, 2026-10-28).
  `zipFiles` with those inputs must give exactly its bytes. It's never regenerated or edited to
  make a test pass.

**Refusing** (section 5)
- Each row gives its message: `null` and `"entries"` for the list; an entry that's a string, one
  missing `text`, one with an extra property; names `5`, `"/a"`, `"a/"`, `"a//b"`, `"a/../b"`,
  `"."`, `"a\\b"` and `"Exp36_µ.csv"`; two entries named alike (reported by both numbers); dates
  `"2026-10-28"`, `new Date("x")`, `new Date(1979, 0, 1)` and `new Date(2108, 0, 1)`.
- Order of checks: a bad entry before a duplicate name; a bad name before a bad date.
