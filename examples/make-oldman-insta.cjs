const fs = require("fs");
const path = require("path");

const imgPath = path.join(__dirname, "oldman.jpg");
const imgBase64 = fs.readFileSync(imgPath).toString("base64");
const imgDataUri = `data:image/jpeg;base64,${imgBase64}`;

const width = 1080;
const height = 1350;
const duration = 4;

const serif = "Playfair Display, Didot, Bodoni MT, Georgia, serif";
const sans = "Neue Haas Grotesk, Helvetica Neue, Arial, sans-serif";
const mono = "Courier New, Courier, monospace";

const colors = {
  offwhite: "#faf8f5",
  cream: "#f2ede6",
  ink: "#1a1a18",
  warmGray: "#8c8578",
  softBlack: "#2c2a26",
  filmBorder: "#e8e3dc",
  accent: "#c4a87d",
  red: "#c43d3d"
};

const curves = {
  smooth: { type: "cubicBezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  easeOut: { type: "cubicBezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
  gentle: { type: "cubicBezier", x1: 0.4, y1: 0, x2: 0.2, y2: 1 },
  snap: { type: "cubicBezier", x1: 0.68, y1: -0.6, x2: 0.32, y2: 1.6 }
};

const elements = [];

// Cream canvas border (magazine page feel)
elements.push({
  id: "page-bg",
  type: "path",
  d: `M 0 0 H ${width} V ${height} H 0 Z`,
  fill: colors.cream,
  stroke: "none"
});

// Photo with editorial crop
const photoX = 65;
const photoY = 180;
const photoW = 950;
const photoH = 750;

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
          { time: 0.3, value: 0, out: curves.gentle },
          { time: 1.2, value: 1 }
        ]
      },
      scale: {
        keyframes: [
          { time: 0.3, value: 1.03, out: curves.gentle },
          { time: 1.8, value: 1 }
        ]
      }
    }
  }
});

// Thin border around photo
elements.push({
  id: "photo-border",
  type: "path",
  d: `M ${photoX} ${photoY} H ${photoX + photoW} V ${photoY + photoH} H ${photoX} Z`,
  fill: "none",
  stroke: colors.ink,
  strokeWidth: 0.8,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.0, value: 0, out: curves.smooth },
          { time: 1.5, value: 1 }
        ]
      }
    }
  }
});

// --- TOP HEADER ---
// Top rule — draws on
elements.push({
  id: "rule-top",
  type: "path",
  d: `M 65 60 L 1015 60`,
  fill: "none",
  stroke: colors.ink,
  strokeWidth: 0.5,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 0, value: 0, out: curves.easeOut },
          { time: 0.8, value: 1 }
        ]
      }
    }
  }
});

// Date stamp
elements.push({
  id: "date-stamp",
  type: "text",
  x: 65,
  y: 42,
  text: "28 . 05 . 2026",
  align: "left",
  valign: "middle",
  fontSize: 11,
  fontFamily: mono,
  weight: 400,
  letterSpacing: 2,
  fill: colors.warmGray,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.4, value: 0, out: curves.smooth },
          { time: 0.9, value: 1 }
        ]
      }
    }
  }
});

// Vol stamp
elements.push({
  id: "vol-stamp",
  type: "text",
  x: 1015,
  y: 42,
  text: "VOL. VII",
  align: "right",
  valign: "middle",
  fontSize: 11,
  fontFamily: mono,
  weight: 400,
  letterSpacing: 2,
  fill: colors.warmGray,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.5, value: 0, out: curves.smooth },
          { time: 1.0, value: 1 }
        ]
      }
    }
  }
});

// Masthead — fades in + subtle rise
elements.push({
  id: "masthead",
  type: "text",
  x: width / 2,
  y: 105,
  text: "STILL WATERS",
  align: "center",
  valign: "middle",
  fontSize: 52,
  fontFamily: serif,
  weight: 400,
  letterSpacing: 14,
  fill: colors.ink,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.1, value: 0, out: curves.gentle },
          { time: 0.7, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 0.1, value: 115, out: curves.easeOut },
          { time: 0.7, value: 105 }
        ]
      }
    }
  }
});

// Rule below masthead — draws on
elements.push({
  id: "rule-masthead",
  type: "path",
  d: `M 65 140 L 1015 140`,
  fill: "none",
  stroke: colors.ink,
  strokeWidth: 0.3,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 0.6, value: 0, out: curves.easeOut },
          { time: 1.4, value: 1 }
        ]
      }
    }
  }
});

// Subtitle
elements.push({
  id: "subtitle",
  type: "text",
  x: width / 2,
  y: 160,
  text: "A VISUAL DIARY",
  align: "center",
  valign: "middle",
  fontSize: 10,
  fontFamily: sans,
  weight: 400,
  letterSpacing: 5,
  fill: colors.warmGray,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.8, value: 0, out: curves.smooth },
          { time: 1.3, value: 1 }
        ]
      }
    }
  }
});

// --- FILM SPROCKET HOLES (staggered fade-in) ---
for (let i = 0; i < 8; i++) {
  const sy = photoY + 30 + i * 90;
  const delay = 0.8 + i * 0.08;

  elements.push({
    id: `sprocket-l-${i}`,
    type: "path",
    d: roundedRect(42, sy, 14, 22, 3),
    fill: "none",
    stroke: colors.filmBorder,
    strokeWidth: 0.8,
    opacity: 0,
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: delay, value: 0, out: curves.smooth },
            { time: delay + 0.3, value: 1 }
          ]
        }
      }
    }
  });

  elements.push({
    id: `sprocket-r-${i}`,
    type: "path",
    d: roundedRect(1024, sy, 14, 22, 3),
    fill: "none",
    stroke: colors.filmBorder,
    strokeWidth: 0.8,
    opacity: 0,
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: delay + 0.05, value: 0, out: curves.smooth },
            { time: delay + 0.35, value: 1 }
          ]
        }
      }
    }
  });
}

// --- BOTTOM EDITORIAL TEXT ---

// Bottom divider — draws on
elements.push({
  id: "rule-bottom",
  type: "path",
  d: `M 65 960 L 1015 960`,
  fill: "none",
  stroke: colors.ink,
  strokeWidth: 0.3,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 1.6, value: 0, out: curves.easeOut },
          { time: 2.4, value: 1 }
        ]
      }
    }
  }
});

// Pull quote — rises in with fade
elements.push({
  id: "pull-quote",
  type: "text",
  x: 80,
  y: 1000,
  text: "He stood where the world\ngrew quiet, and listened.",
  align: "left",
  valign: "top",
  fontSize: 44,
  fontFamily: serif,
  weight: 400,
  fontStyle: "italic",
  lineHeight: 1.25,
  fill: colors.ink,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.8, value: 0, out: curves.gentle },
          { time: 2.5, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 1.8, value: 1020, out: curves.easeOut },
          { time: 2.5, value: 1000 }
        ]
      }
    }
  }
});

// Attribution dash — draws on
elements.push({
  id: "attrib-dash",
  type: "path",
  d: "M 80 1130 L 120 1130",
  fill: "none",
  stroke: colors.ink,
  strokeWidth: 1,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 2.5, value: 0, out: curves.easeOut },
          { time: 2.9, value: 1 }
        ]
      }
    }
  }
});

// Attribution text
elements.push({
  id: "attrib-text",
  type: "text",
  x: 134,
  y: 1130,
  text: "somewhere by the sea",
  align: "left",
  valign: "middle",
  fontSize: 13,
  fontFamily: sans,
  weight: 400,
  fontStyle: "italic",
  fill: colors.warmGray,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 2.6, value: 0, out: curves.smooth },
          { time: 3.1, value: 1 }
        ]
      }
    }
  }
});

// Page number
elements.push({
  id: "page-num",
  type: "text",
  x: 1015,
  y: 1300,
  text: "47",
  align: "right",
  valign: "middle",
  fontSize: 14,
  fontFamily: serif,
  weight: 400,
  fill: colors.warmGray,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.0, value: 0, out: curves.smooth },
          { time: 3.4, value: 1 }
        ]
      }
    }
  }
});

// Red dot — pops in with scale
elements.push({
  id: "red-dot",
  type: "path",
  d: circlePath(1015, 1260, 4),
  fill: colors.red,
  stroke: "none",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.2, value: 0, out: curves.snap },
          { time: 3.4, value: 1 }
        ]
      },
      scale: {
        keyframes: [
          { time: 3.2, value: 0, out: curves.snap },
          { time: 3.4, value: 1 }
        ]
      }
    }
  }
});

// Fine print
elements.push({
  id: "fine-print",
  type: "text",
  x: 65,
  y: 1300,
  text: "PHOTOGRAPHED ON LOCATION",
  align: "left",
  valign: "middle",
  fontSize: 8,
  fontFamily: sans,
  weight: 400,
  letterSpacing: 3,
  fill: colors.warmGray,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.0, value: 0, out: curves.smooth },
          { time: 3.5, value: 1 }
        ]
      }
    }
  }
});

// Final bottom rule — draws on last
elements.push({
  id: "rule-final",
  type: "path",
  d: `M 65 1325 L 1015 1325`,
  fill: "none",
  stroke: colors.ink,
  strokeWidth: 0.5,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 3.2, value: 0, out: curves.easeOut },
          { time: 3.8, value: 1 }
        ]
      }
    }
  }
});

const doc = {
  version: 1,
  canvas: { width, height, background: colors.offwhite, duration, fps: 30 },
  elements
};

const outPath = path.join(__dirname, "oldman-insta.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);

function roundedRect(x, y, w, h, r) {
  return [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z"
  ].join(" ");
}

function circlePath(cx, cy, r) {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
}
