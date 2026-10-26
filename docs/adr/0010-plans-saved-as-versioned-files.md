# 10. Plans are saved as files, with a format name and version

Date: 2026-10-26

## Status
Accepted (Andy, 2026-10-25, while shaping the transfer designer preview).

## Context
A plan (`docs/glossary.md`) is built up over an hour or more: components, starting contents,
stages, tip changes and transfers. Until now it lived only in the page while it was open, so
closing or reloading the page lost it, and it couldn't be kept with an experiment's records or
opened on another computer. Saving and loading plans was on the roadmap's "Later" list; while
shaping the preview, Andy asked for it now, because the plan should persist (and the plan already
holds everything worth saving: components with their colors, tip changes and labware labels were
moved into it for undo).

Three places to keep a saved plan were considered:
- **A file** the user saves and opens. It can be kept with the experiment's records, sent to
  someone, or opened on any lab PC, and nothing is lost if the browser's data is cleared.
- **The browser's own storage.** Quicker, but it stays on one PC and one browser, and clearing
  browser data deletes it.
- **Both**: files for keeping and sharing, plus an automatic browser copy against reloads.

## Decision
**A plan is saved as a file** (Andy, 2026-10-25), a **plan file** (`docs/glossary.md`), **and the
page also keeps a browser copy** as a safety net (Andy, 2026-10-26): the third option.

- **Plain data in JSON**, a standard text format for data, so the file is readable, and needs
  nothing installed to write or read (the tools must run in Edge or Chrome with nothing installed).
- **The file names its format and version**: a format name (`"biomek-tools transfer plan"`) and a
  version number, starting at 1. A later version of the tools that changes the file's contents
  raises the version and can still recognize older files; a file with a version the tools don't
  know is refused with a message saying why, e.g. that a newer version of the tool saved it.
- **The format version isn't the tools' version** (Andy, 2026-10-26). The tools' version (v0.2.0,
  v0.3.0 …) changes with every release, whatever changed; the format version changes only when
  what a plan file holds changes. Kept apart, "can this file be opened?" is just "is its format
  version one the tools know?", with no table of which tool versions wrote which format. (This is
  usual practice, often called a format or schema version.)
- **The file also records which tool and version saved it** (e.g. "transfer designer v0.2.0"),
  for information only, such as finding where a troublesome file came from. It never decides
  whether a file opens.
- **Opening a file checks everything in it** through the same rules as the user's own edits
  (component names and colors, stage settings, transfers, wells on the deck, starting contents,
  tip types, labels), and says what's wrong and where if anything is (CLAUDE.md, "Validate
  input"). A file that fails isn't opened in part.
- **Stage IDs aren't kept.** The stage list makes its own IDs and can't be given one (ADR 0008,
  `stage-list.md`), so opening a file adds its stages afresh and renumbers them, in the file's
  order; the transfers, tip changes and planned places in the file follow them. (Since ADR 0011, the
  file holds its stages in stage order and has no planned places.)
- **Opening a plan replaces the one shown, as one undoable edit.**
- **A browser copy** (Andy, 2026-10-26). After every change, the page copies the plan into the
  browser's local storage (storage each web page gets in the browser, kept between visits), in the
  same form as a plan file. When the page opens, it quietly brings that copy back, through the same
  checks as opening a file; a copy that can't be read is left out, with a note. Saving a file
  doesn't touch the copy. The plan file stays the record: the copy only guards against reloading or
  closing the page by mistake.

The file's exact contents are set in the transfer designer's logic specification
(`transfer-designer.md`), which reads and writes them. (Since the transfer designer's logic was
split into modules, 2026-10-26, that's `plan-file.md`.)

## Consequences
- Plans can be kept, shared and opened on another computer.
- Every change to what a plan holds must also decide what happens to plan files saved before it:
  raise the version, and either keep reading the older version or say it can't be opened.
- Only the plan is saved, not how the page was being viewed (which stage is open, which labware
  is brought out).
- Reloading or closing the page by mistake loses nothing: the browser copy brings the plan back.
- The browser copy has limits, so it doesn't replace saving files: it lives in one browser on one
  computer; it's lost if browsing data is cleared, and isn't kept in a private window; and it holds
  one plan per browser, so two people using the tool in the same browser share it.
- In the preview, opening and saving were tried in an exported copy of the page, opened from
  Andy's computer (2026-10-25): the artifact viewer the preview is published in can't save files.
