const fs = require("node:fs");
const path = require("node:path");

const width = 900;
const height = 900;
const cx = width / 2;
const cy = height / 2;
const radius = 320;
const duration = 16;
const fps = 60;

function circlePath(x, y, r) {
  const c = Math.round(r * 0.5522847498 * 1000) / 1000;
  return [
    `M ${x + r} ${y}`,
    `C ${x + r} ${y + c} ${x + c} ${y + r} ${x} ${y + r}`,
    `C ${x - c} ${y + r} ${x - r} ${y + c} ${x - r} ${y}`,
    `C ${x - r} ${y - c} ${x - c} ${y - r} ${x} ${y - r}`,
    `C ${x + c} ${y - r} ${x + r} ${y - c} ${x + r} ${y}`,
    "Z"
  ].join(" ");
}

function pathElement(id, d, style = {}) {
  return { id, type: "path", d, ...style };
}

function textElement(id, x, y, text, style = {}) {
  return { id, type: "text", x, y, text, ...style };
}

function group(id, x, y, children, extra = {}) {
  return { id, type: "group", x, y, children, ...extra };
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

function hand(id, length, thickness, color, endRotation) {
  return group(
    id,
    cx,
    cy,
    [
      pathElement(`${id}_shape`, `M 0 18 L ${thickness / 2} 12 L ${thickness / 2} ${-length} L ${-thickness / 2} ${-length} L ${-thickness / 2} 12 Z`, {
        fill: color,
        stroke: "none"
      })
    ],
    {
      // Group origin is in canvas/world coordinates for groups.
      origin: [cx, cy],
      timeline: {
        tracks: {
          rotation: {
            keyframes: [
              [0, 0],
              [duration, endRotation]
            ]
          }
        }
      }
    }
  );
}

const dialMarks = [];
for (let i = 0; i < 60; i += 1) {
  const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
  const outer = radius - 12;
  const inner = i % 5 === 0 ? radius - 54 : radius - 34;
  const x1 = cx + Math.cos(angle) * inner;
  const y1 = cy + Math.sin(angle) * inner;
  const x2 = cx + Math.cos(angle) * outer;
  const y2 = cy + Math.sin(angle) * outer;
  dialMarks.push(pathElement(`mark_${i}`, `M ${x1} ${y1} L ${x2} ${y2}`, {
    fill: "none",
    stroke: i % 5 === 0 ? "#0f172a" : "#64748b",
    strokeWidth: i % 5 === 0 ? 5 : 2,
    strokeCap: "round"
  }));
}

const numbers = [];
for (let n = 1; n <= 12; n += 1) {
  const angle = (n / 12) * Math.PI * 2 - Math.PI / 2;
  const r = radius - 88;
  numbers.push(textElement(`num_${n}`, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r + 8, String(n), {
    align: "center",
    fontSize: 34,
    weight: 700,
    fill: "#0f172a",
    fontFamily: "Inter, system-ui, sans-serif"
  }));
}

const doc = {
  version: 1,
  canvas: {
    width,
    height,
    background: "#e2e8f0",
    duration,
    fps
  },
  elements: [
    pathElement("card", roundedRectPath(70, 70, width - 140, height - 140, 30), {
      fill: "#f8fafc",
      stroke: "#cbd5e1",
      strokeWidth: 3
    }),
    textElement("title", cx, 126, "Analog Clock", {
      align: "center",
      fontSize: 30,
      weight: 800,
      fill: "#0f172a",
      fontFamily: "Inter, system-ui, sans-serif"
    }),
    pathElement("dial_outer", circlePath(cx, cy, radius), {
      fill: "#ffffff",
      stroke: "#0f172a",
      strokeWidth: 8
    }),
    pathElement("dial_inner", circlePath(cx, cy, radius - 24), {
      fill: "none",
      stroke: "#cbd5e1",
      strokeWidth: 2
    }),
    ...dialMarks,
    ...numbers,
    hand("hour_hand", 150, 14, "#0f172a", 60),
    hand("minute_hand", 228, 10, "#1e293b", 720),
    hand("second_hand", 256, 5, "#dc2626", 5760),
    pathElement("center_cap_outer", circlePath(cx, cy, 11), { fill: "#0f172a" }),
    pathElement("center_cap_inner", circlePath(cx, cy, 5), { fill: "#f8fafc" })
  ]
};

const outPath = path.join(__dirname, "clock.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath}`);
