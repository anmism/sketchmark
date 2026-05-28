const fs = require("fs");
const path = require("path");

const width = 1120;
const height = 880;
const bg = "#ffffff";
const font = "Inter, system-ui, sans-serif";

const colors = {
  headline: "#0f172a",
  subheadline: "#475569",
  chipBg: "#f1f5f9",
  chipBorder: "#e2e8f0",
  chipText: "#334155",
  sectionTitle: "#1e293b",
  body: "#475569",
  bullet: "#2563eb",
  divider: "#e2e8f0"
};

const padX = 80;
const contentW = width - padX * 2;
let y = 72;

const elements = [];

// === HERO SECTION (centered) ===

// Large centered headline
elements.push({
  id: "hero-headline",
  type: "text",
  x: width / 2,
  y: y,
  text: "Ship faster with less friction",
  align: "center",
  valign: "top",
  fontSize: 48,
  fontFamily: font,
  weight: 800,
  fill: colors.headline
});
y += 68;

// Centered subheadline
elements.push({
  id: "hero-subheadline",
  type: "text",
  x: width / 2,
  y: y,
  text: "A modern platform for teams who want to build, deploy, and iterate\nwithout wrestling infrastructure or waiting on bottlenecks.",
  align: "center",
  valign: "top",
  fontSize: 18,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.55,
  fill: colors.subheadline,
  maxWidth: contentW
});
y += 72;

// Feature chips (centered row, centered text in each)
const chips = [
  "Real-time Collaboration",
  "One-click Deploy",
  "Built-in Analytics"
];

const chipH = 36;
const chipR = 18;
const chipPadX = 20;
const chipGap = 14;

// Calculate total row width to center the group
let totalChipW = 0;
const chipWidths = chips.map(label => {
  const w = label.length * 8.5 + chipPadX * 2;
  totalChipW += w;
  return w;
});
totalChipW += chipGap * (chips.length - 1);

let chipX = (width - totalChipW) / 2;

chips.forEach((label, i) => {
  const cw = chipWidths[i];

  elements.push({
    id: `chip-bg-${i}`,
    type: "path",
    d: roundedRect(chipX, y, cw, chipH, chipR),
    fill: colors.chipBg,
    stroke: colors.chipBorder,
    strokeWidth: 1
  });

  elements.push({
    id: `chip-text-${i}`,
    type: "text",
    x: chipX + cw / 2,
    y: y + chipH / 2,
    text: label,
    align: "center",
    valign: "middle",
    fontSize: 14,
    fontFamily: font,
    weight: 500,
    fill: colors.chipText
  });

  chipX += cw + chipGap;
});
y += chipH + 56;

// Divider between hero and body
elements.push({
  id: "hero-divider",
  type: "path",
  d: `M ${padX} ${y} L ${width - padX} ${y}`,
  stroke: colors.divider,
  strokeWidth: 1,
  fill: "none"
});
y += 48;

// === BODY SECTION (left-aligned) ===

// Section title
elements.push({
  id: "section-title",
  type: "text",
  x: padX,
  y: y,
  text: "Why teams choose us",
  align: "left",
  valign: "top",
  fontSize: 26,
  fontFamily: font,
  weight: 700,
  fill: colors.sectionTitle
});
y += 44;

// Body paragraph
elements.push({
  id: "section-para",
  type: "text",
  x: padX,
  y: y,
  text: "Most platforms promise speed but deliver complexity. We took a different approach:\nstrip away everything that doesn't directly help you ship. No configuration mazes,\nno permission matrices, no waiting for DevOps. Just write code, push, and see it live.",
  align: "left",
  valign: "top",
  fontSize: 15,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.7,
  fill: colors.body,
  maxWidth: contentW
});
y += 100;

// Bullet list
const bullets = [
  "Zero-config deployments with automatic scaling and rollback",
  "Collaborative editing with live cursors and instant sync",
  "Unified dashboard for logs, metrics, and error tracking",
  "Native integrations with GitHub, GitLab, and Bitbucket",
  "SOC 2 Type II certified with end-to-end encryption"
];

bullets.forEach((text, i) => {
  const by = y + i * 36;

  // Bullet dot
  elements.push({
    id: `bullet-dot-${i}`,
    type: "path",
    d: `M ${padX + 5} ${by + 9} A 4 4 0 1 1 ${padX + 5} ${by + 9.01} Z`,
    fill: colors.bullet,
    stroke: "none"
  });

  elements.push({
    id: `bullet-text-${i}`,
    type: "text",
    x: padX + 20,
    y: by,
    text: text,
    align: "left",
    valign: "top",
    fontSize: 15,
    fontFamily: font,
    weight: 400,
    fill: colors.body,
    maxWidth: contentW - 20
  });
});

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

const doc = {
  version: 1,
  canvas: { width, height, background: bg },
  elements
};

const outPath = path.join(__dirname, "product-hero.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
