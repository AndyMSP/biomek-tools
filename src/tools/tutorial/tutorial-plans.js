// tutorial-plans.js — makes each tutorial's starting plan (docs/glossary.md, "Starting plan") with
// the transfer designer's own logic, so every starting plan is one the page could have made, and a
// change to the logic that would make one invalid fails a test here. The guide panel puts a
// starting plan in the page's browser copy when a tutorial starts (tutorial-page.md, section 4).
// Specification: tutorial-plans.md.

import { COMPONENT_COLORS } from "../../../config/component-colors.js";
import { CELL_DENSITY_UNIT } from "../../../config/concentration-units.js";
import {
  emptyPlan,
  setExperimentName,
  addComponent,
  setConstituents,
  addToWells,
  setLabel,
  setWellLabel,
  renameStage,
  stageOrder,
  addStageWithNewTips,
  addTransfers,
} from "../transfer-designer/transfer-designer.js";
import { planToText } from "../transfer-designer/plan-file.js";

// The plate wells tutorial 1 fills, row by row: B2, B3, B4, B5, C2 … D5.
const CULTURE_WELLS = ["B", "C", "D"].flatMap((row) => [2, 3, 4, 5].map((column) => `${row}${column}`));

// Each starting plan's maker, by name, in the order of tutorial-plans.md, section 3.
const MAKERS = {
  empty: makeEmpty,
  firstRunDone: makeFirstRunDone,
  conditionStocks: makeConditionStocks,
  tableStocks: makeTableStocks,
  conditionMedia: makeConditionMedia,
};

// The starting plans' names, in the order of tutorial-plans.md, section 3.
export const STARTING_PLAN_NAMES = Object.freeze(Object.keys(MAKERS));

// The starting plan called `name`, made fresh each call, e.g. startingPlan("firstRunDone").
// Throws 'There's no starting plan named "x".' for any other name.
export function startingPlan(name) {
  if (typeof name !== "string" || !Object.hasOwn(MAKERS, name)) {
    throw new Error(`There's no starting plan named "${String(name)}".`);
  }
  return MAKERS[name]();
}

// The starting plan called `name` as a plan file's text, saved by `savedBy` (the page's own, so it
// says the same build), e.g. startingPlanText("empty", "transfer designer tutorial v0.2.0").
export function startingPlanText(name, savedBy) {
  return planToText(startingPlan(name), savedBy);
}

// --- The plans ---

// Tutorial 1's: the empty plan as it is.
function makeEmpty() {
  return emptyPlan().plan;
}

// Tutorial 2's: what tutorial 1 ends with. Base media then Cells into the 12 culture wells, each
// stage on tips of its own.
function makeFirstRunDone() {
  let plan = setExperimentName(emptyPlan().plan, "Practice1");
  plan = setLabel(plan, "Plate1", "Culture plate");
  plan = withComponents(plan, [
    { name: "Base media", constituents: [] },
    { name: "Cells", constituents: [] },
  ]);
  plan = addToWells(plan, [res1("1")], "Base media", 6000);
  plan = addToWells(plan, [res1("2")], "Cells", 3000);
  const mediaStage = stageOrder(plan)[0];
  plan = renameStage(plan, mediaStage, "Base media");
  plan = addTransfers(plan, cultureTransfers(res1("1"), 100, mediaStage));
  const added = addStageWithNewTips(plan, null);
  plan = renameStage(added.plan, added.id, "Cells");
  return addTransfers(plan, cultureTransfers(res1("2"), 50, added.id));
}

// Tutorial 3's: four stocks in Res1, nothing else.
function makeConditionStocks() {
  let plan = setExperimentName(emptyPlan().plan, "Practice3");
  plan = withComponents(plan, [
    { name: "Base media", constituents: [] },
    { name: "Glucose", constituents: [gramsPerLiter("Glucose", 50)] },
    { name: "Yeast extract", constituents: [gramsPerLiter("Yeast extract", 50)] },
    { name: "Cells", constituents: [{ name: "Cells", amount: 1e6, unit: CELL_DENSITY_UNIT }] },
  ]);
  return fillTroughs(plan, [
    ["Base media", 6000],
    ["Glucose", 3000],
    ["Yeast extract", 3000],
    ["Cells", 3000],
  ]);
}

// Tutorial 4's: three stocks in Res1, nothing else.
function makeTableStocks() {
  let plan = setExperimentName(emptyPlan().plan, "Practice4");
  plan = withComponents(plan, [
    { name: "Base media", constituents: [] },
    { name: "Glucose", constituents: [gramsPerLiter("Glucose", 50)] },
    { name: "Yeast extract", constituents: [gramsPerLiter("Yeast extract", 50)] },
  ]);
  return fillTroughs(plan, [
    ["Base media", 6000],
    ["Glucose", 3000],
    ["Yeast extract", 3000],
  ]);
}

// Tutorial 5's: four condition media in Deep1 A1 to A4, named, and PBS in Res1 1.
function makeConditionMedia() {
  let plan = setExperimentName(emptyPlan().plan, "Practice5");
  plan = setLabel(plan, "Deep1", "Conditions");
  const media = [
    ["Control media", "A1", "Control"],
    ["Glucose media", "A2", "With glucose"],
    ["Yeast media", "A3", "With yeast"],
    ["Both media", "A4", "Both"],
  ];
  plan = withComponents(plan, [
    ...media.map(([name]) => ({ name, constituents: [] })),
    { name: "PBS", constituents: [] },
  ]);
  for (const [name, well, label] of media) {
    const end = { labware: "Deep1", well };
    plan = setWellLabel(addToWells(plan, [end], name, 1500), end, label);
  }
  return addToWells(plan, [res1("1")], "PBS", 4000);
}

// --- Helpers ---

// The plan with `components` added in order, each { name, constituents }, taking colors from
// COMPONENT_COLORS in order: the first component the first color, and so on.
function withComponents(plan, components) {
  return components.reduce((planSoFar, { name, constituents }, index) => {
    const added = addComponent(planSoFar, name, COMPONENT_COLORS[index]);
    return constituents.length === 0 ? added : setConstituents(added, name, constituents);
  }, plan);
}

// The plan with Res1's troughs 1, 2, 3 … starting with `fills`' volumes, each [component, µL], in
// order.
function fillTroughs(plan, fills) {
  return fills.reduce(
    (planSoFar, [name, volume], index) => addToWells(planSoFar, [res1(String(index + 1))], name, volume),
    plan,
  );
}

// A trough of Res1, e.g. res1("2") → { labware: "Res1", well: "2" }.
function res1(well) {
  return { labware: "Res1", well };
}

// A constituent in g/L, e.g. gramsPerLiter("Glucose", 50).
function gramsPerLiter(name, amount) {
  return { name, amount, unit: "g/L" };
}

// One transfer of `volume` µL from `source` into each of the culture wells on Plate1, in stage
// `stage`, in the order of CULTURE_WELLS.
function cultureTransfers(source, volume, stage) {
  return CULTURE_WELLS.map((well) => ({
    type: "transfer",
    source,
    destination: { labware: "Plate1", well },
    volume,
    stage,
  }));
}
