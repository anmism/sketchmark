const fs = require("node:fs");
const path = require("node:path");

const width = 1600;
const height = 900;
const duration = 16;
const fps = 60;

const palette = {
  sky: "#0b1220",
  road: "#0f172a",
  roadEdge: "#1f2937",
  lane: "#64748b",
  cross: "#cbd5e1",
  grass: "#0f3a2a",
  carA: "#38bdf8",
  carB: "#f97316",
  carC: "#22c55e",
  carD: "#f43f5e",
  window: "#e2e8f0",
  wheel: "#0f172a",
  light: "#facc15",
  text: "#e2e8f0"
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

function circlePath(cx, cy, r) {
  const c = Math.round(r * 0.5522847498 * 1000) / 1000;
  return [
    `M ${cx + r} ${cy}`,
    `C ${cx + r} ${cy + c} ${cx + c} ${cy + r} ${cx} ${cy + r}`,
    `C ${cx - c} ${cy + r} ${cx - r} ${cy + c} ${cx - r} ${cy}`,
    `C ${cx - r} ${cy - c} ${cx - c} ${cy - r} ${cx} ${cy - r}`,
    `C ${cx + c} ${cy - r} ${cx + r} ${cy - c} ${cx + r} ${cy}`,
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

function wrap(value, max) {
  if (max <= 0) return 0;
  const next = value % max;
  return next < 0 ? next + max : next;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function carShape(id, color, widthPx, heightPx) {
  const roofWidth = widthPx * 0.42;
  const roofHeight = heightPx * 0.42;
  const roofX = (widthPx - roofWidth) / 2;
  const roofY = heightPx * 0.08;
  const wheelR = Math.max(2.5, heightPx * 0.16);
  return [
    pathElement(`${id}_body`, roundedRectPath(0, 0, widthPx, heightPx, Math.max(4, heightPx * 0.25)), { fill: color, stroke: "#0b1020", strokeWidth: 1.5 }),
    pathElement(`${id}_roof`, roundedRectPath(roofX, roofY, roofWidth, roofHeight, roofHeight * 0.35), { fill: palette.window, opacity: 0.8 }),
    pathElement(`${id}_wheel_a`, circlePath(widthPx * 0.24, heightPx, wheelR), { fill: palette.wheel }),
    pathElement(`${id}_wheel_b`, circlePath(widthPx * 0.76, heightPx, wheelR), { fill: palette.wheel }),
    pathElement(`${id}_headlight`, circlePath(widthPx - 2.5, heightPx * 0.45, 2), { fill: palette.light, opacity: 0.85 })
  ];
}

function laneCar(id, lane) {
  const isVertical = lane.axis === "y";
  const bodyWidth = lane.kind === "truck" ? 98 : 70;
  const bodyHeight = lane.kind === "truck" ? 34 : 26;
  const length = isVertical ? height + 360 : width + 360;
  const keyframes = [];
  const step = 1;
  for (let time = 0; time <= duration + 0.001; time += step) {
    const progress = lane.dir * lane.speed * time + lane.offset;
    if (!isVertical) {
      const x = wrap(progress, length) - 180;
      keyframes.push([Number(time.toFixed(3)), [Math.round(x), lane.fixed]]);
    } else {
      const y = wrap(progress, length) - 180;
      keyframes.push([Number(time.toFixed(3)), [lane.fixed, Math.round(y)]]);
    }
  }
  return group(
    id,
    0,
    0,
    carShape(id, lane.color, bodyWidth, bodyHeight),
    {
      origin: [bodyWidth * 0.5, bodyHeight * 0.5],
      rotation: isVertical ? (lane.dir > 0 ? 90 : -90) : lane.dir > 0 ? 0 : 180,
      timeline: {
        tracks: {
          position: {
            keyframes
          }
        }
      }
    }
  );
}

function pedestrian(id, anchorX, anchorY, phase) {
  const amp = 18 + (phase % 5) * 3;
  const cycle = 1.2 + (phase % 7) * 0.05;
  const keyframes = [];
  for (let t = 0; t <= duration + 0.001; t += 0.2) {
    const p = (t / cycle) * Math.PI * 2 + phase;
    keyframes.push([Number(t.toFixed(3)), [Math.round(anchorX + Math.sin(p) * amp), Math.round(anchorY + Math.cos(p * 2) * 2)]]);
  }
  return group(
    id,
    anchorX,
    anchorY,
    [
      pathElement(`${id}_head`, circlePath(0, -10, 3), { fill: "#f8fafc", opacity: 0.9 }),
      pathElement(`${id}_body`, "M 0 -6 L 0 9 M -5 2 L 5 2 M -4 14 L 0 9 L 4 14", {
        fill: "none",
        stroke: "#f8fafc",
        strokeWidth: 1.6,
        strokeCap: "round",
        strokeJoin: "round",
        opacity: 0.85
      })
    ],
    {
      timeline: {
        tracks: {
          position: { keyframes }
        }
      }
    }
  );
}

function buildScene() {
  const elements = [];

  elements.push(pathElement("bg", `M 0 0 H ${width} V ${height} H 0 Z`, { fill: palette.sky }));
  elements.push(pathElement("park_nw", roundedRectPath(0, 0, 640, 320, 18), { fill: palette.grass, opacity: 0.5 }));
  elements.push(pathElement("park_se", roundedRectPath(980, 560, 620, 340, 18), { fill: palette.grass, opacity: 0.5 }));

  const roadH = { x: 0, y: 330, w: width, h: 240 };
  const roadV = { x: 640, y: 0, w: 320, h: height };
  elements.push(pathElement("road_h", roundedRectPath(roadH.x, roadH.y, roadH.w, roadH.h, 8), { fill: palette.road }));
  elements.push(pathElement("road_v", roundedRectPath(roadV.x, roadV.y, roadV.w, roadV.h, 8), { fill: palette.road }));
  elements.push(pathElement("road_h_edge", `M 0 ${roadH.y} H ${width} M 0 ${roadH.y + roadH.h} H ${width}`, { fill: "none", stroke: palette.roadEdge, strokeWidth: 6 }));
  elements.push(pathElement("road_v_edge", `M ${roadV.x} 0 V ${height} M ${roadV.x + roadV.w} 0 V ${height}`, { fill: "none", stroke: palette.roadEdge, strokeWidth: 6 }));

  const laneLines = [
    `M 0 ${roadH.y + 80} H ${width}`,
    `M 0 ${roadH.y + 120} H ${width}`,
    `M 0 ${roadH.y + 160} H ${width}`,
    `M 0 ${roadH.y + 200} H ${width}`,
    `M ${roadV.x + 105} 0 V ${height}`,
    `M ${roadV.x + 160} 0 V ${height}`,
    `M ${roadV.x + 215} 0 V ${height}`
  ].join(" ");
  elements.push(pathElement("lanes", laneLines, { fill: "none", stroke: palette.lane, strokeWidth: 2, dashArray: [16, 18], opacity: 0.6 }));

  const crosswalk = [];
  for (let i = 0; i < 9; i += 1) {
    const x = 600 + i * 22;
    crosswalk.push(`M ${x} 308 H ${x + 12} V 328 H ${x} Z`);
    crosswalk.push(`M ${x} 572 H ${x + 12} V 592 H ${x} Z`);
  }
  for (let i = 0; i < 8; i += 1) {
    const y = 300 + i * 24;
    crosswalk.push(`M 612 ${y} H 632 V ${y + 12} H 612 Z`);
    crosswalk.push(`M 968 ${y} H 988 V ${y + 12} H 968 Z`);
  }
  elements.push(pathElement("crosswalks", crosswalk.join(" "), { fill: palette.cross, opacity: 0.9 }));

  const lanes = [];
  const laneColors = [palette.carA, palette.carB, palette.carC, palette.carD];
  const horizontal = [
    { y: 366, dir: 1, speed: 195, count: 16, kind: "car" },
    { y: 406, dir: 1, speed: 220, count: 14, kind: "car" },
    { y: 446, dir: -1, speed: 180, count: 17, kind: "truck" },
    { y: 486, dir: -1, speed: 205, count: 15, kind: "car" }
  ];
  for (let li = 0; li < horizontal.length; li += 1) {
    const lane = horizontal[li];
    for (let i = 0; i < lane.count; i += 1) {
      lanes.push({
        axis: "x",
        fixed: lane.y,
        dir: lane.dir,
        speed: lane.speed + ((i * 13) % 31),
        offset: i * (lane.kind === "truck" ? 146 : 118) + li * 47,
        color: laneColors[(i + li) % laneColors.length],
        kind: lane.kind
      });
    }
  }
  const vertical = [
    { x: 694, dir: 1, speed: 168, count: 12, kind: "car" },
    { x: 750, dir: -1, speed: 176, count: 12, kind: "car" },
    { x: 806, dir: -1, speed: 160, count: 11, kind: "truck" },
    { x: 862, dir: 1, speed: 186, count: 11, kind: "car" }
  ];
  for (let li = 0; li < vertical.length; li += 1) {
    const lane = vertical[li];
    for (let i = 0; i < lane.count; i += 1) {
      lanes.push({
        axis: "y",
        fixed: lane.x,
        dir: lane.dir,
        speed: lane.speed + ((i * 9) % 22),
        offset: i * (lane.kind === "truck" ? 150 : 124) + li * 41,
        color: laneColors[(i + 2 * li) % laneColors.length],
        kind: lane.kind
      });
    }
  }

  for (let i = 0; i < lanes.length; i += 1) {
    elements.push(laneCar(`traffic_${i}`, lanes[i]));
  }

  for (let i = 0; i < 40; i += 1) {
    const isTop = i < 20;
    const span = isTop ? 580 : 560;
    const baseX = isTop ? 38 : 980;
    const baseY = isTop ? 295 : 603;
    const t = i % 20;
    const x = baseX + lerp(0, span, t / 19);
    const y = baseY + (isTop ? -5 : 5) * Math.sin(i * 0.75);
    elements.push(pedestrian(`ped_${i}`, Math.round(x), Math.round(y), i * 0.73));
  }

  const lightKeyframes = [];
  const lightColors = ["#ef4444", "#facc15", "#22c55e"];
  for (let t = 0; t <= duration + 0.001; t += 1) {
    const phase = Math.floor(t) % 6;
    const idx = phase < 2 ? 0 : phase < 3 ? 1 : 2;
    lightKeyframes.push([Number(t.toFixed(3)), lightColors[idx]]);
  }
  const lights = [
    [625, 325],
    [975, 575],
    [625, 575],
    [975, 325]
  ];
  for (let i = 0; i < lights.length; i += 1) {
    const [x, y] = lights[i];
    elements.push(pathElement(`signal_box_${i}`, roundedRectPath(x - 8, y - 28, 16, 56, 4), { fill: "#111827", stroke: "#334155", strokeWidth: 1 }));
    elements.push(pathElement(`signal_light_${i}`, circlePath(x, y - 10, 5), {
      fill: "#22c55e",
      timeline: {
        tracks: {
          fill: { keyframes: lightKeyframes }
        }
      }
    }));
  }

  elements.push(textElement("title", 24, 34, "Metro Junction - Rush Hour (Stress Scene)", {
    fill: palette.text,
    fontSize: 22,
    weight: 700,
    fontFamily: "Inter, system-ui, sans-serif"
  }));
  elements.push(textElement("meta", 24, 58, `vehicles: ${lanes.length} | pedestrians: 40 | ${fps}fps`, {
    fill: "#94a3b8",
    fontSize: 13,
    fontFamily: "monospace"
  }));

  return {
    version: 1,
    canvas: { width, height, background: palette.sky, duration, fps },
    elements
  };
}

const out = path.join(__dirname, "stress-city-traffic.visual.json");
fs.writeFileSync(out, JSON.stringify(buildScene(), null, 2) + "\n", "utf8");
console.log(`Wrote ${out}`);
