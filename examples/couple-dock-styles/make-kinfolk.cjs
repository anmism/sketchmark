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
  bg: "#f8f6f2",
  title: "#2c2c2c",
  subtitle: "#7a7a7a",
  author: "#aaaaaa",
  line: "#cccccc",
  dot: "#dddddd"
};

const curve = { type: "cubicBezier", x1: 0.4, y1: 0, x2: 0.2, y2: 1 };

const elements = [];

// Warm white background
elements.push({
  id: "bg",
  type: "path",
  d: `M 0 0 H ${width} V ${height} H 0 Z`,
  fill: colors.bg,
  stroke: "none"
});

// Photo — centered, moderate size, floating in whitespace
const photoW = 750;
const photoH = 550;
const photoX = (width - photoW) / 2;
const photoY = (height - photoH) / 2 - 30;

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
          { time: 0, value: 0, out: curve },
          { time: 2.5, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 0, value: photoY + 8, out: curve },
          { time: 2.5, value: photoY }
        ]
      }
    }
  }
});

// Title above photo: "grow old with me"
const titleY = photoY - 60;

elements.push({
  id: "title",
  type: "text",
  x: width / 2,
  y: titleY,
  text: "grow old with me",
  align: "center",
  valign: "middle",
  fontSize: 36,
  fontFamily: font,
  weight: 300,
  letterSpacing: 3,
  fill: colors.title,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.0, value: 0, out: curve },
          { time: 3.0, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 1.0, value: titleY + 6, out: curve },
          { time: 3.0, value: titleY }
        ]
      }
    }
  }
});

// Small dot between title and photo
const dotY = photoY - 28;

elements.push({
  id: "dot",
  type: "path",
  d: `M ${width / 2 - 1.5} ${dotY} A 1.5 1.5 0 1 1 ${width / 2 + 1.5} ${dotY} A 1.5 1.5 0 1 1 ${width / 2 - 1.5} ${dotY}`,
  fill: colors.dot,
  stroke: "none",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.5, value: 0, out: curve },
          { time: 3.5, value: 1 }
        ]
      }
    }
  }
});

// Subtitle below photo: "the best is yet to be"
const subtitleY = photoY + photoH + 50;

elements.push({
  id: "subtitle",
  type: "text",
  x: width / 2,
  y: subtitleY,
  text: "the best is yet to be",
  align: "center",
  valign: "middle",
  fontSize: 18,
  fontFamily: font,
  weight: 300,
  fontStyle: "italic",
  fill: colors.subtitle,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.5, value: 0, out: curve },
          { time: 3.5, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 1.5, value: subtitleY + 5, out: curve },
          { time: 3.5, value: subtitleY }
        ]
      }
    }
  }
});

// Thin horizontal line between subtitle and author
const lineY = subtitleY + 50;

elements.push({
  id: "line",
  type: "path",
  d: `M ${width / 2 - 60} ${lineY} L ${width / 2 + 60} ${lineY}`,
  fill: "none",
  stroke: colors.line,
  strokeWidth: 0.3,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 2.0, value: 0, out: curve },
          { time: 4.0, value: 1 }
        ]
      }
    }
  }
});

// Author credit: "browning"
const authorY = lineY + 40;

elements.push({
  id: "author",
  type: "text",
  x: width / 2,
  y: authorY,
  text: "BROWNING",
  align: "center",
  valign: "middle",
  fontSize: 10,
  fontFamily: font,
  weight: 300,
  letterSpacing: 4,
  fill: colors.author,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 2.5, value: 0, out: curve },
          { time: 4.5, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 2.5, value: authorY + 5, out: curve },
          { time: 4.5, value: authorY }
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

const outPath = path.join(__dirname, "kinfolk.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
