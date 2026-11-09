// tutorial.walk.js — the tutorials' browser walk-throughs (tutorial-page.md, section 9), run by
// `npm run test:browser`, not by `npm test` (whose node --test runs only *.test.js files).
//
// With Playwright, against the built tutorial file in dist/ (built first if there's none), it does
// every step of every tutorial as a user would: clicks, drags, typing, right-clicks, hovering, the
// clipboard, the transfer table wizard and the randomization card. Before each step's actions it
// checks the ring is on the element the step names (the element marked data-tutorial-target, and
// the ring over it); after, that the status line says ✓ Done; then it presses Next. With a dialog
// open, it checks the panel doesn't cover the dialog's main button. It also checks that Next
// tutorial starts the next tutorial, that tutorial 2 started from the menu holds the plan tutorial
// 1 ends with, that the real Transfer Designer's storage name is never written, and that the page
// throws no error. At two window sizes: 1500 × 950 and 1366 × 768. It also checks that presses on
// the panel leave what the page has open as it was, and that the Transfer Designer's own build has
// no panel and keeps its plan under its own storage name.
// It uses Chrome if it's installed, otherwise Playwright's own Chromium (`npx playwright install
// chromium` once).
//
// Run it with: npm run test:browser          (every tutorial, both sizes)
//              npm run test:browser -- 3      (only tutorial 3, both sizes)
//              npm run test:browser -- 3 --shots   (and save a screenshot after each step in
//                                                    dist/walk-shots/)

import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

// The project's folder and dist/.
const PROJECT_FOLDER = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const DIST = resolve(PROJECT_FOLDER, "dist");

// The window sizes the walk-throughs run at.
const SIZES = [
  { width: 1500, height: 950 },
  { width: 1366, height: 768 },
];

// The storage name of the real Transfer Designer's plan, which the tutorial must never write.
const REAL_PLAN_KEY = "biomek-tools transfer designer: plan";

// The tutorial's own plan storage name.
const TUTORIAL_PLAN_KEY = "biomek-tools transfer designer tutorial: plan";

// How long to wait for the panel to catch up with the page (it redraws every 250 ms).
const SETTLE = 350;

// Which tutorials to walk (from the command line: their numbers), and whether to save screenshots.
const onlyTutorials = process.argv.slice(2).filter((arg) => /^\d+$/.test(arg)).map(Number);
const takeShots = process.argv.includes("--shots");

// --- Selectors ---

// A well on the deck.
function well(labware, name) {
  return `.well[data-labware="${labware}"][data-well="${name}"]`;
}

// A labware's chip in the tray.
function chip(labware) {
  return `.labware-chip[data-labware="${labware}"]`;
}

// A labware's label button.
function labelButton(labware) {
  return `.labware[data-labware="${labware}"] .label-button`;
}

// Start, a stage or End in the Stages column.
function entry(key) {
  return `.entry[data-entry="${key}"]`;
}

// The seam just above End.
const END_SEAM = `.group-seam:has(+ ${entry("end")})`;

// A component's chip in the Start card.
function componentChip(name) {
  return `.component-chip:has(> span:text-is("${name}"))`;
}

// --- Checks ---

// Fails the walk with `message`, naming where it was.
class WalkFailure extends Error {}

// Throws a WalkFailure unless `condition` holds.
function check(condition, message) {
  if (!condition) {
    throw new WalkFailure(message);
  }
}

// Waits until the element marked data-tutorial-target is the one `selector` finds, and the ring is
// shown over it; fails after 3 seconds.
async function expectRing(page, selector) {
  try {
    await page.waitForFunction(
      (wanted) => {
        const marked = document.querySelector("[data-tutorial-target]");
        const expected = document.querySelector(wanted);
        const ring = document.querySelector(".tutorial-ring");
        if (marked === null || marked !== expected || ring === null || ring.hidden) {
          return false;
        }
        const target = marked.getBoundingClientRect();
        const around = ring.getBoundingClientRect();
        // The ring glides for 150 ms; once there, it lies over its target on every side.
        return (
          around.left <= target.left + 1 &&
          around.top <= target.top + 1 &&
          around.right >= target.right - 1 &&
          around.bottom >= target.bottom - 1
        );
      },
      selector,
      { timeout: 3000, polling: 100 },
    );
  } catch {
    const marked = await page.evaluate(() => {
      const element = document.querySelector("[data-tutorial-target]");
      return element === null ? "nothing" : element.outerHTML.slice(0, 160);
    });
    throw new WalkFailure(`The ring isn't on ${selector}; it marks ${marked}.`);
  }
}

// Waits until the status line says the step is done; fails after 4 seconds.
async function expectDone(page) {
  try {
    await page.waitForSelector(".tp-status.tp-status-done", { timeout: 4000 });
  } catch {
    const status = await page.textContent(".tp-status");
    throw new WalkFailure(`The step isn't done: the status line says "${status}".`);
  }
  const text = await page.textContent(".tp-status");
  check(text.startsWith("✓ Done"), `The status line says "${text}".`);
}

// Checks the open dialog's main button isn't covered by the panel.
async function expectDialogMainClear(page) {
  await page.waitForTimeout(SETTLE);
  const overlap = await page.evaluate(() => {
    const main = document.querySelector(".wizard-backdrop:not([hidden]) .wizard-main");
    const panel = document.querySelector(".tutorial-panel");
    if (main === null) {
      return "no main button";
    }
    const a = main.getBoundingClientRect();
    const b = panel.getBoundingClientRect();
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom ? "covered" : "clear";
  });
  check(overlap === "clear", `The dialog's main button is ${overlap}.`);
}

// --- Doing things on the page ---

// Presses the panel's main button (Start, Next, Skip …).
async function pressMain(page) {
  await page.click(".tp-main");
  await page.waitForTimeout(100);
}

// Types on the keyboard, as for a volume.
async function typeKeys(page, text) {
  await page.keyboard.type(text);
}

// Presses on `from` and drags to `to`, letting go there.
async function drag(page, from, to) {
  const start = page.locator(from);
  const end = page.locator(to);
  await start.scrollIntoViewIfNeeded();
  const a = await start.boundingBox();
  const b = await end.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 8, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

// Clicks the seam above End's button `buttonClass` (".add-stage", ".add-randomization" …), showing
// the seam's buttons by pointing at it first.
async function clickEndSeam(page, buttonClass) {
  await page.hover(END_SEAM);
  await page.click(`${END_SEAM} ${buttonClass}`);
  await page.waitForTimeout(100);
}

// The ID of the open entry in the Stages column.
async function openEntryId(page) {
  return page.getAttribute(".entry.is-open", "data-entry");
}

// Renames a labware by its label button.
async function renameLabware(page, labware, name) {
  await page.click(labelButton(labware));
  await page.keyboard.press("Control+A");
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
}

// Names a well with a right-click.
async function nameWell(page, labware, name, label) {
  await page.click(well(labware, name), { button: "right" });
  await page.keyboard.type(label);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
}

// Opens the open stage's ✎ box (checking the ring is on the ✎ first), does `change` in it, and
// saves it.
async function editOpenStage(page, change) {
  const id = await openEntryId(page);
  const pencil = `${entry(id)} .edit-button[data-box-kind="stage"]`;
  await expectRing(page, pencil);
  await page.click(pencil);
  await expectRing(page, ".editing-box");
  await change();
  await page.click(".editing-box .save");
}

// Adds a stage with new tips above End and sets it up in its ✎ box: `name`, then `change`.
async function addStageAtEnd(page, name, change = async () => {}) {
  await expectRing(page, END_SEAM);
  await clickEndSeam(page, ".add-stage");
  await editOpenStage(page, async () => {
    await page.fill("#editing-box-name", name);
    await change();
  });
}

// Opens an entry by clicking its row.
async function openEntry(page, key) {
  await page.click(`${entry(key)} .entry-row`);
}

// Fills a trough or well with the picked component: picks it, types the volume, clicks the well.
async function fillWell(page, component, volume, labware, name) {
  await page.click(componentChip(component));
  await typeKeys(page, volume);
  await page.click(well(labware, name));
}

// Makes transfers: types the volume, clicks the source, then clicks or drags the destinations.
async function transfer(page, volume, source, destination, lastDestination = null) {
  await typeKeys(page, volume);
  await page.click(source);
  if (lastDestination === null) {
    await page.click(destination);
  } else {
    await drag(page, destination, lastDestination);
  }
}

// The write step: Biomek files, then Write files.
async function writeFiles(page) {
  await expectRing(page, "#biomek-files");
  await page.click("#biomek-files");
  await expectRing(page, "#write-files");
  await page.click("#write-files");
}

// The wizard's main button, checked uncovered and rung, then pressed.
async function pressDialogMain(page) {
  await expectDialogMainClear(page);
  await expectRing(page, ".wizard-main");
  await page.click(".wizard-main");
  await page.waitForTimeout(100);
}

// --- The tutorials, step by step ---
// Each tutorial is a list of its steps' actions, one per step; null for a step with nothing to do
// but press Next. Each step's actions start with the ring check.

const TUTORIAL_STEPS = [
  // 1. Your first run
  [
    null,
    async (page) => {
      await expectRing(page, "#experiment-heading > button");
      await page.click("#experiment-heading > button");
      await page.keyboard.type("Practice1");
      await page.keyboard.press("Enter");
    },
    async (page) => {
      await expectRing(page, chip("Res1"));
      await page.click(chip("Res1"));
      await expectRing(page, chip("Plate1"));
      await page.click(chip("Plate1"));
    },
    async (page) => {
      await expectRing(page, labelButton("Plate1"));
      await renameLabware(page, "Plate1", "Culture plate");
    },
    async (page) => expectRing(page, entry("start")),
    async (page) => {
      await expectRing(page, ".new-component");
      await page.click(".new-component");
      await page.keyboard.type("Base media");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Cells");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
    },
    async (page) => {
      await expectRing(page, well("Res1", "1"));
      await fillWell(page, "Base media", "6000", "Res1", "1");
      await expectRing(page, well("Res1", "2"));
      await fillWell(page, "Cells", "3000", "Res1", "2");
    },
    async (page) => {
      await expectRing(page, entry("1"));
      await openEntry(page, "1");
      await editOpenStage(page, () => page.fill("#editing-box-name", "Base media"));
    },
    async (page) => {
      await expectRing(page, well("Res1", "1"));
      await transfer(page, "100", well("Res1", "1"), well("Plate1", "B2"), well("Plate1", "D5"));
    },
    async (page) => addStageAtEnd(page, "Cells"),
    async (page) => {
      await expectRing(page, well("Res1", "2"));
      await transfer(page, "50", well("Res1", "2"), well("Plate1", "B2"), well("Plate1", "D5"));
    },
    async (page) => {
      await expectRing(page, entry("end"));
      await openEntry(page, "end");
    },
    async (page) => {
      await expectRing(page, "#save");
      await page.click("#save");
    },
    writeFiles,
    null,
  ],
  // 2. Checking your plan
  [
    null,
    async (page) => {
      await expectRing(page, well("Plate1", "B2"));
      await page.hover(well("Plate1", "B2"));
    },
    async (page) => {
      await expectRing(page, entry("start"));
      await openEntry(page, "start");
      const pencil = '.edit-button[data-box-kind="component"][data-box-key="Cells"]';
      await expectRing(page, pencil);
      await page.click(pencil);
      await expectRing(page, ".editing-box");
      await page.click(".editing-box .add-constituent");
      await page.fill(".editing-box .constituent-amount", "1e6");
      await page.selectOption(".editing-box .constituent-unit", "cells/mL");
      await page.click(".editing-box .save");
    },
    async (page) => {
      await expectRing(page, entry("1"));
      await openEntry(page, "1");
      await expectRing(page, `${entry("1")} .toggle-list`);
      await page.click(`${entry("1")} .toggle-list`);
      const volume = `${entry("1")} .volume-button[aria-label^="Volume of Res1 1 → Culture plate B2,"]`;
      await expectRing(page, volume);
      await page.click(volume);
      await page.keyboard.press("Control+A");
      await page.keyboard.type("120");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Escape");
    },
    async (page) => {
      await expectRing(page, entry("2"));
      await openEntry(page, "2");
      await expectRing(page, well("Res1", "2"));
      await transfer(page, "300", well("Res1", "2"), well("Plate1", "B2"));
    },
    async (page) => {
      await expectRing(page, "#undo");
      await page.click("#undo");
    },
    async (page) => {
      await expectRing(page, well("Res1", "2"));
      await transfer(page, "500", well("Res1", "2"), well("Res1", "5"));
    },
    async (page) => {
      await expectRing(page, entry("start"));
      await openEntry(page, "start");
      await expectRing(page, well("Res1", "2"));
      await fillWell(page, "Cells", "1000", "Res1", "2");
    },
    async (page) => {
      await expectRing(page, entry("2"));
      await openEntry(page, "2");
      await expectRing(page, `${entry("2")} .toggle-list`);
      await page.click(`${entry("2")} .toggle-list`);
      const remove = `${entry("2")} .remove-transfer[aria-label="Remove Res1 2 → Res1 5"]`;
      await expectRing(page, remove);
      await page.click(remove);
    },
    async (page) => {
      await expectRing(page, entry("end"));
      await openEntry(page, "end");
      await expectRing(page, well("Res1", "2"));
      await page.hover(well("Res1", "2"));
    },
    async (page) => {
      await expectRing(page, entry("2"));
      await openEntry(page, "2");
      await editOpenStage(page, () =>
        page.selectOption('.editing-box select[aria-label="Dispense mode"]', "Non-Contact"),
      );
    },
    async (page) => expectRing(page, entry("start")),
    null,
  ],
  // 3. Making conditions
  [
    null,
    async (page) => {
      await expectRing(page, chip("Deep1"));
      await page.click(chip("Deep1"));
      await expectRing(page, labelButton("Deep1"));
      await renameLabware(page, "Deep1", "Conditions");
    },
    async (page) => {
      await editOpenStage(page, () => page.fill("#editing-box-name", "Base media"));
      await expectRing(page, well("Res1", "1"));
      await transfer(page, "1000", well("Res1", "1"), well("Deep1", "A1"));
      await transfer(page, "800", well("Res1", "1"), well("Deep1", "A2"), well("Deep1", "A4"));
    },
    async (page) =>
      addStageAtEnd(page, "Glucose", () => page.check('.editing-box input[aria-label="Mix after dispensing"]')),
    async (page) => {
      await expectRing(page, well("Res1", "2"));
      await transfer(page, "200", well("Res1", "2"), well("Deep1", "A2"));
      await transfer(page, "100", well("Res1", "2"), well("Deep1", "A4"));
    },
    async (page) => {
      await addStageAtEnd(page, "Yeast extract");
      await expectRing(page, well("Res1", "3"));
      await transfer(page, "200", well("Res1", "3"), well("Deep1", "A3"));
      await transfer(page, "100", well("Res1", "3"), well("Deep1", "A4"));
    },
    async (page) => {
      for (const [name, label] of [["A1", "Control"], ["A2", "Glucose"], ["A3", "Yeast"], ["A4", "Both"]]) {
        await expectRing(page, well("Deep1", name));
        await nameWell(page, "Deep1", name, label);
      }
      await page.hover(well("Deep1", "A4"));
    },
    async (page) => {
      await expectRing(page, chip("Res1"));
      await page.click(chip("Res1"));
      await expectRing(page, chip("Plate1"));
      await page.click(chip("Plate1"));
      await expectRing(page, labelButton("Plate1"));
      await renameLabware(page, "Plate1", "Culture plate");
    },
    async (page) => {
      await addStageAtEnd(page, "To plate", () => page.uncheck('.editing-box input[aria-label="Mix after dispensing"]'));
      await typeKeys(page, "100");
      for (const [name, column] of [["A1", 2], ["A2", 3], ["A3", 4], ["A4", 5]]) {
        await expectRing(page, well("Deep1", name));
        await page.click(well("Deep1", name));
        await drag(page, well("Plate1", `B${column}`), well("Plate1", `D${column}`));
      }
    },
    async (page) => {
      await expectRing(page, chip("Res1"));
      await page.click(chip("Res1"));
      await expectRing(page, chip("Deep1"));
      await page.click(chip("Deep1"));
    },
    async (page) =>
      addStageAtEnd(page, "Cells", async () => {
        await page.selectOption('.editing-box select[aria-label="Aspirate mode"]', "Slow");
        await page.check('.editing-box input[aria-label="Mix before aspirating"]');
      }),
    async (page) => {
      await expectRing(page, well("Res1", "4"));
      await transfer(page, "50", well("Res1", "4"), well("Plate1", "B2"), well("Plate1", "D5"));
      await page.hover(well("Plate1", "B3"));
    },
    async (page) => {
      const id = await page.evaluate(() => [...document.querySelectorAll(".entry[data-entry]")].at(-2).dataset.entry);
      const pencil = `.edit-button[data-box-kind="tip"][data-box-key="${id}"]`;
      await expectRing(page, pencil);
      await page.click(pencil);
      await expectRing(page, ".editing-box");
      await page.click('.editing-box .probe-button[aria-label="8 probes"]');
      await page.click(".editing-box .save");
    },
    async (page) => {
      await expectRing(page, chip("Deep1"));
      await page.click(chip("Deep1"));
      await expectRing(page, entry("end"));
      await openEntry(page, "end");
    },
    async (page) => {
      await expectRing(page, well("Plate1", "B2"));
      await page.hover(well("Plate1", "B2"));
    },
    writeFiles,
    null,
  ],
  // 4. Transfer tables
  [
    null,
    async (page) => {
      await expectRing(page, chip("Deep1"));
      await page.click(chip("Deep1"));
      for (const [name, label] of [["A1", "Control"], ["A2", "With glucose"], ["A3", "With yeast"], ["A4", "Both"]]) {
        await expectRing(page, well("Deep1", name));
        await nameWell(page, "Deep1", name, label);
      }
    },
    async (page) => {
      await expectRing(page, END_SEAM);
      await page.click(".tp-copy");
      await page.waitForSelector(".tp-copy-outcome:text-is('Copied.')", { timeout: 2000 });
      await clickEndSeam(page, ".add-transfer-table");
      await expectRing(page, "#wizard");
      await expectDialogMainClear(page);
      await page.click(".paste-zone");
      await page.keyboard.press("Control+V");
      await page.waitForSelector(".wizard .cell-box");
    },
    async (page) => {
      await pressDialogMain(page);
      await pressDialogMain(page);
      await pressDialogMain(page);
    },
    async (page) => {
      await expectRing(page, entry("end"));
      await openEntry(page, "end");
      await expectRing(page, well("Deep1", "A4"));
      await page.hover(well("Deep1", "A4"));
    },
    async (page) => {
      const pencil = '[data-item="transferTable:t1"] .box-edit';
      await expectRing(page, pencil);
      await page.click(pencil);
      await expectDialogMainClear(page);
      await expectRing(page, ".wizard-main");
      await page.click('[data-wizard-focus="step:table"]');
      for (const [column, amount] of [[1, "700"], [2, "150"], [3, "150"]]) {
        await page.click(`[data-wizard-focus="cell:4:${column}"]`);
        await page.keyboard.press("Control+A");
        await page.keyboard.type(amount);
        await page.keyboard.press("Enter");
      }
      await pressDialogMain(page);
      await pressDialogMain(page);
      await pressDialogMain(page);
    },
    async (page) => {
      const glucose = await page.evaluate(() => {
        const plan = JSON.parse(localStorage.getItem("biomek-tools transfer designer tutorial: plan"));
        const index = plan.stages.findIndex((stage) => stage.name === "Glucose");
        return String(index + 1);
      });
      const row = `${entry(glucose)} .entry-row`;
      if ((await page.locator(row).count()) === 0) {
        await expectRing(page, '[data-item="transferTable:t1"] .randomization-heading');
        await page.click('[data-item="transferTable:t1"] .randomization-heading');
      }
      await expectRing(page, entry(glucose));
      await page.click(row);
      await editOpenStage(page, () => page.check('.editing-box input[aria-label="Mix after dispensing"]'));
    },
    null,
  ],
  // 5. Randomizing a plate
  [
    null,
    async (page) => {
      await expectRing(page, chip("Plate1"));
      await page.click(chip("Plate1"));
      await expectRing(page, END_SEAM);
      await clickEndSeam(page, ".add-randomization");
      await expectRing(page, '[data-focus-key="name"]');
      await page.fill('[data-focus-key="name"]', "Layout");
      await page.keyboard.press("Enter");
    },
    async (page) => {
      await expectRing(page, well("Deep1", "A1"));
      await drag(page, well("Deep1", "A1"), well("Deep1", "A4"));
      await expectRing(page, well("Res1", "1"));
      await page.click(well("Res1", "1"));
      const filler = `[data-focus-key='filler:["Res1","1"]']`;
      await expectRing(page, filler);
      await page.click(filler);
    },
    async (page) => {
      await expectRing(page, '[data-focus-key="all-sources"]');
      await page.fill('[data-focus-key="all-sources"]', "12");
    },
    async (page) => {
      await expectRing(page, '[data-focus-key="tab:fill"]');
      await page.click('[data-focus-key="tab:fill"]');
      await expectRing(page, well("Plate1", "B2"));
      await drag(page, well("Plate1", "B2"), well("Plate1", "G11"));
    },
    async (page) => {
      await expectRing(page, '[data-focus-key="volume"]');
      await page.fill('[data-focus-key="volume"]', "100");
      await expectRing(page, '[data-focus-key="run"]');
      await page.click('[data-focus-key="run"]');
    },
    async (page) => {
      await expectRing(page, entry("end"));
      await openEntry(page, "end");
      await expectRing(page, well("Plate1", "B2"));
      await page.hover(well("Plate1", "B2"));
    },
    async (page) => {
      const pencil = '.randomization[data-entry="r1"] .box-edit';
      await expectRing(page, pencil);
      await page.click(pencil);
      await expectRing(page, '[data-focus-key="seed"]');
      await page.fill('[data-focus-key="seed"]', "37");
      await expectRing(page, '[data-focus-key="run"]');
      await page.click('[data-focus-key="run"]');
    },
    writeFiles,
    null,
  ],
];

// --- Running ---

// The built tutorial file, building first if dist/ has none.
function tutorialFile() {
  const find = () =>
    existsSync(DIST) ? readdirSync(DIST).find((name) => name.startsWith("transfer-designer-tutorial-v") && name.endsWith(".html")) : undefined;
  if (find() === undefined) {
    console.log("No tutorial file in dist/: building it first.");
    execFileSync(process.execPath, [resolve(PROJECT_FOLDER, "scripts/build.js")], { stdio: "inherit", cwd: PROJECT_FOLDER });
  }
  return resolve(DIST, find());
}

// Chrome if it's installed, otherwise Playwright's own Chromium.
async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return chromium.launch();
  }
}

// A fresh browser context at `size`, with Save and Write files falling back to ordinary downloads,
// the clipboard allowed, and a sentinel set if anything writes the real Transfer Designer's plan.
async function freshContext(browser, size) {
  const context = await browser.newContext({ viewport: size, acceptDownloads: true });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await context.addInitScript((realKey) => {
    delete window.showSaveFilePicker;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === realKey) {
        setItem.call(this, "walk: wrote the real plan", "yes");
      }
      return setItem.call(this, key, value);
    };
  }, REAL_PLAN_KEY);
  return context;
}

// Walks tutorial number `number` (from 1) at `size`, in a fresh context, from the menu. Returns the
// number of steps done.
async function walkTutorial(browser, fileUrl, number, size) {
  const context = await freshContext(browser, size);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const steps = TUTORIAL_STEPS[number - 1];
  let stepIndex = -1;
  try {
    await page.goto(fileUrl);
    await page.waitForSelector(".tp-menu-start");
    await Promise.all([page.waitForEvent("load"), page.click(`.tp-menu-row:nth-child(${number}) .tp-menu-start`)]);
    await page.waitForSelector(".tp-main");
    await checkStartingPlan(page, number);
    for (stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const header = await page.textContent(".tp-header-where");
      const expectedWhere = stepIndex === 0 ? `${number}. ` : `step ${stepIndex} of ${steps.length - 1}`;
      check(header.includes(expectedWhere), `The header says "${header}", not "${expectedWhere}".`);
      const action = steps[stepIndex];
      if (action !== null) {
        await action(page);
      }
      await page.waitForTimeout(SETTLE);
      const hasStatus = (await page.textContent(".tp-status")) !== "";
      if (hasStatus) {
        await expectDone(page);
      }
      if (takeShots) {
        mkdirSync(resolve(DIST, "walk-shots"), { recursive: true });
        await page.screenshot({ path: resolve(DIST, "walk-shots", `${size.width}-t${number}-s${stepIndex}.png`) });
      }
      if (stepIndex < steps.length - 1) {
        await pressMain(page);
      }
    }
    await checkLastStep(page, number);
    check(errors.length === 0, `The page threw: ${errors.join("; ")}`);
    const realWritten = await page.evaluate(
      (realKey) => localStorage.getItem("walk: wrote the real plan") !== null || localStorage.getItem(realKey) !== null,
      REAL_PLAN_KEY,
    );
    check(!realWritten, "The real Transfer Designer's plan storage name was written.");
    return steps.length;
  } catch (error) {
    const shot = resolve(DIST, `walk-failure-${size.width}-t${number}-s${stepIndex}.png`);
    await page.screenshot({ path: shot }).catch(() => {});
    error.message = `Tutorial ${number}, step ${stepIndex}, at ${size.width} × ${size.height}: ${error.message} (screenshot: ${shot})`;
    throw error;
  } finally {
    await context.close();
  }
}

// After a tutorial starts from the menu: its starting plan is in the tutorial's storage, and the
// page opened it. For tutorial 2, the plan tutorial 1 ends with.
async function checkStartingPlan(page, number) {
  const plan = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), TUTORIAL_PLAN_KEY);
  if (number === 1) {
    check(plan === null || plan.experimentName === "", "Tutorial 1 didn't start from an empty plan.");
    return;
  }
  check(plan !== null, `Tutorial ${number} has no starting plan in the tutorial's storage.`);
  const message = await page.textContent("#message-bar");
  check(message.includes("Brought back the plan"), `The page didn't bring the starting plan back: "${message}".`);
  if (number === 2) {
    const stageNames = plan.stages.map((stage) => stage.name).join(", ");
    check(plan.experimentName === "Practice1", "Tutorial 2's plan isn't named Practice1.");
    check(stageNames === "Base media, Cells", `Tutorial 2's stages are ${stageNames}.`);
    check(plan.operations.length === 24, "Tutorial 2's plan doesn't hold 24 transfers.");
    check(plan.savedBy.startsWith("transfer designer tutorial v"), `Its savedBy is ${plan.savedBy}.`);
  }
}

// At a tutorial's last step: Next tutorial starts the next one (on its step 0, with its starting
// plan); the last tutorial's button goes back to the menu.
async function checkLastStep(page, number) {
  const label = await page.textContent(".tp-main");
  if (number === TUTORIAL_STEPS.length) {
    check(label === "All tutorials", `The last tutorial's last button says "${label}".`);
    await pressMain(page);
    await page.waitForSelector(".tp-menu-start");
    const done = await page.locator(".tp-menu-done").count();
    check(done >= 1, "The menu doesn't mark the finished tutorial ✓ done.");
    return;
  }
  check(label === "Next tutorial", `The last step's button says "${label}".`);
  await Promise.all([page.waitForEvent("load"), page.click(".tp-main")]);
  await page.waitForSelector(".tp-main");
  const header = await page.textContent(".tp-header-where");
  check(header.startsWith(`${number + 1}. `), `Next tutorial opened "${header}".`);
  await checkStartingPlan(page, number + 1);
}

// Presses on the guide panel are ignored by the page (transfer-designer-page.md, section 17): with
// a stage's ✎ box holding unsaved changes, Next moves the tutorial on and the box neither shakes nor
// closes; with the Biomek files box open, a press on the panel leaves it open.
async function checkPanelPresses(browser, fileUrl, size) {
  const context = await freshContext(browser, size);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(fileUrl);
    await Promise.all([page.waitForEvent("load"), page.click(".tp-menu-row:nth-child(2) .tp-menu-start")]);
    await page.waitForSelector(".tp-main");
    await pressMain(page);
    await page.click(`${entry("2")} .edit-button[data-box-kind="stage"]`);
    await page.fill("#editing-box-name", "Cells, changed");
    await page.click(".tp-main");
    await page.waitForTimeout(SETTLE);
    const header = await page.textContent(".tp-header-where");
    check(header.includes("step 2 of"), `Next on the panel didn't move on: the header says "${header}".`);
    check((await page.locator(".editing-box").count()) === 1, "The ✎ box closed when the panel was pressed.");
    check((await page.locator(".editing-box.shake").count()) === 0, "The ✎ box shook when the panel was pressed.");
    check((await page.inputValue("#editing-box-name")) === "Cells, changed", "The ✎ box lost what was typed.");
    // Escape in the box closes it without saving (the panel may cover its Discard here).
    await page.focus("#editing-box-name");
    await page.keyboard.press("Escape");
    check((await page.locator(".editing-box").count()) === 0, "Escape didn't close the ✎ box.");
    await page.click("#biomek-files");
    await page.click(".tp-button:text-is('Back')");
    await page.waitForTimeout(SETTLE);
    check(!(await page.locator("#biomek-box").isHidden()), "The Biomek files box closed when the panel was pressed.");
    check(errors.length === 0, `The page threw: ${errors.join("; ")}`);
  } finally {
    await context.close();
  }
}

// The Transfer Designer's own build behaves as before (transfer-designer-page.md, section 17): no
// guide panel, its own title, and its plan kept under the real storage name, saved by "transfer
// designer v…", never under the tutorial's.
async function checkDesignerBuild(browser, size) {
  const name = readdirSync(DIST).find((file) => file.startsWith("transfer-designer-v") && file.endsWith(".html"));
  check(name !== undefined, "dist/ has no Transfer Designer file.");
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(pathToFileURL(resolve(DIST, name)).href);
    check((await page.title()) === "Transfer Designer", `The Transfer Designer's title is "${await page.title()}".`);
    check((await page.locator(".tutorial-panel").count()) === 0, "The Transfer Designer has a guide panel.");
    check((await page.getAttribute("html", "data-tutorial")) === null, "The Transfer Designer is marked data-tutorial.");
    await page.click("#experiment-heading > button");
    await page.keyboard.type("Exp36");
    await page.keyboard.press("Enter");
    const stored = await page.evaluate(
      ([realKey, tutorialKey]) => ({ real: localStorage.getItem(realKey), tutorial: localStorage.getItem(tutorialKey) }),
      [REAL_PLAN_KEY, TUTORIAL_PLAN_KEY],
    );
    check(stored.real !== null, "The Transfer Designer didn't keep its plan under its own storage name.");
    check(JSON.parse(stored.real).savedBy.startsWith("transfer designer v"), "The Transfer Designer's savedBy changed.");
    check(stored.tutorial === null, "The Transfer Designer wrote the tutorial's storage name.");
    check(errors.length === 0, `The page threw: ${errors.join("; ")}`);
  } finally {
    await context.close();
  }
}

// Walks every tutorial (or those named on the command line) at both sizes, and reports.
async function main() {
  const file = tutorialFile();
  const fileUrl = pathToFileURL(file).href;
  console.log(`Walking ${file}`);
  const browser = await launchBrowser();
  console.log(`Browser: ${browser.browserType().name()} ${browser.version()}`);
  let failures = 0;
  let stepsDone = 0;
  try {
    for (const size of SIZES) {
      for (const [label, extraCheck] of [
        ["presses on the panel", () => checkPanelPresses(browser, fileUrl, size)],
        ["the Transfer Designer's own build", () => checkDesignerBuild(browser, size)],
      ]) {
        try {
          await extraCheck();
          console.log(`ok   ${label} at ${size.width} × ${size.height}`);
        } catch (error) {
          failures += 1;
          console.log(`FAIL ${label} at ${size.width} × ${size.height}: ${error.message}`);
        }
      }
      for (let number = 1; number <= TUTORIAL_STEPS.length; number++) {
        if (onlyTutorials.length > 0 && !onlyTutorials.includes(number)) {
          continue;
        }
        try {
          const steps = await walkTutorial(browser, fileUrl, number, size);
          stepsDone += steps;
          console.log(`ok   tutorial ${number} at ${size.width} × ${size.height}: ${steps} steps`);
        } catch (error) {
          failures += 1;
          console.log(`FAIL ${error.message}`);
        }
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`${stepsDone} steps done, ${failures} ${failures === 1 ? "walk-through" : "walk-throughs"} failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
