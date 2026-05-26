const fs = require("node:fs");
const path = require("node:path");

const width = 1280;
const height = 720;
const duration = 6;
const fps = 30;

function pathElement(id, d, style = {}) {
  return { id, type: "path", d, ...style };
}

function textElement(id, x, y, text, style = {}) {
  return { id, type: "text", x, y, text, ...style };
}

function rectPath(x, y, w, h) {
  return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
}

function roundedRectPath(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return [
    `M ${x + rr} ${y}`,
    `H ${x + w - rr}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `V ${y + h - rr}`,
    `Q ${x + w} ${y + h} ${x + w - rr} ${y + h}`,
    `H ${x + rr}`,
    `Q ${x} ${y + h} ${x} ${y + h - rr}`,
    `V ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    "Z"
  ].join(" ");
}

function imageDataUri(filePath) {
  const bytes = fs.readFileSync(filePath);
  const base64 = bytes.toString("base64");
  const extension = path.extname(filePath).toLowerCase();
  const mime = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${base64}`;
}

const sourceFile = path.join(__dirname, "image.jpg");
if (!fs.existsSync(sourceFile)) throw new Error(`Expected image file at ${sourceFile}`);
const embeddedImage = imageDataUri(sourceFile);

const doc = {
  version: 1,
  canvas: {
    width,
    height,
    background: "#0b1020",
    duration,
    fps
  },
  elements: [
    pathElement("bg_top", rectPath(0, 0, width, height * 0.55), { fill: "#0f172a" }),
    pathElement("bg_bottom", rectPath(0, height * 0.55, width, height * 0.45), { fill: "#111827" }),

    pathElement("frame_shadow", roundedRectPath(218, 114, 844, 494, 24), { fill: "#000000", opacity: 0.28 }),
    pathElement("frame_outer", roundedRectPath(204, 100, 844, 494, 24), {
      fill: "#f8fafc",
      stroke: "#cbd5e1",
      strokeWidth: 3
    }),
    pathElement("frame_inner", roundedRectPath(232, 128, 788, 438, 18), {
      fill: "#0f172a",
      stroke: "#1f2937",
      strokeWidth: 2
    }),

    {
      id: "photo",
      type: "image",
      src: embeddedImage,
      x: 246,
      y: 142,
      width: 760,
      height: 410,
      fit: "cover",
      timeline: {
        tracks: {
          position: {
            keyframes: [
              [0, [246, 142]],
              [1.5, [238, 136]],
              [3, [252, 148]],
              [4.5, [240, 138]],
              [6, [246, 142]]
            ]
          },
          scale: {
            keyframes: [
              [0, 1],
              [2, 1.05],
              [4, 1.08],
              [6, 1]
            ]
          },
          rotation: {
            keyframes: [
              [0, 0],
              [1.5, 1.2],
              [3, -0.8],
              [4.5, 0.9],
              [6, 0]
            ]
          },
          opacity: {
            keyframes: [
              [0, 0.25],
              [0.4, 1],
              [5.6, 1],
              [6, 0.65]
            ]
          }
        }
      }
    },

    textElement("title", width / 2, 54, "Image Element Sample", {
      align: "center",
      fontSize: 38,
      weight: 800,
      fill: "#e2e8f0",
      fontFamily: "Inter, system-ui, sans-serif"
    }),
    textElement("sub", width / 2, 86, "uses examples/image.jpg embedded as data URI", {
      align: "center",
      fontSize: 15,
      fill: "#93c5fd",
      fontFamily: "monospace"
    })
  ]
};

const outPath = path.join(__dirname, "image-sample.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath}`);
