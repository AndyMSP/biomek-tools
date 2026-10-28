# zip-two-files.zip — golden file for the zip module

A zip of two files, dated `new Date(2026, 9, 28, 1, 57, 32)` (local time):
- `Run/Setup.csv`, text `"a,b\r\n1,2\r\n"` (10 bytes);
- `Run/Stages.csv`, text `"x\r\n"` (3 bytes).

It holds three entries: the folder `Run/`, then the two files (`src/shared/zip/zip.md`, section 3).

**How it was made:** on 2026-10-28, from the transfer designer preview's zip code (a scratch copy,
not the module built later), so that the module's own code doesn't make the file it's tested
against.

**How it was checked**, before it was saved here (2026-10-28):
- Python's `zipfile`: `testzip()` found no errors; the three entries, their sizes, CRC-32s and
  dates read back as above, and both files' text exactly.
- Info-ZIP's `unzip -t`: "No errors detected".
- Its stored time and date are `0x0F30` and `0x5D5C`, as `zip.md` works them out.
- Andy, in Windows Explorer: one folder `Run` holding `Setup.csv` and `Stages.csv`; Extract All
  gave no warning; Notepad showed `Setup.csv` as `a,b` and `1,2`, and `Stages.csv` as `x`, each
  line ending in CRLF and the text in UTF-8.

It is never regenerated or edited to make a test pass (CLAUDE.md, "Testing").
