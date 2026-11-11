// trash.js — the transfer designer's trash (docs/glossary.md, "Trash"; ADR 0024): it keeps what's
// deleted from a plan, one entry per thing deleted, so each can be pasted again later, in this plan
// or another. It makes the entries, pastes one at a place the caller gives (taking it out), empties
// the trash, undoes and redoes its changes, and turns a trash into text and back.
//
// It builds on the transfer designer rather than repeating it: the items deleted are checked and
// taken as deleteItems takes them, each is kept as copied items (copyOf), and pasting one is
// pasteItems, so every rule and check of pasting applies. The trash never works out where anything
// was: the caller gives the place (Andy, 2026-11-11). A trash is never changed after it's made;
// every function returns a new one. No page code here (CLAUDE.md, "Separate logic from the UI").
// Specification: trash.md.

import { TRASH_LIMIT } from "../../../config/trash.js";
import { describeValue } from "../../shared/error-messages/error-messages.js";
import { checkNameRule } from "../../shared/file-writer/file-writer.js";
import {
  deleteItems,
  copyOf,
  pasteItems,
  renameRandomization,
  randomizationAt,
  transferTableAt,
  mixingBoxAt,
  tipGroups,
  transfersIn,
} from "./transfer-designer.js";

export { TRASH_LIMIT };

// The format name and version a trash's text says it is (section 3, "Keeping the trash as text").
export const TRASH_FORMAT = "biomek-tools trash";
export const TRASH_VERSION = 1;

// The properties of a trash's text, and of an entry, exactly.
const TEXT_PROPERTIES = ["format", "version", "entries", "nextEntryId", "nextDeletion"];
const ENTRY_PROPERTIES = ["id", "deletion", "kind", "name", "stageCount", "transferCount", "deletedAt", "copied"];

// The kinds of thing an entry holds, and those that have a name (the others' name is null).
const ENTRY_KINDS = ["stage", "tipGroup", "randomization", "transferTable", "mixingBox"];
const NAMED_KINDS = ["stage", "randomization"];

// The words checkNameRule needs; only whether it throws matters here, never its message.
const NAME_RULE_WORDS = Object.freeze({ subject: "A randomization's name", example: "HySoy_dose", blank: "" });

// --- Making and changing a trash ---

// A trash with no entries: { entries: [], nextEntryId: 1, nextDeletion: 1 }.
export function emptyTrash() {
  return { entries: [], nextEntryId: 1, nextDeletion: 1 };
}

// Returns { trash, change }: `trash` with one entry for each of `items` deleted from `plan` (the
// plan before the delete), all of one delete, newest first, and the change that made it,
// { added, removed } (section 3, "Adding"). Throws deleteItems' messages for `items`, then if
// `deletedAt` isn't text Date reads as a date,
// e.g. addDeleted(emptyTrash(), plan, [{ kind: "stage", id: "4" }], "2026-11-11T05:28:41.000Z").
export function addDeleted(trash, plan, items, deletedAt) {
  const { deleted } = deleteItems(plan, items);
  checkDeletedAt(deletedAt);
  const deletion = trash.nextDeletion;
  const made = deleted.map((item, index) =>
    entryFor(plan, item, trash.nextEntryId + index, deletion, deletedAt),
  );
  const { entries, dropped } = limited(sortedEntries([...made, ...trash.entries]));
  const droppedIds = new Set(dropped.map((entry) => entry.id));
  const change = {
    added: made.filter((entry) => !droppedIds.has(entry.id)),
    removed: trash.entries.filter((entry) => droppedIds.has(entry.id)),
  };
  const added = { entries, nextEntryId: trash.nextEntryId + made.length, nextDeletion: deletion + 1 };
  return { trash: added, change };
}

// Returns { plan, placed, trash, change }: entry `id` pasted into `plan` at `place` (a place of
// transfer-designer.md, "Moving and copying"), as one edit, a randomization given its name back
// when it can have it, and the trash without the entry, with the change { added: [], removed:
// [entry] }. Throws if there's no such entry, then pasteItems' messages, unchanged.
export function pasteEntry(plan, trash, id, place) {
  const entry = trash.entries.find((candidate) => candidate.id === id);
  if (entry === undefined) {
    throw new Error(`There's no entry ${describeValue(id)} in the trash.`);
  }
  const pasted = pasteItems(plan, entry.copied, place);
  const named = entry.kind === "randomization" ? withNameBack(pasted.plan, pasted.placed[0].id, entry.name) : pasted.plan;
  return {
    plan: named,
    placed: pasted.placed,
    trash: { ...trash, entries: trash.entries.filter((candidate) => candidate.id !== id) },
    change: { added: [], removed: [entry] },
  };
}

// Returns { trash, change }: the trash with no entries, keeping its counters so no ID is given
// twice, and the change { added: [], removed: [every entry] }.
export function clearTrash(trash) {
  return { trash: { ...trash, entries: [] }, change: { added: [], removed: trash.entries } };
}

// The trash with `change` undone: without the entries it added (by ID; any no longer there are
// skipped) and with those it removed that aren't in it, in order, the oldest beyond TRASH_LIMIT
// dropped (section 3, "Undo and redo").
export function undoTrashChange(trash, change) {
  return withChangeApplied(trash, change.added, change.removed);
}

// The trash with `change` made again: without the entries it removed, with those it added.
export function redoTrashChange(trash, change) {
  return withChangeApplied(trash, change.removed, change.added);
}

// --- Keeping a trash as text ---

// The trash as JSON text: { "format": "biomek-tools trash", "version": 1, "entries": […],
// "nextEntryId": …, "nextDeletion": … }.
export function trashToText(trash) {
  return JSON.stringify({
    format: TRASH_FORMAT,
    version: TRASH_VERSION,
    entries: trash.entries,
    nextEntryId: trash.nextEntryId,
    nextDeletion: trash.nextDeletion,
  });
}

// The trash `text` holds, as much of it as can be read (section 3, "Keeping the trash as text"):
// emptyTrash() if its frame can't be read; otherwise its readable entries, in order, at most
// TRASH_LIMIT of the newest. Never throws: a damaged trash shouldn't stop a tool opening.
export function trashFromText(text) {
  const read = readTrashText(text);
  if (read.frame === null) {
    return emptyTrash();
  }
  const { nextEntryId, nextDeletion } = read.frame;
  return { entries: limited(sortedEntries(read.entries)).entries, nextEntryId, nextDeletion };
}

// Whether trashFromText reads `text` in full: null if it does (entries out of order, or more than
// TRASH_LIMIT, are no problem); "newer" for a trash of a later version than TRASH_VERSION; or
// "damaged" for anything else, a frame it can't read or an entry it drops. Never throws.
export function trashTextProblem(text) {
  const read = readTrashText(text);
  if (read.newer) {
    return "newer";
  }
  if (read.frame === null || read.dropped > 0) {
    return "damaged";
  }
  return null;
}

// --- Helpers ---

// Throws unless `deletedAt` is text that Date reads as a date, e.g. "2026-11-11T05:28:41.000Z".
function checkDeletedAt(deletedAt) {
  if (!isDateText(deletedAt)) {
    throw new Error(
      `When it was deleted must be a date as text, like "2026-11-11T05:28:41.000Z", but got ${describeValue(deletedAt)}.`,
    );
  }
}

// True if `value` is text that Date reads as a date; "yesterday" and "2026-13-45" aren't.
function isDateText(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

// The entry for `item` (a deleted item of `plan`, the plan before the delete), with ID `id`, from
// delete number `deletion`, deleted at `deletedAt`.
function entryFor(plan, item, id, deletion, deletedAt) {
  const stages = stagesOfItem(plan, item);
  return {
    id,
    deletion,
    kind: item.kind,
    name: nameOfItem(plan, item),
    stageCount: stages.length,
    transferCount: stages.reduce((count, stage) => count + transfersIn(plan, stage).length, 0),
    deletedAt,
    copied: copyOf(plan, [item]),
  };
}

// The IDs of the stages an item of `plan` holds, in stage order: a stage's own, a tip group's, a
// randomization's (none before it has run) or a transfer table's.
function stagesOfItem(plan, item) {
  switch (item.kind) {
    case "stage":
      return [item.id];
    case "tipGroup":
      return tipGroups(plan).find((group) => group.stages[0] === item.id).stages;
    case "randomization":
      return randomizationAt(plan, item.id).stages.map((owned) => owned.stage);
    case "mixingBox":
      return [...mixingBoxAt(plan, item.id).stages];
    default:
      return transferTableAt(plan, item.id).stages.map((owned) => owned.stage);
  }
}

// An item's name for its entry: a stage's or randomization's name; null for the others.
function nameOfItem(plan, item) {
  if (item.kind === "stage") {
    return plan.stageList.get(item.id).name;
  }
  return item.kind === "randomization" ? randomizationAt(plan, item.id).name : null;
}

// `plan` with randomization `id` renamed to `name` when that passes a randomization name's rule and
// no other randomization has it, capitals aside; otherwise `plan` as it is, so nothing is refused
// (section 3, "Pasting an entry").
function withNameBack(plan, id, name) {
  try {
    checkNameRule(name, NAME_RULE_WORDS);
  } catch {
    return plan;
  }
  const taken = plan.randomizations.some(
    (randomization) => randomization.id !== id && randomization.name.toLowerCase() === name.toLowerCase(),
  );
  return taken ? plan : renameRandomization(plan, id, name);
}

// `trash` without the entries of `taking` (by ID) and with those of `putting` that aren't in it, in
// order, at most TRASH_LIMIT.
function withChangeApplied(trash, taking, putting) {
  const takingIds = new Set(taking.map((entry) => entry.id));
  const kept = trash.entries.filter((entry) => !takingIds.has(entry.id));
  const keptIds = new Set(kept.map((entry) => entry.id));
  const put = putting.filter((entry) => !keptIds.has(entry.id));
  return { ...trash, entries: limited(sortedEntries([...kept, ...put])).entries };
}

// A new list of `entries` in the trash's order: newest delete first, then by ID, smallest first.
function sortedEntries(entries) {
  return [...entries].sort((first, second) => second.deletion - first.deletion || first.id - second.id);
}

// { entries, dropped }: the first TRASH_LIMIT of `entries` (in order), and the rest.
function limited(entries) {
  return { entries: entries.slice(0, TRASH_LIMIT), dropped: entries.slice(TRASH_LIMIT) };
}

// What `text` holds as a trash, without throwing: { frame, entries, dropped, newer }. `frame` is
// { nextEntryId, nextDeletion }, or null if the frame can't be read; `entries`, the readable
// entries, in the text's order; `dropped`, how many entries weren't read; `newer`, whether it's a
// trash of a later version than TRASH_VERSION.
function readTrashText(text) {
  const unread = { frame: null, entries: [], dropped: 0, newer: false };
  const parsed = parsedJson(text);
  if (!isPlainObject(parsed)) {
    return unread;
  }
  if (parsed.format === TRASH_FORMAT && Number.isInteger(parsed.version) && parsed.version > TRASH_VERSION) {
    return { ...unread, newer: true };
  }
  if (!isReadableFrame(parsed)) {
    return unread;
  }
  const frame = { nextEntryId: parsed.nextEntryId, nextDeletion: parsed.nextDeletion };
  const seenIds = new Set();
  const entries = parsed.entries.filter((entry) => {
    if (!isReadableEntry(entry, frame) || seenIds.has(entry.id)) {
      return false;
    }
    seenIds.add(entry.id);
    return true;
  });
  return { frame, entries, dropped: parsed.entries.length - entries.length, newer: false };
}

// `text` read as JSON, or undefined if it isn't text or isn't JSON.
function parsedJson(text) {
  if (typeof text !== "string") {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// True if `value` is a trash's frame, version 1: exactly its five properties, the format and
// version, both counters whole numbers of at least 1, and its entries a list.
function isReadableFrame(value) {
  return (
    hasExactly(value, TEXT_PROPERTIES) &&
    value.format === TRASH_FORMAT &&
    value.version === TRASH_VERSION &&
    isWholeAtLeast(value.nextEntryId, 1) &&
    isWholeAtLeast(value.nextDeletion, 1) &&
    Array.isArray(value.entries)
  );
}

// True if `entry` can be read as an entry of a trash with `frame`'s counters (section 3): exactly
// its properties, each of its kind, its name as its kind has it, and `copied` a plain object (what's
// in it is checked by pasteItems when it's pasted).
function isReadableEntry(entry, frame) {
  return (
    isPlainObject(entry) &&
    hasExactly(entry, ENTRY_PROPERTIES) &&
    isWholeAtLeast(entry.id, 1) &&
    entry.id < frame.nextEntryId &&
    isWholeAtLeast(entry.deletion, 1) &&
    entry.deletion < frame.nextDeletion &&
    ENTRY_KINDS.includes(entry.kind) &&
    (NAMED_KINDS.includes(entry.kind) ? typeof entry.name === "string" : entry.name === null) &&
    isWholeAtLeast(entry.stageCount, 0) &&
    isWholeAtLeast(entry.transferCount, 0) &&
    isDateText(entry.deletedAt) &&
    isPlainObject(entry.copied)
  );
}

// True if `value` is a whole number of at least `least`, e.g. (3, 1) → true; (0, 1), (1.5, 1) → false.
function isWholeAtLeast(value, least) {
  return Number.isInteger(value) && value >= least;
}

// True if `value` is an object, not a list and not null.
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// True if `value` has exactly the properties `names`, no more and no fewer.
function hasExactly(value, names) {
  const keys = Object.keys(value);
  return keys.length === names.length && names.every((name) => Object.hasOwn(value, name));
}
