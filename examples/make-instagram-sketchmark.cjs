const fs = require("fs");
const path = require("path");

const width = 1080;
const height = 1080;
const bg = "#0f0f1a";
const font = "Inter, system-ui, sans-serif";
const monoFont = "JetBrains Mono, Fira Code, monospace";

const colors = {
  white: "#ffffff",
  headline: "#ffffff",
  subtext: "#a1a1b5",
  accent: "#7c83ff",
  accentSoft: "#2a2b4a",
  accent2: "#38bdf8",
  accent3: "#34d399",
  cardBg: "#1a1a2e",
  cardStroke: "#2a2a44",
  codeBg: "#12121f",
  codeText: "#c4c4dc",
  codeKeyword: "#7c83ff",
  codeString: "#34d399",
  gridLine: "#1e1e32",
  glow: "#7c83ff"
};

const elements = [];

// Background grid pattern (subtle)
for (let i = 0; i <= 10; i++) {
  const gx = i * 108;
  elements.push({
    id: `grid-v-${i}`,
    type: "path",
    d: `M ${gx} 0 L ${gx} ${height}`,
    fill: "none",
    stroke: colors.gridLine,
    strokeWidth: 0.5,
    opacity: 0.4
  });
  elements.push({
    id: `grid-h-${i}`,
    type: "path",
    d: `M 0 ${gx} L ${width} ${gx}`,
    fill: "none",
    stroke: colors.gridLine,
    strokeWidth: 0.5,
    opacity: 0.4
  });
}

// Glow orb behind headline
elements.push({
  id: "glow-orb",
  type: "path",
  d: circlePath(540, 320, 200),
  fill: {
    type: "radialGradient",
    center: [540, 320],
    radius: 200,
    stops: [
      { offset: 0, color: "#7c83ff" },
      { offset: 1, color: "#0f0f1a" }
    ]
  },
  stroke: "none",
  opacity: 0.2
});

// Brand chip at top
elements.push({
  id: "brand-pill-bg",
  type: "path",
  d: roundedRect(420, 80, 240, 44, 22),
  fill: colors.accentSoft,
  stroke: colors.cardStroke,
  strokeWidth: 1
});

elements.push({
  id: "brand-pill-dot",
  type: "path",
  d: circlePath(452, 102, 5),
  fill: colors.accent3,
  stroke: "none"
});

elements.push({
  id: "brand-pill-text",
  type: "text",
  x: 540,
  y: 102,
  text: "SKETCHMARK",
  align: "center",
  valign: "middle",
  fontSize: 15,
  fontFamily: font,
  weight: 700,
  letterSpacing: 2.5,
  fill: colors.accent
});

// Main headline
elements.push({
  id: "headline",
  type: "text",
  x: width / 2,
  y: 180,
  text: "Design visuals\nwith code.",
  align: "center",
  valign: "top",
  fontSize: 80,
  fontFamily: font,
  weight: 800,
  lineHeight: 1.05,
  fill: colors.headline
});

// Subheadline
elements.push({
  id: "subhead",
  type: "text",
  x: width / 2,
  y: 380,
  text: "A JSON-native visual language built\nfor AI agents and modern toolchains.",
  align: "center",
  valign: "top",
  fontSize: 22,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.5,
  fill: colors.subtext,
  maxWidth: 700
});

// Code card
elements.push({
  id: "code-card",
  type: "path",
  d: roundedRect(120, 490, 840, 320, 24),
  fill: colors.codeBg,
  stroke: colors.cardStroke,
  strokeWidth: 1.5,
  effects: {
    shadow: { dx: 0, dy: 24, blur: 60, color: "#000000", opacity: 0.5 }
  }
});

// Code card top bar dots
elements.push({
  id: "code-dot-1",
  type: "path",
  d: circlePath(160, 522, 6),
  fill: "#ff5f57",
  stroke: "none"
});

elements.push({
  id: "code-dot-2",
  type: "path",
  d: circlePath(182, 522, 6),
  fill: "#febc2e",
  stroke: "none"
});

elements.push({
  id: "code-dot-3",
  type: "path",
  d: circlePath(204, 522, 6),
  fill: "#28c840",
  stroke: "none"
});

// Code card filename
elements.push({
  id: "code-filename",
  type: "text",
  x: 540,
  y: 522,
  text: "banner.visual.json",
  align: "center",
  valign: "middle",
  fontSize: 13,
  fontFamily: monoFont,
  weight: 500,
  fill: colors.subtext
});

// Code content
elements.push({
  id: "code-content",
  type: "text",
  x: 160,
  y: 560,
  lines: [
    "{",
    "  \"version\": 1,",
    "  \"canvas\": { \"width\": 1080, \"height\": 1080 },",
    "  \"elements\": [",
    "    { \"type\": \"text\", \"text\": \"Hello\" },",
    "    { \"type\": \"path\", \"d\": \"M 0 0 ...\" }",
    "  ]",
    "}"
  ],
  align: "left",
  valign: "top",
  fontSize: 16,
  fontFamily: monoFont,
  weight: 400,
  lineHeight: 1.7,
  fill: colors.codeText
});

// Decorative shape - floating rounded square
elements.push({
  id: "deco-square",
  type: "path",
  d: roundedRect(820, 560, 80, 80, 16),
  fill: "none",
  stroke: colors.accent,
  strokeWidth: 2,
  opacity: 0.6,
  rotation: 15,
  origin: [860, 600]
});

// Decorative shape - floating circle
elements.push({
  id: "deco-circle",
  type: "path",
  d: circlePath(180, 660, 24),
  fill: "none",
  stroke: colors.accent2,
  strokeWidth: 2,
  opacity: 0.5
});

// Feature pills at bottom
const features = [
  { label: "JSON-native", color: colors.accent },
  { label: "Animatable", color: colors.accent2 },
  { label: "AI-ready", color: colors.accent3 }
];

const pillH = 40;
const pillGap = 16;
const pillPadX = 24;
const pillWidths = features.map(f => f.label.length * 10.5 + pillPadX * 2);
const totalPillW = pillWidths.reduce((s, w) => s + w, 0) + pillGap * (features.length - 1);
let pillX = (width - totalPillW) / 2;
const pillY = 860;

features.forEach((feat, i) => {
  const pw = pillWidths[i];
  elements.push({
    id: `feat-pill-bg-${i}`,
    type: "path",
    d: roundedRect(pillX, pillY, pw, pillH, pillH / 2),
    fill: colors.accentSoft,
    stroke: feat.color,
    strokeWidth: 1
  });

  elements.push({
    id: `feat-pill-text-${i}`,
    type: "text",
    x: pillX + pw / 2,
    y: pillY + pillH / 2,
    text: feat.label,
    align: "center",
    valign: "middle",
    fontSize: 16,
    fontFamily: font,
    weight: 600,
    fill: feat.color
  });

  pillX += pw + pillGap;
});

// Footer CTA
elements.push({
  id: "cta",
  type: "text",
  x: width / 2,
  y: 950,
  text: "github.com/sketchmark",
  align: "center",
  valign: "middle",
  fontSize: 18,
  fontFamily: monoFont,
  weight: 500,
  fill: colors.subtext
});

// Bottom accent line
elements.push({
  id: "bottom-accent",
  type: "path",
  d: `M 390 1010 L 690 1010`,
  fill: "none",
  stroke: {
    type: "linearGradient",
    from: [390, 1010],
    to: [690, 1010],
    stops: [
      { offset: 0, color: colors.accent },
      { offset: 0.5, color: colors.accent2 },
      { offset: 1, color: colors.accent3 }
    ]
  },
  strokeWidth: 3,
  strokeCap: "round"
});

const doc = {
  version: 1,
  canvas: { width, height, background: bg },
  elements
};

const outPath = path.join(__dirname, "instagram-sketchmark.visual.json");
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
