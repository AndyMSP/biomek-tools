// tip-groups.js — works out a plan's tip groups (docs/glossary.md, "Tip group"): the stages that
// run on the same tips, from one tip change to the next, and which probes get tips for each group,
// by looking ahead (ADR 0007, "Tip changes").
//
// It's shared because the transfer designer (to show tip groups on the page) and the file writer
// (to write a tip-change row before each group) need exactly the same answer; one function means
// they can't disagree. It reads a plan's stageOrder, tipChanges and stageList and changes nothing.
// It doesn't check the plan: plans are made only through the transfer designer's checks.
// Specification: tip-groups.md.

// The key of the tip change before the first stage. Stage IDs are numbers written as text, so no
// stage is ever called "start".
export const START = "start";

// The tip groups (docs/glossary.md, "Tip group"), in stage order, each with the tip change that
// starts it, e.g. [{ key: "start", tipType: "BC230", stages: ["1", "2"], probes: [1, 2, 3, 4] }, …].
// `probes` are the probes that get tips: every probe any of the group's stages uses, smallest first.
// Builds a new list each time, so changing it doesn't change the next one.
export function tipGroups(plan) {
  const groups = [];
  plan.stageOrder.forEach((id, place) => {
    // The first stage always starts the START group; any later stage with a tip change starts one.
    if (place === 0 || Object.hasOwn(plan.tipChanges, id)) {
      const key = place === 0 ? START : id;
      groups.push({ key, tipType: plan.tipChanges[key].tipType, stages: [] });
    }
    groups.at(-1).stages.push(id);
  });
  return groups.map((group) => ({ ...group, probes: probesUsedBy(plan, group.stages) }));
}

// Every probe that any of `stages` (stage IDs) uses, each once, smallest first,
// e.g. stages using [1] and [3, 5] → [1, 3, 5].
function probesUsedBy(plan, stages) {
  const probes = new Set(stages.flatMap((id) => plan.stageList.get(id).settings.probes));
  // sort() on its own compares as text; this compares numbers.
  return [...probes].sort((a, b) => a - b);
}
