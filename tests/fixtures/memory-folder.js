// memory-folder.js — a stand-in for a folder the user picked in the browser, kept in memory, so
// folder-writer can be tested in Node and tried in the REPL.
//
// A browser gives a picked folder as a FileSystemDirectoryHandle (the File System Access API).
// folder-writer uses only a few of its parts (folder-writer.md, section 3, "The folder"), and this
// stand-in has exactly those: `name`, `keys()`, `getDirectoryHandle(name, { create: true })` and
// `getFileHandle(name, { create: true })`, whose `createWritable()` gives a stream with
// `write(text)` and `close()`. Each returns a promise, as in the browser. A writable stream stores a
// string as UTF-8, so this one does too.
//
// It also records what's made, in order, and can be told to fail: on the nth file asked for, or
// when its contents are listed. Used by folder-writer.test.js and scripts/repl.js.
// Specification: src/shared/folder-writer/folder-writer.md, section 6.

// Turns text into its UTF-8 bytes, as a browser's writable stream does with a string.
const utf8 = new TextEncoder();

// A folder held in memory, with the parts of a browser's folder handle that folder-writer uses.
export class MemoryFolder {
  // A folder named `name`, holding nothing yet. Options, for the top folder only:
  // `failOnFile`: the number (from 1) of the file whose making fails, counted across this folder
  // and every folder inside it, e.g. 3 makes the third file asked for fail; `failKeys`: true to
  // make listing this folder's contents fail. `shared` is for folders made inside it only: the top
  // folder's shared record (below), which they add to.
  // e.g. new MemoryFolder("Ento", { failOnFile: 3 })
  constructor(name, { failOnFile = null, failKeys = false } = {}, shared = null) {
    this.name = name;
    this.failKeys = failKeys;
    // What the folder holds: each name mapped to a MemoryFolder or a MemoryFile.
    this.children = new Map();
    // What's shared by the top folder and every folder inside it: the log of what's made, the
    // files asked for so far, and the file to fail on.
    this.shared = shared ?? { made: [], filesAsked: 0, failOnFile };
    // The path from the top folder, for the log, e.g. "" for the top folder, "Run1/Records".
    this.path = "";
  }

  // The names of what the folder holds, as an async iterator, as a browser's folder handle gives
  // them, e.g. for await (const name of folder.keys()) …
  async *keys() {
    if (this.failKeys) {
      throw new Error("The stand-in folder was told to fail listing its contents.");
    }
    // A copy, so making something while listing doesn't change the list being listed.
    for (const name of [...this.children.keys()]) {
      yield name;
    }
  }

  // The folder named `name` inside this one, made if it's missing (with { create: true }). Throws
  // if a file has that name, or if it's missing and create isn't true, as a browser does.
  async getDirectoryHandle(name, { create = false } = {}) {
    const existing = this.children.get(name);
    if (existing instanceof MemoryFolder) {
      return existing;
    }
    if (existing !== undefined) {
      throw new Error(`The stand-in folder holds a file named "${name}", not a folder.`);
    }
    if (!create) {
      throw new Error(`The stand-in folder holds no folder named "${name}".`);
    }
    const folder = new MemoryFolder(name, {}, this.shared);
    folder.path = this.childPath(name);
    this.children.set(name, folder);
    this.shared.made.push({ kind: "folder", path: folder.path });
    return folder;
  }

  // The file named `name` inside this one, made if it's missing (with { create: true }). Fails if
  // it's the file the folder was told to fail on, or for the same reasons as getDirectoryHandle.
  async getFileHandle(name, { create = false } = {}) {
    this.shared.filesAsked += 1;
    if (this.shared.filesAsked === this.shared.failOnFile) {
      throw new Error(`The stand-in folder was told to fail on file ${this.shared.failOnFile}.`);
    }
    const existing = this.children.get(name);
    if (existing instanceof MemoryFile) {
      return existing;
    }
    if (existing !== undefined) {
      throw new Error(`The stand-in folder holds a folder named "${name}", not a file.`);
    }
    if (!create) {
      throw new Error(`The stand-in folder holds no file named "${name}".`);
    }
    const file = new MemoryFile(name, this.childPath(name), this.shared);
    this.children.set(name, file);
    this.shared.made.push({ kind: "file", path: file.path });
    return file;
  }

  // The log of what's been made in this folder and the folders inside it, in order, each
  // { kind: "folder" or "file", path }, e.g. [{ kind: "folder", path: "Run1" }, …].
  made() {
    return this.shared.made;
  }

  // Every file in this folder and the folders inside it, as a Map from its path (from this folder,
  // with "/" between folders) to its bytes, e.g. Map { "Run1/Setup.csv" → Uint8Array [...] }.
  files() {
    const found = new Map();
    for (const [name, child] of this.children) {
      if (child instanceof MemoryFolder) {
        for (const [path, bytes] of child.files()) {
          found.set(`${name}/${path}`, bytes);
        }
      } else {
        found.set(name, child.bytes);
      }
    }
    return found;
  }

  // Every file's text, decoded from UTF-8, as a Map from its path to its text, like files().
  texts() {
    const decoder = new TextDecoder();
    return new Map([...this.files()].map(([path, bytes]) => [path, decoder.decode(bytes)]));
  }

  // The path of something named `name` inside this folder, from the top folder, e.g. "Run1/Records".
  childPath(name) {
    return this.path === "" ? name : `${this.path}/${name}`;
  }
}

// A file held in memory, with the part of a browser's file handle that folder-writer uses.
export class MemoryFile {
  // A file named `name`, at `path` from the top folder, holding no bytes yet; `shared` is the top
  // folder's shared record, so writing can be logged.
  constructor(name, path, shared) {
    this.name = name;
    this.path = path;
    this.shared = shared;
    this.bytes = new Uint8Array(0);
  }

  // A writable stream for the file, with write(text) and close(), as a browser's file handle
  // gives. Like a browser's, what's written replaces the file's bytes only when the stream closes.
  async createWritable() {
    const file = this;
    // The bytes written so far, waiting for close.
    const pieces = [];
    return {
      // Adds `text`, as UTF-8, to what the stream will write.
      async write(text) {
        pieces.push(utf8.encode(text));
      },
      // Writes what was added into the file.
      async close() {
        file.bytes = concatenate(pieces);
      },
    };
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
