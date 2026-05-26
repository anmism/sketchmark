const fs = require("node:fs");
const path = require("node:path");

function pathElement(id, d, style = {}) {
  return { id, type: "path", d, ...style };
}

function textElement(id, x, y, text, style = {}) {
  return { id, type: "text", x, y, text, ...style };
}

function roundedRectPath(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return [
    `M ${x + rr} ${y}`,
    `H ${x + w - rr}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `V ${y + h - rr}`,
    `Q ${x + w} ${y + h} ${x + w - rr} ${y + h}`,
    `H ${x + rr}`,
    `Q ${x} ${y + h} ${x} ${y + h - rr}`,
    `V ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    "Z"
  ].join(" ");
}

const width = 1200;
const height = 740;
const duration = 4;
const fps = 30;

const startX = 210;
const endX = width - 210;
const boxSize = 64;
const topY = 170;
const rowGap = 74;

const cases = [
  { id: "linear", label: "linear", color: "#2563eb", curve: { type: "graph", points: [[0, 0], [1, 1]] } },
  { id: "ease_in", label: "ease-in", color: "#0ea5e9", curve: { type: "cubicBezier", x1: 0.42, y1: 0, x2: 1, y2: 1 } },
  { id: "ease_out", label: "ease-out", color: "#22c55e", curve: { type: "cubicBezier", x1: 0, y1: 0, x2: 0.58, y2: 1 } },
  { id: "ease_in_out", label: "ease-in-out", color: "#f59e0b", curve: { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
  { id: "hold", label: "hold", color: "#ef4444", curve: { type: "hold" } },
  { id: "custom_cubic", label: "custom cubic", color: "#8b5cf6", curve: { type: "cubicBezier", x1: 0.18, y1: 0.92, x2: 0.32, y2: 1.12 } },
  { id: "custom_graph", label: "custom graph", color: "#14b8a6", curve: { type: "graph", points: [[0, 0], [0.2, 0.03], [0.5, 0.97], [0.8, 0.2], [1, 1]] } }
];

function curveClone(curve) {
  return curve ? JSON.parse(JSON.stringify(curve)) : undefined;
}

function boxCase(caseItem, index) {
  const centerY = topY + index * rowGap;
  const boxY = centerY - boxSize / 2;
  const id = caseItem.id;
  return [
    pathElement(`rail_${id}`, `M ${startX - 20} ${centerY} H ${endX + 20}`, {
      fill: "none",
      stroke: "#cbd5e1",
      strokeWidth: 2
    }),
    textElement(`label_${id}`, 60, centerY + 5, caseItem.label, {
      align: "left",
      fontSize: 18,
      weight: 700,
      fill: "#334155",
      fontFamily: "Inter, system-ui, sans-serif"
    }),
    {
      id: `box_${id}`,
      type: "group",
      x: startX - boxSize / 2,
      y: boxY,
      children: [
        pathElement(`box_${id}_shadow`, roundedRectPath(6, 8, boxSize, boxSize, 12), {
          fill: "#0f172a",
          opacity: 0.15
        }),
        pathElement(`box_${id}_body`, roundedRectPath(0, 0, boxSize, boxSize, 12), {
          fill: caseItem.color,
          stroke: "#0f172a",
          strokeWidth: 2
        })
      ],
      timeline: {
        tracks: {
          position: {
            keyframes: [
              { time: 0, value: [startX - boxSize / 2, boxY], out: curveClone(caseItem.curve) },
              { time: duration, value: [endX - boxSize / 2, boxY] }
            ]
          }
        }
      }
    }
  ];
}

const doc = {
  version: 1,
  canvas: {
    width,
    height,
    background: "#f8fafc",
    duration,
    fps
  },
  elements: [
    textElement("title", width / 2, 52, "Graph Test - Separate Boxes", {
      align: "center",
      fontSize: 30,
      weight: 800,
      fill: "#0f172a",
      fontFamily: "Inter, system-ui, sans-serif"
    }),
    textElement("legend", width / 2, 104, "Each row is one curve on a separate box.", {
      align: "center",
      fontSize: 15,
      fill: "#334155",
      fontFamily: "Inter, system-ui, sans-serif"
    }),
    textElement("legend2", width / 2, 128, "linear | ease-in | ease-out | ease-in-out | hold | custom cubic | custom graph", {
      align: "center",
      fontSize: 15,
      fill: "#334155",
      fontFamily: "Inter, system-ui, sans-serif"
    }),
    ...cases.flatMap((item, index) => boxCase(item, index))
  ]
};

const outPath = path.join(__dirname, "graph-box-test.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath}`);
