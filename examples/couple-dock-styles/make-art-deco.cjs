const fs = require("fs");
const path = require("path");

const imgPath = path.join(__dirname, "..", "couple-dock.jpg");
const imgBase64 = fs.readFileSync(imgPath).toString("base64");
const imgDataUri = `data:image/jpeg;base64,${imgBase64}`;

const width = 1080;
const height = 1350;
const duration = 5;

const gold = "#c9a96e";
const navy = "#1a1a2e";
const white = "#ffffff";
const muted = "#8a8a8a";

const serif = "Georgia, Times New Roman, serif";

const easeOut = { type: "cubicBezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1 };

const elements = [];

// Background
elements.push({
  id: "bg",
  type: "path",
  d: `M 0 0 H ${width} V ${height} H 0 Z`,
  fill: navy,
  stroke: "none"
});

// --- Geometric gold frame: concentric rounded rectangles ---
const frameMargins = [30, 50, 55];
frameMargins.forEach((m, i) => {
  const x1 = m;
  const y1 = m;
  const x2 = width - m;
  const y2 = height - m;
  const r = 8;
  elements.push({
    id: `frame-${i}`,
    type: "path",
    d: `M ${x1 + r} ${y1} L ${x2 - r} ${y1} Q ${x2} ${y1} ${x2} ${y1 + r} L ${x2} ${y2 - r} Q ${x2} ${y2} ${x2 - r} ${y2} L ${x1 + r} ${y2} Q ${x1} ${y2} ${x1} ${y2 - r} L ${x1} ${y1 + r} Q ${x1} ${y1} ${x1 + r} ${y1} Z`,
    fill: "none",
    stroke: gold,
    strokeWidth: 1,
    drawStart: 0,
    drawEnd: 0,
    timeline: {
      tracks: {
        drawEnd: {
          keyframes: [
            { time: 0.2 + i * 0.3, value: 0, out: easeOut },
            { time: 1.0 + i * 0.3, value: 1 }
          ]
        }
      }
    }
  });
});

// --- Corner ornaments (diamond shapes) ---
const cornerPositions = [
  { x: 70, y: 70 },
  { x: width - 70, y: 70 },
  { x: 70, y: height - 70 },
  { x: width - 70, y: height - 70 }
];
cornerPositions.forEach((pos, i) => {
  elements.push({
    id: `corner-diamond-${i}`,
    type: "path",
    d: `M ${pos.x} ${pos.y} L ${pos.x + 8} ${pos.y - 8} L ${pos.x + 16} ${pos.y} L ${pos.x + 8} ${pos.y + 8} Z`,
    fill: gold,
    stroke: "none",
    opacity: 0,
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: 1.2, value: 0, out: easeOut },
            { time: 1.6, value: 1 }
          ]
        }
      }
    }
  });
});

// --- Sunburst / fan lines above title ---
const cx = width / 2;
const sunburstCy = 320;
const numRays = 7;
const rayLength = 60;
const spreadAngle = 120; // degrees total spread
const startAngle = -(spreadAngle / 2);

for (let i = 0; i < numRays; i++) {
  const angleDeg = startAngle + (spreadAngle / (numRays - 1)) * i;
  const angleRad = (angleDeg - 90) * (Math.PI / 180);
  const x2 = cx + Math.cos(angleRad) * rayLength;
  const y2 = sunburstCy + Math.sin(angleRad) * rayLength;
  elements.push({
    id: `sunburst-${i}`,
    type: "path",
    d: `M ${cx} ${sunburstCy} L ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    fill: "none",
    stroke: gold,
    strokeWidth: 1,
    drawStart: 0,
    drawEnd: 0,
    timeline: {
      tracks: {
        drawEnd: {
          keyframes: [
            { time: 1.5, value: 0, out: easeOut },
            { time: 2.2, value: 1 }
          ]
        }
      }
    }
  });
}

// --- Decorative line with diamond above title ---
const decoLineY = 370;
const decoLineLeft = 200;
const decoLineRight = width - 200;
const decoLineMid = width / 2;

elements.push({
  id: "deco-line-top-left",
  type: "path",
  d: `M ${decoLineLeft} ${decoLineY} L ${decoLineMid - 12} ${decoLineY}`,
  fill: "none",
  stroke: gold,
  strokeWidth: 0.5,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 2.0, value: 0, out: easeOut },
          { time: 2.6, value: 1 }
        ]
      }
    }
  }
});

elements.push({
  id: "deco-line-top-diamond",
  type: "path",
  d: `M ${decoLineMid} ${decoLineY - 5} L ${decoLineMid + 5} ${decoLineY} L ${decoLineMid} ${decoLineY + 5} L ${decoLineMid - 5} ${decoLineY} Z`,
  fill: gold,
  stroke: "none",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 2.2, value: 0, out: easeOut },
          { time: 2.5, value: 1 }
        ]
      }
    }
  }
});

elements.push({
  id: "deco-line-top-right",
  type: "path",
  d: `M ${decoLineMid + 12} ${decoLineY} L ${decoLineRight} ${decoLineY}`,
  fill: "none",
  stroke: gold,
  strokeWidth: 0.5,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 2.0, value: 0, out: easeOut },
          { time: 2.6, value: 1 }
        ]
      }
    }
  }
});

// --- Title: "GROW OLD WITH ME" ---
elements.push({
  id: "title",
  type: "text",
  x: width / 2,
  y: 420,
  text: "GROW OLD WITH ME",
  align: "center",
  valign: "middle",
  fontSize: 40,
  fontFamily: serif,
  weight: 300,
  letterSpacing: 8,
  fill: gold,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 2.3, value: 0, out: easeOut },
          { time: 2.8, value: 1 }
        ]
      }
    }
  }
});

// --- Photo centered with gold border ---
const photoW = 700;
const photoH = 500;
const photoX = (width - photoW) / 2;
const photoY = 490;

// Gold border behind photo
elements.push({
  id: "photo-border",
  type: "path",
  d: `M ${photoX - 2} ${photoY - 2} H ${photoX + photoW + 2} V ${photoY + photoH + 2} H ${photoX - 2} Z`,
  fill: "none",
  stroke: gold,
  strokeWidth: 2,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 2.5, value: 0, out: easeOut },
          { time: 3.0, value: 1 }
        ]
      }
    }
  }
});

// Photo
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
          { time: 2.5, value: 0, out: easeOut },
          { time: 3.2, value: 1 }
        ]
      }
    }
  }
});

// --- Decorative line with diamond below photo ---
const decoLine2Y = 1030;

elements.push({
  id: "deco-line-bot-left",
  type: "path",
  d: `M ${decoLineLeft} ${decoLine2Y} L ${decoLineMid - 12} ${decoLine2Y}`,
  fill: "none",
  stroke: gold,
  strokeWidth: 0.5,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 3.2, value: 0, out: easeOut },
          { time: 3.8, value: 1 }
        ]
      }
    }
  }
});

elements.push({
  id: "deco-line-bot-diamond",
  type: "path",
  d: `M ${decoLineMid} ${decoLine2Y - 5} L ${decoLineMid + 5} ${decoLine2Y} L ${decoLineMid} ${decoLine2Y + 5} L ${decoLineMid - 5} ${decoLine2Y} Z`,
  fill: gold,
  stroke: "none",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.4, value: 0, out: easeOut },
          { time: 3.7, value: 1 }
        ]
      }
    }
  }
});

elements.push({
  id: "deco-line-bot-right",
  type: "path",
  d: `M ${decoLineMid + 12} ${decoLine2Y} L ${decoLineRight} ${decoLine2Y}`,
  fill: "none",
  stroke: gold,
  strokeWidth: 0.5,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 3.2, value: 0, out: easeOut },
          { time: 3.8, value: 1 }
        ]
      }
    }
  }
});

// --- Subtitle below photo ---
elements.push({
  id: "subtitle",
  type: "text",
  x: width / 2,
  y: 1080,
  text: "The Best Is Yet To Be",
  align: "center",
  valign: "middle",
  fontSize: 24,
  fontFamily: serif,
  weight: 400,
  fill: gold,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.5, value: 0, out: easeOut },
          { time: 4.0, value: 1 }
        ]
      }
    }
  }
});

// --- Author ---
elements.push({
  id: "author",
  type: "text",
  x: width / 2,
  y: 1130,
  text: "— Robert Browning —",
  align: "center",
  valign: "middle",
  fontSize: 12,
  fontFamily: serif,
  weight: 400,
  fill: muted,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.8, value: 0, out: easeOut },
          { time: 4.3, value: 1 }
        ]
      }
    }
  }
});

// --- Build document ---
const doc = {
  version: 1,
  canvas: { width, height, background: navy, duration, fps: 30 },
  elements
};

const outPath = path.join(__dirname, "art-deco.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
