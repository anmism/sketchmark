const fs = require("node:fs");
const path = require("node:path");

const width = 1280;
const height = 720;
const duration = 6;
const fps = 30;
const poseFps = 18;
const poseCount = duration * poseFps;
const frameTime = duration / poseCount;
const TAU = Math.PI * 2;

const cx = 330;
const cy = 365;
const radius = 150;
const graphX = 610;
const graphW = 520;
const sineY = 285;
const cosineY = 500;
const amp = 95;

function n(value) {
  return Math.round(value * 10) / 10;
}

function point(x, y) {
  return [n(x), n(y)];
}

function line(id, from, to, stroke, strokeWidth = 2, extra = {}) {
  return {
    id,
    type: "line",
    from: point(from[0], from[1]),
    to: point(to[0], to[1]),
    stroke,
    strokeWidth,
    ...extra
  };
}

function circle(id, x, y, r, fill, extra = {}) {
  return {
    id,
    type: "circle",
    cx: n(x),
    cy: n(y),
    radius: r,
    fill,
    ...extra
  };
}

function text(id, content, x, y, fontSize, fill, extra = {}) {
  return {
    id,
    type: "text",
    text: content,
    x: n(x),
    y: n(y),
    align: "center",
    valign: "middle",
    fontSize,
    fill,
    ...extra
  };
}

function pathElement(id, d, stroke, strokeWidth = 3, extra = {}) {
  return {
    id,
    type: "path",
    d,
    fill: "none",
    stroke,
    strokeWidth,
    ...extra
  };
}

function wavePath(kind, until = 1, samples = 120) {
  const count = Math.max(1, Math.round(samples * until));
  const out = [];
  for (let i = 0; i <= count; i += 1) {
    const u = i / samples;
    const angle = u * TAU;
    const x = graphX + u * graphW;
    const centerY = kind === "sin" ? sineY : cosineY;
    const value = kind === "sin" ? Math.sin(angle) : Math.cos(angle);
    const y = centerY - amp * value;
    out.push(`${i === 0 ? "M" : "L"} ${n(x)} ${n(y)}`);
  }
  return out.join(" ");
}

function arcPath(progress, arcRadius = 52) {
  const angle = progress * TAU;
  const startX = cx + arcRadius;
  const startY = cy;
  const endX = cx + Math.cos(angle) * arcRadius;
  const endY = cy - Math.sin(angle) * arcRadius;
  const large = angle > Math.PI ? 1 : 0;
  return `M ${n(startX)} ${n(startY)} A ${arcRadius} ${arcRadius} 0 ${large} 0 ${n(endX)} ${n(endY)}`;
}

function visibleWindow(index) {
  const start = index * frameTime;
  const end = Math.min(duration, start + frameTime);
  const e = 0.0001;
  const keys = [];
  if (start > 0) keys.push([0, 0], [n(Math.max(0, start - e)), 0]);
  keys.push([n(start), 1], [n(Math.max(start, end - e)), 1], [n(end), 0], [duration, 0]);
  return keys;
}

function makeFrame(index) {
  const progress = index / (poseCount - 1);
  const angle = progress * TAU;
  const cosValue = Math.cos(angle);
  const sinValue = Math.sin(angle);
  const px = cx + radius * cosValue;
  const py = cy - radius * sinValue;
  const gx = graphX + graphW * progress;
  const sinDotY = sineY - amp * sinValue;
  const cosDotY = cosineY - amp * cosValue;

  return {
    id: `frame_${String(index + 1).padStart(3, "0")}`,
    type: "group",
    x: 0,
    y: 0,
    opacity: 0,
    animate: {
      opacity: { keyframes: visibleWindow(index) }
    },
    children: [
      pathElement(undefined, arcPath(progress), "#f59e0b", 4),
      line(undefined, [cx, cy], [px, py], "#111827", 4),
      line(undefined, [cx, cy], [px, cy], "#2563eb", 5),
      line(undefined, [px, cy], [px, py], "#dc2626", 5),
      circle(undefined, px, py, 9, "#111827"),
      circle(undefined, px, cy, 5, "#2563eb"),
      circle(undefined, cx, py, 5, "#dc2626"),

      pathElement(undefined, wavePath("sin", progress), "#dc2626", 5),
      pathElement(undefined, wavePath("cos", progress), "#2563eb", 5),
      line(undefined, [gx, sineY + amp + 18], [gx, sineY - amp - 18], "#dc2626", 1.5, { dashArray: [6, 6], opacity: 0.55 }),
      line(undefined, [gx, cosineY + amp + 18], [gx, cosineY - amp - 18], "#2563eb", 1.5, { dashArray: [6, 6], opacity: 0.55 }),
      circle(undefined, gx, sinDotY, 8, "#dc2626"),
      circle(undefined, gx, cosDotY, 8, "#2563eb"),
      text(undefined, `theta ${Math.round(progress * 360)} deg`, cx, cy + radius + 38, 18, "#92400e"),
      text(undefined, `cos = ${cosValue.toFixed(2)}`, cx - 95, cy + radius + 72, 17, "#2563eb"),
      text(undefined, `sin = ${sinValue.toFixed(2)}`, cx + 95, cy + radius + 72, 17, "#dc2626")
    ]
  };
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
    {
      id: "title",
      type: "text",
      text: "Sine and Cosine from the Unit Circle",
      x: width / 2,
      y: 56,
      align: "center",
      valign: "middle",
      fontSize: 38,
      weight: 800,
      fill: "#0f172a"
    },
    {
      id: "circle_panel",
      type: "rect",
      x: 80,
      y: 115,
      width: 500,
      height: 535,
      radius: 18,
      fill: "#ffffff",
      stroke: "#e2e8f0",
      strokeWidth: 2
    },
    {
      id: "graph_panel",
      type: "rect",
      x: 590,
      y: 115,
      width: 610,
      height: 535,
      radius: 18,
      fill: "#ffffff",
      stroke: "#e2e8f0",
      strokeWidth: 2
    },
    circle("unit_circle", cx, cy, radius, "none", { stroke: "#94a3b8", strokeWidth: 3 }),
    circle("center", cx, cy, 5, "#64748b"),
    line("circle_x_axis", [cx - radius - 28, cy], [cx + radius + 28, cy], "#cbd5e1", 2),
    line("circle_y_axis", [cx, cy - radius - 28], [cx, cy + radius + 28], "#cbd5e1", 2),
    text("circle_label", "unit circle", cx, 150, 22, "#334155", { weight: 700 }),
    text("cos_explain", "cos(theta) is the horizontal distance", cx, 625, 15, "#2563eb"),
    text("sin_explain", "sin(theta) is the vertical distance", cx, 645, 15, "#dc2626"),

    line("sine_axis", [graphX, sineY], [graphX + graphW, sineY], "#cbd5e1", 2),
    line("cosine_axis", [graphX, cosineY], [graphX + graphW, cosineY], "#cbd5e1", 2),
    line("sine_y_axis", [graphX, sineY - amp - 24], [graphX, sineY + amp + 24], "#e2e8f0", 2),
    line("cosine_y_axis", [graphX, cosineY - amp - 24], [graphX, cosineY + amp + 24], "#e2e8f0", 2),
    pathElement("sine_full", wavePath("sin"), "#fecaca", 3),
    pathElement("cosine_full", wavePath("cos"), "#bfdbfe", 3),
    text("sine_label", "sin(theta)", graphX + graphW + 42, sineY, 19, "#dc2626", { align: "left", weight: 700 }),
    text("cosine_label", "cos(theta)", graphX + graphW + 42, cosineY, 19, "#2563eb", { align: "left", weight: 700 }),
    text("graph_label", "same angle plotted over time", graphX + graphW / 2, 150, 22, "#334155", { weight: 700 }),

    ...Array.from({ length: poseCount }, (_, index) => makeFrame(index))
  ]
};

fs.writeFileSync(
  path.join(__dirname, "sine-cos-circle.visual.json"),
  JSON.stringify(doc, null, 2)
);

console.log(`Wrote ${poseCount} baked sine/cos frames to examples/sine-cos-circle.visual.json`);
