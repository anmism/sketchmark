const fs = require("node:fs");
const path = require("node:path");

const width = 1560;
const height = 940;
const duration = 18;
const fps = 60;
const cx = 520;
const cy = 470;
const radarR = 360;

const palette = {
  bg: "#041114",
  grid: "#0f2a2f",
  ring: "#1f4b53",
  sweep: "#22d3ee",
  aircraft: "#a7f3d0",
  tag: "#93c5fd",
  track: "#155e75",
  text: "#d1fae5",
  warning: "#f59e0b"
};

function circlePath(centerX, centerY, r) {
  const c = Math.round(r * 0.5522847498 * 1000) / 1000;
  return [
    `M ${centerX + r} ${centerY}`,
    `C ${centerX + r} ${centerY + c} ${centerX + c} ${centerY + r} ${centerX} ${centerY + r}`,
    `C ${centerX - c} ${centerY + r} ${centerX - r} ${centerY + c} ${centerX - r} ${centerY}`,
    `C ${centerX - r} ${centerY - c} ${centerX - c} ${centerY - r} ${centerX} ${centerY - r}`,
    `C ${centerX + c} ${centerY - r} ${centerX + r} ${centerY - c} ${centerX + r} ${centerY}`,
    "Z"
  ].join(" ");
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

function pathElement(id, d, style = {}) {
  return { id, type: "path", d, ...style };
}

function textElement(id, x, y, text, style = {}) {
  return { id, type: "text", x, y, text, ...style };
}

function group(id, x, y, children, extra = {}) {
  return { id, type: "group", x, y, children, ...extra };
}

function aircraftIconPath(size) {
  const s = size;
  return `M 0 ${-s} L ${s * 0.32} ${s * 0.7} L 0 ${s * 0.32} L ${-s * 0.32} ${s * 0.7} Z`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hash(index) {
  return Math.sin(index * 12.9898) * 43758.5453;
}

function pseudo(index) {
  return hash(index) - Math.floor(hash(index));
}

function flightCode(index) {
  const airlines = ["AI", "6E", "UK", "SG", "IX", "QR", "EK", "LH"];
  const airline = airlines[index % airlines.length];
  const digits = String(120 + ((index * 73) % 880));
  return `${airline}${digits}`;
}

function flightPath(seed, p) {
  const angleA = (pseudo(seed + 1) * Math.PI * 2) - Math.PI;
  const angleB = angleA + (pseudo(seed + 4) * 1.7 - 0.85);
  const radiusA = 90 + pseudo(seed + 7) * (radarR - 100);
  const radiusB = 90 + pseudo(seed + 11) * (radarR - 80);
  const radiusMid = clamp((radiusA + radiusB) * 0.5 + Math.sin(p * Math.PI * 2 + seed) * 90, 70, radarR - 35);
  const x0 = cx + Math.cos(angleA) * radiusA;
  const y0 = cy + Math.sin(angleA) * radiusA;
  const x2 = cx + Math.cos(angleB) * radiusB;
  const y2 = cy + Math.sin(angleB) * radiusB;
  const mx = cx + Math.cos((angleA + angleB) * 0.5 + 0.35) * radiusMid;
  const my = cy + Math.sin((angleA + angleB) * 0.5 - 0.18) * radiusMid;
  const x = (1 - p) * (1 - p) * x0 + 2 * (1 - p) * p * mx + p * p * x2;
  const y = (1 - p) * (1 - p) * y0 + 2 * (1 - p) * p * my + p * p * y2;
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

function heading(a, b) {
  return Math.atan2(b[1] - a[1], b[0] - a[0]) * (180 / Math.PI);
}

function trailPath(seed) {
  let d = "";
  for (let i = 0; i <= 54; i += 1) {
    const p = i / 54;
    const [x, y] = flightPath(seed, p);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d;
}

function flight(index) {
  const id = `flight_${index}`;
  const keyframesPos = [];
  const keyframesRot = [];
  const keyframesAlt = [];
  const phase = pseudo(index * 17 + 3);
  for (let t = 0; t <= duration + 0.0001; t += 0.75) {
    const tt = Number(t.toFixed(3));
    const p = ((t / duration) + phase) % 1;
    const a = flightPath(index + 1, p);
    const b = flightPath(index + 1, (p + 0.01) % 1);
    const rot = heading(a, b) + 90;
    const altitude = 240 + Math.round((Math.sin(t * 0.82 + index * 0.45) * 0.5 + 0.5) * 210);
    keyframesPos.push([tt, a]);
    keyframesRot.push([tt, Number(rot.toFixed(2))]);
    keyframesAlt.push([tt, `FL${String(altitude).padStart(3, "0")}`]);
  }

  return [
    pathElement(`${id}_trail`, trailPath(index + 1), {
      fill: "none",
      stroke: palette.track,
      strokeWidth: 1.4,
      opacity: 0.45,
      dashArray: [6, 8]
    }),
    group(
      id,
      0,
      0,
      [
        pathElement(`${id}_icon`, aircraftIconPath(8), {
          fill: index % 9 === 0 ? palette.warning : palette.aircraft,
          stroke: "#052026",
          strokeWidth: 1
        }),
        textElement(`${id}_code`, 16, -8, flightCode(index), {
          fill: palette.tag,
          fontSize: 11,
          fontFamily: "monospace"
        }),
        textElement(`${id}_alt`, 16, 7, "FL000", {
          fill: "#67e8f9",
          fontSize: 10,
          fontFamily: "monospace",
          timeline: { tracks: { text: { keyframes: keyframesAlt } } }
        })
      ],
      {
        origin: [0, 0],
        timeline: {
          tracks: {
            position: { keyframes: keyframesPos },
            rotation: { keyframes: keyframesRot }
          }
        }
      }
    )
  ];
}

function sweepArm() {
  const keyframes = [];
  for (let t = 0; t <= duration + 0.0001; t += 0.5) {
    keyframes.push([Number(t.toFixed(3)), (t / duration) * 360]);
  }
  return group(
    "sweep",
    cx,
    cy,
    [
      pathElement("sweep_line", `M 0 0 L ${radarR} 0`, { fill: "none", stroke: palette.sweep, strokeWidth: 2.2, opacity: 0.95 }),
      pathElement("sweep_echo", `M 0 0 L ${radarR * 0.62} 0`, { fill: "none", stroke: "#67e8f9", strokeWidth: 5, opacity: 0.14 })
    ],
    {
      origin: [0, 0],
      timeline: {
        tracks: {
          rotation: { keyframes }
        }
      }
    }
  );
}

function build() {
  const elements = [];
  elements.push(pathElement("bg", `M 0 0 H ${width} V ${height} H 0 Z`, { fill: palette.bg }));

  elements.push(pathElement("radar_frame", roundedRectPath(26, 26, 980, 888, 18), {
    fill: "#071a1f",
    stroke: "#164e63",
    strokeWidth: 2
  }));
  elements.push(pathElement("right_panel", roundedRectPath(1030, 26, 504, 888, 18), {
    fill: "#071521",
    stroke: "#1d4d66",
    strokeWidth: 2
  }));

  for (let i = 1; i <= 6; i += 1) {
    elements.push(pathElement(`ring_${i}`, circlePath(cx, cy, (radarR / 6) * i), {
      fill: "none",
      stroke: palette.ring,
      strokeWidth: i === 6 ? 2.2 : 1.1,
      opacity: i === 6 ? 0.9 : 0.7
    }));
  }
  elements.push(pathElement("axis_h", `M ${cx - radarR} ${cy} H ${cx + radarR}`, { fill: "none", stroke: palette.grid, strokeWidth: 1 }));
  elements.push(pathElement("axis_v", `M ${cx} ${cy - radarR} V ${cy + radarR}`, { fill: "none", stroke: palette.grid, strokeWidth: 1 }));
  elements.push(pathElement("axis_d1", `M ${cx - radarR * 0.71} ${cy - radarR * 0.71} L ${cx + radarR * 0.71} ${cy + radarR * 0.71}`, { fill: "none", stroke: palette.grid, strokeWidth: 1 }));
  elements.push(pathElement("axis_d2", `M ${cx + radarR * 0.71} ${cy - radarR * 0.71} L ${cx - radarR * 0.71} ${cy + radarR * 0.71}`, { fill: "none", stroke: palette.grid, strokeWidth: 1 }));

  elements.push(textElement("title", 48, 68, "Airport Surface & Approach Radar", {
    fill: palette.text,
    fontSize: 28,
    weight: 800,
    fontFamily: "Inter, system-ui, sans-serif"
  }));
  elements.push(textElement("subtitle", 48, 94, "Realtime traffic feed simulation for preview stress", {
    fill: "#7dd3fc",
    fontSize: 13,
    fontFamily: "Inter, system-ui, sans-serif"
  }));

  elements.push(sweepArm());
  elements.push(pathElement("center_dot", circlePath(cx, cy, 5), { fill: palette.sweep }));

  for (let i = 0; i < 54; i += 1) {
    const nodes = flight(i);
    elements.push(nodes[0], nodes[1]);
  }

  const tableTop = 120;
  elements.push(textElement("table_header", 1060, 84, "ACTIVE FLIGHTS", {
    fill: "#f0f9ff",
    fontSize: 16,
    weight: 700,
    fontFamily: "monospace"
  }));
  for (let i = 0; i < 26; i += 1) {
    const y = tableTop + i * 30;
    const idx = i * 2;
    elements.push(pathElement(`row_${i}_bg`, roundedRectPath(1050, y, 464, 24, 6), {
      fill: i % 2 === 0 ? "#0a1a2a" : "#0c1f32",
      opacity: 0.88
    }));
    elements.push(textElement(`row_${i}_code`, 1064, y + 16, flightCode(idx), {
      fill: palette.tag,
      fontSize: 12,
      fontFamily: "monospace"
    }));
    elements.push(textElement(`row_${i}_route`, 1136, y + 16, `APP-${String((idx % 17) + 1).padStart(2, "0")}  HOLD-${(idx % 8) + 1}`, {
      fill: "#bae6fd",
      fontSize: 12,
      fontFamily: "monospace"
    }));
    elements.push(textElement(`row_${i}_state`, 1434, y + 16, i % 5 === 0 ? "DESCEND" : i % 4 === 0 ? "FINAL" : "TRANSIT", {
      fill: i % 5 === 0 ? "#fdba74" : "#86efac",
      fontSize: 12,
      fontFamily: "monospace",
      align: "right"
    }));
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

const out = path.join(__dirname, "stress-airport-radar.visual.json");
fs.writeFileSync(out, JSON.stringify(build(), null, 2) + "\n", "utf8");
console.log(`Wrote ${out}`);
