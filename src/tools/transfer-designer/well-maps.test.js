// Unit tests for well-maps.js. Each test comes from the "Test cases" section of well-maps.md.
//
// Plans are built with the transfer designer's own edits. Labware is picked from labwareNames() by
// its labware type (the first reservoir, the first two 96-well plates, the first deep-well plate),
// never named, so a change to config/deck.js doesn't break them; file names are built from
// WELL_MAP_SUFFIX (CLAUDE.md, "Tests follow config/").

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { WELL_MAP_SUFFIX, RECORDS_FOLDER } from "../../../config/records.js";
import { labwareNames, labwareTypeOf, gridOf, capacityOf } from "../../shared/deck/deck.js";
import { GRID_96, GRID_1X12_NUMBERED } from "../../shared/well-grid/well-grid.js";
import { zipFiles } from "../../shared/zip/zip.js";
import {
  emptyPlan,
  addComponent,
  addToWells,
  addRandomization,
  setRandomization,
  runRandomization,
  renameRandomization,
  setLabel,
  setWellLabel,
  transfersIn,
  randomizationAt,
} from "./transfer-designer.js";
import { wellMaps } from "./well-maps.js";

// The first reservoir (numbered grid), the first two 96-well plates (both of the first 96-well
// labware's type) and the first 96-well labware of another type (a deep-well plate).
const RESERVOIR = labwareNames().find((name) => gridOf(name) === GRID_1X12_NUMBERED);
const PLATE_TYPE = labwareTypeOf(labwareNames().find((name) => gridOf(name) === GRID_96));
const [PLATE1, PLATE2] = labwareNames().filter((name) => labwareTypeOf(name) === PLATE_TYPE);
const DEEP = labwareNames().find((name) => gridOf(name) === GRID_96 && labwareTypeOf(name) !== PLATE_TYPE);

// The byte order mark, the header line, and a line's ending.
const BOM = "\uFEFF";
const HEADER_LINE = "Plate,Well,Source\r\n";

// A well, e.g. at(RESERVOIR, "9").
function at(labware, well) {
  return { labware, well };
}

// A source, e.g. source(at(RESERVOIR, "9"), 3), or source(at(RESERVOIR, "12"), null, true) for a
// filler well.
function source(end, replicates, filler = false) {
  return { ...end, replicates, filler, sharesTips: false };
}

// Colors for the test's components, one each (a plan's components each have their own).
const COLORS = ["#4e79a7", "#e15759", "#59a14f"];

// An empty plan whose wells `ends` (at most three) each hold a component of their own, full.
function planWithFullWells(ends) {
  let { plan } = emptyPlan();
  ends.forEach((end, index) => {
    const name = `Liquid ${index + 1}`;
    plan = addComponent(plan, name, COLORS[index]);
    plan = addToWells(plan, [end], name, capacityOf(end.labware));
  });
  return plan;
}

// `plan` with a new randomization last, set up with `sources` and `fill`, seed 37 and 10 µL, then
// run: { plan, id }.
function withRunRandomization(plan, sources, fill) {
  const added = addRandomization(plan, null, { seed: 37, volume: 10 });
  const set = setRandomization(added.plan, added.id, { sources, fill });
  return { plan: runRandomization(set, added.id), id: added.id };
}

// The 8 wells of `labware`'s grid starting at B2: B2 to B9.
function eightWells(labware) {
  return gridOf(labware)
    .wellNames()
    .filter((well) => /^B[2-9]$/.test(well))
    .map((well) => at(labware, well));
}

// The example of well-maps.md, section 6: a run randomization named HySoy_dose with sources
// RESERVOIR 9 (labeled "Hy-Soy 100 g/L", 3 replicates) and RESERVOIR 10 (unlabeled, 2 replicates)
// and filler RESERVOIR 12, filling 8 wells of PLATE1, labeled "Cells": { plan, id }.
function examplePlan() {
  let plan = planWithFullWells([at(RESERVOIR, "9"), at(RESERVOIR, "10"), at(RESERVOIR, "12")]);
  plan = setWellLabel(plan, at(RESERVOIR, "9"), "Hy-Soy 100 g/L");
  plan = setLabel(plan, PLATE1, "Cells");
  const sources = [
    source(at(RESERVOIR, "9"), 3),
    source(at(RESERVOIR, "10"), 2),
    source(at(RESERVOIR, "12"), null, true),
  ];
  const run = withRunRandomization(plan, sources, eightWells(PLATE1));
  return { plan: renameRandomization(run.plan, run.id, "HySoy_dose"), id: run.id };
}

// The destination wells of the stage randomization `id` owns for source well `end`, as well names.
function wellsFilledFrom(plan, id, end) {
  const owned = randomizationAt(plan, id).stages.find(
    (entry) => entry.labware === end.labware && entry.well === end.well,
  );
  return transfersIn(plan, owned.stage).map((transfer) => transfer.destination.well);
}

// `wells` (well names of `labware`) in its grid's order.
function inGridOrder(labware, wells) {
  const order = gridOf(labware).wellNames();
  return [...wells].sort((first, second) => order.indexOf(first) - order.indexOf(second));
}

// The data lines of a well map's text: after the BOM and the header, without line endings.
function dataLines(text) {
  return text.slice(BOM.length + HEADER_LINE.length).split("\r\n").slice(0, -1);
}

describe("well-maps", () => {
  test("a plan without randomizations, or with one that hasn't run, gives no well maps", () => {
    const { plan } = emptyPlan();
    assert.deepEqual(wellMaps(plan), []);
    assert.deepEqual(wellMaps(addRandomization(plan, null).plan), []);
  });

  test("a run randomization gives one file, named after it, its sources' wells in grid order and no filler rows", () => {
    const { plan, id } = examplePlan();
    const maps = wellMaps(plan);
    assert.equal(maps.length, 1);
    assert.equal(maps[0].name, `HySoy_dose${WELL_MAP_SUFFIX}`);
    assert.ok(maps[0].text.startsWith(BOM + HEADER_LINE));
    assert.equal(maps[0].text.charCodeAt(0), 0xfeff);
    const labeled = wellsFilledFrom(plan, id, at(RESERVOIR, "9"));
    const unlabeled = wellsFilledFrom(plan, id, at(RESERVOIR, "10"));
    assert.equal(labeled.length, 3);
    assert.equal(unlabeled.length, 2);
    const expected = inGridOrder(PLATE1, [...labeled, ...unlabeled]).map((well) =>
      labeled.includes(well) ? `Cells,${well},Hy-Soy 100 g/L` : `Cells,${well},${RESERVOIR} 10`,
    );
    assert.deepEqual(dataLines(maps[0].text), expected);
  });

  test("rows across two labware come the first labware's first, each in grid order", () => {
    let plan = planWithFullWells([at(RESERVOIR, "1"), at(RESERVOIR, "2")]);
    const fill = [...eightWells(PLATE1).slice(0, 4), ...eightWells(PLATE2).slice(0, 4)];
    const run = withRunRandomization(plan, [source(at(RESERVOIR, "1"), 4), source(at(RESERVOIR, "2"), 4)], fill);
    plan = run.plan;
    const rows = dataLines(wellMaps(plan)[0].text).map((line) => line.split(","));
    assert.deepEqual(rows.map(([plate]) => plate), [PLATE1, PLATE1, PLATE1, PLATE1, PLATE2, PLATE2, PLATE2, PLATE2]);
    for (const labware of [PLATE1, PLATE2]) {
      const wells = rows.filter(([plate]) => plate === labware).map(([, well]) => well);
      assert.deepEqual(wells, inGridOrder(labware, wells));
    }
  });

  test("on a reservoir, wells are numbered and sorted as numbers, 2 before 10", () => {
    const fill = ["2", "10", "3", "11"].map((well) => at(RESERVOIR, well));
    const run = withRunRandomization(
      planWithFullWells([at(DEEP, "A1"), at(DEEP, "A2")]),
      [source(at(DEEP, "A1"), 2), source(at(DEEP, "A2"), 2)],
      fill,
    );
    const wells = dataLines(wellMaps(run.plan)[0].text).map((line) => line.split(",")[1]);
    assert.deepEqual(wells, ["2", "3", "10", "11"]);
  });

  test("an unlabeled destination labware shows its name", () => {
    const run = withRunRandomization(
      planWithFullWells([at(RESERVOIR, "1")]),
      [source(at(RESERVOIR, "1"), 2)],
      eightWells(PLATE1).slice(0, 2),
    );
    for (const line of dataLines(wellMaps(run.plan)[0].text)) {
      assert.ok(line.startsWith(`${PLATE1},`), line);
    }
  });

  test("two randomizations give two files, in the plan's order, each with its own rows", () => {
    let plan = planWithFullWells([at(RESERVOIR, "1"), at(RESERVOIR, "2")]);
    plan = setWellLabel(plan, at(RESERVOIR, "1"), "First");
    plan = setWellLabel(plan, at(RESERVOIR, "2"), "Second");
    const first = withRunRandomization(plan, [source(at(RESERVOIR, "1"), 2)], eightWells(PLATE1).slice(0, 2));
    const second = withRunRandomization(first.plan, [source(at(RESERVOIR, "2"), 3)], eightWells(PLATE2).slice(0, 3));
    plan = renameRandomization(second.plan, second.id, "Later");
    const maps = wellMaps(plan);
    assert.deepEqual(maps.map((map) => map.name), [`Randomization1${WELL_MAP_SUFFIX}`, `Later${WELL_MAP_SUFFIX}`]);
    assert.deepEqual(dataLines(maps[0].text).map((line) => line.split(",")[2]), ["First", "First"]);
    assert.deepEqual(dataLines(maps[1].text).map((line) => line.split(",")[2]), ["Second", "Second", "Second"]);
  });

  test("quoting: a field with a comma or a double quote is quoted, its quotes doubled; µ is written as is", () => {
    let plan = planWithFullWells([at(RESERVOIR, "1"), at(RESERVOIR, "2")]);
    plan = setWellLabel(plan, at(RESERVOIR, "1"), 'Drug "A", 10 mM');
    plan = setWellLabel(plan, at(RESERVOIR, "2"), "Drug B 5 µM");
    const run = withRunRandomization(
      plan,
      [source(at(RESERVOIR, "1"), 1), source(at(RESERVOIR, "2"), 1)],
      eightWells(PLATE1).slice(0, 2),
    );
    const sources = dataLines(wellMaps(run.plan)[0].text).map((line) => line.slice(line.indexOf(",", line.indexOf(",") + 1) + 1));
    assert.deepEqual([...sources].sort(), ['"Drug ""A"", 10 mM"', "Drug B 5 µM"]);
  });

  test("every line ends with CRLF, the last included", () => {
    const { text } = wellMaps(examplePlan().plan)[0];
    assert.ok(text.endsWith("\r\n"));
    const lines = text.slice(BOM.length).split("\r\n");
    assert.equal(lines.at(-1), "");
    for (const line of lines) {
      assert.ok(!line.includes("\n") && !line.includes("\r"), JSON.stringify(line));
    }
    assert.equal(lines.length, 1 + 5 + 1);
  });

  test("two sources with the same well label give rows with the same Source", () => {
    let plan = planWithFullWells([at(RESERVOIR, "1"), at(RESERVOIR, "2")]);
    plan = setWellLabel(plan, at(RESERVOIR, "1"), "Same");
    plan = setWellLabel(plan, at(RESERVOIR, "2"), "Same");
    const run = withRunRandomization(
      plan,
      [source(at(RESERVOIR, "1"), 2), source(at(RESERVOIR, "2"), 2)],
      eightWells(PLATE1).slice(0, 4),
    );
    const sources = dataLines(wellMaps(run.plan)[0].text).map((line) => line.split(",")[2]);
    assert.deepEqual(sources, ["Same", "Same", "Same", "Same"]);
  });

  test("the plan is unchanged afterwards, and each call gives a new list", () => {
    const { plan } = examplePlan();
    const before = JSON.stringify(plan);
    const first = wellMaps(plan);
    assert.equal(JSON.stringify(plan), before);
    assert.notEqual(wellMaps(plan), first);
    assert.deepEqual(wellMaps(plan), first);
  });

  // --- The configuration (config/records.js) ---

  test("WELL_MAP_SUFFIX ends .csv", () => {
    assert.equal(typeof WELL_MAP_SUFFIX, "string");
    assert.ok(WELL_MAP_SUFFIX.endsWith(".csv"));
  });

  test("a 40-character name and WELL_MAP_SUFFIX make a name zip accepts", () => {
    const name = `Run/${RECORDS_FOLDER}/${"R".repeat(40)}${WELL_MAP_SUFFIX}`;
    assert.doesNotThrow(() => zipFiles([{ name, text: "" }], new Date(2026, 10, 8, 13, 41, 18)));
  });
});
