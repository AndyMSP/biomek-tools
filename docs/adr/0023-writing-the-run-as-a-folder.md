# 23. Write files can write the run's folder straight into the Ento folder

Date: 2026-11-10

## Status
Proposed (Andy, 2026-11-10: shaped in a preview on 2026-11-09 and tested on the Biomek PC on
2026-11-10; written in the hands-off workflow, so it stands as a proposal until he merges its pull
request).

## Context
Write files saves one zip holding the run's folder (`transfer-designer-page.md`, section 5; ADR
0020), which the user unzips into the base folder on the Biomek PC, `BASE_FOLDER`
(`config/paths.js`, `C:\Users\Beckman Coulter\Desktop\Ento\`). On 2026-10-28 the zip was chosen
over the alternative, the browser's folder picker, which was never tried. Using the page on the
Biomek PC itself, Andy found the zip a nuisance: find it in the downloads, unzip it, move it to the
right place, and Windows' Extract All puts the folder one level down by default (ADR 0020).

Edge and Chrome let a page ask the user for a folder and write files into it (the File System
Access API: `showDirectoryPicker`). Three things about it shaped the decision:
- **A page can't name a path.** The picker opens only at one of the browser's own starting places
  (the Desktop, Documents, Downloads and so on) or at a folder the user picked before, which the
  page can keep in the browser's database (IndexedDB). It can't open at `BASE_FOLDER`, and it can't
  write anywhere the user hasn't picked. Andy asked for the path in `config/` (he often uses
  private windows, which forget everything); that isn't possible.
- **A page sees a folder's name, not its path.** It can check the folder picked is named `Ento`,
  but not that it's the Desktop's.
- **Firefox and Safari don't offer it**, and a frame that blocks it (the preview artifact) refuses
  it. Lab PCs use Edge or Chrome (CLAUDE.md).

## Decision
- **The Biomek files box offers Save as: Folder or Zip file** (Andy, 2026-11-09). Folder writes the
  run's folder straight into the Ento folder; Zip file is unchanged, for planning on another
  computer. Both hold exactly the same files.
- **Folder is the default**, and the box opens with the last choice (kept in local storage).
- **Only a folder named Ento is accepted** (Andy, 2026-11-09), because the files hold full paths
  into `BASE_FOLDER` and a run written elsewhere wouldn't run. The message names the folder to pick
  (Andy, 2026-11-09: "just say which folder they need to pick").
- **The picker opens in the Ento folder picked before**, kept in the browser's database, and
  otherwise at `BASE_FOLDER_PICKER_START` in `config/paths.js`, the Desktop (Andy, 2026-11-09:
  in config, and keeping the memory "so there's a chance it opens back to Ento"). Tested on the
  Biomek PC, 2026-11-10: it wrote the run and opened back in Ento after a reload.
- **Nothing is overwritten**: a run's folder already in Ento is refused.
- **The writing is a shared module of our own, `folder-writer`** (Claude, 2026-11-10, in the
  hands-off workflow, from the specification review), next to `zip`: it takes the same entries as
  `zip`, checked by `zip`'s own rules, so the folder and the zip can't drift apart, and it's tested
  in Node with a stand-in folder.
- **The tutorials still save a zip only** (Claude, 2026-11-10, in the hands-off workflow): their
  steps save and talk about a zip, and practice files shouldn't go into Ento.

## Consequences
- On the Biomek PC, a run goes from the page to the place the method reads in one step, with no
  zip in the downloads.
- A folder named Ento somewhere other than the Desktop would be accepted; the message after writing
  shows the full path the method expects, and the method's own worklist path would not find it.
- In a private window, or on a first visit, the picker opens on the Desktop and the user clicks
  Ento once. In each new browser session the browser also asks once whether the page may edit
  files there.
- If writing fails part-way, the files already written stay; the message says to delete the folder
  before trying again.
- If another tool comes to write files to the Biomek PC, it can use the same pattern.
