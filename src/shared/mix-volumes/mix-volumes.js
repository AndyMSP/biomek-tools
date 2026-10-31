// mix-volumes.js — works out how many µL each stage-worklist row mixes, at each end that mixes, and
// finds the mixes that work out to nothing (mix problems; docs/glossary.md, "Mix problem").
//
// A stage stores each mix as a share of the well (stage-list.md), but each row of the stage worklist
// takes one mix volume in µL for each end, and Biomek can't work out a volume per well itself
// (docs/domain/biomek.md, "Mixing"). So the tool works it out from what the wells hold (ADR 0007,
// "Mixing"): the share of what the row's emptiest well holds when it's mixed, rounded down to
// 0.1 µL, and no more than the tip type's limit.
//
// For each well a row mixes, it also gives what share of that well the row's volume is, and whether
// that's short (under SHORT_MIX_SHARE in config/mixing.js): every well in a row mixes the same
// volume, so a fuller well mixes less of itself. A short mix is a warning a tool shows, not a problem.
//
// It's shared because the file writer (the mix columns, and refusing a plan with a mix problem) and
// the transfer designer (reporting mix problems as soon as they appear) need the same answer. It
// reads a plan and changes nothing. It doesn't check the plan: plans are made only through the
// transfer designer's checks.
// Specification: mix-volumes.md.

import { MIX_VOLUME_LIMITS } from "../../../config/tip-types.js";
import { SHORT_MIX_SHARE } from "../../../config/mixing.js";
import { replay } from "../contents-tracking/contents-tracking.js";
import { tipGroups } from "../tip-groups/tip-groups.js";
import { substagesOf } from "../substages/substages.js";

// The two ends of a transfer, in the order problems are listed: source before destination.
const ENDS = ["source", "destination"];

// Volumes are compared and reported to 3 decimal places (ADR 0007): whole numbers of thousandths.
const THOUSANDTHS = 1000;

// A mix volume is rounded down to a whole number of tenths of a µL: 100 thousandths make a tenth.
const THOUSANDTHS_PER_TENTH = 100;

// Each row's mix volume at each end, and the mix problems, as { stages, problems }, new each time.
// `stages` lists each stage with transfers, in stage order, as { stage, rows }: `rows` are its
// substages in order, each with sourceMixVolume and destinationMixVolume added (µL, or null for an
// end that doesn't mix), and mixedWells: each well the row mixes, sources first, as { end, labware,
// well, held, share, short } (mixedWell). `problems` lists each row and end whose mix works out to 0, in stage order,
// then row order, source before destination, as { stage, end, labware, well, held }.
// e.g. a stage mixing its destinations at 90% on BC230 tips, whose emptiest destination holds
// 20 µL once dispensed into → mixVolumes(plan).stages[0].rows[0].destinationMixVolume is 18.
export function mixVolumes(plan) {
  const tipTypeOfStage = tipTypesByStage(plan);
  const stages = [];
  const problems = [];
  for (const { stage, transfers, firstIndex } of stagesWithTransfers(plan)) {
    const { settings } = plan.stageList.get(stage);
    const limit = MIX_VOLUME_LIMITS[tipTypeOfStage.get(stage)];
    // What the wells held before the stage, worked out only for a stage that mixes, since a replay
    // of the plan up to the stage is the slow part and a stage that doesn't mix never needs it.
    const mixes = settings.sourceMix !== null || settings.destinationMix !== null;
    const before = mixes ? replay(plan.startingContents, plan.operationList, firstIndex) : null;
    // What each well has gained or lost from this stage's earlier rows, keyed by wellKey.
    const changesFromEarlierRows = new Map();
    // What the well at `end` ({ labware, well }) holds as the current row starts: what it held
    // before the stage, plus what the stage's earlier rows put in or took out.
    const heldBeforeRow = (end) =>
      before.totalVolumeOf(end.labware, end.well) +
      (changesFromEarlierRows.get(wellKey(end)) ?? 0);

    const rows = substagesOf(transfers).map((substage) => {
      const row = { ...substage, mixedWells: [] };
      for (const end of ENDS) {
        const mix = settings[`${end}Mix`];
        row[`${end}MixVolume`] = null;
        if (mix !== null) {
          const wells = heldWhenMixed(substage.transfers, end, heldBeforeRow);
          const emptiest = emptiestOf(wells);
          const volume = mixVolume(mix.share, emptiest.held, limit);
          row[`${end}MixVolume`] = volume;
          row.mixedWells.push(...wells.map((entry) => mixedWell(end, entry, volume)));
          if (volume === 0) {
            problems.push({
              stage,
              end,
              labware: emptiest.labware,
              well: emptiest.well,
              held: roundToThousandths(emptiest.held),
            });
          }
        }
      }
      recordRowChanges(changesFromEarlierRows, substage.transfers);
      return row;
    });
    stages.push({ stage, rows });
  }
  return { stages, problems };
}

// --- Helpers used only inside this module ---

// The stages with transfers, in stage order, each as { stage, transfers, firstIndex }: its ID, its
// transfers in operation-list order, and the position of its first transfer in the operation list
// (so replaying that many operations gives what the wells held before the stage). The operation
// list's blocks follow the stage order (ADR 0011), so its groups come in stage order already.
function stagesWithTransfers(plan) {
  let firstIndex = 0;
  return plan.operationList.groupByStage().map((group) => {
    const entry = { stage: group.stage, transfers: group.operations, firstIndex };
    firstIndex += group.operations.length;
    return entry;
  });
}

// Each stage's tip type, from its tip group (tip-groups.md), as a Map, e.g. "3" → "BC1070".
function tipTypesByStage(plan) {
  const tipTypes = new Map();
  for (const group of tipGroups(plan)) {
    for (const stage of group.stages) {
      tipTypes.set(stage, group.tipType);
    }
  }
  return tipTypes;
}

// Each well at `end` ("source" or "destination") of a row's `transfers`, once, in transfer order,
// with what it holds when it's mixed, as { labware, well, held }. `heldBeforeRow` gives what a well
// holds as the row starts. What a well holds when mixed (mix-volumes.md, section 3): before the row,
// less everything the row draws from it, plus its smallest draw (a source) or smallest dispense (a
// destination); never below 0.
// e.g. a row drawing 100 and 50 µL from Res1 1, which held 1000 µL → [{ labware: "Res1",
// well: "1", held: 900 }].
function heldWhenMixed(transfers, end, heldBeforeRow) {
  const drawn = totalsBy(transfers, "source");
  const smallest = smallestBy(transfers, end);
  const wells = new Map();
  for (const transfer of transfers) {
    const key = wellKey(transfer[end]);
    if (!wells.has(key)) {
      const held = Math.max(
        0,
        heldBeforeRow(transfer[end]) - (drawn.get(key) ?? 0) + smallest.get(key),
      );
      wells.set(key, { labware: transfer[end].labware, well: transfer[end].well, held });
    }
  }
  return [...wells.values()];
}

// The well in `wells` (from heldWhenMixed) that holds the least when it's mixed; with a tie, the
// first, which is the first in transfer order.
function emptiestOf(wells) {
  // Strictly less, so the first of several wells holding equally little is kept.
  return wells.reduce((emptiest, entry) => (entry.held < emptiest.held ? entry : emptiest));
}

// One entry of a row's mixedWells: the well `entry` ({ labware, well, held }) at `end`, mixed with
// the row's `volume`, as { end, labware, well, held, share, short }. `held` is rounded to 3 decimal
// places, and the share is worked out from it, so a well holding 0.1 + 0.2 µL counts as 0.3.
// e.g. mixedWell("destination", { labware: "Plate1", well: "A2", held: 150 }, 18) →
// { end: "destination", labware: "Plate1", well: "A2", held: 150, share: 12, short: true }.
function mixedWell(end, entry, volume) {
  const held = roundToThousandths(entry.held);
  // A well holding nothing mixes none of itself: 0, rather than dividing by 0.
  const share = held === 0 ? 0 : (volume / held) * 100;
  return { end, labware: entry.labware, well: entry.well, held, share, short: share < SHORT_MIX_SHARE };
}

// The total volume of `transfers` at each well of `end`, keyed by wellKey, e.g. what the row draws
// from each source.
function totalsBy(transfers, end) {
  const totals = new Map();
  for (const transfer of transfers) {
    const key = wellKey(transfer[end]);
    totals.set(key, (totals.get(key) ?? 0) + transfer.volume);
  }
  return totals;
}

// The smallest volume of `transfers` at each well of `end`, keyed by wellKey: a source's smallest
// draw, or a destination's smallest dispense.
function smallestBy(transfers, end) {
  const smallest = new Map();
  for (const transfer of transfers) {
    const key = wellKey(transfer[end]);
    smallest.set(key, Math.min(smallest.get(key) ?? Infinity, transfer.volume));
  }
  return smallest;
}

// Adds what a row's `transfers` move to `changes` (keyed by wellKey), so later rows of the stage
// start from what the wells hold after it: each source loses its draws, each destination gains.
function recordRowChanges(changes, transfers) {
  for (const transfer of transfers) {
    const sourceKey = wellKey(transfer.source);
    const destinationKey = wellKey(transfer.destination);
    changes.set(sourceKey, (changes.get(sourceKey) ?? 0) - transfer.volume);
    changes.set(destinationKey, (changes.get(destinationKey) ?? 0) + transfer.volume);
  }
}

// A row's mix volume: `share` percent of `held` µL, rounded to the nearest thousandth of a µL, then
// down to a whole number of tenths so no well mixes more than it holds, and no more than `limit`,
// e.g. mixVolume(75, 120, 200) → 90 (not 89.9, which rounding down without the first step would
// give); mixVolume(90, 99.99, 200) → 89.9; mixVolume(90, 0.05, 200) → 0.
function mixVolume(share, held, limit) {
  const thousandths = Math.round((share / 100) * held * THOUSANDTHS);
  const tenths = Math.floor(thousandths / THOUSANDTHS_PER_TENTH);
  return Math.min(tenths / 10, limit);
}

// `volume` rounded to 3 decimal places, e.g. 0.30000000000000004 → 0.3.
function roundToThousandths(volume) {
  return Math.round(volume * THOUSANDTHS) / THOUSANDTHS;
}

// One text key for a well, for looking it up in a Map, e.g. { labware: "Res1", well: "1" } →
// '["Res1","1"]'. A JSON list keeps the two names apart, as in contents-tracking.
function wellKey(end) {
  return JSON.stringify([end.labware, end.well]);
}
