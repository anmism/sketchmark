const fs = require("node:fs");
const path = require("node:path");

const outputPath = path.join(__dirname, "front-flip.visual.json");

const W = 960;
const H = 540;
const DURATION = 3;
const FPS = 30;
const GROUND_Y = 426;

const dark = "#111827";
const far = "#64748b";
const bg = "#f8fafc";
const ground = "#cbd5e1";
const shadow = "#94a3b8";
const curve = { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
const jumpCurve = { type: "cubicBezier", x1: 0.2, y1: 0, x2: 0.18, y2: 1 };

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

function flipperRig() {
  return {
    id: "flipper.rig",
    type: "group",
    x: 0,
    y: 0,
    origin: HIP,
    width: 170,
    height: 430,
    children: [
      arm("flipper.farArm", far, 0.68),
      leg("flipper.farLeg", far, 0.68),
      pathElement("flipper.torso", linePath(HIP[0], HIP[1], SHOULDER[0], SHOULDER[1]), {
        stroke: dark,
        strokeWidth: 11,
        strokeCap: "round"
      }),
      pathElement("flipper.neck", linePath(SHOULDER[0], SHOULDER[1], 7, 168), {
        stroke: dark,
        strokeWidth: 8,
        strokeCap: "round"
      }),
      pathElement("flipper.head", ellipsePath(23, 134, 34, 34), {
        fill: "#ffffff",
        stroke: dark,
        strokeWidth: 7
      }),
      pathElement("flipper.eye", ellipsePath(36, 128, 3.6, 3.6), {
        fill: dark
      }),
      leg("flipper.nearLeg", dark),
      arm("flipper.nearArm", dark)
    ]
  };
}

const walkPose = {
  nearLegThigh: -35.42,
  nearLegShin: 37.36,
  nearLegFoot: -1.94,
  farLegThigh: 1.24,
  farLegShin: 32.75,
  farLegFoot: -33.99,
  nearArmUpper: 48.02,
  nearArmForearm: -37.74,
  farArmUpper: 48.02,
  farArmForearm: -37.74
};

const crouchPose = {
  nearLegThigh: -58,
  nearLegShin: 92,
  nearLegFoot: -24,
  farLegThigh: -58,
  farLegShin: 92,
  farLegFoot: -24,
  nearArmUpper: -82,
  nearArmForearm: -36,
  farArmUpper: -82,
  farArmForearm: -36
};

const takeoffPose = {
  nearLegThigh: -4,
  nearLegShin: 8,
  nearLegFoot: -4,
  farLegThigh: -4,
  farLegShin: 8,
  farLegFoot: -4,
  nearArmUpper: -122,
  nearArmForearm: -28,
  farArmUpper: -122,
  farArmForearm: -28
};

const tuckPose = {
  nearLegThigh: -108,
  nearLegShin: 142,
  nearLegFoot: -28,
  farLegThigh: -108,
  farLegShin: 142,
  farLegFoot: -28,
  nearArmUpper: -118,
  nearArmForearm: -118,
  farArmUpper: -118,
  farArmForearm: -118
};

const openPose = {
  nearLegThigh: -18,
  nearLegShin: 16,
  nearLegFoot: 2,
  farLegThigh: -18,
  farLegShin: 16,
  farLegFoot: 2,
  nearArmUpper: -34,
  nearArmForearm: -20,
  farArmUpper: -34,
  farArmForearm: -20
};

function pose(time, root, body, shape, shadowX, shadowScale, shadowOpacity) {
  return {
    time,
    root,
    body,
    shadowX,
    shadowScale,
    shadowOpacity,
    ...shape
  };
}

const poses = [
  pose(0, [150, 0], 0, walkPose, 150, 1, 0.24),
  pose(0.25, [188, 18], 8, crouchPose, 188, 1.16, 0.3),
  pose(0.52, [265, -48], 24, takeoffPose, 265, 0.88, 0.2),
  pose(0.9, [390, -145], 135, tuckPose, 390, 0.58, 0.12),
  pose(1.28, [515, -178], 230, tuckPose, 515, 0.5, 0.1),
  pose(1.68, [650, -92], 315, openPose, 650, 0.76, 0.18),
  pose(2.03, [735, 15], 360, crouchPose, 735, 1.18, 0.32),
  pose(2.35, [792, 0], 360, walkPose, 792, 1, 0.24),
  pose(DURATION, [830, 0], 360, walkPose, 830, 1, 0.24)
];

function trackFor(property, outCurve = curve) {
  return { keyframes: keyframes(poses.map((item) => [item.time, item[property]]), outCurve) };
}

const rig = flipperRig();
rig.timeline = { tracks: { rotation: trackFor("body", jumpCurve) } };

const flipper = {
  id: "flipper",
  type: "group",
  x: 150,
  y: 0,
  width: 170,
  height: 430,
  children: [rig],
  timeline: {
    tracks: {
      position: { keyframes: keyframes(poses.map((item) => [item.time, item.root]), jumpCurve) }
    }
  }
};

const shadowElement = pathElement("shadow", ellipsePath(150, 438, 78, 12), {
  fill: shadow,
  opacity: 0.24
});
shadowElement.origin = [150, 438];
shadowElement.timeline = {
  tracks: {
    x: trackFor("shadowX", jumpCurve),
    scale: trackFor("shadowScale", curve),
    opacity: trackFor("shadowOpacity", curve)
  }
};

for (const element of rig.children) {
  if (element.id === "flipper.nearLeg.thigh" || element.id === "flipper.farLeg.thigh") {
    const prefix = element.id === "flipper.nearLeg.thigh" ? "nearLeg" : "farLeg";
    element.timeline = { tracks: { rotation: trackFor(`${prefix}Thigh`) } };
    const shin = element.children.find((child) => child.id === element.id.replace(".thigh", ".shin"));
    const foot = shin.children.find((child) => child.id === element.id.replace(".thigh", ".foot"));
    shin.timeline = { tracks: { rotation: trackFor(`${prefix}Shin`) } };
    foot.timeline = { tracks: { rotation: trackFor(`${prefix}Foot`) } };
  }
  if (element.id === "flipper.nearArm.upper" || element.id === "flipper.farArm.upper") {
    const prefix = element.id === "flipper.nearArm.upper" ? "nearArm" : "farArm";
    element.timeline = { tracks: { rotation: trackFor(`${prefix}Upper`) } };
    const forearm = element.children.find((child) => child.id === element.id.replace(".upper", ".forearm"));
    forearm.timeline = { tracks: { rotation: trackFor(`${prefix}Forearm`) } };
  }
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
    pathElement("stage.ground", linePath(90, GROUND_Y, 895, GROUND_Y), {
      stroke: ground,
      strokeWidth: 9,
      strokeCap: "round"
    }),
    shadowElement,
    flipper,
    {
      id: "title",
      type: "text",
      text: "Front flip: walk rig + rotating group + tuck pose",
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
