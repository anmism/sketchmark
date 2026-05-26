const fs = require("node:fs");
const path = require("node:path");

const width = 1680;
const height = 960;
const duration = 14;
const fps = 60;

const palette = {
  bg: "#060b16",
  panel: "#0f172a",
  panelBorder: "#1e293b",
  text: "#e2e8f0",
  dim: "#94a3b8",
  accentA: "#22d3ee",
  accentB: "#38bdf8",
  accentC: "#22c55e",
  accentD: "#f59e0b",
  accentE: "#f43f5e"
};

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

function pathElement(id, d, style = {}) {
  return { id, type: "path", d, ...style };
}

function textElement(id, x, y, text, style = {}) {
  return { id, type: "text", x, y, text, ...style };
}

function group(id, x, y, children, extra = {}) {
  return { id, type: "group", x, y, children, ...extra };
}

function curve(seed, t) {
  return (
    Math.sin(t * 0.85 + seed * 0.17) * 0.58 +
    Math.sin(t * 2.35 + seed * 0.49) * 0.24 +
    Math.cos(t * 3.8 + seed * 0.11) * 0.18
  );
}

function sparklinePath(seed, time, w, h, samples) {
  let d = "";
  for (let i = 0; i <= samples; i += 1) {
    const p = i / samples;
    const x = Math.round(p * w * 100) / 100;
    const signal = curve(seed, time * 1.6 + p * 8.4);
    const y = Math.round((h * 0.5 - signal * h * 0.42) * 100) / 100;
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d;
}

function areaPath(seed, time, w, h, samples) {
  let d = `M 0 ${h}`;
  for (let i = 0; i <= samples; i += 1) {
    const p = i / samples;
    const x = Math.round(p * w * 100) / 100;
    const signal = curve(seed, time * 1.2 + p * 7.1) * 0.9;
    const y = Math.round((h * 0.54 - signal * h * 0.35) * 100) / 100;
    d += ` L ${x} ${y}`;
  }
  d += ` L ${w} ${h} Z`;
  return d;
}

function pulseDot(id, x, y, color, phase) {
  const keyframes = [];
  for (let t = 0; t <= duration + 0.0001; t += 0.25) {
    const value = 0.25 + 0.75 * ((Math.sin(t * 2.1 + phase) + 1) * 0.5);
    keyframes.push([Number(t.toFixed(3)), Number(value.toFixed(3))]);
  }
  return pathElement(id, `M ${x + 3} ${y} A 3 3 0 1 1 ${x - 3} ${y} A 3 3 0 1 1 ${x + 3} ${y} Z`, {
    fill: color,
    opacity: 0.8,
    timeline: { tracks: { opacity: { keyframes } } }
  });
}

function panel(panelIndex, col, row) {
  const panelW = 378;
  const panelH = 248;
  const gapX = 24;
  const gapY = 22;
  const left = 28 + col * (panelW + gapX);
  const top = 116 + row * (panelH + gapY);
  const id = `panel_${panelIndex}`;
  const accent = [palette.accentA, palette.accentB, palette.accentC, palette.accentD, palette.accentE][panelIndex % 5];
  const sparkId = `${id}_spark`;
  const areaId = `${id}_area`;
  const valueId = `${id}_value`;
  const keyframesD = [];
  const keyframesArea = [];
  const keyframesValue = [];
  for (let t = 0; t <= duration + 0.0001; t += 0.2) {
    const tt = Number(t.toFixed(3));
    const signal = curve(panelIndex + 3, t * 1.15);
    const value = 50 + signal * 42 + (panelIndex % 4) * 4;
    keyframesD.push([tt, sparklinePath(panelIndex + 10, t, panelW - 36, 132, 110)]);
    keyframesArea.push([tt, areaPath(panelIndex + 30, t, panelW - 36, 132, 96)]);
    keyframesValue.push([tt, `${Math.round(value)}%`]);
  }

  const dots = [];
  for (let i = 0; i < 28; i += 1) {
    const x = 22 + i * 12.3;
    dots.push(pulseDot(`${id}_dot_${i}`, x, panelH - 26, accent, panelIndex * 0.4 + i * 0.27));
  }

  return group(id, left, top, [
    pathElement(`${id}_bg`, roundedRectPath(0, 0, panelW, panelH, 12), {
      fill: palette.panel,
      stroke: palette.panelBorder,
      strokeWidth: 1.8
    }),
    textElement(`${id}_title`, 18, 28, `Region ${panelIndex + 1} - Service Mesh`, {
      fill: palette.text,
      fontSize: 14,
      weight: 700,
      fontFamily: "Inter, system-ui, sans-serif"
    }),
    textElement(`${id}_label`, 18, 48, "Realtime throughput", {
      fill: palette.dim,
      fontSize: 12,
      fontFamily: "Inter, system-ui, sans-serif"
    }),
    textElement(valueId, panelW - 18, 31, "0%", {
      align: "right",
      fill: accent,
      fontSize: 20,
      weight: 800,
      fontFamily: "monospace",
      timeline: { tracks: { text: { keyframes: keyframesValue } } }
    }),
    group(`${id}_chart`, 18, 68, [
      pathElement(`${id}_chart_bg`, roundedRectPath(0, 0, panelW - 36, 132, 8), {
        fill: "#0a1222",
        stroke: "#17233b",
        strokeWidth: 1
      }),
      pathElement(areaId, areaPath(panelIndex + 30, 0, panelW - 36, 132, 96), {
        fill: accent,
        opacity: 0.15,
        timeline: { tracks: { d: { keyframes: keyframesArea } } }
      }),
      pathElement(sparkId, sparklinePath(panelIndex + 10, 0, panelW - 36, 132, 110), {
        fill: "none",
        stroke: accent,
        strokeWidth: 2.2,
        strokeCap: "round",
        strokeJoin: "round",
        timeline: { tracks: { d: { keyframes: keyframesD } } }
      })
    ]),
    ...dots
  ]);
}

function ticker() {
  const chips = [];
  for (let i = 0; i < 32; i += 1) {
    const left = 22 + i * 51;
    const keyframes = [];
    for (let t = 0; t <= duration + 0.0001; t += 0.5) {
      const blink = ((Math.sin(t * 2.8 + i * 0.74) + 1) * 0.5);
      keyframes.push([Number(t.toFixed(3)), Number((0.25 + blink * 0.75).toFixed(3))]);
    }
    chips.push(pathElement(`ticker_chip_${i}`, roundedRectPath(left, 82, 44, 8, 4), {
      fill: i % 3 === 0 ? palette.accentC : i % 3 === 1 ? palette.accentA : palette.accentD,
      opacity: 0.65,
      timeline: { tracks: { opacity: { keyframes } } }
    }));
  }
  return chips;
}

function buildDocument() {
  const elements = [];
  elements.push(pathElement("bg", `M 0 0 H ${width} V ${height} H 0 Z`, { fill: palette.bg }));
  elements.push(pathElement("header", roundedRectPath(18, 16, width - 36, 84, 12), {
    fill: "#0b1428",
    stroke: "#1e2d4b",
    strokeWidth: 2
  }));
  elements.push(textElement("title", 32, 48, "Global Operations Command - Live", {
    fill: palette.text,
    fontSize: 28,
    weight: 800,
    fontFamily: "Inter, system-ui, sans-serif"
  }));
  elements.push(textElement("sub", 32, 72, "Streaming telemetry, alerts, and edge load balancing", {
    fill: palette.dim,
    fontSize: 13,
    fontFamily: "Inter, system-ui, sans-serif"
  }));
  elements.push(...ticker());

  let index = 0;
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      elements.push(panel(index, col, row));
      index += 1;
    }
  }

  return {
    version: 1,
    canvas: {
      width,
      height,
      background: palette.bg,
      duration,
      fps
    },
    elements
  };
}

const outPath = path.join(__dirname, "stress-ops-dashboard.visual.json");
fs.writeFileSync(outPath, JSON.stringify(buildDocument(), null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath}`);
