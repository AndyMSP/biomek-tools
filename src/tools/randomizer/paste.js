// paste.js — turns text copied from Excel into condition rows { name, replicates }.
// It doesn't check the rows: assign.js does, so pasted and typed mistakes get the same messages.
// Specification: paste.md.

// Condition rows from pasted text, one per line that isn't blank, e.g.
// "Condition 1\t4\r\nCondition 2\t4\r\n" → [{ name: "Condition 1", replicates: 4 }, …].
export function parseConditionRows(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [name = "", replicates = ""] = line.split("\t");
      return { name, replicates: replicatesFromText(replicates) };
    });
}

// Replicates typed or pasted as text: digits only become a number, anything else stays text so it
// can be reported, e.g. "4" → 4, " 12 " → 12, "four" → "four", "1.5" → "1.5".
export function replicatesFromText(text) {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}
