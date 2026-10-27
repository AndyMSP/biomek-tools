// component-colors.js — the colors a component can be drawn in, on the transfer designer page.
//
// COMPONENT_COLORS lists the 30 colors as "#RRGGBB" text, ordered so the most distinct come first:
// a new component takes the first color no component has yet, so similar colors only appear once a
// plan has many components. Chosen by Andy, 2026-10-25, while shaping the transfer designer preview
// (transfer-designer-page.md, section 14). No two components may share a color (transfer-designer.md),
// so no color is listed twice. The page's tests check this file (ADR 0009). Data only (ADR 0009).

export const COMPONENT_COLORS = [
  "#4e79a7",
  "#f28e2b",
  "#59a14f",
  "#e15759",
  "#b07aa1",
  "#edc948",
  "#76b7b2",
  "#ff9da7",
  "#9c755f",
  "#17becf",
  "#1f3d7a",
  "#bcbd22",
  "#7b2d8e",
  "#a0cbe8",
  "#ffbe7d",
  "#8cd17d",
  "#8b0000",
  "#b6992d",
  "#499894",
  "#d4a6c8",
  "#c85200",
  "#006d2c",
  "#ff6f91",
  "#6b6ecf",
  "#637939",
  "#fabfd2",
  "#5c3c1b",
  "#9edae5",
  "#ce6dbd",
  "#2b2b2b",
];
