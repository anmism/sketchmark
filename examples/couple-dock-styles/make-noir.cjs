const fs = require("fs");
const path = require("path");

const imgPath = path.join(__dirname, "..", "couple-dock.jpg");
const imgBase64 = fs.readFileSync(imgPath).toString("base64");
const imgDataUri = `data:image/jpeg;base64,${imgBase64}`;

const width = 1080;
const height = 1350;
const duration = 5;

const serif = "Georgia, Times New Roman, serif";
const condensed = "Impact, Haettenschweiler, Arial Narrow, sans-serif";
const mono = "SFMono-Regular, Menlo, Courier New, monospace";

const easeOut = { type: "cubicBezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1 };

const elements = [];

// Background: near-black
elements.push({
  id: "bg",
  type: "path",
  d: `M 0 0 H ${width} V ${height} H 0 Z`,
  fill: "#0a0a0a",
  stroke: "none"
});

// --- Photo: large, centered horizontally ---
const photoW = 900;
const photoH = 700;
const photoX = (width - photoW) / 2;
const photoY = 340;

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
          { time: 0, value: 0, out: easeOut },
          { time: 2, value: 1 }
        ]
      }
    }
  }
});

// --- Gradient overlay: top (black to transparent over photo) ---
elements.push({
  id: "gradient-top",
  type: "path",
  d: `M ${photoX} ${photoY} H ${photoX + photoW} V ${photoY + 200} H ${photoX} Z`,
  fill: {
    type: "linearGradient",
    from: [photoX + photoW / 2, photoY],
    to: [photoX + photoW / 2, photoY + 200],
    stops: [
      { offset: 0, color: "#000000" },
      { offset: 1, color: "#0a0a0a" }
    ]
  },
  stroke: "none",
  opacity: 0.9
});

// --- Gradient overlay: bottom (transparent to black over photo) ---
elements.push({
  id: "gradient-bottom",
  type: "path",
  d: `M ${photoX} ${photoY + photoH - 200} H ${photoX + photoW} V ${photoY + photoH} H ${photoX} Z`,
  fill: {
    type: "linearGradient",
    from: [photoX + photoW / 2, photoY + photoH - 200],
    to: [photoX + photoW / 2, photoY + photoH],
    stops: [
      { offset: 0, color: "#0a0a0a" },
      { offset: 1, color: "#000000" }
    ]
  },
  stroke: "none",
  opacity: 0.9
});

// --- Letterbox bar: top ---
elements.push({
  id: "letterbox-top",
  type: "path",
  d: `M 0 0 H ${width} V 80 H 0 Z`,
  fill: "#000000",
  stroke: "none",
  y: -80,
  timeline: {
    tracks: {
      y: {
        keyframes: [
          { time: 0.3, value: -80, out: easeOut },
          { time: 1.2, value: 0 }
        ]
      }
    }
  }
});

// --- Letterbox bar: bottom ---
elements.push({
  id: "letterbox-bottom",
  type: "path",
  d: `M 0 ${height - 80} H ${width} V ${height} H 0 Z`,
  fill: "#000000",
  stroke: "none",
  y: 80,
  timeline: {
    tracks: {
      y: {
        keyframes: [
          { time: 0.3, value: 80, out: easeOut },
          { time: 1.2, value: 0 }
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
  y: 230,
  text: "GROW OLD WITH ME",
  align: "center",
  valign: "middle",
  fontSize: 60,
  fontFamily: condensed,
  weight: 700,
  letterSpacing: 6,
  fill: "#ffffff",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.5, value: 0, out: easeOut },
          { time: 1.5, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 0.5, value: 245, out: easeOut },
          { time: 1.5, value: 230 }
        ]
      }
    }
  }
});

// --- Thin white horizontal line below title ---
elements.push({
  id: "title-rule",
  type: "path",
  d: `M ${(width - 600) / 2} 290 L ${(width + 600) / 2} 290`,
  fill: "none",
  stroke: "#ffffff",
  strokeWidth: 1,
  drawStart: 0,
  drawEnd: 0,
  timeline: {
    tracks: {
      drawEnd: {
        keyframes: [
          { time: 1.0, value: 0, out: easeOut },
          { time: 2.0, value: 1 }
        ]
      }
    }
  }
});

// --- Tagline below photo ---
elements.push({
  id: "tagline",
  type: "text",
  x: width / 2,
  y: photoY + photoH + 50,
  text: "the best is yet to be",
  align: "center",
  valign: "middle",
  fontSize: 22,
  fontFamily: serif,
  weight: 400,
  fontStyle: "italic",
  fill: "#999999",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 2.0, value: 0, out: easeOut },
          { time: 3.0, value: 1 }
        ]
      }
    }
  }
});

// --- Film grain: ~30 tiny dots scattered randomly ---
const grainDots = [];
const rng = (seed) => {
  // Simple seeded pseudo-random for reproducibility
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
};
const rand = rng(42);

for (let i = 0; i < 30; i++) {
  const cx = Math.floor(rand() * width);
  const cy = Math.floor(rand() * height);
  const r = 1 + rand();
  const grainOpacity = 0.03 + rand() * 0.05;
  const fadeDelay = 1.5 + rand() * 2.5;

  grainDots.push({
    id: `grain-${i}`,
    type: "path",
    d: `M ${cx} ${cy} m -${r.toFixed(1)} 0 a ${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(r * 2).toFixed(1)} 0 a ${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 -${(r * 2).toFixed(1)} 0`,
    fill: "#ffffff",
    stroke: "none",
    opacity: 0,
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: fadeDelay, value: 0, out: easeOut },
            { time: fadeDelay + 0.8, value: grainOpacity }
          ]
        }
      }
    }
  });
}

elements.push(...grainDots);

// --- Credit at bottom ---
elements.push({
  id: "credit",
  type: "text",
  x: width / 2,
  y: height - 40,
  text: "DIRECTED BY LIFE — 2026",
  align: "center",
  valign: "middle",
  fontSize: 9,
  fontFamily: mono,
  weight: 400,
  letterSpacing: 2,
  fill: "#555555",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3.5, value: 0, out: easeOut },
          { time: 4.2, value: 1 }
        ]
      }
    }
  }
});

// --- Assemble document ---
const doc = {
  version: 1,
  canvas: { width, height, background: "#0a0a0a", duration, fps: 30 },
  elements
};

const outPath = path.join(__dirname, "noir.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
