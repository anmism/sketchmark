const fs = require("node:fs");
const path = require("node:path");

const outputPath = path.join(__dirname, "fight-contact-controller.visual.json");

const W = 960;
const H = 540;
const DURATION = 4.8;
const FPS = 30;
const GROUND_Y = 426;
const FOOT_Y = 420;

const bg = "#f8fafc";
const ground = "#cbd5e1";
const dark = "#111827";
const blue = "#334155";
const farA = "#64748b";
const farB = "#94a3b8";
const shadow = "#94a3b8";
const flash = "#facc15";
const curve = { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
const snap = { type: "cubicBezier", x1: 0.2, y1: 0, x2: 0.18, y2: 1 };

const HIP = [0, 292];
const SHOULDER = [0, 204];
const THIGH = 68;
const SHIN = 74;
const UPPER_ARM = 50;
const FOREARM = 48;

function linePath(x1, y1, x2, y2) {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

function ellipsePath(cx, cy, rx, ry) {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

function starPath(cx, cy, outer, inner, points = 8) {
  const parts = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const x = Number((cx + Math.cos(angle) * radius).toFixed(2));
    const y = Number((cy + Math.sin(angle) * radius).toFixed(2));
    parts.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

function rotationFromVector(dx, dy) {
  return (Math.atan2(dy, dx) * 180) / Math.PI - 90;
}

function solveTwoBone(root, target, upperLength, lowerLength, bend = 1) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const rawDistance = Math.hypot(dx, dy) || 0.001;
  const maxDistance = upperLength + lowerLength - 0.001;
  const minDistance = Math.abs(upperLength - lowerLength) + 0.001;
  const distance = Math.max(minDistance, Math.min(rawDistance, maxDistance));
  const ux = dx / rawDistance;
  const uy = dy / rawDistance;
  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  const lift = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const joint = [
    root[0] + ux * along + -uy * lift * bend,
    root[1] + uy * along + ux * lift * bend
  ];
  const upper = rotationFromVector(joint[0] - root[0], joint[1] - root[1]);
  const lowerAbs = rotationFromVector(target[0] - joint[0], target[1] - joint[1]);
  return {
    upper: Number(upper.toFixed(2)),
    lower: Number((lowerAbs - upper).toFixed(2))
  };
}

function keyframes(values, outCurve = curve) {
  return values.map(([time, value], index) => ({
    time,
    value,
    ...(index < values.length - 1 ? { out: outCurve } : {})
  }));
}

function pathElement(id, d, options = {}) {
  return {
    id,
    type: "path",
    d,
    fill: options.fill ?? "none",
    ...(options.stroke ? { stroke: options.stroke } : {}),
    ...(options.strokeWidth ? { strokeWidth: options.strokeWidth } : {}),
    ...(options.strokeCap ? { strokeCap: options.strokeCap } : {}),
    ...(options.opacity !== undefined ? { opacity: options.opacity } : {})
  };
}

function segment(id, x, y, length, stroke, strokeWidth, children = [], opacity) {
  return {
    id,
    type: "group",
    x,
    y,
    origin: [x, y],
    width: strokeWidth,
    height: length,
    ...(opacity !== undefined ? { opacity } : {}),
    children: [
      pathElement(`${id}.line`, linePath(0, 0, 0, length), {
        stroke,
        strokeWidth,
        strokeCap: "round"
      }),
      ...children
    ]
  };
}

function arm(id, stroke, opacity) {
  const forearm = segment(`${id}.forearm`, 0, UPPER_ARM, FOREARM, stroke, 6);
  return segment(`${id}.upper`, SHOULDER[0], SHOULDER[1], UPPER_ARM, stroke, 7, [forearm], opacity);
}

function leg(id, stroke, opacity) {
  const foot = {
    id: `${id}.foot`,
    type: "group",
    x: 0,
    y: SHIN,
    origin: [0, SHIN],
    width: 38,
    height: 8,
    children: [
      pathElement(`${id}.foot.line`, linePath(-4, 0, 36, 0), {
        stroke,
        strokeWidth: 8,
        strokeCap: "round"
      })
    ]
  };
  const shin = segment(`${id}.shin`, 0, THIGH, SHIN, stroke, 8, [foot]);
  return segment(`${id}.thigh`, HIP[0], HIP[1], THIGH, stroke, 9, [shin], opacity);
}

function makeRig(id, color, ghostColor, facing) {
  const rig = {
    id: `${id}.rig`,
    type: "group",
    x: 0,
    y: 0,
    origin: HIP,
    width: 170,
    height: 430,
    children: [
      arm(`${id}.farArm`, ghostColor, 0.62),
      leg(`${id}.farLeg`, ghostColor, 0.62),
      pathElement(`${id}.torso`, linePath(HIP[0], HIP[1], SHOULDER[0], SHOULDER[1]), {
        stroke: color,
        strokeWidth: 11,
        strokeCap: "round"
      }),
      pathElement(`${id}.neck`, linePath(SHOULDER[0], SHOULDER[1], 8, 172), {
        stroke: color,
        strokeWidth: 8,
        strokeCap: "round"
      }),
      pathElement(`${id}.head`, ellipsePath(24, 138, 32, 32), {
        fill: "#ffffff",
        stroke: color,
        strokeWidth: 7
      }),
      pathElement(`${id}.eye`, ellipsePath(37, 132, 3.5, 3.5), {
        fill: color
      }),
      leg(`${id}.nearLeg`, color),
      arm(`${id}.nearArm`, color)
    ]
  };
  if (facing === -1) rig.scaleX = -1;
  return rig;
}

const actionTargets = {
  guard: {
    nearHand: [48, 236],
    farHand: [34, 248],
    nearFoot: [36, FOOT_Y],
    farFoot: [-48, FOOT_Y],
    body: 0
  },
  step: {
    nearHand: [50, 236],
    farHand: [36, 248],
    nearFoot: [48, FOOT_Y],
    farFoot: [-32, FOOT_Y],
    body: 4
  },
  punch: {
    nearHand: [96, 206],
    farHand: [36, 246],
    nearFoot: [46, FOOT_Y],
    farFoot: [-34, FOOT_Y],
    body: 8
  },
  blockHigh: {
    nearHand: [54, 188],
    farHand: [42, 210],
    nearFoot: [34, FOOT_Y],
    farFoot: [-44, FOOT_Y],
    body: -3
  },
  kickWind: {
    nearHand: [-28, 238],
    farHand: [24, 246],
    nearFoot: [18, 365],
    farFoot: [-36, FOOT_Y],
    body: -4
  },
  kickContact: {
    nearHand: [-22, 240],
    farHand: [20, 246],
    nearFoot: [138, 314],
    farFoot: [-30, FOOT_Y],
    nearFootAngle: 8,
    body: 10
  },
  flyingWind: {
    nearHand: [-34, 236],
    farHand: [16, 250],
    nearFoot: [18, 370],
    farFoot: [-50, 390],
    nearFootAngle: -16,
    farFootAngle: -8,
    body: -10
  },
  flyingKick: {
    nearHand: [-46, 238],
    farHand: [-18, 252],
    nearFoot: [145, 320],
    farFoot: [-72, 368],
    nearFootAngle: 8,
    farFootAngle: -18,
    body: 16
  },
  flyingLand: {
    nearHand: [42, 238],
    farHand: [20, 252],
    nearFoot: [46, FOOT_Y],
    farFoot: [-42, FOOT_Y],
    nearFootAngle: -8,
    farFootAngle: -6,
    body: 4
  },
  hitReact: {
    nearHand: [-54, 232],
    farHand: [-24, 254],
    nearFoot: [18, FOOT_Y],
    farFoot: [-58, FOOT_Y],
    body: -16
  },
  recover: {
    nearHand: [22, 240],
    farHand: [0, 252],
    nearFoot: [28, FOOT_Y],
    farFoot: [-50, FOOT_Y],
    body: -8
  }
};

function compileActionFrame(time, action, x, y, shadowScale = 1, shadowOpacity = 0.22) {
  const target = actionTargets[action];
  if (!target) throw new Error(`Unknown action: ${action}`);

  const nearArm = solveTwoBone(SHOULDER, target.nearHand, UPPER_ARM, FOREARM, 1);
  const farArm = solveTwoBone(SHOULDER, target.farHand, UPPER_ARM, FOREARM, 1);
  const nearLeg = solveTwoBone(HIP, target.nearFoot, THIGH, SHIN, -1);
  const farLeg = solveTwoBone(HIP, target.farFoot, THIGH, SHIN, -1);
  const nearFootAngle = target.nearFootAngle ?? 0;
  const farFootAngle = target.farFootAngle ?? 0;

  return {
    time,
    root: [x, y],
    shadowX: x,
    shadowScale,
    shadowOpacity,
    body: target.body,
    nearArmUpper: nearArm.upper,
    nearArmForearm: nearArm.lower,
    farArmUpper: farArm.upper,
    farArmForearm: farArm.lower,
    nearLegThigh: nearLeg.upper,
    nearLegShin: nearLeg.lower,
    nearLegFoot: Number((nearFootAngle - nearLeg.upper - nearLeg.lower).toFixed(2)),
    farLegThigh: farLeg.upper,
    farLegShin: farLeg.lower,
    farLegFoot: Number((farFootAngle - farLeg.upper - farLeg.lower).toFixed(2))
  };
}

function makeFighter(id, color, ghostColor, facing, frames) {
  const rig = makeRig(id, color, ghostColor, facing);
  const trackFor = (property, outCurve = curve) => ({
    keyframes: keyframes(frames.map((frame) => [frame.time, frame[property]]), outCurve)
  });
  rig.timeline = { tracks: { rotation: trackFor("body", snap) } };

  for (const element of rig.children) {
    if (element.id === `${id}.nearLeg.thigh` || element.id === `${id}.farLeg.thigh`) {
      const prefix = element.id === `${id}.nearLeg.thigh` ? "nearLeg" : "farLeg";
      element.timeline = { tracks: { rotation: trackFor(`${prefix}Thigh`) } };
      const shin = element.children.find((child) => child.id === element.id.replace(".thigh", ".shin"));
      const foot = shin.children.find((child) => child.id === element.id.replace(".thigh", ".foot"));
      shin.timeline = { tracks: { rotation: trackFor(`${prefix}Shin`) } };
      foot.timeline = { tracks: { rotation: trackFor(`${prefix}Foot`) } };
    }
    if (element.id === `${id}.nearArm.upper` || element.id === `${id}.farArm.upper`) {
      const prefix = element.id === `${id}.nearArm.upper` ? "nearArm" : "farArm";
      element.timeline = { tracks: { rotation: trackFor(`${prefix}Upper`) } };
      const forearm = element.children.find((child) => child.id === element.id.replace(".upper", ".forearm"));
      forearm.timeline = { tracks: { rotation: trackFor(`${prefix}Forearm`) } };
    }
  }

  return {
    id,
    type: "group",
    x: frames[0].root[0],
    y: frames[0].root[1],
    width: 170,
    height: 430,
    children: [rig],
    timeline: {
      tracks: {
        position: { keyframes: keyframes(frames.map((frame) => [frame.time, frame.root]), snap) }
      }
    }
  };
}

function impact(id, cx, cy, time, radius) {
  const burst = pathElement(id, starPath(cx, cy, radius, radius * 0.38), {
    fill: flash,
    stroke: "#92400e",
    strokeWidth: 2,
    opacity: 0
  });
  burst.origin = [cx, cy];
  burst.timeline = {
    tracks: {
      opacity: {
        keyframes: [
          { time: Math.max(0, time - 0.06), value: 0, out: snap },
          { time, value: 1, out: snap },
          { time: time + 0.16, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: Math.max(0, time - 0.06), value: 0.35, out: snap },
          { time, value: 1, out: snap },
          { time: time + 0.16, value: 1.42 }
        ]
      }
    }
  };
  return burst;
}

const fighterAFrames = [
  compileActionFrame(0, "guard", 305, 0),
  compileActionFrame(0.36, "step", 360, 0),
  compileActionFrame(0.72, "punch", 455, 0, 1.04, 0.24),
  compileActionFrame(1.0, "guard", 420, 0),
  compileActionFrame(1.34, "kickWind", 435, -2, 0.96, 0.2),
  compileActionFrame(1.72, "kickContact", 455, -4, 0.9, 0.18),
  compileActionFrame(2.08, "guard", 420, 0),
  compileActionFrame(2.6, "step", 380, 0),
  compileActionFrame(3.0, "flyingWind", 430, -26, 0.78, 0.14),
  compileActionFrame(3.42, "flyingKick", 465, -76, 0.54, 0.1),
  compileActionFrame(3.86, "flyingLand", 520, 10, 1.16, 0.3),
  compileActionFrame(4.2, "guard", 500, 0),
  compileActionFrame(DURATION, "guard", 455, 0)
];

const fighterBFrames = [
  compileActionFrame(0, "guard", 635, 0),
  compileActionFrame(0.36, "guard", 608, 0),
  compileActionFrame(0.72, "blockHigh", 590, 0, 1.04, 0.24),
  compileActionFrame(1.0, "recover", 610, 0),
  compileActionFrame(1.34, "guard", 604, 0),
  compileActionFrame(1.72, "hitReact", 620, -2, 0.9, 0.18),
  compileActionFrame(2.08, "recover", 665, 0, 0.96, 0.2),
  compileActionFrame(2.6, "guard", 632, 0),
  compileActionFrame(3.0, "guard", 632, 0),
  compileActionFrame(3.42, "hitReact", 680, -8, 0.78, 0.14),
  compileActionFrame(3.86, "recover", 715, 0, 0.92, 0.18),
  compileActionFrame(4.2, "guard", 675, 0),
  compileActionFrame(DURATION, "guard", 645, 0)
];

const fighterA = makeFighter("fighterA", dark, farA, 1, fighterAFrames);
const fighterB = makeFighter("fighterB", blue, farB, -1, fighterBFrames);

function movingShadow(id, frames) {
  const item = pathElement(id, ellipsePath(frames[0].shadowX, 438, 70, 11), {
    fill: shadow,
    opacity: 0.18
  });
  item.origin = [frames[0].shadowX, 438];
  item.timeline = {
    tracks: {
      x: { keyframes: keyframes(frames.map((frame) => [frame.time, frame.shadowX]), snap) },
      scale: { keyframes: keyframes(frames.map((frame) => [frame.time, frame.shadowScale]), curve) },
      opacity: { keyframes: keyframes(frames.map((frame) => [frame.time, frame.shadowOpacity]), curve) }
    }
  };
  return item;
}

const document = {
  version: 1,
  canvas: {
    width: W,
    height: H,
    background: bg,
    duration: DURATION,
    fps: FPS
  },
  elements: [
    pathElement("stage.ground", linePath(100, GROUND_Y, 860, GROUND_Y), {
      stroke: ground,
      strokeWidth: 9,
      strokeCap: "round"
    }),
    movingShadow("shadowA", fighterAFrames),
    movingShadow("shadowB", fighterBFrames),
    fighterB,
    fighterA,
    impact("jabImpact", 548, 210, 0.72, 22),
    impact("kickImpact", 590, 314, 1.72, 32),
    impact("flyingKickImpact", 610, 252, 3.42, 36),
    {
      id: "title",
      type: "text",
      text: "Fight scene from contact targets + IK",
      x: W / 2,
      y: 58,
      align: "center",
      valign: "middle",
      fontSize: 30,
      weight: 800,
      fill: "#0f172a"
    }
  ]
};

fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
console.log(`Wrote ${outputPath}`);
