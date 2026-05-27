const fs = require("fs");
const path = require("path");

const width = 1440;
const height = 900;
const bg = "#f1f5f9";
const font = "Inter, system-ui, sans-serif";

const sidebarW = 240;
const sidebarBg = "#1e293b";
const mainX = sidebarW;
const mainW = width - sidebarW;
const mainPad = 40;

const colors = {
  sidebarBg: "#1e293b",
  sidebarSection: "#94a3b8",
  sidebarLabel: "#e2e8f0",
  sidebarLabelMuted: "#94a3b8",
  sidebarActive: "#2563eb",
  sidebarActiveBg: "#334155",
  mainTitle: "#0f172a",
  mainBody: "#475569",
  caption: "#64748b",
  cardBg: "#ffffff",
  cardBorder: "#e2e8f0",
  cardTitle: "#1e293b",
  cardBody: "#64748b",
  cardMeta: "#94a3b8",
  chipBg: "#ffffff",
  chipBorder: "#cbd5e1",
  chipText: "#334155",
  chipActiveBg: "#2563eb",
  chipActiveText: "#ffffff",
  divider: "#334155"
};

const elements = [];

// === Sidebar background ===
elements.push({
  id: "sidebar-bg",
  type: "path",
  d: `M 0 0 L ${sidebarW} 0 L ${sidebarW} ${height} L 0 ${height} Z`,
  fill: colors.sidebarBg,
  stroke: "none"
});

// Sidebar logo / app name
elements.push({
  id: "sidebar-logo",
  type: "text",
  x: 24,
  y: 24,
  text: "Acme Studio",
  align: "left",
  valign: "top",
  fontSize: 16,
  fontFamily: font,
  weight: 700,
  fill: colors.sidebarLabel
});

let sy = 72;

// --- Sidebar Section: Workspace ---
sy = sidebarSection("ws", "WORKSPACE", sy, [
  { id: "nav-dashboard", label: "Dashboard", active: false },
  { id: "nav-projects", label: "Projects", active: true },
  { id: "nav-tasks", label: "Tasks", active: false },
  { id: "nav-calendar", label: "Calendar", active: false }
]);

sy += 24;

// --- Sidebar Section: Analytics ---
sy = sidebarSection("an", "ANALYTICS", sy, [
  { id: "nav-overview", label: "Overview", active: false },
  { id: "nav-reports", label: "Reports", active: false },
  { id: "nav-exports", label: "Exports", active: false }
]);

sy += 24;

// --- Sidebar Section: Settings ---
sy = sidebarSection("st", "SETTINGS", sy, [
  { id: "nav-general", label: "General", active: false },
  { id: "nav-team", label: "Team Members", active: false },
  { id: "nav-billing", label: "Billing", active: false },
  { id: "nav-integrations", label: "Integrations", active: false }
]);

// === Main content area ===
let my = 32;
const mx = mainX + mainPad;
const mw = mainW - mainPad * 2;

// Main title
elements.push({
  id: "main-title",
  type: "text",
  x: mx,
  y: my,
  text: "Projects",
  align: "left",
  valign: "top",
  fontSize: 28,
  fontFamily: font,
  weight: 700,
  fill: colors.mainTitle
});
my += 40;

// Summary paragraph
elements.push({
  id: "main-summary",
  type: "text",
  x: mx,
  y: my,
  text: "Track active projects across your workspace. Filter by status or team to narrow\nresults. Each card shows the latest activity snapshot and assigned owner.",
  align: "left",
  valign: "top",
  fontSize: 14,
  fontFamily: font,
  weight: 400,
  lineHeight: 1.6,
  fill: colors.mainBody,
  maxWidth: mw
});
my += 52;

// Filter chips row (centered text in each chip)
const chips = [
  { label: "All", active: true },
  { label: "Active", active: false },
  { label: "Archived", active: false },
  { label: "My Team", active: false }
];

let chipX = mx;
const chipH = 30;
const chipR = 15;
const chipPadX = 16;
const chipGap = 10;

chips.forEach((chip, i) => {
  const charW = chip.label.length * 7.5 + chipPadX * 2;
  elements.push({
    id: `chip-bg-${i}`,
    type: "path",
    d: roundedRect(chipX, my, charW, chipH, chipR),
    fill: chip.active ? colors.chipActiveBg : colors.chipBg,
    stroke: chip.active ? "none" : colors.chipBorder,
    strokeWidth: chip.active ? 0 : 1
  });
  elements.push({
    id: `chip-text-${i}`,
    type: "text",
    x: chipX + charW / 2,
    y: my + chipH / 2,
    text: chip.label,
    align: "center",
    valign: "middle",
    fontSize: 13,
    fontFamily: font,
    weight: 500,
    fill: chip.active ? colors.chipActiveText : colors.chipText
  });
  chipX += charW + chipGap;
});
my += chipH + 28;

// Table caption
elements.push({
  id: "table-caption",
  type: "text",
  x: mx,
  y: my,
  text: "Showing 3 of 12 projects · Sorted by last activity",
  align: "left",
  valign: "top",
  fontSize: 12,
  fontFamily: font,
  weight: 400,
  fill: colors.caption
});
my += 28;

// === Content cards ===
const cards = [
  {
    id: "card-a",
    title: "Design System v3",
    body: "Component library refactor with updated tokens, accessibility\nimprovements, and new layout primitives for dashboard views.",
    meta: "Updated 2 hours ago · Sarah K."
  },
  {
    id: "card-b",
    title: "API Gateway Migration",
    body: "Moving from the legacy REST proxy to a new GraphQL federation\nlayer with per-service schema ownership and rate limiting.",
    meta: "Updated 1 day ago · Marcus T."
  },
  {
    id: "card-c",
    title: "Onboarding Flow Redesign",
    body: "Streamlining the first-run experience with progressive disclosure,\nreduced form fields, and contextual help tooltips.",
    meta: "Updated 3 days ago · Priya N."
  }
];

const cardPad = 20;
const cardGap = 16;
const cardW = mw;
const cardH = 120;

cards.forEach((card, i) => {
  const cy = my + i * (cardH + cardGap);

  // Card background
  elements.push({
    id: `${card.id}-bg`,
    type: "path",
    d: roundedRect(mx, cy, cardW, cardH, 8),
    fill: colors.cardBg,
    stroke: colors.cardBorder,
    strokeWidth: 1
  });

  // Card title
  elements.push({
    id: `${card.id}-title`,
    type: "text",
    x: mx + cardPad,
    y: cy + 16,
    text: card.title,
    align: "left",
    valign: "top",
    fontSize: 16,
    fontFamily: font,
    weight: 600,
    fill: colors.cardTitle
  });

  // Card body
  elements.push({
    id: `${card.id}-body`,
    type: "text",
    x: mx + cardPad,
    y: cy + 42,
    text: card.body,
    align: "left",
    valign: "top",
    fontSize: 13,
    fontFamily: font,
    weight: 400,
    lineHeight: 1.55,
    fill: colors.cardBody,
    maxWidth: cardW - cardPad * 2
  });

  // Card meta
  elements.push({
    id: `${card.id}-meta`,
    type: "text",
    x: mx + cardPad,
    y: cy + cardH - 22,
    text: card.meta,
    align: "left",
    valign: "top",
    fontSize: 11,
    fontFamily: font,
    weight: 400,
    fill: colors.cardMeta
  });
});

// --- Sidebar helpers ---

function sidebarSection(prefix, title, startY, items) {
  let cy = startY;

  // Section heading
  elements.push({
    id: `${prefix}-heading`,
    type: "text",
    x: 24,
    y: cy,
    text: title,
    align: "left",
    valign: "top",
    fontSize: 10,
    fontFamily: font,
    weight: 600,
    letterSpacing: 1,
    fill: colors.sidebarSection
  });
  cy += 24;

  items.forEach((item) => {
    // Active highlight bg
    if (item.active) {
      elements.push({
        id: `${item.id}-active-bg`,
        type: "path",
        d: roundedRect(12, cy - 4, sidebarW - 24, 30, 6),
        fill: colors.sidebarActiveBg,
        stroke: "none"
      });
    }

    // Nav label
    elements.push({
      id: item.id,
      type: "text",
      x: 24,
      y: cy,
      text: item.label,
      align: "left",
      valign: "top",
      fontSize: 13,
      fontFamily: font,
      weight: item.active ? 500 : 400,
      fill: item.active ? colors.sidebarLabel : colors.sidebarLabelMuted
    });

    // Active indicator bar
    if (item.active) {
      elements.push({
        id: `${item.id}-indicator`,
        type: "path",
        d: `M 4 ${cy} L 4 ${cy + 18}`,
        stroke: colors.sidebarActive,
        strokeWidth: 3,
        strokeCap: "round",
        fill: "none"
      });
    }

    cy += 34;
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

const outPath = path.join(__dirname, "app-screen.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
