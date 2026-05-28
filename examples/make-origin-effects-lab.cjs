const fs = require("node:fs");
const path = require("node:path");

const width = 1280;
const height = 760;
const duration = 6;
const fps = 30;
const bg = "#07111f";
const font = "Roboto, Arial, sans-serif";

const colors = {
  panel: "#0d1a2e",
  panelStroke: "#193252",
  title: "#f8fafc",
  body: "#94a3b8",
  marker: "#fde047",
  markerStroke: "#0f172a",
  grid: "#173054",
  rowLabel: "#7dd3fc",
  fills: ["#818cf8", "#38bdf8", "#22c55e", "#f59e0b"]
};

const curves = {
  ease: { type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  easeOut: { type: "cubicBezier", x1: 0, y1: 0, x2: 0.2, y2: 1 }
};

const rectW = 160;
const rectH = 100;
const cellW = 270;
const cellH = 240;
const gridX = 70;
const gridGap = 25;
const scaleRowY = 150;
const rotateRowY = 435;
const shapeOffsetX = 58;
const shapeOffsetY = 98;
const rectShape = roundedRect(0, 0, rectW, rectH, 18);

const originVariants = [
  { key: "top_left", title: "Top-left origin", note: "[0, 0]", local: [0, 0] },
  { key: "center", title: "Center origin", note: "[80, 50]", local: [rectW / 2, rectH / 2] },
  { key: "bottom_right", title: "Bottom-right origin", note: "[160, 100]", local: [rectW, rectH] },
  { key: "outside_right", title: "Outside-right origin", note: "[200, 50]", local: [rectW + 40, rectH / 2] }
];

const elements = [];

elements.push({
  id: "lab_title",
  type: "text",
  x: 70,
  y: 52,
  text: "Origin Transform Lab",
  fontSize: 38,
  fontFamily: font,
  weight: 700,
  fill: colors.title
});

elements.push({
  id: "lab_body",
  type: "text",
  x: 70,
  y: 96,
  text: "Same rounded rectangle, animated as a group. Only the origin changes.",
  fontSize: 16,
  fontFamily: font,
  weight: 400,
  fill: colors.body
});

elements.push({
  id: "scale_row_label",
  type: "text",
  x: 70,
  y: scaleRowY - 38,
  text: "Scale tests",
  fontSize: 18,
  fontFamily: font,
  weight: 700,
  fill: colors.rowLabel
});

elements.push({
  id: "rotate_row_label",
  type: "text",
  x: 70,
  y: rotateRowY - 38,
  text: "Rotation tests",
  fontSize: 18,
  fontFamily: font,
  weight: 700,
  fill: colors.rowLabel
});

originVariants.forEach((variant, index) => {
  const cellX = gridX + index * (cellW + gridGap);
  const fill = colors.fills[index % colors.fills.length];
  addPanel(cellX, scaleRowY, `scale_${variant.key}`, variant.title, variant.note);
  addScaleDemo(cellX, scaleRowY, variant, fill);
  addPanel(cellX, rotateRowY, `rotate_${variant.key}`, variant.title, variant.note);
  addRotateDemo(cellX, rotateRowY, variant, fill);
});

const doc = {
  version: 1,
  canvas: { width, height, background: bg, duration, fps },
  elements
};

const outPath = path.join(__dirname, "origin-effects-lab.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);

function addPanel(x, y, id, title, note) {
  elements.push({
    id: `${id}_panel`,
    type: "path",
    d: roundedRect(x, y, cellW, cellH, 22),
    fill: colors.panel,
    stroke: colors.panelStroke,
    strokeWidth: 1.5
  });

  elements.push({
    id: `${id}_title`,
    type: "text",
    x: x + 20,
    y: y + 18,
    text: title,
    fontSize: 16,
    fontFamily: font,
    weight: 700,
    fill: colors.title
  });

  elements.push({
    id: `${id}_note`,
    type: "text",
    x: x + 20,
    y: y + 42,
    text: note,
    fontSize: 12,
    fontFamily: font,
    weight: 500,
    fill: colors.body
  });

  elements.push({
    id: `${id}_guide_h`,
    type: "path",
    d: `M ${x + 20} ${y + shapeOffsetY + rectH / 2} L ${x + cellW - 20} ${y + shapeOffsetY + rectH / 2}`,
    fill: "none",
    stroke: colors.grid,
    strokeWidth: 1,
    dashArray: [6, 6]
  });

  elements.push({
    id: `${id}_guide_v`,
    type: "path",
    d: `M ${x + shapeOffsetX + rectW / 2} ${y + 68} L ${x + shapeOffsetX + rectW / 2} ${y + cellH - 20}`,
    fill: "none",
    stroke: colors.grid,
    strokeWidth: 1,
    dashArray: [6, 6]
  });
}

function addScaleDemo(cellX, cellY, variant, fill) {
  const groupX = cellX + shapeOffsetX;
  const groupY = cellY + shapeOffsetY;
  const originAbs = absoluteOrigin(groupX, groupY, variant.local);

  elements.push(originMarker(`scale_${variant.key}_origin`, originAbs[0], originAbs[1]));

  elements.push({
    id: `scale_${variant.key}_group`,
    type: "group",
    x: groupX,
    y: groupY,
    width: rectW,
    height: rectH,
    origin: originAbs,
    children: [
      {
        id: `scale_${variant.key}_rect`,
        type: "path",
        d: rectShape,
        fill,
        stroke: "#dbeafe",
        strokeWidth: 2
      }
    ],
    timeline: {
      tracks: {
        scale: {
          keyframes: [
            { time: 0, value: 1, out: curves.easeOut },
            { time: 1.3, value: 1.45, out: curves.ease },
            { time: 2.6, value: 0.72, out: curves.ease },
            { time: 4, value: 1.18, out: curves.ease },
            { time: 5.4, value: 1 }
          ]
        }
      }
    }
  });
}

function addRotateDemo(cellX, cellY, variant, fill) {
  const groupX = cellX + shapeOffsetX;
  const groupY = cellY + shapeOffsetY;
  const originAbs = absoluteOrigin(groupX, groupY, variant.local);

  elements.push(originMarker(`rotate_${variant.key}_origin`, originAbs[0], originAbs[1]));

  elements.push({
    id: `rotate_${variant.key}_group`,
    type: "group",
    x: groupX,
    y: groupY,
    width: rectW,
    height: rectH,
    origin: originAbs,
    children: [
      {
        id: `rotate_${variant.key}_rect`,
        type: "path",
        d: rectShape,
        fill,
        stroke: "#dbeafe",
        strokeWidth: 2
      }
    ],
    timeline: {
      tracks: {
        rotation: {
          keyframes: [
            { time: 0, value: 0, out: curves.easeOut },
            { time: 1.5, value: 42, out: curves.ease },
            { time: 3, value: -28, out: curves.ease },
            { time: 4.5, value: 18, out: curves.ease },
            { time: 5.8, value: 0 }
          ]
        }
      }
    }
  });
}

function originMarker(id, x, y) {
  return {
    id,
    type: "group",
    x: x - 16,
    y: y - 16,
    children: [
      {
        id: `${id}_cross_h`,
        type: "path",
        d: "M 0 16 L 32 16",
        fill: "none",
        stroke: colors.marker,
        strokeWidth: 2,
        strokeCap: "round"
      },
      {
        id: `${id}_cross_v`,
        type: "path",
        d: "M 16 0 L 16 32",
        fill: "none",
        stroke: colors.marker,
        strokeWidth: 2,
        strokeCap: "round"
      },
      {
        id: `${id}_dot`,
        type: "path",
        d: circlePath(16, 16, 6),
        fill: colors.marker,
        stroke: colors.markerStroke,
        strokeWidth: 1.5
      }
    ]
  };
}

function absoluteOrigin(groupX, groupY, localOrigin) {
  return [groupX + localOrigin[0], groupY + localOrigin[1]];
}

function circlePath(cx, cy, r) {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
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
