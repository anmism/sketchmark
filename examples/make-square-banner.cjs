const fs = require("fs");
const path = require("path");

const width = 1080;
const height = 1080;
const bg = "#fafbfd";
const font = "Roboto, Arial, sans-serif";
const monoFont = "JetBrains Mono, Fira Code, monospace";

const colors = {
  frame: "#e7ebf3",
  text: "#0f172a",
  body: "#475569",
  muted: "#64748b",
  panel: "#ffffff",
  panelStroke: "#e6ebf2",
  shell: "#f4f7fb",
  shellStroke: "#dbe4ef",
  accent: "#7c83ff",
  accentSoft: "#eef0ff",
  accent2: "#38bdf8",
  accent2Soft: "#eaf8ff",
  accent3: "#34d399",
  accent3Soft: "#eafaf3",
  codeText: "#334155",
  codeMuted: "#6d7cff"
};

const elements = [];

elements.push({
  id: "frame",
  type: "path",
  d: roundedRect(36, 36, width - 72, height - 72, 40),
  fill: "none",
  stroke: colors.frame,
  strokeWidth: 1.5
});

elements.push({
  id: "brand-chip-bg",
  type: "path",
  d: roundedRect(448, 74, 184, 38, 19),
  fill: colors.accentSoft,
  stroke: "none"
});

elements.push({
  id: "brand-chip-text",
  type: "text",
  x: 540,
  y: 93,
  text: "SKETCHMARK",
  align: "center",
  valign: "middle",
  fontSize: 13,
  fontFamily: font,
  weight: 700,
  letterSpacing: 1.7,
  fill: colors.accent
});

elements.push({
  id: "headline",
  type: "text",
  x: width / 2,
  y: 156,
  text: "The world's first\nvisual language\nfor AI agents",
  align: "center",
  valign: "top",
  fontSize: 72,
  fontFamily: font,
  weight: 700,
  lineHeight: 1.04,
  fill: colors.text
});

elements.push({
  id: "subhead",
  type: "text",
  x: width / 2,
  y: 404,
  text: "Describe visuals in JSON. Keep them editable.\nAnimate them. Export them.",
  align: "center",
  valign: "top",
  fontSize: 24,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.45,
  fill: colors.body,
  maxWidth: 760
});

const chips = [
  { id: "chip-json", label: "JSON-native", color: colors.accent, soft: colors.accentSoft },
  { id: "chip-anim", label: "Animatable", color: colors.accent2, soft: colors.accent2Soft },
  { id: "chip-edit", label: "Editable", color: colors.accent3, soft: colors.accent3Soft }
];

const chipGap = 16;
const chipPadX = 22;
const chipH = 44;
const chipWidths = chips.map((chip) => chip.label.length * 10 + chipPadX * 2);
const totalChipW = chipWidths.reduce((sum, value) => sum + value, 0) + chipGap * (chips.length - 1);
let chipX = (width - totalChipW) / 2;

chips.forEach((chip, index) => {
  const chipW = chipWidths[index];
  elements.push({
    id: `${chip.id}-bg`,
    type: "path",
    d: roundedRect(chipX, 502, chipW, chipH, chipH / 2),
    fill: chip.soft,
    stroke: "none"
  });

  elements.push({
    id: `${chip.id}-text`,
    type: "text",
    x: chipX + chipW / 2,
    y: 524,
    text: chip.label,
    align: "center",
    valign: "middle",
    fontSize: 18,
    fontFamily: font,
    weight: 600,
    fill: chip.color
  });

  chipX += chipW + chipGap;
});

elements.push({
  id: "workflow-shell",
  type: "path",
  d: roundedRect(92, 604, 896, 384, 32),
  fill: colors.shell,
  stroke: colors.shellStroke,
  strokeWidth: 1.5,
  effects: {
    shadow: { dx: 0, dy: 18, blur: 40, color: "#b8c3d6", opacity: 0.16 }
  }
});

elements.push({
  id: "workflow-title",
  type: "text",
  x: 132,
  y: 638,
  text: "One document. Multiple outputs.",
  align: "left",
  valign: "top",
  fontSize: 20,
  fontFamily: font,
  weight: 600,
  fill: colors.muted
});

elements.push({
  id: "doc-card",
  type: "path",
  d: roundedRect(132, 694, 304, 236, 24),
  fill: colors.panel,
  stroke: colors.panelStroke,
  strokeWidth: 1.2
});

elements.push({
  id: "doc-accent",
  type: "path",
  d: roundedRect(132, 694, 304, 10, 5),
  fill: colors.accent,
  stroke: "none"
});

elements.push({
  id: "doc-title",
  type: "text",
  x: 158,
  y: 726,
  text: "sketchmark.visual.json",
  align: "left",
  valign: "top",
  fontSize: 13,
  fontFamily: monoFont,
  weight: 500,
  fill: colors.codeMuted
});

elements.push({
  id: "doc-code",
  type: "text",
  x: 158,
  y: 764,
  lines: [
    "{",
    "  \"canvas\": { ... },",
    "  \"elements\": [",
    "    ...",
    "  ],",
    "  \"timeline\": { ... }",
    "}"
  ],
  align: "left",
  valign: "top",
  fontSize: 13,
  fontFamily: monoFont,
  weight: 400,
  lineHeight: 1.48,
  fill: colors.codeText
});

elements.push({
  id: "render-arrow-line",
  type: "path",
  d: "M 474 812 L 592 812",
  fill: "none",
  stroke: colors.accent,
  strokeWidth: 3,
  strokeCap: "round"
});

elements.push({
  id: "render-arrow-head",
  type: "path",
  d: "M 576 798 L 592 812 L 576 826",
  fill: "none",
  stroke: colors.accent,
  strokeWidth: 3,
  strokeCap: "round",
  strokeJoin: "round"
});

elements.push({
  id: "render-label",
  type: "text",
  x: 533,
  y: 780,
  text: "render",
  align: "center",
  valign: "middle",
  fontSize: 14,
  fontFamily: font,
  weight: 600,
  fill: colors.accent
});

elements.push({
  id: "preview-card",
  type: "path",
  d: roundedRect(640, 694, 312, 236, 24),
  fill: colors.panel,
  stroke: colors.panelStroke,
  strokeWidth: 1.2
});

elements.push({
  id: "preview-accent",
  type: "path",
  d: roundedRect(640, 694, 312, 10, 5),
  fill: colors.accent2,
  stroke: "none"
});

elements.push({
  id: "preview-title",
  type: "text",
  x: 668,
  y: 726,
  text: "Rendered output",
  align: "left",
  valign: "top",
  fontSize: 13,
  fontFamily: font,
  weight: 600,
  fill: colors.accent3
});

elements.push({
  id: "preview-hello",
  type: "text",
  x: 668,
  y: 764,
  text: "Hello agent",
  align: "left",
  valign: "top",
  fontSize: 28,
  fontFamily: font,
  weight: 700,
  fill: colors.text
});

elements.push({
  id: "preview-shape",
  type: "path",
  d: roundedRect(760, 800, 56, 56, 14),
  fill: colors.accent,
  stroke: "none",
  rotation: -24,
  origin: [788, 828]
});

elements.push({
  id: "preview-wave",
  type: "path",
  d: "M 688 876 C 736 850 786 848 830 868 C 866 884 900 884 930 862",
  fill: "none",
  stroke: colors.accent2,
  strokeWidth: 5,
  strokeCap: "round"
});

elements.push({
  id: "preview-dot",
  type: "path",
  d: circlePath(790, 874, 9),
  fill: colors.accent3,
  stroke: "none"
});

elements.push({
  id: "footer-copy",
  type: "text",
  x: width / 2,
  y: 1008,
  text: "Design once. Export SVG, PNG, or MP4.",
  align: "center",
  valign: "middle",
  fontSize: 20,
  fontFamily: font,
  weight: 500,
  fill: colors.body
});

const doc = {
  version: 1,
  canvas: { width, height, background: bg },
  elements
};

const outPath = path.join(__dirname, "square-banner.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);

function roundedRect(x, y, w, h, r) {
  return [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z"
  ].join(" ");
}

function circlePath(cx, cy, r) {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
}
