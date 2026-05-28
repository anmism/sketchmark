const fs = require("fs");
const path = require("path");

const width = 1100;
const height = 720;
const bg = "#f1f5f9";
const font = "Inter, system-ui, sans-serif";

const colors = {
  pageTitle: "#0f172a",
  pageSubtitle: "#64748b",
  panelBg: "#ffffff",
  panelBorder: "#e2e8f0",
  panelNumber: "#cbd5e1",
  panelTitle: "#1e293b",
  panelCaption: "#475569",
  tagBg: "#0f172a",
  tagText: "#ffffff"
};

const padX = 48;
const padY = 40;
let y = padY;

const elements = [];

// Page title
elements.push({
  id: "page-title",
  type: "text",
  x: padX,
  y: y,
  text: "Product Launch Storyboard",
  align: "left",
  valign: "top",
  fontSize: 28,
  fontFamily: font,
  weight: 700,
  fill: colors.pageTitle
});
y += 38;

elements.push({
  id: "page-subtitle",
  type: "text",
  x: padX,
  y: y,
  text: "Four key moments in the announcement video sequence.",
  align: "left",
  valign: "top",
  fontSize: 14,
  fontFamily: font,
  weight: 400,
  fill: colors.pageSubtitle
});
y += 44;

// Panel grid (2x2)
const panelGap = 24;
const gridW = width - padX * 2;
const panelW = (gridW - panelGap) / 2;
const panelH = 260;
const panelR = 10;
const panelPad = 20;

const panels = [
  {
    id: "panel-1",
    number: "01",
    tag: "Intro",
    title: "Brand Logo Reveal",
    caption: "Open on a dark screen. The logo fades in from\nthe center with a subtle glow effect. Hold for\ntwo seconds to establish brand presence."
  },
  {
    id: "panel-2",
    number: "02",
    tag: "Action",
    title: "Feature Demonstration",
    caption: "Quick cuts showing the product in use. Focus\non three key interactions: search, create, and\nshare. Each clip lasts 1.5 seconds."
  },
  {
    id: "panel-3",
    number: "03",
    tag: "Pause",
    title: "Customer Testimonial",
    caption: "A single customer speaks directly to camera.\nKeep framing tight on their face. Let the quote\nbreathe with natural pauses for emphasis."
  },
  {
    id: "panel-4",
    number: "04",
    tag: "End",
    title: "Call to Action",
    caption: "Product name and tagline animate in from\nthe left. URL and QR code appear below.\nEnd with logo lockup in the corner."
  }
];

panels.forEach((panel, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const px = padX + col * (panelW + panelGap);
  const py = y + row * (panelH + panelGap);

  // Panel background
  elements.push({
    id: `${panel.id}-bg`,
    type: "path",
    d: roundedRect(px, py, panelW, panelH, panelR),
    fill: colors.panelBg,
    stroke: colors.panelBorder,
    strokeWidth: 1
  });

  // Panel number (top-left, large muted)
  elements.push({
    id: `${panel.id}-number`,
    type: "text",
    x: px + panelPad,
    y: py + panelPad,
    text: panel.number,
    align: "left",
    valign: "top",
    fontSize: 32,
    fontFamily: font,
    weight: 700,
    fill: colors.panelNumber
  });

  // Tag pill (top-right, centered text)
  const tagW = panel.tag.length * 9 + 24;
  const tagH = 26;
  const tagX = px + panelW - panelPad - tagW;
  const tagY = py + panelPad;
  const tagR = 13;

  elements.push({
    id: `${panel.id}-tag-bg`,
    type: "path",
    d: roundedRect(tagX, tagY, tagW, tagH, tagR),
    fill: colors.tagBg,
    stroke: "none"
  });

  elements.push({
    id: `${panel.id}-tag-text`,
    type: "text",
    x: tagX + tagW / 2,
    y: tagY + tagH / 2,
    text: panel.tag,
    align: "center",
    valign: "middle",
    fontSize: 11,
    fontFamily: font,
    weight: 600,
    fill: colors.tagText
  });

  // Panel title (left-aligned)
  const titleY = py + panelPad + 52;
  elements.push({
    id: `${panel.id}-title`,
    type: "text",
    x: px + panelPad,
    y: titleY,
    text: panel.title,
    align: "left",
    valign: "top",
    fontSize: 18,
    fontFamily: font,
    weight: 600,
    fill: colors.panelTitle
  });

  // Panel caption (left-aligned, multiline)
  const captionY = titleY + 32;
  elements.push({
    id: `${panel.id}-caption`,
    type: "text",
    x: px + panelPad,
    y: captionY,
    text: panel.caption,
    align: "left",
    valign: "top",
    fontSize: 13,
    fontFamily: font,
    weight: 400,
    lineHeight: 1.6,
    fill: colors.panelCaption,
    maxWidth: panelW - panelPad * 2
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

const outPath = path.join(__dirname, "storyboard.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
