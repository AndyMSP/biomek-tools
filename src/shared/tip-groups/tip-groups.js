// tip-groups.js — works out a plan's tip groups (docs/glossary.md, "Tip group"): the stages that
// run on the same tips, from one tip change to the next, with that tip change's tip type and probes
// (ADR 0007, "Tip changes").
//
// It's shared because the transfer designer (to show tip groups on the page) and the file writer
// (to write a tip-change row before each group) need exactly the same answer; one function means
// they can't disagree. It reads a plan's stageOrder and tipChanges and changes nothing. It doesn't
// check the plan: plans are made only through the transfer designer's checks.
// Specification: tip-groups.md.

// The key of the tip change before the first stage. Stage IDs are numbers written as text, so no
// stage is ever called "start".
export const START = "start";

// The tip groups (docs/glossary.md, "Tip group"), in stage order, each with the tip change that
// starts it, e.g. [{ key: "start", tipType: "BC230", stages: ["1", "2"], probes: [1, 2, 3, 4] }, …].
// `probes` are that tip change's probes, smallest first: the probes that get tips, and that every
// stage in the group uses. Builds a new list each time, with copies of the probes, so changing it
// doesn't change the plan or the next result.
export function tipGroups(plan) {
  const groups = [];
  plan.stageOrder.forEach((id, place) => {
    // The first stage always starts the START group; any later stage with a tip change starts one.
    if (place === 0 || Object.hasOwn(plan.tipChanges, id)) {
      const key = place === 0 ? START : id;
      const tipChange = plan.tipChanges[key];
      groups.push({ key, tipType: tipChange.tipType, stages: [], probes: [...tipChange.probes] });
    }
    groups.at(-1).stages.push(id);
  });
  return groups;
}
