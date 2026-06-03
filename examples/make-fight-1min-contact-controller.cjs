const fs = require("node:fs");
const path = require("node:path");

const outputPath = path.join(__dirname, "fight-1min-contact-controller.visual.json");

const W = 960;
const H = 540;
const DURATION = 60;
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
  bodyPunch: {
    nearHand: [108, 270],
    farHand: [32, 240],
    nearFoot: [44, FOOT_Y],
    farFoot: [-34, FOOT_Y],
    body: 10
  },
  blockHigh: {
    nearHand: [54, 188],
    farHand: [42, 210],
    nearFoot: [34, FOOT_Y],
    farFoot: [-44, FOOT_Y],
    body: -3
  },
  blockBody: {
    nearHand: [54, 260],
    farHand: [42, 244],
    nearFoot: [34, FOOT_Y],
    farFoot: [-44, FOOT_Y],
    body: -6
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
  frontKick: {
    nearHand: [-22, 240],
    farHand: [20, 246],
    nearFoot: [138, 314],
    farFoot: [-30, FOOT_Y],
    nearFootAngle: 8,
    body: 10
  },
  roundhouseKick: {
    nearHand: [-26, 238],
    farHand: [22, 250],
    nearFoot: [142, 292],
    farFoot: [-34, FOOT_Y],
    nearFootAngle: 18,
    body: 14
  },
  lowKick: {
    nearHand: [-18, 242],
    farHand: [20, 250],
    nearFoot: [122, 382],
    farFoot: [-30, FOOT_Y],
    nearFootAngle: -12,
    body: 6
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
  fallBack: {
    nearHand: [-70, 268],
    farHand: [-36, 284],
    nearFoot: [52, FOOT_Y],
    farFoot: [-82, 410],
    nearFootAngle: -18,
    farFootAngle: -10,
    body: -72
  },
  down: {
    nearHand: [-56, 360],
    farHand: [8, 370],
    nearFoot: [72, 414],
    farFoot: [-74, 414],
    nearFootAngle: 0,
    farFootAngle: 0,
    body: -92
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

const fighterAFrames = [];
const fighterBFrames = [];
const impactSpecs = [];

function addFrame(frames, time, action, x, y = 0, shadowScale = 1, shadowOpacity = 0.22) {
  frames.push(compileActionFrame(Number(time.toFixed(3)), action, Number(x.toFixed(2)), y, shadowScale, shadowOpacity));
}

function addImpact(id, x, y, time, radius) {
  impactSpecs.push({ id, x, y, time: Number(time.toFixed(3)), radius });
}

function framesFor(who) {
  return who === "A" ? fighterAFrames : fighterBFrames;
}

function directionFor(who) {
  return who === "A" ? 1 : -1;
}

function otherFighter(who) {
  return who === "A" ? "B" : "A";
}

function guard(who, time, x, y = 0) {
  addFrame(framesFor(who), time, "guard", x, y);
}

function stepToward(who, time, x, distance = 30) {
  addFrame(framesFor(who), time, "step", x + directionFor(who) * distance);
}

function jab(who, time, target) {
  addFrame(framesFor(who), time, "punch", target.attackerX, 0, 1.04, 0.24);
  impactFlash({ id: `${target.id}.jab`, point: target.point, time, radius: 20 });
}

function blockHigh(who, time, x) {
  addFrame(framesFor(who), time, "blockHigh", x, 0, 1.04, 0.24);
}

function frontKick(who, time, target) {
  addFrame(framesFor(who), time, "frontKick", target.attackerX, -4, 0.9, 0.18);
  impactFlash({ id: `${target.id}.frontKick`, point: target.point, time, radius: 30 });
}

function roundhouseKick(who, time, target) {
  addFrame(framesFor(who), time, "roundhouseKick", target.attackerX, -4, 0.88, 0.17);
  impactFlash({ id: `${target.id}.roundhouse`, point: target.point, time, radius: 32 });
}

function flyingKick(who, time, target) {
  addFrame(framesFor(who), time - 0.26, "flyingWind", target.windX, -28, 0.78, 0.14);
  addFrame(framesFor(who), time, "flyingKick", target.attackerX, -78, 0.54, 0.1);
  addFrame(framesFor(who), time + 0.34, "flyingLand", target.landX, 10, 1.16, 0.3);
  impactFlash({ id: `${target.id}.flyingKick`, point: target.point, time, radius: 36 });
}

function hitReact(who, time, direction, x, y = -2) {
  addFrame(framesFor(who), time, "hitReact", x + direction * 18, y, 0.9, 0.18);
}

function staggerBack(who, time, direction, x) {
  addFrame(framesFor(who), time, "recover", x + direction * 34, 0, 0.96, 0.2);
}

function recover(who, time, x) {
  addFrame(framesFor(who), time, "recover", x, 0, 0.98, 0.21);
}

function fallBack(who, time, direction, x, y = 48) {
  addFrame(framesFor(who), time, "fallBack", x + direction * 30, y, 0.86, 0.18);
}

function stayDown(who, time, x, y = 86) {
  addFrame(framesFor(who), time, "down", x, y, 0.78, 0.14);
}

function impactFlash({ id, point, time, radius }) {
  addImpact(id, point[0], point[1], time, radius);
}

function addGuard(time, aX, bX) {
  guard("A", time, aX);
  guard("B", time, bX);
}

function addCombo(base, index, attacker) {
  const aStarts = [305, 318, 336, 312, 348, 328];
  const bStarts = [635, 622, 604, 628, 592, 612];
  const aX = aStarts[index % aStarts.length];
  const bX = bStarts[index % bStarts.length];
  const kind = index % 6;
  const aAttacks = attacker === "A";
  const defender = otherFighter(attacker);
  const attackStart = aAttacks ? aX : bX;
  const defendStart = aAttacks ? bX : aX;
  const direction = aAttacks ? 1 : -1;
  const close = (amount) => attackStart + direction * amount;
  const retreat = (amount) => defendStart + direction * amount;
  const impactX = aAttacks ? close(124) : close(-124);
  const target = (name, x, y, attackerAmount, landAmount = 118) => ({
    id: `impact${index}.${name}`,
    point: [x, y],
    attackerX: close(attackerAmount),
    windX: close(48),
    landX: close(landAmount)
  });

  guard(attacker, base, attackStart);
  guard(defender, base, defendStart);
  stepToward(attacker, base + 0.14, attackStart, 28);
  guard(defender, base + 0.14, defendStart - direction * 10);

  if (kind === 0) {
    const hitTime = base + 0.36;
    jab(attacker, hitTime, target("jab", impactX, 210, 88));
    blockHigh(defender, hitTime, defendStart - direction * 28);
  } else if (kind === 1) {
    const hitTime = base + 0.34;
    addFrame(framesFor(attacker), hitTime, "bodyPunch", close(92), 0, 1.04, 0.24);
    addFrame(framesFor(defender), hitTime, "blockBody", defendStart - direction * 26, 0, 1.02, 0.23);
    impactFlash({ id: `impact${index}.body`, point: [impactX, 274], time: hitTime, radius: 22 });
  } else if (kind === 2) {
    const hitTime = base + 0.48;
    addFrame(framesFor(attacker), hitTime - 0.18, "kickWind", close(46), -2, 0.94, 0.2);
    frontKick(attacker, hitTime, target("frontKick", impactX, 314, 76));
    hitReact(defender, hitTime, direction, retreat(28));
  } else if (kind === 3) {
    const hitTime = base + 0.46;
    addFrame(framesFor(attacker), hitTime - 0.16, "kickWind", close(44), -2, 0.94, 0.2);
    roundhouseKick(attacker, hitTime, target("roundhouse", impactX, 292, 74));
    hitReact(defender, hitTime, direction, retreat(34));
  } else if (kind === 4) {
    const hitTime = base + 0.56;
    flyingKick(attacker, hitTime, target("flying", impactX, 252, 82, 118));
    hitReact(defender, hitTime, direction, retreat(46), -8);
  } else {
    const hitTime = base + 0.42;
    addFrame(framesFor(attacker), hitTime - 0.14, "kickWind", close(40), -2, 0.94, 0.2);
    addFrame(framesFor(attacker), hitTime, "lowKick", close(70), -2, 0.92, 0.18);
    hitReact(defender, hitTime, direction, retreat(30), 0);
    impactFlash({ id: `impact${index}.lowKick`, point: [impactX, 382], time: hitTime, radius: 24 });
  }

  recover(attacker, base + 0.82, close(46));
  staggerBack(defender, base + 0.82, direction, retreat(26));
  guard(attacker, base + 1.18, close(10));
  guard(defender, base + 1.18, defendStart - direction * 8);
  guard(attacker, base + 1.95, attackStart);
  guard(defender, base + 1.95, defendStart);
}

const COMBO_DURATION = 2.15;
const COMBO_COUNT = Math.floor((DURATION - 5) / COMBO_DURATION);
addGuard(0, 305, 635);
for (let index = 0; index < COMBO_COUNT; index += 1) {
  addCombo(0.28 + index * COMBO_DURATION, index, index % 2 === 0 ? "A" : "B");
}

const finale = DURATION - 4.6;
guard("A", finale, 390);
guard("B", finale, 640);
stepToward("A", finale + 0.18, 390, 34);
guard("B", finale + 0.18, 628);
flyingKick("A", finale + 0.68, {
  id: "finale",
  point: [610, 252],
  attackerX: 472,
  windX: 430,
  landX: 535
});
hitReact("B", finale + 0.68, 1, 655, -10);
staggerBack("B", finale + 1.04, 1, 680);
fallBack("B", finale + 1.42, 1, 705, 52);
stayDown("B", finale + 2.08, 735, 88);
guard("A", finale + 1.6, 545);
guard("A", DURATION, 520);
stayDown("B", DURATION, 735, 88);

fighterAFrames.sort((a, b) => a.time - b.time);
fighterBFrames.sort((a, b) => a.time - b.time);
impactSpecs.sort((a, b) => a.time - b.time);

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
    ...impactSpecs.map((spec) => impact(spec.id, spec.x, spec.y, spec.time, spec.radius)),
    {
      id: "title",
      type: "text",
      text: "Fast one-minute fight from named actions + IK",
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
