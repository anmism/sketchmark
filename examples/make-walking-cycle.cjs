const fs = require("node:fs");
const path = require("node:path");

const outputPath = path.join(__dirname, "walking-cycle.visual.json");

const W = 960;
const H = 540;
const STRIDE_DURATION = 1.8;
const WALK_CYCLES = 20;
const DURATION = STRIDE_DURATION * WALK_CYCLES;
const FPS = 30;
const GROUND_Y = 420;
const FOOT_Y = 415;

const dark = "#111827";
const far = "#64748b";
const bg = "#f8fafc";
const ground = "#cbd5e1";
const shadow = "#94a3b8";
const curve = { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
const linear = { type: "graph", points: [[0, 0], [1, 1]] };

const HIP = [0, 282];
const SHOULDER = [1, 198];
const THIGH = 70;
const SHIN = 76;
const UPPER_ARM = 49;
const FOREARM = 48;

function linePath(x1, y1, x2, y2) {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

function ellipsePath(cx, cy, rx, ry) {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

function rotationFromVector(dx, dy) {
  return (Math.atan2(dy, dx) * 180) / Math.PI - 90;
}

function solveTwoBone(root, target, upperLength, lowerLength, bend = -1) {
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

function keyframes(values) {
  return values.map(([time, value], index) => ({
    time,
    value,
    ...(index < values.length - 1 ? { out: index === 0 ? linear : curve } : {})
  }));
}

function poseTime(seconds) {
  return Number(seconds.toFixed(3));
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

function arm(id, stroke, opacity) {
  const forearm = segment(`${id}.forearm`, 0, UPPER_ARM, FOREARM, stroke, 6);
  return segment(`${id}.upper`, SHOULDER[0], SHOULDER[1], UPPER_ARM, stroke, 7, [forearm], opacity);
}

function walkerGroup() {
  return {
    id: "walker",
    type: "group",
    x: 450,
    y: 0,
    width: 170,
    height: 430,
    children: [
      arm("walker.farArm", far, 0.68),
      leg("walker.farLeg", far, 0.68),
      pathElement("walker.torso", linePath(HIP[0], HIP[1], SHOULDER[0], SHOULDER[1]), {
        stroke: dark,
        strokeWidth: 11,
        strokeCap: "round"
      }),
      pathElement("walker.neck", linePath(SHOULDER[0], SHOULDER[1], 7, 168), {
        stroke: dark,
        strokeWidth: 8,
        strokeCap: "round"
      }),
      pathElement("walker.head", ellipsePath(23, 134, 34, 34), {
        fill: "#ffffff",
        stroke: dark,
        strokeWidth: 7
      }),
      pathElement("walker.eye", ellipsePath(36, 128, 3.6, 3.6), {
        fill: dark
      }),
      leg("walker.nearLeg", dark),
      arm("walker.nearArm", dark)
    ]
  };
}

function limbPose(config, id, root, foot, footAngle = 0) {
  const solved = solveTwoBone(root, foot, THIGH, SHIN, -1);
  config[`${id}.thigh`] = solved.upper;
  config[`${id}.shin`] = solved.lower;
  config[`${id}.foot`] = Number((footAngle - solved.upper - solved.lower).toFixed(2));
}

function armPose(config, id, hand, bend) {
  const solved = solveTwoBone(SHOULDER, hand, UPPER_ARM, FOREARM, bend);
  config[`${id}.upper`] = solved.upper;
  config[`${id}.forearm`] = solved.lower;
}

function makePose(time, rootY, options) {
  const localFootY = FOOT_Y - rootY;
  const config = {
    time,
    root: [450, rootY],
    shadowScale: options.shadowScale,
    shadowOpacity: options.shadowOpacity
  };

  limbPose(config, "walker.nearLeg", HIP, [options.nearFootX, options.nearFootLift ? localFootY - options.nearFootLift : localFootY], options.nearFootAngle ?? 0);
  limbPose(config, "walker.farLeg", HIP, [options.farFootX, options.farFootLift ? localFootY - options.farFootLift : localFootY], options.farFootAngle ?? 0);
  armPose(config, "walker.nearArm", [options.nearHandX, options.nearHandY], options.nearArmBend ?? 1);
  armPose(config, "walker.farArm", [options.farHandX, options.farHandY], options.farArmBend ?? 1);
  return config;
}

const basePoseSpecs = [
  {
    time: 0,
    rootY: 0,
    options: {
    nearFootX: 38,
    farFootX: -44,
    nearHandX: -44,
    nearHandY: 278,
    farHandX: 44,
    farHandY: 278,
    shadowScale: 1,
    shadowOpacity: 0.22
    }
  },
  {
    time: 0.3,
    rootY: 6,
    options: {
    nearFootX: 24,
    farFootX: -34,
    nearHandX: -30,
    nearHandY: 282,
    farHandX: 30,
    farHandY: 282,
    shadowScale: 1.08,
    shadowOpacity: 0.26
    }
  },
  {
    time: 0.6,
    rootY: -5,
    options: {
    nearFootX: 10,
    farFootX: 0,
    farFootLift: 38,
    farFootAngle: -12,
    nearHandX: 8,
    nearHandY: 278,
    farHandX: -8,
    farHandY: 278,
    shadowScale: 0.92,
    shadowOpacity: 0.18
    }
  },
  {
    time: 0.9,
    rootY: 0,
    options: {
    nearFootX: -44,
    farFootX: 38,
    nearHandX: 44,
    nearHandY: 278,
    farHandX: -44,
    farHandY: 278,
    shadowScale: 1,
    shadowOpacity: 0.22
    }
  },
  {
    time: 1.2,
    rootY: 6,
    options: {
    nearFootX: -34,
    farFootX: 24,
    nearHandX: 30,
    nearHandY: 282,
    farHandX: -30,
    farHandY: 282,
    shadowScale: 1.08,
    shadowOpacity: 0.26
    }
  },
  {
    time: 1.5,
    rootY: -5,
    options: {
    nearFootX: 0,
    nearFootLift: 38,
    nearFootAngle: -12,
    farFootX: 10,
    nearHandX: -8,
    nearHandY: 278,
    farHandX: 8,
    farHandY: 278,
    shadowScale: 0.92,
    shadowOpacity: 0.18
    }
  }
];

const poses = [];
for (let cycle = 0; cycle < WALK_CYCLES; cycle += 1) {
  const offset = cycle * STRIDE_DURATION;
  for (const spec of basePoseSpecs) {
    poses.push(makePose(poseTime(offset + spec.time), spec.rootY, spec.options));
  }
}

const firstPoseSpec = basePoseSpecs[0];
poses.push(makePose(DURATION, firstPoseSpec.rootY, firstPoseSpec.options));

function trackFor(property) {
  return { keyframes: keyframes(poses.map((pose) => [pose.time, pose[property]])) };
}

function timelineFor(property) {
  return { tracks: { [property]: trackFor(property) } };
}

function applyTimeline(element, property) {
  element.timeline = timelineFor(property);
  return element;
}

const walker = walkerGroup();
applyTimeline(walker, "position");
walker.timeline.tracks.position = { keyframes: keyframes(poses.map((pose) => [pose.time, pose.root])) };

const shadowElement = pathElement("shadow", ellipsePath(450, 432, 82, 12), {
  fill: shadow,
  opacity: 0.22
});
shadowElement.origin = [450, 432];
shadowElement.timeline = {
  tracks: {
    scale: { keyframes: keyframes(poses.map((pose) => [pose.time, pose.shadowScale])) },
    opacity: { keyframes: keyframes(poses.map((pose) => [pose.time, pose.shadowOpacity])) }
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
    pathElement("stage.ground", linePath(120, GROUND_Y, 840, GROUND_Y), {
      stroke: ground,
      strokeWidth: 9,
      strokeCap: "round"
    }),
    shadowElement,
    walker,
    {
      id: "title",
      type: "text",
      text: "Walk cycle from kernel timelines",
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

for (const element of walker.children) {
  if (element.id === "walker.nearLeg.thigh" || element.id === "walker.farLeg.thigh") {
    element.timeline = { tracks: { rotation: trackFor(element.id) } };
    const shin = element.children.find((child) => child.id === element.id.replace(".thigh", ".shin"));
    const foot = shin.children.find((child) => child.id === element.id.replace(".thigh", ".foot"));
    shin.timeline = { tracks: { rotation: trackFor(shin.id) } };
    foot.timeline = { tracks: { rotation: trackFor(foot.id) } };
  }
  if (element.id === "walker.nearArm.upper" || element.id === "walker.farArm.upper") {
    element.timeline = { tracks: { rotation: trackFor(element.id) } };
    const forearm = element.children.find((child) => child.id === element.id.replace(".upper", ".forearm"));
    forearm.timeline = { tracks: { rotation: trackFor(forearm.id) } };
  }
}

fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
console.log(`Wrote ${outputPath}`);
