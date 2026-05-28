const fs = require("fs");
const path = require("path");

const imgPath = path.join(__dirname, "..", "couple-dock.jpg");
const imgBase64 = fs.readFileSync(imgPath).toString("base64");
const imgDataUri = `data:image/jpeg;base64,${imgBase64}`;

const width = 1080;
const height = 1350;
const duration = 5;

const font = "Helvetica Neue, Helvetica, Arial, sans-serif";

const colors = {
  bg: "#fafaf7",
  ink: "#1a1a1a",
  red: "#c41e1e"
};

const curve = { type: "cubicBezier", x1: 0.4, y1: 0, x2: 0.2, y2: 1 };

const elements = [];

// Background
elements.push({
  id: "bg",
  type: "path",
  d: `M 0 0 H ${width} V ${height} H 0 Z`,
  fill: colors.bg,
  stroke: "none"
});

// Thin vertical line from top, stopping above the photo
// Photo will be centered at roughly y=375, so line runs from y=0 to y=300
elements.push({
  id: "vertical-line",
  type: "path",
  d: `M ${width / 2} 0 L ${width / 2} 300`,
  fill: "none",
  stroke: colors.ink,
  strokeWidth: 0.5,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 0, value: 0, out: curve },
          { time: 2.0, value: 1 }
        ]
      }
    }
  }
});

// Photo — small, centered in upper-middle area
const photoW = 600;
const photoH = 400;
const photoX = (width - photoW) / 2;
const photoY = 375;

elements.push({
  id: "photo",
  type: "image",
  src: imgDataUri,
  x: photoX,
  y: photoY,
  width: photoW,
  height: photoH,
  fit: "cover",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 2.5, value: 0, out: curve },
          { time: 4.0, value: 1 }
        ]
      }
    }
  }
});

// Vertical text "stillness" — one character per line, placed to the left of photo
const word = "stillness";
const charSize = 14;
const charSpacing = 22;
const textX = 160;
const textStartY = 400;

word.split("").forEach((char, i) => {
  elements.push({
    id: `char-${i}`,
    type: "text",
    x: textX,
    y: textStartY + i * charSpacing,
    text: char,
    align: "center",
    valign: "top",
    fontSize: charSize,
    fontFamily: font,
    weight: 300,
    letterSpacing: 0,
    fill: colors.ink,
    opacity: 0,
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: 1.2 + i * 0.1, value: 0, out: curve },
            { time: 2.0 + i * 0.1, value: 1 }
          ]
        }
      }
    }
  });
});

// Ensō-inspired red circle (imperfect, using a bezier path)
// Placed subtly in the lower-right area
const ensoX = 850;
const ensoY = 950;
const ensoR = 28;
elements.push({
  id: "enso",
  type: "path",
  d: [
    `M ${ensoX - ensoR} ${ensoY}`,
    `C ${ensoX - ensoR} ${ensoY - ensoR * 1.1} ${ensoX + ensoR * 0.9} ${ensoY - ensoR * 1.05} ${ensoX + ensoR} ${ensoY - 2}`,
    `C ${ensoX + ensoR * 1.05} ${ensoY + ensoR * 0.85} ${ensoX - ensoR * 0.1} ${ensoY + ensoR * 1.15} ${ensoX - ensoR + 3} ${ensoY + 4}`
  ].join(" "),
  fill: "none",
  stroke: colors.red,
  strokeWidth: 2,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 1.8, value: 0, out: curve },
          { time: 3.5, value: 0.92 }
        ]
      }
    }
  }
});

// Small horizontal text at bottom
elements.push({
  id: "attribution",
  type: "text",
  x: width / 2,
  y: 1280,
  text: "grow old with me — browning",
  align: "center",
  valign: "top",
  fontSize: 10,
  fontFamily: font,
  weight: 300,
  fill: colors.ink,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.0, value: 0, out: curve },
          { time: 4.5, value: 0.7 }
        ]
      }
    }
  }
});

const doc = {
  version: 1,
  canvas: { width, height, background: colors.bg, duration, fps: 30 },
  elements
};

const outPath = path.join(__dirname, "japanese-minimal.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
