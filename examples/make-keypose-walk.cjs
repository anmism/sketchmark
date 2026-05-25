const fs = require("node:fs");
const path = require("node:path");

let compileKeyframeStates;
let timelineCurvePreset;
try {
  ({ compileKeyframeStates, timelineCurvePreset } = require("../dist/src"));
} catch {
  throw new Error("Run `npm run build` before this example so dist/src is available.");
}

const ink = "#111827";
const ghost = "#64748b";

function line(x1, y1, x2, y2) {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

function circle(cx, cy, r) {
  const c = Math.round(r * 0.5522847498 * 100) / 100;
  return [
    `M ${cx + r} ${cy}`,
    `C ${cx + r} ${cy + c} ${cx + c} ${cy + r} ${cx} ${cy + r}`,
    `C ${cx - c} ${cy + r} ${cx - r} ${cy + c} ${cx - r} ${cy}`,
    `C ${cx - r} ${cy - c} ${cx - c} ${cy - r} ${cx} ${cy - r}`,
    `C ${cx + c} ${cy - r} ${cx + r} ${cy - c} ${cx + r} ${cy}`,
    "Z"
  ].join(" ");
}

function stroke(color, width) {
  return { fill: "none", stroke: color, strokeWidth: width, strokeCap: "round", strokeJoin: "round" };
}

function pathElement(id, d, style = {}) {
  return { id, type: "path", d, ...style };
}

function group(id, x, y, children, extra = {}) {
  return { id, type: "group", x, y, children, ...extra };
}

function segment(id, length, color, width) {
  return pathElement(id, line(0, 0, 0, length), stroke(color, width));
}

function limb(id, x, y, color, upperName, lowerName) {
  return group(
    id,
    x,
    y,
    [
      segment(`${id}_${upperName}`, 64, color, 8),
      group(`${id}_lower`, 0, 64, [segment(`${id}_${lowerName}`, 62, color, 7)], { origin: [0, 64] })
    ],
    { origin: [x, y] }
  );
}

function leg(id, x, y, color) {
  const lower = group(
    `${id}_lower`,
    0,
    68,
    [
      segment(`${id}_shin`, 66, color, 7),
      group(`${id}_foot`, 0, 66, [pathElement(`${id}_foot_path`, line(0, 0, 34, 0), stroke(color, 7))], { origin: [0, 66] })
    ],
    { origin: [0, 68] }
  );
  return group(id, x, y, [segment(`${id}_thigh`, 68, color, 8), lower], { origin: [x, y] });
}

const document = {
  version: 1,
  canvas: { width: 960, height: 540, background: "#f8fafc", duration: 3, fps: 30 },
  elements: [
    pathElement("ground", line(70, 444, 890, 444), stroke("#d7e1ee", 8)),
    group(
      "walker",
      110,
      0,
      [
        limb("far_arm", 2, 184, ghost, "upper", "forearm"),
        leg("far_leg", 0, 290, ghost),
        pathElement("torso", line(0, 290, 2, 184), stroke(ink, 10)),
        pathElement("neck", line(2, 184, 6, 154), stroke(ink, 8)),
        limb("near_arm", 2, 184, ink, "upper", "forearm"),
        leg("near_leg", 0, 290, ink),
        group(
          "head",
          0,
          94,
          [
            pathElement("head_circle", circle(29, 29, 29), { fill: "#ffffff", stroke: ink, strokeWidth: 7 }),
            pathElement("eye", circle(39, 24, 3.2), { fill: ink })
          ],
          { width: 58, height: 58 }
        )
      ],
      { width: 160, height: 460 }
    )
  ]
};

const poses = [
  {
    near_leg: -22,
    near_leg_lower: 8,
    near_leg_foot: 8,
    far_leg: 22,
    far_leg_lower: 4,
    far_leg_foot: -8,
    near_arm: 18,
    near_arm_lower: 8,
    far_arm: -18,
    far_arm_lower: 8,
    head: [0, 94],
    bob: 0
  },
  {
    near_leg: 3,
    near_leg_lower: 28,
    near_leg_foot: -12,
    far_leg: 6,
    far_leg_lower: 2,
    far_leg_foot: 0,
    near_arm: 4,
    near_arm_lower: 16,
    far_arm: -4,
    far_arm_lower: 16,
    head: [2, 89],
    bob: -6
  },
  {
    near_leg: 22,
    near_leg_lower: 4,
    near_leg_foot: -8,
    far_leg: -22,
    far_leg_lower: 8,
    far_leg_foot: 8,
    near_arm: -18,
    near_arm_lower: 8,
    far_arm: 18,
    far_arm_lower: 8,
    head: [0, 94],
    bob: 0
  },
  {
    near_leg: 6,
    near_leg_lower: 2,
    near_leg_foot: 0,
    far_leg: 3,
    far_leg_lower: 28,
    far_leg_foot: -12,
    near_arm: -4,
    near_arm_lower: 16,
    far_arm: 4,
    far_arm_lower: 16,
    head: [-2, 89],
    bob: -6
  }
];

function state(time, pose) {
  return {
    time,
    set: {
      walker: { position: [110 + time * 170, pose.bob] },
      head: { position: pose.head },
      near_leg: { rotation: pose.near_leg },
      near_leg_lower: { rotation: pose.near_leg_lower },
      near_leg_foot: { rotation: pose.near_leg_foot },
      far_leg: { rotation: pose.far_leg },
      far_leg_lower: { rotation: pose.far_leg_lower },
      far_leg_foot: { rotation: pose.far_leg_foot },
      near_arm: { rotation: pose.near_arm },
      near_arm_lower: { rotation: pose.near_arm_lower },
      far_arm: { rotation: pose.far_arm },
      far_arm_lower: { rotation: pose.far_arm_lower }
    }
  };
}

const states = [];
for (let index = 0; index <= 6; index += 1) states.push(state(index * 0.5, poses[index % poses.length]));

const animated = compileKeyframeStates(document, states, {
  defaultCurve: timelineCurvePreset("linear")
});

const outPath = path.join(__dirname, "keypose-walk.visual.json");
fs.writeFileSync(outPath, JSON.stringify(animated, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
