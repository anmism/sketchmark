const fs = require("fs");
const path = require("path");

const width = 1280;
const height = 720;
const duration = 12;
const fps = 30;
const bg = "#0f172a";
const font = "Inter, system-ui, sans-serif";
const monoFont = "JetBrains Mono, Fira Code, monospace";

const colors = {
  headline: "#ffffff",
  subtext: "#94a3b8",
  accent: "#3b82f6",
  accentGlow: "#60a5fa",
  panelBg: "#1e293b",
  panelBorder: "#334155",
  codeBg: "#0f172a",
  codeText: "#e2e8f0",
  pillBg: "#3b82f6",
  pillText: "#ffffff",
  btnBg: "#ffffff",
  btnText: "#0f172a",
  labelText: "#64748b"
};

const curves = {
  easeOut: { type: "cubicBezier", x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
  easeInOut: { type: "cubicBezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 }
};

const elements = [];

// === SCENE 1: Logo + Tagline (0s - 3s) ===

// Logo text
elements.push({
  id: "logo",
  type: "text",
  x: width / 2,
  y: height / 2 - 40,
  text: "Sketchmark",
  align: "center",
  valign: "middle",
  fontSize: 72,
  fontFamily: font,
  weight: 800,
  fill: colors.headline,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0, value: 0, out: curves.easeOut },
          { time: 0.6, value: 1 },
          { time: 2.4, value: 1, out: curves.easeOut },
          { time: 3, value: 0 }
        ]
      },
      y: {
        keyframes: [
          { time: 0, value: height / 2 - 20, out: curves.easeOut },
          { time: 0.6, value: height / 2 - 40 }
        ]
      }
    }
  }
});

// Tagline
elements.push({
  id: "tagline",
  type: "text",
  x: width / 2,
  y: height / 2 + 30,
  text: "Visual documents as JSON",
  align: "center",
  valign: "middle",
  fontSize: 24,
  fontFamily: font,
  weight: 400,
  fill: colors.subtext,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 0.3, value: 0, out: curves.easeOut },
          { time: 0.9, value: 1 },
          { time: 2.4, value: 1, out: curves.easeOut },
          { time: 3, value: 0 }
        ]
      }
    }
  }
});

// === SCENE 2: Feature Pills (3s - 6s) ===

const features = ["Render", "Animate", "Export"];
const pillW = 140;
const pillH = 48;
const pillGap = 24;
const pillsStartX = (width - (pillW * 3 + pillGap * 2)) / 2;

features.forEach((label, i) => {
  const px = pillsStartX + i * (pillW + pillGap);
  const py = height / 2 - pillH / 2;
  const delay = i * 0.15;

  // Use a group to keep pill bg and text together
  elements.push({
    id: `pill-${i}`,
    type: "group",
    x: px,
    y: py,
    children: [
      {
        id: `pill-${i}-bg`,
        type: "path",
        d: roundedRect(0, 0, pillW, pillH, pillH / 2),
        fill: colors.pillBg,
        stroke: "none"
      },
      {
        id: `pill-${i}-text`,
        type: "text",
        x: pillW / 2,
        y: pillH / 2,
        text: label,
        align: "center",
        valign: "middle",
        fontSize: 18,
        fontFamily: font,
        weight: 600,
        fill: colors.pillText
      }
    ],
    opacity: 0,
    timeline: {
      tracks: {
        opacity: {
          keyframes: [
            { time: 3 + delay, value: 0, out: curves.easeOut },
            { time: 3.4 + delay, value: 1 },
            { time: 5.4, value: 1, out: curves.easeOut },
            { time: 6, value: 0 }
          ]
        },
        y: {
          keyframes: [
            { time: 3 + delay, value: py + 20, out: curves.easeOut },
            { time: 3.4 + delay, value: py }
          ]
        }
      }
    }
  });
});

// Scene 2 headline
elements.push({
  id: "scene2-headline",
  type: "text",
  x: width / 2,
  y: height / 2 - 80,
  text: "Three simple commands",
  align: "center",
  valign: "middle",
  fontSize: 20,
  fontFamily: font,
  weight: 500,
  fill: colors.subtext,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 3, value: 0, out: curves.easeOut },
          { time: 3.4, value: 1 },
          { time: 5.4, value: 1, out: curves.easeOut },
          { time: 6, value: 0 }
        ]
      }
    }
  }
});

// === SCENE 3: UI Panel Demo (6s - 10s) ===

const panelW = 600;
const panelH = 320;
const panelX = (width - panelW) / 2;
const panelY = (height - panelH) / 2 + 20;

// Panel background
elements.push({
  id: "panel-bg",
  type: "path",
  d: roundedRect(panelX, panelY, panelW, panelH, 12),
  fill: colors.panelBg,
  stroke: colors.panelBorder,
  strokeWidth: 1,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 6, value: 0, out: curves.easeOut },
          { time: 6.5, value: 1 },
          { time: 9.5, value: 1, out: curves.easeOut },
          { time: 10, value: 0 }
        ]
      },
      scale: {
        keyframes: [
          { time: 6, value: 0.95, out: curves.easeOut },
          { time: 6.5, value: 1 }
        ]
      }
    }
  }
});

// Panel title bar
elements.push({
  id: "panel-title",
  type: "text",
  x: panelX + 20,
  y: panelY + 20,
  text: "scene.visual.json",
  align: "left",
  valign: "top",
  fontSize: 12,
  fontFamily: monoFont,
  weight: 500,
  fill: colors.labelText,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 6.3, value: 0, out: curves.easeOut },
          { time: 6.7, value: 1 },
          { time: 9.5, value: 1, out: curves.easeOut },
          { time: 10, value: 0 }
        ]
      }
    }
  }
});

// Code preview
const codeContent = `{
  "version": 1,
  "canvas": { "width": 1280, "height": 720 },
  "elements": [
    {
      "id": "title",
      "type": "text",
      "text": "Hello World",
      "x": 640, "y": 360,
      "fontSize": 48
    }
  ]
}`;

elements.push({
  id: "panel-code",
  type: "text",
  x: panelX + 20,
  y: panelY + 48,
  text: codeContent,
  align: "left",
  valign: "top",
  fontSize: 13,
  fontFamily: monoFont,
  weight: 400,
  lineHeight: 1.45,
  fill: colors.codeText,
  opacity: 0,
  maxWidth: panelW - 40,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 6.5, value: 0, out: curves.easeOut },
          { time: 7, value: 1 },
          { time: 9.5, value: 1, out: curves.easeOut },
          { time: 10, value: 0 }
        ]
      }
    }
  }
});

// Scene 3 headline
elements.push({
  id: "scene3-headline",
  type: "text",
  x: width / 2,
  y: panelY - 50,
  text: "Define visuals in JSON",
  align: "center",
  valign: "middle",
  fontSize: 28,
  fontFamily: font,
  weight: 700,
  fill: colors.headline,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 6, value: 0, out: curves.easeOut },
          { time: 6.5, value: 1 },
          { time: 9.5, value: 1, out: curves.easeOut },
          { time: 10, value: 0 }
        ]
      }
    }
  }
});

// === SCENE 4: CTA (10s - 12s) ===

elements.push({
  id: "cta-headline",
  type: "text",
  x: width / 2,
  y: height / 2 - 60,
  text: "Start building",
  align: "center",
  valign: "middle",
  fontSize: 52,
  fontFamily: font,
  weight: 800,
  fill: colors.headline,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 10, value: 0, out: curves.easeOut },
          { time: 10.5, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 10, value: height / 2 - 40, out: curves.easeOut },
          { time: 10.5, value: height / 2 - 60 }
        ]
      }
    }
  }
});

// CTA button
const btnW = 200;
const btnH = 52;
const btnX = (width - btnW) / 2;
const btnY = height / 2 + 10;

elements.push({
  id: "cta-btn-bg",
  type: "path",
  d: roundedRect(btnX, btnY, btnW, btnH, 8),
  fill: colors.btnBg,
  stroke: "none",
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 10.3, value: 0, out: curves.easeOut },
          { time: 10.7, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 10.3, value: btnY + 20, out: curves.easeOut },
          { time: 10.7, value: btnY }
        ]
      }
    }
  }
});

elements.push({
  id: "cta-btn-text",
  type: "text",
  x: width / 2,
  y: btnY + btnH / 2,
  text: "Get Started",
  align: "center",
  valign: "middle",
  fontSize: 16,
  fontFamily: font,
  weight: 600,
  fill: colors.btnText,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 10.3, value: 0, out: curves.easeOut },
          { time: 10.7, value: 1 }
        ]
      },
      y: {
        keyframes: [
          { time: 10.3, value: btnY + btnH / 2 + 20, out: curves.easeOut },
          { time: 10.7, value: btnY + btnH / 2 }
        ]
      }
    }
  }
});

// Footer label
elements.push({
  id: "footer-label",
  type: "text",
  x: width / 2,
  y: height - 40,
  text: "sketchmark.dev",
  align: "center",
  valign: "middle",
  fontSize: 14,
  fontFamily: font,
  weight: 500,
  fill: colors.subtext,
  opacity: 0,
  timeline: {
    tracks: {
      opacity: {
        keyframes: [
          { time: 10.5, value: 0, out: curves.easeOut },
          { time: 11, value: 0.7 }
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

const outPath = path.join(__dirname, "product-demo.visual.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
console.log("Written:", outPath);
