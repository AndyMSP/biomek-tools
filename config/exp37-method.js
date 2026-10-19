// exp37-method.js — the Biomek method values for Exp37 (method Exp37_V0), used to make its
// Transfer From File and Worklist files. Values come from the Exp37 deck layout workbook and the
// guide "Biomek Randomized Plate Transfer Files" (Andrew Stone, 2026-10-13/14), whose files ran on
// the instrument. Change them here, not in the code, when the method changes.

export const EXP37_METHOD = {
  // Where the run folder must sit on the Biomek PC; {id} is replaced by the experiment ID.
  // The worklist holds full paths, so the folder must be unzipped exactly here.
  biomekFolder: "C:\\Users\\Beckman Coulter\\Desktop\\{id}",

  // The two culture plates, each given the same randomized layout. Cells for each plate come from
  // two wells, alternating by condition (a, c, e … the first well; b, d, f … the second).
  plates: [
    { labware: "MsNAC", cellWells: ["F1", "F2"], cellsStep: "10", mixStep: "11" },
    { labware: "SF9", cellWells: ["H1", "H2"], cellsStep: "12", mixStep: "13" },
  ],
  cellSourceLabware: "Deep",
  cellVolume: 50,
  mixVolume: 100,

  // Step 8: each condition's media, from its own deep well, in the order the conditions are listed.
  mediaStep: "8",
  conditionSourceLabware: "Deep",
  conditionSourceWells: ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12"],
  mediaVolume: 100,

  // Step 9: every well holding PBS, from reservoir wells 5, 6 and 7, 32 transfers from each.
  pbs: { name: "PBS", step: "9", labware: "Res", wells: ["5", "6", "7"], transfersPerWell: 32, volume: 200 },

  // Step 10: the Worklist that loops through each cell file and its mix file.
  worklistStep: "10",
};
