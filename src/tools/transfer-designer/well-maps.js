// well-maps.js — makes each randomization's well map: a CSV file listing, for every well the
// randomization filled from one of its sources, the plate, the well and which source it got, one
// row per well, for data analysis (sorting, filtering and looking up plate-reader results in Excel).
// The page puts each in the Records folder of the run's zip (ADR 0020), named after its
// randomization.
//
// Wells filled from the filler aren't listed: the map holds the wells compared in the analysis
// (Andy, 2026-11-08). The plan is the transfer designer's, already checked, so nothing is checked
// again, and the caller makes well maps only when no randomization is out of date, so each
// randomization's stages match its sources.
// Specification: well-maps.md.

import { WELL_MAP_SUFFIX } from "../../../config/records.js";
import { labwareNames, gridOf } from "../../shared/deck/deck.js";
import { labelOf, wellLabelOf, transfersIn } from "./transfer-designer.js";

// The CSV's header row (well-maps.md, section 3, "The CSV").
const HEADER = ["Plate", "Well", "Source"];

// Every line ends with CRLF, the two characters Windows ends a line with, as the Biomek's files do.
const LINE_ENDING = "\r\n";

// The UTF-8 byte order mark that starts the text: without it Excel reads the file in the wrong
// character set, showing "µ" as "Âµ" (2026-11-08). The zip module stores the text as UTF-8, so the
// file starts with the bytes EF BB BF.
const BYTE_ORDER_MARK = "﻿";

// Matches a character that makes a field need double quotes (RFC 4180): a comma, a double quote,
// or a line break.
const NEEDS_QUOTES = /[",\r\n]/;

// The well maps of `plan`: one { name, text } per randomization that has run (its stages aren't
// empty), in the order of the plan's randomizations; [] if none has run. A new list each time; the
// plan isn't changed.
// e.g. with one run randomization named "HySoy_dose" →
//      [{ name: "HySoy_dose well map.csv", text: "﻿Plate,Well,Source\r\nCells,B2,Hy-Soy 100 g/L\r\n…" }]
export function wellMaps(plan) {
  return plan.randomizations
    .filter((randomization) => randomization.stages.length > 0)
    .map((randomization) => ({
      name: `${randomization.name}${WELL_MAP_SUFFIX}`,
      text: csvText([HEADER, ...wellMapRows(plan, randomization)]),
    }));
}

// The rows of `randomization`'s well map, each [plate, well, source], in deck order then grid
// order: one for each transfer of each stage it owns whose well is one of its sources (not its
// filler).
function wellMapRows(plan, randomization) {
  const sourceKeys = new Set(
    randomization.sources.filter((source) => !source.filler).map((source) => wellKey(source)),
  );
  const entries = [];
  for (const owned of randomization.stages) {
    if (!sourceKeys.has(wellKey(owned))) {
      continue;
    }
    const source = sourceName(plan, owned);
    for (const transfer of transfersIn(plan, owned.stage)) {
      entries.push({ destination: transfer.destination, source });
    }
  }
  return sortedByDeckAndGrid(entries).map(({ destination, source }) => [
    labelOf(plan, destination.labware),
    destination.well,
    source,
  ]);
}

// What the Source column says for source well `end` ({ labware, well }): its well label, or with
// none, its labware's Biomek name, a space and its well name, e.g. "Hy-Soy 100 g/L" or "Res1 9".
// (The Biomek name, not the label, so "Res1 9" reads as a well: a labware label may hold spaces.)
function sourceName(plan, end) {
  return wellLabelOf(plan, end) ?? `${end.labware} ${end.well}`;
}

// `entries` (each with a destination { labware, well }) sorted by the destination's labware in the
// deck's order, then by its well in its grid's order (A1, A2 … A12, B1 …; on a reservoir 1, 2 …
// 12, so 2 comes before 10). A new list; `entries` isn't changed.
function sortedByDeckAndGrid(entries) {
  const deckOrder = labwareNames();
  const placeOf = ({ labware, well }) => ({
    labware: deckOrder.indexOf(labware),
    well: gridOf(labware).wellNames().indexOf(well),
  });
  return entries
    .map((entry) => ({ entry, place: placeOf(entry.destination) }))
    .sort((first, second) => first.place.labware - second.place.labware || first.place.well - second.place.well)
    .map(({ entry }) => entry);
}

// The CSV's text from `rows`, each a list of fields: the byte order mark, then one line per row,
// every line ending with CRLF, the last included.
function csvText(rows) {
  const lines = rows.map((fields) => fields.map(csvField).join(","));
  return BYTE_ORDER_MARK + lines.map((line) => line + LINE_ENDING).join("");
}

// One field as a well map writes it (RFC 4180): as it is, or, if it holds a comma, a double quote
// or a line break, in double quotes with each double quote inside doubled,
// e.g. 'Drug "A", 10 mM' → '"Drug ""A"", 10 mM"', "B2" → "B2".
function csvField(text) {
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// One text key for a well, for looking it up in a Set, e.g. { labware: "Res1", well: "9" } →
// '["Res1","9"]'. A JSON list keeps the two names apart.
function wellKey({ labware, well }) {
  return JSON.stringify([labware, well]);
}
