// Unit tests for concentrations.js. Each test comes from the "Test cases" section of
// concentrations.md.
//
// Tests follow config/ (CLAUDE.md): a test names a unit by its symbol, as the specification's
// examples do, but takes everything else about it (its factor, its family, the family's base and
// smallest units, the offered list) from config/concentration-units.js, so changing the file never
// breaks a behavior test. Only section 7's tests, at the end, check what the file holds.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  CONCENTRATION_UNITS,
  DEFAULT_CONCENTRATION_UNIT,
  CELL_DENSITY_UNIT,
} from "../../../config/concentration-units.js";
import {
  checkConstituents,
  familyOf,
  unitsOf,
  wellConcentrations,
  bestUnit,
  isCellFamily,
  seedingDensity,
} from "./concentrations.js";

// The configuration's entry for the unit with symbol `unit`, e.g. entryOf("mM").factor → 1e-3.
function entryOf(unit) {
  const entry = CONCENTRATION_UNITS.find((candidate) => candidate.unit === unit);
  assert.ok(entry, `${unit} is in the configuration`);
  return entry;
}

// The factor of the unit with symbol `unit`, from the file.
function factor(unit) {
  return entryOf(unit).factor;
}

// The configuration's entries for `family`, in the file's order.
function entriesOf(family) {
  return CONCENTRATION_UNITS.filter((entry) => entry.family === family);
}

// The family's base unit (factor 1), e.g. baseUnitOf("molar") → "M".
function baseUnitOf(family) {
  return entriesOf(family).find((entry) => entry.factor === 1).unit;
}

// The family's smallest unit: the last of the family in the file, e.g. smallestUnitOf("molar").
function smallestUnitOf(family) {
  const entries = entriesOf(family);
  return entries[entries.length - 1].unit;
}

// The offered units' symbols, in the file's order, joined as a message lists them.
function offeredList() {
  return CONCENTRATION_UNITS.filter((entry) => entry.offered)
    .map((entry) => entry.unit)
    .join(", ");
}

// The symbol of a unit of `family` that isn't the base unit, if there is one, e.g. "mM" for molar.
function aSubunitOf(family) {
  return entriesOf(family).find((entry) => entry.factor !== 1)?.unit;
}

// The families in the configuration, each once, in the file's order.
const FAMILIES = [...new Set(CONCENTRATION_UNITS.map((entry) => entry.family))];

// A family with more than one unit, and one with exactly one, for the display tests.
const MULTI_UNIT_FAMILY = FAMILIES.find((family) => entriesOf(family).length > 1);
const ONE_UNIT_FAMILY = FAMILIES.find((family) => entriesOf(family).length === 1);

// Whether `actual` is within 1e-12 of `expected`, relative to the value (section 6).
function assertClose(actual, expected) {
  const tolerance = Math.abs(expected) * 1e-12;
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is within 1e-12 of ${expected}`,
  );
}

// A component { name, constituents } for the concentration tests.
function component(name, constituents) {
  return { name, constituents };
}

// One constituent { name, amount, unit }.
function constituent(name, amount, unit) {
  return { name, amount, unit };
}

describe("concentrations", () => {
  describe("checking constituents", () => {
    test("an empty list gives an empty list", () => {
      assert.deepEqual(checkConstituents([]), []);
    });

    test("a valid list comes back equal, with names trimmed", () => {
      const result = checkConstituents([
        constituent(" Dye ", 10, "mM"),
        constituent("Hy-Soy", 4, "g/L"),
      ]);
      assert.deepEqual(result, [constituent("Dye", 10, "mM"), constituent("Hy-Soy", 4, "g/L")]);
    });

    test("the list isn't changed by the check", () => {
      const input = [constituent(" Dye ", 10, "mM")];
      const copy = JSON.parse(JSON.stringify(input));
      checkConstituents(input);
      assert.deepEqual(input, copy);
    });

    test("the result is a new list of new objects", () => {
      const input = [constituent("Dye", 10, "mM")];
      const result = checkConstituents(input);
      assert.notEqual(result, input);
      assert.notEqual(result[0], input[0]);
      result.push(constituent("Other", 1, "mM"));
      result[0].amount = 99;
      assert.deepEqual(input, [constituent("Dye", 10, "mM")]);
      input[0].amount = 5;
      assert.equal(result[0].amount, 99);
    });

    test("something that isn't a list is refused", () => {
      const message = (got) =>
        `A component's constituents must be a list, like [{ name: "Dye", amount: 10, unit: "mM" }], but got ${got}.`;
      assert.throws(() => checkConstituents(null), { message: message("null") });
      assert.throws(() => checkConstituents({}), { message: message("an object") });
      assert.throws(() => checkConstituents("Dye"), { message: message('"Dye"') });
    });

    test("an entry that isn't an object is refused, numbered from 1", () => {
      const message = (number, got) =>
        `Constituent ${number} must be an object with a name, an amount and a unit, but got ${got}.`;
      assert.throws(() => checkConstituents([null]), { message: message(1, "null") });
      assert.throws(() => checkConstituents([constituent("Dye", 10, "mM"), 5]), {
        message: message(2, "5"),
      });
      assert.throws(() => checkConstituents([[]]), { message: message(1, "a list") });
    });

    test("missing properties are refused, listed in name, amount, unit order", () => {
      assert.throws(() => checkConstituents([{ name: "Dye", amount: 10 }]), {
        message: 'Constituent 1 needs name, amount and unit, but is missing "unit".',
      });
      assert.throws(() => checkConstituents([constituent("Dye", 10, "mM"), { name: "Dye" }]), {
        message: 'Constituent 2 needs name, amount and unit, but is missing "amount", "unit".',
      });
    });

    test("extra properties are refused", () => {
      assert.throws(() => checkConstituents([{ ...constituent("Dye", 10, "mM"), volume: 5 }]), {
        message: 'Constituent 1 can only have name, amount and unit, but also got "volume".',
      });
    });

    test("a name that isn't a name is refused with checkName's message", () => {
      assert.throws(() => checkConstituents([constituent("", 10, "mM")]), {
        message: "The constituent name is blank. Give it at least one character that isn't a space.",
      });
      assert.throws(() => checkConstituents([constituent("   ", 10, "mM")]), {
        message: "The constituent name is blank. Give it at least one character that isn't a space.",
      });
      assert.throws(() => checkConstituents([constituent(5, 10, "mM")]), {
        message: "The constituent name must be text, but got 5.",
      });
    });

    test("the same name twice is refused at the later entry, trimmed", () => {
      assert.throws(
        () => checkConstituents([constituent("Dye", 10, "mM"), constituent("Dye", 5, "mM")]),
        { message: '"Dye" is listed twice. List each constituent once.' },
      );
      assert.throws(
        () => checkConstituents([constituent("Dye", 10, "mM"), constituent(" Dye", 5, "mM")]),
        { message: '"Dye" is listed twice. List each constituent once.' },
      );
    });

    test("a repeated name is reported before the entry's amount and unit, after its name", () => {
      assert.throws(
        () => checkConstituents([constituent("Dye", 10, "mM"), constituent("Dye", 0, "mM")]),
        { message: '"Dye" is listed twice. List each constituent once.' },
      );
      assert.throws(
        () => checkConstituents([constituent("Dye", 10, "mM"), constituent("", 0, "mM")]),
        { message: /constituent name/ },
      );
    });

    test("an amount that isn't a number above 0 is refused", () => {
      const message = (got) => `The amount of "Dye" must be a number above 0, like 10, but got ${got}.`;
      for (const [amount, shown] of [
        ["10", '"10"'],
        [0, "0"],
        [-1, "-1"],
        [NaN, "NaN"],
        [Infinity, "Infinity"],
      ]) {
        assert.throws(() => checkConstituents([constituent("Dye", amount, "mM")]), {
          message: message(shown),
        });
      }
    });

    test("a unit not in the configuration is refused, listing the offered units", () => {
      const message = (got) => `The unit of "Dye" must be one of ${offeredList()}, but got ${got}.`;
      assert.throws(() => checkConstituents([constituent("Dye", 10, "mg/mL")]), {
        message: message('"mg/mL"'),
      });
      // A unit differing only in case isn't the unit.
      const wrongCase = CONCENTRATION_UNITS.map((entry) => entry.unit).find(
        (unit) => unit.toUpperCase() !== unit,
      );
      const upper = wrongCase.toUpperCase();
      assert.ok(!CONCENTRATION_UNITS.some((entry) => entry.unit === upper));
      assert.throws(() => checkConstituents([constituent("Dye", 10, upper)]), {
        message: message(`"${upper}"`),
      });
    });

    test("checks run in order: constituent 1 before constituent 2, name before amount", () => {
      assert.throws(() => checkConstituents([constituent("", 0, "mM"), 5]), {
        message: "The constituent name is blank. Give it at least one character that isn't a space.",
      });
      assert.throws(() => checkConstituents([constituent(5, "ten", "mM")]), {
        message: "The constituent name must be text, but got 5.",
      });
    });
  });

  describe("a well's concentrations", () => {
    const base = baseUnitOf(MULTI_UNIT_FAMILY);
    const sub = aSubunitOf(MULTI_UNIT_FAMILY);

    test("one component with one constituent, share 0.2 at 10 of a unit", () => {
      const result = wellConcentrations({ Stock: 0.2, Media: 0.8 }, [
        component("Stock", [constituent("Dye", 10, sub)]),
        component("Media", []),
      ]);
      assert.equal(result.length, 1);
      assert.equal(result[0].name, "Dye");
      assert.equal(result[0].family, MULTI_UNIT_FAMILY);
      assertClose(result[0].value, 0.2 * 10 * factor(sub));
    });

    test("share 1 gives the amount in the base unit", () => {
      const result = wellConcentrations({ Media: 1 }, [
        component("Media", [constituent("Hy-Soy", 4, base)]),
      ]);
      assert.deepEqual(result, [{ name: "Hy-Soy", family: MULTI_UNIT_FAMILY, value: 4 }]);
    });

    test("two components carrying the same constituent in the same family add", () => {
      const result = wellConcentrations({ A: 0.5, B: 0.25 }, [
        component("A", [constituent("Hy-Soy", 4, base)]),
        component("B", [constituent("Hy-Soy", 2, base)]),
      ]);
      assert.equal(result.length, 1);
      assertClose(result[0].value, 0.5 * 4 + 0.25 * 2);
    });

    test("the same name in two families gives two entries, in the order first met", () => {
      const [familyA, familyB] = FAMILIES;
      const unitA = baseUnitOf(familyA);
      const unitB = baseUnitOf(familyB);
      const result = wellConcentrations({ A: 0.5, B: 0.5 }, [
        component("A", [constituent("Drug", 2, unitA)]),
        component("B", [constituent("Drug", 4, unitB)]),
      ]);
      assert.equal(result.length, 2);
      assert.deepEqual(
        result.map((entry) => [entry.name, entry.family]),
        [
          ["Drug", familyA],
          ["Drug", familyB],
        ],
      );
      assertClose(result[0].value, 0.5 * 2 * factor(unitA));
      assertClose(result[1].value, 0.5 * 4 * factor(unitB));
    });

    test("different units of one family add in the base unit", () => {
      const result = wellConcentrations({ A: 0.5, B: 0.5 }, [
        component("A", [constituent("Dye", 1, base)]),
        component("B", [constituent("Dye", 500, sub)]),
      ]);
      assert.equal(result.length, 1);
      assertClose(result[0].value, 0.5 * 1 * factor(base) + 0.5 * 500 * factor(sub));
    });

    test("a component with no share, a share of 0, no constituents or no property contributes nothing", () => {
      const dye = [constituent("Dye", 10, base)];
      assert.deepEqual(
        wellConcentrations({ Media: 1, Zero: 0 }, [
          component("Stock", dye),
          component("Zero", dye),
          component("Media", []),
          { name: "Bare" },
        ]),
        [],
      );
      assert.deepEqual(wellConcentrations({}, [component("Stock", dye)]), []);
    });

    test("a share whose name is no component's is ignored", () => {
      assert.deepEqual(wellConcentrations({ Ghost: 1 }, []), []);
    });

    test("entries come in the order the (name, family) pairs are first met", () => {
      const result = wellConcentrations({ A: 0.5, B: 0.5 }, [
        component("A", [constituent("X", 1, base), constituent("Y", 1, base)]),
        component("B", [constituent("Z", 1, base), constituent("X", 1, base)]),
      ]);
      assert.deepEqual(
        result.map((entry) => entry.name),
        ["X", "Y", "Z"],
      );
    });

    test("inputs aren't changed", () => {
      const shares = { A: 0.5, B: 0.5 };
      const components = [
        component("A", [constituent("X", 1, base)]),
        component("B", [constituent("X", 1, sub)]),
      ];
      const sharesCopy = JSON.parse(JSON.stringify(shares));
      const componentsCopy = JSON.parse(JSON.stringify(components));
      wellConcentrations(shares, components);
      assert.deepEqual(shares, sharesCopy);
      assert.deepEqual(components, componentsCopy);
    });
  });

  describe("the unit to show", () => {
    // The specification's examples, each as a value in a unit of the file: the amount and unit
    // given are converted to the base unit through the file's factor, and the shown pair is the
    // expected result.
    const examples = [
      [476, "µM"],
      [2, "mM"],
      [2.5, "M"],
      [4, "g/L"],
      [7.5, "mg/L"],
      [0.5, "%"],
      [150, "×"],
    ];
    for (const [amount, unit] of examples) {
      test(`${amount} ${unit} shows as ${amount} ${unit}`, () => {
        const result = bestUnit(familyOf(unit), amount * factor(unit));
        assert.equal(result.unit, unit);
        assertClose(result.amount, amount);
      });
    }

    test("below 1 of the smallest unit still shows the smallest unit", () => {
      const smallest = smallestUnitOf(MULTI_UNIT_FAMILY);
      const result = bestUnit(MULTI_UNIT_FAMILY, 0.5 * factor(smallest));
      assert.equal(result.unit, smallest);
      assertClose(result.amount, 0.5);
      const massSmallest = smallestUnitOf(familyOf("g/L"));
      const mass = bestUnit(familyOf("g/L"), 0.0075 * factor(massSmallest));
      assert.equal(mass.unit, massSmallest);
      assertClose(mass.amount, 0.0075);
    });

    test("a one-unit family always shows its unit", () => {
      const unit = entriesOf(ONE_UNIT_FAMILY)[0].unit;
      assert.deepEqual(bestUnit(ONE_UNIT_FAMILY, 0.5), { amount: 0.5, unit });
      assert.deepEqual(bestUnit(ONE_UNIT_FAMILY, 150), { amount: 150, unit });
    });

    test("a value within 1e-12 of a unit's boundary rounds up to that unit", () => {
      const unit = aSubunitOf(MULTI_UNIT_FAMILY);
      const result = bestUnit(MULTI_UNIT_FAMILY, factor(unit) * 0.99999999999999);
      assert.equal(result.unit, unit);
      assertClose(result.amount, 1);
    });

    test("an unknown family throws", () => {
      assert.throws(() => bestUnit("volume", 1), {
        message: '"volume" isn\'t a family of concentration units.',
      });
    });
  });

  describe("familyOf and unitsOf", () => {
    test("every configured unit gives its family", () => {
      for (const entry of CONCENTRATION_UNITS) {
        assert.equal(familyOf(entry.unit), entry.family);
      }
    });

    test("an unknown unit throws", () => {
      assert.throws(() => familyOf("mg/mL"), { message: '"mg/mL" isn\'t a concentration unit.' });
    });

    test("every family gives its units, offered first, each group in the file's order", () => {
      for (const family of FAMILIES) {
        const entries = entriesOf(family);
        const expected = [
          ...entries.filter((entry) => entry.offered),
          ...entries.filter((entry) => !entry.offered),
        ].map((entry) => entry.unit);
        assert.deepEqual(unitsOf(family), expected);
      }
    });

    test("an unknown family throws", () => {
      assert.throws(() => unitsOf("volume"), {
        message: '"volume" isn\'t a family of concentration units.',
      });
    });

    test("the list is a new one each time", () => {
      const first = unitsOf(FAMILIES[0]);
      const second = unitsOf(FAMILIES[0]);
      assert.notEqual(first, second);
      first.push("extra");
      assert.deepEqual(unitsOf(FAMILIES[0]), second);
    });
  });

  // Cells (concentrations.md, "Cells"): the unit is always CELL_DENSITY_UNIT from the file.
  describe("cells", () => {
    const cellFamily = familyOf(CELL_DENSITY_UNIT);

    test("a list with cells is accepted, the amount in exponent form too", () => {
      const cells = [constituent("Cells", 1500000, CELL_DENSITY_UNIT)];
      assert.deepEqual(checkConstituents(cells), cells);
      assert.deepEqual(checkConstituents([constituent("Cells", 1.5e6, CELL_DENSITY_UNIT)]), cells);
    });

    test("isCellFamily is true only for the cells' family, and never throws", () => {
      assert.equal(isCellFamily(cellFamily), true);
      for (const family of FAMILIES.filter((candidate) => candidate !== cellFamily)) {
        assert.equal(isCellFamily(family), false);
      }
      for (const other of ["volume", "", null, 5]) {
        assert.equal(isCellFamily(other), false);
      }
    });

    test("the cells' family has the one unit", () => {
      assert.deepEqual(unitsOf(cellFamily), [CELL_DENSITY_UNIT]);
    });

    test("a well 10% from a suspension carries a tenth of its cells", () => {
      const result = wellConcentrations({ Suspension: 0.1, Media: 0.9 }, [
        component("Suspension", [constituent("Cells", 1500000, CELL_DENSITY_UNIT)]),
        component("Media", []),
      ]);
      assert.equal(result.length, 1);
      assert.equal(result[0].name, "Cells");
      assert.equal(result[0].family, cellFamily);
      assertClose(result[0].value, 0.1 * 1500000);
    });

    test("cells from two components add", () => {
      const result = wellConcentrations({ A: 0.1, B: 0.2 }, [
        component("A", [constituent("Cells", 1500000, CELL_DENSITY_UNIT)]),
        component("B", [constituent("Cells", 500000, CELL_DENSITY_UNIT)]),
      ]);
      assert.equal(result.length, 1);
      assertClose(result[0].value, 0.1 * 1500000 + 0.2 * 500000);
    });

    test("cells are never rescaled", () => {
      for (const value of [0.5, 1500, 1.5e9]) {
        assert.deepEqual(bestUnit(cellFamily, value), { amount: value, unit: CELL_DENSITY_UNIT });
      }
    });

    test("seedingDensity is the cell density times the volume in mL over the growth area", () => {
      assert.equal(seedingDensity(150000, 100, 0.32), (150000 * (100 / 1000)) / 0.32);
      assert.equal(seedingDensity(150000, 100, 0.32), 46875);
      assert.equal(seedingDensity(0, 100, 0.32), 0);
    });

    test("doubling the volume doubles the seeding density; doubling the area halves it", () => {
      const base = seedingDensity(150000, 100, 0.32);
      assertClose(seedingDensity(150000, 200, 0.32), 2 * base);
      assertClose(seedingDensity(150000, 100, 0.64), base / 2);
    });
  });

  // Checks of config/concentration-units.js itself (concentrations.md, section 7; ADR 0009).
  describe("config/concentration-units.js", () => {
    test("every entry has exactly unit, family, factor and offered, well formed", () => {
      for (const entry of CONCENTRATION_UNITS) {
        assert.deepEqual(Object.keys(entry).sort(), ["factor", "family", "offered", "unit"]);
        assert.equal(typeof entry.unit, "string");
        assert.notEqual(entry.unit.trim(), "");
        assert.equal(typeof entry.family, "string");
        assert.notEqual(entry.family.trim(), "");
        assert.ok(Number.isFinite(entry.factor) && entry.factor > 0);
        assert.equal(typeof entry.offered, "boolean");
      }
    });

    test("unit symbols are unique ignoring case", () => {
      const lowered = CONCENTRATION_UNITS.map((entry) => entry.unit.toLowerCase());
      assert.equal(new Set(lowered).size, lowered.length);
    });

    test("each family has exactly one base unit and factors go down along the list", () => {
      for (const family of FAMILIES) {
        const entries = entriesOf(family);
        assert.equal(entries.filter((entry) => entry.factor === 1).length, 1);
        for (let index = 1; index < entries.length; index += 1) {
          assert.ok(entries[index].factor < entries[index - 1].factor);
        }
      }
    });

    test("every family has at least one offered unit", () => {
      for (const family of FAMILIES) {
        assert.ok(entriesOf(family).some((entry) => entry.offered));
      }
    });

    test("DEFAULT_CONCENTRATION_UNIT is an offered unit", () => {
      const entry = CONCENTRATION_UNITS.find((candidate) => candidate.unit === DEFAULT_CONCENTRATION_UNIT);
      assert.ok(entry);
      assert.equal(entry.offered, true);
    });

    test("CELL_DENSITY_UNIT is an offered unit, with factor 1, the only unit of its family", () => {
      const entry = CONCENTRATION_UNITS.find((candidate) => candidate.unit === CELL_DENSITY_UNIT);
      assert.ok(entry);
      assert.equal(entry.offered, true);
      assert.equal(entry.factor, 1);
      assert.deepEqual(entriesOf(entry.family), [entry]);
    });
  });
});
