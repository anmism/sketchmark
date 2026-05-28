const fs = require("fs");
const path = require("path");

const imgPath = path.join(__dirname, "..", "couple-dock.jpg");
const imgBase64 = fs.readFileSync(imgPath).toString("base64");
const imgDataUri = `data:image/jpeg;base64,${imgBase64}`;

const width = 1080;
const height = 1350;
const duration = 5;

const sans = "Arial Black, Arial, Helvetica, sans-serif";
const mono = "SFMono-Regular, Menlo, Courier, monospace";

const colors = {
  bg: "#f5f0e0",
  red: "#e63946",
  blue: "#1d3557",
  yellow: "#f4a261",
  black: "#0a0a0a",
  cream: "#f5f0e0"
};

const curves = {
  snap: { type: "cubicBezier", x1: 0.68, y1: -0.6, x2: 0.32, y2: 1.6 },
  smooth: { type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 }
};

const elements = [];

// Background
elements.push({
  id: "bg",
  type: "path",
  d: `M 0 0 H ${width} V ${height} H 0 Z`,
  fill: colors.bg,
  stroke: "none"
});

// --- GRID LINES (asymmetric, thin black) ---

// Vertical line left
elements.push({
  id: "grid-v1",
  type: "path",
  d: `M 120 0 L 120 ${height}`,
  fill: "none",
  stroke: colors.black,
  strokeWidth: 1,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 0, value: 0, out: curves.smooth },
          { time: 1.2, value: 1 }
        ]
      }
    }
  }
});

// Vertical line right
elements.push({
  id: "grid-v2",
  type: "path",
  d: `M 880 0 L 880 ${height}`,
  fill: "none",
  stroke: colors.black,
  strokeWidth: 1,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 0.2, value: 0, out: curves.smooth },
          { time: 1.4, value: 1 }
        ]
      }
    }
  }
});

// Horizontal line top
elements.push({
  id: "grid-h1",
  type: "path",
  d: `M 0 320 L ${width} 320`,
  fill: "none",
  stroke: colors.black,
  strokeWidth: 1,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 0.1, value: 0, out: curves.smooth },
          { time: 1.3, value: 1 }
        ]
      }
    }
  }
});

// Horizontal line bottom
elements.push({
  id: "grid-h2",
  type: "path",
  d: `M 0 1050 L ${width} 1050`,
  fill: "none",
  stroke: colors.black,
  strokeWidth: 1,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 0.3, value: 0, out: curves.smooth },
          { time: 1.5, value: 1 }
        ]
      }
    }
  }
});

// Horizontal line mid
elements.push({
  id: "grid-h3",
  type: "path",
  d: `M 0 680 L ${width} 680`,
  fill: "none",
  stroke: colors.black,
  strokeWidth: 1,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 0.15, value: 0, out: curves.smooth },
          { time: 1.35, value: 1 }
        ]
      }
    }
  }
});

// --- GEOMETRIC SHAPES ---

// Large red circle — top-left area
const redCx = 200;
const redCy = 240;
const redR = 120;

elements.push({
  id: "red-circle",
  type: "path",
  d: `M ${redCx - redR} ${redCy} a ${redR} ${redR} 0 1 0 ${redR * 2} 0 a ${redR} ${redR} 0 1 0 ${-redR * 2} 0`,
  fill: colors.red,
  stroke: "none",
  origin: [redCx, redCy],
  scale: 0,
  timeline: {
    tracks: {
      scale: {
        keyframes: [
          { time: 0.3, value: 0, out: curves.snap },
          { time: 0.9, value: 1 }
        ]
      }
    }
  }
});

// Blue rectangle — bottom-right
const blueX = 780;
const blueY = 1050;
const blueW = 200;
const blueH = 200;

elements.push({
  id: "blue-rect",
  type: "path",
  d: `M ${blueX} ${blueY} H ${blueX + blueW} V ${blueY + blueH} H ${blueX} Z`,
  fill: colors.blue,
  stroke: "none",
  origin: [blueX + blueW / 2, blueY + blueH / 2],
  scale: 0,
  timeline: {
    tracks: {
      scale: {
        keyframes: [
          { time: 0.5, value: 0, out: curves.snap },
          { time: 1.1, value: 1 }
        ]
      }
    }
  }
});

// Yellow triangle — mid-right area
const triX1 = 900;
const triY1 = 500;
const triX2 = 1020;
const triY2 = 700;
const triX3 = 780;
const triY3 = 700;
const triCx = (triX1 + triX2 + triX3) / 3;
const triCy = (triY1 + triY2 + triY3) / 3;

elements.push({
  id: "yellow-triangle",
  type: "path",
  d: `M ${triX1} ${triY1} L ${triX2} ${triY2} L ${triX3} ${triY3} Z`,
  fill: colors.yellow,
  stroke: "none",
  origin: [triCx, triCy],
  scale: 0,
  timeline: {
    tracks: {
      scale: {
        keyframes: [
          { time: 0.7, value: 0, out: curves.snap },
          { time: 1.3, value: 1 }
        ]
      }
    }
  }
});

// --- BLACK CIRCLE OUTLINE (partially behind photo) ---
const outlineCx = 540;
const outlineCy = 620;
const outlineR = 180;

elements.push({
  id: "circle-outline",
  type: "path",
  d: `M ${outlineCx - outlineR} ${outlineCy} a ${outlineR} ${outlineR} 0 1 0 ${outlineR * 2} 0 a ${outlineR} ${outlineR} 0 1 0 ${-outlineR * 2} 0`,
  fill: "none",
  stroke: colors.black,
  strokeWidth: 3,
  origin: [outlineCx, outlineCy],
  scale: 0,
  timeline: {
    tracks: {
      scale: {
        keyframes: [
          { time: 0.6, value: 0, out: curves.snap },
          { time: 1.2, value: 1 }
        ]
      }
    }
  }
});

// --- PHOTO (angled, centered, with black border) ---
const photoW = 650;
const photoH = 500;
const photoX = (width - photoW) / 2;
const photoY = (height - photoH) / 2 - 50;
const photoCx = photoX + photoW / 2;
const photoCy = photoY + photoH / 2;

// Black border behind photo (slightly larger)
const borderPad = 4;
elements.push({
  id: "photo-border",
  type: "path",
  d: `M ${photoX - borderPad} ${photoY - borderPad} H ${photoX + photoW + borderPad} V ${photoY + photoH + borderPad} H ${photoX - borderPad} Z`,
  fill: colors.black,
  stroke: "none",
  rotation: -3,
  origin: [photoCx, photoCy],
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.8, value: 0, out: curves.smooth },
          { time: 1.5, value: 1 }
        ]
      },
      rotation: {
        keyframes: [
          { time: 0.8, value: -8, out: curves.smooth },
          { time: 1.8, value: -3 }
        ]
      }
    }
  }
});

// Photo image
elements.push({
  id: "photo",
  type: "image",
  src: imgDataUri,
  x: photoX,
  y: photoY,
  width: photoW,
  height: photoH,
  fit: "cover",
  rotation: -3,
  origin: [photoCx, photoCy],
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.8, value: 0, out: curves.smooth },
          { time: 1.5, value: 1 }
        ]
      },
      rotation: {
        keyframes: [
          { time: 0.8, value: -8, out: curves.smooth },
          { time: 1.8, value: -3 }
        ]
      }
    }
  }
});

// --- TITLE TEXT (overlaps red circle) ---
const titleX = 100;
const titleY = 180;

elements.push({
  id: "title-line1",
  type: "text",
  x: titleX,
  y: titleY,
  text: "GROW OLD",
  align: "left",
  valign: "top",
  fontSize: 72,
  fontFamily: sans,
  weight: 900,
  fill: colors.black,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.2, value: 0, out: curves.smooth },
          { time: 1.7, value: 1 }
        ]
      },
      x: {
        keyframes: [
          { time: 1.2, value: titleX - 80, out: curves.snap },
          { time: 1.7, value: titleX }
        ]
      }
    }
  }
});

elements.push({
  id: "title-line2",
  type: "text",
  x: titleX,
  y: titleY + 76,
  text: "WITH ME",
  align: "left",
  valign: "top",
  fontSize: 72,
  fontFamily: sans,
  weight: 900,
  fill: colors.black,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.4, value: 0, out: curves.smooth },
          { time: 1.9, value: 1 }
        ]
      },
      x: {
        keyframes: [
          { time: 1.4, value: titleX - 80, out: curves.snap },
          { time: 1.9, value: titleX }
        ]
      }
    }
  }
});

// --- SMALL TEXT (monospace, bottom) ---
elements.push({
  id: "credit",
  type: "text",
  x: 60,
  y: height - 40,
  text: "R. BROWNING / 2026",
  align: "left",
  valign: "bottom",
  fontSize: 10,
  fontFamily: mono,
  weight: 400,
  fill: colors.black,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.5, value: 0, out: curves.smooth },
          { time: 4.2, value: 1 }
        ]
      }
    }
  }
});

// --- BUILD DOCUMENT ---
const doc = {
  version: 1,
  canvas: { width, height, background: colors.bg, duration, fps: 30 },
  elements
};

const outPath = path.join(__dirname, "bauhaus.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
