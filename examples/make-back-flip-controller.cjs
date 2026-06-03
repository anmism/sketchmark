const fs = require("node:fs");
const path = require("node:path");

const outputPath = path.join(__dirname, "back-flip-controller.visual.json");

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
const smooth = { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
const flipEase = { type: "cubicBezier", x1: 0.2, y1: 0, x2: 0.18, y2: 1 };

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

function keyframes(values, curve = smooth) {
  return values.map(([time, value], index) => ({
    time,
    value,
    ...(index < values.length - 1 ? { out: curve } : {})
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

function makeRig() {
  return {
    id: "hero.rig",
    type: "group",
    x: 0,
    y: 0,
    origin: HIP,
    width: 170,
    height: 430,
    children: [
      arm("hero.farArm", far, 0.68),
      leg("hero.farLeg", far, 0.68),
      pathElement("hero.torso", linePath(HIP[0], HIP[1], SHOULDER[0], SHOULDER[1]), {
        stroke: dark,
        strokeWidth: 11,
        strokeCap: "round"
      }),
      pathElement("hero.neck", linePath(SHOULDER[0], SHOULDER[1], 7, 168), {
        stroke: dark,
        strokeWidth: 8,
        strokeCap: "round"
      }),
      pathElement("hero.head", ellipsePath(23, 134, 34, 34), {
        fill: "#ffffff",
        stroke: dark,
        strokeWidth: 7
      }),
      pathElement("hero.eye", ellipsePath(36, 128, 3.6, 3.6), {
        fill: dark
      }),
      leg("hero.nearLeg", dark),
      arm("hero.nearArm", dark)
    ]
  };
}

const legModes = {
  stand: { thigh: 0, shin: 0, foot: 0 },
  crouch: { thigh: -58, shin: 92, foot: -24 },
  push: { thigh: -4, shin: 8, foot: -4 },
  tuck: { thigh: -108, shin: 142, foot: -28 },
  open: { thigh: -18, shin: 16, foot: 2 }
};

const armModes = {
  balance: { upper: 48, forearm: -38 },
  crouch: { upper: -82, forearm: -36 },
  overhead: { upper: -122, forearm: -28 },
  tuck: { upper: -118, forearm: -118 },
  open: { upper: -34, forearm: -20 }
};

function createFlipController() {
  const frames = [];
  return {
    at(time) {
      const frame = {
        time,
        body: { x: 150, y: 0, rotation: 0 },
        legs: "stand",
        arms: "balance",
        shadowScale: 1,
        shadowOpacity: 0.24
      };
      frames.push(frame);
      return {
        body(values) {
          frame.body = { ...frame.body, ...values };
          return this;
        },
        legs(mode) {
          frame.legs = mode;
          return this;
        },
        arms(mode) {
          frame.arms = mode;
          return this;
        },
        shadow(values) {
          frame.shadowScale = values.scale ?? frame.shadowScale;
          frame.shadowOpacity = values.opacity ?? frame.shadowOpacity;
          return this;
        }
      };
    },
    compile() {
      return frames
        .sort((a, b) => a.time - b.time)
        .map((frame) => {
          const legs = legModes[frame.legs];
          const arms = armModes[frame.arms];
          if (!legs) throw new Error(`Unknown leg mode: ${frame.legs}`);
          if (!arms) throw new Error(`Unknown arm mode: ${frame.arms}`);
          return {
            time: frame.time,
            root: [frame.body.x, frame.body.y],
            body: frame.body.rotation,
            shadowX: frame.body.x,
            shadowScale: frame.shadowScale,
            shadowOpacity: frame.shadowOpacity,
            nearLegThigh: legs.thigh,
            nearLegShin: legs.shin,
            nearLegFoot: legs.foot,
            farLegThigh: legs.thigh,
            farLegShin: legs.shin,
            farLegFoot: legs.foot,
            nearArmUpper: arms.upper,
            nearArmForearm: arms.forearm,
            farArmUpper: arms.upper,
            farArmForearm: arms.forearm
          };
        });
    }
  };
}

const flip = createFlipController();

flip.at(0).body({ x: 150, y: 0, rotation: 0 }).legs("stand").arms("balance").shadow({ scale: 1, opacity: 0.24 });
flip.at(0.25).body({ x: 188, y: 18, rotation: 0 }).legs("crouch").arms("crouch").shadow({ scale: 1.16, opacity: 0.3 });
flip.at(0.52).body({ x: 265, y: -48, rotation: -20 }).legs("push").arms("overhead").shadow({ scale: 0.88, opacity: 0.2 });
flip.at(0.9).body({ x: 390, y: -145, rotation: -125 }).legs("tuck").arms("tuck").shadow({ scale: 0.58, opacity: 0.12 });
flip.at(1.28).body({ x: 515, y: -178, rotation: -235 }).legs("tuck").arms("tuck").shadow({ scale: 0.5, opacity: 0.1 });
flip.at(1.68).body({ x: 650, y: -92, rotation: -320 }).legs("open").arms("open").shadow({ scale: 0.76, opacity: 0.18 });
flip.at(2.03).body({ x: 735, y: 15, rotation: -360 }).legs("crouch").arms("crouch").shadow({ scale: 1.18, opacity: 0.32 });
flip.at(2.35).body({ x: 792, y: 0, rotation: -360 }).legs("stand").arms("balance").shadow({ scale: 1, opacity: 0.24 });
flip.at(DURATION).body({ x: 830, y: 0, rotation: -360 }).legs("stand").arms("balance").shadow({ scale: 1, opacity: 0.24 });

const frames = flip.compile();

function trackFor(property, curve = smooth) {
  return { keyframes: keyframes(frames.map((frame) => [frame.time, frame[property]]), curve) };
}

const rig = makeRig();
rig.timeline = { tracks: { rotation: trackFor("body", flipEase) } };

const hero = {
  id: "hero",
  type: "group",
  x: 150,
  y: 0,
  width: 170,
  height: 430,
  children: [rig],
  timeline: {
    tracks: {
      position: { keyframes: keyframes(frames.map((frame) => [frame.time, frame.root]), flipEase) }
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
    x: trackFor("shadowX", flipEase),
    scale: trackFor("shadowScale", smooth),
    opacity: trackFor("shadowOpacity", smooth)
  }
};

for (const element of rig.children) {
  if (element.id === "hero.nearLeg.thigh" || element.id === "hero.farLeg.thigh") {
    const prefix = element.id === "hero.nearLeg.thigh" ? "nearLeg" : "farLeg";
    element.timeline = { tracks: { rotation: trackFor(`${prefix}Thigh`) } };
    const shin = element.children.find((child) => child.id === element.id.replace(".thigh", ".shin"));
    const foot = shin.children.find((child) => child.id === element.id.replace(".thigh", ".foot"));
    shin.timeline = { tracks: { rotation: trackFor(`${prefix}Shin`) } };
    foot.timeline = { tracks: { rotation: trackFor(`${prefix}Foot`) } };
  }
  if (element.id === "hero.nearArm.upper" || element.id === "hero.farArm.upper") {
    const prefix = element.id === "hero.nearArm.upper" ? "nearArm" : "farArm";
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
    hero,
    {
      id: "title",
      type: "text",
      text: "Backflip from a procedural controller",
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
