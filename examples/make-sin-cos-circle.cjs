const fs = require("node:fs");
const path = require("node:path");

let compileKeyframeStates;
try {
  ({ compileKeyframeStates } = require("../dist/src"));
} catch {
  throw new Error("Run `npm run build` before this example so dist/src is available.");
}

const width = 1200;
const height = 700;
const duration = 8;

const cx = 300, cy = 350; // circle center
const radius = 150;
const waveStartX = 500; // where waves begin
const waveWidth = 600;

function circlePath(x, y, r) {
  const c = r * 0.5522847498;
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

// Generate sine wave path for a given phase
function sinWavePath(phase, yCenter, amplitude) {
  let d = "";
  for (let i = 0; i <= 300; i++) {
    const x = waveStartX + (i / 300) * waveWidth;
    const angle = (i / 300) * 4 * Math.PI + phase;
    const y = yCenter + Math.sin(angle) * amplitude;
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d;
}

// Generate cosine wave path for a given phase
function cosWavePath(phase, yCenter, amplitude) {
  let d = "";
  for (let i = 0; i <= 300; i++) {
    const x = waveStartX + (i / 300) * waveWidth;
    const angle = (i / 300) * 4 * Math.PI + phase;
    const y = yCenter + Math.cos(angle) * amplitude;
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d;
}

const colors = {
  bg: "#0f172a",
  circle: "#475569",
  sin: "#ef4444",    // red for sin
  cos: "#3b82f6",    // blue for cos
  point: "#fbbf24",  // yellow dot
  axis: "#334155",
  text: "#f1f5f9",
  grid: "#1e293b"
};

const baseDocument = {
  version: 1,
  canvas: { width, height, background: colors.bg, duration, fps: 30 },
  elements: [
    // Title
    textElement("title", width / 2, 35, "Sine & Cosine from Circular Motion", {
      fill: colors.text, fontSize: 24, fontFamily: "Inter, sans-serif", weight: 700, align: "center"
    }),

    // Grid lines for wave area
    pathElement("grid_h1", `M ${waveStartX} ${cy} L ${waveStartX + waveWidth} ${cy}`, { fill: "none", stroke: colors.grid, strokeWidth: 1 }),
    pathElement("grid_h2", `M ${waveStartX} ${cy - radius} L ${waveStartX + waveWidth} ${cy - radius}`, { fill: "none", stroke: colors.grid, strokeWidth: 1, dashArray: [3, 5] }),
    pathElement("grid_h3", `M ${waveStartX} ${cy + radius} L ${waveStartX + waveWidth} ${cy + radius}`, { fill: "none", stroke: colors.grid, strokeWidth: 1, dashArray: [3, 5] }),

    // Circle axes
    pathElement("axis_x", `M ${cx - radius - 30} ${cy} L ${cx + radius + 30} ${cy}`, { fill: "none", stroke: colors.axis, strokeWidth: 1 }),
    pathElement("axis_y", `M ${cx} ${cy - radius - 30} L ${cx} ${cy + radius + 30}`, { fill: "none", stroke: colors.axis, strokeWidth: 1 }),

    // Unit circle
    pathElement("unit_circle", circlePath(cx, cy, radius), { fill: "none", stroke: colors.circle, strokeWidth: 2 }),

    // Angle labels on circle
    textElement("label_0", cx + radius + 10, cy + 5, "0", { fill: colors.text, fontSize: 12, fontFamily: "monospace" }),
    textElement("label_90", cx - 5, cy - radius - 10, "90", { fill: colors.text, fontSize: 12, fontFamily: "monospace", align: "center" }),
    textElement("label_180", cx - radius - 30, cy + 5, "180", { fill: colors.text, fontSize: 12, fontFamily: "monospace" }),
    textElement("label_270", cx - 5, cy + radius + 18, "270", { fill: colors.text, fontSize: 12, fontFamily: "monospace", align: "center" }),

    // Radius line (animated - rotates with angle)
    group("radius_line", cx, cy, [
      pathElement("radius_path", `M 0 0 L ${radius} 0`, { fill: "none", stroke: colors.point, strokeWidth: 2 })
    ]),

    // Point on circle (animated)
    group("point_on_circle", cx + radius, cy, [
      pathElement("point_dot", circlePath(0, 0, 8), { fill: colors.point })
    ]),

    // Sin projection line (vertical from point to x-axis)
    group("sin_proj_line", 0, 0, [
      pathElement("sin_proj", `M ${cx + radius} ${cy} L ${cx + radius} ${cy}`, { fill: "none", stroke: colors.sin, strokeWidth: 2, dashArray: [4, 3] })
    ]),

    // Cos projection line (horizontal from point to y-axis)
    group("cos_proj_line", 0, 0, [
      pathElement("cos_proj", `M ${cx} ${cy} L ${cx + radius} ${cy}`, { fill: "none", stroke: colors.cos, strokeWidth: 2, dashArray: [4, 3] })
    ]),

    // Connection line from circle to wave (sin)
    group("connect_sin", 0, 0, [
      pathElement("connect_sin_path", `M ${cx + radius} ${cy} L ${waveStartX} ${cy}`, { fill: "none", stroke: colors.sin, strokeWidth: 1, dashArray: [3, 4], opacity: 0.5 })
    ]),

    // Connection line from circle to wave (cos)
    group("connect_cos", 0, 0, [
      pathElement("connect_cos_path", `M ${cx + radius} ${cy} L ${waveStartX} ${cy}`, { fill: "none", stroke: colors.cos, strokeWidth: 1, dashArray: [3, 4], opacity: 0.5 })
    ]),

    // Sine wave (animated phase)
    group("sin_wave", 0, 0, [
      pathElement("sin_wave_path", sinWavePath(0, cy, radius), { fill: "none", stroke: colors.sin, strokeWidth: 2.5 })
    ]),

    // Cosine wave (animated phase)
    group("cos_wave", 0, 0, [
      pathElement("cos_wave_path", cosWavePath(0, cy, radius), { fill: "none", stroke: colors.cos, strokeWidth: 2.5 })
    ]),

    // Wave axis labels
    textElement("wave_label_1", waveStartX + waveWidth / 2, cy - radius - 20, "+1", { fill: colors.text, fontSize: 11, fontFamily: "monospace", align: "center", opacity: 0.6 }),
    textElement("wave_label_neg1", waveStartX + waveWidth / 2, cy + radius + 20, "-1", { fill: colors.text, fontSize: 11, fontFamily: "monospace", align: "center", opacity: 0.6 }),

    // Legend
    pathElement("legend_sin_line", `M 500 620 L 540 620`, { fill: "none", stroke: colors.sin, strokeWidth: 3 }),
    textElement("legend_sin_text", 550, 625, "sin(θ) = y / r", { fill: colors.sin, fontSize: 14, fontFamily: "Inter, sans-serif" }),

    pathElement("legend_cos_line", `M 750 620 L 790 620`, { fill: "none", stroke: colors.cos, strokeWidth: 3 }),
    textElement("legend_cos_text", 800, 625, "cos(θ) = x / r", { fill: colors.cos, fontSize: 14, fontFamily: "Inter, sans-serif" }),

    // Angle display
    group("angle_display", cx, cy + radius + 50, [
      textElement("angle_label", 0, 0, "θ = 0°", { fill: colors.point, fontSize: 16, fontFamily: "monospace", align: "center" })
    ]),

    // Sin/Cos value display
    group("sin_value_display", 160, 650, [
      textElement("sin_val", 0, 0, "sin(θ) = 0.00", { fill: colors.sin, fontSize: 14, fontFamily: "monospace" })
    ]),
    group("cos_value_display", 160, 675, [
      textElement("cos_val", 0, 0, "cos(θ) = 1.00", { fill: colors.cos, fontSize: 14, fontFamily: "monospace" })
    ]),

    // Explanation text
    textElement("explain1", 60, 80, "As the point rotates around the circle:", { fill: colors.text, fontSize: 13, fontFamily: "Inter, sans-serif", opacity: 0.8 }),
    textElement("explain2", 60, 100, "its Y coordinate traces the sine wave", { fill: colors.sin, fontSize: 13, fontFamily: "Inter, sans-serif" }),
    textElement("explain3", 60, 120, "its X coordinate traces the cosine wave", { fill: colors.cos, fontSize: 13, fontFamily: "Inter, sans-serif" }),
  ]
};

// Animation - point rotates around circle, waves scroll
const sequence = [];
const totalFrames = 80; // 80 frames over 8 seconds

for (let i = 0; i <= totalFrames; i++) {
  const t = (i / totalFrames) * duration;
  const progress = i / totalFrames;

  // Angle goes 0 to 2*PI (one full rotation)
  const angle = progress * 2 * Math.PI;
  const degrees = Math.round(progress * 360);

  // Point position on circle
  const px = cx + Math.cos(angle) * radius;
  const py = cy - Math.sin(angle) * radius; // negative because Y is inverted in screen coords

  // Sin and cos values
  const sinVal = Math.sin(angle);
  const cosVal = Math.cos(angle);

  // Radius line rotation (in degrees, screen coords = clockwise negative)
  const rotationDeg = -degrees;

  // Wave phase (scrolls with angle)
  const phase = -angle;

  // Build sin wave path for this frame
  let sinD = "";
  for (let j = 0; j <= 300; j++) {
    const wx = waveStartX + (j / 300) * waveWidth;
    const wAngle = (j / 300) * 4 * Math.PI + phase;
    const wy = cy - Math.sin(wAngle) * radius;
    sinD += j === 0 ? `M ${wx} ${wy}` : ` L ${wx} ${wy}`;
  }

  // Build cos wave path for this frame
  let cosD = "";
  for (let j = 0; j <= 300; j++) {
    const wx = waveStartX + (j / 300) * waveWidth;
    const wAngle = (j / 300) * 4 * Math.PI + phase;
    const wy = cy - Math.cos(wAngle) * radius;
    cosD += j === 0 ? `M ${wx} ${wy}` : ` L ${wx} ${wy}`;
  }

  // Sin projection: vertical line from point to center horizontal axis
  const sinProjD = `M ${px} ${cy} L ${px} ${py}`;

  // Cos projection: horizontal line from center vertical axis to point
  const cosProjD = `M ${cx} ${py} L ${px} ${py}`;

  // Connection lines from circle point to wave start
  const connectSinD = `M ${px} ${py} L ${waveStartX} ${py}`;
  const connectCosD = `M ${px} ${py} L ${waveStartX} ${py}`;

  sequence.push({
    time: t,
    ease: "linear",
    set: {
      point_on_circle: { position: [px, py] },
      radius_line: { rotation: rotationDeg },
      sin_wave_path: { d: sinD },
      cos_wave_path: { d: cosD },
      sin_proj: { d: sinProjD },
      cos_proj: { d: cosProjD },
      connect_sin_path: { d: connectSinD },
      connect_cos_path: { d: connectCosD },
      angle_label: { text: `θ = ${degrees}°` },
      sin_val: { text: `sin(θ) = ${sinVal.toFixed(2)}` },
      cos_val: { text: `cos(θ) = ${cosVal.toFixed(2)}` },
    }
  });
}

const document = compileKeyframeStates(baseDocument, sequence, {
  defaultCurve: { type: "graph", points: [[0, 0], [0.5, 0.5], [1, 1]] }
});
const outPath = path.join(__dirname, "sin-cos-circle.visual.json");
fs.writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
