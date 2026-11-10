# folder-writer — specification

> **Draft (2026-11-10).** Written for v0.2.0 (item 31; ADR 0023), from the transfer designer preview
> Andy tested on the Biomek PC on 2026-11-10, in the hands-off workflow (CLAUDE.md, "Workflows").
> It becomes Final once built and tested by Andy.

## 1. Purpose
`folder-writer.js` writes a list of files into a folder on the user's computer that the user has
picked in the browser, as an alternative to a zip they unzip themselves. It takes the same entries
as `zip` (`zip.md`, section 3), so a caller can offer both from one list and they can't drift
apart: the folder holds byte for byte what unzipping the zip gives.

It's shared because, like `zip`, it has nothing to do with one tool. It does no picking: the caller
asks the browser for the folder (`window.showDirectoryPicker`) and passes it in. So the module uses
no page and no browser window, only the folder object it's given, and its tests run in Node with a
stand-in folder.

## 2. Scope
- **Writes only into a new folder.** It never overwrites or deletes anything: if any folder or file
  it would make at the top level already exists, it writes nothing.
- **Checks the folder's name**, as the caller asks. A web page sees a folder's name, never its path,
  so this is the only check of where the folder is.
- **Doesn't undo a failure.** If writing stops part-way, what was written stays, and the caller is
  told how far it got.

Not in this version: overwriting, deleting, reading files back, or picking the folder.

## 3. Data model

### The folder
A **folder object**: what the browser gives for a picked folder (a `FileSystemDirectoryHandle`, from
the File System Access API), or anything with the same parts. The module uses only these:
- `name`: the folder's name, e.g. `"Ento"`;
- `keys()`: the names of what the folder holds, as an async iterator (each name a string);
- `getDirectoryHandle(name, { create: true })`: the folder of that name inside it, made if missing;
- `getFileHandle(name, { create: true })`: the file of that name inside it, made if missing, whose
  `createWritable()` gives a writable stream with `write(text)` and `close()`.

All of these return promises (they're asynchronous in the browser). The module calls nothing else,
so the stand-in folder in the tests (section 6) needs only these.

### The entries
A list of `{ name, text }`, exactly as `zip` takes them (`zip.md`, section 3, "Inputs"): `name` is
the file's path inside the folder with folders separated by `/`, and `text` its contents. The same
rules on names apply, and are checked the same way (section 5). The entries' **top-level names**
are the first parts of their names, each once, in the order they first appear, e.g. `Run1` for
`Run1/Setup.csv` and `Run1/Records/Labware sheet.pdf`.

### What it writes
For each entry, in order: each folder along its path, made inside the one before (or found, if an
earlier entry made it), then the file, its text written as UTF-8 (the text as given; a writable
stream stores a string as UTF-8), then closed. So the folders and files are those the zip's
entries describe, and each file holds the same bytes as the zip's.

## 4. Interface
`folder-writer.js` exports:

- **`lastFolderName(path)`**: the last folder name in a Windows folder path, ignoring a backslash at
  the end. E.g. `lastFolderName("C:\\Users\\Beckman Coulter\\Desktop\\Ento\\")` is `"Ento"`, and so
  is `lastFolderName("C:\\Ento")`. Throws if the path holds no folder name (`""`, `"C:\\"`).
- **`writeIntoFolder(folder, entries, expectedName)`**: async. Checks and writes, in this order:
  1. The entries' names, as `zip` checks them (section 5): if one is wrong, it throws before looking
     at the folder.
  2. **The folder's name.** If `folder.name` isn't exactly `expectedName` (capitals count; this is
     deliberate, as the caller compares with the name written in its configuration), it returns
     `{ how: "wrong-folder", name: folder.name }` and writes nothing.
  3. **What's already there.** If the folder already holds anything (a folder or a file) named as
     one of the entries' top-level names, it returns `{ how: "exists", name }`, `name` being the
     first such top-level name, and writes nothing.
  4. **Writing**, as section 3 says. If every entry is written, it returns `{ how: "written",
     count }`, `count` being the number of files written. If a call to the folder object fails
     (throws or rejects) part-way, it stops at once and returns `{ how: "failed", error, count }`:
     the error as thrown, and how many files were written completely before it. It never throws
     for a failure while writing.

  Errors from steps 2 and 3 (the folder's `keys()` failing) are failures too: `{ how: "failed",
  error, count: 0 }`.

## 5. Errors
Only wrong entries throw, as programming errors, before anything is written:
- an empty list: `writeIntoFolder needs at least one entry to write, and got none.`;
- otherwise, `zip`'s own check of the entries (`checkEntries`, exported from `zip.js` for this;
  `zip.md`, section 4), with `zip`'s messages unchanged (`zip.md`, section 5): a list that isn't
  one, an entry that isn't `{ name, text }`, a name breaking a rule, two entries named alike. The
  check is shared, not written twice (CLAUDE.md, "Don't repeat yourself"); its messages mention a
  zip, which is fine for programming errors that the callers' own entries never trigger.

`lastFolderName`'s error: `lastFolderName needs a folder path ending in a folder name, and got "<path>".`

Everything that goes wrong with the folder itself is returned, not thrown (section 4), so the caller
can say what happened.

## 6. Test cases
`folder-writer.test.js`, inside `describe("folder-writer", …)`, using a **stand-in folder**: an
in-memory folder object with exactly the parts of section 3, which records what's made and can be
told to fail on the nth file. It lives in `tests/fixtures/memory-folder.js`, so the REPL can use it
too.

- `lastFolderName`: with and without the backslash at the end; a single folder (`C:\\Ento`); `""`
  and `C:\\` throw.
- Writes a run's entries (a folder, files in it, a `Records` folder with files): the stand-in holds
  exactly those folders and files, with the same texts; returns `{ how: "written", count }` with
  the number of files.
- The bytes written for each file equal the bytes `zip` stores for it (the text with `µ` and `°`,
  as UTF-8): written through the stand-in, compared with `new TextEncoder().encode(text)`.
- Entries are written in order; folders made once each.
- Wrong name: `Downloads` when `Ento` is expected, and `ento` (capitals count): `wrong-folder` with
  the name, nothing made.
- Already there: a folder named as the top-level name, and a file named so: `exists` with the
  name, nothing made.
- Failure on the third file: `failed`, with the stand-in's error and `count` 2; the first two files
  are there, nothing after.
- `keys()` failing: `failed` with `count` 0.
- Wrong entries throw, and nothing is made: an empty list (this module's message); a name with
  `..` and two entries with the same name (the same messages `zipFiles` gives).

## 7. REPL
A `folder-writer` topic in `scripts/repl.js`: `lastFolderName` on `BASE_FOLDER`, then
`writeIntoFolder` into a stand-in folder (`tests/fixtures/memory-folder.js`) named `Ento`, showing
what it holds afterwards, then the same again, giving `exists`.
