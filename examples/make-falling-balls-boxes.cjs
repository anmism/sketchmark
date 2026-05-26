const fs = require("node:fs");
const path = require("node:path");

const width = 960;
const height = 540;
const groundY = 430;
const duration = 8;
const fps = 60;

function pathElement(id, d, style = {}) {
  return { id, type: "path", d, ...style };
}

function group(id, x, y, children, extra = {}) {
  return { id, type: "group", x, y, children, ...extra };
}

function circlePath(cx, cy, r) {
  const c = Math.round(r * 0.5522847498 * 1000) / 1000;
  return [
    `M ${cx + r} ${cy}`,
    `C ${cx + r} ${cy + c} ${cx + c} ${cy + r} ${cx} ${cy + r}`,
    `C ${cx - c} ${cy + r} ${cx - r} ${cy + c} ${cx - r} ${cy}`,
    `C ${cx - r} ${cy - c} ${cx - c} ${cy - r} ${cx} ${cy - r}`,
    `C ${cx + c} ${cy - r} ${cx + r} ${cy - c} ${cx + r} ${cy}`,
    "Z"
  ].join(" ");
}

function rectPathCentered(w, h) {
  const x = -w / 2;
  const y = -h / 2;
  return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
}

function rounded(n, digits) {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function makeBounceTracks(options) {
  const dt = 1 / 30;
  const gravity = options.gravity ?? 1650;
  const restitution = options.restitution ?? 0.58;
  const restSpeed = options.restSpeed ?? 24;
  const delay = options.delay ?? 0;
  const baseX = options.x;
  const floorY = options.floorY;

  let x = baseX;
  let y = options.startY;
  let vy = 0;
  let rotation = options.rotationStart ?? 0;
  let spin = options.spin ?? 0;
  let atRest = false;

  const positionKeyframes = [];
  const rotationKeyframes = [];

  for (let t = 0; t <= duration + 0.0001; t += dt) {
    const activeT = Math.max(0, t - delay);

    if (!atRest && activeT > 0) {
      vy += gravity * dt;
      y += vy * dt;
      rotation += spin * dt;

      if (y >= floorY) {
        y = floorY;
        vy = -vy * restitution;
        spin *= 0.72;
        if (Math.abs(vy) < restSpeed) {
          vy = 0;
          atRest = true;
        }
      }
    }

    if (options.driftAmp) {
      const sway = Math.sin(activeT * (options.driftFreq ?? 4.5)) * options.driftAmp;
      const damp = Math.exp(-activeT * (options.driftDamp ?? 0.5));
      x = baseX + sway * damp;
    } else {
      x = baseX;
    }

    positionKeyframes.push([rounded(t, 3), [rounded(x, 2), rounded(y, 2)]]);
    rotationKeyframes.push([rounded(t, 3), rounded(rotation, 2)]);
  }

  return {
    position: positionKeyframes,
    rotation: rotationKeyframes
  };
}

function makeBall(id, x, radius, color, delay) {
  const tracks = makeBounceTracks({
    x,
    startY: -120 - radius * 1.4,
    floorY: groundY - radius,
    delay,
    restitution: 0.6,
    spin: 130 + radius * 0.8,
    driftAmp: 16,
    driftFreq: 3.2 + radius * 0.03,
    driftDamp: 0.35
  });

  return group(
    id,
    x,
    -120,
    [
      pathElement(`${id}_body`, circlePath(0, 0, radius), {
        fill: color,
        stroke: "#0f172a",
        strokeWidth: 2
      }),
      pathElement(`${id}_shine`, circlePath(-radius * 0.34, -radius * 0.34, radius * 0.26), {
        fill: "#ffffff",
        opacity: 0.33
      })
    ],
    {
      origin: [0, 0],
      timeline: {
        tracks: {
          position: { keyframes: tracks.position },
          rotation: { keyframes: tracks.rotation }
        }
      }
    }
  );
}

function makeBox(id, x, size, color, delay) {
  const tracks = makeBounceTracks({
    x,
    startY: -170 - size * 0.8,
    floorY: groundY - size / 2,
    delay,
    restitution: 0.44,
    spin: 190 + size * 0.9,
    driftAmp: 10,
    driftFreq: 3.8,
    driftDamp: 0.55
  });

  const half = size / 2;
  const inset = size * 0.17;
  const inner = half - inset;

  return group(
    id,
    x,
    -170,
    [
      pathElement(`${id}_body`, rectPathCentered(size, size), {
        fill: color,
        stroke: "#111827",
        strokeWidth: 2
      }),
      pathElement(
        `${id}_mark`,
        `M ${-inner} ${-inner} L ${inner} ${inner} M ${inner} ${-inner} L ${-inner} ${inner}`,
        {
          fill: "none",
          stroke: "#ffffff",
          strokeWidth: 1.5,
          opacity: 0.6
        }
      )
    ],
    {
      origin: [0, 0],
      timeline: {
        tracks: {
          position: { keyframes: tracks.position },
          rotation: { keyframes: tracks.rotation }
        }
      }
    }
  );
}

const document = {
  version: 1,
  canvas: {
    width,
    height,
    background: "#f8fafc",
    duration,
    fps
  },
  elements: [
    pathElement("ground_fill", `M 0 ${groundY} H ${width} V ${height} H 0 Z`, { fill: "#dbeafe" }),
    pathElement("ground_line", `M 0 ${groundY} H ${width}`, {
      fill: "none",
      stroke: "#0f172a",
      strokeWidth: 3
    }),

    makeBall("ball_blue", 130, 28, "#38bdf8", 0.00),
    makeBall("ball_green", 260, 24, "#22c55e", 0.18),
    makeBall("ball_orange", 390, 34, "#f97316", 0.35),
    makeBall("ball_pink", 540, 22, "#ec4899", 0.54),

    makeBox("box_amber", 670, 52, "#f59e0b", 0.10),
    makeBox("box_indigo", 790, 44, "#6366f1", 0.30),
    makeBox("box_teal", 890, 58, "#14b8a6", 0.52)
  ]
};

const outPath = path.join(__dirname, "falling-balls-boxes.visual.json");
fs.writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath}`);
