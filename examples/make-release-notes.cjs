const fs = require("fs");
const path = require("path");

const width = 1080;
const height = 1380;
const bg = "#ffffff";
const font = "Inter, system-ui, sans-serif";

const colors = {
  title: "#0f172a",
  date: "#94a3b8",
  heading: "#1e293b",
  subheading: "#334155",
  body: "#475569",
  bullet: "#2563eb",
  divider: "#e2e8f0",
  pillBg: "#10b981",
  pillText: "#ffffff"
};

const padX = 72;
const contentW = width - padX * 2;
let y = 56;

const elements = [];

// Large title
elements.push({
  id: "title",
  type: "text",
  x: padX,
  y: y,
  text: "Release Notes",
  align: "left",
  valign: "top",
  fontSize: 44,
  fontFamily: font,
  weight: 800,
  fill: colors.title
});
y += 60;

// Version + date line
elements.push({
  id: "version",
  type: "text",
  x: padX,
  y: y,
  text: "v2.4.0",
  align: "left",
  valign: "top",
  fontSize: 18,
  fontFamily: font,
  weight: 600,
  fill: colors.heading
});

elements.push({
  id: "date",
  type: "text",
  x: padX + 72,
  y: y + 2,
  text: "— May 27, 2026",
  align: "left",
  valign: "top",
  fontSize: 15,
  fontFamily: font,
  weight: 400,
  fill: colors.date
});
y += 36;

// Divider
elements.push({
  id: "divider-top",
  type: "path",
  d: `M ${padX} ${y} L ${width - padX} ${y}`,
  stroke: colors.divider,
  strokeWidth: 1,
  fill: "none"
});
y += 40;

// --- Section 1: New Features ---
elements.push({
  id: "s1-heading",
  type: "text",
  x: padX,
  y: y,
  text: "New Features",
  align: "left",
  valign: "top",
  fontSize: 24,
  fontFamily: font,
  weight: 700,
  fill: colors.heading
});

// "New" pill badge next to heading
const pillW = 52;
const pillH = 22;
const pillX = padX + 168;
const pillY = y + 3;
const pillR = 11;
elements.push({
  id: "new-pill-bg",
  type: "path",
  d: roundedRect(pillX, pillY, pillW, pillH, pillR),
  fill: colors.pillBg,
  stroke: "none"
});
elements.push({
  id: "new-pill-text",
  type: "text",
  x: pillX + pillW / 2,
  y: pillY + pillH / 2,
  text: "New",
  align: "center",
  valign: "middle",
  fontSize: 11,
  fontFamily: font,
  weight: 700,
  fill: colors.pillText
});
y += 42;

// Subsection 1a
elements.push({
  id: "s1a-sub",
  type: "text",
  x: padX,
  y: y,
  text: "Real-time Collaboration",
  align: "left",
  valign: "top",
  fontSize: 16,
  fontFamily: font,
  weight: 600,
  fill: colors.subheading
});
y += 28;

const s1aBullets = [
  "Multiple users can now edit the same document simultaneously\nwith live cursor presence and conflict-free merging.",
  "Inline comments and threads are synced in real time across\nall connected sessions without page reload.",
  "Permission scopes support viewer, commenter, and editor\nroles with granular per-section access control."
];
y = renderBullets(s1aBullets, "s1a", y);
y += 16;

// Subsection 1b
elements.push({
  id: "s1b-sub",
  type: "text",
  x: padX,
  y: y,
  text: "Export Pipeline",
  align: "left",
  valign: "top",
  fontSize: 16,
  fontFamily: font,
  weight: 600,
  fill: colors.subheading
});
y += 28;

const s1bBullets = [
  "Added PDF and DOCX export targets with full styling\npreservation and embedded font support.",
  "Batch export now runs in parallel workers, reducing\nprocessing time by up to 4x on large document sets."
];
y = renderBullets(s1bBullets, "s1b", y);
y += 32;

// --- Section 2: Improvements ---
elements.push({
  id: "s2-heading",
  type: "text",
  x: padX,
  y: y,
  text: "Improvements",
  align: "left",
  valign: "top",
  fontSize: 24,
  fontFamily: font,
  weight: 700,
  fill: colors.heading
});
y += 42;

// Subsection 2a
elements.push({
  id: "s2a-sub",
  type: "text",
  x: padX,
  y: y,
  text: "Performance",
  align: "left",
  valign: "top",
  fontSize: 16,
  fontFamily: font,
  weight: 600,
  fill: colors.subheading
});
y += 28;

const s2aBullets = [
  "Timeline resolution is now 3x faster due to a rewritten\ninterpolation engine with pre-compiled curve LUTs.",
  "Initial document load time reduced by 40% through\nlazy hydration of off-screen element groups.",
  "Memory usage during preview reduced by caching\nresolved frames and evicting stale entries on scroll."
];
y = renderBullets(s2aBullets, "s2a", y);
y += 16;

// Subsection 2b
elements.push({
  id: "s2b-sub",
  type: "text",
  x: padX,
  y: y,
  text: "Editor UX",
  align: "left",
  valign: "top",
  fontSize: 16,
  fontFamily: font,
  weight: 600,
  fill: colors.subheading
});
y += 28;

const s2bBullets = [
  "Undo history now groups rapid sequential edits into\nsingle entries for cleaner rollback behavior.",
  "Keyboard shortcuts panel redesigned with searchable\ncategories and conflict detection warnings."
];
y = renderBullets(s2bBullets, "s2b", y);
y += 32;

// --- Section 3: Bug Fixes ---
elements.push({
  id: "s3-heading",
  type: "text",
  x: padX,
  y: y,
  text: "Bug Fixes",
  align: "left",
  valign: "top",
  fontSize: 24,
  fontFamily: font,
  weight: 700,
  fill: colors.heading
});
y += 42;

// Subsection 3a
elements.push({
  id: "s3a-sub",
  type: "text",
  x: padX,
  y: y,
  text: "Rendering",
  align: "left",
  valign: "top",
  fontSize: 16,
  fontFamily: font,
  weight: 600,
  fill: colors.subheading
});
y += 28;

const s3aBullets = [
  "Fixed incorrect gradient interpolation when stop offsets\nwere defined in descending order.",
  "Resolved clipping mask artifacts on group elements\nwith non-zero rotation and nested transforms.",
  "Text elements with empty strings no longer produce\ninvalid SVG output during frame resolution."
];
y = renderBullets(s3aBullets, "s3a", y);

function renderBullets(items, prefix, startY) {
  let cy = startY;
  items.forEach((text, i) => {
    // Bullet dot
    elements.push({
      id: `${prefix}-dot-${i}`,
      type: "path",
      d: `M ${padX + 6} ${cy + 8} A 3.5 3.5 0 1 1 ${padX + 6} ${cy + 8.01} Z`,
      fill: colors.bullet,
      stroke: "none"
    });

    elements.push({
      id: `${prefix}-text-${i}`,
      type: "text",
      x: padX + 20,
      y: cy,
      text: text,
      align: "left",
      valign: "top",
      fontSize: 14,
      fontFamily: font,
      weight: 400,
      lineHeight: 1.65,
      fill: colors.body,
      maxWidth: contentW - 20
    });

    const lineCount = text.split("\n").length;
    cy += lineCount * 23 + 14;
  });
  return cy;
}

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

const outPath = path.join(__dirname, "release-notes.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
