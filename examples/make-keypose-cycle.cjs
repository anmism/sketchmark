const fs = require("node:fs");
const path = require("node:path");

let compileKeyframeStates;
let timelineCurvePreset;
try {
  ({ compileKeyframeStates, timelineCurvePreset } = require("../dist/src"));
} catch {
  throw new Error("Run `npm run build` before this example so dist/src is available.");
}

const ink = "#0f172a";
const steel = "#334155";
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

function spoke(id, cx, cy, radius, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return pathElement(
    id,
    line(cx, cy, cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius),
    stroke("#94a3b8", 2)
  );
}

function spokeSet(prefix, cx, cy, radius, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(spoke(`${prefix}_${i}`, cx, cy, radius, i * (360 / count)));
  return out;
}

function arm(id, x, y, color) {
  return group(
    id,
    x,
    y,
    [
      pathElement(`${id}_upper`, line(0, 0, 42, 4), stroke(color, 7)),
      group(`${id}_lower`, 42, 4, [pathElement(`${id}_forearm`, line(0, 0, 34, 6), stroke(color, 6))], { origin: [42, 4] })
    ],
    { origin: [x, y] }
  );
}

function leg(id, x, y, color) {
  return group(
    id,
    x,
    y,
    [
      pathElement(`${id}_thigh`, line(0, 0, 0, 50), stroke(color, 8)),
      group(
        `${id}_lower`,
        0,
        50,
        [
          pathElement(`${id}_shin`, line(0, 0, 0, 46), stroke(color, 7)),
          group(`${id}_foot`, 0, 46, [pathElement(`${id}_shoe`, line(0, 0, 16, 0), stroke(color, 7))], { origin: [0, 46] })
        ],
        { origin: [0, 50] }
      )
    ],
    { origin: [x, y] }
  );
}

const document = {
  version: 1,
  canvas: { width: 960, height: 540, background: "#f8fafc", duration: 4, fps: 30 },
  elements: [
    pathElement("ground", line(40, 430, 920, 430), stroke("#cbd5e1", 12)),
    pathElement("lane_1", line(120, 430, 220, 430), stroke("#94a3b8", 4)),
    pathElement("lane_2", line(300, 430, 400, 430), stroke("#94a3b8", 4)),
    pathElement("lane_3", line(480, 430, 580, 430), stroke("#94a3b8", 4)),
    pathElement("lane_4", line(660, 430, 760, 430), stroke("#94a3b8", 4)),
    group(
      "bike",
      80,
      0,
      [
        group(
          "cycle",
          0,
          0,
          [
            pathElement("rear_tire", circle(250, 380, 72), { fill: "none", stroke: "#0b1220", strokeWidth: 8 }),
            pathElement("rear_rim", circle(250, 380, 60), { fill: "none", stroke: "#94a3b8", strokeWidth: 4 }),
            pathElement("front_tire", circle(520, 380, 72), { fill: "none", stroke: "#0b1220", strokeWidth: 8 }),
            pathElement("front_rim", circle(520, 380, 60), { fill: "none", stroke: "#94a3b8", strokeWidth: 4 }),
            group(
              "rear_wheel_spokes",
              0,
              0,
              [...spokeSet("rear_spoke", 250, 380, 56, 10), pathElement("rear_hub", circle(250, 380, 8), { fill: steel })],
              { origin: [250, 380] }
            ),
            group(
              "front_wheel_spokes",
              0,
              0,
              [...spokeSet("front_spoke", 520, 380, 56, 10), pathElement("front_hub", circle(520, 380, 8), { fill: steel })],
              { origin: [520, 380] }
            ),
            pathElement("seat_stay", line(250, 380, 310, 280), stroke(steel, 7)),
            pathElement("chain_stay", line(250, 380, 340, 340), stroke(steel, 7)),
            pathElement("seat_tube", line(310, 280, 340, 340), stroke(ink, 8)),
            pathElement("top_tube", line(310, 280, 438, 275), stroke(ink, 8)),
            pathElement("down_tube", line(340, 340, 430, 325), stroke(ink, 8)),
            pathElement("head_tube", line(438, 275, 430, 325), stroke(ink, 8)),
            pathElement("fork", line(430, 325, 520, 380), stroke(steel, 7)),
            pathElement("seat", line(298, 278, 332, 278), stroke(ink, 7)),
            pathElement("handlebar", "M 440 272 L 468 248 L 492 250", stroke(ink, 7)),
            group(
              "crank",
              0,
              0,
              [
                pathElement("chainring", circle(340, 340, 16), { fill: "none", stroke: ink, strokeWidth: 5 }),
                pathElement("crank_arm_near", line(340, 340, 340, 370), stroke(ink, 6)),
                pathElement("crank_arm_far", line(340, 340, 340, 310), stroke(ghost, 5)),
                pathElement("pedal_near", line(332, 370, 348, 370), stroke(ink, 6)),
                pathElement("pedal_far", line(332, 310, 348, 310), stroke(ghost, 5))
              ],
              { origin: [340, 340] }
            )
          ],
          { width: 620, height: 430 }
        ),
        group(
          "rider",
          0,
          0,
          [
            arm("far_arm", 388, 248, ghost),
            leg("far_leg", 322, 286, ghost),
            pathElement("torso", line(322, 286, 388, 248), stroke(ink, 10)),
            pathElement("neck", line(388, 248, 396, 230), stroke(ink, 7)),
            group(
              "head",
              396,
              186,
              [
                pathElement("head_circle", circle(24, 24, 24), { fill: "#ffffff", stroke: ink, strokeWidth: 6 }),
                pathElement("eye", circle(32, 20, 3), { fill: ink })
              ],
              { width: 48, height: 48 }
            ),
            arm("near_arm", 388, 248, ink),
            leg("near_leg", 322, 286, ink)
          ],
          { width: 200, height: 220 }
        )
      ],
      { width: 620, height: 430 }
    )
  ]
};

const hip = { x: 322, y: 286 };
const crankCenter = { x: 340, y: 340 };
const crankRadius = 30;
const thighLength = 50;
const shinLength = 46;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toDegrees(radians) {
  return radians * 180 / Math.PI;
}

function pedalPoint(angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return {
    x: crankCenter.x + Math.cos(rad) * crankRadius,
    y: crankCenter.y + Math.sin(rad) * crankRadius
  };
}

function solveLeg(hipPoint, targetPoint, bendSign) {
  const dx = targetPoint.x - hipPoint.x;
  const dy = targetPoint.y - hipPoint.y;
  const distance = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
  const maxReach = thighLength + shinLength - 0.001;
  const minReach = Math.abs(thighLength - shinLength) + 0.001;
  const clampedDistance = clamp(distance, minReach, maxReach);
  const base = Math.atan2(dy, dx);
  const cosA = clamp((thighLength * thighLength + clampedDistance * clampedDistance - shinLength * shinLength) / (2 * thighLength * clampedDistance), -1, 1);
  const angleA = Math.acos(cosA);
  const upperGlobal = base + bendSign * angleA;
  const knee = {
    x: hipPoint.x + Math.cos(upperGlobal) * thighLength,
    y: hipPoint.y + Math.sin(upperGlobal) * thighLength
  };
  const shinGlobal = Math.atan2(targetPoint.y - knee.y, targetPoint.x - knee.x);
  const upperRotation = toDegrees(upperGlobal - Math.PI / 2);
  const lowerRotation = toDegrees(shinGlobal - upperGlobal);
  const footRotation = clamp(-(upperRotation + lowerRotation) * 0.25, -22, 22);
  return { upperRotation, lowerRotation, footRotation };
}

function state(time) {
  const wheelSpin = time * 720;
  const crankSpin = time * 360;
  const nearPedal = pedalPoint(90 + crankSpin);
  const farPedal = pedalPoint(270 + crankSpin);
  const nearLeg = solveLeg(hip, nearPedal, -1);
  const farLeg = solveLeg(hip, farPedal, -1);
  const bob = Math.sin((time / 4) * Math.PI * 4) * 1.8;
  return {
    time,
    set: {
      bike: { position: [80 + time * 105, bob] },
      rear_wheel_spokes: { rotation: wheelSpin },
      front_wheel_spokes: { rotation: wheelSpin },
      crank: { rotation: crankSpin },
      near_leg: { rotation: nearLeg.upperRotation },
      near_leg_lower: { rotation: nearLeg.lowerRotation },
      near_leg_foot: { rotation: nearLeg.footRotation },
      far_leg: { rotation: farLeg.upperRotation },
      far_leg_lower: { rotation: farLeg.lowerRotation },
      far_leg_foot: { rotation: farLeg.footRotation },
      near_arm: { rotation: 2 },
      near_arm_lower: { rotation: -10 },
      far_arm: { rotation: 2 },
      far_arm_lower: { rotation: -8 },
      torso: { rotation: 0 },
      head: { position: [396, 185 + Math.sin((time / 4) * Math.PI * 4) * 0.8] }
    }
  };
}

const states = [];
for (let index = 0; index <= 16; index += 1) states.push(state(index * 0.25));

const animated = compileKeyframeStates(document, states, {
  defaultCurve: timelineCurvePreset("linear")
});

const outPath = path.join(__dirname, "keypose-cycle.visual.json");
fs.writeFileSync(outPath, JSON.stringify(animated, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
