// Shared palette for the mishpat screens. Lived inside page.tsx until the prompt library
// needed the same values from a second file — one source, so a colour change can't drift.
export const c = {
  primary: "#0073ea",
  primaryLight: "#cce5ff",
  badgeBg: "#d4e7ff",
  headerBg: "#ecedf5",
  darkBlue: "#00376d",
  text: "#323338",
  textGray: "#707070",
  textLight: "#8596af",
  iconGray: "#676879",
  border: "#c5c7d0",
  inputBorder: "#dcdfec",
  panelBg: "#ecedf5",
  hoverBg: "#f5f6f8",
} as const;

export const dk = {
  bg: "#13172b", surface: "#1c2235", input: "#1e2538",
  text: "#c8d6e5", textMuted: "#6b7da3", header: "#181c30",
  border: "#2a3150", blue: "#90b8e0",
} as const;

// Vibe's own status colours: --negative-color and --color-working_orange
export const RED = "#d83a52";
export const AMBER = "#fdab3d";

export const FONT = "Noto Sans Hebrew, sans-serif";
