// ============================================================
// sketchmark — Global Theme Palette Library
// ============================================================
// Usage in DSL:
//   theme default=ocean          ← activates a built-in palette
//   theme default=dark           ← built-in dark mode
//   config theme=ocean           ← alternative syntax
//
// All palettes follow the same DiagramPalette shape so renderers
// only need one code path regardless of which theme is active.
// ============================================================

export interface DiagramPalette {
  // ── Nodes ────────────────────────────────────────────────
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;

  // ── Edges ────────────────────────────────────────────────
  edgeStroke: string;
  edgeLabelBg: string;
  edgeLabelText: string;

  // ── Groups ───────────────────────────────────────────────
  groupFill: string;
  groupStroke: string;
  groupDash: number[];
  groupLabel: string;

  // ── Tables ───────────────────────────────────────────────
  tableFill: string;
  tableStroke: string;
  tableText: string;
  tableHeaderFill: string;
  tableHeaderText: string;
  tableDivider: string;

  // ── Notes ────────────────────────────────────────────────
  noteFill: string;
  noteStroke: string;
  noteText: string;
  noteFold: string;

  // ── Charts ───────────────────────────────────────────────
  chartFill: string;
  chartStroke: string;
  chartAxisStroke: string;
  chartText: string;
  chartTitleText: string;

  // ── Canvas background ────────────────────────────────────
  background: string;

  // ── Title ────────────────────────────────────────────────
  titleText: string;
}

// ── Built-in palettes ──────────────────────────────────────

export const PALETTES: Record<string, DiagramPalette> = {
  // ── light (default) ───────────────────────────────────
  light: {
    nodeFill: "#fefcf8",
    nodeStroke: "#2c1c0e",
    nodeText: "#1a1208",

    edgeStroke: "#2c1c0e",
    edgeLabelBg: "#f8f4ea",
    edgeLabelText: "#4a2e10",

    groupFill: "#f5f0e8",
    groupStroke: "#c8a878",
    groupDash: [7, 5],
    groupLabel: "#7a5028",

    tableFill: "#fefcf8",
    tableStroke: "#c8b898",
    tableText: "#1a1208",
    tableHeaderFill: "#f0e8d8",
    tableHeaderText: "#3a2010",
    tableDivider: "#d8c8a8",

    noteFill: "#fffde7",
    noteStroke: "#f0a500",
    noteText: "#5a4000",
    noteFold: "#f0a500",

    chartFill: "#fefcf8",
    chartStroke: "#c8b898",
    chartAxisStroke: "#8a7060",
    chartText: "#4a2e10",
    chartTitleText: "#1a1208",

    background: "#f8f4ea",
    titleText: "#1a1208",
  },

  // ── dark ──────────────────────────────────────────────
  dark: {
    nodeFill: "#1e1812",
    nodeStroke: "#c8a870",
    nodeText: "#f0dca8",

    edgeStroke: "#c8a870",
    edgeLabelBg: "#1e1812",
    edgeLabelText: "#ddc898",

    groupFill: "#2a2218",
    groupStroke: "#6a5030",
    groupDash: [7, 5],
    groupLabel: "#c8a060",

    tableFill: "#1e1812",
    tableStroke: "#6a5030",
    tableText: "#f0dca8",
    tableHeaderFill: "#2e2418",
    tableHeaderText: "#f5e0a8",
    tableDivider: "#4a3820",

    noteFill: "#2a2410",
    noteStroke: "#c8a060",
    noteText: "#ddc898",
    noteFold: "#c8a060",

    chartFill: "#1e1812",
    chartStroke: "#6a5030",
    chartAxisStroke: "#9a8060",
    chartText: "#ddc898",
    chartTitleText: "#f0dca8",

    background: "#12100a",
    titleText: "#f0dca8",
  },
  // ── sketch ─────────────────────────────────────────────

  sketch: {
    nodeFill: "#f4f4f2",
    nodeStroke: "#2e2e2e",
    nodeText: "#1a1a1a",

    edgeStroke: "#3a3a3a",
    edgeLabelBg: "#ebebea",
    edgeLabelText: "#2a2a2a",

    groupFill: "#eeeeec",
    groupStroke: "#8a8a88",
    groupDash: [6, 4],
    groupLabel: "#4a4a48",

    tableFill: "#f7f7f5",
    tableStroke: "#9a9a98",
    tableText: "#1a1a1a",
    tableHeaderFill: "#dededc",
    tableHeaderText: "#111111",
    tableDivider: "#c4c4c2",

    noteFill: "#f5f5f0",
    noteStroke: "#6a6a68",
    noteText: "#2a2a2a",
    noteFold: "#8a8a88",

    chartFill: "#f4f4f2",
    chartStroke: "#9a9a98",
    chartAxisStroke: "#5a5a58",
    chartText: "#2a2a2a",
    chartTitleText: "#111111",

    background: "#f0f0ee",
    titleText: "#111111",
  },
  // ── ocean ─────────────────────────────────────────────
  ocean: {
    nodeFill: "#e8f4ff",
    nodeStroke: "#0044cc",
    nodeText: "#003399",

    edgeStroke: "#0055cc",
    edgeLabelBg: "#d0e8ff",
    edgeLabelText: "#003388",

    groupFill: "#ddeeff",
    groupStroke: "#4488dd",
    groupDash: [7, 5],
    groupLabel: "#0044aa",

    tableFill: "#e8f4ff",
    tableStroke: "#4488dd",
    tableText: "#003399",
    tableHeaderFill: "#cce0ff",
    tableHeaderText: "#002288",
    tableDivider: "#88bbee",

    noteFill: "#e0f0ff",
    noteStroke: "#0066cc",
    noteText: "#003388",
    noteFold: "#0066cc",

    chartFill: "#e8f4ff",
    chartStroke: "#4488dd",
    chartAxisStroke: "#336699",
    chartText: "#003388",
    chartTitleText: "#002277",

    background: "#f0f8ff",
    titleText: "#002277",
  },

  // ── forest ────────────────────────────────────────────
  forest: {
    nodeFill: "#e8ffe8",
    nodeStroke: "#007700",
    nodeText: "#004400",

    edgeStroke: "#228822",
    edgeLabelBg: "#d0f0d0",
    edgeLabelText: "#004400",

    groupFill: "#d8f0d8",
    groupStroke: "#44aa44",
    groupDash: [7, 5],
    groupLabel: "#005500",

    tableFill: "#e8ffe8",
    tableStroke: "#44aa44",
    tableText: "#004400",
    tableHeaderFill: "#c8eec8",
    tableHeaderText: "#003300",
    tableDivider: "#88cc88",

    noteFill: "#e0ffe0",
    noteStroke: "#009900",
    noteText: "#004400",
    noteFold: "#009900",

    chartFill: "#e8ffe8",
    chartStroke: "#44aa44",
    chartAxisStroke: "#336633",
    chartText: "#004400",
    chartTitleText: "#003300",

    background: "#f0fff0",
    titleText: "#003300",
  },

  // ── sunset ────────────────────────────────────────────
  sunset: {
    nodeFill: "#fff0e8",
    nodeStroke: "#c85428",
    nodeText: "#7a2800",

    edgeStroke: "#c85428",
    edgeLabelBg: "#ffe0cc",
    edgeLabelText: "#7a2800",

    groupFill: "#ffe8d8",
    groupStroke: "#e07040",
    groupDash: [7, 5],
    groupLabel: "#883300",

    tableFill: "#fff0e8",
    tableStroke: "#e07040",
    tableText: "#7a2800",
    tableHeaderFill: "#ffd8c0",
    tableHeaderText: "#661800",
    tableDivider: "#e8a888",

    noteFill: "#fff0d8",
    noteStroke: "#e07040",
    noteText: "#7a2800",
    noteFold: "#e07040",

    chartFill: "#fff0e8",
    chartStroke: "#e07040",
    chartAxisStroke: "#aa5530",
    chartText: "#7a2800",
    chartTitleText: "#661800",

    background: "#fff8f0",
    titleText: "#661800",
  },

  // ── slate ─────────────────────────────────────────────
  slate: {
    nodeFill: "#f0f2f5",
    nodeStroke: "#4a5568",
    nodeText: "#1a202c",

    edgeStroke: "#4a5568",
    edgeLabelBg: "#e2e8f0",
    edgeLabelText: "#2d3748",

    groupFill: "#e2e8f0",
    groupStroke: "#718096",
    groupDash: [7, 5],
    groupLabel: "#2d3748",

    tableFill: "#f0f2f5",
    tableStroke: "#718096",
    tableText: "#1a202c",
    tableHeaderFill: "#e2e8f0",
    tableHeaderText: "#1a202c",
    tableDivider: "#a0aec0",

    noteFill: "#fefcbf",
    noteStroke: "#d69e2e",
    noteText: "#744210",
    noteFold: "#d69e2e",

    chartFill: "#f0f2f5",
    chartStroke: "#718096",
    chartAxisStroke: "#4a5568",
    chartText: "#2d3748",
    chartTitleText: "#1a202c",

    background: "#edf2f7",
    titleText: "#1a202c",
  },

  // ── rose ──────────────────────────────────────────────
  rose: {
    nodeFill: "#fff0f3",
    nodeStroke: "#cc3355",
    nodeText: "#7a0022",

    edgeStroke: "#cc3355",
    edgeLabelBg: "#ffd0da",
    edgeLabelText: "#7a0022",

    groupFill: "#ffe0e8",
    groupStroke: "#dd5577",
    groupDash: [7, 5],
    groupLabel: "#880033",

    tableFill: "#fff0f3",
    tableStroke: "#dd5577",
    tableText: "#7a0022",
    tableHeaderFill: "#ffd0da",
    tableHeaderText: "#660022",
    tableDivider: "#eea0b0",

    noteFill: "#fff0f3",
    noteStroke: "#cc3355",
    noteText: "#7a0022",
    noteFold: "#cc3355",

    chartFill: "#fff0f3",
    chartStroke: "#dd5577",
    chartAxisStroke: "#aa3355",
    chartText: "#7a0022",
    chartTitleText: "#660022",

    background: "#fff5f7",
    titleText: "#660022",
  },

  // ── midnight ──────────────────────────────────────────
  midnight: {
    nodeFill: "#0d1117",
    nodeStroke: "#58a6ff",
    nodeText: "#c9d1d9",

    edgeStroke: "#58a6ff",
    edgeLabelBg: "#161b22",
    edgeLabelText: "#c9d1d9",

    groupFill: "#161b22",
    groupStroke: "#30363d",
    groupDash: [7, 5],
    groupLabel: "#8b949e",

    tableFill: "#0d1117",
    tableStroke: "#30363d",
    tableText: "#c9d1d9",
    tableHeaderFill: "#161b22",
    tableHeaderText: "#e6edf3",
    tableDivider: "#30363d",

    noteFill: "#161b22",
    noteStroke: "#58a6ff",
    noteText: "#c9d1d9",
    noteFold: "#58a6ff",

    chartFill: "#0d1117",
    chartStroke: "#30363d",
    chartAxisStroke: "#8b949e",
    chartText: "#c9d1d9",
    chartTitleText: "#e6edf3",

    background: "#010409",
    titleText: "#e6edf3",
  },
};

// ── Palette resolver ───────────────────────────────────────
export function resolvePalette(name?: string): DiagramPalette {
  if (!name) return PALETTES.light;
  return PALETTES[name] ?? PALETTES.light;
}

// ── DSL config key that activates a palette ────────────────
// Usage in DSL:  config theme=ocean
export const THEME_CONFIG_KEY = "theme";

export function listThemes(): string[] {
  return Object.keys(PALETTES);
}

export const THEME_NAMES = Object.keys(PALETTES) as string[];