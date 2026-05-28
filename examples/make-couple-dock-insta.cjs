const fs = require("fs");
const path = require("path");

const imgPath = path.join(__dirname, "couple-dock.jpg");
const imgBase64 = fs.readFileSync(imgPath).toString("base64");
const imgDataUri = `data:image/jpeg;base64,${imgBase64}`;

const width = 1080;
const height = 1350;
const duration = 5;

const grotesk = "Helvetica Neue, Helvetica, Arial, sans-serif";
const mono = "SFMono-Regular, Menlo, monospace";

const colors = {
  white: "#ffffff",
  black: "#0a0a0a",
  gray1: "#333333",
  gray2: "#666666",
  gray3: "#999999",
  gray4: "#cccccc",
  gray5: "#e6e6e6",
  red: "#e50000"
};

const curves = {
  swiss: { type: "cubicBezier", x1: 0.45, y1: 0, x2: 0.55, y2: 1 },
  precise: { type: "cubicBezier", x1: 0.22, y1: 0.68, x2: 0, y2: 1 },
  linear: { type: "cubicBezier", x1: 0, y1: 0, x2: 1, y2: 1 }
};

const elements = [];

// White background
elements.push({
  id: "bg",
  type: "path",
  d: `M 0 0 H ${width} V ${height} H 0 Z`,
  fill: colors.white,
  stroke: "none"
});

// --- GRID SYSTEM (6-column, visible) ---
const margin = 72;
const gutter = 24;
const colW = (width - margin * 2 - gutter * 5) / 6;

// Light grid columns (background structure)
for (let i = 0; i < 6; i++) {
  const cx = margin + i * (colW + gutter);
  elements.push({
    id: `col-${i}`,
    type: "path",
    d: `M ${cx} 0 H ${cx + colW} V ${height} H ${cx} Z`,
    fill: colors.gray5,
    stroke: "none",
    opacity: 0,
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: 0, value: 0, out: curves.swiss },
            { time: 0.6, value: 0.35 },
            { time: 1.2, value: 0.35, out: curves.swiss },
            { time: 1.8, value: 0 }
          ]
        }
      }
    }
  });
}

// --- TOP: Typographic header ---
// Flush left, Helvetica, systematic

elements.push({
  id: "header-num",
  type: "text",
  x: margin,
  y: 60,
  text: "01",
  align: "left",
  valign: "top",
  fontSize: 13,
  fontFamily: grotesk,
  weight: 700,
  fill: colors.red,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.2, value: 0, out: curves.precise },
          { time: 0.6, value: 1 }
        ]
      }
    }
  }
});

elements.push({
  id: "header-title",
  type: "text",
  x: margin,
  y: 88,
  text: "Grow Old\nWith Me",
  align: "left",
  valign: "top",
  fontSize: 82,
  fontFamily: grotesk,
  weight: 700,
  lineHeight: 0.95,
  fill: colors.black,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.3, value: 0, out: curves.precise },
          { time: 0.8, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 0.3, value: 100, out: curves.precise },
          { time: 0.8, value: 88 }
        ]
      }
    }
  }
});

// Thin horizontal rule
elements.push({
  id: "rule-1",
  type: "path",
  d: `M ${margin} 260 L ${width - margin} 260`,
  fill: "none",
  stroke: colors.black,
  strokeWidth: 1,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 0.5, value: 0, out: curves.linear },
          { time: 1.2, value: 1 }
        ]
      }
    }
  }
});

// Right-aligned subtitle
elements.push({
  id: "subtitle",
  type: "text",
  x: width - margin,
  y: 240,
  text: "The best is yet to be",
  align: "right",
  valign: "middle",
  fontSize: 16,
  fontFamily: grotesk,
  weight: 300,
  fill: colors.gray2,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.8, value: 0, out: curves.swiss },
          { time: 1.3, value: 1 }
        ]
      }
    }
  }
});

// --- PHOTO: spans 4 columns, aligned to grid ---
const photoX = margin;
const photoY = 290;
const photoW = colW * 4 + gutter * 3;
const photoH = 580;

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
          { time: 0.8, value: 0, out: curves.swiss },
          { time: 1.5, value: 1 }
        ]
      }
    }
  }
});

// --- RIGHT COLUMN: Data/metadata (columns 5-6) ---
const rightX = margin + (colW + gutter) * 4 + 10;

elements.push({
  id: "data-label-1",
  type: "text",
  x: rightX,
  y: 310,
  text: "PHOTOGRAPHER",
  align: "left",
  valign: "top",
  fontSize: 9,
  fontFamily: grotesk,
  weight: 700,
  letterSpacing: 1.5,
  fill: colors.gray3,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.4, value: 0, out: curves.precise },
          { time: 1.8, value: 1 }
        ]
      }
    }
  }
});

elements.push({
  id: "data-val-1",
  type: "text",
  x: rightX,
  y: 328,
  text: "Esther Ann",
  align: "left",
  valign: "top",
  fontSize: 15,
  fontFamily: grotesk,
  weight: 400,
  fill: colors.black,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.5, value: 0, out: curves.precise },
          { time: 1.9, value: 1 }
        ]
      }
    }
  }
});

elements.push({
  id: "data-label-2",
  type: "text",
  x: rightX,
  y: 380,
  text: "LOCATION",
  align: "left",
  valign: "top",
  fontSize: 9,
  fontFamily: grotesk,
  weight: 700,
  letterSpacing: 1.5,
  fill: colors.gray3,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.6, value: 0, out: curves.precise },
          { time: 2.0, value: 1 }
        ]
      }
    }
  }
});

elements.push({
  id: "data-val-2",
  type: "text",
  x: rightX,
  y: 398,
  text: "Coastal\nNorthwest",
  align: "left",
  valign: "top",
  fontSize: 15,
  fontFamily: grotesk,
  weight: 400,
  lineHeight: 1.4,
  fill: colors.black,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.7, value: 0, out: curves.precise },
          { time: 2.1, value: 1 }
        ]
      }
    }
  }
});

elements.push({
  id: "data-label-3",
  type: "text",
  x: rightX,
  y: 465,
  text: "DATE",
  align: "left",
  valign: "top",
  fontSize: 9,
  fontFamily: grotesk,
  weight: 700,
  letterSpacing: 1.5,
  fill: colors.gray3,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.8, value: 0, out: curves.precise },
          { time: 2.2, value: 1 }
        ]
      }
    }
  }
});

elements.push({
  id: "data-val-3",
  type: "text",
  x: rightX,
  y: 483,
  text: "28.05.2026",
  align: "left",
  valign: "top",
  fontSize: 15,
  fontFamily: mono,
  weight: 400,
  fill: colors.black,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 1.9, value: 0, out: curves.precise },
          { time: 2.3, value: 1 }
        ]
      }
    }
  }
});

// Red vertical accent (right column marker)
elements.push({
  id: "red-accent",
  type: "path",
  d: `M ${rightX - 12} 310 L ${rightX - 12} 500`,
  fill: "none",
  stroke: colors.red,
  strokeWidth: 2.5,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 1.4, value: 0, out: curves.swiss },
          { time: 2.2, value: 1 }
        ]
      }
    }
  }
});

// --- BOTTOM TEXT SECTION ---

// Rule above bottom text
elements.push({
  id: "rule-2",
  type: "path",
  d: `M ${margin} 900 L ${width - margin} 900`,
  fill: "none",
  stroke: colors.black,
  strokeWidth: 1,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 2.2, value: 0, out: curves.linear },
          { time: 2.9, value: 1 }
        ]
      }
    }
  }
});

// Large quote — clean, flush left
elements.push({
  id: "quote",
  type: "text",
  x: margin,
  y: 940,
  text: "The best is\nyet to be.",
  align: "left",
  valign: "top",
  fontSize: 96,
  fontFamily: grotesk,
  weight: 300,
  lineHeight: 1.05,
  fill: colors.black,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 2.5, value: 0, out: curves.swiss },
          { time: 3.2, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 2.5, value: 955, out: curves.precise },
          { time: 3.2, value: 940 }
        ]
      }
    }
  }
});

// Author — small, systematic
elements.push({
  id: "author",
  type: "text",
  x: margin,
  y: 1160,
  text: "Robert Browning",
  align: "left",
  valign: "top",
  fontSize: 14,
  fontFamily: grotesk,
  weight: 400,
  fill: colors.gray2,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.2, value: 0, out: curves.swiss },
          { time: 3.6, value: 1 }
        ]
      }
    }
  }
});

// Bottom rule
elements.push({
  id: "rule-3",
  type: "path",
  d: `M ${margin} 1200 L ${width - margin} 1200`,
  fill: "none",
  stroke: colors.gray4,
  strokeWidth: 0.5,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 3.4, value: 0, out: curves.linear },
          { time: 4.0, value: 1 }
        ]
      }
    }
  }
});

// Footer: systematic info row
elements.push({
  id: "footer-left",
  type: "text",
  x: margin,
  y: 1230,
  text: "SERIES 01 / ENDURING",
  align: "left",
  valign: "top",
  fontSize: 9,
  fontFamily: grotesk,
  weight: 700,
  letterSpacing: 2,
  fill: colors.gray3,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.6, value: 0, out: curves.swiss },
          { time: 4.0, value: 1 }
        ]
      }
    }
  }
});

elements.push({
  id: "footer-right",
  type: "text",
  x: width - margin,
  y: 1230,
  text: "PAGE 01 OF 06",
  align: "right",
  valign: "top",
  fontSize: 9,
  fontFamily: grotesk,
  weight: 400,
  letterSpacing: 2,
  fill: colors.gray3,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.7, value: 0, out: curves.swiss },
          { time: 4.1, value: 1 }
        ]
      }
    }
  }
});

// Large background number (Swiss poster tradition)
elements.push({
  id: "bg-number",
  type: "text",
  x: width - margin,
  y: 1260,
  text: "01",
  align: "right",
  valign: "top",
  fontSize: 120,
  fontFamily: grotesk,
  weight: 700,
  fill: colors.black,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.8, value: 0, out: curves.swiss },
          { time: 4.3, value: 0.04 }
        ]
      }
    }
  }
});

// Small red square (Swiss design accent)
elements.push({
  id: "red-square",
  type: "path",
  d: `M ${margin} 1260 H ${margin + 12} V 1272 H ${margin} Z`,
  fill: colors.red,
  stroke: "none",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.8, value: 0, out: curves.precise },
          { time: 4.1, value: 1 }
        ]
      }
    }
  }
});

const doc = {
  version: 1,
  canvas: { width, height, background: colors.white, duration, fps: 30 },
  elements
};

const outPath = path.join(__dirname, "couple-dock-insta.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
