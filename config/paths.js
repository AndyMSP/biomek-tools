// paths.js — where the files the file writer makes go on the Biomek PC.
//
// BASE_FOLDER is the folder each run's folder goes inside (file-writer.md, "Outputs"). The file
// writer writes it into the files as the start of every absolute path, so it must be exactly the
// folder on the Biomek PC: a drive letter, a colon and a backslash first, a backslash last. In
// JavaScript text each `\\` is one backslash. Chosen by Andy, 2026-10-28. The transfer designer
// page calls its last folder name ("Ento") the Ento folder, and writes a run's folder into it
// (transfer-designer-page.md, section 5). The file-writer module's tests check it
// (file-writer.md, "Configuration").
//
// BASE_FOLDER_PICKER_START is where the browser's folder picker opens when the page remembers no
// Ento folder (transfer-designer-page.md, section 5; ADR 0023). Chosen by Andy, 2026-11-10. A page
// can't open the picker at a path such as BASE_FOLDER: browsers accept only one of their own
// starting places, by name ("desktop", "documents", "downloads", "music", "pictures" or "videos"),
// or a folder picked before. The Desktop is the nearest to BASE_FOLDER. The transfer designer
// page's tests check it (transfer-designer-page.md, section 16), as the page is what uses it.
//
// Data only (ADR 0009).

export const BASE_FOLDER = "C:\\Users\\Beckman Coulter\\Desktop\\Ento\\";

export const BASE_FOLDER_PICKER_START = "desktop";
