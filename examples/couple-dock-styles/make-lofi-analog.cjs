const fs = require("fs");
const path = require("path");

const imgPath = path.join(__dirname, "..", "couple-dock.jpg");
const imgBase64 = fs.readFileSync(imgPath).toString("base64");
const imgDataUri = `data:image/jpeg;base64,${imgBase64}`;

const width = 1080;
const height = 1350;
const duration = 5;
const fps = 30;

const curves = {
  easeOut: { type: "cubicBezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
  bounce: { type: "cubicBezier", x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 }
};

// Polaroid dimensions
const polaroidPadSide = 40;
const polaroidPadTop = 40;
const polaroidPadBottom = 140;
const photoW = 700;
const photoH = 700;
const polaroidW = photoW + polaroidPadSide * 2;
const polaroidH = photoH + polaroidPadTop + polaroidPadBottom;

// Center polaroid on canvas
const polaroidX = (width - polaroidW) / 2;
const polaroidY = (height - polaroidH) / 2 - 20;

// Center of polaroid for origin
const polaroidCX = polaroidX + polaroidW / 2;
const polaroidCY = polaroidY + polaroidH / 2;

const elements = [];

// Background
elements.push({
  id: "bg",
  type: "path",
  d: `M 0 0 H ${width} V ${height} H 0 Z`,
  fill: "#e8e0d4",
  stroke: "none"
});

// Scattered star/asterisk shapes
const stars = [
  { id: "star-1", x: 140, y: 200, color: "#c4b8a8" },
  { id: "star-2", x: 920, y: 350, color: "#b8a898" },
  { id: "star-3", x: 180, y: 1100, color: "#d4c8b8" }
];

stars.forEach((star, i) => {
  const s = 8;
  const cx = star.x;
  const cy = star.y;
  elements.push({
    id: star.id,
    type: "path",
    d: `M ${cx - s} ${cy} L ${cx + s} ${cy} M ${cx} ${cy - s} L ${cx} ${cy + s} M ${cx - s * 0.7} ${cy - s * 0.7} L ${cx + s * 0.7} ${cy + s * 0.7} M ${cx - s * 0.7} ${cy + s * 0.7} L ${cx + s * 0.7} ${cy - s * 0.7}`,
    fill: "none",
    stroke: star.color,
    strokeWidth: 1.5,
    opacity: 0.6,
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: 0, value: 0.6 },
            { time: 1.0 + i * 0.4, value: 0.6 },
            { time: 1.5 + i * 0.4, value: 0.2, out: curves.easeOut },
            { time: 2.0 + i * 0.4, value: 0.7 },
            { time: 2.5 + i * 0.4, value: 0.3, out: curves.easeOut },
            { time: 3.0 + i * 0.4, value: 0.6 },
            { time: 4.0 + i * 0.2, value: 0.2 },
            { time: 4.5, value: 0.6 }
          ]
        }
      }
    }
  });
});

// Polaroid group (frame + photo + text)
elements.push({
  id: "polaroid-group",
  type: "group",
  x: polaroidX,
  y: polaroidY,
  rotation: 2,
  origin: [polaroidCX, polaroidCY],
  effects: {
    shadow: { dx: 4, dy: 8, blur: 20, color: "#000000", opacity: 0.15 }
  },
  opacity: 1,
  timeline: {
    tracks: {
      y: {
        keyframes: [
          { time: 0, value: polaroidY - 80, out: curves.bounce },
          { time: 0.8, value: polaroidY }
        ]
      },
      rotation: {
        keyframes: [
          { time: 0, value: 5, out: curves.easeOut },
          { time: 0.8, value: 2 }
        ]
      },
      opacity: {
        keyframes: [
          { time: 0, value: 0, out: curves.easeOut },
          { time: 0.3, value: 1 }
        ]
      }
    }
  },
  children: [
    // White polaroid frame
    {
      id: "polaroid-frame",
      type: "path",
      d: `M 0 0 H ${polaroidW} V ${polaroidH} H 0 Z`,
      fill: "#ffffff",
      stroke: "none"
    },
    // Photo inside polaroid
    {
      id: "polaroid-photo",
      type: "image",
      src: imgDataUri,
      x: polaroidPadSide,
      y: polaroidPadTop,
      width: photoW,
      height: photoH,
      fit: "cover",
      opacity: 0,
      timeline: {
        tracks: {
          opacity: {
            keyframes: [
              { time: 0.8, value: 0, out: curves.easeOut },
              { time: 1.4, value: 1 }
            ]
          }
        }
      }
    },
    // Handwritten text on polaroid bottom
    {
      id: "polaroid-text",
      type: "text",
      x: polaroidW / 2,
      y: polaroidPadTop + photoH + 70,
      text: "grow old with me ♡",
      align: "center",
      valign: "middle",
      fontSize: 28,
      fontFamily: "Georgia, 'Times New Roman', serif",
      weight: 400,
      fill: "#3d3530",
      opacity: 0,
      timeline: {
        tracks: {
          opacity: {
            keyframes: [
              { time: 1.4, value: 0, out: curves.easeOut },
              { time: 2.0, value: 1 }
            ]
          }
        }
      }
    },
    // Date stamp top-right
    {
      id: "date-stamp",
      type: "text",
      x: polaroidW - 55,
      y: polaroidPadTop + 20,
      text: "05 / 2026",
      align: "right",
      valign: "top",
      fontSize: 11,
      fontFamily: "SFMono-Regular, Menlo, monospace",
      weight: 400,
      fill: "#8b7e6f",
      rotation: 3,
      origin: [polaroidW - 55, polaroidPadTop + 20],
      opacity: 0,
      timeline: {
        tracks: {
          opacity: {
            keyframes: [
              { time: 1.6, value: 0, out: curves.easeOut },
              { time: 2.2, value: 1 }
            ]
          }
        }
      }
    }
  ]
});

// Tape across top of polaroid
const tapeX = polaroidX + polaroidW / 2 - 50;
const tapeY = polaroidY - 10;

elements.push({
  id: "tape",
  type: "path",
  d: `M ${tapeX} ${tapeY} H ${tapeX + 100} V ${tapeY + 30} H ${tapeX} Z`,
  fill: "#f0e8d0",
  stroke: "none",
  opacity: 0.7,
  rotation: -5,
  origin: [tapeX + 50, tapeY + 15],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0, value: 0, out: curves.easeOut },
          { time: 0.5, value: 0.7 }
        ]
      }
    }
  }
});

// Bottom text outside polaroid
elements.push({
  id: "bottom-text",
  type: "text",
  x: width / 2,
  y: polaroidY + polaroidH + 60,
  text: "the best is yet to be — browning",
  align: "center",
  valign: "top",
  fontSize: 12,
  fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
  weight: 400,
  fill: "#8b7e6f",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 2.2, value: 0, out: curves.easeOut },
          { time: 2.8, value: 1 }
        ]
      }
    }
  }
});

const doc = {
  version: 1,
  canvas: { width, height, background: "#e8e0d4", duration, fps },
  elements
};

const outPath = path.join(__dirname, "lofi-analog.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
