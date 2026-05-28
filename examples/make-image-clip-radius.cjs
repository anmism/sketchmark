const fs = require("fs");
const path = require("path");

const width = 960;
const height = 540;
const duration = 4;
const fps = 30;

const image = {
  id: "photo",
  type: "image",
  src: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0f766e"/>
          <stop offset="0.52" stop-color="#2563eb"/>
          <stop offset="1" stop-color="#7c3aed"/>
        </linearGradient>
      </defs>
      <rect width="900" height="560" fill="url(#bg)"/>
      <circle cx="180" cy="150" r="86" fill="#fef3c7" opacity="0.9"/>
      <circle cx="710" cy="120" r="120" fill="#bae6fd" opacity="0.42"/>
      <circle cx="640" cy="415" r="180" fill="#f0abfc" opacity="0.35"/>
      <path d="M 0 410 C 160 340 260 470 430 390 C 590 315 720 395 900 330 L 900 560 L 0 560 Z" fill="#022c22" opacity="0.45"/>
      <path d="M 0 450 C 170 390 330 510 500 425 C 660 350 760 470 900 405 L 900 560 L 0 560 Z" fill="#020617" opacity="0.38"/>
      <text x="60" y="488" font-family="Arial, sans-serif" font-size="48" font-weight="800" fill="#ffffff">clip.d radius animation</text>
    </svg>
  `),
  x: 210,
  y: 116,
  width: 540,
  height: 336,
  clip: {
    type: "path",
    d: roundedRectClipPath(210, 116, 540, 336, 0)
  },
  timeline: {
    tracks: {
      "clip.d": {
        keyframes: sampledRadiusKeyframes({
          x: 210,
          y: 116,
          width: 540,
          height: 336,
          duration,
          fps: 12,
          radiusAt: (time) => {
            const loop = pingPong(time / duration);
            return 120 * easeInOut(loop);
          }
        })
      },
      opacity: {
        keyframes: [
          { time: 0, value: 0, out: curve("ease-out") },
          { time: 0.35, value: 1 }
        ]
      }
    }
  }
};

const doc = {
  version: 1,
  canvas: {
    width,
    height,
    background: "#f8fafc",
    duration,
    fps
  },
  elements: [
    {
      id: "title",
      type: "text",
      text: "Image radius is compiled to clip.d keyframes",
      x: width / 2,
      y: 54,
      align: "center",
      valign: "middle",
      fontSize: 30,
      weight: 800,
      fill: "#0f172a"
    },
    {
      id: "note",
      type: "text",
      text: "The kernel only sees an image plus animated clip path data.",
      x: width / 2,
      y: 494,
      align: "center",
      valign: "middle",
      fontSize: 18,
      fill: "#475569"
    },
    image
  ]
};

const outPath = path.join(__dirname, "image-clip-radius.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath}`);

function sampledRadiusKeyframes({ x, y, width, height, duration, fps, radiusAt }) {
  const frameCount = Math.max(1, Math.round(duration * fps));
  const frames = [];
  for (let index = 0; index <= frameCount; index += 1) {
    const time = Number(((index / frameCount) * duration).toFixed(4));
    const radius = radiusAt(time);
    frames.push({
      time,
      value: roundedRectClipPath(x, y, width, height, radius)
    });
  }
  return frames;
}

function roundedRectClipPath(x, y, width, height, radius) {
  const left = finite(x);
  const top = finite(y);
  const w = Math.max(0, finite(width));
  const h = Math.max(0, finite(height));
  const r = Math.min(Math.max(0, finite(radius)), w / 2, h / 2);
  const right = left + w;
  const bottom = top + h;

  if (r <= 0) return `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`;

  return [
    `M ${round(left + r)} ${top}`,
    `H ${round(right - r)}`,
    `Q ${right} ${top} ${right} ${round(top + r)}`,
    `V ${round(bottom - r)}`,
    `Q ${right} ${bottom} ${round(right - r)} ${bottom}`,
    `H ${round(left + r)}`,
    `Q ${left} ${bottom} ${left} ${round(bottom - r)}`,
    `V ${round(top + r)}`,
    `Q ${left} ${top} ${round(left + r)} ${top}`,
    "Z"
  ].join(" ");
}

function pingPong(value) {
  const t = Math.max(0, Math.min(1, value));
  return t <= 0.5 ? t * 2 : (1 - t) * 2;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function curve(name) {
  if (name === "ease-out") return { type: "cubicBezier", x1: 0, y1: 0, x2: 0.58, y2: 1 };
  return { type: "graph", points: [[0, 0], [1, 1]] };
}

function svgDataUri(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round(value) {
  return Number(value.toFixed(2));
}
