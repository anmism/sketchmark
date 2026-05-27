const fs = require("fs");
const path = require("path");

const width = 800;
const height = 600;
const duration = 8;
const fps = 30;
const bg = "#e0f2fe";
const font = "Inter, system-ui, sans-serif";

const colors = {
  skin: "#fcd5b8",
  skinShadow: "#e8b896",
  hair: "#4a3728",
  eyeWhite: "#ffffff",
  eyePupil: "#1e293b",
  eyeHighlight: "#ffffff",
  mouth: "#dc2626",
  mouthInner: "#7f1d1d",
  teeth: "#ffffff",
  outline: "#1e293b",
  cheek: "#f9a8d4",
  speechBubble: "#ffffff",
  speechText: "#1e293b"
};

const curves = {
  ease: { type: "cubicBezier", x1: 0.4, y1: 0, x2: 0.2, y2: 1 },
  bounce: { type: "cubicBezier", x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
  snap: { type: "cubicBezier", x1: 0.5, y1: 0, x2: 0.5, y2: 1 }
};

const elements = [];

// Center position for face
const cx = 300;
const cy = 320;

// === BODY (simple shoulders) ===
elements.push({
  id: "body",
  type: "path",
  d: `M ${cx - 120} ${cy + 140} Q ${cx - 80} ${cy + 100} ${cx} ${cy + 110} Q ${cx + 80} ${cy + 100} ${cx + 120} ${cy + 140} L ${cx + 120} ${height + 20} L ${cx - 120} ${height + 20} Z`,
  fill: "#3b82f6",
  stroke: colors.outline,
  strokeWidth: 3
});

// === HEAD GROUP (for subtle bobbing) ===
elements.push({
  id: "head-group",
  type: "group",
  x: cx,
  y: cy,
  children: [
    // Hair back
    {
      id: "hair-back",
      type: "path",
      d: "M -85 -20 Q -95 -80 -60 -110 Q -20 -130 0 -130 Q 20 -130 60 -110 Q 95 -80 85 -20 Q 80 20 70 40 L -70 40 Q -80 20 -85 -20 Z",
      fill: colors.hair,
      stroke: colors.outline,
      strokeWidth: 3
    },
    // Head shape
    {
      id: "head",
      type: "path",
      d: "M -70 0 Q -80 -50 -60 -80 Q -30 -110 0 -110 Q 30 -110 60 -80 Q 80 -50 70 0 Q 75 50 50 80 Q 20 105 0 105 Q -20 105 -50 80 Q -75 50 -70 0 Z",
      fill: colors.skin,
      stroke: colors.outline,
      strokeWidth: 3
    },
    // Ears
    {
      id: "ear-left",
      type: "path",
      d: "M -70 -10 Q -90 -10 -90 10 Q -90 30 -70 30",
      fill: colors.skin,
      stroke: colors.outline,
      strokeWidth: 3
    },
    {
      id: "ear-right",
      type: "path",
      d: "M 70 -10 Q 90 -10 90 10 Q 90 30 70 30",
      fill: colors.skin,
      stroke: colors.outline,
      strokeWidth: 3
    },
    // Hair front
    {
      id: "hair-front",
      type: "path",
      d: "M -55 -75 Q -40 -60 -30 -70 Q -15 -85 0 -80 Q 15 -85 30 -70 Q 40 -60 55 -75 Q 70 -90 60 -100 Q 30 -115 0 -115 Q -30 -115 -60 -100 Q -70 -90 -55 -75 Z",
      fill: colors.hair,
      stroke: colors.outline,
      strokeWidth: 2
    },
    // Eyebrows
    {
      id: "eyebrow-left",
      type: "path",
      d: "M -50 -45 Q -35 -55 -20 -45",
      fill: "none",
      stroke: colors.hair,
      strokeWidth: 4,
      strokeCap: "round"
    },
    {
      id: "eyebrow-right",
      type: "path",
      d: "M 20 -45 Q 35 -55 50 -45",
      fill: "none",
      stroke: colors.hair,
      strokeWidth: 4,
      strokeCap: "round"
    },
    // Eye whites
    {
      id: "eye-white-left",
      type: "path",
      d: "M -50 -20 Q -35 -35 -20 -20 Q -35 -5 -50 -20 Z",
      fill: colors.eyeWhite,
      stroke: colors.outline,
      strokeWidth: 2
    },
    {
      id: "eye-white-right",
      type: "path",
      d: "M 20 -20 Q 35 -35 50 -20 Q 35 -5 20 -20 Z",
      fill: colors.eyeWhite,
      stroke: colors.outline,
      strokeWidth: 2
    },
    // Pupils (will animate)
    {
      id: "pupil-left",
      type: "path",
      d: "M -35 -20 m -6 0 a 6 6 0 1 1 12 0 a 6 6 0 1 1 -12 0 Z",
      fill: colors.eyePupil,
      stroke: "none"
    },
    {
      id: "pupil-right",
      type: "path",
      d: "M 35 -20 m -6 0 a 6 6 0 1 1 12 0 a 6 6 0 1 1 -12 0 Z",
      fill: colors.eyePupil,
      stroke: "none"
    },
    // Eye highlights
    {
      id: "highlight-left",
      type: "path",
      d: "M -38 -24 m -2 0 a 2 2 0 1 1 4 0 a 2 2 0 1 1 -4 0 Z",
      fill: colors.eyeHighlight,
      stroke: "none"
    },
    {
      id: "highlight-right",
      type: "path",
      d: "M 32 -24 m -2 0 a 2 2 0 1 1 4 0 a 2 2 0 1 1 -4 0 Z",
      fill: colors.eyeHighlight,
      stroke: "none"
    },
    // Nose
    {
      id: "nose",
      type: "path",
      d: "M 0 -10 L 8 20 Q 0 25 -8 20 Z",
      fill: colors.skinShadow,
      stroke: colors.outline,
      strokeWidth: 2
    },
    // Cheeks
    {
      id: "cheek-left",
      type: "path",
      d: "M -50 20 m -12 0 a 12 8 0 1 1 24 0 a 12 8 0 1 1 -24 0 Z",
      fill: colors.cheek,
      stroke: "none",
      opacity: 0.5
    },
    {
      id: "cheek-right",
      type: "path",
      d: "M 50 20 m -12 0 a 12 8 0 1 1 24 0 a 12 8 0 1 1 -24 0 Z",
      fill: colors.cheek,
      stroke: "none",
      opacity: 0.5
    },
    // Mouth closed (smile)
    {
      id: "mouth-closed",
      type: "path",
      d: "M -25 50 Q 0 62 25 50",
      fill: "none",
      stroke: colors.outline,
      strokeWidth: 3,
      strokeCap: "round",
      opacity: 1,
      timeline: {
        tracks: {
          opacity: {
            keyframes: [
              { time: 0, value: 1 },
              { time: 0.5, value: 0 },
              { time: 7, value: 0 },
              { time: 7.3, value: 1 }
            ]
          }
        }
      }
    },
    // Mouth open (for talking)
    {
      id: "mouth-open",
      type: "group",
      x: 0,
      y: 50,
      children: [
        {
          id: "mouth-shape",
          type: "path",
          d: "M -22 0 Q -25 -8 0 -10 Q 25 -8 22 0 Q 25 15 0 18 Q -25 15 -22 0 Z",
          fill: colors.mouthInner,
          stroke: colors.outline,
          strokeWidth: 3
        },
        {
          id: "teeth-top",
          type: "path",
          d: "M -15 -6 L -15 2 L -8 2 L -8 -4 L 0 -4 L 0 2 L 8 2 L 8 -4 L 15 -4 L 15 2 L 15 -8 Q 0 -10 -15 -6 Z",
          fill: colors.teeth,
          stroke: "none"
        },
        {
          id: "tongue",
          type: "path",
          d: "M -10 8 Q 0 18 10 8 Q 5 12 0 10 Q -5 12 -10 8 Z",
          fill: "#f87171",
          stroke: "none"
        }
      ],
      opacity: 0,
      origin: [0, 0],
      timeline: {
        tracks: {
          opacity: {
            keyframes: [
              { time: 0, value: 0 },
              { time: 0.5, value: 1 },
              { time: 7, value: 1 },
              { time: 7.3, value: 0 }
            ]
          },
          scaleY: {
            keyframes: [
              { time: 0.5, value: 0.3 },
              { time: 0.65, value: 1, out: curves.snap },
              { time: 0.8, value: 0.4 },
              { time: 0.95, value: 0.9, out: curves.snap },
              { time: 1.1, value: 0.3 },
              { time: 1.3, value: 1.1, out: curves.snap },
              { time: 1.5, value: 0.5 },
              { time: 1.7, value: 0.8, out: curves.snap },
              { time: 1.9, value: 0.3 },
              { time: 2.1, value: 1, out: curves.snap },
              { time: 2.3, value: 0.4 },
              { time: 2.5, value: 0.9, out: curves.snap },
              { time: 2.7, value: 0.3 },
              { time: 2.9, value: 1.1, out: curves.snap },
              { time: 3.1, value: 0.5 },
              { time: 3.3, value: 0.8, out: curves.snap },
              { time: 3.5, value: 0.3 },
              { time: 3.7, value: 1, out: curves.snap },
              { time: 3.9, value: 0.4 },
              { time: 4.1, value: 0.9, out: curves.snap },
              { time: 4.3, value: 0.3 },
              { time: 4.5, value: 1.1, out: curves.snap },
              { time: 4.7, value: 0.5 },
              { time: 4.9, value: 0.8, out: curves.snap },
              { time: 5.1, value: 0.3 },
              { time: 5.3, value: 1, out: curves.snap },
              { time: 5.5, value: 0.4 },
              { time: 5.7, value: 0.9, out: curves.snap },
              { time: 5.9, value: 0.3 },
              { time: 6.1, value: 1.1, out: curves.snap },
              { time: 6.3, value: 0.5 },
              { time: 6.5, value: 0.3 },
              { time: 7, value: 0.3 }
            ]
          }
        }
      }
    },
    // Eyelids for blinking
    {
      id: "eyelid-left",
      type: "path",
      d: "M -52 -20 Q -35 -37 -18 -20 L -52 -20 Z",
      fill: colors.skin,
      stroke: "none",
      opacity: 0,
      timeline: {
        tracks: {
          opacity: {
            keyframes: [
              { time: 2.0, value: 0 },
              { time: 2.05, value: 1 },
              { time: 2.15, value: 1 },
              { time: 2.2, value: 0 },
              { time: 5.0, value: 0 },
              { time: 5.05, value: 1 },
              { time: 5.15, value: 1 },
              { time: 5.2, value: 0 }
            ]
          }
        }
      }
    },
    {
      id: "eyelid-right",
      type: "path",
      d: "M 18 -20 Q 35 -37 52 -20 L 18 -20 Z",
      fill: colors.skin,
      stroke: "none",
      opacity: 0,
      timeline: {
        tracks: {
          opacity: {
            keyframes: [
              { time: 2.0, value: 0 },
              { time: 2.05, value: 1 },
              { time: 2.15, value: 1 },
              { time: 2.2, value: 0 },
              { time: 5.0, value: 0 },
              { time: 5.05, value: 1 },
              { time: 5.15, value: 1 },
              { time: 5.2, value: 0 }
            ]
          }
        }
      }
    }
  ],
  origin: [0, 0],
  timeline: {
    tracks: {
      // Subtle head bob while talking
      y: {
        keyframes: [
          { time: 0, value: cy },
          { time: 0.3, value: cy - 3, out: curves.ease },
          { time: 0.6, value: cy },
          { time: 1.0, value: cy - 4, out: curves.ease },
          { time: 1.3, value: cy },
          { time: 1.8, value: cy - 3, out: curves.ease },
          { time: 2.1, value: cy },
          { time: 2.5, value: cy - 5, out: curves.ease },
          { time: 2.9, value: cy },
          { time: 3.3, value: cy - 3, out: curves.ease },
          { time: 3.6, value: cy },
          { time: 4.0, value: cy - 4, out: curves.ease },
          { time: 4.4, value: cy },
          { time: 5.0, value: cy - 3, out: curves.ease },
          { time: 5.4, value: cy },
          { time: 6.0, value: cy - 4, out: curves.ease },
          { time: 6.4, value: cy },
          { time: 7.0, value: cy }
        ]
      },
      rotation: {
        keyframes: [
          { time: 0, value: 0 },
          { time: 1.5, value: 2, out: curves.ease },
          { time: 3, value: -2, out: curves.ease },
          { time: 4.5, value: 1, out: curves.ease },
          { time: 6, value: -1, out: curves.ease },
          { time: 7.5, value: 0, out: curves.ease }
        ]
      }
    }
  }
});


// === SPEECH BUBBLE ===
elements.push({
  id: "speech-bubble",
  type: "group",
  x: 580,
  y: 180,
  children: [
    {
      id: "bubble-shape",
      type: "path",
      d: "M 0 0 Q -20 0 -20 20 L -20 100 Q -20 120 0 120 L 140 120 Q 160 120 160 100 L 160 20 Q 160 0 140 0 L 40 0 L 20 -20 L 30 0 Z",
      fill: colors.speechBubble,
      stroke: colors.outline,
      strokeWidth: 3
    },
    {
      id: "speech-text-1",
      type: "text",
      x: 70,
      y: 35,
      text: "Hi there!",
      align: "center",
      valign: "top",
      fontSize: 18,
      fontFamily: font,
      weight: 600,
      fill: colors.speechText
    },
    {
      id: "speech-text-2",
      type: "text",
      x: 70,
      y: 60,
      text: "I'm a cartoon",
      align: "center",
      valign: "top",
      fontSize: 16,
      fontFamily: font,
      weight: 400,
      fill: colors.speechText
    },
    {
      id: "speech-text-3",
      type: "text",
      x: 70,
      y: 85,
      text: "character!",
      align: "center",
      valign: "top",
      fontSize: 16,
      fontFamily: font,
      weight: 400,
      fill: colors.speechText
    }
  ],
  opacity: 0,
  origin: [70, 60],
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.3, value: 0, out: curves.ease },
          { time: 0.7, value: 1 },
          { time: 6.5, value: 1, out: curves.ease },
          { time: 7, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: 0.3, value: 0.8, out: curves.bounce },
          { time: 0.7, value: 1 }
        ]
      }
    }
  }
});


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

const doc = {
  version: 1,
  canvas: { width, height, background: bg, duration, fps },
  elements
};

const outPath = path.join(__dirname, "talking-cartoon.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
