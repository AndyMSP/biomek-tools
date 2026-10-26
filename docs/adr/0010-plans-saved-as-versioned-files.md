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
**A plan is saved as a file** (Andy, 2026-10-25), a **plan file** (`docs/glossary.md`).

- **Plain data in JSON**, a standard text format for data, so the file is readable, and needs
  nothing installed to write or read (the tools must run in Edge or Chrome with nothing installed).
- **The file names its format and version**: a format name (`"biomek-tools transfer plan"`) and a
  version number, starting at 1. A later version of the tools that changes the file's contents
  raises the version and can still recognize older files; a file with a version the tools don't
  know is refused with a message saying why, e.g. that a newer version of the tool saved it.
- **Opening a file checks everything in it** through the same rules as the user's own edits
  (component names and colors, stage settings, transfers, wells on the deck, starting contents,
  tip types, labels), and says what's wrong and where if anything is (CLAUDE.md, "Validate
  input"). A file that fails isn't opened in part.
- **Stage IDs aren't kept.** The stage list makes its own IDs and can't be given one (ADR 0008,
  `stage-list.md`), so opening a file adds its stages afresh and renumbers them, in the file's
  order; the transfers, tip changes and planned places in the file follow them.
- **Opening a plan replaces the one shown, as one undoable edit.**

The file's exact contents are set in the transfer designer's logic specification
(`transfer-designer.md`), which reads and writes them.

## Consequences
- Plans can be kept, shared and opened on another computer.
- Every change to what a plan holds must also decide what happens to plan files saved before it:
  raise the version, and either keep reading the older version or say it can't be opened.
- Only the plan is saved, not how the page was being viewed (which stage is open, which labware
  is brought out).
- Nothing is saved automatically: reloading or closing the page still loses changes made since the
  last save. An automatic browser copy (the third option) can be added later if that becomes a
  problem (roadmap, "Later").
- In the preview, opening and saving were tried in an exported copy of the page, opened from
  Andy's computer (2026-10-25): the artifact viewer the preview is published in can't save files.
