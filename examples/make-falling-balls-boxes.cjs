const fs = require("node:fs");
const path = require("node:path");

const width = 1280;
const height = 720;
const groundY = 620;
const duration = 7;
const fps = 60;

function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function clampTime(time) {
  return Math.max(0, Math.min(duration, round(time)));
}

function pathElement(id, d, style = {}) {
  return { id, type: "path", d, ...style };
}

function groupElement(id, x, y, children, extra = {}) {
  return { id, type: "group", x, y, children, ...extra };
}

function textElement(id, x, y, text, style = {}) {
  return { id, type: "text", x, y, text, ...style };
}

function rectPath(x, y, w, h) {
  return [
    `M ${x} ${y}`,
    `H ${x + w}`,
    `V ${y + h}`,
    `H ${x}`,
    "Z"
  ].join(" ");
}

function ellipsePath(cx, cy, rx, ry) {
  const c = 0.5522847498;
  const ox = round(rx * c);
  const oy = round(ry * c);
  return [
    `M ${round(cx + rx)} ${round(cy)}`,
    `C ${round(cx + rx)} ${round(cy + oy)} ${round(cx + ox)} ${round(cy + ry)} ${round(cx)} ${round(cy + ry)}`,
    `C ${round(cx - ox)} ${round(cy + ry)} ${round(cx - rx)} ${round(cy + oy)} ${round(cx - rx)} ${round(cy)}`,
    `C ${round(cx - rx)} ${round(cy - oy)} ${round(cx - ox)} ${round(cy - ry)} ${round(cx)} ${round(cy - ry)}`,
    `C ${round(cx + ox)} ${round(cy - ry)} ${round(cx + rx)} ${round(cy - oy)} ${round(cx + rx)} ${round(cy)}`,
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

function circlePath(r) {
  return ellipsePath(0, 0, r, r);
}

function curveEaseIn() {
  return { type: "cubicBezier", x1: 0.5, y1: 0, x2: 1, y2: 0.5 };
}

function curveLift() {
  return { type: "cubicBezier", x1: 0.12, y1: 0.75, x2: 0.22, y2: 1 };
}

function curveFloat() {
  return { type: "cubicBezier", x1: 0.22, y1: 0, x2: 0.68, y2: 1 };
}

function sanitizeKeyframes(frames) {
  const sorted = frames
    .map((frame) => ({ ...frame, time: clampTime(frame.time) }))
    .filter((frame) => Number.isFinite(frame.time))
    .sort((left, right) => left.time - right.time);
  const compact = [];
  for (const frame of sorted) {
    if (!compact.length) {
      compact.push(frame);
      continue;
    }
    const previous = compact[compact.length - 1];
    if (Math.abs(previous.time - frame.time) < 0.0001) compact[compact.length - 1] = frame;
    else compact.push(frame);
  }
  return compact;
}

function buildBouncePositionTrack(config) {
  const {
    x,
    startY,
    restY,
    startTime,
    dropDuration,
    bounces,
    bounceHeight,
    restitution,
    drift
  } = config;

  const keyframes = [
    { time: startTime, value: [x, startY], out: curveEaseIn() }
  ];
  const impactTimes = [];

  let cursor = startTime + dropDuration;
  let driftX = drift * 0.25;
  keyframes.push({ time: cursor, value: [x + driftX, restY], out: curveLift() });
  impactTimes.push(cursor);

  let heightPx = bounceHeight;
  for (let i = 0; i < bounces; i += 1) {
    heightPx *= restitution;
    if (heightPx < 8) break;
    const upDuration = Math.max(0.08, dropDuration * 0.23 * Math.pow(0.74, i));
    const downDuration = Math.max(0.08, dropDuration * 0.27 * Math.pow(0.74, i));
    const upTime = cursor + upDuration;
    driftX += drift * 0.2;
    keyframes.push({
      time: upTime,
      value: [x + driftX, restY - heightPx],
      out: curveFloat()
    });
    const downTime = upTime + downDuration;
    driftX += drift * 0.18;
    keyframes.push({
      time: downTime,
      value: [x + driftX, restY],
      out: curveLift()
    });
    impactTimes.push(downTime);
    cursor = downTime;
  }

  keyframes.push({ time: duration, value: [x + drift, restY] });
  return { keyframes: sanitizeKeyframes(keyframes), impactTimes };
}

function buildSquashTracks(startTime, impactTimes, amount) {
  const scaleX = [{ time: startTime, value: 1 }];
  const scaleY = [{ time: startTime, value: 1 }];
  for (const hitTime of impactTimes) {
    const t0 = clampTime(hitTime - 0.05);
    const t1 = clampTime(hitTime);
    const t2 = clampTime(hitTime + 0.08);
    const t3 = clampTime(hitTime + 0.18);
    scaleX.push({ time: t0, value: 1 });
    scaleX.push({ time: t1, value: round(1 + amount) });
    scaleX.push({ time: t2, value: round(1 - amount * 0.45) });
    scaleX.push({ time: t3, value: 1 });

    scaleY.push({ time: t0, value: 1 });
    scaleY.push({ time: t1, value: round(1 - amount * 0.85) });
    scaleY.push({ time: t2, value: round(1 + amount * 0.35) });
    scaleY.push({ time: t3, value: 1 });
  }
  scaleX.push({ time: duration, value: 1 });
  scaleY.push({ time: duration, value: 1 });
  return {
    scaleX: { keyframes: sanitizeKeyframes(scaleX) },
    scaleY: { keyframes: sanitizeKeyframes(scaleY) }
  };
}

function buildBoxRotationTrack(startTime, impactTimes, initialSpin) {
  const keyframes = [{ time: startTime, value: round(-initialSpin * 0.5), out: curveEaseIn() }];
  let spin = initialSpin;
  for (const hitTime of impactTimes) {
    const before = clampTime(hitTime - 0.03);
    const after = clampTime(hitTime + 0.17);
    keyframes.push({ time: before, value: round(spin * 0.55) });
    spin = -spin * 0.58;
    keyframes.push({ time: after, value: round(spin), out: curveFloat() });
  }
  keyframes.push({ time: duration, value: 0 });
  return { keyframes: sanitizeKeyframes(keyframes) };
}

function makeBall(item, index) {
  const radius = item.size / 2;
  const startY = 52 + index * 24;
  const restY = groundY - radius;
  const motion = buildBouncePositionTrack({
    x: item.x,
    startY,
    restY,
    startTime: item.startTime,
    dropDuration: item.dropDuration,
    bounces: item.bounces,
    bounceHeight: item.bounceHeight,
    restitution: item.restitution,
    drift: item.drift
  });
  return groupElement(
    item.id,
    item.x,
    startY,
    [
      pathElement(`${item.id}_body`, circlePath(radius), {
        fill: item.color,
        stroke: "#0f172a",
        strokeWidth: 3
      }),
      pathElement(`${item.id}_highlight`, ellipsePath(-radius * 0.28, -radius * 0.3, radius * 0.33, radius * 0.22), {
        fill: "#ffffff",
        opacity: 0.2
      })
    ],
    {
      timeline: {
        tracks: {
          position: { keyframes: motion.keyframes },
          ...buildSquashTracks(item.startTime, motion.impactTimes, 0.17)
        }
      }
    }
  );
}

function makeBox(item, index) {
  const side = item.size;
  const startY = 68 + index * 22;
  const restY = groundY - side / 2;
  const motion = buildBouncePositionTrack({
    x: item.x,
    startY,
    restY,
    startTime: item.startTime,
    dropDuration: item.dropDuration,
    bounces: item.bounces,
    bounceHeight: item.bounceHeight,
    restitution: item.restitution,
    drift: item.drift
  });
  return groupElement(
    item.id,
    item.x,
    startY,
    [
      pathElement(`${item.id}_body`, roundedRectPath(-side / 2, -side / 2, side, side, 12), {
        fill: item.color,
        stroke: "#0f172a",
        strokeWidth: 3
      }),
      pathElement(`${item.id}_edge`, roundedRectPath(-side / 2 + 7, -side / 2 + 7, side - 14, side - 14, 8), {
        fill: "none",
        stroke: "#ffffff",
        strokeWidth: 2,
        opacity: 0.25
      })
    ],
    {
      timeline: {
        tracks: {
          position: { keyframes: motion.keyframes },
          rotation: buildBoxRotationTrack(item.startTime, motion.impactTimes, item.spin),
          ...buildSquashTracks(item.startTime, motion.impactTimes, 0.1)
        }
      }
    }
  );
}

const actors = [
  { id: "ball_blue", kind: "ball", x: 150, size: 62, color: "#3b82f6", startTime: 0.0, dropDuration: 1.05, bounces: 4, bounceHeight: 180, restitution: 0.5, drift: 60 },
  { id: "box_orange", kind: "box", x: 320, size: 76, color: "#f97316", startTime: 0.25, dropDuration: 1.2, bounces: 4, bounceHeight: 160, restitution: 0.47, drift: 48, spin: 26 },
  { id: "ball_green", kind: "ball", x: 500, size: 74, color: "#22c55e", startTime: 0.5, dropDuration: 1.32, bounces: 4, bounceHeight: 190, restitution: 0.5, drift: 56 },
  { id: "box_violet", kind: "box", x: 700, size: 70, color: "#8b5cf6", startTime: 0.85, dropDuration: 1.15, bounces: 4, bounceHeight: 150, restitution: 0.46, drift: 44, spin: 30 },
  { id: "ball_rose", kind: "ball", x: 905, size: 58, color: "#f43f5e", startTime: 1.1, dropDuration: 1.0, bounces: 5, bounceHeight: 145, restitution: 0.54, drift: 52 },
  { id: "box_teal", kind: "box", x: 1090, size: 78, color: "#14b8a6", startTime: 1.35, dropDuration: 1.25, bounces: 4, bounceHeight: 170, restitution: 0.48, drift: 40, spin: 24 }
];

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
    pathElement("sky_strip", rectPath(0, 0, width, groundY), {
      fill: "#f8fafc"
    }),
    pathElement("ground", rectPath(0, groundY, width, height - groundY), {
      fill: "#cbd5e1"
    }),
    pathElement("ground_line", `M 0 ${groundY} H ${width}`, {
      fill: "none",
      stroke: "#64748b",
      strokeWidth: 4
    }),
    ...actors.map((item, index) => {
      const w = item.size * (item.kind === "ball" ? 1.7 : 1.45);
      const h = item.size * 0.22;
      return pathElement(`shadow_${item.id}`, ellipsePath(item.x, groundY + 3, w / 2, h / 2), {
        fill: "#0f172a",
        opacity: 0.16
      });
    }),
    textElement("title", width / 2, 72, "Falling Balls + Boxes Bounce Test", {
      align: "center",
      fontSize: 44,
      weight: 800,
      fill: "#0f172a",
      fontFamily: "Inter, system-ui, sans-serif"
    }),
    textElement("hint", width / 2, 124, "Simple gravity-style drop with damped bounces", {
      align: "center",
      fontSize: 20,
      fill: "#334155",
      fontFamily: "Inter, system-ui, sans-serif"
    }),
    ...actors.map((item, index) => (item.kind === "ball" ? makeBall(item, index) : makeBox(item, index)))
  ]
};

const outPath = path.join(__dirname, "falling-balls-boxes.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath}`);
