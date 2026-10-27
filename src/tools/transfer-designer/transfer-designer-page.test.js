// Tests for the transfer designer page's configuration (transfer-designer-page.md, section 16).
// The page itself isn't unit-tested in Node: every rule about plans is in the logic modules, which
// are. These tests check only the two configuration files the page uses (ADR 0009), so a typo in
// config/ makes npm test fail rather than reaching the lab.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { COMPONENT_COLORS } from "../../../config/component-colors.js";
import { DEFAULT_TRANSFER_VOLUME, DEFAULT_FILL_VOLUME } from "../../../config/default-volumes.js";

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
});
