const fs = require("fs");
const path = require("path");

const width = 1280;
const height = 960;
const bg = "#ffffff";
const textColor = "#1a1a2e";
const mutedColor = "#6b7280";
const accentColor = "#2563eb";
const codeBg = "#f1f5f9";
const codeBorder = "#e2e8f0";
const codeText = "#334155";
const bulletColor = "#2563eb";
const btnBg = "#2563eb";
const btnText = "#ffffff";
const font = "Inter, system-ui, sans-serif";
const monoFont = "JetBrains Mono, Fira Code, monospace";

const padX = 80;
let y = 64;

const elements = [];

// Page title
elements.push({
  id: "title",
  type: "text",
  x: padX,
  y: y,
  text: "Getting Started with the Render API",
  align: "left",
  valign: "top",
  fontSize: 36,
  fontFamily: font,
  weight: 700,
  fill: textColor
});
y += 52;

// Subtitle
elements.push({
  id: "subtitle",
  type: "text",
  x: padX,
  y: y,
  text: "A concise guide to integrating the render pipeline into your application.",
  align: "left",
  valign: "top",
  fontSize: 16,
  fontFamily: font,
  weight: 400,
  fill: mutedColor
});
y += 48;

// Horizontal rule
elements.push({
  id: "divider",
  type: "path",
  d: `M ${padX} ${y} L ${width - padX} ${y}`,
  stroke: "#e5e7eb",
  strokeWidth: 1,
  fill: "none"
});
y += 32;

// Paragraph 1
elements.push({
  id: "para1",
  type: "text",
  x: padX,
  y: y,
  text: "The Render API exposes a minimal surface for compiling visual documents into\noutput frames. It accepts a validated kernel document and a target time, then\nresolves all timeline interpolations and returns a flat list of positioned primitives\nready for rasterization or SVG serialization.",
  align: "left",
  valign: "top",
  fontSize: 15,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.7,
  fill: textColor,
  maxWidth: width - padX * 2
});
y += 110;

// Paragraph 2
elements.push({
  id: "para2",
  type: "text",
  x: padX,
  y: y,
  text: "Before calling the render function, ensure your document passes schema\nvalidation. Invalid documents will throw a structured error with path information\npointing to the offending node. This keeps the pipeline predictable and safe.",
  align: "left",
  valign: "top",
  fontSize: 15,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.7,
  fill: textColor,
  maxWidth: width - padX * 2
});
y += 100;

// Code block background
const codeBlockH = 172;
elements.push({
  id: "code-bg",
  type: "path",
  d: `M ${padX} ${y} L ${width - padX} ${y} L ${width - padX} ${y + codeBlockH} L ${padX} ${y + codeBlockH} Z`,
  fill: codeBg,
  stroke: codeBorder,
  strokeWidth: 1
});

// Code block text (6 lines)
elements.push({
  id: "code-text",
  type: "text",
  x: padX + 20,
  y: y + 18,
  text: `import { validateVisualDocument, resolveVisualFrame } from "sketchmark";\n\nconst doc = JSON.parse(fs.readFileSync("scene.visual.json", "utf8"));\nvalidateVisualDocument(doc);\n\nconst frame = resolveVisualFrame(doc, { time: 1.5 });\nconsole.log(frame.elements.length, "primitives resolved");`,
  align: "left",
  valign: "top",
  fontSize: 13,
  fontFamily: monoFont,
  weight: 400,
  lineHeight: 1.8,
  fill: codeText,
  maxWidth: width - padX * 2 - 40
});
y += codeBlockH + 36;

// Section heading for bullet list
elements.push({
  id: "list-heading",
  type: "text",
  x: padX,
  y: y,
  text: "Key Concepts",
  align: "left",
  valign: "top",
  fontSize: 20,
  fontFamily: font,
  weight: 600,
  fill: textColor
});
y += 36;

// Bullet list items
const bullets = [
  "Documents must declare version: 1 and a canvas with width and height.",
  "Elements are flat arrays of path, text, image, point, or group primitives.",
  "Timelines are element-local — each element owns its own tracks and keyframes.",
  "Interpolation resolves per-track using cubic bezier, graph, or hold curves.",
  "The output frame contains fully resolved properties with no remaining references."
];

bullets.forEach((text, i) => {
  const bulletY = y + i * 30;
  elements.push({
    id: `bullet-dot-${i}`,
    type: "path",
    d: `M ${padX + 4} ${bulletY + 7} A 3 3 0 1 1 ${padX + 4} ${bulletY + 7.01} Z`,
    fill: bulletColor,
    stroke: "none"
  });
  elements.push({
    id: `bullet-text-${i}`,
    type: "text",
    x: padX + 18,
    y: bulletY,
    text: text,
    align: "left",
    valign: "top",
    fontSize: 14,
    fontFamily: font,
    weight: 400,
    fill: textColor,
    maxWidth: width - padX * 2 - 18
  });
});
y += bullets.length * 30 + 40;

// Centered button
const btnW = 200;
const btnH = 44;
const btnX = (width - btnW) / 2;
const btnR = 8;
elements.push({
  id: "btn-bg",
  type: "path",
  d: `M ${btnX + btnR} ${y} L ${btnX + btnW - btnR} ${y} Q ${btnX + btnW} ${y} ${btnX + btnW} ${y + btnR} L ${btnX + btnW} ${y + btnH - btnR} Q ${btnX + btnW} ${y + btnH} ${btnX + btnW - btnR} ${y + btnH} L ${btnX + btnR} ${y + btnH} Q ${btnX} ${y + btnH} ${btnX} ${y + btnH - btnR} L ${btnX} ${y + btnR} Q ${btnX} ${y} ${btnX + btnR} ${y} Z`,
  fill: btnBg,
  stroke: "none"
});
elements.push({
  id: "btn-label",
  type: "text",
  x: width / 2,
  y: y + btnH / 2,
  text: "View Full Reference",
  align: "center",
  valign: "middle",
  fontSize: 15,
  fontFamily: font,
  weight: 600,
  fill: btnText
});
y += btnH + 36;

// Footer note
elements.push({
  id: "footer",
  type: "text",
  x: padX,
  y: y,
  text: "Last updated May 2026 · Sketchmark v1.0 · MIT License",
  align: "left",
  valign: "top",
  fontSize: 12,
  fontFamily: font,
  weight: 400,
  fill: mutedColor
});

const doc = {
  version: 1,
  canvas: { width, height, background: bg },
  elements
};

const outPath = path.join(__dirname, "dev-docs.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
