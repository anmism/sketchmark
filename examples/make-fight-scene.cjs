const fs = require("node:fs");
const path = require("node:path");

const outputPath = path.join(__dirname, "fight-scene.visual.json");

const W = 960;
const H = 540;
const DURATION = 3.4;
const FPS = 30;
const GROUND_Y = 426;

const bg = "#f8fafc";
const ground = "#cbd5e1";
const dark = "#111827";
const blue = "#334155";
const red = "#b91c1c";
const shadow = "#94a3b8";
const flash = "#facc15";
const curve = { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
const snap = { type: "cubicBezier", x1: 0.2, y1: 0, x2: 0.18, y2: 1 };

const HIP = [0, 292];
const SHOULDER = [0, 204];
const THIGH = 68;
const SHIN = 74;
const UPPER_ARM = 48;
const FOREARM = 46;

function linePath(x1, y1, x2, y2) {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

function ellipsePath(cx, cy, rx, ry) {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

function starPath(cx, cy, outer, inner, points = 8) {
  const commands = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const x = Number((cx + Math.cos(angle) * radius).toFixed(2));
    const y = Number((cy + Math.sin(angle) * radius).toFixed(2));
    commands.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }
  commands.push("Z");
  return commands.join(" ");
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

function keyframes(values, outCurve = curve) {
  return values.map(([time, value], index) => ({
    time,
    value,
    ...(index < values.length - 1 ? { out: outCurve } : {})
  }));
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
  return {
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
      pathElement(`${id}.neck`, linePath(SHOULDER[0], SHOULDER[1], facing * 8, 172), {
        stroke: color,
        strokeWidth: 8,
        strokeCap: "round"
      }),
      pathElement(`${id}.head`, ellipsePath(facing * 24, 138, 32, 32), {
        fill: "#ffffff",
        stroke: color,
        strokeWidth: 7
      }),
      pathElement(`${id}.eye`, ellipsePath(facing * 37, 132, 3.5, 3.5), {
        fill: color
      }),
      leg(`${id}.nearLeg`, color),
      arm(`${id}.nearArm`, color)
    ]
  };
}

const modes = {
  guard: {
    body: 0,
    nearArmUpper: -72,
    nearArmForearm: 72,
    farArmUpper: -46,
    farArmForearm: 58,
    nearLegThigh: -12,
    nearLegShin: 22,
    nearLegFoot: -10,
    farLegThigh: 18,
    farLegShin: -14,
    farLegFoot: -4
  },
  step: {
    body: 4,
    nearArmUpper: -64,
    nearArmForearm: 68,
    farArmUpper: -38,
    farArmForearm: 52,
    nearLegThigh: -28,
    nearLegShin: 34,
    nearLegFoot: -6,
    farLegThigh: 22,
    farLegShin: -18,
    farLegFoot: -4
  },
  jab: {
    body: 8,
    nearArmUpper: -92,
    nearArmForearm: 0,
    farArmUpper: -48,
    farArmForearm: 62,
    nearLegThigh: -22,
    nearLegShin: 28,
    nearLegFoot: -6,
    farLegThigh: 10,
    farLegShin: -4,
    farLegFoot: -6
  },
  block: {
    body: -4,
    nearArmUpper: -112,
    nearArmForearm: 82,
    farArmUpper: -88,
    farArmForearm: 72,
    nearLegThigh: -10,
    nearLegShin: 18,
    nearLegFoot: -8,
    farLegThigh: 16,
    farLegShin: -12,
    farLegFoot: -4
  },
  kickWind: {
    body: -6,
    nearArmUpper: -34,
    nearArmForearm: 36,
    farArmUpper: 34,
    farArmForearm: -34,
    nearLegThigh: -74,
    nearLegShin: 110,
    nearLegFoot: -34,
    farLegThigh: 4,
    farLegShin: -2,
    farLegFoot: -2
  },
  kick: {
    body: 10,
    nearArmUpper: -28,
    nearArmForearm: 24,
    farArmUpper: 42,
    farArmForearm: -34,
    nearLegThigh: -92,
    nearLegShin: 6,
    nearLegFoot: 0,
    farLegThigh: 2,
    farLegShin: 4,
    farLegFoot: -6
  },
  hitReact: {
    body: -22,
    nearArmUpper: 38,
    nearArmForearm: -28,
    farArmUpper: 64,
    farArmForearm: -36,
    nearLegThigh: 14,
    nearLegShin: 4,
    nearLegFoot: -18,
    farLegThigh: -34,
    farLegShin: 44,
    farLegFoot: -10
  },
  recoil: {
    body: -10,
    nearArmUpper: -32,
    nearArmForearm: 40,
    farArmUpper: 54,
    farArmForearm: -32,
    nearLegThigh: 8,
    nearLegShin: 12,
    nearLegFoot: -12,
    farLegThigh: -24,
    farLegShin: 34,
    farLegFoot: -8
  }
};

function modeFrame(time, modeName, x, y, facing, shadowScale = 1, shadowOpacity = 0.22) {
  const mode = modes[modeName];
  if (!mode) throw new Error(`Unknown mode: ${modeName}`);
  return {
    time,
    root: [x, y],
    shadowX: x,
    shadowScale,
    shadowOpacity,
    body: mode.body,
    nearArmUpper: mode.nearArmUpper,
    nearArmForearm: mode.nearArmForearm,
    farArmUpper: mode.farArmUpper,
    farArmForearm: mode.farArmForearm,
    nearLegThigh: mode.nearLegThigh,
    nearLegShin: mode.nearLegShin,
    nearLegFoot: mode.nearLegFoot,
    farLegThigh: mode.farLegThigh,
    farLegShin: mode.farLegShin,
    farLegFoot: mode.farLegFoot
  };
}

function makeFighter(id, color, ghostColor, facing, frames) {
  const rig = makeRig(id, color, ghostColor, facing);
  if (facing === -1) rig.scaleX = -1;
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
          { time: Math.max(0, time - 0.08), value: 0, out: snap },
          { time, value: 1, out: snap },
          { time: time + 0.18, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: Math.max(0, time - 0.08), value: 0.35, out: snap },
          { time, value: 1, out: snap },
          { time: time + 0.18, value: 1.45 }
        ]
      }
    }
  };
  return burst;
}

const fighterAFrames = [
  modeFrame(0, "guard", 300, 0, 1),
  modeFrame(0.35, "step", 340, 0, 1),
  modeFrame(0.72, "jab", 390, 0, 1, 1.04, 0.24),
  modeFrame(1.0, "guard", 380, 0, 1),
  modeFrame(1.34, "kickWind", 410, -2, 1, 0.96, 0.2),
  modeFrame(1.72, "kick", 430, -4, 1, 0.92, 0.18),
  modeFrame(2.06, "guard", 410, 0, 1),
  modeFrame(2.6, "step", 380, 0, 1),
  modeFrame(DURATION, "guard", 360, 0, 1)
];

const fighterBFrames = [
  modeFrame(0, "guard", 620, 0, -1),
  modeFrame(0.35, "guard", 600, 0, -1),
  modeFrame(0.72, "block", 575, 0, -1, 1.04, 0.24),
  modeFrame(1.0, "recoil", 592, 0, -1),
  modeFrame(1.34, "guard", 590, 0, -1),
  modeFrame(1.72, "hitReact", 625, -2, -1, 0.9, 0.18),
  modeFrame(2.06, "recoil", 660, 0, -1, 0.96, 0.2),
  modeFrame(2.6, "guard", 625, 0, -1),
  modeFrame(DURATION, "guard", 610, 0, -1)
];

const fighterA = makeFighter("fighterA", dark, "#64748b", 1, fighterAFrames);
const fighterB = makeFighter("fighterB", blue, "#94a3b8", -1, fighterBFrames);

const shadowA = pathElement("shadowA", ellipsePath(300, 438, 70, 11), { fill: shadow, opacity: 0.18 });
shadowA.origin = [300, 438];
shadowA.timeline = {
  tracks: {
    x: { keyframes: keyframes(fighterAFrames.map((frame) => [frame.time, frame.shadowX]), snap) },
    scale: { keyframes: keyframes(fighterAFrames.map((frame) => [frame.time, frame.shadowScale]), curve) },
    opacity: { keyframes: keyframes(fighterAFrames.map((frame) => [frame.time, frame.shadowOpacity]), curve) }
  }
};

const shadowB = pathElement("shadowB", ellipsePath(620, 438, 70, 11), { fill: shadow, opacity: 0.18 });
shadowB.origin = [620, 438];
shadowB.timeline = {
  tracks: {
    x: { keyframes: keyframes(fighterBFrames.map((frame) => [frame.time, frame.shadowX]), snap) },
    scale: { keyframes: keyframes(fighterBFrames.map((frame) => [frame.time, frame.shadowScale]), curve) },
    opacity: { keyframes: keyframes(fighterBFrames.map((frame) => [frame.time, frame.shadowOpacity]), curve) }
  }
};

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
    shadowA,
    shadowB,
    fighterB,
    fighterA,
    impact("jabImpact", 520, 226, 0.72, 22),
    impact("kickImpact", 565, 314, 1.72, 32),
    {
      id: "title",
      type: "text",
      text: "Procedural fight scene",
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
