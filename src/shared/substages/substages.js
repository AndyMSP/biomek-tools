// substages.js — splits one stage's transfers into its substages (docs/glossary.md, "Substage"):
// the parts one Transfer From File file can hold, because Transfer From File requires one labware
// type at the sources and one at the destinations (B56358AF, 22-13). Each substage becomes one row
// of the stage worklist (ADR 0007).
//
// It's shared because the file writer (a row and a file for each substage) and the mix-volumes
// module (one mix volume per row) need exactly the same split; one function means they can't
// disagree. It was moved out of file-writer.js unchanged; naming each substage's file stays in the
// file writer. It checks nothing and changes nothing it's given.
// Specification: substages.md.

import { labwareTypeOf } from "../deck/deck.js";

// A stage's substages: its transfers (in operation-list order) grouped by source and destination
// labware type, listed in the order their first transfers come, each as
// { sourceLabwareType, destinationLabwareType, transfers }, with the transfers in order. A new list
// each time, holding the very transfer objects given. No transfers give [].
// e.g. substagesOf([reservoirToPlate, plateToDeep, reservoirToPlate2]) →
//   [{ sourceLabwareType: "DeepReservoir12", destinationLabwareType: "BCFlat96",
//      transfers: [reservoirToPlate, reservoirToPlate2] },
//    { sourceLabwareType: "BCFlat96", destinationLabwareType: "BCDeep96Square",
//      transfers: [plateToDeep] }]
export function substagesOf(transfers) {
  const substages = [];
  for (const transfer of transfers) {
    const sourceLabwareType = labwareTypeOf(transfer.source.labware);
    const destinationLabwareType = labwareTypeOf(transfer.destination.labware);
    let substage = substages.find(
      (candidate) =>
        candidate.sourceLabwareType === sourceLabwareType &&
        candidate.destinationLabwareType === destinationLabwareType,
    );
    if (substage === undefined) {
      substage = { sourceLabwareType, destinationLabwareType, transfers: [] };
      substages.push(substage);
    }
    substage.transfers.push(transfer);
  }
  return substages;
}
