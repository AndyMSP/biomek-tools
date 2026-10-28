// paths.js — where the files the file writer makes go on the Biomek PC.
//
// BASE_FOLDER is the folder each run's folder goes inside (file-writer.md, "Outputs"). The file
// writer writes it into the files as the start of every absolute path, so it must be exactly the
// folder on the Biomek PC: a drive letter, a colon and a backslash first, a backslash last. In
// JavaScript text each `\\` is one backslash. Chosen by Andy, 2026-10-28. Data only (ADR 0009). The
// file-writer module's tests check this file (file-writer.md, "Configuration").

export const BASE_FOLDER = "C:\\Users\\Beckman Coulter\\Desktop\\Ento\\";
