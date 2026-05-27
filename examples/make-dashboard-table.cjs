const fs = require("fs");
const path = require("path");

const width = 1100;
const height = 560;
const bg = "#f8fafc";
const font = "Inter, system-ui, sans-serif";

const colors = {
  pageTitle: "#0f172a",
  tableTitle: "#1e293b",
  headerBg: "#f1f5f9",
  headerText: "#475569",
  rowBg: "#ffffff",
  rowAltBg: "#fafbfc",
  rowBorder: "#e2e8f0",
  cellText: "#334155",
  cellMuted: "#64748b",
  tableBorder: "#e2e8f0",
  statusGreen: "#10b981",
  statusGreenBg: "#d1fae5",
  statusYellow: "#d97706",
  statusYellowBg: "#fef3c7",
  statusRed: "#dc2626",
  statusRedBg: "#fee2e2",
  statusGray: "#64748b",
  statusGrayBg: "#f1f5f9"
};

const padX = 48;
let y = 40;

const elements = [];

// Page title
elements.push({
  id: "page-title",
  type: "text",
  x: padX,
  y: y,
  text: "Operations Dashboard",
  align: "left",
  valign: "top",
  fontSize: 26,
  fontFamily: font,
  weight: 700,
  fill: colors.pageTitle
});
y += 44;

// Table title
elements.push({
  id: "table-title",
  type: "text",
  x: padX,
  y: y,
  text: "Service Health Overview",
  align: "left",
  valign: "top",
  fontSize: 16,
  fontFamily: font,
  weight: 600,
  fill: colors.tableTitle
});
y += 32;

// Table structure
const tableX = padX;
const tableW = width - padX * 2;
const rowH = 44;
const headerH = 40;

const columns = [
  { key: "service", label: "Service", width: 200, align: "left" },
  { key: "requests", label: "Requests", width: 120, align: "right" },
  { key: "latency", label: "Avg Latency", width: 120, align: "right" },
  { key: "errors", label: "Error Rate", width: 110, align: "right" },
  { key: "uptime", label: "Uptime", width: 100, align: "right" },
  { key: "status", label: "Status", width: 110, align: "center" }
];

const rows = [
  { service: "API Gateway", requests: "1.2M", latency: "42ms", errors: "0.02%", uptime: "99.99%", status: "Healthy" },
  { service: "Auth Service", requests: "890K", latency: "28ms", errors: "0.01%", uptime: "99.98%", status: "Healthy" },
  { service: "User Database", requests: "2.4M", latency: "8ms", errors: "0.00%", uptime: "100%", status: "Healthy" },
  { service: "Cache Layer", requests: "5.1M", latency: "2ms", errors: "0.03%", uptime: "99.95%", status: "Degraded" },
  { service: "Search Index", requests: "340K", latency: "156ms", errors: "1.20%", uptime: "98.50%", status: "Warning" },
  { service: "Legacy Sync", requests: "45K", latency: "890ms", errors: "4.50%", uptime: "94.20%", status: "Critical" }
];

const statusColors = {
  Healthy: { bg: colors.statusGreenBg, text: colors.statusGreen },
  Degraded: { bg: colors.statusYellowBg, text: colors.statusYellow },
  Warning: { bg: colors.statusYellowBg, text: colors.statusYellow },
  Critical: { bg: colors.statusRedBg, text: colors.statusRed },
  Offline: { bg: colors.statusGrayBg, text: colors.statusGray }
};

// Table outer border
const tableH = headerH + rows.length * rowH;
elements.push({
  id: "table-border",
  type: "path",
  d: roundedRect(tableX, y, tableW, tableH, 8),
  fill: colors.rowBg,
  stroke: colors.tableBorder,
  strokeWidth: 1
});

// Header row background
elements.push({
  id: "header-bg",
  type: "path",
  d: `M ${tableX + 8} ${y} L ${tableX + tableW - 8} ${y} Q ${tableX + tableW} ${y} ${tableX + tableW} ${y + 8} L ${tableX + tableW} ${y + headerH} L ${tableX} ${y + headerH} L ${tableX} ${y + 8} Q ${tableX} ${y} ${tableX + 8} ${y} Z`,
  fill: colors.headerBg,
  stroke: "none"
});

// Header row bottom border
elements.push({
  id: "header-border",
  type: "path",
  d: `M ${tableX} ${y + headerH} L ${tableX + tableW} ${y + headerH}`,
  stroke: colors.rowBorder,
  strokeWidth: 1,
  fill: "none"
});

// Column headers
let colX = tableX;
columns.forEach((col, i) => {
  const textX = col.align === "left" ? colX + 16 :
                col.align === "right" ? colX + col.width - 16 :
                colX + col.width / 2;

  elements.push({
    id: `header-${col.key}`,
    type: "text",
    x: textX,
    y: y + headerH / 2,
    text: col.label,
    align: col.align,
    valign: "middle",
    fontSize: 12,
    fontFamily: font,
    weight: 600,
    fill: colors.headerText
  });

  colX += col.width;
});

// Data rows
rows.forEach((row, ri) => {
  const rowY = y + headerH + ri * rowH;

  // Alternating row background
  if (ri % 2 === 1) {
    elements.push({
      id: `row-bg-${ri}`,
      type: "path",
      d: `M ${tableX} ${rowY} L ${tableX + tableW} ${rowY} L ${tableX + tableW} ${rowY + rowH} L ${tableX} ${rowY + rowH} Z`,
      fill: colors.rowAltBg,
      stroke: "none"
    });
  }

  // Row border (except last)
  if (ri < rows.length - 1) {
    elements.push({
      id: `row-border-${ri}`,
      type: "path",
      d: `M ${tableX + 16} ${rowY + rowH} L ${tableX + tableW - 16} ${rowY + rowH}`,
      stroke: colors.rowBorder,
      strokeWidth: 1,
      fill: "none"
    });
  }

  // Cell values
  let cx = tableX;
  columns.forEach((col) => {
    const value = row[col.key];
    const textX = col.align === "left" ? cx + 16 :
                  col.align === "right" ? cx + col.width - 16 :
                  cx + col.width / 2;

    if (col.key === "status") {
      // Status chip
      const chipW = 72;
      const chipH = 24;
      const chipX = cx + (col.width - chipW) / 2;
      const chipY = rowY + (rowH - chipH) / 2;
      const chipR = 12;
      const sc = statusColors[value] || statusColors.Offline;

      elements.push({
        id: `cell-${ri}-${col.key}-bg`,
        type: "path",
        d: roundedRect(chipX, chipY, chipW, chipH, chipR),
        fill: sc.bg,
        stroke: "none"
      });

      elements.push({
        id: `cell-${ri}-${col.key}-text`,
        type: "text",
        x: chipX + chipW / 2,
        y: chipY + chipH / 2,
        text: value,
        align: "center",
        valign: "middle",
        fontSize: 11,
        fontFamily: font,
        weight: 600,
        fill: sc.text
      });
    } else if (col.key === "service") {
      // Service name (row label)
      elements.push({
        id: `cell-${ri}-${col.key}`,
        type: "text",
        x: textX,
        y: rowY + rowH / 2,
        text: value,
        align: col.align,
        valign: "middle",
        fontSize: 13,
        fontFamily: font,
        weight: 500,
        fill: colors.cellText
      });
    } else {
      // Numeric values
      elements.push({
        id: `cell-${ri}-${col.key}`,
        type: "text",
        x: textX,
        y: rowY + rowH / 2,
        text: value,
        align: col.align,
        valign: "middle",
        fontSize: 13,
        fontFamily: font,
        weight: 400,
        fill: colors.cellMuted
      });
    }

    cx += col.width;
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

const outPath = path.join(__dirname, "dashboard-table.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
