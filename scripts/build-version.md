# build-version — specification

> **Draft (2026-11-02).** Written from a discussion with Andy on 2026-11-02, after a build sent to
> his manager turned out not to be the latest: every build was called `transfer-designer.html`, so
> old and new looked the same. It becomes Final once built and Andy has used the named builds.

## 1. Purpose
`build-version.js` works out the **version of a build** (ADR 0015), so each built file's name, and
the page inside it, says exactly which build it is. `npm run build` (`scripts/build.js`) uses it.

The versions follow Semantic Versioning 2.0.0 (semver.org), as CLAUDE.md's "Releases" says:
- **a release** is `MAJOR.MINOR.PATCH`, e.g. `0.2.0`;
- **a build between releases** is a **pre-release** of the version being worked towards, e.g.
  `0.2.0-dev.488`, which SemVer orders after the last release (`0.1.0`) and before the release it
  leads to (`0.2.0`);
- **the commit** a build was made from is **build metadata**, after a `+`, e.g.
  `0.2.0-dev.488+3cc65a9`. It's shown in the page, not in the file name (a `+` is awkward in links).

## 2. Scope
Version 1 names the builds of every tool (`build.js`'s `TOOLS`) and gives the page its version.

With it, `package.json` (and `package-lock.json`) go from 0.1.0 to **0.2.0**, the version being worked
towards (`npm version 0.2.0 --no-git-tag-version`), so builds from now on are 0.2.0's pre-releases.

Not in version 1: building from anything but a git clone of the repository (a downloaded zip has no
history to count, so the build stops; section 5).

## 3. Data model

### The facts
The version is worked out from these **facts** about the repository, which `readGitFacts()` reads
with `git` (section 4) and the pure function `buildVersion(facts)` turns into a version:

| Fact | What it is | Read with |
|---|---|---|
| `packageVersion` | `package.json`'s `version`: the version being worked towards, e.g. `"0.2.0"` | the file |
| `lastRelease` | the most recent release tag reachable from the commit, without its `v`, e.g. `"0.1.0"`, or `null` if there's none. A release tag is `v` and `MAJOR.MINOR.PATCH`, e.g. `v0.1.0` (other tags, such as `pre-mixing`, aren't releases). | `git describe --tags --abbrev=0 --match "v[0-9]*.[0-9]*.[0-9]*"` |
| `commitsSince` | how many commits there are since that tag, e.g. `488`; `0` at the tag itself | `git rev-list --count v0.1.0..HEAD` |
| `commit` | the commit, its first 7 characters, e.g. `"3cc65a9"` | `git rev-parse --short=7 HEAD` |
| `branch` | the branch checked out, e.g. `"main"`, or `null` when none is (a detached HEAD) | `git rev-parse --abbrev-ref HEAD` (`"HEAD"` means none) |
| `modified` | `true` if there are changes not committed yet (to tracked files, or new files not ignored) | `git status --porcelain` (any output) |

### The version
`buildVersion(facts)` gives `{ short, full }`: `short` names the file, `full` (`short`, `+`, the
commit) is shown in the page and recorded in saved plan files.

| The build is made… | `short` | `full` |
|---|---|---|
| at a release tag (`commitsSince` 0), unmodified | `0.2.0` | `0.2.0+3cc65a9` |
| on `main` | `0.2.0-dev.488` | `0.2.0-dev.488+3cc65a9` |
| on another branch, e.g. `moving-stages` | `0.2.0-moving-stages.488` | `0.2.0-moving-stages.488+3cc65a9` |
| on no branch (a detached HEAD) | `0.2.0-detached.488` | `0.2.0-detached.488+3cc65a9` |
| with changes not committed, as one of the three above | `0.2.0-dev.488.dirty` | `0.2.0-dev.488.dirty+3cc65a9` |

- **The label** after the `-` is `dev` on `main`, the branch's **label** on another branch, or
  `detached`. (`dev` is the usual label for main-line builds; the branch name, as GitVersion and
  similar tools use; `dirty`, Git's own word for uncommitted changes, as `git describe --dirty`
  writes it.)
- **A branch's label** is its name made fit for a SemVer pre-release identifier: each run of
  characters other than ASCII letters, digits and `-` becomes one `-` (`fix/Mix steps` →
  `fix-Mix-steps`), then `-` at either end is removed. If that leaves nothing, or only digits, or
  `dev`, or `detached`, it's `branch-` and that (`branch-123`, `branch-dev`), so a branch's builds
  never look like `main`'s or like a number.
- **The version** at the front is `packageVersion` in every case, so a build between releases reads
  as a pre-release of the version being worked towards.

### The checks
The build stops, with a message saying what to do (section 5), when:
1. `packageVersion` isn't `MAJOR.MINOR.PATCH` (three whole numbers, no leading zeros, nothing after).
2. There's no release tag (`lastRelease` is `null`): usually a clone made without tags.
3. At a release tag, unmodified: `packageVersion` isn't that release (`package.json` must say
   `0.2.0` when building release `v0.2.0`).
4. At a release tag, modified: the build would be neither the release nor a later build.
5. Anywhere else: `packageVersion` isn't greater than `lastRelease` (compared as SemVer: major,
   then minor, then patch). After a release, `package.json` must move on to the next planned
   version, or the builds that follow would be named as if before the release.

### The file names
`fileNameFor(tool, version)` gives `<tool>-v<short>.html`, e.g. `transfer-designer-v0.2.0-dev.488.html`,
`transfer-designer-v0.2.0.html` for a release.

### What the build does with it (`build.js`)
- Reads the facts once and works out the version before building anything; a check that fails stops
  the build before any file is written.
- **Clears earlier builds**: removes every file in `dist/` named `<tool>.html` or `<tool>-v*.html`
  for each tool in `TOOLS`, so `dist/` holds only the builds just made (Andy, 2026-11-02: the wrong
  file was sent because old and new builds sat side by side). Other files in `dist/` are left alone.
- Writes each tool to `dist/` under `fileNameFor(tool, version)`, and prints each path, as now.
- Gives each page its version: the bundler replaces the name `BUILD_VERSION` in the page scripts with
  `full` as a text constant (esbuild's `define`), so the built file holds it.

### The page's version
A page shows `BUILD_VERSION` when it's built. Served unbuilt during development (`npm run serve`),
there's no `BUILD_VERSION`; the page shows `packageVersion` and `-unbuilt`, e.g. `0.2.0-unbuilt`
(taken from `package.json`, as now). Each page's specification says where it shows it.

## 4. Interface
| Function | Returns |
|---|---|
| `buildVersion(facts)` | `{ short, full }` for `facts` (section 3), e.g. `{ short: "0.2.0-dev.488", full: "0.2.0-dev.488+3cc65a9" }`. Throws the checks' messages (section 5). Pure: no files, no `git`. |
| `branchLabel(branch)` | the label for a branch name, e.g. `"fix/Mix steps"` → `"fix-Mix-steps"`, `"dev"` → `"branch-dev"`. |
| `fileNameFor(tool, version)` | `"<tool>-v<short>.html"`, from `{ short, full }`. |
| `readGitFacts(projectFolder)` | the facts, read with `git` in `projectFolder` and from its `package.json`. Throws section 5's message when it isn't a git repository. |

## 5. Errors
| Problem | Message |
|---|---|
| not a git repository, or `git` isn't there | `Can't work out the build's version: this folder isn't a git clone of the repository (or git isn't installed). Build from a clone.` |
| `packageVersion` isn't `MAJOR.MINOR.PATCH` | `package.json's version must be MAJOR.MINOR.PATCH, like 0.2.0, but it's "0.2".` |
| no release tag | `No release tag (like v0.1.0) was found. Fetch the tags: git fetch --tags` (a clone without history may also need `--unshallow`) |
| at a release tag, `packageVersion` differs | `This commit is release v0.2.0, but package.json says 0.3.0. Build the release from a commit whose package.json says 0.2.0.` |
| at a release tag, modified | `This commit is release v0.2.0, but it has changes not committed yet. Commit or discard them, or build from a later commit.` |
| elsewhere, `packageVersion` not greater than `lastRelease` | `package.json says 0.2.0, but 0.2.0 has been released. Set the next version first: npm version 0.3.0 --no-git-tag-version` (suggesting the next minor version) |

## 6. Test cases
In `scripts/build-version.test.js`, inside `describe("build-version", …)`:
- `buildVersion`: each row of section 3's table, with `full` too. "At a release tag" means
  `commitsSince` is `0` (the nearest release tag is the commit's own), so a release is
  `commitsSince` 0 and unmodified, and the same but modified is refused (check 4).
- The label for `main`, another branch, no branch, and modified on each.
- `branchLabel`: `moving-stages`, `fix/Mix steps`, `--x--`, `feature//a`, `123`, `dev`, `detached`,
  `ünïcode` (→ `n-code`), `///` (→ `branch-`).
- Each check of section 3 refuses with its message, and in the table's order; versions compared as
  numbers (`0.10.0` is greater than `0.9.0`).
- `fileNameFor` for a release and a build between releases.
- SemVer order: for a sample of versions it makes, sorting them as SemVer puts `0.1.0` <
  `0.2.0-dev.5` < `0.2.0-dev.12` < `0.2.0`. (Numbers in a pre-release compare as numbers, so
  `dev.12` is after `dev.5`.)
- `readGitFacts` isn't unit-tested (it runs `git`); it's checked by hand: a build on `main`, on a
  branch, with a change not committed, and at a release tag in a scratch clone.

**The REPL** (`scripts/repl.js`): a topic for `build-version`, with `buildVersion` on a few facts and
`readGitFacts(".")`.
