// records.js — the files for people, rather than the Biomek, that go in the Biomek files' zip
// (ADR 0020): where they go and what they're called.
//
// RECORDS_FOLDER is the folder inside the run's folder that holds them, so the Biomek's own files
// stay as they are. LABWARE_SHEET_FILE_NAME is the labware sheet's file name in it, and
// LABWARE_SHEET_PAGE its page size, in points (72 to the inch): US Letter. Chosen by Andy,
// 2026-11-08. WELL_MAP_SUFFIX is what follows a randomization's name in its well map's file name
// (well-maps.md; 2026-11-08). Data only (ADR 0009). The labware-sheet module's tests check this
// file (labware-sheet.md, section 4), and the well-maps module's check WELL_MAP_SUFFIX.

export const RECORDS_FOLDER = "Records";

export const LABWARE_SHEET_FILE_NAME = "Labware sheet.pdf";

export const LABWARE_SHEET_PAGE = { width: 612, height: 792 };

export const WELL_MAP_SUFFIX = " well map.csv";
