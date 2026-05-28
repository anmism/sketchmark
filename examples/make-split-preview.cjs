const fs = require("fs");
const path = require("path");

const width = 1200;
const height = 600;
const bg = "#f8fafc";
const font = "Inter, system-ui, sans-serif";
const monoFont = "JetBrains Mono, Fira Code, monospace";

const colors = {
  codeBg: "#1e293b",
  codeText: "#e2e8f0",
  codeKeyword: "#7dd3fc",
  codeString: "#86efac",
  codeNumber: "#fcd34d",
  previewBg: "#ffffff",
  previewBorder: "#e2e8f0",
  previewTitle: "#0f172a",
  previewCaption: "#64748b",
  badgeBg: "#8b5cf6",
  badgeText: "#ffffff",
  sectionLabel: "#64748b"
};

const padX = 48;
const padY = 48;
const gapX = 40;
const colW = (width - padX * 2 - gapX) / 2;

const elements = [];

// === LEFT SIDE: Code block ===

const codeX = padX;
const codeY = padY;
const codeW = colW;
const codeH = height - padY * 2;
const codeR = 12;
const codePad = 24;

// Code block background
elements.push({
  id: "code-bg",
  type: "path",
  d: roundedRect(codeX, codeY, codeW, codeH, codeR),
  fill: colors.codeBg,
  stroke: "none"
});

// Section label above code
elements.push({
  id: "code-label",
  type: "text",
  x: codeX + codePad,
  y: codeY + 20,
  text: "document.visual.json",
  align: "left",
  valign: "top",
  fontSize: 11,
  fontFamily: monoFont,
  weight: 500,
  fill: colors.sectionLabel
});

// JSON code content
const jsonCode = `{
  "version": 1,
  "canvas": {
    "width": 400,
    "height": 300,
    "background": "#ffffff"
  },
  "elements": [
    {
      "id": "card",
      "type": "path",
      "d": "M 20 20 L 380 20 ...",
      "fill": "#f1f5f9",
      "stroke": "#e2e8f0"
    },
    {
      "id": "title",
      "type": "text",
      "x": 40,
      "y": 60,
      "text": "Welcome",
      "fontSize": 24,
      "weight": 700
    }
  ]
}`;

elements.push({
  id: "code-text",
  type: "text",
  x: codeX + codePad,
  y: codeY + 48,
  text: jsonCode,
  align: "left",
  valign: "top",
  fontSize: 12,
  fontFamily: monoFont,
  weight: 400,
  lineHeight: 1.5,
  fill: colors.codeText,
  maxWidth: codeW - codePad * 2
});

// === RIGHT SIDE: Preview ===

const previewX = padX + colW + gapX;
const previewY = padY;
const previewW = colW;
const previewH = height - padY * 2;

// Centered "Rendered output" badge above preview card
const badgeW = 130;
const badgeH = 26;
const badgeX = previewX + (previewW - badgeW) / 2;
const badgeY = previewY;
const badgeR = 13;

elements.push({
  id: "badge-bg",
  type: "path",
  d: roundedRect(badgeX, badgeY, badgeW, badgeH, badgeR),
  fill: colors.badgeBg,
  stroke: "none"
});

elements.push({
  id: "badge-text",
  type: "text",
  x: badgeX + badgeW / 2,
  y: badgeY + badgeH / 2,
  text: "Rendered output",
  align: "center",
  valign: "middle",
  fontSize: 11,
  fontFamily: font,
  weight: 600,
  fill: colors.badgeText
});

// Preview container
const cardY = badgeY + badgeH + 20;
const cardH = previewH - badgeH - 20;
const cardR = 12;
const cardPad = 32;

elements.push({
  id: "preview-bg",
  type: "path",
  d: roundedRect(previewX, cardY, previewW, cardH, cardR),
  fill: colors.previewBg,
  stroke: colors.previewBorder,
  strokeWidth: 1
});

// Inner rendered card (the visual output)
const innerCardX = previewX + cardPad;
const innerCardY = cardY + cardPad;
const innerCardW = previewW - cardPad * 2;
const innerCardH = 200;
const innerCardR = 8;

elements.push({
  id: "inner-card-bg",
  type: "path",
  d: roundedRect(innerCardX, innerCardY, innerCardW, innerCardH, innerCardR),
  fill: "#f1f5f9",
  stroke: "#e2e8f0",
  strokeWidth: 1
});

// Inner card title (the "Welcome" from the JSON)
elements.push({
  id: "inner-card-title",
  type: "text",
  x: innerCardX + 24,
  y: innerCardY + 32,
  text: "Welcome",
  align: "left",
  valign: "top",
  fontSize: 24,
  fontFamily: font,
  weight: 700,
  fill: colors.previewTitle
});

// Inner card body text
elements.push({
  id: "inner-card-body",
  type: "text",
  x: innerCardX + 24,
  y: innerCardY + 72,
  text: "This card was rendered from the JSON\ndefinition on the left. The kernel resolves\nall elements into positioned primitives.",
  align: "left",
  valign: "top",
  fontSize: 13,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.55,
  fill: colors.previewCaption,
  maxWidth: innerCardW - 48
});

// Preview caption below the inner card
elements.push({
  id: "preview-caption",
  type: "text",
  x: previewX + cardPad,
  y: innerCardY + innerCardH + 28,
  text: "Live preview updates as the document changes.\nNo build step required — just edit and see.",
  align: "left",
  valign: "top",
  fontSize: 13,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.55,
  fill: colors.previewCaption,
  maxWidth: previewW - cardPad * 2
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

const outPath = path.join(__dirname, "split-preview.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
