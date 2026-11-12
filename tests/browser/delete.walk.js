// delete.walk.js — the browser walk-through of deleting and the trash (transfer-designer-page.md,
// section 16, "Deleting and the trash in the browser"), run by `npm run test:browser`, not by
// `npm test`.
//
// With Playwright, against the built Transfer Designer in dist/ (built first if there's none), at
// 1500 × 950, in Chrome if it's installed, otherwise Playwright's own Chromium. Before each check it
// opens the test plan with a bit of everything (tests/fixtures/delete-test-plan.js), or for a mixing
// box the test plan with one, saved as a plan file and opened with Open, in a fresh browser context,
// so the trash starts empty. It compares the
// column, read from the page (each box in order, each stage by its name, each tip group's tip type
// and probes from its heading), with what the transfer designer's logic gives for the same edits.
// It fails if the page throws an error.
//
// Run it with: npm run test:browser   (with the tutorial's walk-through)
//              node tests/browser/delete.walk.js
//              node tests/browser/delete.walk.js --only "the menu"   (only the checks so named)

import { chromium } from "playwright";
import { existsSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { DELETE_ANIMATION_MS } from "../../config/animations.js";
import { TRASH_LIMIT } from "../../config/trash.js";
import {
  deleteTestPlan,
  mixingBoxTestPlan,
  stageIdOf,
  PLATE,
} from "../fixtures/delete-test-plan.js";
import { planToText } from "../../src/tools/transfer-designer/plan-file.js";
import {
  columnBoxes,
  randomizationAt,
  deleteItems,
  removeStage,
  removeTipChange,
  emptyPlan,
} from "../../src/tools/transfer-designer/transfer-designer.js";
import { emptyTrash, addDeleted, trashToText } from "../../src/tools/transfer-designer/trash.js";

// The project's folder and dist/.
const PROJECT_FOLDER = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const DIST = resolve(PROJECT_FOLDER, "dist");

// The window size the walk-through runs at.
const SIZE = { width: 1500, height: 950 };

// The storage names of the designer's trash and the tutorial's (section 17).
const TRASH_KEY = "biomek-tools transfer designer: trash";
const TUTORIAL_TRASH_KEY = "biomek-tools transfer designer tutorial: trash";

// The notes about the trash's storage (section 4).
const NOT_KEPT_NOTE = "The trash can't be kept by this browser, so it will be empty after a reload.";
const NEWER_NOTE =
  "The stored trash was saved by a newer version of the transfer designer, so this tab keeps a trash of its own and leaves that one as it is.";
const DAMAGED_NOTE =
  "The stored trash is damaged, so this tab keeps a trash of its own, from what could be read, and leaves the stored one as it is.";

// Only the checks whose names hold this text (from the command line: --only "the menu"), or all.
const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

// A little longer than the delete animation, for it to end.
const AFTER_ANIMATION = DELETE_ANIMATION_MS + 250;

// When the test's things were deleted, for entries made here.
const NOW = new Date().toISOString();

// A folder for the plan files the walk opens.
const FILES = mkdtempSync(join(tmpdir(), "delete-walk-"));

// The test plan, as a plan file, the test plan with a mixing box's, and an empty plan's, for
// "another plan".
const TEST_PLAN_FILE = join(FILES, "test-plan.json");
const MIXING_BOX_PLAN_FILE = join(FILES, "mixing-box-plan.json");
const EMPTY_PLAN_FILE = join(FILES, "empty-plan.json");
writeFileSync(TEST_PLAN_FILE, planToText(deleteTestPlan(), "delete walk"));
writeFileSync(MIXING_BOX_PLAN_FILE, planToText(mixingBoxTestPlan(), "delete walk"));
writeFileSync(EMPTY_PLAN_FILE, planToText(emptyPlan().plan, "delete walk"));

// --- Checks ---

// A failure of the walk-through, with what was wrong.
class WalkFailure extends Error {}

// Throws a WalkFailure unless `condition` holds.
function check(condition, message) {
  if (!condition) {
    throw new WalkFailure(message);
  }
}

// Throws unless `actual` and `expected` are the same as JSON, saying both.
function checkSame(actual, expected, what) {
  const [a, e] = [JSON.stringify(actual), JSON.stringify(expected)];
  check(a === e, `${what}:\n  got      ${a}\n  expected ${e}`);
}

// --- The column, as the page shows it and as the logic gives it ---

// The column the page shows: each box in order, a tip group as its heading's text ("New tips ·
// BC230 · 4 tips") and its stages' names, a randomization as its name, a transfer table as its
// status ("2 stages"), a mixing box as its status's count ("5 mix steps", from "5 mix steps · a
// fresh tip each").
async function shownColumn(page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "#stages-list > .tip-group, #stages-list > .randomization, #stages-list > .transfer-table, #stages-list > .mixing-box",
      ),
    ].map((box) => {
      if (box.classList.contains("tip-group")) {
        const heading = box.querySelector(".tip-group-heading");
        return {
          tips: heading.children[1].textContent,
          stages: [...box.querySelectorAll(".entry-name")].map((name) => name.textContent),
        };
      }
      if (box.classList.contains("randomization")) {
        return { randomization: box.querySelector(".randomization-name").textContent };
      }
      if (box.classList.contains("mixing-box")) {
        return { mixingBox: box.querySelector(".randomization-status").textContent.split(" · ")[0] };
      }
      return { transferTable: box.querySelector(".randomization-status").textContent };
    }),
  );
}

// "1 tip", "4 tips".
function tipsText(count) {
  return `${count} ${count === 1 ? "tip" : "tips"}`;
}

// The column the logic gives for `plan`, in shownColumn's form.
function expectedColumn(plan) {
  return columnBoxes(plan).map((box) => {
    if (box.kind === "tipGroup") {
      return {
        tips: `New tips · ${box.tipType} · ${tipsText(box.probes.length)}`,
        stages: box.stages.map((id) => plan.stageList.get(id).name),
      };
    }
    if (box.kind === "randomization") {
      return { randomization: randomizationAt(plan, box.id).name };
    }
    const count = box.tipGroups.length;
    if (box.kind === "mixingBox") {
      return { mixingBox: `${count} ${count === 1 ? "mix step" : "mix steps"}` };
    }
    return { transferTable: `${count} ${count === 1 ? "stage" : "stages"}` };
  });
}

// The test plan's column, by the logic.
const FULL_COLUMN = expectedColumn(deleteTestPlan());

// The column the logic gives after deleting, from the test plan, the items `itemsOf` gives for it,
// e.g. columnAfterDeleting((plan) => [stageItem(plan, "S04")]).
function columnAfterDeleting(itemsOf) {
  const plan = deleteTestPlan();
  return expectedColumn(deleteItems(plan, itemsOf(plan)).plan);
}

// Items of the test plan by stage name, for columnAfterDeleting.
function stageItem(plan, name) {
  return { kind: "stage", id: stageIdOf(plan, name) };
}

// Checks the page's column is `expected`.
async function checkColumn(page, expected, what) {
  checkSame(await shownColumn(page), expected, what);
}

// --- Selectors ---

// A stage's name in its row (or open card's heading row): pressed on its name, not the row's middle,
// which on an open card can be its ✎.
function stageRow(name) {
  return `#stages-list .entry-name:text-is("${name}")`;
}

// The heading of the ordinary tip group whose first stage is called `name`.
function groupHeading(name) {
  return `#stages-list > .tip-group:has(.entry-name:text-is("${name}")) > .tip-group-heading`;
}

// The run randomization's, the transfer table's and the mixing box's headings.
const RANDOMIZATION_HEADING = "#stages-list > .randomization .randomization-heading";
const TABLE_HEADING = "#stages-list > .transfer-table .randomization-heading";
const MIXING_BOX_HEADING = "#stages-list > .mixing-box .mixing-box-heading";

// A seam with this drop place.
function seamAt(place) {
  return `#stages-list [data-drop-place='${JSON.stringify(place)}']`;
}

// --- The page ---

// The built Transfer Designer, building first if dist/ has none.
function designerFile() {
  const find = (prefix) =>
    existsSync(DIST) ? readdirSync(DIST).find((name) => name.startsWith(prefix) && name.endsWith(".html")) : undefined;
  if (find("transfer-designer-v") === undefined) {
    console.log("No Transfer Designer in dist/: building it first.");
    execFileSync(process.execPath, [resolve(PROJECT_FOLDER, "scripts/build.js")], { stdio: "inherit", cwd: PROJECT_FOLDER });
  }
  return { designer: resolve(DIST, find("transfer-designer-v")), tutorial: resolve(DIST, find("transfer-designer-tutorial-v")) };
}

// Chrome if it's installed, otherwise Playwright's own Chromium.
async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return chromium.launch();
  }
}

// A fresh context (an empty trash), with the clipboard allowed and `options` (e.g. reducedMotion).
async function freshContext(browser, options = {}) {
  const context = await browser.newContext({ viewport: SIZE, ...options });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  return context;
}

// A new page of `context` at `url`, noting any error it throws in `errors`.
async function openPage(context, url, errors) {
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  return page;
}

// Opens the plan file `file` with Open and waits for its message.
async function openPlanFile(page, file = TEST_PLAN_FILE) {
  await page.setInputFiles("#open-file", file);
  await page.waitForFunction(() => document.querySelector(".message-text")?.textContent.startsWith("Opened"));
}

// The message bar's own text (without its Undo button or extra lines), its kind, whether it has an
// Undo button, and its extra lines.
async function message(page) {
  return page.evaluate(() => {
    const bar = document.getElementById("message-bar");
    return {
      text: bar.querySelector(".message-text")?.textContent ?? "",
      kind: ["ok", "note", "error"].find((kind) => bar.classList.contains(kind)) ?? null,
      undo: bar.querySelector(".message-undo") !== null,
      lines: [...bar.querySelectorAll(".message-line")].map((line) => line.textContent),
      hidden: bar.hidden,
    };
  });
}

// The trash's closed line's text, e.g. "🗑Trash (2)▴".
async function trashLine(page) {
  return page.textContent("#trash-line");
}

// Opens the trash's list (if closed) and gives its rows: { name, details, buttons }.
async function trashRows(page) {
  if (await page.isHidden("#trash-list")) {
    await page.click("#trash-line");
  }
  return page.evaluate(() =>
    [...document.querySelectorAll("#trash-list .trash-entry")].map((row) => ({
      name: row.querySelector(".trash-entry-name").textContent,
      details: row.querySelector(".trash-entry-details").textContent,
      buttons: row.querySelectorAll("button").length,
    })),
  );
}

// The trash stored in local storage, parsed, or null.
async function storedTrash(page) {
  const text = await page.evaluate((key) => localStorage.getItem(key), TRASH_KEY);
  return text === null ? null : JSON.parse(text);
}

// Clicks a stage's row, then presses Delete and waits for the animation to end.
async function deleteStage(page, name) {
  await page.click(stageRow(name));
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
}

// The center of the element `selector` finds.
async function centerOf(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  check(box !== null, `${selector} isn't on the page.`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Presses on `fromSelector`, moves in steps to `to` ({ x, y }), runs `whileThere` (if given) before
// releasing, then releases. `holdControl` holds Ctrl while dropping.
async function dragTo(page, fromSelector, to, { whileThere = null, holdControl = false, beforeRelease = null } = {}) {
  const from = await centerOf(page, fromSelector);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 8, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  if (whileThere !== null) {
    await whileThere();
  }
  if (holdControl) {
    await page.keyboard.down("Control");
    await page.mouse.move(to.x, to.y + 1);
  }
  if (beforeRelease !== null) {
    await beforeRelease();
  }
  await page.mouse.up();
  if (holdControl) {
    await page.keyboard.up("Control");
  }
  await page.waitForTimeout(150);
}

// Drags trash entry number `index` (from 0, in the list's order) to the seam with `place`: the drag
// starts first (closing the list), then the seam, scrolled to the column's middle, is aimed at.
async function dragEntryToSeam(page, index, place, { whileThere = null, holdControl = false, beforeRelease = null } = {}) {
  if (await page.isHidden("#trash-list")) {
    await page.click("#trash-line");
  }
  const from = await centerOf(page, `#trash-list .trash-entry >> nth=${index}`);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 10, { steps: 2 });
  await page.evaluate((selector) => {
    document.getElementById("stages-column").style.scrollBehavior = "auto";
    document.querySelector(selector).scrollIntoView({ block: "center" });
  }, seamAt(place));
  const to = await centerOf(page, seamAt(place));
  await page.mouse.move(to.x, to.y, { steps: 8 });
  if (whileThere !== null) {
    await whileThere();
  }
  if (holdControl) {
    await page.keyboard.down("Control");
    await page.mouse.move(to.x, to.y + 1);
  }
  if (beforeRelease !== null) {
    await beforeRelease();
  }
  await page.mouse.up();
  if (holdControl) {
    await page.keyboard.up("Control");
  }
  await page.waitForTimeout(150);
}

// The menu's items: { label, disabled, reason, danger }.
async function menuItems(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#column-menu .column-menu-item")].map((item) => ({
      label: item.querySelector(".column-menu-label").textContent,
      disabled: item.disabled,
      reason: item.querySelector(".column-menu-reason")?.textContent ?? null,
      danger: item.classList.contains("danger-item"),
    })),
  );
}

// Right-clicks the element `selector` finds, scrolled to the middle of its column first: a scroll
// of the column closes its menu (section 7), and the scroll Playwright makes before a click would
// arrive just after the menu opened.
async function rightClick(page, selector) {
  await page.locator(selector).first().evaluate((target) => {
    document.getElementById("stages-column").style.scrollBehavior = "auto";
    target.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(100);
  await page.click(selector, { button: "right" });
}

// Scrolls the element `selector` finds to the middle of its column, at once.
async function scrollToMiddle(page, selector) {
  await page.locator(selector).first().evaluate((target) => {
    document.getElementById("stages-column").style.scrollBehavior = "auto";
    target.scrollIntoView({ block: "center" });
  });
}

// Chooses `label` from the menu that's open.
async function chooseFromMenu(page, label) {
  await page.click(`#column-menu .column-menu-item:has(> .column-menu-label:text-is("${label}"))`);
}

// --- The checks, each in a fresh context with the test plan open ---

// The Delete key (section 7, "Deleting and cutting").
async function checkDeleteKey(page) {
  await page.click(stageRow("S04 Drug B row B"));
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S04")]), "after Delete on S04");
  const shown = await message(page);
  checkSame([shown.text, shown.kind, shown.undo], ["Deleted “S04 Drug B row B”.", "ok", true], "Delete's message");
  await page.keyboard.press("Control+Z");
  await checkColumn(page, FULL_COLUMN, "after Undo");

  // A stage opened, then a well on the deck clicked, then Delete: nothing.
  await page.click(stageRow("S03 Drug A row A"));
  await page.click(`.well[data-labware="${PLATE}"][data-well="H12"]`);
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, FULL_COLUMN, "after a click on the deck and Delete");

  // Typing Delete in the experiment's name box: the box's own.
  await page.click("#experiment-heading > button");
  await page.keyboard.press("Home");
  await page.keyboard.press("Delete");
  const typed = await page.inputValue("#experiment-heading input");
  check(typed === "eleteTest", `Delete in the name box gave "${typed}".`);
  await page.keyboard.press("Escape");
  await checkColumn(page, FULL_COLUMN, "after Delete in the name box");

  // The focus moved into the column with the keyboard (Shift+Tab from the trash's line, which
  // doesn't count), then Delete: what's selected, the open stage (S03), is deleted.
  await page.click(`.well[data-labware="${PLATE}"][data-well="H12"]`);
  await page.focus("#trash-line");
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, FULL_COLUMN, "Delete with the focus on the trash's line");
  await page.keyboard.press("Shift+Tab");
  const inColumn = await page.evaluate(() => document.getElementById("stages-list").contains(document.activeElement));
  check(inColumn, "Shift+Tab from the trash's line didn't reach the column.");
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S03")]), "Delete with the focus moved into the column");
}

// The focus tabbed into the column and back out to the deck ends the Delete key's condition: a
// stage's row clicked, a well clicked, Tab until the focus is in the column, Shift+Tab back out,
// then Delete: nothing.
async function checkFocusInAndOut(page) {
  await page.click(stageRow("S04 Drug B row B"));
  await page.click(`.well[data-labware="${PLATE}"][data-well="H12"]`);
  const focusInColumn = () => page.evaluate(() => document.getElementById("stages-column").contains(document.activeElement));
  let presses = 0;
  while (!(await focusInColumn())) {
    check(presses < 400, "Tab never reached the Stages column.");
    await page.keyboard.press("Tab");
    presses += 1;
  }
  await page.keyboard.press("Shift+Tab");
  check(!(await focusInColumn()), "Shift+Tab didn't leave the column.");
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, FULL_COLUMN, "Delete after the focus went into the column and back out");
}

// Delete before any press does nothing.
async function checkDeleteBeforeAnyPress(page) {
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, FULL_COLUMN, "Delete before any press");
}

// Ctrl+X cuts after a click in the column; Ctrl+V pastes it back below the selection; after a click
// on the deck, nothing.
async function checkCut(page) {
  await page.click(stageRow("S04 Drug B row B"));
  await page.keyboard.press("Control+X");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S04")]), "after Ctrl+X on S04");
  const shown = await message(page);
  checkSame([shown.text, shown.undo], ["Cut “S04 Drug B row B”.", true], "Cut's message");
  checkSame((await trashRows(page)).map((row) => row.name), ["“S04 Drug B row B”"], "the trash after Cut");
  // S05 is open now (it took S04's place), so Ctrl+V pastes S04 just below it.
  await page.click(`.well[data-labware="${PLATE}"][data-well="H12"]`);
  await page.keyboard.press("Control+V");
  await page.waitForTimeout(200);
  const column = await shownColumn(page);
  checkSame(column[1].stages, ["S03 Drug A row A", "S05 Dye row B", "S04 Drug B row B", "S06 Mix row A"], "group 2 after Ctrl+V");
  // Ctrl+X after a click on the deck: nothing deleted.
  const before = await shownColumn(page);
  await page.click(`.well[data-labware="${PLATE}"][data-well="H12"]`);
  await page.keyboard.press("Control+X");
  await page.waitForTimeout(AFTER_ANIMATION);
  checkSame(await shownColumn(page), before, "Ctrl+X after a click on the deck");
}

// The right-click menu: its items on a stage, an ordinary tip group, the first tip group, a
// randomization and a transfer table; Delete, Cut and Join from it.
async function checkMenu(page) {
  const itemsWithoutJoin = ["Cut", "Copy", "Paste above", "Paste below", "Delete"];
  await rightClick(page, stageRow("S04 Drug B row B"));
  let items = await menuItems(page);
  checkSame(items.map((item) => item.label), itemsWithoutJoin, "the menu on a stage");
  check(items.at(-1).danger && !items.slice(0, -1).some((item) => item.danger), "Only Delete is red in the menu.");
  await page.keyboard.press("Escape");

  await rightClick(page, groupHeading("S03 Drug A row A"));
  items = await menuItems(page);
  checkSame(items.map((item) => item.label), ["Cut", "Copy", "Paste above", "Paste below", "Join with the group above", "Delete"], "the menu on a tip group");
  check(!items[4].disabled, "Join with the group above is grayed out on group 2.");
  await page.keyboard.press("Escape");

  await rightClick(page, groupHeading("S01 Media row A"));
  items = await menuItems(page);
  checkSame(items[4], { label: "Join with the group above", disabled: true, reason: "It's the first tip group: there's none above it.", danger: false }, "Join on the first tip group");
  await page.keyboard.press("Escape");

  for (const heading of [RANDOMIZATION_HEADING, TABLE_HEADING]) {
    await rightClick(page, heading);
    checkSame((await menuItems(page)).map((item) => item.label), itemsWithoutJoin, `the menu on ${heading}`);
    await page.keyboard.press("Escape");
  }

  // Join only when that tip group alone is selected: groups 2 and 3 selected.
  await page.click(groupHeading("S03 Drug A row A"));
  await page.click(groupHeading("S07 Media row C"), { modifiers: ["Control"] });
  await rightClick(page, groupHeading("S07 Media row C"));
  checkSame((await menuItems(page)).map((item) => item.label), itemsWithoutJoin, "the menu with two tip groups selected");
  await page.keyboard.press("Escape");

  // Delete from the menu.
  await rightClick(page, stageRow("S04 Drug B row B"));
  await chooseFromMenu(page, "Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S04")]), "after the menu's Delete");
  await page.keyboard.press("Control+Z");
  // Cut from the menu.
  await rightClick(page, stageRow("S05 Dye row B"));
  await chooseFromMenu(page, "Cut");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S05")]), "after the menu's Cut");
  check((await message(page)).text === "Cut “S05 Dye row B”.", "The menu's Cut gave another message.");
  await page.keyboard.press("Control+Z");
  // Join from the menu: group 3 (S07) joins group 2.
  await rightClick(page, groupHeading("S07 Media row C"));
  await chooseFromMenu(page, "Join with the group above");
  await page.waitForTimeout(150);
  const plan = deleteTestPlan();
  checkSame(await shownColumn(page), expectedColumn(removeTipChange(plan, stageIdOf(plan, "S07"))), "after Join from the menu");
  checkSame(await message(page), { text: "Joined the tip group to the one above: its stages now use the tips before.", kind: "ok", undo: false, lines: [], hidden: false }, "Join's message");
}

// The tip change's box: its button reads Join with the group above, and joins.
async function checkTipBoxJoin(page) {
  await page.click(`${groupHeading("S07 Media row C")} .edit-button`);
  const button = page.locator(".editing-box button.danger-outline");
  check((await button.textContent()) === "Join with the group above", `The tip box's button reads "${await button.textContent()}".`);
  await button.click();
  await page.waitForTimeout(150);
  const plan = deleteTestPlan();
  checkSame(await shownColumn(page), expectedColumn(removeTipChange(plan, stageIdOf(plan, "S07"))), "after the tip box's Join");
}

// Each kind deleted with the Delete key; the refusals; a mixed selection.
async function checkEachKindAndRefusals(page) {
  const cases = [
    ["a tip group", groupHeading("S03 Drug A row A"), (plan) => [{ kind: "tipGroup", id: stageIdOf(plan, "S03") }], "Deleted a tip group (4 stages)."],
    ["the randomization", RANDOMIZATION_HEADING, (plan) => [{ kind: "randomization", id: plan.randomizations[0].id }], "Deleted a randomization (3 stages)."],
    ["the transfer table", TABLE_HEADING, (plan) => [{ kind: "transferTable", id: plan.transferTables[0].id }], "Deleted a transfer table (2 stages)."],
  ];
  for (const [what, selector, itemsOf, text] of cases) {
    await page.click(selector);
    await page.keyboard.press("Delete");
    await page.waitForTimeout(AFTER_ANIMATION);
    await checkColumn(page, columnAfterDeleting(itemsOf), `after deleting ${what}`);
    check((await message(page)).text === text, `Deleting ${what} said "${(await message(page)).text}".`);
    await page.keyboard.press("Control+Z");
    await checkColumn(page, FULL_COLUMN, `after undoing ${what}`);
  }

  // A randomization's stage alone: its box opened by its heading, then the stage clicked.
  const plan = deleteTestPlan();
  for (const [heading, stageName, refusal] of [
    [RANDOMIZATION_HEADING, "Drug A", "Stage 10, “Drug A”, belongs to a randomization: delete the whole randomization, or change it in its card."],
    [TABLE_HEADING, "Media", "Stage 15, “Media”, belongs to a transfer table: delete the whole transfer table, or change it in its wizard."],
  ]) {
    const box = heading === RANDOMIZATION_HEADING ? "#stages-list > .randomization" : "#stages-list > .transfer-table";
    if ((await page.locator(`${box} .entry-row`).count()) === 0) {
      await page.click(heading);
    }
    await page.click(`${box} .entry-name:text-is("${stageName}")`);
    await page.keyboard.press("Delete");
    await page.waitForTimeout(AFTER_ANIMATION);
    checkSame(await message(page), { text: refusal, kind: "error", undo: false, lines: [], hidden: false }, `deleting ${stageName} alone`);
    await checkColumn(page, FULL_COLUMN, `after refusing ${stageName} alone`);
  }
  check(plan.stageOrder.length === 16, "The test plan should have 16 stages.");

  // Every stage selected: the first tip group's heading, then Shift-click the transfer table's.
  await page.click(groupHeading("S01 Media row A"));
  await page.click(TABLE_HEADING, { modifiers: ["Shift"] });
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  check(
    (await message(page)).text === "That's every stage in the plan, and a plan needs at least one. Leave one stage, or add a new one first.",
    `Every stage selected gave "${(await message(page)).text}".`,
  );
  await checkColumn(page, FULL_COLUMN, "after refusing every stage");

  // A mixed selection: S02, S03's tip group by its heading with Ctrl-click, the transfer table.
  await page.click(stageRow("S02 Media row B"));
  await page.click(groupHeading("S03 Drug A row A"), { modifiers: ["Control"] });
  await page.click(TABLE_HEADING, { modifiers: ["Control"] });
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(
    page,
    columnAfterDeleting((p) => [stageItem(p, "S02"), { kind: "tipGroup", id: stageIdOf(p, "S03") }, { kind: "transferTable", id: p.transferTables[0].id }]),
    "after the mixed delete",
  );
  const shown = await message(page);
  checkSame([shown.text, shown.undo], ["Deleted 3 items (7 stages).", true], "the mixed delete's message");
  checkSame((await trashRows(page)).map((row) => row.name), ["“S02 Media row B”", "Tip group", "Transfer table"], "the trash after the mixed delete");
}

// A mixing box (from the test plan with a mixing box, opened from a plan file): one of its mix
// steps alone refused; the box deleted by its heading and Delete, into the trash as one entry; the
// entry dragged back out to where the box was; then the wizard's Remove putting it in the trash.
// (The refusal is checked first, while the box is there as opened.)
async function checkMixingBox(page) {
  const plan = mixingBoxTestPlan();
  const asOpened = expectedColumn(plan);
  const mixingBoxItem = { kind: "mixingBox", id: plan.mixingBoxes[0].id };

  // One of its mix steps alone: its box opened by its heading, the mix step clicked, Delete.
  let refusal = null;
  try {
    deleteItems(plan, [{ kind: "stage", id: plan.mixingBoxes[0].stages[0] }]);
  } catch (error) {
    refusal = error.message;
  }
  check(refusal !== null && refusal.includes("belongs to a mixing box"), `The logic gave "${refusal}" for a mix step alone.`);
  await page.click(MIXING_BOX_HEADING);
  await page.click(`#stages-list > .mixing-box .entry-name:text-is("Mix 1 of 5")`);
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  checkSame(await message(page), { text: refusal, kind: "error", undo: false, lines: [], hidden: false }, "deleting a mix step alone");
  await checkColumn(page, asOpened, "after refusing a mix step alone");

  // Its heading clicked and Delete pressed.
  await page.click(MIXING_BOX_HEADING);
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, expectedColumn(deleteItems(plan, [mixingBoxItem]).plan), "after deleting the mixing box");
  const deleted = await message(page);
  checkSame([deleted.text, deleted.kind, deleted.undo], ["Deleted a mixing box (5 stages).", "ok", true], "deleting the mixing box's message");
  const rows = await trashRows(page);
  checkSame(rows.map((row) => row.name), ["Mixing box"], "the trash after deleting the mixing box");
  check(rows[0].details.startsWith("5 stages · 5 transfers · deleted "), `The mixing box's entry says "${rows[0].details}".`);

  // The entry dragged out to the seam where the box was (box 3, between S07's and S08's groups).
  await dragEntryToSeam(page, 0, { kind: "between", index: 3 }, {
    whileThere: async () => {
      const label = await page.textContent("#drag-label");
      check(label === "Paste a mixing box", `Dragging the mixing box out, the label reads "${label}".`);
    },
  });
  await checkColumn(page, asOpened, "the mixing box dragged back");
  checkSame(await trashRows(page), [], "the trash after dragging the mixing box out");

  // Its ✎, then the wizard's Remove.
  await page.click("#trash-line");
  await page.click("#stages-list > .mixing-box .box-edit");
  await page.click(".mixing-wizard-footer button.danger-outline");
  await page.waitForTimeout(150);
  const removed = await message(page);
  checkSame([removed.text, removed.kind, removed.undo], ["Removed the mixing box and its 5 mix steps.", "ok", true], "the wizard's Remove's message");
  checkSame((await trashRows(page)).map((row) => row.name), ["Mixing box"], "the trash after the wizard's Remove");
}

// The mixing wizard refuses deleting and the trash (section 16), from the test plan with a mixing
// box, S04 deleted first so the trash has an entry and the trash's list left open: with the wizard
// open on the box (its ✎), then on a new mixing (a seam's ⟳⟳ after a click on a stage), Delete and
// Ctrl+X are refused, and so are a press on the trash's line, a drag of the entry onto the column
// and a drop of a stage on the trash; the plan and trash don't change. The page throwing fails the
// check (main).
async function checkMixingWizardRefusesDeleting(page) {
  const plan = mixingBoxTestPlan();
  const column = expectedColumn(deleteItems(plan, [{ kind: "stage", id: stageIdOf(plan, "S04") }]).plan);
  await deleteStage(page, "S04 Drug B row B");
  await checkColumn(page, column, "after deleting S04");
  const trashBefore = JSON.stringify(await storedTrash(page));
  await trashRows(page);
  // Counts the wizard's shakes: the class comes and goes with its animation.
  await page.evaluate(() => {
    window.wizardShakes = 0;
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.target.matches(".mixing-wizard.shake")) {
          window.wizardShakes += 1;
        }
      }
    }).observe(document.body, { attributes: true, attributeFilter: ["class"], subtree: true });
  });

  // Checks the refusal's message and that the wizard shook, then that nothing changed.
  const checkRefused = async (refusal, what) => {
    const shown = await message(page);
    checkSame([shown.text, shown.kind], [refusal, "note"], `${what}: the message`);
    const shakes = await page.evaluate(() => {
      const count = window.wizardShakes;
      window.wizardShakes = 0;
      return count;
    });
    check(shakes > 0, `${what}: the wizard didn't shake.`);
    await page.evaluate(() => {
      document.getElementById("message-bar").querySelector(".message-text").textContent = "";
    });
    await checkColumn(page, column, `${what}: the column`);
    check(JSON.stringify(await storedTrash(page)) === trashBefore, `${what}: the trash changed.`);
  };

  // Tries each refused way of deleting or using the trash, expecting `refusal` each time.
  const tryEach = async (refusal, where) => {
    await page.keyboard.press("Delete");
    await page.waitForTimeout(AFTER_ANIMATION);
    await checkRefused(refusal, `Delete ${where}`);
    await page.keyboard.press("Control+X");
    await page.waitForTimeout(AFTER_ANIMATION);
    await checkRefused(refusal, `Ctrl+X ${where}`);
    await page.click("#trash-line");
    await checkRefused(refusal, `a press on the trash's line ${where}`);
    check(await page.locator("#trash-list .trash-entry").first().isVisible(), `The trash's list isn't open ${where}.`);
    await scrollToMiddle(page, stageRow("S03 Drug A row A"));
    await dragTo(page, "#trash-list .trash-entry >> nth=0", await centerOf(page, stageRow("S03 Drug A row A")));
    await checkRefused(refusal, `a drag of the entry onto the column ${where}`);
    await scrollToMiddle(page, stageRow("S07 Media row C"));
    await dragTo(page, stageRow("S07 Media row C"), await centerOf(page, "#trash-line"));
    await page.waitForTimeout(AFTER_ANIMATION);
    await checkRefused(refusal, `a drop of a stage on the trash ${where}`);
  };

  // The wizard on the box, by its ✎.
  await page.click("#stages-list > .mixing-box .box-edit");
  await tryEach("Update the mixing box, or cancel, first.", "with the wizard on the box");
  await page.keyboard.press("Escape");
  check((await page.locator(".mixing-wizard").count()) === 0, "Escape didn't cancel the wizard on the box.");

  // A new mixing, after a click on a stage.
  await page.click(stageRow("S03 Drug A row A"));
  const seam = "#stages-list .seam:has(.seam-button.add-mixing) >> nth=0";
  await scrollToMiddle(page, seam);
  await page.hover(seam);
  await page.locator(`${seam} >> .seam-button.add-mixing`).click();
  check((await page.locator(".mixing-wizard").count()) === 1, "The seam's ⟳⟳ didn't open the wizard.");
  await tryEach("Make the mix steps, or cancel the mixing, first.", "with a new mixing");
}

// A group's first stage removed with its box's Remove keeps the group's tips; Join refused just
// after a randomization.
async function checkRemoveFirstStageAndJoinRefused(page) {
  await page.click(stageRow("S03 Drug A row A"));
  await page.click(`#stages-list .entry.is-open .edit-button`);
  await page.click(".editing-box button.danger-outline");
  await page.waitForTimeout(150);
  const plan = deleteTestPlan();
  checkSame(await shownColumn(page), expectedColumn(removeStage(plan, stageIdOf(plan, "S03"))), "after Remove on S03");
  const column = await shownColumn(page);
  check(column[1].tips === FULL_COLUMN[1].tips, `Group 2's heading reads "${column[1].tips}", not "${FULL_COLUMN[1].tips}".`);
  const shown = await message(page);
  checkSame([shown.text, shown.undo], ["Removed stage 3, “S03 Drug A row A” and its 4 transfers.", true], "Remove's message");
  checkSame((await trashRows(page)).map((row) => row.name), ["“S03 Drug A row A”"], "the trash after Remove");
  await page.click(".message-undo");
  await checkColumn(page, FULL_COLUMN, "after the message's Undo of Remove");
  checkSame(await trashRows(page), [], "the trash after undoing Remove");

  let refusal = null;
  try {
    removeTipChange(plan, stageIdOf(plan, "S10"));
  } catch (error) {
    refusal = error.message;
  }
  await rightClick(page, groupHeading("S10 Media row G"));
  const join = (await menuItems(page)).find((item) => item.label === "Join with the group above");
  checkSame(join, { label: "Join with the group above", disabled: true, reason: refusal, danger: false }, "Join just after a randomization");
  await page.keyboard.press("Escape");
}

// The animation: the rows still drawn, red, right after Delete; gone after DELETE_ANIMATION_MS;
// Ctrl+Z during it cancels only the delete; a second Delete during it is ignored.
async function checkAnimation(page) {
  await page.click(stageRow("S04 Drug B row B"));
  await page.keyboard.press("Delete");
  const during = await page.evaluate(() => ({
    deleting: document.querySelectorAll("#stages-list .deleting").length,
    stillThere: [...document.querySelectorAll("#stages-list .entry-name")].some((name) => name.textContent === "S04 Drug B row B"),
  }));
  check(during.deleting === 1 && during.stillThere, `Right after Delete: ${JSON.stringify(during)}.`);
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S04")]), "after the animation");

  // Ctrl+Z during the animation: canceled, the earlier delete (S04's) not undone.
  await page.click(stageRow("S07 Media row C"));
  await page.keyboard.press("Delete");
  await page.keyboard.press("Control+Z");
  await page.waitForTimeout(AFTER_ANIMATION);
  checkSame(await message(page), { text: "Delete canceled.", kind: "note", undo: false, lines: [], hidden: false }, "Ctrl+Z during the animation");
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S04")]), "after canceling");
  checkSame((await trashRows(page)).map((row) => row.name), ["“S04 Drug B row B”"], "the trash after canceling");
  // Undo's next step is still S04's delete.
  await page.keyboard.press("Control+Z");
  await checkColumn(page, FULL_COLUMN, "Undo after canceling");
  // Then a click on the row and Delete again: deleted once, with one entry.
  await page.click(stageRow("S07 Media row C"));
  await page.keyboard.press("Delete");
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S07")]), "after Delete twice during the animation");
  checkSame((await trashRows(page)).map((row) => row.name), ["“S07 Media row C”"], "one entry after Delete twice");
}

// With reduced motion, the rows go at once.
async function checkReducedMotion(page) {
  await page.click(stageRow("S04 Drug B row B"));
  await page.keyboard.press("Delete");
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S04")]), "at once with reduced motion");
}

// A delete ends the last press; the message's Undo; and its Undo after a later edit.
async function checkLastPressAndMessageUndo(page) {
  await deleteStage(page, "S04 Drug B row B");
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S04")]), "Delete again after a delete");
  await deleteStage(page, "S05 Dye row B");
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S04"), stageItem(plan, "S05")]), "Delete after a new click");

  // The message's Undo brings S05 back, the trash losing its entry.
  await page.click(".message-undo");
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S04")]), "the message's Undo");
  checkSame((await trashRows(page)).map((row) => row.name), ["“S04 Drug B row B”"], "the trash after the message's Undo");

  // The message's Undo after a later edit that shows no message of its own: closing the card of a
  // randomization that hasn't run, after changing its seed, saves its draft silently. The Undo
  // undoes that, as Ctrl+Z would, and S05 stays deleted.
  await page.hover(seamAt({ kind: "between", index: 2 }));
  await page.click(`${seamAt({ kind: "between", index: 2 })} .add-randomization`);
  await page.waitForTimeout(150);
  await deleteStage(page, "S05 Dye row B");
  check((await message(page)).undo, "The delete's message has no Undo.");
  await page.click("#stages-list > .randomization.not-set-up .randomization-heading");
  await page.fill("#card-seed", "4242");
  await page.click('.randomization-card button.action:text-is("Close")');
  await page.waitForTimeout(150);
  const shown = await message(page);
  checkSame([shown.text, shown.undo], ["Deleted “S05 Dye row B”.", true], "the message after the card's silent save");
  await page.click(".message-undo");
  check((await message(page)).text === "Undone.", "The message's Undo didn't undo.");
  check(!(await shownColumn(page)).some((box) => box.stages?.includes("S05 Dye row B")), "The message's Undo brought S05 back, not the later edit.");
  await page.click("#stages-list > .randomization.not-set-up .randomization-heading");
  const seed = await page.inputValue("#card-seed");
  check(seed !== "4242", "The message's Undo didn't undo the card's save.");
  await page.click('.randomization-card button.action:text-is("Close")');
  await page.keyboard.press("Control+Z");
  check((await shownColumn(page)).some((box) => box.stages?.includes("S05 Dye row B")), "Ctrl+Z after that didn't bring S05 back.");
}

// The trash's line, list, the Removes, Reset's question, dragging onto it, after a reload, Empty
// trash, Reset and Undo, and while moving wells.
async function checkTrash(page) {
  check((await trashLine(page)) === "🗑TrashDrag here to delete", `The empty trash's line reads "${await trashLine(page)}".`);
  checkSame(await trashRows(page), [], "the empty trash's rows");
  check((await page.textContent("#trash-list")).includes("The trash is empty."), "The empty list doesn't say it's empty.");
  await page.click("#trash-line");

  await deleteStage(page, "S09 Media row H");
  await page.click(stageRow("S02 Media row B"));
  await page.click(stageRow("S05 Dye row B"), { modifiers: ["Control"] });
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  check((await trashLine(page)) === "🗑Trash (3)▴", `The line reads "${await trashLine(page)}".`);
  const rows = await trashRows(page);
  checkSame(rows.map((row) => row.name), ["“S02 Media row B”", "“S05 Dye row B”", "“S09 Media row H”"], "newest first, column order within a delete");
  for (const row of rows) {
    check(/^4 transfers · deleted \d{1,2}:\d{2}/.test(row.details) && row.buttons === 0, `A row reads "${row.details}" with ${row.buttons} buttons.`);
  }
  check((await trashLine(page)).endsWith("▾"), "The open list's line doesn't end with ▾.");
  await page.click("#trash-line");

  // The randomization card's Remove and the wizard's Remove each add an entry, with Undo.
  await page.click(`#stages-list > .randomization .box-edit`);
  await page.click(".randomization-card button.quiet-danger");
  await page.waitForTimeout(150);
  let shown = await message(page);
  checkSame([shown.text, shown.undo], ["Removed the randomization and its 3 stages.", true], "the card's Remove");
  check((await trashRows(page))[0].name === "Randomization “Randomization1”", "The card's Remove didn't add the randomization's entry.");
  check((await trashRows(page))[0].details.startsWith("3 stages · 12 transfers · deleted "), "The randomization's entry has other details.");
  await page.click(".message-undo");
  check((await trashRows(page)).length === 3, "Undo of the card's Remove didn't take its entry out.");
  await page.click(`#stages-list > .transfer-table .box-edit`);
  await page.click("#wizard button.danger-outline:text-is('Remove')");
  await page.waitForTimeout(150);
  shown = await message(page);
  checkSame([shown.text, shown.undo], ["Removed the transfer table and its 2 stages.", true], "the wizard's Remove");
  check((await trashRows(page))[0].name === "Transfer table", "The wizard's Remove didn't add the table's entry.");
  await page.click(".message-undo");
  check((await trashRows(page)).length === 3, "Undo of the wizard's Remove didn't take its entry out.");

  // Reset's question says it empties the trash.
  await page.click("#reset");
  check((await page.textContent("#reset-box")).includes("and empties the trash"), "Reset's question doesn't mention the trash.");
  await page.click("#reset-cancel");

  // After a reload, the trash is still there.
  await page.reload();
  check((await trashLine(page)) === "🗑Trash (3)▴", `After a reload the line reads "${await trashLine(page)}".`);

  // Reset empties it, and Undo brings it back.
  await page.click("#reset");
  await page.click("#reset-everything");
  check((await trashLine(page)) === "🗑TrashDrag here to delete", "Reset didn't empty the trash.");
  await page.keyboard.press("Control+Z");
  check((await trashLine(page)) === "🗑Trash (3)▴", "Undo of Reset didn't bring the trash back.");

  // While moving wells: the list opens, but a press on an entry and Empty trash are refused.
  await page.click("#move-wells");
  const rowsWhileMoving = await trashRows(page);
  check(rowsWhileMoving.length === 3, "The list didn't open while moving wells.");
  await page.click("#trash-list .trash-entry >> nth=0");
  check((await message(page)).text === "Stages can't be changed while moving wells. Press Done first.", "A press on an entry while moving wells wasn't refused.");
  await page.click("#trash-list .trash-empty");
  check((await trashRows(page)).length === 3, "Empty trash worked while moving wells.");
  await page.click("#move-wells");

  // Delete with the focus on a trash entry, after a click in the column: nothing.
  await page.click(stageRow("S04 Drug B row B"));
  await page.click("#trash-list .trash-entry >> nth=0");
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  check((await message(page)).text === "Drag it to a gap to put it there.", "A click on an entry didn't give its note.");
  check((await shownColumn(page)).some((box) => box.stages?.includes("S04 Drug B row B")), "Delete with the focus on an entry deleted.");

  // Empty trash: at once, with its note.
  await page.click("#trash-list .trash-empty");
  checkSame(await trashRows(page), [], "the trash after Empty trash");
  checkSame(await message(page), { text: "Emptied the trash.", kind: "note", undo: false, lines: [], hidden: false }, "the message after Empty trash");
}

// Dragging a stage onto the trash deletes it (the trash and label red), Ctrl held too.
async function checkDragOntoTrash(page) {
  const trash = await centerOf(page, "#trash-line");
  await dragTo(page, stageRow("S04 Drug B row B"), trash, {
    whileThere: async () => {
      const looks = await page.evaluate(() => ({
        trash: document.getElementById("trash").classList.contains("drop-target"),
        label: document.getElementById("drag-label").textContent,
        red: document.getElementById("drag-label").classList.contains("deleting"),
        line: !document.getElementById("drop-line").hidden,
      }));
      checkSame(looks, { trash: true, label: "Delete “S04 Drug B row B”", red: true, line: false }, "a drag over the trash");
    },
  });
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S04")]), "after dropping on the trash");
  await dragTo(page, stageRow("S05 Dye row B"), trash, { holdControl: true });
  await page.waitForTimeout(AFTER_ANIMATION);
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S04"), stageItem(plan, "S05")]), "after dropping on the trash with Ctrl");
  checkSame((await trashRows(page)).map((row) => row.name), ["“S05 Dye row B”", "“S04 Drug B row B”"], "the trash after the drops");
}

// Dragging entries out of the trash, back where they were, and the cases around it.
async function checkDragOut(page) {
  // S03 back into group 2 at its top: the drop line, the label, the list closing.
  await deleteStage(page, "S03 Drug A row A");
  await dragEntryToSeam(page, 0, { kind: "inTipGroup", index: 1, position: 0 }, {
    whileThere: async () => {
      const looks = await page.evaluate(() => ({
        label: document.getElementById("drag-label").textContent,
        line: !document.getElementById("drop-line").hidden,
        listClosed: document.getElementById("trash-list").hidden,
      }));
      checkSame(looks, { label: "Paste “S03 Drug A row A”", line: true, listClosed: true }, "a drag out of the trash");
    },
  });
  await checkColumn(page, FULL_COLUMN, "S03 dragged back");
  checkSame(await trashRows(page), [], "the trash after dragging S03 out");
  check((await message(page)).text === "Pasted “S03 Drug A row A” from the trash.", `Dragging out said "${(await message(page)).text}".`);
  check((await page.locator("#stages-list [data-item^='stage:'].selected .entry-name").first().textContent()) === "S03 Drug A row A", "What was pasted isn't selected.");

  // S07, then S08, deleted separately, dragged back in reverse order with Ctrl held (no Copy).
  await deleteStage(page, "S07 Media row C");
  await deleteStage(page, "S08 Dye row C");
  await dragEntryToSeam(page, 0, { kind: "inTipGroup", index: 2, position: 0 }, {
    holdControl: true,
    beforeRelease: async () => {
      const label = await page.textContent("#drag-label");
      check(!label.includes("Copy"), `With Ctrl, the label reads "${label}".`);
    },
  });
  await dragEntryToSeam(page, 0, { kind: "between", index: 2 });
  await checkColumn(page, FULL_COLUMN, "S07 and S08 dragged back");

  // A tip group can only go between tip groups: dropped over a seam inside group 1, it lands
  // between boxes.
  await page.click(groupHeading("S03 Drug A row A"));
  await page.keyboard.press("Delete");
  await page.waitForTimeout(AFTER_ANIMATION);
  await dragEntryToSeam(page, 0, { kind: "inTipGroup", index: 0, position: 1 });
  const column = await shownColumn(page);
  check(
    column.some((box) => JSON.stringify(box) === JSON.stringify(FULL_COLUMN[1])) &&
      column.some((box) => JSON.stringify(box) === JSON.stringify(FULL_COLUMN[0])),
    `A tip group dropped inside one: ${JSON.stringify(column)}.`,
  );

  // Dropped with nothing marked (on the deck): nothing; Escape cancels.
  await page.keyboard.press("Control+Z");
  await checkColumn(page, columnAfterDeleting((plan) => [{ kind: "tipGroup", id: stageIdOf(plan, "S03") }]), "back to group 2 deleted");
  await page.click("#trash-line");
  await dragTo(page, "#trash-list .trash-entry >> nth=0", await centerOf(page, `.well[data-labware="${PLATE}"][data-well="H12"]`));
  check((await trashRows(page)).length === 1, "A drop with nothing marked took the entry out.");
  const seam = await centerOf(page, seamAt({ kind: "between", index: 1 }));
  await dragTo(page, "#trash-list .trash-entry >> nth=0", seam, { beforeRelease: () => page.keyboard.press("Escape") });
  check((await trashRows(page)).length === 1, "Escape didn't cancel the drag out.");
  await checkColumn(page, columnAfterDeleting((plan) => [{ kind: "tipGroup", id: stageIdOf(plan, "S03") }]), "after a drop on the deck and Escape");

  // A click on an entry: its note.
  await page.click("#trash-list .trash-entry >> nth=0");
  check((await message(page)).text === "Drag it to a gap to put it there.", "A click on an entry didn't give its note.");

  // Into another plan, opened from a file: the trash is kept, and the entry pastes there.
  await openPlanFile(page, EMPTY_PLAN_FILE);
  check((await trashLine(page)).startsWith("🗑Trash (1)"), "Opening a plan file changed the trash.");
  await dragEntryToSeam(page, 0, { kind: "between", index: 0 });
  checkSame(
    (await shownColumn(page)).map((box) => box.stages),
    [["S03 Drug A row A", "S04 Drug B row B", "S05 Dye row B", "S06 Mix row A"], ["New stage"]],
    "the tip group pasted into another plan",
  );
}

// The column scrolled to its end with the trash closed: End's card and the seam above it wholly
// above the band.
async function checkScrolledToEnd(page) {
  await page.evaluate(() => {
    const column = document.getElementById("stages-column");
    column.style.scrollBehavior = "auto";
    column.scrollTop = column.scrollHeight;
  });
  await page.waitForTimeout(150);
  const rects = await page.evaluate(() => {
    const end = document.querySelector('#stages-list .entry[data-entry="end"]').getBoundingClientRect();
    const seams = document.querySelectorAll("#stages-list > .group-seam");
    const seam = seams[seams.length - 1].getBoundingClientRect();
    const band = document.getElementById("trash").getBoundingClientRect();
    return { end: end.bottom, seam: seam.bottom, band: band.top };
  });
  check(rects.end <= rects.band && rects.seam <= rects.band, `End or the seam above it is under the trash: ${JSON.stringify(rects)}.`);
}

// A refused paste: an entry whose stored copy is damaged, put in storage before the page opened.
async function checkRefusedPaste(browser, url, errors) {
  const plan = deleteTestPlan();
  const trash = addDeleted(emptyTrash(), plan, [{ kind: "stage", id: stageIdOf(plan, "S04") }], NOW).trash;
  const data = JSON.parse(trashToText(trash));
  data.entries[0].copied = { format: "nope" };
  const context = await freshContext(browser);
  await context.addInitScript(
    ([key, text]) => {
      if (sessionStorage.getItem("walk: set") === null) {
        localStorage.setItem(key, text);
        sessionStorage.setItem("walk: set", "yes");
      }
    },
    [TRASH_KEY, JSON.stringify(data)],
  );
  try {
    const page = await openPage(context, url, errors);
    await openPlanFile(page);
    await dragEntryToSeam(page, 0, { kind: "between", index: 0 });
    const shown = await message(page);
    check(shown.kind === "error" && shown.text.startsWith("Can't paste"), `A damaged entry gave "${shown.text}".`);
    await checkColumn(page, FULL_COLUMN, "after a refused paste");
    check((await trashRows(page)).length === 1, "The refused entry left the trash.");
  } finally {
    await context.close();
  }
}

// TRASH_LIMIT + 1 entries in storage: the newest TRASH_LIMIT listed, no note; and an entry deleted
// the day before shows its date.
async function checkStoredLimitAndDates(browser, url, errors) {
  const plan = deleteTestPlan();
  let trash = emptyTrash();
  for (let made = 0; made < TRASH_LIMIT; made += 1) {
    trash = addDeleted(trash, plan, [{ kind: "stage", id: stageIdOf(plan, "S04") }], NOW).trash;
  }
  const data = JSON.parse(trashToText(trash));
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const older = { ...data.entries[0], id: data.nextEntryId, deletion: 1, name: "S01 Media row A", deletedAt: yesterday };
  data.entries = [older, ...data.entries.map((entry) => ({ ...entry, deletion: entry.deletion + 1 }))];
  data.nextEntryId += 1;
  data.nextDeletion += 1;
  // The newest entry made yesterday too, to see the date before the time.
  data.entries[1].deletedAt = yesterday;
  const context = await freshContext(browser);
  await context.addInitScript(([key, text]) => localStorage.setItem(key, text), [TRASH_KEY, JSON.stringify(data)]);
  try {
    const page = await openPage(context, url, errors);
    check((await trashLine(page)) === `🗑Trash (${TRASH_LIMIT})▴`, `With ${TRASH_LIMIT + 1} stored, the line reads "${await trashLine(page)}".`);
    const rows = await trashRows(page);
    check(rows.length === TRASH_LIMIT && !rows.some((row) => row.name === "“S01 Media row A”"), "The oldest entry is listed.");
    const shown = await message(page);
    check(![NOT_KEPT_NOTE, NEWER_NOTE, DAMAGED_NOTE].some((note) => shown.lines.includes(note) || shown.text === note), "A note showed for a full trash.");
    const datedRows = rows.filter((row) => /deleted [A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}/.test(row.details));
    check(datedRows.length >= 1, `No row shows a date before the time: ${rows.map((row) => row.details).join(" | ")}.`);
  } finally {
    await context.close();
  }
}

// Undo and Redo of a delete and of a drag-out; a drag-out with an editing box with changes open; a
// change of what's open between a delete and its Undo.
async function checkEditsAroundTrash(page) {
  await deleteStage(page, "S04 Drug B row B");
  await page.keyboard.press("Control+Z");
  checkSame(await trashRows(page), [], "Undo of a delete");
  await page.keyboard.press("Control+Y");
  check((await trashRows(page)).length === 1, "Redo of a delete didn't put the entry back.");
  await dragEntryToSeam(page, 0, { kind: "inTipGroup", index: 1, position: 1 });
  checkSame(await trashRows(page), [], "after dragging out");
  await page.keyboard.press("Control+Z");
  check((await trashRows(page)).length === 1, "Undo of a drag-out didn't put the entry back.");
  await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S04")]), "Undo of a drag-out");
  await page.keyboard.press("Control+Y");
  checkSame(await trashRows(page), [], "Redo of a drag-out");
  await checkColumn(page, FULL_COLUMN, "Redo of a drag-out");

  // A drag-out with a stage's editing box with changes open: the list opened first, then the box
  // changed, then an entry dragged: refused, shaking, its message, the trash and plan unchanged.
  await deleteStage(page, "S04 Drug B row B");
  if (await page.isHidden("#trash-list")) {
    await page.click("#trash-line");
  }
  await page.click(stageRow("S05 Dye row B"));
  await page.click(`#stages-list .entry.is-open .edit-button`);
  await page.fill(".editing-box input[type='text']", "Changed name");
  const columnBefore = await shownColumn(page);
  const trashBefore = await storedTrash(page);
  check(await page.isVisible("#trash-list .trash-entry"), "The trash's list closed when the box opened.");
  const entry = await centerOf(page, "#trash-list .trash-entry >> nth=0");
  const target = await centerOf(page, seamAt({ kind: "between", index: 0 }));
  await page.mouse.move(entry.x, entry.y);
  await page.mouse.down();
  const shaking = await page.evaluate(() => document.querySelector(".editing-box").classList.contains("shake"));
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const refused = await message(page);
  check(refused.text === "Save or discard your changes first.", `A drag out with changes open said "${refused.text}".`);
  check(shaking, "The editing box didn't shake.");
  checkSame(await shownColumn(page), columnBefore, "the column after a refused drag out");
  checkSame(await storedTrash(page), trashBefore, "the trash after a refused drag out");
  check(await page.isVisible(".editing-box"), "The editing box with changes closed.");
  await page.click(".editing-box .discard");

  // A delete, then a change of what's open, then Undo: the delete's entries leave the trash.
  await deleteStage(page, "S07 Media row C");
  await page.click(stageRow("S01 Media row A"));
  await page.keyboard.press("Control+Z");
  checkSame((await trashRows(page)).map((row) => row.name), ["“S04 Drug B row B”"], "Undo after opening another stage");
}

// Two tabs sharing the trash: each change keeps the other tab's entries; Undo and Redo move only
// this tab's.
async function checkTwoTabs(browser, url, errors) {
  const context = await freshContext(browser);
  try {
    const first = await openPage(context, url, errors);
    await openPlanFile(first);
    const second = await openPage(context, url, errors);
    await openPlanFile(second);
    await deleteStage(second, "S07 Media row C");
    await deleteStage(first, "S04 Drug B row B");
    let stored = await storedTrash(first);
    checkSame(stored.entries.map((entry) => entry.name), ["S04 Drug B row B", "S07 Media row C"], "both tabs' entries kept");
    await first.keyboard.press("Control+Z");
    stored = await storedTrash(first);
    checkSame(stored.entries.map((entry) => entry.name), ["S07 Media row C"], "this tab's Undo kept the other tab's entry");
    await first.keyboard.press("Control+Y");
    stored = await storedTrash(first);
    checkSame(stored.entries.map((entry) => entry.name), ["S04 Drug B row B", "S07 Media row C"], "this tab's Redo");

    // An entry the other tab dragged out, dropped in this tab: its note, nothing pasted.
    await second.reload();
    await openPlanFile(second);
    await dragEntryToSeam(second, 0, { kind: "inTipGroup", index: 1, position: 1 });
    const before = await shownColumn(first);
    if (await first.isHidden("#trash-list")) {
      await first.click("#trash-line");
    }
    await dragEntryToSeam(first, 0, { kind: "inTipGroup", index: 1, position: 1 });
    check((await message(first)).text === "That item has left the trash (another tab used it).", `A used entry gave "${(await message(first)).text}".`);
    checkSame(await shownColumn(first), before, "nothing pasted from a used entry");
    checkSame((await trashRows(first)).map((row) => row.name), ["“S07 Media row C”"], "the list redrawn without the used entry");

    // In the order section 16 gives: this tab deletes, the second tab deletes, then this tab's Undo
    // and Redo move only this tab's entry, the second tab's kept.
    await first.evaluate((key) => localStorage.removeItem(key), TRASH_KEY);
    await first.reload();
    await openPlanFile(first);
    await second.reload();
    await openPlanFile(second);
    await deleteStage(first, "S03 Drug A row A");
    await deleteStage(second, "S10 Media row G");
    stored = await storedTrash(first);
    checkSame(stored.entries.map((entry) => entry.name), ["S10 Media row G", "S03 Drug A row A"], "this tab's delete, then the other's");
    await first.keyboard.press("Control+Z");
    stored = await storedTrash(first);
    checkSame(stored.entries.map((entry) => entry.name), ["S10 Media row G"], "this tab's Undo after the other tab's delete");
    await first.keyboard.press("Control+Y");
    stored = await storedTrash(first);
    checkSame(stored.entries.map((entry) => entry.name), ["S10 Media row G", "S03 Drug A row A"], "this tab's Redo after the other tab's delete");
  } finally {
    await context.close();
  }
}

// Local storage switched off: the note after the first delete's message, the trash in memory.
async function checkStorageOff(browser, url, errors) {
  const context = await freshContext(browser);
  await context.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage is switched off.");
    };
    Storage.prototype.getItem = () => {
      throw new Error("Storage is switched off.");
    };
  });
  try {
    const page = await openPage(context, url, errors);
    await openPlanFile(page);
    await deleteStage(page, "S04 Drug B row B");
    checkSame(await message(page), { text: "Deleted “S04 Drug B row B”.", kind: "ok", undo: true, lines: [NOT_KEPT_NOTE], hidden: false }, "the first delete with storage off");
    checkSame((await trashRows(page)).map((row) => row.name), ["“S04 Drug B row B”"], "the trash with storage off");
    await deleteStage(page, "S07 Media row C");
    check((await message(page)).lines.length === 0, "The storage note showed twice.");
    await dragEntryToSeam(page, 1, { kind: "inTipGroup", index: 1, position: 1 });
    await checkColumn(page, columnAfterDeleting((plan) => [stageItem(plan, "S07")]), "dragging out with storage off");
  } finally {
    await context.close();
  }
}

// A stored trash of version 2, or damaged: its note when the page opens, deleting in memory, and the
// stored text unchanged.
async function checkStoredNewerOrDamaged(browser, url, errors) {
  const plan = deleteTestPlan();
  const trash = addDeleted(emptyTrash(), plan, [{ kind: "stage", id: stageIdOf(plan, "S09") }], NOW).trash;
  const newer = { ...JSON.parse(trashToText(trash)), version: 2 };
  const damaged = JSON.parse(trashToText(addDeleted(trash, plan, [{ kind: "stage", id: stageIdOf(plan, "S10") }], NOW).trash));
  damaged.entries[0].kind = "box";
  for (const [what, data, note, startsWith] of [
    ["newer", newer, NEWER_NOTE, 0],
    ["damaged", damaged, DAMAGED_NOTE, 1],
  ]) {
    const context = await freshContext(browser);
    try {
      const page = await openPage(context, url, errors);
      const text = JSON.stringify(data);
      await page.evaluate(([key, value]) => localStorage.setItem(key, value), [TRASH_KEY, text]);
      await page.reload();
      const opened = await message(page);
      check(opened.text === note || opened.lines.includes(note), `A ${what} stored trash: the message is ${JSON.stringify(opened)}.`);
      check((await trashRows(page)).length === startsWith, `A ${what} stored trash starts with the wrong entries.`);
      await openPlanFile(page);
      await deleteStage(page, "S04 Drug B row B");
      check((await trashRows(page)).length === startsWith + 1, `Deleting with a ${what} stored trash didn't work in memory.`);
      const stored = await page.evaluate((key) => localStorage.getItem(key), TRASH_KEY);
      check(stored === text, `The ${what} stored trash was written over.`);
    } finally {
      await context.close();
    }
  }
}

// The tutorial build keeps its own trash.
async function checkTutorialTrash(browser, tutorialUrl, errors) {
  const context = await freshContext(browser);
  try {
    const page = await openPage(context, tutorialUrl, errors);
    await openPlanFile(page);
    await deleteStage(page, "S04 Drug B row B");
    const stored = await page.evaluate(([own, designers]) => ({ own: localStorage.getItem(own), designers: localStorage.getItem(designers) }), [TUTORIAL_TRASH_KEY, TRASH_KEY]);
    check(stored.own !== null && JSON.parse(stored.own).entries.length === 1, "The tutorial's trash didn't get the entry.");
    check(stored.designers === null, "The tutorial wrote the designer's trash.");
  } finally {
    await context.close();
  }
}

// --- Running ---

// Runs one check: in a fresh context (with `contextOptions`), the test plan opened, then `run(page)`.
function withTestPlan(run, contextOptions = {}) {
  return withPlanFile(TEST_PLAN_FILE, FULL_COLUMN, run, contextOptions);
}

// Runs one check: in a fresh context (with `contextOptions`), the plan file `file` opened and its
// column checked against `column`, then `run(page)`.
function withPlanFile(file, column, run, contextOptions = {}) {
  return async (browser, url, errors) => {
    const context = await freshContext(browser, contextOptions);
    try {
      const page = await openPage(context, url, errors);
      await openPlanFile(page, file);
      await checkColumn(page, column, "the plan as opened");
      await run(page);
    } finally {
      await context.close();
    }
  };
}

// Runs one check with a fresh page and nothing opened yet.
function withFreshPage(run) {
  return async (browser, url, errors) => {
    const context = await freshContext(browser);
    try {
      const page = await openPage(context, url, errors);
      await openPlanFile(page);
      // Open puts the focus nowhere in the column, and no press has been made.
      await run(page);
    } finally {
      await context.close();
    }
  };
}

// Every check, by name.
const CHECKS = [
  ["the Delete key", withTestPlan(checkDeleteKey)],
  ["Delete before any press", withFreshPage(checkDeleteBeforeAnyPress)],
  ["the focus tabbed into the column and back out", withTestPlan(checkFocusInAndOut)],
  ["Ctrl+X", withTestPlan(checkCut)],
  ["the menu", withTestPlan(checkMenu)],
  ["the tip change's box", withTestPlan(checkTipBoxJoin)],
  ["each kind deleted, the refusals and a mixed selection", withTestPlan(checkEachKindAndRefusals)],
  ["a mixing box", withPlanFile(MIXING_BOX_PLAN_FILE, expectedColumn(mixingBoxTestPlan()), checkMixingBox)],
  [
    "the mixing wizard refuses deleting and the trash",
    withPlanFile(MIXING_BOX_PLAN_FILE, expectedColumn(mixingBoxTestPlan()), checkMixingWizardRefusesDeleting),
  ],
  ["a group's first stage removed, and Join refused after a randomization", withTestPlan(checkRemoveFirstStageAndJoinRefused)],
  ["the animation", withTestPlan(checkAnimation)],
  ["reduced motion", withTestPlan(checkReducedMotion, { reducedMotion: "reduce" })],
  ["a delete ends the last press, and the message's Undo", withTestPlan(checkLastPressAndMessageUndo)],
  ["the trash", withTestPlan(checkTrash)],
  ["dragging onto the trash", withTestPlan(checkDragOntoTrash)],
  ["dragging out", withTestPlan(checkDragOut)],
  ["the column scrolled to its end", withTestPlan(checkScrolledToEnd)],
  ["a refused paste", checkRefusedPaste],
  ["the limit and dates of a stored trash", checkStoredLimitAndDates],
  ["edits around the trash", withTestPlan(checkEditsAroundTrash)],
  ["two tabs", checkTwoTabs],
  ["storage switched off", checkStorageOff],
  ["a newer or damaged stored trash", checkStoredNewerOrDamaged],
];

// Runs every check and reports; fails if any check fails or the page throws.
async function main() {
  const { designer, tutorial } = designerFile();
  const url = pathToFileURL(designer).href;
  console.log(`Walking ${designer}`);
  const browser = await launchBrowser();
  console.log(`Browser: ${browser.browserType().name()} ${browser.version()}`);
  let failures = 0;
  try {
    const every = [...CHECKS, ["the tutorial's own trash", (b, _url, errors) => checkTutorialTrash(b, pathToFileURL(tutorial).href, errors)]];
    for (const [name, run] of every.filter(([checkName]) => ONLY === null || checkName.includes(ONLY))) {
      const errors = [];
      try {
        await run(browser, url, errors);
        check(errors.length === 0, `The page threw: ${errors.join("; ")}`);
        console.log(`ok   ${name}`);
      } catch (error) {
        failures += 1;
        console.log(`FAIL ${name}: ${error.message}`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`${failures === 0 ? "All" : failures} ${failures === 0 ? "checks passed" : "checks failed"}.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
