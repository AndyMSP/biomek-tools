// Tests for the transfer designer page's configuration (transfer-designer-page.md, section 16).
// The page itself isn't unit-tested in Node: every rule about plans is in the logic modules, which
// are. These tests check only the configuration files the page uses (ADR 0009), so a typo in
// config/ makes npm test fail rather than reaching the lab. PLAN_FILE_SUFFIX in config/records.js is
// checked here because the page is what uses it (section 5).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { COMPONENT_COLORS } from "../../../config/component-colors.js";
import { DEFAULT_TRANSFER_VOLUME, DEFAULT_FILL_VOLUME } from "../../../config/default-volumes.js";
import { SOURCES_SHOWN } from "../../../config/randomizations.js";
import {
  PLAN_FILE_SUFFIX,
  RECORDS_FOLDER,
  LABWARE_SHEET_FILE_NAME,
  WELL_MAP_SUFFIX,
} from "../../../config/records.js";
import { folderNameFor } from "../../shared/file-writer/file-writer.js";
import { zipFiles } from "../../shared/zip/zip.js";

// How many colors the page offers: "All 30 colors are in use" (transfer-designer-page.md, section 8).
const COLOR_COUNT = 30;

// "#" and six hexadecimal digits, in either case, e.g. "#4e79a7".
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

describe("transfer-designer-page", () => {
  describe("config/component-colors.js", () => {
    test(`COMPONENT_COLORS has ${COLOR_COUNT} entries`, () => {
      assert.ok(Array.isArray(COMPONENT_COLORS));
      assert.equal(COMPONENT_COLORS.length, COLOR_COUNT);
    });

    test("each color is # and six hexadecimal digits", () => {
      for (const color of COMPONENT_COLORS) {
        assert.match(color, COLOR_PATTERN, `${color} isn't a #RRGGBB color`);
      }
    });

    test("no color is repeated, ignoring case", () => {
      const lowerCased = COMPONENT_COLORS.map((color) => color.toLowerCase());
      assert.equal(new Set(lowerCased).size, COMPONENT_COLORS.length);
    });
  });

  describe("config/default-volumes.js", () => {
    test("DEFAULT_TRANSFER_VOLUME is a number above 0", () => {
      assert.equal(typeof DEFAULT_TRANSFER_VOLUME, "number");
      assert.ok(DEFAULT_TRANSFER_VOLUME > 0);
    });

    test("DEFAULT_FILL_VOLUME is a number above 0", () => {
      assert.equal(typeof DEFAULT_FILL_VOLUME, "number");
      assert.ok(DEFAULT_FILL_VOLUME > 0);
    });
  });

  describe("config/randomizations.js", () => {
    test("SOURCES_SHOWN is a whole number of at least 1", () => {
      assert.ok(Number.isInteger(SOURCES_SHOWN));
      assert.ok(SOURCES_SHOWN >= 1);
    });
  });

  describe("config/records.js", () => {
    test("PLAN_FILE_SUFFIX is text ending .json", () => {
      assert.equal(typeof PLAN_FILE_SUFFIX, "string");
      assert.ok(PLAN_FILE_SUFFIX.endsWith(".json"));
    });

    test("a 40-character experiment name's folder name and PLAN_FILE_SUFFIX make a name zip accepts", () => {
      const moment = new Date(2026, 10, 8, 13, 41, 18);
      const folderName = folderNameFor(moment, "E".repeat(40));
      const name = `${folderName}/${RECORDS_FOLDER}/${folderName}${PLAN_FILE_SUFFIX}`;
      assert.doesNotThrow(() => zipFiles([{ name, text: "" }], moment));
    });

    test("PLAN_FILE_SUFFIX differs from the other records' names, so the plan's name can't match one", () => {
      assert.notEqual(PLAN_FILE_SUFFIX, LABWARE_SHEET_FILE_NAME);
      assert.ok(!PLAN_FILE_SUFFIX.endsWith(WELL_MAP_SUFFIX) && !WELL_MAP_SUFFIX.endsWith(PLAN_FILE_SUFFIX));
      assert.ok(!LABWARE_SHEET_FILE_NAME.endsWith(PLAN_FILE_SUFFIX));
    });
  });
});
