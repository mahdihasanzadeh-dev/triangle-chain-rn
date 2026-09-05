// Shared visual language, ported from the web prototype's dark wood + brass
// palette. Kept as plain hex strings so both the RN StyleSheet layer and the
// Three.js material layer can use the exact same values.

export const COLORS = {
  bg0: "#100b07",
  bg1: "#17110b",
  bg2: "#2c2013",
  panel: "rgba(255,255,255,0.05)",
  panelBorder: "rgba(233,201,138,0.18)",
  gold: "#e9c98a",
  goldDim: "#b8a688",
  text: "#f1e7d6",
  textDim: "#8a7a63",
  wood: "#241a12",
  brass: "#c9a35c",
  dimPeg: "#362c1e",
  danger: "#e05a5a",
};

export const PALETTE = [
  { name: "Green", color: "#3ecf8e", dim: "#1f6b48" },
  { name: "Amber", color: "#fb923c", dim: "#8a4d17" },
  { name: "Azure", color: "#4ea1f7", dim: "#1f4c80" },
];

export const SIZE_OPTIONS = [
  { label: "Small", sub: "Quick game", n: 2 },
  { label: "Medium", sub: "Balanced", n: 3 },
  { label: "Large", sub: "Epic", n: 4 },
];
