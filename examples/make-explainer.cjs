const fs = require("fs");
const path = require("path");

const width = 1280;
const height = 720;
const duration = 20;
const fps = 30;
const bg = "#fafafa";
const font = "Inter, system-ui, sans-serif";
const monoFont = "JetBrains Mono, Fira Code, monospace";

const colors = {
  headline: "#0f172a",
  body: "#475569",
  muted: "#94a3b8",
  accent: "#2563eb",
  panelBg: "#ffffff",
  panelBorder: "#e2e8f0",
  codeBg: "#1e293b",
  codeText: "#e2e8f0",
  chipBg: "#dbeafe",
  chipText: "#1d4ed8",
  chipGreenBg: "#dcfce7",
  chipGreenText: "#166534"
};

const curves = {
  ease: { type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  easeOut: { type: "cubicBezier", x1: 0, y1: 0, x2: 0.2, y2: 1 }
};

const elements = [];

// Helper: create a chip group (bg + text together)
function chipGroup(id, x, y, label, bgColor, textColor) {
  const padX = 14;
  const h = 28;
  const w = label.length * 8 + padX * 2;
  const r = h / 2;
  return {
    id,
    type: "group",
    x, y,
    children: [
      {
        id: `${id}-bg`,
        type: "path",
        d: roundedRect(0, 0, w, h, r),
        fill: bgColor,
        stroke: "none"
      },
      {
        id: `${id}-text`,
        type: "text",
        x: w / 2,
        y: h / 2,
        text: label,
        align: "center",
        valign: "middle",
        fontSize: 12,
        fontFamily: font,
        weight: 600,
        fill: textColor
      }
    ]
  };
}

// Helper: fade in/out timeline
function fadeTimeline(inStart, inEnd, outStart, outEnd, yOffset = 0, startY = 0) {
  const tracks = {
    opacity: {
      keyframes: [
        { time: inStart, value: 0, out: curves.ease },
        { time: inEnd, value: 1 },
        { time: outStart, value: 1, out: curves.ease },
        { time: outEnd, value: 0 }
      ]
    }
  };
  if (yOffset !== 0) {
    tracks.y = {
      keyframes: [
        { time: inStart, value: startY + yOffset, out: curves.ease },
        { time: inEnd, value: startY }
      ]
    };
  }
  return { tracks };
}

// === SCENE 1: What is Sketchmark? (0-5s) ===

elements.push({
  id: "s1-headline",
  type: "text",
  x: width / 2,
  y: 200,
  text: "What is Sketchmark?",
  align: "center",
  valign: "middle",
  fontSize: 44,
  fontFamily: font,
  weight: 700,
  fill: colors.headline,
  opacity: 0,
  timeline: fadeTimeline(0, 0.6, 4, 4.6, 20, 200)
});

elements.push({
  id: "s1-body",
  type: "text",
  x: width / 2,
  y: 280,
  text: "A minimal render kernel that turns JSON documents\ninto SVG, HTML, or video frames.",
  align: "center",
  valign: "top",
  fontSize: 20,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.6,
  fill: colors.body,
  maxWidth: 700,
  opacity: 0,
  timeline: fadeTimeline(0.4, 1, 4, 4.6, 15, 280)
});

// Chip row for scene 1
const s1Chips = [
  { label: "JSON In", bg: colors.chipBg, text: colors.chipText },
  { label: "Visuals Out", bg: colors.chipGreenBg, text: colors.chipGreenText }
];
const s1ChipY = 380;
const s1ChipGap = 16;
const s1ChipW = s1Chips.reduce((sum, c) => sum + c.label.length * 8 + 28, 0) + s1ChipGap;
let s1ChipX = (width - s1ChipW) / 2;

s1Chips.forEach((chip, i) => {
  const cw = chip.label.length * 8 + 28;
  const group = chipGroup(`s1-chip-${i}`, s1ChipX, s1ChipY, chip.label, chip.bg, chip.text);
  group.opacity = 0;
  group.timeline = fadeTimeline(0.8 + i * 0.15, 1.3 + i * 0.15, 4, 4.6, 10, s1ChipY);
  elements.push(group);
  s1ChipX += cw + s1ChipGap;
});

// === SCENE 2: Define your document (5-10s) ===

elements.push({
  id: "s2-headline",
  type: "text",
  x: 180,
  y: 140,
  text: "Define your document",
  align: "left",
  valign: "top",
  fontSize: 32,
  fontFamily: font,
  weight: 700,
  fill: colors.headline,
  opacity: 0,
  timeline: fadeTimeline(5, 5.5, 9, 9.5, 15, 140)
});

elements.push({
  id: "s2-body",
  type: "text",
  x: 180,
  y: 190,
  text: "Declare canvas size, background, and elements.\nEach element has an ID, type, and properties.",
  align: "left",
  valign: "top",
  fontSize: 16,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.6,
  fill: colors.body,
  maxWidth: 400,
  opacity: 0,
  timeline: fadeTimeline(5.3, 5.8, 9, 9.5, 10, 190)
});

// Code panel for scene 2
const s2CodeX = 180;
const s2CodeY = 280;
const s2CodeW = 500;
const s2CodeH = 280;

elements.push({
  id: "s2-panel",
  type: "group",
  x: s2CodeX,
  y: s2CodeY,
  children: [
    {
      id: "s2-panel-bg",
      type: "path",
      d: roundedRect(0, 0, s2CodeW, s2CodeH, 10),
      fill: colors.codeBg,
      stroke: "none"
    },
    {
      id: "s2-panel-label",
      type: "text",
      x: 16,
      y: 16,
      text: "canvas.visual.json",
      align: "left",
      valign: "top",
      fontSize: 11,
      fontFamily: monoFont,
      weight: 500,
      fill: colors.muted
    },
    {
      id: "s2-panel-code",
      type: "text",
      x: 16,
      y: 44,
      text: `{
  "version": 1,
  "canvas": {
    "width": 800,
    "height": 600,
    "background": "#ffffff"
  },
  "elements": [
    { "id": "title", "type": "text", ... },
    { "id": "shape", "type": "path", ... }
  ]
}`,
      align: "left",
      valign: "top",
      fontSize: 13,
      fontFamily: monoFont,
      weight: 400,
      lineHeight: 1.45,
      fill: colors.codeText,
      maxWidth: s2CodeW - 32
    }
  ],
  opacity: 0,
  timeline: fadeTimeline(5.5, 6.2, 9, 9.5, 20, s2CodeY)
});

// Status chip for scene 2
const s2Chip = chipGroup("s2-chip", 720, 320, "Schema validated", colors.chipGreenBg, colors.chipGreenText);
s2Chip.opacity = 0;
s2Chip.timeline = fadeTimeline(6.5, 7, 9, 9.5, 10, 320);
elements.push(s2Chip);

// === SCENE 3: Add motion (10-15s) ===

elements.push({
  id: "s3-headline",
  type: "text",
  x: width / 2,
  y: 120,
  text: "Add motion with timelines",
  align: "center",
  valign: "middle",
  fontSize: 32,
  fontFamily: font,
  weight: 700,
  fill: colors.headline,
  opacity: 0,
  timeline: fadeTimeline(10, 10.5, 14, 14.5, 15, 120)
});

elements.push({
  id: "s3-body",
  type: "text",
  x: width / 2,
  y: 170,
  text: "Each element can have its own timeline with keyframes.\nThe kernel interpolates smoothly between values.",
  align: "center",
  valign: "top",
  fontSize: 16,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.6,
  fill: colors.body,
  maxWidth: 600,
  opacity: 0,
  timeline: fadeTimeline(10.3, 10.8, 14, 14.5, 10, 170)
});

// Animated demo box for scene 3
const s3BoxSize = 80;
const s3BoxY = 340;

elements.push({
  id: "s3-demo-box",
  type: "path",
  d: roundedRect(0, 0, s3BoxSize, s3BoxSize, 12),
  x: 300,
  y: s3BoxY,
  fill: colors.accent,
  stroke: "none",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 10.5, value: 0, out: curves.ease },
          { time: 11, value: 1 },
          { time: 14, value: 1, out: curves.ease },
          { time: 14.5, value: 0 }
        ]
      },
      x: {
        keyframes: [
          { time: 11, value: 300, out: curves.ease },
          { time: 12.5, value: 900, out: curves.ease },
          { time: 14, value: 300 }
        ]
      },
      rotation: {
        keyframes: [
          { time: 11, value: 0, out: curves.ease },
          { time: 12.5, value: 180, out: curves.ease },
          { time: 14, value: 360 }
        ]
      }
    }
  },
  origin: [s3BoxSize / 2, s3BoxSize / 2]
});

// Timeline label chips
const s3Labels = ["position", "rotation", "opacity"];
s3Labels.forEach((label, i) => {
  const lx = 400 + i * 140;
  const ly = 480;
  const chip = chipGroup(`s3-label-${i}`, lx, ly, label, colors.chipBg, colors.chipText);
  chip.opacity = 0;
  chip.timeline = fadeTimeline(11.5 + i * 0.2, 12 + i * 0.2, 14, 14.5, 8, ly);
  elements.push(chip);
});

// === SCENE 4: Export anywhere (15-20s) ===

elements.push({
  id: "s4-headline",
  type: "text",
  x: width / 2,
  y: 180,
  text: "Export anywhere",
  align: "center",
  valign: "middle",
  fontSize: 44,
  fontFamily: font,
  weight: 700,
  fill: colors.headline,
  opacity: 0,
  timeline: fadeTimeline(15, 15.6, 19, 19.5, 20, 180)
});

elements.push({
  id: "s4-body",
  type: "text",
  x: width / 2,
  y: 260,
  text: "Render to SVG for the web, PNG for assets,\nor MP4 for video content. One source, many outputs.",
  align: "center",
  valign: "top",
  fontSize: 18,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.6,
  fill: colors.body,
  maxWidth: 600,
  opacity: 0,
  timeline: fadeTimeline(15.4, 16, 19, 19.5, 15, 260)
});

// Export format chips
const s4Formats = [
  { label: "SVG", bg: colors.chipBg, text: colors.chipText },
  { label: "PNG", bg: colors.chipBg, text: colors.chipText },
  { label: "MP4", bg: colors.chipGreenBg, text: colors.chipGreenText },
  { label: "WebM", bg: colors.chipBg, text: colors.chipText }
];
const s4ChipY = 360;
const s4ChipGap = 14;
const s4TotalW = s4Formats.reduce((sum, c) => sum + c.label.length * 8 + 28, 0) + s4ChipGap * (s4Formats.length - 1);
let s4ChipX = (width - s4TotalW) / 2;

s4Formats.forEach((chip, i) => {
  const cw = chip.label.length * 8 + 28;
  const group = chipGroup(`s4-chip-${i}`, s4ChipX, s4ChipY, chip.label, chip.bg, chip.text);
  group.opacity = 0;
  group.timeline = fadeTimeline(16 + i * 0.15, 16.5 + i * 0.15, 19, 19.5, 10, s4ChipY);
  elements.push(group);
  s4ChipX += cw + s4ChipGap;
});

// Footer
elements.push({
  id: "s4-footer",
  type: "text",
  x: width / 2,
  y: 500,
  text: "sketchmark.dev",
  align: "center",
  valign: "middle",
  fontSize: 16,
  fontFamily: font,
  weight: 500,
  fill: colors.muted,
  opacity: 0,
  timeline: fadeTimeline(17, 17.5, 19.5, 20, 0, 500)
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
  canvas: { width, height, background: bg, duration, fps },
  elements
};

const outPath = path.join(__dirname, "explainer.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
