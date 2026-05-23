const fs = require("node:fs");
const path = require("node:path");

const duration = 4;
const fps = 30;
const poseFps = 18;
const poseCount = duration * poseFps;
const frameTime = duration / poseCount;
const groundY = 315;

const ink = "#111827";
const soft = "#64748b";
const ground = "#dbe3ee";
const shadow = "#94a3b8";

function n(value) {
  return Math.round(value * 10) / 10;
}

function point(x, y) {
  return [n(x), n(y)];
}

function line(from, to, stroke = ink, strokeWidth = 5) {
  return {
    type: "line",
    from: point(from[0], from[1]),
    to: point(to[0], to[1]),
    stroke,
    strokeWidth
  };
}

function circle(cx, cy, radius, extra = {}) {
  return {
    type: "circle",
    cx: n(cx),
    cy: n(cy),
    radius,
    fill: "#ffffff",
    stroke: ink,
    strokeWidth: 4,
    ...extra
  };
}

function ellipse(cx, cy, rx, ry, extra = {}) {
  return {
    type: "ellipse",
    cx: n(cx),
    cy: n(cy),
    rx,
    ry,
    ...extra
  };
}

function limb(length, angleDeg) {
  const angle = angleDeg * Math.PI / 180;
  return [Math.sin(angle) * length, Math.cos(angle) * length];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function footPose(phase) {
  const p = wrap01(phase);
  if (p < 0.62) {
    const u = smooth(p / 0.62);
    return [lerp(42, -42, u), groundY];
  }
  const u = smooth((p - 0.62) / 0.38);
  return [
    lerp(-42, 42, u),
    groundY - 32 * Math.sin(Math.PI * u)
  ];
}

function kneeFor(hip, foot, upper, lower) {
  const dx = foot[0] - hip[0];
  const dy = foot[1] - hip[1];
  const distance = Math.max(1, Math.min(upper + lower - 0.1, Math.hypot(dx, dy)));
  const mx = hip[0] + dx * 0.5;
  const my = hip[1] + dy * 0.5;
  const half = distance * 0.5;
  const bend = Math.sqrt(Math.max(0, upper * upper - half * half));
  const px = -dy / distance;
  const py = dx / distance;

  // Negative side bends both knees toward screen-right, which reads as a
  // natural side-view walk for a person moving right.
  return [mx - px * bend, my - py * bend];
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

function makePose(index) {
  const t = index / poseFps;
  const phase = wrap01(t / 1.0);
  const bob = 4 * Math.abs(Math.sin(phase * Math.PI * 2));
  const hip = [0, 207 + bob];
  const shoulder = [8, hip[1] - 82 - 2 * Math.sin(phase * Math.PI * 2)];
  const head = [18, shoulder[1] - 38];

  const rearFoot = footPose(phase + 0.5);
  const frontFoot = footPose(phase);
  const rearKnee = kneeFor(hip, rearFoot, 68, 68);
  const frontKnee = kneeFor(hip, frontFoot, 68, 68);

  const cycle = phase * Math.PI * 2;
  const rearArmAngle = 24 * Math.cos(cycle);
  const frontArmAngle = -24 * Math.cos(cycle);
  const rearForearmAngle = rearArmAngle * 0.55 + 18;
  const frontForearmAngle = frontArmAngle * 0.55 + 18;
  const rearElbow = add(shoulder, limb(42, rearArmAngle));
  const rearHand = add(rearElbow, limb(38, rearForearmAngle));
  const frontElbow = add(shoulder, limb(42, frontArmAngle));
  const frontHand = add(frontElbow, limb(38, frontForearmAngle));

  const children = [
    ellipse(0, groundY - 5, 42, 8, { fill: shadow, opacity: 0.2 }),

    line(hip, rearKnee, soft, 5),
    line(rearKnee, rearFoot, soft, 5),
    line(rearFoot, [rearFoot[0] + 28, rearFoot[1] - 1], soft, 5),
    line(shoulder, rearElbow, soft, 4),
    line(rearElbow, rearHand, soft, 4),

    line(hip, shoulder, ink, 6),
    circle(head[0], head[1], 18),
    circle(head[0] + 7, head[1] - 4, 2.2, { fill: ink, stroke: ink, strokeWidth: 0 }),
    line([head[0] + 16, head[1] + 2], [head[0] + 32, head[1] + 5], ink, 4),

    line(hip, frontKnee, ink, 6),
    line(frontKnee, frontFoot, ink, 6),
    line(frontFoot, [frontFoot[0] + 30, frontFoot[1] - 1], ink, 6),
    line(shoulder, frontElbow, ink, 4),
    line(frontElbow, frontHand, ink, 4)
  ];

  return {
    id: `pose_${String(index + 1).padStart(2, "0")}`,
    type: "group",
    x: 0,
    y: 0,
    opacity: 0,
    animate: {
      opacity: { keyframes: visibleWindow(index) }
    },
    children
  };
}

const doc = {
  version: 1,
  canvas: {
    width: 640,
    height: 360,
    background: "#f8fafc",
    duration,
    fps
  },
  elements: [
    {
      id: "ground",
      type: "line",
      from: [40, groundY],
      to: [600, groundY],
      stroke: ground,
      strokeWidth: 7
    },
    {
      id: "walker",
      type: "group",
      x: 90,
      y: 0,
      animate: {
        x: { from: 90, to: 540, duration, ease: "linear" }
      },
      children: Array.from({ length: poseCount }, (_, index) => makePose(index))
    }
  ]
};

fs.writeFileSync(
  path.join(__dirname, "walking-person.visual.json"),
  JSON.stringify(doc, null, 2)
);

console.log(`Wrote ${poseCount} baked walk poses to examples/walking-person.visual.json`);
